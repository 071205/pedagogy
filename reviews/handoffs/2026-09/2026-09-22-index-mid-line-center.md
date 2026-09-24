# 변경 인계 — statement·boxed 의 ⋮·… 단독행 가운데 정렬 (R4.5 둘째 묶음)

- ID: `HANDOFF-2026-164`
- 날짜: `2026-09-22`
- 작성자: `Claude / Sonnet 5`
- 상태: `ready-for-review`
- 영향 영역: `index | tests`
- 관련 이슈: `없음` — `HANDOFF-2026-159`(신고 검증·설계)의 후속 구현

## 변경 내용

`HANDOFF-2026-159` §2 의 설계대로, R4.5 둘째 묶음을 구현했다.

- `isEllipsisLine()`(`pedagogy-render.js`)이 `(중략)(하략)(전략)` 뿐 아니라 한 줄 전체가
  `⋮` 또는 `…` 하나뿐일 때도 잡도록 넓혔다. 판정은 여전히 **줄 전체가 그 모양일 때만**이다
  — 문장 중간의 `…`는 이 규칙과 무관하다.
- `statement`·`boxed` 블록은 `processText(text)`에 텍스트를 통째로 넘기던 자리라(`\n`이
  6pt 간격 span으로만 바뀐다) 가운데 정렬할 상자 자체가 없었다. 새 `midAwareHTML(raw)`가
  `splitParagraphs()`로 줄을 가른 뒤 특수행만 `.psg-mid`로 뽑아내고, **그 사이 나머지
  일반행 묶음은 지금처럼 한 번에 `processText()`에 넘긴다** — 묶음을 줄마다 쪼개면 기존
  6pt 간격이 사라지므로, 특수행이 없으면 결과가 이전과 완전히 같다.
  `blockHTML`의 `statement`·`boxed` 두 갈래만 `processText` 대신 `midAwareHTML`을 쓰도록
  바꿨다(`conditions`·`examples`는 설계 범위 밖 — 항목마다 이미 별도 요소다).
- `splitParagraphs()`를 그대로 재사용했으므로 `$$…$$` 안의 `\n`에서는 여전히 자르지
  않는다(표시 수식이 두 조각으로 깨지는 것을 막는 기존 규칙 재사용).
- `midAwareHTML`은 `window.PedagogyRender`의 freeze 객체에는 더했지만, `HSMALL`·
  `condLabel`·`circled`와 같은 부류로 두고 `index.html`의 `window` 표면(destructure +
  `Object.assign`)에는 **올리지 않았다** — `blockHTML` 내부에서만 쓰이고, 기존
  `test:review-contracts`의 `leaked` 검사 패턴과 같은 자리다.
- `verseHTML`·`proseHTML`은 이미 `isEllipsisLine()`을 호출하고 있어서, 정규식 확장만으로
  운문·산문(`passage`)의 `⋮`·`…`도 자동으로 가운데 정렬된다(추가 코드 변경 없음).

## 위험과 검토 요청

- **렌더링 회귀**: `statement`·`boxed`에 특수행이 없는 기존 데이터는 `midAwareHTML`이
  `splitParagraphs()`로 줄을 나눴다가 그대로 다시 `\n`으로 이어붙여 `processText`에 넘기므로
  **원본 raw와 바이트가 같아야** 한다(재구성 로직을 직접 볼 것).
- **신뢰 경계**: `isEllipsisLine()` 확장이 가져온 `.json`/AI 응답의 기존 텍스트 뜻을
  바꾸지 않는지 — 판정이 "줄 전체가 정확히 `⋮` 또는 `…`"로 좁으므로 오탐 여지는 작다.
- **XSS 순서**: `midAwareHTML`의 특수행 출력도 `sanitize(l.trim())`을 거치므로 기존
  sanitize→inlineMarks 순서 계약을 그대로 따른다(직접 확인할 것).

## 검증

- 실행한 명령:
  - `node scripts/check-review-contracts.mjs` — 전부 PASS(`render split keeps its surface...` 포함).
  - `HWPX_PYTHON=/opt/anaconda3/bin/python3 npm run test:audit-browser` —
    `REGRESSION 165 / 165 통과`(기존 163 + 새 회귀 2건).
  - `npm run check:static` — 전부 통과.
  - `node -c pedagogy-render.js` — 구문 확인.
- 결과: 전부 통과, 새로 추가한 두 검사(`tests/regression-test.html`)도 포함해 초록불.
- 아직 실행하지 못한 검증과 이유: 실제 인쇄본 PDF로 눈으로 보는 확인은 하지 않았다(R8이
  실제 인쇄 여정으로 다시 본다 — `HANDOFF-2026-159` §다음 행동 ④).

## 다음 검토자에게

- diff 범위: `pedagogy-render.js`(`isEllipsisLine`, 새 `midAwareHTML`, `blockHTML`의
  `statement`·`boxed` 두 줄, export 목록 한 줄), `tests/regression-test.html`(새 회귀 2건).
  커밋 `b6d3c40` — 첫 묶음(`851c7bd`/`a6b82a1`/`1357bec`)과는 **다른 커밋**이다.
- 재현 전제: 특별한 로그인·데이터 없이 `node scripts/check-review-contracts.mjs` 또는
  `test:audit-browser`로 바로 재현된다.
- 레일 위치: `docs/RAIL-ORDERS.md` ④(R4.5 둘째 묶음) 완료 → 다음은 ⑤(Codex 검토).

## 검토 기록

- `2026-09-23` — `Codex / Sol medium`: `b6d3c40` diff를 `HANDOFF-2026-159` 계약과 대조했다.
  `splitParagraphs()` 재사용으로 CR/LF 및 `$$…$$` 경계를 보존하고, 일반행 묶음은 기존
  `processText()`를 유지하며 특수행은 sanitize를 거치는 것을 확인했다. 재현 가능한 결함 없음;
  구현자 기록의 `test:audit-browser` 165/165와 리뷰 계약 검사 결과를 근거로 승인한다.
