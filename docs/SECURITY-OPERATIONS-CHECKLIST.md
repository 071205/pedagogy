# 출시 보안 운영 증적 체크리스트

2026-09-11 기준 **모든 운영 항목은 미확인**이다. 로컬 코드 검사 통과와 구분한다.
[확정 설계](SECURITY-ARCHITECTURE.md)를 기준으로, 완료 시 각 항목에 담당자·확인 시각·환경·
리소스 ID·설정 export/스크린샷의 비공개 위치·실험 결과를 연결한다. 토큰·키·사용자 원문은
이 문서나 공개 저장소에 붙이지 않는다. 코드 후속 구현도 아래 전환의 선행 조건이다.

## A. 저장소와 배포 경계 — 출시 차단

⚠️ **현재 상태(2026-09-13): 저장소는 공개, Pages 는 `main`/루트에서 서비스 중이다.**
그 전에 비공개로 바뀌어 있었고 **그 때문에 사이트가 404 였다** — 무료 플랜은 비공개 저장소에
Pages 를 붙이지 못하고, 전환과 함께 Pages 설정 자체가 지워졌다. 공개로 되돌리고 Pages 를
다시 만들어 복구했다. **아래 순서를 지키지 않으면 같은 일이 반복된다** — 대체 호스트가
살아 있는 것을 확인한 *다음에* 저장소를 비공개로 옮긴다.

- [ ] GitHub 보호 설정·배포 주체 확정. 2026-10-23 API 조회에서 visibility는 public,
  Pages는 legacy `main`/루트·custom domain 없음, rulesets는 빈 목록이었다. PR26 병합
  `ceec8a3`의 Verify와 Pages built를 확인했다. 보호 규칙·독립 승인자·배포 권한 분리는
  아직 완료로 표시하지 않으며 원격 설정은 변경하지 않았다.
- [ ] private source 저장소와 접근자 확정, 원격·CI 연결 전환. 기존 공개 이력/clone은 회수
  불가함을 기록. 노출된 실제 secret은 전체 이력 scanner 결과에 따라 폐기·교체한다.
- [ ] 상용 호스트를 Workers Static Assets로 준비. assets root는 `dist/public`만 지정.
  빌드 성공한 동일 산출물을 승격하고 manifest 해시를 배포 기록과 대조한다. 공개 sourcemap,
  `.git`, Worker, reviews, tests URL이 실서비스에서도 404인지 확인한다.
  R7 로컬 준비에서는 별도 `wrangler.static.staging.toml`과 생성 `_headers`를 검증한다.
  `npm run test:static-host`는 fresh build→manifest 대조 후 127.0.0.1 Wrangler에서
  root/HTML 별칭·404·CSP/framing·같은 출처 iframe을 확인한다. 새 원격 호스트의
  생성·승격·도메인·실응답 확인과 구분한다.
- [ ] 정적 자산/AI API의 production·staging 도메인·Worker·Firebase·Anthropic key 분리.
  staging은 실제 운영 사용자 자료를 읽지 못하도록 별도 프로젝트를 사용한다.
- [ ] 도메인 이전 전에 기존 origin의 localStorage/IndexedDB 자료를 JSON으로 export할 경로를
  제공하고 새 origin import를 테스트한다. origin 변경은 로컬 데이터를 자동 이동하지 않는다.
  Firebase 승인 도메인·Auth redirect·Storage CORS·Worker Origin·CSP·App Check 도메인을 함께 점검한다.

  | 기존 origin 상태 | 현재 사용자 JSON의 범위 | 이전 판단 |
  | --- | --- | --- |
  | 문제집 본문 `PM_SETS_V7:<owner>` 및 로그인 Firestore 문제집 (`index.html:3041`, `:3865`) | `:6757` 전체 내보내기, `:6770` 가져오기는 새 ID의 문제집을 추가한다 | 서버 확정본은 새 origin 로그인에서 읽을 수 있으나 guest·미확정 로컬본과 원래 ID의 연속성은 자동 보장하지 않는다 |
  | 모의고사 `PM_MOCK_SETS_V1:<owner>` (`mock-library-store.js:133`) | `index.html:7300`, `:7427`의 개별 JSON은 새 ID 사본으로 가져온다 | 미저장 `MOCK_DRAFT_V1`(`mock-exam-editor.html:2388`)과 정렬·마지막 선택은 별도 |
  | 원문·작업 `PM_INTAKE_V1` v1의 `owners` store (`pedagogy-intake.js:10-45`) | 문제집 JSON의 `intake.sources`는 출처 ID/쪽 표시만 남긴다 | 같은 owner 레코드의 Blob·jobs/구성 초안·adoptions 고정 ID·links 권한·outbox(`pedagogy-intake-sw.js:5-50`)는 미포함. 파일 재연결은 명시 확인해야 한다 |
  | 충돌·복구·설정 (`index.html:3316`, `:3496`, `:4839`, `:5444`) | 일반 문제집 JSON에 없음 | `PM_BACKUP`, `PM_SET_SYNC_META_V1`, `PM_SET_CONFLICTS_V1` snapshot, 폴더/선호는 별도. 보류·미ACK 초안을 서버본과 혼동하지 않는다 |
  | 문서 AI 초안 `PEDAGOGY_DOCUMENT_BETA` (`document-editor.html:302`) | 문제집/모의고사 JSON에 없음 | 새 origin에 자동 이관되지 않는다 |

  기존 origin을 유지하며 각 사용자가 JSON 사본을 내보내고 새 origin에서 명시 가져오기·원문
  재연결을 하는 제한적 이전 안내는 가능하다. 이 방식은 작업 재개·연결 권한·충돌 snapshot의
  무손실 이전을 뜻하지 않는다. 구 origin과 새 origin의 동시 편집/구버전 탭을 통제할 계약도
  필요하다. 전체 이관은 [U0 계약 §5](PRODUCT-UX-U0-CONTRACT.md)의 owner·삭제 세대·
  sourceId/권 연결·고정 채택 ID를 검토하는 별도 저장 설계(high 담당) 후 구현/검증한다.
  이 설계와 실계정 export/import 증거 전에는 Pages를 안내/중지하거나 저장소를 private로
  바꾸지 않는다.
- [ ] 새 호스트 정상 확인 후 기존 Pages는 이전 안내로 전환. 앱과 모든 공개 이력을 동시에
  감출 수 있다고 약속하지 않는다. 캐시·구버전 탭 대응 및 지원 종료 시점을 공지한다.

### R7 guest 미리보기 — 운영 이전과 구별

- [x] 2026-10-27 Codex가 전용 [guest 절차](R7-GUEST-PREVIEW-RUNBOOK.md)로
  https://pedagogy-guest-preview.dbruddl79.workers.dev 를 신규 배포했다. version
  b22da34b-4d78-469c-be22-a2d776b9e811, manifest SHA311046226308c8356c39e7e97626b0cfd360721043b6d1899546484dd00a6fa3.
  정확10007/인증오류없음·전용cwd/config·생성확인메타데이터를 보존했다.
  PR30 head88c86d5/merge d65e759의 CI4개와 Pages·5파일 일치, 원격233자산/SHA·aliases·
  HTTP헤더/private404·양성대조/iframe 검증까지 통과했다. [증거](../reviews/audits/2026-10-27/README.md).
- [ ] 위 guest는 로그인/AI/계정 동기화·실자료 이관을 지원하지 않는다. A의 상용 호스트/
  분리 backend·App Check·자료 이관·Pages/private 전환 완료 체크를 대체하지 않는다.
  d65e759 main Sonar의 new_security_rating5/ERROR도 유지하며 PR head 성공과 구별한다.
  rollback은 이번 생성확인리소스만 중지할 절차 준비이며 실제 삭제/복원 실험은 하지 않았다.

## B. Firebase / App Check — 출시 차단

- [ ] 실제 project number/app ID와 Enterprise site key의 프로젝트·허용 도메인 일치 확인.
  브라우저 SDK 버전과 토큰 발급 성공률·오탐을 staging에서 측정한다.
- [x] index와 document AI 양쪽의 App Check 초기화·토큰 전송 코드 및 토큰 획득 실패 차단을
  로컬 브라우저로 검증했다. 실제 site key 발급·reCAPTCHA 동작은 아래 운영 확인에 포함한다.
- [x] Worker 전용 verifier의 RS256 서명, 변조·만료·다른 audience/app, JWKS 캐시·unknown kid
  60초 갱신 간격·5초 장애 backoff, header 길이·잘못된 env를 자동 검사한다. enforce 실패가 quota·AI 전에
  중단되는 회귀도 있다. 실제 Google JWKS·staging 요청은 아직 확인하지 않았다.
- [ ] `APP_CHECK_MODE=monitor` 배포 후 고정된 실패 분류와 정상 발급 비율을 확인하고,
  `enforce` 전환 시각·Worker version ID·rollback version을 기록한다.
- [ ] Firestore와 Storage enforcement 각각 활성화 증거. 허용 App Check+타인 UID 조합은
  Rules에서 거절되고, 자기 UID+누락 App Check는 enforcement에서 거절되는지 확인한다.
- [ ] Authentication App Check 지원을 위한 Identity Platform 상태·비용·도메인 확인.
  Firebase Auth/Rules에 적용됐다는 주장으로 Worker 보호를 대신하지 않는다.
- [ ] 운영 Rules 배포본·IAM·서비스 계정·버킷 공개 권한과 저장소 파일 대조. 인증 없는 요청,
  타인 경로, 잘못된 모양·초과 파일 크기 거부를 격리 테스트 계정으로 확인한다.
- [ ] Storage 다운로드 토큰 URL의 공유·로그·referrer 노출과 취소 절차를 확인한다. 엄격한
  비공개 이미지 계약이 필요하면 인증 읽기/단기 URL로 이전하고 인쇄·내보내기를 재검증한다.
- [ ] debug token은 staging에만 등록하고 저장소·공개 빌드에 없는지 검사한다.

## C. Cloudflare / 과금 중단 — 출시 차단

- [ ] 배포 Worker version ID, 실제 `QUOTA` binding/migration, `GLOBAL_DAILY_LIMIT > 0`,
  `DAILY_LIMIT`, 승인 모델·플랜 상한, secret 연결 확인. 여러 production Worker가 있다면
  동일 전역 예산 경계를 공유하거나 예산을 분할해 합산 제한을 지키게 한다.
- [ ] 실제 DO에서 개인 초과 429·전역 초과 429·저장 장애 503·부분 예약 반납 확인.
  동시 호출·자정·재시작을 테스트하고, 실패 때 Anthropic 호출이 없는지 메타데이터로 확인한다.
- [ ] `AI_KILL_SWITCH=1` 반영 뒤 신규 호출 503, 진행 중 요청 영향, 실제 반영 시간 확인.
  설정 변경도 새 version/배포 반영을 수반할 수 있다. “즉시·무배포”를 보증하지 않는다.
- [ ] API custom domain·WAF/rate rule 적용 및 workers.dev/preview 우회 차단 확인.
  같은 NAT를 쓰는 학원/교실에서 로그인·연속 작업이 막히지 않는지 측정한다.
- [ ] Anthropic 조직/workspace 지출 상한·알림·자동 충전·키 범위 확인. API 재시도 정책,
  입력 최대 비용·출력 토큰·모델별 비용을 기준으로 일/월 예산을 승인한다.
- [ ] Cloudflare 요청량/CPU/DO/로그 비용과 계정 한도·알림 수신 시험. CPU 제한은 전체
  과금을 멈추지 않으므로 비용원별 중단 수단과 지속 비용을 기록한다.
- [ ] Firebase 비용·Auth 가입량·Storage 전송량 알림 및 실제 수신 확인. spend cap의
  지원 서비스·지연을 확인하고 Firebase 전체가 자동 보호된다고 표시하지 않는다.
- [ ] 클라우드 쓰기/업로드 비상 차단과 읽기 전용 전환을 별도로 준비. 직접 SDK 경로를 막는
  Rules 변경은 저장 실패 안내·export와 함께 staging 검증한다. 광범위 billing 연결 해제를
  무조건 자동 실행하지 않는다. 이미 저장된 객체의 비용은 차단 후에도 남을 수 있다.

## D. CSP / GitHub 공급망 — 출시 차단

- [ ] 실제 응답의 CSP·Referrer-Policy·nosniff 확인. index의 외부 framing은 차단하고
  같은 출처의 mock iframe은 정상 로드한다. strict CSP는 report-only 관찰 후 enforce한다.
- [ ] 실제 계정으로 Google popup/redirect·reCAPTCHA·저장·이미지·AI·인쇄·HWPX 확인.
  Playwright 오프라인 검사는 이 결과를 대체하지 않는다. 실제 iOS/WebView도 별도 점검한다.
- [ ] GitHub ruleset 필수 CI/최신 승인/code-owner review·force push 금지·bypass 최소화 확인.
  실제 독립 승인자 지정, 관리자 MFA/passkey·복구 수단 확인.
- [x] GitHub API에서 `secret_scanning`과 `secret_scanning_push_protection` 활성화를 확인했다
  (2026-10-23, 공개 저장소). `dependabot_security_updates`는 비활성, `non_provider_patterns`와
  `validity_checks`도 비활성으로 조회됐다. 이 작업에서는 계정 설정을 변경하지 않았다.
  Dependabot alerts의 실제 알림 목록은 별도 확인 전까지 미확인이다.
- [x] R6에서 Gitleaks 8.30.1의 공식 checksum을 검증하고 git 전체 이력 기준선을 한 번 실행했다.
  root 및 모든 하위 `transcript.txt`는 pathspec으로 제외했다. 이후 CI는 base..head diff만 검사한다.
  과거 로컬 IPC 세션 토큰이 로그에 들어간 이력 노출은 [REV-2026-147](../reviews/issues/2026-10/2026-10-23-security-driveupload-messaging-token-history-exposure.md)에
  기록했다. 전체 이력은 rewrite하지 않았고 계정 키 회전이나 값 유효성 검증도 하지 않았다.
- [ ] Actions allowed policy, 최소 권한·외부 PR 권한·배포 environment 제한 확인.
  R6은 Node20 제거에 대응해 checkout/setup-node/setup-python/setup-java/upload-artifact를
  공식 Node24 지원 SHA로 고정했다(세부 pin은 HANDOFF-198). 배포 권한은 보호된 release job에만
  주고 Cloudflare token은 필요한 리소스로 제한한다.
- [x] `firebase-tools` 15.34.0, `wrangler` 4.151.1, Python `lxml` 6.1.3을 고정했다.
  Firebase CLI emulator와 Wrangler staging `--dry-run`, HWPX 12항목·브라우저 parity를 로컬에서
  검증했다. 실제 staging 배포는 실행하지 않았다. Firebase CLI 및 Firebase test SDK의 dev 전이
  의존성 npm audit 잔여분은 R6 인계에서 영향 범위와 함께 기록한다.
- [ ] CDN/SRI·라이선스 수동 인벤토리: 정적 script/style 태그는 대체로 SRI가 있으나
  `mock-exam-editor.html`의 Pretendard CSS import 및 HANBatang/HCRDotum 외부 WOFF는 SRI가 없고,
  HCR 글꼴의 상업 이용 허가 근거를 확인하지 못했다. CSS가 가져오는 하위 폰트와 Firebase의
  동적 reCAPTCHA/하위 파일은 정적 태그 SRI 검증 범위 밖이다. 상세 경계와 파일 위치는
  [HANDOFF-198](../reviews/handoffs/2026-10/2026-10-23-security-r6-verification-tools.md)에 기록.

## 전환·롤백 순서

1. 격리 staging + private source + 공개 빌드 검사를 먼저 완성한다.
2. 두 AI 클라이언트의 token 전송을 배포하고 Worker monitor/정상 발급을 관찰한다.
3. 테스트 계정에서 검증을 마친 뒤 Firebase 자원별 enforcement, Worker enforce를 적용한다.
4. 새 호스트/CSP/승인 도메인에서 같은 테스트를 반복하고 산출물 해시·Worker 버전을 기록한다.
5. 장애 시 마지막 검증 산출물/Worker version/Rules 버전으로 되돌린다. frontend만 token 미전송
   버전으로 되돌려 enforce Worker와 불일치시키지 않는다. 실패 원인이 App Check라면 필요한
   서비스만 제한 시간 monitor로 완화하고, Auth·Rules·quota는 유지한다. 변경자는 만료 시각과
   복원 책임자를 기록한다. 진행 중 AI 비용·DO schema 호환성은 롤백으로 취소되지 않는다.

현재 `npm run check:launch`의 8개 차단 사유와 법무·결제·백업/복구 게이트도 그대로 남아 있다.
이 문서의 항목과 코드 검사 둘 다 완료되기 전에는 결제를 열지 않는다.

## 2026-09-11 후속 코드 검증

당시 공개 산출물은 22개 파일이었고 임의 inline script를 차단했다. 현재 파일 수는 `PUBLIC_FILES`와 매 빌드 manifest로 판정한다. 세 브라우저의 CSP·편집·인쇄·HWPX·file 실행을 확인했다. Auth/App Check 초기화 장애 분리와 SDK 대역을 사용한 화면 왕복·계정 격리도 검사했다. 실제 Google 로그인, 운영 site key, 콘솔 enforcement 증적을 대신하지 않는다.
