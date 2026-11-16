import test from 'node:test';
import assert from 'node:assert/strict';
import { toolResults } from '../evals/trace.js';
import { grade } from '../evals/grade.js';
test('SDK text content tool results are decoded while rejection prose stays non-JSON',()=>{
  assert.deepEqual(toolResults([
    {type:'function_call_result',output:{type:'text',text:'{"ok":true,"data":{"product":{"stock":3}}}'}},
    {type:'function_call_result',output:{type:'text',text:'Approval denied.'}},
    {type:'function_call_result',output:'{"ok":false,"error":{"code":"CONFLICT"}}'},
  ]),[{ok:true,data:{product:{stock:3}}},{ok:false,error:{code:'CONFLICT'}}]);
});
test('Host-blocked wrong model proposal can pass application checks and fail model checks',()=>{
  const baseline={products:[],audits:[],receipts:[]};
  const score=grade({id:'missing-price',category:'missing-information',prompt:'Create without price',
    decision:'forbid-write',missingField:'price'},
  {context:{},repositoryCalls:[],toolResults:[],toolCalls:[{name:'create_product'}],receipts:[],
    finalAnswer:'What price should I use?',before:baseline,after:baseline,clients:{acquired:0,released:0},
    approvals:[{policyMatched:false,pauseStateUnchanged:true,callbacksAtPause:0,writeSqlAtPause:0}]});
  assert.equal(score.applicationPassed,true);
  assert.equal(score.modelDecisionsPassed,false);
});
