import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Exact runtime assets. Never replace this with a recursive repository copy/glob.
// The two sanitized HWPX skeletons are runtime data; the rest of experiments is private.
export const PUBLIC_INPUTS = Object.freeze([
  'index.html', 'mock-exam-editor.html', 'document-editor.html', 'legal.html',
  'service-config.js', 'pedagogy-normalize.js', 'pedagogy-render.js', 'pedagogy-print.js', 'pedagogy-ai-image.js',
  'mock-library-store.js', 'hwpx-engine.js', 'hwpx-document.js', 'hwpx-exam.js',
  'hwpx-exam-template.js', 'exam-template-data.js', 'blank-template-data.js', 'LICENSE',
  'experiments/hwp-export/templates/blank.hwpx',
  'experiments/hwp-export/templates/exam-math.hwpx',
].sort());

const SCRIPT_COUNTS = Object.freeze({'index.html':3,'mock-exam-editor.html':1,'document-editor.html':1});
const scriptName = (file,index) => `assets/${file.replace(/\.html$/,'')}-${index}.js`;
export const PUBLIC_FILES = Object.freeze([...PUBLIC_INPUTS,
  ...Object.entries(SCRIPT_COUNTS).flatMap(([file,count])=>Array.from({length:count},(_,i)=>scriptName(file,i+1))),
].sort());

// Classic script order and global lexical scope are intentional public contracts.
// Skip complete HTML comments; script bodies are consumed as raw text, not parsed as HTML.
const SCRIPT_TAG = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
function splitScripts(file,bytes) {
  if(!SCRIPT_COUNTS[file]) return [[file,bytes]];
  const scripts=[];
  let html=bytes.toString('utf8').replace(SCRIPT_TAG,(tag,attributes,body)=>{
    if(attributes===undefined || /\bsrc\s*=/i.test(attributes)) return tag;
    if(attributes.trim()) throw Error(`Review new inline script attributes: ${file}`);
    const name=scriptName(file,scripts.length+1);
    scripts.push([name,Buffer.from(body)]);
    return `<script src="${name}"></script>`;
  });
  if(scripts.length!==SCRIPT_COUNTS[file]) throw Error(`Review public script allowlist: ${file}`);
  let policyCount=0;
  html=html.replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([\s\S]*?)(")/i,
    (_tag,before,policy,after)=>{
      policyCount++;
      return before+policy.replace(/(^|;)\s*script-src\s+([^;]+)/,
        (_rule,boundary,values)=>`${boundary} script-src ${values.replace(/\s*'unsafe-inline'/g,'')}`)+after;
    });
  if(policyCount!==1) throw Error(`Missing public CSP: ${file}`);
  return [[file,Buffer.from(html)],...scripts];
}

function checkPublicPolicy(file,bytes) {
  if(!SCRIPT_COUNTS[file]) return;
  const html=bytes.toString('utf8');
  const policy=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1];
  const scriptPolicy=policy?.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1];
  if(!scriptPolicy || /'unsafe-inline'|'unsafe-eval'/.test(scriptPolicy)) throw Error(`Unsafe public script policy: ${file}`);
  for(const match of html.matchAll(SCRIPT_TAG)) {
    if(match[1]!==undefined && !/\bsrc\s*=/.test(match[1])) throw Error(`Inline script in public output: ${file}`);
  }
}

async function plainPath(root, relative) {
  let current = root;
  const parts = relative.split('/');
  for (const [i, part] of parts.entries()) {
    current = join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile())) {
      throw new Error(`Public asset must be a regular file without symlinks: ${relative}`);
    }
  }
  return current;
}

function checkContent(file, bytes) {
  if (!/\.(js|html)$/.test(file)) return;
  const content = bytes.toString('utf8');
  // Defense in depth, not a complete secret scanner. Public Firebase API keys are expected.
  if (/sourceMappingURL\s*=|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-ant-[A-Za-z0-9_-]{12,}/.test(content)) {
    throw new Error(`Source map reference or secret signature in public asset: ${file}`);
  }
}

export async function verifyPublic(directory) {
  if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink()) {
    throw new Error('Public output must be a regular directory');
  }
  const found = [];
  async function walk(relative = '') {
    for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in public output: ${file}`);
      if (entry.isDirectory()) {
        if (!PUBLIC_FILES.some(allowed => allowed.startsWith(file + '/'))) throw new Error(`Unexpected public directory: ${file}`);
        await walk(file);
      } else if (entry.isFile()) found.push(file);
      else throw new Error(`Non-file in public output: ${file}`);
    }
  }
  await walk();
  if (JSON.stringify(found.sort()) !== JSON.stringify(PUBLIC_FILES)) throw new Error('Public file allowlist mismatch');
  const manifest = {};
  for (const file of found) {
    const bytes = await readFile(await plainPath(directory, file));
    checkContent(file, bytes);
    checkPublicPolicy(file, bytes);
    manifest[file] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  return manifest;
}

export async function buildPublic(root) {
  root = resolve(root);
  // Validate all inputs before touching the previous build.
  const assets = [];
  for (const file of PUBLIC_INPUTS) {
    const bytes = await readFile(await plainPath(root, file));
    checkContent(file, bytes);
    assets.push(...splitScripts(file,bytes));
  }
  const dist = join(root, 'dist');
  await mkdir(dist, { recursive: true });
  if ((await lstat(dist)).isSymbolicLink()) throw new Error('dist must not be a symlink');
  const output = join(dist, 'public');
  const manifestPath = join(dist, 'public-manifest.json');
  const oldManifest = await lstat(manifestPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (oldManifest && (!oldManifest.isFile() || oldManifest.isSymbolicLink())) throw new Error('Public manifest must be a regular file');
  const old = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (old && (!old.isDirectory() || old.isSymbolicLink())) throw new Error('dist/public must be a regular directory');
  const staging = await mkdtemp(join(dist, '.public-'));
  try {
    for (const [file, bytes] of assets) {
      await mkdir(dirname(join(staging, file)), { recursive: true });
      await writeFile(join(staging, file), bytes);
    }
    const manifest = await verifyPublic(staging);
    // Only this generated output is replaced; rm does not follow child symlinks.
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    // Keep evidence outside the web root. Build success is required before publication.
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = process.argv.includes('--check')
    ? await verifyPublic(join(root, 'dist/public')) : await buildPublic(root);
  console.log(`Public artifact verified: ${Object.keys(manifest).length} files. Publish only dist/public; this is not launch approval.`);
}
