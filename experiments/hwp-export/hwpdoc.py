"""HWP 본문 스트림을 '문단' 단위로 다루는 최소 계층 (베타 실험).

왜 직접 만드는가
----------------
jakal-hwpx 는 `replace_paragraph_text_same_length()` 처럼 **길이가 같은 텍스트 교체**까지만
안전하게 지원한다(레코드 크기 헤더와 PARA_HEADER 의 글자수를 다시 쓰지 않기 때문이다).
시험지를 새로 조판하려면 문단을 지우고, 넣고, 길이가 다른 글을 채워야 하므로
그 계층만 여기서 직접 만든다. 파일 열기·압축·저장은 계속 jakal-hwpx 에 맡긴다.

레코드 구조
-----------
HWP5 의 본문 스트림은 (태그, 레벨, 크기) 헤더가 붙은 레코드가 죽 이어진 것이고,
'문단'은 트리가 아니라 **레벨로만** 구분된다:

    [0] para_header        ← 문단 시작
      [1] para_text
      [1] para_char_shape
      [1] para_line_seg
      [1] ctrl_header      ← 표·그림이 붙으면
        [2] ...            ← 그 안에 또 문단이 들어간다(표 칸 안 문단)

따라서 "레벨 0 문단 하나"는 para_header(레벨 0)부터 **다음 레벨 0 para_header 직전까지**의
모든 레코드다. 표 안 문단(레벨 2 이상)까지 같이 딸려 오는 것이 맞다 — 표는 그 문단의
일부이기 때문이다. 이 규칙을 어기고 레벨을 무시한 채 para_header 마다 자르면
표 한 칸이 통째로 다른 문단에 붙는다.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from jakal_hwpx import HwpRecord
from jakal_hwpx.hwp_binary import _iter_records
import jakal_hwpx.hwp_binary as hb

TAG_PARA_HEADER = hb.TAG_PARA_HEADER
TAG_PARA_TEXT = hb.TAG_PARA_TEXT
TAG_PARA_CHAR_SHAPE = hb.TAG_PARA_CHAR_SHAPE
TAG_PARA_LINE_SEG = hb.TAG_PARA_LINE_SEG

# PARA_HEADER 의 글자수 필드 최상위 비트. 의미를 완전히 알지 못하므로
# 새로 쓸 때도 원본 값을 그대로 보존한다(임의로 끄면 한글이 다르게 읽을 수 있다).
CHARCOUNT_FLAG = 0x80000000

# 실물 시험지의 본문 문단이 모두 쓰고 있는 instance id 값. 의미를 확정하지 못했으므로
# 새 문단도 같은 값을 쓴다(문단 0 만 0 이었는데 그건 구역 정의를 안은 특수 문단이다).
DEFAULT_INSTANCE_ID = 0x80000000


@dataclass
class Para:
    """레벨 0 문단 하나 = 머리 레코드 + 딸린 레코드 전부."""

    header: HwpRecord
    children: list[HwpRecord] = field(default_factory=list)

    @property
    def text(self) -> str:
        for rec in self.children:
            if rec.tag_id == TAG_PARA_TEXT:
                return rec.payload.decode("utf-16-le", errors="ignore")
        return ""

    @property
    def ctrl_ids(self) -> list[str]:
        """이 문단에 붙은 컨트롤 종류(tbl, gso, cold …). 표/그림 판별용."""
        out = []
        for rec in self.children:
            if rec.tag_id == hb.TAG_CTRL_HEADER and len(rec.payload) >= 4:
                out.append(rec.payload[0:4].decode("ascii", errors="replace")[::-1])
        return out

    def to_bytes(self) -> bytes:
        return b"".join([self.header.to_bytes()] + [c.to_bytes() for c in self.children])


def split_paragraphs(raw: bytes, level: int = 0) -> tuple[list[HwpRecord], list[Para]]:
    """본문 스트림을 (앞머리 레코드, 레벨 0 문단 목록) 으로 나눈다.

    앞머리는 보통 비어 있지만, 문단보다 먼저 오는 레코드가 있어도 잃지 않도록 따로 받는다.
    """
    prefix: list[HwpRecord] = []
    paras: list[Para] = []
    for rec in _iter_records(raw):
        if rec.tag_id == TAG_PARA_HEADER and rec.level == level:
            paras.append(Para(header=rec))
        elif paras:
            paras[-1].children.append(rec)
        else:
            prefix.append(rec)
    return prefix, paras


def join_paragraphs(prefix: list[HwpRecord], paras: list[Para]) -> bytes:
    return b"".join([r.to_bytes() for r in prefix] + [p.to_bytes() for p in paras])


def roundtrip_ok(raw: bytes, level: int = 0) -> bool:
    """분해 → 재조립이 원본과 바이트까지 같은지.

    이 검사가 통과해야만 위에서 무엇을 고치든 '내가 바꾼 것만' 바뀐다고 말할 수 있다.
    """
    prefix, paras = split_paragraphs(raw, level)
    return join_paragraphs(prefix, paras) == raw


# ── 레코드 만들기 ──────────────────────────────────────────────────────────

def _record(tag_id: int, level: int, payload: bytes) -> HwpRecord:
    return HwpRecord(
        tag_id=tag_id,
        level=level,
        size=len(payload),
        header_size=8 if len(payload) >= 0xFFF else 4,
        offset=-1,
        payload=payload,
    )


def make_para_header(char_count: int, para_shape_id: int, style_id: int,
                     *, level: int = 0, control_mask: int = 0,
                     split_flags: int = 0, flag: int = 0,
                     n_char_shapes: int = 1, n_range_tags: int = 0,
                     n_line_segs: int = 1,
                     instance_id: int = DEFAULT_INSTANCE_ID) -> HwpRecord:
    """PARA_HEADER 24바이트를 만든다.

    ⚠️ 12바이트(글자수·컨트롤·문단모양·스타일)만 쓰면 안 된다. 뒤에 이어지는
    **구간 개수 필드**가 실제 레코드 개수와 어긋나면 한글이 문단을 잘못 읽는다.
    실물 시험지 749개 문단 전부에서 다음이 성립함을 확인했다:

        b[12:14] = 직계 PARA_CHAR_SHAPE 구간 수
        b[16:18] = 직계 PARA_LINE_SEG 줄 수

    '직계'가 핵심이다 — 표 안 문단의 레코드는 세지 않는다.
    """
    payload = bytearray(24)
    payload[0:4] = ((flag & CHARCOUNT_FLAG) | (char_count & 0x7FFFFFFF)).to_bytes(4, "little")
    payload[4:8] = (control_mask & 0xFFFFFFFF).to_bytes(4, "little")
    payload[8:10] = (para_shape_id & 0xFFFF).to_bytes(2, "little")
    payload[10] = style_id & 0xFF
    payload[11] = split_flags & 0xFF
    payload[12:14] = (n_char_shapes & 0xFFFF).to_bytes(2, "little")
    payload[14:16] = (n_range_tags & 0xFFFF).to_bytes(2, "little")
    payload[16:18] = (n_line_segs & 0xFFFF).to_bytes(2, "little")
    payload[18:22] = (instance_id & 0xFFFFFFFF).to_bytes(4, "little")
    payload[22:24] = (0).to_bytes(2, "little")
    return _record(TAG_PARA_HEADER, level, bytes(payload))


def count_direct(para: "Para", tag_id: int, unit: int) -> int:
    """이 문단이 직접 거느린 레코드의 항목 수 (표 안 문단 것은 빼고)."""
    direct = para.header.level + 1
    return sum(r.size // unit for r in para.children
               if r.tag_id == tag_id and r.level == direct)


def make_para_text(text: str, *, level: int = 1) -> HwpRecord:
    return _record(TAG_PARA_TEXT, level, text.encode("utf-16-le"))


def make_para_char_shape(char_shape_id: int, *, level: int = 1) -> HwpRecord:
    """글자 모양 구간표. (시작 위치, 글자모양 id) 쌍의 배열이다.

    한 문단 전체를 한 가지 글자 모양으로 조판하므로 (0, id) 하나만 넣는다.
    굵게/밑줄이 섞인 문단을 만들려면 여기에 구간을 더 넣어야 한다(아직 안 함).
    """
    payload = (0).to_bytes(4, "little") + (char_shape_id & 0xFFFFFFFF).to_bytes(4, "little")
    return _record(TAG_PARA_CHAR_SHAPE, level, payload)


def make_para_line_seg(*, level: int = 1, text_height: int = 1000,
                       line_height: int = 1200, column_width: int = 0) -> HwpRecord:
    """줄 나눔 캐시 한 줄짜리.

    ⚠️ 이 값은 한글이 문서를 열 때 다시 계산하는 '캐시'다. 우리가 정확한 줄 나눔을
    계산해서 넣을 수는 없고(그건 조판 엔진이 하는 일), 자리만 만들어 둔다.
    **한글이 실제로 다시 계산해 주는지가 이 실험의 최종 미검증 항목이다.**
    """
    seg = bytearray(36)
    seg[0:4] = (0).to_bytes(4, "little")            # 텍스트 시작 위치
    seg[4:8] = (0).to_bytes(4, "little", signed=True)   # 줄의 세로 위치
    seg[8:12] = line_height.to_bytes(4, "little", signed=True)
    seg[12:16] = text_height.to_bytes(4, "little", signed=True)
    seg[16:20] = (0).to_bytes(4, "little", signed=True)  # 베이스라인 간격
    seg[20:24] = (line_height - text_height).to_bytes(4, "little", signed=True)
    seg[24:28] = (0).to_bytes(4, "little", signed=True)  # 단 시작 위치
    seg[28:32] = column_width.to_bytes(4, "little", signed=True)
    seg[32:36] = (0x00000393).to_bytes(4, "little")  # 첫 줄 + 줄 시작 태그
    return _record(TAG_PARA_LINE_SEG, level, bytes(seg))


def make_text_para(text: str, *, para_shape_id: int, style_id: int,
                   char_shape_id: int, line_seg_hint: HwpRecord | None = None) -> Para:
    """글자 모양이 균일한 본문 문단 하나를 만든다.

    text 는 문단 끝 '\\r' 을 포함해야 한다(한글이 문단 종료로 읽는다).
    """
    units = len(text.encode("utf-16-le")) // 2
    line_seg = line_seg_hint if line_seg_hint is not None else make_para_line_seg()
    header = make_para_header(
        units, para_shape_id, style_id,
        n_char_shapes=1, n_line_segs=max(1, line_seg.size // 36),
    )
    children = [
        make_para_text(text),
        make_para_char_shape(char_shape_id),
        line_seg,
    ]
    return Para(header=header, children=children)


def set_para_text(para: Para, text: str) -> None:
    """이미 있는 문단의 글만 바꾼다 — 글자 모양·문단 모양은 그대로 둔다.

    길이가 달라도 되도록 PARA_TEXT 레코드 크기와 PARA_HEADER 의 글자수를 함께 고친다.
    글자 모양 구간표는 문단 전체를 첫 구간의 모양으로 통일한다(구간이 여럿이면
    새 글 길이에 맞는 경계를 알 수 없기 때문이다).
    """
    units = len(text.encode("utf-16-le")) // 2
    old = para.header
    direct = old.level + 1

    for i, rec in enumerate(para.children):
        if rec.tag_id == TAG_PARA_TEXT and rec.level == direct:
            para.children[i] = make_para_text(text, level=rec.level)
        elif rec.tag_id == TAG_PARA_CHAR_SHAPE and rec.level == direct and rec.size >= 8:
            first_id = int.from_bytes(rec.payload[4:8], "little")
            para.children[i] = make_para_char_shape(first_id, level=rec.level)

    # 구간을 하나로 합쳤으므로 머리의 개수 필드도 반드시 함께 줄인다.
    # 줄 나눔 캐시는 손대지 않으므로 그 개수는 실제 레코드에서 다시 센다.
    para.header = make_para_header(
        units,
        int.from_bytes(old.payload[8:10], "little"),
        old.payload[10],
        level=old.level,
        control_mask=int.from_bytes(old.payload[4:8], "little"),
        split_flags=old.payload[11],
        flag=int.from_bytes(old.payload[0:4], "little") & CHARCOUNT_FLAG,
        n_char_shapes=count_direct(para, TAG_PARA_CHAR_SHAPE, 8),
        n_range_tags=int.from_bytes(old.payload[14:16], "little") if len(old.payload) >= 16 else 0,
        n_line_segs=count_direct(para, TAG_PARA_LINE_SEG, 36),
        instance_id=int.from_bytes(old.payload[18:22], "little") if len(old.payload) >= 22
                    else DEFAULT_INSTANCE_ID,
    )
