# pending Firestore snapshot이 실패한 문제집 쓰기를 ACK로 기록한다

- ID: `REV-2026-101`
- 날짜: `2026-09-21`
- 보고자: `Codex / GPT-6 Astra high`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-158`

## 요약과 영향

Firestore listener는 서버 확정 전에 로컬 쓰기를 반영한 snapshot을 보낼 수 있다. `watchCloud()`가
이를 영속 ACK 기준으로 기록하면 실제 commit이 거절된 뒤에도 실패한 초안이 마지막 서버 기준처럼
남는다. 이후 B3의 revision CAS가 이 기준을 신뢰하면 충돌 검출을 건너뛸 수 있다.

## 재현 절차

1. owner의 로컬 문제집을 수정하고 `watchCloud()`를 구독한다.
2. `writeCloudSnapshot()`의 commit 중 동일 문서에 대해
   `metadata.hasPendingWrites:true`인 listener snapshot을 전달한다.
3. commit을 `PERMISSION_DENIED`로 거절한 뒤 영속 metadata와 `setSyncBaseFor()`를 확인한다.

## 기대 결과 / 실제 결과

- 기대: 서버가 확정하지 않은 pending 또는 cache snapshot은 ACK 기준을 전진시키지 않는다.
- 실제: 저장 함수는 `false`를 반환하지만 `PM_SET_SYNC_META_V1:<uid>`가 실패한 초안의 hash로
  전진하고 `setSyncBaseFor()`도 그 초안을 유효한 기준으로 돌려준다.

## 근거

- `index.html`의 `watchCloud()`는 snapshot metadata를 보지 않고
  `reconcileSetSyncMeta()`를 호출한다. `loadSets()`의 최초 읽기 경로도 출처 확인이 없다.
- Astra 검토자가 실제 제품 함수를 VM에 추출하고 pending listener → commit 거절 → 기존 서버본
  순서로 재현했다. 로컬 수정 시각이 더 최신이면 기존 서버본을 받아도 거짓 기준이 남았다.
- Firestore 공식 listener 계약은 로컬 쓰기 이벤트를 서버 반영 전에 보내며
  `metadata.hasPendingWrites`로 구분한다고 설명한다.

## 처리 기록

- `2026-09-21` — `Codex / GPT-6 Astra high`: 읽기 전용 독립 검토에서 등록. 실제
  `writeCloudSnapshot()`과 `watchCloud()`를 결합해 commit 실패 후 거짓 ACK를 재현했다.
- `2026-09-21` — `Codex / GPT-5.6 Sol high`: `index.html`에서 pending/cache query snapshot은
  `cloudSynced`와 영속 기준을 전진시키지 않게 하고, `scripts/check-set-sync-metadata.mjs`에 실제
  listener → commit 거절 결합 회귀를 추가했다. 현재 9건 통과, B2 이전에서 7건 실패.
- `2026-09-21` — `Codex / GPT-6 Astra high`: 좁은 재검토에서 실패 초안 보존, 거짓 ACK 미기록,
  반복 확정 이벤트 무추가쓰기를 다시 확인해 해결 승인.
