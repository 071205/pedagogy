import assert from "node:assert/strict";
import { callAI, callDocumentAI, createWorker } from "./index.js";
import { AppCheckError } from "./app-check.js";

const env = {
  ALLOWED_ORIGINS: "https://app.example",
  FIREBASE_PROJECT_ID: "pedagogy-test",
  ANTHROPIC_KEY: "test-secret",
  DAILY_LIMIT: "5",
  // 기존 요청 계약 검사는 사용자별 quota에 집중한다. 전역 quota는 아래의
  // 전용 가짜 Durable Object로 실제 reserve/consume 순서를 따로 검증한다.
  GLOBAL_DAILY_LIMIT: "0",
  PLAN_DAILY_LIMITS_JSON: JSON.stringify({ free: 5, pro: 20 }),
};

const request = (method, {
  origin = "https://app.example",
  token = "test-token",
  appCheckToken = null,
  body,
  extraHeaders = {},
} = {}) => {
  const headers = new Headers(extraHeaders);
  if (origin !== null) headers.set("Origin", origin);
  if (token !== null) headers.set("Authorization", "Bearer " + token);
  if (appCheckToken !== null) headers.set("X-Firebase-AppCheck", appCheckToken);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request("https://worker.example/ai", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

function testWorker({
  verifyToken = async () => ({ uid: "user-1", claims: { pedagogy_plan: "pro" } }),
  verifyAppCheck = async () => ({ appId: "test-app" }),
  quotaResult = {},
  generateProblems = async () => [{ title: "변환됨", blocks: [] }],
  generateDocument = async () => ({ title: "초안", blocks: [{ type: "paragraph", text: "본문" }] }),
  recordMetric,
} = {}) {
  const calls = [];
  const metrics = [];
  const worker = createWorker({
    verifyToken: async (...args) => {
      calls.push({ kind: "verify", args });
      return verifyToken(...args);
    },
    verifyAppCheck: async (...args) => {
      calls.push({ kind: "app-check", args });
      return verifyAppCheck(...args);
    },
    requestQuota: async (_env, uid, op, reservationId, options) => {
      calls.push({ kind: "quota", uid, op, reservationId, options });
      const result = quotaResult[op];
      if (result instanceof Error) throw result;
      if (typeof result === "function") return result({ uid, op, reservationId, options });
      if (result) return result;
      if (op === "reserve") return { ok: true, used: 0, limit: options.limit, pending: 1 };
      if (op === "consume") return { ok: true, used: 1, limit: options.limit, pending: 0 };
      return { ok: true };
    },
    generateProblems: async (...args) => {
      calls.push({ kind: "ai", args });
      return generateProblems(...args);
    },
    generateDocument: async (...args) => {
      calls.push({ kind: "document-ai", args });
      return generateDocument(...args);
    },
    recordMetric: (metric) => {
      // Intentional failure injection: the privacy assertion below must reject a log
      // payload with prompt text rather than merely trusting the test helper.
      const observed = process.env.AI_METRICS_RED === "1"
        ? { ...metric, prompt: "must-not-be-logged" } : metric;
      metrics.push(observed);
      recordMetric?.(observed);
    },
  });
  return { worker, calls, metrics };
}

async function body(response) {
  return response.json();
}

async function withMockFetch(mock, action) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function captureConsole(action) {
  const methods = ["log", "error", "warn", "info", "debug"];
  const originals = Object.fromEntries(methods.map((method) => [method, console[method]]));
  const entries = [];
  for (const method of methods) console[method] = (...args) => entries.push({ method, args });
  try {
    return { value: await action(), entries };
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
}

function aiMetricEvents(entries) {
  return entries.flatMap(({ args }) => args).filter((entry) => entry?.event === "ai_usage");
}

function assertConsoleExcludes(entries, secrets) {
  const output = JSON.stringify(entries);
  for (const [kind, secret] of Object.entries(secrets)) {
    assert.equal(output.includes(secret), false, `${kind} 원문이 console 로그에 남으면 안 된다`);
  }
}

async function captureDefaultProviderRequest({ documentMode = false, contentText }) {
  const secrets = {
    image: "PRIVATE_IMAGE_7f44",
    prompt: "PRIVATE_PROMPT_43cd",
    uid: "PRIVATE_UID_98be",
    token: "PRIVATE_TOKEN_20cc",
    response: "PRIVATE_RESPONSE_30aa",
  };
  const quotaOps = [];
  const captured = await captureConsole(async () => {
    const worker = createWorker({
      verifyToken: async () => ({ uid: secrets.uid, claims: {} }),
      requestQuota: async (_env, _uid, op, _reservationId, options) => {
        quotaOps.push(op);
        return op === "reserve"
          ? { ok: true, used: 0, limit: options.limit, pending: 1 }
          : { ok: true, used: 1, limit: options.limit, pending: 0 };
      },
    });
    return withMockFetch(async () => Response.json({
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      usage: { input_tokens: 144, output_tokens: 7 },
      content: [{ type: "text", text: contentText }, { type: "text", text: secrets.response }],
    }), () => worker.fetch(request("POST", {
      token: secrets.token,
      body: documentMode
        ? { mode: "document", prompt: secrets.prompt }
        : { imageBase64: secrets.image, mimeType: "image/png" },
    }), env));
  });
  return { ...captured, quotaOps, secrets };
}

function assertSafeAiMetric(metric, expected) {
  assert.deepEqual(Object.keys(metric).sort(), [
    "duration_ms", "event", "http_status", "input_tokens", "model", "outcome",
    "output_tokens", "provider", "stop_reason", "task",
  ]);
  assert.equal(metric.event, "ai_usage");
  assert.equal(metric.provider, "anthropic");
  assert.equal(metric.task, expected.task);
  assert.equal(metric.outcome, expected.outcome);
  assert.equal(metric.http_status, expected.httpStatus);
  assert.equal(metric.input_tokens, expected.inputTokens);
  assert.equal(metric.output_tokens, expected.outputTokens);
  assert.equal(metric.stop_reason, expected.stopReason);
  assert.equal(typeof metric.duration_ms, "number");
  assert.ok(metric.duration_ms >= 0);
  for (const forbidden of ["image", "imageBase64", "prompt", "response", "text", "uid", "userId"]) {
    assert.equal(Object.hasOwn(metric, forbidden), false, `${forbidden} must not enter Worker logs`);
  }
}

function globalQuotaEnv({ limit = 2, used = 0, fail = false } = {}) {
  const state = { calls: [], reservations: new Set(), used };
  const stub = {
    async fetch(_url, init) {
      if (fail) throw new Error("global quota unavailable");
      const req = JSON.parse(init.body);
      state.calls.push(req);
      if (req.op === "reserve") {
        if (state.used + state.reservations.size >= req.limit) {
          return Response.json({ ok: false, used: state.used, limit: req.limit,
            pending: state.reservations.size });
        }
        state.reservations.add(req.reservationId);
        return Response.json({ ok: true, used: state.used, limit: req.limit,
          pending: state.reservations.size });
      }
      if (req.op === "consume") {
        if (!state.reservations.delete(req.reservationId)) {
          return Response.json({ ok: false, used: state.used, limit: req.limit,
            pending: state.reservations.size, error: "reservation expired" });
        }
        state.used += 1;
        return Response.json({ ok: true, used: state.used, limit: req.limit,
          pending: state.reservations.size });
      }
      state.reservations.delete(req.reservationId);
      return Response.json({ ok: true, used: state.used, limit: req.limit,
        pending: state.reservations.size });
    },
  };
  return {
    env: { ...env, GLOBAL_DAILY_LIMIT: String(limit), QUOTA: {
      idFromName: (name) => name,
      get: () => stub,
    } },
    state,
  };
}

async function testHealthAndOriginBoundary() {
  const { worker, calls } = testWorker();
  const health = await worker.fetch(new Request("https://worker.example/health"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await body(health), { ok: true });
  assert.equal(calls.length, 0, "health는 인증·AI·quota를 호출하면 안 된다");

  const options = await worker.fetch(request("OPTIONS"), env);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "https://app.example");
  assert.match(options.headers.get("Access-Control-Allow-Headers"), /X-Firebase-AppCheck/);

  const blocked = await worker.fetch(request("POST", { origin: "https://evil.example", body: {} }), env);
  assert.equal(blocked.status, 403);
  assert.equal(calls.length, 0, "차단된 출처는 토큰 검증 전 거절해야 한다");

  const missingOrigin = await worker.fetch(request("POST", { origin: null, body: {} }), env);
  assert.equal(missingOrigin.status, 403);

  const missingToken = await worker.fetch(request("POST", { token: null, body: {} }), env);
  assert.equal(missingToken.status, 401);
}

async function testAppCheckBoundary() {
  const configured = {
    ...env,
    APP_CHECK_MODE: "enforce",
    FIREBASE_PROJECT_NUMBER: "123456789",
    FIREBASE_APP_IDS: "app-one,app-two",
  };
  const missing = testWorker({
    verifyAppCheck: async () => { throw new AppCheckError("invalid", "private detail"); },
  });
  const missingResponse = await missing.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), configured);
  assert.equal(missingResponse.status, 401);
  assert.equal((await body(missingResponse)).error,
    "앱 확인에 실패했습니다. 페이지를 새로 열어 다시 시도해 주세요.");
  assert.deepEqual(missing.calls.map((call) => call.kind), ["verify", "app-check"],
    "invalid App Check must stop before body, quota and AI");

  const outage = testWorker({
    verifyAppCheck: async () => { throw new AppCheckError("unavailable", "private detail"); },
  });
  const outageResponse = await outage.worker.fetch(request("POST", {
    appCheckToken: "valid-looking-app-check-token",
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), configured);
  assert.equal(outageResponse.status, 503);
  assert.equal(outage.calls.filter((call) => call.kind === "quota").length, 0);

  const accepted = testWorker();
  const acceptedResponse = await accepted.worker.fetch(request("POST", {
    appCheckToken: "valid-looking-app-check-token",
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), configured);
  assert.equal(acceptedResponse.status, 200);
  assert.deepEqual(accepted.calls.map((call) => call.kind),
    ["verify", "app-check", "quota", "quota", "ai"]);
  assert.deepEqual(accepted.calls[1].args[1], {
    projectNumber: "123456789", allowedAppIds: ["app-one", "app-two"],
  });

  const monitor = testWorker({
    verifyAppCheck: async () => { throw new AppCheckError("invalid", "private detail"); },
  });
  const monitorResponse = await monitor.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), { ...configured, APP_CHECK_MODE: "monitor" });
  assert.equal(monitorResponse.status, 200, "monitor records failure without enforcing it");

  const typo = testWorker({
    verifyAppCheck: async () => { throw new AppCheckError("invalid", "private detail"); },
  });
  const typoResponse = await typo.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), { ...configured, APP_CHECK_MODE: "enfore" });
  assert.equal(typoResponse.status, 401, "unknown mode must fail closed instead of disabling App Check");
}

async function testKillSwitchBoundary() {
  const stopped = testWorker();
  const response = await stopped.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), { ...env, AI_KILL_SWITCH: "1", APP_CHECK_MODE: "enforce" });
  assert.equal(response.status, 503);
  assert.equal(stopped.calls.length, 0,
    "kill switch must stop before Auth/App Check, body, quota and AI work");
  const wrongOrigin = await stopped.worker.fetch(request("POST", {
    origin: "https://evil.example", body: {},
  }), { ...env, AI_KILL_SWITCH: "1" });
  assert.equal(wrongOrigin.status, 403, "Origin boundary must remain before the kill switch");
}

async function testAuthenticationAndInputBoundary() {
  const invalid = testWorker({ verifyToken: async () => { throw new Error("private verifier detail"); } });
  const invalidResponse = await invalid.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), env);
  assert.equal(invalidResponse.status, 401);
  assert.equal((await body(invalidResponse)).error, "로그인이 유효하지 않습니다");
  assert.equal(invalid.calls.filter((call) => call.kind === "quota").length, 0);

  const badMime = testWorker();
  const badMimeResponse = await badMime.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/svg+xml" },
  }), env);
  assert.equal(badMimeResponse.status, 400);
  assert.equal(badMime.calls.filter((call) => call.kind === "quota").length, 0,
    "본문 검증 실패는 quota를 차감하면 안 된다");

  const unavailable = testWorker();
  const unavailableResponse = await unavailable.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), { ...env, ANTHROPIC_KEY: "" });
  assert.equal(unavailableResponse.status, 503);
  assert.equal(unavailable.calls.filter((call) => call.kind === "quota").length, 0);
}

async function testQuotaAndProviderContract() {
  const success = testWorker();
  const successResponse = await success.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), env);
  assert.equal(successResponse.status, 200);
  assert.deepEqual((await body(successResponse)).usage, { used: 1, limit: 20 });
  assert.deepEqual(success.calls.map((call) => call.kind), ["verify", "quota", "quota", "ai"],
    "AI 요청은 인증 → reserve → consume → 제공자 순서여야 한다");
  assert.deepEqual(success.calls.filter((call) => call.kind === "quota").map((call) => call.op),
    ["reserve", "consume"]);

  const full = testWorker({ quotaResult: { reserve: { ok: false, used: 20, limit: 20, pending: 0 } } });
  const fullResponse = await full.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), env);
  assert.equal(fullResponse.status, 429);
  assert.equal(full.calls.filter((call) => call.kind === "ai").length, 0,
    "quota 초과면 AI 제공자를 호출하면 안 된다");

  const providerFailure = testWorker({
    generateProblems: async () => { throw new Error("provider detail must not leak"); },
  });
  const failedResponse = await providerFailure.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), env);
  assert.equal(failedResponse.status, 502);
  assert.equal((await body(failedResponse)).error, "AI 변환에 실패했습니다. 이미지와 네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
  assert.deepEqual(providerFailure.calls.filter((call) => call.kind === "quota").map((call) => call.op),
    ["reserve", "consume"], "제공자 실패도 비용 상한을 위해 사용량을 확정한 뒤 처리한다");
}

async function testGlobalQuotaContract() {
  const success = testWorker();
  const global = globalQuotaEnv();
  const successResponse = await success.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), global.env);
  assert.equal(successResponse.status, 200);
  assert.deepEqual(global.state.calls.map((call) => call.op), ["reserve", "consume"]);
  assert.equal(global.state.calls[0].reservationId, global.state.calls[1].reservationId,
    "전역 quota도 같은 예약 ID를 확정해야 실제 사용량이 증가한다");
  assert.equal(global.state.used, 1);

  const personalFull = testWorker({
    quotaResult: { reserve: { ok: false, used: 20, limit: 20, pending: 0 } },
  });
  const untouched = globalQuotaEnv();
  const personalFullResponse = await personalFull.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), untouched.env);
  assert.equal(personalFullResponse.status, 429);
  assert.equal(untouched.state.calls.length, 0,
    "개인 한도에 막힌 요청이 조직 전체 한도를 먼저 점유하면 안 된다");

  const globallyFull = testWorker();
  const fullGlobal = globalQuotaEnv({ limit: 1, used: 1 });
  const fullResponse = await globallyFull.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), fullGlobal.env);
  assert.equal(fullResponse.status, 429);
  assert.deepEqual(globallyFull.calls.filter((call) => call.kind === "quota").map((call) => call.op),
    ["reserve", "release"], "전역 한도에 막히면 개인 예약을 반납해야 한다");

  const unavailable = testWorker();
  const brokenGlobal = globalQuotaEnv({ fail: true });
  const unavailableResponse = await unavailable.worker.fetch(request("POST", {
    body: { imageBase64: "abc", mimeType: "image/png" },
  }), brokenGlobal.env);
  assert.equal(unavailableResponse.status, 503,
    "비용 차단기 상태를 확인하지 못하면 AI 호출을 fail-closed 해야 한다");
  assert.deepEqual(unavailable.calls.filter((call) => call.kind === "quota").map((call) => call.op),
    ["reserve", "release"]);
  assert.equal(unavailable.calls.filter((call) => call.kind === "ai").length, 0);
}

async function testDocumentDraftContract() {
  const badInput = testWorker();
  const missing = await badInput.worker.fetch(request("POST", { body: { mode: "document", prompt: "" } }), env);
  assert.equal(missing.status, 400);
  assert.equal(badInput.calls.filter((call) => call.kind === "quota").length, 0,
    "빈 문서 요청은 quota를 차감하면 안 된다");

  const draft = testWorker({
    generateDocument: async (_env, prompt) => ({
      version: 1, title: "과제 초안", blocks: [
        { type: "heading", level: 1, text: "서론" },
        { type: "paragraph", text: prompt },
        { type: "equation", text: "$$x^2$$" },
      ],
    }),
  });
  const response = await draft.worker.fetch(request("POST", {
    body: { mode: "document", prompt: "수식을 포함한 보고서 초안을 써 줘" },
  }), env);
  assert.equal(response.status, 200);
  assert.equal((await body(response)).document.title, "과제 초안");
  assert.deepEqual(draft.calls.map((call) => call.kind), ["verify", "quota", "quota", "document-ai"],
    "문서 초안도 인증 → reserve → consume → 제공자 순서여야 한다");

  const malformed = testWorker({
    generateDocument: async () => ({ title: "x", blocks: [{ type: "rawXml", text: "<hp:p/>" }] }),
  });
  const rejected = await malformed.worker.fetch(request("POST", {
    body: { mode: "document", prompt: "테스트" },
  }), env);
  assert.equal(rejected.status, 502);
  assert.equal((await body(rejected)).error,
    "AI 문서 초안 생성에 실패했습니다. 요청과 네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
}

async function testAiUsageMetrics() {
  const success = testWorker({ generateProblems: callAI });
  const successResponse = await withMockFetch(async () => Response.json({
    model: "claude-haiku-4-5-20251001",
    stop_reason: "end_turn",
    usage: { input_tokens: 123, output_tokens: 45 },
    content: [{ type: "text", text: '{"problems":[{"title":"변환됨","blocks":[]}]}' }],
  }), () => success.worker.fetch(request("POST", {
    body: { imageBase64: "private-image-content", mimeType: "image/png" },
  }), env));
  assert.equal(successResponse.status, 200);
  assert.equal(success.metrics.length, 1);
  assertSafeAiMetric(success.metrics[0], {
    task: "problem_image", outcome: "success", httpStatus: 200,
    inputTokens: 123, outputTokens: 45, stopReason: "end_turn",
  });

  const httpFailure = testWorker({ generateProblems: callAI });
  const httpResponse = await withMockFetch(async () => new Response("provider details must not be logged", {
    status: 529,
  }), () => httpFailure.worker.fetch(request("POST", {
    body: { imageBase64: "private-image-content", mimeType: "image/png" },
  }), env));
  assert.equal(httpResponse.status, 502);
  assert.equal(httpFailure.metrics.length, 1);
  assertSafeAiMetric(httpFailure.metrics[0], {
    task: "problem_image", outcome: "http_error", httpStatus: 529,
    inputTokens: null, outputTokens: null, stopReason: null,
  });

  const jsonFailure = testWorker({ generateDocument: callDocumentAI });
  const jsonResponse = await withMockFetch(async () => Response.json({
    model: "claude-haiku-4-5-20251001",
    stop_reason: "end_turn",
    usage: { input_tokens: 88, output_tokens: 13 },
    content: [{ type: "text", text: "private malformed response" }],
  }), () => jsonFailure.worker.fetch(request("POST", {
    body: { mode: "document", prompt: "private document request" },
  }), env));
  assert.equal(jsonResponse.status, 502);
  assert.equal(jsonFailure.metrics.length, 1);
  assertSafeAiMetric(jsonFailure.metrics[0], {
    task: "document", outcome: "json_parse_error", httpStatus: 200,
    inputTokens: 88, outputTokens: 13, stopReason: "end_turn",
  });

  const imageCaptured = await captureDefaultProviderRequest({ contentText: "null" });
  assert.equal(imageCaptured.value.status, 502, "비정상 최상위 JSON은 사용자 응답에서 거절해야 한다");
  assert.deepEqual(imageCaptured.quotaOps, ["reserve", "consume"]);
  const imageUsageEvents = aiMetricEvents(imageCaptured.entries);
  assert.equal(imageUsageEvents.length, 1, "비용이 든 실패도 사용량 이벤트를 정확히 한 번 기록해야 한다");
  assertSafeAiMetric(imageUsageEvents[0], {
    task: "problem_image", outcome: "json_parse_error", httpStatus: 200,
    inputTokens: 144, outputTokens: 7, stopReason: "end_turn",
  });
  assertConsoleExcludes(imageCaptured.entries, imageCaptured.secrets);

  const documentCaptured = await captureDefaultProviderRequest({
    documentMode: true,
    contentText: JSON.stringify({ title: "초안", blocks: [{ type: "paragraph", text: "본문" }] }),
  });
  assert.equal(documentCaptured.value.status, 200, "문서 정상 응답은 logger 검사 중에도 성공해야 한다");
  assert.deepEqual(documentCaptured.quotaOps, ["reserve", "consume"]);
  const documentUsageEvents = aiMetricEvents(documentCaptured.entries);
  assert.equal(documentUsageEvents.length, 1, "문서 성공도 사용량 이벤트를 정확히 한 번 기록해야 한다");
  assertSafeAiMetric(documentUsageEvents[0], {
    task: "document", outcome: "success", httpStatus: 200,
    inputTokens: 144, outputTokens: 7, stopReason: "end_turn",
  });
  assertConsoleExcludes(documentCaptured.entries, documentCaptured.secrets);

  const loggerFailure = testWorker({
    generateProblems: callAI,
    recordMetric: () => { throw new Error("logger unavailable"); },
  });
  const loggerFailureResponse = await withMockFetch(async () => Response.json({
    model: "claude-haiku-4-5-20251001",
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: '{"problems":[]}' }],
  }), () => loggerFailure.worker.fetch(request("POST", {
    body: { imageBase64: "safe-image", mimeType: "image/png" },
  }), env));
  assert.equal(loggerFailureResponse.status, 200,
    "측정 로거 자체의 실패가 성공한 AI 요청을 502로 바꾸면 안 된다");
}

async function testDeletionPurgeContract() {
  const deletion = testWorker();
  const response = await deletion.worker.fetch(request("DELETE"), env);
  assert.equal(response.status, 403);
  const purges = deletion.calls.filter((call) => call.kind === "quota" && call.op === "purge");
  assert.equal(purges.length, 0, "사용자가 비용 한도를 초기화할 수 없어야 한다");
  assert.equal(deletion.calls.filter((call) => call.kind === "ai").length, 0);
}

await testHealthAndOriginBoundary();
await testAuthenticationAndInputBoundary();
await testAppCheckBoundary();
await testKillSwitchBoundary();
await testQuotaAndProviderContract();
await testGlobalQuotaContract();
await testDocumentDraftContract();
await testAiUsageMetrics();
await testDeletionPurgeContract();

console.log("Worker request contract tests passed");
