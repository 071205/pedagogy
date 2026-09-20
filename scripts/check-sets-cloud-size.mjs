/* 문제집 클라우드 저장의 **크기 선제 방어**를 진짜 브라우저에서 확인한다.
 * 계약: docs/STORAGE-CONTRACT.md §1 · 근거: docs/PROBLEM-INTAKE-DESIGN.md §20
 *
 * ⚠️ 왜 이 검사가 있나 — Firestore 배치는 **원자적**이라 한도를 넘는 문제집 하나가
 *    섞이면 **같이 올라가던 멀쩡한 문제집까지 통째로 실패한다.** 모의고사 경로는
 *    예전부터 ready/tooBig 으로 갈랐는데 문제집 경로에만 그 방어가 없었다.
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
let browser;const failures=[];

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
  return p.evaluate(plan=>{
    window.__batched=[];      // batch.set 으로 들어간 문서 id
    window.__commits=0;
    window.__toasts=[];
    window.__status=[];
    window.__flushCalls=0;
    wiping=false;
    currentUser={uid:'u1'};
    cloudSynced.clear();
    setsOversizeKey="";
    window.flushLocal=()=>{};
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
      set(ref){ window.__batched.push(ref.__id); },
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
  try{ p=await open(); await run(p); console.log('PASS',name); }
  catch(e){ failures.push(name); console.error('FAIL',name,'—',e.message); }
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

  // ④ 경계값 — 한도 아래는 그대로 올라간다
  await check('한도 바로 아래는 정상 업로드된다', async p=>{
    const sizes=await stub(p,[{id:'edge',name:'경계',chars:250000}]);
    assert.ok(sizes[0].bytes<900*1024, '표본이 한도 아래여야 한다');
    const r=await p.evaluate(async()=>{ const ok=await writeCloudSnapshot('u1',sessionContext());
      return {ok, batched:window.__batched, toasts:window.__toasts}; });
    assert.deepEqual(r.batched, ['edge']);
    assert.equal(r.toasts.length, 0, '한도 아래인데 경고하면 안 된다');
    assert.equal(r.ok, true);
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

}catch(e){ failures.push('하네스'); console.error('FAIL 하네스 —', e.message); }
finally{ if(browser) await browser.close(); server.kill(); }

if(process.env.SETS_SIZE_RED==='1'){
  if(failures.length){ console.log(`깨보기 OK — 방어 없는 ${BASE_COMMIT} 에서 ${failures.length}건 실패`); process.exit(0); }
  console.error('깨보기 실패 — 방어가 없는데도 전부 통과했다. 검사가 헛돈다.'); process.exit(1);
}
if(failures.length){ console.error('실패:', failures.join(', ')); process.exit(1); }
console.log('문제집 크기 방어 통과 — 5건');
