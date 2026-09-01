# 리뷰 현황

마지막 정리: 2026-09-01

## 열린 이슈

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-009` | `P2` | HWPX 시험지에 '단답형' 구획 태그가 없다 | `issues/2026-08-31-mock-hwpx-missing-short-answer-tag.md` |
| `REV-2026-010` | `P3` | HWPX 시험지에 '※ 확인 사항' 상자가 없다 | `issues/2026-08-31-mock-hwpx-missing-confirm-box.md` |
| `REV-2026-016` | `P2` | 한 단 안의 문항이 실물처럼 벌어지지 않는다 | `issues/2026-09-01-mock-hwpx-problem-spacing-in-column.md` |

둘 다 **실물 대조가 필요해 일부러 손대지 않았다** — 모양이 틀린 것을 넣으면 없는 것보다 나쁘다.

## 최근 해결

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-001` | `P1` | 원격 데이터 삭제 실패 시 계정 삭제 중단 | `issues/2026-08-27-index-account-delete-partial-failure.md` |
| `REV-2026-002` | `P1` | AI 일일 한도 경쟁 상태 제거 | `issues/2026-08-27-worker-ai-quota-race.md` |
| `REV-2026-003` | `P2` | 과목·선 색·문제집 순서 동기화 | `issues/2026-08-27-index-cloud-metadata-fingerprint.md` |
| `REV-2026-004` | `P1` | tombstone 뒤 로컬 사본 재생성 차단 | `issues/2026-08-27-index-tombstone-fallback-revival.md` |
| `REV-2026-005` | `P1` | CSP가 App Check(reCAPTCHA Enterprise) 스크립트를 차단 | `issues/2026-08-28-index-csp-appcheck-recaptcha-blocked.md` |
| `REV-2026-006` | `P2` | CI 얕은 클론에서 `git diff --check HEAD~1 HEAD` 항상 실패 | `issues/2026-08-28-tests-ci-shallow-checkout-diff-check-fails.md` |
| `REV-2026-007` | `P2` | HWPX 그림 경로가 작업 폴더 밖 파일을 읽음 | `issues/2026-08-31-hwpx-image-path-traversal.md` |
| `REV-2026-008` | `P2` | HWPX 내보내기가 편집기 work/ 그림 폴더를 탐색하지 않음 | `issues/2026-08-31-hwpx-work-images-not-exported.md` |
| `REV-2026-011` | `P3` | HWPX 엔드포인트 검사가 기동 실패 때 그림 파일을 남김 | `issues/2026-08-31-tests-hwpx-endpoint-leaves-fixtures.md` |
| `REV-2026-012` | `P0` | 빈 문서 골격의 끊어진 참조로 한글이 파일을 못 엶 | `issues/2026-08-31-document-blank-scaffold-dangling-refs.md` |
| `REV-2026-013` | `P1` | 새 범용 문서 블록이 AI·브라우저에서 내보내기 전 차단됨 | `issues/2026-09-01-document-new-blocks-blocked-before-export.md` |
| `REV-2026-014` | `P2` | 허용된 큰 그림이 base64 HTTP 본문 상한을 넘음 | `issues/2026-09-01-document-image-limit-exceeds-http-limit.md` |
| `REV-2026-015` | `P1` | 시험지 번호 뒤 공백·2쪽부터 머리말 사라짐 | `issues/2026-09-01-mock-hwpx-number-tab-and-page-header.md` |
| `REV-2026-017` | `P1` | 배포본에서 한글 내보내기가 제 주소로 요청해 404 | `issues/2026-09-01-hwpx-export-posts-to-page-origin.md` |

## 최근 인계

| ID | 작성자 | 내용 | 파일 |
| --- | --- | --- | --- |
| `HANDOFF-2026-001` | Codex | 초기 독립 감사 — 제품 코드 변경 없음 | `handoffs/2026-08-27-independent-initial-audit.md` |
| `HANDOFF-2026-002` | Codex | 초기 감사 4건 해결 및 검증 | `handoffs/2026-08-27-fix-audit-findings.md` |
| `HANDOFF-2026-003` | Codex | 상용 출시 보안·권한·운영 기반 | `handoffs/2026-08-28-commercial-launch-hardening.md` |
| `HANDOFF-2026-004` | Codex | 본문·수식 크기 및 국어 발문 굵기 정렬 | `handoffs/2026-08-28-index-type-scale-alignment.md` |
| `HANDOFF-2026-005` | Codex | 구조 분리 전 기준 샘플·검증 기준선 확정 | `handoffs/2026-08-28-refactor-baseline.md` |
| `HANDOFF-2026-006` | Claude | 003/004/005 독립 검토 + CSP App Check 차단 수정 | `handoffs/2026-08-28-independent-review-csp-fix.md` |
| `HANDOFF-2026-007` | Codex | 계층형 회귀·권한 검사 강화 | `handoffs/2026-08-28-tests-layered-hardening.md` |
| `HANDOFF-2026-008` | Codex | 문제집 카드 메뉴 레이어 수정 | `handoffs/2026-08-29-index-library-menu-layering.md` |
| `HANDOFF-2026-009` | Codex | 국어 보기 내 표 · 모의고사 연속 쪽 머리말 | `handoffs/2026-08-30-index-mock-korean-bogi-and-header.md` |
| `HANDOFF-2026-010` | Claude | HWP 조판 가능성 실험 (베타 · 제품 미연결) | `handoffs/2026-08-30-experiments-hwp-export-spike.md` |
| `HANDOFF-2026-011` | Claude | 모의고사 → 한글(HWPX) 변환기 완성 (베타) | `handoffs/2026-08-30-experiments-hwpx-mock-export.md` |
| `HANDOFF-2026-012` | Claude | 모의고사 한글(HWPX) 내보내기 · 베타 (제품 연결) | `handoffs/2026-08-31-mock-hwpx-export-beta.md` |
| `HANDOFF-2026-013` | Codex | HWPX 그림 경로 제한 및 `work` 폴더 연결 | `handoffs/2026-08-31-hwpx-image-path-safety.md` |
| `HANDOFF-2026-014` | Claude | HWPX 검사를 실행 경로에 연결 + 엔드포인트 동작 검사 | `handoffs/2026-08-31-hwpx-tests-wired-and-endpoint-check.md` |
| `HANDOFF-2026-015` | Claude | 30문항·선택과목 검증 · 구역 분리 · HWPX 검사 CI 연결 | `handoffs/2026-08-31-hwpx-full-exam-sections-and-ci.md` |
| `HANDOFF-2026-016` | Codex | HWPX 엔드포인트 검사 실패 시 임시 그림 정리 | `handoffs/2026-08-31-hwpx-endpoint-cleanup.md` |
| `HANDOFF-2026-017` | Codex | 자칼 런타임 제거 및 내부 HWPX 엔진 이관 | `handoffs/2026-08-31-internal-hwpx-runtime.md` |
| `HANDOFF-2026-018` | Codex | 범용 AI 문서 JSON·미리보기·HWPX 베타 | `handoffs/2026-08-31-document-ai-json-hwpx-beta.md` |
| `HANDOFF-2026-019` | Claude | 범용 문서 HWPX에 표 블록 추가 | `handoffs/2026-08-31-document-table-block.md` |
| `HANDOFF-2026-020` | Claude | 한컴 공개 규격서 확보 · 수식 변환기 규격 기반 전환 | `handoffs/2026-08-31-hwp-spec-based-equations.md` |
| `HANDOFF-2026-021` | Claude | 범용 문서에 그림 블록 추가 (base64) | `handoffs/2026-09-01-document-image-block.md` |
| `HANDOFF-2026-022` | Claude | 범용 문서에 테두리 상자 블록 추가 | `handoffs/2026-09-01-document-box-block.md` |
| `HANDOFF-2026-023` | Codex | 범용 문서 블록 경계 독립 검토 | `handoffs/2026-09-01-independent-review-document-block-boundaries.md` |
| `HANDOFF-2026-023` | Claude | 범용 문서에 <보기>·선지 블록 추가 | `handoffs/2026-09-01-document-exam-blocks.md` |
| `HANDOFF-2026-024` | Codex | 범용 문서 블록 경계 독립 검토 | `handoffs/2026-09-01-independent-review-document-block-boundaries.md` |
| `HANDOFF-2026-025` | Claude | 새 블록을 네 경계에 함께 반영 (Codex 검토 반영) | `handoffs/2026-09-01-document-block-boundaries-fix.md` |
| `HANDOFF-2026-026` | Claude | AI 문서 화면을 본체 디자인에 맞춤 | `handoffs/2026-09-01-document-editor-design-unified.md` |
| `HANDOFF-2026-027` | Claude | 시험지 문항 번호(탭)와 이어지는 쪽 머리말 | `handoffs/2026-09-01-mock-hwpx-number-tab-and-page-header.md` |
| `HANDOFF-2026-028` | Claude | 한글 내보내기가 로컬 서버를 제대로 찾게 | `handoffs/2026-09-01-hwpx-export-server-discovery.md` |
