# 초기 부팅 중 편집기 전용 상단 동작이 노출·실행됨

- ID: `REV-2026-061`
- 날짜: `2026-09-09`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`, `tests`
- 관련 인계: `HANDOFF-2026-082`, `HANDOFF-2026-083`, `HANDOFF-2026-084`

## 요약과 영향

`af39779`는 `showLibrary()`가 호출된 뒤의 상단 동작을 즉시 숨기지만, HTML의 초기값은
여전히 `.actions { display:flex }`다. 하단 인라인 스크립트가 클릭 핸들러를 등록한 뒤에도
defer SDK와 `DOMContentLoaded`·인증 초기화가 끝날 때까지 `showLibrary()`가 호출되지 않아,
느린 첫 로드에서는 편집기 전용 버튼이 보이고 눌린다.

## 독립 재현

Chromium에서 `firebase-app-compat.js` 응답만 1.5초 늦추고, 하단 인라인 스크립트의
`showLibrary` 선언이 생긴 직후를 측정했다.

```text
부팅 중: topActions display=flex, printBtn width=52.5, onclick=function
클릭:    exportModal visible=true
부팅 후: topActions display=none, printBtn width=0
```

현재 `test:library-ui`의 새 검사는 앱이 모두 뜬 다음 `showLibrary()`를 직접 부르므로 이 구간을
검사하지 않는다.

## 수정 설계

`#topActions`의 HTML/CSS 초기 상태를 `display:none`으로 두고, `showEditor()`의
`setEditorActions(true)`만 인라인 `display:flex`를 부여한다. 그러면 JS가 늦거나 실패해도
편집기 문맥이 생기기 전에는 동작이 노출되지 않는다.

회귀 검사는 한 defer 스크립트를 지연한 채 `showLibrary` 함수가 등록됐지만
`DOMContentLoaded`는 끝나지 않은 시점에서 폭 0·`isVisible() === false`를 단언한다.
초기 숨김 선언을 제거했을 때 이 검사만 빨간불인지 확인한다.

## 처리 기록

- 2026-09-09 — Claude: 설계대로 수정. `#topActions{display:none}` 을 CSS 에 두어 **초기값을
  숨김**으로 했다. id 규칙이 `.actions` 클래스를 이기고, `setEditorActions(true)` 의
  **인라인** `display:flex` 가 다시 그것을 이긴다 — JS 가 늦거나 실패해도 편집기 문맥이
  생기기 전에는 안 드러난다. (`.actions` 가 `#topActions` 전용임을 확인했다.)
- ⚠️ **설계의 판별 조건은 그대로 쓸 수 없었다.** "`DOMContentLoaded` 는 끝나지 않은 시점"
  으로 잡으려 했는데, 부팅 타임라인을 찍어 보니 **파싱이 끝나자마자 `readyState` 가
  `interactive`** 가 되고 `loading` 에 머물지 않아 `showLibrary` 존재 시점과 겹치지 않는다:
  `150ms loading/undefined → 300ms interactive/function → 1800ms complete`.
  표지를 **늦춘 SDK 자체**(`typeof window.firebase==='undefined'`)로 바꿨다. 판정은 요청대로
  자리 기반(`getBoundingClientRect().width`)을 유지했다.
- 검사: `test:library-ui` 에 `editor-only top actions stay hidden during a slow boot` 추가
  (12 → 13건). `firebase-app-compat.js` 만 1.5초 늦춘다.
- 깨보기: `#topActions{display:none}` **한 줄만** 지우니 → **새 검사 하나만** 빨간불
  (`w:53, shown:true, booted:undefined`), 나머지 12건 통과. 원인이 섞이지 않았다.
