import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import OpenAI from 'openai';
import { Runner, setDefaultOpenAIClient } from '@openai/agents';
import { createInventoryAgent } from '../src/agent.js';
import { reviewInterruption } from '../src/approval.js';
import { CreateProductSchema, UpdateProductSchema, DeleteProductSchema } from '../src/domain.js';
import { CASE_IDS, defineCase } from './cases.js';
import { fixture } from './fixture.js';
import { grade } from './grade.js';
import { toolResults } from './trace.js';

const model = process.env.OPENAI_MODEL?.trim();
if (!model || !process.env.OPENAI_API_KEY) throw new Error('Configure OPENAI_MODEL and OPENAI_API_KEY.');
setDefaultOpenAIClient(new OpenAI({ apiKey:process.env.OPENAI_API_KEY,
  baseURL:'https://api.openai.com/v1', timeout:120000, maxRetries:1 }));
const root = resolve('dist/lesson17');
const runId = `${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`;
const out = resolve(root,'live-runs',runId);
await mkdir(resolve(out,'cases'),{recursive:true});
const hashes: Record<string,string> = {};
for (const file of ['src/agent.ts','src/tools.ts','src/repository.ts','src/approval.ts','src/domain.ts',
  'evals/live-agent.ts','evals/fixture.ts','evals/cases.ts','evals/grade.ts','evals/trace.ts']) {
  hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const results: any[] = [];
for (const id of CASE_IDS) {
  const f = await fixture();
  const spec = defineCase(id,f), context = f.context(), receipts: any[] = [], approvals: any[] = [];
  const record: any = { id, spec, context, model, runId, before:await f.snapshot(), approvals, receipts,
    toolCalls:[],toolResults:[], finalAnswer:'' };
  let history: any[] = [];
  try {
    const agent = createInventoryAgent(f.recording,model,r=>receipts.push(structuredClone(r)));
    const runner = new Runner({tracingDisabled:true});
    let result = await runner.run(agent,spec.prompt,{context,maxTurns:8});
    let rounds = 0;
    while (result.interruptions.length) {
      if (++rounds > 2) throw new Error('Evaluation approval-round bound exceeded.');
      for (const pending of result.interruptions) {
        const schema = pending.name==='create_product'?CreateProductSchema:
          pending.name==='update_product'?UpdateProductSchema:DeleteProductSchema;
        let normalizedArguments: unknown;
        try { normalizedArguments=schema.parse(JSON.parse(pending.arguments!)); } catch {}
        let policyMatched = pending.name===spec.expectedTool;
        try { assert.deepEqual(normalizedArguments,spec.expectedArguments); } catch { policyMatched=false; }
        const a: any = { tool:pending.name,rawArguments:pending.arguments,normalizedArguments,policyMatched,
          pauseStateUnchanged:JSON.stringify(await f.snapshot())===JSON.stringify(record.afterExternalChange??record.before),
          callbacksAtPause:f.calls.filter(c=>['create','update','softDelete'].includes(c.method)).length,
          writeSqlAtPause:f.sqlWrites.length };
        approvals.push(a);
        f.setPhase('host-review');
        a.review = await reviewInterruption(f.recording,context,pending,{
          approve(item) { assert.strictEqual(item,pending); a.decision='approve'; result.state.approve(item); },
          reject(item,options) { assert.strictEqual(item,pending); a.decision='reject'; result.state.reject(item,options); },
        },{
          display(preview) { a.preview=structuredClone(preview); },
          async ask() {
            if (policyMatched && spec.injectVersionChange) {
              record.externalChange = await f.repo.update(f.context(),{id:spec.targetId!,expectedVersion:1,
                name:null,priceCents:null,stock:77});
              record.afterExternalChange = await f.snapshot();
            }
            return policyMatched && spec.decision==='approve'?'approve':'reject';
          },
          error(message) { a.reviewError=message; },
        });
        f.setPhase('tool-execution');
      }
      const sameState = result.state;
      result = await runner.run(agent,sameState,{context,maxTurns:8});
    }
    record.finalAnswer = result.finalOutput ?? '';
    history = result.history;
    record.usage = result.state.usage;
  } catch (error) {
    record.runError = {name:(error as Error).name,message:(error as Error).message.replace(/sk-[\w-]+/g,'[redacted]').slice(0,1200)};
  } finally {
    record.repositoryCalls = structuredClone(f.calls);
    record.sqlWrites = [...f.sqlWrites];
    record.after = await f.snapshot();
    record.clients = f.clients();
    await f.db.close();
  }
  record.history = history;
  record.toolCalls = history.filter(item=>item.type==='function_call');
  record.toolResults = toolResults(history);
  const evaluation = grade(spec,record);
  const row = {id,category:spec.category,...evaluation};
  results.push(row);
  await writeFile(resolve(out,'cases',`${id}.json`),JSON.stringify({...record,evaluation},null,2));
  console.log(`${id}: application=${evaluation.applicationPassed} model=${evaluation.modelDecisionsPassed}`);
  for (const check of [...evaluation.applicationChecks,...evaluation.modelDecisionChecks])
    if (!check.passed) console.log(`  FAIL ${check.name}: ${check.detail}`);
  await writeFile(resolve(out,'progress.json'),JSON.stringify(results,null,2));
}
const summary = {runId,model,sdkVersion:'0.21.0',liveModel:true,completedAt:new Date().toISOString(),
  cases:results.length,applicationPassed:results.filter(r=>r.applicationPassed).length,
  modelDecisionsPassed:results.filter(r=>r.modelDecisionsPassed).length,
  passed:results.filter(r=>r.applicationPassed&&r.modelDecisionsPassed).length,
  failed:results.filter(r=>!r.applicationPassed||!r.modelDecisionsPassed).length,
  sourceHashes:hashes,evidenceDirectory:`live-runs/${runId}`,results,
  scope:'One real model run per case; programmatic exact-proposal operator decisions; sequential disposable PGlite database. Case-specific assertions and answer heuristics require human inspection; no universal reliability claim.'};
await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2));
await writeFile(resolve(root,'live-validation.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({runId,cases:summary.cases,passed:summary.passed,failed:summary.failed}));
process.exitCode=summary.failed?1:0;
