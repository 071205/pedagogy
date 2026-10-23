# R7 origin 자료 이관 설계안

상태: **설계안·실자료 이관 미구현**(2026-10-23). 통합 레일의 R7 하위 준비 문서다.
새로운 실행 레일이나 이관 완료 증거가 아니다. Astra high의 읽기 전용 분석을 구현자가
현재 코드로 대조해 정리했다. 실제 저장/활성화는 high 구현·별도 독립 검토가 필요하다.

## 현재 경계

일반 JSON은 사용자의 문제집 교환 형식이다. `index.html`의 exportAllBtn은 sets만
portableIntakeSet으로 내보낸다. importAllInput은 24MB/200권 한도·normSet 화이트리스트·
새 ID·이름 중복 조정을 거친다. 이 경로를 무손실 origin 이관으로 사용하면 안 된다.

`pedagogy-intake.js`는 PM_INTAKE_V1(version1)의 owners(keyPath owner)에 owner root를
저장한다. public API에는 전체 root export/import가 없다. listJobs는 finished/discarded를
빼고 readComposition은 history/redo를 뺀다. listSources는 reconcile 쓰기를 할 수 있고
readSource는 Blob 없는/삭제된 상태를 읽지 못한다. 읽기 전용 전체 snapshot API가 필요하다.

mock 클라우드 저장은 index의 flush 경로에서 batch.set을 사용한다. sets의 revision/CAS와
같은 안전성을 가정할 수 없다. 새 origin에서 가져온 mock 자동 업로드를 격리하거나
별도 CAS 확장을 검토하기 전까지 계정 동기화를 켜지 않는다.

## 보존 범위와 제외 범위

| 저장소 | 보존 대상 |
| --- | --- |
| owner localStorage | PM_SETS_V7, PM_BACKUP, PM_STAMPS, PM_SET_CONFLICTS_V1, PM_SET_SYNC_META_V1, PM_LIBRARY_META, PM_INTAKE_PREFS_V1, PM_LANG, PM_LAST_Q의 `:<owner>` 값과 키 부재 상태 |
| owner mock localStorage | PM_MOCK_SETS_V1, PM_MOCK_LAST_V1, PM_MOCK_MIGRATED_V1, PM_MOCK_SORT_V1의 `:<owner>` 값 |
| IndexedDB | PM_INTAKE_V1 owners의 해당 root 전체: version/generation/revision/deleted/fence/sources/jobs/adoptions/links/outbox와 compositionHistory/compositionRedo 및 모든 Blob |
| 미저장 상태 | debounce 중 초안, in-memory undo/redo/deletedIds를 안정 저장하거나 불가하면 이관 시작 차단 |
| 별도 선택 | PM_THEME, PM_META_OPEN, PM_PREVIEW_W, PM_PRINT_TUNE_V1 등 기기 설정 |

owner 없는 MOCK_DRAFT_V1·PEDAGOGY_DOCUMENT_BETA는 자동 귀속하지 않는다.
PM_LAST_SET의 sessionStorage 편의 상태는 필수 자료와 구분한다. Firebase Auth·App Check
토큰/SDK DB·동의 기록·PM_INTAKE_WRITER_V1·tab ID·runtime epoch는 복사하지 않는다.
서로 다른 Firebase project의 같은 UID도 같은 사용자로 간주하지 않는다.

## 제안하는 export 계약

1. 모든 producer(라이브러리·원문/구성·mock·document·SW)에 공통 이관 fence를 적용한다.
   debounce 완료와 동시 탭/계정/epoch 확인이 먼저다. 현재 Web Locks는 같은 origin만
   조정하므로 구 origin·다른 기기·구형 탭의 쓰기를 막는 증거로 사용할 수 없다.
2. owner root를 한 readonly transaction으로 읽는다. localStorage는 키 유무와 원문
   문자열을 보존하고 read 전후 revision/내용이 바뀌면 실패시킨다. 관계 그래프와 Blob
   바이트·길이·SHA-256을 manifest에 기록한다. missing/deleted/fence도 의미를 보존한다.
3. archiveID/schema/source origin/Firebase project/owner/revision을 명시한다. 내보낸 파일을
   다시 읽어 모든 hash·ID·ref·작업/채택 관계·삭제 상태를 대조한 뒤에만 성공을 표시한다.
   archive에 담긴 owner ID 자체를 로그인 권한으로 신뢰하지 않는다.

## 제안하는 import·복구 계약

- 초기안은 **비어 있는 destination owner만** 허용한다. 자동 로그인/merge/upload보다
  앞선 격리 부팅에서 archive 전체를 검증한다. 기존 ID/자료 충돌은 중단하고 덮어쓰지 않는다.
- 별도 staging과 영속 journal을 둔다. localStorage/IndexedDB는 원자적으로 묶을 수 없으므로
  prepared → local-written → idb-written → verified → active 단계를 재시작 가능하게 만든다.
  재실행은 archiveID/hash로 멱등 처리하고 각 단계 quota/kill/부분 쓰기를 검증한다.
  롤백도 자신이 쓴 값이 그대로인 경우에만 되돌려 나중 편집을 지우지 않는다.
- UID+project·guest/owner없는 초안의 귀속을 검증하고 destination의 더 최신 삭제 fence를
  우선한다. writer token/epoch/tab ID/Web Locks 상태는 새로 발급한다. SW/outbox는 원래
  attempt 복구만 허용하고 migration fence를 넘는 늦은 쓰기·새 유료 호출은 차단한다.
- 가져온 sync metadata는 과거 관측 증거다. cloudSynced/setWriteBase/ACK를 그대로
  채우지 않는다. 서버의 확정 snapshot 본문·순서·revision을 다시 대조하고 offline/cache/
  pending 상태를 구별한다. 서버 부재 기존 ID를 신규 revision1로 되살리지 않는다.
- old origin export 후 읽기 전용 유지·destination 활성화 직전 재검증이 필요하다.
  강제 구형 클라이언트 차단은 server fence/Rules의 별도 호환 전환 검토가 필요하다.

## 구현·검증 게이트

medium 범위는 저장 inventory, archive schema, 합성 pure validator와 손상 RED, 상태
보고/두 origin 테스트 틀까지다. 실제 owners.put·활성 키 복사·동기화 활성화는 high 범위다.
검토자가 독립적으로 확인할 최소 실패 주입은 다음과 같다.

- Blob 누락/손상, 잘못된 ref/ID, snapshot 중 경쟁 쓰기·owner/epoch 전환.
- journal 각 쓰기의 quota/kill, 재실행 멱등성·기존 ID 충돌·롤백 뒤 편집 보존.
- 삭제 fence·늦은 SW generation, 고정 adoption 결과 재진입·history/redo 복구.
- 서버 revision/tombstone/부재/offline, 구·신 origin 경쟁, mock 자동 업로드 차단.

인간 결정이 남은 항목은 최종 운영 origin, 구 origin의 읽기 전용/지원 종료 시점,
guest·owner 없는 초안 귀속이다. 현재 사용자 부재 중에는 미결로 유지한다. 무료 guest
미리보기는 이관 대상이 아니며 실제 자료를 옮기지 않는다. 도메인 구매 보류도 유지한다.

관련: [통합 레일](DEV-TOKEN-ROADMAP.md), [저장 계약](STORAGE-CONTRACT.md),
[HANDOFF200](../reviews/handoffs/2026-10/2026-10-23-tests-r8-pdf-source.md).

독립 Codex Astra high가 2026-10-23 현재 API·삭제 fence·mock 저장 코드와 대조해
차단할 설계 결함/구현 승인 과장 없음으로 판정했다. 실제 구현 승인이 아니다.
**실계정 export/import 증거 전에는 Pages 안내·중지/private 전환을 진행하지 않는다.**
