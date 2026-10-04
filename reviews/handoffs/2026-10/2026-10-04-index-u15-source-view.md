# 변경 인계 — U1.5 원본 대조 1단계: 지면 옆 원본 패널(출처 있는 문항 · 읽기 전용)

- ID: `HANDOFF-2026-182`
- 날짜: `2026-10-04`
- 작성자: `Claude / Opus 5.5` (클라우드 세션 · 레일 배정은 화면 Sonnet 5 — 해리가 이 세션에 진행을 지시)
- 상태: `ready-for-review` — 로컬 Codex Sol medium 검토 대기 · 미배포
- 영향 영역: `index | tests`
- 브랜치: `claude/u15-view` (기준 `main=a93e7e3` · U1 2차 운영 배포 직후)
- 관련: RAIL-ORDERS ⑩-A2 · U0 계약 §5-1·§5-2·§7 · [`docs/B6-INTAKE-STORAGE.md`](../../../docs/B6-INTAKE-STORAGE.md) · 사전 조사 `claude/u15-prep` 의 `docs/U15-PREP-NOTES.md`

## 변경 내용

U1.5 중 **B6 엔진을 바꾸지 않고 되는 화면 절반**이다. 지면 배치 막대에 `원본` 단추를 두고, 지면과 선택 문항 설정
사이에 원본 패널(`#sheetSrc`)을 연다. 이미 출처(`intake.sources`)가 있는 문항 — 즉 AI 로 만든 문제집 — 은
그 원문 쪽을 **이 기기에서** PDF.js(벤더)로 그려 data URL 로 띄운다.

- 문항 자신의 출처가 있으면 그 쪽으로 열고, 넘기다 벗어나면 '이 문항은 n쪽에 있어요' 라고 말한다.
- 문항에 출처가 없으면 같은 문제집의 다른 문항 출처를 **자유 탐색**으로 띄운다.
- 원문이 없으면 '이 브라우저에 연결된 원본이 없습니다 · 원본은 기기 간 동기화되지 않습니다' + `다시 연결`.
  다시 연결은 B6 `reconnect`(같은 파일만 · 해시·크기·형식)를 그대로 쓴다 — 다른 파일이면 거절하고 옛 쪽 대응을 옮기지 않는다.
- 계정 전환(`onAuth` 의 `authEpoch++` 구간)에서 패널을 닫고, 늦게 도착한 읽기·그리기는 세대·소유자·epoch 가 같을 때만 올린다.
- 출처가 하나도 없는 문제집에서는 원문 저장소(IndexedDB)를 **열지 않는다**.
- 기존 `intakeLinkClient` 생성 코드를 `intakeReadClient()` 로 뺐다(같은 읽기·연결 전용 클라이언트를 원본 패널도 쓴다).

**하지 않은 것(레일상 저장 변경 → Codex Sol high 묶음이 먼저)**: 손으로 만든 문제집에 새 원문 등록 · '이 문항 = n쪽' 저장 ·
`forProblem` 다중 출처 반환 · 설정의 원문 관리 목록. 화면은 이 경우 '다음 단계에서 열려요' / '새 원문 등록은 아직 준비 중' 이라고 말한다.

## 위험과 검토 요청

1. **권한 경계** — 원문은 언제나 `forProblem(setId, {intake:{sources:[ref]}})` 로 읽는다. 자유 탐색·여러 원문도 출처 하나씩
   그 문제집의 연결(`links[setId]`)을 확인한다. `readSource` 를 직접 부르면 가져온 JSON 에 적힌 sourceId 만으로 이 기기 원문이
   열린다(U0 §5-1 · B6 '외부 JSON 출처는 Blob 접근 권한을 만들지 않음'). 합성 문항을 넘기는 이 방식이 계약 위반이 아닌지.
2. **늦은 결과** — `liveCheck()`(gen·S.on·owner·epoch). 계정 전환 외에 문제집 삭제·원문 삭제(`deleteSource` 의 세대 증가)
   도중 열린 패널이 옛 Blob 을 계속 보여 주는 경로가 있는지. 지금은 다음 선택 변경 때 다시 읽는다.
3. **IDB 를 여는 시점** — 출처 있는 문제집에서 패널을 켤 때만 `intakeReadClient()` 가 만들어진다(⑦). 다른 경로로 새는지.
4. **화면** — 넓은 화면은 지면 | 원본(360px) | 문항 설정(260px). 좁은 화면은 문항 설정 → 원본 → 지면 순(order −2/−1).
   `다시 연결` 은 label 이 아니라 진짜 단추다(숨긴 파일 입력을 label 로 감싸면 키보드 초점이 닿지 않는다 — 구현 중 고침).
5. Sonar S6819 를 피하려고 상태 표시는 `role="status"` 대신 `<output>` 이다.

## 검증

- `npm run test:source-panel`(신설, `check:fast` 에 연결): **10/10 통과 · 깨보기 7/7 빨간불**.
  ① 실제 2쪽 PDF(Node 에서 xref 까지 맞춰 생성)를 **B6 실제 API**(`createIntakeFixture` → `createJob` → `run` → `adopt`)로 심고
  문항마다 그 쪽이 그려지는지(세로 1쪽 / 가로 2쪽으로 갈라 확인) ② 쪽 넘기기 ③ 자유 탐색 ④ 연결 없는 사본은 같은 sourceId 라도
  안 열림 + 키보드로 다시 연결 ⑤ 다른 파일 거절 ⑥ 읽기 결과를 문에 붙잡고 **소유자·epoch 를 함께** 바꾼 뒤 놓아도 안 올라옴
  ⑦ 출처 없는 문제집은 IDB 미생성 ⑧ onAuth 가 패널을 닫음(소스 대조 보조망) ⑨ 375px 에서 패널이 화면 안.
  깨보기: forProblem→readSource · liveCheck→true · 자유 탐색 제거 · onAuth 닫기 제거 · 다시 연결 onclick 제거 · 좁은 화면 600px 고정 · 선택 갱신 제거.
- 검사를 만들며 **검사 쪽 결함 셋**을 고쳤다: epoch 만 올리면 같은 소유자의 정당한 재열기와 구별 안 됨(⑥) · `showEditor()` 가 보기를
  '편집' 으로 되돌려 패널이 화면에 없었음(④) · 지면 칸이 `overflow:hidden` 이라 문서 가로 스크롤로는 넘침이 안 보임(⑨ — 깨보기가 잡음).
- `check:static`·`check-source-csp`(12/12)·`check:review-hygiene`·`git diff --check`·`test:review-contracts`·`test:library-ui`·`test:intake` 통과.
- **아직 못 한 것**: 클라우드는 `cdn.jsdelivr.net` 이 막혀 `test:sheet` ⑨-a(글꼴)는 여기서 판정 불가 → CI 몫. 실제 iPad/Safari 의
  원문 표시·PDF.js 메모리, 스캔 PDF 표본, 로그인 계정 전환 실측은 로컬/R8.

## 다음 검토자에게

범위는 `main..claude/u15-view` 의 `index.html`(원본 패널 HTML·CSS·`sheetSource` 모듈·`intakeReadClient`·`syncSheetSelection`·`onAuth` 한 줄)
`scripts/check-source-panel.mjs`·`package.json`. 위 '위험과 검토 요청' 1·2 를 특히 봐 주세요. 저장 변경(새 원문 등록·쪽 매핑 저장)은
이 PR 범위가 아니며 레일상 Codex Sol high 별도 묶음이다.

## 검토 기록
