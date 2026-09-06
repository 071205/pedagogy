# CDN 이 막힌 망에서 문항을 열면 편집기가 통째로 안 그려진다

- ID: `REV-2026-023`
- 날짜: `2026-09-07`
- 보고자: `Claude` (1단계 연기 검사가 잡았다)
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`, `tests`
- 관련 인계: `HANDOFF-2026-053`

## 요약과 영향

`renderEditor()` 가 `new Sortable($("#blocksArea"), …)` 를 **맨몸으로** 부른다
(`index.html:4328`). SortableJS 는 CDN(`cdn.jsdelivr.net`)에서 오므로 그 호스트가 막히면
`Sortable` 이 정의되지 않고 **`ReferenceError` 가 `renderEditor()` 를 통째로 중단시킨다.**
문항을 여는 순간 블록 편집기가 그려지지 않는다.

학교·기업 망의 CDN 차단, 광고 차단 확장, 느린 회선에서 실제로 일어난다.
`setOrderMode()` 의 `new Sortable($("#qList"), …)`(`index.html:3475`)도 같다.

⚠️ **순서 바꾸기는 편의 기능이고 편집기는 본체다.** 편의 기능 하나가 없다고 본체가
멈추면 안 된다.

## 재현 절차

1. `cdn.jsdelivr.net` · `cdnjs.cloudflare.com` 요청을 막는다.
2. `index.html` 을 열고 문제집을 가져와 문항을 연다.
3. 콘솔에 `ReferenceError: Sortable is not defined` 가 뜨고 블록 편집기가 비어 있다.

자동 재현: `npm run test:cross` (`runCdnBlocked`).

## 기대 결과 / 실제 결과

- 기대: 순서 바꾸기만 못 쓰고 편집·저장·내보내기는 그대로 된다.
- 실제: `renderEditor()` 가 중단돼 편집기가 안 그려진다.

## 처리 기록

- 원인: 선택적 CDN 라이브러리를 있는지 확인하지 않고 불렀다.
- 수정: `makeSortable(el, opts, why)` 를 만들어 `typeof Sortable==="undefined"` 면
  `warnOnce()` 로 알리고 `null` 을 돌려준다. 두 호출부가 그것을 쓴다.
- 검증: `npm run test:cross` 의 CDN 차단 항목이 **"문제집을 계속 편집할 수 있다" ·
  "내보내기가 살아 있다"** 를 본다. 일부러 `new Sortable` 로 되돌려
  `❌ 앱이 뜨지 않는다 — ReferenceError: Sortable is not defined` 를 확인했다.
- 회귀 122/122 · `check:fast` · `test:visual` 7세트 통과.
