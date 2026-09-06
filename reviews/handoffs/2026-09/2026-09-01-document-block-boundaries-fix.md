# 변경 인계 — 새 블록을 네 경계에 함께 반영 (Codex 검토 반영)

- ID: `HANDOFF-2026-025`
- 날짜: `2026-09-01`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index`, `worker`, `server`, `tests`
- 관련 이슈: `REV-2026-013`(해결), `REV-2026-014`(해결)
- 관련 인계: `HANDOFF-2026-024`(Codex 독립 검토)

## 배경 — Codex 지적이 맞았다

`HANDOFF-2026-019/021/022` 에서 표·그림·상자를 더할 때 **파이썬 계약과 조판기만 넓히고
나머지 경계를 그대로 뒀다.** 그래서 그 블록들이 실제 제품 흐름에 도달하지 못했다.
두 지적을 모두 재현했다.

## REV-2026-013 — 블록이 AI·브라우저에서 막힘 (P1)

계약은 11종을 받는데 Worker 검증과 브라우저 검증은 여섯 종만 받고 있었다. AI 가 표를
정확히 만들어도 Worker 가 502 로 버리고, 사용자가 JSON 으로 직접 넣어도 브라우저에서
막혀 내보내기 버튼까지 가지 못했다.

⚠️ `grep` 으로는 Worker 에 `examples`·`choices` 가 있는 것처럼 보인다. 그건 **모의고사
사진 변환 프롬프트의 주석**이고 문서 검증부와 무관하다. 함수 본문을 읽어야 보인다.

`worker/index.js`(프롬프트 + `validateDocumentResponse`)와 `document-editor.html`
(`validate` + `render`)을 계약에 맞춰 넓혔다.

⚠️ **네 곳을 똑같이 만들지는 않았다.** `image` 는 계약·브라우저에는 있고 AI 쪽에는 없다 —
AI 가 base64 그림을 만들 수는 없기 때문이다. 그 차이를 아래 검사가 명시적으로 안다.

### 재발 방지 — `scripts/check-document-blocks.mjs`

Codex 가 요구한 대로 **한 곳만 늘리는 것을 막는 장치**를 만들었다. 네 곳의 블록 목록을
원문에서 뽑아 비교한다:

```
① document_schema.py       계약
② DOCUMENT_SYSTEM_PROMPT   AI 에게 무엇을 만들라고 하는가
③ validateDocumentResponse AI 응답에서 무엇을 받는가
④ document-editor.html     브라우저 검증
```

파이썬도 브라우저도 띄우지 않아 **CI 에서 항상 돈다**(`check:static` 에 걸었다).
`AI_CANNOT_PRODUCE` 집합에 적힌 것(`image`)만 차이로 인정하고, 그 외 어긋남은 실패다.
Worker 가 계약에 없는 블록을 받아들이는 반대 방향도 잡는다.

## REV-2026-014 — 허용한 그림이 HTTP 상한에 걸림 (P2)

4MiB PNG 가 계약을 통과한 뒤 JSON 본문 5,592,511바이트가 되어 `MAX_BODY`(4MiB)에서 413.
계약이 약속한 최대 크기를 실제로 쓸 수 없었다.

`MAX_IMAGE_BYTES` 를 **2.5MiB** 로 낮췄다(base64 4/3 → 3.4MiB, 나머지 문서에 0.6MiB).
상수 주석에 **HTTP 본문 상한에서 역산한 값**임을 남겼다 — `MAX_BODY` 를 바꾸면 함께 봐야 한다.

재발 방지: `test_document_endpoint.py` 가 **계약이 허용하는 최대 그림을 실제로 POST** 해
200 과 `BinData/` 를 확인한다. 413 이면 서버가 본문을 다 읽기 전에 끊어 `Broken pipe` 로
오므로, 그 경우도 원인을 밝히는 메시지로 잡는다.

## Codex 의 세 번째 지적은 사실과 달랐다

> `REV-2026-012`는 이슈 파일의 상태가 `resolved`인데 INDEX의 열린 이슈 표에는 남아 있다.

확인해 보니 `INDEX.md` 의 **'최근 해결' 표**에 있다. 열린 이슈 표에는 `REV-2026-009`·
`REV-2026-010` 둘뿐이다. 정리할 것이 없었다.

`HANDOFF-2026-023` ID 는 겹쳐 있었다(내 `document-exam-blocks` 가 먼저 푸시됨).
Codex 의 검토 인계를 `024` 로 옮겼다.

## 위험과 검토 요청

- ~~브라우저 미리보기를 화면으로 확인하지 못했다~~ → **확인했다.** `serve.py` 로 띄워
  표(칸 6개)·상자 2개·선지·수식 5개가 그려지는 것을 봤다.

  ⚠️ 그때 **미리보기에 테두리가 없다는 것**을 발견했다. 내가 더한 `.doctable`·`.docbox`
  ·`.docchoices` 에 CSS 가 없어, 표도 상자도 그냥 글로만 보였다. **미리보기는 '무엇이
  들어 있나' 가 아니라 '어떤 모양이 되나' 를 보여야 하는데** 그 역할을 못 하고 있었다.
  스타일을 넣고 `getComputedStyle` 로 실제 적용을 확인했다(상자 `1px solid`, 표 칸
  `1px`, 선지 `flex`/`22px`). 안내 문구의 옛 블록 목록도 함께 고쳤다.
- Worker 는 저장소에만 반영돼 있고 **배포하지 않았다.** 배포 전에는 AI 초안 버튼이
  새 블록을 만들어도 예전 Worker 가 502 를 낸다.

## 검증

- `node scripts/check-document-blocks.mjs` — 네 경계 일치, 계약 11종 / AI 10종.
- **일부러 깨뜨려 확인**(둘 다 원복 후 재통과): Worker 검증에서 `table` 제거 →
  잡힘. 브라우저 검증에서 `box` 제거 → 잡힘.
- `python3 test_document_endpoint.py` — 최대 크기 그림 전송 성공. 상한을 4MiB 로
  되돌리면 실패하는 것을 확인한 뒤 원복.
- `node worker/worker-contract.test.mjs` 통과.
- `npm run check:fast` 전체 통과.

## 다음 검토자에게

`scripts/check-document-blocks.mjs` 의 추출 정규식이 원문 모양에 기대고 있다. Worker 나
브라우저의 검증 코드 **모양**이 바뀌면 이 검사가 블록을 못 찾을 수 있다 — 그때는
`contract.size >= 6` assertion 이 먼저 걸리게 해 뒀지만, Worker·브라우저 쪽에는 같은
안전장치가 없다. 한 번 봐 달라.
