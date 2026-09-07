#!/usr/bin/env python3
"""실물 시험지 파일에서 **조판 틀만** 남긴 배포용 틀을 만든다.

    python3 experiments/hwp-export/make_exam_template.py "평가원 수학 양식.hwpx"

⚠️ **왜 필요한가.** 실물 파일에는 2025 수능 문제·도형과 만든 사람 이름(532곳)이 들어 있어
   저장소에 올릴 수 없었고, 그래서 시험지 HWPX 내보내기는 **이 컴퓨터에서만** 됐다.
   조판에 필요한 것은 **틀**(구역·단·스타일·머리말·표 개체)뿐이므로 내용을 전부 벗긴다.

⚠️ **세 단계를 모두 거쳐야 한다.** 하나라도 빠지면 "벗겼다" 는 말이 사실이 아니다:
     strip_to_frame  남의 문제 (⚠️ `clear_body` 가 아니다 — 그것은 이어지는 쪽 머리말과
                     구획 태그 표까지 지워, 변환기가 떠 올 것이 없어진다)
     shrink_images   그림(BinData) — 지우지 않고 1×1 로 바꾼다(figure 역할 판정에 필요)
     strip_identity  **미리보기 글·썸네일·작성자 메타** ← 이것을 빼먹으면 미리보기에
                     문제 전문이 그대로 남는다(실측으로 확인했다)

만든 틀이 실물과 같은 조판을 내는지는 `test_style_roles.py` 와 `test_structure.py` 가 본다.
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import template as tmpl                       # noqa: E402
from pedagogy_hwpx import HwpxDocument        # noqa: E402

OUT = HERE / "templates" / "exam-math.hwpx"


def build(src: Path, out: Path = OUT) -> dict:
    doc = HwpxDocument.open(src)
    frame = tmpl.strip_to_frame(doc)      # ⚠️ clear_body 가 아니다 — 위 함수 주석 참고
    report = {
        "문단": f"글 조각 {frame['바꾼 글 조각']}개 채움글자로 · 틀 run {frame['그대로 둔 run']}개 유지",
        "그림": tmpl.shrink_images(doc),
        "신원": tmpl.strip_identity(doc),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    report["크기"] = f"{src.stat().st_size:,} → {out.stat().st_size:,} 바이트"
    return report


def leftovers(path: Path) -> list[str]:
    """벗긴 틀에 **사람 이름이나 문제 글이 남았는지** 다시 확인한다.

    ⚠️ 만드는 코드와 확인하는 코드를 갈라 둔다 — 같은 가정으로 만들고 같은 가정으로
       확인하면 둘이 함께 틀린다(이 저장소에서 여러 번 겪었다).
    """
    z = zipfile.ZipFile(path)
    blob = "".join(z.read(n).decode("utf-8", "ignore") for n in z.namelist())
    bad = []
    for needle, why in [("백승우", "만든 사람 이름"),
                        ("수학능력시험", "시험지 표지 글"),
                        ("의 값은?", "문항 발문"),
                        ("huryul", "저장한 사람 계정")]:
        n = blob.count(needle)
        if n:
            bad.append(f"{why}('{needle}') {n}건")
    return bad


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("평가원 수학 양식.hwpx")
    if not src.exists():
        raise SystemExit(f"실물 틀이 없습니다: {src}")
    rep = build(src)
    print(f"{rep['문단']} · 그림 {rep['그림']}개 1×1 로")
    for line in rep["신원"]:
        print(f"  · {line}")
    print(rep["크기"], "→", OUT)
    bad = leftovers(OUT)
    if bad:
        print("\n❌ 아직 남아 있습니다:", " / ".join(bad))
        raise SystemExit(1)
    print("✅ 이름·문제 글이 남지 않았습니다")
