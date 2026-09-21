# pending snapshot과 함께 온 다른 문제집 변경을 영구 누락한다

- ID: `REV-2026-102`
- 날짜: `2026-09-21`
- 보고자: `Codex / GPT-6 Astra high`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-158`

## 요약과 영향

`REV-2026-101`의 첫 수정처럼 pending/cache query snapshot 전체를 단순히 버리면, 그 snapshot에
같이 들어온 다른 문제집의 확정 원격 변경도 버린다. 기본 listener는 metadata-only 이벤트를
보내지 않고, 보내더라도 `docChanges()`가 비어 있을 수 있어 다른 기기의 변경이 현재 탭에 영구
반영되지 않는다.

## 재현 절차

1. 현재 탭이 문제집 A를 쓰는 동안 다른 기기에서 문제집 B를 수정한다.
2. A 때문에 `hasPendingWrites:true`인 query snapshot에 B 변경도 함께 전달한다.
3. A의 서버 확정 뒤 metadata-only query snapshot을 전달하고 B의 로컬 내용을 확인한다.

## 기대 결과 / 실제 결과

- 기대: pending 상태에서는 ACK하지 않되, 다음 서버 확정 상태에서 B의 확정 변경을 적용한다.
- 실제: pending snapshot 전체를 버리고 이후 delta가 비어 있어 B는 옛 내용으로 남는다.

## 근거

- `watchCloud()`의 첫 수정은 비확정 query snapshot에서 즉시 반환했고 구독에
  `includeMetadataChanges:true`가 없었다.
- Astra 검토자가 실제 함수를 VM에서 실행해 `afterIgnored:'old-b'`,
  `afterServerConfirmed:'old-b'`를 재현했다.
- Firestore 공식 listener 계약상 metadata 변경 이벤트는 명시적으로 요청해야 하며,
  metadata-only 이벤트의 문서 delta는 비어 있을 수 있다.

## 처리 기록

- `2026-09-21` — `Codex / GPT-6 Astra high`: `REV-2026-101` 좁은 재검토에서 등록.
  pending query에 섞인 다른 문서의 원격 변경이 서버 확정 뒤에도 누락됨을 재현했다.
- `2026-09-21` — `Codex / GPT-5.6 Sol high`: listener에 `includeMetadataChanges:true`를 켜고,
  비확정 snapshot을 보류한 다음 첫 서버 확정 event에서 `docs` 전체를 한 번 적용하도록 수정했다.
  새 Chromium 검사는 빈 `docChanges()`에서도 다른 문제집 B의 변경을 복구한다.
- `2026-09-21` — `Codex / GPT-6 Astra high`: 좁은 재검토에서 B 변경과 tombstone 복구,
  계정 전환 뒤 stale callback 무시를 확인해 해결 승인. 새 데이터 유실·무한루프는 재현되지 않았다.
