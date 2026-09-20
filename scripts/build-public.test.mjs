import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPublic, PUBLIC_INPUTS, PUBLIC_FILES, verifyPublic } from './build-public.mjs';

const root = await mkdtemp(join(tmpdir(), 'pedagogy-public-'));
try {
  // Real runtime input, plus private decoys that a repository-wide copy would leak.
  for (const file of PUBLIC_INPUTS) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), await readFile(new URL('../' + file, import.meta.url)));
  }
  for (const file of ['worker/index.js', 'reviews/private.md', '.env', '.git/config', 'index.html.map']) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), 'private decoy');
  }
  const first = await buildPublic(root);
  const out = join(root, 'dist/public');
  const publicIndex=await readFile(join(out,'index.html'),'utf8');
  const policy=publicIndex.match(/http-equiv="Content-Security-Policy" content="([\s\S]*?)"/i)?.[1];
  assert.doesNotMatch(policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]||'', /'unsafe-inline'/,
    'public script policy must reject injected script blocks');
  assert.doesNotMatch(policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]||'', /'sha256-/,
    'externalized public scripts must not retain source-only inline hashes');
  assert.deepEqual(Object.keys(first), [...PUBLIC_FILES]);
  assert.deepEqual(await buildPublic(root), first, 'build must be byte-reproducible');
  for (const file of PUBLIC_INPUTS.filter(file=>!['index.html','mock-exam-editor.html','document-editor.html'].includes(file))) {
    assert.deepEqual(await readFile(join(out, file)), await readFile(join(root, file)));
  }
  for(const file of ['index.html','mock-exam-editor.html','document-editor.html']) {
    const original=await readFile(join(root,file),'utf8');
    const built=await readFile(join(out,file),'utf8');
    const scriptTag=/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    const bodies=[...original.matchAll(scriptTag)].filter(m=>m[1]!==undefined && !/\bsrc\s*=/.test(m[1])).map(m=>m[2]);
    for(const [i,body] of bodies.entries()) {
      const script=`assets/${file.replace(/\.html$/,'')}-${i+1}.js`;
      assert.ok(built.includes(`<script src="${script}"></script>`));
      assert.equal(await readFile(join(out,script),'utf8'),body,'extraction must preserve script bytes and order');
    }
  }
  await writeFile(join(out,'index.html'),publicIndex.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"));
  await assert.rejects(verifyPublic(out), /Unsafe public script policy/);
  await buildPublic(root);
  await writeFile(join(out,'index.html'),publicIndex.replace('</body>','<script>window.injected=1</script></body>'));
  await assert.rejects(verifyPublic(out), /Inline script/);
  await buildPublic(root);
  await writeFile(join(out, 'index.html.map'), 'leak');
  await assert.rejects(verifyPublic(out), /allowlist mismatch/);
  await buildPublic(root);
  await mkdir(join(out, 'worker'));
  await writeFile(join(out, 'worker/index.js'), 'leak');
  await assert.rejects(verifyPublic(out), /Unexpected public directory/);
  await buildPublic(root);
  await writeFile(join(out, 'index.html'), '<script>//# sourceMappingURL=data:application/json;base64,e30=</script>');
  await assert.rejects(verifyPublic(out), /Source map reference/);
  await buildPublic(root);
  const manifestPath = join(root, 'dist/public-manifest.json');
  await rm(manifestPath);
  await symlink(join(root, '.env'), manifestPath);
  await assert.rejects(buildPublic(root), /manifest must be a regular file/);
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'private decoy', 'manifest symlink must not overwrite other files');
  await rm(manifestPath);
  await buildPublic(root);
  await rm(join(root, 'index.html'));
  await symlink(join(root, '.env'), join(root, 'index.html'));
  await assert.rejects(buildPublic(root), /without symlinks/);
  await rm(join(root, 'index.html'));
  await writeFile(join(root, 'index.html'), '<script>const key="sk-ant-fake-test-secret-123456"</script>');
  await assert.rejects(buildPublic(root), /secret signature/);
  await rm(join(root, 'index.html'));
  await assert.rejects(buildPublic(root), /ENOENT/);
  console.log('Public build: reproducible runtime files; private files excluded; map, secret, symlink, missing-input and leaked-output rejection confirmed');
} finally { await rm(root, { recursive: true, force: true }); }
