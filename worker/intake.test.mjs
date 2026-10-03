import assert from 'node:assert/strict';
import {createWorker} from './index.js';
import {intakeContract as C} from './intake-contract.js';
const limits={files:2,fileBytes:100000,totalBytes:200000,pages:4,minDimension:64,maxDimension:1000,imageBytes:10000,
  requestBytes:20000,calls:4,retries:1,problemsPerPage:2,problemsPerJob:8,problemsPerSet:500,fieldChars:100,blocks:10,items:10};
const problem={title:'',answer:'',blocks:[{type:'statement',text:'본문'}],units:[],difficulty:null,points:null,pointsState:'absent',group:null};
const result={task:C.TASK,problems:[problem]};
const body={task:C.TASK,imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:300,
  attempt:{jobId:'fixture-job',sourceId:'fixture-source',pageNumber:1,sourceHash:'a'.repeat(64),extractionContractHash:'b'.repeat(64),attemptId:'fixture-attempt',retry:false}};
const env={ALLOWED_ORIGINS:'https://app.test',AI_PROVIDER:'anthropic',ANTHROPIC_KEY:'fixture',ATTEMPT_HMAC_KEY:'k'.repeat(32),ATTEMPT_HMAC_VERSION:'v1',DAILY_LIMIT:'5',GLOBAL_DAILY_LIMIT:'0'};
const request=b=>new Request('https://worker.test/',{method:'POST',headers:{Origin:'https://app.test',Authorization:'Bearer fixture'},body:JSON.stringify(b)});
let quotas=0,generated=0,outcomes=[];
const deps={verifyToken:async()=>({uid:'fixture-owner',claims:{}}),recordMetric:()=>{},
  requestQuota:async(_env,_uid,op)=>{quotas++;return {ok:true,used:1,limit:5,pending:0};},
  requestLedger:async(_env,_identity,op,args)=>{if(op==='complete')outcomes.push(args.outcome);return {ok:true};},
  generateIntake:async()=>{generated++;return result;},intakeLimits:limits};
const disabled=createWorker({verifyToken:deps.verifyToken,requestQuota:deps.requestQuota});
assert.equal((await disabled.fetch(request(body),env)).status,503);assert.equal(quotas,0);
const worker=createWorker(deps);
assert.equal((await worker.fetch(request({...body,width:1}),env)).status,400);assert.equal(quotas,0);
assert.equal((await worker.fetch(request({...body,mode:'document',prompt:'x'}),env)).status,400);
assert.equal((await worker.fetch(request({...body,attempt:undefined}),env)).status,400);
const accepted=await worker.fetch(request(body),env);assert.equal(accepted.status,200);assert.equal(generated,1);
assert.equal((await accepted.json()).task,C.TASK);assert.deepEqual(outcomes,['success']);
const invalid=createWorker({...deps,generateIntake:async()=>({...result,problems:[{...problem,blocks:[{type:'image',url:'blob:x'}]}]})});
assert.equal((await invalid.fetch(request(body),env)).status,502);assert.deepEqual(outcomes,['success','failure']);
assert.throws(()=>C.validateResponse({...result,problems:[{...problem,points:5}]},limits),/배점/);
assert.throws(()=>C.validateResponse({...result,problems:[{...problem,blocks:[{type:'statement',text:'x'.repeat(101)}]}]},limits),/한도/);
assert.throws(()=>C.validateResponse({...result,problems:[problem,problem,problem]},limits),/문항/);
assert.throws(()=>C.limits({...limits,problemsPerSet:501}),/한도/);
assert.throws(()=>C.validateResponse({...result,problems:[{...problem,unsupported:true}]},limits),/확인/);
// Deliberately disable the schema check in the live validator's source; verify
// a formerly oversized response now slips through, proving the test's boundary.
const saved=C.validateResponse.toString();
const weakened=saved.replace('raw.problems.length>cap.problemsPerPage','false');
assert.notEqual(saved,weakened);
const red=new Function('limits','TASK','return ('+weakened+')')(C.limits,C.TASK);
assert.throws(()=>assert.throws(()=>red({...result,problems:[problem,problem,problem]},limits)),assert.AssertionError);
console.log('B6 Worker: default closed, task separation, pre-quota validation, strict response/ledger failure and red probe passed');
