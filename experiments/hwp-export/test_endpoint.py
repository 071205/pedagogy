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


if not SAMPLE.exists() or not FIGURE.exists():
    print(f"표본이 없어 건너뜁니다 ({SAMPLE.name})")
    raise SystemExit(0)
try:
    import jakal_hwpx  # noqa: F401
except Exception:
    print("jakal-hwpx 가 없어 건너뜁니다")
    raise SystemExit(0)

fails = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global fails
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail and not ok else ""))


WORK.mkdir(exist_ok=True)
made = []
work_fig = WORK / MARK
if not work_fig.exists():
    work_fig.write_bytes(FIGURE.read_bytes())
    made.append(work_fig)
if not OUTSIDE.exists():
    OUTSIDE.write_bytes(FIGURE.read_bytes())
    made.append(OUTSIDE)

port = free_port()
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
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    for f in made:                            # 우리가 만든 것만 치운다
        f.unlink(missing_ok=True)

print()
if fails:
    print(f"실패 {fails}건")
    raise SystemExit(1)
print("전부 통과")
