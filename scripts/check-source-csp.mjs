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
  if (/(?:https|wss):\/\/\*\.|(?:https?|wss):\/\/[^;\s]+:\*/.test(policy || '')) {
    bad.push(`${file}: wildcard network source`);
  }
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

const legal = await readFile(new URL('../legal.html', import.meta.url), 'utf8');
const legalPolicy = legal.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1] || '';
const legalStylePolicy = legalPolicy.match(/(?:^|;)\s*style-src\s+([^;]+)/)?.[1] || '';
const legalStyle = legal.match(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/i)?.[1];
const legalStyleHash = `'sha256-${createHash('sha256').update(legalStyle || '').digest('base64')}'`;
assert.ok(legalStyle && legalStylePolicy.includes(legalStyleHash), 'legal.html: inline style hash must match');
assert.doesNotMatch(legalStylePolicy, /'unsafe-inline'/, 'legal.html: unsafe inline style must stay disabled');
for (const mutated of [
  legal.replace(legalStyleHash, ''),
  legal.replace(/style-src\s+'self'/, "style-src 'self' 'unsafe-inline'"),
  legal.replace('</head>', '<style>body{display:none}</style></head>'),
]) {
  const policy = mutated.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1] || '';
  const stylePolicy = policy.match(/(?:^|;)\s*style-src\s+([^;]+)/)?.[1] || '';
  const styles = [...mutated.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match =>
    `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  assert.ok(/'unsafe-inline'/.test(stylePolicy) || styles.some(hash => !stylePolicy.includes(hash)),
    'legal.html: style CSP failure injection must be rejected');
}

console.log('Source CSP: 5 scripts and 1 legal style hash-locked; 12/12 failure injections rejected');
