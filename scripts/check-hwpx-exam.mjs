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
 * ⚠️ **진짜 브라우저에서 돌린다.** 1단계(역할 읽기)는 문자열·정규식뿐이라 node 로도
 *    됐지만, 2단계(떠 오기·비우기)는 `DOMParser`·`outerHTML` 을 쓴다. 흉내 낸 DOM 으로
 *    견주면 "우리 흉내가 우리 흉내와 같다" 를 검사하게 된다 — 문서 쪽
 *    `check-hwpx-browser.mjs` 가 같은 이유로 Playwright 를 쓴다.
 *
 * ⚠️ **이 대조가 덮지 못하는 것이 있다.** 일부러 깨서 확인한 결과, 아래 둘은 지금 틀에서
 *    그 코드가 **아예 안 걸려** 깨도 통과한다 — 검사가 헛도는 것이 아니라 **표본이 그
 *    경우를 담고 있지 않다.** 고칠 때 이 검사만 믿지 말 것:
 *      · 문단 위 여백(`prev`) 합산 — 이 틀은 `prev=0` 이라 빼도 값이 같다
 *      · 태그 표에서 '셀 안 문단이 하나인 사본' 고르기 — 이 틀은 사본이 전부 하나짜리다
 *    (반대로 '머리말은 첫 것만' 은 처음엔 못 잡았다. 개수만 견줬기 때문인데, section1 에
 *     머리말 문단이 6개라 마지막 것을 떠 와도 개수는 1 로 같았다. 지금은 내용을 견딘다.)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

# 2단계 — 떠 오기·비우기까지. \`open_template()\` 이 하는 것을 그대로 한다.
from pedagogy_hwpx import HwpxDocument
doc = HwpxDocument.open(str(T))
roles["_page_header"] = tmpl.capture_page_headers(doc)
roles["_line_mm"] = tmpl.read_pad_step_mm(doc, roles)
roles["_column_tops"] = tmpl.read_column_tops_mm(doc)
marks = tmpl.capture_marks(doc)
# ⚠️ 표 XML 을 **문자열로 견주면 안 된다.** 파이썬은 요소마다 네임스페이스를 붙여 내고
#    브라우저는 안 붙인다 — 같은 표인데 2531자 vs 1778자가 된다(실제로 그랬다).
#    직렬화에 기대지 않는 **지문**으로 견준다: 요소 종류별 개수 + 보이는 글.
import re as _re
def _fp(xml: str) -> dict:
    tags: dict[str, int] = {}
    # WARN: 이 파이썬은 JS 템플릿 리터럴 안에 있다. 백슬래시를 두 번 적지 않으면
    #       JS 가 하나를 먹어 파이썬이 w+ 를 받는다 — 태그가 하나도 안 잡혀 지문이
    #       빈 사전이 되고, 그러면 이 대조가 아무것도 검사하지 않는다(실제로 그랬다).
    #       그리고 여기에는 backtick 을 쓰지 말 것 — 리터럴이 거기서 끝난다.
    for m in _re.finditer(r"<(?:\\w+:)?(\\w+)[\\s/>]", xml):
        tags[m.group(1)] = tags.get(m.group(1), 0) + 1
    text = "".join(_re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", xml, _re.S))
    return {"tags": tags, "text": _re.sub(r"<[^>]+>", "", text)}

roles["_marks"] = {
    "tag": {k: {"fp": _fp(v["tbl"]), "para": v["para"], "style": v["style"], "char": v["char"]}
            for k, v in (marks.get("tag") or {}).items()},
    "note": {str(k): {"fp": _fp(v["tbl"]), "para": v["para"]}
             for k, v in (marks.get("note") or {}).items()},
    "tag_step_mm": marks.get("tag_step_mm"),
}
# WARN: 개수만 견주면 안 된다. section1 에는 머리말을 품은 문단이 6개라, "첫 것만
#       쓴다" 를 어겨 마지막 것을 떠 와도 개수는 그대로 1 이라 통과한다(실제로 그랬다).
#       내용까지 지문으로 견딘다.
roles["_page_header"] = {str(k): [_fp(x) for x in v] for k, v in roles["_page_header"].items()}
roles["_column_tops"] = {str(k): [round(x, 3) for x in v] for k, v in roles["_column_tops"].items()}
roles["_line_mm"] = round(roles["_line_mm"], 4) if roles["_line_mm"] else roles["_line_mm"]
roles["_cleared"] = tmpl.clear_body(doc)
roles["_bindata_gone"] = tmpl.strip_bindata(doc)   # 이 순서가 open_template() 과 같다
print(json.dumps(roles, ensure_ascii=False, sort_keys=True))
`;

/* ── 3단계: **문항을 실제로 내보고** 결과를 견준다 ─────────────────────────
   ⚠️ 역할 표가 같아도 방출이 다르면 시험지가 다르게 나온다. 여기서는 편집기가 보내는
      것과 같은 payload 를 양쪽에 넣고 **만들어진 문단**을 지문으로 견준다. */
/* 편집기가 실제로 보내는 모양(블록 배열)이다 — 유닛 나누기까지 파이썬이 하게 두고,
   그 결과를 JS 에 그대로 먹여 **방출**만 견준다(브라우저는 편집기의 `probUnits()` 를 쓴다). */
const PROBLEM = {
  num: 12, pts: 4, type: "choice", layoutResolved: "2",
  blocks: [
    { type: "statement", data: { text: "함수 $f(x)=x^{2}-3x$ 에 대하여 $f(2)$ 의 값은? (단, $x>0$)\n$\\int_0^1 x^2\\,dx$" } },
    { type: "conditions", data: { items: ["(가) $a_1=1$", "$a_{n+1}=a_n+2$"] } },
    { type: "examples", data: { items: ["$p$ 는 소수이다.", "$q$ 는 짝수이다."] } },
    { type: "boxed", data: { text: "보기" } },
    { type: "choices", data: { items: ["$1$", "$2$", "$3$", "$4$", "$5$"], layout: "auto" } },
  ],
};

const PY_EMIT = `
import json, sys
sys.path.insert(0, "experiments/hwp-export")
from pathlib import Path
import mock_to_hwpx as m, template as tmpl
T = Path(${JSON.stringify(TEMPLATE)})
doc, roles = tmpl.open_template(T)
m.STYLE.clear(); m.CUR["sec"] = 0
m.PROFILE.clear(); m.PROFILE["_source"] = "x (틀)"
for role, spec in roles.items():
    if role.startswith("_"): continue
    if "para" in spec: m.STYLE["para_" + role] = spec["para"]
    if "char" in spec: m.STYLE["char_" + role] = spec["char"]
    if "style" in spec: m.STYLE["style_" + role] = spec["style"]
m.STYLE["char_num"] = roles.get("num", {}).get("char", m.STYLE.get("char_stem"))
m.PROFILE["_eq_base"] = roles.get("_eq_base")

p = json.loads(sys.argv[1] if len(sys.argv) > 1 else "{}")
rep = m.Report()
units, pts_at = m.prob_units(p)
before = doc.paragraph_count(0)
m.emit_problem(doc, p, rep)
out = []
import re as _re
sec = doc.get_part("Contents/section0.xml")
paras = [k for k in sec.root.children if k.local_name == "p"][before:]
for para in paras:
    xml = para.to_xml()
    tags = {}
    for mm in _re.finditer(r"<(?:\\w+:)?(\\w+)[\\s/>]", xml):
        tags[mm.group(1)] = tags.get(mm.group(1), 0) + 1
    text = "".join(_re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", xml, _re.S))
    out.append({
        "para": para.get_attr("paraPrIDRef"), "style": para.get_attr("styleIDRef"),
        "tags": tags, "text": _re.sub(r"<[^>]+>", "", text),
        "chars": _re.findall(r'charPrIDRef="(\\d+)"', xml),
        "tabs": _re.findall(r'<hp:tab width="(\\d+)"', xml),
        "scripts": _re.findall(r"<hp:script[^>]*>(.*?)</hp:script>", xml, _re.S),
    })
print(json.dumps({"paras": out, "warnings": rep.warnings,
                  "units": units, "ptsAt": pts_at}, ensure_ascii=False))
`;

let pyRoles;
try {
  pyRoles = JSON.parse(execFileSync("python3", ["-c", PY], { cwd: ROOT, encoding: "utf8" }));
} catch (e) {
  skip("파이썬 쪽을 돌리지 못했습니다: " + String(e.message).split("\n")[0].slice(0, 120));
}

/* ── JS 쪽 (진짜 브라우저) ────────────────────────────────────────────── */
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { skip("playwright 가 없습니다 (npm ci)"); }

let browser;
try { browser = await chromium.launch(); }
catch { skip("크로미움이 없습니다 (npx playwright install chromium)"); }

const templateB64 = readFileSync(TEMPLATE).toString("base64");
let jsRoles;
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><meta charset=utf-8><title>틀 읽기 대조</title>");
  await page.addScriptTag({ path: join(ROOT, "hwpx-engine.js") });
  await page.addScriptTag({ path: JS });
  jsRoles = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const T = window.PedagogyExamTemplate;
    const { doc, roles } = await T.openTemplate(bytes.buffer);

    /* ⚠️ 표 XML 을 **문자열로 견주면 안 된다** — 파이썬은 요소마다 네임스페이스를
       붙여 내고 브라우저는 안 붙인다. 직렬화에 기대지 않는 지문으로 견준다. */
    const fp = (xml) => {
      const tags = {};
      for (const m of xml.matchAll(/<(?:\w+:)?(\w+)[\s/>]/g)) tags[m[1]] = (tags[m[1]] || 0) + 1;
      const text = [...xml.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g)].map((m) => m[1]).join("");
      return { tags, text: text.replace(/<[^>]+>/g, "") };
    };
    const marks = roles._marks || {};
    roles._marks = {
      tag: Object.fromEntries(Object.entries(marks.tag || {}).map(([k, v]) =>
        [k, { fp: fp(v.tbl), para: v.para, style: v.style, char: v.char }])),
      note: Object.fromEntries(Object.entries(marks.note || {}).map(([k, v]) =>
        [k, { fp: fp(v.tbl), para: v.para }])),
      tag_step_mm: marks.tag_step_mm,
    };
    /* WARN: 개수만 견주면 "첫 것만 쓴다" 를 어겨도 통과한다 — 내용까지 본다. */
    roles._page_header = Object.fromEntries(
      Object.entries(roles._page_header || {}).map(([k, v]) => [k, v.map(fp)]));
    roles._column_tops = Object.fromEntries(
      Object.entries(roles._column_tops || {}).map(([k, v]) =>
        [k, v.map((x) => Math.round(x * 1000) / 1000)]));
    if (roles._line_mm) roles._line_mm = Math.round(roles._line_mm * 1e4) / 1e4;
    /* ⚠️ 여기서 다시 부르면 안 된다 — `openTemplate()` 이 이미 비웠으므로 0 이 나온다.
       파이썬은 그 순서에서 처음 부르니 273 이 나와, 같은 값을 견주는 것이 아니게 된다
       (실제로 273 vs 0 으로 빨간불이 났다). 비운 개수는 `openTemplate()` 이 기록한다. */
    return roles;
  }, templateB64);
} finally {
  await browser.close();
}

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
const sortDeep = (v) => Array.isArray(v) ? v.map(sortDeep)
  : (v && typeof v === "object")
    ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x < y ? -1 : 1)
        .map(([k, x]) => [k, sortDeep(x)]))
    : v;
const canon = (v) => JSON.stringify(sortDeep(v ?? null));

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

/* ── 3단계: 문항 방출 대조 ───────────────────────────────────────────────── */
let pyEmit;
try {
  pyEmit = JSON.parse(execFileSync("python3", ["-c", PY_EMIT, JSON.stringify(PROBLEM)],
                                   { cwd: ROOT, encoding: "utf8", maxBuffer: 32 << 20 }));
} catch (e) {
  console.log("문항 방출 대조를 건너뜁니다 — 파이썬 쪽 실패: "
    + String(e.stderr || e.message).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 160));
  process.exit(REQUIRE ? 1 : 0);
}

let jsEmit;
{
  const browser2 = await chromium.launch();
  try {
    const page = await browser2.newPage();
    await page.setContent("<!doctype html><meta charset=utf-8><title>방출 대조</title>");
    await page.addScriptTag({ path: join(ROOT, "hwpx-engine.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam-template.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam.js") });
    jsEmit = await page.evaluate(async ([b64, problem]) => {
      const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const { doc, roles } = await window.PedagogyExamTemplate.openTemplate(bytes.buffer);
      const w = new window.PedagogyExam.ExamWriter(doc, roles);
      const before = doc.paragraphCount(0);
      w.problem(problem, null);
      const ser = new XMLSerializer();
      const paras = doc.paragraphs(0).slice(before);
      const out = paras.map((p) => {
        const xml = ser.serializeToString(p);
        const tags = {};
        for (const m of xml.matchAll(/<(?:\w+:)?(\w+)[\s/>]/g)) tags[m[1]] = (tags[m[1]] || 0) + 1;
        const text = [...xml.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g)].map((m) => m[1]).join("");
        return {
          para: p.getAttribute("paraPrIDRef"), style: p.getAttribute("styleIDRef"),
          tags, text: text.replace(/<[^>]+>/g, ""),
          chars: [...xml.matchAll(/charPrIDRef="(\d+)"/g)].map((m) => m[1]),
          tabs: [...xml.matchAll(/<hp:tab width="(\d+)"/g)].map((m) => m[1]),
          scripts: [...xml.matchAll(/<hp:script[^>]*>([\s\S]*?)<\/hp:script>/g)].map((m) => m[1]),
        };
      });
      return { paras: out, warnings: w.report.warnings };
    }, [templateB64, { ...PROBLEM, units: pyEmit.units, ptsAt: pyEmit.ptsAt }]);
  } finally { await browser2.close(); }
}

let efails = 0;
const pp = pyEmit.paras, jp = jsEmit.paras;
if (pp.length !== jp.length) {
  console.log(`  ❌ 문단 개수 — 파이썬 ${pp.length} · JS ${jp.length}`);
  efails++;
}
/* ⚠️ 문단이 몇 개는 나와야 한다 — 둘 다 0 이면 "같다" 로 통과해 아무것도 검사하지 않는다. */
if (pp.length < 5) { console.log(`  ❌ 문단이 ${pp.length}개뿐입니다 — 이 검사가 헛돌고 있습니다`); efails++; }
for (let i = 0; i < Math.min(pp.length, jp.length); i++) {
  const a = canon(pp[i]), b = canon(jp[i]);
  if (a === b) continue;
  console.log(`  ❌ 문단 ${i}\n      파이썬 ${a.slice(0, 220)}\n      JS     ${b.slice(0, 220)}`);
  efails++;
}
if (canon(pyEmit.warnings) !== canon(jsEmit.warnings)) {
  console.log(`  ❌ 경고 — 파이썬 ${canon(pyEmit.warnings)} · JS ${canon(jsEmit.warnings)}`);
  efails++;
}

if (efails) { console.log(`\n문항 방출이 갈라졌습니다 — ${efails}건`); process.exit(1); }
console.log(`문항 방출 대조 통과 — 문단 ${pp.length}개가 파이썬과 같습니다`);
