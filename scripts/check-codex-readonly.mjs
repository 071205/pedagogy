#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  /* ── 스킬이 낡지 않았는지 ──
     ⚠️ `.claude/skills/codex-review` 는 이 래퍼와 `CLAUDE.md` 의 협업 절을 가리킨다.
        가리키는 것이 사라지거나 이름이 바뀌면 **스킬이 조용히 틀린 안내를 한다.**
        훅·표와 같은 이유로 여기서 함께 본다. */
  const skill = new URL('../.claude/skills/codex-review/SKILL.md', import.meta.url);
  assert.ok(existsSync(skill), 'codex-review 스킬이 없습니다');
  const skillText = readFileSync(skill, 'utf8');

  for (const flag of ['--prompt', '--output', '--progress', '--timeout-seconds']) {
    assert.ok(skillText.includes(flag), `스킬이 안내하는 ${flag} 가 사라졌습니다`);
    assert.ok(readFileSync(new URL('./ask-codex-readonly.mjs', import.meta.url), 'utf8').includes(flag),
      `래퍼에 ${flag} 가 없는데 스킬이 안내하고 있습니다`);
  }

  /* 스킬이 가리키는 상대 경로가 전부 실재해야 한다 */
  const links = [...skillText.matchAll(/\]\((\.\.\/[^)]+)\)/g)].map(m => m[1]);
  assert.ok(links.length >= 3, '스킬의 문서 링크가 사라졌습니다');
  for (const link of links) {
    assert.ok(existsSync(new URL(link, skill)), `스킬이 가리키는 경로가 없습니다: ${link}`);
  }

  /* 스킬이 "정답표" 라고 부르는 절이 CLAUDE.md 에 실제로 있어야 한다 */
  const claude = readFileSync(new URL('../CLAUDE.md', import.meta.url), 'utf8');
  assert.match(claude, /Claude → Codex .{0,6}협업/, 'CLAUDE.md 의 협업 절이 사라졌습니다');
  assert.match(claude, /foreground/, 'CLAUDE.md 의 foreground 규칙이 사라졌습니다');
  /* 스킬이 가르치는 마무리 계약이 CLAUDE.md 와 같은 문장이어야 한다 */
  const closing = '합의 / 미합의 / 근거 / 다음 행동';
  assert.ok(claude.includes(closing), 'CLAUDE.md 의 왕복 마무리 계약이 바뀌었습니다');
  assert.ok(skillText.includes(closing), '스킬이 안내하는 마무리 계약이 CLAUDE.md 와 다릅니다');

  process.stdout.write(`Codex read-only bridge checks passed. 스킬 링크 ${links.length}개 확인.\n`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
