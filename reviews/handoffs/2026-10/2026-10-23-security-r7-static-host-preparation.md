# 변경 인계 — R7 로컬 Static Assets 호스트 준비

- ID: `HANDOFF-2026-199`
- 날짜: `2026-10-23`
- 작성자: Codex (GPT-6 Sol / medium)
- 상태: `ready-for-review`
- 영향 영역: `worker | tests | docs`
- 관련 이슈: 없음

## 현재 상태 — 로컬 준비 독립 검토·PR27 CI 통과, 미병합·세션 인계

- 사용자가 재개를 요청했고, 이전 구현에 참여하지 않은 독립 Codex가 REV-149/150을 재현했다. 같은 이슈에 수정·정상/RED·독립 재검증을 기록해 둘 다 resolved다.
- 최종 CLI timeout 경계까지 독립 재검증을 통과했다. 정상 exit0·비동기 ENOENT·SIGINT와 timeout의 실제 소유 child가 종료되고 clean이 1회 수행됐다. 검토 범위 안의 미합의/추가 재현 결함은 없다.
- PR #27 head `44a93dd511ebaf27875acba1a65c6e6475edcf6c`는 ready/open이며 Verify run `39854078445`의 secrets·verify/check:fast·cross-platform·hwpx가 모두 success다. SonarCloud도 통과했다. 병합·새 호스트 배포는 하지 않았다. R7 전체의 실제 호스트·App Check·자료 이관·Pages/private 전환 완료는 아니다.

## 이전 중단 체크포인트 — 4196588 보존 당시 기록

- 실제 worktree: `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, branch `codex/r7-static-host-preparation`. 기본 저장소 checkout은 변경하지 않았다. `transcript.txt`는 접근·수정·생성 금지다.
- 로컬 구현과 아래 정상/RED 검사는 보존했다. 마지막 framing 검사 대기를 `networkidle`로 바꾼 뒤 `test-static-host-final.log`도 성공했다. 새 R7 원격 CI·PR·병합은 아직 없다.
- 독립 검토 `/root/r5_gate_review`와 구현자 `/root/r7_prepare`가 사용량 한도로 종료됐다. **R7 독립 최종 답변/승인 없음.** R6의 성공한 독립 판정과 혼동하지 않는다. 사용자 요청에 따라 재호출이나 다음 구현은 시작하지 않는다.
- 재개 순서: (1) 이 체크포인트와 diff의 독립 검토부터 재개 (2) 실제 재현 지적이 있으면 수정·정상/RED 확인 (3) 검토 후 PR·새 head CI (4) 통과 뒤 로컬 준비 묶음 병합. 도메인·App Check 운영 전환과 원문/작업 이관은 별도 미완료 게이트다.
- 검토에는 config의 실제 TOML 의미가 assets-only/dist-public 계약과 일치하는지와 오류 시 서버 시작/종료·정리 경계를 포함한다. 로컬 Node 실행 결과는 새 head의 Node22 CI를 대신하지 않는다.

## 변경 내용

기존 AI Worker의 이름·DO·secret·origin을 건드리지 않고, 별도
`wrangler.static.staging.toml`의 Static Assets 루트를 `dist/public`으로 고정했다.
`build-public.mjs`가 기존 meta CSP를 정규화한 페이지별 HTTP CSP와
`frame-ancestors`를 `_headers`로 생성한다. index/document/legal은 `'none'`,
같은 출처 모의고사 iframe은 `'self'`이며 공통 규칙은 nosniff·Referrer-Policy만
지정한다. `_headers`도 공개 산출물 allowlist·manifest SHA의 일부지만
Cloudflare가 URL로 제공하지 않는다.

`serve-static-staging.mjs`는 매 시작 전에 fresh build→출력 검증→manifest 대조를
완료한 뒤에만 loopback Wrangler를 시작한다. 빌드 실패 때 기존 `dist/public`을
보존하는 builder 계약은 유지하고, 서버 시작만 거절한다.
`check-static-host.mjs`는 실제 로컬 Wrangler의 root/별칭·query·404·비공개 경로와
HTML HTTP 헤더·같은 출처 mock iframe·외부 origin embedding 거절을 본다.
기존 `/pedagogy/` 서브경로 공개 브라우저 검사는 그대로 둔다.

## 위험과 검토 요청

- Cloudflare HTML auto-trailing-slash의 `/index.html→/`과 편집기
  `.html→확장자 없는 경로` redirect가 실제로 같은 파일·CSP를 주는지,
  누락 경로가 SPA index 200으로 떨어지지 않는지 재확인해 달라.
- `_headers`에서 공통 CSP를 두지 않아 duplicate header 값 결합이 없고,
  모의고사에 `'none'`이나 X-Frame-Options DENY가 붙지 않는지 봐 달라.
- staging config 이름은 로컬 fixture이며 원격 host/domain을 확정하거나 배포한
  증거가 아니다. 실제 credentials·App Check site key·유료 AI 값은 만들지 않았다.
- 구 origin JSON의 범위와 IndexedDB 원문/작업/연결·충돌 기록의 누락은
  [운영 체크리스트 A](../../../docs/SECURITY-OPERATIONS-CHECKLIST.md)의 표에 있다.
  owner/epoch·삭제 세대·고정 채택 ID가 걸린 무손실 archive/import는 이번 Sol medium
  구현에 넣지 않고 별도 high 저장 설계와 실계정 검증으로 남긴다.

## 검증

- `npm run test:public` 정상: source CSP 12/12 실패 주입, 공개 allowlist/
  `_headers`·symlink·secret·소스맵 검사, fresh-start 단위 검증 통과.
- `npm run test:static-host` 정상: 234개 manifest 산출물의 실제 로컬
  Wrangler 응답·SHA·404·헤더·iframe 검사 통과. 둘 다
  `/private/tmp/r7-2026-10-23/`에 로그 보존.
- RED: 생성 mock `frame-ancestors`를 `'none'`으로 임시 변이하면
  `build-public.test.mjs`가 exit 1; start 게이트를 기존 출력 검증만 하도록
  임시 변이하면 실패한 새 빌드에도 서버 spawn에 도달해
  `static-staging.test.mjs`가 exit 1. 변이는 모두 복구했고 각 로그는
  `red-frame.log`, `red-stale-start.log`.
- 미실행: 새 원격 호스트/도메인·실제 Google/Firebase/App Check 정상·거절,
  운영 CSP·source export/import, Pages/private 전환. 계정 자료와 운영 설정에
  접근하지 않았다.

- 마감 검사: `npm run check:static` 통과(`/private/tmp/r7-2026-10-23/final-static.log`). 리뷰 위생은 이슈 136건/열림 4·INDEX 116/120·최근 5/5이며, `git diff --check`도 통과했다.

## 다음 검토자에게

`scripts/build-public.mjs`, `scripts/serve-static-staging.mjs`,
`scripts/check-static-host.mjs`, 두 단위 검사와
`wrangler.static.staging.toml`만 먼저 대조하면 된다. R7은 로컬 준비 단계이며
실제 전환/롤백의 환경별 증적은 운영 체크리스트의 미확인 항목으로 남는다.

## 검토 기록

2026-10-23 · 독립 Codex 검토 요청 후 사용량 한도로 종료. 최종 판정 미수신·검토 대기. 부모는 인계·검사 로그와 변경을 보존하고 중단한다.

2026-10-23 · 재개 후 독립 검토가 `REV-2026-149`(TOML 다른 섹션 decoy)와
`REV-2026-150`(이미 signal 종료된 child의 cleanup hang)을 재현했다.
구현자는 같은 이슈 파일에 해결 근거를 남기고 두 회귀를 추가했다. 전역 정규식 대신
Python 표준 `tomllib`으로 실제 TOML 구조를 파싱해 허용 top-level/[assets]
키·값만 받는다. Wrangler 4.151.1은 `smol-toml` 1.9.0을 내부 번들에 두지만
공개 import가 되지 않으며, offline npm cache에도 없어 새 npm 의존성을 만들지 않았다.
verify job은 기존 pinned `setup-python`으로 Python 3.12를 고정한다. 현장
Python이 없거나 3.11 미만이면 시작 검사가 실패하고, 설정 원문은 오류에 노출하지
않는다. child lifecycle은 spawn 직후 감시·terminal snapshot·유한 stop과
finally cleanup으로 수정했다. `test-rev149-150-final.log`와 실제
`test-static-host-review-fixes.log` 통과, 새 회귀의 실패 주입은
`red-review-config.log`·`red-review-terminal.log`에서 exit 1이다.
`package.json`/lock 변경 없음. 독립 재검증과 원격 운영 증거는 아직 대기한다.

2026-10-23 · REV-150의 기존 terminal/error/유한 stop 경계는 독립 재검증을
통과했다. 다만 standalone CLI의 wait timeout 뒤 살아 있는 소유 child를
종료하지 않고 clean만 하는 추가 재현을 같은 이슈에서 보완했다.
`runStaticStagingCli()`의 실제 entry 경로에 stop→clean을 적용하고,
실제 Node child 회귀는 수정 전 `red-cli-timeout.log` exit 1,
수정 후 `test-cli-timeout.log` 통과했다. 독립 probe의 후속 안전 판정도
`cli-timeout-after-probe.log`에서 kills=1·cleans=1·childRemainsLive=false다.
독립 최종 재검증과 운영 게이트는 여전히 대기한다.

## 재개 시 대조할 핵심 파일 SHA-256

아래는 첫 검토 요청 때의 보존 snapshot이다. REV-149/150 수정 뒤 현재 파일 hash를
뜻하지 않으며, 당시 사용량 한도 종료를 성공 판정으로 바꾸지 않는다.

- `scripts/build-public.mjs`: `acf915ec4c710a797934a0792f047ff786c178cee6a1e3ee70f08ab9015d1021`
- `scripts/build-public.test.mjs`: `c933b9de443d6d244a91917bb9307a414b4bcc477b8818f7c349b66b97eda1eb`
- `scripts/serve-static-staging.mjs`: `0386f040e3691a1a73f821e0f6b6f11f766b37e327d6ebec7c77dcdf5ef5fadb`
- `scripts/static-staging.test.mjs`: `8bd87c16d7107ff681d1e2534b23f1c811df4b615ebd0c356f40fdc68636598f`
- `scripts/check-static-host.mjs`: `0930d3a472d2af48b97627580ee28b8d0467102da60da85c0cdfb5c414bacea0`
- `wrangler.static.staging.toml`: `b9f405086868e2b2a10aa80d7a194601cdd3cd313a94bfd77ecca975fcbbbdc6`

## 최종 독립 검토 — 2026-10-23 재개 후

- 비구현자 `/root/r5_gate_review`: **합의 — R7 로컬 Static Assets 준비 묶음 통과. REV149/150 해소, 추가 재현 결함 없음. 미합의 — 검토 범위 안에는 없음.** 원본 CLI timeout probe는 SIGTERM→종료→clean, child 생존 없음으로 바뀌었고 실제 child 정상 종료·ENOENT·SIGINT도 통과했다. config 7경계·이미 signal 종료/비동기 오류/유한 stop·framing 양성/음성 근거를 재사용했다. 새 head CI는 필수이며 이 판정은 운영 R7 완료 승인이 아니다.
- 최신 독립 로그: `/private/tmp/r7-independent-2026-10-23/{fix-boundaries-probe,lifecycle-fixed-probe,cli-timeout-final-probe,cli-outcomes-probe}.log`. 임시 로그가 정리돼도 두 이슈의 재현 절차 및 영구 회귀로 다시 검증할 수 있다.
- 최종 검토 파일 SHA-256:
  - `scripts/serve-static-staging.mjs`: `5c3aeed5f3104ecc5d244f44690e86dc543072b23e52ea0aa9f0f0d275c0c3cf`
  - `scripts/check-static-host.mjs`: `b75225a614fe3b75faea15a182b9134c98f7937e6377bda6254931bbe13579b4`
  - `scripts/static-staging.test.mjs`: `896d3a22bdfcc2d9eb5286f8d1d477255ebcc40204b6228fecf38fa83dfb4859`
  - `scripts/check-static-staging-config.py`: `00e115057545dfa31c5e03de800d7dfd53ca09bc07a9250e0852946c8cac1cbf`


## 새 채팅 재개 체크포인트 — 2026-10-23 사용자 요청

사용자가 컨텍스트 누적으로 새 채팅에서 이어가도록 정리를 요청했다. 이 절이 위 과거 중단 기록보다 최신이다.

- 실제 worktree는 `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`. PR #27 branch `codex/r7-static-host-preparation`의 head는 `44a93dd511ebaf27875acba1a65c6e6475edcf6c`로 고정했다. 인계 문서·R8 감사 자료는 그 위 별도 `codex/r7-r8-session-handoff`에 보존한다. PR27 head와 이 인계 브랜치를 혼동하지 않는다.
- PR: <https://github.com/071205/pedagogy/pull/27>. Verify: <https://github.com/071205/pedagogy/actions/runs/39854078445>. 마지막 실측은 open/ready/CLEAN·4 job success이며 미병합이다. 재개 때 새 댓글·head·CI를 다시 확인한 뒤 기존 승인 범위에서 병합하고, 정확한 merge의 main CI와 Pages 상태를 확인한다. PR27 통과로 이 인계 브랜치의 별도 CI까지 통과했다고 쓰지 않는다.
- **최신 사용자 결정: 도메인 구매 보류, 무료 기본 주소/호스팅부터 진행.** `pedagogy.tools`는 검색 후보였을 뿐 등록·결제하지 않았다. Cloudflare `workers.dev`와 정적 호스팅을 우선 검토한다. AI/DB/Storage/Worker 사용량까지 전체 무료라는 뜻은 아니다. 기존 운영 사이트는 그대로이며 새 원격 정적 호스트를 만들거나 배포하지 않았다.
- Cloudflare `wrangler whoami`는 인증 상태만 확인했다. 계정 ID·이메일·token 값은 인계하지 않는다. 분리된 staging `pedagogy-ai-staging`의 기존 web app public SDK config 읽기는 Firebase API **403 PERMISSION_DENIED**였다. 앱 부재·로그인 만료·IAM 원인은 미확정이며 읽기만 시도했다. 원문 debug/env/token을 출력하지 말고 오류 metadata만 확인한다. production Firebase config를 쓰고 분리 staging이라고 표시하지 않는다.
- 사용자에게는 이 프로젝트 작업을 계속 진행하고 독립 검토 에이전트를 사용하도록 사전 승인이 있다. 사소한 다음 행동을 반복 승인받지 않는다. 유료 도메인 구매는 위 최신 보류 결정을 따른다. 저장소의 낡은 왕복 3회 제한 대신 세션에서 직접 제공된 AGENTS의 '호출 횟수 상한 없음, 새 근거 없이 같은 질문 반복 금지'를 우선한다.
- Claude 주간 한도로 실패했던 호출은 승인과 구분한다. 이전 표시상 2026-10-25 20:00 KST까지였으므로 상태 변화 근거 없이 재시도하지 않는다. R5·R6·R7의 성공 판정은 독립 Codex 판정이며 Claude 승인이라고 쓰지 않는다.
- `transcript.txt`는 읽기·수정·추가·생성 금지다. 기본 checkout `/Users/huryul/개발/pedagogy-main`을 전환하거나 그곳의 기존 파일을 섞지 않는다. 새 채팅은 먼저 사용자 AGENTS·reviews/README·INDEX·통합 레일 현재 위치를 읽는다.

### R8 로컬 연결 증거 — 일부만 완료

- 영구 자료: [감사 README](../../audits/2026-10-23/README.md), [실행 코드](../../audits/2026-10-23/r8-connected-journey.mjs), [정상 결과](../../audits/2026-10-23/r8-connected-journey-normal.json), [RED 결과](../../audits/2026-10-23/r8-connected-journey-red.json).
- 비구현자 `/root/r5_gate_review`가 강화된 본문/고정 ID/Undo 단언과 최종 이식본을 독립 검토했다. 최종 이식본은 경로/소유 서버 대기·cleanup만 변경됐고 추가 재현 결함 없음. 별도 원문 이미지 probe에서 naturalWidth/Height=1과 decode도 확인했다. 구현자 `/root/r7_prepare`는 GPT-6 Sol / medium이며 자기 승인으로 세지 않는다.
- 합성 guest 원본 8문항·PNG 원문 1쪽, UI로 5권 요청(자동 제안4권 차이 확인)→이동/Undo→원문 열기→수동5번째권→채택→편집기/지면→재로드/재진입을 1194×834·768×1024·375×812에서 정상 통과했다. 원본·결과 본문 payload 8개, 새 문항 ID 중복/누락 없음, 다섯 결과 ID 보존을 확인했다. RED는 격리 guest 결과5권을 의도적으로 삭제한 뒤 재로드 ID 단언이 exit1이었다. 이는 검사 음성 대조이며 실제 저장 장애 재현으로 확대하지 않는다.
- **미검증:** 실제 PDF 추출/실패 쪽/부분 채택, 새 편집 내용 저장, 실계정/클라우드 ACK, 유료 AI, 인쇄·한글 출력, 실기기 Safari/iPad, 인간 사용자 과제 관찰. 자동 클릭을 인간 관찰 완료로 기록하지 않는다. R8 운영 완료가 아니다.
- 재실행은 README의 정상/RED 한 명령을 사용한다. 변경 없는 기존 정상·RED 전체를 반복하지 않는다. `/private/tmp/r8-2026-10-23/portable/`의 로그는 보조이며 임시 폴더가 없어져도 영구 코드·JSON으로 재현 가능하다.

### 다음 행동

1. PR27 head/댓글/필수 CI 상태 확인 → 로컬 준비 묶음만 병합 → 정확한 merge의 main CI/Pages 확인. 새 코드 결함이 없으면 이미 통과한 전체 검사를 반복하지 않는다.
2. 인계 branch의 문서·R8 감사 자료를 main 이후 작업에 보존한다. R7 병합 후 이 branch를 이어 쓰거나 관련 인계 commit을 가져오되 PR27 코드 전체를 중복 cherry-pick하지 않는다.
3. 무료 호스팅 경로로 실제 staging Firebase 접근/설정·App Check·origin·무손실 원문/작업 이관·롤백 증거를 준비한다. 현재 403 원인 및 계정 접근을 먼저 확인한다. 저장 계약 변경/이관 설계는 레일의 high 역할·독립 검토로 올린다.
4. R7 외부 접근 대기 중 R8의 남은 로컬 실패/복구·출력·성능 검증은 GPT-6 Sol / medium으로 진행 가능하다. R7 운영 완료·D3/C1~C3 조건 충족 전 유료 일괄 AI 활성화나 R8 운영 완료로 표시하지 않는다. R9 공개·R10 출시는 뒤 게이트를 따른다.

인계 마감 검증: 최종 저장소 위치에서 `R8_REPO_ROOT` 없이 정상 명령을 실행해 세 화면 모두 complete=true/exit0, 임시 브라우저 close·소유 serve.py SIGTERM 종료를 확인했다(`/private/tmp/r8-2026-10-23/handoff-location.log`). `check:review-hygiene`는 이슈138/열림4·INDEX116/120·최근5/5·자기검사6/6 통과, `git diff --check` 통과다. 인계 branch의 원격 CI는 별도로 실행/완료했다고 주장하지 않는다.
