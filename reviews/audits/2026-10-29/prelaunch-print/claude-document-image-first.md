## 합의 (Q1 — 차단·보존: 예)

`validatedImageData`(`document-editor.html:222-249`)가 내보내기 **앞단**에서 순서대로 막습니다: 빈/공백 → base64 길이·알파벳·`atob` → 디코드 바이트 한도 → PNG 8바이트 서명 또는 JPEG SOI → `PedagogyHwpx.imageSize()`로 `width/height > 0`. `validate()` image 분기(`:250`)가 이를 호출하고, `parseAndRender()`(`:336`)를 `download()`(`:386`)와 AI 초안(`:339`)이 모두 거치므로 브라우저 조판·로컬 서버 폴백 **두 경로 모두** 미지원 입력이 `emitImage`(`hwpx-document.js:194-200`, 경고만 남기고 그림 생략)까지 가지 않습니다 — 재현된 `validationPassed:true` + `pictureParts:[]` 조합이 닫힙니다.

경계도 Python과 맞습니다: `5*1024*1024/2` = `document_schema.py:54` `MAX_IMAGE_BYTES`(2,621,440), width 5~170mm = `MIN/MAX_IMAGE_MM`. base64 선검사 상한 `ceil(MAX/3)*4 = 3,495,256`은 한도 크기 그림의 정확한 인코딩 길이와 같아 **경계에서 정상 입력을 거짓 거부하지 않습니다**. `imageSize`가 PNG 서명을 4바이트만 보는 느슨함은 `validatedImageData`의 8바이트 `PNG_SIGNATURE` 검사가 메웁니다. (RED/GREEN 로그는 `/private/tmp`가 샌드박스 밖이라 읽지 못했습니다 — 코드 경로 기준 판정입니다.)

## 미합의 (Q2 — 잔존 불일치 2건, 둘 다 비차단)

**1. Python이 더 느슨합니다 — 브라우저가 거부하는 그림을 통과시킵니다.** `document_schema.py:250-253`은 `image_size(data) is not None`만 봅니다. 픽셀 0 검사가 없어 IHDR 폭=0 PNG가 통과 → `document_to_hwpx.py:222` `round(w * px_h / px_w)`에서 `ZeroDivisionError`(400 대신 500). 24바이트 잘린 PNG도 통과 → 깨진 BinData가 HWPX에 들어갑니다(브라우저는 `imageSize`의 `length > 24` 때문에 거부). 방향이 "브라우저가 더 엄격"이라 사용자 경로의 그림 누락은 없습니다. 코드 판독 근거이며 실행 확인은 하지 않았습니다.

**2. 새 검사가 브라우저 판정만 봅니다.** `check-hwpx-browser.mjs:204-215`는 같은 3개 입력을 Python `validate_document()`에 넣어 **같은 판정인지** 대조하지 않습니다. 같은 파일의 `strictValidate` 자기검사(`:328-423`)는 "검증기도 사본이라 갈라진다"며 양쪽 판정을 맞추고 있어, image 검사만 그 원칙에서 빠져 1번 같은 갈라짐을 앞으로도 못 잡습니다.

비차단 지적 셋: `:211-214`의 `throw`가 실패 시 이후 전체 대조를 중단시킵니다(`failures++`면 행렬이 계속 돕니다) · 미리보기(`:252`)가 JPEG도 `data:image/png;base64,`로 붙입니다(화면은 맞지만 이미 판정한 형식을 쓰는 게 정확) · `imageSize` 부재 시 정상 PNG도 거부(fail-closed)여서 엔진 로드 실패 + 로컬 서버 가동 조합에서 예전에 되던 서버 폴백이 막힙니다.

## 다음 행동 (변경 없음, 소유자 판단)

1. `document_schema.py` image 분기에 `width > 0 and height > 0` 거부 추가 — 1줄 수준, 양쪽 판정 일치.
2. `check-hwpx-browser.mjs`의 그림 3종을 Python 검증에도 넣어 "양쪽 모두 거부" 단언, 폭=0 PNG를 네 번째 입력으로.
3. 1·2 없이 출시하면 REV-2026-161에 "Python이 더 느슨한 쪽" 잔존 간극으로 기록.

참고: 이 세션에서 `Write` 도구가 비활성화되어 계획 파일(`/Users/huryul/.claude/plans/pedagogy-imperative-rabbit.md`)은 만들지 못했습니다. 위 내용이 전체 검토 결과이며 저장소에는 아무것도 수정하지 않았습니다.
