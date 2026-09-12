// Read-only review evidence. Provider fetches are fake; mutations run only in memory.
// Exit 1 means an injected privacy leak still escapes the contract suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createWorker } from '../../../worker/index.js';

const workerDir = new URL('../../../worker/', import.meta.url);
const secrets = { image: 'AUDIT_IMAGE', prompt: 'AUDIT_PROMPT', uid: 'AUDIT_UID',
  response: 'AUDIT_RESPONSE', token: 'AUDIT_TOKEN' };
const env = { ALLOWED_ORIGINS: 'https://app.example', ANTHROPIC_KEY: 'fake',
  GLOBAL_DAILY_LIMIT: '0' };
const methods = ['log', 'error', 'warn', 'info', 'debug'];
let checked = 0;
for (const task of ['problem_image', 'document']) {
  const success = task === 'document'
    ? { title: secrets.response, blocks: [{ type: 'paragraph', text: secrets.response }] }
    : { problems: [{ title: secrets.response, blocks: [] }] };
  const cases = [
    ['success', JSON.stringify(success), 'success'],
    ['null', 'null', task === 'document' ? 'validation_error' : 'json_parse_error'],
    ['numeric-text', 42, 'json_parse_error'],
    ['object-text', { text: secrets.response }, 'json_parse_error'],
    ['missing-text', undefined, 'json_parse_error'],
    ['syntax', secrets.response, 'json_parse_error'],
    ['schema', '{}', task === 'document' ? 'validation_error' : 'json_parse_error'],
    ['http', null, 'http_error'],
    ['network', null, 'request_error'],
    ['envelope', null, 'json_parse_error'],
  ];
  for (const [name, text, outcome] of cases) {
    const entries = [], ops = [];
    const originals = Object.fromEntries(methods.map(m => [m, console[m]]));
    const originalFetch = globalThis.fetch;
    let response;
    try {
      for (const m of methods) console[m] = (...args) => entries.push({ method: m, args });
      const worker = createWorker({
        verifyToken: async () => ({ uid: secrets.uid, claims: {} }),
        requestQuota: async (_env, _uid, op) => {
          ops.push(op); return { ok: true, used: 1, limit: 5 };
        },
      });
      globalThis.fetch = async () => {
        if (name === 'network') throw new Error(secrets.response);
        if (name === 'http') return new Response(secrets.response, { status: 529 });
        if (name === 'envelope') return new Response(secrets.response, { status: 200 });
        return Response.json({ model: 'claude-haiku-4-5', stop_reason: 'end_turn',
          usage: { input_tokens: 144, output_tokens: 7 }, content: [{ type: 'text', text }] });
      };
      response = await worker.fetch(new Request('https://worker.example/ai', {
        method: 'POST', headers: { Origin: 'https://app.example',
          Authorization: `Bearer ${secrets.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(task === 'document' ? { mode: 'document', prompt: secrets.prompt }
          : { imageBase64: secrets.image, mimeType: 'image/png' }),
      }), env);
    } finally {
      globalThis.fetch = originalFetch;
      for (const m of methods) console[m] = originals[m];
    }
    const events = entries.flatMap(entry => entry.args).filter(arg => arg?.event === 'ai_usage');
    const available = !['http', 'network', 'envelope'].includes(name);
    assert.equal(response.status, outcome === 'success' ? 200 : 502, `${task}/${name}`);
    assert.deepEqual(ops, ['reserve', 'consume']);
    assert.equal(events.length, 1, `${task}/${name} event count`);
    assert.equal(events[0].task, task);
    assert.equal(events[0].outcome, outcome);
    assert.equal(events[0].input_tokens, available ? 144 : null);
    assert.equal(events[0].output_tokens, available ? 7 : null);
    assert.equal(events[0].stop_reason, available ? 'end_turn' : null);
    for (const value of Object.values(secrets)) assert.ok(!JSON.stringify(entries).includes(value));
    checked++;
  }
}
console.log(`Provider boundary cases passed: ${checked}`);

const imports = source => source.replace(/from "(\.\/[^\"]+)"/g,
  (_match, path) => `from ${JSON.stringify(new URL(path, workerDir).href)}`);
const source = imports(readFileSync(new URL('index.js', workerDir), 'utf8'));
const tests = imports(readFileSync(new URL('worker-contract.test.mjs', workerDir), 'utf8'));
for (const [name, signature, leak] of [
  ['baseline', null, null],
  ['document-prompt-leak', 'export async function callDocumentAI(env, prompt) {', 'console.error(prompt);'],
  ['image-input-leak', 'export async function callAI(env, imageBase64, mimeType) {', 'console.error(imageBase64);'],
  ['provider-response-leak', 'const telemetry = aiTelemetry({ task, model, response, data, outcome: "success", startedAt });', 'console.error(data);'],
  ['uid-leak', 'user = await verifyToken(token, env.FIREBASE_PROJECT_ID);', 'console.error(user.uid);'],
]) {
  const variant = signature ? source.replace(signature, `${signature} ${leak}`) : source;
  if (signature) assert.notEqual(variant, source, 'mutation anchor must match');
  const moduleURL = 'data:text/javascript;base64,' + Buffer.from(variant).toString('base64');
  const suite = tests.replace(JSON.stringify(new URL('index.js', workerDir).href), JSON.stringify(moduleURL));
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: suite, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, AI_METRICS_RED: '' },
  });
  if (result.error) throw result.error;
  if (!signature) assert.equal(result.status, 0, 'baseline must pass');
  else if (result.status !== 0) {
    assert.equal(result.status, 1, 'mutation must fail through an assertion');
    assert.match(result.stderr, /AssertionError/, 'syntax/import failures are not detection');
  }
  if (signature) assert.notEqual(result.status, 0, `${name} must fail a privacy assertion`);
  console.log(`${name}: exit=${result.status}`);
  // Never print captured child output, which intentionally contains fake private text.
}
