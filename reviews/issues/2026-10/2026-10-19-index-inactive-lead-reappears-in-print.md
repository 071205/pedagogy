# 묶음이 아닌 문항의 숨은 옛 안내가 인쇄물에 나타난다

- ID: `REV-2026-134`
- 날짜: `2026-10-19`
- 보고자: `Claude Opus 클라우드 2회차 검토 · Codex 독립 재현`
- 상태: `resolved`
- 심각도: `P3`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-194`
- 검토 기준: `c2dba2b` (PR #23)

## 요약과 영향

옛 UI에서 문항 수를 1로 되돌릴 때 `groupLead` 원문은 남고 화면에서만 숨었다.
`groupHeadHTML()`이 범위 없이 모든 안내를 렌더하도록 바뀌자, 묶음이 아닌 단독 문항의
옛 안내가 미리보기·인쇄물에 조용히 나타났다. 기존 출력물의 뜻이 변한다.

## 재현 절차

1. `{id:'a',groupLead:'옛 안내'}`이고 `groupOf`가 없는 문항 하나를 가진 권을 연다.
2. 미리보기와 `buildPrintDoc()` 출력을 본다.
3. 비교로 정상 2문항 안내 묶음의 구성원을 삭제해 1문항 대표를 만든다.

## 기대 결과 / 실제 결과

- 기대: 독립 문항의 남은 안내는 편집기에 보존하되 출력하지 않는다. 2→1 축소 뒤
  `groupOf===id`인 대표의 안내는 범위 없이 출력한다.
- 실제(기준 `c2dba2b`): 독립 문항도 `<div class="grp-head psg-head">옛 안내</div>`가 출력된다.

## 근거

- Claude Opus PR #23 댓글 `6257247920`. Codex가 같은 head의 `groupHeadHTML()`에서 독립 재현했다.
- `REV108_FOLLOWUP_REVIEW_BASELINE=hiddenLead`의 실제 DOM 기준 RED와
  `REV108_FOLLOWUP_RED=hiddenLead` 방어 제거 RED가 같은 출력 누출을 재현한다.

## 처리 기록

- `2026-10-19` — Claude Opus 2회차 독립 검토: 묶음 아닌 안내가 출력에 부활하는 결함을 재현.
- `2026-10-19` — Codex GPT-6 Sol / high: `groupHeadHTML()`을 ID가 있는 자기 참조 대표에만
  적용했다. 실제 DOM에서 묶음 없는 안내의 미리보기/조판 미출력과 편집값 보존,
  정상 2→1 삭제 뒤 selfref 대표의 안내 출력을 확인했다. 명시 `이 문항만` 선택과 D-b `묶음 풀기`는
  selfref를 제거하므로 안내 원문을 보존하되 출력하지 않는다.
  `test:rev108`의 정상/표적 RED/`c2dba2b` 기준 RED 및 RED 변이 생략 제어를 확인했다.
  Claude 변경분 독립 재검토는 아직이다.
