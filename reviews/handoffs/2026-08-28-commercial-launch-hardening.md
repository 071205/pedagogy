# 변경 인계 — 상용 출시 보안·권한·운영 기반

- ID: `HANDOFF-2026-003`
- 날짜: `2026-08-28`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `index | worker | server | rules | tests | docs`
- 관련 이슈: `없음`

## 변경 내용

1. AI Worker의 사용자 식별자는 SHA-256 해시로 바꾸고, Durable Object 사용량 기록은 최대
   48시간 후 alarm으로 파기한다. 계정 삭제는 Auth 삭제 전에 현재·직전 이틀의 AI 기록을
   DELETE API로 파기한다. AI 외부 호출을 시작하기 전에 quota를 확정해, 공급자 응답 장애가
   있어도 일일 비용 상한을 넘지 않게 했다. 잘못된 플랜 환경변수도 Worker 내부의 하루
   10,000회 절대 상한을 넘길 수 없다.
2. Worker는 허용 Origin·Firebase 토큰을 모두 요구하고, 요청 MIME·크기·오류 노출을
   제한한다. Firebase Admin만 발급할 수 있는 `pedagogy_plan` claim과
   `PLAN_DAILY_LIMITS_JSON`으로 유료 플랜별 AI 한도를 적용할 수 있게 했다. 화면의 플랜
   배지는 같은 서명된 claim을 표시할 뿐 권한을 결정하지 않는다.
3. Firestore 문서 모양·tombstone, Storage MIME·파일 크기·경로 깊이·파일명 길이를 Rules에서
   제한했다. App Check SDK와 공개 설정 틀은 추가했지만, Console site key와 enforcement는
   의도적으로 아직 비어 있다.
4. 결제 webhook/entitlement 경계, 저장량 과금의 서버측 집계 필요성, 개인정보·계정삭제,
   장애·비용·복구·배포 런북, 보안 신고 절차, CI와 출시 차단 검사를 추가했다. PG 계약이나
   운영자·수탁자 실정보를 추측해 넣지 않았다.
5. 더 이상 실제 진입점이 아닌 `worker/worker-single-file.js`를 제거해 Worker 구현이
   Wrangler `worker/index.js` 하나로만 유지되게 했다.

## 위험과 검토 요청

- 이 변경을 배포할 때는 **Worker → health 확인 → Firebase Rules → 정적 사이트** 순으로
  배포한다. 먼저 정적 사이트를 배포하면 새 계정 삭제의 DELETE 요청을 아직 지원하지 않는
  이전 Worker가 거절할 수 있다.
- `service-config.js`의 App Check site key, 고객지원 주소, 법률 문서 버전, 결제 포털은 현재
  빈 값이다. `npm run check:launch`가 이 상태를 실패시키는 것이 정상이며, 값을 실제 계약·콘솔
  정보로 채우고 검증하기 전 유료 공개를 하면 안 된다.
- 현재 Firebase 클라이언트 직접 쓰기로는 사용자별 총 저장량·파일 수·문제집 수를 원자적으로
  플랜 제한할 수 없다. 해당 혜택을 판매하려면 `docs/BILLING-ARCHITECTURE.md`의 backend
  집계 경계를 먼저 구현해야 한다.
- 실제 Firebase 계정 삭제, PG webhook, App Check enforcement, 운영 Rules 배포는 외부 상태를
  바꾸므로 테스트 계정·staging에서 별도 확인이 필요하다.

## 검증

- `npm run test:worker` → Durable Object 동시성·멱등성·자동 파기·계정 파기 검사 통과.
- `npm run check:static` → 상용 보안 정적 검사 통과.
- `node --check worker/index.js`, `python3 -c "import py_compile; py_compile.compile('serve.py', doraise=True)"`,
  `git diff --check` → 통과.
- `npx --yes wrangler deploy --dry-run` → Worker/Durable Object 배포 번들 컴파일 통과(실제 배포 없음).
- `regression-test.html` → `83 / 83 통과`. 새 플랜 claim 검사 문구를 고의로 틀리게 했을 때
  `1건 실패 · 82건 통과`로 실패함도 확인한 뒤 원복했다.
- Firebase Emulator 규칙 파싱은 이 컴퓨터의 JDK가 8이라 최신 `firebase-tools`가 실행을 거부했다.
  CI에는 Temurin JDK 21과 `npm run check:rules`를 추가했으므로 push 뒤 CI에서 실제 Firestore·Storage
  Emulator 기동 결과를 확인한다. 운영 Firebase에는 연결하지 않았다.
- `npm run check:launch` → 빈 외부 운영 정보와 development origin을 차단 항목으로 보고하며
  의도적으로 실패해야 한다. 실제 운영 정보가 없으므로 성공시키지 않았다.

## 다음 검토자에게

`worker/index.js`, `index.html`, `firestore.rules`, `storage.rules`, `service-config.js`,
`docs/`, `.github/workflows/verify.yml`의 diff를 함께 본다. 로그인이 필요한 흐름은 운영 계정이
아닌 테스트 Firebase 계정으로만 확인한다. 계정 삭제 검증은 새 Worker를 staging에 먼저 배포하고
AI 호출 후 실행해, Worker quota·Storage·Firestore·Auth가 모두 남지 않는지 콘솔에서 확인한다.
