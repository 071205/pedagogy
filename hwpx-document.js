/* PEDAGOGY — 범용 문서 JSON → HWPX (브라우저).
 *
 * `experiments/hwp-export/document_to_hwpx.py` 를 옮긴 것이다. 조판 자체는
 * `hwpx-engine.js` 가 맡고, 여기서는 블록을 문단으로 푸는 규칙만 다룬다.
 *
 * ⚠️ 파이썬과 **같은 결과를 내야 한다.** `scripts/check-hwpx-browser.mjs` 가 같은 입력을
 *    양쪽에 넣어 대조한다. 한쪽만 고치면 그 검사가 빨간불이 된다 — 고치지 말고 맞출 것.
 */
(function (global) {
  "use strict";

  const E = global.PedagogyHwpx;
  if (!E) throw new Error("hwpx-engine.js 를 먼저 불러와야 합니다");

  const { NS, MARKS, HGND, MM_TO_HWPUNIT, HwpxDocument, UnsupportedTex, texToHwp,
          imageSize, xmlEscape } = E;
  const HP = NS.hp, HH = NS.hh, HC = NS.hc;
  const MM = 7200 / 25.4;

  /** 문단 안의 `$...$` 만 수식으로 본다. `$$...$$` 는 equation 블록을 쓴다. */
  function splitInline(text) {
    const parts = [];
    for (const chunk of String(text).split(/(\$[^$\n]*\$)/g)) {
      if (!chunk) continue;
      if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length >= 2) {
        parts.push(["equation", chunk.slice(1, -1)]);
      } else parts.push(["text", chunk]);
    }
    return parts;
  }

  function charPr(id, size, { bold = false, color = "#000000" } = {}) {
    const langs = 'hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"';
    return (
      `<hh:charPr xmlns:hh="${HH}" id="${id}" height="${size}" textColor="${color}" ` +
      'shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE">' +
      `<hh:fontRef ${langs}/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>` +
      '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>' +
      '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>' +
      '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>' +
      '<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/>' +
      (bold ? "<hh:bold/>" : "") +
      '<hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>' +
      "</hh:charPr>"
    );
  }

  /** 문단 모양 하나. `borderFill` 을 주면 **테두리 있는 문단**이 된다.
   *  ⚠️ `connect="1"` 이 핵심이다 — 이게 있어야 연속된 문단이 상자 하나로 합쳐진다.
   *     없으면 줄마다 따로 상자가 그려진다. */
  function paraPr(id, { align = "LEFT", leftMm = 0, rightMm = 0, firstMm = 0,
                        beforeMm = 0, afterMm = 1.7, line = 160, borderFill = null } = {}) {
    const unit = (v) => String(Math.round(v * MM));
    const border = borderFill == null ? "" :
      `<hh:border borderFillIDRef="${borderFill}" offsetLeft="1133" offsetRight="1133" ` +
      'offsetTop="850" offsetBottom="850" connect="1" ignoreMargin="1"/>';
    return (
      `<hh:paraPr xmlns:hh="${HH}" xmlns:hc="${HC}" id="${id}" tabPrIDRef="0" condense="0" ` +
      'fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">' +
      `<hh:align horizontal="${align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>` +
      '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="1" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>' +
      '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hh:margin>' +
      `<hc:intent value="${unit(firstMm)}" unit="HWPUNIT"/><hc:left value="${unit(leftMm)}" unit="HWPUNIT"/>` +
      `<hc:right value="${unit(rightMm)}" unit="HWPUNIT"/><hc:prev value="${unit(beforeMm)}" unit="HWPUNIT"/>` +
      `<hc:next value="${unit(afterMm)}" unit="HWPUNIT"/></hh:margin>` +
      `<hh:lineSpacing type="PERCENT" value="${line}" unit="HWPUNIT"/>${border}</hh:paraPr>`
    );
  }

  const CHAR_ROLES = [
    ["title", 1900, true], ["heading1", 1500, true], ["heading2", 1300, true],
    ["heading3", 1150, true], ["body", 1100, false], ["quote", 1050, false],
    ["table_header", 1050, true], ["table_body", 1050, false],
  ];

  const PARA_ROLES = {
    title: { align: "CENTER", beforeMm: 0, afterMm: 6.0, line: 140 },
    heading1: { beforeMm: 6.0, afterMm: 2.5, line: 145 },
    heading2: { beforeMm: 4.5, afterMm: 2.0, line: 150 },
    heading3: { beforeMm: 3.5, afterMm: 1.5, line: 155 },
    body: { beforeMm: 0, afterMm: 1.7, line: 165 },
    equation: { align: "CENTER", beforeMm: 1.0, afterMm: 2.0, line: 140 },
    list: { leftMm: 7.0, firstMm: -4.5, beforeMm: 0, afterMm: 1.2, line: 160 },
    quote: { leftMm: 8.0, rightMm: 5.0, beforeMm: 1.5, afterMm: 1.5, line: 160 },
    table: { align: "CENTER", beforeMm: 2.0, afterMm: 3.0, line: 140 },
    image: { align: "CENTER", beforeMm: 2.0, afterMm: 2.0, line: 140 },
    box: { leftMm: 3.0, rightMm: 3.0, beforeMm: 0, afterMm: 0, line: 165 },
    choice: { leftMm: 2.0, beforeMm: 0, afterMm: 1.0, line: 160 },
    boxtop: { beforeMm: 2.5, afterMm: 0, line: 40 },
    boxbottom: { beforeMm: 0, afterMm: 2.5, line: 40 },
  };

  function installStyles(doc) {
    const head = doc.part("Contents/header.xml").xml;
    const chars = head.getElementsByTagNameNS(HH, "charProperties")[0];
    const paras = head.getElementsByTagNameNS(HH, "paraProperties")[0];
    if (!chars || !paras) throw new Error("HWPX header.xml에 글자/문단 서식이 없습니다");
    let c = parseInt(chars.getAttribute("itemCnt") || "1", 10);
    let p = parseInt(paras.getAttribute("itemCnt") || "1", 10);
    const roles = {};
    // ⚠️ 테두리 정의를 **문단 모양보다 먼저** 만든다 — 상자 문단이 그 id 를 참조한다.
    roles.border_cell = doc.addBorderFill();
    roles.border_box = doc.addBorderFill({ width: "0.15 mm" });
    const parse = (xml) => new DOMParser().parseFromString(xml, "application/xml").documentElement;
    for (const [name, size, bold] of CHAR_ROLES) {
      chars.appendChild(head.importNode(parse(charPr(c, size,
        { bold, color: name === "quote" ? "#333333" : "#000000" })), true));
      roles["char_" + name] = String(c);
      c += 1;
    }
    for (const name of Object.keys(PARA_ROLES)) {
      const opts = Object.assign({}, PARA_ROLES[name]);
      if (name === "box") opts.borderFill = roles.border_box;   // 상자 문단만 테두리를 단다
      paras.appendChild(head.importNode(parse(paraPr(p, opts)), true));
      roles["para_" + name] = String(p);
      p += 1;
    }
    chars.setAttribute("itemCnt", String(c));
    paras.setAttribute("itemCnt", String(p));
    return roles;
  }

  function appendText(doc, paragraph, text, charPrId) {
    if (text) {
      doc.appendRunXml(`<hp:t xmlns:hp="${HP}">${xmlEscape(text)}</hp:t>`,
                       { paragraphIndex: paragraph, charPrId });
    }
  }

  /** 문단 하나. `into` 를 주면 새 문단을 만들지 않고 그 문단에 이어 쓴다.
   *  골격의 첫 문단은 구역 정의를 안고 있어 지울 수 없으므로, 문서의 첫 글은 거기에
   *  이어 써야 맨 위에 빈 줄이 남지 않는다. */
  function emitRich(doc, text, report, styles, { para = "body", char = "body", where, into = null } = {}) {
    const parts = splitInline(text);
    let paragraph, remaining;
    if (into != null) {
      paragraph = into;
      doc.setParagraphStyle(into, { paraPrId: styles["para_" + para], charPrId: styles["char_" + char] });
      remaining = parts;
    } else {
      const lead = parts.length && parts[0][0] === "text" ? parts[0][1] : "";
      doc.appendParagraph(lead, { paraPrId: styles["para_" + para], charPrId: styles["char_" + char] });
      paragraph = doc.paragraphCount() - 1;
      remaining = lead ? parts.slice(1) : parts;
    }
    for (const [kind, value] of remaining) {
      if (kind === "text") { appendText(doc, paragraph, value, styles["char_" + char]); continue; }
      try {
        doc.appendEquation(texToHwp(value),
          { paragraphIndex: paragraph, charPrId: styles.char_body, baseUnit: 1050 });
        report.equations += 1;
      } catch (err) {
        if (!(err instanceof UnsupportedTex)) throw err;
        report.warnings.push(`${where}: 인라인 수식 변환 실패 — ${err.message} (${value})`);
        appendText(doc, paragraph, `[수식 변환 실패: ${value}]`, styles["char_" + char]);
      }
    }
    return paragraph;
  }

  function emitDisplayEquation(doc, tex, report, styles, where) {
    let body = tex.trim();
    body = body.startsWith("$$") && body.endsWith("$$") ? body.slice(2, -2).trim()
                                                        : body.replace(/^\$+|\$+$/g, "").trim();
    doc.appendParagraph("", { paraPrId: styles.para_equation, charPrId: styles.char_body });
    const paragraph = doc.paragraphCount() - 1;
    try {
      doc.appendEquation(texToHwp(body), { paragraphIndex: paragraph, charPrId: styles.char_body,
                                           baseUnit: 1100, width: 11000, height: 2800 });
      report.equations += 1;
    } catch (err) {
      if (!(err instanceof UnsupportedTex)) throw err;
      report.warnings.push(`${where}: 별행 수식 변환 실패 — ${err.message} (${body})`);
      appendText(doc, paragraph, `[수식 변환 실패: ${body}]`, styles.char_body);
    }
  }

  function emitTable(doc, rows, header, styles) {
    doc.appendParagraph("", { paraPrId: styles.para_table, charPrId: styles.char_body });
    doc.appendTable(rows, { paragraphIndex: doc.paragraphCount() - 1, header,
      headerCharPrId: styles.char_table_header, bodyCharPrId: styles.char_table_body,
      cellBorderFillId: styles.border_cell });
  }

  function base64ToBytes(b64) {
    const binary = atob(String(b64).replace(/\s+/g, ""));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  /** 그림 한 장. ⚠️ 높이는 **원본 비율로 계산한다** — 폭만 주고 높이를 아무 값이나 주면
   *  그림이 늘어나거나 눌린다. */
  function emitImage(doc, encoded, widthMm, styles, where, report) {
    const data = base64ToBytes(encoded);
    const size = imageSize(data);
    if (!size) {
      report.warnings.push(`${where}: PNG·JPEG 가 아니어서 그림을 넣지 못했습니다`);
      return;
    }
    const w = Math.round(widthMm * MM_TO_HWPUNIT);
    const h = Math.round((w * size.height) / size.width);
    doc.appendParagraph("", { paraPrId: styles.para_image, charPrId: styles.char_body });
    const paragraph = doc.paragraphCount() - 1;
    // 확장자는 바이트로 판정한 형식을 따른다 — 사용자가 준 이름을 쓰지 않는다.
    const name = "image" + doc.paragraphCount() + (size.png ? ".png" : ".jpg");
    doc.appendPicture(name, data, { paragraphIndex: paragraph, charPrId: styles.char_body,
                                    width: w, height: h });
  }

  /** 테두리 상자. 줄바꿈마다 문단을 만들되 **모두 같은 상자 문단 모양**을 쓴다.
   *  ⚠️ 그래야 `connect="1"` 이 작동해 하나의 상자로 합쳐진다.
   *  ⚠️ 상자 앞뒤에 여백 문단을 하나씩 둔다 — 없으면 앞 문단이 상자에 딱 붙는다. */
  function emitBox(doc, text, label, report, styles, where) {
    doc.appendParagraph("", { paraPrId: styles.para_boxtop, charPrId: styles.char_body });
    const lines = String(text).split("\n").filter((l) => l.trim());
    if (label) lines.unshift(label);
    for (const line of lines) emitRich(doc, line, report, styles, { para: "box", char: "body", where });
    doc.appendParagraph("", { paraPrId: styles.para_boxbottom, charPrId: styles.char_body });
  }

  function emitExamples(doc, items, label, report, styles, where) {
    emitBox(doc, items.map((it, i) => `${HGND[i % HGND.length]}. ${it}`).join("\n"),
            label, report, styles, where);
  }

  /** 선지 ①②③④⑤.
   *  ⚠️ **시험지 조판기와 배치가 같지 않다.** 그쪽은 2단 폭(111mm)에 맞춰 실물에서 잰 탭
   *     위치를 쓰고, 여기는 A4 한 단 문서의 기본 탭을 쓴다. 라벨과 규칙만 공유한다.
   *  ⚠️ 한 줄 안의 선지는 **한 문단**에 탭으로 이어 붙인다. 문단을 나누면 세로로 쌓인다. */
  function emitChoices(doc, items, layout, report, styles, where) {
    const used = items.filter((x) => x.trim());
    if (!used.length) return;
    if (layout === "auto") {
      const longest = Math.max(...used.map((x) => x.length));
      layout = longest <= 6 ? "1" : longest <= 16 ? "2" : "v";
    }
    const rows = layout === "1" ? [used]
               : layout === "2" ? [used.slice(0, 3), used.slice(3)]
               : used.map((x) => [x]);
    let mark = 0;
    for (const row of rows) {
      if (!row.length) continue;
      let first = true;
      let paragraph = null;
      for (const item of row) {
        const label = MARKS[mark % MARKS.length] + " ";
        mark += 1;
        if (first) {
          paragraph = emitRich(doc, label + item, report, styles, { para: "choice", char: "body", where });
          first = false;
          continue;
        }
        doc.appendRunXml(
          `<hp:t xmlns:hp="${HP}"><hp:tab width="0" leader="0" type="1"/>${xmlEscape(label)}</hp:t>`,
          { paragraphIndex: paragraph, charPrId: styles.char_body });
        // ⚠️ 라벨 뒤 본문도 **수식 처리를 거쳐야 한다.** 글자로 붙이면 둘째 선지부터
        //    `$\dfrac32$` 가 원문 그대로 찍힌다(파이썬 쪽에서 실제로 그랬다).
        for (const [kind, value] of splitInline(item)) {
          if (kind === "text") { appendText(doc, paragraph, value, styles.char_body); continue; }
          try {
            doc.appendEquation(texToHwp(value),
              { paragraphIndex: paragraph, charPrId: styles.char_body, baseUnit: 1050 });
            report.equations += 1;
          } catch (err) {
            if (!(err instanceof UnsupportedTex)) throw err;
            report.warnings.push(`${where}: 선지 수식 변환 실패 — ${err.message} (${value})`);
            appendText(doc, paragraph, `[수식 변환 실패: ${value}]`, styles.char_body);
          }
        }
      }
    }
  }

  /** 검증까지 끝난 문서 JSON → HWPX Blob. `blankUrl` 은 빈 문서 골격의 주소다. */
  async function buildDocument(docJson, blankUrl) {
    const doc = await HwpxDocument.blank(blankUrl);
    const styles = installStyles(doc);
    const report = { blocks: 0, equations: 0, warnings: [] };
    // ⚠️ 골격의 첫 문단은 지우면 안 된다 — 구역·쪽 정의(secPr)가 그 안에 있다.
    //    그렇다고 그냥 두면 문서 맨 위에 빈 줄이 남는다. 제목을 그 문단에 이어 쓴다.
    const frame = doc.firstParagraphIsEmpty();
    emitRich(doc, docJson.title, report, styles,
             { para: "title", char: "title", where: "제목", into: frame ? 0 : null });
    docJson.blocks.forEach((block, index) => {
      const kind = block.type;
      const where = `${index + 1}번째 ${kind}`;
      if (kind === "heading") {
        emitRich(doc, block.text, report, styles,
                 { para: "heading" + block.level, char: "heading" + block.level, where });
      } else if (kind === "paragraph") {
        emitRich(doc, block.text, report, styles, { where });
      } else if (kind === "quote") {
        emitRich(doc, block.text, report, styles, { para: "quote", char: "quote", where });
      } else if (kind === "equation") {
        emitDisplayEquation(doc, block.text, report, styles, where);
      } else if (kind === "table") {
        emitTable(doc, block.rows, block.header, styles);
      } else if (kind === "image") {
        emitImage(doc, block.data, block.width, styles, where, report);
      } else if (kind === "box") {
        emitBox(doc, block.text, block.label, report, styles, where);
      } else if (kind === "examples") {
        emitExamples(doc, block.items, block.label, report, styles, where);
      } else if (kind === "choices") {
        emitChoices(doc, block.items, block.layout, report, styles, where);
      } else {
        const bullet = kind === "bullets";
        block.items.forEach((item, n) => {
          emitRich(doc, (bullet ? "• " : `${n + 1}. `) + item, report, styles,
                   { para: "list", where });
        });
      }
      report.blocks += 1;
    });
    return { blob: await doc.toBlob(), report };
  }

  global.PedagogyHwpxDocument = { buildDocument, installStyles, splitInline };
})(window);
