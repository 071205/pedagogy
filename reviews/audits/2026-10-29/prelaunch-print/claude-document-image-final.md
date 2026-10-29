**합의**
엔진 부재 분기에 재현 가능한 차단 결함은 없습니다. `hwpx-document.js:12-13`이 `window.PedagogyHwpx` 없이는 즉시 throw하므로 `PedagogyHwpxDocument`가 정의되지 않고, `document-editor.html:389`의 브라우저 조판 분기 자체가 성립하지 않아 반드시 서버 경로(`document_schema.py:250-253`의 엄격 계약)를 지납니다. 두 번째 항목도 불량 5종 거부·정상 PNG/JPEG 산출의 양쪽 대조가 실제로 성립합니다(`check-hwpx-browser.mjs:206-237`, `test_document_export.py:235-247`).

**미합의**
세 가지 비차단 차이가 남았습니다: ① 엔진 부재 시 브라우저는 0픽셀 PNG나 IHDR 없는 25바이트 이상 PNG를 통과시켜 거절이 서버로 미뤄지고, `document-editor.html:397`의 catch가 그 서버 400에도 "로컬 서버를 찾지 못했습니다"를 덧붙여 원인을 흐립니다. ② `MAX_DOCUMENT_IMAGE_BYTES`(:222)는 `document_schema.MAX_IMAGE_BYTES`(:54)의 손 사본인데 상수 동일성 검사가 없고, 과대 입력 픽스처(3.6MB/복호 2.7MB)는 상향 이탈만 잡습니다. ③ `signals()`는 `pictures` 개수와 파트 목록만 보고 `<hp:pic>`의 width/height를 보지 않아, 동일 공식 `round(w*px_h/px_w)`의 JS 반올림(half-up) vs Python 뱅커스 반올림 차이(최대 1 HWPUNIT ≈ 0.0035mm)가 비교 범위 밖입니다.

**근거**
`validatedImageData`(:224-251)는 서명·길이·base64만 확인한 뒤 엔진이 있을 때만 치수를 보고, 서버 재검증이 `image_size()`(`pedagogy_hwpx.py:51-73`)로 IHDR·SOF까지 판정하므로 완화된 입력이 파일로 나갈 경로가 없습니다. 반대로 `check-hwpx-browser.mjs:200-201`이 엔진 준비를 전제로 하므로 완화 분기는 양쪽 어디에서도 검사되지 않고, ZIP 대조(:306-341)는 파트 이름·순서·플래그까지 보되 그림 치수 바이트는 보지 않습니다.

**다음 행동**
현 상태로 출시 차단 사유는 없다고 봅니다. 여유가 되면 ①의 오류 메시지 분기 분리와, ②·③을 `check-hwpx-browser.mjs`에 추가(엔진 `imageSize`를 임시로 지운 상태의 기대값, 상수 동일성, `signals()`에 pic width/height)만 후속으로 두면 충분합니다. 지시대로 수정·재실행은 하지 않았고, 플랜 파일 쓰기는 이 세션에서 Write가 비활성이라 남기지 못했습니다.
