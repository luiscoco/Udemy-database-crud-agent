import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { Runner } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall, modelError } from '@openai/agents/testing';
import { createInventoryAgent } from '../src/agent.js';
import { runConversation } from '../src/conversation.js';
import { inspectEvidence } from '../src/evidence.js';
import { PgProductRepository, type DatabasePool } from '../src/repository.js';
import { type AppContext, type Product } from '../src/domain.js';
import type { MutationReceipt } from '../src/tools.js';

let db:PGlite, repository:PgProductRepository, pool:DatabasePool;
let queries:string[] = [], acquired=0, released=0;
const scenarios:Record<string,unknown>[]=[];
const tenantId='18181818-1818-4181-8181-181818181818';
const ctx=(overrides:Partial<AppContext>={}):AppContext=>Object.freeze({
  tenantId,userId:'evidence18-operator',role:'editor',requestId:randomUUID(),...overrides,
});
const input={sku:'EVIDENCE18',name:'Evidence product',priceCents:4990,stock:5};
const inspect=(context:AppContext,requestId:string|null,productId:string|null=null)=>
  inspectEvidence(pool,context,{requestId,productId});
before(async()=>{
  db=new PGlite();
  await db.exec(await readFile(new URL('../sql/001_init.sql',import.meta.url),'utf8'));
  const query=async(sql:string,values:unknown[]=[])=>{
    queries.push(sql);
    const r=await db.query(sql,values);
    return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};
  };
  pool={query,connect:async()=>{acquired++;return {query,release(){released++;}};}} as unknown as DatabasePool;
  repository=new PgProductRepository(pool);
});
beforeEach(async()=>{
  await db.exec('TRUNCATE audit_logs, operation_receipts, products');
  queries=[];acquired=released=0;
});
after(async()=>{
  assert.equal(acquired,released);
  await db?.close();
  if(process.env.LESSON18_RESULTS_PATH) await writeFile(process.env.LESSON18_RESULTS_PATH,
    JSON.stringify({sdkVersion:'0.21.0',scriptedModel:true,liveModel:false,scenarios},null,2));
});

test('request and product IDs link one durable receipt to the exact audit event',async()=>{
  const context=ctx(),created=await repository.create(context,input);
  queries=[];
  const report=await inspect(context,context.requestId,created.product.id);
  assert.equal(queries.length,1);assert.match(queries[0]!,/^WITH receipts/);
  assert.equal(report.receipts.length,1);assert.equal(report.audits.length,1);
  const receipt=report.receipts[0],audit=report.audits[0];
  assert.match(receipt.request_key,/^[a-f0-9]{64}$/);
  assert.equal(receipt.request_id,context.requestId);assert.equal(receipt.actor_id,context.userId);
  assert.equal(audit.product_id,created.product.id);assert.equal(audit.before_data,null);
  assert.deepEqual(receipt.result,audit.after_data);
  assert.deepEqual(receipt.matchingAuditIds,[audit.id]);
  assert.equal(report.products[0].stock,5);assert.equal(acquired,released);
  scenarios.push({id:'correlated-create',context,report});
});
test('one request may contain distinct operations and receipts link without a Cartesian join',async()=>{
  const context=ctx(),created=await repository.create(context,input);
  await repository.update(context,{id:created.product.id,expectedVersion:1,name:null,priceCents:null,stock:12});
  const report=await inspect(context,context.requestId);
  assert.equal(report.receipts.length,2);assert.equal(report.audits.length,2);
  assert.equal(report.products.length,1);
  assert.deepEqual(report.audits.map(a=>a.after_data.version),[1,2]);
  for(const r of report.receipts) assert.equal(r.matchingAuditIds.length,1);
  assert.equal(new Set(report.receipts.map(r=>r.request_key)).size,2);
  scenarios.push({id:'multiple-operations-one-request',report});
});
test('historical receipt values differ from the later current product snapshot',async()=>{
  const first=ctx(),created=await repository.create(first,input),second=ctx();
  await repository.update(second,{id:created.product.id,expectedVersion:1,name:null,priceCents:null,stock:12});
  const original=await inspect(first,first.requestId),history=await inspect(first,null,created.product.id);
  assert.equal(original.receipts[0].result.stock,5);assert.equal(original.receipts[0].result.version,1);
  assert.equal(original.products[0].stock,12);assert.equal(original.products[0].version,2);
  assert.equal(history.receipts.length,2);assert.equal(history.audits.length,2);
  scenarios.push({id:'historical-versus-current',original,history});
});
test('archived rows remain inspectable although normal product retrieval returns NOT_FOUND',async()=>{
  const context=ctx(),created=await repository.create(context,input),archiveContext=ctx();
  await repository.softDelete(archiveContext,{id:created.product.id,expectedVersion:1});
  await assert.rejects(repository.get(context,{id:created.product.id}),{code:'NOT_FOUND'});
  const report=await inspect(context,null,created.product.id);
  assert.equal(report.products[0].version,2);assert.ok(report.products[0].deleted_at);
  assert.deepEqual(report.audits.map(a=>a.action),['create','delete']);
  assert.ok(report.audits[1].after_data.deletedAt);
  scenarios.push({id:'archived-product-history',report});
});
test('host tenant scoping hides foreign requests and products in every evidence collection',async()=>{
  const foreign=ctx({tenantId:randomUUID()}),created=await repository.create(foreign,input),context=ctx();
  for(const [requestId,productId] of [[foreign.requestId,null],[null,created.product.id],[foreign.requestId,created.product.id]]) {
    const report=await inspect(context,requestId,productId);
    assert.deepEqual(report.receipts,[]);assert.deepEqual(report.audits,[]);assert.deepEqual(report.products,[]);
    assert.match(report.interpretation,/does not prove/);
  }
  scenarios.push({id:'tenant-isolation',hiddenLookups:3});
});
test('operator role, UUIDs, a selector and strict selector fields are checked before SQL',async()=>{
  queries=[];
  await assert.rejects(inspect(ctx({role:'reader'}),randomUUID()),{code:'FORBIDDEN'});
  await assert.rejects(inspect(ctx(),'invalid-uuid'),{code:'VALIDATION_ERROR'});
  await assert.rejects(inspect(ctx(),null),{code:'VALIDATION_ERROR'});
  await assert.rejects(inspectEvidence(pool,ctx(),{requestId:randomUUID(),productId:null,sql:'SELECT secret'} as any),{code:'VALIDATION_ERROR'});
  assert.equal(queries.length,0);
  scenarios.push({id:'strict-operator-selector',rejectedInputs:4,sqlQueries:0});
});
test('model failure after an approved commit leaves product, audit and stored receipt discoverable',async()=>{
  const model=new ScriptedModel([
    [functionCall('create_product',input,{callId:'evidence18-post-commit'})],
    modelError(new Error('SCRIPTED_MODEL_FAILURE_AFTER_COMMIT'),{suggested:false}),
  ]);
  const receipts:MutationReceipt[]=[],writes:string[]=[],errors:string[]=[];
  const agent=createInventoryAgent(repository,model,r=>{receipts.push(r);writes.push('[Database receipt] '+JSON.stringify(r));});
  const answers=['Create the evidence product.','approve','/quit'];
  let disposed=false;
  await runConversation({agent,repository,runner:new Runner({tracingDisabled:true}),identity:ctx(),
    io:{question:async()=>answers.shift()??null,write:m=>writes.push(m),error:m=>errors.push(m)},
    dispose:async()=>{disposed=true;}});
  assert.equal(receipts.length,1);assert.equal(model.calls.length,2);model.assertComplete();
  assert.equal(errors.length,1);assert.match(errors[0]!,/prior write may have committed/);
  assert.ok(!writes.some(w=>w.startsWith('\nAgent>')));assert.ok(disposed);
  const receipt=receipts[0]!,report=await inspect(ctx(),receipt.requestId,receipt.product.id);
  assert.equal(report.receipts.length,1);assert.equal(report.audits.length,1);
  assert.equal(report.products[0].stock,5);assert.equal(report.products[0].version,1);
  assert.equal(report.receipts[0].matchingAuditIds.length,1);
  assert.match(errors[0]!,new RegExp(receipt.requestId));assert.equal(acquired,released);
  scenarios.push({id:'post-commit-model-failure',modelCalls:2,finalAnswerReturned:false,
    hostMessages:writes,hostErrors:errors,notification:receipt,report,resourcesDisposed:disposed});
});
test('a failing notification callback cannot erase the committed receipt or turn tool success into failure',async()=>{
  const context=ctx();let callbackInvoked=0;
  const model=new ScriptedModel([[functionCall('create_product',input,{callId:'evidence18-notifier'})],
    [assistantMessage('Fixture continuation complete.')]]);
  const agent=createInventoryAgent(repository,model,()=>{callbackInvoked++;throw new Error('NOTIFIER_OFFLINE');});
  const runner=new Runner({tracingDisabled:true});
  let result=await runner.run(agent,'Create fixture.',{context});
  result.state.approve(result.interruptions[0]!);
  result=await runner.run(agent,result.state,{context});model.assertComplete();
  assert.equal(callbackInvoked,1);assert.match(JSON.stringify(model.lastCall?.request.input),/"ok\\?":true/);
  const report=await inspect(context,context.requestId);
  assert.equal(report.receipts.length,1);assert.equal(report.audits.length,1);
  scenarios.push({id:'notification-failure',callbackInvoked,report});
});
test('exact same normalized call replays its historical result without another audit or receipt',async()=>{
  const context=ctx(),created=await repository.create(context,input),later=ctx();
  await repository.update(later,{id:created.product.id,expectedVersion:1,name:null,priceCents:null,stock:12});
  const before=await inspect(context,null,created.product.id);
  const replay=await repository.create(context,input);
  assert.ok(replay.replayed);assert.equal(replay.product.version,1);assert.equal(replay.product.stock,5);
  const after=await inspect(context,null,created.product.id);
  assert.deepEqual(after,before);assert.equal(after.products[0].stock,12);
  scenarios.push({id:'exact-replay-historical',replay,before,after});
});
test('a new request ID is not deduplicated by the earlier request receipt',async()=>{
  const first=ctx(),created=await repository.create(first,input),second=ctx();
  await repository.update(second,{id:created.product.id,expectedVersion:1,name:null,priceCents:null,stock:12});
  const third=ctx();
  await repository.update(third,{id:created.product.id,expectedVersion:2,name:null,priceCents:null,stock:13});
  const report=await inspect(first,null,created.product.id);
  assert.equal(report.products[0].version,3);assert.equal(report.products[0].stock,13);
  assert.equal(report.receipts.length,3);assert.equal(new Set(report.receipts.map(r=>r.request_id)).size,3);
  scenarios.push({id:'new-request-distinct-operation',report});
});
test('failed audit insertion rolls back mutation and leaves no success evidence for that request',async()=>{
  const context=ctx();
  await db.exec("ALTER TABLE audit_logs ADD CONSTRAINT evidence18_fail CHECK (actor_id <> 'evidence18-operator')");
  try { await assert.rejects(repository.create(context,input),{code:'DATABASE_ERROR'}); }
  finally { await db.exec('ALTER TABLE audit_logs DROP CONSTRAINT evidence18_fail'); }
  const report=await inspect(context,context.requestId);
  assert.deepEqual(report.receipts,[]);assert.deepEqual(report.audits,[]);assert.deepEqual(report.products,[]);
  assert.match(report.interpretation,/does not prove/);assert.equal(acquired,released);
  scenarios.push({id:'audit-failure-rollback',report});
});
test('failed evidence lookup returns a safe unknown outcome without exposing driver details',async()=>{
  const broken={query:async()=>{throw new Error('private-db.example password=hidden SELECT private_table');}} as unknown as DatabasePool;
  await assert.rejects(inspectEvidence(broken,ctx(),{requestId:randomUUID(),productId:null}),error=>{
    assert.equal((error as any).code,'DATABASE_ERROR');
    assert.match((error as Error).message,/unconfirmed/);assert.doesNotMatch((error as Error).message,/private|password|hidden/);return true;
  });
  scenarios.push({id:'lookup-failure-safe-unknown'});
});
