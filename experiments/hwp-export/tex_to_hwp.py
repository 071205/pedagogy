"""LaTeX → HWP 수식 스크립트 변환 (베타).

왜 직접 만드는가
----------------
모의고사 편집기는 문항을 LaTeX 로 쓰고 KaTeX 로 미리보기를 그린다. 이걸 한글로 내보내려면
LaTeX 을 HWP 수식 스크립트로 바꿔야 한다. 웹 변환기(foreducator 등)가 있지만 외부 서비스에
의존할 수는 없다 — 오프라인에서도 되어야 하고, 서비스가 사라지면 내보내기가 죽는다.

대응 관계는 `2025학년도 수능 수학 문제.hwp` 의 **실제 수식 522개**를 읽어 유도했다.
추측이 아니라 실물에서 나온 것이다.

    {a} over {b}        \\frac{a}{b}
    sqrt {3} of {5}     \\sqrt[3]{5}
    left ( … right )    \\left( … \\right)
    leq / geq           \\leq / \\geq
    cases{ A # B }      \\begin{cases}   (# 가 행 구분)
    sum _{k=1}^{n}      \\sum_{k=1}^{n}
    lim _{n rarrow inf} \\lim_{n \\to \\infty}

⚠️ 이 변환기는 **모의고사에 실제로 쓰이는 범위**만 다룬다. LaTeX 전체를 덮지 않는다.
   모르는 명령을 만나면 조용히 버리지 않고 `UnsupportedTex` 를 던진다 —
   조용히 버리면 시험지에 수식이 빠진 채로 인쇄된다.

출처와 고지
-----------
아래 대응표는 한글과컴퓨터가 공개한 **『한글 문서 파일 구조 - 수식』 revision 1.3** 을
근거로 한다(그 전에는 실물 시험지 522개 수식에서 역으로 추측한 것이었다).

⚠️ 그 공개 문서의 저작권 조항은 참고해 만든 결과물에 다음을 **반드시 기재**하도록 요구한다:

    "본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."

그래서 이 고지는 소스(이 주석)와 사용자에게 보이는 곳 양쪽에 남아 있어야 한다.
이 문구를 지우지 말 것 — 배포 조건이다.
"""

from __future__ import annotations

import re


class UnsupportedTex(Exception):
    """변환할 수 없는 LaTeX. 조용히 넘기지 않고 호출한 쪽에 알린다."""


# 이름만 바뀌는 것들 (실물 522개에서 실제로 쓰인 것 위주)
SIMPLE = {
    "times": "times", "div": "div", "pm": "+-", "mp": "-+",
    "leq": "leq", "le": "leq", "geq": "geq", "ge": "geq",
    "neq": "!=", "ne": "!=", "approx": "approx", "equiv": "equiv",
    "infty": "inf", "to": "rarrow", "rightarrow": "rarrow",
    "leftarrow": "larrow", "Rightarrow": "RARROW", "cdot": "cdot",
    "cdots": "cdots", "ldots": "dotslow", "dots": "dotslow",
    "alpha": "alpha", "beta": "beta", "gamma": "gamma", "delta": "delta",
    "theta": "theta", "lambda": "lambda", "mu": "mu", "pi": "pi",
    "sigma": "sigma", "omega": "omega", "Delta": "DELTA", "Sigma": "SIGMA",
    "Omega": "OMEGA", "phi": "phi", "varphi": "varphi", "epsilon": "epsilon",
    "sum": "sum", "prod": "prod", "int": "int", "lim": "lim",
    "sin": "sin", "cos": "cos", "tan": "tan", "log": "log", "ln": "ln",
    "min": "min", "max": "max", "exp": "exp",
    "in": "in", "notin": "notin", "subset": "subset", "cup": "cup",
    "cap": "cap", "emptyset": "emptyset", "forall": "forall", "exists": "exists",
    "prime": "prime", "circ": "circ", "angle": "angle", "perp": "perp",
    "quad": "~~", "qquad": "~~~~", ",": "`", ";": "`", "!": "",
    # 규격서(수식 revision 1.3) 1.2 기본 명령어·1.2.4 기호 종류에서 확인한 것들.
    # 예전에는 실물 시험지에 나온 것만 넣어서 이 아래가 통째로 빠져 있었다.
    "oint": "oint", "iint": "dint", "iiint": "tint",
    "cong": "cong", "sim": "sim", "propto": "propto",
    "supset": "supset", "subseteq": "subseteq", "supseteq": "supseteq",
    "setminus": "\\", "nabla": "nabla", "partial": "partial",
    "aleph": "aleph", "hbar": "hbar", "ell": "ell", "Re": "imag", "wp": "wp",
    "vartheta": "vartheta", "varpi": "varpi", "varsigma": "varsigma",
    "varupsilon": "varupsilon", "varepsilon": "varepsilon",
    "eta": "eta", "zeta": "zeta", "iota": "iota", "kappa": "kappa", "nu": "nu",
    "xi": "xi", "rho": "rho", "tau": "tau", "upsilon": "upsilon", "chi": "chi",
    "psi": "psi", "Gamma": "GAMMA", "Theta": "THETA", "Lambda": "LAMBDA",
    "Xi": "XI", "Pi": "PI", "Phi": "PHI", "Psi": "PSI",
    "leftrightarrow": "lrarrow", "Leftarrow": "LARROW",
    "Leftrightarrow": "LRARROW", "mp2": "-+",
    # ⚠️ `\ `(역슬래시+공백)와 `\:` 도 LaTeX 의 공백 명령이다. 30문항 시험지를 처음
    #    변환해 보고서야 빠진 것을 알았다 — `\mathrm{B}\!\left(20,\ \frac13\right)`
    #    처럼 실제로 흔히 쓰는 표기가 통째로 `[수식 변환 실패]` 로 나갔다.
    " ": "`", ":": "`",
}

# 인자 하나를 받아 앞에 붙는 것들
# 규격서(수식 revision 1.3) 1.2.1 '글자 장식 명령어' 표를 그대로 옮긴 것.
ACCENT = {"vec": "vec", "bar": "bar", "hat": "hat", "tilde": "tilde",
          "dot": "dot", "ddot": "ddot", "overline": "bar",
          "acute": "acute", "grave": "grave", "check": "check",
          "breve": "arch", "underline": "under", "widehat": "hat",
          "widetilde": "tilde",
          "mathrm": "rm", "mathit": "it", "mathbf": "bold", "text": "rm",
          "operatorname": "rm", "mathsf": "rm", "mathbb": "rm"}

# 규격서 1.1.2.3 — 한 낱말이 이 길이를 넘으면 한글이 두 항으로 쪼갠다.
MAX_TERM_CHARS = 9

# LaTeX 의 '조판 힌트' — HWP 에는 대응물이 없고 한글이 알아서 크기를 정한다.
# 버려도 뜻이 달라지지 않으므로 조용히 무시하는 것이 맞다. 반대로 뜻이 있는 명령을
# 여기 넣으면 수식이 조용히 틀려지므로, 넣기 전에 '없어도 뜻이 같은가' 를 확인할 것.
NOOP = {"displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle",
        "limits", "nolimits", "left.", "right.", "mathstrut", "strut"}


def _skip_ws(s: str, i: int) -> int:
    while i < len(s) and s[i].isspace():
        i += 1
    return i


def _read_group(s: str, i: int) -> tuple[str, int]:
    """`{...}` 를 읽어 (안쪽 원문, 다음 위치) 를 준다. 중첩 중괄호를 센다."""
    i = _skip_ws(s, i)
    if i >= len(s):
        raise UnsupportedTex("인자가 필요한 자리에서 수식이 끝났습니다")
    if s[i] != "{":
        # `x^2` 처럼 한 글자만 오는 경우, 또는 `\alpha` 처럼 명령 하나
        if s[i] == "\\":
            m = re.match(r"\\([A-Za-z]+|.)", s[i:])
            return s[i:i + m.end()], i + m.end()
        return s[i], i + 1
    depth, start = 0, i
    while i < len(s):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                return s[start + 1:i], i + 1
        i += 1
    raise UnsupportedTex("중괄호가 닫히지 않았습니다")


def _read_optional(s: str, i: int) -> tuple[str | None, int]:
    """`\\sqrt[3]{x}` 의 `[3]` 처럼 선택 인자를 읽는다."""
    j = _skip_ws(s, i)
    if j < len(s) and s[j] == "[":
        end = s.find("]", j)
        if end < 0:
            raise UnsupportedTex("대괄호가 닫히지 않았습니다")
        return s[j + 1:end], end + 1
    return None, i


def _split_top(body: str, sep: str) -> list[str]:
    """중괄호 깊이 0 에서만 구분자로 자른다 (`\\\\` 나 `&`)."""
    out, depth, buf, i = [], 0, [], 0
    while i < len(body):
        c = body[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        if depth == 0 and body.startswith(sep, i):
            out.append("".join(buf))
            buf = []
            i += len(sep)
            continue
        buf.append(c)
        i += 1
    out.append("".join(buf))
    return out


def convert(tex: str) -> str:
    """LaTeX 수식 한 덩어리를 HWP 수식 스크립트로 바꾼다."""
    out: list[str] = []
    i = 0
    while i < len(tex):
        c = tex[i]

        if c != "\\":
            if c == "{":
                inner, i = _read_group(tex, i)
                out.append("{" + convert(inner) + "}")
                continue
            if c == "}":
                raise UnsupportedTex("짝이 맞지 않는 '}' 가 있습니다")
            if c in "^_":
                # ⚠️ 위·아래 첨자의 범위를 반드시 중괄호로 묶어 낸다.
                #    LaTeX 의 `x^2-a` 는 x²−a 지만, 그대로 옮기면 HWP 는 `^` 가 뒤를 더
                #    먹어 x^(2−a) 로 조판한다(한글에서 실제로 그렇게 나왔다).
                #    수식이 조용히 다른 뜻이 되는 종류의 버그라 예외 없이 묶는다.
                arg, i = _read_group(tex, i + 1)
                out.append(c + "{" + convert(arg) + "}")
                continue
            # ⚠️ 규격서 1.1.2.3 — **한 낱말이 9자를 넘으면 한글이 두 항으로 쪼갠다.**
            #    그래서 긴 낱말은 영문 따옴표로 묶어 하나로 만들어야 한다. 안 그러면
            #    수식이 조용히 다른 모양으로 조판된다(오류가 아니라 결과가 달라진다).
            run = re.match(r"[A-Za-z0-9]+", tex[i:])
            if run:
                word = run.group(0)
                out.append(f'"{word}"' if len(word) > MAX_TERM_CHARS else word)
                i += run.end()
                continue
            out.append(c)
            i += 1
            continue

        m = re.match(r"\\([A-Za-z]+|.)", tex[i:])
        if not m:
            raise UnsupportedTex("'\\' 뒤에 명령이 없습니다")
        name = m.group(1)
        i += m.end()

        if name == "frac" or name == "dfrac" or name == "tfrac":
            a, i = _read_group(tex, i)
            b, i = _read_group(tex, i)
            out.append("{" + convert(a) + "} over {" + convert(b) + "}")
        elif name == "sqrt":
            opt, i = _read_optional(tex, i)
            a, i = _read_group(tex, i)
            if opt is None:
                out.append("sqrt {" + convert(a) + "}")
            else:
                out.append("sqrt {" + convert(opt) + "} of {" + convert(a) + "}")
        elif name == "left":
            # ⚠️ 앞뒤 공백이 반드시 있어야 한다. `f\left(` 를 `fleft(` 로 붙여 내면
            #    HWP 가 `fleft` 를 식별자 하나로 읽어 괄호가 사라진다(실제로 그랬다).
            j = _skip_ws(tex, i)
            out.append(" left " + tex[j] + " ")
            i = j + 1
        elif name == "right":
            j = _skip_ws(tex, i)
            out.append(" right " + tex[j] + " ")
            i = j + 1
        elif name == "begin" or name == "end":
            env, i = _read_group(tex, i)
            if name == "end":
                raise UnsupportedTex(f"짝이 없는 \\end{{{env}}}")
            close = "\\end{" + env + "}"
            k = tex.find(close, i)
            if k < 0:
                raise UnsupportedTex(f"\\begin{{{env}}} 의 짝을 찾지 못했습니다")
            body, i = tex[i:k], k + len(close)
            out.append(_convert_env(env, body))
        elif name in ACCENT:
            a, i = _read_group(tex, i)
            out.append(f"{ACCENT[name]} {{{convert(a)}}}")
        elif name in NOOP:
            pass                        # 조판 힌트 — 버려도 뜻이 같다
        elif name in SIMPLE:
            out.append(" " + SIMPLE[name] + " ")
        elif name == "\\":
            out.append(" # ")           # 줄바꿈 (환경 밖)
        elif name == "{" or name == "}":
            # ⚠️ HWP 에서 `{}` 는 '묶음' 기호라 그대로 내면 화면에 보이지 않는다.
            #    수열 `\{a_n\}` 의 중괄호가 통째로 사라졌다. 글자로 찍히는 것은
            #    `lbrace`/`rbrace` 다.
            out.append(" lbrace " if name == "{" else " rbrace ")
        elif name in "%$&_#":
            out.append(name)
        else:
            raise UnsupportedTex(f"아직 지원하지 않는 명령: \\{name}")

    return re.sub(r"\s+", " ", "".join(out)).strip()


def _convert_env(env: str, body: str) -> str:
    """`cases`·`matrix` 계열 환경. 행은 `#`, 열은 `&` 로 바뀐다."""
    rows = [r for r in _split_top(body, "\\\\")]
    conv_rows = []
    for row in rows:
        cols = _split_top(row, "&")
        conv_rows.append(" & ".join(convert(c) for c in cols if c.strip() or len(cols) == 1))
    joined = " # ".join(r for r in conv_rows if r.strip())

    if env == "cases":
        return "cases{ " + joined + " }"
    if env in ("pmatrix", "bmatrix", "matrix", "vmatrix", "Vmatrix"):
        # ⚠️ 한글에는 `vmatrix` 라는 명령이 **없다**. 규격서(수식 revision 1.3, 1.2절)의
        #    행렬 명령은 MATRIX · PMATRIX · BMATRIX · DMATRIX 넷뿐이고, 세로줄로 감싸는
        #    것이 DMATRIX 다. 예전에는 `vmatrix` 를 그대로 내보내 한글이 모르는 명령이
        #    시험지에 들어갔다.
        return {"pmatrix": "pmatrix", "bmatrix": "bmatrix", "matrix": "matrix",
                "vmatrix": "dmatrix", "Vmatrix": "dmatrix"}[env] + "{ " + joined + " }"
    if env in ("aligned", "align", "eqalign", "array"):
        return "eqalign{ " + joined + " }"
    raise UnsupportedTex(f"아직 지원하지 않는 환경: {env}")


def normalize(script: str) -> str:
    """공백 차이를 무시하고 비교하기 위한 정규화.

    HWP 스크립트는 `` ` `` 와 `~` 도 공백이라 실물끼리도 표기가 흔들린다.
    """
    s = script.replace("`", " ").replace("~", " ")
    s = re.sub(r"\s+", " ", s)
    # 구분 기호 둘레의 공백은 조판에 영향이 없다. 반면 `f left` 처럼 낱말 사이의
    # 공백은 의미가 있으므로(붙이면 식별자 하나가 된다) 여기서 지우지 않는다.
    s = re.sub(r"\s*([{}()\[\]^_&#])\s*", r"\1", s)
    return s.strip().lower()
