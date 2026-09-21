#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const DEFAULT_TIMEOUT_SECONDS = 15 * 60;
const KILL_GRACE_MS = 3_000;
const PROGRESS_TAIL_BYTES = 4_096;
const MAX_STDOUT_BYTES = 8 * 1024 * 1024;
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function usage() {
  return `Usage:
  node scripts/ask-claude-readonly.mjs \\
    --prompt <prompt-file> --output <final-answer-file> \\
    [--progress <progress-log>] [--model <model>] [--effort <level>] \\
    [--timeout-seconds <seconds>]

The wrapper invokes Claude Code in non-interactive, restricted, plan-only mode,
sends the prompt via stdin, closes stdin, and stores only the final result text
in --output. Run "claude auth status" first; interactive login is not performed
by this wrapper.`;
}

function parseArgs(argv) {
  const options = {};
  const names = ['--prompt', '--output', '--progress', '--model', '--effort', '--timeout-seconds'];
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--help' || name === '-h') return { help: true };
    if (!names.includes(name)) throw new Error(`Unknown option: ${name}`);
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
  const model = options.model || 'opus';
  if (!/^[A-Za-z0-9._:-]+$/.test(model)) throw new Error('--model contains unsupported characters');
  const effort = options.effort || 'high';
  if (!EFFORTS.has(effort)) throw new Error(`--effort must be one of: ${[...EFFORTS].join(', ')}`);

  const prompt = resolve(options.prompt);
  const output = resolve(options.output);
  const progress = resolve(options.progress || `${options.output}.progress.log`);
  if (new Set([prompt, output, progress]).size !== 3) {
    throw new Error('--prompt, --output, and --progress must be different files');
  }
  return { prompt, output, progress, model, effort, timeoutSeconds };
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

async function runClaude({ prompt, output, progress, model, effort, timeoutSeconds }) {
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(dirname(progress), { recursive: true });
  /* 유효한 새 실행 요청을 받으면 이전 답부터 지운다. 프롬프트 읽기·검증보다 늦으면
     빈/사라진 프롬프트 실패 뒤 후속 작업이 낡은 답을 이번 결과로 오인한다. */
  rmSync(output, { force: true });
  writeFileSync(progress, '');
  const promptText = readFileSync(prompt, 'utf8');
  if (!promptText.trim()) throw new Error(`Prompt file is empty: ${prompt}`);

  const temporaryOutput = `${output}.tmp-${process.pid}-${Date.now()}`;
  const progressFd = openSync(progress, 'w');
  const stdout = [];
  let stdoutBytes = 0;
  let child;
  let timedOut = false;
  let spawnError;
  let forceKillTimer;

  try {
    process.stdout.write(`Claude review started (restricted read-only, timeout: ${timeoutSeconds}s)\n`);
    child = spawn(process.env.CLAUDE_BIN || 'claude', [
      '-p',
      '--output-format', 'json',
      '--permission-mode', 'plan',
      '--permission-prompts', 'none',
      '--no-session-persistence',
      '--restricted',
      '--safe-mode',
      '--model', model,
      '--effort', effort,
      '--tools', 'Read,Grep,Glob',
    ], {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', progressFd],
    });

    child.once('error', (error) => { spawnError = error; });
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') spawnError = error;
    });
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        spawnError = new Error(`Claude stdout exceeded ${MAX_STDOUT_BYTES} bytes`);
        killProcessTree(child, 'SIGTERM');
        return;
      }
      stdout.push(chunk);
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
      const error = new Error(`Claude exceeded ${timeoutSeconds} seconds and was stopped`);
      error.exitCode = 124;
      throw error;
    }
    if (code !== 0) {
      const detail = signal ? `signal ${signal}` : `exit ${code}`;
      const error = new Error(`Claude failed (${detail})`);
      error.exitCode = Number.isInteger(code) && code > 0 ? code : 1;
      const failureOutput = Buffer.concat(stdout).toString('utf8').trim();
      try {
        const failurePayload = JSON.parse(failureOutput);
        error.outputTail = typeof failurePayload?.result === 'string'
          ? failurePayload.result.trim()
          : failureOutput.slice(-PROGRESS_TAIL_BYTES);
      } catch {
        error.outputTail = failureOutput.slice(-PROGRESS_TAIL_BYTES);
      }
      throw error;
    }

    const raw = Buffer.concat(stdout).toString('utf8').trim();
    let payload;
    try { payload = JSON.parse(raw); }
    catch { throw new Error('Claude exited successfully without valid JSON output'); }
    if (payload?.is_error || typeof payload?.result !== 'string' || !payload.result.trim()) {
      throw new Error('Claude exited successfully without a final result');
    }

    writeFileSync(temporaryOutput, `${payload.result.trim()}\n`);
    renameSync(temporaryOutput, output);
    process.stdout.write(`Claude review complete\nfinal: ${output}\nprogress: ${progress}\n`);
  } catch (error) {
    try {
      closeSync(progressFd);
    } catch (closeError) {
      if (closeError?.code !== 'EBADF') throw closeError;
    }
    rmSync(temporaryOutput, { force: true });
    const tail = progressTail(progress);
    process.stderr.write(`Claude review failed: ${error.message}\n`);
    if (error.outputTail) process.stderr.write(`Claude output tail:\n${error.outputTail}\n`);
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
    await runClaude(options);
  } catch (error) {
    process.stderr.write(`Claude review failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
