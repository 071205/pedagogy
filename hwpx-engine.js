/* PEDAGOGY — 브라우저에서 도는 최소 HWPX 작성 엔진.
 *
 * `experiments/hwp-export/` 의 파이썬(pedagogy_hwpx.py · tex_to_hwp.py ·
 * document_to_hwpx.py)을 옮긴 것이다. 목적은 하나 — **로컬 서버 없이** 사이트만 열어도
 * 한글 파일을 받을 수 있게 하는 것.
 *
 * ⚠️ 이것은 파이썬의 **사본이다. 사본은 갈라진다** — 이 저장소가 여러 번 겪은 실패다.
 *    `scripts/check-hwpx-browser.mjs` 가 같은 입력으로 양쪽을 돌려 결과를 대조한다.
 *    한쪽을 고치면 다른 쪽도 고치고, 그 검사를 반드시 돌릴 것.
 *
 * ⚠️ 빈 문서 골격(`templates/blank.hwpx`)은 **한글이 직접 저장한 실물 파일**이다.
 *    코드로 지어 만들면 한글이 열지 못한다(두 번 시도해 두 번 실패했다 —
 *    `docs/HWP-SPEC.md` 참고). 여기서도 그 파일을 받아 골격으로 쓴다.
 *
 * 수식 대응표 출처 고지 — 배포 조건이므로 지우지 말 것:
 *   "본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."
 */
(function (global) {
  "use strict";

  const NS = {
    ha: "http://www.hancom.co.kr/hwpml/2011/app",
    hc: "http://www.hancom.co.kr/hwpml/2011/core",
    hh: "http://www.hancom.co.kr/hwpml/2011/head",
    hm: "http://www.hancom.co.kr/hwpml/2011/master-page",
    hp: "http://www.hancom.co.kr/hwpml/2011/paragraph",
    hs: "http://www.hancom.co.kr/hwpml/2011/section",
    hv: "http://www.hancom.co.kr/hwpml/2011/version",
    hpf: "http://www.hancom.co.kr/schema/2011/hpf",
    ocf: "urn:oasis:names:tc:opendocument:xmlns:container",
    opf: "http://www.idpf.org/2007/opf/",
  };

  const MM_TO_HWPUNIT = 7200 / 25.4;
  const MARKS = ["①", "②", "③", "④", "⑤"];        // 선지
  const HGND = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ"];   // <보기> 항목

  /* ── ZIP ────────────────────────────────────────────────────────────────
   * HWPX 는 ZIP 이다. 외부 라이브러리를 쓰지 않는다 — 브라우저에 이미
   * CompressionStream('deflate-raw') 이 있고, 그 외에는 헤더를 직접 쓰면 된다.
   * ⚠️ `mimetype` 은 **압축하지 않고 맨 앞에** 둔다(ODF 계열 규칙).
   */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function throughStream(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  const deflateRaw = (b) => throughStream(b, new CompressionStream("deflate-raw"));
  const inflateRaw = (b) => throughStream(b, new DecompressionStream("deflate-raw"));

  /** ZIP 을 풀어 {이름 → Uint8Array} 로 준다(순서 유지). */
  async function unzip(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    // 중앙 디렉터리 끝(EOCD)을 뒤에서 찾는다.
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("ZIP 이 아닙니다 (EOCD 를 찾지 못했습니다)");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const files = new Map();
    const decoder = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP 중앙 디렉터리가 깨졌습니다");
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localAt = view.getUint32(p + 42, true);
      const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      // 지역 헤더에서 실제 자료가 시작하는 곳을 다시 계산한다(extra 길이가 다를 수 있다).
      const lNameLen = view.getUint16(localAt + 26, true);
      const lExtraLen = view.getUint16(localAt + 28, true);
      const start = localAt + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compSize);
      files.set(name, method === 0 ? new Uint8Array(raw) : await inflateRaw(raw));
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  /** {이름 → Uint8Array} 를 ZIP 바이트로 만든다. `stored` 에 든 이름은 압축하지 않는다. */
  async function zip(files, stored) {
    const encoder = new TextEncoder();
    const locals = [];
    const central = [];
    let offset = 0;
    for (const [name, data] of files) {
      const nameBytes = encoder.encode(name);
      const isStored = stored.has(name);
      const body = isStored ? data : await deflateRaw(data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);                    // version needed
      lv.setUint16(6, 0x0800, true);                // 이름은 UTF-8
      lv.setUint16(8, isStored ? 0 : 8, true);      // 0=저장 8=deflate
      lv.setUint16(10, 0, true); lv.setUint16(12, 0x0021, true);   // 1980-01-01 (파이썬과 같게)
      lv.setUint32(14, crc, true);
      lv.setUint32(18, body.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      locals.push(local, body);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, isStored ? 0 : 8, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0x0021, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, body.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);
      offset += local.length + body.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.size, true);
    ev.setUint16(10, files.size, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...locals, ...central, end], { type: "application/vnd.hancom.hwpx" });
  }

  /* ── XML ──────────────────────────────────────────────────────────────── */
  // ⚠️ 늦게 만든다. 파일을 읽는 순간 만들면 DOM 이 없는 곳(Node 로 ZIP 부분만 쓰는
  //    검사)에서 통째로 못 불러온다.
  let _serializer = null;
  const serializer = () => (_serializer || (_serializer = new XMLSerializer()));

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const bad = doc.getElementsByTagName("parsererror")[0];
    if (bad) throw new Error("XML 을 읽지 못했습니다: " + bad.textContent.slice(0, 200));
    return doc;
  }

  /** `'hp:t'` 처럼 접두어가 붙은 이름으로 원소를 만든다. */
  function el(xdoc, tag, attrs) {
    const prefix = tag.split(":")[0];
    const node = xdoc.createElementNS(NS[prefix], tag);
    if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, String(attrs[k]));
    return node;
  }
  function sub(parent, tag, attrs) {
    const node = el(parent.ownerDocument, tag, attrs);
    parent.appendChild(node);
    return node;
  }
  /** 문자열 XML 조각을 그 문서의 노드로 들여온다. */
  function fragment(xdoc, xml) {
    return xdoc.importNode(parseXml(xml).documentElement, true);
  }
  function xmlEscape(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function childrenOf(node, prefix, name) {
    const out = [];
    for (const c of node.children) {
      if (c.localName === name && (!prefix || c.namespaceURI === NS[prefix])) out.push(c);
    }
    return out;
  }
  function firstByLocal(root, prefix, name) {
    return root.getElementsByTagNameNS(NS[prefix], name)[0] || null;
  }

  /* ── 그림 크기 ─────────────────────────────────────────────────────────
   * ⚠️ 확장자나 사용자가 준 이름을 믿지 않는다 — **바이트를 보고** 형식과 크기를 정한다.
   */
  function imageSize(data) {
    if (data.length > 24 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e &&
        data[3] === 0x47 && String.fromCharCode(...data.subarray(12, 16)) === "IHDR") {
      const v = new DataView(data.buffer, data.byteOffset);
      return { width: v.getUint32(16), height: v.getUint32(20), png: true };
    }
    if (data[0] === 0xff && data[1] === 0xd8) {                 // JPEG
      const v = new DataView(data.buffer, data.byteOffset);
      let i = 2;
      while (i + 9 < data.length) {
        if (data[i] !== 0xff) { i += 1; continue; }
        const marker = data[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: v.getUint16(i + 7), height: v.getUint16(i + 5), png: false };
        }
        i += 2 + v.getUint16(i + 2);
      }
    }
    return null;
  }

  /* ══ LaTeX → HWP 수식 (tex_to_hwp.py 를 옮긴 것) ══════════════════════ */

  class UnsupportedTex extends Error {}

  const SIMPLE = {
    times: "times", div: "div", pm: "+-", mp: "-+",
    leq: "leq", le: "leq", geq: "geq", ge: "geq",
    neq: "!=", ne: "!=", approx: "approx", equiv: "equiv",
    infty: "inf", to: "rarrow", rightarrow: "rarrow",
    leftarrow: "larrow", Rightarrow: "RARROW", cdot: "cdot",
    cdots: "cdots", ldots: "dotslow", dots: "dotslow",
    alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta",
    theta: "theta", lambda: "lambda", mu: "mu", pi: "pi",
    sigma: "sigma", omega: "omega", Delta: "DELTA", Sigma: "SIGMA",
    Omega: "OMEGA", phi: "phi", varphi: "varphi", epsilon: "epsilon",
    sum: "sum", prod: "prod", int: "int", lim: "lim",
    sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln",
    min: "min", max: "max", exp: "exp",
    in: "in", notin: "notin", subset: "subset", cup: "cup",
    cap: "cap", emptyset: "emptyset", forall: "forall", exists: "exists",
    prime: "prime", circ: "circ", angle: "angle", perp: "perp",
    quad: "~~", qquad: "~~~~", ",": "`", ";": "`", "!": "",
    oint: "oint", iint: "dint", iiint: "tint",
    cong: "cong", sim: "sim", propto: "propto",
    supset: "supset", subseteq: "subseteq", supseteq: "supseteq",
    setminus: "\\", nabla: "nabla", partial: "partial",
    aleph: "aleph", hbar: "hbar", ell: "ell", Re: "imag", wp: "wp",
    vartheta: "vartheta", varpi: "varpi", varsigma: "varsigma",
    varupsilon: "varupsilon", varepsilon: "varepsilon",
    eta: "eta", zeta: "zeta", iota: "iota", kappa: "kappa", nu: "nu",
    xi: "xi", rho: "rho", tau: "tau", upsilon: "upsilon", chi: "chi",
    psi: "psi", Gamma: "GAMMA", Theta: "THETA", Lambda: "LAMBDA",
    Xi: "XI", Pi: "PI", Phi: "PHI", Psi: "PSI",
    leftrightarrow: "lrarrow", Leftarrow: "LARROW",
    Leftrightarrow: "LRARROW", mp2: "-+",
    " ": "`", ":": "`",
  };

  const ACCENT = {
    vec: "vec", bar: "bar", hat: "hat", tilde: "tilde",
    dot: "dot", ddot: "ddot", overline: "bar",
    acute: "acute", grave: "grave", check: "check",
    breve: "arch", underline: "under", widehat: "hat", widetilde: "tilde",
    mathrm: "rm", mathit: "it", mathbf: "bold", text: "rm",
    operatorname: "rm", mathsf: "rm", mathbb: "rm",
  };

  // 규격서 1.1.2.3 — 한 낱말이 이 길이를 넘으면 한글이 두 항으로 쪼갠다.
  const MAX_TERM_CHARS = 9;

  const NOOP = new Set(["displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle",
    "limits", "nolimits", "left.", "right.", "mathstrut", "strut"]);

  const isSpace = (ch) => /\s/.test(ch);
  function skipWs(s, i) { while (i < s.length && isSpace(s[i])) i += 1; return i; }

  function readGroup(s, i) {
    i = skipWs(s, i);
    if (i >= s.length) throw new UnsupportedTex("인자가 필요한 자리에서 수식이 끝났습니다");
    if (s[i] !== "{") {
      if (s[i] === "\\") {
        const m = /^\\([A-Za-z]+|[\s\S])/.exec(s.slice(i));
        return [s.slice(i, i + m[0].length), i + m[0].length];
      }
      return [s[i], i + 1];
    }
    let depth = 0; const start = i;
    while (i < s.length) {
      if (s[i] === "{") depth += 1;
      else if (s[i] === "}") { depth -= 1; if (depth === 0) return [s.slice(start + 1, i), i + 1]; }
      i += 1;
    }
    throw new UnsupportedTex("중괄호가 닫히지 않았습니다");
  }

  function readOptional(s, i) {
    const j = skipWs(s, i);
    if (j < s.length && s[j] === "[") {
      const end = s.indexOf("]", j);
      if (end < 0) throw new UnsupportedTex("대괄호가 닫히지 않았습니다");
      return [s.slice(j + 1, end), end + 1];
    }
    return [null, i];
  }

  function splitTop(body, sep) {
    const out = []; let depth = 0; let buf = ""; let i = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      if (depth === 0 && body.startsWith(sep, i)) { out.push(buf); buf = ""; i += sep.length; continue; }
      buf += c; i += 1;
    }
    out.push(buf);
    return out;
  }

  function texToHwp(tex) {
    const out = [];
    let i = 0;
    while (i < tex.length) {
      const c = tex[i];
      if (c !== "\\") {
        if (c === "{") { const [inner, next] = readGroup(tex, i); out.push("{" + texToHwp(inner) + "}"); i = next; continue; }
        if (c === "}") throw new UnsupportedTex("짝이 맞지 않는 '}' 가 있습니다");
        if (c === "^" || c === "_") {
          // ⚠️ 첨자 범위를 반드시 중괄호로 묶는다. `x^2-a` 를 그대로 옮기면 HWP 가
          //    뒤를 더 먹어 x^(2−a) 로 조판한다 — 수식이 조용히 다른 뜻이 된다.
          const [arg, next] = readGroup(tex, i + 1);
          out.push(c + "{" + texToHwp(arg) + "}");
          i = next; continue;
        }
        const run = /^[A-Za-z0-9]+/.exec(tex.slice(i));
        if (run) {
          // ⚠️ 규격서 1.1.2.3 — 9자를 넘는 낱말은 한글이 두 항으로 쪼갠다.
          const word = run[0];
          out.push(word.length > MAX_TERM_CHARS ? '"' + word + '"' : word);
          i += word.length; continue;
        }
        out.push(c); i += 1; continue;
      }

      const m = /^\\([A-Za-z]+|[\s\S])/.exec(tex.slice(i));
      if (!m) throw new UnsupportedTex("'\\' 뒤에 명령이 없습니다");
      const name = m[1];
      i += m[0].length;

      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        let a, b;
        [a, i] = readGroup(tex, i); [b, i] = readGroup(tex, i);
        out.push("{" + texToHwp(a) + "} over {" + texToHwp(b) + "}");
      } else if (name === "sqrt") {
        let opt, a;
        [opt, i] = readOptional(tex, i); [a, i] = readGroup(tex, i);
        out.push(opt === null ? "sqrt {" + texToHwp(a) + "}"
                              : "sqrt {" + texToHwp(opt) + "} of {" + texToHwp(a) + "}");
      } else if (name === "left") {
        // ⚠️ 앞뒤 공백이 반드시 있어야 한다. `f\left(` 를 `fleft(` 로 붙이면 HWP 가
        //    `fleft` 를 식별자 하나로 읽어 괄호가 사라진다.
        const j = skipWs(tex, i);
        out.push(" left " + tex[j] + " "); i = j + 1;
      } else if (name === "right") {
        const j = skipWs(tex, i);
        out.push(" right " + tex[j] + " "); i = j + 1;
      } else if (name === "begin" || name === "end") {
        let env;
        [env, i] = readGroup(tex, i);
        if (name === "end") throw new UnsupportedTex("짝이 없는 \\end{" + env + "}");
        const close = "\\end{" + env + "}";
        const k = tex.indexOf(close, i);
        if (k < 0) throw new UnsupportedTex("\\begin{" + env + "} 의 짝을 찾지 못했습니다");
        const body = tex.slice(i, k);
        i = k + close.length;
        out.push(convertEnv(env, body));
      } else if (Object.prototype.hasOwnProperty.call(ACCENT, name)) {
        let a;
        [a, i] = readGroup(tex, i);
        out.push(ACCENT[name] + " {" + texToHwp(a) + "}");
      } else if (NOOP.has(name)) {
        /* 조판 힌트 — 버려도 뜻이 같다 */
      } else if (Object.prototype.hasOwnProperty.call(SIMPLE, name)) {
        out.push(" " + SIMPLE[name] + " ");
      } else if (name === "\\") {
        out.push(" # ");
      } else if (name === "{" || name === "}") {
        // ⚠️ HWP 에서 `{}` 는 묶음 기호라 그대로 내면 화면에 보이지 않는다.
        out.push(name === "{" ? " lbrace " : " rbrace ");
      } else if ("%$&_#".includes(name)) {
        out.push(name);
      } else {
        throw new UnsupportedTex("아직 지원하지 않는 명령: \\" + name);
      }
    }
    return out.join("").replace(/\s+/g, " ").trim();
  }

  function convertEnv(env, body) {
    const rows = splitTop(body, "\\\\");
    const converted = rows.map((row) => {
      const cols = splitTop(row, "&");
      return cols.filter((c) => c.trim() || cols.length === 1).map(texToHwp).join(" & ");
    });
    const joined = converted.filter((r) => r.trim()).join(" # ");
    if (env === "cases") return "cases{ " + joined + " }";
    const MATRIX = { pmatrix: "pmatrix", bmatrix: "bmatrix", matrix: "matrix",
                     vmatrix: "dmatrix", Vmatrix: "dmatrix" };
    // ⚠️ 한글에 `vmatrix` 라는 명령은 **없다**. 세로줄 행렬은 DMATRIX 다(규격서 1.2).
    if (Object.prototype.hasOwnProperty.call(MATRIX, env)) return MATRIX[env] + "{ " + joined + " }";
    if (["aligned", "align", "eqalign", "array"].includes(env)) return "eqalign{ " + joined + " }";
    throw new UnsupportedTex("아직 지원하지 않는 환경: " + env);
  }

  /* ══ HWPX 문서 ═══════════════════════════════════════════════════════ */

  class HwpxDocument {
    constructor(parts) {
      this.parts = parts;               // Map<string, {bytes?:Uint8Array, xml?:XMLDocument}>
      this._control = 1;
      // 표 칸 문단은 본문 문단과 **전체 문서에서 겹치지 않는 id** 가 필요하다.
      this._cellPara = 900000;
    }

    static async open(buffer) {
      const files = await unzip(buffer);
      const parts = new Map();
      const decoder = new TextDecoder();
      for (const [name, bytes] of files) {
        const isXml = name.endsWith(".xml") || name.endsWith(".hpf");
        parts.set(name, isXml ? { xml: parseXml(decoder.decode(bytes)) } : { bytes });
      }
      return new HwpxDocument(parts);
    }

    /** 빈 문서 — 한글이 직접 저장한 골격을 받아 쓴다(코드로 지어 만들지 말 것). */
    static async blank(url) {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("빈 문서 골격을 받지 못했습니다 (" + url + " → HTTP " + res.status + ")");
      return HwpxDocument.open(await res.arrayBuffer());
    }

    part(path) {
      const p = this.parts.get(path);
      if (!p) throw new Error("HWPX 에 " + path + " 가 없습니다");
      return p;
    }
    section(index) { return this.part("Contents/section" + index + ".xml").xml; }
    paragraphs(index) { return childrenOf(this.section(index).documentElement, "hp", "p"); }
    paragraphCount(index) { return this.paragraphs(index || 0).length; }

    /** 이미 있는 문단의 문단·글자 모양을 바꾼다(골격 문단에 이어 쓸 때 필요). */
    setParagraphStyle(idx, { paraPrId, charPrId, sectionIndex = 0 } = {}) {
      const p = this.paragraphs(sectionIndex)[idx];
      if (paraPrId != null) p.setAttribute("paraPrIDRef", String(paraPrId));
      for (const run of p.getElementsByTagNameNS(NS.hp, "run")) {
        // 구역 정의(secPr)를 안고 있는 run 은 건드리지 않는다 — 쪽 설정이 흔들린다.
        if (childrenOf(run, "hp", "secPr").length) continue;
        if (charPrId != null) run.setAttribute("charPrIDRef", String(charPrId));
      }
    }

    /** 골격 첫 문단이 '구역 정의만 있고 글은 비어 있는' 상태인가. */
    firstParagraphIsEmpty(sectionIndex = 0) {
      const ps = this.paragraphs(sectionIndex);
      if (!ps.length) return false;
      let text = "";
      for (const t of ps[0].getElementsByTagNameNS(NS.hp, "t")) text += t.textContent || "";
      return !text.trim();
    }

    appendParagraph(text, { sectionIndex = 0, paraPrId, styleId, charPrId } = {}) {
      const xdoc = this.section(sectionIndex);
      const p = sub(xdoc.documentElement, "hp:p", {
        paraPrIDRef: String(paraPrId ?? 0), styleIDRef: String(styleId ?? 0),
        pageBreak: "0", columnBreak: "0", merged: "0",
      });
      p.setAttribute("id", String(this.paragraphCount(sectionIndex) - 1));
      const run = sub(p, "hp:run", { charPrIDRef: String(charPrId ?? 0) });
      sub(run, "hp:t").textContent = text;
      return p;
    }

    _targetParagraph(sectionIndex, index, charPrId) {
      let ps = this.paragraphs(sectionIndex);
      if (!ps.length) { this.appendParagraph("", { sectionIndex, charPrId }); ps = this.paragraphs(sectionIndex); }
      return ps[index == null ? ps.length - 1 : index];
    }
    _appendRun(sectionIndex, index, charPrId) {
      return sub(this._targetParagraph(sectionIndex, index, charPrId), "hp:run",
                 { charPrIDRef: String(charPrId ?? 0) });
    }

    /** ⚠️ 넘긴 XML 을 `<hp:run>` 으로 한 번 더 감싼다 — 안쪽 `<hp:t>` 만 넘길 것.
     *  `<hp:run>` 을 통째로 넘기면 run 안에 run 이 중첩돼 한글이 뒤 글자를 안 그린다. */
    appendRunXml(xml, { sectionIndex = 0, paragraphIndex, charPrId } = {}) {
      const run = this._appendRun(sectionIndex, paragraphIndex, charPrId);
      run.appendChild(fragment(this.section(sectionIndex), xml));
    }

    appendEquation(script, { sectionIndex = 0, paragraphIndex, charPrId,
                             baseUnit = 1100, width = 4800, height = 2300 } = {}) {
      const run = this._appendRun(sectionIndex, paragraphIndex, charPrId);
      this._control += 1;
      const eq = sub(run, "hp:equation", {
        id: String(this._control), zOrder: String(this._control), numberingType: "EQUATION",
        textWrap: "TOP_AND_BOTTOM", textFlow: "BOTH_SIDES", lock: "0", dropcapstyle: "None",
        version: "Equation Version 60", baseLine: "93", textColor: "#000000",
        baseUnit: String(baseUnit), lineMode: "CHAR", font: "HYhwpEQ",
      });
      sub(eq, "hp:sz", { width: String(width), widthRelTo: "ABSOLUTE",
                         height: String(height), heightRelTo: "ABSOLUTE", protect: "0" });
      sub(eq, "hp:pos", { treatAsChar: "1", affectLSpacing: "0", flowWithText: "1",
                          allowOverlap: "0", holdAnchorAndSO: "0", vertRelTo: "PARA",
                          horzRelTo: "COLUMN", vertAlign: "TOP", horzAlign: "LEFT",
                          vertOffset: "0", horzOffset: "0" });
      sub(eq, "hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });
      const script_ = sub(eq, "hp:script");
      script_.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      script_.textContent = script;
    }

    appendPicture(name, data, { sectionIndex = 0, paragraphIndex, charPrId,
                                width = 7200, height = 7200 } = {}) {
      const clean = name.split("/").pop();
      const dot = clean.lastIndexOf(".");
      const stem = dot > 0 ? clean.slice(0, dot) : clean || "image";
      const suffix = dot > 0 ? clean.slice(dot) : "";
      let candidate = clean; let n = 2;
      while (this.parts.has("BinData/" + candidate)) { candidate = stem + "_" + n + suffix; n += 1; }
      const manifestId = this._manifestId(stem);
      this.parts.set("BinData/" + candidate, { bytes: data });

      const hpf = this.part("Contents/content.hpf").xml;
      const manifest = firstByLocal(hpf.documentElement, "opf", "manifest");
      const item = el(hpf, "opf:item", {
        id: manifestId, href: "BinData/" + candidate,
        "media-type": suffix.toLowerCase() === ".png" ? "image/png" : "image/jpeg",
        isEmbeded: "1",
      });
      manifest.appendChild(item);

      const run = this._appendRun(sectionIndex, paragraphIndex, charPrId);
      this._control += 1;
      const cid = String(this._control);
      const pic = sub(run, "hp:pic", {
        id: cid, zOrder: cid, numberingType: "PICTURE", textWrap: "TOP_AND_BOTTOM",
        textFlow: "BOTH_SIDES", lock: "0", dropcapstyle: "None", href: "",
        groupLevel: "0", instid: cid, reverse: "0",
      });
      sub(pic, "hp:offset", { x: "0", y: "0" });
      sub(pic, "hp:orgSz", { width: String(width), height: String(height) });
      sub(pic, "hp:curSz", { width: String(width), height: String(height) });
      sub(pic, "hp:flip", { horizontal: "0", vertical: "0" });
      sub(pic, "hp:rotationInfo", { angle: "0", centerX: String(Math.floor(width / 2)),
                                    centerY: String(Math.floor(height / 2)), rotateimage: "1" });
      const render = sub(pic, "hp:renderingInfo");
      for (const tag of ["transMatrix", "rotMatrix"]) {
        sub(render, "hc:" + tag, { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
      }
      sub(render, "hc:scaMatrix", { e1: "1.000000", e5: "1.000000" });
      sub(pic, "hc:img", { binaryItemIDRef: manifestId, bright: "0", contrast: "0",
                           effect: "REAL_PIC", alpha: "0" });
      const rect = sub(pic, "hp:imgRect");
      [[0, 0], [width, 0], [width, height], [0, height]].forEach(([x, y], k) => {
        sub(rect, "hc:pt" + k, { x: String(x), y: String(y) });
      });
      sub(pic, "hp:imgClip", { left: "0", right: String(width), top: "0", bottom: String(height) });
      sub(pic, "hp:inMargin", { left: "0", right: "0", top: "0", bottom: "0" });
      sub(pic, "hp:imgDim", { dimwidth: String(width), dimheight: String(height) });
      sub(pic, "hp:effects");
      sub(pic, "hp:sz", { width: String(width), widthRelTo: "ABSOLUTE",
                          height: String(height), heightRelTo: "ABSOLUTE", protect: "0" });
      sub(pic, "hp:pos", { treatAsChar: "1", affectLSpacing: "0", flowWithText: "1",
                           allowOverlap: "0", holdAnchorAndSO: "0", vertRelTo: "PARA",
                           horzRelTo: "COLUMN", vertAlign: "TOP", horzAlign: "LEFT",
                           vertOffset: "0", horzOffset: "0" });
      sub(pic, "hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });
    }

    /** ⚠️ 한글 빈 문서의 테두리 정의는 전부 '없음' 이다 — 그대로 쓰면 선이 안 보인다. */
    addBorderFill({ borderType = "SOLID", width = "0.12 mm", color = "#000000" } = {}) {
      const head = this.part("Contents/header.xml").xml;
      const fills = firstByLocal(head.documentElement, "hh", "borderFills");
      if (!fills) throw new Error("HWPX header.xml 에 borderFills 가 없습니다");
      const used = childrenOf(fills, "hh", "borderFill")
        .map((c) => parseInt(c.getAttribute("id"), 10)).filter((n) => !isNaN(n));
      const newId = String(used.length ? Math.max(...used) + 1 : 1);
      const sides = ["leftBorder", "rightBorder", "topBorder", "bottomBorder"]
        .map((s) => `<hh:${s} type="${borderType}" width="${width}" color="${color}"/>`).join("");
      fills.appendChild(fragment(head,
        `<hh:borderFill xmlns:hh="${NS.hh}" xmlns:hc="${NS.hc}" id="${newId}" threeD="0" shadow="0" ` +
        'centerLine="NONE" breakCellSeparateLine="0">' +
        '<hh:slash type="NONE" Crooked="0" isCounter="0"/>' +
        '<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>' + sides +
        `<hh:diagonal type="SOLID" width="${width}" color="${color}"/>` +
        '<hc:fillBrush><hc:winBrush faceColor="none" hatchColor="#000000" alpha="0"/></hc:fillBrush>' +
        "</hh:borderFill>"));
      fills.setAttribute("itemCnt", String(used.length + 1));
      return newId;
    }

    appendTable(rows, { sectionIndex = 0, paragraphIndex, charPrId, header = true,
                        headerCharPrId, bodyCharPrId, colWidth = 16000, rowHeight = 1800,
                        tableBorderFillId = "1", cellBorderFillId = "2" } = {}) {
      const rowCount = rows.length; const colCount = rows[0].length;
      const run = this._appendRun(sectionIndex, paragraphIndex, charPrId);
      this._control += 1;
      const cid = String(this._control);
      const table = sub(run, "hp:tbl", {
        id: cid, zOrder: cid, numberingType: "TABLE", textWrap: "TOP_AND_BOTTOM",
        textFlow: "BOTH_SIDES", lock: "0", dropcapstyle: "None", pageBreak: "CELL",
        repeatHeader: "1", rowCnt: String(rowCount), colCnt: String(colCount),
        cellSpacing: "0", borderFillIDRef: tableBorderFillId, noAdjust: "0",
      });
      sub(table, "hp:sz", { width: String(colWidth * colCount), widthRelTo: "ABSOLUTE",
                            height: String(rowHeight * rowCount), heightRelTo: "ABSOLUTE", protect: "0" });
      sub(table, "hp:pos", { treatAsChar: "1", affectLSpacing: "0", flowWithText: "1",
                             allowOverlap: "0", holdAnchorAndSO: "0", vertRelTo: "PARA",
                             horzRelTo: "COLUMN", vertAlign: "TOP", horzAlign: "LEFT",
                             vertOffset: "0", horzOffset: "0" });
      sub(table, "hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });
      sub(table, "hp:inMargin", { left: "141", right: "141", top: "141", bottom: "141" });
      rows.forEach((row, r) => {
        const tr = sub(table, "hp:tr");
        row.forEach((text, c) => {
          const isHeader = header && r === 0;
          const cellChar = (isHeader ? headerCharPrId : bodyCharPrId) || charPrId || "0";
          const tc = sub(tr, "hp:tc", { name: "", header: isHeader ? "1" : "0", hasMargin: "0",
                                        protect: "0", editable: "0", dirty: "0",
                                        borderFillIDRef: cellBorderFillId });
          const list = sub(tc, "hp:subList", { id: "", textDirection: "HORIZONTAL",
            lineWrap: "BREAK", vertAlign: "CENTER", linkListIDRef: "0", linkListNextIDRef: "0",
            textWidth: "0", textHeight: "0", hasTextRef: "0", hasNumRef: "0" });
          this._cellPara += 1;
          const cellP = sub(list, "hp:p", { id: String(this._cellPara), paraPrIDRef: "0",
            styleIDRef: "0", pageBreak: "0", columnBreak: "0", merged: "0" });
          const cellRun = sub(cellP, "hp:run", { charPrIDRef: String(cellChar) });
          sub(cellRun, "hp:t").textContent = text;
          sub(tc, "hp:cellAddr", { colAddr: String(c), rowAddr: String(r) });
          sub(tc, "hp:cellSpan", { colSpan: "1", rowSpan: "1" });
          sub(tc, "hp:cellSz", { width: String(colWidth), height: String(rowHeight) });
          sub(tc, "hp:cellMargin", { left: "141", right: "141", top: "141", bottom: "141" });
        });
      });
    }

    _manifestId(preferred) {
      const hpf = this.part("Contents/content.hpf").xml;
      const ids = new Set();
      for (const it of hpf.getElementsByTagNameNS(NS.opf, "item")) ids.add(it.getAttribute("id"));
      let value = preferred || "image"; let n = 2;
      while (ids.has(value)) { value = preferred + "_" + n; n += 1; }
      return value;
    }

    async toBlob() {
      const encoder = new TextEncoder();
      const files = new Map();
      for (const [name, part] of this.parts) {
        files.set(name, part.bytes
          ? part.bytes
          : encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
                           serializer().serializeToString(part.xml.documentElement)));
      }
      return zip(files, new Set(["mimetype"]));
    }
  }

  global.PedagogyHwpx = {
    NS, MARKS, HGND, MM_TO_HWPUNIT, HwpxDocument, UnsupportedTex,
    texToHwp, imageSize, xmlEscape, unzip, zip,
  };
})(window);
