# 모의고사 저장이 전송 중 수정본을 저장 완료로 표시함

- ID: `REV-2026-082`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

`flushMocksToCloud()`의 batch.commit을 지연시킨 뒤 같은 카드 이름·문항을 바꾸었다. 전송 문항까지 after로 바뀌고, 실제로 보내지 않은 카드의 지문을 확정할 수 있었다.

## 처리 기록

전송 문서를 깊은 사본으로 만들고 그 사본의 지문만 batch 성공 후 확정한다. 전송 중 새 수정이 생기면 다음 저장을 예약한다.

`node scripts/check-review-followup.mjs`: 수정 전 after != before 실패, 수정 후 통과.
