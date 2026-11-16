import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { DomainError, type AppContext, type DomainErrorCode } from '../src/domain.js';
import { PgProductRepository, type DatabasePool } from '../src/repository.js';

// PGlite runs PostgreSQL compiled to WASM. This verifies SQL/transaction behavior,
// but not pg network transport, real roles, TLS, or multiple-connection contention.
let database: PGlite;
let repository: PgProductRepository;
let acquired = 0;
let released = 0;
const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const context = (changes: Partial<AppContext> = {}): AppContext => ({
  tenantId: tenantA, userId: 'test-editor', role: 'editor', requestId: randomUUID(), ...changes,
});
const productInput = (changes: Partial<{ sku: string; name: string; priceCents: number; stock: number }> = {}) => ({
  sku: 'KB-001', name: 'Mechanical keyboard', priceCents: 8990, stock: 20, ...changes,
});
const expectCode = (code: DomainErrorCode) => (error: unknown): boolean => {
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, code);
  return true;
};
const scalar = async (sql: string): Promise<number> => {
  const result = await database.query<{ n: number }>(sql);
  return Number(result.rows[0]!.n);
};
const snapshot = async () => (await database.query(`SELECT
  (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id), '[]'::jsonb) FROM products p) AS products,
  (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id), '[]'::jsonb) FROM audit_logs a) AS audits,
  (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY tenant_id, request_key), '[]'::jsonb)
   FROM operation_receipts r) AS receipts`)).rows[0];

before(async () => {
  database = new PGlite();
  await database.exec(await readFile(new URL('../sql/001_init.sql', import.meta.url), 'utf8'));
  const query = async (sql: string, values: unknown[] = []) => {
    const result = await database.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length, fields: result.fields, command: '', oid: 0 };
  };
  const pool = { query, connect: async () => {
    acquired++;
    return { query, release() { released++; } };
  } } as unknown as DatabasePool;
  repository = new PgProductRepository(pool);
});

beforeEach(async () => {
  await database.exec('TRUNCATE audit_logs, operation_receipts, products');
  acquired = released = 0;
});

after(async () => { await database?.close(); });

test('CRUD persists, versions changes, archives, and records before/after audit in one transaction', async () => {
  const ctx = context();
  const created = await repository.create(ctx, productInput());
  assert.equal(created.replayed, false);
  assert.equal(created.product.version, 1);
  assert.equal(created.product.deletedAt, null);
  assert.equal('tenantId' in created.product, false);
  assert.deepEqual(await repository.get(ctx, { id: created.product.id }), created.product);

  const updated = await repository.update(ctx, {
    id: created.product.id, expectedVersion: 1, name: null, priceCents: 7990, stock: 0,
  });
  assert.equal(updated.product.priceCents, 7990);
  assert.equal(updated.product.stock, 0);
  assert.equal(updated.product.name, 'Mechanical keyboard');
  assert.equal(updated.product.version, 2);

  const archived = await repository.softDelete(ctx, { id: created.product.id, expectedVersion: 2 });
  assert.equal(archived.product.version, 3);
  assert.ok(archived.product.deletedAt);
  await assert.rejects(repository.get(ctx, { id: created.product.id }), expectCode('NOT_FOUND'));
  assert.deepEqual(await repository.list(ctx, { query: null, limit: 20, offset: 0 }), { products: [], nextOffset: null });
  assert.equal(await scalar('SELECT count(*) AS n FROM products'), 1);
  assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 3);
  assert.equal(await scalar('SELECT count(*) AS n FROM operation_receipts'), 3);
  const audit = await database.query<{ before_data: { stock: number }; after_data: { stock: number; version: number }; actor_id: string }>(
    "SELECT before_data, after_data, actor_id FROM audit_logs WHERE action = 'update'",
  );
  assert.equal(audit.rows[0]!.before_data.stock, 20);
  assert.equal(audit.rows[0]!.after_data.stock, 0);
  assert.equal(audit.rows[0]!.after_data.version, 2);
  assert.equal(audit.rows[0]!.actor_id, ctx.userId);
});

test('host tenant scope prevents reads, searches, updates, and archive across workspaces', async () => {
  const alice = context();
  const bob = context({ tenantId: tenantB });
  const created = await repository.create(alice, productInput());
  assert.equal((await repository.list(bob, { query: null, limit: 20, offset: 0 })).products.length, 0);
  await assert.rejects(repository.get(bob, { id: created.product.id }), expectCode('NOT_FOUND'));
  await assert.rejects(repository.update(bob, {
    id: created.product.id, expectedVersion: 1, name: 'Stolen', priceCents: null, stock: null,
  }), expectCode('NOT_FOUND'));
  await assert.rejects(repository.softDelete(bob, { id: created.product.id, expectedVersion: 1 }), expectCode('NOT_FOUND'));
  assert.equal((await repository.get(alice, { id: created.product.id })).version, 1);
  assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 1);
  // SKU uniqueness is scoped to a workspace, never global.
  const other = await repository.create(bob, productInput());
  assert.notEqual(other.product.id, created.product.id);
});

test('reader role cannot call repository writes even if bypassing agent instructions', async () => {
  const created = await repository.create(context(), productInput());
  const reader = context({ role: 'reader' });
  assert.equal((await repository.get(reader, { id: created.product.id })).sku, 'KB-001');
  await assert.rejects(repository.create(reader, productInput({ sku: 'KB-002' })), expectCode('FORBIDDEN'));
  await assert.rejects(repository.update(reader, {
    id: created.product.id, expectedVersion: 1, name: 'No', priceCents: null, stock: null,
  }), expectCode('FORBIDDEN'));
  await assert.rejects(repository.softDelete(reader, { id: created.product.id, expectedVersion: 1 }), expectCode('FORBIDDEN'));
  assert.equal(await scalar('SELECT count(*) AS n FROM products'), 1);
});

test('stale updates and archive requests fail without overwriting newer data', async () => {
  const ctx = context();
  const created = await repository.create(ctx, productInput());
  await repository.update(ctx, { id: created.product.id, expectedVersion: 1, name: null, priceCents: null, stock: 30 });
  await assert.rejects(repository.update(context(), {
    id: created.product.id, expectedVersion: 1, name: null, priceCents: null, stock: 12,
  }), expectCode('CONFLICT'));
  await assert.rejects(repository.softDelete(context(), { id: created.product.id, expectedVersion: 1 }), expectCode('CONFLICT'));
  const current = await repository.get(ctx, { id: created.product.id });
  assert.equal(current.stock, 30);
  assert.equal(current.version, 2);
  assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 2);
});

test('exact normalized repeated calls in one host request return receipts without duplicate effects', async () => {
  const ctx = context();
  const first = await repository.create(ctx, productInput({ sku: ' kb-001 ', name: ' Mechanical keyboard ' }));
  const replay = await repository.create(ctx, productInput());
  assert.deepEqual(replay.product, first.product);
  assert.equal(replay.replayed, true);
  const args = { id: first.product.id, expectedVersion: 1, name: null, priceCents: null, stock: 19 };
  const changed = await repository.update(ctx, args);
  const replayChanged = await repository.update(ctx, args);
  assert.deepEqual(replayChanged.product, changed.product);
  assert.equal(replayChanged.replayed, true);
  const deletion = { id: first.product.id, expectedVersion: 2 };
  const removed = await repository.softDelete(ctx, deletion);
  const replayRemoved = await repository.softDelete(ctx, deletion);
  assert.deepEqual(replayRemoved.product, removed.product);
  assert.equal(replayRemoved.replayed, true);
  assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 3);
  assert.equal(await scalar('SELECT count(*) AS n FROM operation_receipts'), 3);
});

test('replay scope does not cross new request IDs or actors, and archived SKUs remain reserved', async () => {
  const ctx = context();
  const created = await repository.create(ctx, productInput());
  await assert.rejects(repository.create(context(), productInput()), expectCode('SKU_EXISTS'));
  await assert.rejects(repository.create({ ...ctx, userId: 'another-editor' }, productInput()), expectCode('SKU_EXISTS'));
  await repository.softDelete(ctx, { id: created.product.id, expectedVersion: 1 });
  await assert.rejects(repository.create(context(), productInput()), expectCode('SKU_EXISTS'));
  assert.equal(await scalar('SELECT count(*) AS n FROM products'), 1);
  assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 2);
});

test('SQL-looking text remains data and literal LIKE wildcards do not broaden matches', async () => {
  const ctx = context();
  const malicious = "x'); DROP TABLE products; -- 100%_safe";
  const created = await repository.create(ctx, productInput({ name: malicious }));
  await repository.create(ctx, productInput({ sku: 'KB-002', name: '100 percent safe' }));
  assert.equal((await repository.get(ctx, { id: created.product.id })).name, malicious);
  const matches = await repository.list(ctx, { query: '%_safe', limit: 20, offset: 0 });
  assert.equal(matches.products.length, 1);
  assert.equal(matches.products[0]!.id, created.product.id);
  const injectionSearch = await repository.list(ctx, { query: "' OR 1=1 --", limit: 20, offset: 0 });
  assert.equal(injectionSearch.products.length, 0);
  assert.equal(await scalar('SELECT count(*) AS n FROM products'), 2);
});

test('bounded pagination is deterministic and validation rejects invalid or hidden fields', async () => {
  const ctx = context();
  for (let n = 1; n <= 3; n++) await repository.create(ctx, productInput({ sku: `KB-00${n}` }));
  const first = await repository.list(ctx, { query: null, limit: 2, offset: 0 });
  assert.equal(first.products.length, 2);
  assert.equal(first.nextOffset, 2);
  const second = await repository.list(ctx, { query: null, limit: 2, offset: first.nextOffset! });
  assert.equal(second.products.length, 1);
  assert.equal(second.nextOffset, null);
  assert.equal(new Set([...first.products, ...second.products].map(p => p.id)).size, 3);
  await assert.rejects(repository.list(ctx, { query: null, limit: 51, offset: 0 }), expectCode('VALIDATION_ERROR'));
  await assert.rejects(repository.create(ctx, productInput({ priceCents: -1 })), expectCode('VALIDATION_ERROR'));
  await assert.rejects(repository.create(ctx, productInput({ stock: 1.5 })), expectCode('VALIDATION_ERROR'));
  await assert.rejects(repository.create(ctx, { ...productInput(), tenantId: tenantB } as never), expectCode('VALIDATION_ERROR'));
  await assert.rejects(repository.update(ctx, {
    id: first.products[0]!.id, expectedVersion: 1, name: null, priceCents: null, stock: null,
  }), expectCode('VALIDATION_ERROR'));
});

test('audit failure rolls back the product mutation and prevents a receipt', async () => {
  // Force a genuine database failure after the product INSERT, before COMMIT.
  await database.exec("ALTER TABLE audit_logs ADD CONSTRAINT reject_test_actor CHECK (actor_id <> 'fail-audit')");
  try {
    await assert.rejects(repository.create(context({ userId: 'fail-audit' }), productInput()), expectCode('DATABASE_ERROR'));
    assert.equal(await scalar('SELECT count(*) AS n FROM products'), 0);
    assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 0);
    assert.equal(await scalar('SELECT count(*) AS n FROM operation_receipts'), 0);
  } finally {
    await database.exec('ALTER TABLE audit_logs DROP CONSTRAINT reject_test_actor');
  }
});

test('reader denials preserve complete database state without acquiring a write client', async () => {
  const product = (await repository.create(context(), productInput())).product;
  const beforeState = await snapshot();
  const beforeClients = acquired;
  const reader = context({ role: 'reader' });
  await assert.rejects(repository.create(reader, productInput({ sku: 'DENIED-15' })), expectCode('FORBIDDEN'));
  await assert.rejects(repository.update(reader, {
    id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: 99,
  }), expectCode('FORBIDDEN'));
  await assert.rejects(repository.softDelete(reader, { id: product.id, expectedVersion: 1 }), expectCode('FORBIDDEN'));
  assert.deepEqual(await snapshot(), beforeState);
  assert.equal(acquired, beforeClients);
  assert.equal(acquired, released);
});

test('stale mutations preserve every stored row and release transaction clients', async () => {
  const product = (await repository.create(context(), productInput())).product;
  await repository.update(context(), {
    id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: 30,
  });
  const beforeState = await snapshot();
  await assert.rejects(repository.update(context(), {
    id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: 12,
  }), expectCode('CONFLICT'));
  await assert.rejects(repository.softDelete(context(), { id: product.id, expectedVersion: 1 }), expectCode('CONFLICT'));
  assert.deepEqual(await snapshot(), beforeState);
  assert.equal(acquired, released);
});

test('missing and cross-tenant identifiers have the same safe error and no stored effects', async () => {
  const product = (await repository.create(context(), productInput())).product;
  const beforeState = await snapshot();
  const messages: string[] = [];
  for (const id of [product.id, randomUUID()]) {
    const other = context({ tenantId: tenantB });
    for (const work of [
      () => repository.get(other, { id }),
      () => repository.update(other, { id, expectedVersion: 1, name: null, priceCents: null, stock: 5 }),
      () => repository.softDelete(other, { id, expectedVersion: 1 }),
    ]) {
      await assert.rejects(work(), error => {
        expectCode('NOT_FOUND')(error);
        messages.push((error as DomainError).message);
        return true;
      });
    }
  }
  assert.equal(new Set(messages).size, 1);
  assert.deepEqual(await snapshot(), beforeState);
  assert.equal(acquired, released);
});

test('replay returns the original receipt without undoing a later committed update', async () => {
  const ctx = context();
  const first = await repository.create(ctx, productInput({ sku: ' kb-001 ', name: ' Mechanical keyboard ' }));
  const changed = await repository.update(context(), {
    id: first.product.id, expectedVersion: 1, name: null, priceCents: null, stock: 42,
  });
  const beforeState = await snapshot();
  const replay = await repository.create(ctx, productInput());
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.product, first.product); // Historical committed result, not a new read.
  assert.equal((await repository.get(context(), { id: changed.product.id })).stock, 42);
  assert.deepEqual(await snapshot(), beforeState);
  assert.equal(acquired, released);
});

test('different normalized arguments within one request are distinct versioned operations', async () => {
  const ctx = context();
  const product = (await repository.create(ctx, productInput())).product;
  const first = { id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: 19 };
  const second = { ...first, expectedVersion: 2, stock: 18 };
  await repository.update(ctx, first);
  const updated = await repository.update(ctx, second);
  assert.equal(updated.replayed, false);
  assert.equal(updated.product.version, 3);
  const beforeState = await snapshot();
  assert.equal((await repository.update(ctx, first)).replayed, true);
  assert.equal((await repository.update(ctx, second)).replayed, true);
  assert.deepEqual(await snapshot(), beforeState);
  assert.equal(await scalar('SELECT count(*) AS n FROM audit_logs'), 3);
  assert.equal(await scalar('SELECT count(*) AS n FROM operation_receipts'), 3);
});

test('percent, underscore, backslash and SQL-looking search text remain literal data', async () => {
  const ctx = context();
  const examples = [
    ['LIT15-PERCENT', 'literal%marker', '%marker'],
    ['LIT15-UNDER', 'literal_marker', '_marker'],
    ['LIT15-SLASH', 'literal\\marker', '\\marker'],
    ['LIT15-SQL', "x'); DROP TABLE products; --", 'DROP TABLE'],
  ];
  for (const [sku, name] of examples) await repository.create(ctx, productInput({ sku: sku!, name: name! }));
  const beforeState = await snapshot();
  for (const [sku, , query] of examples) {
    const page = await repository.list(ctx, { query: query!, limit: 10, offset: 0 });
    assert.deepEqual(page.products.map(p => p.sku), [sku]);
  }
  const none = await repository.list(ctx, { query: "' OR 1=1 --", limit: 10, offset: 0 });
  assert.deepEqual(none, { products: [], nextOffset: null });
  assert.deepEqual(await snapshot(), beforeState);
});

test('pagination uses the ID tie-breaker and excludes archived and foreign-tenant rows', async () => {
  const ctx = context();
  const ids: string[] = [];
  for (let n = 0; n < 5; n++) {
    ids.push((await repository.create(ctx, productInput({ sku: `PAGE15-${n}` }))).product.id);
  }
  const archived = (await repository.create(ctx, productInput({ sku: 'PAGE15-ARCHIVED' }))).product;
  await repository.softDelete(ctx, { id: archived.id, expectedVersion: 1 });
  await repository.create(context({ tenantId: tenantB }), productInput({ sku: 'PAGE15-FOREIGN' }));
  await database.exec("UPDATE products SET created_at = '2026-01-01T00:00:00Z'");
  const expected = [...ids].sort();
  for (let repeat = 0; repeat < 2; repeat++) {
    const seen: string[] = [];
    let offset = 0;
    while (true) {
      const page = await repository.list(ctx, { query: 'PAGE15-', limit: 2, offset });
      seen.push(...page.products.map(p => p.id));
      if (page.nextOffset === null) break;
      assert.equal(page.nextOffset, offset + 2);
      offset = page.nextOffset;
    }
    assert.deepEqual(seen, expected);
    assert.equal(new Set(seen).size, 5);
  }
  assert.deepEqual(await repository.list(ctx, { query: null, limit: 2, offset: 100 }), { products: [], nextOffset: null });
});

test('invalid pagination and identity fields preserve state before acquiring a write client', async () => {
  const ctx = context();
  const beforeState = await snapshot();
  for (const input of [
    { query: null, limit: 0, offset: 0 },
    { query: null, limit: 51, offset: 0 },
    { query: null, limit: 1, offset: -1 },
    { query: null, limit: 1, offset: 10001 },
  ]) await assert.rejects(repository.list(ctx, input), expectCode('VALIDATION_ERROR'));
  await assert.rejects(repository.create(ctx, { ...productInput(), tenantId: tenantB } as never), expectCode('VALIDATION_ERROR'));
  await assert.rejects(repository.create(ctx, productInput({ stock: 1.5 })), expectCode('VALIDATION_ERROR'));
  assert.deepEqual(await snapshot(), beforeState);
  assert.equal(acquired, 0);
});

test('audit constraint failure rolls back create, update and archive to complete prior state', async () => {
  const product = (await repository.create(context(), productInput())).product;
  await database.exec("ALTER TABLE audit_logs ADD CONSTRAINT reject_lesson15_actor CHECK (actor_id <> 'fail-audit15')");
  try {
    for (const operation of ['create', 'update', 'archive']) {
      const ctx = context({ userId: 'fail-audit15' });
      const beforeState = await snapshot();
      const work = operation === 'create'
        ? repository.create(ctx, productInput({ sku: 'ROLLBACK15-NEW' }))
        : operation === 'update'
          ? repository.update(ctx, { id: product.id, expectedVersion: 1, name: null, priceCents: null, stock: 99 })
          : repository.softDelete(ctx, { id: product.id, expectedVersion: 1 });
      await assert.rejects(work, expectCode('DATABASE_ERROR'));
      assert.deepEqual(await snapshot(), beforeState, `${operation} must preserve products, audits and receipts`);
      assert.equal(acquired, released);
    }
  } finally {
    await database.exec('ALTER TABLE audit_logs DROP CONSTRAINT reject_lesson15_actor');
  }
});
