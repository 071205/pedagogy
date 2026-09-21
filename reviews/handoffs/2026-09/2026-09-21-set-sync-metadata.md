# 변경 인계 — R4/B2: owner별 로컬 동기화 기준 메타데이터

- ID: `HANDOFF-2026-158`
- 날짜: `2026-09-21`
- 작성자: `Codex / GPT-5.6 Sol high`
- 상태: `reviewed`
- 영향 영역: `index.html`, `tests`, `docs`
- 관련 이슈: `REV-2026-101`(resolved), `REV-2026-102`(resolved)

## 변경 내용

[저장 계약 §2-2](../../../docs/STORAGE-CONTRACT.md)에 따라 문제집의 마지막 ACK 기준을
`PM_SET_SYNC_META_V1:<uid>`에 저장한다. 각 항목은 `{id, revision, contentHash, order}`이고,
현재 Firestore 문서에는 revision이 없으므로 `null`을 보존한다. B3부터 양의 정수 revision을
그대로 받을 수 있으며 `0`은 유효한 기준으로 만들지 않는다. Firestore 스키마와 Rules는 바꾸지 않았다.

메모리의 `cloudSynced`는 현재 관측 서버 상태·dirty 판정·정렬에도 쓰이므로 영속 ACK 기준과
분리했다. cloud commit 성공 또는 최종 로컬 내용·order와 실제로 같은 서버본을 채택했을 때만
기준을 전진시킨다. 다른 원격본 관측, 크기 초과, commit 실패는 ACK하지 않는다. 본문과 메타데이터
쓰기가 quota로 갈라져도 `setSyncBaseFor()`가 현재 `setJSON()` 지문과 order를 다시 대조하므로
B3가 잘못된 base revision을 쓰지 않는다.

owner 전환 때 해당 키를 다시 읽고 guest에는 쓰지 않는다. 개별 tombstone 성공은 해당 기준을,
모든 문제집 삭제와 계정 삭제는 owner 키 전체를 지운다. `watchCloud()`는 실제 Firestore의 완전
snapshot과 일부 하네스의 `docChanges()` 전용 snapshot을 구분해, 부분 관측으로 다른 ID의 기준을
지우지 않는다.

독립 검토 뒤에는 pending/cache query snapshot을 ACK로 인정하지 않게 했다. 단순히 버리면 같은
query에 섞인 다른 문제집 변경도 잃으므로 `includeMetadataChanges`를 켜고, 다음 서버 확정 event의
`docChanges()`가 비어도 전체 `docs`를 한 번 적용해 변경·tombstone을 복구한다.

## 설계 교차 확인

Claude / Opus high에 §2-2와 관련 함수만 읽기 전용으로 보여 1회 의견을 받았다. 현재 서버 관측과
ACK 기준 분리, owner 재로딩, 짧은 동기 지문, hash/order 재검증이 필요하다는 점을 코드로 확인해
반영했다. 단, 서버본을 실제로 로컬이 채택한 읽기도 이후 오프라인 편집의 기준이므로 “쓰기 성공만
ACK” 제안은 그대로 따르지 않고 동일 내용·order일 때만 기록하도록 좁혔다.

## 검증

- `npm run test:set-sync-meta`: 현재 9건 통과. 성공 ACK·새로고침 hash/order guard·초과본 미ACK·
  원격 관측/채택 분리·owner/guest/삭제·commit 실패·pending/cache 미ACK·초기 cache read·보류
  snapshot 전체 복구를 실제 Chromium에서 확인.
- 깨보기: `SET_SYNC_META_RED=1`로 B2 직전 `fdcf622`를 서빙해 9건을 모두 실행하고 7건 빨간불.
- 기존 회귀: `test:sets-cloud`, `test:review-contracts`, `test:library-ui`, `test:mock-library-ui`,
  `test:audit-browser`(158/158), `test:ai-image`, `test:worker`, `test:public`, `check:static` 통과.
- `scripts/check-audit-safety.mjs`의 제품 함수 하네스에 새 의존성만 추가했다. 첫 실행에서
  `watchCloud()` 하네스가 `snap.docs` 없이 `docChanges()`만 주는 것을 잡아 완전/부분 snapshot을
  분리했고 재실행에서 통과했다.

## 다음 구현자 — R4/B3 (Sol high)

계약은 `docs/STORAGE-CONTRACT.md` §2-1·§2-3·§2-4다. 시작 파일은 `firestore.rules`,
`service-config.js`, `index.html`의 `setToDoc`·`setSyncBaseFor`·`writeCloudSnapshot`·`watchCloud`·
`deleteSetEverywhere`, `scripts/verify-rules-emulator.mjs`, `scripts/check-set-sync-metadata.mjs`다.
전환 Rules(구 문서와 revision 선택 수용) → 단계 플래그 아래 transaction 클라이언트 → 엄격 Rules
순서를 한 번에 건너뛰지 않는다. 최소 검사는 `test:set-sync-meta`, `test:sets-cloud`,
`test:review-contracts`, `check:rules`, `test:audit-browser`, `test:public`, `check:static`이며 Rules 배포는
emulator와 독립 검토 뒤 별도 단계로 다룬다. B4 충돌 사본·선택 UI는 시작하지 않는다.

## 검토 기록

- `2026-09-21` — `Codex / GPT-6 Astra high`: pending listener snapshot이 실패한 commit을 ACK로
  기록하는 `REV-2026-101`을 재현.
- `2026-09-21` — `Codex / GPT-6 Astra high`: 1차 수정에서 보류 snapshot에 섞인 다른 문제집
  변경이 누락되는 `REV-2026-102`를 재현.
- `2026-09-21` — `Codex / GPT-6 Astra high`: metadata event + 전체 docs 복구 수정의 좁은 재검토에서
  두 이슈 해결, tombstone·반복 event·owner 전환 경계까지 확인하고 추가 결함 없음.
