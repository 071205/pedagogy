"""끝에서 끝까지 실험 — LaTeX 로 쓴 문항 → HWPX → 한글 (베타).

모의고사 편집기가 실제로 다루는 형태(LaTeX)로 문항을 쓰고,
`tex_to_hwp.convert()` 로 HWP 수식 스크립트로 바꿔 시험지를 조판한다.
**손으로 HWP 스크립트를 적어 넣지 않는다** — 그러면 변환기를 검사하는 의미가 없다.

    python3 make_e2e_probe.py [내보낼 폴더]
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pedagogy_hwpx import HwpxDocument  # noqa: E402

from make_math_probe import apply_layout  # noqa: E402  (용지·단·글꼴 설정 재사용)
from tex_to_hwp import UnsupportedTex, convert  # noqa: E402

# 모의고사 편집기가 쓰는 것과 같은 방식으로, LaTeX 로만 적는다.
PROBLEMS = [
    ("1. 다음 식의 값은? [2점]",
     r"\sqrt[3]{5} \times 25^{\frac{1}{3}}",
     "① 3   ② 4   ③ 5   ④ 6   ⑤ 7"),
    ("2. 다음을 만족시키는 함수 f 에 대하여 옳은 것은? [3점]",
     r"2 f\left(1\right) \leq f\left(2\right) \leq f\left(3\right)",
     "① 1   ② 2   ③ 3   ④ 4   ⑤ 5"),
    ("3. 실수 전체의 집합에서 연속인 함수 f 가 다음과 같을 때, 상수 a 의 값은? [3점]",
     r"f(x) = \begin{cases} 5x+a & (x < -2) \\ x^2-a & (x \geq -2) \end{cases}",
     "① -2   ② -1   ③ 0   ④ 1   ⑤ 2"),
    ("4. 다음 조건을 만족시키는 수열의 첫째항은? [4점]",
     r"\lim_{n \to \infty} \sum_{k=1}^{2n} a_{k} > \frac{1}{700}",
     "① 10   ② 20   ③ 30   ④ 40   ⑤ 50"),
    ("5. 두 벡터의 내적과 행렬을 함께 쓰는 문항. [4점]",
     r"\vec{a} \cdot \vec{b} = \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}",
     "① 1   ② 2   ③ 3   ④ 4   ⑤ 5"),
]


def build(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = HwpxDocument.blank()
    apply_layout(doc)

    doc.append_paragraph("5지선다형  (LaTeX 에서 자동 변환한 수식)")
    failures = 0
    for stem, tex, choices in PROBLEMS:
        doc.append_paragraph(stem)
        try:
            script = convert(tex)
        except UnsupportedTex as e:
            print(f"  ⚠️ 변환 실패 — {e}\n     {tex}")
            failures += 1
            doc.append_paragraph(f"[변환 실패: {e}]")
        else:
            print(f"  {tex}\n    → {script}")
            doc.append_equation(script)
        doc.append_paragraph(choices)
        doc.append_paragraph("")

    doc.append_paragraph("◆여기까지보이면성공◆ — 위 수식 다섯 개가 모두 제대로 조판됐는지, "
                         "본문이 두 단으로 흐르는지 확인해 주세요.")

    problems = 0
    for name in ["xml_validation_errors", "reference_validation_errors",
                 "stale_paragraph_layout_validation_errors", "validation_errors",
                 "strict_lint_errors"]:
        problems += len(getattr(doc, name)())
    try:
        doc.strict_validate()
    except Exception as e:  # noqa: BLE001
        print("strict_validate 실패:", e)
        problems += 1

    out = out_dir / "e2e-probe.hwpx"
    doc.save(str(out))
    re_open = HwpxDocument.open(str(out))
    print(f"\n검증 문제 {problems}건, 변환 실패 {failures}건")
    print(f"저장: {out} ({out.stat().st_size:,} bytes) — 수식 {len(re_open.equations())}개")
    return 0 if problems == 0 and failures == 0 else 1


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "out"
    raise SystemExit(build(target))
