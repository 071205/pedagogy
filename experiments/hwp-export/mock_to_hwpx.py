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

from make_math_probe import HP, apply_layout  # noqa: E402
from tex_to_hwp import UnsupportedTex, convert  # noqa: E402

MARKS = ["①", "②", "③", "④", "⑤"]
HGND = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"]


@dataclass
class Report:
    problems: int = 0
    equations: int = 0
    warnings: list[str] = field(default_factory=list)


def xml_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;").replace("'", "&apos;"))


def append_text_run(doc: HwpxDocument, para_idx: int, text: str) -> None:
    """문단 뒤에 글자 조각 하나를 잇는다.

    ⚠️ `append_run_xml()` 은 넘긴 XML 을 `<hp:run>` 으로 **한 번 더 감싼다.**
       그래서 `<hp:run>…</hp:run>` 을 통째로 넘기면 run 안에 run 이 중첩되고,
       한글은 그 문단의 뒤쪽 글자를 통째로 그리지 않는다(수식 뒤 한글이 사라지고
       선지가 `① 12345` 로 뭉개졌다). 안쪽 `<hp:t>` 만 넘겨야 한다.
    """
    doc.append_run_xml(f'<hp:t xmlns:hp="{HP}">{xml_escape(text)}</hp:t>',
                       paragraph_index=para_idx)


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


def emit_rich(doc: HwpxDocument, text: str, rep: Report, *, where: str) -> int:
    """텍스트와 인라인 수식이 섞인 문단 하나를 만들고 그 문단 번호를 준다."""
    parts = split_inline(text)
    lead = parts[0][1] if parts and parts[0][0] == "text" else ""
    doc.append_paragraph(lead)
    idx = doc.paragraph_count() - 1
    rest = parts[1:] if lead else parts

    for kind, body in rest:
        if kind == "text":
            append_text_run(doc, idx, body)
        else:
            try:
                script = convert(body)
            except UnsupportedTex as e:
                # 조용히 버리면 시험지에 수식이 빠진 채로 인쇄된다. 자리를 남기고 알린다.
                rep.warnings.append(f"{where}: 수식 변환 실패 — {e}  ({body})")
                append_text_run(doc, idx, f"[수식 변환 실패: {body}]")
                continue
            doc.append_inline_equation(script, paragraph_index=idx)
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
    doc.append_paragraph("")
    doc.append_equation(script, paragraph_index=doc.paragraph_count() - 1)
    rep.equations += 1


def emit_problem(doc: HwpxDocument, p: dict, rep: Report) -> None:
    units, pts_at = prob_units(p)
    num = p.get("num", "?")
    where = f"{num}번"
    if not any(u["k"] != "choices" for u in units):
        doc.append_paragraph(f"{num}. (발문 비어 있음)")
        doc.append_paragraph("")
        return

    first = True
    for i, u in enumerate(units):
        pts = (i == pts_at)
        tail = f"  [{p.get('pts', '')}점]" if pts and p.get("pts") else ""
        if u["k"] == "text":
            head = f"{num}. " if first else ""
            emit_rich(doc, head + u["t"] + tail, rep, where=where)
            first = False
        elif u["k"] == "eq":
            emit_display_eq(doc, u["t"], rep, where=where)
        elif u["k"] == "boxed":
            emit_rich(doc, "〈" + u["t"] + "〉", rep, where=where)
        elif u["k"] == "cond":
            for item in u["items"]:
                emit_rich(doc, item, rep, where=where)
        elif u["k"] == "ex":
            for j, item in enumerate(u["items"]):
                emit_rich(doc, f"{HGND[j % len(HGND)]}. {item}", rep, where=where)
        elif u["k"] == "fig":
            doc.append_paragraph(f"[그림 {u['src'] or num} · 너비 {u['w']}mm]")
        elif u["k"] == "choices":
            line = "   ".join(f"{MARKS[j % len(MARKS)]} {c}".rstrip()
                              for j, c in enumerate(u["items"]) if c.strip())
            if line:
                emit_rich(doc, line, rep, where=f"{where} 선지")
    doc.append_paragraph("")


def build(data: dict, out: Path) -> Report:
    rep = Report()
    doc = HwpxDocument.blank()
    apply_layout(doc)

    title = str(data.get("round") or "모의고사")
    doc.append_paragraph(title)
    doc.append_paragraph("5지선다형")

    for p in data.get("problems") or []:
        units, _ = prob_units(p)
        if not any(u["k"] != "choices" for u in units):
            continue                      # 빈 문항은 싣지 않는다
        emit_problem(doc, p, rep)
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

    rep = build(data, out)
    print(f"문항 {rep.problems}개, 수식 {rep.equations}개 → {out} ({out.stat().st_size:,} bytes)")
    if rep.warnings:
        print(f"\n⚠️ 경고 {len(rep.warnings)}건 (조용히 넘기지 않습니다):")
        for w in rep.warnings[:20]:
            print("  -", w)
        return 1
    print("경고 없음")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
