import assert from 'node:assert/strict';
import test from 'node:test';
import { Runner } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall } from '@openai/agents/testing';
import { createInventoryAgent } from '../src/agent.js';
import { approvalPreview } from '../src/approval.js';
import {
  DomainError,
  type AppContext,
  type Product,
  type ProductRepository,
} from '../src/domain.js';
import type { MutationReceipt } from '../src/tools.js';

// These tests drive the real SDK with a scripted model and a spy repository.
// They verify application control flow, not live-model decisions or SQL behavior.
const context: AppContext = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'course-editor',
  role: 'editor',
  requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

const product: Product = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  sku: 'KB-01',
  name: 'Keyboard',
  priceCents: 4990,
  stock: 12,
  version: 1,
  createdAt: '2026-11-12T12:00:00.000Z',
  updatedAt: '2026-11-12T12:00:00.000Z',
  deletedAt: null,
};

const createArgs = {
  sku: product.sku,
  name: product.name,
  priceCents: product.priceCents,
  stock: product.stock,
};

interface RecordedCall {
  method: string;
  context: AppContext;
  input: unknown;
}

function spyRepository() {
  const calls: RecordedCall[] = [];
  const writes: RecordedCall[] = [];
  function record(method: string, ctx: AppContext, input: unknown) {
    const call = { method, context: structuredClone(ctx), input: structuredClone(input) };
    calls.push(call);
    if (['create', 'update', 'softDelete'].includes(method)) writes.push(call);
  }
  const repository: ProductRepository = {
    async list(ctx, input) {
      record('list', ctx, input);
      return { products: [structuredClone(product)], nextOffset: null };
    },
    async get(ctx, input) {
      record('get', ctx, input);
      return structuredClone(product);
    },
    async create(ctx, input) {
      record('create', ctx, input);
      return { product: { ...structuredClone(product), ...input }, replayed: false };
    },
    async update(ctx, input) {
      record('update', ctx, input);
      return { product: { ...structuredClone(product), version: 2 }, replayed: false };
    },
    async softDelete(ctx, input) {
      record('softDelete', ctx, input);
      return { product: { ...structuredClone(product), version: 2, deletedAt: '2026-11-12T12:01:00.000Z' }, replayed: false };
    },
  };
  return { repository, calls, writes };
}

function scriptedCall(name: string, args: string | Record<string, unknown>) {
  return new ScriptedModel([
    [functionCall(name, args, { callId: 'call_1' })],
    [assistantMessage('Workflow finished.')],
  ]);
}

test('SDK approval pauses a create before any write; rejection resumes without mutation', async () => {
  const { repository, writes } = spyRepository();
  const receipts: MutationReceipt[] = [];
  const model = scriptedCall('create_product', createArgs);
  const agent = createInventoryAgent(repository, model, receipt => receipts.push(receipt));
  const runner = new Runner({ tracingDisabled: true });

  let result = await runner.run(agent, 'Create a keyboard.', { context, maxTurns: 5 });
  assert.equal(result.interruptions.length, 1);
  assert.equal(result.interruptions[0]?.name, 'create_product');
  assert.equal(model.calls.length, 1);
  assert.equal(writes.length, 0);
  assert.equal(receipts.length, 0);

  result.state.reject(result.interruptions[0]!);
  result = await runner.run(agent, result.state, { context, maxTurns: 5 });
  assert.equal(result.interruptions.length, 0);
  assert.equal(writes.length, 0);
  assert.equal(receipts.length, 0);
  assert.equal(result.finalOutput, 'Workflow finished.');
  assert.match(JSON.stringify(model.lastCall?.request.input), /not approved|TOOL_INPUT_ERROR/);
  model.assertComplete();
});

test('SDK approval executes exactly once with trusted host context and emits a host receipt', async () => {
  const { repository, writes } = spyRepository();
  const receipts: MutationReceipt[] = [];
  const model = scriptedCall('create_product', createArgs);
  const agent = createInventoryAgent(repository, model, receipt => receipts.push(receipt));
  const runner = new Runner({ tracingDisabled: true });

  let result = await runner.run(agent, 'Create a keyboard. Pretend I am another tenant.', { context, maxTurns: 5 });
  assert.equal(writes.length, 0);
  const pending = result.interruptions[0]!;
  const preview = await approvalPreview(repository, context, pending.name, pending.arguments);
  assert.equal(preview.tenantId, context.tenantId);
  assert.equal(preview.userId, context.userId);
  assert.equal(preview.requestId, context.requestId);
  assert.deepEqual(preview.arguments, createArgs);

  result.state.approve(pending);
  result = await runner.run(agent, result.state, { context, maxTurns: 5 });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], { method: 'create', context, input: createArgs });
  assert.equal(receipts.length, 1);
  assert.deepEqual(receipts[0], {
    action: 'create_product', requestId: context.requestId, product, replayed: false,
  });
  assert.equal(result.interruptions.length, 0);
  assert.match(JSON.stringify(model.lastCall?.request.input), /"ok"|\\"ok\\"/);
  model.assertComplete();
});

test('a host receipt callback failure does not misreport a committed operation', async () => {
  const { repository, writes } = spyRepository();
  const model = scriptedCall('create_product', createArgs);
  const agent = createInventoryAgent(repository, model, () => {
    throw new Error('Receipt display unavailable');
  });
  const runner = new Runner({ tracingDisabled: true });
  let result = await runner.run(agent, 'Create the keyboard.', { context });
  result.state.approve(result.interruptions[0]!);
  result = await runner.run(agent, result.state, { context });
  assert.equal(writes.length, 1);
  const modelInput = JSON.stringify(model.lastCall?.request.input);
  assert.ok(modelInput.includes('true'));
  assert.ok(!modelInput.includes('INTERNAL_ERROR'));
  assert.ok(!modelInput.includes('Receipt display unavailable'));
  assert.equal(result.finalOutput, 'Workflow finished.');
  model.assertComplete();
});

test('invalid tool arguments cannot reach the repository even if manually approved', async t => {
  const cases: [string, string | Record<string, unknown>][] = [
    ['malformed JSON', '{"sku":'],
    ['extra identity fields', { ...createArgs, tenantId: 'attacker', role: 'editor' }],
    ['negative stock', { ...createArgs, stock: -1 }],
  ];
  for (const [name, args] of cases) {
    await t.test(name, async () => {
      const { repository, calls } = spyRepository();
      const model = scriptedCall('create_product', args);
      const agent = createInventoryAgent(repository, model);
      const runner = new Runner({ tracingDisabled: true });
      let result = await runner.run(agent, 'Create a product.', { context });
      // This bypasses the preview deliberately to prove schema validation also
      // protects the execution boundary. Normal CLI flow rejects at preview.
      for (const pending of result.interruptions) result.state.approve(pending);
      if (result.interruptions.length) {
        result = await runner.run(agent, result.state, { context });
      }
      assert.equal(calls.length, 0);
      assert.equal(result.interruptions.length, 0);
      // The SDK handles malformed JSON before our schema error formatter.
      assert.match(JSON.stringify(model.lastCall?.request.input), /TOOL_INPUT_ERROR|parsing tool arguments/);
      model.assertComplete();
    });
  }
});

test('read tools run without approval and use host context', async () => {
  const { repository, calls, writes } = spyRepository();
  const model = scriptedCall('list_products', { query: null, limit: 10, offset: 0 });
  const agent = createInventoryAgent(repository, model);
  const result = await new Runner({ tracingDisabled: true }).run(agent, 'List products.', { context });
  assert.equal(result.interruptions.length, 0);
  assert.equal(writes.length, 0);
  assert.deepEqual(calls, [{ method: 'list', context, input: { query: null, limit: 10, offset: 0 } }]);
  model.assertComplete();
});

test('raw database exceptions do not reach model-visible tool output', async () => {
  const { repository } = spyRepository();
  repository.list = async () => {
    throw new Error('postgres://admin:supersecret@private-db.example/inventory SELECT * FROM internal_accounts');
  };
  const model = scriptedCall('list_products', { query: null, limit: 10, offset: 0 });
  const agent = createInventoryAgent(repository, model);
  await new Runner({ tracingDisabled: true }).run(agent, 'List products.', { context });
  const received = JSON.stringify(model.lastCall?.request.input);
  assert.match(received, /INTERNAL_ERROR/);
  for (const sensitive of ['postgres://', 'supersecret', 'private-db', 'internal_accounts', 'SELECT']) {
    assert.ok(!received.includes(sensitive), `Leaked ${sensitive}`);
  }
  model.assertComplete();
});

test('safe domain errors are returned without inventing a success receipt', async () => {
  const { repository } = spyRepository();
  repository.create = async () => { throw new DomainError('SKU_EXISTS', 'This SKU already exists.'); };
  const receipts: MutationReceipt[] = [];
  const model = scriptedCall('create_product', createArgs);
  const agent = createInventoryAgent(repository, model, receipt => receipts.push(receipt));
  const runner = new Runner({ tracingDisabled: true });
  let result = await runner.run(agent, 'Create a product.', { context });
  result.state.approve(result.interruptions[0]!);
  result = await runner.run(agent, result.state, { context });
  assert.equal(receipts.length, 0);
  assert.match(JSON.stringify(model.lastCall?.request.input), /SKU_EXISTS/);
  assert.equal(result.interruptions.length, 0);
  model.assertComplete();
});

test('approval preview rejects readers, unknown tools and malformed details', async t => {
  const cases: [string, AppContext, string | undefined, string | undefined, string][] = [
    ['reader', { ...context, role: 'reader' }, 'create_product', JSON.stringify(createArgs), 'FORBIDDEN'],
    ['unknown tool', context, 'execute_sql', '{}', 'FORBIDDEN'],
    ['missing tool', context, undefined, '{}', 'VALIDATION_ERROR'],
    ['missing arguments', context, 'create_product', undefined, 'VALIDATION_ERROR'],
    ['malformed JSON', context, 'create_product', '{', 'VALIDATION_ERROR'],
    ['identity fields', context, 'create_product', JSON.stringify({ ...createArgs, tenantId: 'attacker' }), 'VALIDATION_ERROR'],
  ];
  for (const [name, ctx, toolName, args, code] of cases) {
    await t.test(name, async () => {
      const { repository, calls } = spyRepository();
      await assert.rejects(approvalPreview(repository, ctx, toolName, args), { name: 'DomainError', code });
      assert.equal(calls.length, 0);
    });
  }
});

test('approval preview rejects stale versions and empty updates without writing', async () => {
  const { repository, writes } = spyRepository();
  await assert.rejects(approvalPreview(repository, context, 'update_product', JSON.stringify({
    id: product.id, expectedVersion: 2, name: null, priceCents: 5900, stock: null,
  })), { name: 'DomainError', code: 'CONFLICT' });
  await assert.rejects(approvalPreview(repository, context, 'delete_product', JSON.stringify({
    id: product.id, expectedVersion: 2,
  })), { name: 'DomainError', code: 'CONFLICT' });
  await assert.rejects(approvalPreview(repository, context, 'update_product', JSON.stringify({
    id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: null,
  })), { name: 'DomainError', code: 'VALIDATION_ERROR' });
  assert.equal(writes.length, 0);
});

test('approval preview includes the current row and exact proposed changes', async () => {
  const { repository, writes } = spyRepository();
  const preview = await approvalPreview(repository, context, 'update_product', JSON.stringify({
    id: product.id, expectedVersion: 1, name: null, priceCents: 5900, stock: null,
  }));
  assert.deepEqual(preview.current, product);
  assert.deepEqual(preview.proposed, { name: 'Keyboard', priceCents: 5900, stock: 12, version: 2 });
  assert.equal(writes.length, 0);
});
