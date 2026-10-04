# B6 자료·채택 저장 구현 — 수정 diff 재검토 대기

2026-10-03 · `codex/b6-intake-storage` · 기준 `main=2ff20f3`.
실행 위치는 [통합 레일](DEV-TOKEN-ROADMAP.md), 계약은 [U0](PRODUCT-UX-U0-CONTRACT.md)와
[저장 계약](STORAGE-CONTRACT.md), 검토 기록은 [HANDOFF-173](../reviews/handoffs/2026-10/2026-10-01-index-b6-intake-storage.md).

## 범위와 활성화 경계

B6는 자료/초안/채택 엔진과 기존 라이브러리 연결이다. 작업 UI·원문 관리 UI는 U2/U1.5에서
같은 엔진에 연결한다. 기존 문서 AI·한 장 사진 AI·B3/B4/B5 Rules와 운영 설정은 유지한다.
**실서비스 일괄 AI는 꺼져 있다.** Worker의 기본 `createWorker()`에는 새 task transport와
운영 한도가 없으며 `problem-intake-v1`을 quota 예약·공급자 호출 전에 503으로 거절한다.
로컬 fixture는 `createIntakeFixture({config,transport,renderer,dbName,editorsConfirmed:true})`로
실행한다. transport는 테스트 stub이며 실제 공급자/모델·요금·키를 바꾸지 않는다.

C1~C3/D3가 정할 운영 숫자는 넣지 않았다. `PedagogyIntakeContract.limits()`의 한도 목록을 모두
명시해야 생성 가능하며 값 없는 활성화는 불가능하다. fixture 수치는 테스트에만 있다.
기존 외부 JSON 500문항, B6 목적지 500 이하, B5 pageNumber 500 이하, 클라우드 900KiB를 보존한다.
운영 활성화 전 서버의 작업 누적 호출/재시도 예산 집행과 실제 비용 계측은 C3에서 연결해야 한다.
클라이언트의 호출 수 제한을 서버의 경제적 상한이라고 주장하지 않는다.

D1 연동 저장은 `mode:independent` 외 요청을 거절한다. 새 공유 컬렉션·Rules·참조 전환은 없다.
이전 편집기가 모르는 메타데이터를 지울 수 있으므로 구형 클라이언트 무손실 호환을 선언하지 않는다.
현재 버전은 읽지 못하는 intake를 원문 그대로 보존하고 해당 문제집을 업데이트 필요·읽기 전용으로 격리한다.
정상 권 읽기/저장은 계속하며 해당 권의 cloud 쓰기(직접 CAS 포함)는 차단한다. 복구 JSON은 opaque 원문이고
v1 projection을 성공했다고 보지 않는다. 명시 계정 파기는 tombstone을 허용한다. 구형 탭을 닫고 최신 편집기만 사용한다는 명시
확인과 Web Locks가 없으면 채택을 보류한다. 운영 활성화 전 지원 버전/구형 기기 전환을 다시 확인한다.

## 데이터·API

`pedagogy-intake-contract.js`는 browser/Worker가 함께 사용하는 task별 응답 검증이다.
기존 document/사진 task의 응답은 바꾸지 않는다. 원문에 없는 배점/정답을 만들지 않고
그림·표/쪽 경계의 지문을 안전하게 텍스트로 보존할 수 없는 결과는 확인 필요로 실패시킨다.
`pedagogy-normalize.js`의 strict `normIntake()`와 읽기 경계 `preserveIntake()`가 출처를 보존한다.
`intake.sources`에는 **무작위 sourceId와 pages만** 남는다. 정상 v1의 cloud 전송/ACK 비교/JSON 내보내기에서도 같은 projection을 적용한다. filename/hash/blobURL/owner/receipt는 없다.
저장된 문항의 본문/정답을 바꾸면 contentReview, 꼬리표/배점을 바꾸면 classificationReview가
unreviewed로 돌아간다. 확인 완료는 저장 성공이나 AI 응답 성공으로 만들지 않는다.

원문 DB는 `PM_INTAKE_V1`/schema 1이다. owner 레코드의 `sources/jobs/adoptions/links`는 IDB
transaction 안에서 갱신한다. 라이브러리 전체를 IDB로 옮기지 않는다. 원문 Blob·이름·해시는
이 기기에만 있고, 원문 전체 업로드 경로는 없다. 삭제 fence의 최소 owner/source 기록은 TTL 없이 남긴다.

| API | 동작 |
| --- | --- |
| `createJob(files,{selection,contract})` | 파일 수/바이트·형식·쪽 범위 검증, 불변 원문과 첫 작업 연결을 함께 보관. 선택만으로 AI 호출 없음 |
| `run(jobId,{retryPages,confirmCharge})` | Web Lock으로 같은 작업을 직렬화, 한 쪽씩 렌더/검증/호출. 성공은 건너뜀. 실패 재시도는 쪽 선택+추가 차감 확인 필요 |
| `readJob(jobId)` | 같은 owner의 쪽 상태·stable draft IDs·응답 checksum·차감 receipt 읽기 |
| `adopt(jobId,{destinations,draftVersion,partial,adoptionId,mode})` | 고정 ID 매핑/예정 연결을 먼저 IDB 보관. 독립 사본만 실제 라이브러리에 채택 |
| `adoptionStatus(adoptionId)` | 현재 권별 local/failed/deleted/check와 cloud ack/pending/tooBig/error/conflict 대조 |
| `listSources/readSource/forProblem` | owner별 목록/원문/권한 있는 권 연결 읽기. 외부 JSON 출처는 Blob 접근 권한을 만들지 않음 |
| `linkSource/inheritLinks/detachSource` | 수동 명시 연결·같은 owner의 복제 연결·원문을 파기하지 않는 명시 해제 |
| `impact/deleteSource` | 온라인+첫 서버 확정 구독+전체 기록 읽기 후 현재 권/충돌/작업/예정 연결/복구본 합집합 표시. ticket+명시 확인 후 삭제 |
| `reconcile/finishJob` | 삭제한 권의 연결 정리/Undo의 살아 있는 연결 복귀, 작업 종료. 원문 자동 삭제 없음 |
| `reconnect` | 같은 파일 hash/type/bytes 확인. 삭제한 원문/다른 파일은 새 ID로 명시 등록해야 함 |
| `stop/purge` | 계정 전환의 늦은 작업 중단, 계정 삭제의 IDB fence/원문·job·adoption 파기 |

### U1.5 저장 묶음 API (2026-10-04)

`PedagogyIntake.create({session,library,renderer})`는 AI `config` 없이 원문 읽기·수동 등록·연결에 쓴다.
운영 바인딩은 `index.html`의 `createIntakeStorageClient({editorsConfirmed})`이며 fixture와 같은
`createIntakeLibrary()`를 사용한다. 구형 탭 종료 확인은 호출자가 명시해야 한다.

- `registerSource(file,setId)`는 PDF/지원 이미지의 형식·해시·쪽수를 검사한다. 파일당 100MB,
  owner별 실제 Blob 합계 1GB, 파일당 500쪽을 적용한다. 같은 owner의 hash·bytes·type이 모두
  맞는 Blob만 재사용하며 첫 권 연결과 Blob은 한 IDB 트랜잭션에 쓴다. job과 AI 호출 예산은 만들지 않는다.
- **B6 `createJob` 동작 변경:** AI 요청 한 번의 파일/총바이트 제한은 기존 `config`를 그대로
  적용한다. 이미 저장한 원문의 누적 합계 제한은 AI `cap.totalBytes`에서 D6의 1GB로 바꿨다.
- `assignPages(setId,problemId,[{sourceId,pages}])`는 원문/쪽 범위와 권 권한을 확인한 뒤 문항
  `intake.sources` **전체를 교체**해 라이브러리 저장 경로로 쓴다. AI 출처를 유지하며 수동 출처를
  더하려면 호출자가 기존 목록을 합쳐 넘긴다. 다른 문항·권의 출처는 바꾸지 않는다. 실패하면
  문제집 본문은 이전 값으로 되돌리고, 재시도 때 현재 문제집을 다시 대조한다. 문항 쪽 번호는
  IDB에 저장하지 않는다. 저장 성공 직후 Undo 한 번으로 해당 교체를 되돌릴 수 있다.
- `reconnect(sourceId,file,{setId})`는 기록이 있으면 hash·bytes·type을 검사한다. 기록이 없으면
  `setId`를 명시한 새 등록이며 이전 문항 쪽 대응을 옮기지 않는다. `detachSource`는 Blob을 파기하지 않는다.

쪽 상태는 pending → processing → success/failed/locked/missing이다. processing 중단·completed 원장만
있고 결과가 없는 경우는 locked로 남겨 자동 재호출하지 않는다. B7 outbox는 아직 없다.
공통지문은 job의 실제 draft IDs로 묶는다. 목적지에서 구성원 순서/연속성/완전성을 검사한 뒤
`groupSpan`을 재계산한다. 위치 기반 기존 편집기 결함 `REV-2026-108`은 그대로 열린 이슈다.

## 채택·탭 간 조정

IDB → 실제 localStorage flush → IDB 상태 갱신 순서다. 매핑 실패는 library write 0회다.
localStorage가 전체 배열을 쓰므로 한 번에 포함된 결과는 모두 local 성공 또는 모두 실패다.
실패 시 메모리/초안/고정 매핑을 남긴다. 재진입은 실제 같은 setId를 확인해 사용자 수정본을
보존하며 tombstone/이미 local이었다가 누락된 결과를 새 ID로 부활시키지 않는다.
900KiB 초과는 해당 권의 cloud만 막고 정상 권 ACK와 로컬 원문을 보존한다.

현재 클라이언트의 일반 local/cloud 쓰기도 `intakeWriteAllowed()`를 거친다. 활성화된 owner의
writer marker가 다른 탭 소유이거나 디스크가 읽은 기준과 다르면 초안을 owner별 메모리에 보존하고
쓰기/채택을 보류한다. 새로고침 전 JSON 백업 안내를 남긴다. IDB 잠금만으로 library를 보호했다고
주장하지 않는다. **구형 탭은 이 프로토콜을 모르므로 사전 정리 확인이 필요하다.**

죽은 writer marker의 복구는 같은 owner의 exclusive Web Lock을 실제 획득한 뒤
`navigator.locks.query()`의 단일 holder/clientId와 옛 clientId 부재를 확인한 경우만 허용한다.
옛 기록에 clientId가 없거나 살아 있는 holder가 보이면 보류하고, 디스크 기준 비교는 계속 유지한다.
근거: [Web Locks API](https://www.w3.org/TR/web-locks/). 무조건 marker를 지우는 안은 사용하지 않는다.

## 원문 삭제·계정 경계

`impact()`는 색인 외 실제 sets, 충돌 snapshot, 백업, Undo/Redo, 활성 job과 예정 연결을 읽는다.
첫 server 확정 snapshot 전, pending/cache snapshot, offline, 기록 손상·경쟁 쓰기에는 확인 필요다.
서버에만 있던 복제 권이 아직 내려오지 않은 상태를 '참조 없음'으로 확정하지 않는다.

문제집 삭제와 원문 삭제는 다르다. 마지막 현재 연결이 사라지면 unlinked로 보존하고 숫자 TTL/GC가 없다.
복구 시 Blob이 남아 있는 경우만 available로 복귀한다. 명시 삭제는 영향 ticket/IDB revision/원문 generation을
다시 검증한 뒤 deleting과 새 generation을 먼저 쓰고 Blob을 파기한다. 늦은 렌더/AI 저장은 구 세대로 실패한다.
결과가 blob URL에 의존하면 독립 보존 확인 전 삭제를 막는다. 결과 문항/그림은 지우지 않는다.

원문 반환과 모든 IDB write에 owner/epoch를 검사한다. guest는 별도 owner이며 자동 이관하지 않는다.
계정 삭제는 IDB fence/자료 파기와 `PM_INTAKE_PREFS_V1:<owner>` 제거를 Auth 삭제 전에 확인한다.
이 설정 키는 '모든 문제집 삭제'가 공유하는 `accountLocalKeys()`에 넣지 않았다.
삭제 중에는 owner fence가 늦은 IDB 쓰기를 막는다. Auth 삭제가 실패하면 서버에 `user.reload()`로
같은 계정의 존속을 확인한 뒤 해당 삭제 시도의 fence만 걷고, 파기한 원문은 복원하지 않는다.
확인이 불확실하면 fence를 유지한다. 뒤이은 동일 계정 로그인에서 Auth 서버 확인을 다시 거쳐
빈 원문 저장소로 복구한다. Web Lock 지원 브라우저에서는 삭제 시도와 복구를 owner별로 직렬화한다.
원문 하나를 삭제할 때는 그 원문을 쓰는 진행 중 요청만 중단하며, 작업 세대 변경으로 늦은 저장을 막는다.
D4의 `intakeResultRoute()`는 단일 정상 local 결과와 기억 설정일 때만 editor를 반환한다.
여러 권/partial/error/conflict/check는 list다. UI 연결은 U2에서 한다.

복제와 부팅 충돌 사본은 UI fixture 없이 기본 owner IDB 연결 권한을 승계한다. IDB 완료 뒤 사본을
게시하며 실패하면 생성 보류·재시도한다. 외부 JSON metadata는 권한을 만들지 않는다.
[112·113 수정/재현 증거](../reviews/handoffs/2026-10/2026-10-03-index-b6-review-fixes.md).

서버본만 새 버전이고 로컬은 v1 초안인 경우에도 해당 권만 계정 저장을 보류한다.
첫 서버 읽기/확정 구독은 dirty 초안을 보존하고 카드에 업데이트 필요·계정 저장 보류를 표시한다.
이 보류는 B4 충돌/자동 사본/ACK가 아니며 다른 권 저장은 계속한다. 자동 재예약에서는 제외한다.
호환 가능한 서버 확정 관측으로 해제하며 cache/pending은 해제하지 않는다. 계정별 관측 상태는
전환 시 비우고 새로고침 뒤 서버 관측에서 재구성한다. JSON 내보내기는 유지한다.
[114 수정·재현/경계 증거](../reviews/handoffs/2026-10/2026-10-03-index-b6-remote-update-hold.md).

## PDF·보관 환경

PDF.js **6.3.289** legacy display/worker와 고정 CMap/표준 폰트/codec 자산을 vendoring했다.
[공식 canvas 예제](https://mozilla.github.io/pdf.js/examples/index.html)를 따라 파일 bytes로 로컬 쪽 렌더링한다.
`node scripts/vendor-pdfjs.mjs`로 재생성한다. 소스맵 참조·생성 주석/고지의 후행 공백을 제거하고 QuickJS scripting engine은 제외한다. 고지 내용은 보존한다.
`isEvalSupported:false`; CSP에는 WebAssembly codec용 `wasm-unsafe-eval`만 추가했고 JS unsafe-eval/inline은 없다.
공개 빌드와 serve.py는 정확한 자산 목록만 제공한다. 기존 인라인 CSP 해시를 다시 계산했다.

storage.persisted/persist의 granted/denied/unsupported/error를 구별한다. 보관 성공을 영구 백업이라고
표시하지 않는다. Chromium의 실제 image/PDF 렌더를 검증했고 실제 iPad/Safari의 원문 장기 보관·회수 후
복구와 스캔/폰트별 PDF 표본은 U1.5/R8에서 추가 확인한다. 실패한 쪽은 자동 성공/절단하지 않는다.
