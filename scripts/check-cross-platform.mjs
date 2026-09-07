/**
 * 환경이 달라도 앱이 살아 있는가 — 연기 검사 1차선
 * (`docs/CROSS-PLATFORM-DESIGN.md` §7 1단계)
 *
 * ⚠️ **"깨졌는가" 만 본다. 시각 비교는 하지 않는다.** OS 마다 글리프 래스터화가 달라
 *    잡음이 진짜 회귀보다 크다는 것을 이 저장소가 이미 실측했다(`REV-2026-018`).
 *
 * ⚠️ **이것은 1차선일 뿐이다.** Playwright 의 WebKit 은 실제 iOS 사파리도 카카오 WebView
 *    도 아니고, firefox 는 데스크톱 엔진이다. 여기가 전부 초록불이어도
 *    **'모바일 대응 완료' 라고 쓰면 안 된다** — 인증·다운로드·키보드·safe-area 의 완료
 *    판정에는 실제 기기가 필요하다. 이 저장소가 반복해서 당한 실패 방식 1번이다.
 *
 * 새 항목을 더할 때: **반드시 일부러 깨서 빨간불을 확인한 뒤** 믿을 것.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium, webkit, firefox } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const only = process.env.XPLAT_ONLY || "";          // "chromium" 처럼 하나만 돌릴 때
const freePort = () => new Promise(r => {
  const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});

const ENGINES = [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]
  .filter(([n]) => !only || n === only);

/* ⚠️ Playwright 의 `isMobile` 은 **firefox 가 지원하지 않는다.** 터치만 켠다. */
const VIEWPORTS = [
  { name: "데스크톱", width: 1440, height: 900, touch: false },
  { name: "태블릿",   width: 768,  height: 1024, touch: true },
  { name: "휴대폰",   width: 375,  height: 812,  touch: true },
];

/* ⚠️ **겹침은 정해 둔 쌍만 본다.** 모든 요소 교차를 자동 판정하면 의도한 메뉴·모달·
   툴팁까지 실패로 잡혀 검사가 못 쓰게 된다(검토 지적). */
const OVERLAP_PAIRS = [
  [".topbar", "#appMain", "상단 막대가 본문을 덮지 않는다"],
];

/* 터치 목표 최소 크기. 24px 은 WCAG 2.2 AA 의 하한, 44px 은 애플 권고다.
   ⚠️ 실패를 바로 빨간불로 만들지 않고 **경고로 세어 보고**한다 — 지금 화면을 다 뜯어고치는
      것이 이 단계의 목적이 아니다(1단계는 재는 단계다). */
const TOUCH_MIN = 44;
const KEY_BUTTONS = ["printBtn", "saveBtn", "exportJsonBtn"];

const port = await freePort();
const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: root, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`${base}/index.html`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 150));
}

let fails = 0, warns = 0;
const ok  = (m, note) => console.log(`  ✅ ${m}${note ? " — " + note : ""}`);
const bad = (m, note) => { console.log(`  ❌ ${m}${note ? " — " + note : ""}`); fails++; };
const warn= (m, note) => { console.log(`  ⚠️  ${m}${note ? " — " + note : ""}`); warns++; };
const say = (cond, m, note) => cond ? ok(m) : bad(m, note);

function fixtureSet(name) {
  return [{
    name, header: "연기 검사", subject: "math", lineColor: "indigo",
    problems: [1, 2, 3].map(i => ({
      title: "", desc: "", answer: "③", span: "col",
      blocks: [
        { type: "statement", data: { text: `함수 $f(x)=x^2-${i}x$ 에 대하여 $f(${i})$ 의 값은?` } },
        { type: "choices", data: { layout: "horizontal", items: ["$1$", "$2$", "$3$", "$4$", "$5$"] } },
      ],
    })),
  }];
}

async function newPage(engine, vp) {
  const opts = { viewport: { width: vp.width, height: vp.height }, colorScheme: "light", locale: "ko-KR" };
  if (vp.touch) opts.hasTouch = true;
  const ctx = await engine.launch().then(b => b.newContext(opts).then(c => (c.__browser = b, c)));
  return ctx;
}

/* 한 화면에 대한 검사들. **이름 → {pass, note}** 로 돌려준다.
   ⚠️ 자기검사(`selfCheck`)가 **같은 함수**를 쓴다 — 검사와 자기검사가 갈라지면
      "자기검사는 통과하는데 진짜 검사는 헛도는" 상태가 된다. */
async function probes(page, vp, seen) {
  const out = {};
  const add = (k, pass, note) => { out[k] = { pass, note }; };

  add("가로스크롤(편집기)", (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 2,
      await page.evaluate(() => `${document.documentElement.scrollWidth - window.innerWidth}px 초과`));

  const added = await page.evaluate(() => {
    const before = activeQ().blocks.length;
    const sel = document.getElementById("blockType"); if (sel) sel.value = "conditions";
    document.getElementById("addBlockBtn").click();
    return { before, after: activeQ().blocks.length };
  });
  add("블록 더하기", added.after === added.before + 1, JSON.stringify(added));

  const pages = await page.evaluate(() => { buildPrintDoc(false); return document.querySelectorAll("#printDoc .page").length; });
  add("인쇄본 조립", pages > 0, `${pages}쪽`);

  for (const [a, b, label] of OVERLAP_PAIRS) {
    const hit = await page.evaluate(([sa, sb]) => {
      const A = document.querySelector(sa), B = document.querySelector(sb);
      if (!A || !B) return null;
      const r = A.getBoundingClientRect(), s2 = B.getBoundingClientRect();
      const dy = Math.min(r.bottom, s2.bottom) - Math.max(r.top, s2.top);
      const dx = Math.min(r.right, s2.right) - Math.max(r.left, s2.left);
      return (dx > 1 && dy > 1) ? Math.round(dy) : 0;
    }, [a, b]);
    add(label, hit === 0, hit === null ? "요소를 못 찾음" : `${hit}px 겹침`);
  }

  /* ⚠️ **처음 만든 판정에는 구멍이 둘 있었다**(`REV-2026-025`, Codex).
       ① `!b.missing` 으로 **없는 단추를 검사에서 빼** 버렸다 — 단추가 DOM 에서 사라지면
          초록불이었다. 시끄러운 것을 피하려다 눈을 가린 꼴이다.
       ② 가로(`left`/`right`)만 보고 **세로를 안 봤다** — `top:-500px` 로 밀어도 통과했다.
     '없는 것' 과 '못 누르는 것' 은 둘 다 실패다. */
  const btns = await page.evaluate(([ids, min]) => ids.map(id => {
    const e = document.getElementById(id);
    if (!e) return { id, missing: true, inView: false };
    const r = e.getBoundingClientRect();
    return { id, w: Math.round(r.width), h: Math.round(r.height),
             top: Math.round(r.top), bottom: Math.round(r.bottom),
             inView: r.width > 0 && r.height > 0
                  && r.left >= -1 && r.right <= window.innerWidth + 1
                  && r.top >= -1 && r.bottom <= window.innerHeight + 1,
             small: r.height > 0 && r.height < min };
  }), [KEY_BUTTONS, TOUCH_MIN]);
  const off = btns.filter(b => !b.inView);
  add("핵심 단추가 화면 안", off.length === 0,
      off.map(b => b.missing ? `${b.id}(없음)` : `${b.id}(${b.w}×${b.h} @${b.top}~${b.bottom})`).join(", "));

  /* ⚠️ 두 이벤트를 **따로** 본다. 함께 쏘면 하나가 죽어도 다른 하나가 가려 준다 —
     `pagehide` 를 새로 넣은 이유(iOS 사파리가 `beforeunload` 를 건너뛴다)가 통째로
     검사되지 않는다. 디바운스 저장이 먼저 끼어들지 않게 **타이머를 끄고** 잰다. */
  for (const [ev, on] of [["visibilitychange", "document"], ["pagehide", "window"]]) {
    const r = await page.evaluate(async ([ev, on]) => {
      const q = activeQ(); const mark = "연기" + ev + Date.now();
      /* ⚠️ **디바운스(150ms)가 대신 저장해 이 검사를 헛돌게 만든다.** 처음에 250ms 를
         기다렸더니 `pagehide` 청취를 **소스에서 지워도 통과**했다 — 그 사이 디바운스
         타이머가 먼저 써 버렸기 때문이다. 그래서 이렇게 잰다:
           ① 편집하고 `saveSets()` — 타이머가 걸린다(아직 안 썼다)
           ② 저장소를 비운다
           ③ 이벤트를 쏜다 — 핸들러의 `flushLocal()` 은 **동기**다
           ④ **기다리지 않고 바로** 읽는다 — 타이머는 아직 안 돌았다
         `localDirty` 가 살아 있어야 `flushLocal()` 이 실제로 쓰므로 ①과 ③ 사이에
         다른 저장이 끼면 안 된다. */
      q.title = mark; saveSets();
      try { localStorage.setItem(setsKey(), "{}"); } catch { return "저장소없음"; }
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
      if (ev === "visibilitychange") Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      try { (on === "document" ? document : window).dispatchEvent(new Event(ev)); }
      finally {
        if (ev === "visibilitychange") { delete document.visibilityState;
          if (desc) Object.defineProperty(Document.prototype, "visibilityState", desc); }
      }
      try { return (localStorage.getItem(setsKey()) || "").includes(mark); } catch { return "저장소없음"; }
    }, [ev, on]);
    add(`${ev} 로 편집분이 로컬에 남는다`, r === true, String(r));
  }

  add("스크립트 오류 없음", seen.pageErrors.length === 0, seen.pageErrors.slice(0, 2).join(" | "));

  /* ── 터치 목표 ──
     ⚠️ 1단계에서는 **핵심 단추 셋만** 재고 경고로 뒀다. 3단계에서 고쳤으므로 이제
        **보이는 조작 요소를 전부** 재고 **판정한다.** 셋만 재면 나머지가 작아져도 모른다.
     ⚠️ `44` 는 애플 권고다. 화면에 꽉 찬 화면(모달 등) 안의 요소도 같은 기준으로 본다. */
  if (vp.touch) {
    const small = await page.evaluate((min) => {
      const out = [];
      document.querySelectorAll("#appMain button, #appMain select, #appMain input:not([type=file]),"
        + ".topbar button, .topbar select, .topbar input:not([type=file]), .pane-tab, .iconbtn").forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;              // 안 보이는 것은 세지 않는다
        if (getComputedStyle(e).display === "none") return;
        if (r.height >= min && r.width >= min) return;
        const id = e.id || (typeof e.className === "string" ? e.className.split(" ")[0] : "") || e.tagName.toLowerCase();
        out.push(`${id} ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      return [...new Set(out)];
    }, TOUCH_MIN);
    add(`터치 목표 ${TOUCH_MIN}px 이상`, small.length === 0, small.slice(0, 6).join(", ") + (small.length > 6 ? ` 외 ${small.length - 6}개` : ""));
    /* hover 가 없는 기기에서 hover 로만 보이는 조작은 **없는 것과 같다.** */
    const hidden = await page.evaluate(() => {
      const b = document.querySelector(".blk-insert-btn");
      return b ? Number(getComputedStyle(b).opacity) : null;
    });
    add("hover 없이도 블록 추가 단추가 보인다", hidden === null || hidden > 0.5, String(hidden));
  }
  return out;
}

/** 문제집을 가져와 편집기까지 들어간다. 검사 전 공통 준비. */
async function boot(page, setName) {
  await page.goto(`${base}/index.html?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.normSet === "function" && typeof window.katex !== "undefined",
                             null, { timeout: 20000 });
  await page.setInputFiles("#importAllInput",
    { name: "smoke.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixtureSet(setName))) });
  await page.waitForFunction(n => Array.isArray(sets) && sets.some(s => s.name === n), setName, { timeout: 30000 });
  const libScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  /* ⚠️ `showEditor()` 는 **문제집 id 를 인자로 받는다**(`index.html:3435`). 빈손으로 부르면
     `currentSetId` 가 undefined 가 되어 `activeQ()` 가 터진다 — 세 엔진에서 똑같이 났고,
     브라우저 차이가 아니라 검사 쪽 실수였다. */
  await page.evaluate(n => {
    const s = sets.find(x => x.name === n);
    showEditor(s.id); currentQId = s.problems[0].id;
    renderEditor(); renderPreview();
  }, setName);
  await page.waitForTimeout(700);
  return libScroll;
}

function watch(page) {
  const seen = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", e => seen.pageErrors.push(String(e).split("\n")[0].slice(0, 140)));
  page.on("console", m => { if (m.type() === "error") seen.consoleErrors.push(m.text().slice(0, 140)); });
  return seen;
}

async function runMatrix(engineName, engine) {
  for (const vp of VIEWPORTS) {
    const where = `${engineName} · ${vp.name}`;
    const ctx = await newPage(engine, vp);
    const page = await ctx.newPage();
    const seen = watch(page);
    try {
      const libScroll = await boot(page, `[연기] ${engineName}-${vp.name}`);
      say(libScroll <= 2, `${where} — 라이브러리에 가로 스크롤이 없다`, `${libScroll}px 초과`);
      const r = await probes(page, vp, seen);
      for (const [k, v] of Object.entries(r)) {
        if (k === "__touchWarn") continue;
        say(v.pass, `${where} — ${k}`, v.pass ? undefined : v.note);
      }
      if (seen.consoleErrors.length) warn(`${where} — 콘솔 오류 ${seen.consoleErrors.length}건`, seen.consoleErrors.slice(0, 2).join(" | "));
    } catch (e) {
      bad(`${where} — 흐름이 끝까지 돌지 않았다`, String(e).split("\n")[0].slice(0, 140));
    } finally { const b = ctx.__browser; await ctx.close(); await b.close(); }
  }
}

/* ── 자기검사 — **검사가 실제로 무언가를 잡는가** ───────────────────────────────
 *
 * ⚠️ 이 저장소에서 '전부 초록불인데 아무것도 검사하지 않던' 사고가 세 번 났다.
 *    새 검사를 만들면 **일부러 깨서 빨간불을 보는 것까지**가 한 벌이다.
 *    사람이 손으로 하면 잊히므로 검사 안에 넣는다(시각 회귀가 하는 것과 같은 방식).
 *
 * 각 항목은 화면에 고장을 하나 심고 **그에 대응하는 probe 가 실패해야** 통과다.
 * ⚠️ 다른 probe 까지 덩달아 실패하는 것은 상관없다 — 보는 것은 '그 항목이 잡히는가' 다.
 */
const BREAKS = [
  { key: "가로스크롤(편집기)", 이름: "단보다 넓은 요소를 넣으면",
    run: p => p.evaluate(() => { const d = document.createElement("div");
      d.style.cssText = "width:4000px;height:10px"; document.body.appendChild(d); }) },
  { key: "블록 더하기", 이름: "블록 더하기 단추를 죽이면",
    run: p => p.evaluate(() => { document.getElementById("addBlockBtn").onclick = null; }) },
  { key: "인쇄본 조립", 이름: "인쇄본을 비우면",
    run: p => p.evaluate(() => { window.buildPrintDoc = () => { document.getElementById("printDoc").innerHTML = ""; }; }) },
  { key: "상단 막대가 본문을 덮지 않는다", 이름: "상단 막대를 본문 위로 덮으면",
    run: p => p.evaluate(() => { const t = document.querySelector(".topbar");
      t.style.cssText += ";position:fixed;top:0;left:0;right:0;height:400px;z-index:9999"; }) },
  { key: "핵심 단추가 화면 안", 이름: "핵심 단추를 화면 밖(가로)으로 밀면",
    run: p => p.evaluate(() => { document.getElementById("printBtn").style.cssText += ";position:fixed;left:-500px"; }) },
  /* ⚠️ 아래 둘은 `REV-2026-025` 가 지적한 맹점이다 — 예전 판정은 둘 다 초록불이었다. */
  { key: "핵심 단추가 화면 안", 이름: "핵심 단추를 화면 밖(세로)으로 밀면",
    run: p => p.evaluate(() => { document.getElementById("saveBtn").style.cssText += ";position:fixed;top:-500px"; }) },
  { key: "핵심 단추가 화면 안", 이름: "핵심 단추를 아예 지우면",
    run: p => p.evaluate(() => { document.getElementById("printBtn").remove(); }) },
  /* ⚠️ 자기검사는 데스크톱 뷰포트에서 도는데 터치 항목은 터치 뷰포트에서만 잰다 —
     그래서 이 둘은 `selfCheck` 가 터치 뷰포트를 따로 쓴다(아래 `touchVp`). */
  { key: `터치 목표 ${TOUCH_MIN}px 이상`, 이름: "단추를 다시 작게 만들면", touch: true,
    run: p => p.addStyleTag({ content: "#printBtn{min-height:20px!important;height:20px!important}" }) },
  { key: "hover 없이도 블록 추가 단추가 보인다", 이름: "블록 추가 단추를 다시 숨기면", touch: true,
    run: p => p.addStyleTag({ content: ".blk-insert-btn{opacity:0!important}" }) },
  /* ⚠️ 저장 경로를 끊으면 **두 항목이 모두** 빨간불이어야 한다. 하나만 빨개지면 나머지
     하나는 다른 이유로 통과하고 있다는 뜻이다(예: 디바운스가 대신 저장). */
  { key: "visibilitychange 로 편집분이 로컬에 남는다", 이름: "숨김 저장을 끊으면 (visibilitychange)",
    run: p => p.evaluate(() => { window.flushLocal = () => true; window.writeLocalNow = () => true; }) },
  { key: "pagehide 로 편집분이 로컬에 남는다", 이름: "숨김 저장을 끊으면 (pagehide)",
    run: p => p.evaluate(() => { window.flushLocal = () => true; window.writeLocalNow = () => true; }) },
  { key: "스크립트 오류 없음", 이름: "스크립트 오류를 내면",
    run: p => p.evaluate(() => { setTimeout(() => { throw new Error("자기검사용 고의 오류"); }, 0); }) },
];

async function selfCheck(engine) {
  console.log("\n── 자기검사 (검사가 실제로 잡는가) ──");
  const touchVp = VIEWPORTS.find(v => v.touch);
  for (const b of BREAKS) {
    const vp = b.touch ? touchVp : VIEWPORTS[0];
    const ctx = await newPage(engine, vp);
    const page = await ctx.newPage();
    const seen = watch(page);
    try {
      await boot(page, `[자기검사] ${b.key}`);
      await b.run(page);
      await page.waitForTimeout(250);
      const r = await probes(page, vp, seen);
      const hit = r[b.key];
      say(hit && hit.pass === false, `${b.이름} 빨간불이 된다`,
          hit ? "여전히 통과한다 — 이 검사는 헛돌고 있다" : `'${b.key}' probe 를 못 찾음`);
    } catch (e) {
      bad(`${b.이름} 빨간불이 된다`, "자기검사가 터짐: " + String(e).split("\n")[0].slice(0, 100));
    } finally { const br = ctx.__browser; await ctx.close(); await br.close(); }
  }
}

/* ── 인앱 안내가 **누를 수 있는 자리**에 있는가 ────────────────────────────
 *
 * ⚠️ 안내 문구가 맞아도 **단추가 화면 밖이면 없느니만 못하다.** 처음에 문서 편집기의
 *    안내를 상단 바(`.bar-right`) 안에 넣었더니 375px 에서 `left=388px` — 화면 오른쪽
 *    **바깥**이었다(`REV-2026-026` 재검토, Codex). 밖으로 나가라는 안내가 정작 못 누르는
 *    자리에 있었다.
 * ⚠️ 그래서 **네 방향을 모두** 본다(가로만 보면 위·아래로 밀린 것을 놓친다).
 */
async function runInAppNotice(engineName, engine) {
  const b = await engine.launch();
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  for (const [file, label] of [["index.html", "본체"], ["document-editor.html", "문서 편집기"]]) {
    const page = await ctx.newPage();
    const where = `${engineName} · ${label} · 인앱 안내`;
    try {
      await page.goto(`${base}/${file}?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => typeof window.showInAppNotice === "function", null, { timeout: 20000 });
      const r = await page.evaluate(() => {
        showInAppNotice("카카오톡");
        const n = document.getElementById("inAppNotice");
        const btn = document.getElementById("openOutsideBtn") || (n && n.querySelector("button"));
        if (!n || !btn) return { 없음: !n ? "안내" : "단추" };
        const q = btn.getBoundingClientRect();
        return {
          안: q.width > 0 && q.height > 0 && q.left >= -1 && q.right <= window.innerWidth + 1
             && q.top >= -1 && q.bottom <= window.innerHeight + 1,
          자리: `${Math.round(q.left)},${Math.round(q.top)}~${Math.round(q.right)},${Math.round(q.bottom)}`,
          넘침: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      if (r.없음) { bad(`${where} — ${r.없음}가 없다`); }
      else {
        say(r.안, `${where} — '밖에서 열기' 를 누를 수 있다`, `${r.자리} (창 375×812)`);
        say(r.넘침 <= 2, `${where} — 안내를 띄워도 가로로 넘치지 않는다`, `${r.넘침}px 초과`);
      }
    } catch (e) {
      bad(`${where} — 확인하지 못했다`, String(e).split("\n")[0].slice(0, 140));
    } finally { await page.close(); }
  }
  await b.close();
}

/* ── CDN 이 막힌 망 (학교·기업) ──────────────────────────────────────────────
 *
 * ⚠️ KaTeX · KoPub · Firebase · SortableJS 가 **전부 CDN** 이다. 하나만 막혀도 무엇이
 *    어떻게 깨지는지 **한 번도 확인한 적이 없었다**(`docs/CROSS-PLATFORM-DESIGN.md` §7).
 *    여기서 보는 것은 '예쁘게 나오는가' 가 아니라 **앱이 살아서 데이터를 다룰 수 있는가** 다.
 */
const CDN_HOSTS = ["**cdn.jsdelivr.net/**", "**cdnjs.cloudflare.com/**",
                   "**www.gstatic.com/**", "**fonts.googleapis.com/**", "**fonts.gstatic.com/**"];

async function runCdnBlocked(engineName, engine) {
  const b = await engine.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  for (const h of CDN_HOSTS) await ctx.route(h, r => r.abort());
  const page = await ctx.newPage();
  const seen = watch(page);
  const where = `${engineName} · CDN 차단`;
  try {
    await page.goto(`${base}/index.html?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => typeof window.normSet === "function", null, { timeout: 20000 });
    await page.setInputFiles("#importAllInput",
      { name: "smoke.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixtureSet("[CDN차단] 세트"))) });
    await page.waitForFunction(() => Array.isArray(sets) && sets.some(s => s.name === "[CDN차단] 세트"), null, { timeout: 20000 });
    const r = await page.evaluate(() => {
      const s = sets.find(x => x.name === "[CDN차단] 세트");
      showEditor(s.id); currentQId = s.problems[0].id; renderEditor(); renderPreview();
      const before = activeQ().blocks.length;
      document.getElementById("addBlockBtn").click();
      return { katex: typeof window.katex !== "undefined", sortable: typeof window.Sortable !== "undefined",
               편집됨: activeQ().blocks.length === before + 1,
               내보내기단추: typeof document.getElementById("exportJsonBtn").onclick === "function" };
    });
    say(r.편집됨, `${where} — 문제집을 계속 편집할 수 있다`, JSON.stringify(r));
    say(r.내보내기단추, `${where} — 내보내기(데이터 탈출구)가 살아 있다`, JSON.stringify(r));
    if (!r.katex) warn(`${where} — KaTeX 없음: 수식이 원문으로 보인다(인쇄 전 확인 대화상자가 뜬다)`);
    if (!r.sortable) warn(`${where} — SortableJS 없음: 순서 바꾸기만 못 쓴다`);
  } catch (e) {
    bad(`${where} — 앱이 뜨지 않는다`, String(e).split("\n")[0].slice(0, 140));
  } finally { await b.close(); }
}

/* ── 파일이 실제로 기기에 저장되는가 ─────────────────────────────────────────
 * ⚠️ **만드는 것과 저장되는 것은 별개다**(검토 지적). Blob 을 만들었다는 데서 끝내면
 *    모바일·인앱 브라우저에서 다운로드가 막히는 것을 못 잡는다.
 */
async function runDownload(engineName, engine) {
  const b = await engine.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const where = `${engineName} · 내보내기`;
  try {
    await boot(page, "[내보내기] 세트");
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.click("#exportJsonBtn"),
    ]);
    const name = dl.suggestedFilename();
    const path = await dl.path();
    const size = path ? (await import("node:fs")).statSync(path).size : 0;
    say(/\.json$/.test(name) && size > 0, `${where} — JSON 파일이 실제로 내려온다`, `${name} · ${size}B`);
  } catch (e) {
    bad(`${where} — JSON 파일이 내려오지 않는다`, String(e).split("\n")[0].slice(0, 140));
  } finally { await b.close(); }
}

/* ── 저장소가 던지는 환경 (`REV-2026-022`) ──
   ⚠️ `localStorage.clear()` 로는 재현되지 않는다 — **비어 있는 것과 던지는 것은 다르다.** */
const THROW_ON_STORAGE = `
  for (const name of ["localStorage","sessionStorage"]) {
    Object.defineProperty(window, name, { configurable:true,
      get(){ throw new DOMException("The operation is insecure.","SecurityError"); } });
  }`;
const STORAGE_PAGES = [
  { file: "document-editor.html", label: "문서 편집기", buttons: ["validateBtn", "draftBtn", "downloadBtn", "loginBtn"] },
  { file: "index.html", label: "본체", buttons: ["exportWithAns", "exportNoAns"] },
];

async function runStorageBlocked(engineName, engine) {
  for (const spec of STORAGE_PAGES) {
    for (const blocked of [false, true]) {
      const b = await engine.launch();
      const ctx = await b.newContext();
      if (blocked) await ctx.addInitScript(THROW_ON_STORAGE);
      const page = await ctx.newPage();
      await page.goto(`${base}/${spec.file}?xplat=${Date.now()}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const wired = await page.evaluate(ids =>
        ids.filter(id => { const e = document.getElementById(id); return e && typeof e.onclick === "function"; }), spec.buttons);
      const where = `${engineName} · ${spec.label} · 저장소 ${blocked ? "차단" : "정상"}`;
      say(wired.length === spec.buttons.length, `${where} — 단추가 살아 있다`,
          `${wired.length}/${spec.buttons.length}만 붙음 (빠진 것: ${spec.buttons.filter(x => !wired.includes(x)).join(", ")})`);
      await b.close();
    }
  }
}

/* ⚠️ **엔진이 안 깔린 환경에서는 죽지 말고 건너뛴다** — `npm ci` 는 playwright 를 깔지만
   브라우저 바이너리는 따로 받아야 한다. 다만 **건너뜀은 통과가 아니다**(이 저장소의 규칙):
   `XPLAT_REQUIRE=1` 이면 실패로 친다. CI 는 그 값으로 돈다. */
const REQUIRE = process.env.XPLAT_REQUIRE === "1";
const available = [];
for (const [name, engine] of ENGINES) {
  try { const b = await engine.launch(); await b.close(); available.push([name, engine]); }
  catch (e) {
    if (REQUIRE) { console.error(`❌ ${name} 브라우저가 없습니다 (npx playwright install ${name})`); fails++; }
    else console.log(`  ⏭ ${name} — 브라우저가 없어 건너뜁니다 (npx playwright install ${name})`);
  }
}
if (!available.length) {
  server.kill();
  console.log(REQUIRE ? "\n환경 연기 검사: 브라우저가 하나도 없습니다" : "\n환경 연기 검사 건너뜀");
  process.exit(REQUIRE ? 1 : 0);
}

try {
  for (const [name, engine] of available) {
    console.log(`\n── ${name} ──`);
    await runMatrix(name, engine);
    await runStorageBlocked(name, engine);
    await runInAppNotice(name, engine);
    await runCdnBlocked(name, engine);
    await runDownload(name, engine);
  }
  /* 자기검사는 한 엔진에서만 돈다 — 검사 논리가 엔진마다 다르지 않다. */
  await selfCheck(available[0][1]);
} finally { server.kill(); }

console.log();
if (fails) { console.log(`환경 연기 검사 ${fails}건 실패 · 경고 ${warns}건`); process.exit(1); }
console.log(`환경 연기 검사 통과 (경고 ${warns}건)`);
