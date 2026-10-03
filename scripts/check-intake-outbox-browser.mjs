import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {execFileSync} from 'node:child_process';

const port=await new Promise(resolve=>{
  const server=createServer();server.listen(0,'127.0.0.1',()=>{
    const value=server.address().port;server.close(()=>resolve(value));
  });
});
const origin=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;
try{
  for(let i=0;i<80;i++){
    try{if((await fetch(origin+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch();
  const page=await browser.newPage();
  const baseline=process.env.B7_BROWSER_RED==='1';
  if(baseline){
    const old=execFileSync('git',['show','d4762f6:index.html'],{encoding:'utf8'});
    await page.route('**/index.html',route=>route.fulfill({contentType:'text/html',body:old}));
  }
  await page.goto(origin+'/index.html');
  await page.waitForFunction(()=>typeof createIntakeFixture==='function');
  const initial=await page.evaluate(async()=>{
    const config={files:2,fileBytes:1000,totalBytes:3000,pages:2,minDimension:1,maxDimension:1000,imageBytes:1000,
      requestBytes:2000,calls:2,retries:1,problemsPerPage:2,problemsPerJob:4,problemsPerSet:500,fieldChars:1000,blocks:10,items:10};
    const renderer={count:async()=>1,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
    const dbName='b7-browser-'+crypto.randomUUID();
    const outboxOptions={timeoutMs:400,fixture:{dropDelivery:true}};
    const client=createIntakeFixture({config,renderer,dbName,useOutbox:true,outboxOptions,editorsConfirmed:true});
    const {jobId}=await client.createJob([new File(['raw'],'fixture.png',{type:'image/png'})]);
    await client.run(jobId);
    const job=await client.readJob(jobId);
    return {dbName,jobId,config,state:job.pages[0].state,drafts:job.drafts.length,
      sw:(await navigator.serviceWorker.getRegistration('./'))?.active?.scriptURL};
  }).catch(error=>{
    if(baseline && /C1~C3/.test(error.message))return null;
    throw error;
  });
  if(baseline){
    assert.equal(initial,null,'d4762f6 should lack B7 transport');
    console.log('RED browser d4762f6: fixture cannot preserve an outbox reply');
  }else{
  assert.equal(initial.state,'locked');assert.equal(initial.drafts,0);
  assert.ok(initial.sw?.endsWith('/pedagogy-intake-sw.js'));
  await page.reload();
  await page.waitForFunction(()=>typeof createIntakeFixture==='function');
  const recovered=await page.evaluate(async args=>{
    const renderer={count:async()=>1,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
    const client=createIntakeFixture({config:args.config,renderer,dbName:args.dbName,
      useOutbox:true,editorsConfirmed:true});
    await client.run(args.jobId);
    const job=await client.readJob(args.jobId);
    return {state:job.pages[0].state,drafts:job.drafts.length,attemptId:job.pages[0].attemptId};
  },initial);
  assert.equal(recovered.state,'success');assert.equal(recovered.drafts,1);
  console.log('PASS browser SW persists before delivery and recovers after reload');
  }
}finally{await browser?.close();server.kill();}
