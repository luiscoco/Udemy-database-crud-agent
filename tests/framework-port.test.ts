import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Runner } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall, modelError } from '@openai/agents/testing';
import { MockLanguageModelV4 } from 'ai/test';
import { createInventoryAgent } from '../src/agent.js';
import { reviewInterruption } from '../src/approval.js';
import { AiInventoryRun } from '../src/ai-sdk/adapter.js';
import type { AppContext } from '../src/domain.js';
import { context, baseId, foreignId, createArgs, updateArgs, archiveArgs,
  frameworkFixture, effects, type FrameworkFixture } from './helpers/framework-fixture.js';

type Call = { name: string; args: unknown };
type Scenario = { id: string; calls: Call[]; decision?: string; role?: 'reader'; error?: string;
  commits?: number; callbackCount?: number; mutateAtReview?: boolean; failAfterCommit?: boolean;
  breakNotification?: boolean; breakRead?: boolean; failAudit?: boolean; rejectSecond?: boolean };
const write = (name: string, args: unknown) => ({ name, args });
const scenarios: Scenario[] = [
  { id: 'read-list', calls: [write('list_products', { query: null, limit: 10, offset: 0 })], commits: 0 },
  { id: 'read-get', calls: [write('get_product', { id: baseId })], commits: 0 },
  ...[['create_product', createArgs], ['update_product', updateArgs], ['delete_product', archiveArgs]].flatMap(([name, args]) => [
    { id: `${name}-approve`, calls: [write(name as string, args)], commits: 1,
      decision: name === 'create_product' ? ' approve ' : 'approve' },
    { id: `${name}-reject`, calls: [write(name as string, args)], decision: 'reject', commits: 0 },
    { id: `${name}-reader`, calls: [write(name as string, args)], role: 'reader' as const, commits: 0 },
  ]),
  { id: 'unclear-decision', calls: [write('create_product', createArgs)], decision: 'yes', commits: 0 },
  ...['tenantId', 'userId', 'role', 'requestId'].map(field => ({ id: `identity-${field}`,
    calls: [write('create_product', { ...createArgs, [field]: 'forged' })], commits: 0 })),
  { id: 'malformed-json', calls: [write('create_product', '{')], commits: 0 },
  { id: 'wrong-shape', calls: [write('create_product', [])], commits: 0 },
  { id: 'unknown-tool', calls: [write('execute_sql', {})], commits: 0 },
  { id: 'duplicate-sku', calls: [write('create_product', { ...createArgs, sku: 'PORT20-BASE' })], commits: 0, error: 'SKU_EXISTS' },
  { id: 'missing-product', calls: [write('get_product', { id: '55555555-2020-4202-8202-202020202020' })], commits: 0, error: 'NOT_FOUND' },
  { id: 'foreign-product-read', calls: [write('get_product', { id: foreignId })], commits: 0, error: 'NOT_FOUND' },
  { id: 'foreign-product-update', calls: [write('update_product', { ...updateArgs, id: foreignId })], commits: 0 },
  { id: 'stale-update-after-preview', calls: [write('update_product', updateArgs)], mutateAtReview: true, commits: 1, error: 'CONFLICT' },
  { id: 'stale-archive-after-preview', calls: [write('delete_product', archiveArgs)], mutateAtReview: true, commits: 1, error: 'CONFLICT' },
  { id: 'exact-call-replay', calls: [write('create_product', createArgs), write('create_product', createArgs)], commits: 1, callbackCount: 2 },
  { id: 'new-call-new-approval', calls: [write('create_product', createArgs), write('create_product', { ...createArgs, sku: 'PORT20-SECOND' })], rejectSecond: true, commits: 1 },
  { id: 'audit-rollback', calls: [write('create_product', createArgs)], failAudit: true, commits: 0, error: 'DATABASE_ERROR' },
  { id: 'notification-failure', calls: [write('create_product', createArgs)], breakNotification: true, commits: 1 },
  { id: 'private-error', calls: [write('list_products', { query: null, limit: 10, offset: 0 })], breakRead: true, commits: 0, error: 'INTERNAL_ERROR' },
  { id: 'model-failure-after-commit', calls: [write('create_product', createArgs)], failAfterCommit: true, commits: 1 },
];
let fixtures: Record<string, FrameworkFixture>;
const results: any[] = [];
before(async () => { fixtures = { openai: await frameworkFixture(), ai: await frameworkFixture() }; });
after(async () => {
  await Promise.all(Object.values(fixtures).map(f => f.db.close()));
  if (process.env.LESSON20_PORT_RESULTS) await writeFile(process.env.LESSON20_PORT_RESULTS,
    JSON.stringify({ sdkVersions: { openai: '0.21.0', ai: '7.0.173' }, scriptedModels: true, liveModelApiCalls: 0, results }, null, 2));
});
function aiModel(spec: Scenario) {
  let index = 0;
  return new MockLanguageModelV4({ doGenerate: async () => {
    if (index === spec.calls.length && spec.failAfterCommit) throw new Error('SCRIPTED_POST_COMMIT_FAILURE');
    const call = spec.calls[index++];
    return { content: call ? [{ type: 'tool-call' as const, toolCallId: `call-${index}`, toolName: call.name,
      input: typeof call.args === 'string' ? call.args : JSON.stringify(call.args) }]
      : [{ type: 'text' as const, text: 'Fixture complete; inspect stored evidence.' }],
    finishReason: { unified: call ? 'tool-calls' as const : 'stop' as const, raw: undefined },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined } }, warnings: [] };
  } });
}
async function execute(framework: 'openai' | 'ai', spec: Scenario) {
  const f = fixtures[framework]!; await f.reset();
  const ctx: AppContext = Object.freeze({ ...context, role: spec.role ?? 'editor' });
  const baseline = effects(await f.snapshot());
  const notifications: any[] = [], previews: any[] = [], reviewErrors: string[] = [];
  const onMutation = (receipt: unknown) => { notifications.push(receipt); if (spec.breakNotification) throw new Error('NOTIFIER_DOWN'); };
  const originalList = f.recording.list;
  if (spec.breakRead) f.recording.list = async () => { throw new Error('postgres://secret-user:private-password@private-db/internal_table'); };
  if (spec.failAudit) await f.db.exec("ALTER TABLE audit_logs ADD CONSTRAINT port20_fail CHECK (actor_id <> 'port20-editor')");
  const io = {
    async display(preview: any) {
      // Host preview reads are allowed, but the mutation itself has not run at this pause.
      const beforeMutations = f.calls.filter(c => ['create', 'update', 'softDelete'].includes(c.method)).length;
      if (!previews.length) {
        assert.equal(beforeMutations, 0); assert.deepEqual(effects(await f.snapshot()), baseline);
      }
      previews.push(preview);
    },
    async ask() {
      if (spec.mutateAtReview) await f.repo.update({ ...context, requestId: '66666666-2020-4202-8202-202020202020' },
        { ...updateArgs, stock: 77 });
      return spec.rejectSecond && previews.length === 2 ? 'reject' : spec.decision ?? 'approve';
    }, error(message: string) { reviewErrors.push(message); },
  };
  let nativeOutput = '', stopped = false, pendingCalls = 0, finalAnswer: string | undefined;
  try {
    if (framework === 'openai') {
      const model = new ScriptedModel([
        ...spec.calls.map((call, i) => [functionCall(call.name, call.args as any, { callId: `call-${i + 1}` })]),
        ...(spec.failAfterCommit ? [modelError(new Error('SCRIPTED_POST_COMMIT_FAILURE'), { suggested: false })]
          : [[assistantMessage('Fixture complete; inspect stored evidence.')]]),
      ]);
      const agent = createInventoryAgent(f.recording, model, onMutation);
      const runner = new Runner({ tracingDisabled: true });
      let run = await runner.run(agent, 'Run the acceptance fixture.', { context: ctx, maxTurns: 8 });
      let rounds = 0;
      while (run.interruptions.length) {
        pendingCalls += run.interruptions.length;
        assert.ok(++rounds <= 8);
        for (const item of run.interruptions) await reviewInterruption(f.recording, ctx, item, run.state, io);
        run = await runner.run(agent, run.state, { context: ctx, maxTurns: 8 });
      }
      finalAnswer = run.finalOutput; nativeOutput = JSON.stringify(run.history); model.assertComplete();
    } else {
      const run = new AiInventoryRun(f.recording, aiModel(spec), ctx, 'Run the acceptance fixture.', onMutation);
      await run.start();
      let rounds = 0;
      while (run.pending.length) { pendingCalls += run.pending.length; assert.ok(++rounds <= 8); await run.review(io); }
      finalAnswer = run.finalAnswer; nativeOutput = JSON.stringify(run.history);
    }
  } catch (error) {
    stopped = true;
    if (spec.id === 'unknown-tool' && framework === 'openai') {
      assert.equal((error as Error).name, 'ModelBehaviorError');
      assert.match((error as Error).message, /Tool execute_sql not found/);
      nativeOutput = JSON.stringify({ error: 'ModelBehaviorError', message: 'Unknown tool rejected before repository entry.' });
    } else {
      if (!spec.failAfterCommit) throw error;
      assert.match((error as Error).message, /SCRIPTED_POST_COMMIT_FAILURE/);
    }
  } finally {
    if (spec.failAudit) await f.db.exec('ALTER TABLE audit_logs DROP CONSTRAINT port20_fail');
    if (spec.breakRead) f.recording.list = originalList;
  }
  const snapshot = await f.snapshot(), actual = effects(snapshot);
  assert.equal(snapshot.audits.length, spec.commits ?? 0);
  assert.equal(snapshot.receipts.length, spec.commits ?? 0);
  assert.equal(stopped, Boolean(spec.failAfterCommit || (spec.id === 'unknown-tool' && framework === 'openai')));
  if (spec.commits === 0) assert.deepEqual(actual, baseline);
  if (!stopped) assert.equal(finalAnswer, 'Fixture complete; inspect stored evidence.');
  if (spec.error) assert.ok(nativeOutput.includes(spec.error), `${framework} omitted ${spec.error}`);
  for (const secret of ['private-password', 'private-db', 'internal_table']) assert.ok(!nativeOutput.includes(secret));
  for (const call of f.calls) assert.deepEqual(call.context, ctx);
  const clients = f.clients(); assert.equal(clients.acquired, clients.released);
  if (spec.callbackCount !== undefined) assert.equal(notifications.length, spec.callbackCount);
  if (spec.rejectSecond) assert.equal(previews.length, 2);
  return { framework, id: spec.id, effects: actual, pendingCalls, previews: previews.length, notifications: notifications.length,
    finalAnswer, stopped, clients, nativeOutput, reviewErrors };
}
for (const spec of scenarios) test(`same acceptance: ${spec.id}`, async () => {
  const original = await execute('openai', spec), port = await execute('ai', spec);
  assert.deepEqual(port.effects, original.effects);
  assert.equal(port.notifications, original.notifications);
  results.push({ id: spec.id, equivalentEffects: true,
    nativeLifecycleDiffers: original.stopped !== port.stopped || original.pendingCalls !== port.pendingCalls,
    original, port });
});
test('schema, domain, repository and every pre-existing deterministic test remain byte-identical', async () => {
  const before = JSON.parse(await readFile(new URL('./fixtures/lesson20-core-hashes.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(before))
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), hash, file);
});
