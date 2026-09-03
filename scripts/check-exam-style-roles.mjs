/* 조판 역할 표 대조 — 1층 (베타 · `docs/MOCK-STYLE-DESIGN.md` 6단계)
 *
 * `scripts/exam-style-roles.mjs` 의 표를 기준으로
 *   · 파이썬 `template.STYLE_NAMES` 의 역할·이름 목록
 *   · 편집기 CSS 와 Typst 틀의 조판 값
 * 이 어긋나지 않았는지 본다. **틀 파일도 파이썬도 브라우저도 필요 없다** — 원문을 읽어
 * 맞춰 보기만 하므로 CI 에서 항상 돈다.
 *
 * 표가 실물과 같은지는 이 검사가 답하지 않는다. 그건 틀이 있어야 하므로
 * `experiments/hwp-export/test_style_roles.py` 가 맡는다(2층).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MARK_OBJECTS, METRICS, NAMED_ROLES, ROLES, USAGE_ROLES, pluck }
  from "./exam-style-roles.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const editor = await readFile(join(root, "mock-exam-editor.html"), "utf8");
const templatePy = await readFile(join(root, "experiments", "hwp-export", "template.py"), "utf8");
const converterPy = await readFile(join(root, "experiments", "hwp-export", "mock_to_hwpx.py"), "utf8");

let failed = 0;
const fail = (msg) => { failed++; console.error(`  ❌ ${msg}`); };
const pass = (msg) => console.log(`  ✅ ${msg}`);

/* ── 1. 파이썬 STYLE_NAMES ↔ 표 ─────────────────────────────────────────── */
const block = templatePy.match(/STYLE_NAMES = \{[\s\S]*?\n\}/)?.[0];
if (!block) {
  fail("template.py 에서 STYLE_NAMES 를 찾지 못했습니다");
} else {
  const pyNames = {};
  for (const m of block.matchAll(/^\s*"(\w+)":\s*\[([^\]]*)\]/gm)) {
    pyNames[m[1]] = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  }
  const want = Object.keys(NAMED_ROLES).sort();
  const got = Object.keys(pyNames).sort();
  if (String(want) !== String(got)) {
    fail(`역할 목록이 다릅니다 — 표 [${want}] · template.py [${got}]`);
  } else {
    let same = true;
    for (const role of want) {
      if (String(NAMED_ROLES[role]) !== String(pyNames[role])) {
        same = false;
        fail(`'${role}' 의 스타일 이름이 다릅니다 — 표 [${NAMED_ROLES[role]}] `
           + `· template.py [${pyNames[role]}]`);
      }
    }
    if (same) pass(`역할 ↔ 실물 스타일 이름 ${want.length}종이 template.py 와 같습니다`);
  }
  // 이름으로 찾으면 **틀리는** 역할이 STYLE_NAMES 에 남아 있으면 안 된다.
  // (`figure` 가 실제로 그랬다 — 실물이 쓰지 않는 `보기` 를 가리키고 있었다. §8-④)
  const strays = USAGE_ROLES.filter((r) => r in pyNames);
  if (strays.length) {
    fail(`쓰임으로 찾아야 하는 역할이 STYLE_NAMES 에 남아 있습니다: ${strays} `
       + "— 이름이 그럴듯해도 실물이 쓰지 않으면 틀린 답입니다");
  } else {
    pass(`쓰임으로 찾는 역할 ${USAGE_ROLES.length}종이 이름 목록에 섞이지 않았습니다`);
  }
}

/* ── 2. 쓰임으로 찾는 역할이 실제로 투표 대상인가 ────────────────────────── */
/* ⚠️ 함정 둘을 다 피해야 한다.
   · `[^}]*` 로 잡으면 값이 `Counter()` 라 그 안의 `}` 에서 먼저 끊긴다.
   · `votes` 는 `read_roles()` 에도 있다 — 함수를 먼저 잘라내지 않으면 그쪽(stem·choice·
     cont)을 읽고 "figure 를 안 찾는다" 고 헛소리를 한다. 둘 다 실제로 겪었다. */
const byUsage = templatePy.match(/def read_roles_by_usage[\s\S]*?\n    return out/)?.[0] ?? "";
const votes = byUsage.match(/votes: dict\[str, Counter\] = \{(.*)\}/)?.[1] ?? "";
const voted = [...votes.matchAll(/"(\w+)":/g)].map((m) => m[1]);
const missing = USAGE_ROLES.filter((r) => !voted.includes(r));
if (missing.length) {
  fail(`read_roles_by_usage() 가 ${missing} 를 찾지 않습니다 — 표에는 쓰임으로 찾는다고 적혀 있습니다`);
} else {
  pass(`read_roles_by_usage() 가 ${USAGE_ROLES.join("·")} 를 찾습니다`);
}

/* ── 3. 변환기가 쓰는 역할이 표에 다 있는가 ──────────────────────────────── */
/* 새 역할을 만들면서 표에 적지 않으면 여기서 걸린다. `para_ch`(부분 문자열)처럼
   실제 역할이 아닌 조각은 제외한다. */
const used = new Set([...converterPy.matchAll(/\bpara_([a-z0-9]+)\b/g)].map((m) => m[1]));
for (const skip of ["pr", "idx", "ch"]) used.delete(skip);   // 함수 인자·지역 변수 이름
const unknown = [...used].filter((r) => !(r in ROLES));
if (unknown.length) {
  fail(`변환기가 쓰는 역할이 표에 없습니다: ${unknown} — exam-style-roles.mjs 에 적어야 합니다`);
} else {
  pass(`변환기가 쓰는 역할 ${used.size}종이 모두 표에 있습니다`);
}

/* ── 4. 편집기 CSS ↔ Typst ↔ 표 ─────────────────────────────────────────── */
const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.011);
for (const m of METRICS) {
  let css, typst;
  try {
    css = pluck(editor, m.css, `${m.key}(CSS)`);
    typst = pluck(editor, m.typst, `${m.key}(Typst)`);
  } catch (e) {
    fail(e.message);
    continue;
  }
  if (m.cssAdd) css = css.map((x) => +(x + m.cssAdd).toFixed(2));
  if (!near(css, m.value)) fail(`${m.key} — 화면 ${css} · 표 ${m.value}`);
  else if (!near(typst, m.value)) fail(`${m.key} — 정본 ${typst} · 표 ${m.value}`);
  else pass(`${m.key} = ${m.value.join(" · ")}mm (화면·정본·표 일치)`);

  // 실물과 일부러 다른 값은 **이유가 적혀 있어야** 한다. 안 적으면 그냥 어긋난 것이다.
  if (m.real && !near(m.real, m.value) && !m.why) {
    fail(`${m.key} 는 실물(${m.real})과 다른데 이유(why)가 적혀 있지 않습니다`);
  }
  /* 적어 둔 '실물 값' 이 표 개체 목록과 어긋나면 안 된다 — 그러면 어느 쪽이 실물인지
     알 수 없어진다. 실물 자체와의 대조는 test_style_roles.py(2층)가 한다. */
  if (m.realFrom) {
    const [group, name, dim] = m.realFrom.split(".");
    const obj = MARK_OBJECTS[`${group}.${name}`];
    if (!obj) fail(`${m.key} 의 realFrom '${m.realFrom}' 이 표 개체 목록에 없습니다`);
    else if (!m.real) fail(`${m.key} 에 realFrom 만 있고 real 값이 없습니다`);
    else if (Math.abs(obj[dim] - m.real[0]) > 0.011) {
      fail(`${m.key} 의 실물 값이 표 개체 목록과 다릅니다 — ${m.real[0]} vs ${obj[dim]}`);
    }
  }
}

/* ── 5. 선지 칸 폭이 실물 탭 정지점에서 나온 값인가 ──────────────────────── */
/* 탭 정지점은 실물에서 읽은 값이고(표의 `real.stops`), 칸 폭은 그 간격이다.
   둘 중 하나만 고치면 선지가 실물과 다른 자리에 놓인다. */
for (const m of METRICS.filter((x) => x.fromStops)) {
  const { role, left } = m.fromStops;
  const stops = ROLES[role]?.real?.stops;
  if (!stops) { fail(`${role} 의 탭 정지점이 표에 없습니다`); continue; }
  const widths = stops.map((s, i) => +(s - (i ? stops[i - 1] : left)).toFixed(2));
  if (!near(widths, m.value)) {
    fail(`${m.key} 가 실물 탭 정지점과 맞지 않습니다 — 탭 ${stops} → ${widths} · 표 ${m.value}`);
  } else {
    pass(`${m.key} 가 실물 탭 정지점 ${stops} 에서 나온 값입니다`);
  }
}

if (failed) {
  console.error(`조판 역할 표 대조 실패 ${failed}건`);
  process.exit(1);
}
console.log(`조판 역할 표 일치 — 역할 ${Object.keys(ROLES).length}종 · 값 ${METRICS.length}종`);
