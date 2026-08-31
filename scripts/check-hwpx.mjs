/* 한글(HWPX) 내보내기 검사 모음 — 베타
 *
 * 변환기는 experiments/hwp-export/ 에 있고 제품이 아니다. 그런데 그 폴더의 파이썬 검사가
 * 어떤 실행 경로에도 걸려 있지 않아, 편집기 쪽 규칙이 바뀌어도 아무도 모르는 상태였다.
 * (`probUnits`·`buildPages`·`layoutOf` 를 옮겨 적은 사본이라 어긋나면 화면과 시험지가
 *  달라진다. 그걸 잡으라고 만든 검사가 정작 돌지 않고 있었다.)
 *
 * ⚠️ 의존성(jakal-hwpx)은 제품 의존성이 아니라 `experiments/hwp-export/requirements.txt`
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
  "test_structure.py",    // 실물 문단 흐름(박스 앞뒤 여백 등)
  "test_endpoint.py",     // /hwpx 를 실제로 띄워 그림·보안 관문 확인
];

if (!existsSync(DIR)) {
  console.log("HWPX 실험 폴더가 없어 건너뜁니다 (experiments/hwp-export)");
  process.exit(0);
}

const python = process.env.HWPX_PYTHON || "python3";
const probe = spawnSync(python, ["-c", "import jakal_hwpx"], { encoding: "utf8" });
if (probe.status !== 0) {
  console.log("jakal-hwpx 가 없어 HWPX 검사를 건너뜁니다 "
    + "(설치: pip install -r experiments/hwp-export/requirements.txt)");
  process.exit(0);
}

let failed = 0;
for (const name of TESTS) {
  const file = path.join(DIR, name);
  if (!existsSync(file)) {
    console.log(`  - ${name}: 파일 없음 — 건너뜀`);
    continue;
  }
  const r = spawnSync(python, [file], { cwd: DIR, encoding: "utf8" });
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
console.log("HWPX export tests passed");
