/* 브라우저 HWPX 조판기 ↔ 파이썬 변환기 대조 — 베타
 *
 * `hwpx-engine.js` + `hwpx-document.js` 는 `experiments/hwp-export/` 파이썬을 **옮겨 적은
 * 사본**이다. 이 저장소가 여러 번 겪은 대로, 사본은 갈라진다. 그래서 같은 문서 JSON 을
 * 진짜 브라우저(Playwright)와 파이썬에 각각 넣어 결과를 맞춰 본다.
 *
 * ⚠️ 바이트 단위로 비교하지 않는다. XML 직렬화는 속성 순서·공백이 구현마다 달라서
 *    그렇게 하면 **뜻이 같은데도 빨간불**이 난다. 대신 조판 결과를 결정하는 신호를
 *    뽑아 맞춘다 — 글자 조각 차례, 수식 스크립트, 문단 수, 문단·글자 모양 참조 차례.
 *
 *   node scripts/check-hwpx-browser.mjs
 *   HWPX_BROWSER_OUT=<폴더> node scripts/...   # 두 결과물을 파일로 남긴다(한글로 열어 보려고)
 *   HWPX_REQUIRE=1 node scripts/...            # 건너뛰기를 실패로 취급(CI)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const expDir = join(root, "experiments", "hwp-export");
const python = process.env.HWPX_PYTHON || "python3";
const required = process.env.HWPX_REQUIRE === "1";
const outDir = process.env.HWPX_BROWSER_OUT || "";

const SKIP_FIXABLE = 3;

function skip(why) {
  if (required) {
    console.error(`HWPX_REQUIRE=1 인데 검사를 건너뛰어야 합니다: ${why}`);
    process.exit(SKIP_FIXABLE);
  }
  console.log(`브라우저↔파이썬 대조를 건너뜁니다 — ${why}`);
  process.exit(0);
}

if (!existsSync(expDir)) skip("experiments/hwp-export 가 없습니다");
if (!existsSync(join(root, "hwpx-engine.js"))) skip("hwpx-engine.js 가 없습니다");
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

/* 대조할 문서들. 표본 파일 하나에 더해, 표본이 다루지 않는 블록을 채운 것을 덧붙인다. */
const samplePath = join(expDir, "samples", "document-sample.json");
if (!existsSync(samplePath)) skip("document-sample.json 이 없습니다");
const cases = [["document-sample", JSON.parse(await readFile(samplePath, "utf8"))]];
cases.push(["extra-blocks", {
  version: 1,
  title: "대조용 — 표본에 없는 것들",
  blocks: [
    { type: "heading", level: 2, text: "둘째 단계 제목" },
    { type: "heading", level: 3, text: "셋째 단계 제목" },
    { type: "paragraph", text: "행렬 $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$ 과 " +
                                "경우 $\\begin{cases} x \\\\ y \\end{cases}$ 를 섞는다." },
    { type: "equation", text: "$$\\lim_{n \\to \\infty}\\dfrac{1}{n} = 0$$" },
    { type: "choices", layout: "2", items: ["$\\sqrt{2}$", "둘", "셋", "넷", "다섯"] },
    { type: "choices", layout: "v", items: ["아주 긴 선지 하나입니다", "둘"] },
    { type: "examples", label: "<자료>", items: ["첫째", "둘째", "셋째"] },
    { type: "box", label: null, text: "라벨 없는 상자" },
    { type: "quote", text: "인용 안의 수식 $e^{i\\pi}+1=0$" },
  ],
}]);

/* ── 결과에서 뽑아낼 신호 ─────────────────────────────────────────────────
 * 조판 결과를 실제로 결정하는 것들만 본다. 직렬화 차이(속성 순서·공백)는 무시한다. */
/* 조판 결과를 실제로 결정하는 것들만 본다. 직렬화 차이(속성 순서·공백)는 무시한다.
 * ⚠️ Node 에서 뽑는다. 브라우저 안에서 `eval` 로 돌리려 했다가 막혔다 — 두 화면의 CSP 에
 *    `unsafe-eval` 이 **일부러** 없다(방어선이다). 검사 편의로 그것을 열지 말 것. */
function signals(xml) {
  const strip = (s) => s.replace(/<[^>]+>/g, "");
  const grab = (text, re) => [...text.matchAll(re)].map((m) => m[1]);
  const sec = xml.section0 || "";
  const head = xml.header || "";
  const hpf = xml.hpf || "";
  return {
    // ⚠️ 빈 글자칸은 브라우저가 `<hp:t/>`(자기닫음), 파이썬이 `<hp:t></hp:t>` 로 쓴다.
    //    자기닫음을 함께 보지 않으면 정규식이 **다음 태그까지 삼켜** 수식 스크립트가
    //    글자 조각에 섞여 든다 — 뜻은 같은데 빨간불이 나는 종류의 오진이다.
    texts: [...sec.matchAll(/<hp:t\b[^>]*\/>|<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g)]
      .map((m) => strip(m[1] ?? "")).filter((t) => t.trim()),
    scripts: grab(sec, /<hp:script\b[^>]*>([\s\S]*?)<\/hp:script>/g).map(strip),
    paraCount: (sec.match(/<hp:p\b/g) || []).length,
    paraRefs: grab(sec, /<hp:p\b[^>]*paraPrIDRef="([^"]*)"/g),
    charRefs: grab(sec, /<hp:run\b[^>]*charPrIDRef="([^"]*)"/g),
    tables: (sec.match(/<hp:tbl\b/g) || []).length,
    pictures: (sec.match(/<hp:pic\b/g) || []).length,
    tabs: (sec.match(/<hp:tab\b/g) || []).length,
    charPrCount: (head.match(/<hh:charPr\b/g) || []).length,
    paraPrCount: (head.match(/<hh:paraPr\b/g) || []).length,
    borderFills: (head.match(/<hh:borderFill\b/g) || []).length,
    borderRefs: grab(head, /<hh:border\b[^>]*borderFillIDRef="([^"]*)"/g),
    manifestItems: (hpf.match(/<opf:item\b/g) || []).length,
  };
}

const port = await freePort();
const server = spawn(python, ["serve.py", "--port", String(port)], { cwd: root, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
let browser;
let failures = 0;

function compare(name, a, b) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const bad = [];
  for (const k of keys) {
    const x = JSON.stringify(a[k]);
    const y = JSON.stringify(b[k]);
    if (x !== y) bad.push({ k, browser: x, python: y });
  }
  if (!bad.length) { console.log(`  ✅ ${name}`); return; }
  failures += 1;
  console.log(`  ❌ ${name} — 다른 항목 ${bad.length}개`);
  for (const d of bad.slice(0, 6)) {
    console.log(`      ${d.k}\n        브라우저: ${String(d.browser).slice(0, 220)}\n        파이썬  : ${String(d.python).slice(0, 220)}`);
  }
}

try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw new Error(`로컬 서버가 일찍 종료됐습니다 (${server.exitCode})`);
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* 준비 전 */ }
    if (i > 150) throw new Error("로컬 서버 준비 시간 초과");
    await new Promise((r) => setTimeout(r, 100));
  }

  // ⚠️ 크로미움 실행 파일이 없으면 **죽지 말고 건너뛴다.** `npm ci` 는 playwright 를
  //    깔지만 브라우저 본체는 `npx playwright install` 을 따로 해야 받아진다.
  try { browser = await chromium.launch(); }
  catch (e) {
    server.kill();
    skip(`크로미움을 띄우지 못했습니다 (npx playwright install chromium) — ${e.message.split("\n")[0]}`);
  }
  const page = await browser.newPage();
  // ?t= 는 캐시된 낡은 사본을 다시 검사하지 않기 위한 것이다.
  await page.goto(`${base}/document-editor.html?t=${Date.now()}`, { waitUntil: "networkidle" });
  const ready = await page.evaluate(() => !!(window.PedagogyHwpxDocument && window.CompressionStream));
  if (!ready) throw new Error("브라우저 조판기를 불러오지 못했습니다 (hwpx-engine.js / hwpx-document.js)");

  if (outDir) await mkdir(outDir, { recursive: true });
  console.log("브라우저 ↔ 파이썬 대조");

  for (const [name, docJson] of cases) {
    /* 1) 브라우저에서 만든다 */
    const made = await page.evaluate(async (input) => {
      const doc = window.validate(input);
      const { blob } = await window.PedagogyHwpxDocument.buildDocument(
        doc, "experiments/hwp-export/templates/blank.hwpx");
      const files = await window.PedagogyHwpx.unzip(await blob.arrayBuffer());
      const dec = new TextDecoder();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return {
        b64: btoa(bin),
        xml: {
          section0: dec.decode(files.get("Contents/section0.xml")),
          header: dec.decode(files.get("Contents/header.xml")),
          hpf: dec.decode(files.get("Contents/content.hpf")),
        },
      };
    }, docJson);

    /* 2) 같은 입력을 파이썬에 넣는다 */
    const pyOut = join(tmpdir(), `pedagogy-py-${name}-${process.pid}.hwpx`);
    const py = spawnSync(python, ["-c", `
import json, sys, zipfile
sys.path.insert(0, ${JSON.stringify(expDir)})
from document_to_hwpx import build
data = json.load(sys.stdin)
build(data, ${JSON.stringify(pyOut)})
z = zipfile.ZipFile(${JSON.stringify(pyOut)})
print(json.dumps({
    "section0": z.read("Contents/section0.xml").decode("utf-8"),
    "header": z.read("Contents/header.xml").decode("utf-8"),
    "hpf": z.read("Contents/content.hpf").decode("utf-8"),
}))
`], { input: JSON.stringify(docJson), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (py.status !== 0) throw new Error(`파이썬 변환 실패 (${name}): ${py.stderr}`);
    const pyXml = JSON.parse(py.stdout);

    /* 3) 신호를 뽑아 맞춘다 */
    compare(name, signals(made.xml), signals(pyXml));

    if (outDir) {
      await writeFile(join(outDir, `${name}-browser.hwpx`), Buffer.from(made.b64, "base64"));
      await writeFile(join(outDir, `${name}-python.hwpx`), await readFile(pyOut));
      console.log(`      → ${outDir}/${name}-browser.hwpx · ${name}-python.hwpx`);
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (failures) {
  console.log(`\n브라우저 조판기가 파이썬과 갈라졌습니다 — ${failures}건`);
  console.log("한쪽만 고치지 말 것. 둘 다 같은 결과를 내야 한다.");
  process.exit(1);
}
console.log("\n브라우저 조판기가 파이썬과 같은 결과를 냅니다");
