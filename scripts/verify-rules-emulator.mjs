/* Firebase Emulator에서 실제 Security Rules 허용/거부를 확인한다.
 * @firebase/rules-unit-testing은 에뮬레이터에만 연결하므로 운영 Firebase 데이터나
 * 계정에는 절대 닿지 않는다. 단순 문법 파싱만 하던 이전 검사와 달리, 아래 시나리오는
 * 본인/타인/비로그인·스키마·tombstone·Storage 경로·MIME·용량을 직접 실행한다. */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

const root = new URL("../", import.meta.url);
const [firestoreRules, storageRules] = await Promise.all([
  process.env.REVIEW_RED === "1" ? execFileSync("git",["show","31da3eb:firestore.rules"],{encoding:"utf8"}) : readFile(new URL("firestore.rules", root), "utf8"),
  readFile(new URL("storage.rules", root), "utf8"),
]);

function emulatorAddress(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(name + "가 설정되지 않았습니다");
  const index = raw.lastIndexOf(":");
  if (index < 1) throw new Error(name + " 형식이 host:port가 아닙니다: " + raw);
  const host = raw.slice(0, index);
  const port = Number(raw.slice(index + 1));
  if (!Number.isInteger(port) || port <= 0) throw new Error(name + " 포트가 올바르지 않습니다: " + raw);
  return { host, port };
}

const projectId = process.env.GCLOUD_PROJECT || "pedagogy-rules-test";
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { ...emulatorAddress("FIRESTORE_EMULATOR_HOST"), rules: firestoreRules },
  storage: { ...emulatorAddress("FIREBASE_STORAGE_EMULATOR_HOST"), rules: storageRules },
});

const validSet = (id, overrides = {}) => ({
  id,
  name: "테스트 문제집",
  header: "기준",
  problems: [],
  order: 0,
  deleted: false,
  updatedAt: 1,
  lineColor: "indigo",
  subject: "math",
  folderId: "",
  ...overrides,
});
const png = (size = 32) => new Blob([new Uint8Array(size)], { type: "image/png" });

try {
  const alice = testEnv.authenticatedContext("alice");
  const bob = testEnv.authenticatedContext("bob");
  const guest = testEnv.unauthenticatedContext();
  const aliceDb = alice.firestore();
  const bobDb = bob.firestore();
  const guestDb = guest.firestore();

  // Firestore: 계정 문서와 문제집 문서의 본인 권한·필드 화이트리스트를 확인한다.
  await assertFails(getDoc(doc(guestDb, "users", "alice")));
  await assertFails(getDoc(doc(bobDb, "users", "alice")));
  await assertSucceeds(setDoc(doc(aliceDb, "users", "alice"), { migratedAt: 1 }));
  await assertFails(setDoc(doc(aliceDb, "users", "alice"), { migratedAt: 2, sets: [] }),
    "구형 sets 배열을 다시 쓰면 안 된다");

  await assertSucceeds(setDoc(doc(aliceDb, "users", "alice", "sets", "set-1"), validSet("set-1")));
  await assertFails(getDoc(doc(bobDb, "users", "alice", "sets", "set-1")));
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "sets", "wrong-id"), validSet("set-1")),
    "문서 ID와 내부 ID가 다르면 병합 안전성이 깨진다");
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "sets", "extra"),
    { ...validSet("extra"), unexpected: true }), "허용되지 않은 필드는 거부해야 한다");
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "sets", "bad-tombstone"),
    validSet("bad-tombstone", { deleted: true, name: "남은 내용" })),
    "tombstone에는 빈 내용만 허용해야 한다");
  await assertSucceeds(setDoc(doc(aliceDb, "users", "alice", "sets", "tombstone"),
    validSet("tombstone", { deleted: true, name: "", header: "", problems: [] })));
  await assertSucceeds(deleteDoc(doc(aliceDb, "users", "alice", "sets", "set-1")));

  // ── R4/B3 revision 전환 Rules ──
  // 구 클라이언트끼리는 전환 기간에만 계속 쓰되, revision으로 승격한 문서는 절대 내려가지 않는다.
  const transition=doc(aliceDb,"users","alice","sets","revision-transition");
  await assertSucceeds(setDoc(transition,validSet("revision-transition")),"구 create 호환");
  await assertSucceeds(setDoc(transition,validSet("revision-transition",{name:"구 update"})),"구 update 호환");
  await assertSucceeds(setDoc(transition,validSet("revision-transition",{name:"승격",revision:1})),
    "무 revision 문서는 revision 1로 한 번만 승격");
  await assertFails(setDoc(transition,validSet("revision-transition",{name:"downgrade"})),
    "승격 뒤 무 revision으로 되돌릴 수 없어야 한다");
  await assertFails(setDoc(transition,validSet("revision-transition",{name:"skip",revision:3})),
    "revision을 건너뛸 수 없어야 한다");
  await assertSucceeds(setDoc(transition,validSet("revision-transition",{name:"정상 +1",revision:2})));
  await assertSucceeds(setDoc(transition,validSet("revision-transition",{
    name:"",header:"",problems:[],deleted:true,revision:3
  })),"tombstone도 정확히 +1");

  await assertSucceeds(setDoc(doc(aliceDb,"users","alice","sets","revision-create"),
    validSet("revision-create",{revision:1})),"새 클라이언트 create는 revision 1");
  await assertFails(setDoc(doc(aliceDb,"users","alice","sets","bad-revision-create"),
    validSet("bad-revision-create",{revision:2})),"create revision 2는 거부");
  await assertFails(setDoc(doc(aliceDb,"users","alice","sets","float-revision"),
    validSet("float-revision",{revision:1.5})),"revision은 양의 정수여야 한다");

  // ⚠️ **규칙의 상한과 앱의 상한이 어긋나면 그 길이의 제목은 영영 저장되지 않는다.**
  //    앱은 200자까지 받아 두는데 규칙이 160자에서 끊고 있었다(외부 검토가 짚었다).
  await assertSucceeds(setDoc(doc(aliceDb, "users", "alice", "sets", "name-160"),
    validSet("name-160", { name: "가".repeat(160) })));
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "sets", "name-161"),
    validSet("name-161", { name: "가".repeat(161) })),
    "규칙의 이름 상한(160)을 넘으면 거부돼야 한다 — 앱도 같은 값으로 잘라야 한다");

  // ── 폴더 (B단계) ──
  // ⚠️ 규칙과 앱의 화이트리스트는 **함께** 넓혀야 한다. 한쪽만 넓히면 저장이 통째로
  //    '권한 오류' 가 된다 — 그래서 folderId 가 실제로 통과하는지부터 본다.
  await assertSucceeds(setDoc(doc(aliceDb, "users", "alice", "sets", "in-folder"),
    validSet("in-folder", { folderId: "f-abc" })));
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "sets", "long-folder"),
    validSet("long-folder", { folderId: "f".repeat(61) })),
    "folderId 는 60자를 넘을 수 없어야 한다");
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "sets", "bad-folder"),
    validSet("bad-folder", { folderId: 5 })),
    "folderId 는 문자열이어야 한다");

  // A-stage and pre-folder clients must still save and delete under B-stage Rules.
  const oldSet=validSet("legacy-no-folder"); delete oldSet.folderId;
  await assertSucceeds(setDoc(doc(aliceDb,"users","alice","sets","legacy-no-folder"),oldSet));
  await assertSucceeds(setDoc(doc(aliceDb,"users","alice","sets","legacy-no-folder"),
    {...oldSet,deleted:true,name:"",header:"",problems:[]}));

  // ── 모의고사 문서 ── 문제집과 같은 계약(id 일치 · 화이트리스트 · tombstone).
  const validMock = (id, over = {}) => ({
    id, name: "6월 대비", round: "6월 대비", elective: "미적분",
    problems: [{ id: "p1" }], deleted: false, createdAt: 1, updatedAt: 1, ...over });
  const mock = (db, id, who = "alice") => doc(db, "users", who, "mocks", id);
  await assertSucceeds(setDoc(mock(aliceDb, "mock-1"), validMock("mock-1")));
  await assertSucceeds(getDoc(mock(aliceDb, "mock-1")));
  await assertFails(getDoc(mock(bobDb, "mock-1")), "남의 모의고사를 읽을 수 없어야 한다");
  await assertFails(setDoc(mock(bobDb, "mock-2"), validMock("mock-2")), "남의 모의고사를 쓸 수 없어야 한다");
  await assertFails(setDoc(mock(guestDb, "mock-3"), validMock("mock-3")), "로그인 없이 쓸 수 없어야 한다");
  await assertFails(setDoc(mock(aliceDb, "wrong-id"), validMock("mock-1")),
    "문서 id 와 내부 id 가 어긋나면 병합이 꼬인다");
  await assertFails(setDoc(mock(aliceDb, "extra"), validMock("extra", { nickname: "x" })),
    "모르는 필드는 거부돼야 한다");
  await assertFails(setDoc(mock(aliceDb, "many"),
    validMock("many", { problems: Array.from({ length: 61 }, (_, i) => ({ id: "p" + i })) })),
    "편집기 슬롯 상한(60)을 넘을 수 없어야 한다");
  await assertFails(setDoc(mock(aliceDb, "bad-tombstone"),
    validMock("bad-tombstone", { deleted: true })), "내용이 남은 tombstone 은 거부돼야 한다");
  await assertSucceeds(setDoc(mock(aliceDb, "tombstone"),
    validMock("tombstone", { deleted: true, name: "", round: "", problems: [] })));
  await assertSucceeds(deleteDoc(mock(aliceDb, "mock-1")));   // 계정 삭제 경로

  // 폴더 **이름 목록**은 별도 문서 하나다. 문제집에 이름을 박으면 이름 하나 바꿀 때
  // 문제집을 전부 다시 써야 한다.
  const prefs = (db, who = "alice") => doc(db, "users", who, "prefs", "library");
  const validPrefs = (over = {}) =>
    ({ folders: [{ id: "f-abc", name: "모의고사", order: 0 }], folderTombstones: {}, updatedAt: 1, ...over });
  await assertSucceeds(setDoc(prefs(aliceDb), validPrefs()));
  await assertSucceeds(getDoc(prefs(aliceDb)));
  await assertFails(getDoc(prefs(bobDb)), "남의 폴더 설정을 읽을 수 없어야 한다");
  await assertFails(setDoc(prefs(bobDb), validPrefs()), "남의 폴더 설정을 쓸 수 없어야 한다");
  await assertFails(setDoc(prefs(guestDb), validPrefs()), "로그인 없이 폴더 설정을 쓸 수 없어야 한다");
  await assertFails(setDoc(prefs(aliceDb), validPrefs({ nickname: "x" })),
    "모르는 필드는 거부돼야 한다");
  await assertFails(setDoc(prefs(aliceDb),
    validPrefs({ folders: Array.from({ length: 201 }, (_, i) => ({ id: "f" + i, name: "x", order: i })) })),
    "폴더 200개를 넘을 수 없어야 한다");
  await assertFails(setDoc(prefs(aliceDb), validPrefs({ folders: "많음" })),
    "folders 는 목록이어야 한다");
  // ⚠️ `prefs/{아무거나}` 로 열면 로그인 사용자가 임의 문서를 무제한 만들 수 있다.
  await assertFails(setDoc(doc(aliceDb, "users", "alice", "prefs", "other"), validPrefs()),
    "prefs 아래 다른 문서는 만들 수 없어야 한다");
  await assertSucceeds(deleteDoc(prefs(aliceDb)));

  // Storage: 실제 앱의 한 단계 이미지 경로, MIME·용량·소유자 제한을 확인한다.
  const aliceStorage = alice.storage();
  const bobStorage = bob.storage();
  const guestStorage = guest.storage();
  const ownerImage = ref(aliceStorage, "users/alice/images/ok.png");
  await assertSucceeds(uploadBytes(ownerImage, png()));
  await assertSucceeds(getBytes(ownerImage, 1024));
  await assertFails(getBytes(ref(bobStorage, "users/alice/images/ok.png"), 1024));
  await assertFails(getBytes(ref(guestStorage, "users/alice/images/ok.png"), 1024));
  await assertFails(uploadBytes(ref(bobStorage, "users/alice/images/other.png"), png()));
  await assertFails(uploadBytes(ref(aliceStorage, "users/alice/images/vector.svg"),
    new Blob(["<svg/>"], { type: "image/svg+xml" })));
  await assertFails(uploadBytes(ref(aliceStorage, "users/alice/images/nested/bad.png"), png()));
  await assertFails(uploadBytes(ref(aliceStorage, "users/alice/images/too-large.png"),
    png(5 * 1024 * 1024)), "정확히 5MB 파일은 '< 5MB' 규칙에서 거부돼야 한다");
  await assertSucceeds(deleteObject(ownerImage));

  console.log("Firebase Rules authorization tests passed");
} finally {
  await testEnv.cleanup();
}
