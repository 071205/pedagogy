"""범용 문서 베타가 공유하는, 작고 엄격한 JSON 계약.

AI에게 HWPX/XML을 직접 만들게 하지 않는다. 이 계약을 통과한 블록만 브라우저 미리보기와
HWPX 조판기로 넘긴다. 새 블록을 추가할 때는 여기와 두 출력기를 함께 확장해야 한다.

지원 블록: heading·paragraph·equation·quote·bullets·numbered·table·image·box.

표 칸 안에는 수식을 넣을 수 없다(`_cell_text` 가 `$` 를 거절한다) — 조용히 글자 그대로
찍히면 사용자가 렌더된 줄 착각한다.

⚠️ **그림은 base64 로만 받는다. 파일 경로를 받지 않는다.** `serve.py` 의 `/document-hwpx`
는 "경로도 임의 XML 도 받지 않는다" 를 보안 전제로 명시하고 있고, 경로를 받기 시작하면
그 전제가 깨진다(모의고사 경로와 다른 점이다 — 그쪽은 서버가 허용한 폴더 안 파일만 읽는다).
형식은 **확장자가 아니라 바이트를 보고** 판정한다 — 이름만 그림인 파일이 HWPX 안에
들어가면 한글이 문서를 아예 열지 못한다.
"""

from __future__ import annotations

import base64
import binascii
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))

from pedagogy_hwpx import image_size  # noqa: E402


MAX_TITLE = 180
MAX_BLOCKS = 180
MAX_TEXT = 12_000
MAX_ITEMS = 80
MAX_TABLE_ROWS = 40
MAX_TABLE_COLS = 12
MAX_CELL_TEXT = 500
# 그림은 base64 로 실어 오므로 원본 바이트 기준으로 막는다(base64 는 약 4/3 배가 된다).
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MIN_IMAGE_MM, MAX_IMAGE_MM = 5, 170          # 170mm ≈ A4 본문 폭

TEXT_BLOCKS = {"heading", "paragraph", "equation", "quote"}
LIST_BLOCKS = {"bullets", "numbered"}
TABLE_BLOCKS = {"table"}
IMAGE_BLOCKS = {"image"}
BOX_BLOCKS = {"box"}
MAX_BOX_LABEL = 40


class DocumentValidationError(ValueError):
    """사용자/AI 입력이 범용 문서 계약을 벗어났을 때의 안전한 오류."""


@dataclass(frozen=True)
class Document:
    title: str
    blocks: list[dict[str, Any]]

    def as_dict(self) -> dict[str, Any]:
        return {"version": 1, "title": self.title, "blocks": self.blocks}


def _text(value: Any, where: str, *, limit: int = MAX_TEXT) -> str:
    if not isinstance(value, str):
        raise DocumentValidationError(f"{where}는 문자열이어야 합니다")
    value = value.strip()
    if not value:
        raise DocumentValidationError(f"{where}가 비어 있습니다")
    if len(value) > limit:
        raise DocumentValidationError(f"{where}가 너무 깁니다 (최대 {limit:,}자)")
    return value


def _cell_text(value: Any, where: str) -> str:
    """표 칸 글자. 문단·제목과 달리 **빈 칸을 허용한다** — 실제 표는 빈 칸이 흔하다."""
    if not isinstance(value, str):
        raise DocumentValidationError(f"{where}는 문자열이어야 합니다")
    value = value.strip()
    if len(value) > MAX_CELL_TEXT:
        raise DocumentValidationError(f"{where}가 너무 깁니다 (최대 {MAX_CELL_TEXT:,}자)")
    if "$" in value:
        # 표 조판기(pedagogy_hwpx.append_table)는 칸 하나에 글 하나만 넣는다 — 수식을
        # 섞어 넣는 emit_rich()의 조각 나누기를 타지 않는다. 조용히 '$' 를 문자 그대로
        # 찍으면 사용자가 수식이 렌더된 줄 알고 넘어간다. 그래서 여기서 막는다.
        raise DocumentValidationError(f"{where}: 표 칸 안의 수식('$')은 아직 지원하지 않습니다")
    return value


def validate(raw: Any) -> Document:
    if not isinstance(raw, dict):
        raise DocumentValidationError("문서는 JSON 객체여야 합니다")
    title = _text(raw.get("title"), "title", limit=MAX_TITLE)
    blocks = raw.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        raise DocumentValidationError("blocks가 한 개 이상 필요합니다")
    if len(blocks) > MAX_BLOCKS:
        raise DocumentValidationError(f"blocks는 최대 {MAX_BLOCKS}개입니다")

    clean: list[dict[str, Any]] = []
    for index, block in enumerate(blocks, 1):
        where = f"blocks[{index}]"
        if not isinstance(block, dict):
            raise DocumentValidationError(f"{where}는 객체여야 합니다")
        kind = block.get("type")
        if kind == "heading":
            level = block.get("level", 1)
            if not isinstance(level, int) or isinstance(level, bool) or level not in (1, 2, 3):
                raise DocumentValidationError(f"{where}.level은 1~3 정수여야 합니다")
            clean.append({"type": kind, "level": level, "text": _text(block.get("text"), f"{where}.text")})
        elif kind in TEXT_BLOCKS:
            clean.append({"type": kind, "text": _text(block.get("text"), f"{where}.text")})
        elif kind in LIST_BLOCKS:
            items = block.get("items")
            if not isinstance(items, list) or not items:
                raise DocumentValidationError(f"{where}.items가 한 개 이상 필요합니다")
            if len(items) > MAX_ITEMS:
                raise DocumentValidationError(f"{where}.items는 최대 {MAX_ITEMS}개입니다")
            clean.append({"type": kind, "items": [_text(item, f"{where}.items[{item_index}]")
                                                     for item_index, item in enumerate(items, 1)]})
        elif kind in TABLE_BLOCKS:
            rows = block.get("rows")
            if not isinstance(rows, list) or not rows:
                raise DocumentValidationError(f"{where}.rows가 한 개 이상 필요합니다")
            if len(rows) > MAX_TABLE_ROWS:
                raise DocumentValidationError(f"{where}.rows는 최대 {MAX_TABLE_ROWS}행입니다")
            width: int | None = None
            clean_rows: list[list[str]] = []
            for r_index, row in enumerate(rows, 1):
                if not isinstance(row, list) or not row:
                    raise DocumentValidationError(f"{where}.rows[{r_index}]가 비어 있습니다")
                if width is None:
                    width = len(row)
                    if width > MAX_TABLE_COLS:
                        raise DocumentValidationError(f"{where}.rows는 최대 {MAX_TABLE_COLS}열입니다")
                elif len(row) != width:
                    # 들쭉날쭉한 표는 조판기의 rowCnt/colCnt 와 실제 칸 수가 어긋난다.
                    # 병합 칸은 아직 지원하지 않으므로(엔진 쪽 docstring 참고) 모든 행이
                    # 같은 열 수여야 한다 — 빈 칸은 빈 문자열로 채워 보내야 한다.
                    raise DocumentValidationError(
                        f"{where}.rows[{r_index}]의 열 수가 {len(row)}개인데 "
                        f"첫 행은 {width}개입니다 — 모든 행이 같은 열 수여야 합니다")
                clean_rows.append([_cell_text(cell, f"{where}.rows[{r_index}][{c_index}]")
                                   for c_index, cell in enumerate(row, 1)])
            header = block.get("header", True)
            if not isinstance(header, bool):
                raise DocumentValidationError(f"{where}.header는 참/거짓이어야 합니다")
            clean.append({"type": kind, "rows": clean_rows, "header": header})
        elif kind in BOX_BLOCKS:
            # 테두리 상자. 줄바꿈으로 여러 줄을 넣을 수 있고, 조판기가 연속 문단으로
            # 풀어 하나의 상자로 만든다(`connect="1"`).
            text = _text(block.get("text"), f"{where}.text")
            label = block.get("label")
            if label is not None:
                label = _text(label, f"{where}.label", limit=MAX_BOX_LABEL)
            clean.append({"type": kind, "text": text, "label": label})
        elif kind in IMAGE_BLOCKS:
            # ⚠️ **파일 경로를 받지 않는다.** `serve.py` 의 `/document-hwpx` 는 "경로도 임의
            #    XML 도 받지 않는다" 를 보안 전제로 명시하고 있다. 그림은 base64 로 실어
            #    보내야 그 전제가 유지된다(모의고사 경로와 다른 점이다 — 그쪽은 서버가
            #    허용한 폴더 안 파일만 읽는다).
            encoded = block.get("data")
            if not isinstance(encoded, str) or not encoded.strip():
                raise DocumentValidationError(f"{where}.data 에 base64 그림이 필요합니다")
            try:
                data = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise DocumentValidationError(f"{where}.data 가 올바른 base64 가 아닙니다") from exc
            if not data:
                raise DocumentValidationError(f"{where}.data 가 비어 있습니다")
            if len(data) > MAX_IMAGE_BYTES:
                raise DocumentValidationError(
                    f"{where}.data 가 너무 큽니다 ({len(data):,}바이트, 최대 "
                    f"{MAX_IMAGE_BYTES:,}바이트)")
            # ⚠️ 확장자나 이름이 아니라 **바이트를 보고** 형식을 정한다. 이름만 그림인
            #    파일이 HWPX 안으로 들어가면 한글이 문서를 열지 못한다.
            size = image_size(data)
            if size is None:
                raise DocumentValidationError(
                    f"{where}.data 가 PNG 또는 JPEG 이 아닙니다 (내용을 보고 판정합니다)")
            width = block.get("width", 80)
            if isinstance(width, bool) or not isinstance(width, (int, float)):
                raise DocumentValidationError(f"{where}.width 는 숫자(mm)여야 합니다")
            if not (MIN_IMAGE_MM <= width <= MAX_IMAGE_MM):
                raise DocumentValidationError(
                    f"{where}.width 는 {MIN_IMAGE_MM}~{MAX_IMAGE_MM}mm 여야 합니다 (지금 {width})")
            clean.append({"type": kind, "data": encoded.strip(), "width": float(width),
                          "pixels": size})
        else:
            raise DocumentValidationError(f"{where}.type은 지원하지 않는 블록입니다")
    return Document(title=title, blocks=clean)
