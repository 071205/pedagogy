#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const wrapper = join(root, 'scripts', 'ask-claude-readonly.mjs');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'pedagogy-claude-bridge-'));
const fakeClaude = join(temporaryDirectory, 'claude');

const fakeSource = `#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const requiredPairs = [
  ['--output-format','json'], ['--permission-mode','plan'],
  ['--permission-prompts','none'], ['--model','opus'], ['--effort','high'],
  ['--tools','Read,Grep,Glob'],
];
if (args[0] !== '-p' || !args.includes('--no-session-persistence') ||
    !args.includes('--restricted') || !args.includes('--safe-mode') ||
    requiredPairs.some(([flag,value]) => args.at(args.indexOf(flag) + 1) !== value)) {
  process.stderr.write('unsafe or malformed invocation\\n');
  process.exit(65);
}
const prompt = readFileSync(0, 'utf8');
if (process.env.FAKE_CLAUDE_MODE === 'hang') {
  process.stderr.write('waiting forever\\n');
  setInterval(() => {}, 60_000);
} else if (process.env.FAKE_CLAUDE_MODE === 'not-logged-in') {
  process.stdout.write('Not logged in · Please run /login\\n');
  process.exit(1);
} else if (process.env.FAKE_CLAUDE_MODE === 'bad-json') {
  process.stdout.write('not json\\n');
} else {
  const answer = process.env.FAKE_CLAUDE_MODE === 'bad-output'
    ? 'WRONG ANSWER'
    : 'FINAL:' + prompt.trim();
  process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,result:answer}) + '\\n');
  process.stderr.write('stderr progress kept separately\\n');
}
`;

function invoke(name, mode, timeoutSeconds, options = {}) {
  const prompt = join(temporaryDirectory, `${name}-prompt.txt`);
  const output = join(temporaryDirectory, `${name}-answer.md`);
  const progress = join(temporaryDirectory, `${name}-progress.log`);
  writeFileSync(prompt, options.promptText ?? 'Review only the boundary.');
  if (options.staleOutput) writeFileSync(output, options.staleOutput);
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
    env: { ...process.env, CLAUDE_BIN: fakeClaude, FAKE_CLAUDE_MODE: mode },
  });
  return { ...result, output, progress };
}

try {
  writeFileSync(fakeClaude, fakeSource);
  chmodSync(fakeClaude, 0o755);

  const successMode = process.env.CLAUDE_BRIDGE_RED === '1' ? 'bad-output' : 'success';
  const success = invoke('success', successMode, 2);
  assert.equal(success.status, 0, success.stderr);
  assert.equal(readFileSync(success.output, 'utf8'), 'FINAL:Review only the boundary.\n');
  assert.match(readFileSync(success.progress, 'utf8'), /stderr progress kept separately/);
  assert.doesNotMatch(success.stdout, /FINAL:|stderr progress/);
  assert.match(success.stdout, /Claude review complete/);

  const malformed = invoke('malformed', 'bad-json', 2);
  assert.equal(malformed.status, 1, malformed.stderr);
  assert.match(malformed.stderr, /without valid JSON output/);
  assert.equal(existsSync(malformed.output), false, '실패 뒤 낡은 최종 답변을 남기면 안 된다');

  const unauthenticated = invoke('unauthenticated', 'not-logged-in', 2);
  assert.equal(unauthenticated.status, 1, unauthenticated.stderr);
  assert.match(unauthenticated.stderr, /Not logged in/);
  assert.equal(existsSync(unauthenticated.output), false, '인증 실패 뒤 최종 답변을 만들면 안 된다');

  const emptyPrompt = invoke('empty-prompt', 'success', 2, {
    promptText: '   \n', staleOutput: 'STALE PREVIOUS REVIEW\n',
  });
  assert.equal(emptyPrompt.status, 1, emptyPrompt.stderr);
  assert.match(emptyPrompt.stderr, /Prompt file is empty/);
  assert.equal(existsSync(emptyPrompt.output), false, '빈 프롬프트 실패 뒤 낡은 최종 답변을 남기면 안 된다');

  const timeout = invoke('timeout', 'hang', 0.2);
  assert.equal(timeout.status, 124, timeout.stderr);
  assert.match(timeout.stderr, /exceeded 0\.2 seconds/);
  assert.match(timeout.stderr, /waiting forever/);

  process.stdout.write('Claude read-only bridge checks passed.\n');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
