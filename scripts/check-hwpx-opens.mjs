/* 만든 .hwpx 를 **실물 한컴 한글로 실제로 열어 본다** — 베타
 *
 * 왜 이게 필요한가
 * ----------------
 * 한글은 문서에 문제가 있으면 **어디가 문제인지 말하지 않고** "파일을 읽거나 저장하는데
 * 오류가 있습니다" 라고만 한다. XML 문법이 완벽하고 우리 검증이 전부 초록불이어도
 * 한글이 거부할 수 있다. 실제로 그것 때문에 두 번 잘못 진단했다(`REV-2026-012`).
 * 규격서에도 "한글이 열어 주는가"는 적혀 있지 않다. **열어 보는 수밖에 없다.**
 *
 * 어떻게 판정하나
 * ----------------
 * 한컴 한글은 AppleScript 사전도 CLI 도 제공하지 않는다(확인함). 그래서 창 제목을
 * 읽어 판정한다 — 파일이 열리면 그 이름의 창이 생기고, 거부되면 생기지 않는다.
 *
 * ⚠️ 이 검사는 **손쉬운 사용(보조 접근) 권한**이 필요하다. 시스템 보안 설정이라
 *    사람이 직접 켜야 한다:
 *      시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용 → 터미널(또는 실행 주체) 켜기
 *    권한이 없으면 **건너뛴다고 알리고 통과**한다(종료코드 2). 다만 그때는 이 검사가
 *    아무것도 보증하지 않는다는 뜻이므로, 출력에 그렇게 적는다.
 *
 * ⚠️ 맥과 한글이 있는 환경에서만 돈다. CI 에는 걸 수 없다.
 *
 *   node scripts/check-hwpx-opens.mjs                 # 기본 표본
 *   node scripts/check-hwpx-opens.mjs a.hwpx b.hwpx   # 지정한 파일
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = "Hancom Office HWP";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SKIP = 2;

function osa(script) {
  return spawnSync("osascript", ["-e", script], { encoding: "utf8", timeout: 30_000 });
}

if (process.platform !== "darwin") {
  console.log("맥이 아니라 건너뜁니다 — 한글로 여는 검사는 맥에서만 됩니다");
  process.exit(SKIP);
}
if (!existsSync(`/Applications/${APP}.app`)) {
  console.log(`한컴 한글이 설치돼 있지 않아 건너뜁니다 (/Applications/${APP}.app)`);
  process.exit(SKIP);
}

// 보조 접근 권한이 없으면 창을 읽을 수 없다. 먼저 확인하고 사람에게 안내한다.
const probe = osa('tell application "System Events" to get name of every process');
if (probe.status !== 0) {
  console.log("보조 접근(손쉬운 사용) 권한이 없어 건너뜁니다.");
  console.log("  켜는 곳: 시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용");
  console.log("  ⚠️ 이 검사가 건너뛰면 '한글이 실제로 여는가'는 아무도 확인하지 않습니다.");
  process.exit(SKIP);
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error("열어 볼 .hwpx 파일을 인자로 주세요");
  process.exit(1);
}

/** 한글에 열려 있는 문서 창 제목들. */
function openWindows() {
  const r = osa(`tell application "System Events" to tell process "${APP}" `
    + "to get name of every window");
  return r.status === 0
    ? r.stdout.trim().split(",").map((s) => s.trim()).filter(Boolean)
    : [];
}

/* 한글이 파일을 거부하면 이 글이 뜬다. **이것이 유일하게 믿을 수 있는 실패 신호다.**
 *
 * ⚠️ 창 개수가 늘었는지로 판정하면 안 된다 — 오류 대화상자도 창으로 세어져서
 *    **거부당한 파일을 '열렸다' 고 보고한다**(실제로 그렇게 거짓 통과를 냈다).
 *    거짓 통과는 검사가 없는 것보다 나쁘다. 그래서 개수 대신 이 글을 찾는다. */
const ERROR_TEXT = "파일을 읽거나 저장하는데";

function errorDialogShowing() {
  const r = osa(`tell application "System Events" to tell process "${APP}" `
    + "to get value of every static text of every window");
  return r.status === 0 && r.stdout.includes(ERROR_TEXT);
}

function dismissError() {
  /* ⚠️ 대화상자를 **확실히** 닫아야 한다. 닫히지 않으면 그 위에 다음 오류가 쌓이고,
   *    그 뒤 파일은 전부 거짓 실패로 나온다(실제로 그렇게 결과가 오염됐다).
   *    `keystroke return` 은 이 대화상자에 먹지 않는다 — 버튼을 직접 눌러야 한다. */
  for (let i = 0; i < 5 && errorDialogShowing(); i++) {
    osa(`tell application "System Events" to tell process "${APP}" `
      + "to click button 1 of window 1");
    spawnSync("sleep", ["1"]);
  }
  return !errorDialogShowing();
}

/* ⚠️ 파일마다 한글을 껐다 켜지 말 것.
 *
 *    처음에는 판정 사이에 `quit saving no` 로 앱을 껐다. 그런데 종료가 끝나기 전에
 *    다음 파일을 열게 되고, 몇 번 반복하면 **한글이 창을 아예 못 띄우는 상태**가 된다
 *    (실제로 그렇게 만들었다 — 그 뒤로는 멀쩡한 파일도 전부 ❌ 로 나왔다).
 *    `kill -9` 로 되살리려다 상태를 더 망가뜨렸다. 사람이 한글을 다시 켜야 했다.
 *
 *    그래서 앱은 **한 번만 띄우고 끝까지 살려 둔다.** 파일을 전부 연 뒤 창 목록을
 *    한 번에 읽어 판정하고, 문서는 ⌘W 로 닫는다(앱은 그대로 둔다).
 */
function closeDocuments() {
  // 앱을 끄지 않고 열린 문서만 닫는다. 저장 여부를 묻지 않도록 변경 없는 문서만 연다.
  osa(`tell application "System Events" to tell process "${APP}" `
    + 'to keystroke "w" using {command down, option down}');
  spawnSync("sleep", ["2"]);
}

let failed = 0;
const results = [];
for (const target of targets) {
  const name = basename(target);
  spawnSync("open", ["-a", APP, target]);
  // 한글이 뜨고 문서를 읽을 때까지 기다린다. 오류 대화상자도 이 안에 뜬다.
  spawnSync("sleep", ["8"]);
  const windows = openWindows();
  // ⚠️ 맥 파일 이름은 자모 분해(NFD)라 창 제목(NFC)과 글자가 달라 보인다. 정규화해 비교한다.
  const stem = name.replace(/\.hwpx$/, "").normalize("NFC");
  const titled = windows.some((w) => w.normalize("NFC").includes(stem));
  const rejected = errorDialogShowing();
  // 오류 글이 떠 있으면 무조건 실패다. 창 제목만으로 판단하지 않는다.
  const opened = titled && !rejected;
  if (!opened) failed++;
  results.push({ name, opened, rejected, windows });
  if (rejected && !dismissError()) {
    // 못 닫으면 뒤 판정이 전부 오염된다. 여기서 멈추는 편이 거짓 결과보다 낫다.
    console.error(`  ⚠️ ${name} 뒤 오류 대화상자를 닫지 못했습니다. `
      + "남은 파일은 판정하지 않습니다 — 대화상자를 닫고 다시 실행하세요.");
    break;
  }
  closeDocuments();
}

for (const { name, opened, rejected, windows } of results) {
  console.log(`  ${opened ? "✅" : "❌"} ${name}`);
  if (rejected) console.log("      한글: \"파일을 읽거나 저장하는데 오류가 있습니다.\"");
  else if (!opened) console.log(`      열린 창: ${windows.join(" · ") || "(없음)"}`);
}
if (!results.some((r) => r.opened)) {
  // 전부 실패면 파일이 아니라 한글 쪽이 이상한 경우가 많다. 그렇게 말해 준다.
  console.error("\n⚠️ 하나도 열리지 않았습니다. 파일 문제가 아니라 한글이 이상한 상태일 수 "
    + "있습니다 — 한글을 직접 껐다 켠 뒤 다시 돌려 보세요.");
}

if (failed) {
  console.error(`한글이 열지 못한 파일 ${failed}건`);
  process.exit(1);
}
console.log(`한글에서 ${targets.length}건 모두 열립니다`);
