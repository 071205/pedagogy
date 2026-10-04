# 변경 인계 — U1.5 ⓐ 원본 대조: 연결된 원문 보기 패널

- ID: `HANDOFF-2026-182`
- 날짜: `2026-10-04`
- 작성자: `Claude / Opus 5.5` (레일 배정은 Sonnet 5 — 해리가 이 세션에 '레일대로 계속' 지시)
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `없음`
- 브랜치: `claude/u15-source-viewer` (기준 `claude/repo-tidy` = PR #12 · main `a93e7e3` 포함)
- 관련: RAIL-ORDERS ⑩-A2 '나눔' 1번 · DEV-TOKEN-ROADMAP 'U1.5 저장 묶음'·D6

## 착수 전 판정 (Codex Astra high · 2026-10-04)

B6 API 만으로는 U1.5 수동 연결이 안 된다 — 원문 등록 길이 `createJob()`(AI 작업·D3 한도) 하나뿐이고, `linkSource()` 는 운영에 없는
라이브러리 바인딩을 요구하며 `pages` 를 저장하지 않는다(`pedagogy-intake.js:331`). Claude 가 근거 줄을 확인했다. 그래서 U1.5 를
**ⓐ 원문 보기 화면(Claude) → 저장 묶음(Codex Sol high → Claude 검토) → ⓑ 수동 연결·원문 관리 화면(Claude)** 으로 나눴다.
수동 보관 한도는 해리 결정 **D6: 파일 100MB · 합계 1GB**(AI 한도 D3 와 분리). **이 인계는 ⓐ 뿐이고 U1.5 완료가 아니다.**

## 변경 내용

지면 배치 막대에 `원본` 단추(`#sheetSrcBtn`, `aria-pressed`)와 패널(`#sheetSrc`)을 더했다. 넓은 화면은 지면 · 원본 · 선택한 문항 순으로
나란히, 좁은 화면은 선택한 문항 → 원본 → 지면 순으로 쌓는다.

- **권한 경계**: 원문은 B6 의 `forProblem(setId, problem)` 으로만 연다(권 연결이 active 이고 문항 `intake.sources` 에 그 원문이 있어야 한다).
  출처 ID 만 보고 `readSource()` 로 열지 않는다 — 가져온 `.json` 이 같은 ID 를 들고 와도 이 기기의 원문을 못 연다.
- **저장소를 만들지 않는다**: `PedagogyIntake.create()` 는 여는 순간 DB 를 만든다. `indexedDB.databases()` 에 `PM_INTAKE_V1` 이 없거나
  **`databases()` 자체가 없는 브라우저면** 클라이언트를 만들지 않고 '연결된 원본 없음' 으로 답한다(구형 브라우저는 원본을 못 본다 — 대가로 받아들임).
- **단추는 출처가 있는 문제집에서만** 보인다(`setHasSourceRefs`). 운영은 일괄 AI 가 꺼져 있어 지금 사용자에게는 **아무것도 바뀌지 않는다.**
  문제집을 바꾼 순간 맞추려고 `scheduleSheet()` 첫머리에서도 단추를 맞춘다(조립을 기다리면 그 사이 옛 문제집의 단추가 남았다 — 검사가 잡았다).
- **늦은 결과**: 세대 `srcGen` + `sessionMatches` 로 버린다. 열다 만 PDF 는 닫는다. 원문은 **문항마다 새로 연다**(캐시 없음 — 아래 검토 1차).
- **닫기**: `onAuth` 계정 바뀜 · `showLibrary()` · 삭제 시작(`wiping=true` 두 곳)에서 `closeSheetSource()` — 세대 증가 · PDF 파기 ·
  object URL 해제 · 패널 닫기(U0 §5-2). 다른 탭의 원문 삭제는 IDB 에 탭 간 알림이 없어 **이 탭으로 돌아올 때**(`visibilitychange`) 다시 확인한다.
  상태 변수는 `showLibrary()` 가 부르므로 지면 상태 옆(스크립트 앞)에 둔다 — 뒤에 두면 부팅 중 TDZ.
- **보기**: PDF 는 vendoring 된 pdf.js 6.3.289 를 B6 와 같은 옵션(`isEvalSupported:false` · 로컬 cmap/글꼴/wasm)으로 열어 canvas 에 그린다.
  이미지는 `blob:` URL. 문항에 지정된 쪽으로 열고(`이 문항: n쪽`) ‹ › 로 자유 탐색. 쪽 지정이 없으면 1쪽과 안내.
- **문구**: 없음 `이 브라우저에 연결된 원본이 없습니다 · 원본은 기기 간 동기화되지 않습니다`(U0 계약 문구) · 삭제됨 · 삭제 중 · 열기 실패를 구분.
  '다시 연결' 동작은 ⓑ 몫이라 아직 단추가 없다.
- CSP 셋째 인라인 해시 재계산.

## 하지 않은 것

수동 연결·'이 문항 = n쪽' 지정·다시 연결·원문만 삭제·설정의 원문 목록/용량(ⓑ). 저장 API 변경(저장 묶음). 여러 원문 동시 보기
(`forProblem()` 이 첫 원문 하나만 준다 — 바꾸면 저장 묶음 범위). 지면 위 직접 타이핑은 지시대로 넣지 않았다.

## 검증

- 새 `npm run test:sheet-source`(`scripts/check-sheet-source.mjs`, `check:fast` 에 연결) — 실제 크로미움, 원문은 B6 fixture 로 실제 IDB 에 채택.
  **10개**: ⑩-a 출처 없는 권은 단추·패널 없음 · ⑩-b 이미지 원문(`blob:`·300px) · ⑩-c 2쪽 PDF 가 지정 쪽(빨강 픽셀)으로 열리고 ‹ 로 1쪽 ·
  ⑩-d 권한 없는 사본은 원문 안 열림 · ⑩-h 라이브러리 이동·삭제 시작에 뷰어 비움 · ⑩-e `onAuth` 계정 전환(첫 await 전 판정) ·
  ⑩-i 다른 탭 삭제를 돌아올 때 반영 · ⑩-f 저장소 없으면 안 만듦 · ⑩-j `databases()` 없는 브라우저에서도 안 만듦 · ⑩-g 닫은 뒤 늦은 원문 버림.
  **깨보기 11종 전부 빨간불.** ⚠️ 비로그인 '모든 문제집 삭제' 는 대기 없이 한 번에 끝나 '삭제 구간' 이 없다 — 첫 await 전에 재면 끝난 뒤를
  재서 깨보기가 헛돌았다. `wiping` 이 켜진 직후(다음 줄 `clearTimeout`)를 가로채 잰다.
- `test:sheet` 17개·깨보기 14종 · `test:public`(CSP) · `check:static` · `check:sonar` 통과. `test:library-ui`·`test:cross:fast` 는 아래 검증 기록.
- 눈으로: 1440 넓은 화면(지면·원본·설정 나란히) · 375 좁은 화면(쌓임 · 가로 넘침 0px).
- 못 한 것: 실제 Safari/iPad 의 원문 회수 뒤 동작(R8) · 큰 스캔 PDF 의 렌더 시간.

## 검토 요청 (Codex GPT-6 Sol medium)

범위: 이 브랜치의 `index.html` 원본 패널 블록(`/* ══ 원본 대조 (U1.5 ⓐ)`)·CSS·마크업·`onAuth` 한 줄·`scheduleSheet` 한 줄과
`scripts/check-sheet-source.mjs`. 특히 권한 경계(⑩-d)·DB 생성 금지(⑩-f)·늦은 결과(⑩-g)·계정 전환(⑩-e)이 실제로 닫혔는지.

## 검토 기록

- 2026-10-04 · Codex GPT-5.6 Sol medium 1차 · **merge 반대 — 결함 3** · Claude 가 근거 줄을 확인하고 셋 다 재현·반영:
  (b) `databases()` 없는 브라우저에서 빈 저장소 생성 → 그 경우 읽지 않음, ⑩-j · (c) 앞뒤 64KB 키로 다른 원문을 같은 것으로 볼 수 있음 →
  캐시 제거(문항마다 새로 연다) · (d) '모든 문제집 삭제'·삭제 구간·다른 탭 원문 삭제 뒤 뷰어 잔존 → `showLibrary`·`wiping` 시작에서 닫고
  탭 복귀 때 재확인, ⑩-h·⑩-i. (a) 권한 경계(가져오기는 새 id)와 (e) ⑩-e 의 대표성은 합의. 반영 중 ⑩-e 가 `showLibrary` 경로 때문에
  헛도는 것을 발견해 첫 await 전 판정으로 좁혔다.
