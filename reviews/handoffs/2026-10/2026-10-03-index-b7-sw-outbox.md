# 변경 인계 — B7 Service Worker fixture 응답 outbox

- ID: `HANDOFF-2026-179`
- 날짜: `2026-10-03`
- 작성자: `Codex`
- 상태: `reviewed` — Claude 검토 2026-10-03: 결함 없음(fixture 경계 메모 2건) · merge 승인 대기
- 영향 영역: `index | tests | docs | server`
- 관련 이슈: `없음` (B6의 열린 별도 이슈는 `reviews/INDEX.md` 참조)

## 변경 내용

기준 `main d4762f6`, 브랜치 `codex/b7-outbox`의 미커밋 diff. 메시지 전용
`pedagogy-intake-sw.js`가 fixture 응답을 페이지 전달 전 B6의 owner IndexedDB 레코드에
보존한다. `pedagogy-intake.js`는 같은 트랜잭션으로 쪽 성공·초안 확정과 outbox 제거를
수행하며, 재실행·로그인 복구 시 owner/epoch·작업/원문 세대·attemptId를 재검사한다.
원문 삭제와 계정 삭제는 기존 B6 삭제 세대/fence를 사용해 늦은 SW 쓰기를 막는다.
`index.html`은 명시적인 `useOutbox` fixture hook만 제공한다. SW는 fetch/HTML 캐시,
실제 공급자 호출, background sync가 없고 운영 Worker의 intake 503은 그대로다.
[수명·API 경계](../../../docs/B7-INTAKE-OUTBOX.md)를 참조한다.

## 위험과 검토 요청

Claude Opus 5는 `d4762f6` 뒤의 B7 diff를 독립 검토해 달라. 특히 SW가 IDB 완료 전에
응답을 넘기지 않는지, 처리 중 owner 전환과 원문/계정 삭제 경쟁에서 늦은 응답이
다른 owner·삭제 세대로 들어가지 않는지, 잠긴 쪽에 응답이 남을 때 재호출 없이
한 번만 복구하는지 확인해 달라. 정적 배포의 두 새 파일, CSP 해시와 `file://`
경계, 별도 B5 원장 수명과 원문/응답 수명도 대조해 달라. B3~B6 동일 diff는 재심사하지 않는다.

## 검증

- `node scripts/check-intake-outbox.mjs`: PASS — 저장/원자 소비·중복 채택,
  전달 유실/재실행, owner 전환 중 응답, 재실행 잠금과 늦은 SW 보존의 교차,
  outbox 쓰기 실패, 원문 삭제 및 계정 삭제 중 늦은 응답.
- `B7_RED=1 node scripts/check-intake-outbox.mjs`: RED 검증 PASS — `git show d4762f6:pedagogy-intake.js`에는 outbox 전송/복구 API가 없어 실패한다.
- `npm run test:worker`: PASS — 운영 intake 503 포함 기존 Worker 계약 유지.
- `npm run test:public`: PASS — CSP 해시·공개 빌드 새 파일 포함.
- `npm run check:static`: PASS.
- `node scripts/check-intake-delete-fences.mjs`: PASS (116·117).
- `node scripts/check-intake-outbox-browser.mjs`, `B7_BROWSER_RED=1 node scripts/check-intake-outbox-browser.mjs`,
  `npm run test:intake`, `regression-test.html`: **이 환경에서는 실행 불가** — localhost
  `listen EPERM`으로 브라우저 서버가 시작하지 못한다. Claude가 허용 환경에서 실행해야 한다.
- `npm run check:review-hygiene`, `git diff --check`: 최종 기록 갱신 후 실행.

## 다음 검토자에게

브라우저 검사에서 실제 SW 등록, 응답 보존 후 전달 유실, 새로고침 복구와 기준
`d4762f6` red 모드를 확인해 달라. `npm run test:intake-outbox`가 두 브라우저 모드까지
묶는다. C1~C3/D3 미충족이므로 유료 종단 호출·교차 기기 복구·탭 종료 중 처리 지속은
검증 또는 약속하지 않았다. 검토와 막힌 검사 완료 뒤에만 커밋/후속 레일을 판단한다.

## 검토 기록

### 2026-10-03 — Claude Opus 5.5 독립 검토: **결함 없음 · fixture 경계 메모 2건**

Codex 샌드박스가 `.git` 쓰기·localhost·Chromium 을 막아, 막힌 검사를 Claude 가 돌리고 대신 커밋했다.
- 확인: SW 는 **메시지만** 처리한다(fetch 처리기·캐시 없음 → 페이지 로딩·배포 갱신에 영향 없음). 등록은 `createIntakeFixture({useOutbox:true})` 에서만 일어난다.
  응답을 owner 기록에 IDB 완료까지 쓴 뒤 페이지에 보낸다. 쓰기 직전 owner·작업 세대·원문 삭제 세대·attemptId 를 다시 본다.
  복구(`recoverOutbox`)는 쪽 결과 확정과 outbox 제거를 한 트랜잭션에서 한다(중복 초안·유일본 유실 없음). 원문 삭제는 그 원문의 outbox 를 지우고,
  계정 삭제 울타리(`purge`)는 outbox 까지 비운다. 로그인마다 도는 `recoverIntakeOutboxOnSession` 은 SW 가 등록돼 있지 않으면 바로 돌아간다(운영 사용자 영향 없음).
- 다시 돌린 검사: `test:intake` 전체(B6 28·112~117·로그인 복구 + **B7 Node 7개 · 브라우저 SW 저장→재실행 복구** + 각 `d4762f6` 빨간불) ·
  `test:audit-browser` 167/167 · `test:set-revision` · `test:sets-cloud` · `test:library-ui` · `test:cross:fast` · `test:public`(CSP) · `test:worker` · `check:static` 통과.
  Codex 보고의 'B6 fence 검사 exit 1 재실행 기록 없음' 은 이 실행에서 116·117·로그인 복구 모두 PASS 로 해소.
- 메모(결함 아님 · 실호출 연결 전에 정할 것):
  ① SW 가 응답을 **스스로 지어낸다**(fixture). 실제 경로 — SW 가 로그인 토큰·App Check 를 받아 Worker 를 부르는 방식, 토큰 수명, CORS — 는 아직 설계되지 않았다. C1~C3·U2 전에 정한다.
  ② outbox 를 쓰면 전송 오류는 모두 `locked` 가 된다. SW 사전 검사로 **호출조차 안 한** 거절도 재시도 불가가 된다(fixture 에서는 무해, 실호출 때 '호출 전 거절' 은 `failed` 로 갈라야 한다).

**판정**: B7 독립 검토 합의. PR CI 확인 → **해리 승인 merge(운영 배포)**. 운영 사용자에게는 SW 가 등록되지 않으므로 화면 변화 없음.
