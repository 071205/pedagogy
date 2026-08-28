# 변경 인계 — 계층형 회귀·권한 검사 강화

- ID: HANDOFF-2026-007
- 날짜: 2026-08-28
- 작성자: Codex
- 상태: ready-for-review
- 영향 영역: tests, worker, server, CI, docs
- 관련 이슈: 없음

## 변경 내용

회귀 검사를 단일 83개 화면 검사에만 의존하지 않도록 여섯 층으로 나눴다.

1. 빠른 검사: Worker quota/CORS/플랜 한도/UID 해시화와 요청 순서·실패 경계, 기준 JSON 4종,
   CSP와 CI 설정을 npm run check:fast로 묶었다.
2. 브라우저 회귀: 기준 JSON 4종을 실제로 fetch해 index.html의 normSet()/normBlock()에
   통과시키는 4개 검사를 regression-test.html에 추가했다.
3. 격리 통합: integration-test.html은 다른 포트(origin)에서 실제 전체 가져오기 input
   (FileReader → JSON 파싱 → normSet → saveSets)과 iframe 새로고침 복원, buildPrintDoc()/
   fitPrintDoc()까지 검증한다. 테스트 origin의 localStorage는 끝에 원상 복구한다.
4. 인쇄 시각 회귀: Playwright 고정 Chromium에서 실제 file input 가져오기와 인쇄 DOM 생성,
   수식·글꼴 대기·오버플로 보정 뒤 첫 A4 PNG를 기준본 네 장과 pixelmatch로 비교한다.
   0.5%를 넘는 차이는 실패하고, CI는 actual/diff PNG를 artifact로 남긴다.
5. Firebase 권한: 기존 Rules 문법 파싱을 실제 Emulator allow/deny 검사로 교체했다.
   본인·타인·비로그인, Firestore 스키마/tombstone, Storage 경로/MIME/5MB 경계를 다룬다.
6. CI: npm ci와 Java 21 뒤 빠른 검사·고정 Chromium 시각 검사·실제 Rules 권한 검사를
   실행하도록 수정했다.

기준 수학 샘플은 JSON 이스케이프가 한 번 더 되어 KaTeX 수식이 틀어지던 것을 함께
바로잡았다. serve.py는 로컬 회귀 화면이 읽을 수 있는 고정 JSON 네 파일만 화이트리스트에
추가했으며, 디렉터리 전체를 열지 않는다.

## 위험과 검토 요청

Firebase 권한 테스트는 이 컴퓨터의 Java 8 때문에 실제 Emulator에서 끝까지 실행하지
못했다. CI는 Java 21을 명시 설치하므로 push/PR에서 실제 실행된다. 다음 검토자는 Java 21
환경에서 npm run check:rules를 한 번 실행해 Firestore·Storage SDK의 Emulator 호환성을
확인해 달라.

회귀 페이지가 기준 JSON을 fetch하므로, 테스트용 JSON 경로를 바꾸거나 추가하면
serve.py의 STATIC 화이트리스트와 scripts/check-fixtures.mjs를 함께 고쳐야 한다.

인쇄 시각본은 실패를 없애기 위해 덮어쓰면 안 된다. 의도된 조판 변경을 실제 PDF로 사람이
확인하고 리뷰를 받은 경우에만 `npm run update:visual-baseline`으로 갱신한다.

## 검증

- 실행한 명령 또는 수동 절차:
  - npm ci
  - npm run check:fast
  - node --check scripts/check-fixtures.mjs
  - node --check scripts/verify-rules-emulator.mjs
  - Firebase Rules test API import 확인
  - 로컬 regression-test.html 실행
  - 로컬 integration-test.html 실행
  - npm exec playwright install chromium
  - npm run test:visual
  - npm run check:rules 실행 시도
- 결과:
  - 빠른 검사 통과.
  - 브라우저 회귀 87 / 87 통과.
  - 격리 통합 검사 4 / 4 통과. 각 기준 파일은 실제 파일 input으로 저장하고, iframe 재시작 뒤
    복원과 인쇄 DOM·오버플로 보정을 확인했다.
  - 인쇄 시각 회귀 4 / 4 통과. 수학·국어 지문·이미지·긴 문항의 실제 A4 인쇄 첫 페이지를
    기준 PNG와 비교했다.
  - 수학 기준 JSON의 subject를 broken-fixture로 바꾸면 test:fixtures가 실패하는 것을 확인한
    뒤 복구했다.
  - 국어 기준 JSON의 subject를 broken-fixture로 바꾸면 브라우저 회귀가 1건 실패,
    86건 통과가 되는 것을 확인한 뒤 복구했다.
  - 수학 문항의 보이는 발문을 임시로 바꾸면 시각 차이 0.675%로, 0.5% 한도를 넘어
    test:visual이 실패하는 것을 확인한 뒤 복구했다.
  - Rules 검사 스크립트의 문법과 공식 Firebase 테스트 API import는 통과했다.
  - 실제 Emulator 실행은 Java 8 환경에서 firebase-tools가 Java 21 이상을 요구해 중단됐다.
- 아직 실행하지 못한 검증과 이유:
  - Java 21 로컬 환경의 실제 Emulator 권한 테스트. GitHub CI가 Java 21으로 대신 실행한다.
  - 실제 App Check site key/결제/AI Secret이 필요한 출시 전 외부 연동 검증.

## 다음 검토자에게

검토 대상은 package-lock.json, package.json, scripts/check-fixtures.mjs,
scripts/verify-rules-emulator.mjs, scripts/check-static.mjs, worker/worker-contract.test.mjs,
scripts/visual-regression.mjs, test-fixtures/visual-baseline/, integration-test.html,
regression-test.html, serve.py와 CI 워크플로다. 빠른 코드 변경 뒤에는 npm run check:fast,
UI 변경 뒤에는 브라우저 회귀·격리 통합 검사·인쇄 시각 회귀, Rules 변경 뒤에는
npm run check:rules를 우선 실행한다.
