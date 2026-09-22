# 짝 선지 칸 수 변경 뒤 revision 저장이 영원히 clean이 되지 않는다

- ID: `REV-2026-106`
- 날짜: `2026-09-22`
- 보고자: `Claude / Opus 5`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-161`

## 요약과 영향

짝 선지를 3칸에서 2칸으로 바꾸면 라이브 `cells` 행에 숨은 셋째 값이 남을 수 있다.
전송 경계는 활성 2칸만 보내지만 `isCloudSynced()`는 원본 3칸과 ACK 2칸을 비교해 항상 dirty가
되고, revision 플래그 1에서 transaction 읽기와 `flushToCloud()` 재예약이 반복된다.

## 재현 절차

1. revision 하네스의 문제집에 `pairs:2`, `cells:[["a","b","숨은 셋째"]]`를 둔다.
2. `writeCloudSnapshot()`을 실행한다.
3. ACK 뒤 `isCloudSynced()`와 재예약 횟수를 확인한다.

## 기대 결과 / 실제 결과

- 기대: 원본을 바꾸지 않고 전송 성공 뒤 clean이 되며 재예약하지 않는다.
- 실제: 수정 전에는 clean이 되지 않아 `writeCloudSnapshot()`이 완료값 없이 재예약했다.

## 근거

`scripts/check-set-revision-cas.mjs`의 `짝 3칸에서 2칸 전환 뒤 ACK가 저장 재예약을 반복하지 않는다`.
수정 전 실제 빨간불을 확인했다.

## 처리 기록

- `2026-09-22` — `Codex / Sol high`: `pairedCellsTransportShape()`을 전송과 dirty 비교가 공유하게
  하고 `setProblemsForSync()`이 원본 불변인 전송 고정점만 비교하도록 수정했다. B3 검사 17건과
  B3 이전 깨보기 17건, `test:public` 통과. 관련 회귀와 Claude 좁은 재검토 후 닫는다.
- `2026-09-22` — `Claude / Opus 5`: 좁은 재검토에서 전송·dirty·CAS 기준의 고정점 수렴,
  decode 멱등성, 원본 불변, false-clean 부재를 확인해 해결 판정. 제안한 `cellsFlat=['a','b']`
  순서 단언도 추가하고 표적 검사를 재실행했다.
