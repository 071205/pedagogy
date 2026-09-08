# file:// 모의고사 HWPX가 템플릿 fetch에서 실패함

- ID: `REV-2026-048`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-070`, `HANDOFF-2026-072`, `HANDOFF-2026-073`

## 요약과 영향

file:// 모의고사 HWPX가 템플릿 fetch에서 실패함. 기준 제품은 `31da3eb`이며 검토 대상 변경은 `aafc257`·`42b62d8`·`2944df9`·`6fa6306`이다.

## 재현 절차

Chromium 기본 allow-file-access 플래그를 제거하고 file://로 편집기를 연다. API 서버 접근을 실패시키고 한글 내보내기를 누른다.

## 기대 결과 / 실제 결과

- 기대: 브라우저 조판기로 내장 그림까지 포함한 HWPX를 다운로드한다.
- 실제: EXAM_TEMPLATE_URL fetch가 막혀 서버 경로로 떨어지며 다운로드가 없다. 정적 HTTP의 동일 동작은 성공한다.

## 근거

`scripts/check-review-contracts.mjs`는 실제 페이지 함수와 격리된 원격 경계를 실행한다.
`REVIEW_RED=1`은 작업 파일을 변경하지 않고 기준 커밋의 제품 코드를 공급한다.
Rules는 `scripts/verify-rules-emulator.mjs`와 로컬 emulator를 사용한다.

## 처리 기록

- 2026-09-08 — Codex: 재현 후 직접 수정. 원본 exam-math.hwpx로 생성한 고전 스크립트 fallback을 file://에 연결했다. 원본 일치 검사를 check:fast에 추가하고 STATIC에 등록했다.
- 검증: HTTP 및 file:// 실제 버튼 다운로드 통과. ZIP 안 BinData/figure.png 확인. 수정 전 file 경로는 download timeout. AI 문서 blank.hwpx fetch는 별도 기존 제약으로 문서화.
- 운영 push·Rules/Worker 배포는 하지 않았다. 상세 검증 범위와 한계는 HANDOFF-2026-073 참조.
