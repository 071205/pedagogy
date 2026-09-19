#!/usr/bin/env node
/* 지금 여는 파일에 **짝**이 있으면 그 자리에서 이름을 댄다 (PreToolUse · Edit|Write).
 *
 * 이 저장소가 반복한 실패 둘이 이 훅의 이유다 —
 *   · **한 곳만 고쳤다**: 계약만 넓히고 Worker·브라우저를 두면 기능이 사용자에게 도달하지 못한다.
 *   · **베낀 것은 갈라진다**: 파이썬↔JS 두 조판기, 두 화면의 CSS, 편집기와 변환기의 규칙.
 *
 * ⚠️ **막지 않는다. 알릴 뿐이다.** 실제 방어선은 검사(`check:static`·`test:hwpx-browser` 등)이고,
 *    이 훅은 그 빨간불을 **편집하는 순간으로 앞당기는 것**뿐이다. 막는 훅은 작업을 방해하고,
 *    무엇보다 '검사가 판정한다' 는 이 저장소의 방식과 어긋난다.
 * ⚠️ **어떤 경우에도 exit 0 이다.** 편의 기능 하나가 본체를 멈추면 안 된다(`REV-2026-023` 의 교훈).
 *
 *   node .claude/hooks/pair-guard.mjs --selftest   # 표에 적힌 경로가 실제로 있는가
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* 짝 표. **여기가 유일한 자리다** — 늘리려면 여기에만 더한다.
   `why` 는 한 줄로 쓴다. 길면 아무도 안 읽는다. */
const PAIRS = [
  { file: "experiments/hwp-export/pedagogy_hwpx.py", with: ["hwpx-engine.js"],
    why: "HWPX 엔진의 파이썬↔JS 사본 · test:hwpx-browser 가 대조한다" },
  { file: "hwpx-engine.js", with: ["experiments/hwp-export/pedagogy_hwpx.py"],
    why: "HWPX 엔진의 파이썬↔JS 사본 · test:hwpx-browser 가 대조한다" },

  { file: "experiments/hwp-export/document_to_hwpx.py", with: ["hwpx-document.js"],
    why: "블록→문단 사본 · test:hwpx-browser 가 대조한다" },
  { file: "hwpx-document.js", with: ["experiments/hwp-export/document_to_hwpx.py"],
    why: "블록→문단 사본 · test:hwpx-browser 가 대조한다" },

  { file: "experiments/hwp-export/mock_to_hwpx.py", with: ["hwpx-exam.js", "hwpx-exam-template.js"],
    why: "시험지 조판 사본 · test:hwpx-exam 이 section XML 을 통째로 견준다" },
  { file: "hwpx-exam.js", with: ["experiments/hwp-export/mock_to_hwpx.py"],
    why: "시험지 조판 사본 · test:hwpx-exam 이 section XML 을 통째로 견준다" },
  { file: "hwpx-exam-template.js", with: ["experiments/hwp-export/template.py"],
    why: "틀 읽기 사본 · test:hwpx-exam 이 역할 22값을 견준다" },

  { file: "experiments/hwp-export/tex_to_hwp.py", with: ["hwpx-engine.js"],
    why: "수식 변환 규칙이 양쪽에 있다(`_has_base` ↔ `hasBase` 처럼)" },

  { file: "experiments/hwp-export/document_schema.py",
    with: ["document-editor.html", "worker/index.js"],
    why: "문서 계약은 **다섯 경계**다 — 계약·Worker 프롬프트·Worker 검증·브라우저 validate()·render()" },
  { file: "document-editor.html", with: ["index.html", "experiments/hwp-export/document_schema.py"],
    why: "index 와 디자인 토큰·PM_THEME·authErrorMessage·인앱 목록을 공유 · validate() 와 render() 는 서로 다른 경계다" },
  { file: "index.html", with: ["document-editor.html", "firestore.rules"],
    why: "두 화면의 토큰·인앱 목록이 갈라진다 · sets 문서에 필드를 더하면 Rules 의 hasOnly 도 함께" },

  { file: "mock-library-store.js", with: ["firestore.rules"],
    why: "mockToDoc·tombstone·Rules 세 곳을 check:static 이 대조한다" },
  { file: "firestore.rules", with: ["index.html", "mock-library-store.js"],
    why: "필드 화이트리스트(hasOnly)가 저장 경로와 맞아야 한다 — 어긋나면 전부 '권한 오류'" },

  { file: "scripts/exam-style-roles.mjs",
    with: ["experiments/hwp-export/template.py", "experiments/hwp-export/mock_to_hwpx.py"],
    why: "조판 값의 정답표 · 코드만 고치면 check:static 이 빨간불을 낸다" },

  { file: "worker/index.js", with: ["worker/wrangler.toml", "worker/wrangler.staging.toml"],
    why: "새 환경 변수·provider 분기는 배포 설정과 짝이다 — production 에 AI_PROVIDER 를 넣지 말 것" },

  { file: "serve.py", with: [],
    why: "새 최상위 파일(.js·.hwpx·템플릿)을 만들면 STATIC 목록에 더해야 한다 — 빼먹으면 404" },

  { file: "experiments/hwp-export/templates/blank.hwpx", with: ["blank-template-data.js"],
    why: "file:// 용 인라인본 · node scripts/build-hwpx-templates.mjs 로 다시 만든다" },
  { file: "experiments/hwp-export/templates/exam-math.hwpx", with: ["exam-template-data.js"],
    why: "file:// 용 인라인본 · node scripts/build-hwpx-templates.mjs 로 다시 만든다" },
];

function selftest() {
  const missing = [];
  for (const row of PAIRS) {
    for (const p of [row.file, ...row.with]) {
      if (!existsSync(resolve(ROOT, p))) missing.push(p);
    }
  }
  if (missing.length) {
    console.error("짝 표에 없는 경로가 있습니다 (옮겼거나 이름이 바뀌었습니다):");
    for (const p of [...new Set(missing)].sort()) console.error("  ❌ " + p);
    console.error("\n.claude/hooks/pair-guard.mjs 의 PAIRS 를 고치세요.");
    process.exit(1);
  }
  console.log(`짝 표 확인 — ${PAIRS.length}줄, 경로 전부 존재`);
}

if (process.argv.includes("--selftest")) { selftest(); process.exit(0); }

/* ── 훅 본체 ─────────────────────────────────────────────────────────── */
let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  process.exit(0);           // 표준입력이 없으면 할 말도 없다
}

let target = "";
try {
  const payload = JSON.parse(input);
  target = payload?.tool_input?.file_path || payload?.tool_input?.filePath || "";
} catch {
  process.exit(0);
}
if (!target) process.exit(0);

let rel;
try {
  rel = relative(ROOT, resolve(target));
} catch {
  process.exit(0);
}
if (!rel || rel.startsWith("..")) process.exit(0);   // 저장소 밖은 우리 일이 아니다

const row = PAIRS.find((r) => r.file === rel);
if (!row) process.exit(0);

const lines = [`⚠️ ${rel} 에는 짝이 있습니다 — ${row.why}`];
if (row.with.length) lines.push(`   함께 볼 것: ${row.with.join(" · ")}`);
console.log(lines.join("\n"));
process.exit(0);
