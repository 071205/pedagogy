#!/usr/bin/env node
/* 한글로 `.hwpx` 를 열어 **PDF 로 뽑는다** — 새 요소 절차 ④('눈으로 본다')의 손이 하던 일.
 *
 *   node scripts/hwp-to-pdf.mjs 결과.hwpx        # 원본 옆에 결과.pdf 를 만든다
 *
 * ⚠️ **이 단계를 건너뛰지 말 것.** 파일이 열리는 것과 제대로 그려지는 것은 다른 문제다 —
 *    조합 기호가 **열리는데 빈칸으로 인쇄되던** 결함도, 머리말을 `secPr` 에 넣으면
 *    **열리는데 아무것도 안 찍히던** 것도 이 단계에서만 드러났다.
 *
 * 맥 + 한글 + **손쉬운 사용 권한**이 필요하다(시스템 설정 → 개인정보 보호 및 보안).
 * 그래서 CI 에 걸 수 없다 — 사람이 로컬에서 돌린다.
 *
 * 겪은 함정들. 고칠 때 되돌리지 말 것:
 *  - ⚠️ 단축키(⌘P·⌘S)는 이 앱에 먹지 않는다. **메뉴를 눌러야** 한다.
 *  - ⚠️ 저장 대화상자는 시트가 아니라 **별도 창**이고, 그 안의 '저장' 은 이름으로 찾을 수
 *       없다(AX 이름이 비어 있다). **가장 오른쪽 단추**가 저장이다.
 *  - ⚠️ 같은 이름의 문서가 이미 열려 있으면 `open` 이 다시 읽지 않는다 — 먼저 닫는다.
 *  - ⚠️ 옛 PDF 를 지우고 시작한다. 안 그러면 **실패했는데 옛 결과를 보고 판정**하게 된다.
 */
import { execFileSync } from "node:child_process";
import { basename, extname, resolve, dirname } from "node:path";
import { existsSync, rmSync } from "node:fs";

const APP = "Hancom Office HWP";
const osa = (script) => execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();
const sleep = (sec) => execFileSync("sleep", [String(sec)]);

const file = resolve(process.argv[2] || "");
if (!process.argv[2] || !existsSync(file)) {
  console.error("쓰는 법: node scripts/hwp-to-pdf.mjs <파일.hwpx>");
  process.exit(1);
}
const stem = basename(file, extname(file));
const pdf = resolve(dirname(file), `${stem}.pdf`);
if (existsSync(pdf)) rmSync(pdf);

function waitFor(condition, what, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    if (osa(condition) === "true") return;
    sleep(0.5);
  }
  throw new Error(`${what} 를 기다리다 시간이 지났습니다`);
}

// 같은 이름 창이 열려 있으면 고친 파일을 보면서 옛 내용을 판정하게 된다.
osa(`tell application "System Events" to tell process "${APP}"
  repeat with w in windows
    if name of w is "${stem}.hwpx" then click button 1 of w
  end repeat
end tell`);

execFileSync("open", ["-a", APP, file]);
waitFor(`tell application "System Events" to tell process "${APP}" to return (exists window "${stem}.hwpx") as text`,
        "문서 창");

osa(`tell application "System Events" to tell process "${APP}"
  set frontmost to true
  delay 0.4
  click menu item "PDF로 저장하기..." of menu 1 of menu bar item "파일" of menu bar 1
end tell`);
waitFor(`tell application "System Events" to tell process "${APP}" to return (exists window "PDF로 저장하기") as text`,
        "PDF 대화상자");

// 이름과 폴더는 원본을 따라 이미 채워져 있다 — 가장 오른쪽 단추가 '저장' 이다.
osa(`tell application "System Events" to tell process "${APP}"
  set frontmost to true
  delay 0.5
  set g to splitter group 1 of window "PDF로 저장하기"
  set best to missing value
  set bestx to -1
  repeat with e in (every button of g)
    set p to position of e
    if (item 1 of p) > bestx then
      set bestx to (item 1 of p)
      set best to e
    end if
  end repeat
  click best
end tell`);

for (let i = 0; i < 60; i += 1) {
  if (existsSync(pdf)) { console.log(pdf); process.exit(0); }
  sleep(0.5);
}
console.error("PDF 가 생기지 않았습니다 — 대화상자가 떠 있는지 화면을 보세요");
process.exit(1);
