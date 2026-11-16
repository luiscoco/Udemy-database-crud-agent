import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PgProductRepository, type DatabasePool } from '../../src/repository.js';
import type { AppContext, ProductRepository } from '../../src/domain.js';
export const tenant = '20202020-2020-4202-8202-202020202020';
export const foreignTenant = '21212121-2121-4212-8212-212121212121';
export const baseId = '22222222-2020-4202-8202-202020202020';
export const foreignId = '33333333-2020-4202-8202-202020202020';
export const context: AppContext = Object.freeze({ tenantId: tenant, userId: 'port20-editor', role: 'editor',
  requestId: '44444444-2020-4202-8202-202020202020' });
export const createArgs = { sku: 'PORT20-NEW', name: 'Portable pouch', priceCents: 2990, stock: 3 };
export const updateArgs = { id: baseId, expectedVersion: 1, name: null, priceCents: null, stock: 12 };
export const archiveArgs = { id: baseId, expectedVersion: 1 };
export async function frameworkFixture() {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../../sql/001_init.sql', import.meta.url), 'utf8'));
  let acquired = 0, released = 0;
  const query = async (sql: string, values: unknown[] = []) => {
    const result = await db.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const repo = new PgProductRepository({ query, connect: async () => {
    acquired++; return { query, release() { released++; } };
  } } as unknown as DatabasePool);
  const calls: any[] = [];
  const recording = Object.fromEntries(['list', 'get', 'create', 'update', 'softDelete'].map(method => [method,
    async (ctx: AppContext, args: unknown) => {
      const call: any = { method, context: structuredClone(ctx), arguments: structuredClone(args) };
      calls.push(call);
      const result = await (repo[method as keyof ProductRepository] as Function).call(repo, ctx, args);
      call.result = structuredClone(result); return result;
    }])) as unknown as ProductRepository;
  const reset = async () => {
    await db.exec('TRUNCATE audit_logs, operation_receipts, products');
    await db.query(`INSERT INTO products(id,tenant_id,sku,name,price_cents,stock)
      VALUES ($1,$2,'PORT20-BASE','Baseline product',4990,5),($3,$4,'PORT20-FOREIGN','Foreign product',1990,2)`,
    [baseId, tenant, foreignId, foreignTenant]);
    calls.length = 0; acquired = released = 0;
  };
  const snapshot = async (): Promise<any> => (await db.query(`SELECT
    (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY sku),'[]') FROM products p) AS products,
    (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM audit_logs a) AS audits,
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY request_key),'[]') FROM operation_receipts r) AS receipts`)).rows[0];
  return { db, repo, recording, calls, reset, snapshot, clients: () => ({ acquired, released }) };
}
export type FrameworkFixture = Awaited<ReturnType<typeof frameworkFixture>>;
const product = (p: any) => p === null ? null : ({ sku: p.sku, name: p.name,
  priceCents: p.priceCents ?? p.price_cents, stock: p.stock, version: p.version,
  archived: Boolean(p.deletedAt ?? p.deleted_at) });
/** Normalize generated identifiers and timestamps, retaining business and tenant effects. */
export function effects(snapshot: any) {
  const sort = (rows: any[]) => rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    products: sort(snapshot.products.map((p: any) => ({ tenantId: p.tenant_id, ...product(p) }))),
    audits: sort(snapshot.audits.map((a: any) => ({ tenantId: a.tenant_id, actorId: a.actor_id,
      action: a.action, before: product(a.before_data), after: product(a.after_data) }))),
    receipts: sort(snapshot.receipts.map((r: any) => ({ tenantId: r.tenant_id, actorId: r.actor_id,
      operation: r.operation, result: product(r.result) }))),
  };
}
