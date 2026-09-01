"""HWPX 내보내기는 외부 jakal-hwpx 없이 동작해야 한다."""

from __future__ import annotations

import builtins
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
SAMPLE = HERE / "samples" / "with-figure.json"
IMAGES = HERE / "samples" / "images"

original_import = builtins.__import__


def without_jakal(name, *args, **kwargs):
    if name == "jakal_hwpx" or name.startswith("jakal_hwpx."):
        raise ImportError("jakal-hwpx must not be a HWPX export runtime dependency")
    return original_import(name, *args, **kwargs)


builtins.__import__ = without_jakal
sys.path.insert(0, str(HERE))
try:
    import mock_to_hwpx

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "internal-only.hwpx"
        report = mock_to_hwpx.build(json.loads(SAMPLE.read_text(encoding="utf-8")), out,
                                    images=[IMAGES])
        assert out.exists() and out.stat().st_size > 0
        assert report.figures == 1, report
finally:
    builtins.__import__ = original_import

print("PEDAGOGY 내부 HWPX 런타임만으로 내보내기 통과")
