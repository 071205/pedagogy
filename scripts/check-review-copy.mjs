/* 검토용 사본이 **원본과 같은 프로그램인지** 실제 브라우저로 확인한다.
 *
 * ⚠️ 문법 검사는 "파싱되는가" 까지만 답한다. 주석을 지우다 문자열을 상하게 해도 문법은
 * 멀쩡할 수 있다 — 실제로 템플릿 안의 주소가 주석으로 지워져 문자열이 줄 끝에서 끊긴
 * 일이 있었다. 그건 띄워 봐야 보인다. 빌더의 리터럴 대조가 1차선이고 이것이 2차선이다.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPY = path.join(ROOT, '분석용 코드');
const PORT = Number(process.env.REVIEW_COPY_PORT || 8791);

/* 부팅했다고 말할 수 있는 신호. **화면에 실제로 그려진 것**을 본다 — 전역이 생겼다는
   것만으로는 그 뒤 줄이 다 돌았는지 알 수 없다. */
const APPS = [
  {
    file: 'index.html',
    ready: () => typeof window.normSet === 'function'
      && !!document.querySelector('#libraryModeBtn')
      && getComputedStyle(document.querySelector('#libraryView')).display !== 'none',
    label: '문제집 편집기 — 라이브러리가 그려진다',
  },
  {
    file: 'mock-exam-editor.html',
    ready: () => !!document.querySelector('#ol')?.children.length
      && !!document.querySelector('#stage')?.children.length,
    label: '모의고사 편집기 — 순서도와 시험지 미리보기가 그려진다',
  },
  {
    file: 'document-editor.html',
    ready: () => !!document.querySelector('#json')?.value
      && document.querySelector('#docStatus')?.textContent.includes('검증됨'),
    label: 'AI 문서 편집기 — 기본 문서가 검증된다',
  },
];

/* CDN·폰트·Firebase 는 망 상태에 달렸다. 우리가 보려는 것은 **우리 코드가 터지는가** 다. */
const IGNORE = /Failed to load resource|net::ERR|ERR_|favicon|Firebase|firebase|App Check|gstatic|jsdelivr|googleapis|CORS|Content Security Policy|Refused to/i;

function serve(dir) {
  const child = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
    { cwd: dir, stdio: 'ignore' });
  return child;
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function bootAll(dir) {
  const server = serve(dir);
  const failures = [];
  let browser;
  try {
    if (!await waitForServer(`http://127.0.0.1:${PORT}/index.html`))
      return ['정적 서버가 뜨지 않았습니다'];
    browser = await chromium.launch();
    for (const app of APPS) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => {
        if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text());
      });
      try {
        await page.goto(`http://127.0.0.1:${PORT}/${app.file}?t=${Date.now()}`,
          { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(app.ready, null, { timeout: 15000 });
      } catch {
        failures.push(`${app.label} — 부팅 신호가 오지 않았습니다`);
      }
      const real = errors.filter((e) => !IGNORE.test(e));
      if (real.length) failures.push(`${app.file} 자바스크립트 오류: ${real[0]}`);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.kill();
  }
  return failures;
}

/* ⚠️ 모의고사 화면 미리보기는 CSS 경로라 **Typst 틀이 상해도 부팅은 멀쩡하다.**
   그래서 원본과 사본에서 `typstSource()` 를 실제로 뽑아 견준다. 주석만 다르다는 것을
   보이려고, 양쪽 모두에 **빌더와 무관한 단순 규칙**(줄 앞 `//` 지우기)을 먹인 뒤 비교한다
   — 같은 훑개로 양쪽을 만들면 같은 실수를 함께 저질러 통과한다. */
const plainTypst = (text) => text.split('\n')
  .filter((line) => !/^\s*\/\//.test(line))
  .map((line) => line.replace(/\s+\/\/.*$/, '').trimEnd())
  .filter((line) => line !== '').join('\n');

async function typstSourceOf(dir) {
  const server = serve(dir);
  let browser;
  try {
    if (!await waitForServer(`http://127.0.0.1:${PORT}/mock-exam-editor.html`)) return null;
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/mock-exam-editor.html?t=${Date.now()}`,
      { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.typstSource === 'function', null, { timeout: 15000 });
    return await page.evaluate(() => window.typstSource());
  } catch { return null; } finally { await browser?.close(); server.kill(); }
}

async function typstEquivalence() {
  const original = await typstSourceOf(ROOT);
  const copy = await typstSourceOf(COPY);
  if (!original || !copy) return 'Typst 조판 원본을 뽑지 못했습니다';
  return plainTypst(original) === plainTypst(copy) ? ''
    : 'Typst 조판 결과가 주석 말고도 달라졌습니다 — 틀 문자열이 상했습니다';
}

/* ── 자기검사 — 상한 사본을 진짜로 빨간불로 보는가 ─────────────────────────── */
async function selfCheck() {
  const broken = path.join(ROOT, '분석용 코드-selfcheck');
  fs.rmSync(broken, { recursive: true, force: true });
  fs.cpSync(COPY, broken, { recursive: true });
  /* 주석 제거가 문자열을 삼켰을 때와 같은 모양의 고장: 문자열 하나를 줄 끝에서 끊는다. */
  const target = path.join(broken, 'pedagogy-normalize.js');
  const src = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, src.replace(/^(function normSet)/m, 'BROKEN(\n$1'));
  try {
    return (await bootAll(broken)).length > 0;
  } finally {
    fs.rmSync(broken, { recursive: true, force: true });
  }
}

if (!fs.existsSync(COPY)) {
  console.error("  ❌ '분석용 코드' 폴더가 없습니다 — 먼저 node scripts/build-review-copy.mjs");
  process.exit(1);
}
const failures = await bootAll(COPY);
const typst = await typstEquivalence();
if (typst) failures.push(typst);
for (const f of failures) console.error('  ❌ ' + f);
const caught = await selfCheck();
if (!caught) console.error('  ❌ 자기검사 실패 — 고장 난 사본도 통과합니다. 이 검사는 헛돕니다');
if (failures.length || !caught) process.exit(1);
console.log(`검토용 사본 확인 — 앱 ${APPS.length}개 부팅 · Typst 조판 결과 동일 · 자기검사 통과`);
for (const a of APPS) console.log('  ✅ ' + a.label);
