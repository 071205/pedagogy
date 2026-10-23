import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPublic, verifyPublic } from './build-public.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function prepareStaticStaging(root = projectRoot) {
  root = resolve(root);
  const config = await readFile(join(root, 'wrangler.static.staging.toml'), 'utf8');
  try {
    execFileSync('python3', [fileURLToPath(new URL('./check-static-staging-config.py', import.meta.url))],
      { input: config, stdio: ['pipe', 'ignore', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT' || /requires Python 3\.11\+ tomllib/.test(error.stderr?.toString('utf8') || '')) {
      throw Error('static staging config requires Python 3.11+ tomllib');
    }
    throw Error('static staging config rejected: expected assets-only local fixture');
  }
  // Always rebuild before starting the local host. buildPublic keeps the old
  // output on input failure; this gate must refuse to serve that stale output.
  const built = await buildPublic(root);
  const verified = await verifyPublic(join(root, 'dist/public'));
  const recorded = JSON.parse(await readFile(join(root, 'dist/public-manifest.json'), 'utf8'));
  assert.deepEqual(verified, built, 'Built and verified public bytes differ');
  assert.deepEqual(recorded, built, 'Public manifest does not describe the served bytes');
  return built;
}

export function observeStaticChild(child) {
  let terminal = child.exitCode != null || child.signalCode != null
    ? { code: child.exitCode, signal: child.signalCode, error: null } : null;
  let finish;
  const finished = new Promise(resolveFinished => { finish = resolveFinished; });
  const settle = result => {
    if (terminal) return;
    terminal = result;
    finish(result);
  };
  if (terminal) finish(terminal);
  child.once('error', error => settle({ code: null, signal: null, error }));
  child.once('exit', (code, signal) => settle({ code, signal, error: null }));
  // The event can fire between the initial snapshot and listener registration.
  if (child.exitCode != null || child.signalCode != null) {
    settle({ code: child.exitCode, signal: child.signalCode, error: null });
  }
  const status = () => terminal;
  const wait = async ({ timeoutMs = 3000 } = {}) => {
    if (terminal) return terminal;
    let timer;
    try {
      return await Promise.race([finished, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Local Wrangler exit timed out')), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  };
  const stop = async ({ timeoutMs = 3000 } = {}) => {
    if (terminal) return terminal;
    child.kill('SIGTERM');
    try { return await wait({ timeoutMs }); }
    catch (error) {
      if (terminal) return terminal;
      child.kill('SIGKILL');
      return await wait({ timeoutMs });
    }
  };
  return { status, wait, stop };
}

export async function stopStaticStaging(lifecycle, clean) {
  try { await lifecycle.stop(); }
  finally { await clean(); }
}

export async function startStaticStaging({ root = projectRoot, port = 8797,
  spawnProcess = spawn, persistence } = {}) {
  root = resolve(root);
  const manifest = await prepareStaticStaging(root);
  const state = persistence || await mkdtemp(join(tmpdir(), 'pedagogy-static-'));
  const ownsState = !persistence;
  const clean = async () => { if (ownsState) await rm(state, { recursive: true, force: true }); };
  let child;
  try {
    child = spawnProcess(join(root, 'node_modules/.bin/wrangler'), [
      'dev', '--config', 'wrangler.static.staging.toml', '--local',
      '--ip', '127.0.0.1', '--port', String(port), '--inspector-ip', '127.0.0.1',
      '--persist-to', state, '--log-level', 'warn', '--no-show-interactive-dev-session',
    ], { cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  } catch (error) {
    await clean();
    throw error;
  }
  return { child, lifecycle: observeStaticChild(child), manifest, clean };
}

export async function runStaticStagingCli(lifecycle, clean,
  { onSignal = process.on.bind(process), waitTimeoutMs = 24 * 60 * 60 * 1000 } = {}) {
  let interrupted = false;
  let rejectStop;
  const stopFailed = new Promise((_, reject) => { rejectStop = reject; });
  for (const signal of ['SIGINT', 'SIGTERM']) onSignal(signal, () => {
    if (interrupted) return;
    interrupted = true;
    void lifecycle.stop().catch(rejectStop);
  });
  try {
    const result = await Promise.race([
      lifecycle.wait({ timeoutMs: waitTimeoutMs }), stopFailed,
    ]);
    if (result.error) throw result.error;
    if (result.code !== 0 && !interrupted) throw Error(`Local Wrangler exited ${result.code ?? result.signal}`);
  } finally { await stopStaticStaging(lifecycle, clean); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.argv[2] || 8797);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port');
  const { lifecycle, clean } = await startStaticStaging({ port });
  await runStaticStagingCli(lifecycle, clean);
}
