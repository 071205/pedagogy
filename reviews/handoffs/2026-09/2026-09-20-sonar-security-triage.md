# 변경 인계 — Sonar 364건 목록 분류와 핵심 보강

- ID: `HANDOFF-2026-150`
- 날짜: `2026-09-20`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `index | mock | server | tests | docs`
- 관련 이슈: 없음 (Sonar finding ID는 아래 전체 목록에 보존)

## 변경 내용

전체 364건/48규칙을 API로 수집하고 규칙별 1차 분류했다. **전부 개별 재현·수정 완료가 아니다.**
전체 ID와 후속 판단은 [SONAR-TRIAGE](../../audits/2026-09-20/SONAR-TRIAGE.md)에 있다.
28개 finding에 대응하는 코드 변경(26개 수정, Python XSS 2개 응답 보강)을 수행했다.

- `serve.py`: HWPX 응답을 공통 `_send` 보안 헤더로 통합, 고정 attachment 파일명,
  nosniff/no-store/no-referrer, 경고 헤더 노출. 변환 실패의 내부 예외 메시지 노출 제거.
- `.github/workflows/verify.yml`: npm ci --ignore-scripts, lockfile 설치된 Playwright 실행 파일 직접 호출.
  신규 표적 검사 두 개를 CI에 연결했다. Worker·인증·저장 로직은 변경하지 않았다.
- `mock-exam-editor.html`: whitespace 정규식을 literal split/trimEnd로 교체. 조건 문구 앞 줄바꿈 보존.
- `index.html`: data URL MIME 패턴 시작 고정 및 base64 형식 확인, 안 쓰는 row 제거,
  title 오탐을 유발한 CSS 주석의 태그 표기 제거.
- 접근성 스킬 기준으로 입력 이름 8개·legal nav 이름·선택 버튼 흰 글씨 대비 보완.

## 위험과 검토 요청

XSS 2건의 sink는 HTML이 아니라 변환된 ZIP 응답이다. ZIP 바이트를 HTML escape하지 않았다.
실제 누락된 다운로드 헤더와 내부정보 노출은 수정 전 테스트 실패를 확인했다.
이것이 Cloud finding 자동 해결을 보장하지는 않는다. 오탐·accepted 상태 일괄 변경은 하지 않았다.
배포 CSP script unsafe-inline은 기존 build-public에서 이미 제거되지만 style과 로컬 raw HTML은 남아 있다.
LAN HTTP, classic-script top-level await 권고, byte charCodeAt 권고는 기계 적용하지 않았다.
dataUrlToBlob 호출부는 이제 `data:<mime>;base64,`를 요구하므로 MIME 파라미터가 있는 외부 입력은 거절된다.

## 검증

- `python3 scripts/test-server-download.py`: 수정 전 3개 실패(두 다운로드 attachment 누락,
  변환 예외 내부경로 노출), 수정 후 통과. 실제 loopback HTTP + stub converter, ZIP 바이트 동일성,
  MIME/보안헤더/길이/경고헤더/클라이언트 관문/오류 비노출을 검사. 실제 변환기 생성 검사는 아님.
- `node scripts/check-sonar-fixes.mjs`: 조건문구 기존 결과 동등성, 20만 공백 입력,
  trim 삭제 red, 라벨 삭제 red, data URL 정상/비정상, 대비와 CI 명령 계약 통과.
  처음 시도한 구형 정규식 timeout red는 현재 Node 엔진에서 재현되지 않아 시간 기반 red를 제거했다.
- `node scripts/check-audit-browser.mjs`: serve.py + Chromium **158/158**, JSON 잘못된 root 12개 거절.
- `node scripts/check-accessibility.mjs`: 35개 통과.
- `node scripts/build-public.test.mjs`: public CSP/산출물 경계·실패주입 통과.
- `node scripts/check-sonar-scope.mjs`: 98개 대조, self-check 3/3.
- `node scripts/check-static.mjs`, `git diff --check`: 통과.
- 별도 임시 폴더에서 `npm ci --ignore-scripts --offline` 새 설치 후 Firebase app/firestore,
  rules-unit-testing, Playwright import 통과. 기존 node_modules는 변경하지 않았다.
- 전체 check:fast, 모든 브라우저 엔진, Firebase emulator는 관련 로직 변경이 없어 반복하지 않음.
- 커밋 `4c5206d`를 `main`에 push했다. Sonar 분석 대기열은 비어 있고 최신 분석 목록에는
  아직 `4c5206d` 결과가 나타나지 않아, 재분석 완료·최종 등급은 **미확인**이다.
  로컬 성공을 Cloud 해결로 보고하지 말 것.

## 다음 검토자에게

사용자가 5시간 한도 소진 전에 반드시 종료를 요청했다. 마지막 확인 잔여 11%에서 범위를 동결했다.
사용자의 `transcript.txt`는 수정·추적하지 않는다. 기존 변경을 재실행하지 말고 diff부터 독립 검토한다.

1. **GPT-5.6 Luna high**: diff/검증 기록 확인, 원격 반영 후 Sonar 재분석 확인 및 전체 ID 대조.
   new Error, Number.parseInt 등 의미가 동일한 단순 스타일 정리만 소규모 묶음으로 맡긴다.
2. **Astra high 유지 또는 새 한도에서 재개**: 조건문 70건의 실제 분기 의미, 복잡도 31건,
   catch 23건, JSON clone 의미, CSS cascade, LAN HTTP 보안 전제 판단. 전부 Luna에 자동 위임하지 않는다.
3. `experiments/hwp-export`는 serve.py에서 실제 실행된다. 분석 제외 파일 전체를 오탐으로
   단정한 HANDOFF-148 설명을 그대로 믿지 말고 Python 변환기 분석 범위 보완은 별도 검토한다.

## 검토 기록

독립 검토 대기.
