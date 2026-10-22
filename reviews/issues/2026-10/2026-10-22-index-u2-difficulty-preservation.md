# 본문만 수정해도 자유 난이도 분류가 지워진다

- ID: `REV-2026-140`
- 날짜: `2026-10-22`
- 보고자: `Codex 독립 검토 에이전트`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-197`

## 요약과 영향

본문만 수정해도 자유 난이도 분류가 지워진다. U2 미배포 초안에서 독립 검토가 재현했으며 운영 발생을 주장하지 않는다.

## 재현 절차

난이도 최상위/ai·reviewed 문항을 스냅샷으로 열고 정답만 바꿔 저장한다.

## 기대 결과 / 실제 결과

- 기대: 기존 사용자 데이터와 화면 상태를 보존하고 작업/계정 경계를 지킨다.
- 실제: 초기 UI select에 최상위 옵션이 없어 빈값이 되고 difficulty:null/classificationReview:unreviewed로 바뀌었다.

## 근거

`pedagogy-composition-ui.js`와 `pedagogy-intake.js`의 해당 흐름. 독립 재현 `/private/tmp/u2-ui-independent-review/`의 probes/owner-probe/selection-probe 및 로그. 영구 재현은 `scripts/check-composition-ui.mjs`의 같은 경계 검사다.

## 처리 기록

- 2026-10-22 · Codex 구현자: 자유 난이도 입력과 필드 실제 변경 비교로 원래 값·출처·분류 검토 상태를 보존한다. dirty-and-undo UI 검사가 최상위/ai·reviewed 보존을 확인한다. 미배포 초안을 보완했으며 최종 독립 재확인 결과는 HANDOFF-197에 이어 기록한다.
