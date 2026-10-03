# B7 장치 내 응답 outbox — fixture 경계

`pedagogy-intake-sw.js`는 메시지만 처리한다. fetch 이벤트, 앱 HTML 캐시,
background sync, 공급자 호출이 없다. `createIntakeFixture({useOutbox:true})`가
명시적으로 등록할 때만 사용한다. `file://`에서는 등록하지 않으며 기존 편집 경로를
그대로 사용할 수 있다. 운영 Worker의 intake 503 차단은 유지한다.

1. B6가 원문·쪽·시도 세대를 `processing`으로 기록한 뒤, fixture 요청을 SW에 보낸다.
2. SW가 같은 owner의 `PM_INTAKE_V1` 레코드에서 원문 Blob·삭제 세대·작업 세대·
   attemptId를 확인한다. 모의 응답을 만든 뒤 다시 확인하고 `outbox`에 **IDB 완료**까지
   기록한 다음에만 페이지에 응답을 보낸다.
3. B6는 같은 owner 레코드의 한 트랜잭션에서 유효 응답을 쪽 `success`·초안으로
   확정하고 outbox 항목을 제거한다. 재실행 시 `recoverOutbox()`가 먼저 이 경로를
   밟는다. 로그인/guest 초기화에도 기존 SW 등록과 DB가 있을 때 복구한다.
4. 원문 삭제는 세대를 올리면서 해당 outbox 항목을 제거한다. 늦은 SW 쓰기는
   재검사에서 거절된다. 계정 삭제는 기존 B6 owner fence와 함께 outbox를 비우므로
   Auth 삭제 전 파기 확인에 포함된다. 다른 owner의 항목은 읽지 않는다.

응답을 보존하지 못했거나 응답 자체를 잃으면 쪽은 `locked`로 남고 자동 재호출하지
않는다. 이미 보존한 결과만 같은 owner·유효한 세대에서 복구한다. 기존 B6 채택 장부가
고정 ID와 tombstone을 대조하므로 복구가 문제집을 자동 생성하거나 삭제한 권을
되살리지 않는다. outbox에는 원문 Blob을 **별도로 복제하지 않는다**.

원장 `pending` 최대 10분·`completed` 7일, 일일 quota 48시간은 서버 기록의 수명이다.
원문 Blob은 숫자 TTL 없이 연결/명시 삭제 계약을 따르고, outbox 응답은 채택 후
제거되거나 원문/계정 삭제 때 파기된다. 기기 저장소 회수·기기 변경 복구를 보장하지
않으며 탭 종료 중 처리를 계속하지 않는다. C1~C3/D3와 공급자 연동 전에는 이
fixture를 실호출로 확대하지 않는다.
