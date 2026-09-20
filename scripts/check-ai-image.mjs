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

/* ⚠️ **인라인 `<script>` 를 주입하지 않는다**(`REV-2026-097`). `index.html` 의 인라인
   스크립트는 CSP 해시로 잠겨 있고 `'unsafe-inline'` 이 없어서 주입이 **조용히 차단된다**
   — 오류도 안 나고 훅만 undefined 가 된다. 대신 두 가지를 쓴다:
     · 실제 배선은 `page.evaluate` 로 **맨 이름**을 읽는다(전역 렉시컬·window 둘 다 보인다).
     · 라이브러리를 바꿔 끼울 때는 **route 로 파일 자체를 갈아 준다**(CSP 를 타지 않는다).
   ⚠️ `'unsafe-inline'` 을 되살려 예전 방식으로 돌아가지 말 것. */
async function openApp(browser, url, mutatedLib){
  const page=await browser.newPage();
  await page.route('https://**/*',route=>route.abort());
  if(mutatedLib) await page.route('**/pedagogy-ai-image.js',route=>route.fulfill({
    contentType:'application/javascript; charset=utf-8', body:mutatedLib}));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await waitFor(page,()=>typeof window.PedagogyAIImage?.create==='function');
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
  /* `prepImageForAI`·`aiBlocksToProblem` 은 최상위 `function` 이라 window 에 있고,
     `AI_MAX_DIM`·`AI_QUALITY` 는 `const` 라 window 에는 없지만 **전역 렉시컬**이라
     `evaluate` 안에서 맨 이름으로 보인다. 그래서 주입이 필요 없다. */
  const result=await page.evaluate(async data=>{
    const file=new File([Uint8Array.from(atob(data),char=>char.charCodeAt(0))],'tiny.png',{type:'image/png'});
    const image=await prepImageForAI(file);
    const problem=aiBlocksToProblem({title:'<긴 제목>',blocks:[{type:'choices',items:['a']}]});
    return {constants:[AI_MAX_DIM,AI_QUALITY],image,problem,
            wired:typeof aiImageTools==='object' && aiImageTools!==null};
  },png);
  assert.equal(result.wired,true,'index.html 이 PedagogyAIImage 로 배선한 인스턴스를 봐야 한다');
  assert.deepEqual(result.constants,[1568,0.8]);
  assert.equal(result.image.mimeType,'image/jpeg');
  assert.ok(result.image.base64.length>0);assert.ok(result.image.bytes>0);
  assert.equal(result.problem.blocks[0].type,'choices');
  assert.equal(result.problem.blocks[0].data.items.length,5);
  assert.ok(result.problem.id,'actual wrapper must retain normProblem ID generation');
}

/* ⚠️ 예전에는 `addScriptTag({content})` 로 바꾼 사본을 덧씌웠는데, CSP 가 그것을 막으면
   **원본이 그대로 남아 깨보기가 조용히 통과한다**(= 검사가 헛돈다). 지금은 route 로
   파일 자체를 갈아 끼워 바뀐 사본이 확실히 실행되게 한다. */
async function redProbe(browser, url){
  const source=await readFile(new URL('../pedagogy-ai-image.js',import.meta.url),'utf8');
  const mutated=source.replace('return normProblem({','return ({');
  assert.notEqual(mutated,source,'mutation anchor must match');
  const page=await openApp(browser,url,mutated);
  const normalizerRan=await page.evaluate(()=>{
    const tools=window.PedagogyAIImage.create({
      fileToDataURL:async()=>'',dataUrlToJpegBlob:async()=>null,
      normProblem:()=>{throw new Error('normalizer invoked');},
    });
    try{tools.aiBlocksToProblem({blocks:[{type:'statement',text:'test'}]});return false;}
    catch(error){return error.message==='normalizer invoked';}
  });
  await page.close();
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
  if(red) await redProbe(browser,http);
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
