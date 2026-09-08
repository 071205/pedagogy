# 계정 전환 뒤 앞 계정의 폴더 메타가 남음

- ID: `REV-2026-045`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

계정 전환 뒤 앞 계정의 폴더 메타가 남음. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

A 계정 메타를 메모리에 두고 B 계정 로컬 키에 B-only 폴더를 저장한다. 부팅이 끝난 상태에서 실제 onAuth(B)를 실행한다.

## 기대 결과 / 실제 결과

- 기대: B-only만 보여야 한다.
- 실제: A-only가 그대로 남는다. bootLibrary만 readLibMeta를 호출하며 이후 계정 전환은 loadSets만 부른다. B의 prefs 저장에 A 폴더가 섞일 수 있다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. 소유자가 바뀔 때 메타·언어·선택·필터를 교체하고 이전 prefs 구독과 타이머를 해제했다. 비동기 결과는 기존 계정 세대 guard로 차단한다.
- 검증: account switch 검사 A-only→B-only 통과. 기존 A-B/A-B-A 저장 감사 검사도 통과.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
