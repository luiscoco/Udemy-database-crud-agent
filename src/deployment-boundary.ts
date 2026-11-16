/** Lesson 19 reference policies. Not HTTP middleware, authentication or a wired service. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppContextSchema, DomainError, validate, type AppContext } from './domain.js';

// These are outputs of real auth and membership adapters, never request-body fields.
const PrincipalSchema=z.object({userId:z.string().min(1).max(128),sessionId:z.uuid(),expiresAt:z.number().int().positive()}).strict();
const MembershipSchema=z.object({userId:z.string(),tenantId:z.uuid(),role:z.enum(['reader','editor']),active:z.boolean()}).strict();
export type Principal=z.infer<typeof PrincipalSchema>;
export type Membership=z.infer<typeof MembershipSchema>;
export const ServerTurnSchema=z.object({conversationId:z.uuid(),prompt:z.string().trim().min(1).max(4000)}).strict();
export const DecisionSchema=z.object({pendingId:z.uuid(),revision:z.number().int().positive(),decision:z.string().max(20)}).strict();

function activeIdentity(principal:Principal,membership:Membership,now:number) {
  const actor=validate(PrincipalSchema,principal),member=validate(MembershipSchema,membership);
  if(!Number.isFinite(now)||actor.expiresAt<=now||!member.active||member.userId!==actor.userId)
    throw new DomainError('FORBIDDEN','This session or workspace membership is unavailable.');
  return {actor,member};
}
export function serverTurn(principal:Principal,membership:Membership,body:unknown,now:number) {
  const {actor,member}=activeIdentity(principal,membership,now);
  const turn=validate(ServerTurnSchema,body);
  const context=Object.freeze(AppContextSchema.parse({tenantId:member.tenantId,userId:actor.userId,
    role:member.role,requestId:randomUUID()}));
  // The server must also load and authorize this conversation before starting a run.
  return {turn,context,sessionId:actor.sessionId};
}

export type PendingApproval=Readonly<{
  id:string;revision:number;status:'pending'|'approved'|'rejected'|'completed'|'unknown';
  context:AppContext;sessionId:string;conversationId:string;expiresAt:number;
  callId:string;toolName:string;rawArguments:string;proposalDigest:string;
  sdkVersion:string;agentRevision:string;
}>;
/** Inputs loaded by server from trusted storage. Never hydrate SDK state from browser JSON. */
export function authorizeDecision(principal:Principal,membership:Membership,pending:PendingApproval,
  body:unknown,conversationId:string,expected:{sdkVersion:string;agentRevision:string},now:number) {
  const {actor,member}=activeIdentity(principal,membership,now);
  const decision=validate(DecisionSchema,body),context=validate(AppContextSchema,pending.context);
  if(member.role!=='editor'||context.role!=='editor'||member.tenantId!==context.tenantId
    ||actor.userId!==context.userId||actor.sessionId!==pending.sessionId
    ||conversationId!==pending.conversationId||decision.pendingId!==pending.id)
    throw new DomainError('FORBIDDEN','This pending operation is unavailable.');
  if(pending.status!=='pending'||!Number.isFinite(pending.expiresAt)||pending.expiresAt<=now
    ||pending.revision!==decision.revision||pending.sdkVersion!==expected.sdkVersion
    ||pending.agentRevision!==expected.agentRevision)
    throw new DomainError('CONFLICT','The proposal is expired, decided or incompatible. Review a fresh proposal.');
  // Persist this decision with CAS and an outbox in one transaction before scheduling resume.
  return {decision:decision.decision==='approve'?'approve' as const:'reject' as const,
    context:Object.freeze({...context}),pendingId:pending.id,expectedRevision:pending.revision};
}

export function assertExactPending(pending:PendingApproval,
  restored:{callId:string;toolName:string;rawArguments:string;proposalDigest:string}) {
  if(pending.callId!==restored.callId||pending.toolName!==restored.toolName
    ||pending.rawArguments!==restored.rawArguments||pending.proposalDigest!==restored.proposalDigest)
    throw new DomainError('CONFLICT','Stored approval does not match the restored pending call.');
}

/** Reference adapter SQL: use only after authorizeDecision and with trusted stored ownership. */
export const DECISION_CAS_SQL=`WITH decided AS (
  UPDATE pending_approvals SET status=$7,revision=revision+1,decided_at=now()
  WHERE id=$1 AND tenant_id=$2 AND actor_id=$3 AND session_id=$4
    AND conversation_id=$5 AND revision=$6 AND status='pending' AND expires_at>now()
  RETURNING id
) INSERT INTO approval_outbox (pending_id,decision)
  SELECT id,$8 FROM decided RETURNING pending_id`;

export const DEPLOYMENT_LIMITS=Object.freeze({
  implementedInCli:{maxTurns:8,approvalRounds:8,inputCharacters:4000,historyItems:120},
  proposedServer:{wallClockMs:90000,pendingTtlMs:900000,requestsPerMinute:20,
    concurrentRunsPerTenant:2,queuedRunsPerTenant:10,maxSerializedStateBytes:1000000},
  database:{poolMax:5,statementTimeoutMs:5000,lockTimeoutMs:2000},
  requiredAdapters:['verified authentication','conversation ownership','membership revalidation',
    'durable encrypted state','atomic decision and outbox','distributed rate/quota admission',
    'worker leases and fencing','deadline and cancellation','receipt reconciliation'],
});
