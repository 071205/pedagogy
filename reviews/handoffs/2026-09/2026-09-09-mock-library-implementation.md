# 변경 인계 — 모의고사 라이브러리 (다중 모의고사) 구현

- ID: `HANDOFF-2026-090`
- 날짜: `2026-09-09`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index | mock-exam-editor | serve.py | scripts | tests | docs`
- 관련 이슈: `없음` (새 기능 · `HANDOFF-2026-089` 의 설계를 구현)

## 무엇을 했나

`HANDOFF-2026-089`(Codex)가 확정한 [`docs/MOCK-LIBRARY-DESIGN.md`](../../../docs/MOCK-LIBRARY-DESIGN.md)
의 다섯 단계를 구현했다. 그 인계는 "화면만 먼저 바꾸면 데이터 안전을 보장할 수 없다" 며
저장 모델까지 같은 배포에서 끝내라고 했고, 그 순서를 그대로 지켰다 — **저장 계층과 실패 주입
검사를 먼저** 만들고 화면을 붙였다.

- **`mock-library-store.js`**(신규) — 정규화·CRUD·복제·정렬·저장 어댑터·구형 임시본 이전.
  고전 스크립트(ESM 아님)라 `file://` 에서도 돈다. `serve.py` 의 `STATIC` 에 넣었다.
- **`index.html`** — 라이브러리 제목 자리에 `문제집 라이브러리 | 모의고사 라이브러리`
  세그먼트(`role="tablist"` · 좌우 화살표 · `#library=mocks` 해시). 모의고사 카드 화면
  (검색·정렬·복제·이름 변경·내보내기·삭제·가져오기). **상단 바의 전역 `모의고사` 버튼 제거**,
  대신 편집기 화면에서만 보이는 `← 라이브러리`.
- **`mock-exam-editor.html`** — 본체가 `postMessage` 로 준 `mockId` 를 편집한다. 자동 저장
  상태를 눈과 화면낭독기에 알린다. **단독 실행 경로는 손대지 않았다.**

## ⚠️ 검사가 제품 결함 넷을 잡았다 (지우지 말 것)

1. **`crypto` 가 없으면 모든 id 가 `mock_00000000` 이었다.** 영바이트 배열을 그대로 썼다.
   같은 id 가 둘이면 카드 하나를 열었는데 다른 것이 저장된다. 저장 계층 검사가 잡았다.
2. **`button{display:inline-flex}` 가 `[hidden]{display:none}` 을 이긴다.** `#mockBackBtn` 과
   두 갈래 액션이 `hidden` 인데도 **보이고 눌렸다**. 화면을 보고서야 찾았다(마크업은 정상).
   `.select-bar[hidden]` 에 이미 같은 주석이 있었다 — 이번엔 `button[hidden]` 으로 한 번에 막았다.
3. **카드를 바꿔 열면 앞 카드의 대기 중 저장이 사라졌다.** 1초 디바운스를 그냥 지우고 있었다.
   지금은 바꾸기 **전에** 흘려보낸다.
4. **정적 검사 하나가 헛돌았다.** `postMessage` 를 `'*'` 로 보내는지 보는 정규식이
   `[^)]*` 라 `Object.assign(...)` 의 `)` 를 못 넘어 **고장을 심었는데 통과**했다. 줄 단위로 고쳤고
   양쪽(고장 → 빨간불, 원복 → 초록불)을 확인했다.

## 안전 계약 — 되돌리지 말 것

- **쓰는 곳은 본체 하나다.** iframe 이 직접 `localStorage` 를 쓰면 같은 항목을 서로 덮어쓴다.
  게다가 `file://` 에서는 iframe 이 다른 출처라 직접 접근이 아예 안 된다.
- **`targetOrigin` 은 같은 출처다.** 이 문서는 누구나 iframe 으로 끼울 수 있어 `'*'` 면
  남의 페이지가 사용자의 시험지 내용을 받는다. `check:static` 이 두 파일을 지킨다.
- **문항 속 정규화를 옮겨 적지 않았다.** 화이트리스트는 편집기 `sanitize(blank(n),p)` 한 곳뿐이고,
  그래서 라이브러리는 문항을 그리지 않고 개수만 센다.
- **구형 임시본 원본을 지우지 않는다.** 새 저장을 **다시 읽어** 같은지 확인한 뒤에만 마커를
  남기고, 원본 키는 한 릴리스 보존한다. 취소·실패 때는 `.json` 으로 받을 길을 화면에 남긴다.
- **계정별 키다**(`PM_MOCK_SETS_V1:<owner>` 등). 계정이 바뀌면 목록을 갈아 끼운다.

## 검증

- `npm run test:mock-library` — 저장 계층 16건 통과. `MOCK_STORE_RED=1` 자기검사: 저장 실패를
  성공으로 바꾸면 해당 항목이 빨간불.
- `npm run test:mock-library-ui` — 실제 크로미움 9건 통과(세그먼트·키보드·해시·새로고침 복구·
  복제 독립·계정 격리·저장 실패 경고·구형 이전 무손실·JSON 왕복·1194/768/375 넘침).
  `MOCK_UI_RED=1` 자기검사: 제품에 고장 **4개**를 심어 **4건**이 빨간불인 것을 확인.
- `npm run check:fast` — 통과(정적·접근성 30계약·교차 환경·리뷰 계약·라이브러리 UI 13건 포함).
- `tests/regression-test.html` — 실패 0. 옛 `#mockModeBtn` 을 보던 두 항목을 새 자리로 옮겼다.
- `npm run test:cross:fast` — 통과. 모의고사 진입 경로를 **실제 카드 만들기**로 바꿔 검사한다.
- `scripts/check-review-contracts.mjs` — `file://` 에서 저장 계층이 뜨고 모의고사 탭이 그려진다.
- 아직 못 한 것: **실제 사파리·아이패드 기기 검사.** 크로미움 에뮬레이션으로 대체했고
  실기기 완료로 과장하지 않는다.

## 다음 검토자에게

먼저 [`docs/MOCK-LIBRARY-DESIGN.md`](../../../docs/MOCK-LIBRARY-DESIGN.md) 끝의 **'구현 결과'**
절을 볼 것 — 설계와 **다르게 한 것 넷**(이름·`round` 통합 · 단독 편집기의 구형 임시본 유지 ·
`sessionStorage` 마지막 카드 · 닫는 순간 동기 읽기)과 **안 한 것 셋**(클라우드 동기화 ·
삭제 Undo · 폴더)을 거기 적었다.

집중해서 봐 달라는 곳:
1. `mock-exam-editor.html` 의 `hostLoad`/`hostSave` — 카드 전환 순간의 경합.
2. `index.html` 의 `handleMockSave` — '이미 있는 카드' 로만 쓰는 판정(삭제된 카드 부활 방지).
3. `flushOpenMock()` — 닫는 순간 `contentWindow` 를 동기로 읽는 것이 옳은 경계인지.
4. 저장 공간이 가득 찼을 때의 경로 — 실패를 삼키지 않는지.

---

## 이어서 — 클라우드 동기화 (같은 세션)

로컬 전용은 SaaS 에서 기능 미완성이 아니라 결함이라 판단해 바로 이어 했다.
**문제집과 같은 계약을 재사용했다**(새 모델 없음): `users/{uid}/mocks/{mockId}` 한 부 =
한 문서 · tombstone 삭제 · `updatedAt` 병합 · `onSnapshot` 반영.

- `firestore.rules` 에 `mocks` 화이트리스트(문서 id 일치 · 문항 60 상한 · tombstone 조건).
- **그림은 문서에 담지 않는다** — 편집기가 본체를 거쳐 Storage(`users/{uid}/images`)로
  올리고 주소만 남긴다. 계정 삭제의 `wipeStorageImages()` 가 그 폴더를 훑으므로 파기가 맞는다.
- **계정 삭제가 모의고사 컬렉션과 로컬 키까지 지운다.** 개인정보 파기는 나중에 붙이는
  기능이 아니라, 지금 넣으면 컬렉션 한 줄이다.
- **`service-config.js` 의 `mockCloudSchema` 는 0 으로 내보낸다**(로컬 전용).

### ⚠️ 배포 순서 — 사람이 해야 한다

```
firebase deploy --only firestore:rules --project pedagogy-huryul
```
그 **뒤에** `mockCloudSchema` 를 1 로 올린다. 순서를 뒤집으면 로그인 사용자의 모의고사
저장이 전부 '권한 오류' 로 실패한다(이 저장소가 겪은 사고와 같은 모양).
플래그가 0 인 동안은 코드가 있어도 아무것도 올리지 않는다 — 검사가 그것까지 본다.

### ⚠️ 아직 안 한 것 — Storage 버킷 CORS

한글 내보내기는 그림 **바이트**가 필요해서, 주소만 있는 그림을 편집기가 내보내기 직전에
`fetch` 한다. 그 fetch 는 버킷 CORS 설정이 있어야 한다. 없으면 그림이 빠지고 **그렇게
말한다**(자리표시로 조용히 내보내지 않는다). 한 번만 하면 되는 설정이다.

### 검사가 또 제품 결함을 잡았다

- **문서 크기를 글자 수로 재고 있었다.** `JSON.stringify(...).length` 는 UTF-16 코드
  단위라 한글이 실제의 1/3 로 세어진다 — **1.4MB 짜리 문서가 한도를 통과**했고 Firestore
  에서만 터졌을 것이다. `docBytes()` 가 UTF-8 로 잰다.
- **깨보기가 통과했다(검사 결함).** 원격 덮어쓰기 가드 **둘**을 한 상황으로 재고 있어서
  하나를 깨도 다른 하나가 막았다. 두 카드로 갈라 잰다. 그리고 자기검사를 **개수**가 아니라
  **빨간불이어야 하는 항목 이름**으로 바꿨다 — 개수로 세면 그 사실이 숨는다.

### 검증

- `npm run test:mock-library-ui` — 17건 통과(클라우드 8건 포함). 가짜 Firestore 를 페이지
  안에 심어 **실제** `flushMocksToCloud`·`watchMocks`·`deleteMockEverywhere` 를 돌린다.
  실제 계정·원격 쓰기는 쓰지 않는다. `MOCK_UI_RED=1` 로 고장 9개를 심어 계약 8개가 빨간불.
- `npm run check:static` — 모의고사 문서 필드 ↔ Rules `hasOnly` ↔ tombstone 세 곳 대조.
  Rules 에서 `updatedAt` 을 빼 보고 빨간불을 확인했다.
- `scripts/verify-rules-emulator.mjs` 에 mocks 규칙 11건 추가(에뮬레이터 필요 · `check:rules`).
- 나머지 스위트는 CI 에 맡겼다.
