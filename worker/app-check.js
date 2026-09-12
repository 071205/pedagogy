/** Firebase App Check JWT verification for Cloudflare Workers (WebCrypto only). */
const JWKS_URL = "https://firebaseappcheck.googleapis.com/v1/jwks";
const MAX_JWKS_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;
const UNKNOWN_KEY_REFRESH_MS = 60_000;
const FAILURE_RETRY_MS = 5000;

export class AppCheckError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AppCheckError";
    this.code = code;
  }
}

function b64urlToBytes(value) {
  let text = value.replace(/-/g, "+").replace(/_/g, "/");
  while (text.length % 4) text += "=";
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJson(part) {
  try {
    const value = JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('object required');
    return value;
  }
  catch { throw new AppCheckError("invalid", "App Check JWT 형식이 올바르지 않습니다"); }
}

function cacheTtl(headers) {
  const match = (headers.get("cache-control") || "").match(/max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : 3600;
  return Math.min(Number.isFinite(seconds) ? seconds * 1000 : 3600000, MAX_JWKS_TTL_MS);
}

export function createAppCheckVerifier({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let cache = { keys: [], expiresAt: 0 };
  let pending = null;
  let lastRefreshAt = -Infinity, retryAt = 0;

  async function loadKeys(force = false) {
    const at = now();
    if (!force && cache.keys.length && at < cache.expiresAt) return cache.keys;
    if (pending) return pending;
    if (at < retryAt) throw new AppCheckError('unavailable', 'App Check 공개키 재시도를 기다리고 있습니다');
    // Bound unknown-kid amplification across requests, not merely within one JWT.
    if (force && at - lastRefreshAt < UNKNOWN_KEY_REFRESH_MS) return cache.keys;
    lastRefreshAt = at;
    pending = Promise.resolve().then(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(JWKS_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (!Array.isArray(body?.keys) || !body.keys.length) throw new Error("empty JWKS");
        cache = { keys: body.keys, expiresAt: now() + cacheTtl(response.headers) };
        retryAt = 0;
        return cache.keys;
      } catch {
        retryAt = now() + FAILURE_RETRY_MS;
        throw new AppCheckError("unavailable", "App Check 공개키를 확인하지 못했습니다");
      } finally {
        clearTimeout(timer);
        pending = null;
      }
    });
    return pending;
  }

  return async function verifyAppCheckToken(token, { projectNumber, allowedAppIds = [] } = {}) {
    if (typeof token !== "string" || token.length < 20 || token.length > 8192) {
      throw new AppCheckError("invalid", "App Check 토큰이 없거나 형식이 올바르지 않습니다");
    }
    if (!/^\d+$/.test(String(projectNumber || "")) || !allowedAppIds.length) {
      throw new AppCheckError("unavailable", "App Check 검증 설정이 올바르지 않습니다");
    }
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(part=>!part || !/^[A-Za-z0-9_-]+$/.test(part))) {
      throw new AppCheckError("invalid", "App Check JWT 형식이 올바르지 않습니다");
    }
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    const header = decodeJson(encodedHeader);
    const claims = decodeJson(encodedClaims);
    if (header.alg !== "RS256" || header.typ !== "JWT" || typeof header.kid !== "string" || !header.kid || header.kid.length > 256) {
      throw new AppCheckError("invalid", "App Check JWT 헤더가 올바르지 않습니다");
    }
    const seconds = Math.floor(now() / 1000);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== `https://firebaseappcheck.googleapis.com/${projectNumber}`
      || !audience.includes(`projects/${projectNumber}`)
      || !Number.isFinite(claims.exp) || claims.exp <= seconds
      || !Number.isFinite(claims.iat) || claims.iat > seconds + 60 || claims.iat >= claims.exp
      || typeof claims.sub !== "string" || !allowedAppIds.includes(claims.sub)) {
      throw new AppCheckError("invalid", "App Check JWT claim이 올바르지 않습니다");
    }

    let keys = await loadKeys();
    let jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) {
      keys = await loadKeys(true);
      jwk = keys.find((key) => key.kid === header.kid);
    }
    if (!jwk) throw new AppCheckError("invalid", "App Check 공개키가 일치하지 않습니다");
    try {
      const key = await crypto.subtle.importKey(
        "jwk", jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
      );
      const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5", key, b64urlToBytes(encodedSignature),
        new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
      );
      if (!valid) throw new Error("invalid signature");
    } catch {
      throw new AppCheckError("invalid", "App Check 서명이 올바르지 않습니다");
    }
    return { appId: claims.sub, claims };
  };
}

export const verifyAppCheckToken = createAppCheckVerifier();
