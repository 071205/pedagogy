#!/usr/bin/env node
/* `git add -A` 처럼 **전부 담는** 명령을 쓰려 하면 이 작업 폴더의 사정을 알린다
 * (PreToolUse · Bash).
 *
 * 이유는 추측이 아니라 실제로 겪은 것이다 —
 *   · 이 폴더에는 **갈래 둘의 변경이 섞여 있을 수 있다**(구현자 + 검토자 코덱스).
 *     2026-09-19 에 실제로 `worker/index.js` 한 파일에 두 갈래가 함께 있었다.
 *   · 추적하지 않는 `transcript.txt` 가 딸려 들어간다(`HANDOFF-2026-134`).
 *   · Google Drive 가 `.git` 안에 꽂는 `Icon\r` 도 같이 담길 수 있다(`REV-2026-074`).
 *
 * ⚠️ **막지 않는다. 알릴 뿐이다.** 정말 전부 담아야 하는 때도 있다 — 판단은 사람이 한다.
 * ⚠️ **어떤 경우에도 exit 0 이다.**
 * ⚠️ **heredoc 본문은 보지 않는다.** 커밋 메시지에 `git add -A` 라고 적었다고 경고하면
 *    양치기 소년이 된다 — 이 저장소는 커밋 메시지를 heredoc 으로 쓴다.
 *
 *   node .claude/hooks/git-add-guard.mjs --selftest
 */
import { readFileSync } from "node:fs";

/** heredoc 본문을 걷어낸다. `<<EOF` · `<<'EOF'` · `<<-"EOF"` 를 모두 받는다. */
function stripHeredocs(command) {
  const open = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;
  let out = command;
  let m;
  while ((m = open.exec(command)) !== null) {
    const tag = m[2];
    const bodyStart = command.indexOf("\n", m.index);
    if (bodyStart === -1) continue;
    const end = command.indexOf(`\n${tag}`, bodyStart);
    const body = command.slice(bodyStart, end === -1 ? command.length : end);
    out = out.replace(body, "\n");
  }
  return out;
}

/** 담는 범위가 '전부' 인 명령인가. 반환값은 사람이 읽을 이름이거나 null. */
export function sweeping(commandRaw) {
  const command = stripHeredocs(String(commandRaw || ""));
  // `git add` 뒤에 -A / --all / . / :/ 가 오는 경우
  if (/\bgit\s+add\s+(-A\b|--all\b|\.(\s|$)|:\/)/.test(command)) return "git add -A / . (추적 안 하는 것까지 담는다)";
  // `git commit -a` (메시지 플래그와 붙은 -am 포함)
  if (/\bgit\s+commit\s+(-[a-zA-Z]*a[a-zA-Z]*\b|--all\b)/.test(command)) return "git commit -a (바뀐 것을 전부 담는다)";
  return null;
}

if (process.argv.includes("--selftest")) {
  const cases = [
    ["git add -A", true],
    ["git add .", true],
    ["git add --all", true],
    ["git commit -am 'x'", true],
    ["git commit --all", true],
    ["git add CLAUDE.md worker/index.js", false],
    ["git add -p", false],
    ["git commit -m 'x'", false],
    // ⚠️ heredoc 본문 안의 글자에는 반응하지 않는다 — 이 저장소의 커밋 방식이다
    ["git commit -F - <<'EOF'\ndocs: 예전에는 git add -A 를 썼다\nEOF", false],
    ["git add a.js && git commit -F - <<'MSG'\ngit commit -a 주의\nMSG", false],
  ];
  let bad = 0;
  for (const [cmd, want] of cases) {
    const got = sweeping(cmd) !== null;
    if (got !== want) { bad++; console.error(`  ❌ ${JSON.stringify(cmd)} → ${got}, 기대 ${want}`); }
  }
  if (bad) { console.error(`자기검사 실패 ${bad}건`); process.exit(1); }
  console.log(`git add 가드 자기검사 통과 — ${cases.length}건`);
  process.exit(0);
}

let input = "";
try { input = readFileSync(0, "utf8"); } catch { process.exit(0); }

let command = "";
try { command = JSON.parse(input)?.tool_input?.command || ""; } catch { process.exit(0); }

const what = sweeping(command);
if (!what) process.exit(0);

console.log([
  `⚠️ ${what}`,
  "   이 작업 폴더에는 갈래 둘의 변경이 섞여 있을 수 있고, transcript.txt 는 커밋하지 않습니다.",
  "   담을 파일을 이름으로 고르는 편이 안전합니다 — git status -s 로 먼저 확인하세요.",
].join("\n"));
process.exit(0);
