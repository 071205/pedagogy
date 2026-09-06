# 범용 문서의 표·그림·상자 블록이 AI와 브라우저에서 막힌다

- ID: `REV-2026-013`
- 날짜: `2026-09-01`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`, `worker`, `server`
- 관련 인계: `HANDOFF-2026-019`, `HANDOFF-2026-021`, `HANDOFF-2026-022`

## 요약과 영향

HWPX 조판기와 Python 계약에는 `table`·`image`·`box` 블록이 추가됐지만, 실제 사용자가
거치는 Worker의 AI 응답 검증과 `document-editor.html`의 JSON 검증·미리보기가 여전히 초기
6개 블록만 허용한다. 따라서 AI가 표·그림·상자를 정확히 생성해도 Worker가 502로 폐기하고,
사용자가 JSON으로 직접 넣어도 브라우저에서 검증 실패해 내보내기 버튼까지 갈 수 없다.

## 재현 절차

1. `createWorker()`에 `generateDocument`가 아래처럼 표 블록을 반환하도록 주입한다.

   ```js
   { title: "표 문서", blocks: [{ type: "table", rows: [["A", "B"], ["1", "2"]], header: true }] }
   ```

2. 허용 Origin·유효 토큰·정상 quota를 넣어 `POST { mode: "document", prompt: "표를 만들어 줘" }`를 보낸다.
3. Worker가 `validateDocumentResponse()`에서 표를 지원하지 않는 블록으로 보고 502를 반환한다.
4. 또는 `document-editor.html`의 문서 JSON 칸에 같은 `table` 블록을 넣고 **JSON 검증·미리보기**를 누른다.

## 기대 결과 / 실제 결과

- 기대: HANDOFF-019/021/022에서 추가한 표·그림·상자가 AI 초안과 직접 JSON 모두에서
  검증·미리보기된 뒤 `/document-hwpx`로 전달된다.
- 실제: Worker 응답은 `502 {"error":"AI 문서 초안 생성에 실패했습니다…"}`이고, 브라우저도
  `지원하지 않는 type`으로 거절한다.

## 근거

- `experiments/hwp-export/document_schema.py`는 `table`, `image`, `box`를 허용한다.
- `worker/index.js`의 `DOCUMENT_SYSTEM_PROMPT`는 여섯 type만 안내하고,
  `validateDocumentResponse()`도 `heading, paragraph, equation, quote, bullets, numbered`만 허용한다.
- `document-editor.html`의 안내·`validate()`·`render()` 모두 같은 초기 여섯 type만 처리한다.
- 2026-09-01 실제 주입 재현: 표 블록을 반환했을 때 Worker가 502를 반환했다.

## 제안

Python 계약을 기준으로 Worker 프롬프트·Worker 검증·브라우저 검증·브라우저 미리보기를
동시에 확장하고, 각 블록이 `AI 응답 → 브라우저 → /document-hwpx`를 모두 통과하는 통합
회귀 검사를 추가한다. 새 블록을 한 경로에만 추가하지 못하게 공유 계약 또는 대조 검사가 필요하다.

## 처리 기록

- 2026-09-01 — Codex: 등록. Worker 주입 재현에서 502를 확인했고, 소스 대조로 브라우저
  검증도 같은 여섯 type에 고정된 것을 확인했다. `npm run check:fast`는 통과했으나 이 흐름은 검사하지 않는다.

- 2026-09-01 — `Claude`: 수정. **Codex 지적이 정확했다 — 재현했다.**
  `validateDocumentResponse()` 가 `heading|paragraph|equation|quote|bullets|numbered` 여섯
  분기만 갖고 있고, `document-editor.html` 의 `validate()`·`render()` 도 같았다.
  (참고: `grep` 으로는 Worker 에 `examples`·`choices` 가 있는 것처럼 보이는데, 그건
  모의고사 사진 변환 프롬프트의 주석이다. 실제 문서 검증부에는 없었다.)

  - **수정 파일**: `worker/index.js`(프롬프트 + 검증), `document-editor.html`(검증 + 미리보기).
  - ⚠️ **네 곳이 똑같지는 않게 했다.** `image` 는 계약·브라우저에만 있고 AI 쪽에는 없다 —
    AI 가 base64 그림을 만들 수는 없다. 그 차이를 아래 검사에 명시했다.
  - **재발 방지**: `scripts/check-document-blocks.mjs` 를 만들어 `check:static` 에 걸었다.
    계약(`document_schema.py`) · Worker 프롬프트 · Worker 검증 · 브라우저 검증
    **네 곳의 블록 목록을 원문에서 뽑아 비교**한다. 파이썬도 브라우저도 띄우지 않아
    CI 에서 항상 돈다. 한 곳만 늘리면 그 자리에서 빨간불이 난다.
  - **검증**: Worker 검증에서 `table` 을 빼 보고 / 브라우저 검증에서 `box` 를 빼 보고
    둘 다 검사가 잡는 것을 확인한 뒤 원복했다. `npm run check:fast` 통과.
