import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const baselinePolicy = process.env.H1_POLICY_BASELINE;
const policyUrl = baselinePolicy
  ? `data:text/javascript;base64,${Buffer.from(execFileSync('git', ['show', `${baselinePolicy}:scripts/lib/hwpx-open-probe.mjs`], { encoding: 'utf8' })).toString('base64')}`
  : new URL('./lib/hwpx-open-probe.mjs', import.meta.url);
const { matchesTarget, probeFiles, resultExitCode } = await import(policyUrl);

const red = process.env.H1_OPEN_RED === '1';
const runner = process.env.H1_OPEN_BASELINE
  ? execFileSync('git', ['show', `${process.env.H1_OPEN_BASELINE}:scripts/check-hwpx-opens.mjs`], { encoding: 'utf8' })
  : readFileSync(new URL('./check-hwpx-opens.mjs', import.meta.url), 'utf8');
// This gate also fails against the previous all-window cleanup implementation.
assert.ok(!/closeDocuments\(\s*\)/.test(runner), 'UNSCOPED_CLOSE: cleanup must require an owned window');
function fixture({ existing = [], reject = false, modal = false, timeout = false, permission = false,
  cleanup = true, lateError = false, stickyDialog = false, duplicateAfterReject = false, mergedWindow = false,
  lateMerge = false, extraWindowAfterReject = false, existingLostAfterReject = false,
  existingLostAfterClose = false, existingSwappedAfterReject = false, existingSwappedAfterClose = false,
  extraWindowAfterClose = false } = {}) {
  let windows = [...existing];
  let snapshots = 0;
  const opened = [], closed = [];
  return {
    opened, closed,
    io: {
      snapshot() {
        if (permission) throw new Error('permission denied');
        snapshots++;
        if (lateError && snapshots === 3) windows.push({ title: 'Error', error: true });
        if (lateMerge && snapshots === 3) windows = windows.filter((w) => w.title === 'probe.hwpx');
        return windows.map((w) => ({ ...w }));
      },
      open(target) {
        opened.push(target);
        if (mergedWindow) {
          windows[0].title = target.split('/').at(-1);
          if (reject) windows.push({ title: 'Error', error: true });
          return;
        }
        if (reject) windows.push({ title: 'Error', error: true });
        else if (modal) windows.push({ title: 'Save?', modal: true });
        else if (!timeout) windows.push({ title: target.split('/').at(-1) });
      },
      wait() {},
      close(w) {
        if (red) { closed.push(...windows.map((x) => x.title)); windows = []; return; }
        closed.push(w.title);
        if (cleanup) windows = windows.filter((x) => x.title !== w.title);
        if (existingLostAfterClose) windows = [];
        if (existingSwappedAfterClose) windows = [{ title: 'Untitled replacement' }];
        if (extraWindowAfterClose) windows.push({ title: 'Untitled recovery document' });
      },
      dismissError(w) {
        windows = windows.filter((x) => x.title !== w.title);
        // A recovery prompt can replace the error; the run must stop, not open the next file.
        if (stickyDialog) windows.push({ title: 'Recover?', modal: true });
        if (duplicateAfterReject) windows.push({ title: 'probe.hwpx' }, { title: 'probe.hwpx' });
        if (extraWindowAfterReject) windows.push({ title: 'Untitled recovery document' });
        if (existingLostAfterReject) windows = [];
        if (existingSwappedAfterReject) windows = [{ title: 'Untitled replacement' }];
      },
    },
  };
}
const target = '/tmp/probe.hwpx';
let count = 0;
function run(options, statuses, reason, message) {
  const f = fixture(options);
  const r = probeFiles([target, '/tmp/second.hwpx'], f.io, { polls: 2 });
  assert.ok(!(options.existing || []).some((w) => f.closed.includes(w.title)), 'UNRELATED_WINDOW_CLOSED');
  assert.deepEqual(r.map((x) => x.status), statuses, message || 'UNEXPECTED_PROBE_STATUSES');
  if (reason) assert.equal(r[0].reason, reason);
  f.results = r;
  count++;
  return f;
}
function checkMergedWindow(reject) {
  const merged = run({ existing: [{ title: 'user document.hwpx' }], mergedWindow: true, reject },
    ['unknown', 'skip'], reject ? 'no-new-document-window-after-reject' : 'no-new-document-window',
    'MERGED_WINDOW_CLOSED');
  assert.deepEqual(merged.closed, []);
  assert.deepEqual(merged.opened, [target]);
}
function checkAmbiguousRecovery() {
  const ambiguousRecovery = run({ reject: true, duplicateAfterReject: true }, ['unknown', 'skip'],
    'ambiguous-window', 'RECOVERY_AMBIGUITY_CONTINUED');
  assert.deepEqual(ambiguousRecovery.opened, [target]);
  assert.deepEqual(ambiguousRecovery.closed, []);
  assert.equal(ambiguousRecovery.results[0].rejectionObserved, true);
}
function checkLateMerge() {
  const merged = run({ existing: [{ title: 'user document.hwpx' }], lateMerge: true },
    ['unknown', 'skip'], 'no-new-document-window', 'LATE_MERGED_WINDOW_CLOSED');
  assert.deepEqual(merged.closed, []);
  assert.equal(merged.results[0].windowCountObserved, 1);
}
function checkResidualRecovery() {
  const recovery = run({ reject: true, extraWindowAfterReject: true }, ['unknown', 'skip'],
    'cleanup-incomplete', 'RESIDUAL_RECOVERY_CONTINUED');
  assert.equal(recovery.results[0].rejectionObserved, true);
  assert.deepEqual(recovery.closed, []);
}
function checkExistingLoss(reject) {
  const loss = run({ existing: [{ title: 'user document.hwpx' }], reject,
    existingLostAfterReject: reject, existingLostAfterClose: !reject }, ['unknown', 'skip'],
    'existing-window-count-decreased', 'EXISTING_WINDOW_LOSS_CONTINUED');
  assert.deepEqual(loss.opened, [target]);
  assert.deepEqual(loss.closed, reject ? [] : ['probe.hwpx']);
  assert.equal(loss.results[0].windowCountAfterCleanup, 0);
  if (reject) assert.equal(loss.results[0].rejectionObserved, true);
}
function checkExistingSwap(reject) {
  const swap = run({ existing: [{ title: 'user document.hwpx' }], reject,
    existingSwappedAfterReject: reject, existingSwappedAfterClose: !reject }, ['unknown', 'skip'],
    'existing-window-lost', 'EXISTING_WINDOW_SWAP_CONTINUED');
  assert.deepEqual(swap.opened, [target]);
  assert.equal(swap.results[0].windowCountAfterCleanup, 1);
  assert.deepEqual(swap.closed, reject ? [] : ['probe.hwpx']);
  if (reject) assert.equal(swap.results[0].rejectionObserved, true);
}
function checkResidualClose() {
  const residue = run({ extraWindowAfterClose: true }, ['unknown', 'skip'], 'cleanup-incomplete', 'RESIDUAL_CLOSE_CONTINUED');
  assert.deepEqual(residue.opened, [target]);
  assert.deepEqual(residue.closed, ['probe.hwpx']);
}
const scenario = process.env.H1_OPEN_SCENARIO;
if (scenario) {
  if (scenario === 'merged') checkMergedWindow(false);
  else if (scenario === 'merged-after-reject') checkMergedWindow(true);
  else if (scenario === 'ambiguous-recovery') checkAmbiguousRecovery();
  else if (scenario === 'late-merge') checkLateMerge();
  else if (scenario === 'residual-recovery') checkResidualRecovery();
  else if (scenario === 'existing-loss-after-reject') checkExistingLoss(true);
  else if (scenario === 'existing-loss-after-close') checkExistingLoss(false);
  else if (scenario === 'existing-swap-after-reject') checkExistingSwap(true);
  else if (scenario === 'existing-swap-after-close') checkExistingSwap(false);
  else if (scenario === 'residual-after-close') checkResidualClose();
  else throw new Error('Unknown H1_OPEN_SCENARIO');
  console.log(`H1 focused scenario ${scenario} PASS`);
  process.exit(0);
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
for (const reject of [false, true]) checkMergedWindow(reject);
checkAmbiguousRecovery();
checkLateMerge();
checkResidualRecovery();
checkExistingLoss(true);
checkExistingLoss(false);
checkExistingSwap(true);
checkExistingSwap(false);
checkResidualClose();
assert.equal(matchesTarget('한글.hwpx'.normalize('NFD'), '/tmp/한글.hwpx'), true);
assert.equal(matchesTarget('probe-copy.hwpx', target), false);
assert.equal(matchesTarget('probe.hwpx.backup', target), false);
assert.equal(resultExitCode([{ status: 'skip' }]), 2);
assert.equal(resultExitCode([{ status: 'unknown' }]), 1);
assert.equal(resultExitCode([{ status: 'pass' }]), 0);
console.log(`H1 open probe: ${count} scenarios + title/exit checks PASS`);
