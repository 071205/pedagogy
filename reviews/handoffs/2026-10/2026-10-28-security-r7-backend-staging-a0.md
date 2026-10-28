# 변경 인계 — R7 A0 backend staging 로컬 분리 빌드

- ID: `HANDOFF-2026-204`
- 날짜: `2026-10-28`
- 작성자: `Codex`
- 상태: `needs-follow-up` (독립 검토·PR35 병합 완료, main CI 후속·R8 화면 우선)
- 영향 영역: `security`, `tests`, `docs`
- 관련 이슈: `REV-2026-154`, `REV-2026-155`, `REV-2026-156` (resolved)

## 변경 내용

[실행 설명](../../../docs/R7-BACKEND-STAGING-A0.md). 고정 staging identity의 직접 GET 설정 수집기,
전용 `dist/backend-staging-a0` 빌더/검증기·localhost:8796 호스트·프로필/프로젝트 네트워크 guard를
구현했다. production/guest source·산출물은 보존하며 기존 `.firebaserc` 기본 project도 바꾸지 않는다.

비동기 LS/IDB/SW admission이 끝난 뒤 marker를 쓰고, 그 뒤에만 원래 순서/SRI의 public classic
scripts를 로드한다. App Check-before-services, 로그인 ON·AI/Storage/계정삭제 OFF, 텍스트-only
직렬화 경계를 staging overlay에만 둔다. 파일/이미지/AI·원문 작업·mock cloud sync는 미지원이다.

npm 명령과 기존 CI verify job에 fixture 정상/RED를 연결했다. real SDK 모드는 별도 명령으로
실제 pinned SDK/App 설정 초기화만 확인하고 모든 backend 요청은 차단한다.

## 위험·독립 검토 요청

1. 실제 target identity/preflight·추가 계정/default fallback 금지·오류 redaction, 공개 설정과 원시
   credentials 구분. 실제 공개 키 파일은 저장소 밖 OS temp0600, 계정 객체/token/원시 응답은 미보존.
2. admission 중단/재로드·dirty LS/IDB/SW·앱 로드 순서/전역 스코프, profile marker를 자격 증명처럼
   쓰지 않는지. credential/body/query/header를 진단에 출력하지 않는지.
3. build/public allowlist·metadata/symlink·실패 빌드/호스트·시작 뒤 자산 변경·다른 산출물 보존.
4. fixture/actual SDK·CSP frame 양성 대조와 실제 Google 로그인/attestation/서버 ACK를 혼동하지 않는지.

## 검증

- `npm run test:backend-staging`: configuration 정상/거절9, artifact RED14·원본/production/guest 전체
  파일 보존·변형 실패 시 old A0 출력 유지, browser fixture 정상·runtime RED14 목표 검출·정리 성공.
- 실제 직접 GET 설정 수집은 성공했다. API enable·자원 생성·Auth/Rules/IAM/billing 변경 없음.
- 고정 SDK10.12.0 + 실제 staging 공개 설정으로 초기화 확인, 모든 backend 요청 차단·cleanup 성공.
  Google 로그인·App Check 정상 발급·Firestore ACK 성공을 뜻하지 않는다.
- `node scripts/check-audit-browser.mjs`: serve.py의 regression-test.html **175/175**, malformed JSON
  12건 거절·정규화 왕복 정상. 기존 public/CSP/static-staging 검사도 통과했다.
- 개발 중 CSP의 mock 로컬 폰트 origin, 실제 로그인 동의 모달, async document readiness 및 mock
  late boot를 보완했다. admission 이전 marker/앱 실행 위험은 pending-admission RED로 재현/수정했다.
  이 기록은 production 결함/독립 검토 완료를 뜻하지 않는다.

## 검토 기록·호출 상태

- Claude opus/high 1차(새 모듈6개, 600초)·2차(runtime/config로 축소, 360초)는 모두 exit124 timeout,
  최종 의견0건. 정상 로그인 여부와 검토 성공을 구별하며 합의로 세지 않는다. progress stderr는 비어
  원인을 사용량/서비스 문제로 단정하지 않는다. 직접 claude -p/background 우회는 하지 않았다.
- 사용자 “클로드 다시 시도해보고 안되면 해결하고 ㄱ”에 따라 inline admission/loader 검토(opus/high, 180초 제한)는 exit0/최종 의견을 회수했다. [원문](../../audits/2026-10-28/a0-claude-inline-review.md)의 지적2건을 Codex가 실제 브라우저로 재현했다. 제안한 fetch 주입을 그대로 따르지 않고 실행 시점 gate로 고쳤으며, 동시 창은 IDB await 뒤 fresh를 갱신했다. REV154/155의 같은 이슈 파일에 해결·정상/목표 RED 증거를 남겼다.
- 범위를 config/runtime/build/host 전체 inline 코드로 넓힌 재시도(opus/high, 240초)는 exit124/최종 의견0이었다. 원인 미확정이며 narrow 검토를 전체 승인으로 세지 않는다. 사용자 조건부 대체 승인에 따라 구현자와 분리된 Codex 검토 에이전트가 6개 모듈·검사 경계를 읽기 전용으로 검토했다.

- 독립 Codex가 App Check SDK 경로 불일치 REV156을 발견했다. root도 공개 SDK와 브라우저 fixture로 재현했으며, SDK의 C 상수까지 추적해 양쪽이 놓친 content-host/CSP 누락도 확인했다. 검토자는 첫 통과 판정을 철회했다. 정확한 content-host/projectId/appId/action/key/POST 및 SDK 화면 CSP를 수정했고, native fetch의 로컬 합성 응답 대조와 CSP RED도 추가했다.
- [최종 정정 판정](../../audits/2026-10-28/a0-codex-final-review.md): **합의**, 미합의 없음. 독립 VM 정상 fetch/XHR2·거절18, 산출물/CSP·정상/RED 결과 확인. 구현자와 독립 검토자를 구분하며 실제 Google 로그인/발급/ACK/운영 미검증 한계는 유지한다.

## 다음 행동

최종 구현 `966f78a`는 커밋/푸시되어 있고 [PR35](https://github.com/071205/pedagogy/pull/35)를 생성했다. 정확한 head/필수 CI·병합 상태는 PR 기록으로 확인한다.
독립 코드 검토·재현 결함3건 수정·최종 정상/RED 재검증 완료. 다음은 PR35의 필수 CI·병합/main 확인 뒤 R8의 편집→미리보기→출력 화면과 불편 개선을 우선하는 것이다.
실제 A1 원격 provisioning/인증·Storage/Blaze·실자료 이관/high·main Sonar·R7/R8 운영 전체 게이트는
미결이다. 기본 checkout 전환·transcript.txt 접근·production 변경은 하지 않았다.

## 2026-10-28 사용자 방향 조정

사용자가 “너무 백엔드 작업만 하는거 아님?”이라고 지적했다. 현재 PR까지만 마무리하고,
다음은 사용자 화면에서 체감하는 편집·미리보기·출력 흐름/불편 개선을 우선한다고 답했다.
허용된 R8 로컬 범위에서 진행하며 추가 A1 구축을 자동으로 시작하지 않는다. 원격 게이트를
완료로 바꾸거나 없앤 것은 아니다. 우선순위는 통합 레일/RAIL-ORDERS에도 반영했다.

## PR35 병합·다음 체크포인트

- head `dae2283bffb20693bc5c50783590ecd7fdd9d451`, Verify40610607547의 secrets/verify/cross-platform/hwpx 전부 success, PR Sonar SUCCESS. CodeRabbit은 skipped로 독립 검토 근거에 세지 않는다.
- PR35는 `2026-10-28T01:11:11Z` merge `78505904f1a106e8c4e3d3804b9f1132f4253d87`로 병합됐다. [안전 메타데이터](../../audits/2026-10-28/a0-pr35-ci.json).
- main Verify40613492383은 시작됐으며 최종 통과는 아직 주장하지 않는다. Pages40613492254는 정확 merge7850590 built이며 공개 핵심5파일 bytes 일치를 확인했다([증거](../../audits/2026-10-28/a0-pr35-pages.json)). 이전 main Sonar 실패를 PR Sonar 통과로 닫지 않는다.
- 다음은 R8 화면 우선순위다. 합성 2문항/세 viewport 탐색 기준선은 HANDOFF202 후속과 로컬 visualizations에 보존했다. 새 제품 UI 코드는 아직 바꾸지 않았다.
- 병합 후 이 체크포인트 문서는 기존 feature branch에 별도 커밋/푸시해 보존한다. 이 문서 후속이 PR35의 검사 head에 포함됐다고 쓰지 않는다. 기본 checkout 전환·transcript.txt 접근 없음.
