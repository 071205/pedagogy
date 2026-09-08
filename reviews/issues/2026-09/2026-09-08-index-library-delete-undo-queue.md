# 선택 삭제 tombstone이 Undo 복원 저장과 경쟁함

- ID: `REV-2026-046`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

선택 삭제 tombstone이 Undo 복원 저장과 경쟁함. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

원격 tombstone 응답을 지연한다. 선택 삭제 직후 Undo 및 flushToCloud를 실행하고 그 뒤 tombstone을 완료한다.

## 기대 결과 / 실제 결과

- 기대: 삭제→복원 순서로 원격에 반영되어야 한다.
- 실제: 원 코드의 쓰기 순서는 delete 시작→restore→delete 완료다. UI가 Undo 불가라고 말해도 saveSets는 일반 Undo 기록을 남긴다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. deleteSetEverywhere와 일반 저장이 cloudSaveQueue를 공유한다. 선택 삭제 스냅샷을 동기로 확정하고 Undo 복원 timestamp를 삭제보다 높인다. Redo 제거도 같은 큐를 쓴다.
- 검증: 게이트로 원격 응답을 늦춘 제품 검사 및 실제 선택 버튼→doUndo→늦은 onSnapshot→doRedo 검사 통과. 이미지 원본 보존 감사도 유지.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
