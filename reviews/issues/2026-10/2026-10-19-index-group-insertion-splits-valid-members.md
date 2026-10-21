# 복제·JSON 삽입이 정상 묶음 중간을 갈라 인쇄를 막는다

- ID: `REV-2026-133`
- 날짜: `2026-10-19`
- 보고자: `Claude Opus 클라우드 독립 검토 · Codex 실제 UI 재현 확인`
- 상태: `resolved`
- 심각도: `P3`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-194`
- 검토 기준: `1a0fc50` (PR #23)

## 요약과 영향

정상 3문항 지문 묶음의 대표를 복제하면 복제본이 대표 바로 뒤에 들어가 원래 구성원과 대표를
갈라 놓는다. JSON 붙여넣기도 현재 문항이 묶음의 중간 구성원일 때 같은 위치 오류가 난다.
복제본·붙여넣은 문항은 묶음에 자동 가입되지 않지만, 앱이 선택한 위치 때문에 정상 묶음이
비연속이 되어 미리보기·인쇄가 차단된다.

## 재현 절차

1. `P1(groupOf:P1), P2(groupOf:P1), P3(groupOf:P1), Q4`인 합성 권을 연다.
2. 실제 문항 목록에서 P1의 `이 문항 복제`를 누른다. 별도 반복에서는 P2를 선택한 뒤 JSON 파일을 붙여넣는다.
3. 두 경로 모두 새 문항이 묶음 안에 들어가 `묶음 구성원이 연속하지 않음` 진단이 생기고 인쇄가 거절된다.

## 기대 결과 / 실제 결과

- 기대: 검증된 묶음 중간을 가리킨 삽입은 P3 뒤로 옮긴다. 새 문항은 독립이고 기존 묶음은 인쇄 가능하다.
- 실제(기준 `1a0fc50`): 복제는 `fi+1`, 붙여넣기는 현재 위치 `+1`에 삽입해 정상 묶음을 갈랐다.

## 근거

- Claude Opus PR #23 댓글 `6257002399`의 실제 Chromium 재현. Codex는 같은 두 실제 UI 경로를
  `REV108_FOLLOWUP_BASELINE=duplicate|paste`로 `1a0fc50`에서 다시 RED 확인했다.
- `index.html`의 복제·JSON 파일 입력 핸들러와 `pedagogy-normalize.js`의
  `insertionIndexAfterGroup()`을 현재 DOM 회귀·방어 제거 RED로 확인했다.

## 처리 기록

- `2026-10-19` — Claude Opus 클라우드 독립 검토: 실제 UI 두 경로를 재현해 등록 요청.
- `2026-10-19` — Codex GPT-6 Sol / high: 검증된 묶음 중간에 한해 공통 위치 정책으로 묶음 끝 뒤에 삽입.
  `node scripts/check-rev108-followup.mjs`의 복제·JSON 경로 정상, `REV108_FOLLOWUP_RED=duplicate|paste`
  방어 제거 RED, `REV108_FOLLOWUP_BASELINE=duplicate|paste` 기준 RED 통과. 두 경로에서 기존 ID·소속과
  독립 새 문항, 실제 `buildPrintDoc()` 허용을 확인했다. Claude 변경분 독립 재검토는 아직이다.
- `2026-10-19` — Claude Opus 2회차 검토 댓글 `6257247920`으로 재개: 기준 `c2dba2b`에서
  구조가 정상인 옛 `legacy` 3문항 묶음의 대표 복제와 중간 구성원 뒤 JSON 붙여넣기는
  `validGroups()`에 들지 않아 여전히 중간 삽입된다. Codex가 현재 API로 독립 재현한 결과
  `confirmableLegacyGroups` 1→0과 `묶음 구성원이 연속하지 않음` 진단을 확인했다.
- `2026-10-19` — Codex GPT-6 Sol / high: 삽입 위치 판정에 구조상 유효한
  `confirmableLegacyGroups()`의 끝도 사용했다. 옛 검토 표식은 유지하고, 새 문항은 독립으로 둔다.
  실제 UI 대표 복제·구성원 뒤 JSON 두 경로에서 기존 연속 소속·일괄 확인 후보 1개를 보존했다.
  `REV108_FOLLOWUP_RED=legacyDuplicate|legacyPaste` 방어 제거 RED와
  `REV108_FOLLOWUP_REVIEW_BASELINE=legacyDuplicate|legacyPaste`의 `c2dba2b` 기준 RED가 통과했다.
  `invalid`·`intake`는 위치를 보정하지 않는 경계도 부모 독립 VM으로 확인했다
  (`/private/tmp/rev108-review2-2026-10-19/parent-boundaries.log`). Claude 변경분 재검토는 아직이다.
