#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const wrapper = join(root, 'scripts', 'ask-codex-readonly.mjs');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'pedagogy-codex-bridge-'));
const fakeCodex = join(temporaryDirectory, 'codex');

const fakeSource = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const outputFlag = args.indexOf('--output-last-message');
if (args[0] !== 'exec' || args[1] !== '--sandbox' || args[2] !== 'read-only' ||
    !args.includes('--ephemeral') || args.at(args.indexOf('--color') + 1) !== 'never' ||
    outputFlag < 0 || args.at(-1) !== '-') {
  process.stderr.write('unsafe or malformed invocation\\n');
  process.exit(65);
}
const prompt = readFileSync(0, 'utf8');
if (process.env.FAKE_CODEX_MODE === 'hang') {
  process.stderr.write('waiting forever\\n');
  setInterval(() => {}, 60_000);
} else {
  const answer = process.env.FAKE_CODEX_MODE === 'bad-output'
    ? 'WRONG ANSWER'
    : 'FINAL:' + prompt.trim();
  writeFileSync(args[outputFlag + 1], answer + '\\n');
  process.stdout.write('stdout progress noise that must be discarded\\n');
  process.stderr.write('stderr progress kept separately\\n');
}
`;

function invoke(name, mode, timeoutSeconds) {
  const prompt = join(temporaryDirectory, `${name}-prompt.txt`);
  const output = join(temporaryDirectory, `${name}-answer.md`);
  const progress = join(temporaryDirectory, `${name}-progress.log`);
  writeFileSync(prompt, 'Review only the boundary.');
  const result = spawnSync(process.execPath, [
    wrapper,
    '--prompt', prompt,
    '--output', output,
    '--progress', progress,
    '--timeout-seconds', String(timeoutSeconds),
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5_000,
    env: {
      ...process.env,
      PATH: `${temporaryDirectory}${delimiter}${process.env.PATH || ''}`,
      FAKE_CODEX_MODE: mode,
    },
  });
  return { ...result, output, progress };
}

try {
  writeFileSync(fakeCodex, fakeSource);
  chmodSync(fakeCodex, 0o755);

  const successMode = process.env.CODEX_BRIDGE_RED === '1' ? 'bad-output' : 'success';
  const success = invoke('success', successMode, 2);
  assert.equal(success.status, 0, success.stderr);
  assert.equal(readFileSync(success.output, 'utf8'), 'FINAL:Review only the boundary.\n');
  assert.match(readFileSync(success.progress, 'utf8'), /stderr progress kept separately/);
  assert.doesNotMatch(success.stdout, /stdout progress noise|FINAL:/);
  assert.match(success.stdout, /Codex review complete/);

  const timeout = invoke('timeout', 'hang', 0.2);
  assert.equal(timeout.status, 124, timeout.stderr);
  assert.match(timeout.stderr, /exceeded 0\.2 seconds/);
  assert.match(timeout.stderr, /waiting forever/);

  process.stdout.write('Codex read-only bridge checks passed.\n');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
