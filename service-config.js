/* PEDAGOGY 공개 런타임 설정
 *
 * GitHub Pages가 이 파일을 브라우저에 전달하므로 공개값만 둔다. App Check site key는
 * 공개되어도 안전하지만, PG secret·Anthropic key·Firebase 서비스 계정 키는 절대 넣지 않는다.
 *
 * 상용 출시 전 Firebase App Check에서 발급한 reCAPTCHA Enterprise site key를 넣고,
 * Firebase Console에서 Firestore·Storage·Authentication의 검증 비율을 먼저 관찰한 뒤
 * enforcement를 켠다. 빈 값인 현재 상태는 의도적으로 check:launch에서 실패한다.
 */
window.PEDAGOGY_PUBLIC_CONFIG = Object.freeze({
  // 1 = folder schema release; set to 0 before deploying against pre-folder Rules.
  libraryCloudSchema: 1,
  /* 모의고사 클라우드 동기화. 0 = 이 기기에만 저장 · 1 = 계정 동기화.
   * **2026-09-09 에 mocks 규칙을 실제로 배포한 뒤 1 로 올렸다**
   * (`firebase deploy --only firestore:rules --project pedagogy-huryul` → Deploy complete).
   * ⚠️ **구형 Rules 를 쓰는 배포에 코드를 올릴 때는 0 으로 내릴 것** — 그 규칙에는
   *    `users/{uid}/mocks` 가 없어 로그인 사용자의 모의고사 저장이 전부 '권한 오류' 가 된다.
   * 확인할 것: 로그인 → 모의고사 만들기 → 다른 기기에서 보이는지 → 삭제가 다른
   * 기기에서도 사라지는지 → 계정 삭제 뒤 `users/{uid}/mocks` 가 비었는지. */
  mockCloudSchema: 1,
  appCheckSiteKey: "",
  supportEmail: "",
  legalVersion: "",
  billingPortalUrl: "",
});
