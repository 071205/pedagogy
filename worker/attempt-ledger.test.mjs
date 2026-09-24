import assert from 'node:assert/strict';
import { AttemptLedger, attemptIdentity, validAttempt } from './attempt-ledger.js';
import { createWorker } from './index.js';

class MemoryStorage {
  values = new Map();
  alarmAt = null;
  queue = Promise.resolve();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async getAlarm() { return this.alarmAt; }
  async setAlarm(time) { this.alarmAt = time; }
  async deleteAlarm() { this.alarmAt = null; }
  async transaction(action) {
    const run = this.queue.then(() => action(this));
    this.queue = run.catch(() => {});
    return run;
  }
}

const hex = (c) => c.repeat(64);
const payload = (op, key = hex('a'), attemptId = hex('b'), more = {}) =>
  new Request('https://ledger.test/' + op, { method: 'POST',
    body: JSON.stringify({ op, key, attemptId, ...more }) });
const call = async (ledger, op, key, attemptId, more) =>
  (await ledger.fetch(payload(op, key, attemptId, more))).json();

let now = Date.parse('2026-09-24T23:59:58Z');
const storage = new MemoryStorage();
const ledger = new AttemptLedger({ storage }, {}, () => now);
const a = hex('a'), b = hex('b'), c = hex('c');
const [first, duplicate] = await Promise.all([
  call(ledger, 'begin', a, b, { retry: false }),
  call(ledger, 'begin', a, b, { retry: false }),
]);
assert.deepEqual([first.ok, duplicate.ok], [true, false], 'concurrent duplicate must not start twice');
assert.equal(storage.alarmAt, now + 10 * 60 * 1000, 'pending has its own ten-minute alarm');
assert.equal((await call(ledger, 'complete', a, b,
  { outcome: 'success', resultDigest: hex('d') })).ok, true);
now += 4_000; // crosses UTC midnight; the same user object and request key remain locked.
assert.equal((await call(ledger, 'begin', a, c, { retry: true })).ok, false,
  'success remains locked across UTC midnight even with an explicit retry');
assert.equal((await call(ledger, 'status', a)).resultDigest, hex('d'));

const failureKey = hex('e');
assert.equal((await call(ledger, 'begin', failureKey, b, { retry: false })).ok, true);
assert.equal((await call(ledger, 'complete', failureKey, b, { outcome: 'failure' })).ok, true);
assert.equal((await call(ledger, 'begin', failureKey, b, { retry: true })).ok, false,
  'retry must have a fresh attempt ID');
assert.equal((await call(ledger, 'begin', failureKey, c, { retry: false })).ok, false,
  'a failed call still requires explicit retry');
assert.equal((await call(ledger, 'begin', failureKey, c, { retry: true })).ok, true);
await call(ledger, 'cancel', failureKey, c);
assert.equal((await call(ledger, 'status', failureKey)).state, 'absent',
  'an unpaid reservation can be cancelled');

const pendingKey = hex('f');
await call(ledger, 'begin', pendingKey, b, { retry: false });
const firstAlarm = storage.alarmAt;
now = firstAlarm + 1;
await ledger.alarm();
assert.equal((await call(ledger, 'status', pendingKey)).state, 'absent');
assert.equal((await call(ledger, 'status', a)).state, 'completed',
  'the earliest alarm must leave later records intact');
assert.ok(storage.alarmAt > now, 'the next expiry is rearmed');
now = storage.alarmAt + 1;
await ledger.alarm();
assert.equal((await call(ledger, 'status', a)).state, 'absent');
assert.equal(storage.alarmAt, null, 'no unbounded alarm remains');
assert.equal((await call(ledger, 'begin', a, c, { retry: true })).ok, true,
  'an explicit user retry is allowed after the retention window');

const cappedStorage = new MemoryStorage();
await cappedStorage.put('ledger', { entries: Object.fromEntries(
  Array.from({ length: 1_000 }, (_, i) => [i.toString(16).padStart(64, '0'),
    { state: 'completed', attemptId: b, outcome: 'failure', expiresAt: now + 60_000 }])
), closedUntil: 0 });
const cappedLedger = new AttemptLedger({ storage: cappedStorage }, {}, () => now);
assert.equal((await call(cappedLedger, 'begin', hex('f'), c, { retry: false })).state,
  'capacity', 'unpaid attempts cannot grow a user object without bound');

const env = { ATTEMPT_HMAC_KEY: 'fixture-secret-at-least-thirty-two-characters',
  ATTEMPT_HMAC_VERSION: 'v1' };
const attempt = { jobId: 'job_12345678', sourceHash: hex('1'), pageNumber: 4,
  extractionContractHash: hex('2'), attemptId: 'attempt_12345678', retry: false };
assert.equal(validAttempt(attempt), true);
assert.equal(validAttempt({ ...attempt, pageNumber: 0 }), false);
const identity = await attemptIdentity(env, 'user-1', attempt);
const sameTomorrow = await attemptIdentity(env, 'user-1', { ...attempt });
const otherUser = await attemptIdentity(env, 'user-2', attempt);
assert.equal(identity.objectName, sameTomorrow.objectName, 'ledger object has no UTC date');
assert.equal(identity.key, sameTomorrow.key);
assert.notEqual(identity.key, otherUser.key, 'UID is authenticated server input');

// Exercise the real Worker path against the DO, with fake quota/provider boundaries.
let providerCalls = 0;
let quotaCalls = 0;
let failProvider = false;
const objects = new Map();
const runtime = { ...env, ALLOWED_ORIGINS: 'https://app.example',
  FIREBASE_PROJECT_ID: 'test', DAILY_LIMIT: '5', GLOBAL_DAILY_LIMIT: '0',
  AI_PROVIDER: 'anthropic', ANTHROPIC_KEY: 'fixture',
  ATTEMPT_LEDGER: {
    idFromName: (name) => name,
    get(name) {
      if (!objects.has(name)) objects.set(name,
        new AttemptLedger({ storage: new MemoryStorage() }));
      return { fetch: (url, options) => objects.get(name).fetch(new Request(url, options)) };
    },
  },
};
const worker = createWorker({
  verifyToken: async () => ({ uid: 'user-1', claims: { auth_time: Math.floor(Date.now() / 1000) } }),
  requestQuota: async (_env, _uid, op) => {
    quotaCalls++;
    return op === 'reserve' ? { ok: true, used: 0, limit: 5 }
      : { ok: true, used: 1, limit: 5 };
  },
  generateProblems: async () => {
    providerCalls++;
    if (failProvider) throw new Error('provider failed');
    return [{ title: 'fixture', blocks: [] }];
  },
});
const aiRequest = (entry) => new Request('https://worker.test/ai', {
  method: 'POST', headers: { Origin: 'https://app.example', Authorization: 'Bearer fixture' },
  body: JSON.stringify({ imageBase64: 'YQ==', mimeType: 'image/png', attempt: entry }),
});
assert.equal((await worker.fetch(new Request('https://worker.test/ai', {
  method: 'POST', headers: { Origin: 'https://app.example', Authorization: 'Bearer fixture' },
  body: JSON.stringify({ imageBase64: 'not base64 !', mimeType: 'image/png', attempt }),
}), runtime)).status, 400);
assert.equal(providerCalls, 0);
assert.equal((await worker.fetch(aiRequest(attempt), runtime)).status, 200);
const charged = quotaCalls;
// Simulate the browser losing the first successful response before seeing it.
if (process.env.ATTEMPT_LEDGER_RED === '1') {
  runtime.ATTEMPT_LEDGER.get = () => ({ fetch: async () => Response.json({ ok: true }) });
}
assert.equal((await worker.fetch(aiRequest(attempt), runtime)).status, 409);
assert.equal(providerCalls, 1, 'lost response must not call the provider again');
assert.equal(quotaCalls, charged, 'duplicate must stop before quota');
assert.equal((await worker.fetch(aiRequest({ ...attempt, sourceHash: hex('9'),
  extractionContractHash: hex('8'), attemptId: 'attempt_spoof_123' }), runtime)).status, 409,
  'client-supplied hash labels cannot bypass the server-derived request key');

const failed = { ...attempt, pageNumber: 5, attemptId: 'attempt_fail_123' };
failProvider = true;
assert.equal((await worker.fetch(aiRequest(failed), runtime)).status, 502);
assert.equal((await worker.fetch(aiRequest(failed), runtime)).status, 409);
failProvider = false;
assert.equal((await worker.fetch(aiRequest({ ...failed, attemptId: 'attempt_retry_123', retry: true }), runtime)).status, 200);
assert.equal(providerCalls, 3, 'only an explicit new attempt retries the failed page');

const quotaBeforeDelete = quotaCalls;
const deleteRequest = () => new Request('https://worker.test/account/ledger', {
  method: 'DELETE', headers: { Origin: 'https://app.example', Authorization: 'Bearer fixture' },
});
assert.equal((await worker.fetch(deleteRequest(), runtime)).status, 200);
assert.equal(quotaCalls, quotaBeforeDelete, 'account purge must not reset DailyQuota');
assert.equal((await worker.fetch(aiRequest({ ...attempt, pageNumber: 6 }), runtime)).status, 409,
  'deletion fence blocks paid-page replay if Auth deletion fails');
assert.equal(providerCalls, 3);

const staleWorker = createWorker({
  verifyToken: async () => ({ uid: 'user-1', claims: { auth_time: 1 } }),
  requestLedger: async () => { throw new Error('must not purge without reauthentication'); },
});
assert.equal((await staleWorker.fetch(deleteRequest(), runtime)).status, 403);

console.log('AttemptLedger and Worker B5 contract tests passed');
