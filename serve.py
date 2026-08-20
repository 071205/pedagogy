#!/usr/bin/env python3
"""
평가원 모의고사 편집기 — 로컬 렌더 서버

  python3 serve.py            →  http://127.0.0.1:8787 을 브라우저로 열기
  python3 serve.py --port 9000
  python3 serve.py --open     →  브라우저까지 자동으로 열기

편집기가 만든 Typst 소스를 받아 실제로 컴파일하고 쪽 이미지를 돌려준다.
정본을 뽑는 것과 똑같은 typst·글꼴을 쓰므로, 왼쪽 미리보기가 곧 결과물이다.

── 보안 ──
이 서버는 로컬 전용이다. 다음을 지킨다.
  · 127.0.0.1 에만 바인딩한다 (같은 와이파이의 다른 기기도 접근 불가)
  · 브라우저에서 온 요청은 Origin 이 localhost 일 때만 받는다 (DNS 리바인딩 차단)
  · 사용자가 보낸 경로로 파일을 읽거나 쓰지 않는다. 정적 파일은 화이트리스트만
  · typst 는 --root 를 작업 폴더로 묶어 그 밖의 파일을 못 읽게 한다
  · 셸을 거치지 않고(shell=False) 인자 배열로만 실행한다
  · 본문 크기 상한과 컴파일 시간 상한을 둔다
"""
from __future__ import annotations
import argparse, base64, hashlib, json, os, shutil, signal, subprocess, sys, tempfile, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"                 # 그림 등 typst 가 읽어도 되는 유일한 폴더
MAX_BODY = 4 * 1024 * 1024           # 요청 본문 4MB
TIMEOUT = 25                         # 컴파일 제한 시간(초)
MAX_CONCURRENT = 2                   # 동시에 돌릴 typst 개수 (CPU 폭주 방지)
MAX_PAGES = 60                       # 한 번에 돌려줄 쪽 수 상한
MAX_TOTAL_PNG = 48 * 1024 * 1024     # 응답에 담을 PNG 총량 상한
PPI_MIN, PPI_MAX = 48, 400   # 레티나에서 크게 확대하면 200 으로는 뭉개진다

# 정적 파일 화이트리스트 — 여기 없는 이름은 어떤 경로로도 못 가져간다
STATIC = {
    # / 는 index.html(PEDAGOGY)이 같은 폴더에 있으면 그쪽을, 없으면 모의고사 편집기를 연다
    "/": ("index.html" if (HERE / "index.html").is_file() else "mock-exam-editor.html",
          "text/html; charset=utf-8"),
    "/mock-exam-editor.html": ("mock-exam-editor.html", "text/html; charset=utf-8"),
    # PEDAGOGY 본체를 같은 폴더에 두면 여기서 같이 띄울 수 있다 (같은 출처가 되어
    # 모의고사 모드에서 /render 를 그대로 부를 수 있다)
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/mock": ("mock-exam-editor.html", "text/html; charset=utf-8"),
    # index.html 이 @font-face 로 참조하는 브랜드 글꼴. 화이트리스트에 없으면 404 가 나
    # 로고가 폴백 서체로 나온다. 파일이 없으면 아래 do_GET 이 알아서 404 를 돌려준다.
    "/Adobe Caslon Pro Bold.ttf": ("Adobe Caslon Pro Bold.ttf", "font/ttf"),
}

# https 사이트(깃허브 페이지 등)에서 이 로컬 서버를 부를 수 있게 허용할 출처.
# 여기 적힌 곳만 허용한다. --allow-origin 으로 더 추가할 수 있다.
ALLOW_ORIGINS = {
    "https://071205.github.io",
}

FONT_DIRS = [
    Path.home() / "exam-fonts",
    Path("/Applications/Hancom Office HWP.app/Contents/Resources/Hnc/Shared/TTF/Hwp"),
    Path("/Applications/Hancom Office HWP.app/Contents/Resources/Hnc/Shared/TTF/Install"),
]


FONT_EXTS = {".ttf": "font/ttf", ".otf": "font/otf", ".ttc": "font/collection"}


def find_font(name: str) -> Path | None:
    """FONT_DIRS 안에서 '파일명이 정확히 일치하는' 글꼴만 찾아 돌려준다.
    경로 구분자나 상위 참조가 섞인 이름은 즉시 거절해 폴더 밖으로 못 나가게 한다."""
    if not name or "/" in name or "\\" in name or name.startswith("."):
        return None
    if Path(name).suffix.lower() not in FONT_EXTS:
        return None
    for d in FONT_DIRS:
        if not d.is_dir():
            continue
        f = d / name
        try:
            # 심볼릭 링크로 폴더를 벗어나는 경우까지 차단
            if f.is_file() and f.resolve().parent == d.resolve():
                return f
        except OSError:
            continue
    return None


def find_typst() -> str | None:
    p = shutil.which("typst")
    if p:
        return p
    for c in ("/opt/homebrew/bin/typst", "/usr/local/bin/typst"):
        if Path(c).is_file():
            return c
    return None


TYPST = find_typst()

# 동시 컴파일 수 제한. typst 는 CPU 를 많이 쓰므로, 창을 여러 개 열어 두거나
# 편집이 빨라 요청이 몰리면 노트북이 통째로 느려진다. 순서대로 처리한다.
_COMPILE_SEM = threading.BoundedSemaphore(MAX_CONCURRENT)


def font_args() -> list[str]:
    out = []
    for d in FONT_DIRS:
        if d.is_dir():
            out += ["--font-path", str(d)]
    return out


def compile_typ(src: str, ppi: int) -> dict:
    """소스를 임시 폴더에서 컴파일해 쪽별 PNG 를 돌려준다."""
    if TYPST is None:
        return {"ok": False, "log": "typst 를 찾을 수 없습니다.  brew install typst"}
    # 동시 실행 수를 넘으면 잠시 기다린다. 너무 오래 밀리면 그냥 거절한다.
    if not _COMPILE_SEM.acquire(timeout=TIMEOUT):
        return {"ok": False, "log": "렌더 요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요."}
    try:
        return _compile_typ_locked(src, ppi)
    finally:
        _COMPILE_SEM.release()


def _compile_typ_locked(src: str, ppi: int) -> dict:
    WORK.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=str(WORK)) as td:
        tdp = Path(td)
        (tdp / "main.typ").write_text(src, encoding="utf-8")
        cmd = [TYPST, "compile", *font_args(),
               "--root", str(WORK),          # WORK 바깥은 못 읽는다
               "--format", "png", "--ppi", str(ppi),
               str(tdp / "main.typ"), str(tdp / "p{n}.png")]
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=TIMEOUT,
                               cwd=str(WORK), shell=False)
        except subprocess.TimeoutExpired:
            return {"ok": False, "log": f"컴파일이 {TIMEOUT}초를 넘겨 중단했습니다."}
        log = (r.stderr or b"").decode("utf-8", "replace")
        pages = sorted(tdp.glob("p*.png"),
                       key=lambda p: int("".join(ch for ch in p.stem if ch.isdigit()) or 0))
        if r.returncode != 0 or not pages:
            return {"ok": False, "log": log or "컴파일 실패"}
        # 쪽 수·총 용량 상한 — 실수로 거대한 문서를 만들어도 메모리를 다 먹지 않게
        truncated = len(pages) > MAX_PAGES
        pages = pages[:MAX_PAGES]
        out, total = [], 0
        for i, f in enumerate(pages, 1):
            b = f.read_bytes()
            total += len(b)
            if total > MAX_TOTAL_PNG:
                truncated = True
                break
            out.append({"n": i, "hash": hashlib.sha1(b).hexdigest()[:16],
                        "png": base64.b64encode(b).decode()})
        if truncated:
            log = (log + "\n" if log else "") + \
                  f"※ 미리보기가 너무 커서 {len(out)}쪽까지만 표시합니다."
        return {"ok": True, "pages": out, "log": log}


class Handler(BaseHTTPRequestHandler):
    server_version = "ExamRender/1.0"
    protocol_version = "HTTP/1.1"
    # 소켓 자체의 타임아웃(StreamRequestHandler.setup 이 적용). 느리거나 멈춘 커넥션이
    # 워커 스레드를 무한정 붙잡지 못하게 한다.
    timeout = 30

    # ── 공통 ──
    def log_message(self, fmt, *a):          # 접근 로그 조용히
        pass

    def handle_one_request(self):
        """느린 클라이언트로 소켓이 타임아웃되면 파이썬 기본 구현이
        OSError('cannot read from timed out object') 트레이스백을 뱉는다.
        로컬 개발 서버에서는 소음일 뿐이라 조용히 커넥션만 닫는다."""
        try:
            super().handle_one_request()
        except (TimeoutError, OSError):
            self.close_connection = True

    def _allowed(self) -> set[str]:
        port = self.server.server_address[1]
        return ALLOW_ORIGINS | {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}

    def _origin_ok(self) -> bool:
        """Origin 이 로컬이거나 ALLOW_ORIGINS 에 있을 때만 허용."""
        o = self.headers.get("Origin")
        if o is None:
            return True                       # curl 등 Origin 없는 요청
        return o in self._allowed()

    def _cors(self):
        """허용된 출처면 CORS 헤더를 붙인다.
        Access-Control-Allow-Private-Network 는 크롬이 https 페이지에서
        로컬(사설망) 주소를 부를 때 요구하는 허가 헤더다."""
        o = self.headers.get("Origin")
        if o and o in self._allowed():
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Exam-Client")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj: dict):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def _read_body(self, n: int) -> bytes | None:
        """본문을 조각내어 읽는다. Content-Length 를 실제보다 크게 선언하고
        데이터를 안 보내는 클라이언트가 커넥션을 잡아두지 못하게, 소켓 타임아웃
        (Handler.timeout) 안에 n 바이트가 다 오지 않으면 None 을 돌려준다."""
        buf = bytearray()
        while len(buf) < n:
            try:
                chunk = self.rfile.read(min(65536, n - len(buf)))
            except (TimeoutError, OSError):
                return None
            if not chunk:            # 상대가 선언한 길이보다 적게 보내고 끊음
                return None
            buf += chunk
        return bytes(buf)

    # ── 사전 요청(preflight) ──
    def do_OPTIONS(self):
        if not self._origin_ok():
            return self._json(403, {"error": "forbidden origin"})
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self._cors()
        self.end_headers()

    # ── GET ──
    def do_GET(self):
        # 퍼센트 인코딩을 풀어야 공백이 든 파일명(글꼴)이 화이트리스트 키와 맞는다.
        # 화이트리스트 '정확히 일치' 방식이라 디코딩해도 경로 조작은 여전히 불가능하다.
        path = unquote(self.path.split("?", 1)[0])
        if path == "/health":
            # webfonts: /font/<이름> 으로 받아갈 수 있는 글꼴 파일 목록
            names = []
            for d in FONT_DIRS:
                if d.is_dir():
                    names += [p.name for p in d.iterdir()
                              if p.is_file() and p.suffix.lower() in FONT_EXTS]
            return self._json(200, {"ok": TYPST is not None, "typst": TYPST,
                                    "fonts": [str(d) for d in FONT_DIRS if d.is_dir()],
                                    "webfonts": sorted(set(names))})
        # /font/<파일명> — 시험 글꼴을 웹폰트로 내려준다.
        # 사파리는 보안상 @font-face 의 local() 로 시스템 글꼴을 쓰지 못하게 막는다.
        # 그래서 로컬 서버가 떠 있으면 글꼴 파일 자체를 건네, 어느 브라우저에서든
        # 미리보기가 정본과 같은 서체로 보이게 한다. (파일은 이 PC 밖으로 나가지 않는다)
        if path.startswith("/font/"):
            f = find_font(path[len("/font/"):])
            if not f:
                return self._json(404, {"error": "font not found"})
            return self._send(200, f.read_bytes(), FONT_EXTS[f.suffix.lower()])

        item = STATIC.get(path)
        if not item:
            return self._json(404, {"error": "not found"})
        name, ctype = item
        f = HERE / name
        if not f.is_file():
            return self._send(404, f"{name} 이 serve.py 와 같은 폴더에 있어야 합니다.".encode(), "text/plain; charset=utf-8")
        return self._send(200, f.read_bytes(), ctype)

    # ── POST /render ──
    def do_POST(self):
        if self.path.split("?", 1)[0] != "/render":
            return self._json(404, {"error": "not found"})
        if not self._origin_ok():
            return self._json(403, {"error": "forbidden origin"})
        # 커스텀 헤더를 요구해 다른 사이트의 단순 요청(form 등)을 막는다
        if self.headers.get("X-Exam-Client") != "1":
            return self._json(403, {"error": "missing client header"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"error": "bad length"})
        if n <= 0 or n > MAX_BODY:
            return self._json(413, {"error": "body too large"})
        body = self._read_body(n)
        if body is None:
            # 소켓이 이미 타임아웃/절반만 읽힌 상태다. keep-alive 로 재사용하면
            # 다음 요청을 읽다가 OSError 가 나므로 이 커넥션은 여기서 끊는다.
            self.close_connection = True
            return self._json(408, {"error": "request body timeout"})
        try:
            req = json.loads(body.decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "bad json"})
        src = req.get("typ")
        if not isinstance(src, str) or not src.strip():
            return self._json(400, {"error": "no source"})
        try:
            ppi = int(req.get("ppi", 110))
        except (TypeError, ValueError):
            ppi = 110
        ppi = max(PPI_MIN, min(PPI_MAX, ppi))
        known = req.get("known") or []
        known = set(x for x in known if isinstance(x, str))

        res = compile_typ(src, ppi)
        if res.get("ok"):
            # 안 바뀐 쪽은 이미지를 빼고 해시만 보낸다 (보통 한 쪽만 바뀐다)
            for p in res["pages"]:
                if p["hash"] in known:
                    p.pop("png", None)
                    p["cached"] = True
        return self._json(200, res)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--open", action="store_true", help="브라우저를 자동으로 연다")
    ap.add_argument("--allow-origin", action="append", default=[],
                    help="이 로컬 서버를 부를 수 있는 https 사이트 주소 (여러 번 지정 가능)")
    a = ap.parse_args()

    for o in a.allow_origin:
        ALLOW_ORIGINS.add(o.rstrip("/"))
    WORK.mkdir(exist_ok=True)
    # localhost 로 연다. 127.0.0.1 은 Firebase Auth 의 기본 승인 도메인이 아니라
    # 구글 로그인이 auth/unauthorized-domain 으로 막힌다(localhost 는 기본 허용).
    url = f"http://localhost:{a.port}/"
    print("─" * 58)
    print(f"  편집기      {url}")
    print(f"  typst       {TYPST or '없음 →  brew install typst'}")
    for d in FONT_DIRS:
        print(f"  글꼴        {'○' if d.is_dir() else '×'} {d}")
    print(f"  그림 폴더   {WORK}   (그림 파일은 여기에 두세요)")
    for o in sorted(ALLOW_ORIGINS):
        print(f"  허용 사이트 {o}")
    print("  Ctrl+C 로 종료")
    print("─" * 58)
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)   # 로컬에만 바인딩
    if a.open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
        srv.shutdown()


if __name__ == "__main__":
    main()
