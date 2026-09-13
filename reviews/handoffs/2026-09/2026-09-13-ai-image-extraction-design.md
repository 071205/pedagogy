# 변경 인계 — DEV-2 AI 이미지 경계 추출 설계

- ID: `HANDOFF-2026-130`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `docs`
- 관련 이슈: `없음` (074·075 열린 상태 유지)

## 변경 내용

후보 A 중 blobToBase64·전처리 상수·prepImageForAI·aiBlocksToProblem 53줄을 첫 추출 경계로 선택했다.
[확정 설계](../../../docs/AI-IMAGE-EXTRACTION-DESIGN.md)에 의존 함수 3개 주입, window/lexical 호환,
classic script 로딩, 공개 빌드, 회귀·실패 주입과 복귀 범위를 고정했다. 제품 구현은 하지 않았다.

## 검토 근거와 한계

B의 핵심은 44줄이며 폭·탭·렌더 함수가 상태를 공유한다. C는 769줄이나 저장·이벤트 결합이 크다.
A도 53줄 순감소나 실제 토큰 절감을 보장하지 않으며 DEV-5에서 연결·검사 비용을 포함해 평가한다.
DEV-1의 전체 ref 검색 실패와 달리 HEAD 한정 이력은 읽을 수 있었다. 074를 해결했다고 쓰지 않는다.
지도에서 buildPrintDoc(index)·fitMathIn(pedagogy-print)의 잘못된 소속을 정정하고 이전 단계 표 상태도 맞췄다.

## 검증

- 현 소스의 이동 구간·호출부·상수와 tests/regression-test.html의 lexical hook을 대조했다.
- `git log HEAD -L :함수:index.html --no-patch`로 네 후보 함수의 이력을 확인했다.
- 변경 문서 5개의 로컬 링크·소스 기호/기존 검사 명령 존재·git diff --check 통과. 제품·테스트 무수정이라 회귀는 반복하지 않았다.
- 설계의 새로운 브라우저 회귀·실패 주입은 DEV-3 수행 항목이며 아직 통과한 결과가 아니다.

## 다음 작업자에게

DEV-3/Terra medium은 확정 설계의 한 경계를 구현하고 필요한 회귀·실패 주입·구현 인계까지 완료한다.
구현 뒤 DEV-4/Sol medium으로 넘긴다. OPS-6 이후 서비스 작업이나 다른 추출 후보는 아직 착수하지 않는다.
transcript.txt는 미추적 사용자 파일로 유지한다.
