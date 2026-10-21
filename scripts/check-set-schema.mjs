/* REV-108 ② browser regression. No live Firebase account is used. */
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rehashInlineScripts} from './lib/csp-rehash.mjs';

const baseline=process.env.SET_SCHEMA_BASELINE==='1';
const skip=process.env.SET_SCHEMA_SKIP_MUTATION==='1';
const mutation=process.env.SET_SCHEMA_RED||'';
const base='http://127.0.0.1:18893';
const server=spawn('python3',['serve.py','--port','18893'],{stdio:'ignore'});
let browser,started=0;const failures=[];
async function open(){
  const p=await browser.newPage();p.setDefaultTimeout(8000);
  await p.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==base)return route.abort();
    if(baseline&&!skip&&['/index.html','/pedagogy-normalize.js','/pedagogy-render.js'].includes(u.pathname))
      return route.fulfill({contentType:u.pathname.endsWith('.html')?'text/html':'text/javascript',
        body:execFileSync('git',['show',`ad5fe91:${u.pathname.slice(1)}`])});
    if(mutation&&!skip&&u.pathname==='/index.html'){
      const original=readFileSync('index.html','utf8');
      const changes={
        marker:['setSchemaVersion:SET_SCHEMA_VERSION }','}'],
        'bulk-local':['if(sets.some(intakeSetReadOnly)) throw Error("읽기 전용 문제집이 있어 전체 삭제를 시작하지 않았어요 · 원본을 보존했습니다");',''],
        'bulk-remote':['includeTombstones:false,requireSupported:true','includeTombstones:false'],
        account:['includeTombstones:true});','includeTombstones:true,requireSupported:true});'],
        export:['if(setSchemaUnsupported(s))return portableIntakeSet(s);',''],
        'future-intake':['return !setSchemaUnsupported(set)&&PedagogyNormalize.intakeNeedsUpdate(set);',
          'return PedagogyNormalize.intakeNeedsUpdate(set);']
      };
      const [from,to]=changes[mutation]||[];
      assert.ok(from&&original.includes(from),`RED ${mutation} anchor missing`);
      assert.equal(original.split(from).length,2,`RED ${mutation} anchor ambiguous`);
      return route.fulfill({contentType:'text/html',body:rehashInlineScripts(original.replace(from,to))});
    }
    return route.continue();
  });
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof setToDoc==='function'&&typeof writeSetDocRevision==='function');
  await p.evaluate(()=>{
    localStorage.clear();currentUser={uid:'schema-owner'};authEpoch++;fbReady=true;wiping=false;
    window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,setRevisionSchema:1,libraryCloudSchema:1};
    sets=[{id:'s',name:'기준',header:'',lineColor:'indigo',subject:'math',problems:[]}];
    cloudSynced.clear();setWriteBase.clear();setSyncBase.clear();deletedIds.clear();
    const clone=v=>JSON.parse(JSON.stringify(v));
    window.__remote=new Map();window.__writes=0;
    const col=()=>({doc:id=>({__id:String(id),collection:col})});
    fbDb={collection:col,runTransaction:async run=>{
      const writes=[];const tx={get:async ref=>{const data=window.__remote.get(ref.__id);
        return {exists:data!==undefined,data:()=>clone(data)};},
        set:(ref,data)=>writes.push([ref.__id,clone(data)])};
      const result=await run(tx);writes.forEach(([id,data])=>{window.__writes++;window.__remote.set(id,data);});
      return result;
    }};
    window.__installDeleteDb=({stopAfterDelete=false}={})=>{
      const setsCol={
        get:async()=>({docs:[...window.__remote].map(([id,data])=>({id,data:()=>clone(data)}))}),
        doc:id=>({__id:String(id)})
      };
      fbDb.collection=()=>({doc:()=>({collection:()=>setsCol})});
      fbDb.batch=()=>{
        const removals=[];
        return {delete:ref=>removals.push(ref.__id),commit:async()=>{
          removals.forEach(id=>{window.__remote.delete(id);window.__deletes.push(id);});
          if(stopAfterDelete)throw Error('stop after set documents');
        }};
      };
      window.__deletes=[];
      watchCloud=()=>{};
    };
  });
  return p;
}
async function check(name,run){
  started++;const p=await open();
  try{await run(p);console.log('PASS',name);}
  catch(e){failures.push(name);console.error('FAIL',name,'—',e.message);}
  finally{await p.close();}
}
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  await check('setToDoc and copy/tombstone carry schema v1',async p=>{
    const r=await p.evaluate(()=>{
      const source=setToDoc(sets[0],0);
      const copy=setToDoc({...sets[0],id:'copy'},1);
      const tomb={...setToDoc({id:'s',name:'',header:'',problems:[]},0),deleted:true};
      return [source.setSchemaVersion,copy.setSchemaVersion,tomb.setSchemaVersion];
    });assert.deepEqual(r,[1,1,1]);
  });
  await check('identical unmarked revision upgrades instead of no-write ACK',async p=>{
    const r=await p.evaluate(async()=>{
      const old=setToDoc(sets[0],0);delete old.setSchemaVersion;old.revision=2;
      window.__remote.set('s',old);
      setWriteBase.set('s',setWriteBaseEntryFromDoc(old));
      const result=await writeSetDocRevision(currentUser.uid,setToDoc(sets[0],0),sessionContext());
      return {wrote:result.wrote,revision:window.__remote.get('s').revision,
        schema:window.__remote.get('s').setSchemaVersion,writes:window.__writes};
    });assert.deepEqual(r,{wrote:true,revision:3,schema:1,writes:1});
  });
  await check('future server revision cannot be downgraded or tombstoned',async p=>{
    const r=await p.evaluate(async()=>{
      const future={...setToDoc(sets[0],0),setSchemaVersion:2,revision:7,unknown:{key:'opaque'}};
      window.__remote.set('s',future);
      setWriteBase.set('s',setWriteBaseEntryFromDoc(future));
      const before=JSON.stringify(window.__remote.get('s'));
      let update='',deletion='';
      try{await writeSetDocRevision(currentUser.uid,setToDoc(sets[0],0),sessionContext());}
      catch(e){update=e.code||'';}
      try{await writeSetDocRevision(currentUser.uid,{...setToDoc({id:'s',name:'',header:'',problems:[]},0),deleted:true},sessionContext());}
      catch(e){deletion=e.code||'';}
      return {update,deletion,unchanged:JSON.stringify(window.__remote.get('s'))===before,
        writes:window.__writes,choiceBlocked:serverChoiceBase({exists:true,data:future})===null};
    });assert.deepEqual(r,{update:'set-schema-update',deletion:'set-schema-update',unchanged:true,writes:0,choiceBlocked:true});
  });
  await check('future opaque set survives cloud, backup normalization and JSON export',async p=>{
    const r=await p.evaluate(()=>{
      const raw={id:'future',name:'미래',setSchemaVersion:2,problems:{shape:'future'},
        unknown:{inside:[1,{x:2}]}};
      const cloud=docToSet(raw), backup=normSet(raw,{keepId:true,lossless:true});
      const exported=portableIntakeSet(backup);
      return {cloud:JSON.stringify(cloud)===JSON.stringify(raw),
        backup:JSON.stringify(backup)===JSON.stringify(raw),
        exported:JSON.stringify(exported)===JSON.stringify(raw),
        readOnly:intakeSetReadOnly(backup),same:sameCloudSetDoc(raw,raw)};
    });assert.deepEqual(r,{cloud:true,backup:true,exported:true,readOnly:true,same:false});
  });
  await check('local future shape renders read-only without mutating original',async p=>{
    const r=await p.evaluate(()=>{
      const raw={id:'future',name:'미래',setSchemaVersion:2,problems:{opaque:true},extra:[{k:'v'}]};
      localStorage.setItem(setsKey(),JSON.stringify([raw]));
      const local=readLocalSets();sets=local;
      const before=JSON.stringify(local[0]);
      showLibrary();
      const saved=writeLocalNow();
      return {same:JSON.stringify(local[0])===before,readOnly:intakeSetReadOnly(local[0]),
        badge:document.querySelector('#setGrid')?.textContent.includes('문제집 버전 확인 필요'),
        saved,persisted:localStorage.getItem(setsKey())===JSON.stringify([raw])};
    });assert.deepEqual(r,{same:true,readOnly:true,badge:true,saved:true,persisted:true});
  });
  await check('legacy ACK stamps local version once and keeps persistent CAS base',async p=>{
    const r=await p.evaluate(async()=>{
      const old=setToDoc(sets[0],0);delete old.setSchemaVersion;old.revision=2;
      window.__remote.set('s',old);
      const legacy=docToSet(old);
      setWriteBase.set('s',setWriteBaseEntryFromDoc(old));
      setSyncBase.set('s',setSyncMetaEntry(legacy,0,2));
      const oldBase=!!setSyncBaseFor(sets[0],0);
      const result=await writeSetDocRevision(currentUser.uid,setToDoc(sets[0],0),sessionContext());
      acknowledgeSetWrites(currentUser.uid,[{id:'s',doc:result.doc,writeDoc:result.writeDoc}]);
      const afterACK={schema:sets[0].setSchemaVersion,synced:isCloudSynced(sets[0],0),
        base:!!setSyncBaseFor(sets[0],0),revision:setSyncBase.get('s')?.revision};
      loadSetSyncMeta(currentUser.uid);
      const persisted=!!setSyncBaseFor(sets[0],0);
      const writes=window.__writes;
      const saved=await writeCloudSnapshot(currentUser.uid,sessionContext());
      return {oldBase,afterACK,persisted,saved,noRepeat:window.__writes===writes};
    });
    assert.deepEqual(r,{oldBase:true,afterACK:{schema:1,synced:true,base:true,revision:3},
      persisted:true,saved:true,noRepeat:true});
  });
  await check('future snapshot holds local draft and stays read-only',async p=>{
    const r=await p.evaluate(()=>{
      const before=JSON.stringify(sets[0]);
      const future={...setToDoc(sets[0],0),setSchemaVersion:2,revision:9,
        name:'서버 미래본',futureField:{nested:['keep']}};
      const changed=observeIntakeRemoteBlocks(currentUser.uid,[future]);
      const merged=mergeSetsWithRevision([future],sets);
      return {changed,local:JSON.stringify(sets[0])===before,kept:merged[0]===sets[0],
        blocked:intakeSetReadOnly(sets[0]),notACK:!isCloudSynced(sets[0],0)};
    });assert.deepEqual(r,{changed:true,local:true,kept:true,blocked:true,notACK:true});
  });
  await check('future JSON files are rejected before either import changes data',async p=>{
    await p.evaluate(()=>{window.__toasts=[];window.toast=m=>window.__toasts.push(String(m));});
    const file={name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({
      id:'future',name:'다음 버전',setSchemaVersion:2,problems:[{id:'q',future:{keep:1}}]}))};
    await p.locator('#importAllInput').setInputFiles(file);
    await p.waitForFunction(()=>window.__toasts?.length>=1);
    await p.locator('#loadInput').setInputFiles(file);
    await p.waitForFunction(()=>window.__toasts?.length>=2);
    const r=await p.evaluate(()=>({count:sets.length,problems:sets[0].problems.length,
      errors:window.__toasts.filter(x=>x.includes('지원하지 않는 문제집 버전')).length}));
    assert.deepEqual(r,{count:1,problems:0,errors:2});
  });
  await check('deleteAllSets preserves an unsupported local set before backup or writes',async p=>{
    const r=await p.evaluate(async()=>{
      const future={id:'f',name:'미래',setSchemaVersion:2,problems:{opaque:true},folderId:'future-folder'};
      sets=[future];fbReady=false;writeLocalNow();
      const disk=localStorage.getItem(setsKey());
      let error='';try{await deleteAllSets();}catch(e){error=e.message;}
      return {error,preserved:JSON.stringify(sets[0])===JSON.stringify(future),
        disk:localStorage.getItem(setsKey())===disk,backup:!!localStorage.getItem(backupKey()),
        writes:window.__writes};
    });
    assert.deepEqual(r,{error:'읽기 전용 문제집이 있어 전체 삭제를 시작하지 않았어요 · 원본을 보존했습니다',
      preserved:true,disk:true,backup:false,writes:0});
  });
  await check('deleteAllSets preflights a future server set before any tombstone',async p=>{
    const r=await p.evaluate(async()=>{
      const normal={...setToDoc(sets[0],0),revision:1};
      const future={...normal,id:'future',revision:7,setSchemaVersion:2,problems:{opaque:true}};
      window.__remote.set('s',normal);window.__remote.set('future',future);
      window.__installDeleteDb();writeLocalNow();
      const disk=localStorage.getItem(setsKey()),server=JSON.stringify([...window.__remote]);
      let error='';try{await deleteAllSets();}catch(e){error=e.message;}
      return {error,local:sets.length===1&&sets[0].id==='s',disk:localStorage.getItem(setsKey())===disk,
        server:JSON.stringify([...window.__remote])===server,writes:window.__writes};
    });
    assert.deepEqual(r,{error:'지원하지 않는 문제집 버전이 있어 전체 삭제를 시작하지 않았어요 · 원본을 보존했습니다',
      local:true,disk:true,server:true,writes:0});
  });
  await check('account deletion reaches real hard-delete path for a future set',async p=>{
    const r=await p.evaluate(async()=>{
      const future={...setToDoc(sets[0],0),id:'future',revision:7,setSchemaVersion:2,
        problems:{opaque:true}};
      window.__remote.set('future',future);
      window.__installDeleteDb({stopAfterDelete:true});
      fbStorage={ref:()=>({listAll:async()=>({items:[],prefixes:[]})})};
      window.firebase={auth:{GoogleAuthProvider:class{}}};
      let authDeleted=false;
      currentUser={uid:'schema-owner',reauthenticateWithPopup:async()=>{},
        delete:async()=>{authDeleted=true;}};
      let error='';try{await deleteAccountEverything();}catch(e){error=e.message;}
      return {error,deleted:window.__deletes,remoteGone:!window.__remote.has('future'),authDeleted};
    });
    assert.deepEqual(r,{error:'stop after set documents',deleted:['future'],remoteGone:true,authDeleted:false});
  });
  await check('selected export keeps every opaque future field but omits current folder',async p=>{
    const r=await p.evaluate(async()=>{
      const future={id:'future',name:'미래',setSchemaVersion:2,folderId:'opaque-folder',
        problems:{shape:'future'},unknown:{nested:[1,2]}};
      const normal={...sets[0],folderId:'current-folder'};
      sets=[normal,future];libPicked.clear();libPicked.add('s');libPicked.add('future');
      URL.createObjectURL=blob=>{window.__selectedBlob=blob;return 'blob:probe';};
      URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=()=>{};
      $('#selExportBtn').onclick();
      const exported=JSON.parse(await window.__selectedBlob.text());
      return {opaque:JSON.stringify(exported[1])===JSON.stringify(future),
        currentHasFolder:Object.hasOwn(exported[0],'folderId'),
        original:future.folderId};
    });
    assert.deepEqual(r,{opaque:true,currentHasFolder:false,original:'opaque-folder'});
  });
  await check('future nonarray server yields schema hold and sibling save without intake crash',async p=>{
    const r=await p.evaluate(async()=>{
      const future={...setToDoc(sets[0],0),setSchemaVersion:2,revision:7,
        problems:{opaque:true}};
      window.__remote.set('s',future);
      const sibling={id:'sibling',name:'정상',header:'',problems:[]};
      const localFuture={id:'local-future',name:'미래 로컬',setSchemaVersion:2,
        problems:{opaque:true},unknown:{keep:'원본'}};
      sets.push(sibling,localFuture);
      const localFutureBefore=JSON.stringify(localFuture);
      const oldIntake={id:'old',problems:[{intake:{version:2,sources:[]}}]};
      const supportedIntake={...oldIntake,setSchemaVersion:1};
      const intakeFence=intakeNeedsUpdate(oldIntake)&&intakeSetReadOnly(oldIntake)
        &&intakeNeedsUpdate(supportedIntake)&&intakeSetReadOnly(supportedIntake);
      let error='';try{await writeSetDocRevision(currentUser.uid,setToDoc(sets[0],0),sessionContext());}
      catch(e){error=e.code||e.message;}
      idleSaveStatus(currentUser.uid);
      const saved=await writeCloudSnapshot(currentUser.uid,sessionContext());
      return {error,hold:setSchemaRemoteNeedsUpdate('s',currentUser.uid),
        future:JSON.stringify(window.__remote.get('s'))===JSON.stringify(future),
        localFuture:JSON.stringify(sets.find(x=>x.id==='local-future'))===localFutureBefore,
        notUploaded:!window.__remote.has('local-future'),
        sibling:window.__remote.get('sibling')?.setSchemaVersion,
        writes:window.__writes,saved,intakeFence};
    });
    assert.deepEqual(r,{error:'set-schema-update',hold:true,future:true,sibling:1,writes:1,
      saved:true,intakeFence:true,localFuture:true,notUploaded:true});
  });
  await check('cloud size prediction includes revision and schema marker',async p=>{
    const r=await p.evaluate(()=>{
      const s=sets[0];
      const q={id:'q',title:'',desc:'',answer:'',blocks:[]};s.problems=[q];
      const fixed=docBytes(predictedSetDoc(setToDoc(s,0)));
      const chars=Math.floor((CLOUD_DOC_MAX-fixed)/3);
      q.desc='가'.repeat(Math.max(0,chars));
      while(docBytes(predictedSetDoc(setToDoc(s,0)))<=CLOUD_DOC_MAX)q.desc+='가';
      const actual=docBytes(predictedSetDoc(setToDoc(s,0)));
      return {actual,limit:CLOUD_DOC_MAX,cloud:createIntakeLibrary().cloud('s'),
        schema:setToDoc(s,0).setSchemaVersion};
    });assert.ok(r.actual>r.limit);assert.equal(r.cloud,'tooBig');assert.equal(r.schema,1);
  });
}catch(e){console.error('HARNESS',e);process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();}
if(started!==14){console.error('incomplete schema browser checks');process.exit(1);}
if(baseline||mutation){
  const targets=baseline?['setToDoc and copy/tombstone carry schema v1',
    'identical unmarked revision upgrades instead of no-write ACK',
    'future server revision cannot be downgraded or tombstoned',
    'future opaque set survives cloud, backup normalization and JSON export']
    :({marker:['setToDoc and copy/tombstone carry schema v1',
      'identical unmarked revision upgrades instead of no-write ACK',
      'future server revision cannot be downgraded or tombstoned'],
      'bulk-local':['deleteAllSets preserves an unsupported local set before backup or writes'],
      'bulk-remote':['deleteAllSets preflights a future server set before any tombstone'],
      account:['account deletion reaches real hard-delete path for a future set'],
      export:['selected export keeps every opaque future field but omits current folder'],
      'future-intake':['future nonarray server yields schema hold and sibling save without intake crash']})[mutation];
  if(!targets)throw Error(`unknown RED mutation: ${mutation}`);
  if(skip||!targets.every(x=>failures.includes(x))){console.error('RED target stayed green or mutation skipped');process.exit(1);}
  console.log('RED ad5fe91 schema target failures reproduced');process.exit(0);
}
if(failures.length){console.error('schema browser failures:',failures.join(', '));process.exit(1);}
console.log('REV-108 schema browser: 14/14');
