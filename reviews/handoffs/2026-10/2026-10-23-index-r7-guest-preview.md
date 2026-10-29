# 변경 인계 — R7 무료 게스트 미리보기 정적 오버레이

- ID: `HANDOFF-2026-201`
- 날짜: `2026-10-23`
- 작성자: Codex (GPT-6 Sol)
- 상태: `reviewed`
- 영향 영역: `index | mock | tests`
- 관련 이슈: 없음

## 변경 내용

`scripts/build-guest-preview.mjs`는 기존 `PUBLIC_INPUTS`의 일반 파일만 임시 루트로 복사하고 세 편집 HTML·공개 설정을 게스트 전용으로 변환한다. 기존 `buildPublic/verifyPublic`의 정확한 `PUBLIC_FILES` allowlist와 헤더 생성/검증을 이용한다. 산출물은 `dist/guest-preview/dist/public`, 구별되는 `guest-manifest.json`, 자산 전용 `wrangler.toml`이다. 생성 Wrangler의 `./dist/public`은 해당 게스트 루트 안에서만 해석된다. 원본 공개 입력은 바이트를 전후 비교하며 수정하지 않는다.

게스트 HTML은 운영 Firebase 설정/SDK, Worker 주소와 backend·loopback CSP 출처를 제거한다. 공개 설정의 `guestPreview:true`로 인증·AI·계정 Worker·문서/모의고사 서버 탐색을 명시 차단하고 세 편집 화면에 게스트 배너를 둔다. 브라우저 로컬 저장, JSON, 인쇄, 같은 출처 모의고사 iframe과 브라우저 HWPX 경로는 유지한다. KaTeX/폰트 CDN을 사용하므로 완전 오프라인은 아니다. 운영 `index.html`, `document-editor.html`, `mock-exam-editor.html`, `service-config.js`, 기존 정적 staging 설정과 production 배포 파일은 수정하지 않았다.

## 위험과 검토 요청

- 변환 앵커·개수가 원본 변경을 놓치지 않고 fail-closed 하는지, 특히 계정 Worker `fetch`와 게스트 설정 로드 순서를 확인한다.
- 운영 호스트의 실제 HTTP `_headers`·alias·404 및 assets-only Wrangler 시작은 별도 독립 검토/배포 전 검증이 필요하다. 이 인계의 Node HTTP 서버는 HTML meta CSP와 브라우저 흐름을 검사한다.
- 게스트 미리보기는 R7 전체 staging/Auth/App Check/이관 완료의 대체가 아니다. 실제 자료를 새 origin으로 자동 이관하지 않는다.

## 검증

- `node scripts/guest-preview.test.mjs`: Chromium에서 UI 문항 제목/본문 편집→reload, 인쇄, 모의고사 iframe 저장, 문서 JSON 저장/재로드, 로그인·AI·서버 탐색 차단, CSP 및 private 404 통과. 배너·backend CSP·Firebase SDK·iframe CSP·운영 endpoint·설정 플래그·runtime/account guard 제거, 인라인 스크립트, symlink, private 파일 혼입 RED 통과.
- `node scripts/build-guest-preview.mjs --check`: 기존 빌드 `PUBLIC_FILES`와 manifest, 공개 헤더, 게스트 정책 통과.
- `npm run test:public`: 원본 공개 빌드/CSP/정적 staging 검사 통과.
- `node scripts/check-audit-browser.mjs`: `serve.py`의 `regression-test.html` 실패 0건 및 JSON root 거절 12건 통과.
- 아직 실행하지 못한 검증: 실제 Wrangler dev/원격 HTTP 헤더·새 호스트 운영 증거(후속 독립 검토/배포 단계).

## 다음 검토자에게

검토 diff는 `scripts/build-guest-preview.mjs`, `scripts/guest-preview.test.mjs`와 이 인계다. 게스트 빌드는 `node scripts/build-guest-preview.mjs`, 검사는 `node scripts/guest-preview.test.mjs` 및 `node scripts/build-guest-preview.mjs --check`이다. 생성 Wrangler는 `dist/guest-preview/wrangler.toml`; 배포 대상은 그 설정의 `./dist/public`이다. 기존 `dist/public`은 운영 설정 산출물이므로 게스트 호스트에 지정하지 않는다.

## 검토 기록




## 후속 검증·독립 검토

독립 Codex `/root/r8_edit_print_review`(GPT-6 Sol / medium)가 빌더/정상·RED/생성 JS와
공개 빌드 계약을 읽어 재현 가능한 결함 없음·미합의 없음으로 판정했다. Claude 승인이 아니다.

root가 기존 check-static-host를 재사용한 `scripts/check-guest-host.mjs`를 추가했다.
로컬 생성 Wrangler에서 234 manifest 중 HTTP 제공 233개(_headers 제외)의 모든 바이트·SHA,
HTML 별칭/정확 HTTP CSP·frame-ancestors·nosniff·referrer policy·비공개404와
동일 origin mock iframe/타 origin index 차단이 통과했다. 원본 파일은 변하지 않았다.
정상 명령은 `node scripts/check-guest-host.mjs`, 원격은
`GUEST_HOST_BASE=https://pedagogy-guest-preview.<label>.workers.dev node scripts/check-guest-host.mjs`다.
원격은 이 전용 host 형식만 허용하며 생성 manifest와 대조한다.

`GUEST_HOST_RED=drop-frame-headers node scripts/check-guest-host.mjs`는 격리 로컬 프록시가
실제 CSP 응답 헤더를 지워 `Guest HTTP CSP must match verified framing`에서 exit1이다.
브라우저·프록시·소유 Wrangler·임시 state는 finally로 정리한다. 원격 실패 주입은 거절한다.
독립 Codex가 추가 스크립트·정상/RED 로그와 lifecycle을 대조해 합의했다.
로그는 `/private/tmp/pedagogy-r7-guest-host-normal.log`와 `-red.log`다.
로컬 정상 manifest SHA는 `311046226308c8356c39e7e97626b0cfd360721043b6d1899546484dd00a6fa3`다.

package scripts와 Verify에 guest 정상·RED 및 실제 Wrangler 검사를 연결했다.
새 무료 host 이름 조회는 worker-not-found이며 인증 오류는 아니었다. 원격 배포는 아직 전이다.


## 2026-10-25 재개 체크포인트

사용량으로 실패했던 브랜치 생성은 실행되지 않았고, 재개 시 실제 변경을 확인했다.
PR29 head `b1f1678791e6edb4fb7e6a4a1bac462d7fec5ab4`의 필수 Verify4개와 Sonar 성공·
댓글을 확인해 `1ed8d7f1d96e41e06d8d9ea81cd1e303c4833f48`로 병합했다.
기본 checkout을 바꾸지 않고 본 worktree만 `codex/r7-guest-preview-host`로 옮겨 main에
fast-forward했다. PR29 main CI/Pages는 아직 완료 확인 전이다.
추가 package/CI 연결도 독립 Codex가 정확한 파일/옵션·RED exit1과 실패 문구 검사로
합의했다. 이후 에이전트의 사용량 한도 오류는 이 실질 답변과 구별하며 새 승인으로 세지 않는다.

다음은 이 변경의 별도 head CI·PR 검토/병합, 전용 guest config로 새 호스트 배포,
GUEST_HOST_BASE 원격 전체 바이트/헤더/404/iframe 검증이다. 도메인 구매·production
Firebase/Worker·실제 자료·기존 Pages/private 전환은 하지 않는다. 실패 시 새 guest
리소스만 중지/삭제하거나 검증된 guest 산출물로 복귀하며 production은 롤백 대상이 아니다.


### REV152 — CI 도구 가정 수정

PR30 head 4dcc11f의 Verify40123745055는 새 guest 기능/RED와 Wrangler233자산·헤더·
404·iframe 정상을 실제 Linux에서 통과했다. 마지막 RED 로그 확인의 rg가 러너에 없어
exit127로 실패했으므로 [REV152](../../issues/2026-10/2026-10-25-tests-guest-ci-log-tool.md)를 기록했다.
검색만 grep -F로 바꾸며 RED 원래 exit1과 목표 문구를 모두 요구하는 게이트는 유지한다.
제한 PATH 대조는 old127/fixed0/wrong-exit1/wrong-message1, 독립 Codex 좁은 검토 합의다.
다른 통과 검사는 로컬에서 반복하지 않았고 새 CI head 성공을 기다린다.
PR29 main1ed8d7f의 Verify40123600931 네 job 성공·Pages built도 최종 확인했다.


## 최종 마감 체크포인트 — 2026-10-25

사용자가 사용량 종료 전 마무리를 요청해 새 배포를 시작하지 않고 인계한다.

- 실제 worktree: `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`.
  인계 branch `codex/r7-guest-preview-handoff`; 기본 checkout은 전환하지 않았다.
- PR29는 `1ed8d7f1d96e41e06d8d9ea81cd1e303c4833f48`로 병합 완료.
  정확한 main Verify40123600931 필수4job 성공, Pages40123600472 성공·built 확인.
- PR30 https://github.com/071205/pedagogy/pull/30 은 open/미병합이다.
  branch `codex/r7-guest-preview-host`, 최신 head
  `28189ae6e56e98dc89d7b2b7ad8adc3ee7d15d3b`, Verify40125969663 진행 중이다.
  인계 branch 문서 커밋과 PR head를 구별하며 별도 CI 성공을 주장하지 않는다.
- 최초 head4dcc11f의 Sonar·secrets·cross-platform·hwpx 및 verify의 기존 종합/시각/
  공개 산출물 검사는 성공했다. 새 guest UI/RED 및 실제 Wrangler 정상도 통과했으나
  마지막 rg 부재(exit127)로 verify job은 실패했다. 이를 전체 CI 성공으로 세지 않는다.
- REV152는 grep -F 한 줄 수정·제한 PATH 정상/음성 대조4개·독립 Codex 합의까지 완료,
  새 head CI 확인 전이므로 in-progress다. 성공 후 같은 이슈에 근거를 추가해 resolved로
  바꾸고 INDEX 열린 표에서 제거한다. 다른 통과 로컬 검사는 불필요하게 반복하지 않는다.
- 새 guest 호스트는 아직 생성/배포하지 않았다. 이름 조회는 worker-not-found·인증 오류 없음,
  전용 config dry-run exit0·No bindings 확인. private 안전 요약은 임시
  `pedagogy-r7-guest-deploy-moykhsn1/safe-summary.json`에 있으며 raw CLI 로그/토큰은 출력하지 않는다.
  생성 artifact는 `dist/guest-preview/dist/public`, config는 `dist/guest-preview/wrangler.toml`.
  정확 manifest SHA는 위 정상 로그의 311046… 값과 같다.

### 다음 실행 순서

1. PR30 최신 댓글/head28189ae·필수4job/Sonar를 확인한다. 실패면 실제 근거만 조사한다.
   grep 수정 CI가 성공하면 REV152를 같은 파일에서 해소한다.
2. 검토된 정확 head를 병합하고 merge main CI·Pages를 확인한다. 인계 문서는 별도 보존하며
   PR30 코드 전체를 중복 cherry-pick하지 않는다. 기본 checkout을 전환하지 않는다.
3. 무료 guest 배포 직전 fresh build/verify와 이름 충돌을 확인한다. 생성 guest config만 사용해
   새 `pedagogy-guest-preview`를 배포하고 CLI version ID·공개 URL을 기록한다.
4. `GUEST_HOST_BASE=https://pedagogy-guest-preview.<label>.workers.dev node scripts/check-guest-host.mjs`
   로 전체233자산/SHA·별칭/HTTP헤더/private404/iframe를 확인한다. 새 host 실패 시 전용
   config의 리소스만 중지/삭제한다. 기존 production Firebase/Worker/Pages는 변경하지 않는다.
5. 운영 체크리스트와 레일에 실제 원격 증거를 추가한다. 분리 staging403/프로젝트 quota,
   App Check·실자료 이관/high 구현·R8 실제 AI/ACK/실기기/인간 관찰은 미결로 유지한다.

도메인 구매 보류·무료 기본 주소 우선·실제 자료 이관 금지·transcript.txt 접근 금지를 유지한다.
다음 기본 담당은 레일의 GPT-6 Sol / medium이다. 이번 인계는 운영 완료가 아니다.


## 2026-10-27 재개 — 대상 CI 통과·공백 정리

28189ae의 Verify40125969663에서 새 guest 단계는 성공해 REV152를 대상 증거로 resolved로
닫았다. secrets/cross-platform/hwpx/Sonar도 성공했으나 verify 전체는 마지막 공백 검사에서
build-guest-preview.mjs와 guest-preview.test.mjs의 새 EOF 빈 줄 때문에 실패했다.
두 빈 줄만 제거했다. 앞선 git diff --check가 새 untracked 파일 전체를 포함하지 못했던
검증 범위 문제이며 이제 origin/main...HEAD 및 working diff를 모두 확인한다.
제품 동작 변경 없이 새 head CI를 기다린다. c497888 인계 문서는 별도 branch에 보존돼 있다.


## 2026-10-27 Claude 배포 경계 협의

사용자가 Claude 검토를 직접 허용해 로그인 상태 확인 뒤 저장소 foreground 읽기 전용
래퍼를 opus/high로 2회 호출했고 모두 정상 완료했다. 제한 Read/Grep/Glob·plan·세션 비저장,
쓰기/원격/중첩 호출 없이 지정6파일과 새 이견만 검토했다.
[사용 스킬](/Users/huryul/.codex/skills/claude-codex-collaboration/SKILL.md)의 과거3회상한보다
최신 사용자 AGENTS의 상한 없음/중복질문 금지가 우선한다.

1차 조건부 합의에서 G1 deploy cwd를 생성 guest 폴더로 고정, G3 정확10007/인증오류없음만
신규생성·기존/불명확대상이면deploy/delete금지, G2 원격framing의top-level양성대조를 제시했다.
G1/G3은 위 [운영 절차](../../../docs/R7-GUEST-PREVIEW-RUNBOOK.md)에 명시했다.
G2는 기존 checker의 top-level id만 제거해도 exit0인 실제 검사 공백을 Codex가 재현해
REV153으로 등록하고 count1 단언·local-only DOM변이·CI exit1/문구 확인을 추가했다.
순차 정상0/대상제거1/HTTP헤더제거1/원격주입거절1을 확인했다. 공개 runtime 원본은 수정하지 않았다.

2차 Claude 최종 합의: G2 코드/CI 공백 해소, G1/G3 명시 절차로 조건 충족, 미합의 없음.
다만 Claude 파일 도구가 cwd 밖 임시 로그를 읽지 못했으므로 로그 수치를 독립 확인한
판정으로 과장하지 않는다. Codex가 실제 로그/exit를 대조했고 민감값 없는 원문 probe 로그와
요약을 reviews/audits/2026-10-27에 보존했다. 새 CI/원격 전 운영 성공을 주장하지 않는다.
REV153은 새 CI·원격 증거 후 같은 파일에서 해결 처리한다.

참고: head06e9029의 Verify40424583729는 필수4job 및 Sonar 성공이다. 양성대조 보완은
그 후속 변경이므로 새 head CI로 확인한다. 이전 제품/저장 전체 회귀를 로컬에서 반복하지 않았다.


## 2026-10-27 배포·원격 검증 완료 체크포인트

- PR30 최종head88c86d545ef9dc77585b866a8b6030a7aecfae90 Verify40427720314 필수4job/Sonar 성공,
  merge d65e759136c4bb79b2f6b0a91943c870d4b4e20f Verify40430188686 필수4job/guest단계 성공.
  Pages 정확merge built·핵심5파일 bytes/SHA 일치다. gh watch가 비정상 종료했지만 최종 API의
  정확head/job 성공을 대조했으며 이를 CI 실패/재실행으로 오인하지 않았다.
- 새 https://pedagogy-guest-preview.dbruddl79.workers.dev 배포 성공. version
  b22da34b-4d78-469c-be22-a2d776b9e811, manifest234/제공233,
  SHA311046226308c8356c39e7e97626b0cfd360721043b6d1899546484dd00a6fa3.
  배포직전HEAD/clean tree/정확CI/fresh build/check를 확인했고 cwd=dist/guest-preview,
  CLI/config절대경로, API code집합이정확10007/인증오류없음일때만 신규생성했다.
  생성확인/versionID/URL 메타데이터를 기록했으며기존/불명확대상을덮어쓰거나삭제하지않았다.
- 원격 checker exit0: 모든233자산/SHA·aliases/HTTP CSP/framing·private404·top-level 양성
  대조·same-origin mock/cross-origin index 차단 통과. 근거 reviews/audits/2026-10-27.
  REV153은 CI/원격까지 충족해 같은 파일에서 resolved로 닫았다.
- main Sonar 정확d65e759 분석은 new_security_rating5/ERROR다. 기존 출시 차단을 유지하고
  PR head Sonar/네 CI job 성공과 구분한다. Python 로컬 CA 오류는 Node의 TLS 검증 유지
  fetch로 Pages bytes를 대조해 환경 문제로 구분했으며 인증서 검증을 끄지 않았다.
- 실제자료/production Firebase·Worker·Rules·Pages설정·도메인/결제는변경하지않았다.
  rollback은준비만했고실제삭제/복원은하지않았다. 분리SDK403/새projectquota는마지막조회이후
  해소증거없음. AppCheck·원문무손실이관/high·실계정ACK·실기기/한글/인간관찰은미결이다.
- c497888 이전 인계는 이 branch에서 문서 merge로 보존했으며 PR30 코드 중복cherry-pick은없다.
  현재인계 branch codex/r7-guest-host-verified의 문서후속커밋에별도CI완료를주장하지않는다.
  다음기본담당Solmedium, 실제자료이관구현은별도high·독립검토게이트다.


### Claude 3차 최종 증거 대조 — 종결

cwd 안에 보존한 정상/RED 원문·head/main CI4job·배포 안전 메타데이터·원격 결과·Pages
5파일·main Sonar 상태·REV153 처리 기록을 Claude opus/high가 읽기 전용으로 대조했다.
구체적 불일치 없음, 합의/미합의 없음, REV153 resolved 및 guest 호스팅 부분 완료가
정확하다고 최종 판정했다. [최종 답변](../../audits/2026-10-27/claude-final-verdict.md).
이번 범위 Claude 실제 호출은 3회 모두 정상 완료이며, 이전 세션 한도 실패와 구별한다.

그 판정 당시 PR Sonar 통과/Pages built 자체는 서술 근거였다는 한계도 그대로 보존했다.
이후 Codex가 같은 revision의 실제 API 필드를 다시 대조해 publication-checks.json에
추가 보존했다. 기존 source bytes/CI/배포 증거는 재사용했고 불필요한 회귀를 반복하지 않았다.
원격 완료가 분리 staging·AppCheck·자료 이관·R7/8 운영 전체 완료를 뜻하지 않는다는
한정은 유지한다. 신규 runtime 코드 변경은 없고 최종 branch는 문서/감사 후속 인계다.


## 2026-10-27 새 채팅 재개 체크포인트 — staging 접근 복구

사용자 요청으로 긴 대화를 새 채팅으로 넘긴다. 이 체크포인트 전 HEAD는
`81bcf8273d79411588f723db30fd48467e0d5fbf`, branch는
`codex/r7-guest-host-verified`이며 upstream과 같고 작업 트리는 깨끗했다.
이 후속 변경은 인계/레일 문서뿐이다. PR30 검증 revision과 문서 branch CI를 혼동하지 않는다.

### 변하지 않는 제약

- 실제 worktree `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`에서 계속한다.
  기본 checkout `/Users/huryul/개발/pedagogy-main`은 전환하지 않는다.
- `transcript.txt`는 읽기·수정·추가·생성 금지다.
- 최신 사용자 AGENTS가 디스크의 오래된 왕복 3회 제한보다 우선한다. 횟수 상한은 없으나
  새 근거 없는 같은 질문 반복·상대 에이전트의 중첩 호출은 금지다. 한 번에 한 구현자다.
- 구현·독립 검토·검증·병합·배포는 기존 사용자 승인 범위에서 진행한다. Claude도 사용 가능하다.
  도메인 구매 보류, 무료 기본 주소/호스팅 우선은 유지한다. AI/DB/Storage 전체 무료라는 뜻이 아니다.
- 자격 증명·OAuth URL/state·원시 CLI debug/env·계정 객체는 출력하거나 커밋하지 않는다.
  `firebase login:list --json`도 계정 토큰이 포함될 수 있어 사용하지 않는다.

### 새로 확인한 외부 접근 상태

- 새 채팅 인계 직전 안전한 계정 메타데이터만 다시 조회했다. CLI 계정은 **1개**이며
  기본 계정 fingerprint `d8bbf1f8ef96`이 유지된다. 다른 staging 계정 추가 완료 증거는 없다.
- 마지막 원격 조회에서 그 계정의 Firebase 프로젝트 목록에는 production만 보였고,
  `pedagogy-ai-staging` 앱/SDK는 403 PERMISSION_DENIED였다. invalid_grant는 없었다.
  GCP 프로젝트 목록은 200/6개 ACTIVE였지만 대상 staging은 없었고, 대상 ID/번호의 GET은
  403이었다. 이것만으로 프로젝트 삭제/부재/권한 원인을 확정하지 않는다.
- 과거 실제 staging 증거는 존재한다. `reviews/issues/2026-09/2026-09-14-gemini-staging-provider-request-error.md`
  에 두 번째 Google 계정(`/u/1`) 사용 기록이 있고,
  `reviews/handoffs/2026-09/2026-09-14-ops6b-staging-preflight.md`에 생성/등록 기록이 있다.
  project number `450368559700`, web app `1:450368559700:web:5e8f86074f042dd7d12bc1`이다.
- 사용자가 여러 번 로그인 창 재열기를 요청했다. 마지막에는 새 CLI `login:add` 흐름의
  공식 Google OAuth URL에 `prompt=select_account`만 추가해 Chrome 새 창으로 열었다.
  이전 완료 흐름들은 같은 계정을 갱신했을 뿐이었다. 마지막 도구 세션 98424는 인계 시
  `Unknown process id`라 결과를 회수할 수 없다. 살아 있는 로그인 대기로 취급하거나
  완료된 OAuth URL을 다시 열지 않는다. 인증 성공/새 계정 추가도 주장하지 않는다.
- 새 Firebase 프로젝트 `pedagogy-web-staging` 생성의 과거 code8 quota 거절은 여전히
  미해결이다. 목록 6개만으로 생성 quota 여유를 추정하지 않는다. 관련 없는 프로젝트를
  삭제/재사용하거나 production 설정을 분리 staging으로 표시하지 않는다.
- 현재 인증 진단은 private 임시 파일만 사용했다. 토큰/원시 로그는 저장소에 넣지 않았으며
  제품 코드·실자료·production·결제/IAM 변경은 없다. 임시 로그의 영구 보존을 가정하지 않는다.

### 재개 순서와 모델

1. 최신 사용자 AGENTS → reviews/README.md·INDEX.md → 통합 레일 현재 위치 → 이 체크포인트를 읽는다.
   기존 완료 CI/원격 검증은 관련 변경 없이 반복하지 않는다.
2. 기본 담당은 **GPT-6 Sol / medium**. 먼저 CLI 계정 수와 대상 staging 접근을 안전하게
   확인한다. 새 계정이 있으면 `--account`를 명시하고 기본 계정은 유지한다.
3. 여전히 계정 1개/403이면 다른 staging 계정의 사용자 인증 또는 IAM 권한 부여가 외부 조건이다.
   필요할 때만 새로운 유효 로그인 흐름으로 창을 열고, 같은 계정 재로그인을 해소로 기록하지 않는다.
   사용자가 답할 수 없으면 해당 인간 입력은 미결로 남기고 독립 작업을 계속한다.
4. 접근 복구 후 프로젝트/웹 앱 identity부터 읽기 전용으로 확인하고 분리 설정·App Check·origin을
   준비한다. firebase-tools management getProject는 API enable 부수효과가 있어 단순 진단에 쓰지 않는다.
   유료 AI 호출/C1 결제 전제·승인 범위는 별도 게이트를 유지한다.
5. 외부 대기 중 R8 남은 로컬 검증(300문항 성능, 폰트/이미지 실패, 오래된 렌더 완료 역전/복구)을
   기존 검사와 대조해 필요한 묶음만 진행할 수 있다. 실계정 ACK·유료 AI·시스템 인쇄/한글·Safari/iPad·
   인간 관찰 완료로 확대하지 않는다. 실제 자료 이관 구현은 별도 high·독립 검토가 필요하다.
6. main Sonar 정확 d65e759의 new_security_rating=5/ERROR는 기존 출시 차단으로 유지한다.
   R7/R8 운영 전체 완료, source private 전환, 실자료 이관/롤백 완료는 선언하지 않는다.

현재 실행 환경에서는 writable-root symlink 때문에 기본 sandbox 실행/브라우저 자동화가 실패했다.
정상적인 작업별 exec escalation으로 진단했으며 전역 sandbox 설정은 변경하지 않았다.
새 채팅에서도 동일 실패가 재현되면 승인된 개별 호출로 처리하고 전역 설정으로 우회하지 않는다.


## 2026-10-27 후속 — R8 로컬 검사·새 인증 timeout

[HANDOFF-202](2026-10-27-tests-r8-render-recovery.md)에 로컬 렌더 복구·300문항 제품 doPrint
정합 정상12/목표 RED6·필수회귀175와 독립 검토의 후속 상태를 기록한다. 제품 소스는 그대로다.
사용자가 로그인 가능하다고 답해 새 공식 Firebase 추가 계정 흐름을 Chrome 계정 선택으로 열었지만
10분 timeout으로 끝났고 완료 callback은 없었다. 종료 뒤 CLI 계정1개·기본 fingerprint
`d8bbf1f8ef96` 유지를 확인했다. 새 흐름의 세션/URL도 만료 상태이므로 재사용하지 않는다.
분리 Firebase 접근 복구, App Check·실자료 이관/high 구현·main Sonar·R7/8 운영 전체 게이트는
여전히 남는다. 기본 checkout 전환·transcript.txt 접근·production/결제/IAM 변경은 없다.

최신 후속: 첫 창 미표시/오류 보고 뒤 Chrome 일반 열기의 **새** 인증 흐름은 실제 완료됐다.
계정2개·기본계정 유지, 추가계정의 staging project/web config GET200과 과거 number/app identity
일치를 확인했다. 이제 다음은 **접근 재시도**가 아니라 기존 staging의 자원/Auth·App Check 준비다.
Firestore403/SERVICE_DISABLED·bucket 없음·Google provider GET404·billing false를 구별한다.
최종 근거는 [HANDOFF-202](2026-10-27-tests-r8-render-recovery.md)의 접근 복구와 감사 JSON이다.

## 새 채팅 재개 체크포인트 (2026-10-29 · 출시 전2 실제 출력)

- 실제 worktree는 계속 `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`. **현재 branch는 `codex/prelaunch-output-verified`**다. 원본 `codex/r7-guest-host-verified`/9fc2dde를 보존하고 main 기준 대체 PR38을 만들었다. 기본 checkout 전환/force-push/기존 이력 rewrite 없음. transcript.txt는 접근 금지 유지.
- 실행 원본은 통합 레일 상단 출시 전1~6/후1~4. 세 기능(편집·출력/로그인·클라우드·이미지/AI) 첫 출시 포함, 무료/유료 미정·도메인 구매 보류. 전체 staging 구축을 먼저 완성하는 순서는 아니다.
- 현재 최신은 [HANDOFF207](2026-10-29-mock-hwpx-total-pages.md). 실제 Chrome/Safari2쪽 PDF, 시험지 Mac 한글9문항3쪽/일반 문서3표본4쪽 native/왕복 저장을 확인했다. 사용자 지적 제목치우침 REV159와 고정총수20 REV158을 수정, 정상/RED6·회귀175·Claude 독립 최종 합의. 한글 시험 창/앱은 정리 완료.
- PR37은 제품 CI/PR Sonar 성공·secrets만 Sonar object key 식별자75건으로 실패. 인증값이 아님을 확인해 증거5JSON의 필드명만 sonarObjectId로 정규화(값/역변환동일), 같은 Gitleaks0건. 검사 규칙/ignore/CI 변경 없음. 원본 브랜치는 보존·PR37은38로 대체하고 닫았다.
- PR38 head e3b402f 필수4개/PR Sonar 성공→merge0fbe604, Pages40831760039 built/7파일 일치·공개 HWPX 자동총수/제목정렬 확인. **main Verify40831760704 필수4개 success·동일 revision Sonar gate OK**(207). guest Worker 갱신 없음.
- Sonar 기존23건 판정/원격반영은206 완료(오탐17/기존 제한적 수용6), REV147은 별도 추적. Sonar 새7CODE_SMELL은 보안결함이 아니며 M1 범위. 보안/삭제/저장 검증은 도구와 무관하게 유지한다.
- 다음은 전2 지원 약속·실제 iOS/Windows·실계정 문서복귀 등 남은 증거 대조와 전3 계정/파일의 최소 검증 준비다. native 출력 성공을 계정/AI/전체 출시 완료로 세지 않는다. 실제 자료 이관/저장·권한 핵심 변경은 high+독립 검토 게이트 유지. 사용자 승인된 일반 로그인/계정선택은 계속하되 새 비용/새 보안 접근은 별도 구체화한다.

- 2026-10-29 후속: 공개 문서 편집기 HWPX 버튼은 backend 차단 상태에서도 동작했고 파일 ZIP이 실제 Mac 한글 검증 기본 표본과 동일했다. 로컬 서버 필수라는 낡은 안내 REV160은 문구만 정정, 로컬 UI/Claude 독립 검토 완료. 후속 PR/Pages 반영은 HANDOFF207에서 추적한다.
- 같은 출시 전2 문서 출력에서 REV161 GIF 그림 누락도 재현·수정했다. 브라우저/Python 미지원5종 거절·PNG/JPEG 정상/ZIP 정합·서버 폴백·HWPX12·회귀175·Claude 최종 합의. 후속 PR/Pages 확인은207을 따른다. 실계정·iOS/Windows·AI/전체 출시는 여전히 미완료.

- 2026-10-29 PR40 최종: head f098170 CI4/PR Sonar 성공→merge1bae434, main CI4/Pages built/동일 revision Sonar OK, 공개 문서 UI GIF 거절·PNG 다운로드 그림 BinData1 확인. [HANDOFF207](2026-10-29-mock-hwpx-total-pages.md)·[증거](../../audits/2026-10-29/prelaunch-print/pr40-final-verification.json). 새 PNG/JPEG 표본 native 한글, Windows/iOS·실계정은 여전히 미검증.
- 사용자 후속 REA 질문: 현재 출시 코드와 분리된 H1 연구 브랜치 `claude/h1-hwp-research`/10a0914의 분석·사이트 설계를 확인하고 [출시 적용 계획](../../../docs/PRELAUNCH-HWPX-REA-RENDER-PLAN.md)을 작성했다. 현 main에는 연구 브랜치의 REV129/130 수정이 병합되지 않았으므로 재현/범위 판정 뒤 전2 작은 묶음으로 다룬다. REA 재분석이나 H1 전체 병합을 완료로 세지 않는다.
