/* U1.5 ⓐ 원본 대조 패널 — 실제 브라우저 회귀 + 깨보기.
 *
 * 보는 것
 *   ⑩-a '원본' 단추는 늘 보이고 누르기 전에는 패널이 없다 · 연결 안 된 권은 연결 안내만(저장소를 만들지 않는다)
 *   ⑩-b AI 채택 문제집(이미지 원문) — 단추를 누르면 그 원문이 패널에 보인다
 *   ⑩-c PDF 원문 — 문항에 지정된 쪽으로 열리고 이전/다음 쪽으로 넘긴다
 *   ⑩-d 연결 권한이 없는 문제집(같은 출처 ID 를 가진 사본)에서는 원문을 열지 않는다
 *   ⑩-e 계정이 바뀌면 패널·뷰어가 닫히고 비워진다
 *   ⑩-f 원문 저장소가 없는 사용자에게 저장소를 만들지 않는다
 *   ⑩-g 닫은 뒤 늦게 도착한 원문은 패널에 올리지 않는다
 *   ⑩-h 라이브러리로 나가거나 삭제(wiping)가 시작되면 뷰어를 비운다
 *   ⑩-i 다른 탭에서 원문을 지웠으면 이 탭으로 돌아올 때 다시 확인해 내린다
 *   ⑩-j indexedDB.databases() 가 없는 브라우저에서는 저장소를 열지(만들지) 않는다
 *   ⑪-a (ⓑ) 파일 연결 — 다른 탭 확인을 거쳐 보관하고 이 문제집에서 자유 탐색. 확인을 취소하면 아무것도 저장하지 않는다
 *   ⑪-b 이 문항 = n쪽 · 쪽 더하기 · ⌘Z 한 번으로 되돌림
 *   ⑪-c 수동 쪽 지정이 같은 문항의 AI 출처를 지우지 않는다 · 지정 해제도 그 원문만 뺀다
 *   ⑪-d 다시 연결 — 같은 파일은 이 문제집에 이어지고, 다른 파일은 새 원본이며 옛 쪽 지정을 옮기지 않는다
 *   ⑪-e 설정의 원문 삭제 — 영향 범위를 보여 준 뒤 지우고, 그 원문을 가리키던 문항은 '삭제됨' 이 된다
 *
 * 원문은 B6 fixture(createIntakeFixture)로 실제 IDB 에 넣는다 — 운영에서 쓰는 저장 경로 그대로다.
 * 깨보기: 고장을 심은 index.html(인라인 해시를 다시 맞춘 사본)로 대응 항목이 빨간불이 되는지 본다.
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

/* 두 쪽짜리 PDF — 쪽마다 색이 다른 사각형 하나. 오프셋을 계산해 xref 를 맞춘다. */
function twoPagePdf(){
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 280] /Contents 4 0 R >>',
    null,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 280] /Contents 6 0 R >>',
    null,
  ];
  const stream=s=>`<< /Length ${s.length} >>\nstream\n${s}\nendstream`;
  objs[3]=stream('0 0 1 rg 20 20 160 240 re f');
  objs[5]=stream('1 0 0 rg 20 20 160 240 re f');
  let out='%PDF-1.4\n'; const offs=[];
  objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const x=out.length;
  out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');
  out+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out,'latin1').toString('base64');
}
const PDF64=twoPagePdf();
const PDF_FILE={name:'원본.pdf',mimeType:'application/pdf',buffer:Buffer.from(PDF64,'base64')};
/* 진짜 파일 선택 창을 거친다 — 단추를 누르면 열리는 그 창에 파일을 넣는다 */
async function chooseFile(q,btn,file){
  const [fc]=await Promise.all([q.waitForEvent('filechooser'),q.click(btn)]);
  await fc.setFiles(file);
}
/* 다시 연결 — 'same' 은 이 기기에 보관된 그 원문의 바이트, 'other' 는 다른 그림. 다시 연결 단추의 파일 창에 넣는다. */
async function relinkWith(q,sid,kind){
  const b64=await q.evaluate(async({sid,kind})=>{
    let blob;
    if(kind==='same') blob=(await PedagogyIntake.create({renderer:{},session:()=>({owner:intakeOwner(),epoch:authEpoch})}).readSource(sid)).blob;
    else{ const c=document.createElement('canvas'); c.width=120; c.height=90; c.getContext('2d').fillRect(0,0,60,45); blob=await new Promise(r=>c.toBlob(r,'image/png')); }
    const u=new Uint8Array(await blob.arrayBuffer()); let s=''; u.forEach(v=>s+=String.fromCharCode(v)); return btoa(s);
  },{sid,kind});
  await chooseFile(q,'#sheetSrcRelink',{name:kind+'.png',mimeType:'image/png',buffer:Buffer.from(b64,'base64')});
}

let browser;
async function open(html){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'ko-KR'});
  await ctx.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.origin===base&&u.pathname==='/index.html'&&html) return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
    return (u.origin===base||u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort();
  });
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  // 확인창 — 검사가 미리 정한 답(dialogPlan)대로 누르고 문구를 남긴다. 계획이 없으면 취소(안전한 쪽).
  p.dialogPlan=[]; p.dialogs=[];
  p.on('dialog',d=>{ p.dialogs.push(d.message()); const a=p.dialogPlan.shift(); return a?d.accept():d.dismiss(); });
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof showEditor==='function'&&typeof createIntakeFixture==='function'&&Array.isArray(sets),null,{timeout:15000});
  return p;
}

/* 원문 둘(이미지·PDF)을 B6 fixture 로 넣고 채택한다. 출처 없는 권과 권한 없는 사본도 만든다. */
async function seedSources(p){
  return p.evaluate(async pdf64=>{
    localStorage.clear(); currentUser=null; authEpoch++; sets=[]; localDirty=true; writeLocalNow();
    const config={files:1,fileBytes:200000,totalBytes:1000000,pages:2,minDimension:1,maxDimension:1000,imageBytes:100000,
      requestBytes:200000,calls:2,retries:1,problemsPerPage:1,problemsPerJob:2,problemsPerSet:500,fieldChars:1000,blocks:10,items:10};
    const renderer={count:async f=>f.type==='application/pdf'?2:1,
      page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
    let n=0;
    const transport=async()=>({task:PedagogyIntakeContract.TASK,problems:[{title:'',answer:'',
      blocks:[{type:'statement',text:'원본 문제 '+(++n)}],units:[],difficulty:'중',points:null,pointsState:'absent',group:null}],usage:{used:1,limit:1}});
    const client=createIntakeFixture({config,renderer,transport,editorsConfirmed:true});
    const adoptOne=async(file,name)=>{
      const {jobId}=await client.createJob([file]); await client.run(jobId); const j=await client.readJob(jobId);
      const report=await client.adopt(jobId,{draftVersion:j.draftVersion,destinations:[{id:'d-'+name,name,
        items:j.drafts.map((d,i)=>({draftId:d.id,placementId:String(i+1)}))}]});
      await client.finishJob(jobId); return report.results[0].setId;
    };
    const c=document.createElement('canvas'); c.width=300; c.height=200;
    const g=c.getContext('2d'); g.fillStyle='#2b6fd6'; g.fillRect(0,0,300,200);
    const png=await new Promise(r=>c.toBlob(r,'image/png'));
    const imgSet=await adoptOne(new File([png],'원본.png',{type:'image/png'}),'이미지 원본권');
    const bytes=Uint8Array.from(atob(pdf64),ch=>ch.charCodeAt(0));
    const pdfSet=await adoptOne(new File([bytes],'원본.pdf',{type:'application/pdf'}),'PDF 원본권');
    const copy=structuredClone(sets.find(s=>s.id===imgSet)); copy.id='copy-unlinked'; copy.name='권한 없는 사본'; sets.push(copy);
    sets.push(normSet({id:'plain',name:'출처 없음',problems:[{id:'pq1',blocks:[{type:'statement',data:{text:'손으로 쓴 문제'}}]}]},{keepId:true}));
    localDirty=true; writeLocalNow();
    const pdfQs=sets.find(s=>s.id===pdfSet).problems.map(q=>({id:q.id,pages:q.intake?.sources?.[0]?.pages}));
    return {imgSet,pdfSet,pdfQs};
  },PDF64);
}
async function toSheetOf(p,setId,qid=null){
  await p.evaluate(({setId,qid})=>{showEditor(setId); if(qid) currentQId=sets.find(s=>s.id===setId).problems.find(q=>q.id===qid).id;},{setId,qid});
  await p.evaluate(()=>{ if(editorMode!=='sheet') document.querySelector('#viewSeg button[data-view="sheet"]').click(); });
  await p.waitForFunction(()=>editorMode==='sheet');
}
const srcState=p=>p.evaluate(()=>({
  btnHidden:$('#sheetSrcBtn').hidden, btnShown:getComputedStyle($('#sheetSrcBtn')).display!=='none',
  panel:getComputedStyle($('#sheetSrc')).display, msg:$('#sheetSrcMsg').textContent, label:$('#sheetSrcPage').textContent,
  img:(()=>{const im=$('#sheetSrcView img');return im?{w:im.naturalWidth,src:im.src.slice(0,5)}:null;})(),
  canvas:$('#sheetSrcView canvas')?.getAttribute('aria-label')||null,
  prevDis:$('#sheetSrcPrev').disabled, nextDis:$('#sheetSrcNext').disabled}));

async function suite(html){
  const failures=[], checks=[];
  const check=async(name,fn)=>{checks.push(name);try{await fn();}catch(e){failures.push(name+': '+(e?.message||e).split('\n')[0]);}};
  const ok=(v,msg)=>{if(!v)throw new Error(msg);};
  const p=await open(html);
  let seed;
  try{ seed=await seedSources(p); }catch(e){ failures.push('준비: 원문 채택 실패 '+(e?.message||e)); return {checks,failures}; }

  await check('⑩-a 원본 단추는 늘 보이고 누르기 전에는 패널이 없다 · 연결 안 된 권은 안내만',async()=>{
    await toSheetOf(p,'plain');
    const r=await srcState(p);
    ok(!r.btnHidden&&r.btnShown,'단추가 안 보인다 '+JSON.stringify(r));
    ok(r.panel==='none','누르기 전에 패널이 보인다(display '+r.panel+')');
    await p.click('#sheetSrcBtn');
    await p.waitForFunction(()=>/연결된 원본이 없어요/.test($('#sheetSrcMsg').textContent),null,{timeout:8000});
    const r2=await p.evaluate(()=>({add:!$('#sheetSrcAdd').hidden,img:!!$('#sheetSrcView img,#sheetSrcView canvas')}));
    ok(r2.add&&!r2.img,'연결 안내가 아니다 '+JSON.stringify(r2));
    await p.click('#sheetSrcBtn');
  });
  await check('⑩-b 이미지 원문이 패널에 보인다',async()=>{
    await toSheetOf(p,seed.imgSet);
    ok(!(await srcState(p)).btnHidden,'원본 단추가 안 보인다');
    await p.click('#sheetSrcBtn');
    await p.waitForFunction(()=>{const im=$('#sheetSrcView img');return im&&im.complete&&im.naturalWidth>0;},null,{timeout:8000});
    const r=await srcState(p);
    ok(r.panel!=='none','패널이 열리지 않았다');
    ok(r.img&&r.img.w===300&&r.img.src==='blob:','원문 그림이 아니다 '+JSON.stringify(r.img));
    ok(/1 \/ 1쪽 · 이 문항: 1쪽/.test(r.label),'쪽 표시 '+r.label);
    ok(await p.evaluate(()=>$('#sheetSrcBtn').getAttribute('aria-pressed'))==='true','aria-pressed 가 안 바뀌었다');
  });
  await check('⑩-c PDF 원문이 지정된 쪽으로 열리고 넘어간다',async()=>{
    const second=seed.pdfQs.find(q=>q.pages?.[0]===2);
    ok(second,'2쪽 문항이 채택되지 않았다 '+JSON.stringify(seed.pdfQs));
    await toSheetOf(p,seed.pdfSet,second.id);
    await p.evaluate(()=>{ if(!srcOpen) $('#sheetSrcBtn').click(); });
    await p.waitForFunction(()=>$('#sheetSrcView canvas')?.getAttribute('aria-label')==='원본 2쪽',null,{timeout:15000});
    let r=await srcState(p);
    ok(/2 \/ 2쪽 · 이 문항: 2쪽/.test(r.label),'쪽 표시 '+r.label);
    ok(r.nextDis&&!r.prevDis,'끝 쪽 단추 상태 '+JSON.stringify(r));
    const red=await p.evaluate(()=>{const c=$('#sheetSrcView canvas');const d=c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data;return [d[0],d[2]];});
    ok(red[0]>200&&red[1]<80,'2쪽(빨강)이 그려지지 않았다 '+red);
    await p.click('#sheetSrcPrev');
    await p.waitForFunction(()=>$('#sheetSrcView canvas')?.getAttribute('aria-label')==='원본 1쪽',null,{timeout:8000});
    r=await srcState(p);
    ok(/1 \/ 2쪽/.test(r.label)&&r.prevDis,'이전 쪽 이동 '+JSON.stringify(r));
  });
  await check('⑩-d 연결 권한이 없는 사본에서는 원문을 열지 않는다',async()=>{
    await toSheetOf(p,'copy-unlinked');
    await p.evaluate(()=>{ if(!srcOpen) $('#sheetSrcBtn').click(); });
    await p.waitForFunction(()=>/원본|없/.test($('#sheetSrcMsg').textContent)&&!/여는 중/.test($('#sheetSrcMsg').textContent),null,{timeout:8000});
    const r=await srcState(p);
    ok(!r.img&&!r.canvas,'권한 없는 문제집에서 원문이 보인다 '+JSON.stringify(r));
    ok(/이 브라우저에 연결된 원본이 없습니다/.test(r.msg),'안내 '+r.msg);
  });
  await check('⑩-h 라이브러리로 나가거나 삭제가 시작되면 뷰어를 비운다',async()=>{
    const q=await open(html);   // 자기 창 — '모든 문제집 삭제' 가 뒤 검사의 자료를 지우지 않게
    try{
      const s2=await seedSources(q);
      for(const how of ['library','wiping']){
        await toSheetOf(q,s2.imgSet);
        await q.evaluate(()=>{ if(!srcOpen) $('#sheetSrcBtn').click(); });
        await q.waitForFunction(()=>$('#sheetSrcView img')?.naturalWidth>0,null,{timeout:8000});
        const r=await q.evaluate(async how=>{
          const state=()=>({open:srcOpen,view:!!srcView,kids:$('#sheetSrcView').childElementCount});
          if(how==='library'){ showLibrary(); return state(); }
          /* '삭제 구간 동안' 닫혔는지 본다 — 끝에 라이브러리로 가며 닫히는 것과 가른다. 비로그인 삭제는 대기 없이 한 번에 끝나서
             첫 await 전에 재도 끝난 뒤의 상태다. 그래서 wiping 이 켜진 직후(바로 다음 줄의 clearTimeout)의 상태를 잡는다. */
          let during=null; const ct=window.clearTimeout;
          window.clearTimeout=function(...a){ if(during===null&&wiping) during=state(); return ct.apply(this,a); };
          try{ await deleteAllSets().catch(()=>{}); }finally{ window.clearTimeout=ct; }
          return during||{missed:'wiping 구간을 관측하지 못했다'};
        },how);
        ok(!r.open&&!r.view&&r.kids===0,how+' 뒤에도 원본 뷰어가 남았다 '+JSON.stringify(r));
      }
    }finally{ await q.context().close(); }
  });
  await check('⑩-e 계정이 바뀌면 패널·뷰어가 닫힌다',async()=>{
    await toSheetOf(p,seed.imgSet);
    await p.evaluate(()=>{ if(!srcOpen) $('#sheetSrcBtn').click(); });
    await p.waitForFunction(()=>$('#sheetSrcView img')?.naturalWidth>0,null,{timeout:8000});
    // ⚠️ 첫 await 전에 동기로 판정한다 — 그 뒤에는 라이브러리 이동(showLibrary)이 대신 닫아 줘서 onAuth 의 정리가 빠져도 통과한다.
    const r=await p.evaluate(()=>{ onAuth({uid:'other-account',email:'x@example.com'}).catch(()=>{});
      return {open:srcOpen,panel:getComputedStyle($('#sheetSrc')).display,kids:$('#sheetSrcView').childElementCount}; });
    ok(!r.open&&r.panel==='none'&&r.kids===0,'계정 전환 뒤에도 원본이 남았다 '+JSON.stringify(r));
  });
  await p.context().close();

  await check('⑩-i 다른 탭에서 원문을 지웠으면 돌아올 때 다시 확인해 내린다',async()=>{
    const q=await open(html);
    try{
      const s2=await seedSources(q);
      await toSheetOf(q,s2.imgSet);
      await q.evaluate(()=>{ if(!srcOpen) $('#sheetSrcBtn').click(); });
      await q.waitForFunction(()=>$('#sheetSrcView img')?.naturalWidth>0,null,{timeout:8000});
      // 다른 탭의 deleteSource() 를 흉내 낸다 — 이 탭의 저장소 읽기가 이제 '삭제됨' 을 돌려준다
      // B6 클라이언트는 동결돼 있어 함수만 바꿔치기할 수 없다 — 읽기 클라이언트를 통째로 갈아 끼운다
      await q.evaluate(()=>{ srcReader={forSet:async()=>({state:'missing'}),forProblem:async()=>({state:'deleted'})}; });
      await q.evaluate(()=>{
        Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await q.waitForFunction(()=>/삭제됐어요/.test($('#sheetSrcMsg').textContent),null,{timeout:5000});
      const r=await q.evaluate(()=>({view:!!srcView,kids:$('#sheetSrcView').childElementCount}));
      ok(!r.view&&r.kids===0,'지운 원문이 계속 보인다 '+JSON.stringify(r));
    }finally{ await q.context().close(); }
  });

  await check('⑩-f 원문 저장소가 없으면 만들지 않는다',async()=>{
    const q=await open(html);
    try{
      const r=await q.evaluate(async()=>{
        sets.push(normSet({id:'forged',name:'출처만 있는 권',problems:[{id:'fq',blocks:[{type:'statement',data:{text:'문제'}}],
          intake:{version:1,sources:[{sourceId:crypto.randomUUID(),pages:[1]}]}}]},{keepId:true}));
        showEditor('forged'); $('#viewSeg button[data-view="sheet"]').click();
        $('#sheetSrcBtn').click();
        for(let i=0;i<100&&/여는 중|^$/.test($('#sheetSrcMsg').textContent);i++) await new Promise(r=>setTimeout(r,20));
        return {msg:$('#sheetSrcMsg').textContent,dbs:(await indexedDB.databases()).map(d=>d.name)};
      });
      ok(!r.dbs.includes('PM_INTAKE_V1'),'원문 저장소를 새로 만들었다 '+JSON.stringify(r.dbs));
      ok(/이 브라우저에 연결된 원본이 없습니다/.test(r.msg),'안내 '+r.msg);
    }finally{ await q.context().close(); }
  });
  await check('⑩-j databases() 가 없는 브라우저에서는 저장소를 열지 않는다',async()=>{
    const q=await open(html);
    try{
      const r=await q.evaluate(async()=>{
        const real=IDBFactory.prototype.databases;
        sets.push(normSet({id:'forged2',name:'출처만 있는 권',problems:[{id:'fq2',blocks:[{type:'statement',data:{text:'문제'}}],
          intake:{version:1,sources:[{sourceId:crypto.randomUUID(),pages:[1]}]}}]},{keepId:true}));
        showEditor('forged2'); $('#viewSeg button[data-view="sheet"]').click();
        Object.defineProperty(IDBFactory.prototype,'databases',{configurable:true,value:undefined});
        try{
          $('#sheetSrcBtn').click();
          for(let i=0;i<100&&/여는 중|^$/.test($('#sheetSrcMsg').textContent);i++) await new Promise(r=>setTimeout(r,20));
        }finally{ Object.defineProperty(IDBFactory.prototype,'databases',{configurable:true,writable:true,value:real}); }
        await new Promise(r=>setTimeout(r,100));
        return {msg:$('#sheetSrcMsg').textContent,dbs:(await indexedDB.databases()).map(d=>d.name)};
      });
      ok(!r.dbs.includes('PM_INTAKE_V1'),'databases() 가 없을 때 저장소를 만들었다 '+JSON.stringify(r.dbs));
      ok(/이 브라우저에 연결된 원본이 없습니다/.test(r.msg),'안내 '+r.msg);
    }finally{ await q.context().close(); }
  });
  await check('⑩-g 닫은 뒤 늦게 도착한 원문은 올리지 않는다',async()=>{
    const q=await open(html);
    try{
      const s2=await seedSources(q);
      await toSheetOf(q,s2.imgSet);
      const r=await q.evaluate(async()=>{
        srcOpen=true; $('#sheetSrc').hidden=false;
        const pending=renderSheetSource(true);
        closeSheetSource();
        await pending; await new Promise(r=>setTimeout(r,100));
        return {kids:$('#sheetSrcView').childElementCount,view:!!srcView};
      });
      ok(r.kids===0&&!r.view,'닫은 뒤 원문이 올라왔다 '+JSON.stringify(r));
    }finally{ await q.context().close(); }
  });
  await check('⑪-a 파일 연결 — 다른 탭 확인을 거쳐 보관 · 취소하면 아무것도 저장하지 않는다',async()=>{
    const q=await open(html);
    try{
      await q.evaluate(()=>{ sets.push(normSet({id:'manual',name:'손으로 만든 권',problems:[{id:'mq1',blocks:[{type:'statement',data:{text:'문제'}}]}]},{keepId:true})); });
      await toSheetOf(q,'manual');
      await q.click('#sheetSrcBtn');
      q.dialogPlan.push(false);
      await chooseFile(q,'#sheetSrcAdd',PDF_FILE);
      await q.waitForTimeout(300);
      const no=await q.evaluate(async()=>({dbs:(await indexedDB.databases()).map(d=>d.name)}));
      ok(!no.dbs.includes('PM_INTAKE_V1'),'확인을 취소했는데 원문 저장소가 생겼다');
      ok(/다른 탭/.test(q.dialogs[0]||''),'다른 탭 확인을 묻지 않았다 '+q.dialogs[0]);
      q.dialogPlan.push(true);
      await chooseFile(q,'#sheetSrcAdd',PDF_FILE);
      await q.waitForFunction(()=>$('#sheetSrcView canvas')?.getAttribute('aria-label')==='원본 1쪽',null,{timeout:15000});
      const r=await q.evaluate(async()=>({msg:$('#sheetSrcMsg').textContent,list:(await (await sheetSourceReader()).forSet('manual')).sources.length}));
      ok(/쪽이 지정되지 않았어요/.test(r.msg),'자유 탐색 안내가 아니다 '+r.msg);
      ok(r.list===1,'이 문제집에 연결되지 않았다 '+r.list);
    }finally{ await q.context().close(); }
  });
  await check('⑪-b 이 문항 = n쪽 · 쪽 더하기 · ⌘Z 한 번',async()=>{
    const q=await open(html);
    try{
      await q.evaluate(()=>{ sets.push(normSet({id:'manual',name:'손으로 만든 권',problems:[{id:'mq1',blocks:[{type:'statement',data:{text:'문제'}}]}]},{keepId:true})); });
      await toSheetOf(q,'manual'); await q.click('#sheetSrcBtn');
      q.dialogPlan.push(true); await chooseFile(q,'#sheetSrcAdd',PDF_FILE);
      await q.waitForFunction(()=>$('#sheetSrcView canvas')?.getAttribute('aria-label')==='원본 1쪽',null,{timeout:15000});
      await q.click('#sheetSrcNext');
      await q.waitForFunction(()=>$('#sheetSrcView canvas')?.getAttribute('aria-label')==='원본 2쪽',null,{timeout:8000});
      await q.click('#sheetSrcAssign');
      const pages=()=>q.evaluate(()=>JSON.stringify(sets.find(s=>s.id==='manual').problems[0].intake?.sources?.map(x=>x.pages)||null));
      await q.waitForFunction(()=>sets.find(s=>s.id==='manual').problems[0].intake?.sources?.[0]?.pages?.[0]===2,null,{timeout:8000});
      await q.waitForFunction(()=>/이 문항: 2쪽/.test($('#sheetSrcPage').textContent),null,{timeout:8000});
      await q.click('#sheetSrcPrev');
      await q.waitForFunction(()=>!$('#sheetSrcAddPage').hidden,null,{timeout:8000});
      await q.click('#sheetSrcAddPage');
      await q.waitForFunction(()=>JSON.stringify(sets.find(s=>s.id==='manual').problems[0].intake?.sources?.[0]?.pages)==='[1,2]',null,{timeout:8000});
      await q.evaluate(()=>doUndo());
      ok(await pages()==='[[2]]','⌘Z 한 번이 쪽 더하기를 되돌리지 않았다 '+await pages());
    }finally{ await q.context().close(); }
  });
  await check('⑪-c 수동 쪽 지정이 같은 문항의 AI 출처를 지우지 않는다',async()=>{
    const q=await open(html);
    try{
      const s2=await seedSources(q);
      await toSheetOf(q,s2.imgSet); await q.click('#sheetSrcBtn');
      await q.waitForFunction(()=>$('#sheetSrcView img')?.naturalWidth>0,null,{timeout:8000});
      const ai=await q.evaluate(id=>sets.find(s=>s.id===id).problems[0].intake.sources[0].sourceId,s2.imgSet);
      q.dialogPlan.push(true); await chooseFile(q,'#sheetSrcAdd',PDF_FILE);
      await q.waitForFunction(()=>$('#sheetSrcView canvas')?.getAttribute('aria-label')==='원본 1쪽',null,{timeout:15000});
      await q.click('#sheetSrcAssign');
      await q.waitForFunction(id=>(sets.find(s=>s.id===id).problems[0].intake?.sources||[]).length===2,s2.imgSet,{timeout:8000});
      let ids=await q.evaluate(id=>sets.find(s=>s.id===id).problems[0].intake.sources.map(x=>x.sourceId),s2.imgSet);
      ok(ids.includes(ai),'AI 출처가 사라졌다 '+JSON.stringify(ids));
      await q.click('#sheetSrcUnassign');
      await q.waitForFunction(id=>(sets.find(s=>s.id===id).problems[0].intake?.sources||[]).length===1,s2.imgSet,{timeout:8000});
      ids=await q.evaluate(id=>sets.find(s=>s.id===id).problems[0].intake.sources.map(x=>x.sourceId),s2.imgSet);
      ok(ids.length===1&&ids[0]===ai,'지정 해제가 AI 출처를 건드렸다 '+JSON.stringify(ids));
    }finally{ await q.context().close(); }
  });
  await check('⑪-d 다시 연결 — 같은 파일은 이 문제집에 이어지고 다른 파일은 옛 쪽 지정을 옮기지 않는다',async()=>{
    const q=await open(html);
    try{
      const s2=await seedSources(q);
      await q.evaluate(id=>{ const c=structuredClone(sets.find(s=>s.id===id)); c.id='copy-2'; c.name='권한 없는 사본 2'; sets.push(c); },s2.imgSet);
      const sid=await q.evaluate(()=>sets.find(s=>s.id==='copy-unlinked').problems[0].intake.sources[0].sourceId);
      await toSheetOf(q,'copy-unlinked'); await q.click('#sheetSrcBtn');
      await q.waitForFunction(()=>!$('#sheetSrcRelink').hidden,null,{timeout:8000});
      q.dialogPlan.push(true);
      await relinkWith(q,sid,'same');
      await q.waitForFunction(()=>$('#sheetSrcView img')?.naturalWidth>0,null,{timeout:8000});
      await toSheetOf(q,'copy-2');
      await q.waitForFunction(()=>!$('#sheetSrcRelink').hidden,null,{timeout:8000});
      q.dialogPlan.push(true);
      await relinkWith(q,sid,'other');
      await q.waitForFunction(()=>$('#sheetSrcView img')?.naturalWidth>0,null,{timeout:8000});
      const r=await q.evaluate(async sid=>{
        const p=sets.find(s=>s.id==='copy-2').problems[0];
        const fs=await (await sheetSourceReader()).forSet('copy-2');
        return {ref:p.intake.sources.map(x=>x.sourceId),linked:fs.sources.map(x=>x.sourceId),sid};
      },sid);
      ok(r.ref.length===1&&r.ref[0]===sid,'옛 쪽 지정이 바뀌었다 '+JSON.stringify(r));
      ok(r.linked.length===1&&r.linked[0]!==sid,'다른 파일이 새 원본으로 연결되지 않았다 '+JSON.stringify(r));
      ok(q.dialogs.some(m=>/다른 파일/.test(m)),'다른 파일임을 묻지 않았다');
    }finally{ await q.context().close(); }
  });
  await check('⑪-e 설정의 원문 삭제 — 영향 범위를 보여 준 뒤 지운다',async()=>{
    const q=await open(html);
    try{
      const s2=await seedSources(q);
      const second=s2.pdfQs.find(x=>x.pages?.[0]===2);
      await q.evaluate(()=>{ srcEditorsOk=true; });
      await q.evaluate(()=>showSettings('data'));
      await q.waitForFunction(()=>$('#dmSourcesList li'),null,{timeout:8000});
      q.dialogPlan.push(true);
      await q.locator('#dmSourcesList li',{hasText:'원본.pdf'}).getByRole('button',{name:/원문 삭제/}).click();
      await q.waitForFunction(()=>![...$('#dmSourcesList').querySelectorAll('li')].some(li=>/원본\.pdf/.test(li.textContent)),null,{timeout:8000});
      ok(q.dialogs.some(m=>/PDF 원본권/.test(m)&&/되돌릴 수 없어요/.test(m)),'영향 범위를 보여 주지 않았다 '+JSON.stringify(q.dialogs));
      await q.evaluate(()=>{ $('#settingsView').close(); });
      await toSheetOf(q,s2.pdfSet,second.id);
      await q.evaluate(()=>{ if(!srcOpen) $('#sheetSrcBtn').click(); });
      await q.waitForFunction(()=>/삭제됐어요/.test($('#sheetSrcMsg').textContent),null,{timeout:8000});
      const r=await q.evaluate(id=>({n:sets.find(s=>s.id===id).problems.length,view:!!srcView}),s2.pdfSet);
      ok(r.n===2&&!r.view,'문항이 사라졌거나 지운 원문이 보인다 '+JSON.stringify(r));
    }finally{ await q.context().close(); }
  });
  /* REV-2026-118 — 설정의 원문 목록은 await 를 지나는 사이 계정이 바뀌거나 새 목록이 오면 늦은 쪽이 아무것도 쓰지 않는다.
     persisted() 를 문 앞에 붙잡아 '이전 계정의 목록은 이미 읽었고 DOM 쓰기만 남은' 순간을 만든다(Codex 재현 절차). */
  await check('⑪-f 설정의 원문 목록 — 계정 전환·새 요청 뒤 늦게 끝난 목록은 쓰지 않는다',async()=>{
    const q=await open(html);
    try{
      await seedSources(q);
      const r=await q.evaluate(async()=>{
        const native=navigator.storage.persisted.bind(navigator.storage);
        const hold=async()=>{
          let release; navigator.storage.persisted=()=>new Promise(res=>{ release=res; });
          const run=renderDataSources();
          for(let i=0;i<400&&!release;i++) await new Promise(res=>setTimeout(res,10));
          navigator.storage.persisted=native;
          if(!release) throw Error('목록 읽기가 persisted() 에 닿지 않았다');
          return {run,release};
        };
        const text=()=>$('#dmSourcesList').textContent+'|'+$('#dmSourcesInfo').textContent;
        showSettings('data'); await renderDataSources();
        const a0=$('#dmSourcesList').childElementCount;
        // ① 다 그린 뒤 계정이 바뀌면 이전 목록은 바로 사라진다
        await onAuth({uid:'u15-review-B',email:'b@example.invalid',displayName:'검토 B'});
        const afterSwitch=$('#dmSourcesList').childElementCount;
        // ② 이전 계정 목록이 붙잡힌 채 계정이 바뀌고, 놓으면 — 아무것도 쓰지 않는다
        await onAuth(null);
        const h2=await hold();
        await onAuth({uid:'u15-review-B',email:'b@example.invalid',displayName:'검토 B'});
        const b2=text(); h2.release(false); await h2.run;
        const a2=text();
        // ③ Codex 재현: 붙잡힌 이전 목록 → 전환 → 새 계정 목록 → 놓기
        await onAuth(null);
        const h3=await hold();
        await onAuth({uid:'u15-review-C',email:'c@example.invalid',displayName:'검토 C'});
        showSettings('data'); await renderDataSources();
        const b3=text(); h3.release(false); await h3.run;
        const a3=text();
        // ④ 같은 계정 — 먼저 시작한 목록이 나중 목록을 덮지 않는다
        await onAuth(null); await renderDataSources();
        const h4=await hold();
        await renderDataSources();
        $('#dmSourcesInfo').textContent='나중 목록';
        h4.release(true); await h4.run;
        const a4=$('#dmSourcesInfo').textContent;
        return {a0,afterSwitch,b2,a2,b3,a3,a4};
      });
      ok(r.a0>=2,'준비: 이전 계정 목록이 그려지지 않았다 '+JSON.stringify(r));
      ok(r.afterSwitch===0,'계정이 바뀌어도 이전 목록이 남았다 '+JSON.stringify(r));
      ok(r.a2===r.b2&&!/원본\.p/.test(r.a2),'붙잡힌 이전 계정 목록이 전환 뒤 쓰였다 '+JSON.stringify(r));
      ok(r.a3===r.b3&&!/원본\.p/.test(r.a3),'이전 계정 목록이 새 계정 설정을 덮었다 '+JSON.stringify(r));
      ok(r.a4==='나중 목록','먼저 시작한 목록이 나중 목록을 덮었다 '+JSON.stringify(r));
    }finally{ await q.context().close(); }
  });
  if(p.errs.length) failures.push('페이지 오류: '+p.errs.join(' | '));
  return {checks,failures};
}

const BREAKS=[
  {name:'[hidden] 패널을 display:flex 가 이긴다',target:'⑩-a',
   pairs:[['.sheet-src[hidden]{display:none}\n','']]},
  {name:'다른 탭 확인을 건너뛰고 보관한다',target:'⑪-a',
   pairs:[['  if(!srcEditorsOk){\n    if(!confirm(','  if(false){\n    if(!confirm(']]},
  {name:'쪽 더하기가 기존 쪽을 버린다',target:'⑪-b',
   pairs:[['const pages=mode==="add"?[...new Set([...(mine?.pages||[]),srcPage])].sort((a,b)=>a-b):[srcPage];','const pages=[srcPage];']]},
  {name:'수동 쪽 지정이 다른 원문의 출처를 버린다',target:'⑪-c',
   pairs:[['const next=mode==="remove"?others:[...others,{sourceId:cur.sourceId,pages}];','const next=mode==="remove"?[]:[{sourceId:cur.sourceId,pages}];']]},
  {name:'설정의 원문 삭제가 기록 식별자를 잘못 읽는다',target:'⑪-e',
   pairs:[['  const im=await w.impact(src.id);','  const im=await w.impact(src.sourceId);']]},
  {name:'같은 파일 다시 연결이 이 문제집에 잇지 않는다',target:'⑪-d',
   pairs:[['if(r===mode.sourceId){ await w.linkSource(r,s.id); srcSel=r;','if(r===mode.sourceId){ srcSel=r;']]},
  {name:'지정된 쪽이 아니라 늘 1쪽으로 연다',target:'⑩-c',
   pairs:[['    srcPage=srcMapped[0]||1;\n','    srcPage=1;\n']]},
  {name:'권한 검사(forProblem)를 건너뛰고 출처 ID 로 연다',target:'⑩-d',
   pairs:[['    const r=await reader.forProblem(s.id,q);\n',
           '    const r=await reader.readSource(refs[0].sourceId).then(x=>({state:"available",sourceId:x.id,blob:x.blob,pages:refs[0].pages}));\n']]},
  {name:'계정 전환 때 원본 패널을 닫지 않는다',target:'⑩-e',
   pairs:[['    closeSheetSource();   // 원본 패널','    void 0;   // 원본 패널']]},
  {name:'원문 저장소가 없어도 만든다',target:'⑩-f',
   pairs:[['  if(typeof indexedDB.databases!=="function"||!(await indexedDB.databases()).some(d=>d?.name==="PM_INTAKE_V1")) return null;\n','']]},
  {name:'라이브러리로 나가도 원본 뷰어를 닫지 않는다',target:'⑩-h',
   pairs:[['  closeSheetSource();   // 원본 뷰어를 편집기 밖에','  void 0;   // 원본 뷰어를 편집기 밖에']]},
  {name:'삭제(wiping)가 시작돼도 원본 뷰어를 닫지 않는다',target:'⑩-h',
   pairs:[['  wiping=true; closeSheetSource();\n  clearTimeout(saveTimer); clearTimeout(localTimer);','  wiping=true;\n  clearTimeout(saveTimer); clearTimeout(localTimer);']]},
  {name:'탭으로 돌아와도 원문을 다시 확인하지 않는다',target:'⑩-i',
   pairs:[['  if(document.visibilityState==="visible"&&srcOpen) renderSheetSource(true)','  if(false) renderSheetSource(true)']]},
  {name:'databases() 가 없으면 확인 없이 연다',target:'⑩-j',
   pairs:[['  if(typeof indexedDB.databases!=="function"||!(await indexedDB.databases()).some(','  if(typeof indexedDB.databases==="function"&&!(await indexedDB.databases()).some(']]},
  {name:'늦은 결과를 세대로 버리지 않는다',target:'⑩-g',
   pairs:[['  const live=()=>gen===srcGen&&srcOpen&&sessionMatches(session);\n  srcMapped=[];','  const live=()=>true;\n  srcMapped=[];']]},
  {name:'설정의 원문 목록이 늦은 결과를 버리지 않는다',target:'⑪-f',
   pairs:[['  if(!live()) return;\n  info.textContent=rows.length','  info.textContent=rows.length']]},
  {name:'계정 전환 때 설정의 원문 목록을 비우지 않는다',target:'⑪-f',
   pairs:[['    resetDataSources();   // 설정의 원문 목록','    void 0;   // 설정의 원문 목록']]},
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
  for(const b of BREAKS){
    const r=await suite(mutate(b.pairs));
    const hit=r.failures.some(f=>f.startsWith(b.target));
    console.log(`${hit?'RED ':'MISS'} 깨보기 '${b.name}' → ${b.target} ${hit?'빨간불':'초록불(검사가 헛돈다)'}`);
    if(!hit) exit=1;
  }
  console.log(`원본 대조 검사 ${main.checks.length}개 · 깨보기 ${BREAKS.length}개 · ${Math.round((Date.now()-t0)/1000)}s`);
}catch(e){ console.error(e); exit=1; }
finally{ await browser?.close(); server.kill(); }
process.exit(exit);
