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
  assert.deepEqual(failures,[]);
}finally{await browser?.close();server.kill();}
