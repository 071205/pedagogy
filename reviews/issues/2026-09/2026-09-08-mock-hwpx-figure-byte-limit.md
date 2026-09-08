# 가져온 그림이 UI의 2MiB 상한을 우회함

- ID: `REV-2026-049`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

가져온 그림이 UI의 2MiB 상한을 우회함. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

2MiB+1 바이트를 base64 PNG 데이터 URL로 만들고 실제 normBlockM에 넣는다.

## 기대 결과 / 실제 결과

- 기대: UI와 동일한 2MiB 제한으로 거부한다.
- 실제: raw.length <= MAX_FIG_BYTES*2는 base64 팽창률과 맞지 않아 2MiB 초과 데이터를 허용한다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. 정규화에서 base64 구문 및 실제 디코딩 길이를 검사한다. JS/Python 조판기에도 PNG/JPEG 화이트리스트와 동일 바이트 상한을 적용했다.
- 검증: mock JSON image 검사: 수정 전 2796226자 허용, 수정 후 길이 0. Python/JS HWPX 대조 통과.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
