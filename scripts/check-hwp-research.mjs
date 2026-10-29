import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function check(command, args, environment = {}, expected = null) {
  const r = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, H1_OPEN_RED: '', H1_FIXTURE_RED: '', H1_REFERENCE_RED: '', H1_SECTION_RED: '', H1_EQUATION_RED: '', H1_EQUATION_CONTENT_RED: '', H1_OPEN_BASELINE: '', H1_POLICY_BASELINE: '', H1_OPEN_SCENARIO: '', ...environment } });
  const output = (r.stdout || '') + (r.stderr || '');
  if (expected) {
    assert.equal(r.status, 1, `red did not fail normally: ${output}`);
    assert.ok(output.includes(expected), `wrong failure: ${output}`);
    console.log(`RED verified: ${expected}`);
  } else {
    assert.equal(r.status, 0, output || String(r.error));
    console.log(output.trim());
  }
}
check(process.execPath, ['scripts/check-hwpx-open-probe.mjs']);
check(process.execPath, ['scripts/check-hwpx-open-probe.mjs'], { H1_OPEN_RED: '1' }, 'UNRELATED_WINDOW_CLOSED');
const python = process.env.HWPX_PYTHON || 'python3';
const probe = spawnSync(python, ['-c', 'import lxml'], { encoding: 'utf8' });
if (probe.status !== 0) {
  console.log('SKIP: fixture generation needs lxml; only Node window-policy checks ran. Set HWPX_PYTHON.');
  process.exit(process.env.HWPX_REQUIRE === '1' ? 1 : 0);
}
check(python, ['scripts/check-hwp-research-fixtures.py']);
check(python, ['scripts/check-hwp-research-fixtures.py'], { H1_FIXTURE_RED: '1' }, 'UNRELATED_PART_CHANGED');
check(python, ['scripts/check-hwp-research-fixtures.py'], { H1_REFERENCE_RED: '1' }, 'PATH_REFERENCE_STALE');
check(python, ['scripts/check-hwp-section-fixtures.py']);
check(python, ['scripts/check-hwp-section-fixtures.py'], { H1_SECTION_RED: '1' }, 'SECTION_ORDER_MUTATION_LOST');
check(python, ['scripts/check-hwp-equation-fixtures.py']);
check(python, ['scripts/check-hwp-equation-fixtures.py'], { H1_EQUATION_RED: '1' }, 'EQUATION_GEOMETRY_MUTATION_LOST');
check(python, ['scripts/check-hwp-equation-fixtures.py'], { H1_EQUATION_CONTENT_RED: 'script' }, 'EQUATION_INPUT_MEANING_LOST');
check(python, ['scripts/check-hwp-equation-fixtures.py'], { H1_EQUATION_CONTENT_RED: 'order' }, 'EQUATION_MIXED_ORDER_LOST');
