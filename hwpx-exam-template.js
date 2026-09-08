/* 시험지 틀 읽기 — `experiments/hwp-export/template.py` 를 브라우저로 옮긴 것.
 *
 * ⚠️ **사본은 갈라진다.** 파이썬 쪽을 고치면 여기도 고쳐야 하고, 그 일치는
 *    `npm run test:hwpx-exam` 이 **같은 틀을 양쪽에 넣어 역할 표를 대조**해 지킨다
 *    (AI 문서 쪽 `test:hwpx-browser` 와 같은 방식).
 *
 * ⚠️ 여기 있는 것은 **읽기**뿐이다. 시험지를 만드는 것은 따로 둔다.
 *
 * 왜 옮기는가: 시험지 HWPX 가 로컬 파이썬 서버를 요구해서 **윈도우 사용자와 사파리
 * 사용자가 아예 못 썼다**(`docs/CROSS-PLATFORM-DESIGN.md` §2). 틀은 이제 저장소에 있으므로
 * (`experiments/hwp-export/templates/exam-math.hwpx`) 브라우저가 fetch 로 받아 쓸 수 있다.
 */
(function (global) {
  "use strict";

  const NUM_RE = /^\s*\d{1,2}\s*\./;

  /* 문단 XML 에서 **보이는 글자**만 뽑는다. */
  function visibleText(pXml) {
    const parts = [...pXml.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g)].map((m) => m[1]);
    return parts.join("").replace(/<[^>]+>/g, "").trim();
  }

  /* ⚠️ 문단 갈래는 **글자로** 읽는다 — `①` 이 있으면 선지, `1.` 로 시작하면 발문.
     배포용 틀을 만들 때 그 표시를 채움글자로 덮으면 안 되는 이유가 이것이다. */
  function classify(text) {
    if (!text) return null;
    if (text.includes("①")) return "choice";
    if (NUM_RE.test(text)) return "stem";
    return "cont";
  }

  /* 역할 → 틀의 스타일 이름. **파이썬 `STYLE_NAMES` 와 같아야 한다.** */
  const STYLE_NAMES = {
    stem: ["01-문제"],
    choice: ["21 1행", "1행"],
    /* ⚠️ `1행`·`2행`·`3행` 은 '몇 번째 줄' 이 아니라 **선지가 몇 줄을 차지하는 배치**다.
       3+2 는 두 줄 모두 `2행` 을 쓴다 — 둘째 줄에 다른 스타일을 주면 넷째가 첫째 아래로
       오지 않고 벌어진다. */
    ch1row: ["21 1행", "1행"],
    ch2row: ["2행"],
    ch3row: ["3행"],
    cont: ["21 문제다음", "21 문제다음 별행"],
    eq: ["21 문제다음 별행", "21 문제다음"],
    cond: ["21 박스(테두리)", "02-박스"],
    condeq: ["21 박스(테두리) 별행", "21 박스(테두리)"],
    boxtop: ["21 박스위"],
    boxbot: ["21 박스아래"],
    ex: ["21 보기", "02-보기"],
    /* ⚠️ `figure`·`note` 는 여기 두지 않는다 — 실물이 쓰는 문단 모양에 **이름이 없고**,
       이름이 그럴듯한 `보기`·`확인사항-` 은 실물에서 0회 쓰인다. `rolesByUsage()` 가 찾는다. */
  };

  const dec = (bytes) => new TextDecoder("utf-8").decode(bytes);
  const paragraphsOf = (xml) =>
    [...xml.matchAll(/<hp:p\b[^>]*>[\s\S]*?<\/hp:p>/g)].map((m) => m[0]);

  function topVote(counter) {
    let best = null, bestN = 0;
    for (const [k, n] of counter) if (n > bestN) { best = k; bestN = n; }
    return best === null ? null : [best, bestN];
  }

  /* 실물 수식의 기준 크기(baseUnit, 1/100pt).
     ⚠️ 본문과 다르다 — 실물은 본문 11.5pt 에 수식 11.0pt 다. 본문 크기를 그대로 쓰면
        수식만 커 보인다. */
  function equationBase(parts) {
    for (const name of Object.keys(parts)) {
      if (!name.startsWith("Contents/section")) continue;
      const m = /<hp:equation[^>]*baseUnit="(\d+)"/.exec(dec(parts[name]));
      if (m) return Number(m[1]);
    }
    return null;
  }

  /* 이름 붙은 스타일에서 역할 → {style, para, char}. 이름이 있으면 이쪽이 정답이다. */
  function namedStyles(parts) {
    const head = dec(parts["Contents/header.xml"]);
    const byName = {};
    for (const m of head.matchAll(/<hh:style\b[^>]*\/?>/g)) {
      const tag = m[0];
      const name = /name="([^"]*)"/.exec(tag);
      const pid = /paraPrIDRef="(\d+)"/.exec(tag);
      const cid = /charPrIDRef="(\d+)"/.exec(tag);
      const sid = /id="(\d+)"/.exec(tag);
      if (name && pid && sid) {
        byName[name[1]] = { style: sid[1], para: pid[1], char: cid ? cid[1] : "0" };
      }
    }
    const out = {};
    for (const [role, candidates] of Object.entries(STYLE_NAMES)) {
      for (const nm of candidates) {
        if (nm in byName) { out[role] = { ...byName[nm], name: nm }; break; }
      }
    }
    return out;
  }

  /* 본문을 훑어 역할별로 쓰이는 문단·글자 모양을 알아낸다(이름 없는 틀 대비).
     ⚠️ '가장 많이 덮는' 은 run 개수가 아니라 **글자 수**로 재야 한다 — 문항 번호("2.")도
        run 하나라, 개수로 세면 번호 서식(13.5pt)이 본문 서식으로 뽑힌다. */
  function rolesFromBody(parts) {
    const sec = dec(parts["Contents/section0.xml"]);
    const votes = { stem: new Map(), choice: new Map(), cont: new Map() };
    const numVotes = new Map();
    const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

    for (const p of paragraphsOf(sec)) {
      const role = classify(visibleText(p));
      if (!role) continue;
      const pid = /paraPrIDRef="(\d+)"/.exec(p);
      const runs = [...p.matchAll(/<hp:run\b[^>]*charPrIDRef="(\d+)"[^>]*>([\s\S]*?)<\/hp:run>/g)];
      if (!pid || !runs.length) continue;
      const span = new Map();
      for (const [, cid, body] of runs) {
        const text = [...body.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g)]
          .map((m) => m[1]).join("").replace(/<[^>]+>/g, "");
        span.set(cid, (span.get(cid) || 0) + text.length);
      }
      if (!span.size || Math.max(...span.values()) === 0) continue;
      const dom = topVote(span)[0];
      bump(votes[role], pid[1] + " " + dom);
      if (role === "stem" && runs[0][1] !== dom) bump(numVotes, runs[0][1]);
    }

    const out = {};
    for (const [role, c] of Object.entries(votes)) {
      const top = topVote(c);
      if (!top) continue;
      const [para, char] = top[0].split(" ");
      out[role] = { para, char, count: top[1] };
    }
    const numTop = topVote(numVotes);
    if (numTop) out.num = { char: numTop[0], count: numTop[1] };
    return out;
  }

  /* 이름으로 못 찾는 것 — 실물의 **그림**은 이름 없는 문단 모양을 쓰고 `확인 사항` 도 같다.
     ⚠️ 이름으로 찾은 것을 **이쪽이 덮는다**: 이름이 그럴듯해도 실물이 안 쓰면 틀린 답이다. */
  function rolesByUsage(parts) {
    const votes = { figure: new Map(), note: new Map() };
    const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    for (const name of Object.keys(parts)) {
      if (!name.startsWith("Contents/section")) continue;
      for (const p of paragraphsOf(dec(parts[name]))) {
        const pid = /paraPrIDRef="(\d+)"/.exec(p);
        if (!pid) continue;
        let role = null;
        if (p.includes("<hp:pic")) role = "figure";
        else if (visibleText(p).includes("확인 사항")) role = "note";
        if (!role) continue;
        const chars = new Map();
        for (const m of p.matchAll(/<hp:run\b[^>]*charPrIDRef="(\d+)"/g))
          chars.set(m[1], (chars.get(m[1]) || 0) + 1);
        const top = topVote(chars);
        bump(votes[role], pid[1] + " " + (top ? top[0] : "0"));
      }
    }
    const out = {};
    for (const [role, c] of Object.entries(votes)) {
      const top = topVote(c);
      if (!top) continue;
      const [para, char] = top[0].split(" ");
      out[role] = { para, char, count: top[1] };
    }
    return out;
  }

  /* 틀 한 벌에서 역할 표를 만든다. `open_template()` 의 앞부분과 **같은 순서**여야 한다. */
  function readRoles(parts) {
    let roles = namedStyles(parts);
    if (Object.keys(roles).length) {
      const guessed = rolesFromBody(parts);
      if (guessed.num) roles.num = guessed.num;
      const base = equationBase(parts);
      if (base) roles._eq_base = base;
    }
    if (Object.keys(roles).length < 3) roles = rolesFromBody(parts);
    Object.assign(roles, rolesByUsage(parts));
    return roles;
  }


  /* ══ 틀 준비 — `template.py` 의 떠 오기·비우기·머리말 갈아 끼우기 ══════════
   *
   * ⚠️ **순서가 결과를 바꾼다.** `clearBody()` 뒤에 떠 오면 머리말도 표도 이미 지워진
   *    뒤다. `openTemplate()` 이 지키는 순서를 바꾸지 말 것.
   */

  const MM = 7200 / 25.4;                       // 1mm 가 몇 HWPUNIT 인가
  const sectionPaths = (doc) =>
    [...doc.parts.keys()].filter((p) => /^Contents\/section\d+\.xml$/.test(p)).sort();
  const sectionIndexOf = (path) => Number(/section(\d+)\.xml$/.exec(path)[1]);
  const kids = (node, name) => [...node.children].filter((c) => c.localName === name);
  const deep = (node, name) => [...node.getElementsByTagName("*")].filter((c) => c.localName === name);
  const textOf = (node) => deep(node, "t").map((n) => n.textContent || "").join("");
  const squeeze = (s) => s.replace(/\s+/g, "");

  /* 이어지는 쪽 머리말을 **본문을 비우기 전에** 떠 둔다.
     ⚠️ 실물은 쪽마다 머리말을 다시 넣지 않는다 — 2쪽 첫 문단에 한 번 두고 뒤 쪽이
        물려받는다. `clearBody()` 가 그 문단을 지우면 **2쪽부터 시험지 형식이 사라진다.**
     ⚠️ 문단마다 **첫 번째 것만** 쓴다. 여러 개를 넣으면 쪽마다 겹쳐 찍힌다. */
  function capturePageHeaders(doc) {
    const found = {};
    for (const path of sectionPaths(doc)) {
      const root = doc.part(path).xml.documentElement;
      for (const para of kids(root, "p")) {
        const runs = kids(para, "run").filter((r) => deep(r, "header").length);
        if (runs.length) { found[sectionIndexOf(path)] = runs.map((r) => r.outerHTML); break; }
      }
    }
    return found;
  }

  const TAG_NAMES = { "단답형": "short", "5지선다형": "choice" };

  /* `paras[i]` 다음 문단의 첫 줄이 놓인 자리(단 위 기준 mm). */
  function nextParaTopMm(paras, i) {
    for (const para of paras.slice(i + 1)) {
      const segs = kids(para, "linesegarray");
      if (!segs.length || !segs[0].children.length) continue;
      const v = segs[0].children[0].getAttribute("vertpos");
      return v == null ? null : Number(v) / MM;
    }
    return null;
  }

  /* 구획 태그(`단답형`)와 `※ 확인 사항` 을 떠 둔다.
     ⚠️ 이 둘은 문단이 아니라 **표 개체**다. 크기·테두리를 지어내지 않고 실물 표를
        통째로 떠서 도로 심는다.
     ⚠️ 태그 표는 **셀 안 문단이 하나인 사본**을 고른다 — 어떤 사본은 셀 안에 이어지는
        쪽 머리말을 품고 있어, 그걸 심으면 머리말이 쪽마다 겹쳐 찍힌다. */
  function captureMarks(doc) {
    const tag = {}, note = {};
    let stepMm = null;
    for (const path of sectionPaths(doc)) {
      const paras = kids(doc.part(path).xml.documentElement, "p");
      paras.forEach((para, i) => {
        for (const run of kids(para, "run")) {
          for (const tbl of kids(run, "tbl")) {
            const body = squeeze(textOf(tbl));
            const inner = deep(tbl, "p").length;
            const spec = { tbl: tbl.outerHTML,
                           para: para.getAttribute("paraPrIDRef"),
                           style: para.getAttribute("styleIDRef"),
                           char: run.getAttribute("charPrIDRef") };
            const role = TAG_NAMES[body];
            if (role) {
              if (role in tag && inner !== 1) continue;   // 머리말을 품은 사본은 버린다
              tag[role] = spec;
              if (role === "short" && inner === 1) stepMm = nextParaTopMm(paras, i) ?? stepMm;
            } else if (body.startsWith("*확인사항") || body.startsWith("※확인사항")) {
              if (!(inner in note)) note[inner] = spec;
            }
          }
        }
      });
    }
    return { tag, note, tag_step_mm: stepMm };
  }

  /* 구역마다 **단별로 첫 내용이 시작하는 자리**(mm) — 그 단의 '위 여백' 이다.
     ⚠️ 빼지 않으면 그만큼 아래로 내려간다(실물 대비 20mm 어긋난 적이 있다). */
  function readColumnTopsMm(doc) {
    const out = {};
    for (const path of sectionPaths(doc)) {
      const tops = [];
      let want = true;
      for (const para of kids(doc.part(path).xml.documentElement, "p")) {
        if (para.getAttribute("columnBreak") === "1" || para.getAttribute("pageBreak") === "1") want = true;
        if (!want) continue;
        const segs = kids(para, "linesegarray");
        if (!segs.length || !segs[0].children.length) continue;
        const v = segs[0].children[0].getAttribute("vertpos");
        tops.push(v == null ? 0 : Number(v) / MM);
        want = false;
        if (tops.length >= 4) break;
      }
      if (tops.length) out[sectionIndexOf(path)] = tops;
    }
    return out;
  }

  /* 빈 문단 **하나가 실제로 차지하는 세로 길이**(mm).
     ⚠️ **줄 높이만 세면 안 된다** — 빈 문단은 `줄 높이 + 문단 아래 여백` 만큼 차지한다.
        여백을 빼고 셌더니 빈 문단이 1.6배로 벌어져 둘째 문항이 51mm 아래로 갔다.
     ⚠️ 값을 박아 두지 않는다 — 틀을 바꾸면 함께 바뀌므로 틀에서 읽는다. */
  function readPadStepMm(doc, roles) {
    const spec = roles.cont || roles.stem || {};
    if (spec.para == null) return null;
    const head = doc.part("Contents/header.xml").xml.documentElement;
    let size = null, spacing = null, gapMm = 0;
    for (const node of head.getElementsByTagName("*")) {
      if (node.localName === "charPr" && spec.char != null &&
          node.getAttribute("id") === String(spec.char)) {
        const h = Number(node.getAttribute("height"));
        if (h) size = h;
      } else if (node.localName === "paraPr" && node.getAttribute("id") === String(spec.para)) {
        for (const c of node.getElementsByTagName("*")) {
          if (c.localName === "lineSpacing" && c.getAttribute("type") === "PERCENT") {
            const v = Number(c.getAttribute("value"));
            if (v) spacing = v;
          }
        }
        /* ⚠️ **위·아래 여백을 둘 다 더한다.** 처음에 `next` 만 읽었더니 10.75mm 가
           14.81mm 로 나왔다 — 빈 문단이 실제보다 1.4배 크게 잡혀 문항이 아래로 밀린다.
           그리고 `margin` 은 **첫 번째 것**을 쓰고 그 **직속 자식**만 센다(안쪽에 또
           다른 margin 이 있다). */
        const margin = [...node.getElementsByTagName("*")].find((c) => c.localName === "margin");
        if (margin) {
          for (const side of margin.children) {
            if (side.localName === "prev" || side.localName === "next") {
              gapMm += Number(side.getAttribute("value") || 0) / MM;
            }
          }
        }
      }
    }
    if (!size) size = 1150;                     // 실물 본문 11.5pt — 글자 모양이 0이면 여기로
    if (!spacing) return null;
    const lineMm = (size / 100) * (spacing / 100) / 72 * 25.4;
    return lineMm + gapMm;
  }

  /* 문단 0 에는 '틀' 과 '1번 문항' 이 함께 들어 있다 — 통째로 남기면 남의 문제가
     딸려 오고, 통째로 지우면 머리말이 사라진다. 그래서 run 단위로 가른다. */
  const FRAME_TAGS = new Set(["secPr", "colPr", "ctrl", "tbl", "rect", "line", "ellipse",
    "arc", "polygon", "curve", "pic", "container", "textart", "ole", "chart", "connectLine"]);

  function cleanFrameParagraph(para) {
    for (const run of [...para.children]) {
      if (run.localName === "linesegarray") { run.remove(); continue; }  // 낡은 줄 캐시
      if (run.localName !== "run") continue;
      if ([...run.children].some((c) => FRAME_TAGS.has(c.localName))) continue;
      run.remove();                              // 글자·수식만 있는 run = 실물 문항
    }
  }

  /* 본문을 비우되 **첫 문단은 남긴다** — 거기에 구역·단 정의가 들어 있다.
     ⚠️ 구역이 여럿이다(공통·선택). 하나만 비우면 남은 구역이 실물 문항을 안고 있다. */
  function clearBody(doc) {
    let removed = 0;
    for (const path of sectionPaths(doc)) {
      const paras = kids(doc.part(path).xml.documentElement, "p");
      if (!paras.length) continue;
      for (const p of paras.slice(1)) { p.remove(); removed++; }
      cleanFrameParagraph(paras[0]);
    }
    return removed;
  }

  /* 조각들을 이어 붙인 글에서 `[start, end)` 만 바꾼다.
     ⚠️ 머리말 글자는 `'확','률','과',' ','통계'` 처럼 잘게 쪼개져 있어 구간이 조각
        경계와 맞지 않는다. 새 글은 **첫 조각에만** 넣는다(모두 넣으면 반복된다). */
  function replaceSpan(texts, start, end, next) {
    let pos = 0, filled = false, changed = false;
    for (const node of texts) {
      const text = node.textContent || "";
      const a = pos, b = pos + text.length;
      pos = b;
      if (b <= start || a >= end) continue;
      const head = text.slice(0, Math.max(0, start - a));
      const tail = text.slice(Math.min(text.length, Math.max(0, end - a)));
      node.textContent = head + (filled ? "" : next) + tail;
      filled = true; changed = true;
    }
    return changed;
  }

  /* 머리말의 `2025학년도 대학수학능력시험 문제지` 를 우리 회차명으로 바꾼다.
     ⚠️ 글자가 여러 `<hp:t>` 로 쪼개져 있어 한 곳만 고치면 나머지가 남는다. */
  function setMastheadTitle(doc, title) {
    let changed = false;
    for (const path of sectionPaths(doc)) {
      const paras = kids(doc.part(path).xml.documentElement, "p");
      if (!paras.length) continue;
      const texts = deep(paras[0], "t");
      const joined = texts.map((n) => n.textContent || "").join("");
      if (!joined.includes("문제지")) continue;
      const end = joined.indexOf("문제지") + "문제지".length;
      let pos = 0, first = true;
      for (const n of texts) {
        const len = (n.textContent || "").length;
        if (pos < end) { n.textContent = first ? title : ""; first = false; }
        pos += len;
      }
      changed = true;
    }
    return changed;
  }

  const AREA_OPEN = "수학 영역(";

  /* 선택 구역 머리말의 과목 이름을 바꾼다.
     ⚠️ 한 구역에 `수학 영역(…)` 이 **하나가 아니다**(표지 + 이어지는 쪽). 첫 것만
        바꾸면 1쪽만 미적분이고 2쪽부터 틀에 박힌 확률과 통계가 인쇄된다.
     ⚠️ 돌려주는 값은 '고쳤는가' 가 아니라 **'머리말이 이제 맞는가'** 다 — 고른 과목이
        틀에 박힌 것과 같으면 고칠 것이 없는데 그걸 실패로 보고하면 헛경고가 붙는다. */
  function setMastheadElective(doc, elective) {
    let found = false;
    for (const path of sectionPaths(doc)) {
      const root = doc.part(path).xml.documentElement;
      for (let round = 0; round < 8; round++) {      // 못 고치는 자리에서 맴돌지 않게
        const texts = deep(root, "t");
        const joined = texts.map((n) => n.textContent || "").join("");
        let hit = null, at = 0;
        for (;;) {
          at = joined.indexOf(AREA_OPEN, at);
          if (at < 0) break;
          const start = at + AREA_OPEN.length;
          const close = joined.indexOf(")", start);
          if (close < 0) break;
          found = true;
          if (joined.slice(start, close) !== elective) { hit = [start, close]; break; }
          at = close + 1;
        }
        if (!hit || !replaceSpan(texts, hit[0], hit[1], elective)) break;
      }
    }
    return found;
  }

  /* 틀에 딸려 온 그림을 버린다.
     ⚠️ 파일만 지우면 `content.hpf` 의 목록에 참조가 남아 문서가 깨진 것으로 판정된다. */
  function stripBindata(doc) {
    let gone = 0;
    for (const path of [...doc.parts.keys()]) {
      if (path.startsWith("BinData/")) { doc.parts.delete(path); gone++; }
    }
    if (!gone) return 0;
    const hpf = doc.part("Contents/content.hpf").xml.documentElement;
    for (const item of [...hpf.getElementsByTagName("*")]) {
      if (item.localName === "item" && (item.getAttribute("href") || "").startsWith("BinData/")) {
        item.remove();
      }
    }
    return gone;
  }

  /* 틀을 열어 본문을 비우고 (문서, 역할표) 를 준다 — `open_template()` 과 같은 순서. */
  async function openTemplate(buffer) {
    const parts = {};
    for (const [name, bytes] of await global.PedagogyHwpx.unzip(buffer)) parts[name] = bytes;
    const roles = readRoles(parts);
    const doc = await global.PedagogyHwpx.HwpxDocument.open(buffer);
    // ⚠️ 순서가 중요하다 — 비운 뒤에 부르면 머리말도 표도 이미 없다.
    roles._page_header = capturePageHeaders(doc);
    roles._line_mm = readPadStepMm(doc, roles);
    roles._column_tops = readColumnTopsMm(doc);
    roles._marks = captureMarks(doc);
    roles._cleared = clearBody(doc);
    roles._bindata_gone = stripBindata(doc);
    return { doc, roles };
  }

  global.PedagogyExamTemplate = {
    STYLE_NAMES, classify, visibleText,
    equationBase, namedStyles, rolesFromBody, rolesByUsage, readRoles,
    capturePageHeaders, captureMarks, readColumnTopsMm, readPadStepMm,
    clearBody, stripBindata, setMastheadTitle, setMastheadElective, openTemplate,
  };
})(typeof window !== "undefined" ? window : globalThis);
