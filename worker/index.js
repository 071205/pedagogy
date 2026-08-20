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
 *   · 사용자별 하루 호출 횟수를 제한하며
 *   · 허용된 출처에서 온 요청만 받는다
 *
 * ── 배포 ──
 *   cd worker
 *   npx wrangler secret put AI_API_KEY      # AI 공급자 키
 *   npx wrangler kv namespace create RATE   # 사용량 카운터용
 *   npx wrangler deploy
 *
 * ── 환경 변수(wrangler.toml / Secret) ──
 *   FIREBASE_PROJECT_ID  예: pedagogy-huryul
 *   ALLOWED_ORIGINS      쉼표로 구분한 허용 출처
 *   DAILY_LIMIT          사용자당 하루 호출 상한 (기본 50)
 *   AI_API_KEY           (Secret) AI 공급자 키
 *   RATE                 (KV 바인딩) 사용량 카운터
 */

import { verifyIdToken } from "./auth.js";

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
