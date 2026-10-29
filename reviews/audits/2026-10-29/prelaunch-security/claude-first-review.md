## 합의

**(1) S5131 `/font/<name>` — 반사 XSS 익스플로잇 불가 (근거 있는 오탐).**
**(2) S5332 XML 네임스페이스 16건 — 오탐.** 실측 분포: `pedagogy_hwpx.py` 9, `document_to_hwpx.py` 3, `exam_style.py` 2, `exam_layout.py` 2 = 정확히 16 (테스트 파일 2건은 별도 집계).
**(3) 로컬 HTTP 3건 / style `unsafe-inline` 3건 — 범위 제한 수용 위험.** "위험 0"이 아니라 "loopback·사설망으로 범위를 좁힌 수용"이라는 문서 표현(`SECURITY-ARCHITECTURE.md:171-173`)이 코드와 일치한다.

## 미합의

- **S5131의 Sonar 메시지 자체**("사용자 제어 데이터를 반사하지 말라")는 이 흐름에 성립하지 않는다. 이스케이프 누락이 아니라 **반사가 존재하지 않는다**.
- **게이트 폐쇄는 아직 불가.** 판정은 닫혔지만 증거 체인이 닫히지 않았다(아래 조건).

## 근거

**S5131 — 흐름별 반증 (`serve.py`)**
- 싱크 본문은 요청 데이터가 아니라 `f.read_bytes()` 파일 바이트다. 요청의 `name`은 **경로 선택자**로만 쓰이고 응답 본문·헤더에 들어가지 않는다. 실패 경로도 `_json(404, {"error":"font not found"})`(`:535`) — 입력 에코 0. 즉 반사 채널 자체가 없다.
- MIME은 `FONT_EXTS[f.suffix.lower()]`(`:144`, `:536`)로 **고정**: `font/ttf|font/otf|font/collection`. 요청이 MIME을 고르지 못한다.
- `_send`(`:441-452`)가 `X-Content-Type-Options: nosniff`를 항상 붙인다 → 콘텐츠 스니핑으로 `text/html` 승격 불가. 직접 내비게이션 시 폰트 MIME은 문서로 파싱되지 않고(다운로드/빈 뷰), `@font-face`/`fetch` 임베딩은 애초에 스크립트 실행 컨텍스트가 아니다.
- 이름 집합 제한: `find_font`(`:190-207`)가 `/`·`\`·선행 `.`·비허용 확장자를 거절하고 `f.resolve().parent == d.resolve()`로 심볼릭 탈출까지 막는다. `unquote`(`:503`)는 정확일치 화이트리스트 뒤에 오므로 조작 여지 없음(널바이트는 `is_file()`의 ValueError 처리로 False).
- 전제 조건도 2중: `_host_ok()`(`:407-425`)가 DNS 리바인딩을, `LAN_MODE`에서는 `/font/` 자체를 403(`:531`)으로 차단.
- 가정 공격자가 `~/exam-fonts`에 HTML 내용을 `.ttf`로 심어도 **로컬 쓰기 권한이 이미 전제**이고, 응답은 여전히 `font/ttf + nosniff`라 실행되지 않는다. → 익스플로잇 불가.

**S5332 16건** — 전부 `"http://www.hancom.co.kr/hwpml/2011/*"` 형태의 선언 상수이며 요청 싱크에 연결되지 않는다. HTTPS 치환은 HWPX 네임스페이스 비교를 깨뜨린다.

**잔여 위험 3+3** — 로컬 HTTP는 기본 `127.0.0.1` 바인드(`:699`) + Host/Origin/커스텀 헤더/크기/타임아웃 검사. style inline은 실측 style 속성이 `index.html` 84행, `mock-exam-editor.html` 23행, `document-editor.html` 3행이라 hash 전환이 불가능하고, `script-src-attr 'none'`으로 스크립트 측면은 닫혀 있다.

## 게이트 폐쇄를 막는 조건

1. **Sonar 상태 미변경 정책** — 22건이 열려 있는 한 new security rating은 내려가지 않는다. 폐쇄는 소유자가 독립 검토 결과를 Sonar에 오탐/수용으로 **마킹하는 행위**에 의존한다(이번 작업 범위 외).
2. **증거 신선도** — 기준 분석이 `6adf121`인데 HEAD는 `58fb555`. `exam_layout.py`/`hwp_export_cli.py` 스코프 분리 후 **재분석 미실시** → S8707 3건이 main scope에서 실제로 빠졌는지 미확인.
3. **수용 결정의 명문화** — style 리팩터(~110곳)와 LAN/TLS 미도입을 1차 릴리스 범위 밖으로 두는 결정이 승인 기록으로 남아야 한다.

## 다음행동 (모두 비변경·승인 필요)

1. `python3 serve.py` 후 `curl -i -H 'Host: 127.0.0.1:8787' .../font/<이름>.ttf` 로 `font/ttf + nosniff`와 404 무반사를 캡처해 S5131 반증 증거로 첨부.
2. 현재 revision으로 Sonar 재분석 1회 실행(스코프 분리 확인) — 사용자 승인 후.
3. 재분석 결과가 22건을 유지하면, 16건 오탐 + 6건 수용 마킹을 **소유자가** 처리하고 그 시점에 게이트 재평가.
4. 문서 표의 기준 revision/analysis ID를 최신으로 갱신(별도 승인 시).
