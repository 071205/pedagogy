# 선지 그림이 base64 → Storage 이관에서 빠져 Firestore 문서가 한도를 넘는다

- ID: `REV-2026-020`
- 날짜: `2026-09-06`
- 보고자: `Claude` (자체 점검)
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`, `storage`, `tests`
- 관련: `HANDOFF-2026-045` · `REV-2026-019`(같은 부류)

## 요약과 영향

`REV-2026-019` 를 고친 뒤 **같은 부류가 더 없는지 직접 훑다가** 찾았다.
그림 주소를 다루는 곳이 하나 더 있었고, 거기도 선지 그림을 몰랐다.

`migrateBase64ToStorage()` 와 그것을 부를지 정하는 `saveSets()` 의 판정식이 모두
`b.data.dataUrl` 하나만 본다. 그래서 **선지 그림은 base64 인 채로 Firestore 문서에 남는다.**

`REV-2026-019`(고아 파일·오삭제)보다 나쁘다. base64 는 문서 본문에 그대로 들어가므로
그림이 몇 장 쌓이면 **Firestore 1MB 문서 한도를 넘겨 저장이 통째로 실패한다.**
Storage 를 쓰는 이유가 바로 그것이라고 CLAUDE.md 에 적혀 있다.

교과서 그림 선지는 **문항마다 다섯 장**이라 특히 잘 걸린다 — 캡처 한 장이 40~80KB 면
문항 두어 개로 한도에 닿는다.

## 재현 절차

`index.html` 을 연 실제 브라우저에서, `saveSets()` 가 쓰는 판정식을 그대로 돌렸다.

```js
const b64 = "data:image/png;base64,…";
const needsMigrate = s => (s.problems||[]).some(q =>
  isDataUrl(q.answerImg)||(q.blocks||[]).some(b=>b&&b.data&&isDataUrl(b.data.dataUrl)));

needsMigrate({problems:[{blocks:[{type:"choices",
  data:{items:["","","","",""], images:[b64,"","","",""]}}]}]});   // false  ← 이관이 안 돈다
needsMigrate({problems:[{blocks:[{type:"image", data:{dataUrl:b64}}]}]});  // true
```

## 기대 결과 / 실제 결과

- 기대: 그림이 어디 담겨 있든 base64 면 Storage 로 옮긴다.
- 실제: `image.data.dataUrl` 과 정답 그림만 옮기고 `choices.data.images` 는 남긴다.
  판정식이 좁아서 **이관 함수 자체가 호출되지 않는다.**

## 처리 기록

- `2026-09-06` — `Claude`: 원인·수정·검증.

### 원인 — `REV-2026-019` 과 같다. 고치는 방식이 얕았다.

`REV-2026-019` 때 `storagePathsOf()` 를 `blockImageUrls()` 로 연결해 **그 두 곳만** 맞췄다.
'그림이 어디 있는지 아는 곳' 이 셋이었는데(수집·이관·판정) 둘만 본 것이다.
한 곳을 고치는 게 아니라 **한 곳만 알도록 구조를 바꿨어야 했다.**

### 변경 파일

- `index.html`
  - **`blockImageSlots(blk)` 신설** — 블록이 그림 주소를 담아 두는 *자리*를 `get`/`set` 으로
    돌려준다. 읽기만 하는 곳과 **고쳐 써야 하는 이관**이 같은 목록을 쓸 수 있다.
  - `blockImageUrls()`(Storage 주소 수집) · `blockDataUrls()`(base64 감지) ·
    `migrateBase64ToStorage()`(이관) · `saveSets()`(판정) 이 **모두 그것을 거친다.**
  - 곁가지: `putChoiceImage()` 가 올리는 도중 블록 종류가 바뀌면 쓰지 않고 되돌린다
    (`blk.data` 가 갈린 뒤라 엉뚱한 블록에 `images` 가 생겼다).
- `regression-test.html`
  - 새 검사 「base64 그림은 종류를 가리지 않고 Storage 로 이관된다」 —
    자리가 **되쓰기 가능**한지까지 본다(get 만 있으면 옮겨도 반영이 안 된다).
  - 기존 검사에 **구조 조건**을 더했다 — 수집·이관·판정이 전부 `blockImageSlots()` 를
    거치는지 본다. 하나라도 `b.data.dataUrl` 을 다시 직접 읽으면 빨간불이다.

### 검증

- 세 가지로 되돌려 실제로 빨간불을 확인했다 —
  이관이 `dataUrl` 만 봄 / 자리가 읽기 전용 / 판정만 예전 식.
- 브라우저 회귀 **116/116** · `npm run check:fast` 통과 · 시각 회귀 **7건** 통과.

### 남기는 말

**이 결함은 `main` 에 올라갔다가 고쳐졌다**(`dccdb14` → 이번 커밋). 사이에 로그인 상태로
선지 그림을 넣은 문제집이 있다면 base64 로 남아 있을 수 있는데, 이제 다음 저장 때
자동으로 Storage 로 옮겨진다(판정식이 그것을 보게 됐으므로).
