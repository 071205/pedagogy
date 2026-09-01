"""`/document-hwpx`가 같은 로컬 보안 관문과 JSON 검증을 쓰는지 확인한다."""

from __future__ import annotations

import io
import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


HERE = Path(__file__).parent
ROOT = HERE.parents[1]

SAMPLE = {"version": 1, "title": "문서 내보내기 검사", "blocks": [
    {"type": "paragraph", "text": "수식 $x^2$를 포함한 본문입니다."},
]}


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def post(port: int, body: dict, *, header: bool = True):
    return urllib.request.urlopen(urllib.request.Request(
        f"http://127.0.0.1:{port}/document-hwpx", method="POST",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **({"X-Exam-Client": "1"} if header else {})},
    ), timeout=40)


try:
    import lxml  # noqa: F401
except Exception:
    print("lxml 이 없어 건너뜁니다")
    raise SystemExit(3)

port = free_port()
proc = subprocess.Popen([sys.executable, "serve.py", "--port", str(port)], cwd=str(ROOT),
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
            break
        except Exception:
            time.sleep(.2)
    else:
        raise AssertionError("로컬 서버가 시작하지 않았습니다")

    response = post(port, {"document": SAMPLE})
    with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
        section = archive.read("Contents/section0.xml").decode("utf-8")
    assert response.headers.get("X-Hwpx-Warnings") == "0"
    assert "문서 내보내기 검사" in section and "equation" in section

    # 표는 build()를 직접 호출하는 경로(test_document_export.py)뿐 아니라 이 HTTP
    # 엔드포인트로도 실제로 들어오는지 확인한다 — 계약(document_schema)이 늘면
    # 서버 쪽 코드 변경 없이 저절로 통과해야 하는데, 그게 실제로 맞는지는 요청을
    # 보내 봐야 안다.
    table_doc = {"version": 1, "title": "표 엔드포인트 검사", "blocks": [
        {"type": "table", "rows": [["a", "b"], ["1", "2"]]},
    ]}
    response = post(port, {"document": table_doc})
    with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
        table_section = archive.read("Contents/section0.xml").decode("utf-8")
    assert "<hp:tbl" in table_section, "표 블록이 엔드포인트를 통해서도 hp:tbl로 나와야 합니다"

    # 그림도 이 HTTP 경로로 실제로 들어오는지 — base64 라 파일 경로를 나르지 않는다.
    figure = HERE / "samples" / "images" / "fig14.png"
    if figure.exists():
        import base64
        image_doc = {"version": 1, "title": "그림 엔드포인트 검사", "blocks": [
            {"type": "image", "data": base64.b64encode(figure.read_bytes()).decode(), "width": 50},
        ]}
        response = post(port, {"document": image_doc})
        with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
            names = archive.namelist()
        assert any(n.startswith("BinData/") for n in names), \
            f"그림 블록이 엔드포인트를 통해서도 BinData 로 들어가야 합니다: {names}"

        # ⚠️ 파일 경로를 주면 서버가 거절해야 한다. 이 경로가 경로를 받지 않는다는 것이
        #    `/document-hwpx` 의 보안 전제다.
        try:
            post(port, {"document": {"title": "x", "blocks": [
                {"type": "image", "path": "/etc/passwd", "width": 50}]}})
        except urllib.error.HTTPError as exc:
            assert exc.code == 400, f"경로를 준 그림은 400 이어야 합니다 (지금 {exc.code})"
        else:
            raise AssertionError("파일 경로를 준 그림 블록을 서버가 거절해야 합니다")

    # ── 계약이 허용한 최대 그림이 실제로 전송되는가 (REV-2026-014) ──────────
    # ⚠️ 계약은 **원본 바이트**를, 서버 입구는 **base64 JSON 본문**을 잰다. 둘을 따로
    #    정하면 "계약은 통과했는데 413" 이 된다. 예전에 4MiB 그림이 5.6MB 본문이 되어
    #    변환기에 닿지도 못했다. 여기서 경계값을 실제로 보내 두 상한을 묶어 둔다.
    import base64, struct, zlib
    sys.path.insert(0, str(HERE))
    from document_schema import MAX_IMAGE_BYTES  # noqa: E402

    def fake_png(nbytes: int) -> bytes:
        ihdr = struct.pack(">II", 400, 300) + bytes([8, 2, 0, 0, 0])
        def chunk(tag, payload):
            return (struct.pack(">I", len(payload)) + tag + payload
                    + struct.pack(">I", zlib.crc32(tag + payload)))
        head = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
        return head + chunk(b"tEXt", b"x" * max(0, nbytes - len(head) - 12))

    biggest = {"version": 1, "title": "최대 그림", "blocks": [
        {"type": "image", "data": base64.b64encode(fake_png(MAX_IMAGE_BYTES)).decode(),
         "width": 100}]}
    try:
        response = post(port, {"document": biggest})
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        # 413 이면 서버가 본문을 다 읽기 전에 끊어 Broken pipe 로도 나타난다.
        raise AssertionError(
            "계약이 허용한 최대 그림이 서버 입구에서 막혔습니다 — "
            f"document_schema.MAX_IMAGE_BYTES 와 serve.py 의 MAX_BODY 가 어긋납니다 ({exc})"
        ) from exc
    assert response.status == 200, \
        f"계약이 허용한 최대 그림은 전송돼야 합니다 (지금 {response.status})"
    with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
        assert any(n.startswith("BinData/") for n in archive.namelist()), \
            "최대 크기 그림이 실제로 문서에 들어가야 합니다"

    try:
        post(port, {"document": {"title": "x", "blocks": [{"type": "rawXml", "text": "<x/>"}]}})
    except urllib.error.HTTPError as exc:
        assert exc.code == 400
    else:
        raise AssertionError("지원하지 않는 블록을 서버가 거절해야 합니다")

    try:
        post(port, {"document": SAMPLE}, header=False)
    except urllib.error.HTTPError as exc:
        assert exc.code == 403
    else:
        raise AssertionError("X-Exam-Client 없는 요청을 서버가 거절해야 합니다")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

print("범용 문서 HWPX 엔드포인트 검사 통과")
