/* 리뷰 기록의 위생 검사.
 *
 * 왜 있나 — `reviews/INDEX.md` 는 **새 세션이 매번 읽는 파일**이다. 여기에 과정 기록이
 * 쌓이면 앞으로의 모든 작업이 시작 전에 그 값을 낸다. 줄지 않고 늘기만 한다.
 * 그래서 INDEX 는 '지금 열린 것 + 최근 몇 개' 로 묶고, 지난 과정은 핸드오프 파일과
 * git 에 맡긴다(파일은 지우지 않으므로 잃는 것이 없다).
 *
 * ⚠️ **줄여도 안전하려면 남은 한 곳이 정확해야 한다.** 열린 이슈 표가 실제 이슈 파일과
 * 갈라지면, 요약을 지운 것이 '잊어버린 것' 이 된다. 그 대조가 이 검사의 핵심이고
 * 상한은 덤이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEWS = path.join(ROOT, 'reviews');

export const INDEX_MAX_LINES = 120;
export const RECENT_MAX = 5;
/* README '파일 이름과 상태' 가 정하는 낱말. 여기 없는 값은 오타이거나 새 규칙인데,
   둘 다 사람이 봐야 한다 — 검사가 조용히 받아 주면 상태가 뜻을 잃는다. */
export const OPEN_STATES = new Set(['open', 'confirmed', 'in-progress']);
export const CLOSED_STATES = new Set(['resolved', 'not-reproducible', 'wont-fix', 'duplicate']);

const field = (text, name) => text.match(new RegExp(`^- ${name}:\\s*\`?([^\`\n]+?)\`?\\s*$`, 'm'))?.[1] ?? '';

export function readIssues(dir = path.join(REVIEWS, 'issues')) {
  const out = [];
  for (const month of fs.readdirSync(dir)) {
    const monthDir = path.join(dir, month);
    if (!fs.statSync(monthDir).isDirectory()) continue;
    for (const name of fs.readdirSync(monthDir).filter(f => f.endsWith('.md'))) {
      const text = fs.readFileSync(path.join(monthDir, name), 'utf8');
      /* 옛 기록은 ID 를 제목 줄에 둔 것이 있다(`# REV-2026-052 — …`). 90개를 다시 쓰게 하는
         대신 둘 다 읽는다 — 검사가 서식을 강요하면 사람이 검사를 끈다. */
      const id = field(text, 'ID') || text.match(/^#\s*(REV-\d{4}-\d+)\b/m)?.[1] || '';
      out.push({ file: `issues/${month}/${name}`, id, state: field(text, '상태') });
    }
  }
  return out;
}

/** 열린 이슈 표의 행. `| ID | 심각도 | 요약 | 파일 |` */
export function indexOpenRows(index) {
  return [...index.matchAll(/^\|\s*`(REV-\d{4}-\d+)`\s*\|[^|]*\|[^|]*\|\s*`([^`]+)`\s*\|/gm)]
    .map(m => ({ id: m[1], file: m[2] }));
}

export function indexRecentCount(index) {
  const section = index.split(/^##\s+/m).find(s => s.startsWith('최근 검토'));
  return section ? [...section.matchAll(/^\[HANDOFF-\d{4}-\d+\]/gm)].length : -1;
}

/** 순수 함수라 자기검사가 같은 경로를 고장 낸 입력으로 다시 부를 수 있다. */
export function violations(index, issues) {
  const bad = [];
  for (const it of issues) {
    if (!/^REV-\d{4}-\d+$/.test(it.id)) bad.push(`이슈 ID 를 읽지 못했습니다: ${it.file}`);
    else if (!OPEN_STATES.has(it.state) && !CLOSED_STATES.has(it.state))
      bad.push(`정해지지 않은 상태 \`${it.state}\` — ${it.file} (reviews/README.md 의 낱말만 씁니다)`);
  }

  const listed = new Map(indexOpenRows(index).map(r => [r.id, r.file]));
  const actuallyOpen = new Map(issues.filter(i => OPEN_STATES.has(i.state)).map(i => [i.id, i.file]));
  for (const [id, file] of actuallyOpen)
    if (!listed.has(id)) bad.push(`열린 이슈인데 INDEX 표에 없습니다: ${id} (${file})`);
  for (const [id, file] of listed) {
    if (!actuallyOpen.has(id)) bad.push(`INDEX 표에 있는데 열려 있지 않습니다: ${id}`);
    else if (actuallyOpen.get(id) !== file) bad.push(`INDEX 표의 파일 경로가 다릅니다: ${id} → ${file}`);
  }

  const lines = index.split('\n').length;
  if (lines > INDEX_MAX_LINES)
    bad.push(`INDEX.md 가 ${lines}줄입니다 (상한 ${INDEX_MAX_LINES}) — 지난 과정 요약은 핸드오프 파일에 맡깁니다`);

  const recent = indexRecentCount(index);
  if (recent < 0) bad.push('INDEX.md 에 `## 최근 검토` 절이 없습니다');
  else if (recent > RECENT_MAX)
    bad.push(`최근 검토가 ${recent}개입니다 (상한 ${RECENT_MAX}) — 오래된 줄은 지웁니다. 파일은 그대로 남습니다`);

  return bad;
}

/* ── 자기검사 — 통과만 하는 검사는 없느니만 못하다 ────────────────────────── */
function selfCheck(index, issues) {
  const clone = () => issues.map(i => ({ ...i }));
  const breaks = [
    ['열린 이슈를 표에서 지운다', () => [index.replace(/^\|\s*`REV-\d{4}-\d+`.*$/m, ''), clone()]],
    ['닫힌 이슈를 표에 넣는다', () => {
      const j = clone(); const closed = j.find(i => CLOSED_STATES.has(i.state));
      return [index.replace(/^(## 열린 이슈[\s\S]*?\n\|[^\n]*\n\|[^\n]*\n)/m,
        `$1| \`${closed.id}\` | \`P2\` | 없는 줄 | \`${closed.file}\` |\n`), j];
    }],
    ['표의 파일 경로를 틀리게 적는다', () => [index.replace(/(\|\s*`)issues\/([^`]+)(`\s*\|)/m, '$1issues/없는곳/x.md$3'), clone()]],
    ['모르는 상태 낱말을 쓴다', () => { const j = clone(); j[0].state = 'fixed'; return [index, j]; }],
    ['INDEX 를 상한 너머로 늘린다', () => [index + '\n줄'.repeat(INDEX_MAX_LINES), clone()]],
    ['최근 검토를 상한 너머로 늘린다', () => [
      index.replace(/^(## 최근 검토\n)/m, '$1' + '[HANDOFF-2026-999](x.md): 늘린 줄\n\n'.repeat(RECENT_MAX + 1)), clone()]],
  ];
  let red = 0;
  for (const [name, mutate] of breaks) {
    const [i2, s2] = mutate();
    if (violations(i2, s2).length) red++;
    else console.error(`  ❌ 자기검사 실패 — 고장을 심어도 통과합니다: ${name}`);
  }
  return { red, total: breaks.length };
}

const index = fs.readFileSync(path.join(REVIEWS, 'INDEX.md'), 'utf8');
const issues = readIssues();
const bad = violations(index, issues);
const self = selfCheck(index, issues);

for (const line of bad) console.error('  ❌ ' + line);
if (self.red !== self.total) console.error('  ❌ 자기검사가 통과했습니다 — 검사가 헛돕니다');
if (bad.length || self.red !== self.total) process.exit(1);

const open = issues.filter(i => OPEN_STATES.has(i.state)).length;
console.log(`리뷰 기록 위생 통과 — 이슈 ${issues.length}건(열림 ${open}) · `
  + `INDEX ${index.split('\n').length}/${INDEX_MAX_LINES}줄 · 최근 검토 ${indexRecentCount(index)}/${RECENT_MAX}`
  + ` · 자기검사 ${self.red}/${self.total}`);
