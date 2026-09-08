# 그림 바이트와 파일명 확장자가 다르면 HWPX MIME이 틀림

- ID: `REV-2026-050`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

그림 바이트와 파일명 확장자가 다르면 HWPX MIME이 틀림. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

정상 PNG를 wrong.jpg라는 src로 실제 ExamWriter.figure에 넣는다. JPEG에는 png 이름을 준다.

## 기대 결과 / 실제 결과

- 기대: BinData의 확장자와 manifest MIME은 실제 바이트 형식과 일치한다.
- 실제: imageSize는 PNG로 읽어도 appendPicture가 src 확장자를 사용하여 PNG 바이트를 image/jpeg로 선언한다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. JS/Python 그림 배치가 바이트 형식으로 파일명 확장자를 정규화한다. 너비·높이가 0인 데이터는 배치하지 않는다.
- 검증: 실제 doc.parts와 content.hpf 검사: PNG→wrong.png/image/png, JPEG→wrong-jpeg.jpg, 실패 바이트→그림 경고 및 자리표시. 수정 전 PNG 파일명 검사 실패.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
