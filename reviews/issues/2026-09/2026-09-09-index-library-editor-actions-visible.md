# 라이브러리에서 편집기 전용 상단 동작이 노출·실행됨

- ID: `REV-2026-059`
- 날짜: `2026-09-09`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`, `tests`
- 관련 인계: `HANDOFF-2026-080`, `HANDOFF-2026-081`, `HANDOFF-2026-082`

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

## 처리 기록

- 2026-09-09 — Claude: 설계대로 수정. 다만 **원인 진단을 한 가지 보탠다.**
  `visibility:hidden` 은 **작동한다** — CSS 규칙을 전부 훑어도 `visibility` 를 건드리는
  규칙이 하나도 없는데(스타일시트 전수 조사) 부모는 `hidden`, 자식 버튼은 `visible` 로
  나와 한참 헤맸다. 원인은 규칙이 아니라 **전이**다: `.btn` 의 `transition` 이 `all` 이라
  `visibility` 가 **이산 전이**를 타고, 그동안 **옛 값(`visible`)을 유지**한다.
  실측 — 즉시 `printBtn: visible` · **600ms 뒤 `hidden`**(`transition: 0.13s`).
  즉 증상은 '라이브러리에서 계속 노출' 이 아니라 **약 130ms 동안 노출·클릭 가능**이다
  (`HANDOFF-2026-080` 의 스크린샷도 그 창에 찍힌 것이었다 — 클릭 직후 촬영).
  `display` 는 즉시 반영되므로 그 창이 사라진다.
- 수정: 공용 함수 `setEditorActions(on)` 이 `#topActions` 를 `display:flex/none` 으로
  가른다. `showLibrary()` · `showLibraryLoading()` · 모의고사 `hideOthers()` 가 끄고
  `showEditor()` 만 켠다. 브랜드·모의고사·AI 문서·테마·로그인은 전역 탐색이라 남겼다.
  ⚠️ 함수를 **모의고사 IIFE 보다 앞선 스크립트**에 두었다 — 그 IIFE 는 "본체 스크립트가
  실패해도 동작하도록" 일부러 독립시킨 것이라(소스 주석) 본체 함수에 기대게 하면 그
  결정이 깨진다.
- 검사: `test:library-ui` 에 `editor-only top actions stay out of the library` 추가.
  ⚠️ **판정을 시간이 아니라 `getBoundingClientRect().width` 로 한다** — 130ms 창을
  시간으로 재면 깜빡이는 검사가 된다. `visibility:hidden` 은 자리를 그대로 차지하고
  `display:none` 은 0 이라, 시간에 흔들리지 않으면서 두 방식을 정확히 가른다.
- 깨보기: ① `LIBRARY_UI_RED=1`(수정 전 index) → 이 검사가 `최초 라이브러리에서 편집기
  동작이 보인다` 로 실패. ② **`display` 만 `visibility` 로 되돌린 고립 깨보기** → 이
  검사 하나만 실패(다른 11건은 통과). 원인이 섞이지 않았음을 확인했다.
- 2026-09-09 — Claude(후속): 원인을 **통제 실험**으로 확정했다. 빈 문서에 같은 부모 아래
  버튼 셋을 두고 부모를 `visibility:hidden` 으로 끄면 — 목록 없는 `.13s` 는 **숨긴 직후
  `visible`**, `background-color .13s` 는 `hidden`, 전이 없음도 `hidden`. **지속시간이
  아니라 속성 목록 생략이 원인**이다.
- 함정을 영구히 닫았다: `check:static` 이 세 화면에서 `.style.visibility = …` 를 금지한다
  (`transition` 23곳을 다시 쓰는 것은 시각 동작이 통째로 바뀌어 위험 대비 이득이 나쁘다 —
  `all` 단독으로는 안 터지므로 **짝을 막는 쪽**을 골랐다). 세 파일에 각각 심어 셋 다
  빨간불인 것을 확인했다.
- 판정 검증: `display:none` → **0px**, `visibility:hidden` → **52px**(전이가 끝난 500ms
  뒤에도). `test:library-ui` 3회 연속 12/12 — 깜빡이지 않는다.
