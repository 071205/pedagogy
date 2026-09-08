import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => stat(new URL(path, root)).then(() => true, () => false);

const [index, normalize, mock, documentEditor, worker, rules, storageRules, config, workflow, integration, server, manifest, visual] = await Promise.all([
  text("index.html"),
  text("pedagogy-normalize.js"),
  text("mock-exam-editor.html"),
  text("document-editor.html"),
  text("worker/index.js"),
  text("firestore.rules"),
  text("storage.rules"),
  text("service-config.js"),
  text(".github/workflows/verify.yml"),
  text("tests/integration-test.html"),
  text("serve.py"),
  text("package.json"),
  text("scripts/visual-regression.mjs"),
]);

const csp = index.match(/<meta http-equiv="Content-Security-Policy" content="([\s\S]*?)">/i)?.[1];
assert.ok(csp, "Content Security Policy meta 태그가 필요합니다");
const cspDirective = (name) => csp.match(new RegExp(name + "\\s+([^;]+);", "i"))?.[1] || "";

assert.match(index, /firebase-app-check-compat\.js/, "Firebase App Check SDK가 로드돼야 합니다");
assert.match(index, /ReCaptchaEnterpriseProvider/, "App Check는 reCAPTCHA Enterprise provider를 써야 합니다");
assert.match(cspDirective("script-src"), /https:\/\/www\.google\.com/,
  "App Check reCAPTCHA 스크립트 호스트가 CSP script-src에 있어야 합니다");
assert.match(cspDirective("frame-src"), /https:\/\/www\.google\.com/,
  "App Check reCAPTCHA 프레임 호스트가 CSP frame-src에 있어야 합니다");
assert.match(cspDirective("connect-src"), /dawn-shape-2664\.dbruddl79\.workers\.dev/,
  "AI Worker API 호스트가 CSP connect-src에 있어야 합니다");
assert.doesNotMatch(index, /await purgeAiUsage\(/, "일반 사용자에게 비용 한도 초기화 권한을 주면 안 됩니다");
/* ⚠️ **규칙의 상한과 앱의 상한이 어긋나면 그 길이의 제목은 영영 저장되지 않는다.**
   앱은 200자까지 받는데 규칙이 160에서 끊고 있었다 — 저장이 '권한 오류' 로 실패했고
   아무 검사도 그것을 보지 않았다. 두 숫자를 여기서 묶는다(브라우저도 파이썬도 필요 없어
   CI 에서 늘 돈다). */
{
  const inRules = /name\.size\(\)\s*<=\s*(\d+)/.exec(rules);
  /* ⚠️ 정규화는 `pedagogy-normalize.js` 로 옮겼다(구조 1단계) — index.html 이 아니라
     그 파일을 본다. 여기서 index.html 을 계속 보면 상한이 어긋나도 조용히 통과한다. */
  const inApp = /const SET_NAME_MAX\s*=\s*(\d+)/.exec(normalize);
  assert.ok(inRules, "firestore.rules 에서 이름 상한을 찾지 못했습니다");
  assert.ok(inApp, "pedagogy-normalize.js 에서 SET_NAME_MAX 를 찾지 못했습니다");
  assert.equal(inApp[1], inRules[1],
    `문제집 이름 상한이 어긋납니다 — 앱 ${inApp[1]} · 규칙 ${inRules[1]}. `
    + "앱이 더 크면 그 길이의 제목이 '권한 오류' 로 저장되지 않습니다.");
  assert.match(normalize, /name:str\(s\.name,lossless\?Infinity:SET_NAME_MAX\)/,
    "normSet 이 SET_NAME_MAX 를 써야 두 값이 실제로 이어집니다");
}

/* ⚠️ **화면 요소를 `visibility` 로 숨기지 말 것 — `display` 로 숨긴다**(`REV-2026-059`).
   이 저장소의 버튼·입력은 `transition:.13s` 처럼 **속성 목록 없는 shorthand**(= `all`)를
   쓴다. 그러면 `visibility` 도 **이산 전이**를 타서, 부모를 `visibility:hidden` 으로 꺼도
   자식이 **약 130ms 동안 보이고 눌린다** — 라이브러리에서 인쇄·내보내기 모달이 실제로
   열렸다. 통제 실험으로 확인했다:

     transition:.13s (목록 없음)      → 숨긴 직후 visible · 400ms 뒤 hidden
     transition:background-color .13s → 숨긴 직후 hidden
     전이 없음                        → 숨긴 직후 hidden

   ⚠️ **`transition` 쪽을 고치지 않고 이 짝을 막는다.** 목록 없는 shorthand 가 세 화면에
      23곳이라 전부 다시 쓰면 시각 동작이 통째로 바뀐다 — 위험 대비 이득이 나쁘다.
      함정은 `all` 단독으로는 안 터지고 **`visibility` 로 숨길 때만** 터지므로, 그 짝을
      여기서 금지한다. 숨김은 `setEditorActions()` 처럼 `display` 로 한다.
   (모의고사의 화면 밖 측정 노드는 `style.cssText` 로 한 번에 넣으므로 이 규칙 밖이다 —
    그건 사용자가 볼 수 있는 조작이 아니라 폭을 재려고 만드는 임시 요소다.) */
for (const [name, src] of [["index.html", index], ["mock-exam-editor.html", mock],
                           ["document-editor.html", documentEditor]]) {
  assert.doesNotMatch(src, /\.style\.visibility\s*=/,
    `${name} 에서 \`.style.visibility\` 로 숨기고 있습니다 — \`display\` 로 바꾸세요. `
    + "목록 없는 `transition` shorthand 가 `all` 이라 약 130ms 동안 요소가 보이고 눌립니다"
    + "(REV-2026-059).");
}

assert.match(worker, /async alarm\(\)/, "AI quota는 자동 파기 alarm이 필요합니다");
assert.match(worker, /QUOTA_RETENTION_MS/, "AI quota 보존 기간 상수가 필요합니다");
assert.match(worker, /MAX_DAILY_LIMIT/, "AI 비용을 위한 절대 일일 상한이 필요합니다");
assert.match(worker, /await quotaKey\(uid/, "Worker 저장소 이름에 UID 원문을 쓰면 안 됩니다");
assert.match(worker, /"consume"/, "외부 AI 호출 전 quota 확정이 필요합니다");
assert.doesNotMatch(worker, /detail:\s*String/, "내부 오류 원문을 클라이언트에 반환하면 안 됩니다");
assert.doesNotMatch(worker, /console\.error\([^)]*(?:e\.message|e\?\.message|releaseError)/,
  "원문 오류를 Worker 로그에 남기면 이미지·공급자 정보가 반사될 수 있습니다");
assert.match(rules, /problems\.size\(\) <= 20000/, "Firestore 문제 수 상한이 필요합니다");
assert.match(rules, /affectedKeys\(\)/, "구형 sets 배열 쓰기는 막아야 합니다");
assert.match(storageRules, /image\/\(jpeg\|png\|webp\|gif\)/, "Storage MIME allowlist가 필요합니다");
assert.match(storageRules, /match \/users\/\{uid\}\/images\/\{imageId\}/,
  "Storage 이미지는 한 단계 경로로만 허용해야 합니다");
assert.match(index, /getIdTokenResult\(\)/, "플랜 표시는 서명된 Firebase claim에서 읽어야 합니다");
assert.doesNotMatch(config, /^\s*(anthropicKey|pgSecret|webhookSecret|serviceAccount|privateKey)\s*:/im,
  "공개 설정 파일에 비밀값을 넣으면 안 됩니다");
assert.equal(await exists("worker/worker-single-file.js"), false,
  "운영 Worker는 Wrangler 단일 진입점만 유지해야 합니다");
assert.match(workflow, /fetch-depth:\s*2/, "CI는 git diff에 필요한 직전 커밋까지 받아야 합니다");
assert.match(workflow, /npm ci/, "CI는 고정된 테스트 의존성을 설치해야 합니다");
assert.match(workflow, /npm run check:fast/, "CI는 기준 문제집 형식도 확인해야 합니다");
assert.match(workflow, /npm run check:rules/, "CI는 Firebase Rules 실제 검사를 실행해야 합니다");
assert.match(manifest, /"test:visual"/, "시각 회귀 검사는 npm 명령으로 실행할 수 있어야 합니다");
assert.match(manifest, /"update:visual-baseline"/, "기준 시각본 갱신 명령이 필요합니다");
assert.match(workflow, /playwright install --with-deps chromium/, "CI는 시각 검사 전 고정 Chromium을 설치해야 합니다");
assert.match(workflow, /npm run test:visual/, "CI는 인쇄 시각 회귀 검사를 실행해야 합니다");
assert.match(visual, /setInputFiles\("#importAllInput"/, "시각 검사는 실제 전체 가져오기 input을 거쳐야 합니다");
assert.match(visual, /buildPrintDoc\(false\)/, "시각 검사는 실제 인쇄 문서를 만들어야 합니다");
assert.match(visual, /pixelmatch\(/, "시각 검사는 PNG 픽셀 비교를 해야 합니다");
assert.match(visual, /MAX_DIFF_RATIO/, "시각 검사는 제한된 픽셀 차이 한도를 가져야 합니다");
/* 기준 시각본은 **만든 OS 별**로 둔다(`REV-2026-018`). 어느 OS 것이든 한 벌은 있어야
   하고, 있는 벌은 네 장이 다 있어야 한다 — 한 장만 빠지면 그 문항만 조용히 안 보게 된다. */
const platforms = (await readdir(new URL("test-fixtures/visual-baseline", root), { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name);
assert.ok(platforms.length > 0,
  "시각 회귀 기준본이 한 벌도 없습니다 (test-fixtures/visual-baseline/<platform>/)");
for (const platform of platforms) {
  for (const name of ["math-print", "korean-passage-print", "image-print", "overflow-print"]) {
    assert.equal(await exists(`test-fixtures/visual-baseline/${platform}/${name}.png`), true,
      `시각 회귀 기준본 ${platform}/${name}.png이 필요합니다`);
  }
}
assert.match(integration, /#importAllInput/, "격리 통합 검사는 실제 전체 가져오기 input을 거쳐야 합니다");
assert.match(integration, /await loadApp\(\)/, "격리 통합 검사는 저장 뒤 앱을 새로고침해 복원을 확인해야 합니다");
assert.match(integration, /buildPrintDoc\(false\)/, "격리 통합 검사는 실제 인쇄 DOM 생성 경로를 거쳐야 합니다");
assert.match(integration, /fitPrintDoc\(\)/, "격리 통합 검사는 인쇄 오버플로 보정을 확인해야 합니다");
assert.match(server, /"\/integration-test\.html"/, "로컬 서버는 격리 통합 검사 페이지만 화이트리스트로 제공해야 합니다");
assert.match(server, /mock_to_hwpx\.build\(req, out, images=\[WORK\]\)/,
  "HWPX 내보내기는 편집기가 안내한 work 그림 폴더만 전달해야 합니다");
assert.match(server, /"\/document-hwpx"/, "범용 문서 HWPX 내보내기 경로가 필요합니다");
assert.match(server, /load_document_hwpx/, "범용 문서 변환기도 잠금 안에서 불러와야 합니다");
const hwpxConverter = await text("experiments/hwp-export/mock_to_hwpx.py");
assert.doesNotMatch(hwpxConverter, /from jakal_hwpx|import jakal_hwpx/,
  "HWPX 내보내기 런타임은 외부 jakal-hwpx를 직접 불러오면 안 됩니다");
assert.doesNotMatch(server, /importlib\.reload\(mock_to_hwpx\)/,
  "요청마다 변환기를 reload 하면 안 됩니다 — 이 서버는 스레드로 동시 요청을 받습니다");
assert.match(server, /def load_hwpx\(/, "HWPX 변환기는 잠금 안에서 한 번만 불러와야 합니다");

// ── 선지 배치 정답표가 낡지 않았는가 ──────────────────────────────────────
// 파이썬 검사(test_layout.py)는 이 정답표를 상대로 변환기를 대조한다. 편집기의 배치
// 규칙이 바뀌면 정답표가 조용히 낡고, 그 검사는 **낡은 표를 상대로 계속 통과**한다.
// 여기서 지문을 맞춰 그 상태를 막는다. 브라우저도 파이썬도 필요 없어 항상 돈다.
if (await exists("experiments/hwp-export/samples/choice-layout-truth.json")) {
  const { fingerprint } = await import("./editor-layout-rules.mjs");
  const mockEditor = await text("mock-exam-editor.html");
  const truth = JSON.parse(await text("experiments/hwp-export/samples/choice-layout-truth.json"));
  assert.ok(Object.keys(truth.layouts || {}).length,
    "선지 배치 정답표가 비어 있습니다 — 아무것도 검사하지 않게 됩니다");
  assert.equal(truth._editorRules, fingerprint(mockEditor),
    "편집기의 선지 배치 규칙이 바뀌었는데 정답표를 다시 재지 않았습니다. "
    + "UPDATE_HWPX_TRUTH=1 node scripts/check-hwpx-parity.mjs 를 실행하세요");
}

// ── 인앱 로그인 안내가 두 화면에서 **같게 동작하는가** ────────────────────
// 빌드 단계가 없어 `index.html` 과 `document-editor.html` 이 각자 사본을 안고 있다.
// ⚠️ **사본은 갈라진다.** 처음에는 앱 이름 목록만 견줬는데 — 그것으로는
//    **갈래 순서가 어긋난 것을 못 잡았다.** 같은 카톡 + `auth/popup-blocked` 인데
//    본체는 "팝업을 허용해 주세요"(인앱에는 허용할 설정이 없다), 문서 편집기는
//    "사파리나 크롬에서 열어 주세요" 라고 했다(`REV-2026-026`).
//    그래서 이제 **두 구현을 실제로 실행해** UA × 오류코드 표를 통째로 견준다.
{
  const docEditor = await text("document-editor.html");

  // 두 파일에서 함수 원문을 그대로 떼어 낸다(사본이 아니라 **그 파일의 코드**를 잰다)
  const grab = (src, name, where) => {
    const re = new RegExp(`(?:const ${name}\\s*=\\s*\\[[\\s\\S]*?\\];|function ${name}\\([\\s\\S]*?\\n\\})`);
    const m = src.match(re);
    assert.ok(m, `${where} 에 ${name} 이 없습니다`);
    return m[0];
  };
  const build = (src, where) => {
    const body = [grab(src, "IN_APP_BROWSERS", where), grab(src, "inAppBrowserName", where),
                  grab(src, "authErrorMessage", where)].join("\n");
    // navigator·location 만 갈아 끼우고 실제 코드를 그대로 돌린다
    return new Function("navigator", "location", `${body}; return {inAppBrowserName, authErrorMessage};`);
  };
  const A = build(index, "index.html");
  const B = build(docEditor, "document-editor.html");

  const UAS = [
    ["카톡",   "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 KAKAOTALK 10.4.5"],
    ["네이버", "Mozilla/5.0 (Linux; Android 14) Chrome/120 NAVER(inapp; search; 1200; 12.5.2)"],
    ["인스타", "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 302.0.0.23.113"],
    ["사파리", "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"],
    ["크롬",   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"],
  ];
  const CODES = ["auth/popup-blocked", "auth/internal-error", "auth/network-request-failed",
                 "auth/operation-not-supported-in-this-environment", "auth/popup-closed-by-user",
                 "auth/cancelled-popup-request", "auth/unauthorized-domain", "auth/weird-unknown"];

  const diffs = [];
  for (const [label, ua] of UAS) {
    const loc = { hostname: "example.test", href: "https://example.test/" };
    const a = A({ userAgent: ua }, loc), b = B({ userAgent: ua }, loc);
    if (a.inAppBrowserName(ua) !== b.inAppBrowserName(ua))
      diffs.push(`${label}: 감지 ${a.inAppBrowserName(ua)} ≠ ${b.inAppBrowserName(ua)}`);
    for (const code of CODES) {
      const x = a.authErrorMessage({ code }), y = b.authErrorMessage({ code });
      if (x !== y) diffs.push(`${label} + ${code}\n      index=${x}\n      document=${y}`);
    }
  }
  assert.equal(diffs.length, 0,
    "인앱 로그인 안내가 두 화면에서 다릅니다 — 같은 상황에 다른 말을 하게 됩니다:\n    " + diffs.join("\n    "));

  // 검사가 헛돌지 않는지: 표가 실제로 인앱을 구분하는지 확인한다
  const probe = A({ userAgent: "Mozilla/5.0 KAKAOTALK" }, { hostname: "x", href: "https://x/" });
  assert.match(probe.authErrorMessage({ code: "auth/popup-blocked" }), /사파리|크롬/,
    "인앱에서 팝업 차단은 '밖에서 열라' 로 안내해야 합니다 — 인앱에는 허용할 팝업 설정이 없습니다");

  // ⚠️ 감지는 **힌트일 뿐**이고 로그인 버튼을 없애면 안 된다(오탐 시 멀쩡한 브라우저에서
  //    로그인이 사라진다).
  assert.doesNotMatch(index, /loginBtn"\)\.(disabled\s*=\s*true|remove\(\))/,
    "인앱 감지로 로그인 버튼을 없애면 안 됩니다 — 감지는 힌트일 뿐입니다");

  // ⚠️ 두 화면 모두 **나갈 길**이 있어야 한다. 안내만 하고 동작이 없으면 소용이 없다.
  for (const [src, where] of [[index, "index.html"], [docEditor, "document-editor.html"]]) {
    assert.match(src, /async function openOutsideHint\(/,
      `${where} 에 '밖에서 열기' 동작이 없습니다 — 안내만 하고 나갈 길이 없습니다`);
    assert.match(src, /await navigator\.clipboard\.writeText/,
      `${where} 는 클립보드 Promise 를 기다려야 합니다 — 거부돼도 성공했다고 말하게 됩니다`);
  }
}

// ── 모바일 뷰포트 높이 단위 ────────────────────────────────────────────────
// ⚠️ `100vh` 는 모바일에서 실제 보이는 높이보다 크다(주소창). `dvh` 가 답이지만
//    **`vh` 줄을 폴백으로 앞에 남겨야** 구형 브라우저에서 높이가 사라지지 않는다.
//    순서가 뒤집히면 최신 브라우저가 `vh` 를 쓰게 되어 고친 의미가 없다.
// ⚠️ **파일 전체에서 `/* *\/` 를 지우면 안 된다.** 처음에 그렇게 했다가 JS 안의
//    주석·문자열까지 엮여 본문이 통째로 사라졌고, `88vh` 를 쓰는 모달 줄을 못 찾아
//    "검사가 헛돌고 있다" 는 자기 경고가 떴다. **CSS 만 골라** 본다.
{
  const styleBlocks = [...index.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  assert.ok(styleBlocks.length, "<style> 블록을 찾지 못했습니다");
  const inlineStyles = [...index.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
  const decls = [
    ...styleBlocks.join("\n").replace(/\/\*[\s\S]*?\*\//g, "").split(/[\n;]/),
    ...inlineStyles.join(";").split(";"),
  ].map((d) => d.trim()).filter(Boolean);

  const vhDecls = decls.filter((d) => /\b\d[\d.]*vh\b/.test(d));
  assert.ok(vhDecls.length >= 3,
    `vh 선언을 ${vhDecls.length}개만 찾았습니다 — 이 검사가 헛돌고 있습니다`);
  for (const d of vhDecls) {
    const prop = d.split(":")[0].trim();
    /* ⚠️ `/\bdvh\b/` 는 `100dvh` 를 **못 잡는다** — `0` 과 `d` 사이에 낱말 경계가 없다.
       이걸로 한참 헤맸다(짝이 있는데 없다고 나왔다). */
    const twin = decls.find((x) => x.startsWith(prop + ":") && /\ddvh\b/.test(x));
    assert.ok(twin, `\`${d.slice(0, 70)}\` 에 \`dvh\` 짝이 없습니다(모바일 주소창)`);
    // 같은 선언 안에 둘 다 있으면 순서까지 본다(`min-height:100vh;min-height:100dvh`)
    const line = decls.find((x) => x === d);
    assert.ok(decls.indexOf(d) < decls.indexOf(twin) || d === twin,
      `\`vh\` 선언이 \`dvh\` 보다 **앞**에 와야 폴백이 됩니다: ${d.slice(0, 70)}`);
  }
}

// ── 아이폰 노치와 `viewport-fit` ────────────────────────────────────────────
// ⚠️ **직관과 반대다.** WebKit 의 기본값 `viewport-fit=auto` 는 콘텐츠를 **이미 안전
//    영역 안에** 넣어 준다. `viewport-fit=cover` 를 넣어야 화면 끝까지 펼쳐지고,
//    **그때 비로소** `env(safe-area-inset-*)` 보정이 필요해진다.
//    즉 `cover` 를 그냥 추가하면 **없던 가림을 새로 만든다**(`HANDOFF-2026-051`, Codex).
// 그래서 규칙은 "쓰지 마라" 가 아니라 **"쓸 거면 보정도 같이 하라"** 다.
{
  const docEditor2 = await text("document-editor.html");
  const mock = await text("mock-exam-editor.html");
  for (const [src, where] of [[index, "index.html"], [docEditor2, "document-editor.html"], [mock, "mock-exam-editor.html"]]) {
    if (!/viewport-fit\s*=\s*cover/.test(src)) continue;
    assert.match(src, /env\(\s*safe-area-inset-/,
      `${where} 가 viewport-fit=cover 를 쓰면서 env(safe-area-inset-*) 보정이 없습니다 — `
      + "노치·홈 인디케이터에 UI 가 가립니다. cover 를 뺄지 보정을 넣을지 정하세요");
  }
}

console.log("Commercial static checks passed");
