/* 편집기 ↔ HWPX 변환기 선지 배치 대조 — 베타
 *
 * 변환기(`experiments/hwp-export/mock_to_hwpx.py`)는 편집기의 `layoutOf()` 를 **옮겨
 * 적은 사본**이다. 편집기는 KaTeX 로 실제 렌더 폭을 재고(`measureCh`), 파이썬은 그
 * 폭을 잴 수 없어 어림한다. 30문항 시험지를 처음 변환해 보고서야 21문항 중 3문항이
 * 어긋난다는 것을 알았다 — 분수가 든 선지를 편집기는 한 줄로, 변환기는 세로로 놨다.
 * (원인: `$\dfrac{\pi}{3}$` 의 마크업 16글자를 글자 폭으로 셌다.)
 *
 * 그래서 이 검사는 **진짜 편집기를 브라우저에 띄워** 답을 받고, 같은 문항을 파이썬
 * 변환기에 넣어 결과를 맞춰 본다. 두 규칙이 갈라지면 여기서 빨간불이 난다.
 *
 * ⚠️ 실제 내보내기(편집기 → `/hwpx`)는 편집기가 잰 값을 `layoutResolved` 로 함께
 *    보내므로 어림을 타지 않는다. 이 검사는 그 대비책(CLI·손으로 쓴 JSON)이 여전히
 *    쓸 만한지를 본다.
 *
 *   node scripts/check-hwpx-parity.mjs              # 대조
 *   UPDATE_HWPX_TRUTH=1 node scripts/...            # 편집기 답을 정답표로 다시 받아쓴다
 *   HWPX_REQUIRE=1 node scripts/...                 # 건너뛰기를 실패로 취급(CI)
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fingerprint } from "./editor-layout-rules.mjs";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const expDir = join(root, "experiments", "hwp-export");
const truthPath = join(expDir, "samples", "choice-layout-truth.json");
const fixtures = ["full-exam.json", "editor-seed.json", "with-figure.json"];
const update = process.env.UPDATE_HWPX_TRUTH === "1";
const required = process.env.HWPX_REQUIRE === "1";
const python = process.env.HWPX_PYTHON || "python3";

function skip(why) {
  if (required) {
    console.error(`HWPX_REQUIRE=1 인데 검사를 건너뛰어야 합니다: ${why}`);
    process.exit(1);
  }
  console.log(`선지 배치 대조를 건너뜁니다 — ${why}`);
  process.exit(0);
}

if (!existsSync(expDir)) skip("experiments/hwp-export 가 없습니다");
if (spawnSync(python, ["-c", "import lxml"], { encoding: "utf8" }).status !== 0)
  skip("lxml 이 없습니다 (pip install -r experiments/hwp-export/requirements.txt)");

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { skip("playwright 가 없습니다 (npm ci)"); }

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close((e) => (e ? reject(e) : resolve(port)));
    });
  });
}

/* 대조할 문항 — 선지 블록이 있는 것만. 어느 파일의 몇 번인지로 이름을 붙인다. */
const cases = [];
for (const name of fixtures) {
  const file = join(expDir, "samples", name);
  if (!existsSync(file)) continue;
  const data = JSON.parse(await readFile(file, "utf8"));
  for (const p of data.problems || []) {
    if (!(p.blocks || []).some((b) => b.type === "choices")) continue;
    // ⚠️ layoutResolved 가 붙어 있으면 어림이 아니라 그 값을 그대로 쓴다.
    //    여기서 보려는 것은 '어림이 편집기와 같은가' 이므로 떼고 넘긴다.
    const { layoutResolved, ...rest } = p;
    cases.push({ key: `${name}#${p.num}`, problem: rest });
  }
}
if (!cases.length) skip("대조할 선지 문항이 없습니다");

/* ── 1. 진짜 편집기에게 묻는다 ── */
const port = await freePort();
const server = spawn(python, ["serve.py", "--port", String(port)], { cwd: root, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
let browser;
try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw new Error(`로컬 서버가 일찍 종료됐습니다 (${server.exitCode})`);
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* 준비 전 */ }
    if (i > 150) throw new Error("로컬 서버 준비 시간 초과");
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage();
  // ?t= 는 캐시된 낡은 편집기를 다시 검사하지 않기 위한 것이다(회귀 스위트와 같은 이유).
  await page.goto(`${base}/mock-exam-editor.html?t=${Date.now()}`, { waitUntil: "networkidle" });
  const editor = await page.evaluate(
    (cs) => cs.map(({ key, problem }) => [key, window.layoutOf(problem)]),
    cases);

  /* ── 2. 같은 문항을 파이썬 변환기에 넣는다 ── */
  const probe = spawnSync(python, ["-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(expDir)})
from mock_to_hwpx import layout_of, prob_units
out = {}
for c in json.load(sys.stdin):
    p = c["problem"]
    unit = next((u for u in prob_units(p)[0] if u["k"] == "choices"), None)
    items = [x for x in (unit or {}).get("items", []) if x.strip()]
    out[c["key"]] = layout_of(p, items)
print(json.dumps(out))
`], { input: JSON.stringify(cases), encoding: "utf8" });
  if (probe.status !== 0) throw new Error(`파이썬 변환기 호출 실패:\n${probe.stderr}`);
  const converter = JSON.parse(probe.stdout);

  /* ── 3. 맞춰 본다 ── */
  const truth = Object.fromEntries(editor);
  const mismatched = editor.filter(([key, want]) => converter[key] !== want);
  for (const [key, want] of mismatched)
    console.log(`  ❌ ${key}: 편집기 ${want} · 변환기 ${converter[key]}`);

  if (update) {
    // 어떤 규칙에서 잰 값인지 지문을 함께 적는다. 편집기 규칙이 바뀌면
    // check-static.mjs 가 '정답표가 낡았다' 고 알려 준다(그 검사는 CI 에서도 돈다).
    const editorSource = await readFile(join(root, "mock-exam-editor.html"), "utf8");
    const body = {
      _note: "진짜 편집기를 띄워 받아 적은 선지 배치. "
        + "UPDATE_HWPX_TRUTH=1 node scripts/check-hwpx-parity.mjs 로 다시 잰다.",
      _editorRules: fingerprint(editorSource),
      layouts: truth,
    };
    await writeFile(truthPath, JSON.stringify(body, null, 1) + "\n", "utf8");
    console.log(`편집기 답 ${editor.length}건을 정답표에 다시 받아썼습니다 → ${truthPath}`);
  } else if (existsSync(truthPath)) {
    // 정답표가 낡으면 파이썬 검사(test_layout.py)가 아무것도 검사하지 않게 된다.
    const saved = (JSON.parse(await readFile(truthPath, "utf8")) || {}).layouts || {};
    const stale = editor.filter(([key, want]) => saved[key] !== want);
    for (const [key, want] of stale)
      console.log(`  ❌ 정답표가 낡았습니다 ${key}: 편집기 ${want} · 정답표 ${saved[key] ?? "(없음)"}`);
    if (stale.length) {
      console.error("UPDATE_HWPX_TRUTH=1 로 다시 받아쓰고, 변환기도 함께 확인하세요");
      process.exitCode = 1;
    }
  }

  if (mismatched.length) {
    console.error(`선지 배치가 편집기와 다릅니다 — ${mismatched.length}건 / ${editor.length}건`);
    process.exitCode = 1;
  } else if (!process.exitCode) {
    console.log(`선지 배치 대조 통과 — ${editor.length}문항이 편집기와 같습니다`);
  }
} finally {
  await browser?.close();
  server.kill();
}
