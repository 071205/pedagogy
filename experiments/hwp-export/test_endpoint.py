"""`/hwpx` 엔드포인트를 실제로 띄워 확인한다 (베타).

`scripts/check-static.mjs` 는 `serve.py` 소스에 `images=[WORK]` 라는 **글자**가 있는지만
본다. 그건 서식만 바꿔도 깨지고, 반대로 글자가 있어도 동작을 보장하지 못한다.
여기서는 서버를 띄워 **응답을 보고** 판정한다.

  · 편집기가 안내하는 `work/` 안의 그림은 HWPX 에 들어간다
  · `../` 로 그 폴더를 벗어나는 그림은 들어가지 않고 경고가 붙는다
  · 보안 관문(`X-Exam-Client`)이 없으면 403

    python3 test_endpoint.py
"""

from __future__ import annotations

import json
import io
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
SAMPLE = HERE / "samples" / "editor-seed.json"
FIGURE = HERE / "samples" / "images" / "fig14.png"
WORK = ROOT / "work"
MARK = "hwpx-endpoint-check.png"
OUTSIDE = ROOT / "hwpx-endpoint-outside.png"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def post(port: int, data: dict, *, header: bool = True):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/hwpx", method="POST",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 **({"X-Exam-Client": "1"} if header else {})})
    return urllib.request.urlopen(req, timeout=40)


def with_src(src: str) -> dict:
    data = json.loads(SAMPLE.read_text(encoding="utf-8"))
    for p in data["problems"]:
        for b in p.get("blocks", []):
            if b.get("type") == "image":
                b["data"]["src"] = src
    return data


SKIP_FIXABLE = 3       # 설치하거나 파일을 두면 돌 수 있는 건너뜀 — CI 에서는 실패로 본다

if not SAMPLE.exists() or not FIGURE.exists():
    print(f"표본이 없어 건너뜁니다 ({SAMPLE.name}) — 저장소에 있어야 하는 파일입니다")
    raise SystemExit(SKIP_FIXABLE)
try:
    import lxml  # noqa: F401
except Exception:
    print("lxml 이 없어 건너뜁니다")
    raise SystemExit(SKIP_FIXABLE)

fails = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global fails
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail and not ok else ""))


# 서버를 시작하지 못하는 환경이면 표본을 만들기 전에 끝낸다. 이 호출이 아래 try/finally
# 바깥에 있는 것은 의도적이다 — 여기서 실패하면 정리할 파일 자체가 없어야 한다.
port = free_port()

WORK.mkdir(exist_ok=True)
made = []
work_fig = WORK / MARK
if not work_fig.exists():
    work_fig.write_bytes(FIGURE.read_bytes())
    made.append(work_fig)
if not OUTSIDE.exists():
    OUTSIDE.write_bytes(FIGURE.read_bytes())
    made.append(OUTSIDE)

proc = subprocess.Popen([sys.executable, "serve.py", "--port", str(port)],
                        cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):                       # 기동 대기
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
            break
        except Exception:
            time.sleep(0.2)

    print("/hwpx 엔드포인트")
    # 1) work/ 안 그림은 들어간다
    r = post(port, with_src(MARK))
    names = zipfile.ZipFile(io.BytesIO(r.read())).namelist()
    inside = [n for n in names if n.startswith("BinData/")]
    check("편집기 work/ 그림이 HWPX 에 들어간다", bool(inside), str(inside))
    check("그때 경고가 없다", r.headers.get("X-Hwpx-Warnings") == "0",
          str(r.headers.get("X-Hwpx-Warnings")))

    # 2) work/ 밖으로 나가는 그림은 막힌다
    r = post(port, with_src(f"../{OUTSIDE.name}"))
    names = zipfile.ZipFile(io.BytesIO(r.read())).namelist()
    check("work/ 밖 그림은 들어가지 않는다",
          not [n for n in names if n.startswith("BinData/")], str(names[:3]))
    check("그때 경고가 붙는다", r.headers.get("X-Hwpx-Warnings") not in (None, "0"),
          str(r.headers.get("X-Hwpx-Warnings")))

    # 3) 보안 관문이 살아 있다
    try:
        post(port, with_src(MARK), header=False)
        check("X-Exam-Client 없으면 거절", False, "200 이 돌아왔다")
    except urllib.error.HTTPError as e:
        check("X-Exam-Client 없으면 거절", e.code == 403, str(e.code))

    # 4) 동시에 눌러도 다 나온다
    # 이 서버는 ThreadingHTTPServer 다. 예전에는 요청마다 변환기를 reload 해서,
    # 한 요청이 build() 를 도는 사이 다른 요청이 모듈을 갈아 끼울 수 있었다.
    print("\n동시 요청")
    import threading as _th
    results: list = []
    lock = _th.Lock()

    def shoot() -> None:
        try:
            body = post(port, with_src(MARK)).read()
            ok = zipfile.ZipFile(io.BytesIO(body)).namelist()[0] == "mimetype"
        except Exception as e:                       # noqa: BLE001
            ok = f"{type(e).__name__}: {e}"
        with lock:
            results.append(ok)

    threads = [_th.Thread(target=shoot) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)
    check("동시 요청 4건이 모두 온전한 HWPX 로 돌아온다",
          len(results) == 4 and all(r is True for r in results), str(results))
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    for f in made:                            # 우리가 만든 것만 치운다
        f.unlink(missing_ok=True)

# ── 변환기를 한 번만 불러오는가 ───────────────────────────────────────────
# 요청마다 `importlib.reload()` 하던 것을 잠금 안에서 한 번만 불러오도록 바꿨다.
# 다시 reload 로 돌아가면 여기가 빨간불이 된다.
print("\n변환기 불러오기")
sys.path.insert(0, str(ROOT))
try:
    import serve  # noqa: E402

    exp = ROOT / "experiments" / "hwp-export"
    first, err1 = serve.load_hwpx(exp)
    second, err2 = serve.load_hwpx(exp)
    check("두 번 불러도 같은 모듈을 준다", first is not None and first is second,
          f"{err1 or ''} {err2 or ''}")
    # ⚠️ `sys.path` 에 그 폴더가 '없어야 한다' 고 볼 수는 없다 — 검사 스크립트 자신의
    #    폴더이기도 하고, `mock_to_hwpx` 도 형제 모듈을 부르려고 스스로 넣는다.
    #    여기서 볼 것은 serve.py 가 **자기가 넣은 것을 도로 빼는가**, 즉 부를수록
    #    같은 경로가 쌓이지 않는가다.
    before = sys.path.count(str(exp))
    for _ in range(3):
        serve.load_hwpx(exp)
    check("여러 번 불러도 sys.path 가 늘지 않는다",
          sys.path.count(str(exp)) == before,
          f"{before} → {sys.path.count(str(exp))}")

    # 실험용 스위치가 실제로 동작하는가.
    # ⚠️ `importlib.reload()` 는 **같은 모듈 객체를 그 자리에서 다시 실행**한다.
    #    객체가 그대로라 `is not` 로는 알 수 없고, 모듈 이름공간도 비우지 않아
    #    나중에 붙인 표식은 살아남는다. 모듈 수준에서 새로 만들어지는 것의 정체를
    #    보는 것이 확실하다 — 다시 실행되면 `CUR` 은 새 딕셔너리가 된다.
    serve.HWPX_RELOAD = True
    try:
        before_cur = second.CUR
        serve.load_hwpx(exp)
        check("--reload-hwpx 를 켜면 변환기를 다시 실행한다", second.CUR is not before_cur)
    finally:
        serve.HWPX_RELOAD = False
except Exception as e:                        # noqa: BLE001
    check("serve.py 를 불러온다", False, f"{type(e).__name__}: {e}")

print()
if fails:
    print(f"실패 {fails}건")
    raise SystemExit(1)
print("전부 통과")
