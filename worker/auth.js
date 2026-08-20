/**
 * Firebase ID 토큰 검증 (Cloudflare Workers 용, 의존성 없음)
 *
 * 클라이언트(index.html)가 보내는 `Authorization: Bearer <idToken>` 을 검증한다.
 * firebase-admin 은 Workers 에서 못 쓰므로 WebCrypto 로 직접 RS256 서명을 확인한다.
 * 구글이 제공하는 JWKS 를 쓰면 crypto.subtle.importKey('jwk', ...) 로 바로 가져올 수 있다.
 *
 * 확인하는 것:
 *   1) 서명이 구글 공개키로 검증되는가
 *   2) aud == 프로젝트 ID
 *   3) iss == https://securetoken.google.com/<프로젝트 ID>
 *   4) exp 가 지나지 않았고 iat/auth_time 이 미래가 아닌가
 *   5) sub(uid) 가 비어 있지 않은가
 *
 * 이 검증이 없으면 주소만 아는 사람이 그대로 호출해 AI 요금을 쓰게 된다.
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
export async function verifyIdToken(idToken, projectId) {
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
