# 출시 보안 운영 증적 체크리스트

2026-09-11 기준 **모든 운영 항목은 미확인**이다. 로컬 코드 검사 통과와 구분한다.
[확정 설계](SECURITY-ARCHITECTURE.md)를 기준으로, 완료 시 각 항목에 담당자·확인 시각·환경·
리소스 ID·설정 export/스크린샷의 비공개 위치·실험 결과를 연결한다. 토큰·키·사용자 원문은
이 문서나 공개 저장소에 붙이지 않는다. 코드 후속 구현도 아래 전환의 선행 조건이다.

## A. 저장소와 배포 경계 — 출시 차단

- [ ] GitHub 현재 visibility·Pages source·활성 workflow·배포 주체 확인. 이번 작업은 GitHub
  콘솔/원격 설정을 조회하거나 변경하지 않았다. 과거 리뷰의 공개 상태는 과거 증거로만 취급한다.
- [ ] private source 저장소와 접근자 확정, 원격·CI 연결 전환. 기존 공개 이력/clone은 회수
  불가함을 기록. 노출된 실제 secret은 전체 이력 scanner 결과에 따라 폐기·교체한다.
- [ ] 상용 호스트를 Workers Static Assets로 준비. assets root는 `dist/public`만 지정.
  빌드 성공한 동일 산출물을 승격하고 manifest 해시를 배포 기록과 대조한다. 공개 sourcemap,
  `.git`, Worker, reviews, tests URL이 실서비스에서도 404인지 확인한다.
- [ ] 정적 자산/AI API의 production·staging 도메인·Worker·Firebase·Anthropic key 분리.
  staging은 실제 운영 사용자 자료를 읽지 못하도록 별도 프로젝트를 사용한다.
- [ ] 도메인 이전 전에 기존 origin의 localStorage/IndexedDB 자료를 JSON으로 export할 경로를
  제공하고 새 origin import를 테스트한다. origin 변경은 로컬 데이터를 자동 이동하지 않는다.
  Firebase 승인 도메인·Auth redirect·Storage CORS·Worker Origin·CSP·App Check 도메인을 함께 점검한다.
- [ ] 새 호스트 정상 확인 후 기존 Pages는 이전 안내로 전환. 앱과 모든 공개 이력을 동시에
  감출 수 있다고 약속하지 않는다. 캐시·구버전 탭 대응 및 지원 종료 시점을 공지한다.

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
- [ ] secret scanning/push protection/Dependabot alerts와 보안 업데이트 활성화 확인.
  private repo 요금제 지원 여부와 대체 scanner를 검증한다. 설정 YAML만으로 완료 처리하지 않는다.
- [ ] Actions allowed policy·SHA pin, 최소 권한·외부 PR 권한·배포 environment 제한 확인.
  배포 권한은 보호된 release job에만 주고 Cloudflare token은 필요한 리소스로 제한한다.
- [ ] firebase-tools/wrangler와 Python 전이 의존성을 고정한 후 emulator·staging 배포 검증.
  CDN SDK·CSS/폰트 목록과 SRI·라이선스를 별도 유지한다.

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

공개 산출물은 22개 파일이며 임의 inline script를 차단한다. 세 브라우저의 CSP·편집·인쇄·HWPX·file 실행을 확인했다. Auth/App Check 초기화 장애 분리와 SDK 대역을 사용한 화면 왕복·계정 격리도 검사했다. 실제 Google 로그인, 운영 site key, 콘솔 enforcement 증적을 대신하지 않는다.
