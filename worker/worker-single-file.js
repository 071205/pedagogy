/**
 * PEDAGOGY — AI 변환 프록시 (Cloudflare Worker) · 단일 파일 버전
 *
 * Node/wrangler 없이 Cloudflare 대시보드에 붙여넣어 쓸 수 있게
 * auth.js 와 index.js 를 하나로 합친 파일이다.
 * (수정은 원본 두 파일에서 하고 다시 합칠 것)
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

/**
 * 사용자별 하루 호출 제한.
 *
 * ⚠️ KV 는 '읽고 나서 쓰기' 사이를 원자적으로 묶지 못한다. 동시에 들어온 요청들이
 *    같은 used 를 읽으면 한 번만 증가할 수 있어, 병렬 호출로 상한을 넘길 수 있다.
 *    비용 폭주를 완전히 막으려면 Durable Object(또는 서버측 원자적 카운터)가 필요하다.
 *    지금은 '검사'와 '차감'을 나눠, 최소한 실패한 요청이 사용량을 깎지는 않게 한다.
 */
function quotaKey(uid) {
  const day = new Date().toISOString().slice(0, 10); // UTC 기준 YYYY-MM-DD
  return `ai:${uid}:${day}`;
}
/** 남은 한도가 있는지만 본다(차감하지 않음). */
async function checkQuota(env, uid) {
  if (!env.RATE) return { ok: true, used: 0, limit: 0 };
  const limit = parseInt(env.DAILY_LIMIT || DEFAULT_DAILY_LIMIT, 10);
  const used = parseInt((await env.RATE.get(quotaKey(uid))) || "0", 10);
  return { ok: used < limit, used, limit };
}
/** AI 호출이 실제로 성공한 뒤에만 1 늘린다. */
async function consumeQuota(env, uid) {
  if (!env.RATE) return { used: 0, limit: 0 };
  const limit = parseInt(env.DAILY_LIMIT || DEFAULT_DAILY_LIMIT, 10);
  const key = quotaKey(uid);
  const used = parseInt((await env.RATE.get(key)) || "0", 10) + 1;
  // 넉넉히 이틀 뒤 만료 — 날짜가 바뀌면 키 자체가 바뀐다
  await env.RATE.put(key, String(used), { expirationTtl: 60 * 60 * 48 });
  return { used, limit };
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
    if (typeof mimeType !== "string" || !/^image\//.test(mimeType)) {
      return json({ error: "이미지 형식이 아닙니다" }, 400, cors);
    }

    // ── 3. 남은 한도 확인 (아직 깎지 않는다) ──
    const rate = await checkQuota(env, user.uid);
    if (!rate.ok) {
      return json(
        { error: `오늘 사용량(${rate.limit}회)을 모두 썼습니다. 내일 다시 시도해 주세요.` },
        429, cors
      );
    }

    // ── 4. AI 호출 (키는 env 에서만 읽고 응답에 절대 담지 않는다) ──
    try {
      const problems = await callAI(env, imageBase64, mimeType);
      // 성공했을 때만 차감한다 — 잘못된 요청이나 공급자 오류로는 한도가 줄지 않는다
      const after = await consumeQuota(env, user.uid);
      return json({ problems, usage: { used: after.used, limit: after.limit } }, 200, cors);
    } catch (e) {
      console.error("AI 호출 실패:", e);
      return json({ error: "AI 변환에 실패했습니다", detail: String(e.message || e) }, 502, cors);
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
    // 공급자 오류 원문에는 키가 섞일 수 있으니 상태 코드만 올린다
    console.error("Anthropic API 오류:", r.status, await r.text());
    throw new Error("AI 공급자 오류 (" + r.status + ")");
  }

  const data = await r.json();
  const text = data?.content?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    console.error("JSON 파싱 실패. 응답 앞부분:", clean.slice(0, 300));
    throw new Error("AI 응답을 해석하지 못했습니다");
  }

  const problems = Array.isArray(parsed) ? parsed : parsed.problems;
  if (!Array.isArray(problems)) throw new Error("AI 응답에 problems 가 없습니다");
  return problems;
}
