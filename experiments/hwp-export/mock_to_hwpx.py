"""모의고사 편집기 JSON → HWPX 시험지 (베타).

`mock-exam-editor.html` 의 저장 버튼이 내보내는 `.json` 을 그대로 받아 한글 시험지를 만든다.
편집기 자체는 건드리지 않는다 — 저장한 파일을 이 스크립트에 넘기면 된다.

    python3 mock_to_hwpx.py 시험지.json [out.hwpx]

조판 값은 `2025학년도 수능 수학 문제.hwp` 에서 읽어 온 것이다(README 참고).

⚠️ 유닛을 훑는 순서는 편집기의 `probUnits()` 를 옮긴 것이다. 편집기 쪽이 바뀌면
   여기도 같이 고쳐야 한다 — 두 곳이 어긋나면 화면과 시험지가 달라진다.
   (편집기는 `paintProblem()` + 팔레트로 HTML/Typst 를 공유한다. 언젠가 이 변환기도
    같은 구조로 들어가는 것이 맞지만, 지금은 제품과 분리해 두는 것이 우선이다.)
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jakal_hwpx import HwpxDocument  # noqa: E402

import exam_profile  # noqa: E402
import template as tmpl  # noqa: E402
import exam_style  # noqa: E402
from make_math_probe import HP, apply_layout  # noqa: E402
from tex_to_hwp import UnsupportedTex, convert  # noqa: E402

# 조판 규격을 읽어 올 실물 시험지. 없으면 exam_profile 의 임시 기본값으로 내려간다.
# 조판 규격을 가져올 곳. 한글이 직접 저장한 .hwpx 가 있으면 그것을 **틀로 통째로** 쓴다
# (테두리·머리말·탭 정의까지 따라온다). 없으면 .hwp 에서 값만 읽어 빈 문서에 심는다.
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEMPLATE = ROOT / "평가원 수학 양식.hwpx"
DEFAULT_REF = ROOT / "2025학년도 수능 수학 문제.hwp"

MARKS = ["①", "②", "③", "④", "⑤"]
HGND = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"]


@dataclass
class Report:
    problems: int = 0
    equations: int = 0
    figures: int = 0
    breaks: int = 0
    choice_rows: int = 0
    warnings: list[str] = field(default_factory=list)


def xml_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;").replace("'", "&apos;"))


STYLE: dict[str, str] = {}      # exam_style.install() 결과 — build() 에서 채운다
IMAGE_ROOTS: list[Path] = []    # 그림 파일을 찾을 폴더들 — build() 에서 채운다
PROFILE: dict = {}              # exam_profile.profile_from() 결과


def eq_base() -> int:
    """수식 기준 크기(1/100pt).

    ⚠️ 본문 크기가 아니다. 실물은 본문 11.5pt 에 수식 11.0pt 를 쓴다(522개 전부).
       본문 크기를 넣으면 수식만 도드라져 보인다.
    """
    base = PROFILE.get("_eq_base")
    if base:
        return int(base)
    try:
        return round(float(PROFILE["cont"]["char"]["pt"]) * 100)
    except Exception:
        return 1100


def append_text_run(doc: HwpxDocument, para_idx: int, text: str,
                    *, char: str = "char_stem") -> None:
    """문단 뒤에 글자 조각 하나를 잇는다.

    ⚠️ `append_run_xml()` 은 넘긴 XML 을 `<hp:run>` 으로 **한 번 더 감싼다.**
       그래서 `<hp:run>…</hp:run>` 을 통째로 넘기면 run 안에 run 이 중첩되고,
       한글은 그 문단의 뒤쪽 글자를 통째로 그리지 않는다(수식 뒤 한글이 사라지고
       선지가 `① 12345` 로 뭉개졌다). 안쪽 `<hp:t>` 만 넘겨야 한다.
    """
    doc.append_run_xml(f'<hp:t xmlns:hp="{HP}">{xml_escape(text)}</hp:t>',
                       paragraph_index=para_idx,
                       char_pr_id=STYLE.get(char))





# ── 선지 ──────────────────────────────────────────────────────────────────
# 실물은 선지를 **탭 정지점**으로 단 폭에 고르게 펼친다. 공백으로 이어 붙이면
# 왼쪽에 몰린다(실제로 그랬다). 탭은 `<hp:t>` **안에** `<hp:tab/>` 으로 넣는다.
#
# 한 줄에 몇 칸인지에 따라 문단 모양이 다르다(탭 개수가 다르므로):
#   5칸 → row5(탭 25.6/47.2/68.8/90.4mm) · 3칸 → row3(40/76mm) · 2칸 → row2(58mm)
#
# 배치 규칙은 편집기의 layoutOf() 와 같아야 한다:
#   '1' 한 줄 5개 · '2' 3+2 두 줄 · 'v' 세로
#   'auto' 면 ㄱㄴㄷ 합답형은 무조건 '2', 아니면 폭으로 고른다.
GND = "ㄱㄴㄷ"

# 편집기의 measureCh() 기준(mm). 실물 탭 간격과 같은 값이다.
FIT1_SLOT = 21.6      # 1행일 때 한 칸
FIT2_SLOT = 36.0      # 3+2일 때 한 칸
COL_W_MM = 111.15     # 단 폭


def _text_mm(s: str) -> float:
    """글자 폭 어림값(mm). 본문 11.5pt·장평 95% 기준.

    ⚠️ 편집기는 canvas 로 실제 폭을 재지만(`measureCh`) 여기서는 잴 수 없다.
       그래서 'auto' 판정은 **근사**다. 정확히 맞추려면 편집기에서 배치를
       직접 지정하면 된다(그 값은 그대로 따른다).
    """
    wide = sum(1 for c in s if ord(c) > 0x2000)      # 한글·기호
    narrow = len(s) - wide
    return wide * 3.85 + narrow * 1.93


def layout_of(p: dict, items: list[str]) -> str:
    lay = str(p.get("layout") or "auto")
    blk = next((b for b in blocks_of(p) if b.get("type") == "choices"), None)
    if blk:
        lay = str((blk.get("data") or {}).get("layout") or lay)
    if lay in ("1", "2", "v"):
        return lay
    if any(any(g in c for g in GND) for c in items):
        return "2"                       # ㄱㄴㄷ 합답형은 폭과 무관하게 3+2
    w = [_text_mm(f"⑤ {c}") for c in items]
    if all(x <= (COL_W_MM - 90.4 if i == len(w) - 1 else FIT1_SLOT - 1.0)
           for i, x in enumerate(w)):
        return "1"
    if all(x <= (COL_W_MM - 76 - 1 if i in (2, len(w) - 1) else FIT2_SLOT - 1.0)
           for i, x in enumerate(w)):
        return "2"
    return "v"


def _row_para(layout: str) -> str:
    """선지 배치에 해당하는 문단 역할 이름.

    ⚠️ 배치 전체가 한 문단 모양을 쓴다. 3+2 라면 ①②③ 줄과 ④⑤ 줄이 **같은** 것을
       써야 ④가 ① 아래에, ⑤가 ② 아래에 선다. 줄마다 다른 것을 주면 아래 줄이
       엉뚱하게 벌어진다(실제로 그랬다).
    """
    role = {"1": "para_ch1row", "2": "para_ch2row", "v": "para_ch1row"}.get(
        layout, "para_ch1row")
    if role in STYLE:
        return role
    return "para_choice" if "para_choice" in STYLE else "para_cont"


def emit_choice_row(doc: HwpxDocument, items: list[tuple[int, str]], rep: Report,
                    *, where: str, layout: str) -> None:
    """선지 한 줄. 항목 사이를 탭으로 벌린다."""
    if not items:
        return
    para = _row_para(layout)
    char = "char_choice" if "char_choice" in STYLE else "char_stem"
    first = True
    idx = -1
    for mark_i, body in items:
        label = f"{MARKS[mark_i % len(MARKS)]} "
        if first:
            idx = emit_rich(doc, label + body, rep, where=where, para=para, char=char)
            first = False
        else:
            # 탭 뒤에 이어 붙인다 — 탭은 <hp:t> 안에 들어간다.
            doc.append_run_xml(
                f'<hp:t xmlns:hp="{HP}"><hp:tab width="0" leader="0" type="1"/>'
                f'{xml_escape(label)}</hp:t>',
                paragraph_index=idx, char_pr_id=STYLE.get(char))
            for kind, chunk in split_inline(body):
                if kind == "text":
                    append_text_run(doc, idx, chunk, char=char)
                else:
                    try:
                        doc.append_inline_equation(
                            convert(chunk), paragraph_index=idx,
                            char_pr_id=STYLE.get(char),
                            base_unit=eq_base())
                        rep.equations += 1
                    except UnsupportedTex as e:
                        rep.warnings.append(f"{where}: 선지 수식 변환 실패 — {e}")
                        append_text_run(doc, idx, f"[변환 실패: {chunk}]", char=char)


def emit_choices(doc: HwpxDocument, p: dict, unit: dict, rep: Report,
                 *, where: str) -> None:
    items = [c for c in unit["items"]]
    used = [(i, c) for i, c in enumerate(items) if c.strip()]
    if not used:
        return
    lay = layout_of(p, [c for _, c in used])
    if lay == "1":
        emit_choice_row(doc, used, rep, where=where, layout=lay)
    elif lay == "2":
        emit_choice_row(doc, used[:3], rep, where=where, layout=lay)
        emit_choice_row(doc, used[3:], rep, where=where, layout=lay)
    else:                                  # 'v' — 한 줄에 하나씩
        for one in used:
            emit_choice_row(doc, [one], rep, where=where, layout=lay)
    rep.choice_rows += 1 if lay == "1" else (2 if lay == "2" else len(used))


# ── 문항 배치 ─────────────────────────────────────────────────────────────
# 편집기의 buildPages() 와 같은 규칙이다. 여기서 다르게 나누면 화면 미리보기와
# 실제 시험지가 어긋난다.
#
#   · 한 단에 PER_COL 문항
#   · 문항의 breakAfter 가 켜져 있으면 거기서 단을 끊는다
#   · 다음 문항의 과목 구분(sect)이 달라지면 끊는다
#
# ⚠️ 편집기의 SPEC.perCol 이 바뀌면 이 값도 함께 고쳐야 한다.
PER_COL = 2


def column_starts(problems: list[dict]) -> set[int]:
    """새 단에서 시작해야 하는 문항의 인덱스."""
    starts, count = set(), 0
    for i, p in enumerate(problems):
        if count == 0 and i > 0:
            starts.add(i)
        count += 1
        nxt = problems[i + 1] if i + 1 < len(problems) else None
        if count >= PER_COL or p.get("breakAfter") or (nxt and nxt.get("sect") != p.get("sect")):
            count = 0
    return starts


def mark_column_break(doc: HwpxDocument) -> bool:
    """마지막으로 만든 문단을 '새 단에서 시작' 으로 표시한다.

    HWPX 는 문단 속성 하나로 끝난다 — 우리가 어느 단에 넣을지 계산할 필요가 없다.
    한글이 알아서 다음 단으로 넘긴다.
    """
    sec = doc.get_part("Contents/section0.xml")
    paras = [k for k in sec.root.children if k.local_name == "p"]
    if not paras:
        return False
    paras[-1].set_attr("columnBreak", "1")
    sec.mark_modified()
    return True


# ── 그림 ──────────────────────────────────────────────────────────────────
MM_TO_HWPUNIT = 7200 / 25.4


def image_size(data: bytes) -> tuple[int, int] | None:
    """PNG·JPEG 의 가로·세로(px). 비율을 지키려면 필요하다.

    외부 라이브러리(PIL)를 쓰지 않는다 — 이 실험의 의존성은 jakal-hwpx 하나뿐이고,
    헤더만 읽으면 되는 일에 의존성을 늘릴 이유가 없다.
    """
    if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
        return (int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big"))
    if data[:2] == b"\xff\xd8":                     # JPEG
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                return (int.from_bytes(data[i + 7:i + 9], "big"),
                        int.from_bytes(data[i + 5:i + 7], "big"))
            i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    return None


def find_image(src: str, roots: list[Path]) -> Path | None:
    """허용한 그림 폴더 안의 실제 파일만 찾는다.

    JSON은 가져오기 파일에서 올 수 있으므로 `../`나 절대 경로로 작업 폴더 밖 파일을
    HWPX에 넣게 하면 안 된다. 심볼릭 링크도 resolve() 뒤의 위치로 판정한다.
    """
    for root in roots:
        safe_root = root.resolve()
        cand = (safe_root / src).resolve()
        try:
            cand.relative_to(safe_root)
        except ValueError:
            continue
        if cand.is_file():
            return cand
    return None


def emit_figure(doc: HwpxDocument, unit: dict, rep: Report, *, where: str,
                roots: list[Path]) -> None:
    """그림 한 장. 파일을 못 찾으면 자리표시를 남기고 **경고한다.**

    조용히 빈자리로 두면 그림이 빠진 시험지가 인쇄된다.
    """
    src = (unit.get("src") or "").strip()
    width_mm = float(unit.get("w") or 0)
    para = ("para_figure" if "para_figure" in STYLE
            else ("para_eq" if "para_eq" in STYLE else "para_cont"))

    def placeholder(msg: str) -> None:
        rep.warnings.append(f"{where}: {msg}")
        doc.append_paragraph(f"[그림 없음 — {msg}]", para_pr_id=STYLE.get(para),
                             style_id=_sty(para), char_pr_id=STYLE.get("char_cont"))

    if not src:
        placeholder(f"그림 파일명이 지정되지 않았습니다 (너비 {width_mm:g}mm)")
        return
    path = find_image(src, roots)
    if path is None:
        placeholder(f"그림 파일을 찾지 못했습니다: {src}")
        return

    data = path.read_bytes()
    size = image_size(data)
    if not size or not size[0]:
        placeholder(f"그림 크기를 읽지 못했습니다(PNG·JPEG 만 지원): {src}")
        return

    w = round(width_mm * MM_TO_HWPUNIT)
    h = round(w * size[1] / size[0])          # 비율 유지
    doc.append_paragraph("", para_pr_id=STYLE.get(para), style_id=_sty(para),
                         char_pr_id=STYLE.get("char_cont"))
    doc.append_picture(path.name, data, paragraph_index=doc.paragraph_count() - 1,
                       width=w, height=h,
                       char_pr_id=STYLE.get("char_cont"))
    rep.figures += 1


# ── 편집기의 probUnits() 를 옮긴 것 ────────────────────────────────────────

def blocks_of(p: dict) -> list[dict]:
    b = p.get("blocks")
    return b if isinstance(b, list) and b else []


def prob_units(p: dict) -> tuple[list[dict], int]:
    units: list[dict] = []
    for b in blocks_of(p):
        d = b.get("data") or {}
        t = b.get("type")
        if t == "statement":
            raw = re.sub(r"\s*(\(단,)", r"\n\1", str(d.get("text") or ""))
            for line in (x.strip() for x in raw.split("\n")):
                if not line:
                    continue
                kind = "eq" if re.fullmatch(r"\$[^$]*\$", line) else "text"
                units.append({"k": kind, "t": line})
        elif t == "boxed":
            s = str(d.get("text") or "").strip()
            if s:
                units.append({"k": "boxed", "t": s})
        elif t in ("conditions", "examples"):
            items = [str(x) for x in (d.get("items") or []) if str(x).strip()]
            if items:
                units.append({"k": "cond" if t == "conditions" else "ex", "items": items})
        elif t == "choices":
            if p.get("type") == "short":     # 단답형은 선지를 시험지에 싣지 않는다
                continue
            items = [str(x or "") for x in (d.get("items") or [])]
            if any(x.strip() for x in items):
                units.append({"k": "choices", "items": items,
                              "layout": d.get("layout") or "auto"})
        elif t == "image":
            w = int(d.get("width") or 0)
            if w:
                units.append({"k": "fig", "w": w, "src": str(d.get("src") or "")})

    pts_at = -1
    for i, u in enumerate(units):
        if u["k"] == "text":
            pts_at = i
    if pts_at < 0:
        for i, u in enumerate(units):
            if u["k"] != "choices":
                pts_at = i
                break
    return units, pts_at


# ── 본문 조각 만들기 ──────────────────────────────────────────────────────

def split_inline(text: str) -> list[tuple[str, str]]:
    """`함수 $f(x)=x^3$에 대하여` → [('text','함수 '), ('eq','f(x)=x^3'), ('text','에 대하여')]"""
    parts: list[tuple[str, str]] = []
    for chunk in re.split(r"(\$[^$]*\$)", text):
        if not chunk:
            continue
        if chunk.startswith("$") and chunk.endswith("$") and len(chunk) >= 2:
            parts.append(("eq", chunk[1:-1]))
        else:
            parts.append(("text", chunk))
    return parts


def _sty(para: str) -> str | None:
    """문단 역할에 대응하는 틀의 '이름 붙은 스타일' id (있으면)."""
    return STYLE.get("style_" + para.removeprefix("para_"))


def emit_rich(doc: HwpxDocument, text: str, rep: Report, *, where: str,
              para: str = "para_stem", char: str = "char_stem",
              prefix: str = "", into: int | None = None) -> int:
    """텍스트와 인라인 수식이 섞인 문단 하나를 만들고 그 문단 번호를 준다.

    `prefix` 는 문항 번호처럼 **본문과 다른 서식**으로 나가야 하는 앞머리다.
    실물에서 번호는 본문보다 크다(13.5pt vs 11.5pt).
    """
    parts = split_inline(text)
    if into is not None:
        # 틀 문단(구역·단 정의를 안고 있는 첫 문단)에 그대로 이어 쓴다.
        # 새 문단을 만들면 비워진 틀 문단이 빈 줄로 남아 첫 문항이 밀린다.
        idx = into
        if prefix:
            doc.append_run_xml(f'<hp:t xmlns:hp="{HP}">{xml_escape(prefix)}</hp:t>',
                               paragraph_index=idx, char_pr_id=STYLE.get("char_num"))
        rest = parts
    elif prefix:
        doc.append_paragraph(prefix, para_pr_id=STYLE.get(para),
                             style_id=_sty(para),
                             char_pr_id=STYLE.get("char_num"))
        idx = doc.paragraph_count() - 1
        rest = parts
    else:
        lead = parts[0][1] if parts and parts[0][0] == "text" else ""
        doc.append_paragraph(lead, para_pr_id=STYLE.get(para),
                             style_id=_sty(para),
                             char_pr_id=STYLE.get(char))
        idx = doc.paragraph_count() - 1
        rest = parts[1:] if lead else parts

    for kind, body in rest:
        if kind == "text":
            append_text_run(doc, idx, body, char=char)
        else:
            try:
                script = convert(body)
            except UnsupportedTex as e:
                # 조용히 버리면 시험지에 수식이 빠진 채로 인쇄된다. 자리를 남기고 알린다.
                rep.warnings.append(f"{where}: 수식 변환 실패 — {e}  ({body})")
                append_text_run(doc, idx, f"[수식 변환 실패: {body}]", char=char)
                continue
            doc.append_inline_equation(script, paragraph_index=idx,
                                       char_pr_id=STYLE.get("char_stem"),
                                       base_unit=eq_base())
            rep.equations += 1
    return idx


def emit_display_eq(doc: HwpxDocument, tex: str, rep: Report, *, where: str) -> None:
    """`$...$` 한 줄만 있는 유닛 — 별행 수식."""
    body = tex[1:-1] if tex.startswith("$") and tex.endswith("$") else tex
    try:
        script = convert(body)
    except UnsupportedTex as e:
        rep.warnings.append(f"{where}: 별행 수식 변환 실패 — {e}  ({body})")
        doc.append_paragraph(f"[수식 변환 실패: {body}]")
        return
    eqp = "para_eq" if "para_eq" in STYLE else "para_cont"
    doc.append_paragraph("", para_pr_id=STYLE.get(eqp), style_id=_sty(eqp),
                         char_pr_id=STYLE.get("char_cont", STYLE.get("char_stem")))
    doc.append_equation(script, paragraph_index=doc.paragraph_count() - 1,
                        char_pr_id=STYLE.get("char_stem"),
                        base_unit=eq_base())
    rep.equations += 1


def emit_problem(doc: HwpxDocument, p: dict, rep: Report,
                 *, into: int | None = None) -> None:
    units, pts_at = prob_units(p)
    num = p.get("num", "?")
    where = f"{num}번"
    if not any(u["k"] != "choices" for u in units):
        doc.append_paragraph(f"{num}. (발문 비어 있음)",
                             para_pr_id=STYLE.get("para_stem"),
                             char_pr_id=STYLE.get("char_stem"))
        return

    first = True
    for i, u in enumerate(units):
        pts = (i == pts_at)
        tail = f"  [{p.get('pts', '')}점]" if pts and p.get("pts") else ""
        if u["k"] == "text":
            if first:
                emit_rich(doc, u["t"] + tail, rep, where=where,
                          para="para_stem", char="char_stem", prefix=f"{num}. ",
                          into=into)
                into = None
            else:
                # 둘째 줄부터는 실물처럼 '이어지는 줄' 서식을 쓴다.
                emit_rich(doc, u["t"] + tail, rep, where=where,
                          para="para_cont", char="char_cont")
            first = False
        elif u["k"] == "eq":
            emit_display_eq(doc, u["t"], rep, where=where)
        elif u["k"] == "boxed":
            emit_rich(doc, "〈" + u["t"] + "〉", rep, where=where, para="para_cont", char="char_cont")
        elif u["k"] == "cond":
            # 실물은 상자를 앞뒤 여백 문단으로 감싼다(박스위 → 상자 → 박스아래).
            # 이게 없으면 상자 뒤 발문이 상자에 딱 붙는다.
            if "para_boxtop" in STYLE:
                doc.append_paragraph("", para_pr_id=STYLE["para_boxtop"],
                                     style_id=_sty("para_boxtop"),
                                     char_pr_id=STYLE.get("char_boxtop"))
            for item in u["items"]:
                emit_rich(doc, item, rep, where=where,
                          para="para_cond" if "para_cond" in STYLE else "para_cont",
                          char="char_cond" if "char_cond" in STYLE else "char_cont")
            if "para_boxbot" in STYLE:
                doc.append_paragraph("", para_pr_id=STYLE["para_boxbot"],
                                     style_id=_sty("para_boxbot"),
                                     char_pr_id=STYLE.get("char_boxbot"))
        elif u["k"] == "ex":
            for j, item in enumerate(u["items"]):
                emit_rich(doc, f"{HGND[j % len(HGND)]}. {item}", rep, where=where,
                          para="para_ex" if "para_ex" in STYLE else "para_cont",
                          char="char_ex" if "char_ex" in STYLE else "char_cont")
        elif u["k"] == "fig":
            emit_figure(doc, u, rep, where=where, roots=IMAGE_ROOTS)
        elif u["k"] == "choices":
            emit_choices(doc, p, u, rep, where=f"{where} 선지")
    # 문항 사이를 한 줄 띄운다. 실물도 선지 스타일의 빈 문단으로 띄우고,
    # 그 스타일의 '문단 아래' 가 0 이라 이것 없이는 다음 문항이 바로 붙는다.
    doc.append_paragraph("", para_pr_id=STYLE.get("para_choice"),
                         style_id=_sty("para_choice"),
                         char_pr_id=STYLE.get("char_choice"))


def build(data: dict, out: Path, *, ref: str | Path | None = None,
          images: list[Path] | None = None) -> Report:
    rep = Report()
    IMAGE_ROOTS.clear()
    # 호출자가 그림 폴더를 명시하지 않은 CLI/API 사용에서는 출력 파일 옆만 허용한다.
    # 저장소 전체를 기본으로 넣으면 JSON의 src가 뜻밖의 로컬 파일을 찾을 수 있다.
    IMAGE_ROOTS.extend(images or [out.parent])
    STYLE.clear()
    PROFILE.clear()

    template = Path(ref) if ref else DEFAULT_TEMPLATE
    if template.suffix.lower() == ".hwpx" and template.exists():
        # 실물 틀을 그대로 쓴다 — 서식 id 만 알아내면 되고 새로 만들 것이 없다.
        doc, roles = tmpl.open_template(template)
        PROFILE["_source"] = f"{template.name} (틀)"
        for role, spec in roles.items():
            if role.startswith("_"):
                continue
            if "para" in spec:
                STYLE[f"para_{role}"] = spec["para"]
            if "char" in spec:
                STYLE[f"char_{role}"] = spec["char"]
            if "style" in spec:
                STYLE[f"style_{role}"] = spec["style"]
        STYLE["char_num"] = roles.get("num", {}).get("char", STYLE.get("char_stem"))
        for r in ("stem", "choice", "cont"):
            if f"para_{r}" not in STYLE:
                rep.warnings.append(f"틀에 {r} 역할이 없어 기본 서식으로 대신합니다")
    else:
        # 틀이 없으면 값만 읽어 빈 문서에 심는다(예전 경로).
        PROFILE.update(exam_profile.profile_from(ref or DEFAULT_REF))
        doc = HwpxDocument.blank()
        apply_layout(doc)
        STYLE.update(exam_style.install(doc, PROFILE))

    title = str(data.get("round") or "모의고사")
    if (PROFILE.get("_source") or "").endswith("(틀)"):
        # 틀에 이미 머리말과 '5지선다형' 상자가 있다. 본문에 또 쓰면 두 번 나온다.
        tmpl.set_masthead_title(doc, title)
    else:
        doc.append_paragraph(title, para_pr_id=STYLE["para_cont"],
                             char_pr_id=STYLE["char_stem"])
        doc.append_paragraph("5지선다형", para_pr_id=STYLE["para_cont"],
                             char_pr_id=STYLE["char_stem"])

    shown = [p for p in (data.get("problems") or [])
             if any(u["k"] != "choices" for u in prob_units(p)[0])]
    breaks = column_starts(shown)
    frame_used = False
    for i, p in enumerate(shown):
        before = doc.paragraph_count()
        # 첫 문항은 틀 문단에 이어 쓴다 — 안 그러면 빈 줄 하나가 앞을 밀어낸다.
        use_frame = (i == 0 and not frame_used
                     and (PROFILE.get("_source") or "").endswith("(틀)"))
        emit_problem(doc, p, rep, into=0 if use_frame else None)
        frame_used = frame_used or use_frame
        if i in breaks and doc.paragraph_count() > before:
            # 문항의 '첫' 문단에 표시해야 한다 — 마지막에 하면 다음 문항이 넘어간다.
            sec = doc.get_part("Contents/section0.xml")
            paras = [k for k in sec.root.children if k.local_name == "p"]
            if len(paras) > before:
                paras[before].set_attr("columnBreak", "1")
                sec.mark_modified()
                rep.breaks += 1
        rep.problems += 1

    for name in ["xml_validation_errors", "reference_validation_errors",
                 "stale_paragraph_layout_validation_errors", "validation_errors",
                 "strict_lint_errors"]:
        for e in getattr(doc, name)():
            rep.warnings.append(f"검증({name}): {e}")
    try:
        doc.strict_validate()
    except Exception as e:  # noqa: BLE001
        rep.warnings.append(f"strict_validate 실패: {e}")

    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out))
    return rep


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    src = Path(argv[1])
    out = Path(argv[2]) if len(argv) > 2 else src.with_suffix(".hwpx")
    data = json.loads(src.read_text(encoding="utf-8"))

    imgs = [Path(argv[3])] if len(argv) > 3 else [src.parent]
    rep = build(data, out, images=imgs)
    print("조판 규격 출처:", PROFILE.get("_source") or "(없음)")
    print(f"문항 {rep.problems}개, 수식 {rep.equations}개, 그림 {rep.figures}개, 단나눔 {rep.breaks}회 → {out} ({out.stat().st_size:,} bytes)")
    if rep.warnings:
        print(f"\n⚠️ 경고 {len(rep.warnings)}건 (조용히 넘기지 않습니다):")
        for w in rep.warnings[:20]:
            print("  -", w)
        return 1
    print("경고 없음")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
