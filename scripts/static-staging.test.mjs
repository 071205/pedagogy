import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PUBLIC_INPUTS, verifyPublic } from './build-public.mjs';
import { prepareStaticStaging, startStaticStaging, observeStaticChild, stopStaticStaging,
  runStaticStagingCli } from './serve-static-staging.mjs';

const root = await mkdtemp(join(tmpdir(), 'pedagogy-static-gate-'));
try {
  for (const file of PUBLIC_INPUTS) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), await readFile(new URL('../' + file, import.meta.url)));
  }
  await writeFile(join(root, 'wrangler.static.staging.toml'),
    await readFile(new URL('../wrangler.static.staging.toml', import.meta.url)));
  const first = await prepareStaticStaging(root);
  assert.deepEqual(await verifyPublic(join(root, 'dist/public')), first);
  const oldIndex = await readFile(join(root, 'dist/public/index.html'));

  // A failed new build must never start a server using the retained old build.
  await rm(join(root, 'index.html'));
  let spawned = false;
  await assert.rejects(startStaticStaging({ root,
    spawnProcess: () => { spawned = true; throw Error('Should not spawn'); },
  }), /ENOENT/);
  assert.equal(spawned, false);
  assert.deepEqual(await readFile(join(root, 'dist/public/index.html')), oldIndex);

  // A wrong root is rejected before Wrangler receives a configuration.
  await writeFile(join(root, 'index.html'), await readFile(new URL('../index.html', import.meta.url)));
  const configPath = join(root, 'wrangler.static.staging.toml');
  const config = await readFile(configPath, 'utf8');
  await writeFile(configPath, config.replace('./dist/public', './dist'));
  await assert.rejects(prepareStaticStaging(root), /static staging config/);
  await writeFile(configPath, config);

  // The value must belong to [assets], not a decoy TOML table or inline value.
  for (const invalid of [
    config.replace('[assets]', '[vars]\ndirectory = "./dist/public"\n\n[assets]').replace('[assets]\ndirectory = "./dist/public"', '[assets]\ndirectory = "."'),
    config.replace('directory = "./dist/public"', 'directory = "."\n[vars]\n"directory" = "./dist/public"'),
    config.replace('directory = "./dist/public"', 'directory = "."\n[vars]\nother = { directory = "./dist/public" }'),
  ]) {
    await writeFile(configPath, invalid);
    await assert.rejects(prepareStaticStaging(root), /static staging config|assets\.directory/i);
    spawned = false;
    await assert.rejects(startStaticStaging({ root,
      spawnProcess: () => { spawned = true; throw Error('Should not spawn'); },
    }), /static staging config|assets\.directory/i);
    assert.equal(spawned, false);
  }
  await writeFile(configPath, config);
  const quoted = config.replace('directory = "./dist/public"', '"directory" = "./dist/public"');
  await writeFile(configPath, quoted);
  assert.deepEqual(await prepareStaticStaging(root), first,
    'TOML quoted key must have the same parsed assets meaning');
  await writeFile(configPath, config);

  // Old output may exist after failure, but every successful preparation must
  // rebuild and replace it with the exact manifest-described asset bytes.
  await writeFile(join(root, 'dist/public/index.html'), 'stale output');
  const refreshed = await prepareStaticStaging(root);
  assert.deepEqual(refreshed, first);
  assert.deepEqual(await readFile(join(root, 'dist/public/index.html')), oldIndex);
  console.log('Static staging gate: fresh build, manifest, stale output, failed build and wrong root checks passed');
} finally { await rm(root, { recursive: true, force: true }); }

// A child that has exited by signal keeps exitCode=null. Observing it after
// the event must still complete immediately without killing it a second time.
const child = spawn(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"], { stdio: 'ignore' });
await new Promise(resolve => child.once('exit', resolve));
assert.equal(child.exitCode, null);
assert.equal(child.signalCode, 'SIGTERM');
const observed = observeStaticChild(child);
await observed.stop({ timeoutMs: 100 });
assert.equal(observed.status().signal, 'SIGTERM');

const failedSpawn = spawn(join(root, 'missing-wrangler-binary'), [], { stdio: 'ignore' });
const failed = observeStaticChild(failedSpawn);
assert.ok((await failed.wait({ timeoutMs: 1000 })).error, 'async spawn error must settle');
await failed.stop({ timeoutMs: 100 });

const unresponsive = new EventEmitter();
unresponsive.exitCode = null;
unresponsive.signalCode = null;
const signals = [];
unresponsive.kill = signal => { signals.push(signal); return true; };
await assert.rejects(observeStaticChild(unresponsive).stop({ timeoutMs: 25 }), /timed out/);
assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
let cleanCalls = 0;
await assert.rejects(stopStaticStaging({ stop: () => { throw Error('stop failed'); } },
  async () => { cleanCalls++; }), /stop failed/);
assert.equal(cleanCalls, 1, 'owned persistence cleanup must run even when stop fails');

// Exercise the standalone CLI path with a real owned child and short timeout.
// The test's outer finally kills the fixture if the regression is present.
const cliChild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
const cliEvents = [];
const originalKill = cliChild.kill.bind(cliChild);
cliChild.kill = signal => { cliEvents.push(signal); return originalKill(signal); };
try {
  await assert.rejects(runStaticStagingCli(observeStaticChild(cliChild),
    async () => { cliEvents.push('clean'); },
    { onSignal: () => {}, waitTimeoutMs: 25 }), /Local Wrangler exit timed out/);
  assert.deepEqual(cliEvents, ['SIGTERM', 'clean'],
    'CLI timeout must stop its owned child before persistence cleanup');
  assert.equal(cliChild.signalCode, 'SIGTERM');
} finally {
  if (cliChild.exitCode === null && cliChild.signalCode === null) {
    originalKill('SIGKILL');
    await new Promise(resolve => cliChild.once('exit', resolve));
  }
}
