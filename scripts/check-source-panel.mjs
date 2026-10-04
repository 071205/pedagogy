/* U1.5 원본 대조(화면 1단계) — 실제 브라우저 회귀 + 깨보기.
 *
 * 보는 것
 *   ① AI 로 만든 문제집: 문항 출처 쪽이 지면 옆 패널에 **실제 PDF 렌더러로** 그려지고, 문항을 바꾸면 그 쪽으로 간다
 *   ② 쪽 넘기기 — 지정 쪽을 벗어나면 '이 문항은 n쪽' 으로 말한다
 *   ③ 출처 없는 문항은 같은 문제집의 원본을 자유 탐색으로 띄운다
 *   ④ 가져온 JSON 처럼 **연결이 없는 문제집**은 같은 sourceId 가 적혀 있어도 원문을 열지 않는다(권한 경계)
 *   ④ …그리고 '다시 연결' 을 키보드로 열 수 있다
 *   ⑤ 다시 연결은 같은 파일만 받는다 — 다른 파일이면 거절하고 그리지 않는다
 *   ⑥ 읽는 도중 계정(epoch)이 바뀌면 늦은 결과를 화면에 올리지 않는다
 *   ⑦ 출처 없는 문제집은 원문 저장소(IndexedDB)를 만들지 않는다
 *   ⑩ 원본이 여럿일 때 첫 원본을 못 열어도 고르기로 다른 원본을 연다
 *   ⑨ 좁은 화면(375px)에서 패널을 켜도 가로로 넘치지 않는다
 *   ⑧ 계정이 바뀌면(onAuth) 패널을 닫는다 — 소스 대조(보조망). 늦은 결과 차단 자체는 ⑥ 이 실제로 본다
 *
 * 원문은 B6 실제 API(createJob → run → adopt)로 심는다 — IndexedDB 를 손으로 지어 넣지 않는다
 * (B6 스키마가 바뀌면 검사가 조용히 어긋난다). 렌더러만 호출 단계에서 가짜다(유료 호출 없음).
 * 깨보기: 고장을 심은 index.html(인라인 해시를 다시 맞춘 사본)로 대응 항목이 빨간불이 되는지 본다.
 * 외부 요청은 전부 막는다 — 운영 Firebase·AI 에 닿지 않는다(PDF.js 는 vendor 라 로컬이다).
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

/* 빈 두 쪽짜리 PDF — xref 오프셋까지 맞춘다(PDF.js 가 복구 경로로 빠지지 않게). 쪽마다 크기가 달라 그림으로 갈린다. */
function twoPagePdf(){
  const objs=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]>>'];
  let out='%PDF-1.4\n'; const offs=[];
  objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const x=out.length;
  out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
  out+=`trailer\n<</Size ${objs.length+1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out,'latin1').toString('base64');
}
const PDF=twoPagePdf();

let browser;
async function open(html,viewport={width:1440,height:900}){
  const ctx=await browser.newContext({viewport,locale:'ko-KR'});
  await ctx.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin===base&&u.pathname==='/index.html'&&html) return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
    return u.origin===base?r.continue():r.abort();
  });
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof createIntakeFixture==='function'&&typeof sheetSource==='object'&&Array.isArray(sets),null,{timeout:15000});
  return p;
}
/* B6 실제 API 로 원문(2쪽 PDF)을 심고 두 문항을 각 쪽에 채택한다. */
async function seed(p){
  return p.evaluate(async b64=>{
    const config={files:1,fileBytes:200000,totalBytes:200000,pages:2,minDimension:1,maxDimension:1000,imageBytes:100000,requestBytes:200000,
      calls:2,retries:1,problemsPerPage:1,problemsPerJob:2,problemsPerSet:500,fieldChars:1000,blocks:10,items:10};
    const fake={count:async()=>2,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
    let n=0;
    const client=createIntakeFixture({config,renderer:fake,editorsConfirmed:true,transport:async()=>({task:PedagogyIntakeContract.TASK,
      problems:[{title:'',answer:'',blocks:[{type:'statement',text:'원본 '+(++n)+'쪽 문제'}],units:[],difficulty:'중',points:null,pointsState:'absent',group:null}],usage:{used:n,limit:2}})});
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const {jobId}=await client.createJob([new File([bytes],'원본.pdf',{type:'application/pdf'})]);
    await client.run(jobId); const j=await client.readJob(jobId);
    const report=await client.adopt(jobId,{draftVersion:j.draftVersion,destinations:[{id:'a',name:'원본권',
      items:j.drafts.map((d,i)=>({draftId:d.id,placementId:String(i+1)}))}]});
    await client.finishJob(jobId);
    return {setId:report.results[0].setId,sourceId:j.sources[0],pages:sets.find(s=>s.id===report.results[0].setId).problems.map(q=>q.intake?.sources?.[0]?.pages)};
  },PDF);
}
/* 지면 조립까지 끝난 뒤의 패널 상태를 본다 — 조립이 끝나며 선택을 다시 맞추는 동안 패널이 한 번 더 갱신될 수 있다. */
const settled=p=>p.waitForFunction(()=>{const st=$("#sheetState"),s=$("#sheetSrcState");
  return st&&['ok','fail'].includes(st.dataset.s)&&!sheetBusy&&s&&!/중…$/.test(s.textContent);},null,{timeout:30000});
const view=p=>p.evaluate(()=>({state:$("#sheetSrcState").textContent,miss:$("#sheetSrcState").dataset.s==='miss',img:!$("#sheetSrcImg").hidden&&/^data:image\//.test($("#sheetSrcImg").src||''),
  w:$("#sheetSrcImg").naturalWidth,h:$("#sheetSrcImg").naturalHeight,page:$("#sheetSrcPage").textContent,relink:!$("#sheetSrcRelink").hidden}));
async function toSheet(p,setId){
  await p.evaluate(id=>{showEditor(id);},setId);
  await p.click('#viewSeg button[data-view="sheet"]');
  await p.waitForFunction(()=>{const st=$("#sheetState");return st&&['ok','fail'].includes(st.dataset.s)&&!sheetBusy;},null,{timeout:30000});
}

async function suite(html){
  const failures=[], checks=[];
  const check=async(name,fn)=>{checks.push(name);try{await fn();}catch(e){failures.push(name+': '+(e?.message||e).split('\n')[0]);}};
  const ok=(c,m)=>{if(!c) throw new Error(m);};

  await check('⑦ 출처 없는 문제집은 원문 저장소를 만들지 않는다',async()=>{
    const p=await open(html);
    try{
      const id=await p.evaluate(()=>{const s={id:'plain',name:'손으로',header:'',problems:[newProblem()]};sets.push(s);return s.id;});
      await toSheet(p,id); await p.click('#sheetSrcBtn'); await settled(p);
      const r=await p.evaluate(async()=>({state:$("#sheetSrcState").textContent,dbs:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(d=>d.name):null}));
      ok(/연결된 원본이 없어요/.test(r.state),'안내 '+r.state);
      ok(!r.dbs||!r.dbs.includes('PM_INTAKE_V1'),'출처 없는데 원문 저장소를 만들었다 '+JSON.stringify(r.dbs));
    }finally{await p.context().close();}
  });

  await check('⑨ 좁은 화면(375px)에서 원본 패널을 켜도 가로로 넘치지 않는다',async()=>{
    const p=await open(html,{width:375,height:812});
    try{
      await p.evaluate(()=>{const s={id:'narrow',name:'좁은',header:'',problems:[newProblem()]};sets.push(s);showEditor('narrow');});
      await p.click('.pane-tab[data-pane="sheet"]');
      await p.waitForFunction(()=>{const st=$("#sheetState");return st&&['ok','fail'].includes(st.dataset.s)&&!sheetBusy;},null,{timeout:30000});
      await p.click('#sheetSrcBtn'); await settled(p);
      /* ⚠️ 문서 가로 스크롤만 보면 안 된다 — 지면 칸이 overflow:hidden 이라 넘친 패널은 스크롤이 아니라 **잘려서** 안 보인다
         (깨보기가 그렇게 잡았다). 패널의 오른쪽 끝이 화면 안인지 본다. */
      const r=await p.evaluate(()=>{const b=$("#sheetSrc").getBoundingClientRect();
        return {over:document.documentElement.scrollWidth>innerWidth,right:Math.round(b.right),vw:innerWidth,w:Math.round(b.width),shown:!$("#sheetSrc").hidden};});
      ok(r.shown&&r.w>0&&!r.over&&r.right<=r.vw+1,'좁은 화면 '+JSON.stringify(r));
    }finally{await p.context().close();}
  });
  await check('⑧ 계정이 바뀌면(onAuth) 원본 패널을 닫는다',async()=>{
    const body=(html||SOURCE).match(/const onAuth=async[\s\S]*?authEpoch\+\+;([\s\S]{0,400})/);
    ok(body&&/sheetSource\.toggle\(false\)/.test(body[1]),'onAuth 의 계정 전환 구간에서 패널을 닫지 않는다');
  });
  const p=await open(html);
  const src=await seed(p);
  await check('⓪ 준비: 두 문항이 원본 1·2쪽에 채택됐다',async()=>{
    ok(JSON.stringify(src.pages)==='[[1],[2]]','채택 출처 '+JSON.stringify(src.pages));
  });
  await toSheet(p,src.setId);
  const q=await p.evaluate(id=>sets.find(s=>s.id===id).problems.map(x=>x.id),src.setId);
  await check('① 원본 패널이 이 문항의 쪽을 실제로 그리고, 문항을 바꾸면 그 쪽으로 간다',async()=>{
    await p.evaluate(id=>selectSheetProblem(id,{scroll:false}),q[0]);
    await p.click('#sheetSrcBtn'); await settled(p);
    const a=await view(p);
    ok(a.img&&a.page==='1 / 2쪽'&&/이 문항의 원본 쪽/.test(a.state),'1번 '+JSON.stringify(a));
    ok(a.h>a.w,'1쪽(세로)이 아니다 '+a.w+'×'+a.h);
    await p.evaluate(id=>selectSheetProblem(id,{scroll:false}),q[1]); await settled(p);
    const b=await view(p);
    ok(b.img&&b.page==='2 / 2쪽'&&b.w>b.h,'2번 '+JSON.stringify(b));
  });
  await check('② 쪽 넘기기 — 지정 쪽을 벗어나면 그렇게 말한다',async()=>{
    await p.click('#sheetSrcPrev'); await settled(p);
    const a=await view(p);
    ok(a.page==='1 / 2쪽'&&/2쪽에 있어요/.test(a.state)&&a.h>a.w,'이전 쪽 '+JSON.stringify(a));
    ok(await p.evaluate(()=>$("#sheetSrcPrev").disabled),'첫 쪽에서 이전 단추가 살아 있다');
  });
  await check('③ 출처 없는 문항은 같은 문제집의 원본을 자유 탐색으로 띄운다',async()=>{
    const id=await p.evaluate(sid=>{const s=sets.find(x=>x.id===sid);const n=newProblem();s.problems.push(n);return n.id;},src.setId);
    await p.evaluate(id=>selectSheetProblem(id,{scroll:false}),id); await settled(p);
    const a=await view(p);
    ok(a.img&&/자유롭게/.test(a.state)&&a.page==='1 / 2쪽','자유 탐색 '+JSON.stringify(a));
  });
  await check('⑩ 첫 원본을 못 열어도 고르기로 다른 원본을 연다',async()=>{
    // 첫 출처는 이 문제집에 연결되지 않은(=이 기기에서 못 여는) 원본, 둘째가 실제 원본
    const id=await p.evaluate(({sid,real})=>{const s=sets.find(x=>x.id===sid);const n=newProblem();
      n.intake={version:1,sources:[{sourceId:'00000000-0000-4000-8000-000000000000',pages:[1]},{sourceId:real,pages:[2]}]};
      s.problems.push(n);return n.id;},{sid:src.setId,real:src.sourceId});
    await p.evaluate(id=>selectSheetProblem(id,{scroll:false}),id); await settled(p);
    const a=await p.evaluate(()=>({miss:$("#sheetSrcState").dataset.s==='miss',nav:!$("#sheetSrcNav").hidden,pick:!$("#sheetSrcPick").hidden,
      pageCtl:!$("#sheetSrcPrev").hidden,opts:$("#sheetSrcPick").options.length}));
    ok(a.miss&&a.nav&&a.pick&&a.opts===2&&!a.pageCtl,'첫 원본 실패 뒤 고르기 '+JSON.stringify(a));
    await p.selectOption('#sheetSrcPick','1'); await settled(p);
    const b=await view(p);
    ok(b.img&&b.page==='2 / 2쪽','둘째 원본으로 넘어가지 못했다 '+JSON.stringify(b));
  });
  await check('④ 연결 없는 문제집은 같은 sourceId 가 적혀 있어도 원문을 열지 않는다',async()=>{
    const id=await p.evaluate(({sid,orig})=>{
      const o=sets.find(x=>x.id===orig); const s=structuredClone(o); s.id='imported-json'; s.name='가져온 사본'; sets.push(s); return s.id;
    },{sid:src.sourceId,orig:src.setId});
    await toSheet(p,id);   // showEditor 는 보기를 '편집' 으로 되돌린다 — 지면으로 다시 들어간다
    await p.evaluate(id=>selectSheetProblem(sets.find(s=>s.id===id).problems[0].id,{scroll:false}),id); await settled(p);
    const a=await view(p);
    ok(!a.img&&a.miss&&/연결된 원본이 없습니다/.test(a.state),'연결 없는데 원문이 열렸다 '+JSON.stringify(a));
    ok(a.relink,'다시 연결 단추가 없다');
    // 키보드만으로 다시 연결 창을 열 수 있어야 한다(숨긴 입력을 label 로 감싸면 초점이 닿지 않는다)
    // 초점과 Enter 를 한 동작으로 — 사이에 지면 조립이 끝나며 패널이 다시 그려지면 초점이 빠진다(깜빡였다)
    await p.waitForFunction(()=>!$("#sheetSrcRelink").hidden);
    const relink=p.locator('#sheetSrcRelink');
    ok(await relink.evaluate(b=>{b.focus();return document.activeElement===b;}),'다시 연결 단추에 키보드 초점이 닿지 않는다');
    const [chooser]=await Promise.all([p.waitForEvent('filechooser',{timeout:10000}),relink.press('Enter')]);
    ok(await chooser.element().getAttribute('id')==='sheetSrcFile','다른 파일 창이 열렸다');
  });
  await check('⑤ 다시 연결은 다른 파일을 거절하고 그리지 않는다',async()=>{
    await p.setInputFiles('#sheetSrcFile',{name:'다른.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 다른 파일')});
    await p.waitForFunction(()=>/새 원문/.test($("#sheetSrcState").textContent),null,{timeout:10000});
    const a=await view(p);
    ok(!a.img&&a.miss,'다른 파일인데 그렸다 '+JSON.stringify(a));
  });
  await check('⑥ 읽는 도중 계정이 바뀌면 늦은 결과를 올리지 않는다',async()=>{
    await toSheet(p,src.setId);
    /* 읽기 결과를 문에 붙잡아 두고, 그 사이 **소유자와 epoch 를 함께** 바꾼 뒤 문을 연다.
       epoch 만 올리면 같은 소유자(guest)로 다시 여는 정당한 갱신과 구별되지 않는다. */
    const r=await p.evaluate(async q0=>{
      sheetSource.toggle(false); selectSheetProblem(q0,{scroll:false});
      // 고정 대기로 '읽는 도중' 을 만들면 읽기가 느린 기계에서 계정 전환이 먼저 와 깨보기가 헛돈다 — 도착 신호를 기다린다(CodeRabbit)
      const real=intakeReadClient(); let release,enter;
      const gate=new Promise(res=>{release=res;}), entered=new Promise(res=>{enter=res;});
      intakeLinkClient={...real,forProblem:async(...a)=>{const out=await real.forProblem(...a);enter();await gate;return out;}};
      const prevUser=currentUser;
      try{
        sheetSource.toggle(true);
        // 원문을 읽어 문 앞에 도착했다 — 깨보기로 forProblem 을 우회하면 영영 안 오므로 상한을 둔다
        await Promise.race([entered,new Promise(res=>setTimeout(res,8000))]);
        currentUser={uid:'other-account'}; authEpoch++;    // 계정 전환과 같은 울타리
        release(); await new Promise(res=>setTimeout(res,1500));
        return {img:!$("#sheetSrcImg").hidden};
      }finally{ currentUser=prevUser; authEpoch++; intakeLinkClient=real; }
    },q[0]);
    ok(!r.img,'계정이 바뀐 뒤 옛 원문이 화면에 올라왔다');
  });
  if(p.errs.length) failures.push('페이지 오류: '+p.errs.join(' | '));
  await p.context().close();
  return {failures,checks};
}

const BREAKS=[
  {name:'권 연결 확인 없이 원문을 바로 읽는다',target:'④',
   pairs:[['try{ got=await intakeReadClient().forProblem(S.setId,{intake:{sources:[{sourceId:ref.sourceId,pages:ref.pages}]}}); }',
     'try{ got=await intakeReadClient().readSource(ref.sourceId).then(x=>({state:x.state,blob:x.blob})); }']]},
  {name:'늦은 결과를 세대·계정 확인 없이 올린다',target:'⑥',
   pairs:[['return ()=>gen===S.gen&&S.on&&owner===intakeOwner()&&epoch===authEpoch;','return ()=>true;']]},
  {name:'출처 없는 문항에서 자유 탐색을 하지 않는다',target:'③',
   pairs:[['    if(own.length) return own;\n','    if(own.length||true) return own;\n']]},
  {name:'계정 전환에서 패널을 닫지 않는다',target:'⑧',
   pairs:[['    sheetSource.toggle(false);\n','']]},
  {name:'다시 연결 단추가 파일 창을 열지 않는다',target:'④',
   pairs:[['  $("#sheetSrcRelink").onclick=()=>$("#sheetSrcFile").click();\n','']]},
  {name:'좁은 화면에서도 패널 폭을 고정한다',target:'⑨',
   pairs:[['  .sheet-src{flex:0 0 auto;width:auto;border-left:0;','  .sheet-src{flex:0 0 auto;width:600px;border-left:0;']]},
  {name:'원본을 못 열면 고르기까지 숨긴다',target:'⑩',
   pairs:[['    $("#sheetSrcNav").hidden = S.refs.length<2;\n','    $("#sheetSrcNav").hidden = true;\n']]},
  {name:'선택이 바뀌어도 패널을 갱신하지 않는다',target:'①',
   pairs:[['  renderSheetInspector();\n  sheetSource.refresh();\n','  renderSheetInspector();\n']]},
];

let exit=0;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  const main=await suite(null);
  main.checks.forEach(c=>{const f=main.failures.find(x=>x.startsWith(c));console.log((f?'FAIL ':'PASS ')+(f||c));});
  main.failures.filter(f=>!main.checks.some(c=>f.startsWith(c))).forEach(f=>console.log('FAIL '+f));
  if(main.failures.length) exit=1;
  for(const b of BREAKS){
    const r=await suite(mutate(b.pairs));
    const hit=r.failures.some(f=>f.startsWith(b.target));
    console.log(`${hit?'RED ':'MISS'} 깨보기 '${b.name}' → ${b.target} ${hit?'빨간불':'초록불(검사가 헛돈다)'}`);
    if(!hit) exit=1;
  }
  console.log(`원본 대조 검사 ${main.checks.length}개 · 깨보기 ${BREAKS.length}개`);
}catch(e){ console.error(e); exit=1; }
finally{ await browser?.close(); server.kill(); }
process.exit(exit);
