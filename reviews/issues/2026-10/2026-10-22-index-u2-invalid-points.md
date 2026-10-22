# 음수 배점이 null점 권 구성으로 이어진다

- ID: `REV-2026-141`
- 날짜: `2026-10-22`
- 보고자: `Codex 독립 검토 에이전트`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-197`

## 요약과 영향

음수 배점이 null점 권 구성으로 이어진다. U2 미배포 초안에서 독립 검토가 재현했으며 운영 발생을 주장하지 않는다.

## 재현 절차

구성 상세에서 배점 -1을 입력하고 문항 수정 저장 후 배점별 제안을 연다.

## 기대 결과 / 실제 결과

- 기대: 기존 사용자 데이터와 화면 상태를 보존하고 작업/계정 경계를 지킨다.
- 실제: type=button은 min 검증을 강제하지 않아 points:null/pointsState:read가 저장되고 null점 권이 생겼다.

## 근거

`pedagogy-composition-ui.js`와 `pedagogy-intake.js`의 해당 흐름. 독립 재현 `/private/tmp/u2-ui-independent-review/`의 probes/owner-probe/selection-probe 및 로그. 영구 재현은 `scripts/check-composition-ui.mjs`의 같은 경계 검사다.

## 처리 기록

- 2026-10-22 · Codex 구현자: 저장 엔진에서 유한 0이상 숫자·read/null 정합성을 검사하고 planner는 잘못된 배점을 미분류로 둔다. invalid-points 정상/배점 방어 제거 RED로 검증한다. 미배포 초안을 보완했으며 최종 독립 재확인 결과는 HANDOFF-197에 이어 기록한다.
