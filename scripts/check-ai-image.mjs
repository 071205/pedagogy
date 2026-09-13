import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const red=process.env.AI_IMAGE_RED==='1';
const freePort=()=>new Promise(resolve=>{
  const server=createServer();
  server.listen(0,'127.0.0.1',()=>{
    const {port}=server.address();
    server.close(()=>resolve(port));
  });
});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6m4sAAAAASUVORK5CYII=';

async function waitFor(page, expression){
  await page.waitForFunction(expression,undefined,{timeout:10000});
}

async function openApp(browser, url){
  const page=await browser.newPage();
  await page.route('https://**/*',route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await waitFor(page,()=>typeof window.PedagogyAIImage?.create==='function');
  await page.evaluate(()=>{
    const script=document.createElement('script');
    script.textContent='window.__AI_IMAGE_HOOKS__={AI_MAX_DIM,AI_QUALITY,blobToBase64,prepImageForAI,aiBlocksToProblem};';
    document.head.append(script);script.remove();
  });
  return page;
}

async function checkFactory(page){
  const result=await page.evaluate(async()=>{
    const calls=[];
    const tools=window.PedagogyAIImage.create({
      fileToDataURL:async file=>{calls.push(['read',file.name]);return 'data:image/png;base64,AA==';},
      dataUrlToJpegBlob:async(...args)=>{calls.push(['jpeg',...args]);return new Blob(['abc'],{type:'image/jpeg'});},
      normProblem:value=>({...value,normalized:true}),
    });
    const image=await tools.prepImageForAI(new File(['x'],'sample.png',{type:'image/png'}));
    const problem=tools.aiBlocksToProblem({title:'제목',blocks:[
      {type:'statement',text:'본문'}, {type:'conditions',items:['조건']},
      {type:'choices',items:['1','2','3','4','5','6']}, {type:'unknown',text:'drop'}, null,
    ]});
    const empty=tools.aiBlocksToProblem(null);
    let rejected=false;
    try{await window.PedagogyAIImage.create({fileToDataURL:async()=>'',dataUrlToJpegBlob:async()=>null,normProblem:x=>x}).prepImageForAI(new File(['x'],'bad'));}
    catch(error){rejected=error.message.includes('JPEG나 PNG');}
    let missing=false;
    try{window.PedagogyAIImage.create({});}catch(error){missing=error.message==='PedagogyAIImage requires fileToDataURL';}
    return {calls,image,problem,empty,rejected,missing,constants:[tools.AI_MAX_DIM,tools.AI_QUALITY]};
  });
  assert.deepEqual(result.calls,[['read','sample.png'],['jpeg','data:image/png;base64,AA==',1568,0.8]]);
  assert.deepEqual(result.image,{base64:'YWJj',mimeType:'image/jpeg',bytes:3});
  assert.deepEqual(result.constants,[1568,0.8]);
  assert.equal(result.problem.normalized,true);
  assert.deepEqual(result.problem.blocks,[
    {type:'statement',data:{text:'본문'}},{type:'conditions',data:{items:['조건']}},
    {type:'choices',data:{items:['1','2','3','4','5'],layout:'horizontal'}},
  ]);
  assert.equal(result.empty.blocks[0].type,'statement');
  assert.equal(result.rejected,true);assert.equal(result.missing,true);
}

async function checkActualWrapper(page){
  const result=await page.evaluate(async data=>{
    const hooks=window.__AI_IMAGE_HOOKS__;
    const file=new File([Uint8Array.from(atob(data),char=>char.charCodeAt(0))],'tiny.png',{type:'image/png'});
    const image=await hooks.prepImageForAI(file);
    const problem=hooks.aiBlocksToProblem({title:'<긴 제목>',blocks:[{type:'choices',items:['a']}]});
    return {constants:[hooks.AI_MAX_DIM,hooks.AI_QUALITY],image,problem};
  },png);
  assert.deepEqual(result.constants,[1568,0.8]);
  assert.equal(result.image.mimeType,'image/jpeg');
  assert.ok(result.image.base64.length>0);assert.ok(result.image.bytes>0);
  assert.equal(result.problem.blocks[0].type,'choices');
  assert.equal(result.problem.blocks[0].data.items.length,5);
  assert.ok(result.problem.id,'actual wrapper must retain normProblem ID generation');
}

async function redProbe(page){
  const source=await readFile(new URL('../pedagogy-ai-image.js',import.meta.url),'utf8');
  const mutated=source.replace('return normProblem({','return ({');
  assert.notEqual(mutated,source,'mutation anchor must match');
  await page.addScriptTag({content:mutated});
  const normalizerRan=await page.evaluate(()=>{
    const tools=window.PedagogyAIImage.create({
      fileToDataURL:async()=>'',dataUrlToJpegBlob:async()=>null,
      normProblem:()=>{throw new Error('normalizer invoked');},
    });
    try{tools.aiBlocksToProblem({blocks:[{type:'statement',text:'test'}]});return false;}
    catch(error){return error.message==='normalizer invoked';}
  });
  assert.equal(normalizerRan,true,'AI response conversion must pass through normProblem');
}

let server,browser;
try {
  const port=await freePort();
  server=spawn('python3',['serve.py','--port',String(port)],{cwd:root,stdio:'ignore'});
  const http=`http://127.0.0.1:${port}/index.html`;
  for(let attempt=0;attempt<80;attempt++){
    try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({ignoreDefaultArgs:['--allow-file-access-from-files']});
  const httpPage=await openApp(browser,http);
  if(red) await redProbe(httpPage);
  else {
    await checkFactory(httpPage);await checkActualWrapper(httpPage);
    const filePage=await openApp(browser,pathToFileURL(root+'/index.html').href);
    await checkFactory(filePage);await filePage.close();
    console.log('AI image helpers: HTTP/file classic loading, injected conversion contract, actual preprocessing, and failure boundaries passed');
  }
  await httpPage.close();
} finally {
  if(browser) await browser.close();
  if(server) server.kill('SIGTERM');
}

if(!red){
  const probe=spawnSync(process.execPath,['scripts/check-ai-image.mjs'],{
    cwd:root,encoding:'utf8',env:{...process.env,AI_IMAGE_RED:'1'},maxBuffer:1024*1024,
  });
  if(probe.error) throw probe.error;
  assert.equal(probe.status,1,'normalizer-bypass mutation must fail');
  assert.match(probe.stderr,/AssertionError/,'mutation must fail an assertion, not loading');
  console.log('AI image helpers red probe: normProblem bypass failed through AssertionError');
}
