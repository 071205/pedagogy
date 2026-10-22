import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PUBLIC_INPUTS, verifyPublic } from './build-public.mjs';
import { prepareStaticStaging, startStaticStaging } from './serve-static-staging.mjs';

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
  await assert.rejects(prepareStaticStaging(root), /directory/);
  await writeFile(configPath, config);

  // Old output may exist after failure, but every successful preparation must
  // rebuild and replace it with the exact manifest-described asset bytes.
  await writeFile(join(root, 'dist/public/index.html'), 'stale output');
  const refreshed = await prepareStaticStaging(root);
  assert.deepEqual(refreshed, first);
  assert.deepEqual(await readFile(join(root, 'dist/public/index.html')), oldIndex);
  console.log('Static staging gate: fresh build, manifest, stale output, failed build and wrong root checks passed');
} finally { await rm(root, { recursive: true, force: true }); }
