# 변경 인계 — R7 로컬 Static Assets 호스트 준비

- ID: `HANDOFF-2026-199`
- 날짜: `2026-10-23`
- 작성자: Codex (GPT-6 Sol / medium)
- 상태: `ready-for-review`
- 영향 영역: `worker | tests | docs`
- 관련 이슈: 없음

## 중단 체크포인트 — 사용자 요청으로 현재 작업까지만 보존

- 실제 worktree: `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, branch `codex/r7-static-host-preparation`. 기본 저장소 checkout은 변경하지 않았다. `transcript.txt`는 접근·수정·생성 금지다.
- 로컬 구현과 아래 정상/RED 검사는 보존했다. 마지막 framing 검사 대기를 `networkidle`로 바꾼 뒤 `test-static-host-final.log`도 성공했다. 새 R7 원격 CI·PR·병합은 아직 없다.
- 독립 검토 `/root/r5_gate_review`와 구현자 `/root/r7_prepare`가 사용량 한도로 종료됐다. **R7 독립 최종 답변/승인 없음.** R6의 성공한 독립 판정과 혼동하지 않는다. 사용자 요청에 따라 재호출이나 다음 구현은 시작하지 않는다.
- 재개 순서: (1) 이 체크포인트와 diff의 독립 검토부터 재개 (2) 실제 재현 지적이 있으면 수정·정상/RED 확인 (3) 검토 후 PR·새 head CI (4) 통과 뒤 로컬 준비 묶음 병합. 도메인·App Check 운영 전환과 원문/작업 이관은 별도 미완료 게이트다.
- 검토에는 config의 실제 TOML 의미가 assets-only/dist-public 계약과 일치하는지와 오류 시 서버 시작/종료·정리 경계를 포함한다. 로컬 Node 실행 결과는 새 head의 Node22 CI를 대신하지 않는다.

## 변경 내용

기존 AI Worker의 이름·DO·secret·origin을 건드리지 않고, 별도
`wrangler.static.staging.toml`의 Static Assets 루트를 `dist/public`으로 고정했다.
`build-public.mjs`가 기존 meta CSP를 정규화한 페이지별 HTTP CSP와
`frame-ancestors`를 `_headers`로 생성한다. index/document/legal은 `'none'`,
같은 출처 모의고사 iframe은 `'self'`이며 공통 규칙은 nosniff·Referrer-Policy만
지정한다. `_headers`도 공개 산출물 allowlist·manifest SHA의 일부지만
Cloudflare가 URL로 제공하지 않는다.

`serve-static-staging.mjs`는 매 시작 전에 fresh build→출력 검증→manifest 대조를
완료한 뒤에만 loopback Wrangler를 시작한다. 빌드 실패 때 기존 `dist/public`을
보존하는 builder 계약은 유지하고, 서버 시작만 거절한다.
`check-static-host.mjs`는 실제 로컬 Wrangler의 root/별칭·query·404·비공개 경로와
HTML HTTP 헤더·같은 출처 mock iframe·외부 origin embedding 거절을 본다.
기존 `/pedagogy/` 서브경로 공개 브라우저 검사는 그대로 둔다.

## 위험과 검토 요청

- Cloudflare HTML auto-trailing-slash의 `/index.html→/`과 편집기
  `.html→확장자 없는 경로` redirect가 실제로 같은 파일·CSP를 주는지,
  누락 경로가 SPA index 200으로 떨어지지 않는지 재확인해 달라.
- `_headers`에서 공통 CSP를 두지 않아 duplicate header 값 결합이 없고,
  모의고사에 `'none'`이나 X-Frame-Options DENY가 붙지 않는지 봐 달라.
- staging config 이름은 로컬 fixture이며 원격 host/domain을 확정하거나 배포한
  증거가 아니다. 실제 credentials·App Check site key·유료 AI 값은 만들지 않았다.
- 구 origin JSON의 범위와 IndexedDB 원문/작업/연결·충돌 기록의 누락은
  [운영 체크리스트 A](../../../docs/SECURITY-OPERATIONS-CHECKLIST.md)의 표에 있다.
  owner/epoch·삭제 세대·고정 채택 ID가 걸린 무손실 archive/import는 이번 Sol medium
  구현에 넣지 않고 별도 high 저장 설계와 실계정 검증으로 남긴다.

## 검증

- `npm run test:public` 정상: source CSP 12/12 실패 주입, 공개 allowlist/
  `_headers`·symlink·secret·소스맵 검사, fresh-start 단위 검증 통과.
- `npm run test:static-host` 정상: 234개 manifest 산출물의 실제 로컬
  Wrangler 응답·SHA·404·헤더·iframe 검사 통과. 둘 다
  `/private/tmp/r7-2026-10-23/`에 로그 보존.
- RED: 생성 mock `frame-ancestors`를 `'none'`으로 임시 변이하면
  `build-public.test.mjs`가 exit 1; start 게이트를 기존 출력 검증만 하도록
  임시 변이하면 실패한 새 빌드에도 서버 spawn에 도달해
  `static-staging.test.mjs`가 exit 1. 변이는 모두 복구했고 각 로그는
  `red-frame.log`, `red-stale-start.log`.
- 미실행: 새 원격 호스트/도메인·실제 Google/Firebase/App Check 정상·거절,
  운영 CSP·source export/import, Pages/private 전환. 계정 자료와 운영 설정에
  접근하지 않았다.

- 마감 검사: `npm run check:static` 통과(`/private/tmp/r7-2026-10-23/final-static.log`). 리뷰 위생은 이슈 136건/열림 4·INDEX 116/120·최근 5/5이며, `git diff --check`도 통과했다.

## 다음 검토자에게

`scripts/build-public.mjs`, `scripts/serve-static-staging.mjs`,
`scripts/check-static-host.mjs`, 두 단위 검사와
`wrangler.static.staging.toml`만 먼저 대조하면 된다. R7은 로컬 준비 단계이며
실제 전환/롤백의 환경별 증적은 운영 체크리스트의 미확인 항목으로 남는다.

## 검토 기록

2026-10-23 · 독립 Codex 검토 요청 후 사용량 한도로 종료. 최종 판정 미수신·검토 대기. 부모는 인계·검사 로그와 변경을 보존하고 중단한다.

## 재개 시 대조할 핵심 파일 SHA-256

- `scripts/build-public.mjs`: `acf915ec4c710a797934a0792f047ff786c178cee6a1e3ee70f08ab9015d1021`
- `scripts/build-public.test.mjs`: `c933b9de443d6d244a91917bb9307a414b4bcc477b8818f7c349b66b97eda1eb`
- `scripts/serve-static-staging.mjs`: `0386f040e3691a1a73f821e0f6b6f11f766b37e327d6ebec7c77dcdf5ef5fadb`
- `scripts/static-staging.test.mjs`: `8bd87c16d7107ff681d1e2534b23f1c811df4b615ebd0c356f40fdc68636598f`
- `scripts/check-static-host.mjs`: `0930d3a472d2af48b97627580ee28b8d0467102da60da85c0cdfb5c414bacea0`
- `wrangler.static.staging.toml`: `b9f405086868e2b2a10aa80d7a194601cdd3cd313a94bfd77ecca975fcbbbdc6`
