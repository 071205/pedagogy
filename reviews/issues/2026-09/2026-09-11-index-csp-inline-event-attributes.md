# CSP가 주석과 달리 인라인 이벤트 속성을 허용한다

- ID: `REV-2026-081`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index | mock | document | security`
- 관련 인계: `HANDOFF-2026-118`

## 재현과 영향

`serve.py`로 실제 index.html을 로드하고 button에
`onclick="window.__cspProbe.attribute++"`를 설정해 클릭했다. 기존 주석은 이벤트 속성이
차단된다고 했지만 실제 marker는 1이었다. `script-src 'unsafe-inline'`을 상속하며
`script-src-attr`가 없기 때문이다. mock/document도 같은 정책 구조다.

이것은 CSP의 2차 방어 누락이다. 사용자 입력이 sanitizer를 통과해 XSS가 되는 공격 경로를
발견했다고 주장하지 않는다. 기대 결과는 속성 실행 0, JS의 onclick 함수와 listener 실행 1이다.

## 처리 기록

- 2026-09-11 — Codex: `scripts/check-csp-browser.mjs`를 수정 전 코드에서 실행해
  `chromium/index.html: inline attribute must be blocked`, `1 !== 0` 실패를 확인했다.
- 같은 날 세 HTML에 `script-src-attr 'none'`을 추가하고 index의 잘못된 설명을 수정했다.
  Chromium·WebKit·Firefox × 세 페이지 모두 속성 실행 0, JS callback·script block 정상.
  실제 HTTP 응답에서 이 지시어만 제거한 변형은 모두 속성 실행 1을 검출했다.
- 기존 regression-test.html의 XSS 검사는 CSP 없는 부모 문서에서 실행되어 새 정책이
  sanitizer 회귀를 가리지 않는다. `check:fast`의 브라우저 회귀 158/158 통과.
