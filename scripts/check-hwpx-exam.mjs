/**
 * 시험지 틀 읽기 — **브라우저(JS) 와 파이썬이 같은 답을 내는가**
 *
 * 사용법:
 *   node scripts/check-hwpx-exam.mjs          # 없으면 건너뛴다
 *   HWPX_REQUIRE=1 node scripts/check-hwpx-exam.mjs   # 건너뜀을 실패로 (CI)
 *
 * ⚠️ **사본은 갈라진다.** `hwpx-exam-template.js` 는 `experiments/hwp-export/template.py`
 *    를 옮긴 것이다. 한쪽만 고치면 시험지가 조용히 다른 서식으로 나간다 — 그런 사고가
 *    이 저장소에서 여러 번 났다(CLAUDE.md '반복된 실패 방식' 3번).
 *    AI 문서 쪽 `check-hwpx-browser.mjs` 와 같은 방식으로 **둘을 실제로 돌려 대조**한다.
 *
 * ⚠️ 이 검사는 브라우저가 필요 없다. `hwpx-exam-template.js` 는 DOM 을 쓰지 않고
 *    문자열·정규식만 쓰므로 node 에서 그대로 돈다 — 그래서 **CI 에서 늘 돈다.**
 *    (DOM 을 쓰게 되면 그때 Playwright 로 옮길 것.)
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMPLATE = join(ROOT, "experiments/hwp-export/templates/exam-math.hwpx");
const JS = join(ROOT, "hwpx-exam-template.js");
const REQUIRE = process.env.HWPX_REQUIRE === "1";

const SKIP_FIXABLE = 3;

function skip(why) {
  if (REQUIRE) {
    console.error(`HWPX_REQUIRE=1 인데 건너뛰어야 합니다: ${why}`);
    process.exit(SKIP_FIXABLE);
  }
  console.log(`틀 읽기 대조를 건너뜁니다 — ${why}`);
  process.exit(0);
}

if (!existsSync(TEMPLATE)) skip(`배포용 틀이 없습니다 (${TEMPLATE})`);
if (!existsSync(JS)) skip("hwpx-exam-template.js 가 없습니다");

/* ── 파이썬 쪽 ────────────────────────────────────────────────────────────
   ⚠️ `open_template()` 을 그대로 부르지 않는다 — 그 함수는 문서를 열어 본문까지
      비우므로 느리고, 여기서 견주려는 것은 **역할 표**뿐이다. 대신 그 함수가 하는
      순서를 그대로 따라 한다. 순서가 결과를 바꾼다(이름 → 쓰임이 덮는다). */
const PY = `
import json, sys
sys.path.insert(0, "experiments/hwp-export")
from pathlib import Path
import template as tmpl
T = Path(${JSON.stringify(TEMPLATE)})
roles = tmpl.read_named_styles(T)
if roles:
    g = tmpl.read_roles(T)
    if "num" in g: roles["num"] = g["num"]
    b = tmpl.read_equation_base(T)
    if b: roles["_eq_base"] = b
if len(roles) < 3: roles = tmpl.read_roles(T)
roles.update(tmpl.read_roles_by_usage(T))
roles.pop("_source", None)
print(json.dumps(roles, ensure_ascii=False, sort_keys=True))
`;

let pyRoles;
try {
  pyRoles = JSON.parse(execFileSync("python3", ["-c", PY], { cwd: ROOT, encoding: "utf8" }));
} catch (e) {
  skip("파이썬 쪽을 돌리지 못했습니다: " + String(e.message).split("\n")[0].slice(0, 120));
}

/* ── JS 쪽 ────────────────────────────────────────────────────────────── */
const dir = mkdtempSync(join(tmpdir(), "pedagogy-tpl-"));
try {
  execSync(`unzip -qo ${JSON.stringify(TEMPLATE)} -d ${JSON.stringify(dir)}`);
} catch {
  rmSync(dir, { recursive: true, force: true });
  skip("unzip 이 없습니다");
}
const parts = {};
(function walk(d, pre) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name), k = pre ? pre + "/" + e.name : e.name;
    if (e.isDirectory()) walk(p, k); else parts[k] = readFileSync(p);
  }
})(dir, "");
rmSync(dir, { recursive: true, force: true });

globalThis.window = globalThis;
await import(JS);
const jsRoles = globalThis.PedagogyExamTemplate.readRoles(parts);

/* ── 대조 ─────────────────────────────────────────────────────────────── */
let fails = 0;
const keys = [...new Set([...Object.keys(pyRoles), ...Object.keys(jsRoles)])].sort();

/* ⚠️ 역할이 몇 개는 나와야 한다. 둘 다 비면 "같다" 로 통과해 **아무것도 검사하지
   않게 된다** — 이 저장소에서 세 번 겪은 사고다. */
if (keys.length < 10) {
  console.log(`❌ 역할이 ${keys.length}개뿐입니다 — 이 검사가 헛돌고 있습니다`);
  process.exit(1);
}

/* ⚠️ `JSON.stringify` 를 그대로 견주면 **키 순서**만 달라도 전부 다르다고 나온다
   (파이썬은 정렬해 내고 JS 는 넣은 순서다). 처음에 그렇게 해서 **16종 중 14종이
   빨간불**이었는데 값은 하나도 다르지 않았다. 키를 정렬해 견준다. */
const canon = (v) => v == null ? "null"
  : JSON.stringify(Object.fromEntries(Object.entries(v).sort(([x], [y]) => x < y ? -1 : 1)));

for (const k of keys) {
  const a = canon(pyRoles[k]);
  const b = canon(jsRoles[k]);
  if (a === b) continue;
  console.log(`  ❌ ${k}\n      파이썬 ${a}\n      JS     ${b}`);
  fails++;
}

if (fails) {
  console.log(`\n틀 읽기가 갈라졌습니다 — ${fails}건 (역할 ${keys.length}종 중)`);
  process.exit(1);
}
console.log(`틀 읽기 대조 통과 — 역할 ${keys.length}종이 파이썬과 같습니다`);
