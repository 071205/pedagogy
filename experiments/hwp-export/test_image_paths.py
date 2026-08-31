"""HWPX 그림 탐색은 허용 폴더를 벗어나지 않아야 한다 (베타)."""

from __future__ import annotations

import tempfile
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import mock_to_hwpx  # noqa: E402

HERE = Path(__file__).parent
IMAGE = HERE / "samples" / "images" / "fig14.png"


def problem(src: str) -> dict:
    return {"problems": [{"num": 1, "blocks": [
        {"type": "statement", "data": {"text": "그림을 보자."}},
        {"type": "image", "data": {"width": 58, "src": src}},
    ]}]}


with tempfile.TemporaryDirectory() as temp:
    root = Path(temp) / "allowed"
    root.mkdir()
    (root / "figure.png").write_bytes(IMAGE.read_bytes())
    outside = Path(temp) / "outside.png"
    outside.write_bytes(IMAGE.read_bytes())

    assert mock_to_hwpx.find_image("figure.png", [root]) == (root / "figure.png").resolve()
    assert mock_to_hwpx.find_image("../outside.png", [root]) is None
    assert mock_to_hwpx.find_image(str(outside), [root]) is None

    # 심볼릭 링크로 폴더를 벗어나는 경우. resolve() 뒤에 판정하므로 막혀야 한다 —
    # 링크는 파일 이름만으로는 안쪽 파일과 구분되지 않아 이름 검사로는 못 잡는다.
    try:
        (root / "link.png").symlink_to(outside)
    except OSError:
        pass                     # 심볼릭 링크를 못 만드는 환경이면 이 항목만 건너뛴다
    else:
        assert mock_to_hwpx.find_image("link.png", [root]) is None

    # 하위 폴더는 허용된다(작업 폴더 안이므로)
    (root / "sub").mkdir()
    (root / "sub" / "deep.png").write_bytes(IMAGE.read_bytes())
    assert mock_to_hwpx.find_image("sub/deep.png", [root]) is not None

    ok = mock_to_hwpx.build(problem("figure.png"), root / "ok.hwpx", images=[root])
    assert ok.figures == 1 and not ok.warnings, ok.warnings
    blocked = mock_to_hwpx.build(problem("../outside.png"), root / "blocked.hwpx", images=[root])
    assert blocked.figures == 0
    assert any("찾지 못했습니다" in warning for warning in blocked.warnings), blocked.warnings

print("HWPX image path tests passed")
