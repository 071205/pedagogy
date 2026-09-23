import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

function address(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} unavailable`);
  const cut = raw.lastIndexOf(':');
  return { host: raw.slice(0, cut), port: Number(raw.slice(cut + 1)) };
}

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: process.env.GCLOUD_PROJECT || 'pedagogy-rules-test',
  firestore: { ...address('FIRESTORE_EMULATOR_HOST'), rules },
});
const set = (id, extra={}) => ({
  id, name:'B3 strict', header:'', problems:[], order:0,
  deleted:false, updatedAt:1, lineColor:'indigo', subject:'math', folderId:'', ...extra,
});
try {
  const alice=testEnv.authenticatedContext('alice').firestore();
  const bob=testEnv.authenticatedContext('bob').firestore();
  const current=doc(alice,'users','alice','sets','current');
  const legacy=doc(alice,'users','alice','sets','legacy');
  await assertFails(setDoc(current,set('current')), '구 클라이언트 신규 무 revision 거부');
  await assertFails(setDoc(doc(bob,'users','alice','sets','current'),set('current',{revision:1})), '타인 거부');
  await assertFails(setDoc(current,set('current',{revision:2})), '신규는 revision 1만');
  await assertSucceeds(setDoc(current,set('current',{revision:1})), '신규 revision 1');
  await assertFails(setDoc(current,set('current',{revision:3})), '증분 건너뛰기 거부');
  await assertFails(setDoc(current,set('current')), '승격 뒤 무 revision 거부');
  await assertSucceeds(setDoc(current,set('current',{revision:2,name:'수정'})), '정확히 +1');
  await assertSucceeds(setDoc(current,set('current',{
    revision:3,deleted:true,name:'',header:'',problems:[],
  })), 'tombstone +1');
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(),'users','alice','sets','legacy'),set('legacy'));
  });
  await assertFails(setDoc(legacy,set('legacy',{name:'구 클라이언트 변경'})), '구형 문서 무 revision 갱신 거부');
  await assertFails(setDoc(legacy,set('legacy',{revision:2})), '구형 문서 승격 건너뛰기 거부');
  await assertSucceeds(setDoc(legacy,set('legacy',{revision:1,name:'승격'})), '기존 무 revision 문서 첫 승격');
  await assertFails(setDoc(legacy,set('legacy',{revision:1,name:'stale'})), '승격 뒤 stale 거부');
  console.log('B3 strict Rules focused matrix passed (11 cases)');
} finally {
  await testEnv.cleanup();
}
