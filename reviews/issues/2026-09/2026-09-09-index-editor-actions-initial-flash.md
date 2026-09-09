# 초기 부팅 중 편집기 전용 상단 동작이 노출·실행됨

- ID: `REV-2026-061`
- 날짜: `2026-09-09`
- 보고자: `Codex`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `index`, `tests`
- 관련 인계: `HANDOFF-2026-082`, `HANDOFF-2026-083`

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
