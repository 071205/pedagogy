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
- S7039는 script 위험과 style 위험을 분리했다. script `unsafe-inline`과 외부 hostname wildcard는
  수정했다. style `unsafe-inline`과 exact loopback의 임의 포트는 기능상 수용 위험으로 남겼다.
- S5332 세 건은 기본 loopback과 명시적 LAN 모드를 분리해 수용했다. LAN은 인증 없는 사설망
  서버이므로 공용망에서 안전하다는 뜻이 아니다.
- Sonar 상태를 임의로 accept/false-positive 처리하지 않았다. 새 분석의 old/new ID와 새로 포함된
  HWPX 모듈 finding을 독립 검토자가 대조해 달라. `NOSONAR`나 분석 제외는 사용하지 않았다.

## 검증

- `npm run test:public`: source hash 5개, 실패 주입 9/9, 공개 산출물·비밀/맵/symlink 거절 통과.
- `npm run test:csp`: Chromium 세 페이지에서 임의 inline script/속성 차단, 등록 callback 유지,
  CSP 약화 실패 주입 통과.
- `npm run test:public-browser`: 네 공개 페이지 편집/인쇄/mock 저장, strict CSP red probe,
  `file://`, HWPX, private 404 통과.
- `node scripts/check-audit-browser.mjs`: 최종 158/158, JSON root 거절 12건 통과. 처음에는 기존
  inline test hook가 새 CSP에 차단돼 2건, 외부 hook 전환 중 4건이 실패했고 원인을 수정한 뒤 통과했다.
- `python3 scripts/test-server-download.py`: 실제 loopback에서 HWPX MIME/attachment/nosniff와
  오류 경계 통과. `node scripts/check-sonar-scope.mjs`: 범위 대조와 실패 주입 4/4 통과.
- 실제 Pages 익명 로드: index/document는 GitHub Pages·jsDelivr·gstatic, mock은 여기에 로컬
  8080/8787/8788 probe만 요청했고 CSP 오류가 없었다. 로그인/App Check 실계정 검증은 R7로 남겼다.

## 다음 검토자에게

먼저 이 diff와 `docs/SECURITY-ARCHITECTURE.md` §5.1의 11개 ID 판정을 독립 확인한다.
R1과 독립적인 다음 주 단계는 R2 / GPT-6 Astra high의 제품 범위 결정안이다. 저장 구현 뒤 R5에서
Sol medium의 보안·저장 통합 독립 검토를 수행한다. 사용자 미추적 `transcript.txt`는 건드리지 않는다.

## 검토 기록

구현자 자기검증 완료. 독립 검토 대기.
