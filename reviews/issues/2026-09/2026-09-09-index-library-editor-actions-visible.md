# 라이브러리에서 편집기 전용 상단 동작이 노출·실행됨

- ID: `REV-2026-059`
- 날짜: `2026-09-09`
- 보고자: `Codex`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `index`, `tests`
- 관련 인계: `HANDOFF-2026-080`, `HANDOFF-2026-081`

## 재현과 영향

문제집을 연 뒤 PEDAGOGY 로고로 라이브러리에 돌아가면 `showLibrary()`는
`#topActions.style.visibility="hidden"`을 지정하지만, Chromium에서 `#printBtn`은
계산 스타일 `visible`이며 Playwright `isVisible()`도 `true`다. 버튼을 누르면
`#exportModal`이 실제로 열린다. `currentSetId`도 마지막 문제집을 계속 가리켜 라이브러리
화면에서 마지막 문제집을 인쇄·내보내기·저장할 수 있다.

## 수정 설계

`showLibrary()`·`showLibraryLoading()`·모의고사 진입은 편집기 동작 묶음을
`display:none`으로 제외하고, `showEditor()`만 `display:flex`로 복원한다. 세 위치의 상태
전환은 작은 공용 함수로 모은다. 브랜드·모의고사·AI 문서·테마·로그인은 전역 탐색이므로
남긴다.

`test:library-ui`에 최초 라이브러리와 `editor → library` 두 경로에서 `#topActions`가
보이지 않고 인쇄 모달을 열 수 없으며, 편집기로 돌아오면 다시 보이는 검사를 추가한다.
기존 `visibility` 방식으로 되돌렸을 때 빨간불도 확인한다.
