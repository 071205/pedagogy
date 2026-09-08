/* 시험지 만들기 — `experiments/hwp-export/mock_to_hwpx.py` 의 **방출 부분**을 옮긴 것.
 *
 * ⚠️ **편집기 로직은 옮기지 않는다.** 파이썬은 `probUnits`·`layoutOf`·`buildPages` 를
 *    베껴 안고 있는데(280줄), 브라우저에서는 **편집기의 것을 그대로 쓴다.** 그래서 이
 *    이식은 사본을 늘리는 것이 아니라 **줄인다.** 편집기가 유닛과 배치를 실어 보낸다:
 *      payload.problems[i].units / ptsAt / layoutResolved / heightMm / breakAfter
 *
 * ⚠️ 여기 있는 것은 **글자·수식·선지·문단을 HWPX 로 내는 일**뿐이다. 틀을 읽고 떠 오는
 *    것은 `hwpx-exam-template.js`, ZIP·수식 변환은 `hwpx-engine.js` 가 한다.
 *
 * ⚠️ 파이썬 쪽을 고치면 여기도 고쳐야 하고, 그 일치는 `npm run test:hwpx-exam` 이
 *    **같은 payload 를 양쪽에 넣어 결과 XML 을 대조**해 지킨다.
 */
(function (global) {
  "use strict";

  const HP = "http://www.hancom.co.kr/hwpml/2011/paragraph";

  /* 실물에서 잰 값. 번호 뒤는 **공백이 아니라 탭**이고 자릿수마다 구성이 다르다.
     ⚠️ 공백으로 두면 한 자리·두 자리 문항의 발문 시작 위치가 어긋난다. */
  const NUM_TAB_WIDTHS = { 1: [636], 2: [132, 671] };

  /* 발문 아래 별행 수식도 탭 하나로 14.11mm 에서 시작한다.
     ⚠️ **상자 안(`condeq`)에는 탭이 없다** — 같은 별행 수식이라도 쓰임이 다르다. */
  const EQ_TAB_WIDTH = 2850;

  const esc = (s) => global.PedagogyHwpx.xmlEscape(String(s == null ? "" : s));

  /* ── 실물의 조판 관례 — 수식 **앞**에는 공백 한 칸, 뒤에는 조사를 바로 붙인다.
     실물 인라인 수식 361개 중 349개(96.7%)가 앞에 공백을 둔다.
     ⚠️ 여는 괄호 뒤와 줄 첫머리에는 넣지 않는다.
     ⚠️ **정규식 하나로 하지 말 것.** `$1$,$2$` 에서 앞 수식의 닫는 `$` 와 뒤 수식의
        여는 `$` 를 짝지어 수식 안에 공백이 들어간다 — 쪼갠 뒤 이어 붙인다. */
  function spaceBeforeMath(text) {
    const parts = String(text).split(/(\$[^$\n]*\$)/);
    let out = "";
    for (const part of parts) {
      if (part.startsWith("$") && part.endsWith("$") && part.length >= 2) {
        const prev = out.slice(-1);
        if (prev && !/[\s(\[{]/.test(prev)) out += " ";
      }
      out += part;
    }
    return out;
  }

  /* `함수 $f(x)$에 대하여` → [['text','함수 '], ['eq','f(x)'], ['text','에 대하여']] */
  function splitInline(text) {
    const out = [];
    for (const chunk of spaceBeforeMath(text).split(/(\$[^$]*\$)/)) {
      if (!chunk) continue;
      if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length >= 2) {
        out.push(["eq", chunk.slice(1, -1)]);
      } else out.push(["text", chunk]);
    }
    return out;
  }

  /* `12.` + 탭 — 문항 번호 앞머리 한 조각. 탭은 `<hp:t>` **안의 요소**다. */
  function numPrefixXml(num) {
    const label = String(num);
    const widths = NUM_TAB_WIDTHS[Math.min(label.length, 2)] || NUM_TAB_WIDTHS[2];
    const tabs = widths.map((w) => `<hp:tab width="${w}" leader="0" type="1"/>`).join("");
    return `<hp:t xmlns:hp="${HP}">${esc(label)}.${tabs}</hp:t>`;
  }

  const eqTabXml = () =>
    `<hp:t xmlns:hp="${HP}"><hp:tab width="${EQ_TAB_WIDTH}" leader="0" type="1"/></hp:t>`;

  /* ── 문항 배치 ────────────────────────────────────────────────────────────
   * ⚠️ **이것은 편집기 `buildPages()` 의 규칙이다.** 여기서 다르게 나누면 화면
   *    미리보기와 실제 시험지가 어긋난다. 파이썬도 같은 규칙을 안고 있고
   *    `npm run test:hwpx-exam` 이 셋이 아니라 **둘(파이썬↔JS)** 을 견준다.
   * ⚠️ 편집기의 `SPEC.perCol` 이 바뀌면 이 값도 함께 고쳐야 한다.
   */
  const PER_COL = 2;

  /* 단 높이(mm) — 편집기 Typst 정본의 `BOT - ruleY - 4.5mm` 와 같은 값이다.
     ⚠️ 편집기의 `RULE1`·`RULEN`·`BOT` 이 바뀌면 여기도 함께 고쳐야 한다. */
  const COL_H_FIRST_MM = 295.43;
  const COL_H_NEXT_MM = 319.90;

  /** 새 단에서 시작해야 하는 문항의 인덱스. */
  function columnStarts(problems) {
    const starts = new Set();
    let count = 0;
    problems.forEach((p, i) => {
      if (count === 0 && i > 0) starts.add(i);
      count += 1;
      const nxt = problems[i + 1];
      if (count >= PER_COL || p.breakAfter || (nxt && nxt.sect !== p.sect)) count = 0;
    });
    return starts;
  }

  /** 새 쪽에서 시작해야 하는 문항의 인덱스(첫 쪽은 뺀다).
      **한 쪽은 두 단**이므로 단 시작을 두 번 셀 때마다 새 쪽이다.
      ⚠️ 쪽나눔을 안 내보내고 한글에 맡기면 쪽 경계가 편집기와 어긋나고,
         무엇보다 **이어지는 쪽 머리말을 붙일 자리를 알 수 없다**. */
  function pageStarts(problems) {
    const cols = [0, ...[...columnStarts(problems)].sort((a, b) => a - b)];
    return new Set(cols.filter((c, n) => n && n % 2 === 0));
  }

  /** 단마다 어떤 문항 인덱스가 들어가는지. `columnStarts()` 와 같은 규칙이다. */
  function columnSlots(problems) {
    const starts = columnStarts(problems);
    const cols = [];
    for (let i = 0; i < problems.length; i++) {
      if (i === 0 || starts.has(i)) cols.push([]);
      cols[cols.length - 1].push(i);
    }
    return cols;
  }

  /** 단 안에서 `index` 번째 문항이 **시작해야 하는 자리**(단 위 기준 mm).
      '앞 문항 아래로 몇 칸' 이 아니라 **'몇 번째 줄에서 시작한다'** 로 잡는다 —
      앞 문항 길이는 매번 달라 상대값이면 오차가 쌓이고, 실물이 그렇게 돼 있지 않다.
      ⚠️ **`topMm` 을 빼지 않으면 그만큼 아래로 내려간다**(실측 20mm). */
  function slotTopMm(index, count, colHMm, topMm) {
    return topMm + (colHMm - topMm) * index / Math.max(1, count);
  }

  /** 지금 자리에서 목표 자리까지 채울 빈 문단 수.
      ⚠️ 문항 높이는 **편집기가 실제로 재서 보낸 값**이다. 값이 없으면 **벌리지
         않는다** — 어림으로 넣으면 배치가 통째로 어긋나 없는 것보다 나쁘다.
      ⚠️ **반올림한다.** 내림으로 자르면 빈 문단 한 개(10.75mm)까지 잃는다.
      ⚠️ `problem()` 이 문항마다 빈 문단을 **이미 하나** 붙인다 — 여기서 빼지 않으면
         칸마다 한 줄씩 넉넉해진다. */
  function padLines(nowMm, targetMm, lineMm) {
    if (!lineMm || lineMm <= 0) return 0;
    return Math.max(0, Math.round((targetMm - nowMm) / lineMm) - 1);
  }

  /* 한 시험지를 만드는 동안의 상태. 파이썬의 모듈 전역(STYLE·CUR·rep)에 해당한다.
     ⚠️ 모듈 전역으로 두지 않는다 — 브라우저에서는 두 번 눌러 겹칠 수 있다. */
  class ExamWriter {
    constructor(doc, roles) {
      this.doc = doc;
      this.roles = roles;
      this.sec = 0;                      // 지금 쓰는 구역(0 공통 · 1 선택)
      /* ⚠️ 파이썬 `Report` 와 **같은 칸**을 둔다. 한쪽에만 있는 칸은 대조에서 빠져
         조용히 갈라진다 — `check-hwpx-exam.mjs` 가 이 객체를 통째로 견준다. */
      this.report = { problems: 0, equations: 0, figures: 0, breaks: 0, pages: 0,
                      padded: 0, choice_rows: 0, tags: 0, notes: 0, warnings: [] };
      /* `captureMarks()` 가 본문을 비우기 전에 떠 둔 실물 표(구획 태그 · ※ 확인 사항).
         ⚠️ 이름을 `marks` 로 둔다 — `MARKS` 로 두면 선지 라벨 ①②③④⑤ 를 가린다
            (파이썬에서 실제로 그랬다). */
      this.marks = (roles && roles._marks) || {};
      this.objId = 0;                    // 표를 심을 때마다 새로 매기는 개체 id
      /* 역할 → 문단·글자·스타일 id. 파이썬 `STYLE` 과 같은 이름을 쓴다. */
      this.style = {};
      for (const [role, spec] of Object.entries(roles)) {
        if (role.startsWith("_")) continue;
        if (spec.para != null) this.style["para_" + role] = spec.para;
        if (spec.char != null) this.style["char_" + role] = spec.char;
        if (spec.style != null) this.style["style_" + role] = spec.style;
      }
      /* ⚠️ 이름 붙은 스타일에는 '문항 번호' 서식이 없다 — 발문 첫 조각에서 찾아 온다. */
      this.style.char_num = (roles.num && roles.num.char) || this.style.char_stem;
    }

    warn(msg) { this.report.warnings.push(msg); }

    /* 문단 모양 역할에 대응하는 '이름 붙은 스타일' id (있으면). */
    styleOf(para) { return this.style["style_" + para.replace(/^para_/, "")]; }

    /* 실물 수식의 기준 크기. ⚠️ 본문과 다르다(본문 11.5pt · 수식 11.0pt). */
    eqBase() { return this.roles._eq_base || 1100; }

    para(text, { para, char, withRun = true } = {}) {
      this.doc.appendParagraph(text, {
        sectionIndex: this.sec,
        paraPrId: this.style[para], styleId: this.styleOf(para || ""),
        charPrId: this.style[char], withRun,
      });
      return this.doc.paragraphCount(this.sec) - 1;
    }

    /* ── 구획 태그 · ※ 확인 사항 ─────────────────────────────────────────────
     * ⚠️ 이 둘은 문단이 아니라 **표 개체**다. 크기·테두리를 지어내지 말 것 —
     *    `captureMarks()` 가 본문을 비우기 **전에** 실물 표를 통째로 떠 두고
     *    여기서 도로 심는다. `5지선다형` 은 틀의 표제부에 이미 있다(넣으면 두 번 나온다).
     */

    /** 떠 온 표를 다시 심을 때 개체 id 를 새로 매긴다.
        ⚠️ 같은 id·zOrder 를 가진 개체가 둘이면 한글이 문서를 이상하게 읽는다.
           공통·선택 두 구역에 심으므로 그때마다 새 번호를 준다. */
    stampIds(tblXml) {
      this.objId += 1;
      const n = 90000000 + this.objId;
      const head = /^<hp:tbl\b[^>]*>/.exec(tblXml);
      if (!head) return tblXml;
      let tag = head[0]
        .replace(/\bid="\d+"/, `id="${n}"`)
        .replace(/\bzOrder="\d+"/, `zOrder="${this.objId}"`);
      return tag + tblXml.slice(head[0].length);
    }

    /** 문단의 **run 들 뒤**에 run 하나를 더한다.
        ⚠️ 그냥 붙이면 `linesegarray` 뒤로 가서 순서가 어긋난다 —
           run 이 아닌 첫 자식 **앞**에 넣는다. */
    addRun(para, charPr, bodyXml) {
      const doc = para.ownerDocument;
      const run = doc.createElementNS(HP, "hp:run");
      run.setAttribute("charPrIDRef", String(charPr == null ? "0" : charPr));
      const tmp = new DOMParser().parseFromString(
        `<w xmlns:hp="${HP}">${bodyXml}</w>`, "application/xml");
      for (const node of [...tmp.documentElement.childNodes]) run.appendChild(doc.importNode(node, true));
      let before = null;
      for (const child of [...para.childNodes]) {
        if (child.nodeType === 1 && child.localName !== "run") { before = child; break; }
      }
      para.insertBefore(run, before);
      return run;
    }

    /** `단답형` 태그 표를 심는다. `into` 가 있으면 그 문단에 이어 붙인다. */
    sectionTag(into) {
      const spec = (this.marks.tag || {}).short;
      if (!spec) return false;
      const body = this.stampIds(spec.tbl) + "<hp:t/>";   // 실물도 표 뒤에 빈 글자 조각을 둔다
      if (into == null) {
        this.doc.appendParagraph("", { sectionIndex: this.sec, paraPrId: spec.para,
                                       styleId: spec.style, charPrId: spec.char, withRun: false });
        into = this.doc.paragraphCount(this.sec) - 1;
      }
      this.addRun(this.doc.paragraphs(this.sec)[into], spec.char, body);
      this.report.tags += 1;
      return true;
    }

    /** `※ 확인 사항` 상자를 그 쪽에 매단다(쪽 기준 절대배치라 흐름은 안 건드린다).
        ⚠️ 어느 문단에 매다느냐가 '몇 쪽에 나오는가' 만 정하므로 **그 구역 마지막 쪽**의
           문단에 매단다. */
    attachNote(paraIdx, { lines, elective = "" }) {
      const spec = (this.marks.note || {})[lines];
      if (!spec) return false;
      let body = this.stampIds(spec.tbl);
      if (elective) {
        /* 실물 글을 그대로 두고 **과목 이름만** 갈아 끼운다.
           ⚠️ 글을 새로 쓰지 않는 이유: 첫 줄의 `※` 는 기호 글꼴로 찍힌 글자라
              유니코드 `※` 를 넣으면 다른 모양이 나온다.
           ⚠️ `「」` 까지 함께 찾으면 못 찾는다 — 실물은 괄호와 과목 이름이 **다른 run**
              이라 그 사이에 태그가 끼어 있다. 실제로 그래서 틀의 이름 그대로 나갔다. */
        body = body.replace(/선택과목\([^)<]*\)/g, `선택과목(${esc(elective)})`);
      }
      const paras = this.doc.paragraphs(this.sec);
      if (paraIdx >= paras.length) return false;
      this.addRun(paras[paraIdx], spec.char, body);
      this.report.notes += 1;
      return true;
    }

    /** 마지막으로 만든 문단을 '새 단에서 시작' 으로 표시한다.
        HWPX 는 문단 속성 하나로 끝난다 — 우리가 어느 단에 넣을지 계산할 필요가 없다.
        ⚠️ **쪽나눔을 준 문단에 단나눔까지 주지 말 것** — 한글이 둘 다 수행해 새 쪽의
           왼쪽 단이 통째로 빈다. */
    markColumnBreak() {
      const paras = this.doc.paragraphs(this.sec);
      if (!paras.length) return false;
      paras[paras.length - 1].setAttribute("columnBreak", "1");
      return true;
    }

    /* 문단 뒤에 글자 조각 하나를 잇는다.
       ⚠️ `appendRunXml()` 은 넘긴 XML 을 `<hp:run>` 으로 **한 번 더 감싼다.**
          `<hp:run>` 을 통째로 넘기면 run 이 중첩돼 한글이 그 문단의 뒤쪽 글자를 통째로
          그리지 않는다(수식 뒤 한글이 사라지고 선지가 뭉개졌다). `<hp:t>` 만 넘긴다. */
    textRun(idx, text, char = "char_stem") {
      this.doc.appendRunXml(`<hp:t xmlns:hp="${HP}">${esc(text)}</hp:t>`,
        { sectionIndex: this.sec, paragraphIndex: idx, charPrId: this.style[char] });
    }

    equation(idx, tex, charRole, where) {
      try {
        const script = global.PedagogyHwpx.texToHwp(tex);
        this.doc.appendEquation(script, {
          sectionIndex: this.sec, paragraphIndex: idx,
          charPrId: this.style[charRole], baseUnit: this.eqBase(),
        });
        this.report.equations++;
        return true;
      } catch (e) {
        /* 조용히 버리면 시험지에 수식이 빠진 채로 인쇄된다. 자리를 남기고 알린다. */
        this.warn(`${where}: 수식 변환 실패 — ${e.message} (${tex})`);
        this.textRun(idx, `[수식 변환 실패: ${tex}]`, charRole);
        return false;
      }
    }

    /* 글자와 인라인 수식이 섞인 문단 하나. 만든 문단 번호를 준다.
       `prefix` 는 문항 번호처럼 **본문과 다른 서식**으로 나가는 앞머리다(13.5pt). */
    rich(text, { where, para = "para_stem", char = "char_stem", prefix = "", into = null } = {}) {
      const parts = splitInline(text);
      let idx, rest;
      if (into != null) {
        /* 틀 문단(구역·단 정의를 안고 있는 첫 문단)에 이어 쓴다 — 새 문단을 만들면
           비워진 틀 문단이 빈 줄로 남아 첫 문항이 밀린다. */
        idx = into;
        if (prefix) this.doc.appendRunXml(numPrefixXml(prefix),
          { sectionIndex: this.sec, paragraphIndex: idx, charPrId: this.style.char_num });
        rest = parts;
      } else if (prefix) {
        /* ⚠️ `withRun:false` 다 — 기본값이면 빈 `<hp:t/>` run 이 번호 앞에 남는데,
           실물 문항 문단은 번호 run 으로 바로 시작한다. */
        idx = this.para("", { para, char: "char_num", withRun: false });
        this.doc.appendRunXml(numPrefixXml(prefix),
          { sectionIndex: this.sec, paragraphIndex: idx, charPrId: this.style.char_num });
        rest = parts;
      } else {
        const lead = (parts[0] && parts[0][0] === "text") ? parts[0][1] : "";
        idx = this.para(lead, { para, char });
        rest = lead ? parts.slice(1) : parts;
      }
      for (const [kind, body] of rest) {
        if (kind === "text") this.textRun(idx, body, char);
        else this.equation(idx, body, "char_stem", where);
      }
      return idx;
    }

    /* `$...$` 한 줄만 있는 유닛 — 별행 수식.
       ⚠️ 상자 안에서 `eq` 로 떨어지면 **그 줄만 상자 밖으로 나간다** — 테두리는 문단
          모양이 그리므로 다른 모양을 주면 상자가 끊긴다. */
    displayEq(tex, { where, roles = ["eq", "cont"] } = {}) {
      const body = (tex.startsWith("$") && tex.endsWith("$")) ? tex.slice(1, -1) : tex;
      const paraRole = roles.map((r) => "para_" + r).find((r) => r in this.style) || "para_cont";
      /* ⚠️ 글자 모양 '0'(문서 기본)을 고른 것으로 치지 않는다 — `21 문제다음 별행` 의
         글자 모양이 실제로 0 이라, 그대로 쓰면 본문 글자 모양을 잃는다. */
      const charId = roles.map((r) => this.style["char_" + r])
        .find((v) => v != null && String(v) !== "0")
        ?? (this.style.char_cont ?? this.style.char_stem);

      /* 발문 아래(`eq`)만 탭으로 14.11mm 에 맞춘다 — 상자 안은 탭이 없는 것이 실물이다. */
      const tabbed = paraRole === "para_eq";
      this.doc.appendParagraph("", {
        sectionIndex: this.sec, paraPrId: this.style[paraRole],
        styleId: this.styleOf(paraRole), charPrId: charId, withRun: !tabbed,
      });
      const idx = this.doc.paragraphCount(this.sec) - 1;
      if (tabbed) this.doc.appendRunXml(eqTabXml(),
        { sectionIndex: this.sec, paragraphIndex: idx, charPrId: charId });
      this.equation(idx, body, "char_stem", where);
    }

    /* 선지 배치에 해당하는 문단 역할.
       ⚠️ 배치 전체가 **한 문단 모양**을 쓴다 — 3+2 라면 두 줄이 같은 것을 써야
          넷째가 첫째 아래에 선다. 줄마다 다르게 주면 아래 줄이 엉뚱하게 벌어진다. */
    rowPara(layout) {
      const role = { "1": "para_ch1row", "2": "para_ch2row", "v": "para_ch1row" }[layout]
                 || "para_ch1row";
      if (role in this.style) return role;
      return "para_choice" in this.style ? "para_choice" : "para_cont";
    }

    /* 선지 한 줄. 항목 사이를 **탭**으로 벌린다.
       ⚠️ 공백으로 이어 붙이면 왼쪽에 몰린다(실제로 그랬다). */
    choiceRow(items, { where, layout }) {
      if (!items.length) return;
      const para = this.rowPara(layout);
      const char = "char_choice" in this.style ? "char_choice" : "char_stem";
      const MARKS = global.PedagogyHwpx.MARKS;
      let first = true, idx = -1;
      for (const [markI, body] of items) {
        const label = MARKS[markI % MARKS.length] + " ";
        if (first) {
          idx = this.rich(label + body, { where, para, char });
          first = false;
          continue;
        }
        this.doc.appendRunXml(
          `<hp:t xmlns:hp="${HP}"><hp:tab width="0" leader="0" type="1"/>${esc(label)}</hp:t>`,
          { sectionIndex: this.sec, paragraphIndex: idx, charPrId: this.style[char] });
        for (const [kind, chunk] of splitInline(body)) {
          if (kind === "text") this.textRun(idx, chunk, char);
          else this.equation(idx, chunk, char, `${where} 선지`);
        }
      }
    }

    /* 배치는 **편집기가 정해서 보낸다**(`layoutResolved`).
       ⚠️ 편집기는 KaTeX 로 실제 폭을 재지만 우리는 못 잰다 — 어림하지 말고 받은 값을 쓴다. */
    choices(unit, layout, where) {
      const used = (unit.items || []).map((c, i) => [i, String(c || "")])
        .filter(([, c]) => c.trim());
      if (!used.length) return;
      const lay = layout || "1";
      if (lay === "1") this.choiceRow(used, { where, layout: lay });
      else if (lay === "2") {
        this.choiceRow(used.slice(0, 3), { where, layout: lay });
        this.choiceRow(used.slice(3), { where, layout: lay });
      } else for (const one of used) this.choiceRow([one], { where, layout: lay });
      this.report.choice_rows += lay === "1" ? 1 : (lay === "2" ? 2 : used.length);
    }

    /* 문항 하나. 유닛은 **편집기가 만든 것**을 그대로 받는다. */
    problem(p, into) {
      const units = p.units || [];
      const ptsAt = typeof p.ptsAt === "number" ? p.ptsAt : -1;
      const num = p.num == null ? "?" : p.num;
      const where = `${num}번`;
      if (!units.some((u) => u.k !== "choices")) {
        this.para(`${num}. (발문 비어 있음)`, { para: "para_stem", char: "char_stem" });
        return;
      }
      /* ⚠️ `problems` 는 여기서 세지 않는다 — 파이썬도 `build()` 가 센다.
         양쪽에서 세면 `build()` 를 붙이는 순간 두 배가 된다(집계 대조가 잡았다). */
      let first = true;
      units.forEach((u, i) => {
        const tail = (i === ptsAt && p.pts) ? `  [${p.pts}점]` : "";
        if (u.k === "text") {
          if (first) { this.rich(u.t + tail, { where, para: "para_stem", char: "char_stem", prefix: String(num), into }); into = null; }
          /* 둘째 줄부터는 실물처럼 '이어지는 줄' 서식을 쓴다. */
          else this.rich(u.t + tail, { where, para: "para_cont", char: "char_cont" });
          first = false;
        } else if (u.k === "eq") {
          this.displayEq(u.t, { where });
        } else if (u.k === "boxed") {
          this.rich("〈" + u.t + "〉", { where, para: "para_cont", char: "char_cont" });
        } else if (u.k === "cond") {
          /* 실물은 상자를 앞뒤 여백 문단으로 감싼다 — 없으면 상자 뒤 발문이 딱 붙는다. */
          if ("para_boxtop" in this.style) this.para("", { para: "para_boxtop", char: "char_boxtop" });
          const kinds = u.kinds || u.items.map(() => "text");
          u.items.forEach((item, j) => {
            /* ⚠️ 상자 안 별행 수식은 **상자 스타일로** 내려간다 — `eq` 로 떨어지면
               그 줄만 테두리 밖으로 나간다. */
            if (kinds[j] === "eq") { this.displayEq(item, { where, roles: ["condeq", "cond"] }); return; }
            this.rich(item, { where,
              para: "para_cond" in this.style ? "para_cond" : "para_cont",
              char: "char_cond" in this.style ? "char_cond" : "char_cont" });
          });
          if ("para_boxbot" in this.style) this.para("", { para: "para_boxbot", char: "char_boxbot" });
        } else if (u.k === "ex") {
          const HGND = global.PedagogyHwpx.HGND;
          u.items.forEach((item, j) => {
            this.rich(`${HGND[j % HGND.length]}. ${item}`, { where,
              para: "para_ex" in this.style ? "para_ex" : "para_cont",
              char: "char_ex" in this.style ? "char_ex" : "char_cont" });
          });
        } else if (u.k === "choices") {
          this.choices(u, p.layoutResolved, where);
        }
        /* `fig` 는 아직 옮기지 않았다 — 그림은 편집기가 base64 로 실어 보내야 한다. */
      });
      /* 문항 사이를 한 줄 띄운다. 실물도 선지 스타일의 빈 문단으로 띄우고, 그 스타일의
         '문단 아래' 가 0 이라 이것 없이는 다음 문항이 바로 붙는다. */
      this.para("", { para: "para_choice", char: "char_choice" });
    }
  }

  global.PedagogyExam = { ExamWriter, splitInline, spaceBeforeMath, numPrefixXml, eqTabXml,
                          columnStarts, pageStarts, columnSlots, slotTopMm, padLines,
                          PER_COL, COL_H_FIRST_MM, COL_H_NEXT_MM };
})(typeof window !== "undefined" ? window : globalThis);
