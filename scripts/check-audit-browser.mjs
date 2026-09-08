import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.AUDIT_PLAYWRIGHT_ROOT||process.cwd(),'package.json'));
const {chromium}=require('playwright');
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const serverPort=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const server=spawn(process.env.HWPX_PYTHON||'python3',['serve.py','--port',String(serverPort)],{stdio:'ignore'});
let browser;
const failures=[];
async function checked(name,run){try{await run();}catch(e){failures.push(name+': '+e.message);}}
try{
 const base=`http://127.0.0.1:${serverPort}`;
 for(let i=0;i<70;i++){try{await fetch(base+'/health');break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch();const context=await browser.newContext();
 await context.route('**/*.workers.dev/**',r=>r.abort());
 const page=await context.newPage();await page.goto(base+'/regression-test.html');
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('완료'),null,{timeout:60000});
 console.log('REGRESSION',await page.locator('#summary').innerText());
 const failed=await page.locator('.row.fail').allTextContents();console.log('FAILED',failed);assert.deepEqual(failed,[]);
 const frame=page.frames().find(f=>new URL(f.url()||'about:blank').pathname==='/index.html');
 if(!frame)throw Error('missing app frame');
 const normalization=await frame.evaluate(()=>{
  const raw={id:'audit',name:'A',header:'가'.repeat(500),problems:[{id:'q',blocks:Array.from({length:51},()=>({type:'statement',data:{text:'body'}}))}]};
  const stored=setToDoc(raw,0),loaded=docToSet(stored);
  return {headerBefore:stored.header.length,headerAfter:loaded.header.length,blocksBefore:stored.problems[0].blocks.length,blocksAfter:loaded.problems[0].blocks.length};
 });
 await checked('036 normalization',()=>assert.deepEqual(normalization,{headerBefore:500,headerAfter:500,blocksBefore:51,blocksAfter:51}));
 console.log('CLOUD_NORMALIZATION',normalization);
 console.log('SERIALIZATION_BENCH',await frame.evaluate(()=>{
  const original=sets;const rows=[];
  try {for(const count of [100,500,2000]){
   sets=[{id:'bench',name:'bench',header:'',problems:Array.from({length:count},(_,i)=>({id:'q'+i,blocks:[{type:'statement',data:{text:'가'.repeat(1000)}}]}))}];
   const times=[];let bytes=0;
   for(let j=0;j<15;j++){const t=performance.now();bytes=snapshot().length;times.push(performance.now()-t);}
   times.sort((a,b)=>a-b);rows.push({problems:count,chars:bytes,medianMs:times[7],maxMs:times.at(-1)});
  }}finally{sets=original;}return rows;
 }));
 for(const endpoint of ['/render','/hwpx','/document-hwpx']){
  for(const body of ['[]','null','"text"','42']){
   await checked('039 '+endpoint+' '+body,async()=>{
   const response=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Exam-Client':'1'},body});
   assert.equal(response.status,400,endpoint+' '+body);assert.match((await response.json()).error,/object/);
   });
  }
 }
 assert.equal((await fetch(base+'/health')).status,200);
 assert.deepEqual(failures,[]);
 console.log('JSON_ROOT: 12 malformed requests rejected, server healthy');
}finally{await browser?.close();server.kill();}
