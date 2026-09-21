# 변경 인계 — R4/B1: 문제집 클라우드 저장에 크기 선제 방어를 넣었다

- ID: `HANDOFF-2026-156`
- 날짜: `2026-09-21`
- 작성자: `Claude / Opus 5`
- 상태: `reviewed`
- 영향 영역: `index.html`, `tests`, `docs`
- 관련 이슈: `REV-2026-097`(선행 결함 · 해결), `REV-2026-098`(해결), `REV-2026-099`(해결)

## 한 일

R3 합의를 [`docs/STORAGE-CONTRACT.md`](../../../docs/STORAGE-CONTRACT.md) 로 고정하고,
그 **§1(크기 방어) = B1** 을 구현했다. **R4 의 첫 묶음이고 스키마·Rules 변경이 없다.**

**고친 결함**: 문제집 클라우드 저장에 크기 선제 방어가 없어, Firestore 배치가 **원자적**이라
한도를 넘는 문제집 하나가 섞이면 **같이 올라가던 멀쩡한 문제집까지 통째로 실패**했다.
모의고사 경로는 예전부터 `ready`/`tooBig` 으로 갈랐는데 문제집 경로에만 없었다.

| | 전 | 후 |
|---|---|---|
| 크기 판정 | 없음(실패 뒤 사후 토스트만) | `docBytes(doc) > CLOUD_DOC_MAX` 로 **batch 투입 전** |
| batch | `dirty` 전부 | **`ready` 만** |
| `cloudSynced` | `dirty` 전부 | **`ready` 만**(초과본을 '저장됨' 이라고 하지 않는다) |
| 안내 | "문제집 하나가 1MB를 넘었어요" | **어느 문제집인지 이름으로** + "이 기기에는 저장돼 있습니다" |

⚠️ **상수를 공용 이름으로 바꿨다** — `MOCK_DOC_MAX` → **`CLOUD_DOC_MAX`**. 두 경로가 같은 값을
쓴다는 것을 이름으로 드러내려는 것이다. **갈래 이름을 되살리지 말 것.**

⚠️ **무한 재시도 고리를 막았다.** 초과본은 영영 `isCloudSynced` 가 아니므로, 재시도 조건에서
빼지 않으면 `flushToCloud` 가 **끝없이 자기를 다시 부른다.** 모의고사도 `ready` 만 보고 재예약한다.

## 검증

- **새 검사 `npm run test:sets-cloud`** — 진짜 브라우저에서 `writeCloudSnapshot` 을 돌린다
  (계정·네트워크 없음, Firestore 는 통째로 가짜). **6건**: 한글 바이트 계산 · **혼합 batch** ·
  무한 재시도 없음 · 정확한 900KiB 경계 · 줄이면 재업로드 + 원본 불변 · 로컬 quota 복구 안내.
- **깨보기**: `SETS_SIZE_RED=1` 이 방어 없던 `33af005` 의 `index.html` 을 대신 서빙한다 →
  **4건이 빨간불**. 별도 fixture 오류 주입은 깨보기 성공으로 세지 않고 exit 1이다.
- `check:fast` 에 `test:mock-library` 바로 뒤로 넣었다.
- `test:worker` · `test:mock-library` · `test:library-ui` · `check:static` · `test:public` 통과.

## ⚠️ 이 작업에서 검사망이 잡아 준 것 셋 (기록해 둔다)

1. **CSP 해시가 안 맞아 메인 스크립트가 통째로 차단됐다.** 인라인 스크립트를 고치면
   **`<meta>` 의 `sha256-` 을 다시 계산해야 한다.** ⚠️ **오류가 나지 않는다** — 앱이 조용히
   안 뜬다(`pageerror` 없음). `npm run test:public` 이 기대 해시를 알려 준다.
2. **`scripts/check-review-followup.mjs`** 가 `flushMocksToCloud` 를 샌드박스에서 돌리며
   `MOCK_DOC_MAX` 를 선언하고 있었다 → 이름을 바꾸자 빨간불. 고쳤다.
3. **`scripts/check-audit-safety.mjs`** 가 `writeCloudSnapshot` 을 샌드박스에서 돌린다 →
   `docBytes` 가 없어 빨간불. **베끼지 않고 `fn('docBytes')` 로 진짜 함수를 넣었다.**

▶ 전부 **반복 실패 2번("한 곳만 고쳤다")** 이고, 전부 기존 검사가 잡았다.

## ⚠️ 발견한 선행 결함 — `REV-2026-097`

`npm run test:ai-image` 가 **내 변경 전에도** 실패한다(작업분을 치우고 재현했다).
R1 의 CSP 해시 잠금이 `'unsafe-inline'` 을 없애 **`<script>` 주입으로 내부 값을 읽는 검사**가
막힌 것이다. 제품 결함은 아니지만 **`check:fast` 가 빨간불**이라 다른 변경의 관문이 막힌다.
같은 기법을 쓰는 검사가 더 있고(`check-public-browser`·`check-csp-browser`·
`check-mock-library-ui`·`regression-test.html`·`integration-test.html`) 전부 확인하지는 못했다.

## 다음 검토자에게

⚠️ **특히 봐 주었으면 하는 것** — 초과본이 `hasUnsavedCloudWork()` 를 **영영 참으로** 만든다.
그래서 `beforeunload` 경고가 남는데, **그 문제집이 실제로 클라우드에 없으므로 정직한 동작**이라고
판단했다(이전에는 batch 가 통째로 실패해 **모든** 문제집이 미동기화였으므로 회귀는 아니다).
다른 판단이 있으면 알려 달라.

다음 묶음은 계약 §4 의 **B2(로컬 동기화 메타데이터)** 다.

## 검토 기록

- `2026-09-21` · `Codex / GPT-6 Astra high` · 실제 diff·계약·브라우저 경로를 독립 검토했다.
  정확한 900KiB 경계, 혼합 batch, ACK 범위, 재시도 제외, 원본 불변은 확인했고 로컬 저장 실패
  오안내(`REV-2026-098`)와 고장 주입 하네스 오판(`REV-2026-099`)을 재현해 등록했다.
- `2026-09-21` · `Codex / GPT-6 Astra high` · `REV-2026-098` 해결을 실제 저장 경로로 재확인했다.
  `REV-2026-099`의 1차 수정에 남은 fixture 오류 오판도 찾아 후속 수정·실패 주입으로 닫았다.
  B1의 사용자 데이터·ACK·재시도 계약에 남은 재현 결함은 없다. 다음은 계약 §2-2·§4의 B2다.
