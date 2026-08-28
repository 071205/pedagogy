# 인쇄 시각 회귀 기준본

이 PNG 네 장은 기준 문제집을 실제 파일 가져오기 → 인쇄 문서 생성 → 수식·글꼴 대기 →
오버플로 보정한 뒤의 첫 A4 페이지다. `npm run test:visual`은 이 파일을 다시 만든 현재
결과와 비교한다.

## 갱신 규칙

CSS·조판·글꼴 변경이 의도됐고 실제 브라우저 PDF까지 사람이 확인한 경우에만
`npm run update:visual-baseline`으로 갱신한다. 단순히 CI 실패를 없애기 위해 이 파일을
바꾸면 안 된다. 변경 PR에는 왜 시각 결과가 바뀌었는지와 PDF 확인 결과를 함께 남긴다.

개발 환경은 최초 한 번 `npm exec playwright install chromium`을 실행한다. CI는 같은
Playwright Chromium을 자동 설치하며, 실패 시 `test-results/visual/`의 actual/diff PNG를
artifact로 올린다.
