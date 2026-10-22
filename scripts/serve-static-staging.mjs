import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPublic, verifyPublic } from './build-public.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function prepareStaticStaging(root = projectRoot) {
  root = resolve(root);
  const config = await readFile(join(root, 'wrangler.static.staging.toml'), 'utf8');
  assert.match(config, /^name = "pedagogy-static-local-fixture"$/m);
  assert.match(config, /^directory = "\.\/dist\/public"$/m);
  assert.match(config, /^html_handling = "auto-trailing-slash"$/m);
  assert.match(config, /^not_found_handling = "none"$/m);
  assert.doesNotMatch(config, /^\s*(main|route|routes|account_id|zone_id|binding|AI_PROVIDER|ANTHROPIC_KEY)\s*=/m);
  assert.doesNotMatch(config, /\[\[(?:durable_objects|migrations)/);
  // Always rebuild before starting the local host. buildPublic keeps the old
  // output on input failure; this gate must refuse to serve that stale output.
  const built = await buildPublic(root);
  const verified = await verifyPublic(join(root, 'dist/public'));
  const recorded = JSON.parse(await readFile(join(root, 'dist/public-manifest.json'), 'utf8'));
  assert.deepEqual(verified, built, 'Built and verified public bytes differ');
  assert.deepEqual(recorded, built, 'Public manifest does not describe the served bytes');
  return built;
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
  return { child, manifest, clean };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.argv[2] || 8797);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port');
  const { child, clean } = await startStaticStaging({ port });
  let interrupted = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    interrupted = true;
    child.kill(signal);
  });
  await new Promise((resolveChild, rejectChild) => {
    child.once('error', rejectChild);
    child.once('exit', code => code === 0 || interrupted
      ? resolveChild() : rejectChild(Error(`Local Wrangler exited ${code}`)));
  }).finally(clean);
}
