import assert from "node:assert/strict";
import { createWorker } from "./index.js";

const env = {
  ALLOWED_ORIGINS: "https://app.example",
  FIREBASE_PROJECT_ID: "pedagogy-test",
  ANTHROPIC_KEY: "test-secret",
  DAILY_LIMIT: "5",
  PLAN_DAILY_LIMITS_JSON: JSON.stringify({ free: 5, pro: 20 }),
};

const request = (method, {
  origin = "https://app.example",
  token = "test-token",
  body,
  extraHeaders = {},
} = {}) => {
  const headers = new Headers(extraHeaders);
  if (origin !== null) headers.set("Origin", origin);
  if (token !== null) headers.set("Authorization", "Bearer " + token);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request("https://worker.example/ai", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

function testWorker({
  verifyToken = async () => ({ uid: "user-1", claims: { pedagogy_plan: "pro" } }),
  quotaResult = {},
  generateProblems = async () => [{ title: "변환됨", blocks: [] }],
} = {}) {
  const calls = [];
  const worker = createWorker({
    verifyToken: async (...args) => {
      calls.push({ kind: "verify", args });
      return verifyToken(...args);
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
  });
  return { worker, calls };
}

async function body(response) {
  return response.json();
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

  const blocked = await worker.fetch(request("POST", { origin: "https://evil.example", body: {} }), env);
  assert.equal(blocked.status, 403);
  assert.equal(calls.length, 0, "차단된 출처는 토큰 검증 전 거절해야 한다");

  const missingOrigin = await worker.fetch(request("POST", { origin: null, body: {} }), env);
  assert.equal(missingOrigin.status, 403);

  const missingToken = await worker.fetch(request("POST", { token: null, body: {} }), env);
  assert.equal(missingToken.status, 401);
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

async function testDeletionPurgeContract() {
  const deletion = testWorker();
  const response = await deletion.worker.fetch(request("DELETE"), env);
  assert.equal(response.status, 204);
  const purges = deletion.calls.filter((call) => call.kind === "quota" && call.op === "purge");
  assert.equal(purges.length, 3, "48시간 보존 범위의 현재·직전 이틀 quota를 모두 지워야 한다");
  assert.equal(deletion.calls.filter((call) => call.kind === "ai").length, 0);
}

await testHealthAndOriginBoundary();
await testAuthenticationAndInputBoundary();
await testQuotaAndProviderContract();
await testDeletionPurgeContract();

console.log("Worker request contract tests passed");
