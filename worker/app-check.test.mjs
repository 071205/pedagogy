import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { AppCheckError, createAppCheckVerifier } from "./app-check.js";

globalThis.crypto ??= webcrypto;
const projectNumber = "297266134873";
const appId = "1:297266134873:web:test";
const nowMs = 1_800_000_000_000;
const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value))
  .toString("base64url");
const pair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"],
);
const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "key-1", alg: "RS256", use: "sig" };
async function token(claimOverrides = {}, headerOverrides = {}) {
  const header = b64({ alg: "RS256", typ: "JWT", kid: "key-1", ...headerOverrides });
  const claims = b64({
    iss: `https://firebaseappcheck.googleapis.com/${projectNumber}`,
    aud: [`projects/${projectNumber}`], sub: appId,
    iat: Math.floor(nowMs / 1000) - 10, exp: Math.floor(nowMs / 1000) + 3600,
    ...claimOverrides,
  });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${Buffer.from(signature).toString("base64url")}`;
}
const response = () => new Response(JSON.stringify({ keys: [jwk] }), {
  headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=999999" },
});
let fetches = 0;
const verify = createAppCheckVerifier({ fetchImpl: async () => { fetches++; return response(); }, now: () => nowMs });
const valid = await token();
const tamperedParts = valid.split(".");
const tamperedSignature = Buffer.from(tamperedParts[2], "base64url");
tamperedSignature[0] ^= 1;
const tampered = `${tamperedParts[0]}.${tamperedParts[1]}.${tamperedSignature.toString("base64url")}`;
assert.equal((await verify(valid, { projectNumber, allowedAppIds: [appId] })).appId, appId);
await verify(valid, { projectNumber, allowedAppIds: [appId] });
assert.equal(fetches, 1, "valid JWKS should be cached");

for (const bad of [
  await token({ exp: Math.floor(nowMs / 1000) - 1 }),
  await token({ aud: ["projects/other"] }),
  await token({ iss: "https://firebaseappcheck.googleapis.com/other" }),
  await token({ sub: "other-app" }),
  await token({}, { typ: "NOT-JWT" }),
  tampered,
]) {
  await assert.rejects(verify(bad, { projectNumber, allowedAppIds: [appId] }),
    (error) => error instanceof AppCheckError && error.code === "invalid");
}
await assert.rejects(verify(valid, { projectNumber: "project-name", allowedAppIds: [appId] }),
  (error) => error instanceof AppCheckError && error.code === "unavailable");
const unavailable = createAppCheckVerifier({
  fetchImpl: async () => new Response("down", { status: 503 }), now: () => nowMs,
});
await assert.rejects(unavailable(valid, { projectNumber, allowedAppIds: [appId] }),
  (error) => error instanceof AppCheckError && error.code === "unavailable");
const timedOut = createAppCheckVerifier({
  fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }),
  now: () => nowMs,
  timeoutMs: 5,
});
await assert.rejects(timedOut(valid, { projectNumber, allowedAppIds: [appId] }),
  (error) => error instanceof AppCheckError && error.code === "unavailable");
let unknownFetches = 0;
const unknown = createAppCheckVerifier({
  fetchImpl: async () => { unknownFetches++; return response(); }, now: () => nowMs,
});
await assert.rejects(unknown(await token({}, { kid: "rotated" }), { projectNumber, allowedAppIds: [appId] }),
  (error) => error instanceof AppCheckError && error.code === "invalid");
assert.equal(unknownFetches, 1, "a newly fetched JWKS need not be fetched twice for the same unknown kid");
for(let i=0;i<10;i++) {
  await assert.rejects(unknown(await token({}, {kid:`untrusted-${i}`}), {projectNumber,allowedAppIds:[appId]}),
    error=>error instanceof AppCheckError && error.code==='invalid');
}
assert.equal(unknownFetches, 1, 'untrusted key IDs must not cause one Google fetch per request');

let time=nowMs, rotationFetches=0;
const rotation=createAppCheckVerifier({now:()=>time,fetchImpl:async()=>{
  rotationFetches++;
  return Response.json({keys:[{...jwk,kid:rotationFetches===1?'key-1':'key-2'}]});
}});
await rotation(valid,{projectNumber,allowedAppIds:[appId]});
time+=61000;
assert.equal((await rotation(await token({}, {kid:'key-2'}),{projectNumber,allowedAppIds:[appId]})).appId,appId);
assert.equal(rotationFetches,2,'a rotated key must work after the bounded refresh interval');

let outages=0;
const outage=createAppCheckVerifier({now:()=>time,fetchImpl:async()=>{outages++;throw Error('down');}});
for(let i=0;i<5;i++) await assert.rejects(outage(valid,{projectNumber,allowedAppIds:[appId]}),
  error=>error instanceof AppCheckError && error.code==='unavailable');
assert.equal(outages,1,'JWKS outages must back off as well');
time+=6000;
await assert.rejects(outage(valid,{projectNumber,allowedAppIds:[appId]}));
assert.equal(outages,2,'verification must recover by retrying after the backoff');

for(const malformed of [
  `${b64('null')}.${valid.split('.')[1]}.${valid.split('.')[2]}`,
  `${valid.split('.')[0]}.${b64('null')}.${valid.split('.')[2]}`,
  await token({exp:Infinity}), await token({iat:Infinity}),
]) await assert.rejects(verify(malformed,{projectNumber,allowedAppIds:[appId]}),
  error=>error instanceof AppCheckError && error.code==='invalid');

console.log("App Check JWT tests passed: claims, signature, app allowlist, cache, timeout, rotation refresh and fail-closed errors");
