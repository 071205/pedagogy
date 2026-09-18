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
/* ⚠️ 어느 파이썬인지 함께 묻는다 — 이름만 말하면 PATH 때문에 건너뛴 것을 알 수 없다. */
const lxmlProbe = spawnSync(python, ["-c", "import sys;print(sys.executable);import lxml"], { encoding: "utf8" });
if (lxmlProbe.status !== 0) {
  const used = (lxmlProbe.stdout || "").trim().split("\n")[0] || python;
  skip(`${used} 에 lxml 이 없습니다 (다른 파이썬이면 HWPX_PYTHON=<경로>, `
     + `없으면 pip install -r experiments/hwp-export/requirements.txt)`);
}

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
    // 각주는 **앞 문단**에 매달리고 쪽나눔은 **다음 문단**의 속성이 된다.
    // 양쪽이 그 '앞/뒤' 를 같은 자리로 잡는지까지 이 대조가 본다.
    { type: "footnote", text: "인용에 붙는 각주" },
    { type: "pagebreak" },
    { type: "paragraph", text: "쪽나눔 뒤 문단" },
    { type: "footnote", text: "둘째 각주 — 번호가 이어져야 한다" },
  ],
}]);
/* 머리말·꼬리말은 블록이 아니라 **문서 수준 값**이라 위 표본에 섞이지 않는다.
   ⚠️ 붙는 자리가 흐름 밖(첫 문단의 secPr run)이라 문단 수·글자 조각만 봐서는 갈라진 것을
      못 본다 — 그래서 `signals()` 가 머리말 상자를 따로 뽑는다. */
cases.push(["page-notes", {
  version: 1,
  title: "머리말·꼬리말",
  header: "PEDAGOGY 머리말",
  footer: "PEDAGOGY 꼬리말",
  blocks: [{ type: "paragraph", text: "본문 한 줄" }],
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
    /* ⚠️ `styleIDRef` 를 안 보고 있었다 — 그래서 각주 본문이 **각주(14)가 아니라
       미주(15) 스타일**로 나가던 것을 이 대조가 놓쳤다. 두 스타일이 같은 paraPr·charPr
       을 가리켜 `paraRefs` 로는 똑같아 보였고 PDF 로도 안 보였다. 빼지 말 것. */
    styleRefs: grab(sec, /<hp:p\b[^>]*styleIDRef="([^"]*)"/g),
    charRefs: grab(sec, /<hp:run\b[^>]*charPrIDRef="([^"]*)"/g),
    tables: (sec.match(/<hp:tbl\b/g) || []).length,
    pictures: (sec.match(/<hp:pic\b/g) || []).length,
    tabs: (sec.match(/<hp:tab\b/g) || []).length,
    charPrCount: (head.match(/<hh:charPr\b/g) || []).length,
    paraPrCount: (head.match(/<hh:paraPr\b/g) || []).length,
    borderFills: (head.match(/<hh:borderFill\b/g) || []).length,
    borderRefs: grab(head, /<hh:border\b[^>]*borderFillIDRef="([^"]*)"/g),
    /* 머리말·꼬리말 — **어디에 붙었는지까지** 본다.
       ⚠️ `secPr` 안에 사본을 두고 `<hp:headerApply>` 로 가리키면 한글이 파일은 열어 주고
          **아무것도 찍지 않는다**(2026-09-17 실측). 그래서 개수만 세지 않고 자리를 함께 본다. */
    pageNotes: [...sec.matchAll(/<hp:(header|footer)\b[^>]*applyPageType="([^"]*)"[^>]*>[\s\S]*?<\/hp:\1>/g)]
      .map((m) => `${m[1]}:${m[2]}:${(m[0].match(/vertAlign="([^"]*)"/) || [])[1]}`
                + `:${(m[0].match(/textWidth="([^"]*)"/) || [])[1]}`
                + `:${(m[0].match(/textHeight="([^"]*)"/) || [])[1]}`
                + `:${strip((m[0].match(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/) || [])[1] || "")}`
                /* ⚠️ 글자 모양 참조까지 본다. 안 보면 머리말이 **본문이 아니라 제목
                   모양(19pt)** 으로 나가던 것을 놓친다 — 각주가 미주 스타일로 나가던
                   REV-2026-094 와 같은 종류다(REV-2026-096). */
                + `:${(m[0].match(/<hp:run\b[^>]*charPrIDRef="([^"]*)"/) || [])[1]}`),
    pageNoteApplies: (sec.match(/<hp:(headerApply|footerApply)\b/g) || []).length,
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
        names: [...files.keys()],
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

    /* 4) ZIP 껍데기를 **남의 읽개**로 읽어 본다.
       ⚠️ 위 1) 은 우리 `unzip()` 으로 풀었다 — 우리가 쓰고 우리가 읽으면 우리끼리만
       통하는 ZIP 이라도 통과한다. 정작 이 파일을 읽는 것은 한글이므로, 엄격한 남의
       구현(파이썬 `zipfile`)이 받아 주는지를 따로 본다. 실물 한글이 저장한 .hwpx 를
       재어 보면 `flag_bits=0` · data descriptor 없음 · `mimetype` 이 맨 앞 무압축이다. */
    const brOut = join(tmpdir(), `pedagogy-br-${name}-${process.pid}.hwpx`);
    await writeFile(brOut, Buffer.from(made.b64, "base64"));
    const zipProbe = spawnSync(python, ["-c", `
import json, sys, zipfile
def shape(path):
    z = zipfile.ZipFile(path)
    bad = z.testzip()
    if bad: raise SystemExit("깨진 파트: " + bad)
    return {
        "names": [i.filename for i in z.infolist()],
        "flags": sorted({i.flag_bits for i in z.infolist()}),
        "descriptors": sum(1 for i in z.infolist() if i.flag_bits & 0x08),
        "first": [z.infolist()[0].filename, z.infolist()[0].compress_type],
    }
print(json.dumps({"browser": shape(sys.argv[1]), "python": shape(sys.argv[2])}))
`, brOut, pyOut], { encoding: "utf8" });
    if (zipProbe.status !== 0) {
      failures++;
      console.log(`  ❌ ${name} — 브라우저가 만든 ZIP 을 표준 읽개가 못 읽습니다`);
      console.log("      " + String(zipProbe.stderr || "").trim().split("\n").slice(-1)[0]);
    } else {
      const { browser: bz, python: pz } = JSON.parse(zipProbe.stdout);
      const problems = [];
      if (JSON.stringify(bz.names) !== JSON.stringify(pz.names))
        problems.push(`파트 목록·순서 — 브라우저 ${bz.names.length}개 · 파이썬 ${pz.names.length}개`);
      /* ⚠️ 두 읽개가 **같은 파일에서 같은 것**을 봐야 한다. 파이썬 `zipfile` 은 EOCD 의
         파일 개수를 안 보고 중앙 디렉터리를 끝까지 훑고, 우리 `unzip()` 은 그 개수를 쓴다 —
         그래서 개수만 틀리게 써도 파이썬 쪽만 보면 멀쩡해 보인다(깨보기에서 실제로 통과했다). */
      if (JSON.stringify(made.names) !== JSON.stringify(bz.names))
        problems.push(`읽개마다 다르게 읽힙니다 — 우리 unzip ${made.names.length}개 · 파이썬 ${bz.names.length}개`);
      if (JSON.stringify(bz.first) !== JSON.stringify(["mimetype", 0]))
        problems.push(`첫 파트가 무압축 mimetype 이 아닙니다: ${JSON.stringify(bz.first)}`);
      if (bz.descriptors) problems.push(`data descriptor ${bz.descriptors}개 (한글이 쓰는 .hwpx 는 0개)`);
      if (JSON.stringify(bz.flags) !== JSON.stringify(pz.flags))
        problems.push(`ZIP 플래그가 파이썬과 다릅니다 — 브라우저 ${JSON.stringify(bz.flags)} · 파이썬 ${JSON.stringify(pz.flags)}`);
      if (problems.length) { failures += problems.length; problems.forEach((t) => console.log(`  ❌ ${name} · ${t}`)); }
      else console.log(`  ✅ ${name} — ZIP 껍데기도 파이썬과 같습니다 (파트 ${bz.names.length}개)`);
    }

    if (outDir) {
      await writeFile(join(outDir, `${name}-browser.hwpx`), Buffer.from(made.b64, "base64"));
      await writeFile(join(outDir, `${name}-python.hwpx`), await readFile(pyOut));
      console.log(`      → ${outDir}/${name}-browser.hwpx · ${name}-python.hwpx`);
    }
  }

  /* ── 검증기 자기검사 ───────────────────────────────────────────────────
   * `strictValidate()` 는 **사용자에게 나가기 직전 마지막 관문**이다 — `toBlob()` 이 부른다.
   * ⚠️ 예전에는 파이썬 `save()` 만 검사하고 브라우저는 아무것도 안 봤다. 그런데 실제로
   *    사용자에게 나가는 것은 **브라우저 경로다.** 깨진 문서가 그대로 한글까지 가서
   *    "파일을 읽거나 저장하는데 오류가 있습니다" 한 줄만 돌려받았다.
   * ⚠️ **항상 통과하는 검사는 없느니만 못하다.** 그래서 고장을 심어 빨간불이 나는지 본다.
   *    심는 고장은 전부 **XML 문법은 완벽한데 한글만 거부하는** 모양이다 — 파서로는
   *    절대 안 잡히고 개수·참조를 세어야 보인다.
   * ⚠️ 그리고 파이썬과 **같은 판정을 내는지**까지 본다. 검증기도 사본이라 갈라진다. */
  const BREAK_LABELS = ["정상", "없는 스타일을 가리키는 문단", "itemCnt 가 실제와 다른 표",
                        "규격이 금지한 itemCnt=0", "없는 글꼴을 가리키는 fontRef",
                        "필수 파트가 빠짐"];

  const jsVerdict = await page.evaluate(async (url) => {
    const H = window.PedagogyHwpx;
    const pick = (doc, prefix, name) => doc
      .part(prefix === "hp" ? "Contents/section0.xml" : "Contents/header.xml")
      .xml.getElementsByTagNameNS(H.NS[prefix], name)[0];
    const BREAKS = {
      "정상": () => {},
      "없는 스타일을 가리키는 문단": (d) => pick(d, "hp", "p").setAttribute("styleIDRef", "9999"),
      "itemCnt 가 실제와 다른 표": (d) => pick(d, "hh", "styles").setAttribute("itemCnt", "999"),
      "규격이 금지한 itemCnt=0": (d) => pick(d, "hh", "charProperties").setAttribute("itemCnt", "0"),
      "없는 글꼴을 가리키는 fontRef": (d) => pick(d, "hh", "fontRef").setAttribute("hangul", "9999"),
      "필수 파트가 빠짐": (d) => d.parts.delete("version.xml"),
    };
    const out = {};
    for (const [label, breakIt] of Object.entries(BREAKS)) {
      const doc = await H.HwpxDocument.blank(url);
      breakIt(doc);
      try { doc.strictValidate(); out[label] = []; }
      catch (e) { out[label] = String(e.message).split("; ").sort(); }
    }
    return out;
  }, "experiments/hwp-export/templates/blank.hwpx");

  const pyProbe = spawnSync(python, ["-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(expDir)})
from pedagogy_hwpx import HwpxDocument, NS, qn

TEMPLATE = ${JSON.stringify(join(expDir, "templates", "blank.hwpx"))}

def head(d): return d.get_part("Contents/header.xml").element
def body(d): return d.get_part("Contents/section0.xml").element

BREAKS = {
    "정상": lambda d: None,
    "없는 스타일을 가리키는 문단": lambda d: next(body(d).iter(qn("hp", "p"))).set("styleIDRef", "9999"),
    "itemCnt 가 실제와 다른 표": lambda d: head(d).find(".//hh:styles", namespaces=NS).set("itemCnt", "999"),
    "규격이 금지한 itemCnt=0": lambda d: head(d).find(".//hh:charProperties", namespaces=NS).set("itemCnt", "0"),
    "없는 글꼴을 가리키는 fontRef": lambda d: next(head(d).iter(qn("hh", "fontRef"))).set("hangul", "9999"),
    "필수 파트가 빠짐": lambda d: d.remove_part("version.xml"),
}
out = {}
for label, break_it in BREAKS.items():
    doc = HwpxDocument.open(TEMPLATE)
    break_it(doc)
    try:
        doc.strict_validate()
        out[label] = []
    except ValueError as e:
        out[label] = sorted(str(e).split("; "))
print(json.dumps(out, ensure_ascii=False))
`], { encoding: "utf8" });
  if (pyProbe.status !== 0) {
    failures++;
    console.log("  ❌ 검증기 자기검사 — 파이썬 쪽을 돌리지 못했습니다");
    console.log("      " + String(pyProbe.stderr || "").trim().split("\n").slice(-1)[0]);
  } else {
    const pyVerdict = JSON.parse(pyProbe.stdout);
    console.log("\n검증기 자기검사 — 고장을 심어 본다");
    for (const label of BREAK_LABELS) {
      const js = jsVerdict[label] || [];
      const py = pyVerdict[label] || [];
      const wantCaught = label !== "정상";
      if (wantCaught && !js.length) {
        failures++;
        console.log(`  ❌ ${label} — 브라우저 검증이 **통과시켰습니다.** 이 검사는 헛돕니다`);
        continue;
      }
      if (!wantCaught && js.length) {
        failures++;
        console.log(`  ❌ 정상 문서를 브라우저 검증이 거부합니다: ${js[0]}`);
        continue;
      }
      if (JSON.stringify(js) !== JSON.stringify(py)) {
        failures++;
        console.log(`  ❌ ${label} — 브라우저와 파이썬의 판정이 다릅니다`);
        console.log(`      브라우저: ${JSON.stringify(js).slice(0, 240)}`);
        console.log(`      파이썬  : ${JSON.stringify(py).slice(0, 240)}`);
        continue;
      }
      console.log(`  ✅ ${label}${wantCaught ? ` — 양쪽 모두 잡았습니다 (${js.length}건, 같은 말)` : " — 양쪽 모두 통과"}`);
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
