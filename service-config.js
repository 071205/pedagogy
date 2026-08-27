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
  appCheckSiteKey: "",
  supportEmail: "",
  legalVersion: "",
  billingPortalUrl: "",
});
