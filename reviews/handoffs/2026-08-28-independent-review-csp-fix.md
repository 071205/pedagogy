# 변경 인계 — HANDOFF-2026-003/004/005 독립 검토 + CSP·CI 결함 수정

- ID: `HANDOFF-2026-006`
- 날짜: `2026-08-28`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index`, `tests`
- 관련 이슈: `REV-2026-005`, `REV-2026-006`

## 변경 내용

Codex가 남긴 세 인계(`HANDOFF-2026-003` 상용 출시 보안·권한·운영, `HANDOFF-2026-004`
본문·수식 크기 정렬, `HANDOFF-2026-005` 리팩터링 기준선)를 diff·코드·회귀 테스트로
독립 검토했다. `worker/index.js`의 quota 해시화·소비-전-예약 순서·48시간 alarm·purge
DELETE 엔드포인트, `firestore.rules`/`storage.rules`의 필드 화이트리스트·경로 제한,
`index.html`의 `setToDoc`/tombstone 쓰기가 새 Rules 스키마와 실제로 맞는지를 하나씩
대조했고 모두 일치함을 확인했다(`CLOUD_MAX_PROBLEMS`=20000 ↔ Rules의 `problems.size()<=20000`,
`setToDoc()`이 매번 9개 필드를 전부 채움 ↔ Rules의 `hasSetShape()` 등).

그 과정에서 새 결함 둘을 발견해 등록·수정했다.

1. `REV-2026-005` — App Check용 reCAPTCHA Enterprise 스크립트가 `index.html`의
   CSP `script-src`에 막혀 있었다. `script-src`·`frame-src`에
   `https://www.google.com`을 추가해 고쳤다.
2. `REV-2026-006` — `.github/workflows/verify.yml`의 "Whitespace errors" 단계가
   `git diff --check HEAD~1 HEAD`를 쓰는데, `actions/checkout@v4`의 기본
   `fetch-depth`(1, 얕은 클론)에서는 `HEAD~1`이 없어 **매 실행마다 실패**하는
   구조였다. `actions/checkout@v4`에 `fetch-depth: 2`를 추가해 고쳤다.

## 위험과 검토 요청

두 수정 모두 범위가 좁다. CSP 쪽은 `https://www.google.com`을 넓히는 변경이라, 이
한 줄 외에 다른 스크립트 실행 경로가 함께 열리지 않는지만 다시 봐 주면 된다
(reCAPTCHA Enterprise 용도로만 실제로 쓰인다). `appCheckSiteKey`는 여전히 빈 값이라
App Check는 이번에도 실사용 검증까지는 못 했다 — 실제 site key를 채운 뒤
로그인 → 저장 → 이미지 업로드 전체 흐름을 한 번 더 확인해야 한다(`REV-2026-005`의
'남은 위험' 참고). CI 쪽은 `fetch-depth: 2`가 이 저장소 첫 커밋 근처(과거분)에서는
여전히 `HEAD~1`이 없을 수 있지만, 지금은 커밋이 충분히 쌓여 있어 해당하지 않는다.

## 검증

- 실행한 명령 또는 수동 절차:
  1. (CSP) `python3 serve.py --port 8799` 로 로컬 서버를 띄우고, Claude Browser로
     실제 `document.createElement('script')`을
     `https://www.google.com/recaptcha/enterprise.js`로 주입해 CSP 위반을
     재현(수정 전) → 수정 후 새 탭에서 같은 시도가 위반 없이 통과함을 확인.
  2. (CSP) `regression-test.html` 실행.
  3. (CI) 로컬에서 `git clone --depth 1 --branch main`으로 GitHub Actions 기본
     체크아웃 조건을 재현해 `git diff --check HEAD~1 HEAD`가 실패함을 확인(수정
     전) → 워크플로에 `fetch-depth: 2`를 추가한 뒤 `--depth 2`로 같은 재현을
     반복해 정상 종료(코드 0)함을 확인(수정 후).
- 결과: CSP — 수정 전 위반 콘솔 오류 재현, 수정 후 위반 없음. 회귀 `83 / 83 통과`
  (수정 전후 동일, 회귀 없음). CI — 수정 전 `fatal: ambiguous argument 'HEAD~1'`
  재현, 수정 후 exit 0.
- 아직 실행하지 못한 검증과 이유: 실제 `appCheckSiteKey`로 App Check 토큰 발급
  전체 흐름은 유효한 site key와 Firebase Console 설정이 필요해 이번 세션에서는
  하지 못했다. GitHub Actions 자체에서 워크플로를 실행해 보지는 못했다(로컬 git
  재현으로 대신함).

## 다음 검토자에게

`index.html`의 CSP `<meta>` 두 줄(라인 28, 33 부근)과
`.github/workflows/verify.yml`의 `checkout` 스텝만 보면 된다. `worker/*`,
`firestore.rules`, `storage.rules`, `legal.html`, `regression-test.html`,
`test-fixtures/refactor-baseline/`의 나머지 변경은 diff·코드 대조로 확인했고
이번 인계에서 새로 고친 곳은 없다 — 재검토가 필요하면 원 인계 문서
(`HANDOFF-2026-003/004/005`)를 함께 본다.
