import assert from "node:assert/strict";
import { DailyQuota, allowedOrigins, corsHeaders, dailyLimit, quotaKey } from "./index.js";

/* Durable Object storage의 transaction 직렬화를 흉내 낸다. 실제 Worker와 같은
   요청 순서에서 한도 1이 동시 두 요청을 모두 통과시키지 않는지를 검증한다. */
class MemoryStorage {
  #data = new Map();
  #tail = Promise.resolve();
  #alarm = null;

  async get(key) {
    const value = this.#data.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  async put(key, value) {
    this.#data.set(key, structuredClone(value));
  }

  async getAlarm() {
    return this.#alarm;
  }

  async setAlarm(time) {
    this.#alarm = time;
  }

  async deleteAll() {
    this.#data.clear();
    this.#alarm = null;
  }

  async transaction(fn) {
    let release;
    const previous = this.#tail;
    this.#tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await fn(this);
    } finally {
      release();
    }
  }
}

const request = (op, reservationId, limit = 1) => new Request("https://quota.test/" + op, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ op, reservationId, limit }),
});

async function call(quota, op, reservationId, limit = 1) {
  const response = await quota.fetch(request(op, reservationId, limit));
  assert.equal(response.status, 200);
  return response.json();
}

async function testQuota() {
  const storage = new MemoryStorage();
  const quota = new DailyQuota({ storage });
  const [first, second] = await Promise.all([
    call(quota, "reserve", "first"),
    call(quota, "reserve", "second"),
  ]);
  assert.equal([first, second].filter((r) => r.ok).length, 1,
    "한도 1에서는 동시 예약도 하나만 성공해야 한다");
  assert.ok(await storage.getAlarm(), "첫 예약은 48시간 뒤 자동 파기 alarm을 예약해야 한다");

  const winner = first.ok ? "first" : "second";
  const consumed = await call(quota, "consume", winner);
  assert.equal(consumed.ok, true);
  assert.equal(consumed.used, 1);

  const duplicateConsume = await call(quota, "consume", winner);
  assert.equal(duplicateConsume.used, 1, "확정 재시도는 사용량을 두 번 세면 안 된다");
  assert.equal((await call(quota, "reserve", "third")).ok, false,
    "확정 뒤에는 한도 초과 예약을 막아야 한다");

  const releasable = new DailyQuota({ storage: new MemoryStorage() });
  assert.equal((await call(releasable, "reserve", "failed-ai")).ok, true);
  assert.equal((await call(releasable, "release", "failed-ai")).ok, true);
  assert.equal((await call(releasable, "reserve", "retry")).ok, true,
    "외부 요청 전 실패로 예약을 해제하면 같은 날 재시도할 수 있어야 한다");

  const malformedLimit = await call(new DailyQuota({ storage: new MemoryStorage() }), "reserve", "bad-limit", 10_001);
  assert.equal(malformedLimit.limit, 50,
    "비정상적으로 큰 한도 설정은 안전한 기본 상한으로 되돌아가야 한다");

  await quota.alarm();
  assert.equal((await call(quota, "reserve", "after-alarm")).ok, true,
    "48시간 alarm 뒤에는 저장소가 비워져야 한다");

  await call(quota, "purge", "");
  assert.equal((await call(quota, "reserve", "after-purge")).ok, true,
    "계정 삭제 purge 뒤에는 사용량이 남아 있으면 안 된다");
}

async function testWorkerBoundaryHelpers() {
  const env = {
    ALLOWED_ORIGINS: "https://app.example, https://admin.example/ , ,",
    DAILY_LIMIT: "50",
    PLAN_DAILY_LIMITS_JSON: JSON.stringify({ free: 10, pro: 200, unsafe: 10001 }),
  };
  assert.deepEqual(allowedOrigins(env), ["https://app.example", "https://admin.example"],
    "허용 출처는 공백·끝 슬래시를 정규화하고 빈 항목을 버려야 한다");

  const allowed = corsHeaders(new Request("https://worker.example/", {
    headers: { Origin: "https://app.example" },
  }), env);
  assert.equal(allowed["Access-Control-Allow-Origin"], "https://app.example");
  assert.equal(allowed["Access-Control-Allow-Methods"], "POST, DELETE, OPTIONS");
  assert.equal(allowed.Vary, "Origin");

  const denied = corsHeaders(new Request("https://worker.example/", {
    headers: { Origin: "https://evil.example" },
  }), env);
  assert.equal(denied["Access-Control-Allow-Origin"], undefined,
    "허용되지 않은 출처에는 CORS 허용 헤더를 주면 안 된다");

  assert.equal(dailyLimit(env, { pedagogy_plan: "free" }), 10);
  assert.equal(dailyLimit(env, { pedagogy_plan: "pro" }), 200);
  assert.equal(dailyLimit(env, { pedagogy_plan: "unsafe" }), 50,
    "플랜 설정이 절대 상한을 넘으면 안전한 기본 한도로 돌아가야 한다");
  assert.equal(dailyLimit({ DAILY_LIMIT: "not-a-number", PLAN_DAILY_LIMITS_JSON: "{}" }, {}), 50);

  const uid = "sensitive-user-id@example.test";
  const key = await quotaKey(uid, new Date("2026-08-28T12:00:00.000Z"));
  assert.match(key, /^ai:[a-f0-9]{64}:2026-08-28$/);
  assert.ok(!key.includes(uid), "Durable Object 이름에 UID 원문이 남으면 안 된다");
}

await testQuota();
await testWorkerBoundaryHelpers();

console.log("Worker quota and boundary tests passed");
