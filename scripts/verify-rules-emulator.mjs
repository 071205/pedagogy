/* Firebase Emulator에서 실제 Security Rules 허용/거부를 확인한다.
 * @firebase/rules-unit-testing은 에뮬레이터에만 연결하므로 운영 Firebase 데이터나
 * 계정에는 절대 닿지 않는다. 단순 문법 파싱만 하던 이전 검사와 달리, 아래 시나리오는
 * 본인/타인/비로그인·스키마·tombstone·Storage 경로·MIME·용량을 직접 실행한다. */
import assert from "node:assert/strict";
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
  readFile(new URL("firestore.rules", root), "utf8"),
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
