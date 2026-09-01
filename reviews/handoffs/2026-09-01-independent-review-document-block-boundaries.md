# 변경 인계 — 범용 문서 블록 경계 독립 검토

- ID: `HANDOFF-2026-024`
- 날짜: `2026-09-01`
- 작성자: `Codex`
- 상태: `resolved`
- 영향 영역: `index`, `worker`, `server`, `tests`, `docs`
- 관련 이슈: `REV-2026-013`, `REV-2026-014`

## 검토 결과

`82af6b0`까지의 HWPX·범용 문서 작업을 독립적으로 확인했다. `main`과 `origin/main`은
같은 커밋(`82af6b0`)이며, 빠른 회귀 검사와 기존 모의고사 선지 배치 대조는 통과했다.

다만 범용 문서의 새 블록이 여러 경계에서 함께 확장되지 않아 실제 제품 흐름에 도달하지
못한다. 상세 재현은 아래 이슈에 남겼다.

- `REV-2026-013` — Python 조판 계약은 `table`·`image`·`box`를 허용하지만, Worker
  `DOCUMENT_SYSTEM_PROMPT`/`validateDocumentResponse()`와 `document-editor.html`의
  `validate()`/`render()`는 초기 여섯 블록만 받는다. 주입한 `table` AI 응답은 실제로
  Worker에서 502가 됐다.
- `REV-2026-014` — 계약은 원본 4MiB 그림을 허용하지만, base64 JSON 본문은
  5,592,501바이트가 되어 `serve.py`의 4MiB 공통 본문 상한에서 413이 된다.

## 검증

- `HWPX_PYTHON=/private/tmp/pedagogy-hwpx-venv/bin/python HWPX_REQUIRE=1 npm run check:fast`
  통과 — HWPX 9건 포함.
- `HWPX_PYTHON=/private/tmp/pedagogy-hwpx-venv/bin/python HWPX_REQUIRE=1 npm run test:hwpx-parity`
  통과 — 기존 모의고사 선지 배치 34문항 일치.
- 정상 인증·quota·Origin을 주입한 Worker 요청에서 `table` AI 응답이 502가 되는 것을 재현.
- 4MiB PNG 바이트 표본은 `document_schema.validate()`를 통과하고, JSON 래핑 뒤
  5,592,501바이트가 되는 것을 확인.
- `git diff --check` 통과.

## 다음 작업자에게

`REV-2026-013`은 새 블록 하나마다 **AI 출력 → Worker 검증 → 브라우저 검증·미리보기 →
`/document-hwpx`**를 모두 통과하는 통합 회귀로 고쳐야 한다. 이 중 하나만 확장하면 같은
문제가 재발한다.

`REV-2026-014`는 원본 그림 제한과 HTTP JSON 본문 제한 중 하나를 서로 맞추고, 경계 크기
요청이 실제 엔드포인트에서 성공/실패하는 회귀 검사를 둬야 한다.

`REV-2026-012`는 이슈 파일의 상태가 `resolved`인데 INDEX의 열린 이슈 표에는 남아 있다.
해결 근거를 다시 확인한 뒤 INDEX에서 옮기는 정리가 필요하다.

---

## 후속 (2026-09-01 · Claude)

`REV-2026-013`·`REV-2026-014` 둘 다 재현하고 고쳤다. 각 이슈 파일의 처리 기록 참고.

⚠️ **`REV-2026-012` 지적은 사실과 달랐다** — 이슈 파일은 `resolved` 이고 `INDEX.md` 에서도
'최근 해결' 표에 있다(열린 이슈 표에 남아 있지 않다). 정리할 것이 없었다.
