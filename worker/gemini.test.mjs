import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildGeminiRequest, decodeGeminiEnvelope } from "./gemini.js";
import { createWorker } from "./index.js";

const env = {
  ALLOWED_ORIGINS: "https://app.example",
  FIREBASE_PROJECT_ID: "pedagogy-test",
  AI_PROVIDER: "gemini",
  GEMINI_API_KEY: "GEMINI_SECRET_7f44",
  GEMINI_MODEL: "gemini-3.1-flash-lite",
  DAILY_LIMIT: "5",
  GLOBAL_DAILY_LIMIT: "0",
};

const request = (body) => new Request("https://worker.example/ai", {
  method: "POST",
  headers: { Origin: "https://app.example", Authorization: "Bearer test-token", "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function fixtureWorker({ recordMetric } = {}) {
  const calls = [];
  const metrics = [];
  const worker = createWorker({
    verifyToken: async () => ({ uid: "private-user", claims: {} }),
    requestQuota: async (_env, _uid, op, _id, { limit }) => {
      calls.push(op);
      return op === "reserve" ? { ok: true, used: 0, limit, pending: 1 } : { ok: true, used: 1, limit, pending: 0 };
    },
    recordMetric: (metric) => { metrics.push(metric); recordMetric?.(metric); },
  });
  return { worker, calls, metrics };
}

async function mockFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await action(); }
  finally { globalThis.fetch = original; }
}

async function mockDeadline(action) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let callback;
  let cleared = false;
  globalThis.setTimeout = (fn) => { callback = fn; return 1; };
  globalThis.clearTimeout = () => { cleared = true; };
  try {
    return await action({
      fire: () => { assert.equal(typeof callback, "function", "deadline must be registered"); callback(); },
      get cleared() { return cleared; },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

const response = ({ text = '{"problems":[]}', finishReason = "STOP", usage = {}, parts } = {}) => Response.json({
  modelVersion: "gemini-3.1-flash-lite",
  usageMetadata: usage,
  candidates: [{ finishReason, content: { parts: parts || [{ thought: true, text: "private-thought" }, { text }] } }],
});

function assertSafeGeminiMetric(metric, { outcome, status, input = null, output = null, thinking = null, stop = null, providerStatus = null }) {
  assert.deepEqual(Object.keys(metric).sort(), [
    "duration_ms", "event", "http_status", "input_tokens", "model", "outcome",
    "output_tokens", "provider", "provider_error_status", "stop_reason", "task", "thinking_tokens",
  ]);
  assert.equal(metric.provider_error_status, providerStatus);
  assert.equal(metric.provider, "gemini");
  assert.equal(metric.outcome, outcome);
  assert.equal(metric.http_status, status);
  assert.equal(metric.input_tokens, input);
  assert.equal(metric.output_tokens, output);
  assert.equal(metric.thinking_tokens, thinking);
  assert.equal(metric.stop_reason, stop);
  assert.equal(JSON.stringify(metric).includes("private"), false);
  assert.equal(JSON.stringify(metric).includes(env.GEMINI_API_KEY), false);
}

// Pure boundary: fixed configuration cannot accidentally become a prompt/model tuning surface.
const built = buildGeminiRequest({ system: "system", parts: [{ text: "user" }] });
assert.deepEqual(built.generationConfig, {
  candidateCount: 1, maxOutputTokens: 4096, responseMimeType: "application/json",
  thinkingConfig: { thinkingLevel: "low", includeThoughts: false },
});
assert.equal(built.systemInstruction.parts[0].text, "system");
assert.throws(() => buildGeminiRequest({ system: "", parts: [] }), TypeError);

const decoded = decodeGeminiEnvelope({
  modelVersion: "gemini-3.1-flash-lite", usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4, thoughtsTokenCount: 3 },
  candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "omit" }, { text: "{}" }] } }],
});
assert.deepEqual(decoded, {
  model: "gemini-3.1-flash-lite", inputTokens: 5, outputTokens: 4, thinkingTokens: 3,
  text: "{}", finishReason: "STOP", blocked: false,
});
assert.equal(decodeGeminiEnvelope({ candidates: [] }).invalid, true);
assert.equal(decodeGeminiEnvelope({ promptFeedback: { blockReason: "SAFETY" } }).blocked, true);

// Red probes use in-memory source variants: each weakens a contract and must break
// a concrete assertion, rather than merely depending on a source-text match.
const geminiSource = readFileSync(new URL("./gemini.js", import.meta.url), "utf8");
async function mutatedGemini(needle, replacement) {
  const variant = geminiSource.replace(needle, replacement);
  assert.notEqual(variant, geminiSource, `red probe anchor missing: ${needle}`);
  return import(`data:text/javascript;base64,${Buffer.from(variant).toString("base64")}`);
}
const baselineGemini = { buildGeminiRequest, decodeGeminiEnvelope };
for (const [name, needle, replacement, check] of [
  ["max-output", "maxOutputTokens: 4096", "maxOutputTokens: 4095", (mod) =>
    assert.equal(mod.buildGeminiRequest({ system: "s", parts: [{ text: "p" }] }).generationConfig.maxOutputTokens, 4096)],
  // ⚠️ 되돌리기 쉬운 값이라 붉은 탐침을 둔다 — "minimal" 로 돌아가면 이 모델이 400 을 낸다.
  ["thinking-level", 'thinkingLevel: "low"', 'thinkingLevel: "minimal"', (mod) =>
    assert.equal(mod.buildGeminiRequest({ system: "s", parts: [{ text: "p" }] }).generationConfig.thinkingConfig.thinkingLevel, "low")],
  ["missing-thinking", "thinkingTokens: usage.thoughtsTokenCount", "thinkingTokens: usage.thoughtsTokenCount ?? 0", (mod) =>
    assert.equal(mod.decodeGeminiEnvelope({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }] }).thinkingTokens, null)],
]) {
  check(baselineGemini);
  const mod = await mutatedGemini(needle, replacement);
  assert.throws(() => check(mod), assert.AssertionError, `${name} red probe must fail an assertion`);
}

// Worker-level red probes run an in-memory index.js variant in a child process.
// Each baseline must pass before its deliberately weakened variant is accepted as red.
const workerDir = new URL("./", import.meta.url);
const workerImports = (source) => source.replace(/from "(\.\/[^\"]+)"/g,
  (_match, path) => `from ${JSON.stringify(new URL(path, workerDir).href)}`);
const workerSource = workerImports(readFileSync(new URL("./index.js", import.meta.url), "utf8"));
const workerPrelude = `
import assert from "node:assert/strict";
const env = { ALLOWED_ORIGINS: "https://app.example", FIREBASE_PROJECT_ID: "pedagogy-test", AI_PROVIDER: "gemini", GEMINI_API_KEY: "GEMINI_SECRET_7f44", GEMINI_MODEL: "gemini-3.1-flash-lite", DAILY_LIMIT: "5", GLOBAL_DAILY_LIMIT: "0" };
const operations = [];
const worker = createWorker({
  verifyToken: async () => ({ uid: "private-user", claims: {} }),
  requestQuota: async (_env, _uid, operation, _id, { limit }) => { operations.push(operation); return operation === "reserve" ? { ok: true, used: 0, limit, pending: 1 } : { ok: true, used: 1, limit, pending: 0 }; },
});
const request = (body) => new Request("https://worker.example/ai", { method: "POST", headers: { Origin: "https://app.example", Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: JSON.stringify(body) });
`;
function runWorkerProbe(source, probe) {
  const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return spawnSync(process.execPath, ["--input-type=module"], {
    input: `${workerPrelude}\nimport { createWorker } from ${JSON.stringify(moduleURL)};\n${probe}`,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}
function assertRedWorkerMutation(name, needle, replacement, probe) {
  const baseline = runWorkerProbe(workerSource, probe);
  assert.equal(baseline.status, 0, `${name} baseline must pass`);
  const variant = workerSource.replace(needle, replacement);
  assert.notEqual(variant, workerSource, `${name} red probe anchor missing`);
  const mutated = runWorkerProbe(variant, probe);
  assert.equal(mutated.status, 1, `${name} mutation must fail`);
  assert.match(mutated.stderr, /AssertionError/, `${name} must fail an assertion, not loading`);
}
const successfulGeminiResponse = `Response.json({ modelVersion: "gemini-3.1-flash-lite", usageMetadata: {}, candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ problems: [] }) }] } }] })`;
assertRedWorkerMutation("gemini-body-key-log", "response = await fetch(`https://generativelanguage.googleapis.com/", "console.error(requestBody, env.GEMINI_API_KEY); response = await fetch(`https://generativelanguage.googleapis.com/", `
  const entries = []; const originalFetch = globalThis.fetch; const originalError = console.error; let fetches = 0;
  try {
    console.error = (...args) => entries.push(args);
    globalThis.fetch = async () => { fetches++; return ${successfulGeminiResponse}; };
    const result = await worker.fetch(request({ imageBase64: "private-image", mimeType: "image/png" }), env);
    assert.equal(result.status, 200); assert.equal(fetches, 1);
    assert.equal(JSON.stringify(entries).includes("private-image"), false);
    assert.equal(JSON.stringify(entries).includes(env.GEMINI_API_KEY), false);
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
`);
assertRedWorkerMutation("gemini-http-second-fetch", "console.error(\"Gemini API 오류:\", response.status, providerStatus || \"\");", "await fetch(\"https://retry.invalid/\", {}); console.error(\"Gemini API 오류:\", response.status, providerStatus || \"\");", `
  const originalFetch = globalThis.fetch; let fetches = 0;
  try {
    globalThis.fetch = async () => { fetches++; return new Response("provider failed", { status: 529 }); };
    const result = await worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env);
    assert.equal(result.status, 502); assert.equal(fetches, 1); assert.deepEqual(operations, ["reserve", "consume"]);
  } finally { globalThis.fetch = originalFetch; }
`);
assertRedWorkerMutation("gemini-manual-redirect", "redirect: \"manual\"", "redirect: \"follow\"", `
  const originalFetch = globalThis.fetch; let fetches = 0; let redirect;
  try {
    globalThis.fetch = async (_url, init) => { fetches++; redirect = init.redirect; return ${successfulGeminiResponse}; };
    const result = await worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env);
    assert.equal(result.status, 200); assert.equal(fetches, 1); assert.equal(redirect, "manual");
  } finally { globalThis.fetch = originalFetch; }
`);
assertRedWorkerMutation("gemini-max-tokens-success", "if (data.blocked || data.finishReason !== \"STOP\") {", "if (data.blocked || false) {", `
  const originalFetch = globalThis.fetch; let fetches = 0;
  try {
    globalThis.fetch = async () => { fetches++; return Response.json({ modelVersion: "gemini-3.1-flash-lite", usageMetadata: {}, candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: JSON.stringify({ problems: [] }) }] } }] }); };
    const result = await worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env);
    assert.equal(result.status, 502); assert.equal(fetches, 1); assert.deepEqual(operations, ["reserve", "consume"]);
  } finally { globalThis.fetch = originalFetch; }
`);
assertRedWorkerMutation("gemini-config-after-quota", "provider = providerConfig(env);", "provider = { name: \"gemini\" };", `
  const result = await worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), { ...env, GEMINI_API_KEY: "" });
  assert.equal(result.status, 503); assert.deepEqual(operations, []);
`);

// Invalid provider settings and unsupported direct GIF must stop before quota or fetch.
for (const badEnv of [
  { ...env, AI_PROVIDER: "unknown" },
  { ...env, GEMINI_API_KEY: "" },
  { ...env, GEMINI_API_KEY: " \n\t " },
  { ...env, GEMINI_MODEL: "gemini-other" },
  { ...env, GEMINI_MODEL: "gemini-2.5-flash" },
]) {
  const subject = fixtureWorker(); let fetches = 0;
  const result = await mockFetch(async () => { fetches++; throw new Error("must not fetch"); },
    () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), badEnv));
  assert.equal(result.status, 503);
  assert.deepEqual(subject.calls, []);
  assert.equal(fetches, 0);
}
{
  const subject = fixtureWorker(); let fetches = 0;
  const result = await mockFetch(async () => { fetches++; throw new Error("must not fetch"); },
    () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/gif" }), env));
  assert.equal(result.status, 400);
  assert.deepEqual(subject.calls, []);
  assert.equal(fetches, 0);
}

// The deadline remains active through response body parsing. A body timeout is a
// transport failure, not malformed Gemini JSON, and never creates another request.
{
  const subject = fixtureWorker(); let fetches = 0;
  await mockDeadline(async (deadline) => {
    const result = await mockFetch(async (_url, init) => {
      fetches++;
      return {
        ok: true,
        status: 200,
        json: async () => {
          assert.equal(deadline.cleared, false, "deadline must survive until response.json settles");
          let aborted = false;
          init.signal.addEventListener("abort", () => { aborted = true; });
          deadline.fire();
          assert.equal(aborted, true, "deadline must abort the same fetch signal");
          throw new Error("simulated response body timeout");
        },
      };
    }, () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
    assert.equal(result.status, 502);
    assert.equal(deadline.cleared, true, "deadline must be cleaned after response.json settles");
  });
  assert.equal(fetches, 1, "body timeout must not retry or fall back");
  assert.deepEqual(subject.calls, ["reserve", "consume"]);
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "request_error", status: 200 });
}

// Image request retains the browser response contract while exposing only safe usage metadata.
{
  const subject = fixtureWorker(); const captured = []; let fetches = 0;
  const result = await mockFetch(async (url, init) => {
    fetches++; captured.push({ url, init });
    return response({ usage: { promptTokenCount: 12, candidatesTokenCount: 7, thoughtsTokenCount: 0 } });
  }, () => subject.worker.fetch(request({ imageBase64: "private-image", mimeType: "image/png" }), env));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { problems: [], usage: { used: 1, limit: 5 } });
  assert.deepEqual(subject.calls, ["reserve", "consume"]);
  assert.equal(fetches, 1, "Gemini failure/success never triggers a second provider attempt");
  assert.equal(captured[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
  assert.equal(captured[0].init.redirect, "manual");
  assert.equal(captured[0].init.headers["x-goog-api-key"], env.GEMINI_API_KEY);
  assert.equal(captured[0].url.includes(env.GEMINI_API_KEY), false);
  const outgoing = JSON.parse(captured[0].init.body);
  assert.deepEqual(outgoing.generationConfig, built.generationConfig);
  assert.equal(outgoing.contents[0].parts[0].inlineData.data, "private-image");
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "success", status: 200, input: 12, output: 7, thinking: 0, stop: "end_turn" });
}

// API-key whitespace never reaches a header; a blank-after-trim key is rejected
// before quota, while a padded valid key makes exactly one normal provider call.
{
  const subject = fixtureWorker(); const captured = []; let fetches = 0;
  const paddedEnv = { ...env, GEMINI_API_KEY: ` \n${env.GEMINI_API_KEY}\t ` };
  const result = await mockFetch(async (_url, init) => {
    fetches++; captured.push(init); return response();
  }, () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), paddedEnv));
  assert.equal(result.status, 200);
  assert.equal(fetches, 1);
  assert.equal(captured[0].headers["x-goog-api-key"], env.GEMINI_API_KEY);
  assert.deepEqual(subject.calls, ["reserve", "consume"]);
}

// A provider redirect stays local: it is never followed with the key and its
// status is kept as a safe HTTP failure rather than being flattened to a fetch error.
{
  const subject = fixtureWorker(); let fetches = 0;
  const result = await mockFetch(async () => {
    fetches++; return new Response("", { status: 302, headers: { Location: "https://elsewhere.invalid" } });
  }, () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
  assert.equal(result.status, 502);
  assert.equal(fetches, 1);
  assert.deepEqual(subject.calls, ["reserve", "consume"]);
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "http_error", status: 302 });
}

// JSON validation and provider completion failures consume once, log once, and reveal no provider text.
for (const [name, makeResponse, expected] of [
  ["max tokens", () => response({ text: "{\"problems\":[]}", finishReason: "MAX_TOKENS", usage: { promptTokenCount: 3, candidatesTokenCount: 4096, thoughtsTokenCount: 0 } }), { outcome: "validation_error", stop: "max_tokens" }],
  ["safety", () => Response.json({ promptFeedback: { blockReason: "SAFETY" }, usageMetadata: { promptTokenCount: 3, thoughtsTokenCount: 2 } }), { outcome: "validation_error", stop: "refusal" }],
  ["bad envelope", () => response({ parts: [{ inlineData: { mimeType: "image/png", data: "private-response" } }], usage: { promptTokenCount: 3, candidatesTokenCount: 2, thoughtsTokenCount: 1 } }), { outcome: "json_parse_error", stop: null }],
]) {
  const subject = fixtureWorker(); let fetches = 0;
  const result = await mockFetch(async () => { fetches++; return makeResponse(); },
    () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
  assert.equal(result.status, 502, name);
  assert.deepEqual(subject.calls, ["reserve", "consume"], name);
  assert.equal(fetches, 1, name);
  assertSafeGeminiMetric(subject.metrics[0], { outcome: expected.outcome, status: 200, input: 3, output: name === "safety" ? null : name === "max tokens" ? 4096 : 2, thinking: name === "safety" ? 2 : name === "bad envelope" ? 1 : 0, stop: expected.stop });
}

{
  const subject = fixtureWorker(); let fetches = 0;
  const result = await mockFetch(async () => { fetches++; return new Response("private provider error", { status: 529 }); },
    () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
  assert.equal(result.status, 502);
  assert.equal(fetches, 1, "HTTP failure must not retry or fall back to another provider");
  assert.deepEqual(subject.calls, ["reserve", "consume"]);
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "http_error", status: 529 });
}

/* 공급자가 준 표준 오류 코드는 남기고, 메시지는 남기지 않는다.
   ⚠️ 이 칸이 없던 동안 공급자 400 과 503 이 화면·로그에서 똑같은 502 한 줄이라,
      원인을 알아내는 데 승인된 실호출을 한 번씩 써야 했다(2026-09-19). */
{
  const subject = fixtureWorker(); let fetches = 0;
  const result = await mockFetch(async () => {
    fetches++;
    return Response.json({ error: { code: 400, status: "INVALID_ARGUMENT", message: "private field detail" } }, { status: 400 });
  }, () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
  assert.equal(result.status, 502);
  assert.equal(fetches, 1, "reading the error body must not cost a second fetch");
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "http_error", status: 400, providerStatus: "INVALID_ARGUMENT" });
}

// 코드가 아닌 것은 버린다 — 자유 문자열이 이 칸으로 새어 나가면 안 된다.
{
  const subject = fixtureWorker();
  await mockFetch(async () => Response.json({ error: { status: "사람이 읽는 문장 that is not a code" } }, { status: 400 }),
    () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "http_error", status: 400 });
}

// 본문이 JSON 이 아니어도 실패로 번지지 않는다.
{
  const subject = fixtureWorker();
  await mockFetch(async () => new Response("<html>gateway</html>", { status: 502 }),
    () => subject.worker.fetch(request({ imageBase64: "safe", mimeType: "image/png" }), env));
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "http_error", status: 502 });
}

// The document path sends only text and still runs the existing document validator.
{
  const subject = fixtureWorker();
  const result = await mockFetch(async (_url, init) => {
    const sent = JSON.parse(init.body);
    assert.equal(sent.contents[0].parts[0].text, "짧은 문서");
    return response({ text: JSON.stringify({ title: "초안", blocks: [{ type: "paragraph", text: "본문" }] }), usage: { promptTokenCount: 8, candidatesTokenCount: 9, thoughtsTokenCount: 0 } });
  }, () => subject.worker.fetch(request({ mode: "document", prompt: "짧은 문서" }), env));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).document.title, "초안");
  assertSafeGeminiMetric(subject.metrics[0], { outcome: "success", status: 200, input: 8, output: 9, thinking: 0, stop: "end_turn" });
}

console.log("Gemini adapter contract tests passed");
