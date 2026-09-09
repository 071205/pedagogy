# 리뷰 현황

마지막 정리: 2026-09-09

## 열린 이슈

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-074` | `P2` | macOS 폴더 아이콘 파일이 새 Git 폴더에서 재발해 refs를 오염시킨다 | `issues/2026-09/2026-09-09-rules-macos-icon-files-corrupt-git-refs.md` |
| `REV-2026-075` | `P2` | AI 문서에 들어갔다 나오면 로그인이 안 된다(재현 절차 없음) | `issues/2026-09/2026-09-09-document-editor-login-after-return.md` |

독립 보안·안정성·효율성 분석과 수정 설계: [종합 보고서](audits/2026-09-08/REPORT.md).
이번 9건은 `ae5740e`에서 재현 후 HANDOFF-2026-067로 수정·안전 회귀를 남겼다.
Claude의 후속 검토 `HANDOFF-2026-068`이 연 3건은 `HANDOFF-2026-069`로 수정·회귀를 보강했다.
라이브러리·브라우저 HWPX 최신 구현은 `HANDOFF-2026-073`에서 독립 검토하고 8건을 수정했다.
그 8건은 보고자·수정자가 같아 `HANDOFF-2026-074`가 **독립 검증**했다 — 유효하며 제품 수정은
없었고, 검사 쪽 결함 `REV-2026-051` 하나를 열고 닫았다. 같은 커밋에서 `libraryCloudSchema`를
**0(A단계)** 으로 내렸다(새 Rules 운영 배포가 확인되지 않음).

[`docs/MOCK-STYLE-DESIGN.md`](../docs/MOCK-STYLE-DESIGN.md) 의 실물 조판 계획은
**여섯 단계가 모두 끝났다**.

**영어 과목은 끝났다**(`-103`) — [`docs/ENGLISH-SUBJECT-DESIGN.md`](../docs/ENGLISH-SUBJECT-DESIGN.md)
의 목록이 **전부 닫혔다** — ② 는 실물(2009 수능)을 재 보니 **가정이 틀렸고**(네모는 한 줄이라 이미 되고 있었다) 진짜 빠진 것은 **짝 선지**였다. 최근 인계는
`HANDOFF-2026-038`(토대) · `-039`(문단 모델) · `-040`(순서 라벨) · `-041`(듣기 답란) ·
`-042`(묶음 안내) · `-043`(조판 갈래) · `-044`(안내문 상자) · `-045`(그림 선지) ·
`-047`(인쇄 속도 · 그림 도착 전 측정) · `-048`(깨진 그림 인쇄 대기 제거) ·
`-049`(발문 별행 수식 탭·왼쪽 정렬) · `-050`(범용성 설계) · `-051`(설계 독립 검토) · `-052`(검토 반영) · `-053`(1단계 연기 검사) · `-054`(2단계 인앱·pagehide).

## 검토 대기

검토 요청: [HANDOFF-2026-110](handoffs/2026-09/2026-09-10-review-request-subjects.md) — `-103`·`-105`·`-107`·`-108`·`-109` 다섯 건을 한 자리에 모았다. **내가 설계의 가정을 뒤집은 곳**(영어 ② 네모는 세로 2단이 아니라 한 줄이었다)과 **확인하지 못한 다섯 가지**(특히 인쇄 넘침 보정이 표를 보는가)를 적어 두었다.

검토 요청: [HANDOFF-2026-104](handoffs/2026-09/2026-09-10-library-ux-independent-review-and-fixes.md) — `-097`·`-099`·`-101`·`-102` 독립 검토, 모바일 긴 목록 탐색과 설정 출처 복귀 수정. Claude 재검토 요청 네 항목을 남겼다.

검토 요청(설계 · 1~3단계는 `-097` 로 구현됨): [HANDOFF-2026-096](handoffs/2026-09/2026-09-09-library-ux-design.md) — 라이브러리 화면 재설계. 한컴 고지 위치 · 전체 화면 데이터 설정 · 모바일 일반 흐름 탭바에 대한 답은 [HANDOFF-2026-098](handoffs/2026-09/2026-09-09-library-ux-design-decisions.md)에 확정했다. 설계 본문은 `docs/LIBRARY-UX-DESIGN.md`.

검토 완료: HANDOFF-2026-071은 [HANDOFF-2026-073](handoffs/2026-09/2026-09-08-library-hwpx-independent-review.md)에서 조건부 승인했다. 구조 분리는 **세 단계 모두 완료**했다(`-075` 정규화 · `-077` 렌더 · `-079` 인쇄).

검토 완료: HANDOFF-2026-074의 A단계 전환과 HANDOFF-2026-075의 구조 1단계는 [HANDOFF-2026-076](handoffs/2026-09/2026-09-08-library-and-normalize-review.md)에서 확인했다. VM 검사 결함 REV-2026-052 하나를 수정했다.

검토 완료: [HANDOFF-2026-077](handoffs/2026-09/2026-09-09-structure-step2-render.md)(구조 2단계 렌더 분리)은 `HANDOFF-2026-079` 안에서 독립 확인했다 — `window` 표면 17/3 갈래를 git 으로 대조했고 `sanitize`→`inlineMarks` 순서를 뒤집어 회귀 2건이 빨간불인 것을 확인했다. 결함 없음.

검토 완료: [HANDOFF-2026-078](handoffs/2026-09/2026-09-09-library-ui-workflows.md)(라이브러리 6건)은 [HANDOFF-2026-080](handoffs/2026-09/2026-09-09-library-ui-independent-review.md)에서 **실제 화면으로** 독립 검증했다 — 6건 전부 확인, 결함 없음. 관찰 하나(라이브러리에서도 편집기 상단 바가 남는 것)는 `e11b1b1` 에서도 같아 회귀가 아니므로 이슈로 열지 않았다.

검토 완료: [HANDOFF-2026-079](handoffs/2026-09/2026-09-09-structure-step3-print.md)과 [HANDOFF-2026-080](handoffs/2026-09/2026-09-09-library-ui-independent-review.md)은 [HANDOFF-2026-081](handoffs/2026-09/2026-09-09-claude-latest-design-review.md)에서 독립 검토했다. 제품 결함 `REV-2026-059`와 검사 결함 `REV-2026-060`을 열고 수정 설계까지 확정했다.

검토 완료(조건부): [HANDOFF-2026-082](handoffs/2026-09/2026-09-09-review-fixes-applied.md)은 [HANDOFF-2026-083](handoffs/2026-09/2026-09-09-claude-post081-independent-review.md)에서 독립 검토했다. `REV-2026-059`·`060` 수정은 유효하지만 초기 부팅 구간 누락 `REV-2026-061`을 열었다. 이후 정리·URL·Rules 배포 커밋도 함께 검토했고, 배포 승인·handoff 누락을 Claude에게 지적했다.

검토 완료: [HANDOFF-2026-084](handoffs/2026-09/2026-09-09-boot-flash-fix-and-deploy-record.md) — `REV-2026-061` 수정 · **운영 배포 기록**(SHA-256·롤백 순서 포함) · 배포 승인에 대한 사실 정정 · 정적 검사 범위 과장 정정. `HANDOFF-2026-087`에서 코드·기록을 재확인했다.

검토 완료: [HANDOFF-2026-085](handoffs/2026-09/2026-09-09-hwp-spec-attribution-in-ui.md) — 한컴 규격서 출처 고지를 UI 세 곳·매뉴얼에 넣고 `check:static` 이 여섯 곳을 지키게 했다. `HANDOFF-2026-087`에서 위치·정적 검사를 재확인하고 모의고사 고지를 흐름 안으로 옮겼다.

검토 대기: [HANDOFF-2026-090](handoffs/2026-09/2026-09-09-mock-library-implementation.md) — `HANDOFF-2026-089` 의 설계대로 다중 모의고사를 구현했다. 저장 계층과 실패 주입 검사를 먼저 만들었고, 그 검사가 제품 결함 넷(빈 id 충돌 · `[hidden]` 을 이기는 `display` · 카드 전환 시 대기 저장 소실 · 헛돌던 정적 검사)을 잡았다. 이어서 **클라우드 동기화**까지 했다(문제집과 같은 계약 · 그림은 Storage · 계정 삭제 포함). **2026-09-09 에 mocks 규칙을 배포하고 `mockCloudSchema` 를 1 로 올렸다**(운영 반영). 삭제 Undo 와 Storage 버킷 CORS 는 남았다.

검토 완료(보정): [HANDOFF-2026-091](handoffs/2026-09/2026-09-09-legal-compliance-audit-and-terms-review.md) — Gemini의 이용약관 확장 초안을 실제 동작·운영 문서·공식 법령·Anthropic 상용 API 정책과 대조했다. 콘텐츠·비공개·학습 미이용·면책·백업에 관한 과도하거나 미구현인 보증을 보정하고, 로그인 확인을 만 14세 이상 정책과 일치시켰다. 노란 TODO와 출시 게이트는 의도적으로 유지한다.

검토 완료(보완): [HANDOFF-2026-086](handoffs/2026-09/2026-09-09-ipad-report-fixes.md) — **아이패드 실사용 신고 2건**(상단 바 벌어짐 · 로딩 화면이 안 풀림). `HANDOFF-2026-087`에서 상단 바 수정은 승인했고, 폴더 설정 읽기에 남은 무한 대기 경로를 보완했다.

## 최근 해결

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-077` | `P2` | 설정이 출처 화면을 잊고 모의고사 편집기에는 진입점이 없다 | `issues/2026-09/2026-09-10-index-settings-forgets-source-view.md` |
| `REV-2026-076` | `P2` | 모바일 탐색이 긴 라이브러리 뒤로 밀리고 포커스 순서가 역전된다 | `issues/2026-09/2026-09-10-index-mobile-navigation-after-long-library.md` |
| `REV-2026-074` | `P2` | macOS 폴더 아이콘 파일이 Git refs를 오염시킨다 | `issues/2026-09/2026-09-09-rules-macos-icon-files-corrupt-git-refs.md` |
| `REV-2026-073` | `P2` | 로그인 국외이전 동의가 선택적 AI를 묶고 미확인 사실을 단정한다 | `issues/2026-09/2026-09-09-login-consent-bundles-ai-and-overstates-facts.md` |
| `REV-2026-072` | `P3` | 접근성 계약이 다수 라벨·동작 회귀를 놓친다 | `issues/2026-09/2026-09-09-tests-accessibility-contract-gaps.md` |
| `REV-2026-071` | `P2` | 문항 열기·추가 뒤 키보드 포커스가 사라진다 | `issues/2026-09/2026-09-09-index-question-focus-loss.md` |
| `REV-2026-070` | `P3` | 상단 바 자기검사가 높이가 다른 버튼을 다른 줄로 오인한다 | `issues/2026-09/2026-09-09-tests-topbar-row-detection.md` |
| `REV-2026-069` | `P2` | 일반 토스트 상태가 화면낭독기에 전달되지 않는다 | `issues/2026-09/2026-09-09-index-toast-not-announced.md` |
| `REV-2026-068` | `P2` | 편집기 입력과 아이콘 조작의 접근 가능한 이름이 빠졌다 | `issues/2026-09/2026-09-09-index-editor-controls-unlabeled.md` |
| `REV-2026-067` | `P2` | PEDAGOGY 브랜드 탐색이 마우스로만 동작한다 | `issues/2026-09/2026-09-09-index-brand-mouse-only.md` |
| `REV-2026-066` | `P2` | 반복 상단 조작을 건너뛸 키보드 경로가 없다 | `issues/2026-09/2026-09-09-index-missing-skip-link.md` |
| `REV-2026-065` | `P2` | 아이패드 가로 화면에서 일부 편집 조작이 44px보다 작다 | `issues/2026-09/2026-09-09-index-ipad-landscape-touch-targets.md` |
| `REV-2026-062` | `P3` | 모의고사 편집기가 상단 바 높이를 상수로 빼 화면이 잘린다 | `issues/2026-09/2026-09-09-mock-panes-fixed-height-subtraction.md` |
| `REV-2026-064` | `P1` | 멈춘 클라우드 읽기가 '불러오는 중'을 영원히 붙잡음 | `issues/2026-09/2026-09-09-index-hung-cloud-read-blocks-library.md` |
| `REV-2026-063` | `P2` | 상단 바가 보이지 않는 채움 요소에 기대 벌어짐 | `issues/2026-09/2026-09-09-index-topbar-spread-without-filler.md` |
| `REV-2026-061` | `P2` | 초기 부팅 중 편집기 전용 상단 동작이 노출·실행됨 | `issues/2026-09/2026-09-09-index-editor-actions-initial-flash.md` |
| `REV-2026-059` | `P2` | 라이브러리에서 편집기 전용 상단 동작이 노출·실행됨 | `issues/2026-09/2026-09-09-index-library-editor-actions-visible.md` |
| `REV-2026-060` | `P3` | 인쇄 단계 검사가 측정 뒤 초기화하는 순서를 통과시킴 | `issues/2026-09/2026-09-09-tests-print-stage-order-gap.md` |
| `REV-2026-052` | `P3` | 정규화 VM 검사가 표준 URL 없이 허용 URL 경로를 놓침 | `issues/2026-09/2026-09-08-tests-normalize-vm-missing-url.md` |
| `REV-2026-053` | `P2` | 폴더 삭제·이름 변경을 일반 클릭과 키보드로 찾을 수 없음 | `issues/2026-09/2026-09-09-index-folder-actions-hidden.md` |
| `REV-2026-054` | `P2` | 폴더 안에서 만든 새 문제집·A단계 복제본이 폴더 밖으로 빠짐 | `issues/2026-09/2026-09-09-index-folder-create-copy-membership.md` |
| `REV-2026-055` | `P2` | 검색 중 폴더 클릭이 무효처럼 보이고 결과의 소속도 빠짐 | `issues/2026-09/2026-09-09-index-folder-search-navigation.md` |
| `REV-2026-056` | `P2` | 선택 모드의 점 메뉴가 메뉴를 열지 않고 선택을 뒤집음 | `issues/2026-09/2026-09-09-index-selection-card-menu.md` |
| `REV-2026-057` | `P2` | 라이브러리 이름 변경이 최근 수정순과 잘못된 문제집 시각을 갱신함 | `issues/2026-09/2026-09-09-index-library-edit-timestamps.md` |
| `REV-2026-058` | `P2` | 폴더 이동 직후 Undo가 작동하지 않으며 A단계 소속이 기록되지 않음 | `issues/2026-09/2026-09-09-index-folder-move-undo.md` |
| `REV-2026-051` | `P2` | 검사가 배포 플래그를 물려받아 A단계로 내리면 7건이 빨간불 | `issues/2026-09/2026-09-08-tests-review-contracts-inherit-deploy-flag.md` |
| `REV-2026-043` | `P1` | 폴더 tombstone을 소속 판정·동시 저장이 무시함 | `issues/2026-09/2026-09-08-index-folder-tombstone-membership.md` |
| `REV-2026-044` | `P1` | 폴더 스키마 capability 부재와 구형 저장·삭제 비호환 | `issues/2026-09/2026-09-08-index-library-schema-capability.md` |
| `REV-2026-045` | `P1` | 계정 전환 뒤 앞 계정의 폴더 메타가 남음 | `issues/2026-09/2026-09-08-index-library-account-switch.md` |
| `REV-2026-046` | `P1` | 선택 삭제 tombstone이 Undo 복원 저장과 경쟁함 | `issues/2026-09/2026-09-08-index-library-delete-undo-queue.md` |
| `REV-2026-047` | `P1` | 선택 삭제의 원격 실패를 삼켜 성공으로 표시함 | `issues/2026-09/2026-09-08-index-library-delete-failure-report.md` |
| `REV-2026-048` | `P1` | file:// 모의고사 HWPX가 템플릿 fetch에서 실패함 | `issues/2026-09/2026-09-08-mock-hwpx-file-template.md` |
| `REV-2026-049` | `P2` | 가져온 그림이 UI의 2MiB 상한을 우회함 | `issues/2026-09/2026-09-08-mock-hwpx-figure-byte-limit.md` |
| `REV-2026-050` | `P2` | 그림 바이트와 파일명 확장자가 다르면 HWPX MIME이 틀림 | `issues/2026-09/2026-09-08-mock-hwpx-figure-mime.md` |
| `REV-2026-031` | `P1` | 인증된 DELETE로 AI 일일 비용 한도 초기화 | `issues/2026-09/2026-09-08-worker-quota-purge-reset.md` |
| `REV-2026-040` | `P1` | REV-032 검사가 제품이 아니라 검사 자신의 사본을 봄 | `issues/2026-09/2026-09-09-audit-check-tests-its-own-copy.md` |
| `REV-2026-041` | `P1` | releaseImage 무동작화가 업로드 롤백까지 샘 | `issues/2026-09/2026-09-09-release-image-noop-leaks-uploads.md` |
| `REV-2026-042` | `P2` | 감사 수정 뒤 남은 죽은 코드·혼합 옵션 | `issues/2026-09/2026-09-09-dead-options-after-audit-fixes.md` |
| `REV-2026-032` | `P1` | 이전 계정 읽기 응답이 새 계정 로컬 캐시에 들어감 | `issues/2026-09/2026-09-08-index-stale-account-load.md` |
| `REV-2026-033` | `P1` | 전송하지 않은 수정본을 클라우드 저장 완료로 표시 | `issues/2026-09/2026-09-08-index-cloud-ack-live-reference.md` |
| `REV-2026-034` | `P1` | 즉시 이미지 원본 삭제로 Undo가 깨짐 | `issues/2026-09/2026-09-08-index-image-delete-breaks-undo.md` |
| `REV-2026-035` | `P1` | 서버 동시 HWPX 변환이 전역 상태를 공유해 구역 혼선 | `issues/2026-09/2026-09-08-server-hwpx-shared-build-state.md` |
| `REV-2026-036` | `P1` | 자기 클라우드 자료를 읽으며 머리말·블록을 조용히 자름 | `issues/2026-09/2026-09-08-index-own-cloud-normalization-truncates.md` |
| `REV-2026-037` | `P2` | Content-Length 없는 요청이 Worker 본문 상한 우회 | `issues/2026-09/2026-09-08-worker-body-cap-header-only.md` |
| `REV-2026-038` | `P1` | 로컬 저장 실패 후 dirty·종료 경고가 사라짐 | `issues/2026-09/2026-09-08-index-local-save-clears-dirty-on-failure.md` |
| `REV-2026-039` | `P2` | 로컬 API의 JSON 배열 입력이 400 대신 연결 단절 | `issues/2026-09/2026-09-08-server-json-root-unhandled.md` |
| `REV-2026-001` | `P1` | 원격 데이터 삭제 실패 시 계정 삭제 중단 | `issues/2026-08/2026-08-27-index-account-delete-partial-failure.md` |
| `REV-2026-002` | `P1` | AI 일일 한도 경쟁 상태 제거 | `issues/2026-08/2026-08-27-worker-ai-quota-race.md` |
| `REV-2026-003` | `P2` | 과목·선 색·문제집 순서 동기화 | `issues/2026-08/2026-08-27-index-cloud-metadata-fingerprint.md` |
| `REV-2026-004` | `P1` | tombstone 뒤 로컬 사본 재생성 차단 | `issues/2026-08/2026-08-27-index-tombstone-fallback-revival.md` |
| `REV-2026-005` | `P1` | CSP가 App Check(reCAPTCHA Enterprise) 스크립트를 차단 | `issues/2026-08/2026-08-28-index-csp-appcheck-recaptcha-blocked.md` |
| `REV-2026-006` | `P2` | CI 얕은 클론에서 `git diff --check HEAD~1 HEAD` 항상 실패 | `issues/2026-08/2026-08-28-tests-ci-shallow-checkout-diff-check-fails.md` |
| `REV-2026-007` | `P2` | HWPX 그림 경로가 작업 폴더 밖 파일을 읽음 | `issues/2026-08/2026-08-31-hwpx-image-path-traversal.md` |
| `REV-2026-008` | `P2` | HWPX 내보내기가 편집기 work/ 그림 폴더를 탐색하지 않음 | `issues/2026-08/2026-08-31-hwpx-work-images-not-exported.md` |
| `REV-2026-011` | `P3` | HWPX 엔드포인트 검사가 기동 실패 때 그림 파일을 남김 | `issues/2026-08/2026-08-31-tests-hwpx-endpoint-leaves-fixtures.md` |
| `REV-2026-012` | `P0` | 빈 문서 골격의 끊어진 참조로 한글이 파일을 못 엶 | `issues/2026-08/2026-08-31-document-blank-scaffold-dangling-refs.md` |
| `REV-2026-013` | `P1` | 새 범용 문서 블록이 AI·브라우저에서 내보내기 전 차단됨 | `issues/2026-09/2026-09-01-document-new-blocks-blocked-before-export.md` |
| `REV-2026-014` | `P2` | 허용된 큰 그림이 base64 HTTP 본문 상한을 넘음 | `issues/2026-09/2026-09-01-document-image-limit-exceeds-http-limit.md` |
| `REV-2026-015` | `P1` | 시험지 번호 뒤 공백·2쪽부터 머리말 사라짐 | `issues/2026-09/2026-09-01-mock-hwpx-number-tab-and-page-header.md` |
| `REV-2026-017` | `P1` | 배포본에서 한글 내보내기가 제 주소로 요청해 404 | `issues/2026-09/2026-09-01-hwpx-export-posts-to-page-origin.md` |
| `REV-2026-016` | `P2` | 한 단 안의 문항이 실물처럼 벌어지지 않는다 | `issues/2026-09/2026-09-01-mock-hwpx-problem-spacing-in-column.md` |
| `REV-2026-009` | `P2` | HWPX 시험지에 '단답형' 구획 태그가 없다 | `issues/2026-08/2026-08-31-mock-hwpx-missing-short-answer-tag.md` |
| `REV-2026-010` | `P3` | HWPX 시험지에 '※ 확인 사항' 상자가 없다 | `issues/2026-08/2026-08-31-mock-hwpx-missing-confirm-box.md` |
| `REV-2026-018` | `P2` | 시각 회귀 검사가 CI 에서 한 번도 통과한 적이 없다 | `issues/2026-09/2026-09-03-visual-regression-never-passed-in-ci.md` |
| `REV-2026-019` | `P1` | 선지 그림이 문제집 단위 참조 검사에서 빠져 공유 파일이 삭제됨 | `issues/2026-09/2026-09-06-index-choice-image-reference-tracking.md` |
| `REV-2026-020` | `P1` | 선지 그림이 base64 이관에서 빠져 Firestore 문서가 한도를 넘음 | `issues/2026-09/2026-09-06-index-choice-image-base64-migration.md` |
| `REV-2026-021` | `P2` | 이미 실패한 그림 때문에 인쇄가 매번 8초 지연됨 | `issues/2026-09/2026-09-06-index-print-broken-image-wait.md` |
| `REV-2026-022` | `P1` | 저장소가 막히면 문서 편집기가 통째로 죽는다 | `issues/2026-09/2026-09-07-document-storage-blocked-dead-page.md` |
| `REV-2026-023` | `P1` | CDN 차단 망에서 문항을 열면 편집기가 안 그려진다 | `issues/2026-09/2026-09-07-index-sortable-cdn-blocked.md` |
| `REV-2026-025` | `P2` | 핵심 단추 검사가 누락·세로 이탈을 통과시킴 | `issues/2026-09/2026-09-07-tests-key-button-visibility-blind-spots.md` |
| `REV-2026-024` | `P2` | 주소 복사가 거부돼도 성공했다고 말함 | `issues/2026-09/2026-09-07-index-in-app-copy-false-success.md` |
| `REV-2026-026` | `P2` | 두 편집기의 인앱 안내가 갈리고 탈출 단추가 화면 밖 | `issues/2026-09/2026-09-07-auth-in-app-guidance-diverges.md` |
| `REV-2026-027` | `P2` | 터치 목표 검사가 버튼형 링크·문서 편집기 조작을 제외함 | `issues/2026-09/2026-09-07-tests-touch-target-coverage-gaps.md` |
| `REV-2026-028` | `P2` | 늘어난 상단 바를 60px 로 빼 모의고사 화면이 넘침 | `issues/2026-09/2026-09-07-index-dvh-fixed-header-subtraction.md` |
| `REV-2026-029` | `P2` | 글꼴 의도 검사가 부팅 중 글꼴 두 벌을 허용함 | `issues/2026-09/2026-09-07-tests-font-intent-allows-preload.md` |

## 최근 인계

| ID | 작성자 | 내용 | 파일 |
| --- | --- | --- | --- |
| `HANDOFF-2026-105` | Codex | **097·099·101·102 독립 검토 · 모바일 탐색과 설정 복귀 수정** | `handoffs/2026-09/2026-09-10-library-ux-independent-review-and-fixes.md` |
| `HANDOFF-2026-098` | Codex | **한컴 고지·전체 화면 데이터 설정·모바일 일반 흐름 탭바 결정** | `handoffs/2026-09/2026-09-09-library-ux-design-decisions.md` |
| `HANDOFF-2026-095` | Codex | **한국어 원문 + 영어·일본어·중국어 핵심 법률정보 선택과 AI 번역 고지** | `handoffs/2026-09/2026-09-09-legal-multilingual-reader-guide.md` |
| `HANDOFF-2026-094` | Codex | **공식 법령·12개 서비스군 벤치마크 · 로그인/AI 동의 분리와 과장 고지 교정** | `handoffs/2026-09/2026-09-09-legal-benchmark-and-consent-corrections.md` |
| `HANDOFF-2026-110` | Claude | **검토 요청 — 영어 짝 선지·탐구 과목 다섯 건 (공격 지점·미확인 목록 포함)** | `handoffs/2026-09/2026-09-10-review-request-subjects.md` |
| `HANDOFF-2026-109` | Claude | **표 칸 합치기(가로·세로) — 실물 7건 근거** | `handoffs/2026-09/2026-09-10-table-cell-merge.md` |
| `HANDOFF-2026-108` | Claude | **표 칸에 그림 (탐구 자료) · 자리 목록 한 곳 유지** | `handoffs/2026-09/2026-09-10-table-cell-images.md` |
| `HANDOFF-2026-107` | Claude | **화학식 — 재 보니 하나만 없었다(mhchem) · 순서 계약** | `handoffs/2026-09/2026-09-10-chemistry-formulas.md` |
| `HANDOFF-2026-106` | Claude | **코덱스 `-104` 독립 검토 4건 확인 · 아이콘 재발에 정리 지점** | `handoffs/2026-09/2026-09-10-codex-review-verified.md` |
| `HANDOFF-2026-104` | Codex | 097·099·101·102 독립 검토와 UX 수정 | `handoffs/2026-09/2026-09-10-library-ux-independent-review-and-fixes.md` |
| `HANDOFF-2026-105` | Claude | **탐구(사회·과학) 조판 규칙 — 실물 두 부에서 잼** | `handoffs/2026-09/2026-09-10-inquiry-typography.md` |
| `HANDOFF-2026-103` | Claude | **영어 ② — 실물이 가정을 뒤집음 · 짝 선지(열 머리글) 구현** | `handoffs/2026-09/2026-09-10-english-paired-choices.md` |
| `HANDOFF-2026-102` | Claude | **한컴 고지를 `설정 → 정보` 로 · 검사를 줄이지 않고 좁힘** | `handoffs/2026-09/2026-09-09-hancom-notice-in-settings.md` |
| `HANDOFF-2026-101` | Claude | **설정을 전체 화면 뷰로 · 데이터 관리 흡수(계약 그대로)** | `handoffs/2026-09/2026-09-09-settings-view-and-data.md` |
| `HANDOFF-2026-100` | Claude | **AI 문서를 화면에서 빼고 코드로 남김 · 교차 검사의 '붙어 있는가' 이전** | `handoffs/2026-09/2026-09-09-ai-document-scope.md` |
| `HANDOFF-2026-099` | Claude | **코덱스 결정 반영 — 휴대폰 하단 탐색(흐름 안 · safe-area 미도입)** | `handoffs/2026-09/2026-09-09-mobile-bottom-nav.md` |
| `HANDOFF-2026-097` | Claude | **왼쪽 레일·푸터 축약·설정 좌측 갈래 · 코덱스 이슈 처리** | `handoffs/2026-09/2026-09-09-library-rail-and-settings.md` |
| `HANDOFF-2026-096` | Claude | **라이브러리 화면 재설계 설계안 — 실측·왼쪽 레일·푸터 축약·설정 화면 (검토 요청)** | `handoffs/2026-09/2026-09-09-library-ux-design.md` |
| `HANDOFF-2026-093` | Claude | **법정 기재사항 완성(유출통지·자동화된결정) · 항목별 동의 창과 증적** | `handoffs/2026-09/2026-09-09-legal-statutory-completion-and-consent.md` |
| `HANDOFF-2026-092` | Claude | **법률 문서 구조 개편(요약·목차·개정 이력·인쇄) · 해지 조항 신설 · 푸터 회귀 수정** | `handoffs/2026-09/2026-09-09-legal-page-structure-and-footer.md` |
| `HANDOFF-2026-090` | Claude | **모의고사 라이브러리 구현 + 클라우드 동기화(문서별·tombstone·병합·파기)** | `handoffs/2026-09/2026-09-09-mock-library-implementation.md` |
| `HANDOFF-2026-089` | Codex | **라이브러리 액션·폴더 배치 정돈과 다중 모의고사 라이브러리 설계** | `handoffs/2026-09/2026-09-09-library-header-and-mock-library-plan.md` |
| `HANDOFF-2026-088` | Codex | **편집기 접근성 디자인 점검 · 키보드 경로와 이름 보정** | `handoffs/2026-09/2026-09-09-editor-accessibility-design-audit.md` |
| `HANDOFF-2026-086` | Claude | **아이패드 실사용 신고 두 건 수정** | `handoffs/2026-09/2026-09-09-ipad-report-fixes.md` |
| `HANDOFF-2026-085` | Claude | **한컴 규격서 출처 고지를 UI·매뉴얼에** | `handoffs/2026-09/2026-09-09-hwp-spec-attribution-in-ui.md` |
| `HANDOFF-2026-084` | Claude | **부팅 노출 수정 · 배포 기록 · 083 회신** | `handoffs/2026-09/2026-09-09-boot-flash-fix-and-deploy-record.md` |
| `HANDOFF-2026-083` | Codex | Claude 후속 6커밋 독립 검토 · 초기 노출 수정 및 배포 절차 코멘트 | `handoffs/2026-09/2026-09-09-claude-post081-independent-review.md` |
| `HANDOFF-2026-082` | Claude | **검토 지적 2건 수정 (059·060)** | `handoffs/2026-09/2026-09-09-review-fixes-applied.md` |
| `HANDOFF-2026-081` | Codex | Claude 최신 변경 독립 검토 · 재현 2건 수정 설계 | `handoffs/2026-09/2026-09-09-claude-latest-design-review.md` |
| `HANDOFF-2026-080` | Claude | 라이브러리 사용 흐름 6건 **실제 화면** 독립 검증 | `handoffs/2026-09/2026-09-09-library-ui-independent-review.md` |
| `HANDOFF-2026-079` | Claude | **구조 3단계 — 인쇄 배치 엔진 분리** | `handoffs/2026-09/2026-09-09-structure-step3-print.md` |
| `HANDOFF-2026-077` | Codex | 구조 2단계 — 안전한 HTML 렌더 분리 및 계약 고정 | `handoffs/2026-09/2026-09-09-structure-step2-render.md` |
| `HANDOFF-2026-078` | Codex | 라이브러리 조작 흐름 6건 수정 — 폴더 관리·이동 Undo·검색·선택·정렬 | `handoffs/2026-09/2026-09-09-library-ui-workflows.md` |
| `HANDOFF-2026-076` | Codex | Claude A단계·정규화 분리 독립 검토 및 VM URL 검사 보정 | `handoffs/2026-09/2026-09-08-library-and-normalize-review.md` |
| `HANDOFF-2026-075` | Claude | **구조 1단계 — 정규화(신뢰 경계)를 별도 파일로** | `handoffs/2026-09/2026-09-08-structure-step1-normalize.md` |
| `HANDOFF-2026-074` | Claude | **코덱스 8건 독립 검증 · A단계 전환 · 검사의 플래그 의존 제거** | `handoffs/2026-09/2026-09-08-library-review-verified-and-schema-a.md` |
| `HANDOFF-2026-073` | Codex | 라이브러리·HWPX 독립 검토 8건 수정, 구조 설계 세 질문 답변 | `handoffs/2026-09/2026-09-08-library-hwpx-independent-review.md` |
| `HANDOFF-2026-062` | Codex | UX 수정 설계 검토 — 즉시 되돌리기·묶음 경계·진행 표시 보완 | `handoffs/2026-09/2026-09-08-ux-fixes-design-review.md` |
| `HANDOFF-2026-066` | Codex | 독립 종합 감사 — 결함 9건·체크리스트·수정 설계·재현 도구, 제품 미수정 | `handoffs/2026-09/2026-09-08-independent-security-stability-audit.md` |
| `HANDOFF-2026-067` | Codex | 독립 감사 9건 수정·실패 주입 회귀·보존 정책 정리 | `handoffs/2026-09/2026-09-08-audit-findings-fixed.md` |
| `HANDOFF-2026-069` | Codex | Claude 후속 검토 3건 수정·실행형 회귀 보강 | `handoffs/2026-09/2026-09-09-audit-review-findings-fixed.md` |
| `HANDOFF-2026-070` | Codex | 라이브러리 설계 검토 — 폴더 tombstone·A/B 분리·원격 삭제 Undo 계약 | `handoffs/2026-09/2026-09-09-library-design-review.md` |
| `HANDOFF-2026-072` | Codex | 새 채팅 전환용 현재 상태·안전 계약·검토 순서 | `handoffs/2026-09/2026-09-09-new-chat-project-context.md` |
| `HANDOFF-2026-001` | Codex | 초기 독립 감사 — 제품 코드 변경 없음 | `handoffs/2026-08/2026-08-27-independent-initial-audit.md` |
| `HANDOFF-2026-002` | Codex | 초기 감사 4건 해결 및 검증 | `handoffs/2026-08/2026-08-27-fix-audit-findings.md` |
| `HANDOFF-2026-003` | Codex | 상용 출시 보안·권한·운영 기반 | `handoffs/2026-08/2026-08-28-commercial-launch-hardening.md` |
| `HANDOFF-2026-004` | Codex | 본문·수식 크기 및 국어 발문 굵기 정렬 | `handoffs/2026-08/2026-08-28-index-type-scale-alignment.md` |
| `HANDOFF-2026-005` | Codex | 구조 분리 전 기준 샘플·검증 기준선 확정 | `handoffs/2026-08/2026-08-28-refactor-baseline.md` |
| `HANDOFF-2026-006` | Claude | 003/004/005 독립 검토 + CSP App Check 차단 수정 | `handoffs/2026-08/2026-08-28-independent-review-csp-fix.md` |
| `HANDOFF-2026-007` | Codex | 계층형 회귀·권한 검사 강화 | `handoffs/2026-08/2026-08-28-tests-layered-hardening.md` |
| `HANDOFF-2026-008` | Codex | 문제집 카드 메뉴 레이어 수정 | `handoffs/2026-08/2026-08-29-index-library-menu-layering.md` |
| `HANDOFF-2026-009` | Codex | 국어 보기 내 표 · 모의고사 연속 쪽 머리말 | `handoffs/2026-08/2026-08-30-index-mock-korean-bogi-and-header.md` |
| `HANDOFF-2026-010` | Claude | HWP 조판 가능성 실험 (베타 · 제품 미연결) | `handoffs/2026-08/2026-08-30-experiments-hwp-export-spike.md` |
| `HANDOFF-2026-011` | Claude | 모의고사 → 한글(HWPX) 변환기 완성 (베타) | `handoffs/2026-08/2026-08-30-experiments-hwpx-mock-export.md` |
| `HANDOFF-2026-012` | Claude | 모의고사 한글(HWPX) 내보내기 · 베타 (제품 연결) | `handoffs/2026-08/2026-08-31-mock-hwpx-export-beta.md` |
| `HANDOFF-2026-013` | Codex | HWPX 그림 경로 제한 및 `work` 폴더 연결 | `handoffs/2026-08/2026-08-31-hwpx-image-path-safety.md` |
| `HANDOFF-2026-014` | Claude | HWPX 검사를 실행 경로에 연결 + 엔드포인트 동작 검사 | `handoffs/2026-08/2026-08-31-hwpx-tests-wired-and-endpoint-check.md` |
| `HANDOFF-2026-015` | Claude | 30문항·선택과목 검증 · 구역 분리 · HWPX 검사 CI 연결 | `handoffs/2026-08/2026-08-31-hwpx-full-exam-sections-and-ci.md` |
| `HANDOFF-2026-016` | Codex | HWPX 엔드포인트 검사 실패 시 임시 그림 정리 | `handoffs/2026-08/2026-08-31-hwpx-endpoint-cleanup.md` |
| `HANDOFF-2026-017` | Codex | 자칼 런타임 제거 및 내부 HWPX 엔진 이관 | `handoffs/2026-08/2026-08-31-internal-hwpx-runtime.md` |
| `HANDOFF-2026-018` | Codex | 범용 AI 문서 JSON·미리보기·HWPX 베타 | `handoffs/2026-08/2026-08-31-document-ai-json-hwpx-beta.md` |
| `HANDOFF-2026-019` | Claude | 범용 문서 HWPX에 표 블록 추가 | `handoffs/2026-08/2026-08-31-document-table-block.md` |
| `HANDOFF-2026-020` | Claude | 한컴 공개 규격서 확보 · 수식 변환기 규격 기반 전환 | `handoffs/2026-08/2026-08-31-hwp-spec-based-equations.md` |
| `HANDOFF-2026-021` | Claude | 범용 문서에 그림 블록 추가 (base64) | `handoffs/2026-09/2026-09-01-document-image-block.md` |
| `HANDOFF-2026-022` | Claude | 범용 문서에 테두리 상자 블록 추가 | `handoffs/2026-09/2026-09-01-document-box-block.md` |
| `HANDOFF-2026-023` | Codex | 범용 문서 블록 경계 독립 검토 | `handoffs/2026-09/2026-09-01-independent-review-document-block-boundaries.md` |
| `HANDOFF-2026-023` | Claude | 범용 문서에 <보기>·선지 블록 추가 | `handoffs/2026-09/2026-09-01-document-exam-blocks.md` |
| `HANDOFF-2026-024` | Codex | 범용 문서 블록 경계 독립 검토 | `handoffs/2026-09/2026-09-01-independent-review-document-block-boundaries.md` |
| `HANDOFF-2026-025` | Claude | 새 블록을 네 경계에 함께 반영 (Codex 검토 반영) | `handoffs/2026-09/2026-09-01-document-block-boundaries-fix.md` |
| `HANDOFF-2026-026` | Claude | AI 문서 화면을 본체 디자인에 맞춤 | `handoffs/2026-09/2026-09-01-document-editor-design-unified.md` |
| `HANDOFF-2026-027` | Claude | 시험지 문항 번호(탭)와 이어지는 쪽 머리말 | `handoffs/2026-09/2026-09-01-mock-hwpx-number-tab-and-page-header.md` |
| `HANDOFF-2026-028` | Claude | 한글 내보내기가 로컬 서버를 제대로 찾게 | `handoffs/2026-09/2026-09-01-hwpx-export-server-discovery.md` |
| `HANDOFF-2026-029` | Claude | 브라우저에서 도는 HWPX 조판기 (AI 문서) | `handoffs/2026-09/2026-09-01-browser-hwpx-engine.md` |
| `HANDOFF-2026-030` | Claude | 한 단 안 문항 간격 — 편집기가 재서 보낸다 | `handoffs/2026-09/2026-09-01-mock-hwpx-column-spacing.md` |
| `HANDOFF-2026-031` | Claude | 문항 간격 2차 — 한글에게 좌표를 물어 보정 | `handoffs/2026-09/2026-09-01-mock-hwpx-column-spacing-2.md` |
| `HANDOFF-2026-032` | Claude | 문항별 단 배치 기본값을 실물에서 가져옴 | `handoffs/2026-09/2026-09-01-mock-default-column-layout.md` |
| `HANDOFF-2026-033` | Claude | 실물 조판 1·2단계 (수식 앞 공백 · 그림 문단 모양) | `handoffs/2026-09/2026-09-01-mock-style-step12.md` |
| `HANDOFF-2026-034` | Claude | 실물 조판 4단계 (조건 상자 안 별행 수식) | `handoffs/2026-09/2026-09-02-mock-style-step4-cond-display-eq.md` |
| `HANDOFF-2026-035` | Claude | 실물 조판 3+5단계 (구획 태그 · ※ 확인 사항) | `handoffs/2026-09/2026-09-03-mock-style-step35-section-tag-and-note.md` |
| `HANDOFF-2026-036` | Claude | 실물 조판 6단계 (역할 표 대조 검사) | `handoffs/2026-09/2026-09-03-mock-style-step6-role-table.md` |
| `HANDOFF-2026-037` | Claude | 시각 회귀 — 같은 OS 끼리만 견주고, 국소 변화를 잡게 | `handoffs/2026-09/2026-09-03-visual-regression-cross-platform.md` |
| `HANDOFF-2026-038` | Claude | 영어 과목 조판의 토대 (실물 대조) | `handoffs/2026-09/2026-09-03-english-subject-foundation.md` |
| `HANDOFF-2026-039` | Claude | 지문 문단 모델 — 문단마다 첫 줄 들여쓰기 | `handoffs/2026-09/2026-09-03-passage-paragraph-model.md` |
| `HANDOFF-2026-040` | Claude | 영어 순서 문항의 (A)(B)(C) 라벨을 문단 첫머리로 | `handoffs/2026-09/2026-09-03-english-order-inline-label.md` |
| `HANDOFF-2026-041` | Claude | 영어 듣기 답란(밑줄 한 줄) | `handoffs/2026-09/2026-09-04-english-listening-answer-line.md` |
| `HANDOFF-2026-042` | Claude | 지문 없는 문항 묶음의 안내 줄 | `handoffs/2026-09/2026-09-04-group-lead-without-passage.md` |
| `HANDOFF-2026-043` | Claude | 강조는 굵기가 아니라 글꼴 갈래 (말한이·묶음 안내) | `handoffs/2026-09/2026-09-04-emphasis-by-typeface-not-weight.md` |
| `HANDOFF-2026-044` | Claude | 안내문 상자 (영어 27·28번) | `handoffs/2026-09/2026-09-04-english-notice-box.md` |
| `HANDOFF-2026-045` | Claude | 선지에 그림 넣기 (교과서 그래프 문항) | `handoffs/2026-09/2026-09-06-image-choices.md` |
| `HANDOFF-2026-047` | Claude | 인쇄 속도 실측 · 그림 도착 전 측정 결함 | `handoffs/2026-09/2026-09-06-print-speed.md` |
| `HANDOFF-2026-048` | Codex | 이미 실패한 그림의 인쇄 대기 제거 | `handoffs/2026-09/2026-09-06-print-broken-image-wait.md` |
| `HANDOFF-2026-049` | Claude | 발문 별행 수식의 탭(14.11mm)과 왼쪽 정렬 | `handoffs/2026-09/2026-09-07-stem-display-eq-tab.md` |
| `HANDOFF-2026-050` | Claude | **범용성(플랫폼·기기) 설계안 — 검토 요청** | `handoffs/2026-09/2026-09-07-cross-platform-design.md` |
| `HANDOFF-2026-051` | Codex | 범용성 설계 독립 검토와 수정 요청 | `handoffs/2026-09/2026-09-07-cross-platform-design-review.md` |
| `HANDOFF-2026-052` | Claude | 범용성 설계 검토 반영 + 저장소 차단 P1 수정 | `handoffs/2026-09/2026-09-07-cross-platform-review-applied.md` |
| `HANDOFF-2026-053` | Claude | 범용성 1단계 — 세 엔진 × 세 뷰포트 연기 검사 | `handoffs/2026-09/2026-09-07-cross-platform-step1.md` |
| `HANDOFF-2026-054` | Claude | 범용성 2단계 — 인앱 브라우저 · pagehide | `handoffs/2026-09/2026-09-07-cross-platform-step2.md` |
| `HANDOFF-2026-055` | Claude | 2단계 검토 반영 (024·025·026) | `handoffs/2026-09/2026-09-07-cross-platform-step2-review-applied.md` |
| `HANDOFF-2026-056` | Claude | 범용성 3단계 — 손가락(44px · hover 전용 조작) | `handoffs/2026-09/2026-09-07-cross-platform-step3.md` |
| `HANDOFF-2026-057` | Claude | 범용성 4단계 — 화면(dvh · 문서 편집기 · safe-area) | `handoffs/2026-09/2026-09-07-cross-platform-step4.md` |
| `HANDOFF-2026-058` | Claude | 범용성 5단계 — 글꼴을 인쇄 의도 시점에 | `handoffs/2026-09/2026-09-07-cross-platform-step5.md` |
| `HANDOFF-2026-059` | Claude | 범용성 6단계 — 서버 필요 기능을 미리 알리기 | `handoffs/2026-09/2026-09-07-cross-platform-step6.md` |
| `HANDOFF-2026-060` | Claude | **시험지 틀을 저장소에 (결정 1)** | `handoffs/2026-09/2026-09-07-exam-template-bundled.md` |
| `HANDOFF-2026-061` | Claude | 사용자 수정 요청 셋의 설계 — 검토 요청 | `handoffs/2026-09/2026-09-08-ux-fixes-design.md` |
| `HANDOFF-2026-063` | Claude | UX 수정 설계 — 검토 반영 | `handoffs/2026-09/2026-09-08-ux-fixes-design-applied.md` |
| `HANDOFF-2026-064` | Claude | **UX 수정 셋 구현** | `handoffs/2026-09/2026-09-08-ux-fixes-implemented.md` |
| `HANDOFF-2026-065` | Claude | 라이브러리(폴더·정렬·선택·설정) 설계 — 검토 요청 | `handoffs/2026-09/2026-09-08-library-design.md` |
| `HANDOFF-2026-046` | Claude | 영어 표 문항 (10번) + 표 머리글 굵기 | `handoffs/2026-09/2026-09-06-english-table-question.md` |
| `HANDOFF-2026-038` | Claude | 영어 과목 조판의 토대 (실물 대조) | `handoffs/2026-09/2026-09-03-english-subject-foundation.md` |
| `HANDOFF-2026-039` | Claude | 지문 문단 모델 — 문단마다 첫 줄 들여쓰기 | `handoffs/2026-09/2026-09-03-passage-paragraph-model.md` |
