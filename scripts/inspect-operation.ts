import { parseArgs } from 'node:util';
import { createPool, demoContext } from '../src/config.js';
import { DomainError } from '../src/domain.js';
import { inspectEvidence } from '../src/evidence.js';

async function main() {
  const { values } = parseArgs({ options: {
    request:{type:'string'}, product:{type:'string'},
  }, strict:true, allowPositionals:false });
  // Separate operator connection: SELECT on products, audit_logs and operation_receipts.
  // DEMO identity is a local course fixture; production derives identity from authentication.
  const pool = createPool('DATABASE_INSPECT_URL');
  try {
    console.log(JSON.stringify(await inspectEvidence(pool,demoContext(),{
      requestId:values.request ?? null, productId:values.product ?? null,
    }),null,2));
  } finally { await pool.end(); }
}
main().catch(error => {
  console.error(error instanceof DomainError ? `${error.code}: ${error.message}`
    : 'Inspection stopped. Check selector UUIDs, operator identity, DATABASE_INSPECT_URL and SELECT permissions.');
  process.exitCode=1;
});
