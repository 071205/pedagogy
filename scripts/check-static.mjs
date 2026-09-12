import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => stat(new URL(path, root)).then(() => true, () => false);

const [index, normalize, mock, documentEditor, legal, engine, texToHwp, worker, appCheckWorker, rules, storageRules, config, workflow, integration, server, manifest, visual] = await Promise.all([
  text("index.html"),
  text("pedagogy-normalize.js"),
  text("mock-exam-editor.html"),
  text("document-editor.html"),
  text("legal.html"),
  text("hwpx-engine.js"),
  text("experiments/hwp-export/tex_to_hwp.py"),
  text("worker/index.js"),
  text("worker/app-check.js"),
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
assert.match(index, /X-Firebase-AppCheck/, "문제 이미지 AI 요청은 App Check 토큰을 Worker에 보내야 합니다");
assert.match(documentEditor, /firebase-app-check-compat\.js/, "AI 문서도 App Check SDK를 로드해야 합니다");
assert.match(documentEditor, /ReCaptchaEnterpriseProvider/, "AI 문서도 App Check provider를 초기화해야 합니다");
assert.match(documentEditor, /X-Firebase-AppCheck/, "AI 문서 요청도 App Check 토큰을 Worker에 보내야 합니다");
assert.match(worker, /verifyAppCheck\(appCheckToken/, "Worker는 자체 백엔드용 App Check 토큰을 검증해야 합니다");
assert.match(appCheckWorker, /firebaseappcheck\.googleapis\.com\/v1\/jwks/, "App Check 전용 JWKS를 사용해야 합니다");
assert.match(appCheckWorker, /allowedAppIds\.includes\(claims\.sub\)/, "App Check app ID allowlist를 검증해야 합니다");
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

   ⚠️ **이건 보조망이다.** 여기서 잡는 것은 **직접 대입(`.style.visibility =`)뿐**이고,
      `cssText`·`setProperty`·CSS 클래스 같은 우회는 못 잡는다. 그런 우회를 쫓아 정규식을
      늘려 가지 말 것 — **실제 보장은 브라우저 회귀**(`test:library-ui` 의
      `editor-only top actions …` 둘)가 한다. 이 검사는 가장 흔한 실수를 값싸게 막을 뿐이다.
   ⚠️ **`transition` 쪽을 고치지 않고 이 짝을 막는다.** 목록 없는 shorthand 가 세 화면에
      23곳이라 전부 다시 쓰면 시각 동작이 통째로 바뀐다 — 위험 대비 이득이 나쁘다.
      함정은 `all` 단독으로는 안 터지고 **`visibility` 로 숨길 때만** 터지므로, 그 짝을
      여기서 금지한다. 숨김은 `setEditorActions()` 처럼 `display` 로 한다.
   (모의고사의 화면 밖 측정 노드는 `style.cssText` 로 한 번에 넣으므로 이 규칙 밖이다 —
    그건 사용자가 볼 수 있는 조작이 아니라 폭을 재려고 만드는 임시 요소다.) */
for (const [name, src] of [["index.html", index], ["mock-exam-editor.html", mock],
                           ["document-editor.html", documentEditor]]) {
  assert.doesNotMatch(src, /\.style\.visibility\s*=/,
    `${name} 에서 \`.style.visibility\` 직접 대입이 있습니다 — \`display\` 로 바꾸세요. `
    + "목록 없는 `transition` shorthand 가 `all` 이라 약 130ms 동안 요소가 보이고 눌립니다"
    + "(REV-2026-059).");
}

/* ⚠️ **저작권 조항이 요구하는 고지다 — 지우면 라이선스 조건을 어긴다.**
   한컴 수식 규격서(`docs/HWP-SPEC.md` §배포 조건)는 이 문장을 **제품 내 유저인터페이스,
   매뉴얼, 도움말 및 소스에 모두** 기재하라고 요구한다. 예전에는 **소스에만** 있었다
   (`hwpx-engine.js`·`tex_to_hwp.py`) — 화면 넷에는 하나도 없어 조건을 못 지키고 있었다.
   ⚠️ 문구를 바꾸지 말 것. 규격서가 문장을 그대로 지정한다. */
const HWP_NOTICE = "본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.";
for (const [name, src] of [["index.html", index], ["mock-exam-editor.html", mock],
                           ["document-editor.html", documentEditor], ["legal.html", legal],
                           ["hwpx-engine.js", engine],
                           ["experiments/hwp-export/tex_to_hwp.py", texToHwp]]) {
  assert.ok(src.includes(HWP_NOTICE),
    `${name} 에 한컴 규격서 출처 고지가 없습니다 — 저작권 조항이 UI·매뉴얼·도움말·소스에 `
    + `**모두** 요구합니다(docs/HWP-SPEC.md). 문구: "${HWP_NOTICE}"`);
}
/* ⚠️ **어딘가에 문자열이 있다** 로는 부족하다 — 화면에 안 보이는 주석에 들어 있어도
   통과한다. `index.html` 은 고지를 푸터에서 `설정 → 정보` 로 옮겼으므로(`-098` 3번)
   **그 자리를 실제로** 본다. 개수를 줄이지 않고 위치를 더 좁힌 것이다. */
{
  const about = index.match(/<section id="stPanAbout"[\s\S]*?<\/section>/);
  assert.ok(about, "index.html 에서 설정의 '정보' 갈래를 찾지 못했습니다");
  assert.ok(about[0].includes(HWP_NOTICE),
    "한컴 규격서 고지가 `설정 → 정보` 안에 없습니다 — 자리를 옮겼다면 이 대조도 함께 옮기세요");
  /* ⚠️ 그 화면에 **닿을 수 있어야** 고지한 것이다. 라이브러리(레일)와 편집기(상단) 양쪽에
     입구가 있어야 하고, 돌아갈 길도 있어야 한다 — 그것이 이동의 전제였다. */
  for (const id of ["settingsBtn", "editorSettingsBtn", "mockSettingsBtn", "stTabAbout", "settingsBack"]) {
    assert.match(index, new RegExp(`id="${id}"`),
      `설정 화면 입구/복귀 요소 ${id} 가 없습니다 — 닿을 수 없는 곳의 고지는 고지가 아닙니다`);
  }
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

// ── 모의고사 라이브러리 저장 계층이 실제로 배달되는가 ──────────────────────
// ⚠️ 새 모듈은 **세 곳**을 함께 고쳐야 산다 — `index.html` 의 `<script src>`,
//    `serve.py` 의 `STATIC`, 그리고 이 대조. 빼먹으면 각각 정의되지 않은 이름 ·
//    404 · **조용한 통과**가 된다(구조 분리에서 이미 겪은 방식이다).
{
  const serve = await text("serve.py");
  assert.match(index, /<script src="mock-library-store\.js"><\/script>/,
    "index.html 이 mock-library-store.js 를 불러오지 않습니다 — 모의고사 라이브러리가 죽습니다");
  assert.match(serve, /"\/mock-library-store\.js":/,
    "serve.py 의 STATIC 에 mock-library-store.js 가 없습니다 — 로컬에서 404 로 죽습니다");
  // ⚠️ **`postMessage` 를 `'*'` 로 보내지 말 것.** 남이 iframe 으로 끼우면 시험지 내용이
  //    그대로 넘어간다. 같은 출처로 보내고, 출처가 없는 `file://` 에서만 `'*'` 로 떨어진다.
  const mockDoc = await text("mock-exam-editor.html");
  for (const [src, where] of [[index, "index.html"], [mockDoc, "mock-exam-editor.html"]]) {
    /* ⚠️ 인자 하나를 통째로 잡는 정규식(`[^)]*`)은 `Object.assign(...)` 의 `)` 를 못 넘어
       **아무것도 안 잡는다**(실제로 고장을 심었는데 통과했다). 줄 단위로 본다. */
    const bad = src.split("\n").filter((l) => /\.postMessage\s*\(/.test(l) && /,\s*['"]\*['"]\s*\)/.test(l));
    assert.deepEqual(bad, [],
      `${where} 가 postMessage 를 '*' 로 보냅니다 — 남의 페이지가 시험지 내용을 받습니다`);
    assert.match(src, /location\.origin\s*&&\s*location\.origin\s*!==\s*"?'?null'?"?\s*\)\s*\?\s*location\.origin\s*:\s*["']\*["']/,
      `${where} 에 같은 출처 targetOrigin 규칙이 없습니다`);
  }
}

// ── 모의고사 클라우드 문서 모양 ↔ Rules 화이트리스트 ───────────────────────
// ⚠️ **필드를 하나 더하면 두 곳을 함께 고쳐야 한다.** `firestore.rules` 의
//    `hasOnly([...])` 에 없는 필드를 보내면 저장이 통째로 '권한 오류' 로 실패한다 —
//    문제집에서 이미 겪은 사고이고, 화면에는 "저장 실패" 한 줄만 뜬다.
{
  const rules = await text("firestore.rules");
  const body = index.match(/function mockToDoc\(e\)\{[\s\S]*?\n\}/);
  assert.ok(body, "index.html 에서 mockToDoc() 을 찾지 못했습니다");
  const sent = [...body[0].matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]);
  const block = rules.match(/function hasMockShape\(\)[\s\S]*?hasOnly\(\s*\[([^\]]*)\]/);
  assert.ok(block, "firestore.rules 에서 hasMockShape() 의 hasOnly 목록을 찾지 못했습니다");
  const allowed = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(sent)].sort(), [...new Set(allowed)].sort(),
    "모의고사 클라우드 문서 필드와 firestore.rules 의 허용 목록이 다릅니다 — 저장이 권한 오류로 실패합니다");
  // tombstone 도 같은 화이트리스트를 지나므로 필드가 빠지면 삭제가 거부된다.
  const tomb = index.match(/await MOCKS_COL\(owner\)\.doc\(String\(removed\.id\)\)\.set\(\{([\s\S]*?)\}\);/);
  assert.ok(tomb, "index.html 에서 모의고사 tombstone 쓰기를 찾지 못했습니다");
  const tombKeys = [...tomb[1].matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tombKeys)].sort(), [...new Set(allowed)].sort(),
    "tombstone 이 보내는 필드가 Rules 허용 목록과 다릅니다 — 삭제가 다른 기기에 퍼지지 않습니다");
}

// ── 법정 기재사항과 동의 버전 ──────────────────────────────────────────────
// ⚠️ **빠짐은 표현의 문제가 아니라 사실의 문제다.** 개인정보처리방침의 법정 항목은
//    하나라도 없으면 그 자체로 흠결이다(`docs/LEGAL-COMPLIANCE.md`). 사람이 문서를
//    고치다 지우는 것을 막는다.
{
  const legal = await text("legal.html");
  const REQUIRED = [
    "수집하는 개인정보 항목", "처리 목적", "보유 및 이용 기간", "파기",
    "위탁 및 국외 이전", "정보주체의 권리", "안전성 확보 조치",
    "쿠키", "만 14세 미만", "개인정보 보호책임자", "권익침해 구제",
    "개인정보처리방침의 변경", "유출", "자동화된 결정",
  ];
  const missing = REQUIRED.filter((k) => !legal.includes(k));
  assert.deepEqual(missing, [],
    `개인정보처리방침에서 법정 기재사항이 빠졌습니다: ${missing.join(", ")} — docs/LEGAL-COMPLIANCE.md 참고`);

  // ⚠️ 약관을 고치고 동의 버전을 안 올리면 "무엇에 동의했는지" 를 말할 수 없다.
  const docVer = legal.match(/버전 <code>(v[0-9-]+)<\/code>/);
  assert.ok(docVer, "legal.html 에서 문서 버전을 찾지 못했습니다");
  const appVer = index.match(/const CONSENT_VERSION="([^"]+)"/);
  assert.ok(appVer, "index.html 에서 CONSENT_VERSION 을 찾지 못했습니다");
  assert.equal(appVer[1], docVer[1],
    `동의 버전(${appVer[1]})과 법률 문서 버전(${docVer[1]})이 다릅니다 — 약관을 고쳤으면 동의를 다시 받아야 합니다`);

  // 항목별 동의 — 필수 넷을 다 받고 있는가(한 줄짜리 확인창으로 되돌아가지 않게)
  for (const id of ["csAge", "csTerms", "csPrivacy", "csAbroad"]) {
    assert.match(index, new RegExp(`id="${id}"`), `로그인 동의 항목 ${id} 가 없습니다`);
  }
  assert.match(index, /class="cs-req"/, "필수 동의 표시(cs-req)가 없습니다");
  assert.doesNotMatch(index, /id="csAbroad"[\s\S]{0,700}AI 사진 변환은/,
    "로그인 국외이전 동의에 선택적 AI 전송을 묶으면 안 됩니다 — AI 실행 시 별도로 고지합니다");
  assert.match(index, /csPrivacy[\s\S]{0,700}계정 삭제 시까지[\s\S]{0,400}동의하지 않아도/,
    "개인정보 수집·이용 동의에는 보유기간과 거부 효과를 함께 알려야 합니다");
  assert.ok(!/function confirmLoginConsent\(/.test(index),
    "브라우저 confirm() 동의로 되돌아갔습니다 — 항목별 동의와 전문 링크가 사라집니다");

  // 번역문은 법적 효력이 있는 원문처럼 보이면 안 된다. 제공 언어마다 AI 보조·오류 가능성·
  // 한국어 원문 우선과 전문이 아닌 핵심 안내라는 한계를 해당 언어로 직접 알려야 한다.
  for (const lang of ["en", "ja", "zh"]) {
    assert.match(legal, new RegExp(`class="lang-panel lang-${lang}"`),
      `법률정보 ${lang} 번역 패널이 없습니다`);
  }
  for (const marker of ["AI-assisted translation notice", "AI支援翻訳に関する注意", "AI辅助翻译提示",
                        "Korean original controls", "韓国語原文が優先", "以韩文原文为准"])
    assert.ok(legal.includes(marker), `번역의 한계·한국어 원문 우선 고지가 빠졌습니다: ${marker}`);
  assert.match(legal, /type="radio" name="legal-language" id="lang-ko" checked/,
    "법률정보의 기본 언어는 효력 기준인 한국어 원문이어야 합니다");
}

// ── 화면 사이 이동 링크 ────────────────────────────────────────────────────
// ⚠️ AI 문서에서 '모의고사' 를 누르면 **모의고사 라이브러리**로 가야 한다.
//    예전 `#mock` 해시는 아무 데도 안 걸려 문제집 라이브러리로 조용히 떨어졌다.
{
  const docEditor3 = await text("document-editor.html");
  assert.match(docEditor3, /href="index\.html#library=mocks"[^>]*>모의고사</,
    "document-editor.html 의 '모의고사' 링크가 #library=mocks 를 가리키지 않습니다");
  assert.match(index, /library=mocks/, "index.html 이 그 해시를 읽지 않습니다");

  // ── AI 문서는 **화면에서 뺐고 코드로만 남겼다** (`docs/AI-DOCUMENT-SCOPE.md`) ──
  // ⚠️ 이 제품의 의의는 문제집·모의고사를 한글로 뽑는 것이다. 범용 문서 작성 도구가
  //    같은 자리에 있으면 그 의의가 흐려진다. 그래서 **입구만** 없앴다.
  // ⚠️ 파일과 엔진은 그대로 둔다 — 모의고사 한글 내보내기가 같은 엔진을 쓰고,
  //    주소로 직접 열면 지금도 동작한다. **지우는 것과 입구를 빼는 것은 다르다.**
  assert.ok(!/href="document-editor\.html"/.test(index),
    "index.html 이 다시 AI 문서로 링크합니다 — 화면에서 빼기로 한 결정입니다(docs/AI-DOCUMENT-SCOPE.md)");
  const serveStatic = await text("serve.py");
  assert.match(serveStatic, /"\/document-editor\.html":/,
    "serve.py 의 STATIC 에서 document-editor.html 이 빠졌습니다 — 입구를 뺀 것이지 지운 것이 아닙니다");
  for (const f of ["hwpx-engine.js", "hwpx-document.js"]) {
    assert.match(serveStatic, new RegExp(`"\\/${f.replace(".", "\\.")}":`),
      `serve.py 의 STATIC 에서 ${f} 가 빠졌습니다 — 모의고사 한글 내보내기가 이 엔진을 씁니다`);
  }
}

// ── 화학식(mhchem) ─────────────────────────────────────────────────────────
// ⚠️ **순서가 계약이다.** mhchem 은 KaTeX 에 `\ce` 를 더하는 확장이라 **KaTeX 뒤**,
//    렌더가 도는 **auto-render 앞**에 와야 한다. `defer` 는 문서 순서를 지키므로
//    태그 순서만 맞으면 된다 — 뒤바뀌면 `\ce` 가 조용히 "Undefined control sequence" 가 된다.
{
  const at = (re) => { const m = index.match(re); return m ? index.indexOf(m[0]) : -1; };
  const katexJs = at(/katex@[\d.]+\/dist\/katex\.min\.js/);
  const mhchem  = at(/katex@[\d.]+\/dist\/contrib\/mhchem\.min\.js/);
  const render  = at(/katex@[\d.]+\/dist\/contrib\/auto-render\.min\.js/);
  assert.ok(mhchem > 0, "index.html 에 mhchem 이 없습니다 — 화학식 `\\ce{}` 가 안 그려집니다");
  assert.ok(katexJs > 0 && mhchem > katexJs,
    "mhchem 이 KaTeX 본체보다 앞에 있습니다 — 확장이 붙을 대상이 아직 없습니다");
  assert.ok(render > mhchem,
    "mhchem 이 auto-render 보다 뒤에 있습니다 — 렌더가 돈 뒤에 등록되어 `\\ce` 가 실패합니다");
  assert.match(index, /contrib\/mhchem\.min\.js"\s*\n?\s*integrity="sha384-/,
    "mhchem 태그에 integrity 해시가 없습니다 — CDN 태그는 전부 SRI 를 답니다");
}

console.log("Commercial static checks passed");
