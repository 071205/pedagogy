/* 외부 검토용 사본을 만든다 — 코드만 남기고 해설을 걷어낸다.
 *
 * 왜 — 이 저장소는 "왜 이렇게 했는가" 를 코드 옆에 아주 많이 적어 둔다. 그 설명은
 * 우리에게는 자산이지만, **바깥 검토자에게는 결론을 먼저 알려 주는 것**이라 스스로
 * 판단할 기회를 뺏는다. 주석이 "이건 이런 이유로 안전하다" 고 말하면 검토자는 거기서
 * 멈춘다. 그래서 코드만 남긴 사본을 따로 만든다.
 *
 * ⚠️ **정규식으로 주석을 지우면 안 된다.** 문자열 안의 `//`, 정규식 리터럴 안의 별표,
 * 템플릿 문자열 안의 아무것이나 전부 주석처럼 보인다. 여기서는 문자열·템플릿·정규식
 * 리터럴을 아는 훑개를 쓰고, 파이썬은 **인터프리터 자신의** tokenize·ast 를 쓴다.
 * 그리고 만든 다음 문법 검사와 **실제 브라우저 부팅**으로 안 깨졌는지 확인한다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'review-copy');

/* 제품이 돌아가는 데 필요한 것만. 검사·설계 문서·리뷰 기록은 일부러 뺀다.
   ⚠️ 목록을 glob 으로 바꾸지 말 것 — 새로 생긴 메모가 조용히 섞여 들어간다. */
export const PROGRAM_FILES = Object.freeze([
  'index.html', 'mock-exam-editor.html', 'document-editor.html', 'legal.html',
  'service-config.js', 'pedagogy-normalize.js', 'pedagogy-render.js', 'pedagogy-print.js',
  'pedagogy-ai-image.js', 'mock-library-store.js',
  'hwpx-engine.js', 'hwpx-document.js', 'hwpx-exam.js', 'hwpx-exam-template.js',
  'exam-template-data.js',
  'serve.py', 'firestore.rules', 'storage.rules', 'firebase.json', 'storage-cors.json',
  'LICENSE',
  'worker/index.js', 'worker/auth.js', 'worker/app-check.js', 'worker/wrangler.toml',
  'experiments/hwp-export/pedagogy_hwpx.py', 'experiments/hwp-export/tex_to_hwp.py',
  'experiments/hwp-export/mock_to_hwpx.py', 'experiments/hwp-export/document_to_hwpx.py',
  'experiments/hwp-export/document_schema.py', 'experiments/hwp-export/template.py',
  'experiments/hwp-export/exam_profile.py', 'experiments/hwp-export/exam_style.py',
  'experiments/hwp-export/requirements.txt',
  'experiments/hwp-export/templates/blank.hwpx',
  'experiments/hwp-export/templates/exam-math.hwpx',
]);

/* CLI 도움말로 인쇄되는 docstring 은 남긴다 — 지우면 `--help` 가 빈다. */
const KEEP_MODULE_DOC = new Set(['experiments/hwp-export/mock_to_hwpx.py']);

const NOTICE = '본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.';
const KEEP_RE = /Copyright|SPDX|@license/;
const hasNotice = (text) => text.includes('한글과컴퓨터');

/* ── JavaScript ─────────────────────────────────────────────────────────────
   문자열·템플릿(중첩 표현식 포함)·정규식 리터럴을 건너뛰며 주석만 지운다. */
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'case', 'do', 'else', 'yield', 'await', 'throw']);

export function stripJs(src, collect) {
  let out = '', i = 0, prev = '', prevWord = '';
  const n = src.length, stack = [];
  const blankBefore = (pos) => {
    for (let j = pos - 1; j >= 0 && src[j] !== '\n'; j--) if (!/\s/.test(src[j])) return false;
    return true;
  };
  const blankAfter = (pos) => {
    for (let j = pos; j < n && src[j] !== '\n'; j++) if (!/\s/.test(src[j])) return false;
    return true;
  };

  while (i < n) {
    const c = src[i], d = src[i + 1];

    /* ⚠️ 템플릿 안인지를 **무엇보다 먼저** 본다. 주석 검사를 앞에 두면 템플릿 안의
       주소(`https://...`)가 주석으로 지워져 문자열이 줄 끝에서 끊긴다 — 실제로 그랬다.
       여는 백틱 검사보다도 앞이어야 닫는 백틱이 또 여는 것으로 읽히지 않는다. */
    if (stack.at(-1) === 'template') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === '$' && d === '{') { stack.push('expr'); out += '${'; i += 2; prev = '{'; continue; }
      out += c; i++;
      if (c === '`') { stack.pop(); collect?.push('`'); } else collect?.push(c);
      continue;
    }

    if (c === '/' && (d === '/' || d === '*')) {
      let end;
      if (d === '/') { end = src.indexOf('\n', i); if (end < 0) end = n; }
      else { const close = src.indexOf('*/', i + 2); end = close < 0 ? n : close + 2; }
      const text = src.slice(i, end);
      if (hasNotice(text)) { out += '/* ' + NOTICE + ' */'; i = end; prev = '/'; continue; }
      if (KEEP_RE.test(text)) { out += text; i = end; prev = '/'; continue; }
      const ownLine = blankBefore(i) && (d === '/' || blankAfter(end));
      out = out.replace(/[ \t]+$/, '');
      i = end;
      if (ownLine) { if (src[i] === '\n') i++; }
      else if (d === '*') out += ' ';
      continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      collect?.push(src.slice(i, j + 1)); out += src.slice(i, j + 1); i = j + 1; prev = c; prevWord = ''; continue;
    }

    if (c === '`') { stack.push('template'); out += c; i++; prev = c; prevWord = ''; continue; }
    if (c === '{') { stack.push('brace'); out += c; i++; prev = c; prevWord = ''; continue; }
    if (c === '}') { stack.pop(); out += c; i++; prev = c; prevWord = ''; continue; }

    if (c === '/') {
      // `/` 가 나눗셈인지 정규식인지는 **앞의 토큰**이 가른다.
      const division = /[\w$)\]]/.test(prev) && !REGEX_KEYWORDS.has(prevWord);
      if (!division) {
        let j = i + 1, klass = false;
        while (j < n) {
          const ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '[') klass = true;
          else if (ch === ']') klass = false;
          else if (ch === '/' && !klass) break;
          else if (ch === '\n') break;
          j++;
        }
        while (j + 1 < n && /[a-z]/.test(src[j + 1])) j++;   // 플래그
        collect?.push(src.slice(i, j + 1)); out += src.slice(i, j + 1); i = j + 1; prev = '/'; prevWord = ''; continue;
      }
    }

    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      prevWord = src.slice(i, j); out += prevWord; prev = prevWord.at(-1); i = j; continue;
    }
    out += c; i++;
    if (!/\s/.test(c)) { prev = c; prevWord = ''; }
  }
  return collapse(out);
}

export function stripCss(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      const end = close < 0 ? n : close + 2;
      const text = src.slice(i, end);
      if (hasNotice(text) || KEEP_RE.test(text)) { out += text; i = end; continue; }
      const ownLine = /(^|\n)[ \t]*$/.test(out) && /^[ \t]*(\n|$)/.test(src.slice(end));
      out = out.replace(/[ \t]+$/, '');
      i = end;
      if (ownLine && src[i] === '\n') i++;
      continue;
    }
    out += c; i++;
  }
  return collapse(out);
}

/* HTML 주석은 밖에서만 지운다. script·style 안의 여는 주석 기호는 내용이지 주석이 아니다. */
export function stripHtml(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const open = /<(script|style)\b([^>]*)>/i.exec(src.slice(i));
    const at = open ? i + open.index : n;
    out += stripHtmlComments(src.slice(i, at));
    if (!open) break;
    const tag = open[1].toLowerCase();
    const bodyStart = at + open[0].length;
    const closeIdx = src.toLowerCase().indexOf('</' + tag, bodyStart);
    const bodyEnd = closeIdx < 0 ? n : closeIdx;
    const body = src.slice(bodyStart, bodyEnd);
    const inline = !/\bsrc\s*=/i.test(open[2]);
    out += open[0] + (inline ? (tag === 'style' ? stripCss(body) : stripJs(body)) : body);
    i = bodyEnd;
  }
  return out;
}

function stripHtmlComments(chunk) {
  let out = '', i = 0;
  const n = chunk.length;
  while (i < n) {
    const start = chunk.indexOf('<!--', i);
    if (start < 0) { out += chunk.slice(i); break; }
    const close = chunk.indexOf('-->', start + 4);
    const stop = close < 0 ? n : close + 3;
    const text = chunk.slice(start + 4, close < 0 ? n : close);
    out += chunk.slice(i, start);
    if (hasNotice(text)) { out += '<!-- ' + NOTICE + ' -->'; i = stop; continue; }
    if (KEEP_RE.test(text)) { out += chunk.slice(start, stop); i = stop; continue; }
    const ownLine = /(^|\n)[ \t]*$/.test(out) && /^[ \t]*(\n|$)/.test(chunk.slice(stop));
    out = out.replace(/[ \t]+$/, '');
    i = stop;
    if (ownLine && chunk[i] === '\n') i++;
  }
  return collapse(out);
}

/** 빈 줄이 셋 이상 이어지면 줄인다 — 주석을 들어내고 남은 구멍. */
function collapse(text) {
  return text.replace(/[ \t]+$/gm, '').replace(/\n{4,}/g, '\n\n\n');
}

export function stripFile(rel, bytes) {
  if (/\.html$/.test(rel)) return Buffer.from(stripHtml(bytes.toString('utf8')));
  if (/\.(js|mjs|rules)$/.test(rel)) return Buffer.from(stripJs(bytes.toString('utf8')));
  if (/\.py$/.test(rel)) {
    const args = KEEP_MODULE_DOC.has(rel) ? ['--keep-module-doc'] : [];
    return Buffer.from(execFileSync('python3',
      [path.join(ROOT, 'scripts/strip-comments.py'), ...args],
      { input: bytes, maxBuffer: 32 * 1024 * 1024 }));
  }
  if (/\.toml$/.test(rel)) {
    return Buffer.from(collapse(bytes.toString('utf8').split('\n')
      .filter((line) => !/^\s*#/.test(line) || hasNotice(line))
      .join('\n')));
  }
  return bytes;   // LICENSE · JSON · .hwpx · requirements.txt 는 그대로
}

const READ_ME = `# PEDAGOGY — 검토용 사본

이 폴더는 **읽기 전용 사본**이다. 원본은 상위 폴더이며 이 사본은
\`node scripts/build-review-copy.mjs\` 가 매번 새로 만든다 — **여기서 고친 것은 사라진다.**

설계 의도를 적은 주석과 설계 문서·리뷰 기록을 걷어내고 실행되는 코드만 남겼다.
코드가 스스로 무엇을 말하는지 보려는 것이므로 판단의 근거는 코드에서 찾으면 된다.

법적 고지(한컴 규격서 출처)는 규격서의 저작권 조항이 소스에 요구하므로 남아 있다.

## 무엇이 들어 있나

| | |
| --- | --- |
| \`index.html\` | 문제집 편집기(본체). 라이브러리·블록 편집·인쇄·클라우드 동기화 |
| \`mock-exam-editor.html\` | 모의고사 편집기. 본체가 iframe 으로 띄운다 |
| \`document-editor.html\` | 범용 문서 조판(베타) |
| \`pedagogy-*.js\` | 정규화(신뢰 경계) · 렌더 · 인쇄 |
| \`mock-library-store.js\` | 모의고사 저장 계층 |
| \`hwpx-*.js\` · \`experiments/hwp-export/*.py\` | 한글(HWPX) 조판기 — 브라우저판과 파이썬판 |
| \`worker/\` | Cloudflare Worker(AI 프록시 · 인증 · 사용량 한도 · App Check) |
| \`serve.py\` | 로컬 개발 서버(Typst 미리보기 · HWPX 대비 경로) |
| \`*.rules\` | Firestore · Storage 보안 규칙 |

빌드 단계가 없다. \`.html\` 을 그대로 열면 돈다.

## 들어 있지 않은 것

검사·회귀 스위트, 설계 문서, 리뷰 기록. 코드 자체를 보게 하려는 의도이며
검토에 필요하면 원본 저장소에 있다.
`;

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const report = [];
  for (const rel of PROGRAM_FILES) {
    const source = path.join(ROOT, rel);
    if (!fs.existsSync(source)) throw new Error('사본에 넣을 파일이 없습니다: ' + rel);
    const before = fs.readFileSync(source);
    const after = stripFile(rel, before);
    const target = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, after);
    const binary = /\.hwpx$/.test(rel);
    const lines = (b) => (binary ? 0 : b.toString('utf8').split('\n').length);
    report.push({ rel, before: lines(before), after: lines(after) });
  }
  fs.writeFileSync(path.join(OUT, 'README.md'), READ_ME);
  return report;
}

/* ⚠️ 문법 검사만으로는 모자라다 — **문자열이 상해도 문법은 멀쩡할 수 있다.**
   템플릿 안의 주소(`https://...`)가 주석으로 지워지는 것이 그 모양이었다. 그래서 원본과
   사본에서 문자열·정규식 리터럴을 같은 훑개로 뽑아 **하나도 다르지 않은지** 본다.
   주석을 지우는 일은 리터럴을 건드릴 이유가 없으므로, 다르면 그 자리가 사고다. */
function literals(source) { const out = []; stripJs(source, out); return out; }

function literalDiff(before, after) {
  const a = literals(before), b = literals(after);
  if (a.length !== b.length) return `리터럴 개수가 ${a.length} → ${b.length} 로 바뀌었습니다`;
  for (let k = 0; k < a.length; k++)
    if (a[k] !== b[k]) return `리터럴이 바뀌었습니다: ${JSON.stringify(a[k]).slice(0, 60)} → ${JSON.stringify(b[k]).slice(0, 60)}`;
  return '';
}

/** `.html` 은 인라인 스크립트만 모아 견준다 — 태그·본문은 훑개의 대상이 아니다. */
function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((m) => !/\bsrc\s*=/i.test(m[1])).map((m) => m[2]).join('\n;\n');
}

/* ── 검증 — 지운 뒤에도 같은 프로그램인가 ──────────────────────────────────── */
function verify(report) {
  const problems = [];
  for (const { rel } of report) {
    const file = path.join(OUT, rel);
    try {
      if (/\.(js|mjs)$/.test(rel)) execFileSync('node', ['--check', file], { stdio: 'pipe' });
      if (/\.py$/.test(rel)) execFileSync('python3', ['-m', 'py_compile', file], { stdio: 'pipe' });
      if (/\.json$/.test(rel)) JSON.parse(fs.readFileSync(file, 'utf8'));
      if (/\.(js|mjs|rules|html)$/.test(rel)) {
        const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const copy = fs.readFileSync(file, 'utf8');
        const changed = /\.html$/.test(rel)
          ? literalDiff(inlineScripts(source), inlineScripts(copy))
          : literalDiff(source, copy);
        if (changed) problems.push(rel + ': ' + changed);
      }
    } catch (e) {
      problems.push(rel + ': ' + errorLine(e));
    }
  }
  /* ⚠️ `.html` 안 인라인 스크립트는 파일로 꺼내야 `node --check` 가 볼 수 있다.
     여기까지가 문법이고, 문자열이 상했는지는 브라우저 부팅 검사가 본다. */
  for (const rel of PROGRAM_FILES.filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(OUT, rel), 'utf8');
    let index = 0;
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/i.test(m[1])) continue;
      const tmp = path.join(OUT, '.check-' + (index++) + '.js');
      fs.writeFileSync(tmp, m[2]);
      try { execFileSync('node', ['--check', tmp], { stdio: 'pipe' }); }
      catch (e) { problems.push(rel + ' 인라인 스크립트 ' + index + ': ' + errorLine(e)); }
      fs.rmSync(tmp);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURLSafe(process.argv[1])) {
  const report = build();
  const problems = verify(report);
  for (const p of problems) console.error('  ❌ ' + p);
  if (problems.length) process.exit(1);
  const before = report.reduce((a, r) => a + r.before, 0);
  const after = report.reduce((a, r) => a + r.after, 0);
  console.log('검토용 사본 생성 — 파일 ' + report.length + '개 · ' + before + ' → ' + after
    + '줄 (설명 ' + (before - after) + '줄 제거) · 문법 검사 통과');
  console.log('  다음: node scripts/check-review-copy.mjs  (실제 브라우저로 세 앱을 띄운다)');
}

function errorLine(e) {
  const text = String(e.stderr || e.message || '');
  return text.split('\n').find((l) => /Error|error/.test(l))?.trim() || text.trim().split('\n')[0];
}

function pathToFileURLSafe(p) {
  try { return new URL('file://' + path.resolve(p)).href; } catch { return ''; }
}
