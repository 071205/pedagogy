import { basename } from 'node:path';

const normalize = (s) => s.normalize('NFC');
export function matchesTarget(title, target) {
  const name = normalize(basename(target));
  return normalize(title) === name || normalize(title) === name.replace(/\.hwpx$/i, '');
}

// Adapter owns UI access; the policy never closes a pre-existing or unrelated window.
export function probeFiles(targets, io, { polls = 40 } = {}) {
  const results = [];
  for (const target of targets) {
    const result = { target, status: 'unknown', reason: '' };
    results.push(result);
    try {
      const before = io.snapshot(); // An inaccessible UI must throw, not return an empty inventory.
      if (before.some((w) => w.error || w.modal)) {
        result.reason = 'pre-existing-dialog';
        break;
      }
      if (before.some((w) => matchesTarget(w.title, target))) {
        result.status = 'skip';
        result.reason = 'already-open';
        continue;
      }
      io.open(target);
      let own;
      let rejected;
      for (let i = 0; i < polls; i++) {
        io.wait();
        const windows = io.snapshot();
        rejected = windows.find((w) => w.error);
        if (rejected) break;
        if (windows.some((w) => w.modal)) {
          result.reason = 'unexpected-dialog';
          break;
        }
        const matches = windows.filter((w) => matchesTarget(w.title, target));
        if (matches.length > 1) {
          result.reason = 'ambiguous-window';
          break;
        }
        if (matches.length === 1) {
          own = matches[0];
          // Confirm again after one tick: a document window can precede the error dialog.
          io.wait();
          const confirmed = io.snapshot();
          rejected = confirmed.find((w) => w.error);
          if (rejected) break;
          if (confirmed.some((w) => w.modal) ||
              confirmed.filter((w) => matchesTarget(w.title, target)).length !== 1) {
            result.reason = 'unstable-window';
            own = undefined;
          }
          break;
        }
      }
      if (rejected) {
        result.status = 'fail';
        result.reason = 'hancom-rejected';
        // Only the recognized error, never window 1 indiscriminately. Keep the buttons as evidence.
        const buttons = io.dismissError(rejected);
        if (Array.isArray(buttons)) result.dialogButtons = buttons;
        const remaining = io.snapshot();
        if (remaining.some((w) => w.error || w.modal)) break;
        const matches = remaining.filter((w) => matchesTarget(w.title, target));
        if (matches.length === 1) own = matches[0];
        else own = undefined;
      } else if (own) {
        result.status = 'pass';
        result.reason = 'opened';
      } else {
        result.reason ||= 'open-timeout';
        break; // Attribution becomes unsafe after timeout; do not continue opening files.
      }
      if (own) {
        io.close(own); // Exact observed title, absent from the pre-open inventory.
        io.wait();
        const after = io.snapshot();
        if (after.some((w) => w.error || w.modal || matchesTarget(w.title, target))) {
          result.status = 'unknown';
          result.reason = 'cleanup-incomplete';
          break;
        }
      }
    } catch (error) {
      result.status = 'unknown';
      result.reason = 'adapter-error';
      result.detail = String(error.message);
      break;
    }
  }
  for (const target of targets.slice(results.length)) {
    results.push({ target, status: 'skip', reason: 'prior-case-blocked' });
  }
  return results;
}

export function resultExitCode(results) {
  if (results.some((r) => r.status === 'fail' || r.status === 'unknown')) return 1;
  return results.every((r) => r.status === 'pass') && results.length > 0 ? 0 : 2;
}
