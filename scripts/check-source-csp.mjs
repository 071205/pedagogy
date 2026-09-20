import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const FILES = Object.freeze({
  'index.html': 3,
  'mock-exam-editor.html': 1,
  'document-editor.html': 1,
});
const SCRIPT_TAG = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

function violations(file, html) {
  const policy = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1];
  const scriptPolicy = policy?.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] || '';
  const bodies = [...html.matchAll(SCRIPT_TAG)]
    .filter(match => match[1] !== undefined && !/\bsrc\s*=/.test(match[1]))
    .map(match => match[2]);
  const expected = bodies.map(body => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const declared = [...scriptPolicy.matchAll(/'sha256-[^']+'/g)].map(match => match[0]);
  const bad = [];
  if (!scriptPolicy) bad.push(`${file}: script-src is missing`);
  if (/'unsafe-inline'|'unsafe-eval'/.test(scriptPolicy)) bad.push(`${file}: unsafe script policy`);
  if (/(?:https|wss):\/\/\*\./.test(policy || '')) bad.push(`${file}: wildcard network host`);
  if (!/(?:^|\s)'none'(?:\s|$)/.test(policy?.match(/(?:^|;)\s*script-src-attr\s+([^;]+)/)?.[1] || '')) {
    bad.push(`${file}: script-src-attr must be none`);
  }
  if (bodies.length !== FILES[file]) bad.push(`${file}: review inline script count ${bodies.length}`);
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    bad.push(`${file}: inline script hashes differ; expected ${expected.join(' ')}`);
  }
  return bad;
}

for (const [file] of Object.entries(FILES)) {
  const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const bad = violations(file, html);
  for (const message of bad) console.error(`  ❌ ${message}`);
  assert.equal(bad.length, 0, `${file}: source CSP must match its inline scripts`);

  const mutations = [
    html.replace(/\s*'sha256-[^']+'/, ''),
    html.replace(/script-src\s+'self'/, "script-src 'self' 'unsafe-inline'"),
    html.replace('</body>', '<script>window.__injected = true</script></body>'),
  ];
  assert.ok(mutations.every(mutated => violations(file, mutated).length > 0),
    `${file}: CSP self-check must reject missing hash, unsafe-inline, and injected script`);
}

console.log('Source CSP: 5 inline scripts hash-locked; 9/9 failure injections rejected');
