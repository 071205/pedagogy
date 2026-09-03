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

/* ── 구획 태그(5지선다형·단답형)가 단 위에서 먹는 높이 ──
 *
 * 세 경로가 같은 값을 써야 한다. 이 값이 어긋나면 태그가 붙은 단에서 **둘째 문항의
 * 자리**가 미리보기·정본·한글에서 각각 달라진다.
 *   · 화면 미리보기 : `.tag` 의 height + margin-bottom
 *   · Typst 정본    : `#let TAGH`
 *   · 한글 내보내기 : 틀에서 잰다(`template.capture_marks()` → 실물 15.92mm).
 *     파이썬은 여기서 검사할 수 없으므로 `test_sections.py` 가 15.9mm 인지 본다.
 */
const tagCss = source.match(/\.tag\{[\s\S]*?\}/)?.[0] ?? "";
const tagH = Number(tagCss.match(/height:([\d.]+)mm/)?.[1]);
const tagGap = Number(tagCss.match(/margin:0 0 ([\d.]+)mm/)?.[1]);
const typstTagH = Number(source.match(/#let TAGH = ([\d.]+)mm/)?.[1]);
assert.ok(Number.isFinite(tagH) && Number.isFinite(tagGap),
  "화면 미리보기의 .tag 높이·아래 여백이 필요합니다");
assert.ok(Number.isFinite(typstTagH), "Typst 의 TAGH 가 필요합니다");
assert.ok(Math.abs(tagH + tagGap - typstTagH) < 0.01,
  `태그가 먹는 높이가 다릅니다 — 미리보기 ${tagH + tagGap}mm · Typst ${typstTagH}mm`);
assert.ok(Math.abs(typstTagH - 15.92) < 0.5,
  `태그 높이는 실물에서 잰 15.92mm 여야 합니다 (지금 ${typstTagH}mm)`);

/* ⚠️ 태그 자리는 **단 높이에서 빼야** 한다. 첫 칸 안에 v() 로 밀어 넣으면 칸 경계가
 *    그대로여서 둘째 문항이 제자리에 남는다(실측으로 확인했다). `column-slots` 가
 *    단 높이를 받아 (높이 − 태그) 짜리 격자를 만드는지 본다. */
assert.match(source, /#let column-slots\(items, height: 0mm, pad-top: 0mm\)/,
  "column-slots 는 단 높이를 인자로 받아야 합니다(태그를 그만큼 빼야 하므로)");
assert.match(source, /height: height - pad-top/,
  "격자 높이에서 태그 자리를 빼야 합니다");

console.log("Mock exam continuation header geometry passed");
console.log("Mock exam section-tag height parity passed");
