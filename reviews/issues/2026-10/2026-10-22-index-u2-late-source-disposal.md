# 계정 전환 중 늦게 열린 원문 뷰어가 해제되지 않는다

- ID: `REV-2026-142`
- 날짜: `2026-10-22`
- 보고자: `Codex 독립 검토 에이전트`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-197`

## 요약과 영향

계정 전환 중 늦게 열린 원문 뷰어가 해제되지 않는다. U2 미배포 초안에서 독립 검토가 재현했으며 운영 발생을 주장하지 않는다.

## 재현 절차

원문 열기의 bridge.source Promise를 지연하고 owner를 바꿔 강제 닫은 후 뷰어를 resolve한다.

## 기대 결과 / 실제 결과

- 기대: 기존 사용자 데이터와 화면 상태를 보존하고 작업/계정 경계를 지킨다.
- 실제: 기존 current()가 먼저 throw하여 새 뷰어의 close 호출이 0회였다.

## 근거

`pedagogy-composition-ui.js`와 `pedagogy-intake.js`의 해당 흐름. 독립 재현 `/private/tmp/u2-ui-independent-review/`의 probes/owner-probe/selection-probe 및 로그. 영구 재현은 `scripts/check-composition-ui.mjs`의 같은 경계 검사다.

## 처리 기록

- 2026-10-22 · Codex 구현자: 뷰어를 받은 뒤 취소/계정/원문 세대를 검사해 늦은 뷰어를 즉시 닫는다. late-source-disposal과 해제 방어 제거 RED로 검증한다. 미배포 초안을 보완했으며 최종 독립 재확인 결과는 HANDOFF-197에 이어 기록한다.
