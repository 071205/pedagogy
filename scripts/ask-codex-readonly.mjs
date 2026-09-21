#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const DEFAULT_TIMEOUT_SECONDS = 15 * 60;
const KILL_GRACE_MS = 3_000;
const PROGRESS_TAIL_BYTES = 4_096;

function usage() {
  return `Usage:
  node scripts/ask-codex-readonly.mjs \\
    --prompt <prompt-file> --output <final-answer-file> \\
    [--progress <progress-log>] [--timeout-seconds <seconds>]
    [--model <codex-model>] [--effort low|medium|high]

The wrapper always invokes Codex with a read-only sandbox, sends the prompt via
stdin, closes stdin, and stores only the final assistant message in --output.

--model / --effort pick the Codex model for this call. Without them Codex falls
back to ~/.codex/config.toml, which is a machine-wide default the rail does not
control — pass them explicitly so the stage's assignment in
docs/DEV-TOKEN-ROADMAP.md is the one that actually runs.`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--help' || name === '-h') return { help: true };
    if (!['--prompt', '--output', '--progress', '--timeout-seconds',
          '--model', '--effort'].includes(name)) {
      throw new Error(`Unknown option: ${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    options[name.slice(2)] = value;
    index += 1;
  }

  if (!options.prompt) throw new Error('--prompt is required');
  if (!options.output) throw new Error('--output is required');
  const timeoutSeconds = options['timeout-seconds'] === undefined
    ? DEFAULT_TIMEOUT_SECONDS
    : Number(options['timeout-seconds']);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 0.1 || timeoutSeconds > 3_600) {
    throw new Error('--timeout-seconds must be between 0.1 and 3600');
  }

  const prompt = resolve(options.prompt);
  const output = resolve(options.output);
  const progress = resolve(options.progress || `${options.output}.progress.log`);
  if (new Set([prompt, output, progress]).size !== 3) {
    throw new Error('--prompt, --output, and --progress must be different files');
  }
  /* ⚠️ 이 함수는 **고른 것만 돌려준다** — 새 옵션을 여기 안 더하면 파싱은 되는데
     조용히 버려진다. 실제로 `--model` 을 그렇게 잃어 기본 모델로 갔다(2026-09-22). */
  return { prompt, output, progress, timeoutSeconds,
           model: options.model, effort: options.effort };
}

function progressTail(path) {
  if (!existsSync(path)) return '';
  const contents = readFileSync(path);
  return contents.subarray(Math.max(0, contents.length - PROGRESS_TAIL_BYTES)).toString('utf8').trim();
}

function killProcessTree(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

async function runCodex({ prompt, output, progress, timeoutSeconds, model, effort }) {
  const promptText = readFileSync(prompt, 'utf8');
  if (!promptText.trim()) throw new Error(`Prompt file is empty: ${prompt}`);

  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(dirname(progress), { recursive: true });
  const temporaryOutput = `${output}.tmp-${process.pid}-${Date.now()}`;
  const progressFd = openSync(progress, 'w');
  let child;
  let timedOut = false;
  let spawnError;
  let forceKillTimer;

  try {
    process.stdout.write(`Codex review started (read-only, timeout: ${timeoutSeconds}s)\n`);
    /* 모델을 안 넘기면 `~/.codex/config.toml` 의 기계 전역 기본값으로 간다.
       레일(`docs/DEV-TOKEN-ROADMAP.md`)이 단계마다 모델을 정해 두는데, 그 배정이
       호출에 **한 번도 닿지 않고 있었다**(2026-09-22 에 알았다 — 설계 판정 셋이
       전부 Sol medium 으로 갔다). 명시하면 레일이 적은 것이 실제로 도는 것이 된다. */
    const codexArgs = [
      'exec',
      '--sandbox', 'read-only',
      '--ephemeral',
      '--color', 'never',
      '--output-last-message', temporaryOutput,
    ];
    if (model) codexArgs.push('--model', model);
    if (effort) codexArgs.push('-c', `model_reasoning_effort="${effort}"`);
    codexArgs.push('-');
    process.stdout.write(`model: ${model || '(config.toml 기본값)'} · effort: ${effort || '(기본값)'}\n`);
    child = spawn('codex', codexArgs, {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'ignore', progressFd],
    });

    child.once('error', (error) => {
      spawnError = error;
    });
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') spawnError = error;
    });
    child.stdin.end(promptText);

    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessTree(child, 'SIGTERM');
      forceKillTimer = setTimeout(() => killProcessTree(child, 'SIGKILL'), KILL_GRACE_MS);
      forceKillTimer.unref();
    }, timeoutSeconds * 1_000);
    timeout.unref();

    const { code, signal } = await new Promise((resolveClose) => {
      child.once('close', (closeCode, closeSignal) => {
        resolveClose({ code: closeCode, signal: closeSignal });
      });
    });
    clearTimeout(timeout);
    clearTimeout(forceKillTimer);
    closeSync(progressFd);

    if (spawnError) throw spawnError;
    if (timedOut) {
      const error = new Error(`Codex exceeded ${timeoutSeconds} seconds and was stopped`);
      error.exitCode = 124;
      throw error;
    }
    if (code !== 0) {
      const detail = signal ? `signal ${signal}` : `exit ${code}`;
      const error = new Error(`Codex failed (${detail})`);
      error.exitCode = Number.isInteger(code) && code > 0 ? code : 1;
      throw error;
    }
    if (!existsSync(temporaryOutput) || !readFileSync(temporaryOutput, 'utf8').trim()) {
      throw new Error('Codex exited successfully without a final answer');
    }

    renameSync(temporaryOutput, output);
    process.stdout.write(`Codex review complete\nfinal: ${output}\nprogress: ${progress}\n`);
  } catch (error) {
    try {
      closeSync(progressFd);
    } catch (closeError) {
      if (closeError?.code !== 'EBADF') throw closeError;
    }
    rmSync(temporaryOutput, { force: true });
    const tail = progressTail(progress);
    process.stderr.write(`Codex review failed: ${error.message}\n`);
    if (tail) process.stderr.write(`Progress log tail:\n${tail}\n`);
    process.exitCode = error.exitCode || 1;
  }
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage()}\n`);
  process.exitCode = 2;
}

if (options?.help) process.stdout.write(`${usage()}\n`);
else if (options) {
  try {
    await runCodex(options);
  } catch (error) {
    process.stderr.write(`Codex review failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
