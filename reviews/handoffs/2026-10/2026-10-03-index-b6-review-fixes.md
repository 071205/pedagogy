# 변경 인계 — B6 읽기 격리·새로고침 뒤 원문 연결 승계

- ID: `HANDOFF-2026-174`
- 날짜: `2026-10-03`
- 작성자: `Codex`
- 상태: `changes-requested` — Claude 재검토 2026-10-03: 112·113 확인, 새 결함 REV-2026-114
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-112`, `REV-2026-113` (수정·재현 검사 완료)

## 변경 내용

기준 `eb7e69f`·브랜치 `codex/b6-intake-storage`. HANDOFF-173의 두 재현 결함만 수정했다.

- 112: 엄격한 `normIntake()`는 유지하되 읽기 경계의 `preserveIntake()`는 지원하지 않거나 손상된
  intake를 JSON 원문 그대로 보존한다. 라이브러리·구독·가져오기·백업·비교·복구 내보내기를 계속한다.
  해당 권에는 업데이트 필요/읽기 전용 표시를 붙이고 편집·복제·이름·폴더·일괄 삭제·cloud 쓰기를 막는다.
  cloud dirty 선정과 직접 CAS 쓰기 모두 차단한다. 정상 로컬 초안으로 미래 버전 서버본을 덮는 것도 막는다.
  명시적 계정 파기 tombstone은 허용한다. 원문 삭제 영향 계산은 읽을 수 없는 메타가 있으면 확인 필요다.
- 113: 기본 owner IDB의 연결 전용 클라이언트를 필요할 때 만들어, 살아 있는 UI fixture 없이도 기존
  원문 접근 권한을 승계한다. detached 권의 살아 있는 unlinked Blob도 active 연결로 되돌린다. 실제 복제와 충돌 사본 복구는 IDB 완료 후 사본을 게시한다.
  실패는 안내하고 사본 생성을 보류한다. 충돌 기록은 그대로여서 다음 부팅에서 재시도한다.
  비동기화한 호출부의 owner/epoch를 다시 확인하고 중복·tombstone을 재대조한다.
  외부 JSON의 sourceId만으로 Blob 접근을 허가하지 않는다.
- `scripts/check-intake-review-fixes.mjs`에 각 재현 절차를 넣고 `test:intake`/`check:fast`에 연결했다.
  수정 전 `eb7e69f` 파일을 로컬 브라우저에만 주입하는 112·113 빨간불 검사도 포함한다.

B6 운영 AI 차단·500문항/900KiB·B3/B4/B5·D1/D3 게이트를 유지했다. B7/U1.5/U2는 시작하지 않았다.

## 위험과 검토 요청

1. 불명 intake가 로컬/복구 JSON에는 남고 cloud에는 다시 쓰이지 않는지, 정상 권은 계속 읽고 저장되는지.
   정상 v1은 기존 sourceId/pages 비공개 필드 projection을 유지한다. 불명 schema의 복구 JSON은 opaque 원문이며
   v1 projection을 성공했다고 주장하지 않는다.
2. 새로고침·부팅 시 권한 승계, 연결 실패 보류/재시도, 원본권 삭제 후 사본 접근과 외부 JSON 차단.
3. 비동기 충돌 복구의 계정 전환·중복 생성·tombstone 경계. 기존 REV-108은 이번 범위 밖이다.

## 검증

외부 네트워크는 차단했고 Firestore·AI·계정은 fixture다. 실제 AI/요금/배포 호출은 없다.

- `npm run test:intake`: 기존 Worker/IDB 28개 수용, 실제 두 탭·image/PDF 렌더, metadata 제거 빨간불 통과.
- `node scripts/check-intake-review-fixes.mjs`: 재현/경계 14개 통과. 실제 3권 server ACK 읽기·구독·JSON 파일 입력·백업 복원,
  읽기 전용/cloud 차단·미래 서버본 덮어쓰기 차단·명시 계정 파기, 실제 카드 복제(새로고침 전후), 원본 삭제,
  클라이언트 없는 부팅 충돌 복구(detached/unlinked 보존본 포함), 외부 JSON 접근 차단, IDB 실패 보류와 새로고침 재시도.
- `npm run test:intake-review`: 정상 및 수정 전 파일 주입에서 112 첫 읽기와 113 새로고침 복제/부팅 충돌이
  실제 실패함을 확인. 전체 증거: `/tmp/b6-review-intake-complete.log` (최종 전체 실행), `/tmp/b6-review-fixes-final.log`.
- `npm run test:audit-browser`: serve.py의 regression-test.html **167/167**, malformed JSON 12개 거절.
- `npm run test:set-revision`: 정상 **35/35** 및 과거판 35개 실패 탐지.
- `npm run test:sets-cloud`: 정상 10개·과거판 7개 실패 탐지. `npm run test:worker` 통과.
- `npm run test:public`, `npm run check:static`, `git diff --check` 통과. 리뷰 hygiene: 열린 이슈 4개, INDEX 상한/최근 5개 일치.

실제 Safari/iPad 장기 보관·AI 품질/비용은 기존 미검증 상태를 유지한다.
`transcript.txt`는 접근/변경/추가하지 않았다. main 병합·push·배포 없음.

## 다음 검토자에게

**Claude Opus 5**, `eb7e69f` 이후 이 수정 diff와 두 이슈 처리 기록만 재검토한다.
전체 B6 판정은 HANDOFF-173에 이어 적는다. 재검토 합의 전 B6 완료/main 배포로 바꾸지 않는다.
그 뒤 사용자 배포 승인, B7은 **Codex GPT-6 Sol high** 순서다.

## 검토 기록

### 2026-10-03 — Claude Opus 5.5 재검토: **112·113 해소 확인 · 새 결함 1건(P2)**

범위: `eb7e69f..59a7503` 의 `pedagogy-normalize.js`·`pedagogy-intake.js`·`index.html` 과 두 이슈 처리 기록.
`npm run test:intake` 전체를 다시 돌렸다(exit 0, 수정 전 파일 주입 시 112 7건·113 3건 빨간불).

- **112 해소.** 내 원래 재현(서버 확정 snapshot 3권 중 한 권의 문항 하나에 `intake:{version:2}`)을 그대로 다시 돌렸다.
  수정 전 `["새 문제집"]`+거짓 안내 → 지금 `첫째·둘째·셋째`, 토스트 없음. `normIntake` 는 엄격하게 두고 읽기 경계만
  `preserveIntake` 로 원문 보존 — 채택·공급자 검증은 그대로 엄격하다. 그 권은 편집·복제·이름·폴더·삭제·cloud 쓰기가 막힌다.
- **113 해소.** 원래 재현(새로고침 → 실제 '복제' 단추, 클라이언트 0개)을 운영 기본 저장소 `PM_INTAKE_V1` 로 다시 돌렸다.
  사본 `forProblem` = `available`, 원본권을 지우고 `reconcile()` 해도 사본 `available`. 연결 저장이 끝난 뒤에만 사본을 게시하고,
  실패하면 복제를 하지 않는다고 말한다(조용히 버리던 `.catch(()=>{})` 제거). 외부 JSON 차단 검사도 유지됐다.
- **새 결함 [`REV-2026-114`](../../issues/2026-10/2026-10-03-index-b6-future-remote-blocks-other-saves.md) P2.**
  트랜잭션의 새 거절 `set-intake-update` 를 `writeCloudSnapshot()` 의 문서별 `catch` 가 몰라 `throw` 한다.
  서버 X 가 v2 이고 로컬 X·Y 가 dirty 면 X 는 안전하게 남지만 **Y 가 영영 안 올라가고** 매 판 "⚠ 저장 실패". 브라우저 stub 재현.
  지금 운영에 v2 를 쓰는 판이 없어 당장은 안 터지지만, 112 가 막으려던 '한 권이 다른 권을 멈춘다' 가 쓰기 쪽에 남은 것이다.
- 작은 메모: `preserveIntake(undefined)` 는 `JSON.parse(undefined)` 로 다시 던진다(JSON 에서는 안 생기는 값이라 결함으로 보지 않음).
  `"intake":null` 인 가져온 문제집은 읽기 전용이 된다 — 의도라면 안내 문구로 충분하다.

**판정**: 114 를 고치면 그 diff 만 다시 본다. 합의하면 PR #8 CI 확인 → 해리 승인 merge(= 운영 배포) → B7.
