# R6 secret scan·의존성·도구 고정

- ID: `HANDOFF-2026-198`
- 날짜: `2026-10-23`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `tests | docs | worker`
- 관련 이슈: `REV-2026-147`, `REV-2026-148`

## 변경 내용

R6에서 Gitleaks diff scan을 추가하고, 실제 사용하는 Firebase CLI/Wrangler/lxml을 고정했다. Firebase 13 + Rules Unit Testing 6은 Dependabot 대체 PR #20/#22의 peer 일치 및 도구 호환성을 위한 채택이며 npm audit 개선으로 주장하지 않는다. Worker 실행 주석에는 저장소 루트 기준 config를 명시했다. npm 패키지는 프로젝트 lockfile/node_modules에 설치했고 Gitleaks 실행본·로그는 임시 경로에 보관했다. 글로벌 도구 설치는 없으며 제품 runtime 동작은 바꾸지 않았다.

## 의존성·Dependabot 판정

| PR | 판정 | 근거 |
| --- | --- | --- |
| #1 checkout 7.0.1 | R6 적용 | Node 20 런타임 제거에 따라 checkout v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`로 갱신. v7의 fork checkout 제한은 `pull_request_target`/`workflow_run`에만 적용되며 현재 trigger와 무관. 기존 `fetch-depth: 0`, `persist-credentials: false` 유지. |
| #2 setup-node 7.0.0 | R6 적용 | Node 24 지원 v7.0.0 `820762786026740c76f36085b0efc47a31fe5020`으로 갱신. ESM 전환 외 주요 변경인 자동 cache 및 dummy `NODE_AUTH_TOKEN` 제거는 workflow가 cache/`registry-url`을 쓰지 않아 영향 없다. 프로젝트 Node 22 테스트 버전은 유지. |
| #3 setup-python 7.0.0 | R6 적용 | Node 24 지원 v7.0.0 `5fda3b95a4ea91299a34e894583c3862153e4b97`으로 갱신. 제거된 `pip-install` input은 쓰지 않으며 Python 3.12 입력은 유지. |
| #4 Playwright 1.63.0 | 대체됨/닫힘 | 후속 #21이 1.64.1로 대체. |
| #5 setup-java 6.0.1 | R6 적용 | deprecated/no-future-updates v4에서 supported v6.1.0 `b843ebf9b913146b38da2eaa7aeddf76074ae1ad`로 갱신. 공식 v6의 JDK distribution checksum 검증을 포함하며 `distribution: temurin`, Java 21 입력은 유지. |
| #6 upload-artifact 7.0.1 | R6 적용 | Node 20 제거에 따라 Node 24 지원 v7.0.2 `cf430e030ddbb5b0abf93d22962f4752f3646cd9`로 갱신. 기존 artifact 이름·경로·`if-no-files-found: ignore` 입력은 유지. |
| #7 Firebase 12.19.0 | 대체됨/닫힘 | 후속 Firebase 13 / Rules Unit Testing 6 쌍(#20/#22)으로 peer conflict를 해결. |
| #17 pixelmatch 8.0.0 | 보류 | 시각검사 핵심 직접 의존성의 major update. 7.2.0 사용·기준본 호환 검증 없이 변경하지 않음. |
| #19 pdfjs-dist 6.4.299 | 보류 | 앱 runtime은 npm 패키지가 아니라 `vendor/pdfjs` 6.3.289 및 짝 worker/asset이다. 버전 일치·공개파일 갱신 검증 없이 패키지만 올리면 불일치. |
| #20 firebase 13.0.0 | 채택 대체 | Rules test peer 요건을 #22와 맞춤. 공식 npm latest patch 13.1.0까지 적용. |
| #21 Playwright 1.64.1 | 보류 | 테스트 전반에서 쓰는 브라우저 실행기 업데이트. 기존 green은 과거 head라 새 head CI에 맡기며 runtime/브라우저 버전 영향은 별도 검증. |
| #22 rules-unit-testing 6.0.0 | 채택 대체 | Firebase 13과 peer가 맞는 쌍이다. #20 단독은 Firebase 13이 기존 testing 5와 peer 충돌, #22 단독은 testing 6이 기존 Firebase 12와 충돌해 각각 ERESOLVE했다. 둘을 함께 13/6으로 맞춘 현재 설치는 peer 정합성이 있다. |

Actions 공식 대조 범위: 기존 SHA들의 공식 commit metadata와 current release/README 대조 뒤 Node 20 기반 5 action을 현재 supported pin으로 갱신했다. GitHub는 2026-09-23 Node 20 action runtime을 제거했다. 후보 PR 버전에 고정하지 않고 공식 태그 ref API의 실제 commit SHA를 확인했다(checkout v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`; setup-node v7.0.0 `820762786026740c76f36085b0efc47a31fe5020`; setup-python v7.0.0 `5fda3b95a4ea91299a34e894583c3862153e4b97`; setup-java v6.1.0 `b843ebf9b913146b38da2eaa7aeddf76074ae1ad`; upload-artifact v7.0.2 `cf430e030ddbb5b0abf93d22962f4752f3646cd9`). `contents: read`, runner, action inputs, checkout `fetch-depth: 0`/`persist-credentials: false`, Python 3.12, Java 21 및 프로젝트 Node 22는 유지했다. Node24 action runtime과 프로젝트 Node22 테스트 런타임은 별개다. source: [Node20 removal](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/), [checkout changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md), [setup-node README](https://github.com/actions/setup-node/blob/main/README.md), [setup-python releases](https://github.com/actions/setup-python/releases), [setup-java releases](https://github.com/actions/setup-java/releases), [upload-artifact releases](https://github.com/actions/upload-artifact/releases). No independent vulnerability database/CVE-level exhaustive audit was performed.

### CDN/SRI and license inventory

`index.html:47–95` directly loads pinned KaTeX CSS/JS + mhchem/auto-render, font-kopub CSS, Pretendard CSS, SortableJS 1.15.2, and Firebase JS SDK 10.12.0 five compat modules; each direct tag has `integrity` and `crossorigin`. `document-editor.html:13–20` directly loads Pretendard, KaTeX CSS/JS, and Firebase app/auth/app-check, all with SRI. `mock-exam-editor.html:26–32` has SRI on KaTeX CSS/JS, but its `style` uses a non-SRI Pretendard `@import` and three external WOFF URLs (HANBatang regular/bold and HCRDotum) at lines 42–64. CSS-loaded child fonts (including KoPub/Pretendard where applicable) do not carry per-file SRI. Static Firebase scripts may fetch reCAPTCHA and provider child assets; these dynamic children remain outside the static-tag SRI boundary.

`npm run check:static` passed. Its actual CDN assertion is narrow: `scripts/check-static.mjs:442–453` asserts KaTeX→mhchem→auto-render order and mhchem SRI; it does not enumerate every external tag or validate font licenses. Manual URL/tag inventory above found same Firebase 10.12.0 across the two Firebase pages. `LICENSE:22–35` records major dependencies and licenses; this R6 change adds the direct CDN SortableJS MIT attribution. It lists Pretendard OFL and KoPub license. The `projectnoonnu/noonfonts_2104` and `projectnoonnu/noonfonts_four` repositories expose no GitHub license metadata for HCR fonts; do not interpret the public CDN path as commercial authorization. Rights-holder/license confirmation remains a launch-gate gap. The static tag version/SRI values were inspected in files; remote asset bytes were not re-fetched and recomputed during this R6 pass.

## 비밀 스캔과 위험 판정

- Gitleaks v8.30.1 official release tarball SHA-256을 검증 후 `/private/tmp`에서 실행했다. 전체 이력 기준선은 한 번만 수행했고, git pathspec으로 root 및 모든 깊이의 `transcript.txt`를 제외했다. raw finding은 출력·기록하지 않았다.
- 6 findings: 과거 `.tmp.driveupload` 2건, 공개 Firebase web config 3건, Sonar project metadata 1건. `.tmp.driveupload` 두 finding은 commit `42b62d8`의 같은 `CLAUDE_CODE_MESSAGING_TOKEN` field로 분류됐다. 이는 과거 세션 IPC auth token 노출 후보이며 무해 false positive가 아니다. parent 독립 triage는 당시 socket들이 현재 없고 현재 환경에도 변수가 없음을 확인했다. 공식 설명은 [Claude Code environment variables](https://code.claude.com/docs/en/env-vars)다. 현재 악용·원격 API 권한 근거는 없고, 과거 공개 이력은 복구할 수 없는 제한된 잔여 로그 노출로 REV-147(P2)에 남겼다. 검증·회전·외부 전송·전체 이력 rewrite는 하지 않았다.
- 독립 리뷰에서 Gitleaks 8.30.1의 inline allow, repository `.gitleaks.toml`, root `.gitleaksignore`, 무효 range 진단의 exit 0 우회를 재현해 REV-148에 기록했다. Workflow는 임시 `useDefault=true` config와 ignore 경로, `--ignore-gitleaks-allow`, root `.gitleaksignore` 거부, BASE/HEAD 형식·객체·git log 사전 검증, stderr 비어있음 검사를 적용했다. 부모 독립 최종 probe는 실제 workflow의 13개 경계를 확인했다. clean 0, secret/inline/broad config 1, ignore fingerprint·broken symlink·invalid base/head·empty/zero/malformed range·git preflight 실패·Gitleaks stderr+exit 0은 2로 fail-closed였다. REV-148을 resolved 처리했다. 상세 근거는 같은 이슈에 연결했다. fixture 경로는 금지 파일명을 생성하지 않았다.
- GitHub API(2026-10-23): `secret_scanning` 및 push protection enabled, Dependabot security updates disabled. `non_provider_patterns`와 `validity_checks` disabled. 설정 변경은 하지 않았다.

## 버전 선택과 audit 잔여

- Firebase CLI `15.34.0` (공식 [firebase-tools releases](https://github.com/firebase/firebase-tools/releases)), Wrangler `4.151.1` (공식 [Workers SDK releases](https://github.com/cloudflare/workers-sdk/releases)), HWPX converter `lxml==6.1.3` ([PyPI release](https://pypi.org/project/lxml/6.1.3/)). Gitleaks `8.30.1`은 [공식 release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) checksum 사용.
- 최종 `npm audit`은 12 findings (8 high, 4 moderate, 0 critical), exit 1. CLI 종속 `braces/chokidar`, `gaxios/uuid`, `pubsub/opentelemetry`와 Rules test SDK의 Firebase/Firestore→grpc-js advisories다. 실행 경로는 로컬/CI emulator와 테스트 도구이며 CI는 외부 PR에 read-only 권한만 받고 secrets/deploy credentials를 주지 않는다. 브라우저의 production Firebase SDK는 정적 CDN URL/SRI 별도 경로이며 이 npm tree에 포함되지 않는다. 과금 API 호출이나 실제 project 배포는 검사 대상이 아니었다.
- npm이 제안한 수정은 firebase-tools 14.23 또는 Firebase 9.14 메이저 하향이다. 현재 호환 vendor 범위에 맞지 않는 override도 하지 않았다. 따라서 잔여 advisory는 R6의 미해결 위험으로 보존하며, 도구 공급자가 호환 업데이트를 내면 재검토한다. R7 운영 증적·설정 변경이 완료됐다는 뜻은 아니다.

## 검증

- 재사용: merge commit `7c6386e` CI run `39761068480`의 `hwpx/cross-platform/verify` 성공. runtime 동일이라 전체 제품 회귀를 반복하지 않았다.
- 신규 변경 영향: `npm run check:rules` JDK 21 통과; HWPX 12검사 및 browser/Python parity 통과; Wrangler staging `--dry-run` 성공; `firebase --version` 15.34.0, `npm exec --offline -- wrangler --version` 4.151.1 확인.
- Gitleaks checksum, one-time baseline, 기존 영향검사, final npm audit, Ruby YAML parse를 확인했다. scanner 정책 13개 경계는 독립 재검증되어 REV-148을 해결했다. Action migration 뒤 `npm run check:static`, `npm run check:review-hygiene`, `git diff --check` 통과. 신규 head 원격 CI는 부모의 최종 독립 검토 뒤 실행 예정이다.

## 위험과 검토 요청

독립 검토자는 scanner event/base semantics와 transcript 제외가 실제 diff에서 작동하는지, 설정/ignore/inline 정책 및 scanner git 진단 fail-closed 경계, 갱신된 Action SHA와 유지한 입력/권한, config별 Wrangler 주석, audit advisory 범위, Firebase 13/Rules testing 6 조합을 확인해 달라. 현재 audit 잔여와 historical token issue는 결과에 포함해 R7 진입 차단 여부를 판정한다. 새 Actions SHA에 대한 원격 CI는 변경 head의 단일 계획 CI에 포함한다. 외부 PR 병합/닫기, commit/push는 부모 담당이다.

## 검토 기록

- 2026-10-23 · 구현에 참여하지 않은 독립 Codex `/root/r5_gate_review`: **합의 — R6 구현·독립 검토 통과. 새 head 필수 CI 성공 후 R6 완료 및 R7 준비 진입 가능. 미합의 — 남은 재현 결함 없음.** 실제 workflow 본문으로 정상/실패 13경계를 독립 확인했고 공식 tag API 및 각 SHA의 `action.yml`로 Actions 5개 tag 일치·Node24를 검증했다. 프로젝트 Node22/Python3.12/JDK21·권한·입력·credential 비저장 유지, Firebase13/Rules6 peer와 도구 pin도 확인했다. setup-java deprecated 표시는 사용하지 않는 `jdkFile` 입력에 한정된다.
- 검토 workflow SHA-256: `d0eea7efaa59293b713f54131b70e89a6b551ac0d2ebf8b77e7ef57946a0b0d6`; scanner 본문 SHA-256: `e562d56fb9aac975211e24fc8c35a4c8d3e9f56e4b765f13791decd45b577240`. 증거: `/private/tmp/r6-independent-final-workflow-probe.py`, `/private/tmp/r6-independent-final-0xms0765/*.meta.json`.
- audit 12건과 REV-147(P2 open)은 기록된 도구·세션 토큰 범위에서 R7 준비를 막을 새 근거가 없지만 해소되거나 출시 승인된 것은 아니다. CDN 하위 SRI·글꼴 권리·운영 설정은 후속 게이트에 남긴다. 비차단 보완으로 architecture의 SRI 문구를 실제 예외에 맞게 한정했다. 다음: 변경 head의 `secrets/verify/cross-platform/hwpx` 및 Sonar CI 확인 → 병합 → R7 준비.
