import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { toolResults } from './trace.js';
import { grade } from './grade.js';
const root=resolve('dist/lesson17');
const original=JSON.parse(await readFile(resolve(root,'live-validation.json'),'utf8'));
const directory=resolve(root,original.evidenceDirectory);
const results=[];
for (const row of original.results) {
  const record=JSON.parse(await readFile(resolve(directory,'cases',`${row.id}.json`),'utf8'));
  record.toolResults=toolResults(record.history);
  const evaluation=grade(record.spec,record);
  results.push({id:row.id,category:record.spec.category,...evaluation});
}
const updated={...original,results,applicationPassed:results.filter(r=>r.applicationPassed).length,
  modelDecisionsPassed:results.filter(r=>r.modelDecisionsPassed).length,
  passed:results.filter(r=>r.applicationPassed&&r.modelDecisionsPassed).length,
  failed:results.filter(r=>!r.applicationPassed||!r.modelDecisionsPassed).length,
  regradedAt:new Date().toISOString(),
  correction:'SDK text content wrappers now decoded before scoring. Original traces and scores preserved. Same model responses; zero additional API calls.',
  gradingHashes:Object.fromEntries(await Promise.all(['evals/grade.ts','evals/trace.ts','evals/regrade.ts'].map(async file=>
    [file,createHash('sha256').update(await readFile(file)).digest('hex')])))};
await writeFile(resolve(directory,'regraded-summary.json'),JSON.stringify(updated,null,2));
await writeFile(resolve(root,'live-validation.json'),JSON.stringify(updated,null,2));
console.log(JSON.stringify(updated,null,2));
process.exitCode=updated.failed?1:0;
