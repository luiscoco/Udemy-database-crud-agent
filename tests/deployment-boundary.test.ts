import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RunState } from '@openai/agents';
import { harness,createArgs,context as sdkContext } from './helpers/approval-fixture.js';
import { authorizeDecision,assertExactPending,serverTurn,type PendingApproval } from '../src/deployment-boundary.js';
const now=1700000000000;
const principal={userId:'server-user',sessionId:randomUUID(),expiresAt:now+60000};
const membership={userId:principal.userId,tenantId:randomUUID(),role:'editor' as const,active:true};
const conversationId=randomUUID();
const pending:PendingApproval={id:randomUUID(),revision:1,status:'pending',
  context:{tenantId:membership.tenantId,userId:principal.userId,role:'editor',requestId:randomUUID()},
  sessionId:principal.sessionId,conversationId,expiresAt:now+30000,callId:'call19',toolName:'update_product',
  rawArguments:'{"stock":12}',proposalDigest:'a'.repeat(64),sdkVersion:'0.21.0',agentRevision:'course-v19'};
const expected={sdkVersion:'0.21.0',agentRevision:'course-v19'};
const body={pendingId:pending.id,revision:1,decision:'approve'};
const decide=(p=pending,b:unknown=body,actor=principal,member=membership,conversation=conversationId)=>
  authorizeDecision(actor,member,p,b,conversation,expected,now);
test('server context comes from verified-adapter identity and membership with a fresh host request ID',()=>{
  const first=serverTurn(principal,membership,{conversationId,prompt:'Find a product'},now);
  const next=serverTurn(principal,membership,{conversationId,prompt:'Find another'},now);
  assert.equal(first.context.tenantId,membership.tenantId);assert.equal(first.context.userId,principal.userId);
  assert.notEqual(first.context.requestId,next.context.requestId);assert.ok(Object.isFrozen(first.context));
});
test('all four identity fields in a request body are rejected',()=>{
  for(const field of ['tenantId','userId','role','requestId'])
    assert.throws(()=>serverTurn(principal,membership,{conversationId,prompt:'Read', [field]:'forged'},now),{code:'VALIDATION_ERROR'});
});
test('expired sessions, revoked membership and another membership actor cannot start a turn',()=>{
  for(const [actor,member] of [[{...principal,expiresAt:now},membership],
    [principal,{...membership,active:false}],[principal,{...membership,userId:'different'}]] as const)
    assert.throws(()=>serverTurn(actor,member,{conversationId,prompt:'Read'},now),{code:'FORBIDDEN'});
});
test('input size and exact request shape are bounded before admission',()=>{
  for(const prompt of ['', 'x'.repeat(4001)])
    assert.throws(()=>serverTurn(principal,membership,{conversationId,prompt},now),{code:'VALIDATION_ERROR'});
});
test('an exact authorized decision preserves original request context and expected revision',()=>{
  const result=decide();assert.equal(result.decision,'approve');assert.deepEqual(result.context,pending.context);
  assert.equal(result.expectedRevision,1);assert.ok(Object.isFrozen(result.context));
});
test('another user, tenant or session cannot decide someone else pending operation',()=>{
  assert.throws(()=>decide(pending,body,{...principal,userId:'intruder'},{...membership,userId:'intruder'}),{code:'FORBIDDEN'});
  assert.throws(()=>decide(pending,body,principal,{...membership,tenantId:randomUUID()}),{code:'FORBIDDEN'});
  assert.throws(()=>decide(pending,body,{...principal,sessionId:randomUUID()}),{code:'FORBIDDEN'});
});
test('wrong conversation and wrong pending ID are denied',()=>{
  assert.throws(()=>decide(pending,body,principal,membership,randomUUID()),{code:'FORBIDDEN'});
  assert.throws(()=>decide(pending,{...body,pendingId:randomUUID()}),{code:'FORBIDDEN'});
});
test('fresh authorization rejects a revoked membership or downgraded reader',()=>{
  assert.throws(()=>decide(pending,body,principal,{...membership,active:false}),{code:'FORBIDDEN'});
  assert.throws(()=>authorizeDecision(principal,{...membership,role:'reader'},pending,body,conversationId,expected,now),{code:'FORBIDDEN'});
});
test('expired, already decided and stale-revision proposals fail closed',()=>{
  assert.throws(()=>decide({...pending,expiresAt:now}),{code:'CONFLICT'});
  assert.throws(()=>decide({...pending,status:'approved'}),{code:'CONFLICT'});
  assert.throws(()=>decide(pending,{...body,revision:2}),{code:'CONFLICT'});
});
test('SDK or agent recipe changes invalidate the stored approval',()=>{
  assert.throws(()=>decide({...pending,sdkVersion:'different'}),{code:'CONFLICT'});
  assert.throws(()=>decide({...pending,agentRevision:'different'}),{code:'CONFLICT'});
});
test('unclear text rejects and extra fields cannot replace the pending payload',()=>{
  assert.equal(decide(pending,{...body,decision:'yes'}).decision,'reject');
  assert.equal(decide(pending,{...body,decision:'reject'}).decision,'reject');
  assert.throws(()=>decide(pending,{...body,rawArguments:'forged'}),{code:'VALIDATION_ERROR'});
});
test('restored call ID, tool, raw arguments and proposal digest must all match',()=>{
  const restored={callId:pending.callId,toolName:pending.toolName,rawArguments:pending.rawArguments,proposalDigest:pending.proposalDigest};
  assert.doesNotThrow(()=>assertExactPending(pending,restored));
  for(const field of ['callId','toolName','rawArguments','proposalDigest'])
    assert.throws(()=>assertExactPending(pending,{...restored,[field]:'changed'}),{code:'CONFLICT'});
});
test('actual SDK state serializes and restores the pending item before a single approved callback',async()=>{
  const h=harness('create_product',createArgs);
  const paused=await h.runner.run(h.agent,'Propose fixture creation.',{context:sdkContext});
  assert.equal(h.writes.length,0);assert.equal(paused.interruptions.length,1);
  const snapshot=paused.state.toString({includeTracingApiKey:false});
  const restored=await RunState.fromString(h.agent,snapshot);
  const item=restored.getInterruptions()[0]!;
  assert.equal(item.name,paused.interruptions[0]!.name);
  assert.equal(item.arguments,paused.interruptions[0]!.arguments);
  assert.equal(h.writes.length,0);
  restored.approve(item);
  const finished=await h.runner.run(h.agent,restored);
  assert.equal(finished.interruptions.length,0);assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0]!.context,sdkContext);h.model.assertComplete();
});
