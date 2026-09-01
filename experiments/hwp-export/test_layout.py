"""문항 배치 규칙 검사 (베타).

`mock_to_hwpx.column_starts()` 가 편집기의 `buildPages()` 와 **같은 규칙**인지 본다.
여기가 어긋나면 화면 미리보기와 실제 시험지의 문항 위치가 달라진다.

편집기(mock-exam-editor.html)의 규칙:

    cur.push(p);
    if (cur.length >= SPEC.perCol || p.breakAfter || (다음 문항의 sect 가 다름))
        새 단;

    python3 test_layout.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from mock_to_hwpx import PER_COL, column_starts  # noqa: E402


def prob(num: int, *, sect: str = "공통", br: bool = False) -> dict:
    return {"num": num, "sect": sect, "breakAfter": br}


CASES = [
    ("한 단에 2문항 — 6문항이면 3단",
     [prob(i) for i in range(1, 7)], {2, 4}),
    ("breakAfter 는 거기서 끊는다",
     [prob(1, br=True), prob(2), prob(3), prob(4)], {1, 3}),
    ("과목 구분이 바뀌면 끊는다",
     [prob(1), prob(2), prob(3, sect="선택"), prob(4, sect="선택")], {2}),
    ("문항이 하나면 나눌 곳이 없다", [prob(1)], set()),
    ("빈 목록", [], set()),
]

fails = 0
print(f"PER_COL = {PER_COL} (편집기 SPEC.perCol 과 같아야 한다)")
for label, probs, want in CASES:
    got = column_starts(probs)
    ok = got == want
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}: {sorted(got)}"
          + ("" if ok else f"  ← 기대 {sorted(want)}"))

# 검사가 실제로 실패하는지 — 규칙을 어긋내면 결과가 달라져야 한다
import mock_to_hwpx  # noqa: E402

mock_to_hwpx.PER_COL = 3
broken = column_starts([prob(i) for i in range(1, 7)])
mock_to_hwpx.PER_COL = PER_COL
if broken == {2, 4}:
    print("  ❌ PER_COL 을 바꿔도 결과가 같다 — 이 검사는 아무것도 검사하지 않는다")
    fails += 1
else:
    print(f"  ✅ 고의로 PER_COL=3 으로 바꾸면 {sorted(broken)} 로 달라진다(검사가 유효)")

print(f"단 나눔: {len(CASES) + 1}건 확인")


# ── 선지 배치 (편집기 layoutOf() 와 같아야 한다) ──────────────────────────
from mock_to_hwpx import layout_of  # noqa: E402

CH_CASES = [
    ("짧은 숫자는 한 줄", {}, ["1", "2", "3", "4", "5"], "1"),
    ("ㄱㄴㄷ 합답형은 폭과 무관하게 3+2", {},
     ["ㄱ", "ㄱ,ㄴ", "ㄱ,ㄷ", "ㄴ,ㄷ", "ㄱ,ㄴ,ㄷ"], "2"),
    ("아주 길면 세로", {}, ["아주 긴 선지가 들어가는 경우입니다 정말로 길어요"] * 5, "v"),
    ("명시 지정은 그대로 따른다", {"layout": "v"}, ["1", "2", "3", "4", "5"], "v"),
    ("블록의 지정이 문항보다 우선", {"layout": "1", "blocks": [
        {"type": "choices", "data": {"layout": "v", "items": ["1"] * 5}}]},
     ["1", "2", "3", "4", "5"], "v"),
]

print("\n선지 배치")
for label, prob_, items, want in CH_CASES:
    got = layout_of(prob_, items)
    ok = got == want
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}: {got}" + ("" if ok else f"  ← 기대 {want}"))

print("선지 배치 확인")


# ── 3+2 는 두 줄이 같은 문단 모양이어야 한다 ──────────────────────────────
# 실물 확인: ①②③ 줄과 ④⑤ 줄이 둘 다 문단 19(`2행`) 를 쓴다(각 5회).
# 줄마다 다른 것을 주면 ④가 ① 아래에 오지 않고 벌어진다.
from mock_to_hwpx import STYLE, _row_para  # noqa: E402

print("\n3+2 두 줄 정렬")
STYLE.update({"para_ch1row": "12", "para_ch2row": "19", "para_ch3row": "33"})
same = _row_para("2") == _row_para("2")
row2_style = _row_para("2")
one_row = _row_para("1")
checks = [
    ("3+2 의 두 줄이 같은 문단 모양", same and row2_style == "para_ch2row"),
    ("한 줄 배치는 다른 문단 모양", one_row == "para_ch1row"),
    ("세로 배치도 한 줄 것을 쓴다", _row_para("v") == "para_ch1row"),
]
for label, ok in checks:
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}")

# 검사가 유효한지 — 3+2 를 다른 모양으로 바꾸면 달라져야 한다
STYLE["para_ch2row"] = "33"
if _row_para("2") != "para_ch2row":
    print("  ❌ 문단 모양을 바꿔도 결과가 같다 — 검사가 무의미하다")
    fails += 1
else:
    print("  ✅ 매핑을 바꾸면 결과가 따라 바뀐다(검사가 유효)")


# ── 편집기가 실제로 내놓은 답과 맞는가 ────────────────────────────────────
# `layout_of` 는 편집기 `layoutOf()` 의 사본이다. 편집기는 KaTeX 로 실제 렌더 폭을
# 재지만 여기서는 잴 수 없어 어림한다. 그 어림이 편집기와 갈라지면 화면과 시험지의
# 선지 배치가 달라진다 — 30문항 표본에서 실제로 21문항 중 3문항이 어긋났다.
#
# `samples/choice-layout-truth.json` 은 **진짜 편집기를 브라우저에 띄워 받아 적은
# 답**이다(`node scripts/check-hwpx-parity.mjs`, 다시 받아쓰려면 UPDATE_HWPX_TRUTH=1).
# 그 스크립트는 정답표가 낡았는지도 함께 본다 — 낡은 표를 상대로 통과하는 일이
# 없어야 이 검사가 뜻을 갖는다.
import json  # noqa: E402
from mock_to_hwpx import prob_units  # noqa: E402

HERE = Path(__file__).parent
truth_file = HERE / "samples" / "choice-layout-truth.json"

print("\n편집기 실측 답과 대조")
if not truth_file.exists():
    print(f"  ❌ 정답표가 없습니다: {truth_file}")
    print("     node scripts/check-hwpx-parity.mjs 로 만들 수 있습니다")
    fails += 1
else:
    truth = (json.loads(truth_file.read_text(encoding="utf-8")) or {}).get("layouts") or {}
    checked = 0
    if not truth:
        print("  ❌ 정답표에 layouts 가 비어 있습니다 — 아무것도 검사하지 않게 됩니다")
        fails += 1
    for key, want in sorted(truth.items()):
        name, _, num = key.partition("#")
        src = HERE / "samples" / name
        if not src.exists():
            print(f"  ❌ {key}: 표본 파일이 없습니다 ({name})")
            fails += 1
            continue
        probs = json.loads(src.read_text(encoding="utf-8")).get("problems") or []
        p_ = next((x for x in probs if str(x.get("num")) == num), None)
        if p_ is None:
            print(f"  ❌ {key}: 표본에 그 문항이 없습니다")
            fails += 1
            continue
        # 실측값이 붙어 있으면 어림을 타지 않는다 — 여기서 보려는 건 어림 쪽이다.
        p_ = {k: v for k, v in p_.items() if k != "layoutResolved"}
        unit = next((u for u in prob_units(p_)[0] if u["k"] == "choices"), None)
        items = [c for c in (unit or {}).get("items", []) if c.strip()]
        got = layout_of(p_, items)
        checked += 1
        if got != want:
            print(f"  ❌ {key}: 편집기 {want} · 변환기 {got}")
            fails += 1
    print(f"  {'✅' if checked else '❌'} {checked}문항 대조")

# ── 편집기가 보낸 실측값이 어림보다 우선인가 ──────────────────────────────
# 실제 내보내기(편집기 → /hwpx)는 편집기가 잰 배치를 함께 보낸다. 그 값을 무시하고
# 다시 어림하면 이 모든 노력이 무의미해진다.
print("\n편집기 실측값 우선")
long_items = ["아주 긴 선지가 들어가는 경우입니다 정말로 길어요"] * 5
cases = [
    ("실측값이 어림을 이긴다", {"layoutResolved": "1"}, long_items, "1"),
    ("문항의 지정보다도 우선", {"layoutResolved": "v", "layout": "1"},
     ["1", "2", "3", "4", "5"], "v"),
    ("모르는 값은 무시하고 어림한다", {"layoutResolved": "3"},
     ["1", "2", "3", "4", "5"], "1"),
    ("값이 문자열이 아니어도 무시한다", {"layoutResolved": ["v"]},
     ["1", "2", "3", "4", "5"], "1"),
]
for label, prob_, items, want in cases:
    got = layout_of(prob_, items)
    ok = got == want
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}: {got}" + ("" if ok else f"  ← 기대 {want}"))

if fails:
    print(f"\n실패 {fails}건")
    raise SystemExit(1)
print("\n전부 통과")
