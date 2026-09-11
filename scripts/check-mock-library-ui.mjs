/* 모의고사 라이브러리 — 실제 브라우저 회귀 (`docs/MOCK-LIBRARY-DESIGN.md` 완료 조건).
   버리는 저장소와 로컬 서버만 쓴다. 실제 계정·원격 쓰기는 없다.

   ⚠️ 여기서 보는 것은 "카드를 여러 개 만들 수 있다" 가 아니다. 설계가 못 박은 완료
      조건 — 새로고침 뒤 각각 복구 · 복제본 독립 · 다른 계정 자료 미노출 · 저장 실패
      경고 · 구형 임시본 무손실 · 주소로 탭 보존 — 을 하나씩 본다.
   ⚠️ 고정 시간(`waitForTimeout`)으로 기다리지 않는다. 느린 기기에서 깜빡인다. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:18883';
const server=spawn('python3',['serve.py','--port','18883'],{stdio:'ignore'});
const RED=process.env.MOCK_UI_RED==='1';
let browser;const failures=[];

/* ⚠️ **늘 통과하는 검사는 없느니만 못하다.** `MOCK_UI_RED=1` 은 제품에 고장 넷을 심어
   대응하는 항목이 실제로 빨간불이 되는지 본다. 항목을 더하면 여기에도 고장을 더할 것. */
const BREAKS=[
  // 두 라이브러리가 함께 보인다 (액션 줄은 이제 각 패널 안에 있다)
  ['if(sp) sp.hidden=isM; if(mp) mp.hidden=!isM;','if(sp) sp.hidden=false; if(mp) mp.hidden=false;'],
  // 자동 저장을 받지 않는다 — 편집 내용이 카드에 안 남는다
  ['if(m.type==="save"){ handleMockSave(String(m.id||""),m.data); return; }','if(m.type==="save"){ return; }'],
  // 계정 구분이 사라진다 — 앞 계정 자료가 새 계정 화면에 남는다
  ['function mockOwner(){ return (currentUser&&currentUser.uid)||"guest"; }',
   'function mockOwner(){ return "guest"; }'],
  // 저장 실패를 조용히 삼킨다
  ['if(!w.ok && !mockWriteWarned){','if(false){'],
  // tombstone 에 내용을 남긴다 — Rules 가 거부하고 삭제가 다른 기기에 안 퍼진다
  ['deleted:true, createdAt:Number(removed.createdAt)||at, updatedAt:at });',
   'deleted:true, createdAt:Number(removed.createdAt)||at, updatedAt:at, name:String(removed.name||"x") });'],
  // 배포 단계 플래그를 무시한다 — 구형 Rules 배포에서 저장이 전부 권한 오류가 된다
  ['return Number(window.PEDAGOGY_PUBLIC_CONFIG&&window.PEDAGOGY_PUBLIC_CONFIG.mockCloudSchema||0)>=1;',
   'return true;'],
  // 더 최신인 내 카드를 옛 원격이 덮는다
  ['if(i>=0 && (Number(mocks[i].updatedAt)||0)>=(Number(d.updatedAt)||0)) return;',''],
  // 편집 중인 카드를 원격이 덮는다 (위와 **다른** 계약이다 — 따로 깨 본다)
  ['if(d.id===mockOpenId){','if(false){'],
  // 문서 크기를 글자 수로 잰다 — 한글이 실제의 1/3 로 세어진다
  ['try{ return new TextEncoder().encode(json).length; }','try{ return json.length; }'],
];
function redBody(){
  let html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const [from,to] of BREAKS){
    if(!html.includes(from)) throw new Error('고장 주입 지점을 못 찾았습니다: '+from.slice(0,40));
    html=html.replace(from,to);
  }
  return html;
}

async function page(){
  const p=await browser.newPage({viewport:{width:1194,height:834},locale:'ko-KR'});
  p.setDefaultTimeout(8000);
  /* 외부 요청은 막는다 — CDN 이 없는 망에서도 같은 결과가 나와야 한다. */
  await p.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin!==base) return r.abort();
    if(RED && u.pathname==='/index.html') return r.fulfill({contentType:'text/html; charset=utf-8',body:redBody()});
    return r.continue();
  });
  await p.goto(base+'/index.html?mocklib='+Date.now());
  await p.waitForFunction(()=>typeof setLibraryTab==='function'&&typeof renderMockLibrary==='function');
  await p.evaluate(()=>{
    currentUser=null;
    try{ localStorage.removeItem('MOCK_DRAFT_V1');
         localStorage.removeItem(MockLibraryStore.keysFor('guest').list);
         localStorage.removeItem(MockLibraryStore.keysFor('guest').migrated); }catch(e){}
    mocks=[];mocksLoaded=false;mockOpenId="";mockMigrateAsked=false;mockSearchTerm="";
  });
  return p;
}
/* ── 가짜 Firestore ────────────────────────────────────────────────────────
   ⚠️ 실제 계정·원격 쓰기는 절대 쓰지 않는다. 그런데 클라우드 계약(문서 모양·
      tombstone·병합·구독)은 **코드가 아니라 동작**이라 정적 검사로는 못 본다.
      그래서 앱이 부르는 API 표면만 페이지 안에서 흉내 내고, 그 위에서 실제
      `flushMocksToCloud()`·`watchMocks()`·`deleteMockEverywhere()` 를 돌린다. */
const FAKE_CLOUD=`
window.__cloud={docs:new Map(),subs:[],writes:0};
function __col(uid){
  const key=id=>uid+'/'+id;
  const fire=(changes)=>window.__cloud.subs.forEach(f=>f({docChanges:()=>changes}));
  const ref=id=>({id,
    set:async d=>{ window.__cloud.writes++;
      window.__cloud.docs.set(key(id),JSON.parse(JSON.stringify(d)));
      fire([{doc:{id,data:()=>window.__cloud.docs.get(key(id))}}]); },
    delete:async()=>{ window.__cloud.docs.delete(key(id)); }});
  const mine=()=>[...window.__cloud.docs.entries()]
    .filter(([k])=>k.startsWith(uid+'/')).map(([k,d])=>({id:k.slice(uid.length+1),data:()=>d}));
  return {doc:ref,
    get:async()=>{ const docs=mine(); return {docs,forEach:cb=>docs.forEach(cb)}; },
    onSnapshot:(next)=>{ window.__cloud.subs.push(next);
      return ()=>{ window.__cloud.subs=window.__cloud.subs.filter(f=>f!==next); }; }};
}
/* 다른 기기가 쓴 것처럼 밀어 넣는다 */
window.__remote=(uid,doc)=>{
  window.__cloud.docs.set(uid+'/'+doc.id,JSON.parse(JSON.stringify(doc)));
  window.__cloud.subs.forEach(f=>f({docChanges:()=>[{doc:{id:doc.id,data:()=>doc}}]}));
};
fbReady=true;
fbDb={batch(){const ops=[];return{
    set:(r,d)=>ops.push(['s',r,d]), delete:r=>ops.push(['d',r]),
    commit:async()=>{ for(const [k,r,d] of ops) k==='s'?await r.set(d):await r.delete(); }};},
  collection:()=>({doc:uid=>({collection:sub=>sub==='mocks'?__col(uid):__col(uid+':other')})})};
`;
async function cloudPage(uid='u-alice'){
  const p=await page();
  await p.evaluate(([src,who])=>{
    window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,mockCloudSchema:1};
    const el=document.createElement('script'); el.textContent=src;
    document.head.append(el); el.remove();
    currentUser={uid:who}; authEpoch++;
    mocks=[];mocksLoaded=false;mockCloudSynced.clear();mockDeletedIds.clear();
    mockOpenId="";mockCloudWarned=false;
  },[FAKE_CLOUD,uid]);
  return p;
}
const cloudDocs=(p,uid='u-alice')=>p.evaluate(who=>[...window.__cloud.docs.entries()]
  .filter(([k])=>k.startsWith(who+'/')).map(([,d])=>d),uid);

async function check(name,run){
  const p=await page();
  try{ await run(p); console.log('PASS',name); }
  catch(e){ failures.push(name); console.error('FAIL',name,e.message); }
  finally{ await p.close(); }
}
/* 편집기(iframe)가 **그 카드를** 들고 있을 때까지 기다린다.
   ⚠️ 글('저장됨')로 기다리면 앞 카드의 상태가 그대로 남아 **바로 통과**하고, 그 뒤 입력이
      앞 카드에 저장된다. 실제로 이 검사를 만들며 그 순서가 났다 — id 로 기다린다. */
const waitEditor=async p=>{
  const id=await p.evaluate(()=>mockOpenId);
  await p.frameLocator('#mockFrame').locator(`#hostStatus[data-mock-id="${id}"]`).waitFor({timeout:15000});
};

try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();

  await check('상단 바의 전역 모의고사 버튼이 라이브러리 세그먼트로 대체됐다',async p=>{
    assert.equal(await p.locator('#mockModeBtn').count(),0,'옛 전역 버튼이 남아 있다');
    assert.equal(await p.locator('#libraryModeBtn').isVisible(),true);
    assert.equal(await p.locator('#tabSets').isVisible(),false);
    assert.equal(await p.locator('#tabMocks').isVisible(),false);
    /* 편집기로 돌아가는 길은 있어야 한다 — 열기 전에는 보이면 안 된다. */
    assert.equal(await p.locator('#mockBackBtn').isVisible(),false,'라이브러리에서 돌아가기 단추가 보인다');
    /* 두 갈래의 액션이 동시에 보이면 안 된다(`display:flex` 가 `[hidden]` 을 이기던 결함). */
    assert.equal(await p.locator('#mocksActions').isVisible(),false);
    await p.click('#libraryModeBtn');
    assert.equal(await p.locator('#tabSets').isVisible(),true);
    assert.equal(await p.locator('#tabMocks').isVisible(),true);
    await p.click('#tabMocks');
    assert.equal(await p.locator('#setsActions').isVisible(),false);
    assert.equal(await p.locator('#mocksActions').isVisible(),true);
    assert.equal(await p.locator('#newSetBtn').isVisible(),false,'문제집 액션이 모의고사 탭에 남는다');
  });

  await check('메뉴는 키보드로 옮겨지고 주소에 남아 새로고침을 넘긴다',async p=>{
    await p.focus('#libraryModeBtn');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
    assert.equal(await p.locator('#tabMocks').getAttribute('aria-checked'),'true');
    assert.match(await p.evaluate(()=>location.hash),/library=mocks/);
    await p.reload();
    await p.waitForFunction(()=>typeof setLibraryTab==='function');
    await p.waitForFunction(()=>document.getElementById('mocksPanel')&&!document.getElementById('mocksPanel').hidden);
    assert.equal(await p.locator('#tabMocks').getAttribute('aria-checked'),'true');
    await p.focus('#libraryModeBtn');      /* 새로고침은 포커스를 지운다 */
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('Enter');
    assert.equal(await p.locator('#tabSets').getAttribute('aria-checked'),'true');
    assert.equal(await p.evaluate(()=>location.hash),'');
  });

  await check('여러 부를 만들어 각각 편집하고 새로고침해도 따로 복구된다',async p=>{
    await p.click('#libraryModeBtn');await p.click('#tabMocks');
    for(const name of ['6월 대비','9월 대비']){
      await p.evaluate(()=>setLibraryTab('mocks'));
      await p.click('#newMockBtn');
      await waitEditor(p);
      const round=p.frameLocator('#mockFrame').locator('#round');
      await round.fill(name);
      /* 자동 저장(1초 디바운스)이 카드 이름까지 바꿀 때까지 **상태로** 기다린다. */
      await p.waitForFunction(n=>mocks.some(m=>m.name===n),name,{timeout:8000});
      await p.click('#mockBackBtn');
    }
    assert.deepEqual((await p.locator('#mockGrid .set-card h3').allTextContents()).sort(),
                     ['6월 대비','9월 대비']);
    await p.reload();
    await p.waitForFunction(()=>typeof setLibraryTab==='function');
    await p.evaluate(()=>setLibraryTab('mocks'));
    const after=await p.evaluate(()=>mocks.map(m=>({name:m.name,n:m.problems.length})));
    assert.equal(after.length,2,JSON.stringify(after));
    assert.ok(after.every(m=>m.n===30),'문항이 함께 복구되지 않았다: '+JSON.stringify(after));
    /* 두 카드를 번갈아 열어도 서로의 내용을 덮지 않는다. */
    await p.locator('#mockGrid .set-card').filter({hasText:'6월 대비'}).click();
    await waitEditor(p);
    assert.equal(await p.frameLocator('#mockFrame').locator('#round').inputValue(),'6월 대비');
    await p.click('#mockBackBtn');
    await p.locator('#mockGrid .set-card').filter({hasText:'9월 대비'}).click();
    await waitEditor(p);
    assert.equal(await p.frameLocator('#mockFrame').locator('#round').inputValue(),'9월 대비');
  });

  await check('복제·이름 변경·내보내기·삭제가 서로 독립이다',async p=>{
    await p.evaluate(()=>{
      mocks=[MockLibraryStore.normMock({name:'원본',round:'원본',problems:[{id:'p1'},{id:'p2'}]})];
      mocksLoaded=true;persistMocks();setLibraryTab('mocks');
    });
    await p.locator('#mockGrid .set-card .dotbtn').first().click();
    await p.locator('#mockGrid').getByRole('button',{name:'복제',exact:true}).click();
    const ids=await p.evaluate(()=>mocks.map(m=>m.id));
    assert.equal(new Set(ids).size,2,'복제본이 같은 id 를 쓴다');
    /* 복제본을 고쳐도 원본이 따라 바뀌면 안 된다(얕은 사본 사고). */
    await p.evaluate(()=>{const c=mocks.find(m=>m.name.endsWith('복제'));c.problems[0].id='changed';});
    assert.equal(await p.evaluate(()=>mocks.find(m=>m.name==='원본').problems[0].id),'p1');
    const card=p.locator('#mockGrid .set-card').filter({hasText:'원본 복제'});
    await card.locator('.dotbtn').click();
    await p.locator('#mockGrid').getByRole('button',{name:'이름 변경',exact:true}).click();
    await card.locator('h3').fill('9월 사본');
    await p.locator('h3[contenteditable="true"]').press('Enter');
    /* 카드 이름과 시험지 제목(round)은 한 값이어야 한다 — 둘이 갈리면 서로 다른 이름을 말한다. */
    assert.deepEqual(await p.evaluate(()=>{const m=mocks.find(x=>x.name==='9월 사본');return [m.name,m.round];}),
                     ['9월 사본','9월 사본']);
    p.once('dialog',d=>d.accept());
    await p.locator('#mockGrid .set-card').filter({hasText:'9월 사본'}).locator('.dotbtn').click();
    await p.locator('#mockGrid').getByRole('button',{name:'삭제',exact:true}).click();
    await p.waitForFunction(()=>mocks.length===1);
    assert.equal(await p.evaluate(()=>mocks[0].name),'원본');
    await p.reload();
    await p.waitForFunction(()=>typeof setLibraryTab==='function');
    await p.evaluate(()=>setLibraryTab('mocks'));
    assert.equal(await p.evaluate(()=>mocks.length),1,'삭제가 저장되지 않았다');
  });

  await check('다른 계정의 모의고사는 보이지 않는다',async p=>{
    await p.evaluate(()=>{
      currentUser={uid:'user-a'};mocks=[];mocksLoaded=false;loadMocks();
      mocks=MockLibraryStore.upsertMock(mocks,MockLibraryStore.newMock({name:'A의 시험'}));
      persistMocks();
    });
    await p.evaluate(()=>{ currentUser={uid:'user-b'};mocks=[];mocksLoaded=false;loadMocks();setLibraryTab('mocks'); });
    assert.deepEqual(await p.evaluate(()=>mocks.map(m=>m.name)),[],'앞 계정 자료가 새 계정 화면에 남는다');
    await p.evaluate(()=>{ currentUser={uid:'user-a'};mocks=[];mocksLoaded=false;loadMocks();setLibraryTab('mocks'); });
    assert.deepEqual(await p.evaluate(()=>mocks.map(m=>m.name)),['A의 시험']);
  });

  await check('저장 공간이 막히면 조용히 넘기지 않고 알린다',async p=>{
    await p.evaluate(()=>{
      window.__origSet=Storage.prototype.setItem;
      Storage.prototype.setItem=function(){ throw new Error('QuotaExceededError'); };
      mocksLoaded=true;setLibraryTab('mocks');
    });
    await p.click('#newMockBtn');
    await p.locator('.toast').filter({hasText:'저장하지 못했어요'}).first().waitFor();
    await p.evaluate(()=>{ Storage.prototype.setItem=window.__origSet; });
  });

  await check('구형 임시본을 잃지 않고 카드 하나로 옮긴다',async p=>{
    await p.evaluate(()=>{
      localStorage.setItem('MOCK_DRAFT_V1',JSON.stringify(
        {v:1,round:'옛 작업',elective:'미적분',problems:[{id:'p1'},{id:'p2'}],savedAt:1700000000000}));
      mocks=[];mocksLoaded=false;mockMigrateAsked=false;
    });
    /* 먼저 '취소' — 원본이 남고 파일로 받을 길이 보여야 한다. */
    p.once('dialog',d=>d.dismiss());
    await p.click('#libraryModeBtn');await p.click('#tabMocks');
    assert.equal(await p.evaluate(()=>!!localStorage.getItem('MOCK_DRAFT_V1')),true,'취소했는데 원본이 사라졌다');
    assert.equal(await p.getByRole('button',{name:'예전 임시저장 내려받기'}).count(),1);
    /* 다시 물었을 때 '확인' — 카드가 하나 생기고 원본은 그대로 남는다. */
    await p.evaluate(()=>{ mockMigrateAsked=false; });
    p.once('dialog',d=>d.accept());
    await p.evaluate(()=>setLibraryTab('mocks'));
    assert.deepEqual(await p.evaluate(()=>mocks.map(m=>[m.name,m.round,m.problems.length])),
                     [['복구된 모의고사','옛 작업',2]]);
    assert.equal(await p.evaluate(()=>!!localStorage.getItem('MOCK_DRAFT_V1')),true,'원본 키를 즉시 지웠다');
    /* 멱등 — 다시 열어도 카드가 늘지 않는다. */
    await p.evaluate(()=>{ mockMigrateAsked=false;mocksLoaded=false;loadMocks();setLibraryTab('mocks'); });
    assert.equal(await p.evaluate(()=>mocks.length),1);
  });

  await check('JSON 왕복 — 편집기가 저장한 형식을 그대로 읽고 쓴다',async p=>{
    await p.evaluate(()=>{
      mocks=[MockLibraryStore.normMock({name:'왕복',round:'왕복',elective:'기하',
        problems:[{id:'p1',num:1},{id:'p2',num:2}]})];
      mocksLoaded=true;setLibraryTab('mocks');
    });
    const payload=await p.evaluate(()=>JSON.stringify(mockPayload(mocks[0])));
    assert.deepEqual(Object.keys(JSON.parse(payload)).sort(),['elective','problems','round','v'],
                     '편집기 saveJSON 과 다른 모양이면 불러오기가 깨진다');
    await p.evaluate(t=>{
      const d=JSON.parse(t);
      const e=MockLibraryStore.normMock(d);
      mocks=MockLibraryStore.upsertMock(mocks,e);renderMockLibrary();
    },payload);
    assert.deepEqual(await p.evaluate(()=>mocks.map(m=>[m.round,m.elective,m.problems.length])),
                     [['왕복','기하',2],['왕복','기하',2]]);
    assert.equal(await p.evaluate(()=>new Set(mocks.map(m=>m.id)).size),2,'가져온 파일의 id 를 그대로 썼다');
  });

  await check('가로 넘침 없이 세 화면에 담긴다',async p=>{
    await p.evaluate(()=>{
      mocks=Array.from({length:6},(_,i)=>MockLibraryStore.normMock({name:'모의고사 '+(i+1),problems:[{id:'p1'}]}));
      mocksLoaded=true;persistMocks();setLibraryTab('mocks');
    });
    for(const [w,h] of [[1194,834],[768,1024],[375,812]]){
      await p.setViewportSize({width:w,height:h});
      const over=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(over<=0,`${w}px 에서 가로로 ${over}px 넘친다`);
      const tab=await p.locator('#libraryModeBtn').boundingBox();
      assert.ok(tab.x>=0&&tab.x+tab.width<=w,`${w}px 에서 모드 선택기가 화면 밖(${JSON.stringify(tab)})`);
    }
    await p.screenshot({path:'/tmp/pedagogy-mock-library.png',fullPage:true});
  });

// ── 클라우드 동기화 ──────────────────────────────────────────────────────
  await check('계정에 올리는 문서 모양이 Rules 화이트리스트와 같다',async p=>{
    const q=await cloudPage();
    await q.evaluate(()=>{ setLibraryTab('mocks');
      mocks=[MockLibraryStore.normMock({name:'6월',round:'6월',elective:'미적분',problems:[{id:'p1'}]})];
      mocksLoaded=true;persistMocks(); });
    await q.waitForFunction(()=>window.__cloud.docs.size===1,null,{timeout:8000});
    const docs=await cloudDocs(q);
    assert.deepEqual(Object.keys(docs[0]).sort(),
      ['createdAt','deleted','elective','id','name','problems','round','updatedAt']);
    assert.equal(docs[0].name,'6월');
    assert.equal(docs[0].problems.length,1);
    await q.close();
  });

  await check('플래그가 0이면 아무것도 올리지 않는다 (구형 Rules 안전장치)',async p=>{
    const q=await cloudPage();
    await q.evaluate(()=>{
      window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,mockCloudSchema:0};
      mocks=[MockLibraryStore.normMock({name:'로컬만',problems:[{id:'p1'}]})];
      mocksLoaded=true;persistMocks();
    });
    await q.waitForTimeout(1500);
    assert.equal(await q.evaluate(()=>window.__cloud.writes),0,
      '플래그를 내려도 올라간다 — 구형 Rules 배포에서 저장이 전부 권한 오류가 된다');
    assert.equal((await q.evaluate(()=>mocks.length)),1,'로컬에는 남아 있어야 한다');
    await q.close();
  });

  await check('다른 기기에서 만든 모의고사가 내려오고, 지운 것은 되살아나지 않는다',async p=>{
    const q=await cloudPage();
    await q.evaluate(()=>{
      window.__cloud.docs.set('u-alice/mock_remote',{id:'mock_remote',name:'다른 기기',round:'다른 기기',
        elective:'기하',problems:[{id:'p1'}],deleted:false,createdAt:1,updatedAt:5000});
      mocksLoaded=false;loadMocks();setLibraryTab('mocks');
    });
    await q.waitForFunction(()=>mocks.some(m=>m.id==='mock_remote'),null,{timeout:8000});
    assert.deepEqual(await q.evaluate(()=>mocks.map(m=>m.name)),['다른 기기']);
    /* 다른 기기가 지운다 → tombstone 이 구독으로 온다 */
    await q.evaluate(()=>window.__remote('u-alice',{id:'mock_remote',name:'',round:'',elective:'',
      problems:[],deleted:true,createdAt:1,updatedAt:9000}));
    await q.waitForFunction(()=>mocks.length===0,null,{timeout:8000});
    /* 이 기기의 오래된 사본이 다시 병합돼도 되살리면 안 된다 */
    const revived=await q.evaluate(()=>mergeMocks([],[{id:'mock_remote',name:'옛 사본',
      round:'옛 사본',elective:'기하',problems:[],createdAt:1,updatedAt:5000}]).length);
    assert.equal(revived,0,'tombstone 을 무시하고 되살렸다');
    await q.close();
  });

  await check('삭제는 tombstone 으로 올라간다',async p=>{
    const q=await cloudPage();
    await q.evaluate(()=>{ setLibraryTab('mocks');
      mocks=[MockLibraryStore.normMock({name:'지울 것',problems:[{id:'p1'}]})];
      mocksLoaded=true;persistMocks(); });
    await q.waitForFunction(()=>window.__cloud.docs.size===1,null,{timeout:8000});
    q.once('dialog',d=>d.accept());
    await q.locator('#mockGrid .set-card .dotbtn').first().click();
    await q.locator('#mockGrid').getByRole('button',{name:'삭제',exact:true}).click();
    await q.waitForFunction(()=>[...window.__cloud.docs.values()].every(d=>d.deleted===true),null,{timeout:8000});
    const docs=await cloudDocs(q);
    assert.deepEqual([docs[0].deleted,docs[0].name,docs[0].round,docs[0].problems.length],[true,'','',0],
      'Rules 는 내용이 남은 tombstone 을 거부한다');
    await q.close();
  });

  /* 계약이 **둘**이다. 하나는 '더 최신인 내 것을 옛 원격이 못 덮는다', 다른 하나는
     '지금 편집 중인 카드는 (시각과 무관하게) 원격이 못 덮는다'.
     ⚠️ 한 상황으로 둘을 함께 재면, 하나를 깨뜨려도 다른 하나가 막아 **깨보기가 통과**한다
        — 실제로 그랬다. 그래서 두 카드로 따로 잰다. */
  await check('편집 중인 카드도, 더 최신인 카드도 원격이 덮지 않는다',async p=>{
    const q=await cloudPage();
    await q.evaluate(()=>{ setLibraryTab('mocks');
      mocks=[MockLibraryStore.normMock({id:'mock_open01',name:'내 편집본',round:'내 편집본',
               problems:[{id:'p1'}],updatedAt:1000},{keepId:true}),
             MockLibraryStore.normMock({id:'mock_shut01',name:'닫힌 최신본',round:'닫힌 최신본',
               problems:[{id:'p1'}],updatedAt:9000},{keepId:true})];
      mocksLoaded=true;mockOpenId='mock_open01';watchMocks();
      /* ① 편집 중인 카드에 **더 최신** 원격이 온다 — 시각으로는 원격이 이기지만 덮으면 안 된다 */
      window.__remote('u-alice',{id:'mock_open01',name:'남의 기기',round:'남의 기기',elective:'미적분',
        problems:[],deleted:false,createdAt:1,updatedAt:9999});
      /* ② 닫힌 카드에 **더 옛** 원격이 온다 — 내 것이 최신이므로 덮으면 안 된다 */
      window.__remote('u-alice',{id:'mock_shut01',name:'남의 옛것',round:'남의 옛것',elective:'미적분',
        problems:[],deleted:false,createdAt:1,updatedAt:1000});
    });
    await q.waitForTimeout(400);
    const got=await q.evaluate(()=>mocks.map(m=>m.name).sort());
    assert.deepEqual(got,['내 편집본','닫힌 최신본'].sort(),'원격이 덮었다: '+JSON.stringify(got));
    await q.close();
  });

  await check('문서가 너무 크면 올리지 않고 알린다',async p=>{
    const q=await cloudPage();
    await q.evaluate(()=>{ setLibraryTab('mocks');
      mocks=[MockLibraryStore.normMock({name:'큰 것',
        problems:[{id:'p1',stmt:'가'.repeat(500000)}]})];
      mocksLoaded=true;persistMocks(); });
    await q.locator('.toast').filter({hasText:'너무 커서'}).first().waitFor();
    assert.equal(await q.evaluate(()=>window.__cloud.docs.size),0,'한도를 넘겼는데 올렸다');
    await q.close();
  });

  await check('계정이 바뀌면 앞 계정 문서로 올라가지 않는다',async p=>{
    const q=await cloudPage('u-alice');
    await q.evaluate(()=>{ mocks=[MockLibraryStore.normMock({name:'앨리스',problems:[{id:'p1'}]})];
      mocksLoaded=true;persistMocks(); });
    await q.waitForFunction(()=>window.__cloud.docs.size===1,null,{timeout:8000});
    await q.evaluate(()=>{ currentUser={uid:'u-bob'};authEpoch++;
      mocks=[MockLibraryStore.normMock({name:'밥',problems:[{id:'p1'}]})];
      mocksLoaded=true;mockCloudSynced.clear();persistMocks(); });
    await q.waitForFunction(()=>window.__cloud.docs.size===2,null,{timeout:8000});
    const alice=await cloudDocs(q,'u-alice'), bob=await cloudDocs(q,'u-bob');
    assert.deepEqual([alice.map(d=>d.name),bob.map(d=>d.name)],[['앨리스'],['밥']],
      '남의 계정 칸에 섞였다');
    await q.close();
  });

  await check('그림은 문서에 담지 않고 주소만 남긴다',async p=>{
    const q=await cloudPage();
    const got=await q.evaluate(async()=>{
      /* 업로드는 Storage 를 타므로 그 한 줄만 흉내 낸다 — 판정 대상은 '무엇이 남는가' 다. */
      window.uploadBlobToStorage=async()=>'https://firebasestorage.googleapis.com/v0/b/x/o/fig.png';
      const replies=[];
      const orig=window.postMock;
      window.postMock=m=>{ replies.push(m); return true; };
      await handleMockUpload(1,'fig.png','data:image/png;base64,iVBORw0KGgo=');
      window.postMock=orig;
      return replies;
    });
    assert.equal(got.length,1);
    assert.equal(got[0].type,'uploaded');
    assert.match(got[0].url,/^https:\/\/firebasestorage\.googleapis\.com\//,JSON.stringify(got[0]));
    await q.close();
  });

  if(RED){
    /* ⚠️ **개수로 세지 않는다.** 고장 하나가 항목 하나에 1:1 로 대응하지 않는다 —
       원격 덮어쓰기 계약 둘은 한 항목이 함께 본다. 개수로 세면 그 사실이 숨는다.
       그래서 **어느 항목이 빨간불이어야 하는지**를 이름으로 적고 그것을 확인한다. */
    const MUST_FAIL=[
      '상단 바의 전역 모의고사 버튼이 라이브러리 세그먼트로 대체됐다',
      '여러 부를 만들어 각각 편집하고 새로고침해도 따로 복구된다',
      '다른 계정의 모의고사는 보이지 않는다',
      '저장 공간이 막히면 조용히 넘기지 않고 알린다',
      '플래그가 0이면 아무것도 올리지 않는다 (구형 Rules 안전장치)',
      '삭제는 tombstone 으로 올라간다',
      '편집 중인 카드도, 더 최신인 카드도 원격이 덮지 않는다',
      '문서가 너무 크면 올리지 않고 알린다',
    ];
    const missed=MUST_FAIL.filter(n=>!failures.includes(n));
    if(missed.length){
      console.error('자기검사 실패: 고장을 심었는데 통과한 항목 —',missed.join(', '));
      process.exit(1);
    }
    console.log(`자기검사 통과 — 고장 ${BREAKS.length}개에서 계약 ${MUST_FAIL.length}개가 빨간불`);
    process.exit(0);
  }
  assert.deepEqual(failures,[]);
}finally{ await browser?.close(); server.kill(); }
