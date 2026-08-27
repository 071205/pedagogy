/* Firebase Emulator가 실제로 Firestore·Storage rules를 읽고 시작한 뒤에만 실행된다.
 * 여기서는 운영 Firebase 프로젝트에 연결하지 않는다. 규칙별 allow/deny 시나리오는
 * 별도 rules-unit-testing 스위트로 늘릴 수 있지만, 이 최소 게이트만으로도 배포 전
 * 문법·경로 오류와 Storage Emulator 누락을 막는다. */
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Firestore Emulator가 시작되지 않았습니다");
}
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error("Storage Emulator가 시작되지 않았습니다");
}
console.log("Firebase rules parsed by Firestore and Storage Emulators");
