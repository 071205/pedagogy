import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { matchesTarget, probeFiles, resultExitCode } from './lib/hwpx-open-probe.mjs';

const red = process.env.H1_OPEN_RED === '1';
const runner = process.env.H1_OPEN_BASELINE
  ? execFileSync('git', ['show', `${process.env.H1_OPEN_BASELINE}:scripts/check-hwpx-opens.mjs`], { encoding: 'utf8' })
  : readFileSync(new URL('./check-hwpx-opens.mjs', import.meta.url), 'utf8');
// This gate also fails against the previous all-window cleanup implementation.
assert.ok(!/closeDocuments\(\s*\)/.test(runner), 'UNSCOPED_CLOSE: cleanup must require an owned window');
function fixture({ existing = [], reject = false, modal = false, timeout = false, permission = false,
  cleanup = true, lateError = false, stickyDialog = false } = {}) {
  let windows = [...existing];
  let snapshots = 0;
  const opened = [], closed = [];
  return {
    opened, closed,
    io: {
      snapshot() {
        if (permission) throw new Error('permission denied');
        if (lateError && ++snapshots === 3) windows.push({ title: 'Error', error: true });
        return windows.map((w) => ({ ...w }));
      },
      open(target) {
        opened.push(target);
        if (reject) windows.push({ title: 'Error', error: true });
        else if (modal) windows.push({ title: 'Save?', modal: true });
        else if (!timeout) windows.push({ title: target.split('/').at(-1) });
      },
      wait() {},
      close(w) {
        if (red) { closed.push(...windows.map((x) => x.title)); windows = []; return; }
        closed.push(w.title);
        if (cleanup) windows = windows.filter((x) => x.title !== w.title);
      },
      dismissError(w) {
        windows = windows.filter((x) => x.title !== w.title);
        // A recovery prompt can replace the error; the run must stop, not open the next file.
        if (stickyDialog) windows.push({ title: 'Recover?', modal: true });
      },
    },
  };
}
const target = '/tmp/probe.hwpx';
let count = 0;
function run(options, statuses, reason) {
  const f = fixture(options);
  const r = probeFiles([target, '/tmp/second.hwpx'], f.io, { polls: 2 });
  assert.deepEqual(r.map((x) => x.status), statuses);
  if (reason) assert.equal(r[0].reason, reason);
  count++;
  return f;
}
const preserved = run({ existing: [{ title: 'user document.hwpx' }, { title: 'probe-copy.hwpx' }] }, ['pass', 'pass']);
assert.deepEqual(preserved.closed, ['probe.hwpx', 'second.hwpx'], 'UNRELATED_WINDOW_CLOSED');
run({ existing: [{ title: 'probe.hwpx' }] }, ['skip', 'pass'], 'already-open');
run({ existing: [{ title: 'Error', error: true }] }, ['unknown', 'skip'], 'pre-existing-dialog');
run({ permission: true }, ['unknown', 'skip'], 'adapter-error');
run({ modal: true }, ['unknown', 'skip'], 'unexpected-dialog');
run({ timeout: true }, ['unknown', 'skip'], 'open-timeout');
run({ cleanup: false }, ['unknown', 'skip'], 'cleanup-incomplete');
run({ reject: true }, ['fail', 'fail'], 'hancom-rejected');
run({ lateError: true }, ['fail', 'pass'], 'hancom-rejected');
run({ reject: true, stickyDialog: true }, ['fail', 'skip'], 'hancom-rejected');
assert.equal(matchesTarget('한글.hwpx'.normalize('NFD'), '/tmp/한글.hwpx'), true);
assert.equal(matchesTarget('probe-copy.hwpx', target), false);
assert.equal(matchesTarget('probe.hwpx.backup', target), false);
assert.equal(resultExitCode([{ status: 'skip' }]), 2);
assert.equal(resultExitCode([{ status: 'unknown' }]), 1);
assert.equal(resultExitCode([{ status: 'pass' }]), 0);
console.log(`H1 open probe: ${count} scenarios + title/exit checks PASS`);
