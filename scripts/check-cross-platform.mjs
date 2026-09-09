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
  { name: "아이패드 가로", width: 1194, height: 834, touch: true },
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

  /* ⚠️ **상단 바 왼쪽 묶음이 붙어 있는가**(`REV-2026-063`).
     `.topbar` 가 `justify-content:space-between` 이던 시절, 라이브러리에서 숨은
     `#topActions` 가 `visibility:hidden` 으로 **702px 를 그대로 차지해** 남는 공간을 전부
     먹었다. 그래서 브랜드·모의고사·AI문서가 붙어 보였다 — **보이지 않는 채움에 기댄
     레이아웃**이었다. `display:none` 으로 바꾸자 그 채움이 사라져 나머지가 균등하게
     벌어졌다(아이패드에서 브랜드 끝 145 → 모의고사 시작 **338**).
     ⚠️ 검사 154건이 전부 초록불이었다 — 넘치지도 잘리지도 않고 **그냥 벌어졌을 뿐**이라
     기존 판정(화면 안·넘침·터치 크기) 어디에도 안 걸렸다. 사람이 아이패드로 보고 알았다.
     그래서 '붙어 있는가' 를 값으로 잰다. 줄바꿈될 때는 다른 줄로 갈 수 있으므로
     **같은 줄일 때만** 본다. */
  const brandGap = await page.evaluate(() => {
    const br = document.getElementById("brandBtn"), mk = document.getElementById("mockModeBtn");
    if (!br || !mk) return { missing: true };
    const a = br.getBoundingClientRect(), b = mk.getBoundingClientRect();
    /* 버튼마다 높이가 달라도 세로로 절반 이상 겹치면 같은 줄이다. `top` 좌표 4px
       같은 임계값은 브랜드를 시맨틱 button으로 바꿨을 때 정확히 4px 차가 나 헛돌았다. */
    const verticalOverlap=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    return { sameRow: verticalOverlap>Math.min(a.height,b.height)/2,
             gap: Math.round(b.left - a.right) };
  });
  add("상단 바 왼쪽 묶음이 붙어 있다",
      !brandGap.missing && (!brandGap.sameRow || brandGap.gap <= 40),
      brandGap.missing ? "브랜드·모의고사 단추를 찾지 못했다"
                       : `브랜드와 모의고사 사이 ${brandGap.gap}px (같은 줄=${brandGap.sameRow})`);

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

  const qFocus = await page.evaluate(() => {
    const accepted=()=>document.activeElement?.classList.contains("q-open")||document.activeElement?.id==="metaHead";
    const open=document.querySelector(".q-open"); if(!open) return { missing:"q-open" };
    open.click(); const afterOpen=accepted();
    const add=document.querySelector(".add-q"); if(!add) return { missing:"add-q", afterOpen };
    add.click(); const afterAdd=accepted();
    return {afterOpen,afterAdd,active:document.activeElement?.id||document.activeElement?.className||document.activeElement?.tagName};
  });
  add("문항 조작 뒤 키보드 포커스 유지", qFocus.afterOpen===true&&qFocus.afterAdd===true, JSON.stringify(qFocus));

  /* ── 터치 목표 ──
     ⚠️ **선택자를 CSS 에서 베껴 오면 안 된다.** 처음에 그렇게 했더니 CSS 와 검사가
        `button`·`select`·`input` 만 보고 **버튼처럼 쓰는 `<a class="btn">`(52×21) 과
        `<label class="btn">` 을 함께 놓쳤다**(`REV-2026-027`, Codex).
        우리 목록을 우리 목록으로 검사한 꼴이다.
     → 그래서 여기서는 **태그가 아니라 동작으로** 고른다: 의미상 조작 요소이거나
        **계산된 `cursor: pointer`** 인 것. `cursor` 는 CSS 규칙 목록과 무관한 신호라
        양쪽이 같은 것을 함께 빠뜨릴 수 없다.
     ⚠️ 잎사귀만 센다 — 조작 요소를 품은 컨테이너까지 세면 의미 없는 실패가 난다. */
  if (vp.touch) {
    const small = await page.evaluate((min) => {
      /* ⚠️ `[tabindex]` 를 통째로 넣으면 **구글 로그인 SDK 의 1×1 숨김 iframe**
         (`#I0_…`, `tabindex="-1"`)까지 잡힌다 — webkit 에서만 나타나 한참 헤맸다.
         `-1` 은 '키보드로 갈 수 없음' 이라 사용자가 누르는 목표가 아니다. iframe 도 뺀다. */
      const SEMANTIC = "a[href],button,select,input:not([type=file]),textarea,summary,label,"
                     + '[role=button],[tabindex]:not([tabindex="-1"])';
      const out = [];
      document.querySelectorAll("*").forEach(e => {
        if (e.closest("#printDoc")) return;                    // 시험지 조판은 건드리지 않는다
        const cs = getComputedStyle(e);
        const hot = el => { const c = getComputedStyle(el); return el.matches(SEMANTIC) || c.cursor === "pointer"; };
        if (e.tagName === "IFRAME") return;
        if (!hot(e)) return;
        /* ⚠️ 조상이 이미 조작 요소면 이것은 **그 목표의 일부**다(단추 안의 아이콘·svg·path).
           `cursor: pointer` 는 상속되므로 이 걸러내기가 없으면 svg 내부까지 전부 잡힌다. */
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (hot(p)) return;
        if (e.querySelector(SEMANTIC)) return;                 // 조작 요소를 품은 컨테이너 제외
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return;
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        if (r.height >= min && r.width >= min) return;
        const id = e.id || (typeof e.className === "string" && e.className ? "." + e.className.split(" ")[0] : e.tagName.toLowerCase());
        out.push(`${id} ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      return [...new Set(out)];
    }, TOUCH_MIN);
    add(`터치 목표 ${TOUCH_MIN}px 이상`, small.length === 0, small.slice(0, 8).join(", ") + (small.length > 8 ? ` 외 ${small.length - 8}개` : ""));
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
  /* ⚠️ **앱의 부팅이 끝나기 전에 가져오면 안 된다.** 늦게 도는 `loadSets()` 가 우리가 넣은
     세트를 **덮는다** — CI 의 느린 webkit 에서만 그렇게 돼 `activeQ()` 가 undefined 로
     터졌다. 한 번 기다리는 것으로는 모자란다(그 뒤에 덮일 수 있다).
     `sets` 가 **더 이상 바뀌지 않을 때까지** 기다려 경쟁 자체를 없앤다. */
  await page.waitForFunction(() => {
    const now = JSON.stringify((window.sets || []).map((s) => s.id));
    const same = window.__xplatPrev === now;
    window.__xplatPrev = now;
    return same;
  }, null, { timeout: 20000, polling: 400 });
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
  /* ⚠️ **고정 시간으로 기다리면 안 된다.** 700ms 를 기다렸더니 CI 의 webkit 태블릿·
     휴대폰에서만 `activeQ()` 가 undefined 라 흐름이 터졌다 — 느린 기기에서는 앱의 늦은
     부팅(`loadSets`)이 우리가 넣은 세트를 **덮는 경쟁**이 일어난다.
     검사가 필요로 하는 것은 시간이 아니라 **상태**다: 문항이 잡힐 때까지 기다린다. */
  /* ⚠️ 여기까지 오면 편집기에 들어가 있어야 한다. 고정 시간으로 기다리지 않는다 —
     700ms 는 이 컴퓨터에서만 충분했고 CI 의 webkit 에서 터졌다. */
  await page.waitForFunction(
    () => typeof activeQ === "function" && !!(activeQ() && activeQ().blocks),
    null, { timeout: 20000 });
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
  /* ⚠️ `REV-2026-063` — 예전 판정으로는 이 고장이 **전부 초록불**이었다. */
  { key: "상단 바 왼쪽 묶음이 붙어 있다", 이름: "상단 바를 다시 space-between 으로 되돌리면",
    run: p => p.evaluate(() => { const t = document.querySelector(".topbar");
      /* 이 결함의 원래 재현 조건은 편집기 동작이 숨은 라이브러리 화면이다. */
      document.getElementById("topActions").style.display = "none";
      t.style.justifyContent = "space-between";
      document.getElementById("themeBtn").style.setProperty("margin-left", "8px", "important"); }) },
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
  { key: "문항 조작 뒤 키보드 포커스 유지", 이름: "문항 포커스 복원을 끊으면",
    run: p => p.evaluate(() => { window.focusQuestionControl = () => {}; }) },
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
      /* ⚠️ 여기서 편집기 상태를 '다시 다잡으면' **심은 고장까지 되돌린다** — 실제로
         그렇게 했다가 '블록 더하기 단추를 죽여도 통과' 가 났다. 흔든 뒤에는 손대지 않는다. */
      const r = await probes(page, vp, seen);
      const hit = r[b.key];
      say(hit && hit.pass === false, `${b.이름} 빨간불이 된다`,
          hit ? "여전히 통과한다 — 이 검사는 헛돌고 있다" : `'${b.key}' probe 를 못 찾음`);
    } catch (e) {
      bad(`${b.이름} 빨간불이 된다`, "자기검사가 터짐: " + String(e).split("\n")[0].slice(0, 100));
    } finally { const br = ctx.__browser; await ctx.close(); await br.close(); }
  }
}

/* ── 인쇄용 글꼴을 **인쇄할 사람에게만** 보내는가 ────────────────────────────
 *
 * KoPub 바탕 세 벌만 **7.6MB** 다(weight 당 2.5MB · WOFF2 도 서브셋도 아니다).
 * ⚠️ 예전에는 부팅 뒤 무조건 미리 받아, **인쇄할 생각이 없는 모바일 방문자에게** 그
 *    7.6MB 를 떠안겼다. 지금은 인쇄 단추에 손이 닿을 때 받는다.
 * 실측(375px · chromium): 방문만 하면 **0MB**, 인쇄 단추를 누르면 7.83MB 가 곧바로
 * 시작되고 사용자가 대화상자에서 고르는 1.5초 뒤 남은 대기는 **0ms** 다.
 * ⚠️ 이 검사가 없으면 "부팅 때 미리 받자" 로 조용히 되돌아간다.
 */
async function runFontIntent(engineName, engine) {
  const b = await engine.launch();
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  /* ⚠️ **URL 로 뭉뚱그려 세면 안 된다.** 처음엔 `font-kopub|KoPubBatang|KaTeX_` 가 든
     응답을 한 숫자로 세고 "3건 이하면 통과" 로 뒀는데, 정상값 1건은 **CSS** 이고
     실제 글꼴은 0건이다. 즉 **2.5MB 짜리 WOFF 두 벌(≈5MB)이 부팅 중 내려와도** 통과했다
     (`REV-2026-029`, Codex). 5단계가 없앤 낭비의 대부분이 되돌아와도 몰랐다.
     → 브라우저가 알려 주는 **`resourceType()==="font"`** 로 실제 글꼴만 세고,
        인쇄 의도 전에는 **0건**을 요구한다. 전송량도 함께 남긴다. */
  /* ⚠️ 화면 글꼴(Pretendard)은 **부팅 때 받는 것이 맞다** — 서브셋 10개 0.25MB 다.
     여기서 묻는 것은 "**인쇄용** 글꼴(KoPub 바탕 · KaTeX)을 미리 받았는가" 다.
     `resourceType==="font"` 로 CSS 를 걸러내고, 그 위에 인쇄용만 고른다. */
  const PRINT_FONT = /KoPubBatang|KaTeX_/i;
  const fonts = [], uiFonts = [];
  ctx.on("response", (r) => {
    if (r.request().resourceType() !== "font") return;
    const rec = { url: r.url(), bytes: Number(r.headers()["content-length"] || 0) };
    (PRINT_FONT.test(rec.url) ? fonts : uiFonts).push(rec);
  });
  const page = await ctx.newPage();
  const where = `${engineName} · 글꼴`;
  const mb = (list) => +(list.reduce((n, f) => n + f.bytes, 0) / 1048576).toFixed(2);
  try {
    await page.goto(`${base}/index.html?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => typeof window.warmPrintFonts === "function", null, { timeout: 20000 });
    await page.waitForTimeout(4000);          // 예전 방식이었다면 이 사이에 다 받았을 시간
    const 방문만 = fonts.slice();
    say(방문만.length === 0, `${where} — 방문만 하면 인쇄용 글꼴 파일을 하나도 받지 않는다`,
        `${방문만.length}개 · ${mb(방문만)}MB (${방문만.slice(0, 3).map(f => f.url.split("/").pop()).join(", ")})`);

    await page.dispatchEvent("#printBtn", "pointerdown");     // 인쇄 의도
    await page.waitForTimeout(3000);
    const 뒤 = fonts.slice(방문만.length);
    /* ⚠️ 건수만 보면 어떤 벌이 빠졌는지 모른다. 인쇄 본문이 쓰는 **세 굵기**를 이름으로 본다
       (`.pq .content` 는 300, 소제목·표 제목은 700, 문항 메타는 400). */
    const 굵기 = ["Light", "Medium", "Bold"].filter(w => 뒤.some(f => new RegExp("KoPubBatang-" + w, "i").test(f.url)));
    say(굵기.length === 3, `${where} — 인쇄 의도 뒤 KoPub 세 굵기를 받는다`,
        `받은 것: ${굵기.join(", ") || "없음"} (전체 ${뒤.length}개 · ${mb(뒤)}MB)`);
    say(뒤.some(f => /KaTeX_/i.test(f.url)), `${where} — 인쇄 의도 뒤 KaTeX 글꼴도 받는다`,
        `${뒤.length}개`);
    console.log(`     · 인쇄용 글꼴 — 방문만 ${mb(방문만)}MB / 인쇄 의도 뒤 ${mb(뒤)}MB`
              + ` · 화면 글꼴(Pretendard) ${mb(uiFonts)}MB`);
  } catch (e) {
    bad(`${where} — 확인하지 못했다`, String(e).split("\n")[0].slice(0, 140));
  } finally { await b.close(); }
}

/* ── 상단 바 + 본문이 한 화면에 들어가는가 ──────────────────────────────────
 *
 * ⚠️ 예전에는 본문 높이를 `calc(100dvh - 60px)` 로 잡아 **상단 바 높이를 상수로 박아**
 *    뒀다. 좁은 화면에서 상단 바는 줄바꿈해 커지고(375px 에서 215px), 그만큼 본문이
 *    아래로 넘쳤다(`REV-2026-028`). 지금은 세로 flex 라 빼는 값이 없다.
 *    **상수가 다시 들어오는 것을 이 검사가 막는다.**
 * ⚠️ 모의고사는 iframe 이라 특히 나쁘다 — 바깥을 스크롤하면 iframe 위쪽이 고정 상단
 *    바 밑으로 들어간다.
 */
const FIT_VIEWPORTS = [[375, 812], [768, 1024], [1024, 768], [1194, 834]];

async function runViewportFit(engineName, engine) {
  const b = await engine.launch();
  for (const [w, h] of FIT_VIEWPORTS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const page = await ctx.newPage();
    const where = `${engineName} · ${w}×${h}`;
    try {
      await page.goto(`${base}/index.html?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => typeof window.normSet === "function", null, { timeout: 20000 });
      for (const [btn, view, label] of [[null, "#libraryView", "라이브러리"], ["#mockModeBtn", "#mockView", "모의고사"]]) {
        if (btn) { await page.click(btn); await page.waitForTimeout(900); }
        const r = await page.evaluate((sel) => {
          const bar = document.querySelector(".topbar"), v = document.querySelector(sel);
          if (!bar || !v) return null;
          const br = bar.getBoundingClientRect(), vr = v.getBoundingClientRect();
          return { bar: Math.round(br.height), view: Math.round(vr.height),
                   bottom: Math.round(vr.bottom), vh: window.innerHeight,
                   세로넘침: Math.round(document.documentElement.scrollHeight - window.innerHeight) };
        }, view);
        if (!r) { warn(`${where} — ${label} 요소를 못 찾음`); continue; }
        /* 허용오차 2px — 소수점 반올림 */
        say(r.bar + r.view <= r.vh + 2, `${where} — 상단 바 + ${label} 이 한 화면에 든다`,
            `상단 바 ${r.bar} + ${label} ${r.view} = ${r.bar + r.view} > 창 ${r.vh}`);
      }

      /* 모의고사 편집기도 같은 계약을 지킨다. 서버 안내처럼 높이가 가변인 형제와
         출처 고지가 있어도 .panes가 남은 공간만 가져야 한다(`REV-2026-062`). */
      await page.goto(`${base}/mock-exam-editor.html?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => document.querySelector(".panes"), null, { timeout: 20000 });
      const mock = await page.evaluate(() => {
        const note=document.getElementById("serverNote"); if(note) note.hidden=false;
        const bar=document.querySelector(".topbar"), panes=document.querySelector(".panes"),
              footer=document.querySelector("body>footer");
        const br=bar?.getBoundingClientRect(), pr=panes?.getBoundingClientRect(),
              fr=footer?.getBoundingClientRect(), nr=note?.getBoundingClientRect();
        return {missing:!br||!pr||!fr, overflow:document.documentElement.scrollHeight-window.innerHeight,
                panesHeight:Math.round(pr?.height||0), topGap:Math.round((pr?.top||0)-(nr?.bottom||br?.bottom||0)),
                bottomGap:Math.round((fr?.top||0)-(pr?.bottom||0)),
                footerBottom:Math.round(fr?.bottom||0),vh:window.innerHeight};
      });
      say(!mock.missing && mock.overflow<=2 && mock.panesHeight>0 && mock.topGap>=-2 &&
          mock.bottomGap>=-2 && mock.footerBottom<=mock.vh+2,
          `${where} — 모의고사 가변 머리·본문·고지가 한 화면에 든다`, JSON.stringify(mock));
    } catch (e) {
      bad(`${where} — 확인하지 못했다`, String(e).split("\n")[0].slice(0, 140));
    } finally { await ctx.close(); }
  }
  await b.close();
}

/* ── 서버가 필요한 기능을 **누르기 전에** 알리는가 ──────────────────────────
 *
 * ⚠️ 예전에는 눌러 본 뒤에야 "서버를 켜세요" 를 봤고, 그 안내는 **사파리 사용자가 따라
 *    할 수 없는 것**이었다. 실측(2026-09-07 · 세 엔진 · https 페이지 → http loopback):
 *      chromium/firefox : **된다**(200)
 *      webkit           : **막힌다** — 게다가 살아 있는 서버와 죽은 포트가
 *                         **똑같이 `TypeError: Load failed` · 0ms** 라 페이지 안에서는
 *                         구별할 수 없다. 그래서 안내는 **두 가능성을 함께** 말한다.
 * ⚠️ **단추를 비활성화하지 않는다** — 서버를 방금 켰을 수도 있고 우리 감지가 틀렸을
 *    수도 있다. 기대치만 미리 알린다(인앱 로그인과 같은 원칙).
 */
async function runServerNotice(engineName, engine) {
  const b = await engine.launch();
  for (const 서버있음 of [true, false]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    /* ⚠️ **`/health` 를 양쪽 다 흉내 낸다.** 그냥 두면 이 검사가 **개발 컴퓨터에서만**
       통과한다 — `serve.py` 의 `/health` 는 `typst` 가 있어야 `ok:true` 를 내고
       (`serve.py:447`), 없으면 앱이 옳게 '서버 없음' 으로 판단한다. 내 컴퓨터에는
       typst 가 있어 통과했고 **CI 에서만 빨간불이 났다.**
       여기서 보려는 것은 조판 능력이 아니라 **찾았을 때/못 찾았을 때 무엇을 말하는가**
       이므로, 환경에 기대지 않게 응답을 고정한다. */
    await ctx.route("**/health**", (route) => 서버있음
      ? route.fulfill({ status: 200, contentType: "application/json",
                        body: JSON.stringify({ ok: true, typst: true, webfonts: [] }) })
      : route.abort());
    const page = await ctx.newPage();
    const where = `${engineName} · 서버 ${서버있음 ? "있음" : "없음"}`;
    try {
      await page.goto(`${base}/mock-exam-editor.html?xplat=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => typeof window.markServerFeatures === "function", null, { timeout: 20000 });
      /* ⚠️ **고정 시간으로 기다리지 않는다.** `pingServer()` 는 같은 출처 + 포트 셋을
         차례로 두드리고 하나에 1.5초 상한이라 느린 기기에서는 4초를 넘긴다 — CI 의
         firefox 가 그래서 아직 판정 전인 화면을 보고 빨간불이 났다.
         `markServerFeatures()` 는 어느 쪽으로 끝나든 단추에 `okTitle` 을 남긴다.
         **그 자국**을 기다린다(어느 쪽으로 끝났는지는 말하지 않으므로 검사가 헛돌지 않는다). */
      await page.waitForFunction(
        () => document.getElementById("liveBtn")?.dataset.okTitle !== undefined,
        null, { timeout: 20000 });
      const r = await page.evaluate(() => ({
        안내: !document.getElementById("serverNote")?.hidden,
        이유: (document.getElementById("serverNoteWhy")?.textContent || "").trim(),
        표시: [...document.querySelectorAll(".needs-server")].map((e) => e.id).sort(),
        살아있나: ["liveBtn", "hwpxBtn"].every((id) => { const e = document.getElementById(id); return e && !e.disabled; }),
      }));
      if (서버있음) {
        say(!r.안내, `${where} — 안내를 띄우지 않는다`, `띄웠다: ${r.이유.slice(0, 40)}`);
        say(r.표시.length === 0, `${where} — 단추에 '서버' 표시가 없다`, r.표시.join(", "));
      } else {
        say(r.안내, `${where} — 누르기 전에 미리 알린다`);
        say(r.표시.join(",") === "hwpxBtn,liveBtn", `${where} — 서버가 필요한 단추를 표시한다`, r.표시.join(", ") || "없음");
        /* ⚠️ 두 가능성을 **함께** 말해야 한다 — 하나만 말하면 절반이 따라 할 수 없다. */
        say(/serve\.py/.test(r.이유) && /사파리|브라우저/.test(r.이유),
            `${where} — 서버 켜기와 브라우저 제약을 함께 알린다`, r.이유.slice(0, 60));
      }
      say(r.살아있나, `${where} — 단추를 막지는 않는다`, "비활성화되어 있다");
    } catch (e) {
      bad(`${where} — 확인하지 못했다`, String(e).split("\n")[0].slice(0, 140));
    } finally { await ctx.close(); }
  }
  await b.close();
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
          크기: { w: Math.round(q.width), h: Math.round(q.height) },
          넘침: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      if (r.없음) { bad(`${where} — ${r.없음}가 없다`); }
      else {
        say(r.안, `${where} — '밖에서 열기' 를 누를 수 있다`, `${r.자리} (창 375×812)`);
        /* ⚠️ 위치만 보고 **크기를 안 봤다**(`REV-2026-027`). 인앱에서 유일한 탈출 경로라
           작으면 안 된다 — 본체와 같은 44px 기준을 여기서도 적용한다. */
        say(r.크기.w >= TOUCH_MIN && r.크기.h >= TOUCH_MIN,
            `${where} — '밖에서 열기' 가 ${TOUCH_MIN}px 이상`, `${r.크기.w}×${r.크기.h}`);
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
    await runViewportFit(name, engine);
    await runFontIntent(name, engine);
    await runServerNotice(name, engine);
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
