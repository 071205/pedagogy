// Isolated browser + mock remote boundary; never connects to a real account.
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const port=18879, base=`http://127.0.0.1:${port}`;
const server=spawn(process.env.HWPX_PYTHON||'python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;const failures=[];
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures.push(name);console.error('FAIL',name,e.message);}}
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({ignoreDefaultArgs:['--allow-file-access-from-files']});
 async function app(file='index.html',fileMode=false){
  const p=await browser.newPage();
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(process.env.REVIEW_RED==='1' && ['index.html','mock-exam-editor.html','hwpx-exam.js'].some(f=>u.pathname.endsWith('/'+f))){
   const name=u.pathname.split('/').pop(); return r.fulfill({contentType:name.endsWith('.js')?'application/javascript':'text/html',body:execFileSync('git',['show','31da3eb:'+name])});
  }return u.origin===base||u.protocol==='file:'?r.continue():r.abort();});
  await p.goto(fileMode?pathToFileURL(process.cwd()+'/'+file).href:base+'/'+file);
  await p.waitForFunction(()=>typeof toast==='function');return p;
 }
 await test('folder tombstone masks stale membership; empty cloud value beats migration map',async()=>{
  const p=await app();const got=await p.evaluate(()=>{
   libMeta=normLibMeta({folderTombstones:{gone:10},folderBySetId:{empty:'old'}});
   sets=[{id:'s',folderId:'gone'},{id:'empty',folderId:''}];
   return [folderOf('s'),folderOf('empty'),setToDoc(sets[0],0).folderId];
  });assert.deepEqual(got,['','','']);await p.close();
 });
 await test('capability off never sends folderId or changes set for local move',async()=>{
  const p=await app();const got=await p.evaluate(()=>{
   window.PEDAGOGY_PUBLIC_CONFIG={libraryCloudSchema:0};sets=[{id:'s',name:'s',problems:[]}];
   setFolder('s','local');return {inSet:'folderId' in sets[0],inDoc:'folderId' in setToDoc(sets[0],0),folder:folderOf('s')};
  });assert.deepEqual(got,{inSet:false,inDoc:false,folder:'local'});await p.close();
 });
 await test('A migration distinguishes absent field from explicit cloud no-folder',async()=>{
  const p=await app();const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};saveSets=()=>{};
   const base={name:'s',header:'',problems:[]};
   sets=[normSet({...base,id:'local'},{keepId:true}),docToSet({...base,id:'cloud',folderId:''})];
   libMeta=normLibMeta({folderBySetId:{local:'old',cloud:'old'}});
   await migrateFoldersToCloud(sessionContext());return sets.map(s=>s.folderId);
  });assert.deepEqual(got,['old','']);await p.close();
 });
 await test('delete and immediate restore use same queue, delete errors propagate',async()=>{
  const p=await app();const got=await p.evaluate(async()=>{
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
  const p=await app();const got=await p.evaluate(async()=>{
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
  const p=await app();const got=await p.evaluate(async()=>{
   currentUser={uid:'test'};fbReady=true;window.confirm=()=>true;
   let release,callback;const gate=new Promise(r=>release=r),remote=new Map();
   const emit=d=>callback?.({docChanges:()=>[{doc:{data:()=>d}}]});
   fbDb={collection:()=>({doc:()=>({collection:()=>({
     onSnapshot:cb=>{callback=cb;return ()=>{};},
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
  const p=await app();const got=await p.evaluate(async()=>{
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
  const p=await app();const got=await p.evaluate(async()=>{
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
  const p=await app('mock-exam-editor.html',fileMode);
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
 await test('classic scripts share lexical bindings without window properties',async()=>{
  const p=await browser.newPage();await p.setContent('<!doctype html>');
  await p.addScriptTag({content:'const reviewLexical=42;'});
  await p.addScriptTag({content:'window.reviewResult=[reviewLexical,window.reviewLexical===undefined];'});
  assert.deepEqual(await p.evaluate(()=>window.reviewResult),[42,true]);await p.close();
 });
 assert.deepEqual(failures,[]);
}finally{await browser?.close();server.kill();}
