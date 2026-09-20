/* 공급자 품질 탐침 — Cloudflare·staging 을 거치지 않고 공급자에 직접 묻는다.
 *
 * ⚠️ 왜 Worker 를 안 거치나: 지금 알고 싶은 것은 "우리 스테이징이 잘 배선됐나"(OPS-7)가
 *    아니라 "이 모델이 우리 문항을 제대로 읽나" 다. 후자는 결제 막힌 GCP 프로젝트가
 *    전혀 필요 없다. 다만 **프롬프트와 요청 형식은 제품의 것을 그대로 쓴다** — 여기서
 *    베끼면 측정값이 제품과 다른 것을 재게 된다.
 *
 * 키는 인자로 받지 않는다(셸 기록에 남는다). 환경변수나 파일에서만 읽고 절대 찍지 않는다.
 *   GEMINI_API_KEY=...            또는  GEMINI_KEY_FILE=~/.gemini-key
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");

const { buildGeminiRequest, decodeGeminiEnvelope } = await import(`${REPO}/worker/gemini.js`);

/* 제품의 프롬프트를 소스에서 그대로 떼어 온다 — 베끼면 갈라진다. */
function productPrompt() {
  const src = readFileSync(`${REPO}/worker/index.js`, "utf8");
  const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;\n/);
  if (!m) throw new Error("SYSTEM_PROMPT 를 worker/index.js 에서 찾지 못했다");
  return m[1].replace(/\\\\/g, "\\");
}

function apiKey() {
  const direct = String(process.env.GEMINI_API_KEY || "").trim();
  if (direct) return direct;
  const file = String(process.env.GEMINI_KEY_FILE || "").trim();
  if (file) return readFileSync(file.replace(/^~/, process.env.HOME), "utf8").trim();
  throw new Error("키가 없다. GEMINI_API_KEY 또는 GEMINI_KEY_FILE 을 주어라 (인자로 주지 말 것)");
}

const args = Object.fromEntries(
  /* ⚠️ `--k=v` 와 `k=v` 를 함께 받는다. 예전에는 `a.slice(2,i)` 로 잘라 앞 두 글자를
     무조건 버렸고, `image=...` 를 주면 키가 "age" 가 되어 **조용히 기본 이미지를 쟀다.** */
  process.argv.slice(2).map((a) => { const t = a.replace(/^--/, ""); const i = t.indexOf("="); return i < 0 ? [t, true] : [t.slice(0, i), t.slice(i + 1)]; })
);
const MODEL = args.model || "gemini-3.1-flash-lite";
const IMAGE = args.image || "test-fixtures/visual-baseline/darwin/math-print.png";

const bytes = readFileSync(`${REPO}/${IMAGE}`);
const body = buildGeminiRequest({
  system: productPrompt(),
  /* 제품(worker/index.js:883)과 같은 순서·같은 문구 */
  parts: [
    { text: "이 이미지의 문제를 지정된 JSON 구조로 변환해 줘." },
    { inlineData: { mimeType: "image/png", data: bytes.toString("base64") } },
  ],
});

const t0 = Date.now();
let res, data;
try {
  res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify(body),
    redirect: "manual",
  });
} catch (e) {
  console.error(`[연결 실패] ${e.message}`);
  process.exit(1);
}
const ms = Date.now() - t0;
const text = await res.text();
try { data = JSON.parse(text); } catch { data = null; }

console.log(`모델 ${MODEL} · 이미지 ${IMAGE} (${(bytes.length / 1024).toFixed(0)}KB) · HTTP ${res.status} · ${ms}ms`);

if (!res.ok) {
  /* ⚠️ 원문 메시지는 키를 담을 수 있으므로 표준 코드와 짧은 사유만 본다 (REV-2026-093 의 교훈) */
  const st = data?.error?.status;
  const reason = data?.error?.details?.[0]?.reason;
  console.error(`[공급자 거절] status=${st || "?"} reason=${reason || "-"}`);
  if (st === "FAILED_PRECONDITION") console.error("  → 이 키의 프로젝트에 결제가 안 붙어 있다 (무료 한도 대상이 아님)");
  if (st === "RESOURCE_EXHAUSTED") console.error("  → 무료 한도 소진. 키는 유효하다");
  if (st === "PERMISSION_DENIED" || st === "UNAUTHENTICATED") console.error("  → 키가 유효하지 않거나 이 모델에 권한이 없다");
  if (st === "NOT_FOUND") console.error("  → 이 키로 이 모델 이름을 쓸 수 없다 (모델명·계열 확인)");
  process.exit(2);
}

const env = decodeGeminiEnvelope(data);
console.log(`토큰 입력 ${env.inputTokens ?? "?"} · 출력 ${env.outputTokens ?? "?"} · 사고 ${env.thinkingTokens ?? 0} · finish=${env.finishReason ?? "-"}`);
if (env.invalid || env.blocked) { console.error("[응답 해석 실패]", JSON.stringify(env).slice(0, 300)); process.exit(3); }

let parsed;
try { parsed = JSON.parse(env.text); } catch { console.error("[JSON 아님] 앞부분:", env.text.slice(0, 300)); process.exit(4); }
console.log(`\n--- 추출 결과: 문항 ${parsed?.problems?.length ?? 0}개 ---`);
console.log(JSON.stringify(parsed, null, 2));
