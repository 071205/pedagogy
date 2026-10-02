# '계정 저장 보류' 문제집이 하나 있으면, 다른 문제집의 폴더 이동이 성공해도 '폴더 소속 저장 실패'라고 말한다

- ID: `REV-2026-115`
- 날짜: `2026-10-03`
- 보고자: `Claude / Opus 5.5` (HANDOFF-2026-175 재검토)
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-175`(B6 서버 출처 업데이트 보류) · 관련 이슈 `REV-2026-114`

## 요약과 영향

`8decd55` 는 `writeCloudSnapshot()` 끝에 `if(sets.some(intakeSetReadOnly)){ … return false; }` 를 넣었다.
다른 문제집이 전부 서버에 확정돼도 **읽기 전용 권이 하나라도 있으면 `false`** 다.
`retryLibrarySync()` 는 `ok!==true` 를 실패로 보고 `'폴더 소속 저장 실패 · 다시 시도해 주세요'` 토스트를 띄우며
`libMeta.syncPending=true` 를 남긴다. 그 결과 라이브러리 위 재시도 막대가 사라지지 않는다.
보류가 풀릴 때까지 **모든 폴더 이동·폴더 이름 변경**이 거짓 실패로 보고된다. 자료는 잃지 않는다(서버에는 올라갔다).
REV-2026-111 에서 정한 '사실만 말한다' 원칙과 어긋난다. 지금 운영에는 v2 를 쓰는 판이 없어서 아직 안 터진다.

## 재현 절차

`codex/b6-intake-storage` `8decd55`, `serve.py`, 외부 차단, `fbDb` 메모리 stub, `libraryCloudSchema:1`·`setRevisionSchema:1`:
1. 로컬 X·Y. 서버 X 는 문항 intake `{version:2}`(revision 3). `flushToCloud()` 한 번 → Y 확정, X 보류(114 수정대로).
2. `sets[1].folderId='folder-1'`·`libMeta.syncPending=true` 뒤 `retryLibrarySync()`.
   - 대조군(서버 X 없음): 서버 Y `folderId=folder-1`, 토스트 없음, `syncPending=false`.
   - X 보류: 서버 Y `folderId=folder-1` **인데** 토스트 `폴더 소속 저장 실패 · 다시 시도해 주세요`, `syncPending=true`.

## 제안

`writeCloudSnapshot()` 의 반환값이 '이번 저장 대상이 다 올라갔는가' 를 뜻하게 한다. 읽기 전용 보류는 저장 대상이 아니므로
그 갈래는 상태 문구만 남기고 `true` 를 돌려주거나, `retryLibrarySync()` 가 폴더 소속 대상(이동한 권)의 ACK 만 보게 한다.
회귀: 위 2번(X 보류 중 Y 폴더 이동 → 토스트 없음·`syncPending=false`)과 보류 권 자신의 폴더 이동은 계속 막히는지.
