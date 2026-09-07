import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => stat(new URL(path, root)).then(() => true, () => false);

const [index, worker, rules, storageRules, config, workflow, integration, server, manifest, visual] = await Promise.all([
  text("index.html"),
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
assert.match(index, /purgeAiUsage\(user\)/, "계정 삭제 때 AI 사용 기록도 지워야 합니다");
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

console.log("Commercial static checks passed");
