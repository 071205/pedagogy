/* 범용 문서 블록이 **다섯 경계에서 함께** 늘어났는가 — 베타
 *
 * 새 블록 하나는 다섯 곳을 동시에 고쳐야 실제로 쓸 수 있다:
 *
 *   ① `document_schema.py`      — 조판 계약(무엇을 받아 HWPX 로 만드는가)
 *   ② `worker/index.js` 프롬프트 — AI 에게 무엇을 만들라고 하는가
 *   ③ `worker/index.js` 검증     — AI 응답에서 무엇을 받아들이는가
 *   ④ `document-editor.html` 의 `validate()`  — 브라우저 검증
 *   ⑤ `document-editor.html` 의 `render()`    — 브라우저 미리보기
 *
 * ⚠️ **④ 와 ⑤ 를 한 칸으로 세지 말 것.** 예전에는 `validate()` 만 봤고, 그래서
 *    `pagebreak`·`footnote` 가 계약·Worker·조판기에는 들어갔는데 **미리보기에서만
 *    빠진 채로 검사가 초록불이었다.** 그 둘을 넣으면 `render()` 의 마지막 `else` 가
 *    목록 블록으로 보고 `b.items` 를 훑어 **미리보기가 통째로 죽었다**(REV-2026-095).
 *
 * 한 곳만 늘리면 **AI 가 정확히 만들어도 Worker 가 502 로 버리고, 사용자가 JSON 으로
 * 직접 넣어도 브라우저에서 막힌다.** 실제로 그렇게 됐다(REV-2026-013) — 조판기와 계약만
 * 넓히고 나머지를 두어, 표·상자·보기·선지가 제품 흐름에 도달하지 못했다.
 *
 * ⚠️ 네 곳이 **똑같지는 않다.** `image` 는 계약·브라우저에는 있고 AI 쪽에는 없다 —
 *    AI 가 base64 그림을 만들 수는 없기 때문이다. 그 차이는 아래에 명시하고, 그 외의
 *    어긋남만 실패로 본다.
 *
 * 파이썬도 브라우저도 띄우지 않는다(원문을 읽어 비교할 뿐). CI 에서 항상 돈다.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFile(join(root, p), "utf8");

/** AI 가 만들 수 없어 일부러 뺀 블록. 여기 적힌 것만 차이로 인정한다. */
const AI_CANNOT_PRODUCE = new Set(["image"]);

const [schema, worker, editor] = await Promise.all([
  read("experiments/hwp-export/document_schema.py"),
  read("worker/index.js"),
  read("document-editor.html"),
]);

/** ① 계약 — `*_BLOCKS = {...}` 집합들을 모은다. */
const contract = new Set(
  [...schema.matchAll(/^[A-Z_]*BLOCKS\s*=\s*\{([^}]*)\}/gm)]
    .flatMap((m) => [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1])));
assert.ok(contract.size >= 6,
  `document_schema.py 에서 블록 목록을 읽지 못했습니다 (찾은 것: ${[...contract]})`);

/** ③ Worker 검증 — `validateDocumentResponse()` 안에서 다루는 type. */
const validateBody = worker.slice(worker.indexOf("function validateDocumentResponse"));
const workerChecks = validateBody.slice(0, validateBody.indexOf("\n}\n"));
const workerBlocks = new Set([
  ...[...workerChecks.matchAll(/"([a-z]+)"\s*(?:,\s*"[a-z]+"\s*)*\]\.includes\(block\.type\)/g)]
    .flatMap((m) => [...m[0].matchAll(/"([a-z]+)"/g)].map((x) => x[1])),
  ...[...workerChecks.matchAll(/block\.type\s*===\s*"([a-z]+)"/g)].map((m) => m[1]),
]);

/** ② Worker 프롬프트 — AI 에게 보여 주는 예시의 type. */
const prompt = worker.slice(worker.indexOf("DOCUMENT_SYSTEM_PROMPT"));
const promptBlocks = new Set(
  [...prompt.slice(0, prompt.indexOf("`;")).matchAll(/"type":\s*"([a-z]+)"/g)].map((m) => m[1]));

/** ④ 브라우저 — validate() 가 다루는 type. */
const validateFn = editor.slice(editor.indexOf("function validate(raw)"));
const editorBody = validateFn.slice(0, validateFn.indexOf("return{version:1"));
const editorBlocks = new Set([
  ...[...editorBody.matchAll(/b\.type\s*===\s*"([a-z]+)"/g)].map((m) => m[1]),
  ...[...editorBody.matchAll(/\[([^\]]*)\]\.includes\(b\.type\)/g)]
    .flatMap((m) => [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1])),
]);

/** ⑤ 브라우저 — render() 가 **그리는** type. validate() 와 별개로 봐야 한다.
 *  ⚠️ 통과하는 것과 그려지는 것은 다른 문제다 — 그래서 두 표면을 따로 읽는다. */
const renderFn = editor.slice(editor.indexOf("function render(doc)"));
const renderBody = renderFn.slice(0, renderFn.indexOf("\nfunction "));
const renderBlocks = new Set([
  ...[...renderBody.matchAll(/b\.type\s*===\s*"([a-z]+)"/g)].map((m) => m[1]),
  ...[...renderBody.matchAll(/\[([^\]]*)\]\.includes\(b\.type\)/g)]
    .flatMap((m) => [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1])),
]);

const show = (s) => [...s].sort().join(", ") || "(없음)";
const missing = (want, have) => [...want].filter((b) => !have.has(b)).sort();

const aiExpected = new Set([...contract].filter((b) => !AI_CANNOT_PRODUCE.has(b)));

const gaps = [
  ["브라우저 검증(document-editor.html 의 validate)", missing(contract, editorBlocks), contract],
  ["브라우저 미리보기(document-editor.html 의 render)", missing(contract, renderBlocks), contract],
  ["Worker 검증(validateDocumentResponse)", missing(aiExpected, workerBlocks), aiExpected],
  ["Worker 프롬프트(DOCUMENT_SYSTEM_PROMPT)", missing(aiExpected, promptBlocks), aiExpected],
];

let failed = false;
for (const [label, gap, want] of gaps) {
  if (!gap.length) {
    console.log(`  ✅ ${label}`);
    continue;
  }
  failed = true;
  console.log(`  ❌ ${label} — 빠진 블록: ${gap.join(", ")}`);
  console.log(`      기대: ${show(want)}`);
}

// AI 쪽에만 있고 계약에 없는 것도 문제다(조판기가 못 받는 것을 AI 가 만들게 된다).
const extra = [...workerBlocks].filter((b) => !contract.has(b)).sort();
if (extra.length) {
  failed = true;
  console.log(`  ❌ Worker 가 계약에 없는 블록을 받아들입니다: ${extra.join(", ")}`);
}

if (failed) {
  console.error("\n새 블록은 계약·Worker 프롬프트·Worker 검증·브라우저 검증·브라우저 "
    + "미리보기 다섯 곳을 함께 고쳐야 실제로 쓸 수 있습니다 (REV-2026-013 · REV-2026-095).");
  process.exit(1);
}
console.log(`문서 블록 경계 일치 — 계약 ${contract.size}종 `
  + `(AI 는 ${aiExpected.size}종, ${show(AI_CANNOT_PRODUCE)} 은 AI 가 만들 수 없어 제외)`);
