import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(ROOT, '.sonarcloud.properties');

function parseProperties(text) {
  const logical = [];
  let pending = '';
  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith('\\')) {
      pending += line.slice(0, -1);
      continue;
    }
    logical.push(pending + line);
    pending = '';
  }
  if (pending) logical.push(pending);
  return new Map(logical.map(line => {
    const at = line.indexOf('=');
    return at < 1 ? [line, ''] : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  }));
}

const csv = value => (value || '').split(',').map(item => item.trim()).filter(Boolean);
const coveredBy = (file, roots) => roots.some(root => file === root || file.startsWith(`${root}/`));
const ANALYZABLE = /\.(?:html|js|mjs|py)$/;
const INTENTIONALLY_OUTSIDE = /^(?:scripts|experiments|reviews|tests|\.claude|docs\/mockups)\//;
const GENERATED_DATA = new Set(['blank-template-data.js', 'exam-template-data.js']);
const WORKER_TEST = /^worker\/.*\.test\.mjs$/;
const RUNTIME_HWPX = new Set([
  'experiments/hwp-export/mock_to_hwpx.py',
  'experiments/hwp-export/document_to_hwpx.py',
  'experiments/hwp-export/document_schema.py',
  'experiments/hwp-export/pedagogy_hwpx.py',
  'experiments/hwp-export/tex_to_hwp.py',
  'experiments/hwp-export/template.py',
  'experiments/hwp-export/exam_profile.py',
  'experiments/hwp-export/exam_style.py',
  'experiments/hwp-export/exam_layout.py',
]);

export function violations(text, tracked) {
  const props = parseProperties(text);
  const sources = csv(props.get('sonar.sources'));
  const tests = csv(props.get('sonar.tests'));
  const bad = [];

  if (sources.includes('.')) bad.push('sonar.sources must not include the repository root');
  for (const root of ['scripts', 'experiments', 'reviews', 'tests', '.claude']) {
    if (sources.includes(root)) bad.push(`developer-only directory is in main scope: ${root}`);
    if (tests.includes(root)) bad.push(`developer-only directory is in test scope: ${root}`);
  }
  for (const file of ['experiments/hwp-export/make_math_probe.py',
    'experiments/hwp-export/hwp_export_cli.py']) {
    if (sources.includes(file)) bad.push(`local CLI is in main scope: ${file}`);
  }
  for (const file of RUNTIME_HWPX) {
    if (!existsSync(resolve(ROOT, file))) bad.push(`configured runtime file is missing: ${file}`);
  }

  const expectedMain = tracked.filter(file => ANALYZABLE.test(file)
    && (!INTENTIONALLY_OUTSIDE.test(file) || RUNTIME_HWPX.has(file))
    && !GENERATED_DATA.has(file)
    && !WORKER_TEST.test(file));
  for (const file of expectedMain) {
    if (!coveredBy(file, sources)) bad.push(`runtime file is outside main scope: ${file}`);
  }

  const workerTests = tracked.filter(file => WORKER_TEST.test(file));
  if (!tests.includes('worker')) bad.push('worker is missing from sonar.tests');
  if (!csv(props.get('sonar.test.inclusions')).includes('worker/**/*.test.mjs')) {
    bad.push('worker test inclusion is missing');
  }
  for (const file of workerTests) {
    if (!coveredBy(file, tests)) bad.push(`worker test is outside test scope: ${file}`);
  }
  if (props.get('sonar.python.version') !== '3.12,3.13') bad.push('Python analysis versions drifted');
  return bad;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0').filter(Boolean);
}

if (!existsSync(CONFIG)) {
  console.error('  ❌ .sonarcloud.properties is missing (Automatic Analysis does not read sonar-project.properties)');
  process.exit(1);
}
if (existsSync(resolve(ROOT, 'sonar-project.properties'))) {
  console.error('  ❌ legacy sonar-project.properties would create two diverging configurations');
  process.exit(1);
}

const text = readFileSync(CONFIG, 'utf8');
const tracked = trackedFiles();
const bad = violations(text, tracked);
for (const message of bad) console.error('  ❌ ' + message);

const mutations = [
  text.replace(/sonar\.sources=[\s\S]*?\n\n# Worker/, 'sonar.sources=.\n\n# Worker'),
  text.replace(/\s*worker,\\\n/, '\n'),
  text.replace('sonar.test.inclusions=worker/**/*.test.mjs', 'sonar.test.inclusions='),
  text.replace(/\s*experiments\/hwp-export\/mock_to_hwpx\.py,\\\n/, '\n'),
];
const red = mutations.filter(mutated => violations(mutated, tracked).length > 0).length;
if (red !== mutations.length) console.error('  ❌ Sonar scope self-check failed to reject a broken configuration');
if (bad.length || red !== mutations.length) process.exit(1);

console.log(`Sonar scope passed — ${tracked.filter(f => ANALYZABLE.test(f)).length} analyzable tracked files checked; self-check ${red}/${mutations.length}`);
