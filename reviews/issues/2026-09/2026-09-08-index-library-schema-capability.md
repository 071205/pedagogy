# 폴더 스키마 capability 부재와 구형 저장·삭제 비호환

- ID: `REV-2026-044`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

폴더 스키마 capability 부재와 구형 저장·삭제 비호환. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

capability 0에서 setFolder/setToDoc을 호출한다. 이어 수정 전 Rules에 folderId가 없는 일반 문서 및 삭제 tombstone을 보낸다.

## 기대 결과 / 실제 결과

- 기대: A단계는 로컬 지도만 쓰고 구형 요청은 B Rules에서도 유효해야 한다.
- 실제: capability를 읽는 경로가 없어 set과 요청 모두 folderId가 생긴다. 반대로 기존 deleteSetEverywhere/wipeCloudSets tombstone에는 필드가 없어서 B Rules가 거부한다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. libraryCloudSchema를 공개 설정에 명시하고 로컬 이동/직렬화/이관/prefs를 분기했다. B 삭제는 새 모양으로 직렬화하고 Rules는 구형 필드 부재도 허용한다.
- 검증: capability-off 실제 제품 검사 통과. Rules emulator에서 필드 없는 저장·tombstone 통과. REVIEW_RED=1의 원 Rules는 거부하여 exit 1.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
