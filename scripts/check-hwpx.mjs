/* 한글(HWPX) 내보내기 검사 모음 — 베타
 *
 * 변환기는 experiments/hwp-export/ 에 있고 제품이 아니다. 그런데 그 폴더의 파이썬 검사가
 * 어떤 실행 경로에도 걸려 있지 않아, 편집기 쪽 규칙이 바뀌어도 아무도 모르는 상태였다.
 * (`probUnits`·`buildPages`·`layoutOf` 를 옮겨 적은 사본이라 어긋나면 화면과 시험지가
 *  달라진다. 그걸 잡으라고 만든 검사가 정작 돌지 않고 있었다.)
 *
 * ⚠️ 의존성(lxml)은 제품 의존성이 아니라 `experiments/hwp-export/requirements.txt`
 *    에만 있다. 없는 환경(CI 기본, 남의 컴퓨터)에서 실패하면 안 되므로 **건너뛴다.**
 *    건너뛴 것과 통과한 것을 출력에서 구분해, '검사가 도는 줄 알았는데 안 돌던' 상태를
 *    만들지 않는다.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "..", "experiments", "hwp-export");

const TESTS = [
  "test_tex_to_hwp.py",   // LaTeX → HWP 수식 변환
  "test_layout.py",       // 편집기 buildPages/layoutOf 와 같은 규칙인지
  "test_image_paths.py",  // 그림 경로가 허용 폴더를 벗어나지 않는지
  "test_internal_runtime.py", // jakal-hwpx 없이 내부 엔진만으로 생성되는지
  "test_document_export.py",  // 범용 문서 JSON 검증·내부 HWPX 내보내기
  "test_document_endpoint.py", // 범용 문서 HWPX 로컬 엔드포인트·보안 관문
  "test_structure.py",    // 실물 문단 흐름(박스 앞뒤 여백 등)
  "test_sections.py",     // 공통·선택이 서로 다른 구역으로 갈리는지
  "test_page_layout.py",  // 번호 뒤 탭 · 쪽나눔 · 이어지는 쪽 머리말
  "test_endpoint.py",     // /hwpx 를 실제로 띄워 그림·보안 관문 확인
];

if (!existsSync(DIR)) {
  if (process.env.HWPX_REQUIRE === "1") {
    console.error("HWPX_REQUIRE=1 인데 experiments/hwp-export 가 없습니다");
    process.exit(1);
  }
  console.log("HWPX 실험 폴더가 없어 건너뜁니다 (experiments/hwp-export)");
  process.exit(0);
}

const python = process.env.HWPX_PYTHON || "python3";
// CI 처럼 '반드시 돌아야 하는' 자리에서는 건너뛰기를 실패로 본다. 건너뛰기가 통과로
// 보이면 이 파일이 막으려던 '도는 줄 알았는데 안 돌던' 상태가 그대로 재현된다.
const required = process.env.HWPX_REQUIRE === "1";
const probe = spawnSync(python, ["-c", "import lxml"], { encoding: "utf8" });
if (probe.status !== 0) {
  const how = "pip install -r experiments/hwp-export/requirements.txt";
  if (required) {
    console.error(`HWPX_REQUIRE=1 인데 lxml 이 없습니다 (설치: ${how})`);
    process.exit(1);
  }
  console.log(`lxml 이 없어 HWPX 검사를 건너뜁니다 (설치: ${how})`);
  process.exit(0);
}

let failed = 0;
const skipped = [];
for (const name of TESTS) {
  const file = path.join(DIR, name);
  if (!existsSync(file)) {
    console.log(`  - ${name}: 파일 없음 — 건너뜀`);
    if (required) failed++;          // 목록에 있는 검사가 사라지면 CI 는 실패로 본다
    continue;
  }
  const r = spawnSync(python, [file], { cwd: DIR, encoding: "utf8" });
  // ⚠️ 건너뛴 검사를 통과와 같은 ✅ 로 찍으면 정확히 이 파일이 막으려던 상태가 된다.
  //    사유를 둘로 나눈다 —
  //      2 = 저장소에 둘 수 없는 자료가 없어서(실물 틀은 저작물이라 커밋하지 않는다).
  //          CI 는 이걸 갖출 방법이 없으므로 실패로 보지 않되 눈에 띄게 찍는다.
  //      3 = 설치하거나 파일을 두면 돌 수 있는 것(의존성·표본). CI 에서는 실패다.
  if (r.status === 2 || r.status === 3) {
    const why = `${r.stdout || ""}`.trim().split("\n").pop() || "건너뜀";
    console.log(`  ⏭  ${name} — ${why}`);
    skipped.push(name);
    if (required && r.status === 3) failed++;
    continue;
  }
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}`);
  if (!ok) {
    const out = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-8);
    for (const line of out) console.log(`      ${line}`);
  }
}

if (failed) {
  console.error(`HWPX 검사 ${failed}건 실패`);
  process.exit(1);
}
console.log(`HWPX export tests passed — 실행 ${TESTS.length - skipped.length}건`
  + (skipped.length ? ` · 건너뜀 ${skipped.length}건 (${skipped.join(", ")})` : ""));
