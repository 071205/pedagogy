# Guest framing 실제 probe 출력

격리 합성 환경의 stdout/stderr이며 줄 끝 공백만 정리했다. 운영 자료·토큰 없음.

```text
=== before ===
{"kind":"guest-host","base":"http://127.0.0.1:55047","manifestFiles":234,"servedAssets":233,"manifestSha256":"311046226308c8356c39e7e97626b0cfd360721043b6d1899546484dd00a6fa3","allBytesMatch":true,"aliases":true,"private404":true,"httpHeaders":true,"sameOriginMock":true,"crossOriginIndexBlocked":true}

=== normal ===
{"kind":"guest-host","base":"http://127.0.0.1:55252","manifestFiles":234,"servedAssets":233,"manifestSha256":"311046226308c8356c39e7e97626b0cfd360721043b6d1899546484dd00a6fa3","allBytesMatch":true,"topLevelLibrary":true,"aliases":true,"private404":true,"httpHeaders":true,"sameOriginMock":true,"crossOriginIndexBlocked":true}

=== red ===
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: Guest top-level library positive control

0 !== 1

    at file:///Users/huryul/%EA%B0%9C%EB%B0%9C/pedagogy-%EC%9E%91%EC%97%85%EC%82%AC%EB%B3%B8/pedagogy-u15b/scripts/check-guest-host.mjs:145:10 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 1,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.7.0

=== header-red ===
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: Guest HTTP CSP must match verified framing
+ actual - expected

+ null
- "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'"

    at checkResponse (file:///Users/huryul/%EA%B0%9C%EB%B0%9C/pedagogy-%EC%9E%91%EC%97%85%EC%82%AC%EB%B3%B8/pedagogy-u15b/scripts/check-guest-host.mjs:55:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async file:///Users/huryul/%EA%B0%9C%EB%B0%9C/pedagogy-%EC%9E%91%EC%97%85%EC%82%AC%EB%B3%B8/pedagogy-u15b/scripts/check-guest-host.mjs:118:6 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: null,
  expected: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'",
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.7.0

=== remote-red-denied ===
file:///Users/huryul/%EA%B0%9C%EB%B0%9C/pedagogy-%EC%9E%91%EC%97%85%EC%82%AC%EB%B3%B8/pedagogy-u15b/scripts/check-guest-host.mjs:64
if(remote && red) throw Error('Failure injection is local only');
                        ^

Error: Failure injection is local only
    at file:///Users/huryul/%EA%B0%9C%EB%B0%9C/pedagogy-%EC%9E%91%EC%97%85%EC%82%AC%EB%B3%B8/pedagogy-u15b/scripts/check-guest-host.mjs:64:25

Node.js v26.7.0
```
