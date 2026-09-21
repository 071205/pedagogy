/* 문제집 클라우드 저장의 **크기 선제 방어**를 진짜 브라우저에서 확인한다.
 * 계약: docs/STORAGE-CONTRACT.md §1 · 근거: docs/PROBLEM-INTAKE-DESIGN.md §20
 *
 * ⚠️ 왜 이 검사가 있나 — Firestore 배치는 **원자적**이라 한도를 넘는 문제집 하나가
 *    섞이면 **같이 올라가던 멀쩡한 문제집까지 통째로 실패한다.** 크기뿐 아니라
 *    Firestore 가 거부하는 중첩 배열도 문제집 하나만 격리해야 한다.
 *
 * ⚠️ 계정·네트워크를 쓰지 않는다. Firestore 는 통째로 가짜다.
 * 깨보기: SETS_SIZE_RED=1 이면 방어가 없던 33af005 의 index.html 을 대신 서빙한다.
 *         그때 이 검사는 **반드시 실패해야 한다.**
 */
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const BASE_COMMIT='33af005';
const base='http://127.0.0.1:18884';
const server=spawn('python3',['serve.py','--port','18884'],{stdio:'ignore'});
const EXPECTED_CHECKS=10;
let browser, harnessFailure=null, checksRun=0;
const failures=[];

async function open(){
  const p=await browser.newPage({viewport:{width:1280,height:900},locale:'ko-KR'});
  p.setDefaultTimeout(8000);
  await p.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(process.env.SETS_SIZE_RED==='1' && u.pathname==='/index.html')
      return r.fulfill({contentType:'text/html',body:execFileSync('git',['show',BASE_COMMIT+':index.html'])});
    return u.origin===base?r.continue():r.abort();
  });
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof writeCloudSnapshot==='function' && typeof setToDoc==='function');
  return p;
}

/* Firestore·토스트·상태표시를 전부 가짜로 바꾸고, 지정한 크기의 문제집들을 만든다.
   bigKoreanChars 가 0 이면 그 문제집은 작다. */
async function stub(p, plan){
  if(process.env.SETS_SIZE_HARNESS_RED==='1') throw new Error('injected fixture setup failure');
  return p.evaluate(plan=>{
    window.__batched=[];      // batch.set 으로 들어간 문서 id
    window.__batchDocs=[];
    window.__commits=0;
    window.__toasts=[];
    window.__status=[];
    window.__flushCalls=0;
    wiping=false;
    currentUser={uid:'u1'};
    cloudSynced.clear();
    setsOversizeKey="";
    if(typeof setsBadShapeKey!=="undefined") setsBadShapeKey="";
    localDirty=false;
    window.PEDAGOGY_PUBLIC_CONFIG={...(window.PEDAGOGY_PUBLIC_CONFIG||{}),setRevisionSchema:0};
    window.sessionMatches=()=>true;
    window.sessionContext=()=>({uid:'u1'});
    window.toast=(m,k)=>window.__toasts.push(String(m));
    window.setSaveStatus=(t,c)=>window.__status.push(String(t||""));
    window.flushToCloud=async()=>{ window.__flushCalls++; };
    /* ⚠️ `SETS_COL` 은 `const` 라 바꿀 수 없다 — 그것이 쓰는 `fbDb`(let) 를 통째로 가짜로
       만든다. 그리고 `fbDb` 는 **맨 이름으로** 대입해야 한다. `window.fbDb=` 는
       렉시컬 바인딩을 덮지 못해 **조용히 아무 일도 안 한다**(CLAUDE.md 의 그 함정).
       반대로 `toast`·`setSaveStatus` 등은 최상위 `function` 이라 `window.` 로 덮인다. */
    const col=()=>({doc:id=>({__id:String(id), collection:col})});
    fbDb={ collection:col, batch:()=>({
      set(ref,doc){ window.__batched.push(ref.__id); window.__batchDocs.push(JSON.parse(JSON.stringify(doc))); },
      async commit(){ window.__commits++; }
    })};
    sets=plan.map(spec=>({
      id:spec.id, name:spec.name, header:'',
      lineColor:'indigo', subject:'math',
      problems:[{id:'p-'+spec.id, title:'', desc:'', answer:'', answerImg:'', numLabel:'', paired:false,
                 blocks:[{type:'statement', data:{text:'가'.repeat(spec.chars)}}]}]
    }));
    return sets.map((s,i)=>({id:s.id, bytes:docBytes(setToDoc(s,i))}));
  }, plan);
}

async function check(name,run){
  let p;
  try{ p=await open(); }
  catch(e){ throw new Error(`${name} 페이지 준비 실패 — ${e.message}`); }
  try{ checksRun++; await run(p); console.log('PASS',name); }
  catch(e){
    if(e?.code!=='ERR_ASSERTION') throw new Error(`${name} 실행 실패 — ${e.message}`);
    failures.push(name); console.error('FAIL',name,'—',e.message);
  }
  finally{ if(p) await p.close(); }
}

try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();

  // ① 한글 바이트로 잰다 — 글자 수로 재면 한도를 통과한다
  await check('한글은 UTF-8 3바이트로 세어 한도를 넘는다', async p=>{
    const sizes=await stub(p,[{id:'big',name:'큰 문제집',chars:330000}]);
    const big=sizes.find(x=>x.id==='big');
    assert.ok(big.bytes>900*1024, `바이트로 재면 한도 초과여야 한다(실제 ${big.bytes})`);
    const chars=await p.evaluate(()=>JSON.stringify(setToDoc(sets[0],0)).length);
    assert.ok(chars<900*1024, `글자 수로 재면 한도를 통과한다 — 그래서 바이트로 재야 한다(실제 ${chars})`);
  });

  // ② 혼합 batch — 정상분은 올라가고 초과분만 빠진다  ★핵심
  await check('초과 문서가 섞여도 정상 문제집은 올라간다', async p=>{
    await stub(p,[{id:'small1',name:'작은 하나',chars:10},
                  {id:'big',name:'큰 문제집',chars:330000},
                  {id:'small2',name:'작은 둘',chars:10}]);
    const r=await p.evaluate(async()=>{ const ok=await writeCloudSnapshot('u1',sessionContext());
      return {ok, batched:window.__batched, commits:window.__commits, toasts:window.__toasts,
              status:window.__status, flushes:window.__flushCalls,
              synced:[...cloudSynced.keys()]}; });
    assert.deepEqual(r.batched.sort(), ['small1','small2'], '초과본이 batch 에 들어갔다');
    assert.equal(r.commits, 1, 'commit 은 한 번');
    assert.deepEqual(r.synced.sort(), ['small1','small2'], '초과본을 동기화됨으로 표시하면 안 된다');
    assert.ok(r.toasts.some(t=>t.includes('큰 문제집')), '어느 문제집이 큰지 이름으로 말해야 한다');
    assert.ok(r.toasts.some(t=>t.includes('이 기기에는 저장돼 있습니다')), '로컬 보존을 알려야 한다');
    assert.ok(r.status.includes('⚠ 용량 초과'), '상태에 용량 초과가 보여야 한다');
    assert.equal(r.ok, false, '완전 성공이 아니므로 true 를 돌려주면 안 된다');
  });

  // ③ 무한 재시도 고리를 만들지 않는다
  await check('초과본 때문에 flushToCloud 가 자기를 다시 부르지 않는다', async p=>{
    await stub(p,[{id:'big',name:'큰 문제집',chars:330000},{id:'small',name:'작은 것',chars:10}]);
    const r=await p.evaluate(async()=>{ await writeCloudSnapshot('u1',sessionContext());
      return {flushes:window.__flushCalls}; });
    assert.equal(r.flushes, 0, '초과본은 재시도 조건에서 빠져야 한다');
  });

  // ④ 정확한 경계값 — 900KiB 까지는 올라가고 1바이트 초과부터 빠진다
  await check('정확히 900KiB는 업로드되고 1바이트 초과는 제외된다', async p=>{
    await stub(p,[{id:'edge',name:'경계',chars:0}]);
    const r=await p.evaluate(async()=>{
      const limit=900*1024;
      const text=sets[0].problems[0].blocks[0].data;
      const baseBytes=docBytes(setToDoc(sets[0],0));
      text.text='a'.repeat(limit-baseBytes);
      const atLimit=docBytes(setToDoc(sets[0],0));
      const first=await writeCloudSnapshot('u1',sessionContext());
      const firstBatch=[...window.__batched];
      text.text+='a';
      window.__batched=[]; window.__toasts=[];
      const overLimit=docBytes(setToDoc(sets[0],0));
      const second=await writeCloudSnapshot('u1',sessionContext());
      return {limit,atLimit,overLimit,first,firstBatch,second,
              secondBatch:window.__batched,toasts:window.__toasts};
    });
    assert.equal(r.atLimit,r.limit,'표본이 정확히 한도여야 한다');
    assert.equal(r.overLimit,r.limit+1,'두 번째 표본이 정확히 1바이트 초과여야 한다');
    assert.equal(r.first,true); assert.deepEqual(r.firstBatch,['edge']);
    assert.equal(r.second,false); assert.deepEqual(r.secondBatch,[]);
    assert.ok(r.toasts.some(t=>t.includes('경계')),'초과한 문제집을 이름으로 알려야 한다');
  });

  // ⑤ 줄이면 다시 올라간다 + 원본은 변하지 않는다
  await check('내용을 줄이면 다음 저장에서 올라간다 · 원본 불변', async p=>{
    await stub(p,[{id:'big',name:'큰 문제집',chars:330000}]);
    const r=await p.evaluate(async()=>{
      await writeCloudSnapshot('u1',sessionContext());
      const before={batched:[...window.__batched], problems:sets[0].problems.length,
                    text:sets[0].problems[0].blocks[0].data.text.length};
      sets[0].problems[0].blocks[0].data.text='가'.repeat(10);   // 사용자가 줄였다
      window.__batched=[];
      const ok=await writeCloudSnapshot('u1',sessionContext());
      return {before, after:{ok, batched:window.__batched}};
    });
    assert.deepEqual(r.before.batched, [], '처음엔 아무것도 안 올라간다');
    assert.equal(r.before.problems, 1, '초과본의 문항을 지우면 안 된다');
    assert.ok(r.before.text>300000, '초과본의 내용을 자르면 안 된다');
    assert.deepEqual(r.after.batched, ['big'], '줄인 뒤에는 올라가야 한다');
    assert.equal(r.after.ok, true);
  });

  // ⑥ 로컬도 실패하면 저장됐다고 말하지 않고 즉시 내보내기를 안내한다
  await check('초과본의 로컬 저장 실패는 JSON 내보내기를 안내한다', async p=>{
    await stub(p,[{id:'big',name:'큰 문제집',chars:330000}]);
    const r=await p.evaluate(async()=>{
      setsOversizeKey='big';       // 앞서 크기 경고를 한 구성이어도 복구 안내는 다시 보여야 한다
      localDirty=true;
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(){ throw new DOMException('quota','QuotaExceededError'); };
      try{
        const ok=await writeCloudSnapshot('u1',sessionContext());
        return {ok,batched:window.__batched,synced:[...cloudSynced.keys()],
                dirty:localDirty,toasts:window.__toasts,status:window.__status};
      }finally{ Storage.prototype.setItem=original; }
    });
    assert.equal(r.ok,false); assert.deepEqual(r.batched,[]); assert.deepEqual(r.synced,[]);
    assert.equal(r.dirty,true,'로컬 저장 실패 상태를 유지해야 한다');
    assert.ok(r.toasts.some(t=>t.includes('JSON으로 내보내')),'즉시 복구 안내가 필요하다');
    assert.ok(r.toasts.every(t=>!t.includes('이 기기에는 저장돼 있습니다')),'로컬 보존을 거짓 안내하면 안 된다');
    assert.equal(r.status.at(-1),'⚠ 로컬 저장 실패','용량 상태가 로컬 실패를 덮으면 안 된다');
  });

  // ⑦ Firestore 가 거부하는 중첩 배열도 그 문제집만 격리한다
  await check('중첩 배열 문서가 섞여도 정상 문제집만 올라간다', async p=>{
    await stub(p,[{id:'bad',name:'표가 든 문제집',chars:10},{id:'good',name:'정상 문제집',chars:10}]);
    const r=await p.evaluate(async()=>{
      sets[0].problems[0].blocks.push({type:'table',data:{rows:[["가","나"]],header:true}});
      const ok=await writeCloudSnapshot('u1',sessionContext());
      return {ok,batched:window.__batched,commits:window.__commits,toasts:window.__toasts,
              status:window.__status,flushes:window.__flushCalls,synced:[...cloudSynced.keys()]};
    });
    assert.deepEqual(r.batched,['good'],'중첩 배열 문서가 batch 에 들어갔다');
    assert.equal(r.commits,1); assert.deepEqual(r.synced,['good']);
    assert.equal(r.flushes,0,'모양 오류 문서는 재귀 재시도에서 빠져야 한다');
    assert.ok(r.toasts.some(t=>t.includes('표가 든 문제집')),'문제집 이름을 알려야 한다');
    assert.ok(r.toasts.some(t=>t.includes('problems[0].blocks[1].data.rows[0]')),'첫 중첩 배열 경로를 알려야 한다');
    assert.ok(r.toasts.some(t=>t.includes('이 기기에는 저장돼 있습니다')),'로컬 보존을 알려야 한다');
    assert.ok(r.status.includes('⚠ 저장 형식 오류'));
    assert.equal(r.ok,false); assert.ok(!r.synced.includes('bad'),'건너뛴 문서를 동기화됨으로 표시하면 안 된다');
  });

  // ⑧ paired 의 화면 모델은 유지하고 전송 경계에서만 평탄화한다
  await check('짝 선지는 평탄화해 저장하고 손실 없이 복원한다', async p=>{
    await stub(p,[{id:'paired',name:'짝 선지',chars:0}]);
    const r=await p.evaluate(async()=>{
      const cells=[["A|B","둘"],["셋",""],["\u03b1","\u03b2"],["넷","다섯"],["여섯",""]];
      sets[0].problems[0].blocks=[{type:'choices',data:{
        layout:'paired',pairs:2,items:["A|B 둘","셋","\u03b1 \u03b2","넷 다섯","여섯"],
        images:["","","","",""],cells
      }}];
      const before=JSON.stringify(sets[0]);
      const doc=setToDoc(sets[0],0);
      const data=doc.problems[0].blocks[0].data;
      const available=typeof firstNestedArrayPath==='function';
      const badPath=available?firstNestedArrayPath(doc):'helper-missing';
      const loaded=docToSet(doc);
      const ok=await writeCloudSnapshot('u1',sessionContext());
      return {available,badPath,before,after:JSON.stringify(sets[0]),ok,
              hasCells:Object.hasOwn(data,'cells'),flat:data.cellsFlat,
              loadedCells:loaded?.problems?.[0]?.blocks?.[0]?.data?.cells,
              batched:window.__batched,batchDocs:window.__batchDocs};
    });
    assert.equal(r.available,true,'모양 가드가 있어야 한다');
    assert.equal(r.badPath,'','평탄화한 문서에는 중첩 배열이 없어야 한다');
    assert.equal(r.hasCells,false);
    assert.deepEqual(r.flat,['A|B','둘','셋','','\u03b1','\u03b2','넷','다섯','여섯','']);
    assert.deepEqual(r.loadedCells,[["A|B","둘"],["셋",""],["\u03b1","\u03b2"],["넷","다섯"],["여섯",""]]);
    assert.equal(r.before,r.after,'전송 변환이 화면 원본을 바꾸면 안 된다');
    assert.equal(r.ok,true); assert.deepEqual(r.batched,['paired']);
    assert.ok(Array.isArray(r.batchDocs[0].problems[0].blocks[0].data.cellsFlat),'실제 batch 문서도 평탄해야 한다');
  });

  // ⑨ 같은 모양 오류를 저장 주기마다 반복해서 알리지 않는다
  await check('같은 중첩 배열 오류의 토스트는 반복하지 않는다', async p=>{
    await stub(p,[{id:'bad',name:'반복 경고',chars:10}]);
    const r=await p.evaluate(async()=>{
      sets[0].problems[0].blocks.push({type:'table',data:{rows:[["x"]],header:true}});
      const first=await writeCloudSnapshot('u1',sessionContext());
      const once=window.__toasts.length;
      const second=await writeCloudSnapshot('u1',sessionContext());
      return {first,second,once,total:window.__toasts.length,batched:window.__batched,
              synced:[...cloudSynced.keys()]};
    });
    assert.equal(r.first,false); assert.equal(r.second,false);
    assert.equal(r.once,1); assert.equal(r.total,1,'같은 오류 토스트를 반복하면 안 된다');
    assert.deepEqual(r.batched,[]); assert.deepEqual(r.synced,[]);
  });

  // ⑩ 클라우드 신뢰 경계는 손상된 형제를 버리되 뒤의 정상 문항을 계속 복구한다
  await check('손상된 cloud problem이 paired 복호화에서 전체 읽기를 끊지 않는다', async p=>{
    await stub(p,[{id:'recover',name:'복구',chars:0}]);
    const r=await p.evaluate(()=>{
      const valid={id:'kept',title:'',desc:'',answer:'',answerImg:'',numLabel:'',paired:false,
        blocks:[{type:'statement',data:{text:'kept'}}]};
      const doc=setToDoc(sets[0],0);doc.problems=[null,valid];
      let loaded,error='';
      try{loaded=docToSet(doc);}catch(e){error=String(e&&e.message||e);}
      let encoded=true;
      try{setToDoc({...sets[0],problems:[null,valid]},0);}catch(e){encoded=false;}
      return {error,encoded,count:loaded?.problems?.length,
        text:loaded?.problems?.[0]?.blocks?.[0]?.data?.text};
    });
    assert.equal(r.error,'');assert.equal(r.encoded,true);
    assert.equal(r.count,1);assert.equal(r.text,'kept');
  });

}catch(e){ harnessFailure=e; console.error('FAIL 하네스 —', e.message); }
finally{ if(browser) await browser.close(); server.kill(); }

if(harnessFailure){ process.exit(1); }
if(process.env.SETS_SIZE_RED==='1'){
  if(checksRun!==EXPECTED_CHECKS){ console.error(`깨보기 실패 — ${EXPECTED_CHECKS}건 중 ${checksRun}건만 실행됐다.`); process.exit(1); }
  if(failures.length){ console.log(`깨보기 OK — 방어 없는 ${BASE_COMMIT} 에서 ${failures.length}건 실패`); process.exit(0); }
  console.error('깨보기 실패 — 방어가 없는데도 전부 통과했다. 검사가 헛돈다.'); process.exit(1);
}
if(failures.length){ console.error('실패:', failures.join(', ')); process.exit(1); }
if(checksRun!==EXPECTED_CHECKS){ console.error(`실패: ${EXPECTED_CHECKS}건 중 ${checksRun}건만 실행됐다.`); process.exit(1); }
console.log(`문제집 크기 방어 통과 — ${EXPECTED_CHECKS}건`);
