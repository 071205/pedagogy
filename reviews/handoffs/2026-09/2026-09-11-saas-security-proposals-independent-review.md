# 변경 인계 — SaaS 보안 제안 독립 검토와 출시 게이트 보정

- ID: `HANDOFF-2026-115`
- 날짜: `2026-09-11`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `worker | tests | docs | security | infrastructure`
- 관련 이슈: `REV-2026-079`

## 결론

`HANDOFF-2026-114`의 네 방향 중 App Check 운영 강제와 형상·이상 징후 감시는
출시 게이트로 유효하다. 다만 WAF·DLP·App Check의 보호 범위를 현재 배치 구조보다
넓게 써서, 문서를 그대로 구현 지시서로 쓰면 안 된다. 실제 운영 콘솔 접근 없이
WAF·CSPM이 설정되지 않았다고 단정할 수도 없다. 아래의 좁힌 계약으로 재설계한 뒤
staging에서 검증해야 한다.

## 코드·배포 상태 독립 대조

### 1. Cloudflare WAF / rate limiting — 적용 대상을 나눠야 함

- 현재 정적 앱은 `https://071205.github.io/pedagogy/` 에서 GitHub Pages가 직접
  서비스하고, 브라우저가 Firebase API와 `*.workers.dev` Worker를 각각 직접 호출한다.
- `worker/wrangler.toml`에는 zone route·custom domain·WAF/rate-limit rule가 없다. 공개
  응답은 Worker가 Cloudflare에서 돌고 있음은 보여 주지만, 계정의 WAF 규칙 유무는
  증명하지 않는다.
- 따라서 현재 도메인 앞에 WAF만 켜면 Firebase 도달 전에 차단된다는 서술은
  틀렸다. 먼저 자체 도메인·프록시 경계를 설계하고, Worker API와 정적 자원 중
  무엇을 Cloudflare zone으로 보호할지 정해야 한다. Firebase 직접 API는 Rules와
  App Check가 주 경계이다.
- Worker에는 이미 허용 Origin, Firebase ID token, 8 MiB 실제 본문 상한, UID·일자별
  원자적 quota가 있다. WAF rate limit은 이 계약을 대체하지 말고 미인증 트래픽·IP
  폭주 같은 남은 위협을 대상으로 수치와 오탐 처리를 정해야 한다. SQL/NoSQL
  인젝션을 포괄 사유로 드는 것은 현재 고정된 SDK/Worker 경계의 실제 위협 설명이 아니다.

### 2. Firebase App Check — Firebase와 자체 Worker를 별도로 보호해야 함

- 저장소와 공개 배포본 `service-config.js` 모두 `appCheckSiteKey: ""`이므로
  Firestore·Storage App Check는 아직 운영 강제 상태가 아니다. 이는 이미
  `docs/COMMERCIAL-LAUNCH.md`와 `check:launch`의 명시적 출시 차단 항목이다.
- `index.html`에는 reCAPTCHA Enterprise provider 초기화 코드가 있지만 AI Worker에
  `X-Firebase-AppCheck` 토큰을 보내거나 검증하는 코드는 없다. 공개 Worker의
  preflight도 `Content-Type, Authorization`만 허용했다. Firebase Console의 enforcement만
  켜도 이 자체 백엔드는 보호되지 않으므로, Firebase 자원 강제와 Worker의
  토큰 전송·검증을 별도 단계로 작성해야 한다.
- App Check는 오용 완화 계층이지 사용자 인증이 아니며, 정상 토큰을 가진 클라이언트의
  남용까지 `원천봉쇄`한다고 보증하면 안 된다. 기존 Auth·Rules·quota를 계속 유지한다.
- 공식 근거: [App Check enforcement](https://firebase.google.com/docs/app-check/enable-enforcement),
  [custom backend 토큰 검증](https://firebase.google.com/docs/app-check/custom-resource-backend),
  [web custom resource 전송](https://firebase.google.com/docs/app-check/web/custom-resource).

### 3. PII DLP — 위험은 있으나 `정규식/형태소 마스킹`이 완성 설계가 아님

- 현재는 화면의 `개인정보나 비공개 자료를 넣지 말라`는 고지만 있고 Worker는
  12,000자 prompt와 JPEG/PNG/WebP/GIF 이미지를 Anthropic에 전송한다. 자동 탐지·거절·
  마스킹은 없다.
- 전화번호·이메일 같은 형식 값과 달리 한국인 이름, 성적, 학번, 이미지 속 문자는
  정규식이나 가벼운 형태소 분석만으로 신뢰성 있게 가릴 수 없다. 잘못 가리면 문제·문서
  의미도 변한다.
- B2B 요구사항으로 채택하려면 텍스트와 이미지를 나누고, 자동 변경보다 탐지 후
  차단/사용자 확인을 기본으로 검토하며, 오탐·미탐 허용치, OCR 처리 위치,
  로그에 원문을 남기지 않는 계약, 보존·삭제, 감사 증적, 예외 승인을 먼저 정해야
  한다. 보호 목표는 `Cloudflare에 원문이 도달하지 않음`과 `Anthropic에 도달하지
  않음`을 구분해야 한다.

### 4. CSPM / 지속 감시 — 공급자 별 범위와 증적이 필요함

- 저장소에는 Cloudflare observability 10% sampling과 일일 점검·인시던트·배포 절차가
  있지만 CSPM 설정 코드나 운영 증적은 없다. 이것은 `CSPM이 없다`는 콘솔
  사실을 확정하지는 못한다.
- Security Command Center를 선정하면 Google Cloud/Firebase 범위와 플랜별 감지
  항목을 먼저 확인한다. GitHub, Cloudflare, Anthropic의 IAM·비밀·예산·로그는
  별도 증적이 필요하다. 특정 제3자 제품은 요구사항·가격·권한·데이터 처리·
  종료 절차를 검증하기 전에 문서에서 확정하지 않는다.
- 공식 근거: [Google Cloud Security Command Center](https://cloud.google.com/security-command-center/docs/concepts-security-command-center-overview).

## 현재 운영 점검 결과

- `https://071205.github.io/pedagogy/service-config.js`: 로컬과 같이 App Check key,
  고객지원 이메일, 법률 버전, 결제 포털이 비어 있었다.
- Worker `/health`: `200 {"ok":true}`.
- 운영 Origin의 Worker preflight: `204`, 허용 헤더는 `Content-Type, Authorization`.
- 허용 Origin이어도 인증 없는 POST는 `401` `로그인이 필요합니다`.
- `npm run check:launch`: 수정 전에는 유료 플랜 상한 미설정을 누락했고,
  `REV-2026-079` 수정 후에는 기존 6개에 해당 항목을 더한 7개 출시 차단 사유를
  정확히 보고했다.
- WAF rule, Firebase Console enforcement, SCC/CSPM, 예산·알림의 실제 콘솔 상태는
  인증된 운영자 접근 없이 확인하지 않았다.

## 변경 내용

- `scripts/check-launch-readiness.mjs`: 검사 로직을 `collectLaunchBlockers()`로 분리하고
  TOML의 실제 행 대입만 유료 플랜 AI 상한으로 인정했다.
- `scripts/check-launch-readiness.test.mjs`: 주석 예시는 실패, 실제 대입은 통과시키는
  실행 형 회귀 검사를 추가했다.
- `package.json`: 위 검사를 `check:static`/`check:fast`에 연결했다.
- `REV-2026-079`: 재현·실패 주입·수정 근거를 기록하고 `resolved`로 닫았다.

## 위험과 검토 요청

- `PLAN_DAILY_LIMITS_JSON` 값의 공백·따옴표·인라인 주석과 여러 플랜 JSON을 실제 배포 전
  staging Worker에서 한 번 더 확인한다.
- App Check는 site key 배포 → metrics 관찰 → Firebase 자원 enforcement → 자체 Worker
  토큰 검증 순으로 나눠 출시하고, 테스트 계정·staging으로 실제 호출을 확인한다.
- WAF/DLP/CSPM은 구매 전에 위협 모델, 보호 대상, 성공/실패 기준, 오탐 대응,
  가격과 데이터 처리 계약을 설계 문서로 보완한다.

## 검증

- `node scripts/check-launch-readiness.test.mjs`
  - 수정 전: assertion error로 실패(빨간불 확인).
  - 수정 후: `상용 출시 게이트 설정 검사 통과`.
- `npm run check:launch`: 기대대로 종료 코드 1, 7개 출시 차단 사유 보고.
- `npm run check:icons`: `REV-2026-074` 재발 29개(그중 refs 6개)를 재현한 뒤
  좁은 정리 스크립트로 제거, 재검사 통과.
- `npm run check:fast`: 요청대로 한 번 실행, 종료 코드 0. 새 출시 게이트
  회귀를 포함한 연결 검사가 통과했다. 현재 파이썬 환경에 `lxml`이 없어 HWPX
  검사와 브라우저↔파이썬 대조의 해당 구간은 기존 규칙대로 명시적으로 건너뛰었고,
  Chromium 교차환경 검사는 CDN 차단 경고 2건과 함께 통과했다.

## 다음 검토자에게

`scripts/check-launch-readiness.mjs`, 새 회귀 검사, `package.json`, `REV-2026-079`의
재현 계약을 먼저 본다. 제안서 평가는 운영 콘솔의 실제 WAF·App Check·CSPM
설정 증적을 받은 뒤에만 `적용 완료`로 올린다. 이 검토는 상용 보안 상태를
승인하지 않았다.
