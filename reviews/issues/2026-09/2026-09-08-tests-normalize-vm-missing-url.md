# REV-2026-052 — 정규화 모듈 VM 검사가 표준 `URL` 생성자를 제공하지 않음

- 상태: `resolved`
- 심각도: P3
- 발견: HANDOFF-2026-075 독립 검토
- 관련 인계: HANDOFF-2026-076

## 재현

`scripts/check-audit-safety.mjs`의 정규화 모듈 검사는 `vm.createContext({window:{}})`로 실행했다. 이 컨텍스트에는 표준 `URL` 생성자가 없는데, `pedagogy-normalize.js`의 `safeUrl()`은 이를 사용한다.

```js
vm.createContext({window:{}})
// pedagogy-normalize.js 실행 뒤
window.PedagogyNormalize.safeUrl('https://storage.googleapis.com/pedagogy-test/image.png')
// 실제: ''
```

따라서 검사에서 안전한 Storage URL 경로를 전혀 실행하지 않았고, 인계의 “Node에서 window만 있으면 실행”이라는 설명도 정확하지 않았다. 브라우저 제품에는 표준 `URL`이 있으므로 제품 동작 영향은 없다.

## 해결

검사 VM에 Node의 표준 `URL`을 명시적으로 주입하고, 허용된 Storage URL이 그대로 통과하는 단언을 추가했다. 이 검사는 브라우저와 같은 표준 API 전제를 드러내면서 실제 허용 경로를 검사한다.

## 검증

- `npm run test:worker` 통과
- 정규화 모듈의 허용 URL 단언 통과
