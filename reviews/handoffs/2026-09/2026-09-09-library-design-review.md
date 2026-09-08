# 변경 인계 — 라이브러리 설계 독립 검토

- ID: `HANDOFF-2026-070`
- 날짜: `2026-09-09`
- 작성자: `Codex`
- 상태: `changes-requested`
- 검토 대상: `docs/LIBRARY-DESIGN.md`, `HANDOFF-2026-065`
- 제품 코드 변경: 없음

## 결론

방향은 승인한다: 작은 화면의 폴더 칩, UI/인쇄물 번역 경계, 결제를 표시 전용으로
제한한 점, 한 번에 660곳을 번역하지 않는 단계적 이관은 맞다. 다만 아래 **세 계약을
확정하기 전에는 구현을 시작하지 않는다.** 현재 `index.html`의 set 문서 동기화·tombstone
모델과 충돌하거나 규칙 미배포 중 저장 실패를 낼 수 있다.

## 구현 전 필수 변경

### 1. 폴더 삭제도 tombstone이 필요하다

문제집의 `folderId`만 비우고 폴더 목록에서 폴더를 지우면, 다른 기기가 가진 예전
`folderId`가 그 문제집의 다음 저장 때 다시 올라온다. “알 수 없는 폴더를 보존”하는
설계는 데이터 손실 방지에는 맞지만, 삭제한 폴더가 다시 나타나는 결과가 된다.

`users/{uid}/prefs/library`를 채택하되 폴더를 배열에서 제거하는 대신
`folderTombstones: { folderId: deletedAt }` 또는 동등한 단조 증가 삭제 기록을 둔다.
모든 기기는 유효하지 않은 folderId를 화면에서는 `폴더 없음`으로 보이게 하되 원본을
즉시 지우지 않는다. 다음 문제집 저장/병합 시 tombstone보다 오래된 소속만 비운다.
폴더 삭제는 (a) 해당 소속의 모든 set을 400개 이하 배치로 풀고, (b) folder tombstone을
기록하며, (c) 중간 실패에는 진행·재시도 상태를 보이는 작업이어야 한다. 빈 폴더는
그와 별개로 유지한다.

### 2. A(로컬)와 B(클라우드)는 데이터 저장소부터 분리한다

현재 `setJSON()`/`setToDoc()`/`docToSet()`/`mergeSets()`/`watchCloud()`은 `name`,
`header`, `problems`, `lineColor`, `subject`, `order`만 일관되게 처리한다. folderId를
`normSet`과 규칙에만 넣으면 로컬 변경이 dirty로 감지되지 않아 동기화되지 않거나, 반대로
규칙이 아직 배포되지 않은 환경에서 전체 batch가 권한 오류가 된다.

규칙 배포 전 A 단계에서는 **set 객체에 folderId를 넣지 말고** 계정별
`PM_LIBRARY_META:{uid}`의 `{folderBySetId,lastOpenedBySet,...}`에만 둔다. B 단계는
명시적 schema/capability flag가 켜진 새 배포에서만 시작한다. 그때 한 번의 이관 작업이
local map을 `folderId`로 올리고, 이후 `setJSON`, `setToDoc`, `docToSet`, merge 및
onSnapshot 비교를 같은 릴리스에서 함께 바꾼다. capability가 없는 배포에서 새 필드를
보내는 "시도 후 실패"를 기능 감지로 쓰면 기존 문제집 저장까지 실패한다.

폴더 목록은 기존 `users/{uid}` 문서가 아니라 새 `users/{uid}/prefs/library` 문서가 맞다.
그 부모 문서는 구형 sets 안전망·migratedAt 전용이며 현재 Rules도 다른 필드를 거부한다.
Rules에는 정확히 `/users/{uid}/prefs/library`만 owner read/write 허용하고, id 고정,
folders/tombstones 최대 개수·문자열 길이·timestamp 타입을 제한한다. sets의 hasOnly와
새 `folderId` 타입·길이도 같은 커밋에서 바꾼다. Rules 배포는 코드 배포와 분리된 미완료
작업이므로, B는 배포 확인 전 사용자에게 노출하지 않는다.

### 3. 선택 삭제의 ⌘Z는 원격 명령과 순서를 보장해야 한다

`historyStep()`은 동기 스냅샷만 묶는다. 현 삭제는 화면에서 set을 먼저 빼고 비동기로
tombstone을 쓴다. 사용자가 즉시 Undo하면 복원 저장과 늦은 tombstone이 경쟁해, 늦은
tombstone이 복원본을 다시 지울 수 있다. 현 구조에서 "여러 개도 ⌘Z 한 번"을 약속하면
데이터 보존 계약이 깨질 수 있다.

선택 삭제에는 별도 `libraryOperation` 세대/큐를 둔다. 권장 흐름은 local snapshot →
원격 tombstone batch 완료 → undo 가능 표시이며, Undo는 같은 큐에서 tombstone 뒤에
복원 set write를 보낸다. 삭제·복원 중에는 그 세트를 일반 save queue가 쓰지 않게 한다.
400개 이상은 chunk별 진행, 실패한 ID, 안전한 재시도를 기록한다. 이 계약이 구현되기
전에는 선택 삭제를 "되돌릴 수 있음"으로 표시하지 않는다.

## 나머지 설계 피드백

- 정렬: 직접 순서는 현재 `order`, 이름은 `Intl.Collator(activeUiLocale)`의 안정적
  tie-breaker(id), 최근 수정은 cloud `updatedAt`을 쓴다. 최근 사용은 비용·경쟁을 피하기
  위해 A 단계의 `lastOpenedBySet` 로컬 전용으로 유지하고 "이 기기"임을 표시한다.
- 선택: 선택 상태는 `setId` Set으로만 보관하고, 검색/정렬/폴더 필터가 바뀌어도 보존한다.
  카드 클릭·점 메뉴·키보드 Space/Enter·모두 선택·선택 수의 ARIA 상태를 함께 설계한다.
- 가져오기/복제: 외부 JSON folderId는 버리고, 복제는 원본의 folderId를 의도적으로
  유지할지 UI에서 명시한다. 기본은 현재 폴더에서 복제라면 유지, 전체 검색 결과에서는
  원본 폴더 유지가 자연스럽다. 어느 쪽이든 user content 이름에는 번역을 적용하지 않는다.
- 설정: 현 `PM_THEME`은 세 편집기가 공유하는 **기기 전역** 설정이다. 계정별 키로
  무심코 바꾸지 말고, 언어만 `PM_LANG:{uid}`로 새로 둔다. 로그아웃/guest와 로그인 계정의
  언어 선택 정책도 명시한다.
- 언어: `ui.*`/`sheet.*`만으로는 충분하지 않다. user-authored set 이름·지문·정답·JSON
  export와 AI 프롬프트는 절대 번역하지 않는다. aria-label/title/placeholder/confirm/toast,
  날짜·숫자 locale, index에서 연 iframe에 전파되는 `lang`/`dir`도 UI 계약에 포함한다.
  첫 릴리스는 ko/en, BCP-47 fallback과 unknown key의 한국어 fallback을 둔다. RTL은 별도
  지원 전까지 카탈로그에 노출하지 않는다. `t()`는 DOM textContent 기반이어야 하며
  번역문을 innerHTML로 넣지 않는다.
- 테스트: Rules emulator로 prefs owner/타 계정/잘못된 키를 확인하고, capability off 상태의
  기존 set 저장이 성공하는지를 별도 검사한다. 폴더 삭제→다른 기기의 오래된 저장,
  delete→즉시 undo→늦은 tombstone, 알 수 없는 folderId, 401개 선택 삭제의 중간 실패를
  실패 주입으로 검증한다. 언어는 html lang, 인쇄 텍스트 불변, 미번역 키 fallback,
  좁은 화면·44px을 각각 확인한다.

## 코드 대조 근거

- `firestore.rules`는 현재 sets 외 하위 문서를 기본 거부하며 sets의 hasOnly가 새 필드를
  거부한다.
- `index.html`의 `setJSON`, `setToDoc`, `docToSet`, `mergeSets`, `watchCloud`는 현재
  folderId를 다루지 않는다.
- `historyStep`은 동기 run만 감싸고, `deleteSetEverywhere`는 그 뒤 비동기로 tombstone을
  쓴다.
- `PM_THEME`은 index/document/mock 세 화면이 공유하며, 날짜는 ko-KR 고정 호출이 있다.

이 인계는 설계 검토일 뿐, 재현 가능한 구현 결함 이슈를 새로 등록하지 않았다.
