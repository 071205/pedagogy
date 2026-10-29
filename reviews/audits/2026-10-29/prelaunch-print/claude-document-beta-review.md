## 합의
- **문장과 지원 목록의 블록 집합이 정확히 일치한다.** `document-editor.html:207`이 나열한 13종(제목글·문단·수식·인용문·글머리표·번호 목록·표·상자·`<보기>`·선지·그림·각주·쪽 나눔) + 문서 수준 `header`/`footer`는 `validate()`(`:222`)가 받는 타입 집합과 `render()`(`:224`)가 그리는 분기 집합과 1:1로 맞는다. 목록 밖 타입은 `지원하지 않는 type` 으로 거부된다.
- **각주·쪽 나눔·머리말/꼬리말은 브라우저 HWPX에 실제로 구현돼 있다.** `hwpx-document.js:286-287`(`setHeader`/`setFooter`), `:297-301`(`pagebreak`는 `pendingBreaks`로 미뤘다가 `:330-333`에서 `setPageBreak`, `footnote`는 `appendFootnote`)이고, 엔진 구현은 `hwpx-engine.js:586`(`setPageBreak`), `:673-675`(`setHeader`/`setFooter` → `_setPageNote`), `:677`(`appendFootnote`)에 있다. 서버 없이 `downloadInBrowser`(`document-editor.html:350-356`)가 이 경로를 그대로 쓴다.
- **네이티브 근거가 이 세 기능을 덮는다.** `document-native-verification.json` 3표본(1+2+1 = 4쪽) 전부 `allPagesVisuallyCompared`/`roundtripPngIdentical` true, `visualResults`에 "footnotes1/2 on correct pages, explicit pagebreak preserved", "page-notes: native header/body/footer all present".
- 결론적으로 **차단급 과장은 없다.**

## 미합의 (비차단, 둘 다 '그림' 한 가지에서 나온다)
1. **범위 문장이 덮는 '그림'만 근거가 없다.** 고정 대조 표본 3종에 `image` 블록이 없다 — `scripts/check-hwpx-browser.mjs:66-100`의 세 케이스와 `experiments/hwp-export/samples/document-sample.json`(타입: paragraph·heading·equation·bullets·numbered·quote·table·box·examples·choices)에 `image`가 한 번도 안 나온다. 그래서 `builderParity`·네이티브 PDF 근거 어디에도 그림이 포함되지 않는다. 구현은 있다(`hwpx-document.js:194-209` → `appendPicture`).
2. **'그림(base64)' 표기가 실제보다 넓다.** `validate()`는 `b.data`가 빈 문자열이 아닌 문자열인지만 본다(`:222`). 반면 `emitImage`는 바이트로 PNG·JPEG를 판정해 아니면 `PNG·JPEG 가 아니어서 그림을 넣지 못했습니다` 경고만 남기고 그 블록을 **버린다**(`hwpx-document.js:196-200`). 재현: GIF/SVG base64를 `image.data`에 넣으면 검증·미리보기는 통과하고(미리보기는 `src`를 항상 `data:image/png;base64,`로 쓰며 `<img>`가 바이트를 스니핑한다, `:224`) 내보내기는 그림 없는 파일 + 경고 1건으로 끝난다. 즉 "위에 나열한 문서 블록 … 내보낼 수 있습니다"가 이 입력에선 성립하지 않는다.

참고로 쪽 나눔이 마지막 블록이면 `뒤에 내용이 없어 쪽을 넘기지 않았습니다` 경고로 무시되지만(`:332`), 미리보기엔 구분선이 보인다. 이건 과장이 아니라 경고로 드러나고 lede의 "미리보기에 보이는 구조만 내보냅니다"와도 방향이 반대라 넘어갈 수 있다. "사용자가 올린 고정 양식"은 이 편집기에 업로드 입력이 아예 없다는 점(`type=file` 없음)에서 없는 기능을 암시하는 쪽이지만, 한계 고지 문장이라 오해 소지는 약하다.

## 근거
`document-editor.html:206-209, 222, 224, 350-367` · `hwpx-document.js:194-209, 276-334` · `hwpx-engine.js:586-591, 636-708` · `scripts/check-hwpx-browser.mjs:65-100` · `experiments/hwp-export/samples/document-sample.json` · `reviews/audits/2026-10-29/prelaunch-print/document-native-verification.json`

## 다음 행동 (권고, 이번 범위에선 수정 안 함)
- 지원 목록의 `그림(base64)`을 `그림(PNG·JPEG base64)`로 좁히거나, `validate()`에서 매직바이트를 보고 RED로 거부해 "검증 통과 → 내보내기에서 사라짐"을 없앤다. 둘 중 하나면 문장은 그대로 유효해진다.
- `check-hwpx-browser.mjs`의 `extra-blocks`에 작은 PNG `image` 블록 1개를 추가해 파이썬·브라우저 대조와 다음 네이티브 회차에 그림을 포함시킨다.
- 위 둘 중 어느 것도 이번 프리런치를 막는 사유로 보지 않는다 — 범위 문장은 유지 가능하다.
