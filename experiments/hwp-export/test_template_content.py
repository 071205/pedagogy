#!/usr/bin/env python3
"""배포용 시험지 틀에 **남의 내용이 없는지** 확인한다.

⚠️ **이 검사가 없어서 사고가 났다**(`REV-2026-030`). 틀을 만드는 기능 검사 11건은 전부
   초록불이었는데 — 그것들은 "이 틀로 시험지가 제대로 만들어지는가" 를 볼 뿐이다 —
   저장소에 들어가는 **틀 파일 자체**에 원본 수식 522개와 발문 조각이 남아 있었다.
   *만드는 것* 을 검사한다고 *배포되는 것* 이 검사되지는 않는다.

⚠️ 그리고 그때 `leftovers()` 는 **빈 목록을 돌려주고 있었다.** 금칙어 네 개만 찾았기
   때문이다. 찾을 것을 나열하는 검사는 나열하지 않은 것을 통과시킨다 — 지금은 뒤집어서
   **허용한 것 말고는 전부 실패**로 본다.

틀은 저장소에 있으므로 이 검사는 **어디서나 돈다**(실물 틀이 필요 없다).
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from make_exam_template import leftovers  # noqa: E402
from pedagogy_hwpx import HwpxDocument    # noqa: E402

SKIP_FIXABLE = 3
TEMPLATE = HERE / "templates" / "exam-math.hwpx"

fails = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global fails
    print(f"  {'✅' if ok else '❌'} {name}" + ("" if ok else f" — {detail}"))
    if not ok:
        fails += 1


if not TEMPLATE.exists():
    print(f"배포용 틀이 없습니다 ({TEMPLATE.name}) — 저장소에 있어야 하는 파일입니다")
    raise SystemExit(SKIP_FIXABLE)

print("배포용 틀에 남의 내용이 없는가")
rest = leftovers(TEMPLATE)
check("남의 수식·발문·이름이 없다", not rest, " / ".join(rest))

# ── 이 검사가 실제로 잡는가 ────────────────────────────────────────────────
# ⚠️ 원본 조각을 심어 빨간불이 되는 것까지 확인해야 믿을 수 있다. 사람이 손으로 하면
#    잊히므로 검사 안에 둔다(시각 회귀·환경 연기 검사와 같은 방식).
print("\n검사가 유효한가")


def plant(pick, apply_) -> list[str]:
    doc = HwpxDocument.open(TEMPLATE)
    sec = doc.get_part("Contents/section0.xml")
    done = [False]

    def walk(node):
        for c in node.children:
            if done[0]:
                return
            if pick(c):
                apply_(c)
                done[0] = True
                return
            walk(c)

    for para in [k for k in sec.root.children if k.local_name == "p"]:
        walk(para)
        if done[0]:
            break
    sec.mark_modified()
    out = HERE / "out" / "_planted.hwpx"
    out.parent.mkdir(exist_ok=True)
    doc.save(out)
    try:
        return leftovers(out)
    finally:
        out.unlink(missing_ok=True)


check("원본 수식을 심으면 잡는다",
      bool(plant(lambda c: c.local_name == "script",
                 lambda c: setattr(c, "text", "f left(x right)=x^{3}-8 x+7"))),
      "수식을 심었는데 통과했다 — 이 검사는 헛돌고 있다")

check("원본 발문을 심으면 잡는다",
      bool(plant(lambda c: c.local_name == "t" and (c.text or "").strip(),
                 lambda c: setattr(c, "text", "의 값을 구하시오."))),
      "발문을 심었는데 통과했다 — 이 검사는 헛돌고 있다")

print()
if fails:
    print(f"실패 {fails}건")
    raise SystemExit(1)
print("전부 통과")
