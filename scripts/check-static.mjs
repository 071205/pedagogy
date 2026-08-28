import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

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
  text("integration-test.html"),
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
for (const name of ["math-print", "korean-passage-print", "image-print", "overflow-print"]) {
  assert.equal(await exists(`test-fixtures/visual-baseline/${name}.png`), true,
    `시각 회귀 기준본 ${name}.png이 필요합니다`);
}
assert.match(integration, /#importAllInput/, "격리 통합 검사는 실제 전체 가져오기 input을 거쳐야 합니다");
assert.match(integration, /await loadApp\(\)/, "격리 통합 검사는 저장 뒤 앱을 새로고침해 복원을 확인해야 합니다");
assert.match(integration, /buildPrintDoc\(false\)/, "격리 통합 검사는 실제 인쇄 DOM 생성 경로를 거쳐야 합니다");
assert.match(integration, /fitPrintDoc\(\)/, "격리 통합 검사는 인쇄 오버플로 보정을 확인해야 합니다");
assert.match(server, /"\/integration-test\.html"/, "로컬 서버는 격리 통합 검사 페이지만 화이트리스트로 제공해야 합니다");

console.log("Commercial static checks passed");
