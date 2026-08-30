"""mock_to_hwpx 그림 내보내기 검사 — 실제 HWPX ZIP에 바이너리가 들어가는지 확인한다."""

from __future__ import annotations

import base64
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jakal_hwpx import HwpxDocument  # noqa: E402
from mock_to_hwpx import build  # noqa: E402

# 2×1 PNG. 폭 58mm 그림이 2:1 비율로 HWPX에 들어가야 한다.
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADElEQVR42mNk+M/wHwAF/gL+5R4ZzwAAAABJRU5ErkJggg==")


def fixture(src: str) -> dict:
    return {"round": "그림 검사", "problems": [{"num": 1, "type": "choice", "pts": 2,
        "blocks": [
            {"type": "statement", "data": {"text": "다음 그림을 보자."}},
            {"type": "image", "data": {"width": 58, "src": src}},
            {"type": "choices", "data": {"items": ["가", "나", "다", "라", "마"]}},
        ]}]}


with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    (root / "figure.png").write_bytes(PNG)
    out = root / "exam.hwpx"
    report = build(fixture("figure.png"), out, asset_dir=root)
    assert not report.warnings, report.warnings
    assert len(HwpxDocument.open(str(out)).pictures()) == 1
    with zipfile.ZipFile(out) as archive:
        binaries = [name for name in archive.namelist() if name.startswith("BinData/")]
        assert len(binaries) == 1, binaries
        assert archive.read(binaries[0]) == PNG

    missing = build(fixture("../outside.png"), root / "blocked.hwpx", asset_dir=root)
    assert any("그림 파일을 읽지 못함" in warning for warning in missing.warnings)

print("mock_to_hwpx image export tests passed")
