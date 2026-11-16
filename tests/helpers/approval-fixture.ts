import { randomUUID } from 'node:crypto';
import { Runner } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall } from '@openai/agents/testing';
import { createInventoryAgent } from '../../src/agent.js';
import type { AppContext, Product, ProductRepository } from '../../src/domain.js';
import type { MutationReceipt } from '../../src/tools.js';

export const context: AppContext = Object.freeze({
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId: 'sdk16-editor', role: 'editor',
  requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
});
export const product: Product = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', sku: 'SDK16-BASE', name: 'Scripted Product',
  priceCents: 4990, stock: 5, version: 1, deletedAt: null,
  createdAt: '2026-11-16T10:00:00.000Z', updatedAt: '2026-11-16T10:00:00.000Z',
};
export const createArgs = { sku: product.sku, name: product.name, priceCents: product.priceCents, stock: product.stock };
export const mutations = [
  { name: 'create_product', method: 'create', args: createArgs },
  { name: 'update_product', method: 'update', args: { id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: 12 } },
  { name: 'delete_product', method: 'softDelete', args: { id: product.id, expectedVersion: 1 } },
];
export function spyRepository() {
  const calls: { method: string; context: AppContext; input: unknown }[] = [];
  const writes: typeof calls = [];
  const record = (method: string, ctx: AppContext, input: unknown) => {
    const call = { method, context: structuredClone(ctx), input: structuredClone(input) };
    calls.push(call);
    if (['create', 'update', 'softDelete'].includes(method)) writes.push(call);
  };
  const repository: ProductRepository = {
    async list(ctx, input) { record('list', ctx, input); return { products: [product], nextOffset: null }; },
    async get(ctx, input) { record('get', ctx, input); return structuredClone(product); },
    async create(ctx, input) { record('create', ctx, input); return { product: { ...product, ...input }, replayed: false }; },
    async update(ctx, input) {
      record('update', ctx, input);
      return { product: { ...product, stock: input.stock ?? product.stock, version: 2 }, replayed: false };
    },
    async softDelete(ctx, input) {
      record('softDelete', ctx, input);
      return { product: { ...product, version: 2, deletedAt: '2026-11-16T10:01:00.000Z' }, replayed: false };
    },
  };
  return { repository, calls, writes };
}
export function scriptedCall(name: string, args: string | Record<string, unknown>) {
  return new ScriptedModel([
    [functionCall(name, args, { callId: randomUUID() })],
    [assistantMessage('Fixture finished; inspect the recorded tool outcome.')],
  ]);
}
export function harness(name: string, args: string | Record<string, unknown>, repository?: ProductRepository) {
  const spy = spyRepository();
  const model = scriptedCall(name, args);
  const receipts: MutationReceipt[] = [];
  const agent = createInventoryAgent(repository ?? spy.repository, model, receipt => receipts.push(receipt));
  agent.instructions = 'Fixture agent: follow the scripted steps. No business security guidance is supplied.';
  const runner = new Runner({ tracingDisabled: true });
  return { ...spy, model, receipts, agent, runner };
}
