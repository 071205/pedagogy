# 폴더 tombstone을 소속 판정·동시 저장이 무시함

- ID: `REV-2026-043`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

폴더 tombstone을 소속 판정·동시 저장이 무시함. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

folderTombstones.gone=10과 set.folderId=gone을 주고 folderOf/setToDoc을 호출한다. 다른 기기의 오래된 폴더 목록도 동시에 저장한다.

## 기대 결과 / 실제 결과

- 기대: 화면과 다음 쓰기는 폴더 없음이며 원격 삭제 기록은 남아야 한다.
- 실제: folderOf와 setToDoc 모두 gone을 반환한다. prefs의 전체 set은 다른 기기의 tombstone을 덮어쓸 수 있다. 명시적 빈 folderId도 옛 로컬 지도에서 부활한다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. liveFolderId, 원격 transaction 병합, prefs 구독, 명시적 빈 값 보존, 이관 시점 수정, 400개 소속 배치 및 영속 재시도 표시를 추가했다.
- 검증: folder tombstone / A migration / concurrent prefs 검사. 401개 두 번째 배치 실패 뒤 [400,1,400,1]로 재시도하고 삭제 기록 999를 보존한다.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
