# R5 연결 게이트 근거와 남은 판정

2026-10-23 · 작성 Codex · **R5 통과·R6 진입 가능 — 사용자 승인으로 독립 Codex 종합 판정**

대상은 PR25 검토 head `580a7fa`, main merge `7c6386e`의 R1·B1~B7·R4.5·U0~U2 연결이다.
이미 승인된 같은 diff를 재검토하지 않는다. 이 문서 자체는 독립 승인이나 출시 완료 증거가 아니다.
범위/모델은 [통합 레일](DEV-TOKEN-ROADMAP.md), [⑪ 지시문](RAIL-ORDERS.md#⑪-r5-종합-게이트--둘-다)을 따른다.

## 재사용하는 독립 검토와 배포 근거

| 묶음 | 기존 검토·후속 해소 근거 | 이번 연결에서 확인할 경계 |
| --- | --- | --- |
| R1 보안·공개 경계 | [H153](../reviews/handoffs/2026-09/2026-09-20-sonar-security-r1.md) 2026-09-23 Claude Opus 독립 검토. 자기검증과 구별 | 새 U2 JS/CSS 공개 allowlist·CSP와 CI의 검사 범위. HTTP 보안 헤더는 R7 |
| B1 문서 크기 | [H156](../reviews/handoffs/2026-09/2026-09-21-sets-cloud-size-defense.md) Astra 독립 검토, REV98/99 해소 | U2 결과가 기존 writeLocalNow/900KiB/ACK 경로를 사용하고 초과/실패를 성공으로 표시하지 않음 |
| B2 ACK 기준 | [H158](../reviews/handoffs/2026-09/2026-09-21-set-sync-metadata.md) Astra 검토·REV101/102 재확인 | pending/cache를 계정 ACK로 표시하지 않고 구성 결과 고정 ID로 조회 |
| B3 revision·Rules | [H168](../reviews/handoffs/2026-09/2026-09-23-rules-b3-transition-deploy.md), [H170](../reviews/handoffs/2026-09/2026-09-25-rules-b3-strict-deploy.md) Opus 최종 검토·운영 3/3. 최신 schema는 H194 | setSchemaVersion1·CAS와 구성 결과 정규화, 미래/보류/소속 미확정 입력 거절 |
| B4 충돌·재진입 | [H169](../reviews/handoffs/2026-09/2026-09-25-index-b4-conflict-hold.md) Codex 독립 검토·운영. [H196](../reviews/handoffs/2026-10/2026-10-22-index-conflict-server-choice-reentry.md) REV137/138/139 해소·PR24 운영 | 새 결과 보류→명시 선택→재진입, 서버본 그대로 채택/원본 검토 상태 보존 |
| B5 시도 원장 | [H171](../reviews/handoffs/2026-09/2026-09-25-worker-b5-attempt-ledger.md) Opus 검토, secret→Worker→Pages 운영 | U2 재배열은 호출0회. 운영 추출 비활성 상태에서 provider를 새로 연결하지 않음 |
| B6 원문·채택 | [H173](../reviews/handoffs/2026-10/2026-10-01-index-b6-intake-storage.md), [H174](../reviews/handoffs/2026-10/2026-10-03-index-b6-review-fixes.md)만으로 완료 판단하지 않음. [H175](../reviews/handoffs/2026-10/2026-10-03-index-b6-remote-update-hold.md)·[H176](../reviews/handoffs/2026-10/2026-10-03-index-b6-folder-sync-result.md)·[H178](../reviews/handoffs/2026-10/2026-10-03-index-b6-delete-fences.md)의 REV112~117 Claude 재확인/배포까지 포함 | 보존 결과→구성→고정 채택, grant/owner/삭제 세대·로컬 실패·다음 유료 호출 차단·늦은 응답 보존·미채택 fork |
| B7 응답 복구 | [H179](../reviews/handoffs/2026-10/2026-10-03-index-b7-sw-outbox.md) Claude 독립 검토·fixture 정상/기준 RED·배포 | 응답 보존 경로를 유지. 운영 SW 미등록을 실제 provider 복구 완료로 확대하지 않음 |
| R4.5 출력 | [H163](../reviews/handoffs/2026-09/2026-09-22-r45-choice-overflow-ladder.md), [H164](../reviews/handoffs/2026-09/2026-09-22-index-mid-line-center.md) Codex 검토·REV107 구조 RED 해소 | 새로 구성한 문제집도 기존 render/print를 통과함 |
| U0 계약 | [H167](../reviews/handoffs/2026-09/2026-09-23-docs-u0-contract.md) Opus 검토, [H172](../reviews/handoffs/2026-09/2026-09-26-docs-u0-contract-amendment.md) 개정 재검토 합의 | D1은 현재 독립 사본. D3 운영 숫자·D1 수정 연동 활성화·사용자 관찰을 구별 |
| U1 지면·시작 | [H177](../reviews/handoffs/2026-10/2026-10-03-index-u1-sheet-layout.md), [H180](../reviews/handoffs/2026-10/2026-10-03-index-u1-start-thumbs.md) Codex 승인·운영·완료 기준 대조 | U2 결과→문항 편집/지면 조립·선택/출력 연결 |
| U1.5 원문 대조 | [H182](../reviews/handoffs/2026-10/2026-10-04-index-u15-source-viewer.md) UI Codex, [H183](../reviews/handoffs/2026-10/2026-10-04-index-u15-storage.md) 저장 Claude, [H184](../reviews/handoffs/2026-10/2026-10-04-index-u15-manual-link.md) 수동 연결 Codex 재확인·REV118 해결. PR14/15/16 병합/225파일 일치 | source grant·삭제/유실/재연결·뷰어 해제·owner. 현재 H184 목록/용량/삭제 관리가 이미 있으므로 H193 별도 브랜치 설명으로 미구현이라고 하지 않음 |
| REV108 명시 소속 | [H194](../reviews/handoffs/2026-10/2026-10-19-index-passage-membership.md) Claude ①/② 승인, Rules/PR23·CI·운영 revision/소속/PDF/옛 쓰기 거절 | U2의 이동/제외/Undo·새 ID remap에서 전체 묶음 유지 |
| U2 저장·구성 UI | [H197](../reviews/handoffs/2026-10/2026-10-22-index-u2-composition.md) 사용자 승인으로 Codex 구현/독립 Codex 검토. REV140~146 해소, 저장20/RED7·UI15/RED9·CI/배포 | 미검토 연결 영향만 확인. Claude 승인으로 기록하지 않음 |

## 현재 커밋 검사·실제 운영 연결

- PR25 head CI [39757671461](https://github.com/071205/pedagogy/actions/runs/39757671461), merge Verify [39761068480](https://github.com/071205/pedagogy/actions/runs/39761068480) 모두 성공. check:fast·cross-platform·HWPX·Rules emulator·공개 산출물·CSP/RED와 기존 브라우저175/JSON12를 포함한다. 동일 커밋을 다시 돌리지 않는다. CodeRabbit skipped는 승인으로 세지 않는다.
- Pages main `7c6386e` built. index/UI/planner/CSS/intake 5파일 SHA가 검토본과 일치(H197). 이 문서 작업은 실행 파일 변경이 없다.
- 실제 로그인 Chrome에서 자체 작성 REV1084문항을 U2로 3+1의 두 국어 권에 구성했다. 최초 계정 저장 대기→조회 후 두 권 ACK→새로고침/작업 재진입 ACK·고정 권/문항 ID. 26→28권은 검증 권 두 개만 추가한 결과다.
- 원본 JSON 2888바이트/SHA `dee58a702dc0474cb5c64e86a51bab182ae3c254825062c848ab631e973eac01` 불변. 새 결과 JSON은 root folderId 누락/빈 문자열 정규화만 차이, 나머지 전체 데이터 동일.
- 운영 U2 A권에서 문항 편집→지면 배치가 실제 2쪽 조립 완료, `[01~03]`·3문항 유지/잘림·축소 없음 안내를 확인했다. `/private/tmp/u2-operational-sheet.png`. 실제 PDF 출력은 별도 PR24 검증(H196)이며 이를 새 U2 PDF 실물 검증으로 바꾸지 않는다.
- 기존 tests는 B6·B4·원문·지면을 묶음별로 검증한다. 독립 Codex가 폐기 가능한 Chromium fixture에서 보존 초안→실제 U2 채택→편집/인쇄 DOM/지면→B4 보류/사본→원문 삭제까지 연결해 추가 결함 없이 exit0 확인했다. 후속 probe에서 명시 충돌 선택→실제 CAS 함수의 거절/성공→서버 확정 snapshot 뒤 ACK→실제 새로고침/같은 결과 ID→편집/지면/인쇄 DOM/원문까지 추가 결함 없이 exit0 확인했다. Firestore 서버/transaction/snapshot 전달만 메모리 대역이며 실제 운영 Firestore 검증과 구분한다. 기존 개별 통과를 이 전체 연결 통과로 합산하지 않는다.

## 분리해 남기는 외부 게이트

- D3/C1~C3: 실제 provider·비용/쪽/바이트/문항 수치·순차 실패/명시 재시도. U2 일괄 추출은 비활성.
- B7 운영 SW/실제 공급자 response 복구, 실제 사용자 과제 관찰, Safari/iPad 보관·회수/출력은 R8에서 별도 증거 필요.
- D1 수정 연동 활성화는 별도 Rules·호환·전환 설계/검토가 필요. 현재 U2는 독립 사본이다.
- R7: 호스트/보안 응답 헤더·App Check·origin/전환·롤백. 현재 Pages의 HTTP 보안 헤더 제약을 R1 결함 미해결로 뒤집지 않음.
- REV074/075/093 열린 상태는 유지. R6~R10·결제/출시 완료가 아니며 공백을 승인으로 대체하지 않는다.

## 종합 판정 — 2026-10-23

- **합의: R5 통과·R6 진입 가능.** 사용자가 “검토 에이전트 띄워서 하고 레일대로 계속 진행하자”라고 지시해 Claude 주간 한도 대기를 독립 Codex 종합 검토로 대체했다. 구현·기존 연결 probe와 별개의 새 검토자 `/root/r5_gate_review`가 최종 승인 증거·실제 코드/연결 assertions·대역 범위를 대조했다. R5에서 추가 재현 결함·미검토 수정 영향·승인 누락 없음.
- **미합의: R5 범위 없음.** R6~R10·실제 유료 AI/D3/C1~C3·운영 SW·Safari/iPad·D1 연동·R7 헤더/호스트·사용자 관찰은 위 후속 게이트에 남는다.
- 근거: 원격 main `7c6386e`와 당시 HEAD `2f47d66` 차이는 문서6개, 운영5파일 SHA가 H197 검토본과 동일. 기존 R1/B1~B7/R4.5/U0~U2 최종 독립 승인·후속 해소/배포를 각 인계에서 확인했다. U2 구성/고정 채택/결과 상태와 CAS probe의 실제 함수 호출/단언을 독립 대조해 기존 정상/RED와 함께 유효한 연결 증거로 판정했다. 승인된 같은 검사는 재실행하지 않았다.
- 다음 행동: **R6 / GPT-6 Luna medium**이 기존 CI 재사용·의존성/secret 검사 공백·도구 고정·Dependabot 항목을 처리한다.
- 구현자·검토자: 구현 Codex / 연결 probe 구현하지 않은 Codex / 이번 종합 판정 새 독립 Codex `/root/r5_gate_review`. **Claude 승인으로 기록하지 않는다.** 과거 Claude 요청1회는 로그인 정상 후 주간 한도 exit1·최종 없음이었다(`/private/tmp/r5-opus-wrapper.log`).

## 독립 연결 재현 절차(유료 호출·운영 데이터 없음)

검토자 `/root/independent_review`, runtime head `580a7fa`/index SHA `3fc1f2cc…`. 제품 파일 변경 없음.
폐기 가능한 Chromium에서 serve.py를 띄우고 외부 요청은 차단한다. IDB/계정 대역은 전용 fixture owner만 쓴다.

1. createIntakeFixture의 합성 transport로 2쪽 중 첫 쪽 2문항 공통 묶음 성공·둘째 쪽 실패를 만든다. 별도의 untouched 원본 권을 보관한다.
2. 실제 compositionUI 작업 목록에서 보존된 2문항 초안을 열어 구성안을 확인/적용하고, 성공 쪽만 만들기 확인을 거쳐 1권 채택한다. initial result는 local/pending이며 groupReview는 intake다.
3. 편집기로 열면 묶음 미확인 때문에 buildPrintDoc가 차단됨을 확인한다. 실제 문항 정보에서 묶음 안내/2문항을 확정한 뒤 print DOM의 안내·두 본문·groupDiagnostics 빈 값·untouched 원본 불변을 확인한다.
4. 실제 지면 조립의 1쪽과 두 본문, source view의 image/원문1쪽 대응을 확인한다.
5. 실제 holdSetConflicts로 결과를 보류하면 사본1개와 원문 grant가 보존되고 같은 adoption 결과의 cloud가 conflict가 됨을 확인한다.
6. 원문 impact에 결과/충돌 사본이 모두 있는지 확인하고 ticket/confirmed로 삭제한다. 두 참조는 deleted, 문항2개 유지, 열린 뷰어 해제, transport 호출수는 최초2회 그대로다.

실행 `node /private/tmp/r5-integration-review-2026-10-22/probe.mjs` exit0, 같은 폴더 probe.log. 임시 자료가 없어지면 위 절차와 실제 API/기존 fixture 패턴(check-composition-ui/check-sheet-source)으로 재현한다. 실제 Firestore 충돌 왕복·유료 공급자·PDF 실물/글꼴·Safari 검증으로 확대하지 않는다.

### 명시 CAS와 재진입 후속(같은 fixture)

- 같은 U2 결과를 보류한 상태에서 chooseServerVersion이 실제 writeSetDocRevision을 부르게 했다. Firestore collection/doc, runTransaction의 get/set, onSnapshot 전달만 메모리 대역이다. 선택·CAS 비교·정규화/저장/ACK·watchCloud callback·IDB·편집/지면은 제품 함수를 그대로 썼다.
- stale snapshot revision20/current21 선택은 changed 거절·쓰기0회·보류 유지·ACK 없음. 최신 snapshot의 순서0→1 선택은 실제 명시 CAS를 거쳐 revision22/쓰기1회, 서버 본문과 정확히 같은 값만 ACK했다. 서버 reviewed 상태도 보존됐다.
- 다른 로컬 본문, 로컬 재진입 직후 서버 미관측, pending snapshot은 모두 pending. 서버 확정 snapshot 전달 뒤에만 ack다.
- 실제 page.reload 후 같은 IDB 작업/결과 ID·ACK·원문 available·충돌 사본1개를 확인하고 실제 편집/지면/print DOM에서 채택한 서버 본문·안내/묶음·원문1쪽 대응과 별도 원본 불변을 확인했다. 이어 원문 삭제 영향표와 삭제 후 문항/사본 보존·뷰어 정리도 통과했다.
- 실행 `node /private/tmp/r5-integration-review-2026-10-22/cas-probe.mjs`, cas-probe.log **exit0**. 기존 CAS43건을 다시 실행하지 않았다. 원격 Firestore/Rules·실제 인증·서버 transaction 재시도까지 검증했다는 뜻은 아니다. 기존 정상/RED·운영 U2 ACK/재진입 증거와 함께 재사용한다.

이 연결 probe 뒤 2026-10-23 새 독립 Codex 종합 판정으로 R5를 통과했다(위 종합 판정). Claude 요청의 주간 한도 실패는 승인과 구별한다.
