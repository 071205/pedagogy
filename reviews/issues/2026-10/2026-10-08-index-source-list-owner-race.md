# 설정 원문 목록의 늦은 응답이 다음 owner 화면에 표시된다

- ID: `REV-2026-118`
- 날짜: `2026-10-08`
- 보고자: `Codex / GPT-6 Sol medium 독립 검토 · 부모 브라우저 재현`
- 상태: `in-progress`
- 심각도: `P1`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-184`
- 검토 기준: `origin/codex/u15-storage f29af93..claude/u15-manual-link 114ba27`

## 요약과 영향

설정의 원문 관리가 이전 owner의 목록을 읽은 뒤 브라우저 보관 상태를 기다리는 동안 계정이
바뀌면, 늦게 끝난 목록이 다음 계정의 설정 화면에 파일명·크기·쪽수·삭제 단추를 표시한다.
원문 내용/Blob의 계정 간 읽기나 타인 원문 삭제까지 재현한 것은 아니다. **메타데이터의 owner
격리 위반**이므로 이 상태로 U1.5 ⓑ를 승인하지 않는다.

## 재현 절차

격리 localhost·합성 자료·Firebase SDK 외부 요청 차단 환경에서 기존
`scripts/check-sheet-source.mjs`의 `open()`/`seedSources()` 하네스를 재사용했다.

1. 이전 owner에 `원본.png`와 `원본.pdf`를 등록/채택한다. 이번 probe의 이전 owner는 `guest`다.
2. `navigator.storage.persisted()`를 외부에서 해제할 수 있는 Promise로 일시 대체하고
   `renderDataSources()`를 시작한다. 해당 Promise 진입은 이전 owner의 `listSources()`가 끝났다는 증거다.
3. 원래 `persisted()`를 복원하고 실제 `await onAuth({uid:'u15-review-B',email:'b@example.invalid',displayName:'검토 B'})`
   전환 경로를 호출한다. 실제 Google 로그인 대신 합성 UID를 사용하는 기존 브라우저 fixture다.
4. `showSettings('data'); await renderDataSources()`로 B 설정을 열고 원문 목록이 빈 것을 확인한다.
5. 2의 Promise를 `false`로 해제하고 이전 render 완료를 기다린다. B 설정에 이전 원문 2개가 나타난다.

probe: `/tmp/u15-184-owner-race.mjs`, 실행 결과: `/tmp/u15-184-owner-race.log`.
재현의 핵심은 아래 순서이며 UI/저장 코드는 변경하지 않았다:

```js
const nativePersisted = navigator.storage.persisted.bind(navigator.storage);
let release;
navigator.storage.persisted = () => new Promise(resolve => { release = resolve; });
const oldRender = renderDataSources();
while (!release) await new Promise(resolve => setTimeout(resolve, 10));
navigator.storage.persisted = nativePersisted;
await onAuth({uid:'u15-review-B',email:'b@example.invalid',displayName:'검토 B'});
showSettings('data');
await renderDataSources();
const before = document.querySelector('#dmSourcesList').textContent;
release(false);
await oldRender;
const after = document.querySelector('#dmSourcesList').textContent;
```

## 기대 결과 / 실제 결과

- 기대: owner/epoch 변경 후 이전 목록/오류/삭제 단추는 표시되지 않고 B 목록만 유지한다.
- 실제: `owner='u15-review-B'`, `settingsOpen=true`, `before=''`.
  `after='원본.png · 2KB · 1쪽 · 보관 중원문 삭제원본.pdf · 1KB · 2쪽 · 보관 중원문 삭제'`.
  `info='원본 2개 · 3KB / 1GB · 브라우저가 공간이 부족하면 지울 수 있음'`.

## 근거

- `index.html:9994-10014 renderDataSources()`는 `sheetSourceReader()`·`listSources()`·
  `persisted()` await 뒤 owner/epoch/목록 세대를 확인하지 않고 DOM을 쓴다.
- `onAuth()`는 client.stop/원본 뷰어 정리를 수행하지만 이미 읽힌 목록의 지연 표시를 막지 않는다.
- `prepDataPane()`의 오류 처리도 같은 세션 검사 없이 메시지를 표시한다.
- 기존 ⑩-e는 원본 뷰어 닫힘, ⑪-e는 단일 owner의 삭제만 검사한다. 기존 15개 정상 시나리오가
  통과해도 이 설정 목록 경합은 놓친다.

## 제안

설정 목록의 session/세대 검사를 await와 DOM 변경/오류 표시 경계에 적용하고, owner 변경 시
이전 목록/보관 상태/단추를 지운다. 구/신 목록의 역순 완료도 검증한다. 저장 API 자체의 권한
검사는 유지한다. 회귀에는 현재 구현의 실패와 방어 제거 red mode를 확인한다.

## 처리 기록

- `2026-10-08` — Codex: 부모가 실제 Chromium fixture에서 재현. 요청한 GPT-6 Sol medium
  검토자가 probe/로그를 코드 경로와 독립 대조해 보완 필요 판정. 기능 수정 없음.
- `2026-10-08` — Claude(구현자, 클라우드 세션): **원인** — `renderDataSources()` 가 `sheetSourceReader()`·`listSources()`·
  `persisted()` 세 await 뒤 세션·세대를 다시 보지 않고 DOM 을 썼고, `prepDataPane()` 의 오류 표시도 같았다. `onAuth` 는
  원본 패널만 닫고 설정의 원문 목록은 그대로 두었다.
  **수정**(`index.html`) — ① `renderDataSources()` 가 시작할 때 세대(`dsGen`)·owner·epoch 를 잡고, 목록 읽기 오류 표시와
  DOM 쓰기 직전에 셋이 그대로일 때만 쓴다(`live()`). 오류 처리도 이 안으로 옮겨 `prepDataPane()` 의 `catch` 를 걷었다.
  ② `resetDataSources()` — `onAuth` 의 계정 전환 구간(`closeSheetSource()` 옆)에서 세대를 올리고 목록을 비운다.
  저장 API 의 권한 검사는 건드리지 않았다. `check-audit-safety` 의 `onAuth` 샌드박스에 대역 하나를 더했다.
  **검증** — `check-sheet-source.mjs` 에 **⑪-f** 를 더했다: 다 그린 뒤 전환하면 즉시 비움 · `persisted()` 를 붙잡은 채
  전환 후 놓기 · Codex 재현 그대로(전환 → 새 계정 목록 → 놓기) · 같은 계정에서 먼저 시작한 목록이 나중 목록을 덮지 않음(역순 완료).
  깨보기 2종(`live()` 검사 제거 · `onAuth` 의 비우기 제거) 모두 ⑪-f 빨간불. 전체 결과는 HANDOFF-2026-184 검토 기록 아래 '보완' 줄.
