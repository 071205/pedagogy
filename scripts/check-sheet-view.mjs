/* U1 지면 배치 보기 — 실제 브라우저 회귀 + 깨보기.
 *
 * 보는 것
 *   ① 지면 배치가 **인쇄 조립과 같은 결과**인가(같은 쪽·칸·문항·보정 배율)
 *   ② 잘림이 '확인할 문항' 으로 뜨고, 누르면 그 문항이 선택되는가
 *   ③ 지면에서 배치를 바꾸면 다시 그려지고, ⌘Z 한 번으로 돌아오는가
 *   ④ 문항 편집 ↔ 지면 배치를 오가도 같은 문항이 선택·표시되는가
 *   ⑤ 내용이 바뀐 직후 낡은 지면을 '최신' 으로 표시하지 않는가
 *   ⑥ 선택만 바뀌면 다시 조립하지 않는가(300문항 조립 시간도 잰다)
 *   ⑦ 좁은 화면의 '지면' 탭 · 키보드 선택 · 인쇄 매체에서 숨김
 *
 * 깨보기: 고장을 심은 index.html(인라인 해시를 다시 맞춘 사본)을 내려보내 대응 항목이
 * 빨간불이 되는지 스스로 본다. 항목을 더하면 BREAKS 에도 더할 것.
 * 외부 요청은 jsdelivr(KaTeX·글꼴) 말고 전부 막는다 — 운영 Firebase 에 닿지 않는다.
 */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';

const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
const SOURCE=await readFile(new URL('../index.html',import.meta.url),'utf8');

/* 인라인 스크립트를 고치면 CSP 해시가 어긋나 그 블록이 **조용히** 차단된다 — 다시 맞춘다. */
function rehash(html){
  const TAG=/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const hashes=[...html.matchAll(TAG)].filter(m=>m[1]!==undefined&&!/\bsrc\s*=/.test(m[1]))
    .map(m=>`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  let i=0;
  return html.replace(/(script-src[^;]*?)((?:'sha256-[^']+'\s*)+)/,(all,head,list)=>head+list.replace(/'sha256-[^']+'/g,()=>hashes[i++]));
}
function mutate(pairs){
  let html=SOURCE;
  for(const [a,b] of pairs){
    if(!html.includes(a)) throw new Error('깨보기 대상이 소스에 없다(검사가 낡았다): '+a.slice(0,60));
    html=html.replace(a,b);
  }
  return rehash(html);
}

/* 저장된 자료의 모양(정규화 뒤)으로 심는다 — 빠진 필드가 있으면 편집기가 문항을 처음 열 때
   채워 넣어(예: choices.images) 실제로 자료가 바뀌고, 그건 다시 그리는 게 맞다. */
function seed(count){
  return `(()=>{
    const P=(i,text,extra={})=>({id:'q'+i,title:'',desc:'',answer:String(i),answerImg:'',numLabel:'',paired:false,span:'col',blocks:[{type:'statement',data:{text}}],...extra});
    const long=Array.from({length:60},(_,k)=>'긴 조건 '+(k+1)+': 함수 $f(x)=x^{'+(k+2)+'}+'+k+'x$ 에 대하여 생각한다.').join('\\n');
    const probs=[];
    for(let i=1;i<=${count};i++){
      if(i===5){probs.push(P(i,long));continue;}
      const t=i+'번 문제. 함수 $f(x)=x^2-'+i+'x+1$ 의 최솟값을 구하시오.';
      probs.push(P(i,t,{blocks:[{type:'statement',data:{text:t}},{type:'choices',data:{items:['$1$','$2$','$3$','$4$','$5$'],layout:'horizontal',images:['','','','','']}}]}));
    }
    probs[0].span='pair';probs[0].paired=true;
    localStorage.setItem('PM_SETS_V7:guest',JSON.stringify([{id:'set-u1',name:'U1 지면 시험',header:'U1 테스트',lineColor:'indigo',subject:'math',problems:probs}]));
  })()`;
}

let browser;
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const IMG='https://firebasestorage.googleapis.com/v0/b/x/o/sheet-gate.png?alt=media';
async function open(html,{viewport={width:1440,height:900},count=12}={}){
  const ctx=await browser.newContext({viewport,locale:'ko-KR'});
  // 그림 문 — 검사마다 새로 닫을 수 있다(closeImages). 요청이 **들어온 때의** 문을 기다린다.
  let release; ctx.closeImages=()=>{ctx.imageGate=new Promise(r=>{release=r;});}; ctx.closeImages(); ctx.releaseImages=()=>release();
  await ctx.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.origin===base&&u.pathname==='/index.html'&&html) return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
    // 그림 응답은 시험이 문을 열 때까지 붙잡는다 — 조립 중 경합을 결정적으로 만든다
    if(u.hostname==='firebasestorage.googleapis.com'){ const gate=ctx.imageGate; await gate; return r.fulfill({contentType:'image/png',body:PNG}); }
    return (u.origin===base||u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort();
  });
  await ctx.addInitScript(seed(count));
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof showEditor==='function'&&Array.isArray(sets)&&sets.some(s=>s.id==='set-u1'),null,{timeout:15000});
  await p.evaluate(()=>showEditor('set-u1'));
  return p;
}
const settled=p=>p.waitForFunction(()=>{const st=document.querySelector('#sheetState');return st&&['ok','fail'].includes(st.dataset.s)&&!sheetBusy;},null,{timeout:30000});
async function toSheet(p,{narrow=false}={}){
  await p.click(narrow?'.pane-tab[data-pane="sheet"]':'#viewSeg button[data-view="sheet"]');
  await settled(p);
}

async function suite(html){
  const failures=[], checks=[];
  const check=async(name,fn)=>{checks.push(name);try{await fn();}catch(e){failures.push(name+': '+(e?.message||e).split('\n')[0]);}};
  const ok=(v,msg)=>{if(!v)throw new Error(msg);};
  const p=await open(html);
  await check('① 지면 배치 = 인쇄 조립(쪽·칸·문항·보정 배율)',async()=>{
    await toSheet(p);
    const r=await p.evaluate(async()=>{
      const sig=root=>[...root.querySelectorAll('.page')].map(pg=>[...pg.querySelectorAll('.slot')].map(sl=>
        [...sl.querySelectorAll('.pq')].map(pq=>pq.dataset.qid+'@'+(pq.style.transform||'-')+'|'+[...pq.querySelectorAll('.choices')].map(c=>c.className).join(',')
          +'|'+pq.offsetWidth+'x'+pq.offsetHeight+'|'+pq.scrollHeight+'|'+(pq.querySelector('.content')?.innerHTML.length||0)+':'+[...(pq.querySelector('.content')?.innerHTML||'')].reduce((h,c)=>(h*31+c.charCodeAt(0))|0,7))));
      const pd=$("#printDoc");
      buildPrintDoc(!$("#sheetShowAns").checked);
      await warmPrintFonts(); if(document.fonts?.ready) await document.fonts.ready;
      await awaitPrintImages(pd);
      pd.classList.add('measuring'); void document.body.offsetHeight;
      await new Promise(r=>setTimeout(r,120));
      // ⚠️ 크기는 펼쳐 둔 동안 읽어야 한다 — measuring 을 떼면 display:none 이라 전부 0 이다
      let a;
      try{ fitPrintDoc(); a=JSON.stringify(sig(pd)); }finally{ pd.classList.remove('measuring'); }
      const b=JSON.stringify(sig($("#sheetStage")));
      pd.innerHTML='';
      return {same:a===b,scaled:/scale\(/.test(b),pages:$("#sheetStage").querySelectorAll('.page').length,a:a.slice(0,160),b:b.slice(0,160)};
    });
    ok(r.pages>0,'지면이 비었다');
    ok(r.scaled,'긴 문항의 축소 보정이 지면에 없다');
    ok(r.same,'인쇄와 다르다 · 인쇄 '+r.a+' · 지면 '+r.b);
  });
  await check('② 잘림 → 확인할 문항 → 선택·사유 표시',async()=>{
    const n=await p.evaluate(()=>$("#sheetIssuesBtn").hidden?0:Number($("#sheetIssuesBtn").dataset.n));
    ok(n===1,'확인할 문항 수 '+n);
    await p.click('#sheetIssuesBtn'); await p.click('#sheetIssues button');
    const r=await p.evaluate(()=>({cur:currentQId,note:$("#sheetInspNote").textContent,sel:$("#sheetStage .pq.is-selected")?.dataset.qid}));
    ok(r.cur==='q5'&&r.sel==='q5','선택 '+JSON.stringify(r));
    ok(/잘려요/.test(r.note),'사유 없음: '+r.note);
  });
  await check('③ 지면에서 한 쪽 배치 → 다시 그림 → ⌘Z 한 번 복구',async()=>{
    const before=await p.evaluate(()=>$("#sheetStage").querySelectorAll('.page').length);
    await p.click('#sheetSpan button[data-v="page"]'); await p.waitForTimeout(30); await settled(p);
    const mid=await p.evaluate(()=>({span:sets[0].problems[4].span,pages:$("#sheetStage").querySelectorAll('.page').length,full:!!$("#sheetStage .pq[data-qid=q5]")?.closest('.page--full')}));
    ok(mid.span==='page'&&mid.full&&mid.pages===before+1,'배치 변경 반영 '+JSON.stringify(mid)+' 이전 '+before);
    await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(80); await settled(p);
    const after=await p.evaluate(()=>({span:sets[0].problems[4].span,pages:$("#sheetStage").querySelectorAll('.page').length}));
    ok(after.span==='col'&&after.pages===before,'되돌리기 '+JSON.stringify(after));
  });
  await check('④ 지면 → 문항 편집 → 지면: 같은 문항 유지',async()=>{
    await p.click('#sheetStage .pq[data-qid="q8"]');
    await p.click('#sheetEditBtn');
    const e=await p.evaluate(()=>({mode:editorMode,cur:currentQId,center:getComputedStyle($(".center")).display}));
    ok(e.mode==='edit'&&e.cur==='q8'&&e.center!=='none','편집 '+JSON.stringify(e));
    await toSheet(p);
    const s=await p.evaluate(()=>{const b=$("#sheetStage .pq.is-selected");if(!b)return null;const r=b.getBoundingClientRect(),v=$("#sheetScroll").getBoundingClientRect();return {qid:b.dataset.qid,inView:r.bottom>v.top&&r.top<v.bottom};});
    ok(s&&s.qid==='q8'&&s.inView,'지면 복귀 '+JSON.stringify(s));
  });
  await check('⑤ 내용이 바뀐 직후 낡은 지면을 최신으로 표시하지 않음',async()=>{
    const r=await p.evaluate(()=>{
      const q=sets[0].problems[2]; q.blocks[0].data.text='바뀐 3번 본문입니다'; saveSets();
      return {state:$("#sheetState").dataset.s,cover:!$("#sheetCover").hidden};
    });
    ok(r.state!=='ok'&&r.cover,'바뀐 직후 상태 '+JSON.stringify(r));
    await settled(p);
    const t=await p.evaluate(()=>({has:$("#sheetStage").textContent.includes('바뀐 3번 본문입니다'),latest:sheetShownKey===sheetKey(),cover:!$("#sheetCover").hidden}));
    ok(t.has&&t.latest&&!t.cover,'반영 뒤 '+JSON.stringify(t));
  });
  await check('⑤-b 그림 대기 중 내용이 바뀌면 옛 조립 결과를 올리지 않음',async()=>{
    // q2 에 붙잡힌 그림을 넣는다 → 조립이 '그림 확인' 에서 멈춘다
    await p.evaluate(img=>{sets[0].problems[1].blocks.push({type:'image',data:{dataUrl:img,size:'m'}});saveSets();},IMG);
    await p.waitForFunction(()=>sheetBusy&&/그림/.test($("#sheetState").textContent),null,{timeout:15000});
    // 조립 중에 내용을 바꾸고, 다음 조립이 시작되기 전(220ms 안)에 그림을 놓아 준다
    // ⚠️ 다음 조립 예약(220ms)을 이 검사 동안만 5초로 늘린다 — 그래야 '옛 조립이 먼저 끝나는' 경합이
    //    그림 응답 속도와 상관없이 **반드시** 일어난다(늘리지 않으면 깨보기가 운에 따라 초록불이 됐다).
    await p.evaluate(()=>{const st=window.setTimeout;window.__restoreTimeout=()=>{window.setTimeout=st;};
      window.setTimeout=(f,ms,...rest)=>st(f,ms===220?5000:ms,...rest);});
    await p.evaluate(()=>{window.__bad=[];window.__mark='새 4번 본문';
      // 지면 교체 횟수 — 바뀐 뒤에는 **최신 조립 한 번**만 올라가야 한다(옛 조립은 덮개 밑에라도 올리지 않는다)
      window.__swaps=0;window.__mo=new MutationObserver(rs=>{if(rs.some(r=>r.type==='childList'&&r.addedNodes.length))window.__swaps++;});
      window.__mo.observe($("#sheetStage"),{childList:true});
      sets[0].problems[3].blocks[0].data.text=window.__mark;saveSets();
      window.__probe=setInterval(()=>{const st=$("#sheetState").dataset.s;if(st==='ok'&&!$("#sheetStage").textContent.includes(window.__mark))window.__bad.push(st);},5);});
    p.context().releaseImages();
    await p.waitForTimeout(1500);                       // 옛 조립이 끝날 시간(무효화가 없으면 이때 'ok' 로 게시된다)
    await p.evaluate(()=>window.__restoreTimeout());
    await settled(p);
    const r=await p.evaluate(()=>{clearInterval(window.__probe);window.__mo.disconnect();return {bad:window.__bad.length,swaps:window.__swaps,has:$("#sheetStage").textContent.includes(window.__mark),latest:sheetShownKey===sheetKey()};});
    ok(!r.bad,'옛 지면이 최신(ok)으로 게시됐다 '+r.bad+'회');
    ok(r.swaps===1,'바뀐 뒤 지면 교체 '+r.swaps+'회 — 옛 조립 결과까지 올렸다');
    ok(r.has&&r.latest,'반영 뒤 '+JSON.stringify(r));
  });
  await check('⑤-c 조립 중 문항 편집으로 나가면 늦은 결과를 게시하지 않음',async()=>{
    // ⚠️ 조립이 **실제로 그림을 기다리는 중**인 것을 확인한 뒤 나간다(Codex 2차: 10ms 만에 나가면 조립 전이라 헛돈다)
    p.context().closeImages();
    await p.evaluate(img=>{sets[0].problems[5].blocks[0].data.text='나간 뒤 바뀐 6번';
      sets[0].problems[5].blocks.push({type:'image',data:{dataUrl:img,size:'m'}});saveSets();},IMG+'&v=leave');
    await p.waitForFunction(()=>sheetBusy&&/그림/.test($("#sheetState").textContent)&&$("#sheetBuild").classList.contains('building'),null,{timeout:15000});
    await p.click('#viewSeg button[data-view="edit"]');
    p.context().releaseImages();
    await p.waitForTimeout(1500);
    const r=await p.evaluate(()=>({mode:editorMode,changed:$("#sheetStage").textContent.includes('나간 뒤 바뀐 6번'),busy:sheetBusy,building:$("#sheetBuild").classList.contains('building')}));
    ok(r.mode==='edit'&&!r.changed,'편집 모드로 나간 뒤 늦은 조립이 지면에 올라갔다 '+JSON.stringify(r));
    ok(!r.busy&&!r.building,'조립 상태가 남았다 '+JSON.stringify(r));
    await toSheet(p);
    ok(await p.evaluate(()=>$("#sheetStage").textContent.includes('나간 뒤 바뀐 6번')&&sheetShownKey===sheetKey()),'돌아오면 최신으로 다시 그려야 한다');
  });
  await check('⑥ 선택만 바뀌면 다시 조립하지 않음',async()=>{
    const g0=await p.evaluate(()=>sheetGen);
    // 문항 목록에서 고르는 길이 renderPreview → scheduleSheet 를 탄다(지면을 직접 누르는 선택은 그 길을 안 탄다)
    await p.click('#qList .q-open[data-qid="q9"]'); await p.waitForTimeout(400);
    const sel=await p.evaluate(()=>$("#sheetStage .pq.is-selected")?.dataset.qid);
    ok(sel==='q9','목록 선택이 지면에 표시되지 않았다 '+sel);
    const r=await p.evaluate(()=>({g:sheetGen,cur:currentQId,state:$("#sheetState").dataset.s}));
    ok(r.cur==='q9','선택 '+r.cur);
    ok(r.g===g0&&r.state==='ok','다시 조립했다 '+JSON.stringify({...r,g0}));
  });
  await check('⑦-a 키보드로 문항 선택',async()=>{
    await p.focus('#sheetStage .pq[data-qid="q10"]'); await p.keyboard.press('Enter');
    ok(await p.evaluate(()=>currentQId==='q10'),'Enter 선택 실패');
  });
  await check('⑦-b 인쇄 매체에서는 지면 배치·조립 그릇이 숨는다',async()=>{
    await p.emulateMedia({media:'print'});
    const r=await p.evaluate(()=>({pane:getComputedStyle($("#editorView")).display,build:getComputedStyle($("#sheetBuild")).display}));
    await p.emulateMedia({media:'screen'});
    ok(r.pane==='none'&&r.build==='none','인쇄 매체 '+JSON.stringify(r));
  });
  if(p.errs.length) failures.push('페이지 오류: '+p.errs.join(' | '));
  await p.context().close();

  for(const [name,vp] of [['768',{width:768,height:1024}],['375',{width:375,height:812}]]){
    await check(`⑦-c 좁은 화면 ${name}: 지면 탭 ↔ 편집 탭 · 가로 넘침 없음`,async()=>{
      const q=await open(html,{viewport:vp});
      try{
        await toSheet(q,{narrow:true});
        const r=await q.evaluate(()=>({mode:editorMode,pane:getComputedStyle($("#sheetPane")).display,h:document.documentElement.scrollWidth>innerWidth,pages:$("#sheetStage").querySelectorAll('.page').length}));
        ok(r.mode==='sheet'&&r.pane!=='none'&&!r.h&&r.pages>0,'지면 탭 '+JSON.stringify(r));
        await q.click('.pane-tab[data-pane="edit"]');
        ok(await q.evaluate(()=>editorMode==='edit'&&getComputedStyle($("#sheetPane")).display==='none'),'편집 탭 복귀 실패');
      }finally{ await q.context().close(); }
    });
  }
  return {checks,failures};
}

const BREAKS=[
  {name:'지면이 보정(fitPrintDoc)을 건너뛴다',target:'①',
   pairs:[['    const overflowed=fitPrintDoc(build);\n','    const overflowed=[];\n']]},
  {name:'인쇄 문항에 문항 id 를 안 심는다',target:'②',
   pairs:[['        box.dataset.qid=String(q.id);','        void 0;']]},
  {name:'바뀐 직후 낡음 표시를 하지 않는다',target:'⑤',
   pairs:[['  if(key!==sheetShownKey) setSheetState("stale","바뀐 내용 반영 대기");\n','']]},
  {name:'조립 중 다른 내용이 와도 진행 중 조립을 무효화하지 않는다',target:'⑤-b',
   pairs:[['  if(sheetBusy){ sheetGen++; sheetBusy=false; sheetBuildingKey=null; $("#sheetBuild").classList.remove("building"); }\n','']]},
  {name:'조립 중 보기에서 나가도 늦은 결과를 올린다',target:'⑤-c',
   pairs:[['const live=()=>gen===sheetGen && sessionMatches(session) && sheetVisible();','const live=()=>gen===sheetGen && sessionMatches(session);']]},
  {name:'지면에서만 본문을 숨긴다(배치 서명은 같다)',target:'①',
   pairs:[['.sheet-stage .pq{position:relative;cursor:pointer}','.sheet-stage .pq{position:relative;cursor:pointer}\n.sheet-stage .pq .content{display:none}']]},
  {name:'선택만 바뀌어도 다시 조립한다',target:'⑥',
   pairs:[['  if(key===sheetShownKey && !sheetBusy){ syncSheetSelection(); return; }\n','']]},
  {name:'좁은 화면 탭이 보기를 바꾸지 않는다',target:'⑦-c',
   pairs:[['  if(typeof applyEditorMode==="function" && (name==="sheet")!==(editorMode==="sheet")) applyEditorMode(name==="sheet"?"sheet":"edit");','']]},
];

let exit=0;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  const t0=Date.now();
  const main=await suite(null);
  main.checks.forEach(c=>{const f=main.failures.find(x=>x.startsWith(c));console.log((f?'FAIL ':'PASS ')+(f||c));});
  main.failures.filter(f=>!main.checks.some(c=>f.startsWith(c))).forEach(f=>console.log('FAIL '+f));
  if(main.failures.length) exit=1;

  // 300문항 — 조립 시간(정보)과 상한(느슨하게: 회귀를 잡되 CI 기계 차이로 깜빡이지 않게)
  const big=await open(null,{count:300});
  const ms=await big.evaluate(async()=>{
    const t=performance.now(); $("#viewSeg button[data-view=sheet]").click();
    await new Promise(r=>{const id=setInterval(()=>{if($("#sheetState").dataset.s==='ok'&&!sheetBusy){clearInterval(id);r();}},20);});
    return {ms:Math.round(performance.now()-t),pages:$("#sheetStage").querySelectorAll('.page').length};
  });
  console.log(`INFO 300문항 지면 조립 ${ms.ms}ms · ${ms.pages}쪽`);
  if(ms.ms>20000){console.log('FAIL 300문항 지면 조립이 20초를 넘는다');exit=1;}
  await big.context().close();

  for(const b of BREAKS){
    const r=await suite(mutate(b.pairs));
    const hit=r.failures.some(f=>f.startsWith(b.target));
    console.log(`${hit?'RED ':'MISS'} 깨보기 '${b.name}' → ${b.target} ${hit?'빨간불':'초록불(검사가 헛돈다)'}`);
    if(!hit) exit=1;
  }
  console.log(`지면 배치 검사 ${main.checks.length}개 · 깨보기 ${BREAKS.length}개 · ${Math.round((Date.now()-t0)/1000)}s`);
}catch(e){ console.error(e); exit=1; }
finally{ await browser?.close(); server.kill(); }
process.exit(exit);
