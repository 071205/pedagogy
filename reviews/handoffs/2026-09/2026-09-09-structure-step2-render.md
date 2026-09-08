# HANDOFF-2026-077 — 구조 2단계: 안전한 HTML 렌더 분리

- 상태: ready-for-review
- 작성: Codex
- 기준 HEAD: `ee81250`
- 설계: `docs/STRUCTURE-DESIGN.md` 2단계
- 관련 이슈: 없음

## 변경

정규화된 문제집 데이터를 HTML로 바꾸는 함수 17개와 내부 보조 함수를
`pedagogy-render.js`로 옮겼다. `index.html`은 `window.PedagogyRender`에서 이름을 풀어
기존 호출부를 유지한다. 편집기에서도 쓰는 `HSMALL`·`condLabel`·`circled`는 모듈이
내보내지만, 옮기기 전과 같이 `window` 속성으로 만들지 않는다.

`serve.py` 정적 파일 목록에 새 모듈을 추가했다. 결과적으로 `index.html`은
6,847줄에서 6,447줄로 줄었고, 새 모듈은 447줄·25,412바이트다.

## 지킨 계약

- `blockHTML(blk, ctx)`의 `ctx.subject`와 `ctx.range`를 그대로 유지했다.
- 사용자 문자열은 `sanitize()`를 거친 뒤에만 제한된 인라인 표시로 바뀐다.
- 옮기기 전 최상위 함수 17개의 `window` 표면을 정확히 유지했다.
- HTTP와 `file://` 모두 고전 스크립트 순서 `normalize → render → index`로 부팅한다.
- 저장·동기화와 전역 상태는 건드리지 않았다.

## 검사

새 계약 검사를 구현 전에 추가했을 때 `PedagogyRender` 부재로 의도대로 실패했다. 구현 후:

- `npm run check:fast` 통과
- 브라우저 회귀 154 / 154 통과
- `test:review-contracts` 19건 통과
- Chromium 데스크톱·태블릿·휴대폰 및 CDN 차단 검사 통과
- `file://` 부팅, 렌더 namespace·기존 `window` 표면·XSS 이스케이프·과목/범위 문맥 통과

기본 Python에 `lxml`이 없어 `check:fast` 안의 Python HWPX 대조는 건너뛰었지만, 이 변경은
HWPX 구현을 건드리지 않는다. 원격 push와 Firebase/Worker 배포는 하지 않았다.
`.tmp.driveupload/`의 다른 작업자 파일은 건드리지 않았다.
