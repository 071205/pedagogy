## 합의

1. **커버리지 — 합의.** `validate` 재할당이 네 경로를 모두 덮습니다.
   - `document-editor.html:252`의 `function validate` 는 클래식 스크립트 최상위 선언이라 **전역 바인딩 = `window.validate` 동일 슬롯**입니다. `:255`의 재할당이 그 슬롯을 바꾸므로 `parseAndRender`(`:347`) → `validateBtn`/`init`의 초안 복원(`:447`), `download`(`:397`, `parseAndRender` 경유), `makeDraft`(`:350`, `validate(data.document)` + 직후 `parseAndRender`), 그리고 `check-hwpx-browser.mjs:200/211/260`의 `window.validate` 가 전부 래퍼를 봅니다. 사전 호출 지점은 없습니다(재할당은 최상위, 호출은 DOMContentLoaded 이후).
   - `validateDocumentBase` 는 `const` 라 globalThis 프로퍼티가 **아니며**, 페이지 내 다른 호출자도 없습니다 → 외부에서 원본만 돌리는 우회는 없습니다. 재할당 전 캡처라 재귀도 없습니다.
   - 인덱스 정합: 원본 `blocks.map` 이 1:1(pagebreak 포함)이므로 래퍼의 `${index+1}번째 블록` 은 입력 순번과 일치합니다. 정규화 후 `type:"image"` 만 image 분기를 통과하므로 타입 위조도 없습니다. localStorage 초안으로 되돌아온 JSON도 재검증됩니다.

2. **PNG/JPEG·GIF·엔진 부재 폴백 — 합의, 보존됩니다.** 서명 검사(PNG 8바이트 / JPEG `FF D8`), `bytes.length <= 24`, base64 길이·알파벳, 디코드 바이트 한도는 엔진과 무관하게 돌아 GIF·잘린 PNG·비base64·초과 크기를 그대로 거절하고 메시지도 `check-hwpx-browser.mjs:215` 기대 정규식 5종과 맞습니다. `:244`의 `!window.PedagogyHwpx?.imageSize` 조기 반환은 0픽셀 판정만 Python으로 미루는데, `hwpx-document.js:13`이 엔진 없으면 **로드 시점에 throw** 하므로 `PedagogyHwpxDocument` 가 없고 `download()` 는 곧장 서버 폴백 → `document_schema.py:250-253`이 같은 계약으로 막습니다. 이전 감사가 지적한 "엔진 부재 시 정상 PNG도 거부(fail-closed)" 회귀는 해소된 상태입니다.

## 미합의 / 지적 (둘 다 비차단)

1. **Sonar 리스크가 유지보수성에서 신뢰성으로 옮겨갔을 수 있습니다.** `:255`의 `validate = function …` 은 **새 코드 한 줄**이고, SonarJS는 ESLint `no-func-assign` 계열("함수 선언을 덮어쓰지 말 것")을 Bug 등급으로 포함합니다. 원래 막힌 게이트는 통과하더라도 새 게이트가 걸릴 수 있습니다. 걸린다면 동작 동일한 회피책: `validate = …` 대신 `window.validate = validateDocumentImages;` — 같은 전역 슬롯이라 `parseAndRender`·`download`·`makeDraft` 의 맨이름 `validate` 호출까지 전부 래퍼로 바뀌고, 식별자 재할당 구문은 사라집니다. 한 줄 되돌림도 그대로 유지됩니다.

2. **검증 순서는 "원본 내부"만 보존되고 "형식 vs 구조" 선후는 Python과 어긋납니다.** 형식 검사가 image 분기 안이 아니라 후처리로 빠졌으므로 ① GIF + `width:300` 한 블록 → 브라우저는 `width는 5~170mm`, Python은 `PNG 또는 JPEG 이 아닙니다`, ② 1번 블록 GIF + 5번 블록 구조 오류 → 브라우저는 5번 오류를 먼저 보고. **둘 다 거절이라 우회는 아니고** `check-hwpx-browser.mjs:234`도 accepted/rejected만 대조해 exit0이 유지됩니다. 메시지 단위 정합을 원하면 검사를 image 분기 안으로 되돌려야 하는데, 그게 바로 Sonar가 문제 삼은 그 줄입니다 — 지금 절충이 합리적이라고 봅니다.

부수 관찰(무해): `makeDraft` 가 `validate` → `parseAndRender` 로 그림을 두 번 `atob` 합니다(최대 2.6MB×2, 기존 동작) · 미리보기(`:263`)가 JPEG도 `data:image/png;base64,` 로 붙입니다(브라우저 스니핑으로 표시는 정상, 기존 지적 유지) · JS는 Python의 `pixels` 를 결과에 넣지 않습니다(기존 차이, 조판은 각자 다시 측정).

## 다음 행동

지시대로 읽기만 했고 수정·재실행·다른 모델 호출은 하지 않았습니다. 권고는 **현 상태로 PR40 재제출** 하고, Sonar가 `:255` 에 Bug를 새로 올리면 그때만 ①의 `window.validate = …` 로 한 줄 교체(다른 파일·검사 영향 없음)입니다. ②는 후속 이슈로 남기면 충분합니다.
