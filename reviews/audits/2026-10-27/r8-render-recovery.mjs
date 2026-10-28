import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile, writeFile, mkdir, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {observeStaticChild} from '../../../scripts/serve-static-staging.mjs';

// Synthetic guest data only. Backend requests are denied, including Firebase.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const source=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
const red=process.env.R8_RENDER_RED||'';
assert(['','image','font','stale','count','print-order','print-layout'].includes(red),'Unknown R8_RENDER_RED');
const out=process.env.R8_RENDER_OUT||await mkdtemp(join(tmpdir(),'pedagogy-r8-render-'));
await mkdir(out,{recursive:true});
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`;
const imageUrl='https://firebasestorage.googleapis.com/v0/b/r8-synthetic/o/r8-image.svg?alt=media';
let lifecycle;
const results=[];
// Reuse the same downloaded CDN bytes across fresh contexts; failure routes still run first.
const cdnCache=new Map();
let browser;
let failure;
function htmlForRed(){
  const pairs={
    image:['    sheetIssues=collectSheetIssues(build, overflowed);','    sheetIssues=new Map();'],
    font:['    showSheetFontWarn(sheetFontProblems());','    showSheetFontWarn([]);'],
    stale:['  if(sheetBusy){ sheetGen++; sheetBusy=false; sheetBuildingKey=null; $("#sheetBuild").classList.remove("building"); }',''],
    count:['    sheetIssues=collectSheetIssues(build, overflowed);','    build.querySelector(\'.pq[data-qid="r8-q300"]\')?.remove();\n    sheetIssues=collectSheetIssues(build, overflowed);'],
    'print-order':['    window.print();','    $("#printDoc .pq[data-qid=r8-q300]")?.remove();\n    window.print();'],
    'print-layout':['    window.print();','    $("#printDoc .pq").style.transform="scale(0.5)";\n    window.print();']
  };
  if(!red)return source;
  const [a,b]=pairs[red];
  assert.equal(source.split(a).length,2,'Mutation anchor must be unique');
  let html=source.replace(a,b);
  const hashes=[...html.matchAll(/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(m=>m[1]!==undefined&&!/\bsrc\s*=/.test(m[1])).map(m=>`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  const cspList=/(script-src[^;]*?)((?:'sha256-[^']+'\s*)+)/.exec(html);
  assert(cspList,'CSP script hash list missing');
  assert.equal([...cspList[2].matchAll(/'sha256-[^']+'/g)].length,hashes.length,'CSP hash count mismatch');
  let i=0;
  html=html.replace(/(script-src[^;]*?)((?:'sha256-[^']+'\s*)+)/,(all,head,list)=>head+list.replace(/'sha256-[^']+'/g,()=>hashes[i++]));
  return html;
}
const html=htmlForRed();
const settled=p=>p.waitForFunction(()=>document.querySelector('#sheetState')?.dataset.s==='ok'&&!sheetBusy&&sheetShownKey===sheetKey(),null,{timeout:30000});
async function open(viewport,count=12){
  const ctx=await browser.newContext({viewport,locale:'ko-KR'});
  const state={blockFonts:false,image:'fail',requests:0,releases:[]};
  await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===base&&u.pathname==='/index.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
    if(u.hostname==='firebasestorage.googleapis.com'&&u.pathname==='/v0/b/r8-synthetic/o/r8-image.svg'){
      state.requests++;
      if(state.image==='gate')await new Promise(resolve=>{state.releases.push(resolve);});
      if(state.image==='fail')return route.abort();
      return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="blue"/></svg>'});
    }
    if(state.blockFonts&&/font-kopub@/.test(u.href))return route.abort();
    if(u.hostname==='cdn.jsdelivr.net'){
      if(!cdnCache.has(u.href))cdnCache.set(u.href,(async()=>{
        const response=await route.fetch({timeout:20000,maxRetries:0,maxRedirects:0});
        assert.equal(response.status(),200,'Pinned CDN asset unavailable');
        return {status:200,headers:response.headers(),body:await response.body()};
      })());
      try{return await route.fulfill(await cdnCache.get(u.href));}
      catch{cdnCache.delete(u.href);return route.abort();}
    }
    if(u.origin===base)return route.continue();
    return route.abort();
  });
  await ctx.addInitScript(({count})=>{
    const problems=Array.from({length:count},(_,i)=>({id:'r8-q'+(i+1),title:'',desc:'',answer:String(i+1),answerImg:'',numLabel:'',paired:false,span:'col',blocks:[{type:'statement',data:{text:`R8 ${i+1}번. 함수 $f(x)=x^2-${i+1}x+1$ 의 최솟값을 구하시오.`}}]}));
    localStorage.setItem('PM_SETS_V7:guest',JSON.stringify([{id:'r8-render',name:'R8 합성 렌더 검사',header:'합성 자료',subject:'math',lineColor:'indigo',problems}]));
  },{count});
  const p=await ctx.newPage();p.setDefaultTimeout(15000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const boot=async()=>{await p.goto(base+'/index.html');await p.waitForFunction(()=>typeof showEditor==='function'&&sets.some(s=>s.id==='r8-render'));await p.evaluate(()=>showEditor('r8-render'));};
  await boot();
  return {p,ctx,state,errors,boot};
}
async function show(p){await p.evaluate(()=>setEditorMode('sheet'));await settled(p).catch(async e=>{throw Error('settled: '+JSON.stringify(await p.evaluate(()=>({state:$('#sheetState').textContent,busy:sheetBusy,keyMatches:sheetShownKey===sheetKey()})))+' '+e.message);});}
async function recovery(viewport){
  const {p,ctx,state,errors,boot}=await open(viewport);
  try{
    if(!red||red==='font'){
      state.blockFonts=true;
      await boot();await show(p);
      const failed=await p.evaluate(()=>({warn:!$('#sheetFontWarn').hidden,text:$('#sheetFontWarn').textContent,problems:sheetFontProblems()}));
      assert(failed.warn&&/본문/.test(failed.text)&&failed.problems.includes('본문'),'font: failed body font must be visible');
      state.blockFonts=false;
      await boot();await show(p);
      const recovered=await p.evaluate(()=>({hidden:$('#sheetFontWarn').hidden,problems:sheetFontProblems()}));
      assert(recovered.hidden&&recovered.problems.length===0,'font: restored network + reload must clear warning');
      results.push({viewport,case:'font-failure-reload-recovery',failed,recovered});
    }
    if(!red||red==='image'){
      await p.evaluate(url=>{sets[0].problems[0].blocks.push({type:'image',data:{dataUrl:url,size:'m'}});saveSets();},imageUrl+'&case=failed');
      await show(p);await settled(p);
      const failed=await p.evaluate(()=>({issues:sheetIssues.get('r8-q1')||[],broken:[...$('#sheetStage').querySelectorAll('img')].filter(im=>im.complete&&!im.naturalWidth).length,button:!$('#sheetIssuesBtn').hidden}));
      assert(failed.broken>0&&failed.button&&failed.issues.some(x=>x.kind==='image'),'image: failed image must have a visible issue '+JSON.stringify(failed));
      state.image='ok';
      await p.evaluate(url=>{sets[0].problems[0].blocks.at(-1).data.dataUrl=url;saveSets();},imageUrl+'&case=restored');
      await settled(p);
      const recovered=await p.evaluate(()=>({issues:sheetIssues.get('r8-q1')||[],loaded:[...$('#sheetStage').querySelectorAll('img')].filter(im=>im.complete&&im.naturalWidth>0).length}));
      assert(recovered.loaded>0&&!recovered.issues.some(x=>x.kind==='image'),'image: replacement must load and clear image issue');
      results.push({viewport,case:'image-failure-replacement-recovery',failed,recovered});
    }
    if(!red||red==='stale'){
      await show(p); // Establish the same settled starting state in normal and isolated RED.
      await p.evaluate(()=>{
        window.r8BadPublications=0;window.r8Swaps=0;
        window.r8Started=0;window.r8Finished=[];
        const original=renderSheet;
        renderSheet=async(...args)=>{const run=++window.r8Started;try{return await original(...args);}finally{window.r8Finished.push(run);}};
      });
      state.image='gate';const before=state.requests;
      await p.evaluate(url=>{sets[0].problems[1].blocks.push({type:'image',data:{dataUrl:url,size:'m'}});saveSets();},imageUrl+'&case=gated');
      await showBusy(p);
      await p.waitForFunction(()=>sheetBusy&&/그림/.test($('#sheetState').textContent),null,{timeout:30000}).catch(async e=>{throw Error('stale preparation: '+JSON.stringify(await p.evaluate(()=>({state:$('#sheetState').textContent,busy:sheetBusy,mode:editorMode,images:$('#sheetBuild').querySelectorAll('img').length})))+' '+e.message);});
      assert(state.requests>before&&state.releases.length>0,'stale: image gate must actually hold a request');
      await p.evaluate(()=>{
        window.r8Observer=new MutationObserver(records=>{for(const r of records.filter(r=>r.type==='childList'&&r.target===$('#sheetStage'))){window.r8Swaps++;if(sheetShownKey!==sheetKey())window.r8BadPublications++;}});
        window.r8Observer.observe($('#sheetStage'),{childList:true});
        window.r8OldRun=window.r8Started;
        window.r8NativeTimeout=window.setTimeout;window.r8Blocked=0;
        window.setTimeout=(fn,ms,...args)=>{if(ms===220){window.r8Blocked++;return window.r8NativeTimeout(()=>{},60000);}return window.r8NativeTimeout(fn,ms,...args);};
        sets[0].problems[1].blocks[0].data.text='R8-LATEST-RECOVERED';saveSets();
      });
      assert((await p.evaluate(()=>window.r8Blocked))>0,'stale: debounce interception must actually block the next render');
      state.image='ok';state.releases.splice(0).forEach(release=>release());
      // Await the held old invocation itself, before permitting the next invocation.
      await p.waitForFunction(()=>window.r8Finished.includes(window.r8OldRun),null,{timeout:30000});
      await p.evaluate(()=>{clearTimeout(sheetTimer);window.setTimeout=window.r8NativeTimeout;scheduleSheet(true);});
      await settled(p);
      const r=await p.evaluate(()=>{window.r8Observer.disconnect();return {bad:window.r8BadPublications,swaps:window.r8Swaps,latest:sheetShownKey===sheetKey(),text:$('#sheetStage').textContent.includes('R8-LATEST-RECOVERED'),busy:sheetBusy,building:$('#sheetBuild').classList.contains('building')};});
      assert(r.bad===0&&r.swaps===1&&r.latest&&r.text&&!r.busy&&!r.building,'stale: only current render may publish '+JSON.stringify(r));
      results.push({viewport,case:'stale-completion-recovery',...r});
    }
    assert.deepEqual(errors,[],'No page errors');
  }finally{state.releases.splice(0).forEach(release=>release());await ctx.close();}
}
// Start a render without waiting for the intentionally held image.
async function showBusy(p){await p.evaluate(()=>setEditorMode('sheet'));}
async function performanceParity(viewport){
  const {p,ctx,errors}=await open(viewport,300);
  try{
    const r=await p.evaluate(async()=>{
      const ids=root=>[...root.querySelectorAll('.pq')].map(x=>x.dataset.qid);
      const sig=root=>[...root.querySelectorAll('.page')].map(pg=>[...pg.querySelectorAll('.slot')].map(sl=>[...sl.querySelectorAll('.pq')].map(pq=>[pq.dataset.qid,pq.style.transform,pq.offsetWidth,pq.offsetHeight,pq.scrollHeight,pq.querySelector('.content')?.textContent])));
      // Warm the same fonts before either timer: CDN latency is not layout cost.
      await warmPrintFonts();await document.fonts.ready;
      const t=performance.now();setEditorMode('sheet');
      await new Promise((resolve,reject)=>{const deadline=performance.now()+30000;const timer=setInterval(()=>{if(performance.now()>deadline){clearInterval(timer);reject(Error('300-question render timeout'));}else if($('#sheetState').dataset.s==='ok'&&!sheetBusy){clearInterval(timer);resolve();}},20);});
      const sheetMs=Math.round(performance.now()-t),stage=$('#sheetStage'),sheetSignature=JSON.stringify(sig(stage)),sheetIds=ids(stage);
      const printStart=performance.now(),pd=$('#printDoc'),nativePrint=window.print;
      let captured=null,printCalls=0;
      window.print=()=>{
        printCalls++;
        pd.classList.add('measuring');void document.body.offsetHeight;
        try{captured={printIds:ids(pd),signature:JSON.stringify(sig(pd))};}
        finally{pd.classList.remove('measuring');}
      };
      try{
        await doPrint(!$('#sheetShowAns').checked);
        return {sheetMs,printMs:Math.round(performance.now()-printStart),printCalls,same:captured?.signature===sheetSignature,sheetIds,printIds:captured?.printIds,pages:stage.querySelectorAll('.page').length,fontProblems:sheetFontProblems()};
      }finally{window.print=nativePrint;pd.replaceChildren();}
    });
    const expected=Array.from({length:300},(_,i)=>'r8-q'+(i+1));
    assert.deepEqual(r.sheetIds,expected,'count: sheet must retain all 300 questions in order');
    assert.equal(r.printCalls,1,'Product doPrint must reach the intercepted print boundary once');
    assert.deepEqual(r.printIds,expected,'print-order: print must retain all 300 questions in order');
    assert(r.same&&r.pages>0,'print-layout: 300-question print/sheet layout must agree');
    assert.deepEqual(r.fontProblems,[],'Performance comparison requires loaded fonts');
    assert.deepEqual(errors,[],'No page errors');
    results.push({viewport,case:'300-question-same-session-parity',...r,sheetIds:300,printIds:300});
  }finally{await ctx.close();}
}
try{
  const server=spawn('python3',['serve.py','--port',String(port)],{cwd:root,stdio:'ignore'});
  lifecycle=observeStaticChild(server);
  const deadline=Date.now()+12000;
  while(true){
    assert(!lifecycle.status(),'Owned server exited before readiness');
    try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(400)})).ok)break;}catch{}
    assert(Date.now()<deadline,'Owned server readiness timeout');await new Promise(r=>setTimeout(r,100));
  }
  browser=await chromium.launch();
  for(const viewport of [{width:1194,height:834},{width:768,height:1024},{width:375,height:812}]){
    if(!['count','print-order','print-layout'].includes(red))await recovery(viewport);
    if(!red||['count','print-order','print-layout'].includes(red))await performanceParity(viewport);
  }
}catch(e){failure=e;console.error(e.message);process.exitCode=1;}
finally{
  const cleanup=await Promise.allSettled([browser?.close(),lifecycle?.stop()]);
  if(cleanup.some(r=>r.status==='rejected'))process.exitCode=1;
  const summary={red,complete:!failure&&!process.exitCode,results,error:failure?.message,cleanup:cleanup.map(r=>r.status),serverStopped:!!lifecycle?.status()};
  await writeFile(join(out,'render-recovery.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({...summary,results:results.map(({viewport,case:name,sheetMs,printMs,pages})=>({viewport,case:name,sheetMs,printMs,pages})),out}));
}
