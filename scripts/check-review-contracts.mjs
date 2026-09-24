// Isolated browser + mock remote boundary; never connects to a real account.
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const port=18879, base=`http://127.0.0.1:${port}`;
const server=spawn(process.env.HWPX_PYTHON||'python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;const failures=[];
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures.push(name);console.error('FAIL',name,e.message.replace(/\n/g,' | '));}}
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({ignoreDefaultArgs:['--allow-file-access-from-files']});
 /* ⚠️ **검사가 배포 플래그를 물려받으면 안 된다.** 예전에는 `service-config.js` 의
    `libraryCloudSchema` 를 그대로 썼다 — 공개 전에 그 값을 0 으로 내리라는 지시를 따르는
    순간 B단계 검사 3건이 빨간불이 되고, 제품이 깨진 건지 검사가 깨진 건지 가를 수 없었다.
    그래서 `index.html` 검사는 **자기 단계를 스스로 선언해야 하고**, 안 하면 여기서 터진다. */
 async function app(file='index.html',{fileMode=false,schema,revision}={}){
  if(file==='index.html'&&schema!==0&&schema!==1)
   throw Error('index.html 검사는 libraryCloudSchema 를 선언해야 합니다 (A=0 · B=1)');
  if(file==='index.html'&&revision!==0&&revision!==1)
   throw Error('index.html 검사는 setRevisionSchema 를 선언해야 합니다 (legacy=0 · CAS=1)');
  const p=await browser.newPage();
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(process.env.REVIEW_RED==='1' && ['index.html','mock-exam-editor.html','hwpx-exam.js'].some(f=>u.pathname.endsWith('/'+f))){
   const name=u.pathname.split('/').pop(); return r.fulfill({contentType:name.endsWith('.js')?'application/javascript':'text/html',body:execFileSync('git',['show','31da3eb:'+name])});
  }return u.origin===base||u.protocol==='file:'?r.continue():r.abort();});
  await p.goto(fileMode?pathToFileURL(process.cwd()+'/'+file).href:base+'/'+file);
  await p.waitForFunction(()=>typeof toast==='function');
  /* service-config.js 가 로드 때 이 객체를 덮으므로 **로드 뒤에** 건다.
     `libraryCloudEnabled()` 는 호출 시점에 읽으므로 이걸로 충분하다. */
  if(schema===0||schema===1) await p.evaluate(({schema,revision,inherit})=>{
   window.PEDAGOGY_PUBLIC_CONFIG=Object.freeze({...window.PEDAGOGY_PUBLIC_CONFIG,
    libraryCloudSchema:schema,
    // Red probe inherits the release flag to prove the old false failures recur.
    ...(inherit?{}:{setRevisionSchema:revision})});},{schema,revision,
      inherit:process.env.REVIEW_FLAG_RED==='1'});
  return p;
 }
 /* 소속의 **정본이 단계마다 다르다** — A 는 로컬 지도(`setFolder` 가 쓰는 곳), B 는
    문제집 문서다. 그래서 두 갈래로 나눠 검사한다.
    ⚠️ 삭제된 폴더 가리기는 **두 단계 모두** 지켜야 하고, 정본이 어느 쪽이든 가려야 한다. */
 for(const schema of [0,1])
 await test(`folder tombstone masks membership from either source (schema ${schema})`,async()=>{
  const p=await app('index.html',{schema,revision:1});const got=await p.evaluate(()=>{
   libMeta=normLibMeta({folderTombstones:{gone:10},folderBySetId:{viaMap:'gone'}});
   sets=[{id:'viaSet',folderId:'gone'},{id:'viaMap'}];
   const doc=setToDoc(sets[0],0);
   return [folderOf('viaSet'),folderOf('viaMap'),Object.hasOwn(doc,'folderId')?doc.folderId:'(absent)'];
  });assert.deepEqual(got,['','',schema===1?'':'(absent)']);await p.close();
 });
 /* ⚠️ B 전용 계약이다. A 는 클라우드에 folderId 를 **보내지도 읽지도 않으므로**
    옛 이관 지도가 정본으로 남는 것이 맞다 — 여기서 A 를 함께 돌리면 안 된다. */
 await test('explicit empty cloud folderId beats stale migration map (schema 1)',async()=>{
  const p=await app('index.html',{schema:1,revision:1});const got=await p.evaluate(()=>{
   libMeta=normLibMeta({folderBySetId:{empty:'old'}});
   sets=[{id:'empty',folderId:''}];
   return [folderOf('empty'),setToDoc(sets[0],0).folderId];
  });assert.deepEqual(got,['','']);await p.close();
 });
 await test('capability off never sends folderId or changes set for local move',async()=>{
  const p=await app('index.html',{schema:0,revision:1});const got=await p.evaluate(()=>{
   sets=[{id:'s',name:'s',problems:[]}];
   setFolder('s','local');return {inSet:'folderId' in sets[0],inDoc:'folderId' in setToDoc(sets[0],0),folder:folderOf('s')};
  });assert.deepEqual(got,{inSet:false,inDoc:false,folder:'local'});await p.close();
 });
 await test('A migration distinguishes absent field from explicit cloud no-folder',async()=>{
  const p=await app('index.html',{schema:1,revision:1});const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};saveSets=()=>{};
   const base={name:'s',header:'',problems:[]};
   sets=[normSet({...base,id:'local'},{keepId:true}),docToSet({...base,id:'cloud',folderId:''})];
   libMeta=normLibMeta({folderBySetId:{local:'old',cloud:'old'}});
   await migrateFoldersToCloud(sessionContext());return sets.map(s=>s.folderId);
  });assert.deepEqual(got,['old','']);await p.close();
 });
 await test('delete and immediate restore use same queue, delete errors propagate',async()=>{
  // This queue fixture intentionally exercises the pre-CAS batch transport.
  // Current CAS writes have separate revision transaction coverage.
  const p=await app('index.html',{schema:1,revision:0});const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};fbReady=true;let release;const gate=new Promise(r=>release=r),events=[];
   fbDb={collection:()=>({doc:()=>({collection:()=>({doc:id=>({set:async d=>{events.push('delete');await gate;events.push('deleted');}})})})}),batch:()=>({set:()=>events.push('restore'),commit:async()=>{}})};
   const s={id:'s',name:'s',header:'',problems:[]};sets=[];
   const deletion=deleteSetEverywhere(s);await new Promise(r=>setTimeout(r,0));
   sets=[s];touchSet('s');const restore=flushToCloud('test');await new Promise(r=>setTimeout(r,10));
   const early=events.slice();release();await deletion;await restore;
   fbDb.collection=()=>({doc:()=>({collection:()=>({doc:()=>({set:async()=>{throw Error('injected');}})})})});
   let rejected=false;try{await deleteSetEverywhere(s);}catch{rejected=true;}
   clearTimeout(saveTimer);currentUser=null;return {early,events,rejected};
  });assert.deepEqual(got.early,['delete']);assert.deepEqual(got.events,['delete','deleted','restore']);assert.equal(got.rejected,true);await p.close();
 });
 await test('account switch reloads local folder metadata',async()=>{
  const p=await app('index.html',{schema:1,revision:1});const got=await p.evaluate(async()=>{
   authInitialized=true;prevUid='A';currentUser={uid:'A'};libMeta=normLibMeta({folders:[{id:'A-only',name:'A'}]});
   loadSets=async()=>{};updatePlanBadge=async()=>{};
   localStorage.setItem('PM_LIBRARY_META:B',JSON.stringify({folders:[{id:'B-only',name:'B'}]}));
   await onAuth({uid:'B'});return libMeta.folders.map(f=>f.id);
  });assert.deepEqual(got,['B-only']);await p.close();
 });
 await test('mock JSON image is bounded by decoded 2 MiB',async()=>{
  const p=await app('mock-exam-editor.html');const got=await p.evaluate(()=>normBlockM({type:'image',data:{data:'data:image/png;base64,'+btoa('x'.repeat(2*1024*1024+1))}},(x,d)=>x??d).data.data.length);assert.equal(got,0);await p.close();
 });
 await test('actual selection Undo and Redo survive delayed tombstone snapshot',async()=>{
  const p=await app('index.html',{schema:1,revision:0});const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};fbReady=true;window.confirm=()=>true;
   let release,callback;const gate=new Promise(r=>release=r),remote=new Map();
   const emit=d=>callback?.({docChanges:()=>[{doc:{data:()=>d}}]});
   fbDb={collection:()=>({doc:()=>({collection:()=>({
     onSnapshot:(...args)=>{callback=typeof args[0]==='function'?args[0]:args[1];return ()=>{};},
     doc:id=>({id,set:async d=>{await gate;remote.set(id,d);emit(d);}})
   })})}),batch:()=>{const docs=[];return {set:(ref,d)=>docs.push([ref.id,d]),commit:async()=>{for(const [id,d] of docs){remote.set(id,d);emit(d);}}};}};
   sets=[{id:'s',name:'s',header:'',problems:[]},{id:'keep',name:'keep',header:'',problems:[]}];
   lastSnapshot=snapshot();undoStack=[];redoStack=[];libPicking=true;libPicked.add('s');watchCloud();
   const deletion=document.querySelector('#selDeleteBtn').onclick();
   await new Promise(r=>setTimeout(r,0));doUndo();const restored=flushToCloud('test');release();
   await deletion;await restored;const undo=remote.get('s')?.deleted===false && sets.some(s=>s.id==='s');
   doRedo();await cloudSaveQueue;await flushToCloud('test');
   const redo=remote.get('s')?.deleted===true && !sets.some(s=>s.id==='s');
   clearTimeout(saveTimer);clearTimeout(histTimer);currentUser=null;return {undo,redo};
  });assert.deepEqual(got,{undo:true,redo:true});await p.close();
 });
 await test('401 selected deletes retain only failed ID and permit retry',async()=>{
  const p=await app('index.html',{schema:1,revision:0});const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};fbReady=true;window.confirm=()=>true;
   let rejectOne=true,deleted=0;
   fbDb={collection:()=>({doc:()=>({collection:()=>({doc:id=>({set:async()=>{if(id==='s400'&&rejectOne)throw Error('injected');deleted++;}})})})}),batch:()=>({set(){},commit:async()=>{}})};
   sets=Array.from({length:401},(_,i)=>({id:'s'+i,name:'s'+i,header:'',problems:[]}));
   lastSnapshot=snapshot();libPicking=true;sets.forEach(s=>libPicked.add(s.id));
   await document.querySelector('#selDeleteBtn').onclick();
   const failed=[...libPicked];const kept=sets.some(s=>s.id==='s400');
   rejectOne=false;await document.querySelector('#selDeleteBtn').onclick();
   clearTimeout(saveTimer);currentUser=null;return {failed,kept,deleted,picked:libPicked.size};
  });assert.deepEqual(got,{failed:['s400'],kept:true,deleted:401,picked:0});await p.close();
 });
 await test('concurrent prefs save preserves remote tombstones and clears 401 memberships in chunks',async()=>{
  const p=await app('index.html',{schema:1,revision:0});const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};fbReady=true;
   libMeta=normLibMeta({folders:[{id:'gone',name:'old'}],syncPending:true});
   sets=Array.from({length:401},(_,i)=>({id:'s'+i,name:'s',header:'',problems:[],folderId:'gone'}));
   sets.forEach((s,i)=>cloudSynced.set(s.id,cloudSyncEntry(s,i)));
   let remote={folders:[],folderTombstones:{gone:999}},chunks=[],round=0;
   fbDb={collection:()=>({doc:()=>({collection:()=>({doc:id=>({set:async data=>{remote=data;}})})})}),
     runTransaction:async run=>run({get:async()=>({exists:true,data:()=>remote}),set:(ref,data)=>{remote=data;}}),
     batch:()=>{let n=0;return {set:(id,d)=>{if(d.folderId!=='')throw Error('stale folder');n++;},commit:async()=>{chunks.push(n);if(++round===2)throw Error('injected second chunk');}};}};
   saveLibraryPrefs();await new Promise(r=>setTimeout(r,600));const pending=libMeta.syncPending;
   saveLibraryPrefs();await new Promise(r=>setTimeout(r,600));clearTimeout(saveTimer);currentUser=null;
   return {tomb:remote.folderTombstones.gone,folders:remote.folders.length,chunks,pending,after:libMeta.syncPending};
  });assert.deepEqual(got,{tomb:999,folders:0,chunks:[400,1,400,1],pending:true,after:false});await p.close();
 });
 await test('figure format follows bytes and broken data produces warning',async()=>{
  const p=await app('mock-exam-editor.html');const template=readFileSync('experiments/hwp-export/templates/exam-math.hwpx').toString('base64');
  const got=await p.evaluate(async b64=>{
   const {doc,roles}=await PedagogyExamTemplate.openTemplate(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);
   const w=new PedagogyExam.ExamWriter(doc,roles);
   const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAIAAAB2XpiaAAAADUlEQVR4nGP4z8AARwAd7wP95hFmHQAAAABJRU5ErkJggg==';
   w.figure({w:58,src:'wrong.jpg',data:png},'test');w.figure({w:58,src:'broken.png',data:'data:image/png;base64,AA=='},'broken');
   const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;
   w.figure({w:58,src:'wrong-jpeg.png',data:canvas.toDataURL('image/jpeg')},'jpeg');
   const xml=new XMLSerializer().serializeToString(doc.part('Contents/content.hpf').xml);
   return {png:doc.parts.has('BinData/wrong.png'),jpeg:doc.parts.has('BinData/wrong-jpeg.jpg'),mime:xml.includes('media-type="image/png"'),figures:w.report.figures,warnings:w.report.warnings.length};
  },template);assert.deepEqual(got,{png:true,jpeg:true,mime:true,figures:2,warnings:1});await p.close();
 });
 for(const fileMode of [false,true])await test(`exam download without API server (${fileMode?'file':'http'})`,async()=>{
  const p=await app('mock-exam-editor.html',{fileMode});
  await p.evaluate(()=>{pingServer=async()=>{throw Error('API must not be used');};LIVE.found=false;
   state.problems=[{id:1,num:1,sect:'공통',type:'short',pts:2,blocks:[{type:'statement',data:{text:'test'}},{type:'image',data:{width:58,src:'figure.png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAIAAAB2XpiaAAAADUlEQVR4nGP4z8AARwAd7wP95hFmHQAAAABJRU5ErkJggg=='}}]}];});
  const download=p.waitForEvent('download',{timeout:8000});await p.locator('#hwpxBtn').click();
  const d=await download;assert.equal(await d.failure(),null);const raw=readFileSync(await d.path());assert.ok(raw.length>1000);
  const image=await p.evaluate(async b64=>{const parts=await PedagogyHwpx.unzip(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);
   return Array.from(parts.keys()).filter(k=>k.startsWith('BinData/'));},raw.toString('base64'));
  assert.ok(image.includes('BinData/figure.png'),JSON.stringify(image));await p.close();
 });
 await test('download failure restores button and reports failure without success',async()=>{
  const p=await app('mock-exam-editor.html');const got=await p.evaluate(async()=>{
   const messages=[];toast=(s,t)=>messages.push(t);saveHwpxBlob=()=>{throw Error('injected download failure');};
   pingServer=async()=>{};LIVE.found=false;await toHwpx();
   return {disabled:document.querySelector('#hwpxBtn').disabled,success:messages.includes('success'),error:messages.includes('error')};
  });assert.deepEqual(got,{disabled:false,success:false,error:true});await p.close();
 });
 /* ⚠️ **정규화를 별도 파일로 빼도 `file://` 전제가 깨지면 안 된다**(구조 1단계).
    "파일을 그대로 열어 쓴다" 가 이 저장소의 전제이고, 고전 스크립트는 `file://` 에서
    실행되지만 **ESM 은 아니다** — 그래서 ESM 을 쓰지 않았다. 이 검사가 그 결정을 지킨다.
    ⚠️ `app()` 은 `--allow-file-access-from-files` 를 **끄고** 띄운다(위 launch 인자) —
       그 플래그가 켜져 있으면 실제 제약을 재지 못한다. */
 await test('index.html boots from file:// with the split normalization module',async()=>{
  const p=await app('index.html',{fileMode:true,schema:0,revision:1});
  const got=await p.evaluate(()=>({ns:typeof window.PedagogyNormalize?.normSet,
    norm:typeof window.normSet, safe:window.safeUrl('javascript:alert(1)'),
    cards:document.querySelectorAll('#libGrid .card, .set-card').length>0}));
  assert.deepEqual(got,{ns:'function',norm:'function',safe:'',cards:true});await p.close();
 });
 /* ⚠️ **정규화를 별도 파일로 옮겨도 `window` 표면이 바뀌면 안 된다**(구조 1단계).
    옮기기 전 이 여덟은 최상위 `function` 선언이라 `window` 속성이었고 회귀 검사
    80여 곳이 `win.normBlock(...)` 으로 부른다. 반대로 `uid`·`sanitize`·`str`·
    `normOrder` 는 `const` 였으므로 **올라가면 안 된다** — 표면을 넓히는 것도 회귀다. */
 /* ⚠️ **모의고사 라이브러리 저장 계층도 `file://` 에서 살아 있어야 한다.**
    "파일을 그대로 열어 쓴다" 가 이 저장소의 전제라 ESM 을 쓰지 않았고, 이 검사가 그
    결정을 지킨다. 모의고사 탭은 `file://` 에서도 그려져야 한다(카드 저장은 그 브라우저의
    localStorage 를 쓴다 — 편집기 iframe 은 출처가 달라 postMessage 로만 이어진다). */
 await test('mock library store loads and renders from file://',async()=>{
  const p=await app('index.html',{fileMode:true,schema:0,revision:1});
  const got=await p.evaluate(()=>{
   const S=window.MockLibraryStore;
   if(!S) return {store:'missing'};
   mocks=[S.normMock({name:'파일 모의고사',problems:[{id:'p1'}]})];mocksLoaded=true;
   setLibraryTab('mocks');
   return {store:typeof S.normMock,
           panel:!document.getElementById('mocksPanel').hidden,
           cards:[...document.querySelectorAll('#mockGrid .set-card h3')].map(h=>h.textContent)};
  });
  assert.deepEqual(got,{store:'function',panel:true,cards:['파일 모의고사']});await p.close();
 });
 await test('moving normalization keeps the exact window surface',async()=>{
  const p=await app('index.html',{schema:0,revision:1});const got=await p.evaluate(()=>({
   up:['safeUrl','normSubject','normSheetColor','normBlock','normProblem','normSet',
       'normLibMeta','resetNormDropped','reportNormDropped']
      .filter(n=>typeof window[n]!=='function'),
   down:['uid','sanitize','str','normOrder','BLOCK_TYPES','SUBJECTS','SET_NAME_MAX']
      .filter(n=>n in window),
   ns:typeof window.PedagogyNormalize?.normSet==='function',
  }));assert.deepEqual(got,{up:[],down:[],ns:true});await p.close();
 });
 /* 구조 2단계는 렌더 함수를 옮기되 기존 window 표면과 두 핵심 계약을 그대로 지킨다.
    processText 는 먼저 sanitize 한 뒤 제한된 인라인 표지만 HTML 로 바꿔야 하고,
    blockHTML 은 미리보기·인쇄가 넘기는 subject/range 문맥을 잃으면 안 된다. */
 /* ⚠️ **인쇄 배치를 옮겨도 묶음 경계와 축소 순서가 살아 있어야 한다**(구조 3단계).
    `problemGroups()` 는 묶음 경계를 아는 **유일한 곳**이고, `shrinkWideMathAll()` 의
    읽기·쓰기 단계 순서는 300문항 인쇄에서 1616ms → 265ms 를 만든 것이다.
    ⚠️ 고정 기대 묶음과 견준다 — 목록과 인쇄를 서로 견주면 **함께 틀려도 통과**한다. */
 await test('print split keeps its surface, group boundaries, and staged shrink',async()=>{
  const p=await app('index.html',{schema:0,revision:1});const got=await p.evaluate(()=>{
   const f=['hasPassage','groupSpanOf','computeNums','pairEveryN','shrinkWideMathAll',
    'shrinkWideMath','fitMathIn','setPair','problemGroups','groupAt','spanOf','awaitPrintImages'];
   /* pair · page · col — 예전에 인쇄와 목록이 갈라졌던 바로 그 배치다. */
   const arr=[{span:'pair',blocks:[]},{span:'pair',blocks:[]},{span:'page',blocks:[]},{span:'col',blocks:[]}];
   /* ⚠️ **가짜 노드가 '이미 축소된 상태' 로 시작한다.** 그래야 '재기 전에 해제했는가' 를
      실제로 잴 수 있다 — 해제 전에 재면 자연 폭(400) 대신 축소된 폭(200)을 읽어 배율이
      틀린다(재인쇄 때 실제로 그렇게 된다). 빈 값 쓰기는 `clear`, 나머지는 `apply` 로 센다.
      ⚠️ 계측 대상은 지금 쓰는 레이아웃 읽기(`scrollWidth`·`offsetHeight`)뿐이다 —
         새 읽기 API 를 쓰게 되면 여기에도 함께 더해야 이 검사가 계속 뜻을 갖는다. */
   const order=[];
   const node=()=>{ const store={transform:'scale(0.5)',width:'200px',display:'inline-block'};
    const self={ cleared:false,
     style:new Proxy(store,{set:(t,key,v)=>{
       if(v===''){ order.push('clear'); if(key==='transform') self.cleared=true; }
       else order.push('apply');
       t[key]=v; return true; }}),
     get scrollWidth(){ order.push('read'); return self.cleared?400:200; },
     get offsetHeight(){ order.push('read'); return 20; },
     querySelector:()=>null, firstElementChild:null, store };
    return self; };
   const pairs=[{disp:node(),inner:node(),avail:100},{disp:node(),inner:node(),avail:100}];
   shrinkWideMathAll(pairs);
   const firstRead=order.indexOf('read'), lastRead=order.lastIndexOf('read');
   const lastClear=order.lastIndexOf('clear'), firstApply=order.indexOf('apply');
   return {ns:typeof window.PedagogyPrint?.problemGroups,
    missing:f.filter(n=>typeof window[n]!=='function'),
    leaked:['PRINT_IMG_WAIT_MS','MIN_PRINT_SCALE'].filter(n=>n in window),
    groups:JSON.stringify(problemGroups(arr).map(g=>g.full?[g.idx,'full']:[g.idx])),
    /* 해제 → 측정 → 적용. 세 단계가 겹치면 안 된다. */
    staged:lastClear>=0 && lastClear<firstRead && firstRead<=lastRead && lastRead<firstApply,
    /* 순서가 옳으면 자연 폭 400 을 읽어 100*0.99/400 = 0.2475 가 나온다.
       해제 전에 재면 200 을 읽어 폭도 배율도 달라진다. */
    applied:pairs[0].inner.store.width+' '+pairs[0].inner.store.transform};
  });assert.deepEqual(got,{ns:'function',missing:[],leaked:[],
   groups:JSON.stringify([[[0,1]],[[2],'full'],[[3]]]),staged:true,
   applied:'400px scale(0.2475)'});await p.close();
 });
 await test('render split keeps its surface, sanitization order, and context',async()=>{
  const p=await app('index.html',{schema:0,revision:1});const got=await p.evaluate(()=>{
   const f=['setHasContent','blockExcerpt','autoDisplayStyle','addCasesRowGap','inlineMarks',
    'processText','verseHTML','isEllipsisLine','rangeOpen','isRangeClose','splitRanges',
    'rangeWrap','splitParagraphs','proseHTML','tableHTML','groupHeadHTML','blockHTML'];
   const html=processText('**<img src=x onerror=alert(1)>**');
   const passage=blockHTML(normBlock({type:'passage',data:{lead:'읽기',parts:[{text:'본문'}]}}),
    {subject:'english',range:'16~17'});
   return {ns:typeof window.PedagogyRender?.blockHTML,
    missing:f.filter(n=>typeof window[n]!=='function'),
    leaked:['HANGULS','HSMALL','condLabel','circled'].filter(n=>n in window),
    escaped:html.includes('&lt;img')&&!html.includes('<img'),
    context:passage.includes('psg-en')&&passage.includes('[16~17]')};
  });assert.deepEqual(got,{ns:'function',missing:[],leaked:[],escaped:true,context:true});await p.close();
 });
/* ⚠️ **멈춘 클라우드 읽기가 화면을 영원히 붙잡으면 안 된다**(`REV-2026-064`).
   Firestore 는 전송이 막히면 **거부하지 않고 계속 재시도**하므로, `await` 가 안 풀려
   '문제집을 불러오는 중…' 이 그대로 남는다(아이패드 사파리에서 실제로 그랬고 새로고침
   해야 떴다). 여기서는 `.get()` 이 **영영 안 끝나는** 약속을 돌려주게 하고, 그래도
   로컬 데이터로 라이브러리가 그려지는지 본다.
   ⚠️ 상한이 8초라 이 검사도 그만큼 걸린다 — 시간을 줄이려고 제품에 검사용 구멍을
      내지 않는다. */
 await test('a hung cloud read falls back to local data instead of spinning forever',async()=>{
  const p=await app('index.html',{schema:1,revision:1});
  /* ⚠️ **검사 쪽에도 상한을 둔다.** 제품에 상한이 없으면 `loadSets()` 가 영영 안 끝나
     `evaluate` 가 매달린다 — 그러면 검사가 빨간불이 아니라 **멈춘다**(CI 를 막을 뿐
     아무것도 알려주지 않는다). 실제로 깨보기에서 그렇게 됐다. */
  const got=await Promise.race([
   p.evaluate(async()=>{
   currentUser={uid:'test',displayName:'검사'};fbReady=true;authInitialized=true;
   const messages=[];const realToast=toast;toast=(s,t)=>{messages.push(s);};
   /* 절대 끝나지 않는 읽기 — 거부도 하지 않는다(그것이 실제 증상이다) */
   const never=()=>new Promise(()=>{});
   fbDb={collection:()=>({doc:()=>({get:never,collection:()=>({
     doc:()=>({set:async()=>{}}), get:never, onSnapshot:()=>()=>{} })})}),
     batch:()=>({set(){},commit:async()=>{}})};
   try{ localStorage.setItem('PM_SETS_V7:test',JSON.stringify(
     [{id:'local1',name:'이 기기 문제집',header:'',problems:[{id:'q1',blocks:[]}]}])); }catch{}
   const t0=Date.now();
   await loadSets();
   showLibrary();
   const names=[...document.querySelectorAll('.set-card h3')].map(e=>e.textContent);
   toast=realToast;
   return {걸린초:Math.round((Date.now()-t0)/1000), names,
           느리다고알림:messages.some(m=>m.includes('느려요')),
           /* ⚠️ `document.body.textContent` 로 보면 안 된다 — **`<script>` 안의 문자열까지
              포함**해서 그 문구가 소스에 있는 것만으로 참이 된다(실제로 속았다).
              보이는 자리인 문제집 격자만 본다. */
           로딩화면남음:(document.getElementById('setGrid')||{}).textContent
                        ?.includes('불러오는 중')===true};
  }),
   new Promise((_,rej)=>setTimeout(()=>rej(new Error(
    '앱이 클라우드 읽기에서 멈췄다 — 상한이 없으면 로딩 화면이 영원히 남는다')),20000)),
  ]);
  assert.equal(got.로딩화면남음,false,'로딩 화면이 그대로 남았다: '+JSON.stringify(got));
  assert.deepEqual(got.names,['이 기기 문제집'],JSON.stringify(got));
  assert.equal(got.느리다고알림,true,'느리다는 안내가 없다: '+JSON.stringify(got));
  assert.ok(got.걸린초<=12,'상한보다 오래 걸렸다: '+got.걸린초+'초');
  await p.close();
 });
 await test('a hung folder preferences read does not hold an already loaded library',async()=>{
  const p=await app('index.html',{schema:1,revision:1});
  const got=await Promise.race([
   p.evaluate(async()=>{
    currentUser={uid:'test',displayName:'검사'};fbReady=true;authInitialized=true;
    const never=()=>new Promise(()=>{});
    const set={id:'cloud1',name:'클라우드 문제집',header:'',problems:[{id:'q1',blocks:[]}],
               order:0,updatedAt:1,deleted:false};
    const prefs={get:never,onSnapshot:()=>()=>{}};
    fbDb={collection:()=>({doc:()=>({
      get:async()=>({exists:false,data:()=>({})}),
      collection:name=>name==='sets'
        ? {get:async()=>({docs:[{data:()=>set}]}),onSnapshot:()=>()=>{},doc:()=>({set:async()=>{}})}
        : {doc:()=>prefs}
    })}),batch:()=>({set(){},commit:async()=>{}})};
    const t0=Date.now();await loadSets();showLibrary();
    return {ms:Date.now()-t0,names:[...document.querySelectorAll('.set-card h3')].map(e=>e.textContent)};
   }),
   new Promise((_,rej)=>setTimeout(()=>rej(new Error(
    '폴더 설정 읽기가 이미 읽은 문제집 화면을 붙잡았다')),3000)),
  ]);
  assert.deepEqual(got.names,['클라우드 문제집'],JSON.stringify(got));
  assert.ok(got.ms<2000,'문제집을 보여 주기까지 너무 오래 걸렸다: '+got.ms+'ms');
  await p.close();
 });
 await test('classic scripts share lexical bindings without window properties',async()=>{
  const p=await browser.newPage();await p.setContent('<!doctype html>');
  await p.addScriptTag({content:'const reviewLexical=42;'});
  await p.addScriptTag({content:'window.reviewResult=[reviewLexical,window.reviewLexical===undefined];'});
  assert.deepEqual(await p.evaluate(()=>window.reviewResult),[42,true]);await p.close();
 });
 assert.deepEqual(failures,[]);
}finally{await browser?.close();server.kill();}
