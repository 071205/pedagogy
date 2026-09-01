# 배포본에서 한글 내보내기가 제 주소로 요청을 보내 404 를 받는다

- ID: `REV-2026-017`
- 날짜: `2026-09-01`
- 보고자: `해리` (사용자)
- 상태: `fixed`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-028`

## 요약과 영향

깃허브 페이지(`https://071205.github.io/pedagogy/`)에서 `한글 내보내기` 를 누르면
**`한글 내보내기에 실패했어요`** 만 뜬다. 로컬 `serve.py` 는 정상적으로 떠 있고,
같은 요청을 `curl` 로 보내면 200 에 56KB 짜리 파일이 돌아온다.

로컬(`http://127.0.0.1:8787`)에서는 **우연히 잘 된다** — 그래서 아무도 못 봤다.

## 재현 절차

1. `python3 serve.py` 를 띄운다.
2. `https://071205.github.io/pedagogy/mock-exam-editor.html` 을 연다.
3. 툴바의 `한글 내보내기` 를 누른다.

배포본에서 잰 값:

```
LIVE.base           = ""            ← 빈 문자열
guardWouldRePing    = false         ← 재탐색 조건이 참이 되지 않는다
resolvedExportUrl   = https://071205.github.io/hwpx   ← 로컬 서버가 아니다
```

## 원인

`LIVE` 의 초기값이 `base:''` 인데, `toHwpx()` 의 재탐색 방어는 이렇게 적혀 있었다.

```js
if(LIVE.base===null||LIVE.base===undefined){ await pingServer(); }
const r=await fetch((LIVE.base||'')+'/hwpx', …)
```

`''` 는 `null` 도 `undefined` 도 아니라 **이 조건은 한 번도 참이 되지 않는다.**
`pingServer()` 는 부팅 때 딱 한 번만 돌고, 거기서 서버를 못 찾으면 `LIVE.base` 는
`''` 인 채로 남는다. 그러면 요청이 **페이지 자기 주소**로 나간다.

⚠️ **문제의 핵심은 404 가 `catch` 가 아니라는 것이다.** 깃허브 페이지는 없는 경로에
404 를 주는데, 그것도 '정상적인 HTTP 응답' 이라 `!r.ok` 가지로 떨어진다. 서버가 없을 때
쓰라고 만들어 둔 `catch` 의 안내("로컬 서버가 필요해요 · python3 serve.py 를 실행해
주세요")에는 **영영 도달하지 못하고**, 대신 아무것도 알려 주지 않는 기본 문구가 뜬다.

`base:''` 가 '같은 출처' 라는 **유효한 값**이면서 동시에 '아직 안 찾아봄' 이라는 뜻으로도
쓰인 것이 근본 원인이다. 두 상태를 한 변수에 담으면 구분할 수 없다.

같은 결함이 `document-editor.html` 에도 있었다. 거긴 더 나빠서, `"/document-hwpx"` 가
**상대경로로 하드코딩**돼 있어 서버를 찾는 단계 자체가 없었다.

## 서버는 잘못이 없다 (확인함)

`serve.py` 의 관문과 CORS 는 정확하다.

```
OPTIONS /hwpx  (Origin: https://071205.github.io)
  → 204
  Access-Control-Allow-Origin: https://071205.github.io
  Access-Control-Allow-Private-Network: true
```

위조 Origin·Host 는 403 으로 막힌다. CSP 의 `connect-src` 에도 `http://127.0.0.1:*` 이
들어 있다.

## 수정

- `LIVE.found` 를 **따로** 두었다(`null` 아직 안 찾아봄 / `true` 찾음 / `false` 없음).
  `base` 는 주소, `found` 는 상태 — 한 변수에 겹쳐 담지 않는다.
- `toHwpx()` 는 **누를 때마다** `found` 가 없으면 다시 찾는다. 페이지를 먼저 열고
  나중에 서버를 켜는 일이 흔한데, 부팅 때 한 번만 찾으면 그 뒤로 영영 못 쓴다.
- **못 찾으면 보내지 않는다.** 엉뚱한 주소로 POST 하는 대신 무엇을 해야 하는지 말한다.
  그 문구(`NO_SERVER_MSG`)는 한 곳에만 두고 두 자리에서 함께 쓴다.
- 통신이 도중에 끊기면 `LIVE.found=null` 로 되돌려 다음에 다시 찾게 한다.
- `document-editor.html` 에 `findHwpxServer()` 를 넣어 같은 규칙을 따르게 했다.

## 검증

브라우저에서 실제 버튼을 눌러 세 경로를 모두 확인했다.

| 상황 | `/hwpx` 로 실제 전송? | 화면 문구 |
|---|---|---|
| 서버 있음 | 보냄 → HTTP 200 | (성공) |
| 서버 없음 | **안 보냄** | 로컬 서버가 필요해요 · … `http://127.0.0.1:8787` 로 열어 주세요 |
| 없다가 켜짐 | 다시 찾아 보냄 | (성공) |

`document-editor.html` 도 같은 세 경로를 확인했다.

- `npm run check:fast` · `npm run test:visual` 통과.
- `regression-test.html` **92/92 통과.**

## 남은 것 — 배포본에서 로컬 서버에 닿는가는 별개 문제다

이 수정은 '엉뚱한 주소로 보내는 것' 과 '거짓말하는 오류 문구' 를 고친 것이다.
깃허브 페이지에서 `http://127.0.0.1:8787` 을 **부를 수 있는지** 는 브라우저에 달렸고,
확인한 환경에서는 `net::ERR_BLOCKED_BY_CLIENT` 로 막혔다(광고 차단 확장, 또는 최신
크롬의 로컬 네트워크 접근 정책일 수 있다 — 우리 CSP·CORS 는 둘 다 정상이다).

**막히면 이제는 그렇다고 말한다.** 확실히 되는 길은 `http://127.0.0.1:8787` 로 여는 것이다.
