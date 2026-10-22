# 한글 경로에서 cross-platform 검사가 서버를 시작하지 못한다

- ID: `REV-2026-145`
- 날짜: `2026-10-22`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-197`

## 요약과 영향

`new URL("..", import.meta.url).pathname`의 한글 percent encoding이 spawn cwd로 그대로 전달되어 실제 python이 있어도 ENOENT로 검사가 중단된다. 제품 결함과 별개인 기존 검사 경로 결함이다.

## 재현 절차

한글 이름 worktree(`/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`)에서 `npm run test:cross:fast`를 실행한다.

## 기대 결과 / 실제 결과

- 기대: 실제 저장소 디렉터리에서 serve.py가 시작된다.
- 실제: spawn python3 ENOENT, cwd에는 `%EA…`가 포함된 URL pathname이 전달된다.

## 근거

`scripts/check-cross-platform.mjs` root 계산. `/private/tmp/u2-check-fast-final.log`의 실패와 `/private/tmp/u2-remaining-gates.log`의 정상 실행.

## 처리 기록

- 2026-10-22 · Codex: `fileURLToPath(new URL("..", import.meta.url))`로 로컬 파일 경로를 사용한다. 독립 Codex가 ASCII는 동일, 한글/공백은 올바른 로컬 경로가 되며 그 외 검사/브라우저/서버 인자가 불변임을 확인했다. 실제 한글 worktree에서 XPLAT_REQUIRE=1 Chromium/4크기/기존 실패 주입 자기검사 통과(기존 CDN 차단 경고2).
