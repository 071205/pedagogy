import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures = [
  ["01-math-formulas.json", "math-print"],
  ["02-korean-passage.json", "korean-passage-print"],
  ["03-image-storage.json", "image-print"],
  ["04-print-overflow.json", "overflow-print"],
];
const fixtureDir = join(root, "test-fixtures", "refactor-baseline");
const baselineDir = join(root, "test-fixtures", "visual-baseline");
const resultDir = join(root, "test-results", "visual");
const update = process.env.UPDATE_VISUAL_BASELINE === "1";
// 다른 OS의 글꼴 안티앨리어싱만 흡수한다. pixelmatch의 AA 제외와 웹 글꼴 고정 뒤에도
// 남는 허용 범위는 전체의 0.5%뿐이다. 문장·줄바꿈 같은 실제 인쇄 변화도 잡아낸다.
const MAX_DIFF_RATIO = Number(process.env.VISUAL_MAX_DIFF_RATIO ?? 0.005);
assert.ok(Number.isFinite(MAX_DIFF_RATIO) && MAX_DIFF_RATIO >= 0,
  "VISUAL_MAX_DIFF_RATIO는 0 이상의 숫자여야 합니다");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url, process) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (process.exitCode !== null) throw new Error(`로컬 서버가 일찍 종료됐습니다 (${process.exitCode})`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* 서버 준비 전 연결 거절은 재시도한다. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("시각 회귀 검사 서버 준비 시간 초과");
}

async function launchBrowser() {
  // CI와 같은 Playwright 고정 Chromium을 우선 쓴다. 개발자가 아직 브라우저를 설치하지
  // 않은 맥에서만 시스템 Chrome으로 한 번 대체해, 첫 기준본 생성을 막지는 않는다.
  try {
    return await chromium.launch();
  } catch (error) {
    if (process.platform !== "darwin" || process.env.CI) throw error;
    console.warn("Playwright Chromium이 없어 개발용 Chrome으로 대체합니다. CI 전에는 npm exec playwright install chromium을 실행하세요.");
    return chromium.launch({ channel: "chrome" });
  }
}

async function buildPrintablePage(page, file) {
  const raw = await readFile(join(fixtureDir, file));
  const set = JSON.parse(raw);
  await page.setInputFiles("#importAllInput", {
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([set])),
  });
  await page.waitForFunction((name) => Array.isArray(sets) && sets.some((item) => item.name === name), set.name);
  await page.evaluate(async (name) => {
    const set = sets.find((item) => item.name === name);
    if (!set) throw new Error("가져온 기준 문제집을 찾지 못했습니다");
    currentSetId = set.id;
    currentQId = set.problems[0]?.id || null;
    buildPrintDoc(false);
    if (typeof ensureKatexFonts === "function") await ensureKatexFonts();
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const print = document.querySelector("#printDoc");
    print.classList.add("measuring");
    void print.offsetHeight;
    const overflowed = fitPrintDoc();
    if (overflowed.length) throw new Error(`인쇄 칸 넘침 ${overflowed.length}건`);
    // off-screen measuring 상태의 요소를 Chromium이 viewport 전체로 잘못 캡처하는
    // 경우가 있어, 측정이 끝난 뒤에만 전용 캡처 위치로 옮긴다.
    print.classList.remove("measuring");
    print.classList.add("visual-capture");
  }, set.name);
  return page.locator("#printDoc .page").first();
}

function compare(actualBuffer, expectedBuffer, label) {
  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(expectedBuffer);
  assert.equal(actual.width, expected.width, `${label}: 기준본과 폭이 다릅니다`);
  assert.equal(actual.height, expected.height, `${label}: 기준본과 높이가 다릅니다`);
  const diff = new PNG({ width: actual.width, height: actual.height });
  const pixels = pixelmatch(expected.data, actual.data, diff.data, actual.width, actual.height, {
    threshold: 0.12,
    includeAA: false,
  });
  return { ratio: pixels / (actual.width * actual.height), diff };
}

const port = await freePort();
const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: root, stdio: "ignore" });
const scratch = await mkdtemp(join(tmpdir(), "pedagogy-visual-"));
let browser;
let failure;

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseUrl}/index.html`, server);
  browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, colorScheme: "light", locale: "ko-KR", timezoneId: "Asia/Seoul",
  });
  for (const [file, label] of fixtures) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html?visual=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.normSet === "function" && typeof window.katex !== "undefined", null, { timeout: 15000 });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#printDoc.visual-capture{display:block!important;position:absolute!important;left:0!important;top:0!important;z-index:99999!important;background:#fff!important}" });
    const printable = await buildPrintablePage(page, file);
    const actualPath = join(scratch, `${label}.png`);
    await printable.screenshot({ path: actualPath, animations: "disabled" });
    const actual = await readFile(actualPath);
    const baselinePath = join(baselineDir, `${label}.png`);
    if (update) {
      await mkdir(baselineDir, { recursive: true });
      await writeFile(baselinePath, actual);
      console.log(`기준 시각본 갱신: ${label}`);
    } else {
      try {
        const compared = compare(actual, await readFile(baselinePath), label);
        if (compared.ratio > MAX_DIFF_RATIO) {
          await mkdir(resultDir, { recursive: true });
          await writeFile(join(resultDir, `${label}-actual.png`), actual);
          await writeFile(join(resultDir, `${label}-diff.png`), PNG.sync.write(compared.diff));
          throw new Error(`${label}: 시각 차이 ${(compared.ratio * 100).toFixed(3)}% (허용 ${(MAX_DIFF_RATIO * 100).toFixed(1)}%)`);
        }
        console.log(`시각 회귀 통과: ${label} (${(compared.ratio * 100).toFixed(3)}%)`);
      } catch (error) {
        if (error?.code === "ENOENT") throw new Error(`${label}: 기준 시각본이 없습니다. npm run update:visual-baseline을 실행하세요.`);
        throw error;
      }
    }
    await page.close();
  }
  await context.close();
  if (!update) console.log(`Visual print regression passed (${fixtures.length} sets)`);
} catch (error) {
  failure = error;
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
  await rm(scratch, { recursive: true, force: true });
}

if (failure) {
  console.error(failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
}
