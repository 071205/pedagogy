// B5: paid-call state is independent of the UTC-day quota counter. No source image,
// prompt, provider response, UID, or client identifier is stored in this object.
const PENDING_MS = 10 * 60 * 1000;
const COMPLETED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 1_000;
const HEX_256 = /^[a-f0-9]{64}$/;

const reply = (value, status = 200) => Response.json(value, { status });

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export async function imageSourceHash(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return sha256Hex(bytes);
}

function clean(raw, now) {
  const entries = {};
  for (const [key, value] of Object.entries(raw?.entries || {})) {
    if (HEX_256.test(key) && value && Number.isSafeInteger(value.expiresAt)
      && value.expiresAt > now && ['pending', 'completed'].includes(value.state)) {
      entries[key] = value;
    }
  }
  const closedUntil = Number.isSafeInteger(raw?.closedUntil) && raw.closedUntil > now
    ? raw.closedUntil : 0;
  return { entries, closedUntil };
}

async function setNextAlarm(storage, ledger) {
  const expiries = Object.values(ledger.entries).map((entry) => entry.expiresAt);
  if (ledger.closedUntil) expiries.push(ledger.closedUntil);
  if (expiries.length) await storage.setAlarm(Math.min(...expiries));
  else await storage.deleteAlarm();
}

export class AttemptLedger {
  constructor(state, _env, now = Date.now) {
    this.storage = state.storage;
    this.now = now;
  }

  async fetch(request) {
    if (request.method !== 'POST') return reply({ error: 'POST required' }, 405);
    let body;
    try { body = await request.json(); }
    catch { return reply({ error: 'invalid request' }, 400); }
    const { op, key, attemptId, retry, outcome, resultDigest } = body || {};
    if (!['begin', 'complete', 'cancel', 'status', 'purge'].includes(op)
      || (op !== 'purge' && !HEX_256.test(key))
      || (['begin', 'complete', 'cancel'].includes(op) && !HEX_256.test(attemptId))
      || (op === 'begin' && typeof retry !== 'boolean')
      || (op === 'complete' && (!['success', 'failure'].includes(outcome)
        || (outcome === 'success' && !HEX_256.test(resultDigest))))) {
      return reply({ error: 'invalid request' }, 400);
    }

    const result = await this.storage.transaction(async (storage) => {
      const now = this.now();
      const ledger = clean(await storage.get('ledger'), now);
      let result;
      if (op === 'purge') {
        // Keep only a short-lived deletion fence. If Firebase Auth deletion fails,
        // paid-call replay remains blocked while account deletion is retried.
        ledger.entries = {};
        ledger.closedUntil = now + COMPLETED_MS;
        result = { ok: true };
      } else if (ledger.closedUntil) {
        result = { ok: false, state: 'closed' };
      } else {
        const previous = ledger.entries[key];
        if (op === 'status') {
          result = previous
            ? { ok: true, state: previous.state, outcome: previous.outcome || null,
              resultDigest: previous.resultDigest || null, expiresAt: previous.expiresAt }
            : { ok: true, state: 'absent' };
        } else if (op === 'begin') {
          if (previous && (previous.state === 'pending' || previous.outcome === 'success'
            || !retry || previous.attemptId === attemptId)) {
            result = { ok: false, state: previous.state, outcome: previous.outcome || null };
          } else if (!previous && Object.keys(ledger.entries).length >= MAX_ENTRIES) {
            result = { ok: false, state: 'capacity' };
          } else {
            ledger.entries[key] = { state: 'pending', attemptId,
              expiresAt: now + PENDING_MS };
            result = { ok: true, state: 'pending' };
          }
        } else if (op === 'complete') {
          if (!previous || previous.state !== 'pending' || previous.attemptId !== attemptId) {
            result = { ok: false, state: previous?.state || 'absent' };
          } else {
            ledger.entries[key] = { state: 'completed', attemptId, outcome,
              ...(outcome === 'success' ? { resultDigest } : {}),
              expiresAt: now + COMPLETED_MS };
            result = { ok: true, state: 'completed' };
          }
        } else if (op === 'cancel') {
          if (previous?.state === 'pending' && previous.attemptId === attemptId) {
            delete ledger.entries[key];
          }
          result = { ok: true };
        }
      }
      await storage.put('ledger', ledger);
      await setNextAlarm(storage, ledger);
      return result;
    });
    return reply(result);
  }

  async alarm() {
    await this.storage.transaction(async (storage) => {
      const ledger = clean(await storage.get('ledger'), this.now());
      await storage.put('ledger', ledger);
      await setNextAlarm(storage, ledger);
    });
  }
}

export function validAttempt(input) {
  return input && typeof input === 'object' && !Array.isArray(input)
    && typeof input.jobId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(input.jobId)
    && typeof input.sourceHash === 'string' && HEX_256.test(input.sourceHash)
    && Number.isSafeInteger(input.pageNumber) && input.pageNumber > 0 && input.pageNumber <= 500
    && typeof input.extractionContractHash === 'string' && HEX_256.test(input.extractionContractHash)
    && typeof input.attemptId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(input.attemptId)
    && typeof input.retry === 'boolean';
}

export async function attemptIdentity(env, uid, input) {
  const secret = env.ATTEMPT_HMAC_KEY;
  const version = env.ATTEMPT_HMAC_VERSION || 'v1';
  if (typeof secret !== 'string' || secret.length < 32 || !/^v[1-9][0-9]*$/.test(version)) {
    throw new Error('AttemptLedger HMAC configuration unavailable');
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  async function sign(parts) {
    const digest = await crypto.subtle.sign('HMAC', key,
      new TextEncoder().encode(JSON.stringify([version, ...parts])));
    return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  const objectName = `${version}:${await sign(['user', uid])}`;
  if (!input) return { objectName };
  return {
    objectName,
    key: await sign(['request', uid, input.jobId, input.sourceHash,
      input.pageNumber, input.extractionContractHash]),
    attemptId: await sign(['attempt', uid, input.attemptId]),
    digest: async (value) => sign(['result', value]),
  };
}
