# 변경 인계 — U1.5 원문 저장 묶음

- ID: `HANDOFF-2026-183`
- 날짜: `2026-10-04`
- 작성자: `Codex`
- 상태: `reviewed` — Claude Opus 검토 2회(1차 반려 5건 → 2차 전부 닫힘) · 미배포
- 영향 영역: `index`, `tests`, `docs`
- 관련 이슈: `없음` (열린 `REV-2026-108`은 별도 지문 묶음 작업)
- 검토 요청: `Claude Opus`

## 변경 내용

`pedagogy-intake.js`에 AI 설정 없이 사용할 수 있는 `registerSource`, `assignPages`를 추가했다.
파일 준비 코드는 `createJob`과 공유하고, D6 100MB/1GB/500쪽 한도와 내용 해시 재사용을 적용한다.
**B6 동작 변경:** `createJob`의 한 요청 AI 파일·바이트 한도는 기존 `config`를 유지하지만,
이미 저장한 원문 누적 합계는 `cap.totalBytes` 대신 D6의 1GB를 적용한다.
원문 Blob과 첫 권 연결은 같은 IDB 트랜잭션이다. 쪽 대응은 문항 `intake.sources`에만 저장하며
라이브러리 저장·Undo·클라우드 경로를 탄다. `assignPages`는 해당 문항의 출처 목록 전체 교체이므로
AI 출처 유지 시 호출자가 기존 목록을 함께 넘긴다. 저장 직후에도 Undo 한 번으로 복원되도록
라이브러리 commit 전후에 히스토리 경계를 확정한다. `reconnect`는 기존 기록을 내용으로 검증하고,
기록이 없으면 새 등록만 한다. `forProblem`은 권한 있는 원문 ID를 함께 반환한다.

`index.html`의 fixture 라이브러리 어댑터를 `createIntakeLibrary`로 추출했고,
운영용 `createIntakeStorageClient({editorsConfirmed})`도 이를 사용한다. 확인 기본값은 false다.
Web Lock·writer marker·디스크 기준·세션 확인을 유지한다. 라이브러리 commit의 로컬 저장 실패 시
메모리 문제집을 복구하고, 업데이트 필요 권만 쓰기를 보류한다. ⓐ 화면은 바꾸지 않았다.
API 요약은 `docs/B6-INTAKE-STORAGE.md`에 덧붙였다.

## 위험과 검토 요청

- IDB 권한 기록 후 문제집 commit 전에 중단되면 권 연결 색인이 먼저 남는다. `forProblem`은
  문항 출처가 없으면 Blob을 내주지 않고, 재시도는 현재 라이브러리를 다시 읽는다. 이 경계와
  외부 JSON의 같은 sourceId가 Blob 권한을 만들지 않는지 검토해 달라.
- 실제 브라우저에서 Web Lock·IndexedDB·localStorage 저장 실패, Undo, 구형 탭 확인,
  업데이트 필요 권과 정상 권의 공존을 확인해 달라. Claude Opus 실측에서 최초 브라우저 검사는
  `page.evaluate` 안의 Node `assert` 때문에 0/8이었다. 브라우저 자체 비교 함수로 수정하고
  Undo·다른 문항/권 불변 검사와 고장 주입 7종을 추가했다. 수정본의 브라우저 실행 증거는
  Claude 검토자가 채울 예정이다.

## 검증

- Claude Opus 실측(수정 전): `test:public`·`check:static`·`check:sonar`·
  `check:review-hygiene`·`test:intake`·`test:sheet-source` 통과. `test:u15-storage`는
  Node `assert`의 브라우저 참조 오류로 0/8 실패했다.
- 수정 후 Codex 환경: Node 저장 검사 7/7, dedup 고장 주입에서 대응 항목 실패,
  `npm run test:public`, `npm run check:static`, `npm run check:sonar`,
  `npm run check:review-hygiene` 통과. `npm run test:u15-storage`의 Node 두 단계는
  통과했고 브라우저 단계는 이 샌드박스의 `listen EPERM 127.0.0.1` 때문에 시작 전 중단됐다.
  브라우저 기본 검사 10개와 `dedup/rollback/epoch/permission/editors/limits/undo`
  `--expect-red`는 Claude가 정상 환경에서 실행·기록한다.

## 다음 검토자에게

`pedagogy-intake.js`, `index.html`의 `createIntakeLibrary`/`createIntakeStorageClient`,
`scripts/check-u15-storage-node.mjs`, `scripts/check-u15-storage.mjs`를 보라.
브라우저 검사는 `npm run test:u15-storage`로 정상 실행과 고장 주입을 순서대로 수행한다.
실제 U1.5 ⓑ 화면 연결·원문 관리 UI는 다음 묶음이다.

## 검토 기록

- 2026-10-04 · Claude Opus 1차 · **반려 5건** — ① 브라우저 검사가 `page.evaluate` 안에서 Node `assert` 를 써 한 번도 돈 적 없음(실측 0/8)
  ② 'Undo' 를 이름에만 두고 ⌘Z 를 안 봄 ③ 깨보기가 dedup 하나뿐 ④ `assignPages` 가 출처 목록을 **통째로 교체**함을 명시 ⑤ `createJob`
  저장 합계 상한이 AI 한도 → D6 로 바뀐 B6 동작 변경을 표시. (a) 권한 경계·(b) 등록 트랜잭션·(c) 다시 연결 의미는 판정대로라 합의.
- 2026-10-04 · Claude Opus 2차 · **전부 닫힘** — 이 맥에서 실행: 브라우저 10/10 · Node 7/7 · 깨보기 7종(dedup·rollback·epoch·permission·
  editors·limits·undo) 전부 빨간불. Undo 는 `commit()` 앞뒤 `flushHistory()` 로 타이핑과 이 쓰기를 각각 한 단계로 둔다(`historyStep` 과 같은 원리).
  ④는 전체 교체로 문서화, ⑤는 B6 문서에 '변경' 표시. ⚠️ 깨보기 대응표의 검사 이름 한 곳(`editors`)이 실제 이름과 달라 주입은 빨간불을 냈는데도
  판정이 실패였다 — **검토자가 이름만 맞췄다.** ⓐ 브랜치를 합친 뒤 `check:fast` 전체 로컬 통과(종료 0 · HWPX 12건 실행 · MISS 0).
  ⓑ 화면은 `assignPages` 를 부를 때 기존 출처를 합쳐 넘겨야 한다(AI 출처를 잃지 않게).
