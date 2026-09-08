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

  global.PedagogyExamTemplate = {
    STYLE_NAMES, classify, visibleText,
    equationBase, namedStyles, rolesFromBody, rolesByUsage, readRoles,
  };
})(typeof window !== "undefined" ? window : globalThis);
