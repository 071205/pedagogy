// Execute product functions against delayed/failing storage boundaries. No live account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  let start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  if (src.slice(start - 6, start) === 'async ') start -= 6;
  return src.slice(start, src.indexOf('\n}', start) + 2);
}
function context(code) {
  const c = vm.createContext({ console: { error() {}, warn() {} }, TextEncoder,
    setTimeout: () => 0, clearTimeout() {} });
  vm.runInContext(code, c);
  return c;
}

test('mock acknowledgement uses the sent document, including nested data', async () => {
  const c = context(`
    let currentUser={uid:'A'},wiping=false,mockCloudQueue=Promise.resolve(),mockCloudWarned=false;
    const mocks=[{id:'m',name:'before',round:'before',elective:'미적분',
      problems:[{text:'before'}],createdAt:1,updatedAt:2}];
    const mockCloudSynced=new Map(); let release,sent=[],retries=0;
    const gate=new Promise(r=>release=r),mockCloudReady=()=>true;
    const sessionContext=()=>({uid:'A'}),sessionMatches=()=>true;
    const CLOUD_DOC_MAX=900*1024,MOCKS_COL=()=>({doc:id=>id});
    const fbDb={batch:()=>({set:(id,doc)=>sent.push(doc),commit:()=>gate})};
    const toast=()=>{},mockCloudWarnOnce=()=>{},scheduleMockCloud=()=>{retries++};
  `);
  for (const name of ['mockToDoc', 'mockJSON', 'docBytes', 'flushMocksToCloud']) vm.runInContext(fn(name), c);
  const pending = vm.runInContext('flushMocksToCloud()', c);
  // The serial queue takes two microtasks before it captures the outgoing document.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(vm.runInContext('sent.length', c), 1);
  vm.runInContext("mocks[0].name='after';mocks[0].problems[0].text='after';release()", c);
  await pending;
  assert.equal(vm.runInContext('sent[0].problems[0].text', c), 'before', 'transport snapshot must not be live');
  assert.equal(vm.runInContext('mockCloudSynced.get("m")===mockJSON(mocks[0])', c), false,
    'an unsent edit must remain dirty');
  assert.equal(vm.runInContext('retries', c), 1, 'schedule the remaining revision');
});

for (const failedDoc of ['library', 'consent']) test(`account survives failed ${failedDoc} deletion`, async () => {
  const c = context(`
    let deleted=false,wiping=false,saveTimer=0,localTimer=0,mockCloudTimer=0,setsUnsub=null,mocksUnsub=null;
    const currentUser={uid:'A',reauthenticateWithPopup:async()=>{},delete:async()=>{deleted=true}},fbReady=true;
    const accountLocalKeys=()=>({}),dmSetBusy=()=>{},firebase={auth:{GoogleAuthProvider:function(){}}};
    const wipeStorageImages=async()=>({listed:true,failed:0}),storageCleanupComplete=()=>true;
    const cloudSetDocIds=async()=>[],wipeCloudSets=async()=>{},wipeCloudMocks=async()=>{};
    const PREFS_DOC=()=>({delete:async()=>{${failedDoc === 'library' ? "throw Error('denied')" : ''}}});
    const fbDb={collection:()=>({doc:()=>({delete:async()=>{},collection:()=>({doc:()=>({delete:async()=>{
      ${failedDoc === 'consent' ? "throw Error('denied')" : ''}
    }})})})})};
    const localStorage={removeItem(){}},consentKey=()=>'',clearLocalKeys=()=>{},mockLocalKeys=()=>({});
    let mocks=[],mocksLoaded=false,mockOpenId='',localDirty=false,sets=[],localStamps={},lastQIdBySet={};
    let currentSetId=null,currentQId=null,undoStack=[],redoStack=[];
    const mockCloudSynced=new Map(),mockDeletedIds=new Map(),pendingLocalByOwner=new Map();
    const cloudSynced=new Map(),deletedIds=new Map();
  `);
  vm.runInContext(fn('deleteAccountEverything'), c);
  await assert.rejects(vm.runInContext('deleteAccountEverything()', c));
  assert.equal(vm.runInContext('deleted', c), false, 'Auth must remain usable for retry');
  assert.equal(vm.runInContext('wiping', c), false);
});

test('account deletion stops before Auth deletion when AttemptLedger purge fails', async () => {
  const c = context(`
    const steps=[];
    let wiping=false,saveTimer=0,localTimer=0,mockCloudTimer=0,setsUnsub=null,mocksUnsub=null;
    const currentUser={uid:'A',reauthenticateWithPopup:async()=>steps.push('reauth'),
      delete:async()=>steps.push('auth-delete')},fbReady=true;
    const accountLocalKeys=()=>({}),dmSetBusy=()=>{},firebase={auth:{GoogleAuthProvider:function(){}}};
    const wipeStorageImages=async()=>({listed:true,failed:0}),storageCleanupComplete=()=>true;
    const cloudSetDocIds=async()=>[],wipeCloudSets=async()=>steps.push('sets'),
      wipeCloudMocks=async()=>steps.push('mocks');
    const PREFS_DOC=()=>({delete:async()=>steps.push('prefs')});
    const fbDb={collection:()=>({doc:()=>({delete:async()=>steps.push('user-doc'),
      collection:()=>({doc:()=>({delete:async()=>steps.push('consent')})})})})};
    const localStorage={removeItem(){}},consentKey=()=>'';
    const purgeAttemptLedgerBeforeAccountDelete=async()=>{steps.push('ledger');throw Error('unavailable')};
  `);
  vm.runInContext(fn('deleteAccountEverything'), c);
  await assert.rejects(vm.runInContext('deleteAccountEverything()', c), /unavailable/);
  assert.equal(vm.runInContext('steps.join(",")', c),
    'reauth,sets,mocks,prefs,consent,user-doc,ledger');
  assert.equal(vm.runInContext('wiping', c), false);
});

test('account ledger purge uses a refreshed token and rejects server failure', async () => {
  const c = context(`
    const AI_PROXY_URL='https://worker.test';
    const user={getIdToken:async(force)=>{if(!force)throw Error('stale token');return 'fresh-fixture'}};
    const getAiAppCheckToken=async()=>'';
    const calls=[];
    let ok=false;
    const fetch=async(url,options)=>{calls.push({url,method:options.method,
      authorization:options.headers.Authorization});return {ok};};
  `);
  vm.runInContext(fn('purgeAttemptLedgerBeforeAccountDelete'), c);
  await assert.rejects(vm.runInContext('purgeAttemptLedgerBeforeAccountDelete(user)', c));
  assert.equal(vm.runInContext('calls[0].url', c), 'https://worker.test/account/ledger');
  assert.equal(vm.runInContext('calls[0].method', c), 'DELETE');
  assert.equal(vm.runInContext('calls[0].authorization', c), 'Bearer fresh-fixture');
  vm.runInContext('ok=true', c);
  await vm.runInContext('purgeAttemptLedgerBeforeAccountDelete(user)', c);
});

test('failed mock local save retains an owner-scoped recovery and close warning', () => {
  const c = context(`
    let currentUser=null,localDirty=false,wiping=false,sets=[],mocks=[{id:'unsaved'}],mockWriteWarned=false;
    const pendingLocalByOwner=new Map(),mockCloudSynced=new Map();
    const mockOwner=()=> 'guest',toast=()=>{},scheduleMockCloud=()=>{},mockCloudReady=()=>false;
    let broken=true; const MockStore={keysFor:o=>({list:'mocks:'+o}),
      writeMocks:()=>({ok:!broken})};
  `);
  vm.runInContext(fn('persistMocks') + '\n' + fn('hasUnsavedCloudWork'), c);
  assert.equal(vm.runInContext('persistMocks()', c), false);
  assert.equal(vm.runInContext('hasUnsavedCloudWork()', c), true);
  assert.equal(vm.runInContext("pendingLocalByOwner.get('mocks:guest')", c), '[{"id":"unsaved"}]');
  assert.equal(vm.runInContext('broken=false;persistMocks()', c), true);
  assert.equal(vm.runInContext('hasUnsavedCloudWork()', c), false);
});
