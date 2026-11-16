import { createPool, demoContext } from '../src/config.js';
import { DomainError } from '../src/domain.js';
import { PgProductRepository } from '../src/repository.js';

const pool = createPool();
const repository = new PgProductRepository(pool);
try {
  const context = { ...demoContext('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), role: 'editor' as const };
  for (const product of [
    { sku: 'KB-001', name: 'Mechanical Keyboard', priceCents: 8900, stock: 12 },
    { sku: 'MS-001', name: 'Wireless Mouse', priceCents: 3500, stock: 30 },
  ]) {
    try {
      const result = await repository.create(context, product);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error instanceof DomainError && error.code === 'SKU_EXISTS') {
        console.log(`Seed ${product.sku} already exists; leaving it unchanged.`);
      } else throw error;
    }
  }
} catch {
  console.error('Seed failed. Check setup and the demo context.');
  process.exitCode = 1;
} finally { await pool.end(); }
