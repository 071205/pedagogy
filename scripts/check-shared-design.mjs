/* 두 화면의 디자인 토큰이 갈라지지 않았는가 — index.html ↔ document-editor.html
 *
 * 이 저장소는 빌드 단계가 없어서 각 `.html` 이 자기 CSS 를 통째로 안고 있다. 그래서
 * 토큰을 **베껴 두는 것 말고 방법이 없고**, 베낀 것은 반드시 갈라진다.
 * 실제로 그랬다 — `document-editor.html` 만 `--paper`·`--ink`·`--line` 이라는 자기 이름을
 * 쓰고 값도 달라서, 본체에서 넘어오면 글꼴·여백·모서리·버튼이 전부 다르게 보였다.
 *
 * 이름과 값이 같은지만 본다. 레이아웃까지 같게 만들려는 검사가 아니다 —
 * 두 화면은 하는 일이 다르므로 구조는 달라도 된다.
 *
 * ⚠️ 테마 저장 키도 함께 본다. 키가 다르면 본체에서 어둡게 해 두고 넘어왔을 때
 *    갑자기 밝아진다("여기만 왜 다르지" 로 보이는 종류의 어긋남이다).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFile(join(root, p), "utf8");
const [main, editor] = await Promise.all([read("index.html"), read("document-editor.html")]);

/** `:root{ ... }` 안의 `--이름:값` 을 모은다. */
function tokens(source) {
  const found = new Map();
  for (const block of source.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      if (!found.has(name)) found.set(name, value.trim().replace(/\s+/g, " "));
    }
  }
  return found;
}

const wanted = tokens(main);
const have = tokens(editor);
assert.ok(wanted.size > 10, `index.html 에서 토큰을 읽지 못했습니다 (${wanted.size}개)`);
assert.ok(have.size > 10, `document-editor.html 에서 토큰을 읽지 못했습니다 (${have.size}개)`);

/* 본체에만 있어도 되는 것 — 문항 편집·인쇄 전용이라 문서 화면이 쓸 일이 없다. */
const MAIN_ONLY = /^--(col-gap-mm|print-|sidebar-w|body-serif|num-serif)/;

const problems = [];
for (const [name, value] of wanted) {
  if (MAIN_ONLY.test(name)) continue;
  if (!have.has(name)) { problems.push(`${name} 이 없습니다 (본체: ${value})`); continue; }
  if (have.get(name) !== value) {
    problems.push(`${name} 값이 다릅니다 — 본체 ${value} · 문서 ${have.get(name)}`);
  }
}

// 테마 저장 키
const keyOf = (s) => (s.match(/THEME_KEY\s*=\s*["']([^"']+)["']/) || [])[1];
if (keyOf(main) !== keyOf(editor)) {
  problems.push(`테마 저장 키가 다릅니다 — 본체 ${keyOf(main)} · 문서 ${keyOf(editor)}`);
}

if (problems.length) {
  for (const p of problems) console.log("  ❌", p);
  console.error("\n두 화면의 디자인 토큰이 갈라졌습니다. index.html 을 기준으로 맞추세요 "
    + "— 사용자는 한 사이트로 느낍니다.");
  process.exit(1);
}
console.log(`디자인 토큰 일치 — ${[...wanted.keys()].filter((n) => !MAIN_ONLY.test(n)).length}개 `
  + `· 테마 키 ${keyOf(main)}`);
