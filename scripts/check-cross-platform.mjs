/**
 * 환경이 달라도 앱이 살아 있는가 — 연기 검사 1차선
 *
 * ⚠️ 이 검사는 **"깨졌는가"만 본다.** 시각 비교는 하지 않는다 — OS 마다 글리프 래스터화가
 *    달라 잡음이 진짜 회귀보다 크다는 것을 이 저장소가 이미 실측했다(`REV-2026-018`).
 *
 * ⚠️ 그리고 이것은 **1차선일 뿐이다.** Playwright 의 WebKit 은 실제 iOS 사파리도,
 *    카카오 WebView 도 아니다. 인증·다운로드·키보드·safe-area 의 완료 판정에는 실제 기기가
 *    필요하다. 이 검사가 초록불이라고 "모바일 대응 완료" 라고 쓰지 말 것
 *    (`docs/CROSS-PLATFORM-DESIGN.md` §7).
 *
 * 지금 보는 것: **저장소가 막힌 환경에서도 편집기가 동작하는가**(`REV-2026-022`).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const freePort = () => new Promise(r => {
  const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});

/* 사파리의 '모든 쿠키 차단' 처럼 **접근 자체가 던지는** 상태를 만든다.
   ⚠️ `localStorage.clear()` 로는 재현되지 않는다 — 비어 있는 것과 던지는 것은 다르다. */
const THROW_ON_STORAGE = `
  for (const name of ["localStorage","sessionStorage"]) {
    Object.defineProperty(window, name, { configurable:true,
      get(){ throw new DOMException("The operation is insecure.","SecurityError"); } });
  }`;

const PAGES = [
  { file: "document-editor.html", label: "문서 편집기",
    // 이 단추들에 핸들러가 붙어야 편집기가 산 것이다
    buttons: ["validateBtn", "draftBtn", "downloadBtn", "loginBtn"] },
  { file: "index.html", label: "본체",
    buttons: ["exportWithAns", "exportNoAns"] },
];

const port = await freePort();
const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: root, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`${base}/index.html`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 150));
}

let browser, fails = 0;
const say = (ok, msg, note) => { console.log(`  ${ok ? "✅" : "❌"} ${msg}${note ? " — " + note : ""}`); if (!ok) fails++; };

try {
  browser = await chromium.launch();
  for (const spec of PAGES) {
    for (const blocked of [false, true]) {
      const ctx = await browser.newContext();
      if (blocked) await ctx.addInitScript(THROW_ON_STORAGE);
      const page = await ctx.newPage();
      await page.goto(`${base}/${spec.file}?xplat=${Date.now()}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const wired = await page.evaluate(ids =>
        ids.filter(id => { const e = document.getElementById(id); return e && typeof e.onclick === "function"; }),
        spec.buttons);
      const where = `${spec.label} · 저장소 ${blocked ? "차단" : "정상"}`;
      say(wired.length === spec.buttons.length,
          `${where} — 단추가 살아 있다`,
          wired.length === spec.buttons.length ? undefined
            : `${wired.length}/${spec.buttons.length}만 붙음 (빠진 것: ${spec.buttons.filter(b => !wired.includes(b)).join(", ")})`);
      await ctx.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (fails) { console.log(`\n환경 연기 검사 ${fails}건 실패`); process.exit(1); }
console.log("환경 연기 검사 통과");
