# 변경 인계 — Sonar 보안 R1 실제 배포·분석 경계 보강

- ID: `HANDOFF-2026-153`
- 날짜: `2026-09-20`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | mock | server | tests | docs`
- 관련 이슈: 없음 (Sonar finding은 `docs/SECURITY-ARCHITECTURE.md` §5.1에 보존)

## 변경 내용

실제 GitHub Pages가 `dist/public`이 아니라 루트 HTML을 서비스하는 것을 바이트 대조로 확인했다.
따라서 세 편집기의 source CSP 자체에서 인라인 script 5개를 SHA-256으로 잠그고 외부 hostname
wildcard를 Firebase/Auth/App Check의 개별 endpoint로 좁혔다. 공개 빌드는 script를 외부 파일로
분리할 때 source 전용 hash도 제거한다.

`serve.py`가 직접 import하는 `experiments/hwp-export` Python 9개를 Sonar main scope에 추가했다.
나머지 CLI/probe/test는 계속 제외한다. 엄격한 CSP 때문에 기존 회귀가 사용하던 임의 inline
hook가 차단되어, self 출처의 명시적 `tests/regression-hooks.js`로 옮겼다. 제품 CSP를 검사 때문에
완화하지 않았다.

## 위험과 검토 요청

- 기준 분석 `f8650730...`에는 보안 11건과 new security rating E가 있다. S5131 한 건은 HTML이
  아니라 고정 MIME·attachment·nosniff HWPX ZIP sink로 이어지는 근거 있는 오탐이다.
- S7039는 script 위험과 style 위험을 분리했다. script `unsafe-inline`, 외부 hostname wildcard,
  loopback 임의 포트, 법무 페이지 style inline은 수정했다. 세 편집기의 style 속성만 수용 위험이다.
- S5332 세 건은 기본 loopback과 명시적 LAN 모드를 분리해 수용했다. LAN은 인증 없는 사설망
  서버이므로 공용망에서 안전하다는 뜻이 아니다.
- Sonar 상태를 임의로 accept/false-positive 처리하지 않았다. 새 분석의 old/new ID와 새로 포함된
  HWPX 모듈 finding을 독립 검토자가 대조해 달라. `NOSONAR`나 분석 제외는 사용하지 않았다.
- `6adf121` 분석은 `_send` XSS를 제거하고 Security E→C를 확인했지만 HWPX 범위에서 19건을
  노출했다. 16건은 HWPX XML namespace URI 오탐이다. 세 CLI 경로 finding은 서버 런타임과
  로컬 CLI 모듈을 구조적으로 분리해 후속 코드에서 제거했다.

## 검증

- `npm run test:public`: source script hash 5개·법무 style hash 1개, 실패 주입 12/12,
  공개 산출물·비밀/맵/symlink 거절 통과.
- `npm run test:csp`: Chromium 세 페이지에서 임의 inline script/속성 차단, 등록 callback 유지,
  CSP 약화 실패 주입 통과.
- `npm run test:public-browser`: 네 공개 페이지 편집/인쇄/mock 저장, strict CSP red probe,
  `file://`, HWPX, private 404 통과.
- `node scripts/check-audit-browser.mjs`: 최종 158/158, JSON root 거절 12건 통과. 처음에는 기존
  inline test hook가 새 CSP에 차단돼 2건, 외부 hook 전환 중 4건이 실패했고 원인을 수정한 뒤 통과했다.
- `python3 scripts/test-server-download.py`: 실제 loopback에서 HWPX MIME/attachment/nosniff와
  오류 경계 통과. `node scripts/check-sonar-scope.mjs`: 범위 대조와 실패 주입 4/4 통과.
- Anaconda Python(lxml)에서 HWPX 10개 비네트워크 검사와 endpoint 2개, 문서·시험지 CLI 생성,
  동시성·예외 회복 통과. 검토용 사본 3개 앱 부팅·Typst 동일 결과도 통과.
- 실제 Pages 익명 로드: index/document는 GitHub Pages·jsDelivr·gstatic, mock은 여기에 로컬
  8080/8787/8788 probe만 요청했고 CSP 오류가 없었다. 로그인/App Check 실계정 검증은 R7로 남겼다.

## 다음 검토자에게

먼저 이 diff와 `docs/SECURITY-ARCHITECTURE.md` §5.1의 11개 ID 판정을 독립 확인한다.
R1과 독립적인 다음 주 단계는 R2 / GPT-6 Astra high의 제품 범위 결정안이다. 저장 구현 뒤 R5에서
Sol medium의 보안·저장 통합 독립 검토를 수행한다. 사용자 미추적 `transcript.txt`는 건드리지 않는다.

## 검토 기록

- `2026-09-23` — `Claude / Opus 5`: **독립 검토 완료 · 판정 유효 · 재현된 결함 없음.**
  검사 재실행이 아니라 주장을 직접 대조했다. ① **해시 5개를 직접 재계산**해(하네스를 쓰지 않고)
  index 3 · mock 1 · document 1 이 양방향으로 일치함을 확인했다 — 선언만 있고 본문이 없는 해시도,
  해시가 없어 **조용히 차단될** 인라인 스크립트도 없다. ② `gh api repos/071205/pedagogy/pages` 가
  source = `main` 브랜치 **루트**임을 확인해, 바이트 대조보다 강한 근거로 '`dist/public`이 아니다'를
  뒷받침한다. ③ 공개 빌드 산출물에서 인라인 0개·`sha256-` 제거를 확인했고 **`script-src-attr 'none'`은
  살아남는다**(제거 정규식이 `script-src\s+`라 `-attr`에 걸리지 않는다). ④ `mock_to_hwpx`·
  `document_to_hwpx`의 import 폐포를 AST로 계산하니 `hwp_export_cli`가 나왔으나 **둘 다
  `if __name__ == "__main__":` 안**이라 `serve.py`의 `importlib` 경로에서는 로드되지 않는다 —
  런타임 9개 = Sonar main scope 9개로 정확히 일치하며 §5.1의 런타임/CLI 분리 주장이 맞다.
  ⑤ `_send()`가 **무조건** nosniff를 붙이고, HWPX는 고정 MIME + 리터럴 파일명(`"exam.hwpx"`·
  `"document.hwpx"`)이며 정적 ctype은 `STATIC` 화이트리스트에서만 온다 — S5131 오탐 판정이 옳다.
  ⑥ CSP의 로컬 포트 8080·8787·8788이 세 HTML의 실제 탐색 포트와 정확히 일치하고, `--lan`은
  진짜 사설 IPv4만 허용하며 `/font`를 막는다 — S5332 수용 근거가 코드와 맞다.
  ⚠️ R1 이후 `index.html`이 6번 바뀌었으나(B1·B2·B3·R4.5) **모든 커밋이 해시를 함께 갱신**했고,
  `test:public`이 `check:fast`에, `test:csp`·`test:public-browser`·`check:public`이 CI
  `cross-platform` 잡에 걸려 있어 드리프트에 자동 경로가 있다.
  ▶ **남은 것은 결함이 아니라 R7 범위다** — GitHub Pages는 응답 헤더를 못 붙이므로 운영에서
  `frame-ancestors`·nosniff·Referrer-Policy가 **여전히 없다**(meta는 `frame-ancestors`를 못 싣는다).
  §5·§5.1이 이미 그렇게 적고 있으며 이 검토가 새로 바꾼 것은 없다. `REV-2026-097`은 `resolved`다.
  관찰 하나: `connect-src`의 `www.googleapis.com`은 와일드카드는 아니지만 넓은 호스트다 —
  script-src가 잠겨 있어 지금 실익은 낮고, R5/R7에서 반출 경계를 좁힐 후보로만 남긴다.
