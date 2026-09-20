#!/usr/bin/env node
/* Claude가 안전한 저장소 래퍼를 우회해 `codex exec`를 직접 실행하지 못하게 한다.
 * 직접 실행은 stderr/stdout 합치기와 무제한 대기로
 * 다시 이어졌다(2026-09-21 실측: 질문 1회가 282KB 로그와 약 4분을 만들었다).
 *
 * 허용 경로:
 *   1. 공식 codex-companion 런타임
 *   2. 프롬프트 파일용 저장소 fallback인 scripts/ask-codex-readonly.mjs
 *
 *   node .claude/hooks/codex-call-guard.mjs --selftest
 */
import { readFileSync } from "node:fs";

function stripHeredocs(command) {
  const lines = String(command || "").split("\n");
  const kept = [];
  let closing = null;
  for (const line of lines) {
    if (closing) {
      if (line.trim() === closing) closing = null;
      continue;
    }
    kept.push(line);
    const match = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if (match) closing = match[2];
  }
  return kept.join("\n");
}

/** 직접 실행한 codex exec 세그먼트를 반환한다. 없으면 null. */
export function rawCodexExec(commandRaw) {
  const command = stripHeredocs(commandRaw);
  const segments = command.split(/(?:&&|\|\||[;\n])/);
  const direct = /^(?:(?:env|command|nohup)\s+)*(?:(?:[A-Za-z_][A-Za-z0-9_]*=\S+)\s+)*(?:["']?[^\s"']*\/)?codex["']?\s+exec\b/;
  return segments.map((part) => part.trim()).find((part) => direct.test(part)) || null;
}

if (process.argv.includes("--selftest")) {
  const cases = [
    ["codex exec --sandbox read-only - < ask.txt", true],
    ["cd /repo && codex exec '질문' > out 2>&1", true],
    ["/opt/homebrew/bin/codex exec --sandbox read-only -", true],
    ["SC=/tmp/x && cat > $SC/q <<'TXT'\ncodex exec 는 쓰지 마라\nTXT\ncd /repo && codex exec - < $SC/q", true],
    ["codex --version", false],
    ["codex exec --help", true],
    ["rg -n 'codex exec' CLAUDE.md", false],
    ["cat <<'TXT'\ncodex exec --sandbox read-only\nTXT", false],
    ["node scripts/ask-codex-readonly.mjs --prompt q --output a", false],
    ["node \"$CLAUDE_PLUGIN_ROOT/scripts/codex-companion.mjs\" task '질문'", false],
    ["node scripts/ask-codex-readonly.mjs --prompt q --output a && codex exec '우회'", true],
  ];
  let bad = 0;
  for (const [command, expected] of cases) {
    const actual = rawCodexExec(command) !== null;
    if (actual !== expected) {
      bad += 1;
      console.error(`  ❌ ${JSON.stringify(command)} → ${actual}, 기대 ${expected}`);
    }
  }
  if (bad) {
    console.error(`Codex 호출 가드 자기검사 실패 ${bad}건`);
    process.exit(1);
  }
  console.log(`Codex 호출 가드 자기검사 통과 — ${cases.length}건`);
  process.exit(0);
}

let input = "";
try { input = readFileSync(0, "utf8"); } catch { process.exit(0); }

let command = "";
try { command = JSON.parse(input)?.tool_input?.command || ""; } catch { process.exit(0); }

const blocked = rawCodexExec(command);
if (!blocked) process.exit(0);

const reason = [
  "직접 codex exec는 이 저장소에서 금지됩니다.",
  "일반 설계·진단은 node scripts/ask-codex-readonly.mjs로 질문을 1~2개씩 나눠 foreground로 보내세요.",
  "공식 codex:codex-rescue는 관리형 상태가 필요한 고위험 최종 검토에만 foreground로 사용하세요.",
  "background에서는 중단 뒤 대기만 남은 사례가 있습니다.",
].join(" ");
console.error(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
  systemMessage: reason,
}));
process.exit(2);
