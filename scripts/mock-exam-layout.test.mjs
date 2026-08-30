import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mock-exam-editor.html", import.meta.url), "utf8");

const previewTop = Number(source.match(/class="area p2" style="top:([\d.]+)mm"/)?.[1]);
const typstTop = Number(source.match(/else \{\n\s*\/\/ 2p\+ 제목[\s\S]*?dy: ([\d.]+)mm/)?.[1]);
const ruleY = Number(source.match(/#let RULEN = ([\d.]+)mm/)?.[1]);
const titleHeight = 28.6 * 1.37 * 25.4 / 72;

assert.ok(Number.isFinite(previewTop), "HTML 미리보기 2p+ 제목 y 좌표가 필요합니다");
assert.ok(Number.isFinite(typstTop), "Typst 2p+ 제목 y 좌표가 필요합니다");
assert.ok(Number.isFinite(ruleY), "Typst 2p+ 가로 괘선 y 좌표가 필요합니다");
assert.equal(previewTop, typstTop, "미리보기와 Typst의 2p+ 제목 y 좌표가 같아야 합니다");
assert.ok(previewTop + titleHeight < ruleY,
  "2p+ 수학 영역의 줄상자가 가로 괘선과 겹치지 않아야 합니다");

console.log("Mock exam continuation header geometry passed");
