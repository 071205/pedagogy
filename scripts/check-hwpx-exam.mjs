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
import dataclasses
print(json.dumps({"paras": out, "report": dataclasses.asdict(rep),
                  "units": units, "ptsAt": pts_at}, ensure_ascii=False))
`;

const PY_LAYOUT = `
import json, sys
sys.path.insert(0, "experiments/hwp-export")
import mock_to_hwpx as m
cases = json.loads(sys.argv[1])
out = {}
for name, probs in cases.items():
    out[name] = {
        "columnStarts": sorted(m.column_starts(probs)),
        "pageStarts": sorted(m.page_starts(probs)),
        "columnSlots": m.column_slots(probs),
        "slotTops": [round(m.slot_top_mm(i, 3, m.COL_H_FIRST_MM, 40.7), 4) for i in (0, 1, 2)],
        "padLines": [m.pad_lines(a, b, c) for a, b, c in
                     ((0, 168.5, 10.75), (100, 100, 10.75), (0, 5, 10.75), (0, 168.5, 0))],
    }
print(json.dumps(out, ensure_ascii=False))
`;

const PY_MARKS = `
import json, sys, re, dataclasses
sys.path.insert(0, "experiments/hwp-export")
from pathlib import Path
import mock_to_hwpx as m, template as tmpl
doc, roles = tmpl.open_template(Path(${JSON.stringify(TEMPLATE)}))
m.STYLE.clear(); m.CUR["sec"] = 0; m.OBJ_ID["n"] = 0
m.TMPL_MARKS.clear(); m.TMPL_MARKS.update(roles.get("_marks") or {})
for role, spec in roles.items():
    if role.startswith("_"): continue
    if "para" in spec: m.STYLE["para_" + role] = spec["para"]
    if "char" in spec: m.STYLE["char_" + role] = spec["char"]
    if "style" in spec: m.STYLE["style_" + role] = spec["style"]
def _tags(x):
    out = {}
    for mm in re.finditer(r"<(?:\\w+:)?(\\w+)[\\s/>]", x):
        out[mm.group(1)] = out.get(mm.group(1), 0) + 1
    return out

def _run_slot(doc):
    paras = [k for k in doc.get_part("Contents/section0.xml").root.children if k.local_name == "p"]
    p = paras[-1]
    p.insert_xml(len(p.children), '<hp:linesegarray xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"/>')
    m._add_run(p, m._run_wrap("0", "<hp:t>표시</hp:t>"))
    return ",".join(c.local_name for c in p.children)

rep = m.Report()
before = doc.paragraph_count(0)
m.emit_section_tag(doc, rep)
doc.append_paragraph("", section_index=0, para_pr_id=m.STYLE.get("para_stem"),
                     style_id=m._sty("para_stem"), char_pr_id=m.STYLE.get("char_stem"))
m.attach_note(doc, rep, doc.paragraph_count(0) - 1, lines=3, elective="기하")
m.emit_section_tag(doc, rep)
sec = doc.get_part("Contents/section0.xml")
paras = [k for k in sec.root.children if k.local_name == "p"][before:]
xml = "".join(p.to_xml() for p in paras)
print(json.dumps({
    "report": dataclasses.asdict(rep),
    "tblIds": re.findall(r'<hp:tbl[^>]*\\bid="(\\d+)"', xml),
    "zOrders": re.findall(r'<hp:tbl[^>]*\\bzOrder="(\\d+)"', xml),
    "elective": re.findall(r"선택과목\\(([^)<]*)\\)", xml),
    "childOrder": [",".join(c.local_name for c in p.children) for p in paras],
    "tblCount": len(re.findall(r"<hp:tbl\\b", xml)),
    "shape": [{"para": p.get_attr("paraPrIDRef"), "style": p.get_attr("styleIDRef"),
               "tags": _tags(p.to_xml())} for p in paras],
    "runSlot": _run_slot(doc),
}, ensure_ascii=False))
`;

const PY_BUILD = `
import json, sys, re, dataclasses, tempfile, os
sys.path.insert(0, "experiments/hwp-export")
from pathlib import Path
import mock_to_hwpx as m
data = json.loads(sys.argv[1])
tmpdir = tempfile.mkdtemp()
out = Path(tmpdir) / "exam.hwpx"
rep = m.build(data, out, ref=${JSON.stringify(TEMPLATE)})
keep = os.environ.get("HWPX_EXAM_OUT")
if keep:
    os.makedirs(keep, exist_ok=True)
    import shutil; shutil.copy(out, os.path.join(keep, "python-exam.hwpx"))
import zipfile
from lxml import etree
z = zipfile.ZipFile(out)
def tags(x):
    o = {}
    for mm in re.finditer(r"<(?:\\w+:)?(\\w+)[\\s/>]", x):
        o[mm.group(1)] = o.get(mm.group(1), 0) + 1
    return o
HPNS = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"
sections = {}
for i in (0, 1):
    name = f"Contents/section{i}.xml"
    if name not in z.namelist():
        sections[str(i)] = []
        continue
    root = etree.fromstring(z.read(name))
    rows = []
    for p in root:
        if not str(p.tag).endswith("}p"): continue
        x = etree.tostring(p, encoding="unicode")
        text = "".join(re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", x, re.S))
        rows.append({
            "para": p.get("paraPrIDRef"), "style": p.get("styleIDRef"),
            "pageBreak": p.get("pageBreak"), "columnBreak": p.get("columnBreak"),
            "tags": tags(x), "text": re.sub(r"<[^>]+>", "", text),
            "tabs": re.findall(r'<hp:tab width="(\\d+)"', x),
            "scripts": re.findall(r"<hp:script[^>]*>(.*?)</hp:script>", x, re.S),
        })
    sections[str(i)] = rows
units = []
for p in data.get("problems") or []:
    u, at = m.prob_units(p)
    units.append({"units": u, "ptsAt": at})
print(json.dumps({"report": dataclasses.asdict(rep), "sections": sections, "units": units}, ensure_ascii=False))
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
      return { paras: out, report: w.report };
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
/* ⚠️ 경고만이 아니라 **집계 전체**를 견준다. 한쪽에만 있는 칸이나 안 세는 칸은
   조용히 갈라진다(`choice_rows` 가 실제로 JS 에만 빠져 있었다). */
if (canon(pyEmit.report) !== canon(jsEmit.report)) {
  console.log(`  ❌ 집계 — 파이썬 ${canon(pyEmit.report)}\n           JS     ${canon(jsEmit.report)}`);
  efails++;
}

if (efails) { console.log(`\n문항 방출이 갈라졌습니다 — ${efails}건`); process.exit(1); }
console.log(`문항 방출 대조 통과 — 문단 ${pp.length}개가 파이썬과 같습니다`);

/* ── 4단계: 문항 배치 대조 ────────────────────────────────────────────────
   ⚠️ 이 규칙은 편집기 `buildPages()` 의 것이다. 파이썬도 JS 도 그 사본을 안고 있으므로
   둘이 갈라지면 화면 미리보기와 실제 시험지가 어긋난다. 표본은 **실제로 갈라질 수 있는
   자리**를 고른다 — 단이 꽉 차는 곳, `breakAfter`, 과목 구분이 바뀌는 곳, 그리고 그
   셋이 겹치는 곳. 규칙이 같으면 지루한 표본으로도 통과하므로 그런 것은 안 넣는다. */
const LAYOUT_CASES = {
  "평범": Array.from({ length: 7 }, (_, i) => ({ sect: "common" })),
  /* ⚠️ `breakAfter` 는 **PER_COL 경계와 어긋난 자리**에 둔다. 경계와 겹치면 그 규칙을
     통째로 지워도 결과가 같아 깨보기가 통과한다(실제로 그랬다). */
  "단 끊기": [{ sect: "c", breakAfter: true }, { sect: "c" }, { sect: "c" }, { sect: "c" }, { sect: "c" }],
  "과목 바뀜": [{ sect: "c" }, { sect: "c" }, { sect: "c" }, { sect: "e" }, { sect: "e" }, { sect: "e" }],
  "첫 문항에서 바뀜": [{ sect: "c" }, { sect: "e" }, { sect: "e" }, { sect: "e" }],
  "끊기와 바뀜이 겹침": [{ sect: "c" }, { sect: "c", breakAfter: true }, { sect: "e" }, { sect: "e" },
                    { sect: "e", breakAfter: true }, { sect: "e" }],
  "문항 하나": [{ sect: "c" }],
  "빈 시험지": [],
};

let pyLayout;
try {
  pyLayout = JSON.parse(execFileSync("python3", ["-c", PY_LAYOUT, JSON.stringify(LAYOUT_CASES)],
                                     { cwd: ROOT, encoding: "utf8" }));
} catch (e) {
  console.log("배치 대조를 건너뜁니다 — 파이썬 쪽 실패: "
    + String(e.stderr || e.message).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 160));
  process.exit(REQUIRE ? 1 : 0);
}

const jsLayout = {};
{
  const browser3 = await chromium.launch();
  try {
    const page = await browser3.newPage();
    await page.setContent("<!doctype html><meta charset=utf-8><title>배치 대조</title>");
    await page.addScriptTag({ path: join(ROOT, "hwpx-engine.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam.js") });
    Object.assign(jsLayout, await page.evaluate((cases) => {
      const E = window.PedagogyExam;
      const out = {};
      for (const [name, probs] of Object.entries(cases)) {
        out[name] = {
          columnStarts: [...E.columnStarts(probs)].sort((a, b) => a - b),
          pageStarts: [...E.pageStarts(probs)].sort((a, b) => a - b),
          columnSlots: E.columnSlots(probs),
          /* 자리·빈 문단 수는 순수 계산이므로 대표값 몇 개만 견준다. */
          slotTops: [0, 1, 2].map((i) => +E.slotTopMm(i, 3, E.COL_H_FIRST_MM, 40.7).toFixed(4)),
          padLines: [[0, 168.5, 10.75], [100, 100, 10.75], [0, 5, 10.75], [0, 168.5, 0]]
            .map(([a, b, c]) => E.padLines(a, b, c)),
        };
      }
      return out;
    }, LAYOUT_CASES));
  } finally { await browser3.close(); }
}

let lfails = 0;
for (const name of Object.keys(LAYOUT_CASES)) {
  const a = canon(pyLayout[name]), b = canon(jsLayout[name]);
  if (a === b) continue;
  console.log(`  ❌ ${name}\n      파이썬 ${a.slice(0, 240)}\n      JS     ${b.slice(0, 240)}`);
  lfails++;
}
/* ⚠️ 표본이 실제로 단·쪽을 나누는지 확인한다 — 전부 빈 답이면 '같다' 로 통과한다. */
const splits = Object.values(pyLayout).reduce((n, v) => n + v.columnStarts.length + v.pageStarts.length, 0);
if (splits < 8) { console.log(`  ❌ 표본이 단·쪽을 ${splits}번밖에 안 나눕니다 — 이 검사가 헛돌고 있습니다`); lfails++; }

if (lfails) { console.log(`\n문항 배치가 갈라졌습니다 — ${lfails}건`); process.exit(1); }
console.log(`문항 배치 대조 통과 — 표본 ${Object.keys(LAYOUT_CASES).length}종이 파이썬과 같습니다`);

/* ── 5단계: 구획 태그 · ※ 확인 사항 대조 ────────────────────────────────────
   ⚠️ 이 둘은 문단이 아니라 **틀에서 떠 온 표 개체**다. 크기·테두리를 지어내면 안 되고,
   심을 때마다 개체 id 를 새로 매겨야 한다(같은 id 가 둘이면 한글이 문서를 이상하게 읽는다).
   그래서 **id 가 실제로 달라지는지**까지 본다. */
let pyMarks;
try {
  pyMarks = JSON.parse(execFileSync("python3", ["-c", PY_MARKS], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 << 20 }));
} catch (e) {
  console.log("표 개체 대조를 건너뜁니다 — 파이썬 쪽 실패: "
    + String(e.stderr || e.message).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 160));
  process.exit(REQUIRE ? 1 : 0);
}

let jsMarks;
{
  const browser4 = await chromium.launch();
  try {
    const page = await browser4.newPage();
    await page.setContent("<!doctype html><meta charset=utf-8><title>표 개체 대조</title>");
    await page.addScriptTag({ path: join(ROOT, "hwpx-engine.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam-template.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam.js") });
    jsMarks = await page.evaluate(async (b64) => {
      const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const { doc, roles } = await window.PedagogyExamTemplate.openTemplate(bytes.buffer);
      const w = new window.PedagogyExam.ExamWriter(doc, roles);
      const before = doc.paragraphCount(0);
      w.sectionTag(null);                                   // 새 문단에 태그를 심는다
      w.para("", { para: "para_stem", char: "char_stem" }); // 상자를 매달 문단
      w.attachNote(doc.paragraphCount(0) - 1, { lines: 3, elective: "기하" });
      w.sectionTag(null);                                   // 두 번째 — id 가 달라야 한다
      const ser = new XMLSerializer();
      const paras = doc.paragraphs(0).slice(before);
      const xml = paras.map((p) => ser.serializeToString(p)).join("");
      return {
        report: w.report,
        tblIds: [...xml.matchAll(/<hp:tbl[^>]*\bid="(\d+)"/g)].map((m) => m[1]),
        zOrders: [...xml.matchAll(/<hp:tbl[^>]*\bzOrder="(\d+)"/g)].map((m) => m[1]),
        elective: [...xml.matchAll(/선택과목\(([^)<]*)\)/g)].map((m) => m[1]),
        /* run 이 `linesegarray` **앞**에 들어갔는지 — 뒤로 가면 순서가 어긋난다. */
        childOrder: paras.map((p) => [...p.children].map((c) => c.localName).join(",")),
        tblCount: (xml.match(/<hp:tbl\b/g) || []).length,
        /* ⚠️ 얕은 지문은 거짓말한다 — 표 뒤 빈 `<hp:t/>` 를 빼도 위 항목은 전부 같았다.
           문단마다 태그 개수를 세어 그런 한 조각까지 보이게 한다. */
        shape: paras.map((p) => {
          const one = ser.serializeToString(p);
          const tags = {};
          for (const m of one.matchAll(/<(?:\w+:)?(\w+)[\s/>]/g)) tags[m[1]] = (tags[m[1]] || 0) + 1;
          return { para: p.getAttribute("paraPrIDRef"), style: p.getAttribute("styleIDRef"), tags };
        }),
        /* run 자리 규칙을 **직접** 본다. 위 `childOrder` 로는 못 잡는다 — 새로 만든 문단에는
           `linesegarray` 가 없어 붙이든 끼우든 결과가 같기 때문이다(깨보기가 통과했다). */
        runSlot: (() => {
          const p = doc.paragraphs(0)[doc.paragraphCount(0) - 1];
          p.appendChild(p.ownerDocument.createElementNS(
            "http://www.hancom.co.kr/hwpml/2011/paragraph", "hp:linesegarray"));
          w.addRun(p, "0", "<hp:t>표시</hp:t>");
          return [...p.children].map((c) => c.localName).join(",");
        })(),
      };
    }, templateB64);
  } finally { await browser4.close(); }
}

let mfails = 0;
for (const key of ["report", "tblIds", "zOrders", "elective", "childOrder", "tblCount", "shape", "runSlot"]) {
  if (canon(pyMarks[key]) === canon(jsMarks[key])) continue;
  const A = canon(pyMarks[key]), B = canon(jsMarks[key]);
  let at = 0; while (at < A.length && A[at] === B[at]) at++;   // 처음 갈라지는 자리부터 보여 준다
  const from = Math.max(0, at - 60);
  console.log(`  ❌ ${key} (${at}번째 글자부터)\n      파이썬 …${A.slice(from, at + 160)}\n      JS     …${B.slice(from, at + 160)}`);
  mfails++;
}
/* ⚠️ 표가 실제로 심어져야 한다 — 하나도 안 심으면 빈 값끼리 '같다' 로 통과한다. */
if (pyMarks.tblCount < 3) { console.log(`  ❌ 표가 ${pyMarks.tblCount}개뿐입니다 — 이 검사가 헛돌고 있습니다`); mfails++; }
if (new Set(pyMarks.tblIds).size !== pyMarks.tblIds.length) {
  console.log(`  ❌ 개체 id 가 겹칩니다: ${pyMarks.tblIds.join(",")}`); mfails++;
}

if (mfails) { console.log(`\n표 개체가 갈라졌습니다 — ${mfails}건`); process.exit(1); }
console.log(`표 개체 대조 통과 — 표 ${pyMarks.tblCount}개·개체 id 가 파이썬과 같습니다`);

/* ── 6단계: 시험지 한 부 대조 ─────────────────────────────────────────────
   앞의 조각 검사들이 다 통과해도 **조립이 틀리면** 시험지가 깨진다 — 구역 배정,
   쪽나눔·단나눔 자리, 이어지는 쪽 머리말, 벌린 줄 수, 선택과목 이름. 그래서 같은
   payload 를 양쪽에 넣고 **완성된 section XML 을 통째로** 견준다. */
/* ⚠️ **여기서 못 보는 것 하나** — `framed` 를 구역별이 아니라 묶음별로 세는 결함은 이
   표본으로 못 잡는다. 그 결함은 **두 묶음이 같은 구역으로 갈 때만** 드러나는데(구역이
   하나뿐인 틀), 저장소의 틀에는 구역이 둘이라 그 상황을 만들 수 없다. 실제로 깨보기가
   통과했다 — 검사가 옳아서가 아니라 표본이 거기 닿지 못해서다. */
const stmt = (t) => ({ type: "statement", data: { text: t } });
const ch = (items) => ({ type: "choices", data: { items } });
const EXAM = {
  round: "2026 대비 9월 모의고사", elective: "기하",
  problems: [
    { num: 1, sect: "공통", type: "choice", pts: 2, layoutResolved: "1", heightMm: 60,
      blocks: [stmt("함수 $f(x)=2x+1$ 의 값은?"), ch(["$1$", "$2$", "$3$", "$4$", "$5$"])] },
    { num: 2, sect: "공통", type: "choice", pts: 3, layoutResolved: "2", heightMm: 80,
      blocks: [stmt("다음을 구하시오.\n$\\lim_{x\\to0}\\frac{\\sin x}{x}$"),
               { type: "conditions", data: { items: ["(가) $a_1=1$", "$a_{n+1}=a_n+2$"] } },
               ch(["$1$", "$2$", "$3$", "$4$", "$5$"])] },
    { num: 3, sect: "공통", type: "choice", pts: 4, layoutResolved: "v", heightMm: 120, breakAfter: true,
      blocks: [stmt("보기에서 옳은 것만 고른 것은?"),
               { type: "examples", data: { items: ["$p$ 는 소수이다.", "$q$ 는 짝수이다."] } },
               ch(["ㄱ", "ㄴ", "ㄱ, ㄴ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"])] },
    /* ⚠️ 단답형이 섞여야 구획 태그가 들어간다.
       ⚠️ `heightMm` 은 아무 값이나 쓰면 안 된다 — 70 으로 두었더니 태그 높이(15.92mm)를
          단 위 여백에 더하든 말든 **반올림 뒤 빈 문단 수가 같아** 깨보기가 통과했다.
          65 는 그 경계를 넘는 값이다(7줄 ↔ 8줄). */
    { num: 4, sect: "공통", type: "short", pts: 3, heightMm: 65,
      blocks: [stmt("$f(3)$ 의 값을 구하시오.")] },
    { num: 5, sect: "공통", type: "short", pts: 4, heightMm: 70,
      blocks: [stmt("$g(2)$ 의 값을 구하시오.")] },
    /* ⚠️ 선택과목 — 구역 1 로 가야 한다. 여기가 안 갈리면 머리말·쪽번호가 통째로 틀린다. */
    { num: 23, sect: "선택", type: "choice", pts: 2, layoutResolved: "1", heightMm: 60,
      blocks: [stmt("확률변수 $X$ 의 평균은?"), ch(["$1$", "$2$", "$3$", "$4$", "$5$"])] },
    { num: 24, sect: "선택", type: "short", pts: 4, heightMm: 90,
      blocks: [stmt("$E(X)$ 를 구하시오.")] },
    /* ⚠️ 발문이 없어 시험지에서 빠져야 하는 문항 */
    { num: 25, sect: "선택", type: "choice", layoutResolved: "1",
      blocks: [ch(["$1$", "$2$", "$3$", "$4$", "$5$"])] },
  ],
};

let pyExam;
try {
  pyExam = JSON.parse(execFileSync("python3", ["-c", PY_BUILD, JSON.stringify(EXAM)],
                                   { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }));
} catch (e) {
  console.log("시험지 대조를 건너뜁니다 — 파이썬 쪽 실패: "
    + String(e.stderr || e.message).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 200));
  process.exit(REQUIRE ? 1 : 0);
}

let jsExam;
{
  const browser5 = await chromium.launch();
  try {
    const page = await browser5.newPage();
    await page.setContent("<!doctype html><meta charset=utf-8><title>시험지 대조</title>");
    await page.addScriptTag({ path: join(ROOT, "hwpx-engine.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam-template.js") });
    await page.addScriptTag({ path: join(ROOT, "hwpx-exam.js") });
    jsExam = await page.evaluate(async ([b64, exam]) => {
      const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const { doc, roles } = await window.PedagogyExamTemplate.openTemplate(bytes.buffer);
      const { blob, report } = await window.PedagogyExam.buildExam(doc, roles, exam);
      const raw = new Uint8Array(await blob.arrayBuffer());
      let rb = ""; for (let i = 0; i < raw.length; i++) rb += String.fromCharCode(raw[i]);
      const ser = new XMLSerializer();
      const out = { report, sections: {}, b64: btoa(rb) };
      for (const i of [0, 1]) {
        const paras = doc.paragraphs(i);
        out.sections[i] = paras.map((p) => {
          const xml = ser.serializeToString(p);
          const tags = {};
          for (const m of xml.matchAll(/<(?:\w+:)?(\w+)[\s/>]/g)) tags[m[1]] = (tags[m[1]] || 0) + 1;
          return {
            para: p.getAttribute("paraPrIDRef"), style: p.getAttribute("styleIDRef"),
            pageBreak: p.getAttribute("pageBreak"), columnBreak: p.getAttribute("columnBreak"),
            tags,
            text: [...xml.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g)]
              .map((m) => m[1]).join("").replace(/<[^>]+>/g, ""),
            tabs: [...xml.matchAll(/<hp:tab width="(\d+)"/g)].map((m) => m[1]),
            scripts: [...xml.matchAll(/<hp:script[^>]*>([\s\S]*?)<\/hp:script>/g)].map((m) => m[1]),
          };
        });
      }
      return out;
    }, [templateB64, { ...EXAM, problems: EXAM.problems.map((p, i) => ({
          ...p, units: pyExam.units[i].units, ptsAt: pyExam.units[i].ptsAt })) }]);
  } finally { await browser5.close(); }
}

/* ⚠️ 검사가 초록불이어도 **한글이 열어 주는가**는 다른 질문이다(이 저장소가 두 번 겪었다).
   `HWPX_EXAM_OUT=폴더` 로 두 파일을 남겨 `npm run test:hwpx-opens` 로 확인한다 —
   파이썬 것과 **같은 실행에서** 함께 열어야 한글이 이상한 상태인지 가릴 수 있다. */
if (process.env.HWPX_EXAM_OUT) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(process.env.HWPX_EXAM_OUT, { recursive: true });
  writeFileSync(join(process.env.HWPX_EXAM_OUT, "browser-exam.hwpx"), Buffer.from(jsExam.b64, "base64"));
  console.log(`      → ${process.env.HWPX_EXAM_OUT}/browser-exam.hwpx · python-exam.hwpx`);
}
delete jsExam.b64;

let bfails = 0;
if (canon(pyExam.report) !== canon(jsExam.report)) {
  console.log(`  ❌ 집계\n      파이썬 ${canon(pyExam.report)}\n      JS     ${canon(jsExam.report)}`);
  bfails++;
}
for (const i of ["0", "1"]) {
  const P = pyExam.sections[i] || [], J = jsExam.sections[i] || [];
  if (P.length !== J.length) { console.log(`  ❌ 구역 ${i} 문단 수 — 파이썬 ${P.length} · JS ${J.length}`); bfails++; }
  for (let k = 0; k < Math.min(P.length, J.length); k++) {
    const A = canon(P[k]), B = canon(J[k]);
    if (A === B) continue;
    let at = 0; while (at < A.length && A[at] === B[at]) at++;
    console.log(`  ❌ 구역 ${i} 문단 ${k}\n      파이썬 …${A.slice(Math.max(0, at - 50), at + 150)}\n      JS     …${B.slice(Math.max(0, at - 50), at + 150)}`);
    bfails++;
    if (bfails > 6) break;
  }
}
/* ⚠️ 조립이 실제로 일어나야 한다 — 쪽나눔·단나눔·태그·상자가 하나도 없으면
   빈 문서끼리 '같다' 로 통과한다. */
const r = pyExam.report;
for (const [name, v] of [["문항", r.problems], ["쪽나눔", r.pages], ["단나눔", r.breaks],
                         ["구획 태그", r.tags], ["확인 사항", r.notes]]) {
  if (!v) { console.log(`  ❌ ${name}이 0입니다 — 이 검사가 헛돌고 있습니다`); bfails++; }
}
if (r.problems !== 7) { console.log(`  ❌ 발문 없는 문항이 안 걸러졌습니다 — 문항 ${r.problems}개(7 이어야 한다)`); bfails++; }

if (bfails) { console.log(`\n시험지가 갈라졌습니다 — ${bfails}건`); process.exit(1); }
console.log(`시험지 한 부 대조 통과 — 문항 ${r.problems}개·쪽나눔 ${r.pages}회가 파이썬과 같습니다`);
