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
  ["05-english-order.json", "english-order-print"],
  ["06-english-notice.json", "english-notice-print"],
  ["07-math-image-choices.json", "math-image-choices-print"],
];
const fixtureDir = join(root, "test-fixtures", "refactor-baseline");
/* ── 기준 시각본은 **만든 운영체제별로** 둔다 ────────────────────────────────
 *
 * 글리프 래스터화(힌팅·서브픽셀)는 OS 마다 다르다. 맥에서 만든 기준본을 CI 리눅스와
 * 견주면 **글자마다 픽셀이 어긋나** 쪽 전체의 1.8% 가 다르게 나온다 — 그 검사는
 * 2026-08-28 에 들어온 뒤 **19번 연속 실패**했고, 한 번도 통과한 적이 없다.
 *
 * ⚠️ 이건 허용치를 올려 해결할 문제가 **아니다.** 실측(같은 쪽으로 재어 본 값):
 *
 *     플랫폼 차이(맥 기준본 ↔ CI 리눅스)          1.843%
 *     본문을 3px 밀었을 때(진짜 배치 회귀)         1.492%
 *     글줄 하나가 통째로 사라졌을 때               0.038%
 *
 *   **잡음이 진짜 회귀보다 크다.** 타일별 최댓값으로 바꿔 봐도 마찬가지였다
 *   (잡음 25.1% vs 글줄 사라짐 5.6%). 글자 하나하나가 달라지는 차이는 어떤 픽셀
 *   비교로도 '내용이 바뀐 것' 과 갈라낼 수 없다. **같은 OS 끼리만 견줄 수 있다.**
 *
 * 그래서 기준본을 `visual-baseline/<platform>/` 에 두고, 그 OS 의 기준본이 없으면
 * **건너뛴다(빨간불을 내지 않는다).** 없는 것을 있는 척 재는 것보다 낫고, 저장소가
 * `test:hwpx-parity` 를 CI 에서 뺀 것과 같은 결정이다(CLAUDE.md).
 * ⚠️ 건너뛴 것은 통과가 아니다 — 출력에 ⏭ 로 찍어 CI 로그에서 구분되게 한다.
 */
const baselineDir = join(root, "test-fixtures", "visual-baseline", process.platform);
const resultDir = join(root, "test-results", "visual");
const update = process.env.UPDATE_VISUAL_BASELINE === "1";
/* 같은 OS 끼리는 어긋남이 사실상 0 이다(맥에서 재면 0.000%). 그래서 예전의 0.5% 는
 * **너무 헐거웠다** — 글줄 하나가 사라져도(0.038%) 통과했다. 실제로 통과한다.
 * 이제 두 가지를 함께 본다.
 *   ① 쪽 전체에서 다른 픽셀 비율 — 아주 좁게(0.05%)
 *   ② **글줄의 구조** — 글이 있는 가로 띠의 개수·위치·먹의 양
 * ②가 ①이 놓치는 '내용이 사라짐' 을 잡는다. 쪽 대부분이 흰 여백이라 국소 변화는
 * 전체 비율로는 보이지 않기 때문이다. */
const MAX_DIFF_RATIO = Number(process.env.VISUAL_MAX_DIFF_RATIO ?? 0.0005);
assert.ok(Number.isFinite(MAX_DIFF_RATIO) && MAX_DIFF_RATIO >= 0,
  "VISUAL_MAX_DIFF_RATIO는 0 이상의 숫자여야 합니다");
/* ② 가로줄마다 '글자가 얼마나 있는지' 를 재어 그 분포를 견준다(행 먹 분포).
 *
 * 같은 쪽으로 실측해 고른 값이다(완충 뒤 · 아래 `profileDistance` 참고):
 *
 *     같은 컴퓨터로 두 번 렌더                   0.000%
 *     브라우저 판이 바뀌어 괘선이 미세하게 달라짐    0.018%
 *     ─────────────────────────────── 허용 0.100%
 *     낱말 하나가 사라졌을 때                    0.334%
 *     글줄 하나가 사라졌을 때                    2.223%
 *     본문이 1px 밀렸을 때                     42.290%
 *
 * 잡음보다 5배 위, 가장 작은 진짜 회귀보다 3배 아래다.
 *
 * ⚠️ '글줄 띠' 로 나눠 세지 말 것. 줄 사이 여백이 임계값에 걸쳐 있어 같은 화면인데도
 *    띠 개수가 16↔20 으로 흔들린다(실제로 그렇게 만들었다가 헛빨간불이 났다).
 *    나누지 않고 분포를 통째로 견주면 그 문제가 없다.
 * ⚠️ 어둡기를 **연속값**으로 더한다. '160보다 어두우면 1' 로 세면 글자 테두리 픽셀이
 *    경계를 넘나들어 0.38% 가 흔들린다(이것도 실제로 겪었다). */
const MAX_PROFILE_RATIO = Number(process.env.VISUAL_MAX_PROFILE_RATIO ?? 0.001);

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

/** 가로줄마다 글자가 얼마나 있는지(어둡기의 합). 국소 변화를 잡으려고 쓴다. */
function inkProfile(img) {
  const rows = [];
  for (let y = 0; y < img.height; y++) {
    let row = 0;
    for (let x = 0; x < img.width; x++) {
      const i = (img.width * y + x) << 2;
      row += (255 - (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3) / 255;
    }
    rows.push(row);
  }
  return rows;
}

/** 두 행 먹 분포가 얼마나 다른가(0 이면 같다).
 *
 * ⚠️ 행마다 **작은 차이는 흘려보낸다.** 그러지 않으면 쪽을 가로지르는 괘선 하나가
 *    브라우저 판이 바뀌며 0.4% 옅어진 것만으로 0.312% 가 나온다 — 낱말 하나가 사라진
 *    것(0.434%)과 구별되지 않는다. 괘선은 한 행의 먹이 워낙 커서 작은 비율 변화도
 *    큰 절댓값이 되기 때문이다. 완충을 두면 그 차이는 0.018% 로 내려가고, 낱말 하나가
 *    사라진 것은 0.334% 로 남는다(실측). */
function profileDistance(a, b) {
  let gap = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const slack = Math.max(0.5, 0.02 * b[i]);
    gap += Math.max(0, Math.abs(a[i] - b[i]) - slack);
    total += b[i];
  }
  return total > 0 ? gap / total : 0;
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
  /* ⚠️ 쪽 전체 픽셀 비율만 보면 안 된다 — A4 한 쪽은 대부분 흰 여백이라 **글줄 하나가
     통째로 사라져도 0.038%** 다(실측). 예전 허용치 0.5% 로는 그걸 통과시켰다.
     행 먹 분포를 함께 본다. */
  const profile = profileDistance(inkProfile(actual), inkProfile(expected));
  const notes = [];
  if (profile > MAX_PROFILE_RATIO) {
    notes.push(`글의 배치·양이 ${(profile * 100).toFixed(3)}% 달라졌다 `
      + `(허용 ${(MAX_PROFILE_RATIO * 100).toFixed(3)}%)`);
  }
  return { ratio: pixels / (actual.width * actual.height), diff, profile, notes };
}

const port = await freePort();
const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: root, stdio: "ignore" });
const scratch = await mkdtemp(join(tmpdir(), "pedagogy-visual-"));
let browser;
let failure;
const skipped = [];

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
        const tooDifferent = compared.ratio > MAX_DIFF_RATIO;
        if (tooDifferent || compared.notes.length) {
          await mkdir(resultDir, { recursive: true });
          await writeFile(join(resultDir, `${label}-actual.png`), actual);
          await writeFile(join(resultDir, `${label}-diff.png`), PNG.sync.write(compared.diff));
          const why = compared.notes.length
            ? compared.notes.join(" · ")
            : `시각 차이 ${(compared.ratio * 100).toFixed(3)}% (허용 ${(MAX_DIFF_RATIO * 100).toFixed(3)}%)`;
          throw new Error(`${label}: ${why}`);
        }
        console.log(`시각 회귀 통과: ${label} `
          + `(픽셀 ${(compared.ratio * 100).toFixed(3)}% · 배치 ${(compared.profile * 100).toFixed(3)}%)`);
      } catch (error) {
        if (error?.code === "ENOENT") {
          /* ⚠️ 이 OS 의 기준본이 없다. 다른 OS 의 것과 견주면 글자마다 어긋나
             아무것도 판정하지 못하므로(위 주석의 실측값) **건너뛴다.**
             건너뜀은 통과가 아니다 — 그렇게 찍어 CI 로그에서 구분되게 한다. */
          skipped.push(label);
          console.log(`  ⏭  ${label} — ${process.platform} 기준 시각본이 없어 건너뜁니다`);
          await page.close();
          continue;
        }
        throw error;
      }
    }
    await page.close();
  }
  await context.close();

  /* ── 이 검사가 실제로 무언가를 잡는가 ──────────────────────────────────
   * 허용치를 조금씩 올리다 보면 아무것도 잡지 못하는 검사가 된다 — 이 저장소가
   * 세 번 겪은 실패 방식이다. 기준본을 일부러 망가뜨려 **지금 설정으로 잡히는지**
   * 매번 확인한다. 브라우저가 필요 없어 비용이 거의 없다. */
  if (!update && !skipped.length) {
    const sample = PNG.sync.read(await readFile(join(baselineDir, `${fixtures[1][1]}.png`)));
    const rows = inkProfile(sample);
    const ink = rows.map((v, y) => [v, y]).filter(([v]) => v > 5).sort((a, b) => b[0] - a[0]);
    assert.ok(ink.length > 20, "자기검사: 기준본에서 글줄을 찾지 못했습니다");
    const broken = new PNG({ width: sample.width, height: sample.height });
    sample.data.copy(broken.data);
    for (const [, y] of ink.slice(0, 16)) {           // 글이 가장 많은 16행을 지운다
      for (let x = 0; x < broken.width; x++) {
        const i = (broken.width * y + x) << 2;
        broken.data[i] = 255; broken.data[i + 1] = 255; broken.data[i + 2] = 255;
      }
    }
    const caught = profileDistance(inkProfile(broken), rows);
    assert.ok(caught > MAX_PROFILE_RATIO,
      `자기검사 실패: 글줄 16개를 지웠는데도 ${(caught * 100).toFixed(3)}% 로 `
      + `허용치 ${(MAX_PROFILE_RATIO * 100).toFixed(3)}% 안이라 잡히지 않습니다 — 허용치가 너무 헐겁습니다`);
    console.log(`자기검사 통과: 글줄을 지우면 ${(caught * 100).toFixed(2)}% 로 잡힙니다`);
  }

  if (!update) {
    if (skipped.length) {
      console.log(`⏭ ${process.platform} 기준 시각본이 없어 ${skipped.length}건을 건너뛰었습니다 `
        + `(${skipped.join(", ")}).`);
      console.log(`  만들려면 그 OS 에서 npm run update:visual-baseline 을 돌려 `
        + `test-fixtures/visual-baseline/${process.platform}/ 를 커밋하세요.`);
    }
    const ran = fixtures.length - skipped.length;
    console.log(`Visual print regression passed (${ran} sets`
      + (skipped.length ? `, ${skipped.length} skipped` : "") + ")");
  }
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
