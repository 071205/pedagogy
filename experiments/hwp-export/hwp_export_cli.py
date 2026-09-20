"""Local command-line adapters for the HWPX runtime modules.

These functions intentionally read and write paths selected by the local user.
The HTTP server imports the converter modules directly and never calls this file.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Callable


def document_main(build: Callable, validation_error: type[Exception], sample: Path,
                  script_name: str) -> int:
    if len(sys.argv) != 3:
        raise SystemExit(
            "사용법: python3 document_to_hwpx.py <문서.json> <출력.hwpx>\n"
            f"\n바로 해 보려면:\n  python3 {script_name} "
            f"{sample.relative_to(Path(__file__).parent)} 결과.hwpx")
    source = Path(sys.argv[1])
    if not source.is_file():
        raise SystemExit(
            f"문서 JSON 을 찾을 수 없습니다: {source}\n"
            f"\n예시 문서로 먼저 해 보세요:\n  python3 {script_name} "
            f"{sample.relative_to(Path(__file__).parent)} 결과.hwpx")
    try:
        document = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{source} 가 올바른 JSON 이 아닙니다 — {exc}") from exc
    try:
        report = build(document, sys.argv[2])
    except validation_error as exc:
        raise SystemExit(f"문서 JSON 오류: {exc}") from exc
    print(f"문서 {report.blocks}블록 · 수식 {report.equations}개 · 경고 {len(report.warnings)}개"
          f" → {sys.argv[2]}")
    for warning in report.warnings:
        print("  ⚠️", warning)
    return 0


def mock_main(build: Callable, profile: dict) -> int:
    argv = sys.argv
    if len(argv) < 2:
        print("사용법: python3 mock_to_hwpx.py 시험지.json [out.hwpx] [그림폴더]")
        return 2
    source = Path(argv[1])
    output = Path(argv[2]) if len(argv) > 2 else source.with_suffix(".hwpx")
    data = json.loads(source.read_text(encoding="utf-8"))
    images = [Path(argv[3])] if len(argv) > 3 else [source.parent]
    report = build(data, output, images=images)
    print("조판 규격 출처:", profile.get("_source") or "(없음)")
    print(f"문항 {report.problems}개, 수식 {report.equations}개, 그림 {report.figures}개, "
          f"단나눔 {report.breaks}회, 쪽나눔 {report.pages}회, 벌린 줄 {report.padded}개, "
          f"태그 {report.tags}개, 확인사항 {report.notes}개 → {output} "
          f"({output.stat().st_size:,} bytes)")
    if report.warnings:
        print(f"\n⚠️ 경고 {len(report.warnings)}건 (조용히 넘기지 않습니다):")
        for warning in report.warnings[:20]:
            print("  -", warning)
        return 1
    print("경고 없음")
    return 0
