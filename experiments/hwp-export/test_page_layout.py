"""쪽 배치 검사 — 번호 뒤 탭 · 쪽나눔 · 이어지는 쪽 머리말 (베타).

실물 시험지와 대조해 찾은 세 가지를 지킨다. 셋 다 **파일은 멀쩡히 열리고 다른 검사도
전부 초록불인데 화면만 틀린** 종류라, 여기서 잡지 않으면 아무도 모른다.

1. **번호 뒤는 공백이 아니라 탭이다.**
   실물은 `1.` + 탭(636), `10.` + 탭 둘(132·671)로 발문 시작 위치를 맞춘다.
   공백을 쓰면 한 자리와 두 자리 문항의 발문이 어긋나 번호만 삐뚤어 보인다.

2. **쪽나눔을 실제로 내보낸다.**
   예전에는 단나눔만 내보내고 쪽 경계는 한글이 알아서 넘기기를 기대했다. 그러면
   편집기 `buildPages()` 와 쪽이 어긋나고, 무엇보다 이어지는 쪽 머리말을 붙일 자리를
   알 수 없다. 그리고 **쪽나눔과 단나눔을 같은 문단에 함께 주면 안 된다** —
   한글이 둘 다 수행해 새 쪽의 왼쪽 단이 통째로 빈다.

3. **이어지는 쪽 머리말이 살아 있어야 한다.**
   실물은 2쪽 첫 문단에 `<hp:ctrl><hp:header>` 를 한 번 두고 뒤 쪽이 물려받는다.
   `clear_body()` 가 그 문단을 지우므로 떠 두었다가 도로 넣지 않으면 **2쪽부터
   머리말이 사라진다** — '시험지 형식이 2페이지에 사라진다' 는 증상이 이것이다.
   그 머리말은 고른 선택과목을 따라야 한다(틀에는 `확률과 통계` 가 박혀 있다).

    python3 test_page_layout.py
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import mock_to_hwpx  # noqa: E402

HERE = Path(__file__).parent
TEMPLATE = HERE.parents[1] / "평가원 수학 양식.hwpx"
SAMPLE = HERE / "samples" / "full-exam.json"
IMAGES = HERE / "samples" / "images"

SKIP_UNAVAILABLE = 2
SKIP_FIXABLE = 3

if not SAMPLE.exists():
    print(f"표본이 없어 건너뜁니다 ({SAMPLE.name}) — 저장소에 있어야 하는 파일입니다")
    raise SystemExit(SKIP_FIXABLE)
if not TEMPLATE.exists():
    print(f"실물 틀이 없어 건너뜁니다 ({TEMPLATE.name})")
    raise SystemExit(SKIP_UNAVAILABLE)

fails = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global fails
    print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail else ""))
    if not ok:
        fails += 1


_keep: list = []


def build(data: dict) -> zipfile.ZipFile:
    tmp = tempfile.TemporaryDirectory()
    _keep.append(tmp)
    out = Path(tmp.name) / "exam.hwpx"
    mock_to_hwpx.build(data, out, images=[IMAGES])
    return zipfile.ZipFile(out)


def section_xml(z: zipfile.ZipFile, index: int) -> str:
    return z.read(f"Contents/section{index}.xml").decode("utf-8")


def paragraphs(xml: str) -> list[str]:
    """최상위 `<hp:p …>` 조각들. 안쪽 문단(표·머리말)은 세지 않는다."""
    out, depth, start = [], 0, None
    for m in re.finditer(r"<hp:p\b[^>]*?(/?)>|</hp:p>", xml):
        if m.group(0).startswith("</"):
            depth -= 1
            if depth == 0 and start is not None:
                out.append(xml[start:m.end()])
                start = None
            continue
        if m.group(1) == "/":                    # <hp:p …/> 빈 문단
            if depth == 0:
                out.append(m.group(0))
            continue
        if depth == 0:
            start = m.start()
        depth += 1
    return out


def header_texts(xml: str) -> list[str]:
    out = []
    for h in re.findall(r"<hp:header\b.*?</hp:header>", xml, re.S):
        joined = "".join(re.findall(r"<hp:t(?:\s[^>]*)?>(.*?)</hp:t>", h, re.S))
        out.append(re.sub(r"<[^>]+>", "", joined).strip())
    return out


data = json.loads(SAMPLE.read_text(encoding="utf-8"))
z = build(data)
sec0, sec1 = section_xml(z, 0), section_xml(z, 1)

# ── 1. 번호 뒤는 탭이다 ───────────────────────────────────────────────────
print("문항 번호")
# `<hp:t …>12.<hp:tab …/><hp:tab …/></hp:t>` 에서 번호와 탭 개수를 뽑는다.
num_runs: dict[str, int] = {}
for m in re.finditer(r"<hp:t(?:\s[^>]*)?>(\d{1,2})\.((?:<hp:tab[^>]*/>)*)</hp:t>", sec0 + sec1):
    num_runs.setdefault(m.group(1), len(re.findall(r"<hp:tab", m.group(2))))

check("번호를 30개 모두 찾았다", len(num_runs) == 30, f"{len(num_runs)}개")
check("번호 뒤에 공백을 쓰지 않는다",
      not re.search(r"<hp:t(?:\s[^>]*)?>\d{1,2}\.\s", sec0 + sec1))
one = {n: t for n, t in num_runs.items() if len(n) == 1}
two = {n: t for n, t in num_runs.items() if len(n) == 2}
check("한 자리 번호는 탭 하나 (실물과 같다)",
      bool(one) and all(t == 1 for t in one.values()),
      f"{sorted(set(one.values()))}")
check("두 자리 번호는 탭 둘 (실물과 같다)",
      bool(two) and all(t == 2 for t in two.values()),
      f"{sorted(set(two.values()))}")
check("탭 너비도 실물에서 잰 값이다",
      'width="636"' in sec0 and 'width="132"' in sec0 and 'width="671"' in sec0)

# ── 2. 쪽나눔 ─────────────────────────────────────────────────────────────
print("\n쪽나눔")


def breaks_of(xml: str) -> tuple[list[int], list[int]]:
    ps = paragraphs(xml)
    page = [i for i, p in enumerate(ps) if re.match(r"<hp:p\b[^>]*pageBreak=\"1\"", p)]
    col = [i for i, p in enumerate(ps) if re.match(r"<hp:p\b[^>]*columnBreak=\"1\"", p)]
    return page, col


p0, c0 = breaks_of(sec0)
p1, c1 = breaks_of(sec1)
check("공통 구역에 쪽나눔이 있다", len(p0) > 0, f"{len(p0)}회")
check("선택 구역에도 쪽나눔이 있다", len(p1) > 0, f"{len(p1)}회")
check("쪽나눔과 단나눔이 같은 문단에 겹치지 않는다 (겹치면 새 쪽 왼쪽 단이 빈다)",
      not (set(p0) & set(c0)) and not (set(p1) & set(c1)),
      f"공통 {sorted(set(p0) & set(c0))} · 선택 {sorted(set(p1) & set(c1))}")

# 편집기 buildPages() 와 같은 규칙인가 — 한 쪽은 두 단이다.
for label, group_key in (("공통", lambda q: q.get("sect") != "선택"),
                         ("선택", lambda q: q.get("sect") == "선택")):
    group = [q for q in data["problems"] if group_key(q)]
    cols = [0] + sorted(mock_to_hwpx.column_starts(group))
    expected = len([c for n, c in enumerate(cols) if n and n % 2 == 0])
    got = len(p0 if label == "공통" else p1)
    check(f"{label} 구역 쪽 수가 편집기 규칙과 같다 (단 두 개가 한 쪽)",
          got == expected, f"기대 {expected} · 실제 {got}")

# ── 3. 이어지는 쪽 머리말 ─────────────────────────────────────────────────
print("\n이어지는 쪽 머리말")
check("공통 구역에 쪽 머리말이 살아 있다", len(header_texts(sec0)) > 0,
      str(header_texts(sec0)))
check("선택 구역에도 쪽 머리말이 살아 있다", len(header_texts(sec1)) > 0,
      str(header_texts(sec1)))
check("머리말은 첫 쪽나눔 문단에 **한 번만** 있다 (쪽마다 겹쳐 찍히지 않게)",
      len(re.findall(r"<hp:header\b", sec0)) == len(header_texts(sec0)))

for name in ("미적분", "기하", "확률과 통계"):
    zz = build({**data, "elective": name})
    texts = header_texts(section_xml(zz, 1))
    check(f"선택 '{name}' 이 이어지는 쪽 머리말에도 반영된다",
          bool(texts) and all(f"수학 영역({name})" in t for t in texts),
          str(texts))

# ── 4. 한 단 안에서 문항을 벌린다 (REV-2026-016) ──────────────────────────
# 실물도 편집기도 단을 균등하게 나눠 각 문항을 자기 칸 맨 위에 둔다. 높이는 편집기가
# 재서 `heightMm` 으로 보낸다 — 파이썬은 글꼴 실측을 못 하기 때문이다.
print("\n문항 간격")


def blanks_before_numbers(xml: str) -> dict[str, int]:
    """번호 문단마다 그 앞에 빈 문단이 몇 개인지."""
    out, blank = {}, 0
    for para in paragraphs(xml):
        body = re.sub(r"<hp:(header|footer)\b.*?</hp:\1>", "", para, flags=re.S)
        texts = "".join(re.findall(r"<hp:t(?:\s[^>]*)?>([\s\S]*?)</hp:t>", body))
        num = re.match(r"\s*(\d{1,2})\.", re.sub(r"<[^>]+>", "", texts))
        has_content = bool(re.sub(r"<[^>]+>", "", texts).strip()) or "<hp:equation" in body
        if num:
            out[num.group(1)] = blank
            blank = 0
        elif not has_content:
            blank += 1
        else:
            blank = 0
    return out


LINE_MM = 6.694          # 본문 11.5pt × 줄간격 165% (틀에서 읽은 값)
SLOT_FIRST = mock_to_hwpx.COL_H_FIRST_MM / mock_to_hwpx.PER_COL

# 편집기가 잰 것처럼 높이를 붙인 표본. 브라우저 없이 돌아야 하므로 값을 직접 준다.
tall = {**data, "problems": [{**p, "heightMm": 20.0} for p in data["problems"]]}
z_tall = build(tall)
gaps_tall = blanks_before_numbers(section_xml(z_tall, 0))
gaps_none = blanks_before_numbers(sec0)          # 높이 없는 원래 표본

check("높이를 주면 한 단 안 둘째 문항 앞이 벌어진다",
      gaps_tall.get("2", 0) > 10, f"2번 앞 빈 문단 {gaps_tall.get('2')}개")
check("높이가 없으면 벌리지 않는다 (CLI·손으로 쓴 JSON 대비책)",
      gaps_none.get("2", 0) <= 1, f"2번 앞 빈 문단 {gaps_none.get('2')}개")
# 3번은 새 단의 첫 문항이다 — 단의 마지막 문항 뒤를 벌리면 그 단이 넘친다.
check("단이 바뀌는 자리는 벌리지 않는다",
      gaps_tall.get("3", 0) <= 1, f"3번 앞 빈 문단 {gaps_tall.get('3')}개")
expected = int((SLOT_FIRST - 20.0) // LINE_MM) - 1
check("벌린 양이 칸 높이에서 문항 높이를 뺀 만큼이다",
      gaps_tall.get("2", 0) == expected + 1,        # +1 은 emit_problem 이 늘 붙이는 한 줄
      f"기대 {expected + 1} · 실제 {gaps_tall.get('2')}")
check("벌려도 칸을 넘기지 않는다",
      (gaps_tall.get("2", 0) * LINE_MM) + 20.0 <= SLOT_FIRST + LINE_MM,
      f"{gaps_tall.get('2', 0) * LINE_MM + 20.0:.1f}mm ≤ 칸 {SLOT_FIRST:.1f}mm")

# 칸보다 큰 문항을 주면 음수가 되는데, 그때 벌리지 않아야 한다(칸 밖으로 밀지 않게).
huge = {**data, "problems": [{**p, "heightMm": 400.0} for p in data["problems"]]}
check("문항이 칸보다 크면 벌리지 않는다",
      blanks_before_numbers(section_xml(build(huge), 0)).get("2", 0) <= 1)

# ── 5. 이 검사가 실제로 무언가를 검사하는가 ───────────────────────────────
# 고친 것을 되돌려 놓고 빨간불이 되는지 본다. 안 되면 이 검사는 아무것도 지키지 않는다.
print("\n검사가 유효한지")

real_prefix = mock_to_hwpx.num_prefix_xml
try:
    mock_to_hwpx.num_prefix_xml = (
        lambda num: f'<hp:t xmlns:hp="{mock_to_hwpx.HP}">{num}. </hp:t>')   # 옛 동작
    old = section_xml(build(data), 0)
finally:
    mock_to_hwpx.num_prefix_xml = real_prefix
check("번호 뒤를 공백으로 되돌리면 잡힌다",
      bool(re.search(r"<hp:t(?:\s[^>]*)?>\d{1,2}\.\s", old)))

real_pages = mock_to_hwpx.page_starts
try:
    mock_to_hwpx.page_starts = lambda problems: set()                       # 옛 동작
    nobreak = section_xml(build(data), 0)
finally:
    mock_to_hwpx.page_starts = real_pages
check("쪽나눔을 없애면 잡힌다", breaks_of(nobreak)[0] == [])
check("그때 이어지는 쪽 머리말도 함께 사라진다 (둘은 같은 자리에 붙는다)",
      header_texts(nobreak) == [], str(header_texts(nobreak)))

real_pad = mock_to_hwpx.pad_lines
try:
    mock_to_hwpx.pad_lines = lambda *a, **k: 0                              # 옛 동작
    flat = section_xml(build(tall), 0)
finally:
    mock_to_hwpx.pad_lines = real_pad
check("문항 간격을 없애면 잡힌다",
      blanks_before_numbers(flat).get("2", 0) <= 1,
      f"2번 앞 빈 문단 {blanks_before_numbers(flat).get('2')}개")

if fails:
    print(f"\n실패 {fails}건")
    raise SystemExit(1)
print("\n전부 통과")
