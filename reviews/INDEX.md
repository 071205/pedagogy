# 리뷰 현황

마지막 정리: 2026-08-28

## 열린 이슈

현재 열린 이슈 없음.

## 최근 해결

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-001` | `P1` | 원격 데이터 삭제 실패 시 계정 삭제 중단 | `issues/2026-08-27-index-account-delete-partial-failure.md` |
| `REV-2026-002` | `P1` | AI 일일 한도 경쟁 상태 제거 | `issues/2026-08-27-worker-ai-quota-race.md` |
| `REV-2026-003` | `P2` | 과목·선 색·문제집 순서 동기화 | `issues/2026-08-27-index-cloud-metadata-fingerprint.md` |
| `REV-2026-004` | `P1` | tombstone 뒤 로컬 사본 재생성 차단 | `issues/2026-08-27-index-tombstone-fallback-revival.md` |
| `REV-2026-005` | `P1` | CSP가 App Check(reCAPTCHA Enterprise) 스크립트를 차단 | `issues/2026-08-28-index-csp-appcheck-recaptcha-blocked.md` |
| `REV-2026-006` | `P2` | CI 얕은 클론에서 `git diff --check HEAD~1 HEAD` 항상 실패 | `issues/2026-08-28-tests-ci-shallow-checkout-diff-check-fails.md` |

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
