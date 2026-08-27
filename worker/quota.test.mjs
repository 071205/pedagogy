import assert from "node:assert/strict";
import { DailyQuota as ModuleDailyQuota } from "./index.js";
import { DailyQuota as SingleFileDailyQuota } from "./worker-single-file.js";

/* Durable Object storage의 transaction 직렬화를 흉내 낸다. 실제 Worker와 같은
   요청 순서에서 한도 1이 동시 두 요청을 모두 통과시키지 않는지를 검증한다. */
class MemoryStorage {
  #data = new Map();
  #tail = Promise.resolve();

  async get(key) {
    const value = this.#data.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  async put(key, value) {
    this.#data.set(key, structuredClone(value));
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

async function testQuota(DailyQuota, label) {
  const quota = new DailyQuota({ storage: new MemoryStorage() });
  const [first, second] = await Promise.all([
    call(quota, "reserve", "first"),
    call(quota, "reserve", "second"),
  ]);
  assert.equal([first, second].filter((r) => r.ok).length, 1,
    `${label}: 한도 1에서는 동시 예약도 하나만 성공해야 한다`);

  const winner = first.ok ? "first" : "second";
  const committed = await call(quota, "commit", winner);
  assert.equal(committed.ok, true);
  assert.equal(committed.used, 1);

  const duplicateCommit = await call(quota, "commit", winner);
  assert.equal(duplicateCommit.used, 1, `${label}: 확정 재시도는 사용량을 두 번 세면 안 된다`);
  assert.equal((await call(quota, "reserve", "third")).ok, false,
    `${label}: 확정 뒤에는 한도 초과 예약을 막아야 한다`);

  const releasable = new DailyQuota({ storage: new MemoryStorage() });
  assert.equal((await call(releasable, "reserve", "failed-ai")).ok, true);
  assert.equal((await call(releasable, "release", "failed-ai")).ok, true);
  assert.equal((await call(releasable, "reserve", "retry")).ok, true,
    `${label}: AI 실패로 예약을 해제하면 같은 날 재시도할 수 있어야 한다`);
}

await testQuota(ModuleDailyQuota, "모듈 Worker");
await testQuota(SingleFileDailyQuota, "단일 파일 Worker");

console.log("DailyQuota tests passed (module + single-file)");
