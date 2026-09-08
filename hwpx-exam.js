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

  const MM_TO_HWPUNIT = 7200 / 25.4;

  /** 편집기가 문서에 담아 보낸 그림(데이터 URL) → 바이트.
      ⚠️ **형식은 확장자가 아니라 바이트로 판정한다**(`imageSize` 가 겸한다).
         여기서는 데이터 URL 껍데기만 벗기고, 아니면 null 을 준다. */
  function figureBytes(value) {
    if (typeof value !== "string" || !/^data:image\/(png|jpeg);base64,/.test(value) || value.length > 4 * Math.ceil(2 * 1024 * 1024 / 3) + 23) return null;
    const at = value.indexOf(",");
    if (at < 0 || !/base64/.test(value.slice(0, at))) return null;
    try {
      const bin = atob(value.slice(at + 1));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.length && out.length <= 2 * 1024 * 1024 ? out : null;
    } catch { return null; }        // 깨진 데이터는 없는 것으로 본다
  }

  /* 파이썬 `f"{x:g}"` 와 같은 표기 — `58` 은 `58`, `57.5` 는 `57.5`. */
  const fmtMm = (n) => String(Number(n));

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

    /** 그림 한 장.
        ⚠️ **브라우저는 `src` 가 가리키는 파일을 읽을 수 없다.** 편집기의 `src` 는 서버
           `work/` 폴더 안 **파일 이름**이고(데이터가 아니다), 파일 시스템은 브라우저에
           없다. 그래서 이름이 있는 그림은 여기서 처리하지 않고 **서버 경로로 넘긴다**
           (`hasUnresolvableFigure()` 가 부르기 전에 가른다).
        ⚠️ 이름이 아예 없는 경우만 파이썬과 **같은 자리표시**를 남기고 경고한다 —
           조용히 빈자리로 두면 그림이 빠진 시험지가 인쇄된다. */
    figure(unit, where) {
      const src = String(unit.src || "").trim();
      const widthMm = Number(unit.w || 0);
      const para = "para_figure" in this.style ? "para_figure"
                 : ("para_eq" in this.style ? "para_eq" : "para_cont");

      /* ⚠️ **데이터를 먼저 본다** — 편집기가 그림을 문서에 담아 보내면 파일 시스템이
         필요 없다. 파이썬도 같은 순서라 두 경로가 같은 결과를 낸다. */
      const bytes = figureBytes(unit.data);
      if (bytes && this.placeImage(bytes, src || "figure.png", widthMm, para)) return;

      /* ⚠️ 이름만 있는 그림은 **서버만** 읽을 수 있다(브라우저에 파일 시스템이 없다).
         부르는 쪽이 `needsServer()` 로 미리 갈라 여기 오지 않는다 — 와 버렸다면 파이썬이
         파일을 못 찾았을 때와 **같은** 자리표시를 남긴다. */
      const msg = bytes ? `그림 크기를 읽지 못했습니다(PNG·JPEG 만 지원): ${src}`
                : src ? `그림 파일을 찾지 못했습니다: ${src}`
                      : `그림 파일명이 지정되지 않았습니다 (너비 ${fmtMm(widthMm)}mm)`;
      this.warn(`${where}: ${msg}`);
      this.para(`[그림 없음 — ${msg}]`, { para, char: "char_cont" });
    }

    /** 그림 한 장을 심는다. 크기를 못 읽으면 false. */
    placeImage(bytes, name, widthMm, para) {
      /* ⚠️ 엔진의 `imageSize()` 는 **객체**(`{width,height}`)를 준다 — 파이썬의
         `image_size()` 는 튜플이다. 파이썬처럼 `size[0]` 으로 읽었더니 늘 실패해
         그림이 자리표시로만 나갔다(대조가 잡았다). */
      const size = global.PedagogyHwpx.imageSize(bytes);
      if (!size || !size.width || !size.height) return false;
      name = name.replace(/\.[^.]*$/, "") + (size.png ? ".png" : ".jpg");
      const w = Math.round(widthMm * MM_TO_HWPUNIT);
      const h = Math.round(w * size.height / size.width);   // 비율 유지
      /* ⚠️ 빈 run 을 남긴다 — 파이썬 `append_paragraph("")` 이 그렇게 만든다.
         `withRun:false` 로 두면 문단 구조가 갈라진다(대조가 잡았다). */
      this.para("", { para, char: "char_cont" });
      this.doc.appendPicture(name, bytes, {
        sectionIndex: this.sec, paragraphIndex: this.doc.paragraphCount(this.sec) - 1,
        width: w, height: h, charPrId: this.style.char_cont,
      });
      this.report.figures += 1;
      return true;
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
        else if (u.k === "fig") this.figure(u, where);
      });
      /* 문항 사이를 한 줄 띄운다. 실물도 선지 스타일의 빈 문단으로 띄우고, 그 스타일의
         '문단 아래' 가 0 이라 이것 없이는 다음 문항이 바로 붙는다. */
      this.para("", { para: "para_choice", char: "char_choice" });
    }
  }

  /* ── 시험지 한 부 만들기 ──────────────────────────────────────────────────
   * 파이썬 `_build()` 에 대응한다. **틀 없는 경로는 옮기지 않는다** — 브라우저는
   * 저장소에 든 `templates/exam-math.hwpx` 를 늘 쓰고, 값만 심는 옛 경로는 CLI 몫이다.
   *
   * ⚠️ 문항의 `units`·`ptsAt`·`layoutResolved`·`heightMm` 은 **편집기가 재서 보낸다**.
   *    파이썬은 글꼴 실측을 못 해 사본을 안고 있지만 브라우저는 그럴 이유가 없다.
   */
  async function buildExam(doc, roles, data) {
    const w = new ExamWriter(doc, roles);
    const rep = w.report;
    const T = global.PedagogyExamTemplate;

    for (const r of ["stem", "choice", "cont"]) {
      if (!(("para_" + r) in w.style)) w.warn(`틀에 ${r} 역할이 없어 기본 서식으로 대신합니다`);
    }

    const pageHeader = roles._page_header || {};
    const columnTops = roles._column_tops || {};
    const lineMm = roles._line_mm;
    const tagStepMm = Number((roles._marks || {}).tag_step_mm || 0);

    T.setMastheadTitle(doc, String(data.round || "모의고사"));
    const elective = String(data.elective || "").trim();
    if (elective && !T.setMastheadElective(doc, elective)) {
      w.warn(`틀에서 선택과목 머리말을 찾지 못해 '${elective}' 를 반영하지 못했습니다`);
    }

    /* 선지만 있는 문항은 시험지에 싣지 않는다(발문이 비었다는 뜻). */
    const shown = (data.problems || []).filter((p) => (p.units || []).some((u) => u.k !== "choices"));

    /* ── 구역 배정 — 공통은 0, 선택은 1. ⚠️ 모든 `doc.*` 호출이 그 값을 함께 넘겨야
       한다. 하나라도 빠지면 그 조각만 공통 구역으로 떨어져 조용히 깨진다. */
    const nSections = [...doc.parts.keys()]
      .filter((x) => /^Contents\/section\d+\.xml$/.test(x)).length;
    const groups = [];
    const common = shown.filter((q) => q.sect !== "선택");
    const electiveQs = shown.filter((q) => q.sect === "선택");
    if (common.length) groups.push([0, common]);
    if (electiveQs.length) {
      if (nSections >= 2) groups.push([1, electiveQs]);
      else {
        groups.push([0, electiveQs]);
        w.warn("틀에 선택과목 구역이 없어 선택 문항을 공통 구역에 이어 붙였습니다 "
             + "— 머리말과 쪽번호가 편집기 미리보기와 달라집니다");
      }
    }

    /* ⚠️ '틀 문단에 이미 썼는가' 는 **구역별로** 기억한다. 묶음마다 새로 세면 구역이
       하나뿐인 틀에서 선택 첫 문항이 공통 1번 문단에 덧쓰여 순서가 뒤엉킨다. */
    const framed = new Set();
    const headersDone = new Set();   // 이어지는 쪽 머리말은 구역마다 한 번만

    for (const [secI, group] of groups) {
      w.sec = secI;
      const breaks = columnStarts(group);
      const pages = pageStarts(group);

      /* 구획 태그가 붙는 문항 — 그 구역에서 처음 나오는 단답형(편집기 `isGroupFirst()`). */
      let tagAt = group.findIndex((q) => q.type === "short");
      if (tagAt < 0) tagAt = null;
      const tagAtColTop = tagAt !== null && (tagAt === 0 || breaks.has(tagAt));
      if (tagAt !== null && !((w.marks.tag || {}).short)) {
        w.warn("틀에서 '단답형' 구획 태그를 찾지 못해 넣지 못했습니다");
      }
      if (group.length && group[0].type === "short") {
        w.warn(`${group[0].num == null ? "?" : group[0].num}번이 이 구역의 첫 문항인데 단답형입니다 `
             + "— 표제부의 '5지선다형' 상자는 틀에 박혀 있어 그대로 인쇄됩니다");
      }

      /* 단 안에서 문항을 벌릴 양. 단의 **마지막 문항 뒤는 벌리지 않는다.** */
      const pads = {};
      columnSlots(group).forEach((col, cI) => {
        const colH = Math.floor(cI / 2) === 0 ? COL_H_FIRST_MM : COL_H_NEXT_MM;
        const tops = columnTops[secI] || [];
        let top = cI < tops.length ? tops[cI] : 0;
        /* ⚠️ 태그가 단 첫머리면 그만큼 문항이 내려간다. 안 더하면 둘째 문항이 태그
           높이(15.9mm)만큼 위로 올라붙는다. `readColumnTopsMm` 과 이중으로 세지 않는다 —
           그쪽 값은 그 단의 **첫 문단**(= 태그 문단) 자리라 태그 높이를 안 담고 있다. */
        if (tagAtColTop && col.length && col[0] === tagAt) top += tagStepMm;
        col.slice(0, -1).forEach((idx, j) => {
          let height = group[idx].heightMm;
          if (!height) return;                 // 편집기가 재 주지 않았다 — 벌리지 않는다
          if (idx === tagAt && !tagAtColTop) height += tagStepMm;   // 단 중간에 낀 태그
          const now = slotTopMm(j, col.length, colH, top) + height;
          const target = slotTopMm(j + 1, col.length, colH, top);
          pads[idx] = padLines(now, target, lineMm);
        });
      });

      /* ※ 확인 사항을 매달 문단 — 그 구역 **마지막 쪽**의 첫 문단(쪽 기준 절대배치라
         '어느 쪽에 나오는가' 만 정해 주면 된다). */
      let lastPagePara = 0;
      group.forEach((q, i) => {
        const before = doc.paragraphCount(secI);
        const useFrame = i === 0 && !framed.has(secI);
        /* 구획 태그는 그 문항 **앞**에 온다. `before` 를 태그보다 먼저 잡아 두었으므로
           쪽나눔·단나눔·이어지는 쪽 머리말이 모두 태그 문단에 붙는다(실물과 같다). */
        if (i === tagAt) w.sectionTag(useFrame ? 0 : null);
        w.problem(q, useFrame ? 0 : null);
        if (useFrame) framed.add(secI);

        const paras = doc.paragraphs(secI);
        if (pages.has(i) && paras.length > before) {
          lastPagePara = before;
          paras[before].setAttribute("pageBreak", "1");
          rep.pages += 1;
          /* 실물은 2쪽 첫 문단에 머리말을 한 번 정의하고 뒤 쪽이 물려받는다.
             안 넣으면 **2쪽부터 시험지 형식이 사라진다.** */
          if (!headersDone.has(secI) && (pageHeader[secI] || []).length) {
            const frag = pageHeader[secI];
            frag.forEach((runXml, at) => {
              const tmp = new DOMParser().parseFromString(
                `<w xmlns:hp="${HP}">${runXml}</w>`, "application/xml");
              const node = paras[before].ownerDocument.importNode(tmp.documentElement.firstChild, true);
              paras[before].insertBefore(node, paras[before].childNodes[at] || null);
            });
            headersDone.add(secI);
          }
        }
        /* ⚠️ **쪽나눔을 준 문단에 단나눔까지 주지 말 것** — 한글이 둘 다 수행해 새 쪽의
           왼쪽 단이 통째로 빈다. 쪽나눔은 그 자체로 '새 쪽의 첫 단' 에서 시작한다. */
        if (breaks.has(i) && !pages.has(i) && paras.length > before) {
          paras[before].setAttribute("columnBreak", "1");   // 문항의 **첫** 문단에 표시한다
          rep.breaks += 1;
        }
        /* 다음 문항을 자기 칸으로 밀어 내린다(실물·편집기 모두 균등 분할이다). */
        const n = pads[i] || 0;
        for (let k = 0; k < n; k++) {
          w.para("", { para: "para_cont",
                       char: "char_cont" in w.style ? "char_cont" : "char_stem" });
        }
        rep.padded += n;
        rep.problems += 1;
      });

      /* ※ 확인 사항 — 편집기 `noteFor()` 와 같은 규칙이다.
         공통 3줄(이어서 「선택과목(…)」 안내 포함) · 선택 2줄. */
      const want = group[0].sect === "선택" ? 2 : 3;
      const placed = w.attachNote(lastPagePara, { lines: want, elective: want === 3 ? elective : "" });
      if (group.length && !placed) w.warn("틀에서 '※ 확인 사항' 상자를 찾지 못해 넣지 못했습니다");
    }
    w.sec = 0;

    /* ⚠️ 이어지는 쪽 머리말은 **위 반복문에서야** 문서에 들어간다. 앞에서 부른
       `setMastheadElective()` 는 그때 없던 것을 고칠 수 없어 표지만 바뀌고 2쪽부터는
       틀의 이름이 그대로 인쇄됐다. 여기서 한 번 더 맞춘다. */
    if (elective) T.setMastheadElective(doc, elective);

    return { blob: await doc.toBlob(), report: rep };
  }

  /** 브라우저 혼자서는 못 만드는 payload 인가.
      ⚠️ 지금은 **이름이 있는 그림** 하나뿐이다 — 그 파일은 서버만 읽을 수 있다.
         이걸 안 가르면 그림이 빠진 시험지가 **조용히** 나간다(이 저장소가 가장 자주
         겪은 사고 방식이다). 부르는 쪽이 서버 경로로 넘긴다. */
  function needsServer(payload) {
    return (payload.problems || []).some((p) =>
      (p.units || []).some((u) => u.k === "fig"
        && String(u.src || "").trim()
        && !figureBytes(u.data)));      // 문서에 담긴 그림은 서버가 필요 없다
  }

  global.PedagogyExam = { ExamWriter, buildExam, needsServer, splitInline, spaceBeforeMath, numPrefixXml, eqTabXml,
                          columnStarts, pageStarts, columnSlots, slotTopMm, padLines,
                          PER_COL, COL_H_FIRST_MM, COL_H_NEXT_MM };
})(typeof window !== "undefined" ? window : globalThis);
