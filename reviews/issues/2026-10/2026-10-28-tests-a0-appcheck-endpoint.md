# A0 App Check 허용 경로와 고정 SDK 요청 경로 불일치

- ID: `REV-2026-156`
- 날짜: `2026-10-28`
- 보고자: `독립 Codex 검토 · 구현 Codex 독립 재현`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-204`

## 요약과 영향

로컬 A0 guard가 App Check 실제 SDK 요청을 차단한다. 초기화만 통과한 것으로 실제 token 발급 가능성을 확인할 수 없다. production 영향은 없다.

## 재현 절차

1. 고정 gstatic SDK10.12.0 `firebase-app-check-compat.js`의 `exchangeRecaptchaEnterpriseToken` 구성 코드를 확인한다.
2. 정상 admission 후 SDK의 projectId/apps/appId:exchangeRecaptchaEnterpriseToken?key 주소로 POST fetch/XHR을 시도한다. 실제 전송 대신 fixture spy로 경계만 확인한다.
3. `A0_FOCUS=appcheck node scripts/check-backend-staging.mjs` 수정 전 exit1, 정상 주소 양성 단언 실패.

## 기대 결과 / 실제 결과

- 기대: 고정 staging projectId/appId/action/key/POST만 정상 통로에 도달한다.
- 실제: guard는 projectNumber/apps/appId/ prefix였고 실제 SDK의 content-firebaseappcheck 호스트도 runtime/CSP에서 누락되어 정상 주소를 거절한다.

## 근거

- [고정 SDK](https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check-compat.js), SHA256 `3897630a79b188ddb4e69005057c63dae211a052a5887262d9f3e3d2166e0a19`.
- `scripts/backend-staging-runtime.mjs`의 allows, `scripts/check-backend-staging.mjs`의 appCheckBoundary.
- 실제 reCAPTCHA/token 발급·Google 로그인·원격 쓰기 없음.

## 처리 기록

- `2026-10-28` — 독립 Codex VM 재현 후 구현 Codex도 고정 SDK 원문과 실제 브라우저 fixture 양성 단언 실패로 독립 재현. 정확한 projectId/appId/action/key/POST로 제한하고 정상/음성 및 두 고장 주입 검사 추가. 재검증 중.

- `2026-10-28` — root Codex: SDK URL의 C 상수까지 추적해 실제 호스트 `content-firebaseappcheck.googleapis.com`을 추가 확인했다. 처음에는 검토자·구현자 모두 path만 대조해 호스트를 놓쳤으며, 검토자는 최초 통과 판정을 철회했다. 실제 content-host 양성 실패와 runtime만 수정한 뒤 native-fetch CSP 양성 실패를 각각 재현했다. 최종 runtime은 정확한 host/projectId/appId/action/key/POST만 허용하고, index/document CSP도 해당 host를 허용한다.
- `2026-10-28` — root Codex: `npm run test:backend-staging` 최종 exit0, artifact RED14/runtime RED14. native fetch는 fixture spy 이전 원래 함수를 캡처하고 SDK exact endpoint+a0control=1/POST에만 로컬 JSON+CORS 응답을 제공한다. CSP host 제거/정상 경로 거절/앱 바인딩 제거가 각각 목표 실패로 검출됨. 원격 token 발급은 없으며 독립 검토자의 최종 정정 판정은 HANDOFF204에 기록한다.
