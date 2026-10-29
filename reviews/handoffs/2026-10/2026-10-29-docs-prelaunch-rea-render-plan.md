# 출시 전2 — 한글 REA 출력 검증 적용 계획

- ID: `HANDOFF-2026-208`
- 날짜: `2026-10-29`
- 작성자: `Codex Sol high`
- 상태: `ready-for-review` (계획·검토 완료, 제품 구현/새 REA 실험은 미착수)
- 영향 영역: `docs | mock | tests`
- 관련 이슈: 현재 main의 신규 이슈 등록 없음. 연구 브랜치의 `REV-2026-129/130`은 현 코드 재현 후 기존 기록을 충돌 없이 편입.

## 변경 내용

사용자 요청에 따라 PR40의 출력 작업을 먼저 완료했다. head `f098170` CI4/PR Sonar, squash merge `1bae434`, 동일 revision main CI4·Pages built·Sonar OK와 공개 문서 UI 그림 경로까지 [검증](../../audits/2026-10-29/prelaunch-print/pr40-final-verification.json)했다. 일반 문서 새 PNG/JPEG 표본의 native 한글 출력은 미검증이라고 구분한다. 전체 출시/전2 완료 판정은 아니다.

별도 `claude/h1-hwp-research` 브랜치의 H1 실물/REA 결과와 사이트 적용 설계를 읽고 현재 `mock-exam-editor.html`의 선지 측정·HWPX payload 경로를 다시 확인했다. [적용 계획](../../../docs/PRELAUNCH-HWPX-REA-RENDER-PLAN.md)을 전2의 현 코드 재현→폰트 준비/측정 수정→전체 출력 대조→필요한 질문만 REA로 좁혔다. 연구 브랜치 전체 병합·구현·새 역분석은 하지 않았다. 기본 checkout은 `claude/h1-hwp-research` 그대로 두고 실제 worktree `pedagogy-u15b`의 `codex/prelaunch-rea-render-plan`에서만 작성했다.

## 검토와 범위

[Claude 독립 의견](../../audits/2026-10-29/prelaunch-print/claude-prelaunch-rea-plan-review.md)은 REA 정적 근거와 실물 판정의 분리 및 129/130 묶음에 합의했다. 글꼴 스택/크기/자간/KaTeX 문맥, `layoutResolved`와 `heightMm` 공동 영향, 그림 바이트의 별도 경계, PR/main 출시 게이트, 저장·재진입/실패 복구 누락을 지적해 계획에 반영했다. Claude 도구는 연구 브랜치의 세 파일을 읽지 못했으므로 그 원문과 근거는 주 작성자가 직접 확인했으며, Claude가 H1 실험 자체를 재검토했다고 주장하지 않는다. 현재 코드 경로는 정적으로 확인, 현 버전 출력 영향 크기는 아직 실측 전이다.

문서 계획만 변경했다. 제품 HTML/JS·Rules·저장 스키마·배포 설정·production/staging은 변경하지 않았다. 상용 폰트 배포·도메인 구매·실자료 이관을 승인/진행한 것은 아니다.

## 검증과 다음 행동

- `git diff --check` 통과, `npm run check:review-hygiene` 통과(이슈 열림4·INDEX 117/120·최근5/5, 계획 반영 후 실행). 계획 문서 링크·출시 레일과 PR40 증거는 주 작성자가 대조했다.
- 다음 전2 구현자는 현재 main에서 연구 이슈129/130의 영향부터 재현한다. 재현된다면 같은 이슈 파일을 현재 리뷰 레일에 충돌 없이 가져오고, 준비 경계와 실제 측정 문맥을 한 묶음으로 수정한다. 새 회귀의 실패 주입, 입력/출력 독립 대조, Python/JS 정합, 한글/PDF·공개본 검증과 독립 검토를 따른다.
- Windows 한글·iPad/iOS·새 문서 그림 native 출력·실계정 문서 복귀와 전3~6은 미완료. H1 전 범위 역분석을 선행 조건으로 만들지 않는다.
