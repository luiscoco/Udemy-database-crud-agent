import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPool, demoContext } from '../src/config.js';
import { PgProductRepository } from '../src/repository.js';

// Deliberately bypasses the agent to teach the deterministic domain contract.
// It creates and archives one DEMO-* row. It performs no model/API calls.
const pool = createPool();
const repository = new PgProductRepository(pool);
try {
  const ctx = demoContext();
  const input = { sku: `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`,
    name: 'Course Demo Product', priceCents: 4990, stock: 10 };
  const created = await repository.create(ctx, input);
  const replay = await repository.create(ctx, input);
  assert.equal(replay.replayed, true);
  assert.equal(replay.product.id, created.product.id);
  const read = await repository.get(ctx, { id: created.product.id });
  const updated = await repository.update(ctx, { id: read.id, expectedVersion: read.version,
    name: null, priceCents: 4490, stock: null });
  const archived = await repository.softDelete(ctx, { id: read.id, expectedVersion: updated.product.version });
  await assert.rejects(repository.get(ctx, { id: read.id }), { code: 'NOT_FOUND' });
  console.log(JSON.stringify({ created, replay, read, updated, archived }, null, 2));
  console.log('CRUD and replay scenario passed. The demo row remains archived with its audit history.');
} catch {
  console.error('Demo failed. Check database setup and DEMO_ROLE=editor. Inspect audit_logs before retrying.');
  process.exitCode = 1;
} finally { await pool.end(); }
