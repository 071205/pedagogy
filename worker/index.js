/**
 * PEDAGOGY — AI 변환 프록시 (Cloudflare Worker)
 *
 * 문제 사진을 받아 AI 로 문항 구조(blocks)를 뽑아 돌려준다.
 * 이 Worker 가 존재하는 이유는 **AI 공급자 키를 브라우저에 노출하지 않기 위해서**다.
 * 키는 반드시 Workers Secret 으로만 넣는다(코드에 적지 말 것).
 *
 * ── 이 파일이 막는 것 ──
 * 예전에는 인증이 전혀 없어서, 소스에서 주소만 읽으면 누구나 호출해
 * 이 계정의 AI 사용량을 태울 수 있었다. 이제:
 *   · Firebase ID 토큰이 있어야 하고(로그인한 사용자만)
 *   · 사용자별 하루 호출 횟수를 원자적으로 제한하며
 *   · AI 호출 기록은 48시간 뒤 자동 파기하고, 계정 삭제 때 즉시 파기하며
 *   · 허용된 출처에서 온 요청만 받는다
 *
 * ── 배포 ──
 *   cd worker
 *   npx wrangler secret put ANTHROPIC_KEY   # AI 공급자 키
 *   npx wrangler deploy
 *
 * ── 환경 변수(wrangler.toml / Secret) ──
 *   FIREBASE_PROJECT_ID  예: pedagogy-huryul
 *   ALLOWED_ORIGINS      쉼표로 구분한 허용 출처
 *   DAILY_LIMIT          사용자당 하루 호출 상한 (기본 50)
 *   PLAN_DAILY_LIMITS_JSON Firebase custom claim별 상한 JSON (선택)
 *   ANTHROPIC_KEY        (Secret) AI 공급자 키
 *   QUOTA                (Durable Object 바인딩) 사용량 카운터
 */

import { verifyIdToken } from "./auth.js";

const DEFAULT_DAILY_LIMIT = 50;
// 환경 변수 오타나 잘못된 Billing claim 매핑이 비용 상한을 무력화하지 않게 하는
// 최종 방어선이다. 더 큰 계약 플랜이 필요하면 코드 리뷰와 비용 알림을 함께 갱신한다.
const MAX_DAILY_LIMIT = 10_000;
const MAX_BODY_BYTES = 8 * 1024 * 1024; // 이미지 base64 상한

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const list = allowedOrigins(env);
  const h = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (origin && list.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Vary"] = "Origin";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Allow-Methods"] = "POST, DELETE, OPTIONS";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

/**
 * 사용자별 하루 호출 제한. UID 원문은 Durable Object 이름에 넣지 않고 SHA-256 해시를 쓴다.
 * 각 uid+UTC 날짜는 하나의 Durable Object를 쓰므로 예약·사용 확정이 직렬화된다.
 *
 * 외부 AI 요청은 정확히 한 번 사용량을 세는 트랜잭션으로 만들 수 없다. 요청을 보낸 뒤
 * 네트워크가 끊기면 공급자가 이미 처리했는지 알 수 없기 때문이다. 그래서 실제 외부 요청을
 * 시작하기 전에 사용량을 확정한다. 공급자 오류도 하나의 AI 요청 시도로 센다. 이 정책이
 * 비용 상한을 지키며, 정상 입력 검증 실패는 그 전에 걸러져 사용량을 차감하지 않는다.
 */
async function quotaKey(uid, when = new Date()) {
  const bytes = new TextEncoder().encode(uid);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
  const day = when.toISOString().slice(0, 10); // UTC 기준 YYYY-MM-DD
  return `ai:${hash}:${day}`;
}
const RESERVATION_TTL_MS = 5 * 60 * 1000;
const QUOTA_RETENTION_MS = 48 * 60 * 60 * 1000;

function isDailyLimit(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_DAILY_LIMIT;
}

function dailyLimit(env, claims) {
  const n = parseInt(env.DAILY_LIMIT || DEFAULT_DAILY_LIMIT, 10);
  const fallback = isDailyLimit(n) ? n : DEFAULT_DAILY_LIMIT;
  let plans;
  try { plans = JSON.parse(env.PLAN_DAILY_LIMITS_JSON || "{}"); }
  catch { return fallback; }
  const plan = typeof claims?.pedagogy_plan === "string" ? claims.pedagogy_plan : "free";
  const limit = plans?.[plan];
  return isDailyLimit(limit) ? limit : fallback;
}

function quotaState(raw) {
  const validTimes = (v) => Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {})
    .filter(([id, t]) => typeof id === "string" && id.length <= 128
      && Number.isSafeInteger(t) && t > 0));
  return {
    used: Number.isSafeInteger(raw?.used) && raw.used >= 0 ? raw.used : 0,
    reservations: validTimes(raw?.reservations),
    consumed: validTimes(raw?.consumed),
  };
}

function pruneReservations(state, now) {
  for (const [id, startedAt] of Object.entries(state.reservations)) {
    if (now - startedAt > RESERVATION_TTL_MS) delete state.reservations[id];
  }
}

/** Durable Object: 하나의 uid+날짜에 들어온 quota 조작을 원자적으로 직렬화한다. */
export class DailyQuota {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== "POST") return json({ error: "POST 만 허용합니다" }, 405, {});
    let body;
    try { body = await request.json(); }
    catch { return json({ error: "잘못된 quota 요청입니다" }, 400, {}); }

    const op = body?.op;
    const reservationId = typeof body?.reservationId === "string" ? body.reservationId : "";
    const limit = isDailyLimit(body?.limit) ? body.limit : DEFAULT_DAILY_LIMIT;
    if (!['reserve', 'consume', 'release', 'purge'].includes(op)
      || (op !== 'purge' && (!reservationId || reservationId.length > 128)))
      return json({ error: "잘못된 quota 요청입니다" }, 400, {});

    if (op === "purge") {
      await this.state.storage.deleteAll();
      return json({ ok: true }, 200, {});
    }

    const result = await this.state.storage.transaction(async (storage) => {
      const state = quotaState(await storage.get("quota"));
      const now = Date.now();
      pruneReservations(state, now);
      const pending = () => Object.keys(state.reservations).length;

      if (op === "reserve") {
        if (state.consumed[reservationId] || state.reservations[reservationId]) {
          return { ok: true, used: state.used, limit, pending: pending() };
        }
        if (state.used + pending() >= limit) {
          return { ok: false, used: state.used, limit, pending: pending() };
        }
        state.reservations[reservationId] = now;
        await storage.put("quota", state);
        if (await storage.getAlarm() === null) await storage.setAlarm(now + QUOTA_RETENTION_MS);
        return { ok: true, used: state.used, limit, pending: pending() };
      }

      if (op === "consume") {
        if (state.consumed[reservationId]) {
          return { ok: true, used: state.used, limit, pending: pending() };
        }
        if (!state.reservations[reservationId]) {
          return { ok: false, used: state.used, limit, pending: pending(), error: "reservation expired" };
        }
        delete state.reservations[reservationId];
        state.consumed[reservationId] = now;
        state.used += 1;
        await storage.put("quota", state);
        return { ok: true, used: state.used, limit, pending: pending() };
      }

      // 외부 AI 요청을 시작하기 전에만 예약을 반납한다.
      if (state.reservations[reservationId]) {
        delete state.reservations[reservationId];
        await storage.put("quota", state);
      }
      return { ok: true, used: state.used, limit, pending: pending() };
    });
    return json(result, 200, {});
  }

  async alarm() {
    // 오래된 일자별 카운터가 요청을 받지 않아도 48시간 뒤 자동 파기된다.
    await this.state.storage.deleteAll();
  }
}

async function quotaRequest(env, uid, op, reservationId = "", { limit, when } = {}) {
  if (!env.QUOTA) throw new Error("QUOTA Durable Object 바인딩이 설정되지 않았습니다");
  const id = env.QUOTA.idFromName(await quotaKey(uid, when));
  const stub = env.QUOTA.get(id);
  const r = await stub.fetch("https://quota.internal/" + op, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, reservationId, limit: isDailyLimit(limit) ? limit : dailyLimit(env) }),
  });
  if (!r.ok) throw new Error("quota 처리 실패 (" + r.status + ")");
  return r.json();
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    // 인증이 필요 없는 운영 상태 확인용. 사용자·사용량·설정값은 전혀 반환하지 않는다.
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return json({ ok: true }, 200, { "Cache-Control": "no-store" });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST" && request.method !== "DELETE") {
      return json({ error: "POST 또는 DELETE 만 허용합니다" }, 405, cors);
    }

    // 공개 브라우저 API는 허용 목록의 출처에서만 받는다. Origin 없는 직접 호출도
    // 허용하면 다른 웹·스크립트가 Firebase 토큰을 들고 이 API를 재사용할 수 있다.
    const origin = request.headers.get("Origin");
    const list = allowedOrigins(env);
    if (!origin || !list.includes(origin)) {
      return json({ error: "허용되지 않은 출처입니다" }, 403, cors);
    }

    // ── 1. 로그인 확인 ──
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) {
      return json({ error: "로그인이 필요합니다" }, 401, cors);
    }

    let user;
    try {
      user = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);
    } catch (e) {
      // 실패 사유를 그대로 흘리면 공격자에게 힌트가 되므로 로그로만 남긴다
      console.error("토큰 검증 실패:", e.message);
      return json({ error: "로그인이 유효하지 않습니다" }, 401, cors);
    }

    if (request.method === "DELETE") {
      try {
        // 현재 UTC 일자와 직전 이틀만 남아 있을 수 있다(48시간 retention).
        const now = Date.now();
        await Promise.all([0, 1, 2].map((daysAgo) =>
          quotaRequest(env, user.uid, "purge", "", { when: new Date(now - daysAgo * 24 * 60 * 60 * 1000) })
        ));
        return new Response(null, { status: 204, headers: cors });
      } catch (e) {
        console.error("AI usage 삭제 실패:", e?.message || e);
        return json({ error: "AI 사용 기록을 지우지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503, cors);
      }
    }

    // ── 2. 본문 검사 (사용량을 깎기 전에 먼저) ──
    const len = parseInt(request.headers.get("Content-Length") || "0", 10);
    if (len && len > MAX_BODY_BYTES) {
      return json({ error: "이미지가 너무 큽니다" }, 413, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "잘못된 요청 형식입니다" }, 400, cors);
    }

    const { imageBase64, mimeType } = body || {};
    if (typeof imageBase64 !== "string" || !imageBase64) {
      return json({ error: "이미지가 없습니다" }, 400, cors);
    }
    if (imageBase64.length > MAX_BODY_BYTES) {
      return json({ error: "이미지가 너무 큽니다" }, 413, cors);
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
      return json({ error: "이미지 형식이 아닙니다" }, 400, cors);
    }
    if (!env.ANTHROPIC_KEY) {
      return json({ error: "AI 기능을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요." }, 503, cors);
    }
    const limit = dailyLimit(env, user.claims);

    // ── 3. 남은 한도를 원자적으로 예약 ──
    const reservationId = crypto.randomUUID();
    let reserved = false;
    let rate;
    try {
      rate = await quotaRequest(env, user.uid, "reserve", reservationId, { limit });
      reserved = !!rate.ok;
    } catch (e) {
      console.error("AI quota 예약 실패:", e);
      return json({ error: "AI 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503, cors);
    }
    if (!reserved) {
      return json(
        { error: `오늘 사용량(${rate.limit}회)을 모두 썼습니다. 내일 다시 시도해 주세요.` },
        429, cors
      );
    }

    // ── 4. 외부 호출 전에 사용량 확정 ──
    let after;
    try {
      after = await quotaRequest(env, user.uid, "consume", reservationId, { limit });
      if (!after.ok) throw new Error("AI 사용량 확정에 실패했습니다");
      reserved = false;
    } catch (e) {
      if (reserved) {
        try { await quotaRequest(env, user.uid, "release", reservationId, { limit }); }
        catch (releaseError) { console.error("AI quota 예약 해제 실패:", releaseError); }
      }
      console.error("AI quota 확정 실패:", e?.message || e);
      return json({ error: "AI 사용량을 확정하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503, cors);
    }

    // ── 5. AI 호출 (사용량은 이미 확정됨) ──
    try {
      const problems = await callAI(env, imageBase64, mimeType);
      return json({ problems, usage: { used: after.used, limit: after.limit } }, 200, cors);
    } catch (e) {
      console.error("AI 호출 실패:", e?.message || e);
      return json({ error: "AI 변환에 실패했습니다. 이미지와 네트워크 상태를 확인한 뒤 다시 시도해 주세요." }, 502, cors);
    }
  },
};

const SYSTEM_PROMPT = `너는 한국 수학 문제집 편집기의 입력 도우미다.
입력 이미지에는 수학 문제 한 개(또는 여러 개)가 들어 있다.
각 문제를 아래 JSON 구조로 변환하라. 수식은 모두 LaTeX로, $...$ (인라인) 또는 $$...$$ (디스플레이)로 감싼다.

출력은 반드시 다음 형태의 JSON 객체 하나뿐이어야 한다. 코드블록, 설명, 마크다운 금지.
{
  "problems": [
    {
      "title": "",
      "blocks": [
        { "type": "statement",  "text": "문제 발문 (LaTeX 포함)" },
        { "type": "conditions", "items": ["조건1", "조건2"] },
        { "type": "examples",   "items": ["ㄱ 내용", "ㄴ 내용", "ㄷ 내용"] },
        { "type": "choices",    "items": ["①내용","②내용","③내용","④내용","⑤내용"] },
        { "type": "boxed",      "text": "박스 내용" }
      ]
    }
  ]
}

규칙:
- statement 블록은 반드시 포함한다. 나머지는 이미지에 실제로 있을 때만 넣는다.
- conditions/examples/choices의 items에는 라벨 기호((가),(나),①,②,ㄱ. 등)를 적지 말고 내용만 적는다.
- choices가 있으면 정확히 5개로 맞춘다 (부족하면 빈 문자열로 채움).
- 한글은 LaTeX 밖에 그대로 둔다. 수식 안 한글은 \\text{한글}을 쓴다.
- 적분/시그마/극한이 인라인($...$)에 있으면 \\displaystyle을 붙인다.
- JSON 외에는 아무것도 출력하지 않는다.`;

/**
 * 이미지 → 문항 blocks 변환. 반환값은 index.html 의 aiBlocksToProblem() 이 기대하는 모양:
 *   [{ title?: string,
 *      blocks: [ {type:'statement'|'boxed', text}
 *              | {type:'conditions'|'examples', items:[...]}
 *              | {type:'choices', items:[...5개]} ] }]
 *
 * 키 이름은 기존 Worker 와 같은 ANTHROPIC_KEY 를 그대로 쓴다
 * (이미 이 Worker 에 secret 으로 등록돼 있어 다시 넣을 필요가 없다).
 */
async function callAI(env, imageBase64, mimeType) {
  if (!env.ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY 가 설정되지 않았습니다");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.AI_MODEL || "claude-haiku-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType || "image/png", data: imageBase64 },
            },
            { type: "text", text: "이 이미지의 문제를 지정된 JSON 구조로 변환해 줘." },
          ],
        },
      ],
    }),
  });

  if (!r.ok) {
    // 공급자 오류 원문과 AI 출력은 운영 로그에 남기지 않는다. 문제 이미지의 내용이나
    // 개인 정보가 오류 설명에 반사될 수 있기 때문이다.
    console.error("Anthropic API 오류:", r.status);
    throw new Error("AI 공급자 오류 (" + r.status + ")");
  }

  const data = await r.json();
  const text = data?.content?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    console.error("AI JSON 파싱 실패");
    throw new Error("AI 응답을 해석하지 못했습니다");
  }

  const problems = Array.isArray(parsed) ? parsed : parsed.problems;
  if (!Array.isArray(problems)) throw new Error("AI 응답에 problems 가 없습니다");
  return problems;
}
