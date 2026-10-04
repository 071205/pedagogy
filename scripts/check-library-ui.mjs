// Disposable browser storage and local server; no real account or remote writes.
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:18881';
const server=spawn('python3',['serve.py','--port','18881'],{stdio:'ignore'});
let browser;const failures=[];
async function check(name,run){
  const p=await browser.newPage({viewport:{width:375,height:812},locale:'ko-KR'});
  p.setDefaultTimeout(5000);
  try{
    await p.route('**/*',r=>{
      const u=new URL(r.request().url());
      if(process.env.LIBRARY_UI_RED==='1' && u.pathname==='/index.html')
        return r.fulfill({contentType:'text/html',body:execFileSync('git',['show','96e9d83:index.html'])});
      return u.origin===base?r.continue():r.abort();
    });
    await p.goto(base+'/index.html');
    await p.waitForFunction(()=>typeof renderLibrary==='function' && typeof libMeta==='object');
    await p.evaluate(()=>{
      currentSetId=null;currentUser=null;sets=[normSet({id:'a',name:'가',problems:[{}]},{keepId:true}),normSet({id:'b',name:'나',problems:[{}]},{keepId:true})];
      libMeta=normLibMeta({folders:[{id:'f',name:'수학',order:0},{id:'g',name:'영어',order:1}],folderBySetId:{a:'f',b:'g'}});
      libFolderFilter='';setSearchTerm='';libPicking=false;libPicked.clear();renderLibrary();
    });
    await run(p);console.log('PASS',name);
  }catch(e){failures.push(name);console.error('FAIL',name,e.message);}
  finally{await p.close();}
}
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  await check('library mode switcher and settings modal preserve context accessibly',async p=>{
    await p.setViewportSize({width:1194,height:834});
    const switcher=p.locator('#libraryModeBtn');
    assert.equal(await switcher.isVisible(),true);
    assert.equal(await switcher.getAttribute('aria-haspopup'),'menu');
    assert.equal(await switcher.getAttribute('aria-expanded'),'false');
    assert.match(await switcher.textContent(),/문제집/);
    assert.equal(await p.locator('#libraryModeMenu').isVisible(),false);

    await switcher.click();
    assert.equal(await switcher.getAttribute('aria-expanded'),'true');
    assert.equal(await p.locator('#libraryModeMenu').isVisible(),true);
    const menuOnTop=await p.locator('#libraryModeMenu').evaluate(menu=>{
      const r=menu.getBoundingClientRect();
      return menu.contains(document.elementFromPoint(r.right-20,r.top+42));
    });
    assert.equal(menuOnTop,true,'펼친 메뉴가 라이브러리 카드 아래에 깔렸다');
    assert.match(await p.locator('#tabSets').textContent(),/문항을 묶고 편집/);
    assert.equal(await p.locator('#tabSets').getAttribute('aria-checked'),'true');
    await p.keyboard.press('ArrowDown');
    assert.equal(await p.evaluate(()=>document.activeElement?.id),'tabMocks');
    await p.keyboard.press('Enter');
    assert.equal(await switcher.getAttribute('aria-expanded'),'false');
    assert.match(await switcher.textContent(),/모의고사/);
    assert.match(await p.evaluate(()=>location.hash),/library=mocks/);

    await p.evaluate(()=>setLibraryTab('sets'));
    await p.locator('#settingsBtn').click();
    const dialog=p.locator('#settingsView');
    assert.equal(await dialog.evaluate(el=>el instanceof HTMLDialogElement && el.open),true);
    assert.equal(await p.locator('#libraryView').isVisible(),true,'설정 뒤 라이브러리 맥락이 사라졌다');
    const backdrop=await dialog.evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter||
      getComputedStyle(el,'::backdrop').webkitBackdropFilter||'');
    assert.match(backdrop,/blur\(/,'설정 배경에 맥락을 남기는 블러가 없다');
    const fields=await p.locator('#stPanScreen .settings-choice').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect()));
    assert.equal(fields.length,2);
    assert.ok(fields[1].top-fields[0].bottom>=12,'테마와 언어 선택 영역이 붙어 있다');
    await p.keyboard.press('Escape');
    assert.equal(await dialog.evaluate(el=>el.open),false);
    assert.equal(await p.evaluate(()=>document.activeElement?.id),'settingsBtn');

    const visual=p.locator('#setGrid .set-card-visual--set').first();
    assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.getAttribute('aria-hidden'),'true');
  });
  await check('folder creation, keyboard cancel, capacity, and mobile dialog layout',async p=>{
    await p.getByRole('button',{name:'+ 새 폴더',exact:true}).click();
    assert.equal(await p.locator('#folderDeleteBtn').isVisible(),false);
    await p.locator('#folderNameInput').fill('새 수학 폴더');await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(()=>libMeta.folders.length),2);
    await p.getByRole('button',{name:'+ 새 폴더',exact:true}).click();
    await p.locator('#folderNameInput').fill('새 수학 폴더');await p.locator('#folderNameInput').press('Enter');
    assert.equal(await p.evaluate(()=>folderName(libFolderFilter)),'새 수학 폴더');
    await p.getByRole('button',{name:'새 수학 폴더 폴더 관리',exact:true}).click();
    const box=await p.locator('#folderDialog').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=375);
    await p.screenshot({path:'/tmp/pedagogy-folder-dialog.png'});
    await p.keyboard.press('Escape');
    await p.evaluate(()=>{libMeta.folders=Array.from({length:200},(_,i)=>({id:'f'+i,name:'폴더'+i,order:i}));renderLibrary();});
    await p.getByRole('button',{name:'+ 새 폴더',exact:true}).click();
    await p.locator('#folderNameInput').fill('한도 초과');await p.locator('#folderSaveBtn').click();
    assert.equal(await p.evaluate(()=>libMeta.folders.length),200);
  });
  await check('mobile navigation stays visible before a long library and follows DOM focus order',async p=>{
    await p.evaluate(()=>{
      sets=Array.from({length:14},(_,i)=>normSet({id:'long-'+i,name:'검토 문제집 '+(i+1),problems:[{}]},{keepId:true}));
      libMeta=normLibMeta({folders:[],folderBySetId:{}});renderLibrary();showLibrary('sets');
    });
    const layout=await p.evaluate(()=>{
      const nav=document.querySelector('.lib-rail').getBoundingClientRect();
      const main=document.querySelector('.lib-main').getBoundingClientRect();
      const tab=document.getElementById('tabSets'), search=document.getElementById('setSearch');
      return {navTop:Math.round(nav.top),navBottom:Math.round(nav.bottom),mainTop:Math.round(main.top),
        viewport:innerHeight,domBefore:!!(tab.compareDocumentPosition(search)&Node.DOCUMENT_POSITION_FOLLOWING)};
    });
    assert.ok(layout.navTop>=0&&layout.navBottom<=layout.viewport,'탐색이 첫 화면 밖: '+JSON.stringify(layout));
    assert.ok(layout.navBottom<=layout.mainTop,'화면에서 탐색 뒤에 본문이 오지 않음: '+JSON.stringify(layout));
    assert.equal(layout.domBefore,true,'DOM 포커스 순서가 시각 순서와 다름: '+JSON.stringify(layout));
  });
  await check('settings returns to its library or editor source and mock editor exposes settings',async p=>{
    await p.evaluate(()=>setLibraryTab('mocks'));
    await p.locator('#settingsBtn').click();
    await p.locator('#settingsBack').click();
    assert.equal(await p.evaluate(()=>libraryTab),'mocks');
    assert.equal(await p.locator('#mocksPanel').isVisible(),true);

    await p.evaluate(()=>showEditor('a'));
    await p.locator('#editorSettingsBtn').click();
    assert.equal(await p.locator('#settingsBack').getAttribute('aria-label'),'설정 닫기');
    assert.equal(await p.locator('#editorView').isVisible(),true,'모달 뒤 편집기가 사라졌다');
    assert.equal(await p.evaluate(()=>readLastSet()),'a');
    await p.locator('#settingsBack').click();
    assert.equal(await p.locator('#editorView').isVisible(),true);
    assert.equal(await p.evaluate(()=>currentSetId),'a');

    await p.evaluate(()=>{
      const m=MockStore.newMock({name:'설정 복귀 검사',round:'설정 복귀 검사'});
      mocks=[m];mocksLoaded=true;openMock(m.id);
    });
    assert.equal(await p.locator('#mockSettingsBtn').isVisible(),true);
    await p.locator('#mockSettingsBtn').click();
    assert.equal(await p.locator('#settingsBack').getAttribute('aria-label'),'설정 닫기');
    assert.equal(await p.locator('#mockView').isVisible(),true,'모달 뒤 모의고사 편집기가 사라졌다');
    await p.locator('#settingsBack').click();
    assert.equal(await p.locator('#mockView').isVisible(),true);
    assert.equal(await p.evaluate(()=>MockStore.findMock(mocks,mockOpenId)?.name),'설정 복귀 검사');
  });
  for(const schema of [0,1]) await check(`folder rename/delete are visible and preserve sets (schema ${schema})`,async p=>{
    await p.evaluate(schema=>{window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,libraryCloudSchema:schema};if(schema)sets.forEach(s=>s.folderId=libMeta.folderBySetId[s.id]);renderLibrary();},schema);
    assert.equal(await p.getByRole('button',{name:'수학 폴더 관리',exact:true}).count(),1);
    await p.getByRole('button',{name:'수학 폴더 관리',exact:true}).click();
    await p.locator('#folderNameInput').fill('수학 새 이름');
    await p.locator('#folderSaveBtn').click();
    await p.getByRole('button',{name:'수학 새 이름 폴더 관리',exact:true}).click();
    p.once('dialog',d=>d.dismiss());await p.locator('#folderDeleteBtn').click();
    assert.equal(await p.evaluate(()=>libMeta.folders.length),2);
    p.once('dialog',d=>d.accept());await p.locator('#folderDeleteBtn').click();
    assert.deepEqual(await p.evaluate(()=>({n:sets.length,folder:folderOf('a'),tomb:!!libMeta.folderTombstones.f})),{n:2,folder:'',tomb:true});
    await p.evaluate(()=>flushLocal());await p.reload();
    await p.waitForFunction(()=>typeof libMeta==='object' && sets.length===2);
    assert.equal(await p.evaluate(()=>libMeta.folders.some(f=>f.id==='f')),false);
  });
  for(const schema of [0,1]) await check(`new sets and duplicates stay in their folder (schema ${schema})`,async p=>{
    await p.evaluate(schema=>{window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,libraryCloudSchema:schema};if(schema)sets.forEach(s=>s.folderId=libMeta.folderBySetId[s.id]);},schema);
    await p.evaluate(()=>{libFolderFilter='f';renderLibrary();});
    await p.locator('#newSetBtn').click();
    await p.getByRole('menuitem',{name:/직접 만들기/}).click();
    assert.equal(await p.evaluate(()=>folderOf(currentSetId)),'f');
    await p.evaluate(()=>showLibrary());
    await p.locator('.set-card').filter({has:p.locator('h3', {hasText:/^가$/})}).locator('.dotbtn').click();
    await p.getByRole('button',{name:'복제',exact:true}).click();
    assert.equal(await p.evaluate(()=>folderOf(sets.find(s=>s.name==='가 복제').id)),'f');
  });
  await check('folder navigation clears global search and search shows folder labels',async p=>{
    await p.evaluate(()=>{libFolderFilter='f';renderLibrary();});
    await p.locator('#setSearch').fill('나');
    assert.equal(await p.locator('.card-folder').textContent(),'영어');
    await p.locator('.folder-chip').filter({hasText:/^수학/}).click();
    assert.equal(await p.locator('#setSearch').inputValue(),'');
    assert.deepEqual(await p.locator('.set-card h3').allTextContents(),['가']);
  });
  await check('move picker uses names, cancels safely, and exposes selected actions',async p=>{
    await p.locator('#selectBtn').click();await p.locator('.pick').first().check();
    assert.equal(await p.locator('.set-card .dotbtn:visible').count(),0);
    await p.locator('#selMoveBtn').click();await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(()=>folderOf('a')),'f');
    await p.locator('#selMoveBtn').click();await p.locator('#folderTarget').selectOption('g');
    await p.locator('#folderMoveConfirm').click();
    assert.equal(await p.evaluate(()=>folderOf('a')),'g');
    await p.locator('#selAllBtn').click();
    assert.equal(await p.locator('#selAllBtn').textContent(),'모두 해제');
    await p.locator('#selAllBtn').click();assert.equal(await p.evaluate(()=>libPicked.size),0);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.screenshot({path:'/tmp/pedagogy-library-ui.png',fullPage:true});
  });
  await check('single-card move and stale account dialogs cannot change a new session',async p=>{
    await p.locator('.set-card .dotbtn').first().click();
    await p.locator('.set-card .menu').getByRole('button',{name:'폴더로 이동',exact:true}).first().click();
    await p.locator('#folderTarget').selectOption('g');await p.locator('#folderMoveConfirm').click();
    assert.equal(await p.evaluate(()=>folderOf('a')),'g');
    await p.getByRole('button',{name:'수학 폴더 관리',exact:true}).click();
    await p.locator('#folderNameInput').fill('다른 계정 이름');await p.evaluate(()=>authEpoch++);
    await p.locator('#folderSaveBtn').click();assert.equal(await p.evaluate(()=>folderName('f')),'수학');
  });
  for(const schema of [0,1]) await check(`folder move is one immediate Undo/Redo step (schema ${schema})`,async p=>{
    await p.evaluate(schema=>{
      window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,libraryCloudSchema:schema};
      if(schema)sets.forEach(s=>s.folderId=libMeta.folderBySetId[s.id]);
      lastSnapshot=snapshot();undoStack=[];redoStack=[];
    },schema);
    await p.locator('#selectBtn').click();await p.locator('.pick').first().check();
    await p.locator('#selMoveBtn').click();await p.locator('#folderTarget').selectOption('g');
    await p.locator('#folderMoveConfirm').click();await p.evaluate(()=>doUndo());
    assert.equal(await p.evaluate(()=>folderOf('a')),'f');
    await p.evaluate(()=>doRedo());assert.equal(await p.evaluate(()=>folderOf('a')),'g');
    await p.evaluate(()=>{libMeta.folderTombstones.f=Date.now();doUndo();});
    assert.equal(await p.evaluate(()=>folderOf('a')),'');
    await p.evaluate(()=>doRedo());
    await p.evaluate(()=>flushLocal());await p.reload();
    await p.waitForFunction(()=>typeof libMeta==='object' && sets.length===2);
    // The deployed default is A; inspect B's persisted document field directly after reload.
    assert.equal(await p.evaluate(schema=>schema?sets.find(s=>s.id==='a').folderId:folderOf('a'),schema),'g');
  });
  await check('recent-edit sort stamps the renamed card and displays selected order',async p=>{
    await p.evaluate(()=>{currentSetId='a';localStamps={a:2,b:1};libMeta.sort='updated';renderLibrary();});
    const card=p.locator('.set-card').filter({has:p.locator('h3',{hasText:/^나$/})});
    await card.locator('.dotbtn').click();await p.getByRole('button',{name:'이름 변경',exact:true}).click();
    await card.locator('h3').fill('다');await p.locator('h3[contenteditable="true"]').press('Enter');
    assert.deepEqual(await p.locator('.set-card h3').allTextContents(),['다','가']);
    assert.equal(await p.evaluate(()=>localStamps.a),2);
    assert.match(await p.locator('#sortBtn').textContent(),/최근 수정순/);
    await p.locator('#sortBtn').click();await p.keyboard.press('Escape');
    assert.equal(await p.locator('#sortBtn').getAttribute('aria-expanded'),'false');
  });
  await check('editor-only top actions stay out of the library',async p=>{
    /* ⚠️ **판정을 `getBoundingClientRect().width` 로 한다 — 시간에 안 흔들리게.**
       예전 구현은 `#topActions.style.visibility='hidden'` 이었는데, `.btn` 의
       `transition` 이 `all` 이라 `visibility` 가 **이산 전이**를 타서 라이브러리로 나온 뒤
       **약 130ms 동안 버튼이 그대로 보이고 눌렸다**(`REV-2026-059` — 그 사이 인쇄·내보내기
       모달이 실제로 열렸다). 그 창을 시간으로 재면 깜빡이는 검사가 되므로 **자리를
       차지하는가**로 본다: `visibility:hidden` 은 폭을 그대로 갖고 `display:none` 은 0 이다. */
    const box=()=>p.evaluate(()=>{
      const b=document.getElementById('printBtn');
      return {w:Math.round(b.getBoundingClientRect().width), shown:!!b.offsetParent};
    });
    await p.evaluate(()=>showLibrary());
    assert.deepEqual(await box(),{w:0,shown:false},'최초 라이브러리에서 편집기 동작이 보인다');
    await p.evaluate(()=>showEditor('a'));
    const on=await box();
    assert.ok(on.w>0 && on.shown,'편집기에서는 보여야 한다: '+JSON.stringify(on));
    /* 실제 사용자 경로(로고 클릭)로 나온다. **기다리지 않고 바로 읽는다.** */
    await p.click('#brandBtn');
    assert.deepEqual(await box(),{w:0,shown:false},'편집기 → 라이브러리에서 편집기 동작이 남는다');
    assert.equal(await p.locator('#printBtn').isVisible(),false,'인쇄 단추를 누를 수 있다');
    await p.evaluate(()=>showEditor('a'));
    assert.ok((await box()).w>0,'편집기로 돌아오면 다시 보여야 한다');
  });
  /* ⚠️ **부팅 구간도 봐야 한다**(`REV-2026-061`). 위 검사는 앱이 다 뜬 뒤 `showLibrary()` 를
     직접 부르므로, 하단 인라인 스크립트가 핸들러를 등록한 뒤부터 `showLibrary()` 가 처음
     불릴 때까지의 창을 못 본다 — defer SDK 가 느리면 그 창에 편집기 단추가 보이고 **눌렸다**.
     그래서 SDK 응답을 늦춘 채, `showLibrary` 는 이미 있고 `DOMContentLoaded` 는 아직인
     시점에서 잰다. 판정은 위와 같은 **자리 기반**이다(시간에 안 흔들린다). */
  await (async()=>{
    const name='editor-only top actions stay hidden during a slow boot';
    const p=await browser.newPage({viewport:{width:375,height:812},locale:'ko-KR'});
    try{
      await p.route('**/*',async r=>{
        const u=new URL(r.request().url());
        if(u.pathname.endsWith('/firebase-app-compat.js')){ await new Promise(x=>setTimeout(x,1500)); return r.continue(); }
        return (u.origin===base||u.hostname==='www.gstatic.com'||u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort();
      });
      await p.goto(base+'/index.html',{waitUntil:'commit'});
      /* 인라인 스크립트가 돌아 핸들러는 등록됐는데 **부팅은 아직인** 순간.
         ⚠️ `document.readyState==='loading'` 으로 잡으면 안 된다 — 실측해 보니 파싱이
            끝나자마자 `interactive` 가 되고 `loading` 에 머물지 않아 이 창과 겹치지 않는다.
            늦춘 SDK 가 아직 안 온 것(`window.firebase===undefined`)이 정확한 표지다. */
      await p.waitForFunction(()=>typeof showLibrary==='function' && typeof window.firebase==='undefined',
        null,{timeout:10000});
      const got=await p.evaluate(()=>{
        const b=document.getElementById('printBtn');
        return {w:Math.round(b.getBoundingClientRect().width), shown:!!b.offsetParent,
                ready:document.readyState, booted:typeof window.firebase};
      });
      assert.deepEqual({w:got.w,shown:got.shown},{w:0,shown:false},
        '부팅 중 편집기 동작이 노출됨: '+JSON.stringify(got));
      assert.equal(await p.locator('#printBtn').isVisible(),false,'부팅 중 인쇄 단추를 누를 수 있다');
      console.log('PASS',name);
    }catch(e){failures.push(name);console.error('FAIL',name,e.message);}
    finally{await p.close();}
  })();
  /* ⚠️ **삭제가 끝나면 '왔던 곳' 이 아니라 라이브러리로 가야 한다.**
     설정이 출처를 기억하게 되면서(`HANDOFF-2026-104`) 이 안전 동작이 조용히 뒤집힐 수
     있다 — 방금 문제집을 전부 지웠는데 그 편집기로 돌아가면 없는 것을 편집하게 된다.
     ⚠️ **진짜 삭제 함수는 부르지 않는다**(로그인한 프로필로 돌려도 안전해야 한다).
        성공한 척하는 대역을 끼우고 **어디로 가는지만** 본다. */
  await check('데이터 삭제가 끝나면 출처 편집기가 아니라 라이브러리로 간다',async p=>{
    await p.evaluate(()=>{ showEditor('a'); showSettings('data');
      window.__realDel=deleteAllSets; deleteAllSets=async()=>{};
      document.querySelector('#dmWipeConfirm').value='삭제'; dmSyncButtons(); });
    p.once('dialog',d=>d.accept());
    await p.locator('#dmWipeBtn').click();
    await p.waitForFunction(()=>getComputedStyle(document.getElementById('libraryView')).display!=='none',
      null,{timeout:5000});
    const got=await p.evaluate(()=>{ deleteAllSets=window.__realDel;
      return {ed:getComputedStyle(document.getElementById('editorView')).display,
              st:getComputedStyle(document.getElementById('settingsView')).display}; });
    assert.deepEqual(got,{ed:'none',st:'none'},'삭제 뒤 편집기/설정이 남아 있다: '+JSON.stringify(got));
  });

  /* U1 '라이브러리 → 시작' — 새 문제집은 '직접 / 자료로 · AI' 두 길이고, 빈 라이브러리도 같은 두 길을 보인다.
     PDF 일괄은 U2 몫이라 자리만 있고 누를 수 없다. AI 는 로그인 없이 빈 문제집을 만들지 않는다.
     ⚠️ AI 응답은 가짜다(Worker 주소를 이 페이지에서 가로챈다) — 실제 AI·로그인을 부르지 않는다. */
  await check('새 문제집은 두 길을 고르고 빈 라이브러리도 같은 두 길을 보인다',async p=>{
    await p.setViewportSize({width:1194,height:834});
    p.on('request',r=>{if(/workers\.dev/.test(r.url()))console.log('  (AI 요청 가로챔)');});
    const btn=p.locator('#newSetBtn');
    await btn.click();
    assert.equal(await btn.getAttribute('aria-expanded'),'true');
    const items=p.locator('#newSetMenu [role=menuitem]');
    assert.equal(await items.count(),3);
    assert.match(await items.nth(0).textContent(),/직접 만들기/);
    assert.match(await items.nth(1).textContent(),/자료로 만들기 · AI/);
    assert.equal(await items.nth(2).isDisabled(),true,'PDF 일괄(U2)이 눌린다');
    assert.match(await items.nth(2).textContent(),/준비 중/);
    assert.equal(await p.evaluate(()=>document.activeElement?.textContent),await items.nth(0).textContent(),'메뉴를 열면 첫 항목에 포커스');
    await p.keyboard.press('ArrowDown');
    assert.match(await p.evaluate(()=>document.activeElement?.textContent),/자료로 만들기/);
    await p.keyboard.press('ArrowDown');
    assert.match(await p.evaluate(()=>document.activeElement?.textContent),/직접 만들기/,'준비 중 항목을 건너뛰어야 한다');
    await p.keyboard.press('Escape');
    assert.equal(await btn.getAttribute('aria-expanded'),'false');
    assert.equal(await p.evaluate(()=>document.activeElement?.id),'newSetBtn');
    // 초점이 메뉴 밖으로 나가면 닫히고, 밖에서도 Esc 가 듣는다
    await btn.click(); await p.locator('#exportAllBtn').focus();
    assert.equal(await btn.getAttribute('aria-expanded'),'false','초점이 메뉴 밖으로 나갔는데 열려 있다');
    await btn.click(); await p.evaluate(()=>document.activeElement.blur());
    await p.keyboard.press('Escape');
    assert.equal(await btn.getAttribute('aria-expanded'),'false','메뉴 밖에서 Esc 가 안 듣는다');
    // 로그아웃 상태의 AI 길: 빈 문제집을 만들지 않고 알린다
    await btn.click(); await p.getByRole('menuitem',{name:/자료로 만들기/}).click();
    assert.equal(await p.evaluate(()=>sets.length),2,'로그인 없이 AI 길이 빈 문제집을 만들었다');
    assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('libraryView')).display!=='none'),true);
    // 빈 라이브러리: 같은 두 길(준비 중 제외)
    await p.evaluate(()=>{sets=[];libFolderFilter='';renderLibrary();});
    const start=p.locator('.empty-state .es-start button');
    assert.equal(await start.count(),2);
    assert.match(await start.nth(0).textContent(),/직접 만들기/);
    assert.match(await start.nth(1).textContent(),/자료로 만들기/);
    await start.nth(0).click();
    assert.equal(await p.evaluate(()=>sets.length===1&&currentSetId===sets[0].id&&getComputedStyle(document.getElementById('editorView')).display!=='none'),true,'빈 화면의 직접 만들기');
    // 로그인 상태의 AI 길: 같은 클릭에서 사진 고르기 창이 열리고, 결과가 빈 1번 자리를 채운다
    await p.evaluate(()=>{showLibrary();sets=[];renderLibrary();
      currentUser={uid:'ui-ai',getIdToken:async()=>'fixture-token'};window.getAiAppCheckToken=async()=>'';
      try{localStorage.setItem('PM_AI_TRANSFER_NOTICE',String(publicConfig.legalVersion||'2026-08-28-ai-transfer'));}catch{}});
    await p.route(/workers\.dev/,r=>r.fulfill({contentType:'application/json',
      body:JSON.stringify({problems:[{blocks:[{type:'statement',text:'AI 가 옮긴 1번'}]},{blocks:[{type:'statement',text:'AI 가 옮긴 2번'}]}]})}));
    const [chooser]=await Promise.all([p.waitForEvent('filechooser'),p.locator('.empty-state .es-start button').nth(1).click()]);
    assert.equal(await chooser.element().getAttribute('id'),'aiImgInput');
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
    await chooser.setFiles({name:'q.png',mimeType:'image/png',buffer:png});
    await p.waitForFunction(()=>sets[0]?.problems.some(q=>q.blocks?.[0]?.data?.text==='AI 가 옮긴 1번'),null,{timeout:10000})
      .catch(async e=>{throw new Error('AI 결과 미도착 '+await p.evaluate(()=>JSON.stringify({toast:[...document.querySelectorAll('.toast')].map(t=>t.textContent),ai:document.querySelector('#aiGenStatus')?.textContent,user:!!currentUser,n:sets.length,blocks:sets[0]?.problems.map(q=>q.blocks)})));});
    const got=await p.evaluate(()=>({n:sets.length,texts:sets[0].problems.map(q=>q.blocks?.[0]?.data?.text||''),cur:currentQId===sets[0].problems[0].id}));
    await p.evaluate(()=>{currentUser=null;});
    assert.deepEqual(got,{n:1,texts:['AI 가 옮긴 1번','AI 가 옮긴 2번'],cur:true},'빈 1번이 남았거나 결과 자리가 틀렸다: '+JSON.stringify(got));
    // 응답을 기다리는 동안 고치고 ⌘Z 로 되돌려도(sets 객체가 갈아 끼워진다) 결과가 지금 sets 에 들어가야 한다
    let release; const gate=new Promise(r=>{release=r;});
    await p.unroute(/workers\.dev/);
    await p.route(/workers\.dev/,async r=>{await gate;r.fulfill({contentType:'application/json',
      body:JSON.stringify({problems:[{blocks:[{type:'statement',text:'되돌린 뒤 도착'}]}]})});});
    await p.evaluate(()=>{currentUser={uid:'ui-ai',getIdToken:async()=>'fixture-token'};flushHistory();});
    const [c2]=await Promise.all([p.waitForEvent('filechooser'),p.locator('#aiDropZone').click()]);
    await c2.setFiles({name:'q2.png',mimeType:'image/png',buffer:png});
    await p.waitForFunction(()=>/AI가 문제를 변환/.test(document.querySelector('#aiGenStatus')?.textContent||''));
    await p.evaluate(()=>{historyStep(()=>{sets[0].name='기다리는 중 바꾼 이름';});saveSets();doUndo();});
    release();
    await p.waitForFunction(()=>!/변환하는 중/.test(document.querySelector('#aiGenStatus')?.textContent||''),null,{timeout:10000});
    const kept=await p.evaluate(()=>({has:sets[0].problems.some(q=>q.blocks?.[0]?.data?.text==='되돌린 뒤 도착'),name:sets[0].name}));
    await p.evaluate(()=>{currentUser=null;});
    assert.equal(kept.has,true,'되돌리기 뒤 도착한 AI 결과가 지금 문제집에 없다 '+JSON.stringify(kept));
  });

  assert.deepEqual(failures,[]);
}finally{await browser?.close();server.kill();}
