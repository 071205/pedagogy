# 변경 인계 — R7 A0 backend staging 로컬 분리 빌드

- ID: `HANDOFF-2026-204`
- 날짜: `2026-10-28`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `security`, `tests`, `docs`
- 관련 이슈: `없음` (독립 코드 검토 대기)

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

- `npm run test:backend-staging`: configuration 정상/거절9, artifact RED12·원본/production/guest 전체
  파일 보존·변형 실패 시 old A0 출력 유지, browser fixture 정상·runtime RED9 목표 검출·정리 성공.
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
- 독립 검토 담당 대체에 대한 사용자 답을 기다리는 동안 구현·검사·증거 정리를 진행한다.

## 다음 행동

현재 feature branch에 미검토 체크포인트를 커밋/푸시해 보존한다(병합/배포 승인 아님).
독립 코드 검토 → 재현 결함 수정/같은 이슈 해결 기록 → 관련 정상/RED 재검증 → PR·CI/병합 순서다.
실제 A1 원격 provisioning/인증·Storage/Blaze·실자료 이관/high·main Sonar·R7/R8 운영 전체 게이트는
미결이다. 기본 checkout 전환·transcript.txt 접근·production 변경은 하지 않았다.
