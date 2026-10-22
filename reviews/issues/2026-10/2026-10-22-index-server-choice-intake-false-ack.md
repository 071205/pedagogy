# 서버본 선택이 intake 검토 상태를 바꾸고 다른 본문을 ACK로 표시한다

- ID: `REV-2026-139`
- 날짜: `2026-10-22`
- 보고자: `Codex 독립 검토 에이전트`
- 상태: `in-progress`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-196`

## 요약과 영향

지원되는 intake 문항을 포함한 충돌에서 **계정 저장본 쓰기**를 선택하면, 일반 편집 저장의 검토 무효화가 서버본 채택에도 적용되어 계정의 `contentReview:reviewed`가 로컬에서 `unreviewed`로 바뀐다. 그 변형된 객체로 `cloudSynced`와 영속 동기화 기준을 세우므로 서버/로컬 내용이 다른데도 저장 완료로 판정한다. 사용자에게 검토 상태가 잘못 보이고 저장 차이를 감추는 문제다. 문항 본문 유실이나 운영 발생은 확인하지 않았다.

## 재현 절차

1. 동일한 권/문항 ID에 서로 다른 본문·정답의 서버본과 로컬 초안을 만든다. 양쪽 문항에는 정상 intake v1(`sources:[]`, 검토 상태 `reviewed`)가 있다. 로컬 초안을 저장해 `intakeLocalBase`도 현재 로컬 본문으로 세운다.
2. 이전 서버 revision을 쓰기 기준으로 둔 상태에서 실제 `writeCloudSnapshot()`을 호출해 충돌 기록과 초안 사본을 만든다. 앞 권 삽입으로 해당 권의 로컬 index가 서버 order와 다르게 한다.
3. 화면에서 읽은 서버 snapshot으로 `chooseServerVersion()`을 호출한다.
4. 서버본 채택 뒤 로컬 `contentReview`, 실제 서버 문서의 검토 상태, 정규화 `setJSON`, `isCloudSynced`, `setSyncBaseFor`를 비교한다.

## 기대 결과 / 실제 결과

- 기대: 서버본 채택은 서버에서 이미 확정된 검토 상태를 유지하며 실제로 같은 본문에만 ACK를 세운다. 동시에 저장되는 다른 편집 권의 검토 무효화는 유지한다.
- 실제(`dccf29d`): 선택 결과 `ok:true`; 로컬 `contentReview:unreviewed` / 서버 `reviewed`; `setJSON(local)!==setJSON(docToSet(server))`; 그런데 `isCloudSynced(local,index)===true`, `setSyncBaseFor(local,index)!==null`이다. 충돌이 실제 생성됐고 사본 1개가 보존된 것도 확인했다.

## 근거

- `index.html`의 `chooseServerVersion()`은 서버 `docToSet()` 결과를 `sets`에 넣고 일반 `writeLocalNow()`를 호출한다(`dccf29d` 5071행).
- `writeLocalNow()`는 `intakeLocalBase`에 있던 같은 문항의 본문/꼬리표와 다르면 검토 상태를 무효화한다(4337~4340행). 서버에서 채택한 본문도 여기서 사용자 편집으로 간주된다.
- 그 뒤 같은 변형 객체 `incoming`으로 ACK와 영속 기준을 만든다(5076~5078행). 따라서 실제 서버 확인본과 다른 객체에 ACK를 세운다.
- 독립 검토의 로컬 Chromium 포트 18946, 외부 요청 차단, 메모리 Firestore transaction으로 재현했다. 스크립트 `/private/tmp/rev138-agent-review-2026-10-22/probes.mjs`, 생성기 `build-probes.py`, 결과 `probes.log`의 `reviewed-intake-server-choice`(`heldBefore:true`, `copies:1`). 임시 파일은 소실될 수 있으므로 위 절차와 영구 회귀로 재현한다.
- `37b1500` 응답 비교에서도 검토 상태 손실은 재현됐다. 따라서 일반 편집 무효화의 근본 문제는 기존 경계다. 같은 shifted-order 조건에서 그 기준은 `isCloudSynced:false`/영속 기준 없음이었으나 REV-138 수정안은 순서를 맞춘 뒤 변형된 검토 상태까지 ACK로 표시한다. 원래 REV-138 재진입 결함과 검토 상태 채택 결함을 구분한다.

## 처리 기록

- `2026-10-22 · Codex 독립 검토`: 실제 브라우저에서 확인하여 등록. 제품 수정·커밋·배포는 하지 않았다. 선택한 정확한 서버 채택 객체만 일반 편집 검토 무효화에서 제외하고, 다른 권의 검토 무효화 및 서버/로컬 ACK 일치를 검사하는 수정이 필요하다.

- `2026-10-22 · Codex 구현자`: 부모도 실제 충돌 생성→서버본 선택의 같은 순서/순서 불일치 두 경우에서 RED를 확인했다. `writeLocalNow({serverVersion})`에서 정확히 채택한 그 객체만 일반 편집 검토 무효화에서 제외하고, 형제 권의 본문/꼬리표 편집 무효화는 유지한다. 두 경우 검토 상태·저장 JSON/실제 서버 setJSON·ACK/영속 기준 일치 검사 추가(총 42건). `SET_REVISION_REVIEW_RED=1`은 예외 방어만 제거해 두 표적을 모두 실패시켜야 통과하며, 변이 생략 제어는 exit 1이다.
- `2026-10-22 · 독립 Codex 검토 에이전트`: 수정 후 별도 Chromium 재실행에서 서버/로컬 검토 상태 reviewed·setJSON 일치·ACK/기준 정합성을 확인했다. 로컬 저장 실패/재선택·계정 전환·tx 직전 미래 schema 차단도 정상, 추가 결함 미발견. 검토 index SHA-256 `bd050268d7807339e17578a4e23dbc52dca76b2489d4c9d254b5a8f8f9d1b377`. 새 커밋 CI/운영 확인 전이므로 상태는 in-progress 유지.
