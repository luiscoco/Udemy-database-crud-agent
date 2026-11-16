import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { before,beforeEach,after,test } from 'node:test';
import { Pool } from 'pg';
import { PgProductRepository } from '../../src/repository.js';
import { inspectEvidence } from '../../src/evidence.js';
import { DECISION_CAS_SQL } from '../../src/deployment-boundary.js';
import type { AppContext } from '../../src/domain.js';

const url=process.env.LESSON19_TEST_DATABASE_URL;
if(!url||process.env.LESSON19_EPHEMERAL!=='1') throw new Error('Use npm run test:postgres to create an isolated test database.');
const address=new URL(url);
if(address.hostname!=='127.0.0.1'||address.pathname!=='/lesson19') throw new Error('Expected the isolated loopback Lesson 19 database.');
const owner=new Pool({connectionString:url,max:8,connectionTimeoutMillis:5000});
let runtime:Pool,repo:PgProductRepository;
const evidence:Record<string,unknown>[]=[];
const tenantId=randomUUID();
const context=():AppContext=>({tenantId,userId:'postgres19-editor',role:'editor',requestId:randomUUID()});
const input={sku:'PG19-BASE',name:'Real PostgreSQL test',priceCents:4990,stock:5};
before(async()=>{
  await owner.query(await readFile(new URL('../../sql/001_init.sql',import.meta.url),'utf8'));
  await owner.query(await readFile(new URL('../../docs/deployment-pending.sql',import.meta.url),'utf8'));
  await owner.query("CREATE ROLE lesson19_runtime LOGIN PASSWORD 'runtime19_tests'");
  await owner.query('GRANT USAGE ON SCHEMA public TO lesson19_runtime');
  await owner.query('GRANT SELECT,INSERT,UPDATE ON products TO lesson19_runtime');
  await owner.query('GRANT INSERT ON audit_logs TO lesson19_runtime');
  await owner.query('GRANT SELECT,INSERT ON operation_receipts TO lesson19_runtime');
  const runtimeUrl=new URL(url);runtimeUrl.username='lesson19_runtime';runtimeUrl.password='runtime19_tests';
  runtime=new Pool({connectionString:runtimeUrl.toString(),max:8,connectionTimeoutMillis:5000});
  repo=new PgProductRepository(runtime);
});
beforeEach(async()=>{await owner.query('TRUNCATE approval_outbox,pending_approvals,audit_logs,operation_receipts,products');});
after(async()=>{
  try {
    if(process.env.LESSON19_POSTGRES_RESULTS) await writeFile(process.env.LESSON19_POSTGRES_RESULTS,
      JSON.stringify({database:'PostgreSQL 17',transport:'node-postgres TCP loopback',scenarios:evidence},null,2));
  } finally { await runtime?.end();await owner.end(); }
});
test('runtime grants permit repository transactions while rejecting DDL, physical deletion and audit reads',async()=>{
  const ctx=context(),created=await repo.create(ctx,input);
  assert.equal(created.product.stock,5);
  for(const sql of ['CREATE TABLE public.forbidden19(id int)','DELETE FROM products WHERE false',
    'SELECT * FROM audit_logs','UPDATE audit_logs SET actor_id=actor_id WHERE false'])
    await assert.rejects(runtime.query(sql),{code:'42501'});
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM products')).rows[0].n,1);
  evidence.push({id:'runtime-grants',forbiddenStatements:4,committedProducts:1});
});
test('two concurrent writes with one expected version produce one commit and one safe conflict',async()=>{
  const created=await repo.create(context(),input),left=context(),right=context();
  const update=(ctx:AppContext,stock:number)=>repo.update(ctx,{id:created.product.id,expectedVersion:1,name:null,priceCents:null,stock});
  const settled=await Promise.allSettled([update(left,12),update(right,13)]);
  assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
  const failed=settled.find(r=>r.status==='rejected') as PromiseRejectedResult;
  assert.equal(failed.reason.code,'CONFLICT');
  const report=await inspectEvidence(owner,left,{requestId:null,productId:created.product.id});
  assert.equal(report.products[0].version,2);assert.ok([12,13].includes(report.products[0].stock));
  assert.equal(report.audits.length,2);assert.equal(report.receipts.length,2);
  evidence.push({id:'concurrent-version-check',commits:1,conflicts:1,report});
});
test('concurrent exact calls serialize replay checks and create one product audit and receipt',async()=>{
  const ctx=context();
  const results=await Promise.all([repo.create(ctx,input),repo.create(ctx,input)]);
  assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true]);
  assert.equal(results[0].product.id,results[1].product.id);
  const report=await inspectEvidence(owner,ctx,{requestId:ctx.requestId,productId:null});
  assert.equal(report.products.length,1);assert.equal(report.audits.length,1);assert.equal(report.receipts.length,1);
  evidence.push({id:'concurrent-exact-replay',replayed:results.map(r=>r.replayed),report});
});
test('an audit constraint failure rolls back the transaction and pooled clients remain reusable',async()=>{
  await owner.query("ALTER TABLE audit_logs ADD CONSTRAINT pg19_fail CHECK (actor_id <> 'postgres19-editor')");
  try { await assert.rejects(repo.create(context(),input),{code:'DATABASE_ERROR'}); }
  finally { await owner.query('ALTER TABLE audit_logs DROP CONSTRAINT pg19_fail'); }
  const row=(await owner.query(`SELECT (SELECT count(*)::int FROM products) products,
    (SELECT count(*)::int FROM audit_logs) audits,(SELECT count(*)::int FROM operation_receipts) receipts`)).rows[0];
  assert.deepEqual(row,{products:0,audits:0,receipts:0});
  assert.equal((await runtime.query('SELECT 1 AS n')).rows[0].n,1);
  evidence.push({id:'audit-rollback-and-pool',counts:row,poolReused:true});
});
test('repository tenant scope and archived evidence work through the actual PostgreSQL driver',async()=>{
  const ctx=context(),created=await repo.create(ctx,input),foreign={...context(),tenantId:randomUUID()};
  await assert.rejects(repo.get(foreign,{id:created.product.id}),{code:'NOT_FOUND'});
  await repo.softDelete(context(),{id:created.product.id,expectedVersion:1});
  await assert.rejects(repo.get(ctx,{id:created.product.id}),{code:'NOT_FOUND'});
  const report=await inspectEvidence(owner,ctx,{requestId:null,productId:created.product.id});
  assert.ok(report.products[0].deleted_at);assert.equal(report.products[0].version,2);
  const hidden=await inspectEvidence(owner,foreign,{requestId:null,productId:created.product.id});
  assert.deepEqual(hidden.products,[]);assert.deepEqual(hidden.receipts,[]);assert.deepEqual(hidden.audits,[]);
  evidence.push({id:'tenant-and-archive',report,foreignVisibleRows:0});
});
test('competing approval decisions atomically produce one stored decision and one outbox row',async()=>{
  const id=randomUUID(),ctx=context(),sessionId=randomUUID(),conversationId=randomUUID();
  await owner.query(`INSERT INTO pending_approvals
    (id,tenant_id,actor_id,session_id,conversation_id,request_id,tool_call_id,tool_name,raw_arguments,
      proposal_digest,state_ciphertext,encryption_key_id,sdk_version,agent_revision,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,'call19','create_product','{}',$7,$8,'fixture-key','0.21.0','course-v19',now()+interval '1 minute')`,
    [id,ctx.tenantId,ctx.userId,sessionId,conversationId,ctx.requestId,'a'.repeat(64),Buffer.from('opaque fixture bytes, not production encryption')]);
  const decide=(decision:'approve'|'reject')=>owner.query(DECISION_CAS_SQL,
    [id,ctx.tenantId,ctx.userId,sessionId,conversationId,1,decision==='approve'?'approved':'rejected',decision]);
  const results=await Promise.all([decide('approve'),decide('reject')]);
  assert.deepEqual(results.map(r=>r.rowCount).sort(),[0,1]);
  const pending=(await owner.query('SELECT revision,status FROM pending_approvals WHERE id=$1',[id])).rows[0];
  const outbox=(await owner.query('SELECT decision FROM approval_outbox WHERE pending_id=$1',[id])).rows;
  assert.equal(pending.revision,2);assert.equal(outbox.length,1);
  assert.equal(pending.status,outbox[0].decision==='approve'?'approved':'rejected');
  evidence.push({id:'atomic-decision-outbox',winningDecisions:1,pending,outbox,
    encryptionImplemented:false,workerImplemented:false});
});
