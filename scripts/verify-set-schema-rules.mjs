/* REV-108 ②: run only against the local Firestore emulator. */
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {deleteDoc,doc,getDoc,setDoc} from 'firebase/firestore';

const baseline=process.env.SET_SCHEMA_RULES_BASELINE==='1';
const resourceRed=process.env.SET_SCHEMA_RULES_RED==='resource';
const requestRed=process.env.SET_SCHEMA_RULES_RED==='request';
let rules=baseline&&process.env.SET_SCHEMA_RULES_SKIP_MUTATION!=='1'
  ?execFileSync('git',['show','ad5fe91:firestore.rules'],{encoding:'utf8'})
  :await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
if(resourceRed&&process.env.SET_SCHEMA_RULES_SKIP_MUTATION!=='1'){
  const guard=/\n\s*&& \(!\('setSchemaVersion' in resource\.data\)[\s\S]*?resource\.data\.setSchemaVersion == 1\)\)/;
  if(!guard.test(rules))throw Error('resource RED anchor missing');
  rules=rules.replace(guard,'');
}
if(requestRed&&process.env.SET_SCHEMA_RULES_SKIP_MUTATION!=='1'){
  const guard=/\n\s*&& \('setSchemaVersion' in request\.resource\.data\)\n\s*&& request\.resource\.data\.setSchemaVersion is int\n\s*&& request\.resource\.data\.setSchemaVersion == 1/;
  if(!guard.test(rules))throw Error('request RED anchor missing');
  rules=rules.replace(guard,'');
}
const raw=process.env.FIRESTORE_EMULATOR_HOST;
if(!raw)throw Error('Firestore emulator address missing');
const at=raw.lastIndexOf(':');
const env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT||'pedagogy-rules-test',
  firestore:{host:raw.slice(0,at),port:Number(raw.slice(at+1)),rules}});
const shape=(id,extra={})=>({id,name:'권',header:'',problems:[],order:0,deleted:false,
  updatedAt:1,lineColor:'indigo',subject:'math',folderId:'',revision:1,...extra});
try{
  const db=env.authenticatedContext('schema-owner').firestore();
  const other=env.authenticatedContext('other').firestore();
  const ref=id=>doc(db,'users','schema-owner','sets',id);
  const seed=async(id,data)=>env.withSecurityRulesDisabled(async ctx=>
    setDoc(doc(ctx.firestore(),'users','schema-owner','sets',id),data));
  if(requestRed){
    await setDoc(ref('bad-zero'),shape('bad-zero',{setSchemaVersion:0}));
    const accepted=(await getDoc(ref('bad-zero'))).data();
    if(accepted?.setSchemaVersion!==0)throw Error('request RED did not persist invalid version 0');
    console.log('RED request guard: invalid schema 0 was really stored');
  }else if(resourceRed){
    const future=shape('future-resource',{revision:7,setSchemaVersion:2,opaque:{keep:true}});
    await seed('future-resource',future);
    await setDoc(ref('future-resource'),shape('future-resource',
      {revision:8,setSchemaVersion:1}));
    const downgraded=(await getDoc(ref('future-resource'))).data();
    if(downgraded?.setSchemaVersion!==1||downgraded?.revision!==8)
      throw Error('resource RED did not downgrade the future server document');
    console.log('RED resource guard: future server really became schema 1 revision 8');
  }else if(baseline){
    // All three old-client payloads are otherwise valid. Their success on the
    // original Rules is the exact regression; an unavailable API cannot pass.
    const old=shape('old-create');
    await assertSucceeds(setDoc(ref('old-create'),old),'old client create was accepted');
    await assertSucceeds(setDoc(ref('old-create'),{...old,revision:2,name:'groupOf lost'}),
      'old client next revision was accepted');
    await assertSucceeds(setDoc(ref('old-create'),{...old,revision:3,deleted:true,
      name:'',header:'',problems:[]}), 'old client tombstone was accepted');
    console.log('RED ad5fe91: markerless create, next revision and tombstone accepted');
  }else{
    const supported=shape('supported',{setSchemaVersion:1});
    await assertSucceeds(setDoc(ref('supported'),supported));
    await assertFails(setDoc(ref('missing-create'),shape('missing-create')));
    await assertFails(setDoc(ref('future-create'),shape('future-create',{setSchemaVersion:2})));
    await assertFails(setDoc(ref('bad-type'),shape('bad-type',{setSchemaVersion:'1'})));
    await assertFails(setDoc(ref('bad-zero'),shape('bad-zero',{setSchemaVersion:0})));
    await assertFails(setDoc(ref('bad-fraction'),shape('bad-fraction',{setSchemaVersion:1.5})));
    await assertFails(setDoc(ref('bad-boolean'),shape('bad-boolean',{setSchemaVersion:true})));
    await assertFails(setDoc(ref('supported'),shape('supported',{revision:2,name:'groupOf lost'})));
    await assertFails(setDoc(ref('supported'),shape('supported',{revision:2,deleted:true,
      name:'',header:'',problems:[]})));
    await assertSucceeds(setDoc(ref('supported'),{...supported,revision:2,name:'새 편집기'}));
    await assertSucceeds(setDoc(ref('supported'),{...supported,revision:3,deleted:true,
      name:'',header:'',problems:[]}));
    await seed('legacy',shape('legacy',{revision:4}));
    await assertSucceeds(getDoc(ref('legacy')));
    await assertFails(setDoc(ref('legacy'),shape('legacy',{revision:5,name:'구형 손실'})));
    await assertSucceeds(setDoc(ref('legacy'),shape('legacy',{revision:5,setSchemaVersion:1,
      name:'검토 후 승격'})));
    await seed('future',shape('future',{revision:7,setSchemaVersion:2,futureField:'opaque'}));
    await assertSucceeds(getDoc(ref('future')));
    await assertFails(setDoc(ref('future'),shape('future',{revision:8,setSchemaVersion:1})));
    await assertFails(setDoc(ref('future'),shape('future',{revision:8,setSchemaVersion:1,
      deleted:true,name:'',header:'',problems:[]})));
    await assertFails(deleteDoc(doc(other,'users','schema-owner','sets','future')));
    await assertSucceeds(deleteDoc(ref('future')));
    if((await getDoc(ref('future'))).exists())throw Error('owner hard delete did not remove future document');
    await seed('malformed',shape('malformed',{revision:7,setSchemaVersion:null}));
    await assertFails(setDoc(ref('malformed'),shape('malformed',{revision:8,setSchemaVersion:1})));
    const unrevisioned=shape('unrevisioned');delete unrevisioned.revision;
    await seed('unrevisioned',unrevisioned);
    await assertSucceeds(setDoc(ref('unrevisioned'),shape('unrevisioned',{revision:1,setSchemaVersion:1})));
    await assertFails(setDoc(doc(other,'users','schema-owner','sets','supported'),supported));
    console.log('REV-108 schema Rules: supported writes, legacy upgrade and future preservation passed');
  }
}finally{await env.cleanup();}
