/**
 * PEDAGOGY — AI 변환 프록시 (Cloudflare Worker) · 단일 파일 버전
 *
 * Node/wrangler 없이 Cloudflare 대시보드에 그대로 붙여넣어 쓸 수 있게
 * auth.js 와 index.js 를 하나로 합친 파일이다.
 * (원본은 worker/auth.js, worker/index.js — 수정은 그쪽에서 하고 다시 합칠 것)
 */

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// 공개키는 자주 바뀌지 않는다. 응답의 max-age 를 존중해 캐시한다.
let jwksCache = { keys: null, expiresAt: 0 };

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && now < jwksCache.expiresAt) return jwksCache.keys;

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("JWKS 를 받지 못했습니다: " + res.status);
  const body = await res.json();

  const m = (res.headers.get("cache-control") || "").match(/max-age=(\d+)/);
  const ttl = m ? parseInt(m[1], 10) * 1000 : 60 * 60 * 1000;

  jwksCache = { keys: body.keys || [], expiresAt: now + ttl };
  return jwksCache.keys;
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const decodeJson = (part) => JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));

/**
 * @returns {Promise<{uid:string, email?:string, claims:object}>}
 * @throws  검증 실패 시 Error
 */
async function verifyIdToken(idToken, projectId) {
  if (typeof idToken !== "string" || idToken.split(".").length !== 3) {
    throw new Error("토큰 형식이 올바르지 않습니다");
  }
  const [h, p, s] = idToken.split(".");
  const header = decodeJson(h);
  const claims = decodeJson(p);

  if (header.alg !== "RS256") throw new Error("지원하지 않는 서명 알고리즘입니다");
  if (!header.kid) throw new Error("kid 가 없습니다");

  // ── 클레임 검사 (서명 검증 전에 값싼 것부터) ──
  const now = Math.floor(Date.now() / 1000);
  const skew = 60; // 시계 오차 허용치(초)

  if (claims.aud !== projectId) throw new Error("aud 가 프로젝트와 다릅니다");
  if (claims.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error("iss 가 올바르지 않습니다");
  if (typeof claims.exp !== "number" || claims.exp + skew < now)
    throw new Error("토큰이 만료됐습니다");
  if (typeof claims.iat !== "number" || claims.iat - skew > now)
    throw new Error("iat 가 미래입니다");
  if (typeof claims.sub !== "string" || !claims.sub)
    throw new Error("sub(uid) 가 비어 있습니다");
  if (typeof claims.auth_time === "number" && claims.auth_time - skew > now)
    throw new Error("auth_time 이 미래입니다");

  // ── 서명 검증 ──
  const jwk = (await getJwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("일치하는 공개키를 찾지 못했습니다");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) throw new Error("서명 검증에 실패했습니다");

  return { uid: claims.sub, email: claims.email, claims };
}


const DEFAULT_DAILY_LIMIT = 50;
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
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

/** 사용자별 하루 호출 제한. KV 바인딩이 없으면 제한을 건너뛴다(로컬 개발 편의). */
async function checkRateLimit(env, uid) {
  if (!env.RATE) return { ok: true, used: 0, limit: 0 };

  const limit = parseInt(env.DAILY_LIMIT || DEFAULT_DAILY_LIMIT, 10);
  const day = new Date().toISOString().slice(0, 10); // UTC 기준 YYYY-MM-DD
  const key = `ai:${uid}:${day}`;

  const used = parseInt((await env.RATE.get(key)) || "0", 10);
  if (used >= limit) return { ok: false, used, limit };

  // 넉넉히 이틀 뒤 만료 — 날짜가 바뀌면 키 자체가 바뀐다
  await env.RATE.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  return { ok: true, used: used + 1, limit };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "POST 만 허용합니다" }, 405, cors);
    }

    // 허용 목록을 설정했다면, 그 출처에서 온 브라우저 요청만 받는다
    const origin = request.headers.get("Origin");
    const list = allowedOrigins(env);
    if (origin && list.length && !list.includes(origin)) {
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

    // ── 2. 사용량 제한 ──
    const rate = await checkRateLimit(env, user.uid);
    if (!rate.ok) {
      return json(
        { error: `오늘 사용량(${rate.limit}회)을 모두 썼습니다. 내일 다시 시도해 주세요.` },
        429,
        cors
      );
    }

    // ── 3. 본문 검사 ──
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
    if (typeof mimeType !== "string" || !/^image\//.test(mimeType)) {
      return json({ error: "이미지 형식이 아닙니다" }, 400, cors);
    }

    // ── 4. AI 호출 ──
    // 여기부터는 기존 Worker 의 프롬프트/모델 호출 코드를 그대로 쓰면 된다.
    // callAI() 안에서 env.AI_API_KEY 를 사용한다. 키는 절대 응답에 담지 말 것.
    try {
      const problems = await callAI(env, imageBase64, mimeType);
      return json({ problems, usage: { used: rate.used, limit: rate.limit } }, 200, cors);
    } catch (e) {
      console.error("AI 호출 실패:", e);
      return json({ error: "AI 변환에 실패했습니다", detail: String(e.message || e) }, 502, cors);
    }
  },
};

/**
 * ⚠️ 여기는 기존 Worker 에 이미 있는 구현으로 교체할 것.
 * 이 저장소에는 원본 Worker 코드가 없어 자리만 잡아 두었다.
 * 반환값은 index.html 의 aiBlocksToProblem() 이 기대하는 모양이어야 한다:
 *
 *   [{ title?: string,
 *      blocks: [ {type:'statement'|'boxed', text}
 *              | {type:'conditions'|'examples', items:[...]}
 *              | {type:'choices', items:[...5개]} ] }]
 */
async function callAI(env, imageBase64, mimeType) {
  if (!env.AI_API_KEY) throw new Error("AI_API_KEY 가 설정되지 않았습니다");
  throw new Error("callAI() 를 기존 Worker 구현으로 교체하세요");
}
