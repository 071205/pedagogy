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
    └ --lan 을 주면 0.0.0.0 으로 열고, 이 PC 의 '사설 IP' 만 허용 목록에 더한다.
      임의 호스트명은 그때도 계속 거절하므로 리바인딩 방어는 유지된다.
      대신 상용 글꼴을 내보내는 /font/ 는 그 모드에서 꺼진다.
  · Host 헤더가 127.0.0.1/localhost 가 아니면 GET·POST 모두 거절한다
    (DNS 리바인딩 차단 — Origin 검사만으로는 막히지 않는다)
  · 브라우저에서 온 요청은 Origin 이 허용 목록에 있을 때만 받는다
  · 사용자가 보낸 경로로 파일을 읽거나 쓰지 않는다. 정적 파일은 화이트리스트만
  · typst 는 --root 를 작업 폴더로 묶어 그 밖의 파일을 못 읽게 한다
  · 셸을 거치지 않고(shell=False) 인자 배열로만 실행한다
  · 본문 크기 상한과 컴파일 시간 상한을 둔다
"""
from __future__ import annotations
import argparse, base64, hashlib, ipaddress, json, os, shutil, signal, socket, subprocess, sys, tempfile, threading, webbrowser
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
    # index.html/mock-exam-editor.html 을 iframe 으로 띄워 함수 단위로 재확인하는
    # 회귀 테스트. iframe 내부를 읽으려면 이 파일도 같은 출처로 떠야 하므로
    # file:// 로는 안 되고 반드시 이 화이트리스트를 거쳐야 한다.
    "/regression-test.html": ("regression-test.html", "text/html; charset=utf-8"),
    # 이용약관 · 개인정보처리방침. 본문 푸터에서 링크하므로 로컬에서도 열려야 한다.
    "/legal.html": ("legal.html", "text/html; charset=utf-8"),
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

# ── LAN 모드 ──
# 기본은 꺼져 있다. --lan 을 주면 같은 와이파이의 다른 기기(아이패드 등)에서
# 접속할 수 있게 0.0.0.0 에 바인딩하고, 아래 LAN_IPS 를 Host/Origin 허용에 더한다.
#
# ⚠️ 여기서 '아무 호스트명이나 허용'으로 완화하면 안 된다. 그러면 DNS 리바인딩
#    방어가 그대로 무너진다(공격자 도메인이 내 IP 로 재해석되어도 Host 는 그
#    도메인으로 남는데, 이름을 허용해 버리면 통과한다).
#    그래서 '이 PC 가 실제로 가진 사설 IP' 만 골라 허용 목록에 넣는다.
LAN_MODE = False
LAN_IPS: set[str] = set()


def private_ips() -> set[str]:
    """이 PC 가 가진 사설 대역(10/8, 172.16/12, 192.168/16) IPv4 주소만 모은다.
    공인 IP 나 링크로컬(169.254)은 넣지 않는다."""
    found: set[str] = set()

    def keep(ip: str):
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            return
        if a.version == 4 and a.is_private and not a.is_loopback and not a.is_link_local:
            found.add(str(a))

    # 바깥으로 나가는 인터페이스의 주소 (패킷은 실제로 보내지 않는다)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 9))       # TEST-NET-1 — 라우팅만 조회된다
        keep(s.getsockname()[0])
    except OSError:
        pass
    finally:
        s.close()

    # 호스트명으로 잡히는 주소들도 함께 (인터페이스가 여럿일 때)
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            keep(info[4][0])
    except OSError:
        pass
    return found


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
        base = ALLOW_ORIGINS | {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}
        if LAN_MODE:
            # 아이패드가 http://192.168.0.5:8787 로 열면 POST /render 의 Origin 이
            # 그 주소다. 여기에 더해 두지 않으면 Host 검사를 통과해도 403 이 난다.
            base |= {f"http://{ip}:{port}" for ip in LAN_IPS}
        return base

    def _origin_ok(self) -> bool:
        """Origin 이 로컬이거나 ALLOW_ORIGINS 에 있을 때만 허용."""
        o = self.headers.get("Origin")
        if o is None:
            return True                       # curl 등 Origin 없는 요청
        return o in self._allowed()

    def _host_ok(self) -> bool:
        """DNS 리바인딩 차단.

        공격자가 evil.example 을 127.0.0.1 로 재해석시키면, 브라우저는 이 서버를
        '같은 출처' 로 취급한다. 그러면 Origin 헤더가 아예 붙지 않거나(GET) 같은
        출처로 붙어서 _origin_ok() 로는 걸러지지 않고, CORS 도 방어가 되지 못한다.
        반면 Host 헤더에는 브라우저가 찾아간 이름이 그대로 남는다.

        예전에는 do_GET 에 출처 검사가 아예 없어서, 이 경로로 /health(로컬 절대경로)
        와 /font/*(상용 글꼴 파일 원본)를 그대로 받아갈 수 있었다.
        """
        h = (self.headers.get("Host") or "").strip()
        port = self.server.server_address[1]
        ok = {f"127.0.0.1:{port}", f"localhost:{port}", f"[::1]:{port}"}
        if LAN_MODE:
            # 임의 호스트명은 계속 거절하고, 이 PC 의 실제 사설 IP 만 더한다.
            # (이름까지 허용하면 리바인딩 방어가 사라진다)
            ok |= {f"{ip}:{port}" for ip in LAN_IPS}
        return h in ok

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
        if not self._host_ok():
            return self._json(403, {"error": "forbidden host"})
        if not self._origin_ok():
            return self._json(403, {"error": "forbidden origin"})
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self._cors()
        self.end_headers()

    # ── GET ──
    def do_GET(self):
        if not self._host_ok():
            return self._json(403, {"error": "forbidden host"})
        if not self._origin_ok():
            return self._json(403, {"error": "forbidden origin"})
        # 퍼센트 인코딩을 풀어야 공백이 든 파일명(글꼴)이 화이트리스트 키와 맞는다.
        # 화이트리스트 '정확히 일치' 방식이라 디코딩해도 경로 조작은 여전히 불가능하다.
        path = unquote(self.path.split("?", 1)[0])
        if path == "/health":
            # webfonts: /font/<이름> 으로 받아갈 수 있는 글꼴 파일 목록
            names = []
            # LAN 모드에서는 /font/ 를 막아 뒀으므로 목록도 비워 보낸다.
            # (편집기가 받아갈 수 없는 글꼴로 @font-face 를 만들지 않게 하고,
            #  설치된 글꼴 이름이 같은 와이파이에 새어 나가지도 않게 한다)
            if not LAN_MODE:
                for d in FONT_DIRS:
                    if d.is_dir():
                        names += [p.name for p in d.iterdir()
                                  if p.is_file() and p.suffix.lower() in FONT_EXTS]
            # 글꼴 폴더의 '절대 경로'는 돌려주지 않는다 — 홈 디렉터리 경로에 계정명이
            # 들어 있어 그대로 노출됐다. 편집기는 폴더가 있는지 여부만 쓴다.
            return self._json(200, {"ok": TYPST is not None,
                                    "typst": bool(TYPST),
                                    "fonts": [d.name for d in FONT_DIRS if d.is_dir()],
                                    "webfonts": sorted(set(names))})
        # /font/<파일명> — 시험 글꼴을 웹폰트로 내려준다.
        # 사파리는 보안상 @font-face 의 local() 로 시스템 글꼴을 쓰지 못하게 막는다.
        # 그래서 로컬 서버가 떠 있으면 글꼴 파일 자체를 건네, 어느 브라우저에서든
        # 미리보기가 정본과 같은 서체로 보이게 한다. (파일은 이 PC 밖으로 나가지 않는다)
        if path.startswith("/font/"):
            # LAN 모드에서는 글꼴 파일을 내보내지 않는다.
            # 이 글꼴들은 상용 라이선스 대상이고, FONT-LICENSE.md 의 견적 전제가
            # "글꼴 파일 자체는 사용자에게 전송되지 않는다" 이다. 같은 와이파이의
            # 아무 기기나 원본을 받아갈 수 있게 되면 그 전제가 깨진다.
            # 미리보기 서체만 폴백되고 정본(PNG/PDF) 출력은 그대로 나온다.
            if LAN_MODE:
                return self._json(403, {"error": "font serving disabled in LAN mode"})
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
        if not self._host_ok():
            return self._json(403, {"error": "forbidden host"})
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
    ap.add_argument("--lan", action="store_true",
                    help="같은 와이파이의 다른 기기(아이패드 등)에서 접속할 수 있게 연다 "
                         "— 보안이 약해지므로 개인 와이파이에서만 사용")
    a = ap.parse_args()

    global LAN_MODE, LAN_IPS
    LAN_MODE = a.lan
    if LAN_MODE:
        LAN_IPS = private_ips()

    for o in a.allow_origin:
        ALLOW_ORIGINS.add(o.rstrip("/"))
    WORK.mkdir(exist_ok=True)
    # localhost 로 연다. 127.0.0.1 은 Firebase Auth 의 기본 승인 도메인이 아니라
    # 구글 로그인이 auth/unauthorized-domain 으로 막힌다(localhost 는 기본 허용).
    url = f"http://localhost:{a.port}/"
    bind = "0.0.0.0" if LAN_MODE else "127.0.0.1"

    print("─" * 58)
    print(f"  편집기      {url}")
    print(f"  typst       {TYPST or '없음 →  brew install typst'}")
    for d in FONT_DIRS:
        print(f"  글꼴        {'○' if d.is_dir() else '×'} {d}")
    print(f"  그림 폴더   {WORK}   (그림은 여기에 두고 파일명만 입력하세요)")
    for o in sorted(ALLOW_ORIGINS):
        print(f"  허용 사이트 {o}")
    print("  Ctrl+C 로 종료")
    print("─" * 58)

    if LAN_MODE:
        if not LAN_IPS:
            print("  ⚠️  LAN 모드를 켰지만 사설 IP 를 찾지 못했습니다.")
            print("      와이파이에 연결돼 있는지 확인해 주세요. 지금은 이 PC 에서만 열립니다.")
            print("─" * 58)
        else:
            first = sorted(LAN_IPS)[0]
            print("  ⚠️  LAN 모드 — 같은 와이파이의 모든 기기가 이 서버에 접근할 수 있습니다")
            print("      카페·학교·회사 등 공용 와이파이에서는 절대 켜지 마세요.")
            print("      신뢰할 수 있는 개인 와이파이에서만 사용하세요.")
            print()
            for ip in sorted(LAN_IPS):
                print(f"      접속 주소   http://{ip}:{a.port}/")
            print()
            print("      이 모드에서 알아 둘 것")
            print(f"      · 구글 로그인을 쓰려면 Firebase 콘솔 → Authentication →")
            print(f"        '승인된 도메인' 에 {first} 를 추가해야 합니다")
            print(f"        (추가 전에는 auth/unauthorized-domain 으로 막힙니다)")
            print(f"      · AI 변환을 쓰려면 worker/wrangler.toml 의 ALLOWED_ORIGINS 에")
            print(f"        http://{first}:{a.port} 를 추가하고 다시 배포해야 합니다")
            print("      · 글꼴 파일 제공(/font/)은 라이선스 보호를 위해 꺼집니다")
            print("        (미리보기 서체만 폴백되고 정본 출력은 그대로입니다)")
            print("─" * 58)

    srv = ThreadingHTTPServer((bind, a.port), Handler)
    if a.open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
        srv.shutdown()


if __name__ == "__main__":
    main()
