/* Local Hancom open probe. Exit 0 = all opened, 1 = rejection/unknown, 2 = skip.
 * Never close documents that were already open; use unique fixture filenames.
 * Opening a file is not evidence of correct rendering. See HWP-RESEARCH-DESIGN.md.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { probeFiles, resultExitCode } from './lib/hwpx-open-probe.mjs';

const APP = 'Hancom Office HWP';
const ERROR_TEXT = '파일을 읽거나 저장하는데';
const CORRUPT_TEXT = '파일이 손상되었습니다.';
// JSON escaping is also valid for these AppleScript strings; controls are rejected below.
const quote = (s) => {
  if (/[\x00-\x1f\x7f]/.test(s)) throw new Error('제어 문자가 든 경로/창 제목은 지원하지 않습니다');
  return JSON.stringify(s);
};
function osa(script) {
  const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 30_000 });
  if (r.status !== 0) throw new Error(r.error?.message || r.stderr.trim() || 'UI 접근 실패');
  return r.stdout.trimEnd();
}
// ⚠️ macOS 접근성은 한글이 **앞에 있지 않으면 창을 0개로** 보고한다(2026-10-14 실측 — 열린 문서가 그대로
// 있는데 목록만 비었다). 빈 목록을 '아무것도 안 열림' 으로 믿으면 이미 열린 같은 이름 문서를 못 보고 다시
// 열어 옛 내용으로 판정한 뒤 **사용자 문서를 닫는다.** 그래서 매번 앞으로 가져오고, 그래도 앞이 아니면 멈춘다.
function snapshot() {
  const raw = osa(`tell application "System Events"
    if not (exists process "${APP}") then return ""
  end tell
  tell application "${APP}" to activate
  delay 0.3
  tell application "System Events"
    tell process "${APP}"
      if not frontmost then error "Hancom is not frontmost; window inventory would be unreliable"
      set snapshotLines to ""
      repeat with w in windows
        set titleText to name of w
        set bad to false
        try
          set dialogText to ((value of every static text of w) as text)
          set bad to (dialogText contains "${ERROR_TEXT}") or (dialogText contains "${CORRUPT_TEXT}")
        end try
        set dialogFlag to false
        try
          set dialogFlag to ((subrole of w) is "AXDialog") or ((subrole of w) is "AXSystemDialog") or ((count of sheets of w) > 0)
        end try
        set snapshotLines to snapshotLines & titleText & tab & (bad as text) & tab & (dialogFlag as text) & linefeed
      end repeat
      return snapshotLines
    end tell
  end tell`);
  if (!raw) return [];
  return raw.split('\n').map((line) => {
    const fields = line.split('\t');
    if (fields.length !== 3 || !['true', 'false'].includes(fields[1]) || !['true', 'false'].includes(fields[2])) {
      throw new Error('창 상태를 정확히 읽지 못했습니다');
    }
    return { title: fields[0], error: fields[1] === 'true', modal: fields[2] === 'true' };
  });
}
const argv = process.argv.slice(2);
let reportPath;
const targets = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--report') {
    if (reportPath || !argv[i + 1]) throw new Error('--report <새 결과.json>');
    reportPath = resolve(argv[++i]);
  } else if (argv[i].startsWith('--')) throw new Error(`알 수 없는 옵션: ${argv[i]}`);
  else targets.push(resolve(argv[i]));
}
if (!targets.length) throw new Error('열어 볼 .hwpx 파일을 인자로 주세요');
if (reportPath && existsSync(reportPath)) throw new Error('기존 보고서를 덮어쓰지 않습니다');
for (const target of targets) {
  quote(target);
  if (!existsSync(target) || !/\.hwpx$/i.test(target)) throw new Error(`HWPX 파일이 없습니다: ${target}`);
}
let results;
if (process.platform !== 'darwin' || !existsSync(`/Applications/${APP}.app`)) {
  results = targets.map((target) => ({ target, status: 'skip', reason: 'hancom-unavailable' }));
} else {
  results = probeFiles(targets, {
    snapshot,
    open(target) {
      const r = spawnSync('open', ['-a', APP, target], { encoding: 'utf8', timeout: 30_000 });
      if (r.status !== 0) throw new Error(r.error?.message || r.stderr || 'open 실패');
    },
    wait() { spawnSync('sleep', ['0.5']); },
    close(window) {
      osa(`tell application "System Events" to tell process "${APP}"
        set targets to every window whose name is ${quote(window.title)}
        if (count of targets) is not 1 then error "ambiguous close target"
        click (first button of item 1 of targets whose subrole is "AXCloseButton")
      end tell`);
    },
    dismissError(window) {
      const buttons = osa(`tell application "System Events" to tell process "${APP}"
        set targets to every window whose name is ${quote(window.title)}
        if (count of targets) is not 1 then error "ambiguous error dialog"
        set w to item 1 of targets
        set dialogText to ((value of every static text of w) as text)
        if not ((dialogText contains "${ERROR_TEXT}") or (dialogText contains "${CORRUPT_TEXT}")) then error "not the expected error"
        set buttonNames to ""
        repeat with b in buttons of w
          set buttonNames to buttonNames & (name of b as text) & linefeed
        end repeat
        click button 1 of w
        return buttonNames
      end tell`);
      spawnSync('sleep', ['0.5']);
      return buttons.split('\n').filter(Boolean); // [0] is the one clicked.
    },
  });
}
const report = { schemaVersion: 1, checkedAt: new Date().toISOString(), results };
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
for (const r of results) console.log(`${r.status}: ${r.target} (${r.reason})${r.detail ? ` — ${r.detail}` : ''}`);
process.exitCode = resultExitCode(results);
