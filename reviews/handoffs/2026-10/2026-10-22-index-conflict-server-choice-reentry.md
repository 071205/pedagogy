# 변경 인계 — REV-138 서버본 선택의 재진입 충돌 수정

- ID: `HANDOFF-2026-196`
- 날짜: `2026-10-22`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-138` · `REV-2026-139` (`in-progress`, 독립 검토 후 운영 확인 대기)
- 작업 사본: `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`
- 구현 브랜치: `codex/rev138-conflict-reentry` → PR #24의 `codex/rev108-operational-checks`에 fast-forward 통합
- PR: #24 (draft, 기존 출력 수정과 이번 저장 수정의 검토 범위를 구분; 미검토 PR 위에 새 PR을 쌓지 않음)

## 변경 내용

운영에서 **계정 저장본 쓰기** 후 보류 0을 확인했지만 새로고침하자 세 권이 다시 보류되고 사본이 중복 생성됐다. [REV-138](../../issues/2026-10/2026-10-22-index-conflict-server-choice-reentry.md)에 실제 재현과 원인을 기록했다.
`chooseServerVersion()`이 지원 문서의 로컬 index/서버 order 불일치 때 확인한 서버 snapshot에 명시 CAS로 순서를 맞춘 뒤 ACK를 영속화한다. 서버 본문·폴더·스타일은 재정규화하지 않고 보존한다. 순서·updatedAt·revision과 필요 시 schema 표식만 바뀐다. ACK를 기다리는 동안 listener가 대상 index를 바꾸면 옛 위치를 덮지 않고 다시 확인하도록 멈춘다. 지원되지 않는 intake는 순서 쓰기 없이 읽기 전용으로 채택한다. Rules는 바꾸지 않았다.

## 위험과 검토 요청

1. 서버본 채택이 순서 불일치 때 해당 권에 +1 revision 쓰기를 수반한다. 확인한 서버본과 tx.get()이 다르면 선택 성공으로 처리하지 않고 보류/초안을 보존하는지 검토한다.
2. 로컬 index와 실제 ACK order를 맞춰 재진입에서 no-base가 재발하지 않는지, 다른 보류 권·기존 사본·본문을 건드리지 않는지 확인한다.
3. 미지원 intake/미래 schema 읽기 전용과 계정 전환·로컬 저장 실패 경계는 기존 계약을 유지해야 한다. 이 수정의 운영 효과는 아직 미검증이다.

## 검증

- `npm run test:set-revision`: 정상 **40/40**, B3 전 `4ea6fa7` 기준 RED, `SET_REVISION_CHOICE_RED=1`의 순서 CAS 제거 표적 RED 완료. 새 검사 5건은 재진입/사본 보존, 원격 변경, transaction 실패, ACK 대기 중 목록 변경, 미지원 intake를 다룬다.
- `SET_REVISION_CHOICE_RED=1 SET_REVISION_CHOICE_SKIP_MUTATION=1 node scripts/check-set-revision-cas.mjs`: **exit 1**, 표적이 녹색이면 RED 검사가 실패함을 확인했다. 표적 RED는 40건 모두 실행 및 정확한 재진입 검사 실패를 요구한다.
- `npm run test:set-sync-meta`: 정상 **9/9** 및 기존 기준 RED 완료. `node scripts/check-set-schema.mjs`: **14/14**. 기존 Rules 에뮬레이터 증거 재사용(Rules 무변경).
- `npm run test:audit-browser`: serve.py 기반 기존 **175/175**, 잘못된 JSON 12종 거절, 인쇄 PDF 정상/RED 완료. `npm run test:public`: CSP 실패 주입 **12/12** 거절·공개 빌드 통과. 최종 코드/문서의 `npm run check:static`(review-hygiene 포함, 이슈 126/열림 5·INDEX 116/120)과 `git diff --check` 통과.
- 전체 check:fast 로컬 일괄 실행과 새 head 원격 CI는 별도다. PR #24의 이전 head `37b1500`은 verify·cross-platform·hwpx·Sonar 성공이다. CodeRabbit 성공 표시는 draft 검토 생략 안내이므로 독립 검토 승인으로 세지 않는다.
- 제안 수정안의 후속 검증에서 ACK 대기 중 앞 권 삭제를 주입하자 이전 index로 사본을 덮는 경계가 재현됐다(exit 1, `rev138-listener-race-red.log`). 대상 index를 재확인하는 방어와 다섯째 회귀를 추가했다. 이 경계는 운영에 미배포된 제안 코드에서만 재현했으며 운영 결함으로 확대하지 않는다.
- 로그: `/private/tmp/rev137-fix-2026-10-22/rev138-*`. 최초 재현 로그와 하네스 ACK 전제 보정은 이슈에 구분했다.

## 운영 자료와 이전 기록 정정

[HANDOFF-195](2026-10-22-index-print-ui-followup.md)의 체크포인트 후 사용자가 계속 진행을 요청했다. 남은 세 권에도 서버본을 선택해 3→2→1→0을 확인한 다음 새로고침에서 **3건 재발/26권/사본 8개**를 확인했다. 최초 두 권은 현재 보류되지 않는다. 새 사본 세 개는 **계정 ACK가 아니라 이 기기에만 보존됨** 상태다. 원래 다섯 JSON 백업(문항 수 38/40/70/57/72)과 원래 계정 사본은 유지했다. 사본/원본을 삭제하지 않았다.
195의 종료 당시 '확인창 닫힘' 서술은 도구 상태 지연에 따른 잘못된 관측이었다. `browser-checkpoint.png`는 비교창이 열린 화면이다. 최신 증거는 `rev138-operational-holds.png`(라이브러리, 보류 3권)다. 기존 운영 코드에서 같은 선택/재진입을 반복하지 않는다.

## 독립 검토와 다음 행동 (아래 대체 승인 전 기록)

- 레일의 저장 안전성 수정 배정은 Codex Sol high → Claude Opus 독립 검토다. 195의 foreground Claude 호출은 주간 한도로 exit 1, 최종 답변 없음(표시 재개 Oct 25 20:00 Asia/Seoul). 새 코드 승인으로 세지 않았으며 한도 상태가 바뀌지 않아 재호출하지 않았다. REV-137도 독립 검토 대기다.
- **합의:** 로컬 재현/정상·RED로 원인과 수정 효과 확인. **미합의:** 독립 Claude 최종 판정 없음. **근거:** 검증 로그·40건 재현 검사. **다음 행동:** PR #24 최신 head CI 확인 → 두 범위를 구분한 Opus 검토 → 필요한 수정/검증 → 승인 범위에 따른 Pages 적용 → 테스트 권부터 재진입 확인 → 원래 세 권을 백업/사본 보존하면서 한 번씩 정리하고 새로고침 유지/ACK 확인.
- 프롬프트는 `index.html`의 `chooseServerVersion`/`writeSetDocRevision`/기준 복원 경로, `scripts/check-set-revision-cas.mjs`, `docs/STORAGE-CONTRACT.md`의 §2만 범위로 삼고 질문은 1~2개. `claude auth status` 후 `scripts/ask-claude-readonly.mjs --model opus --effort high` foreground만 사용한다.
- 독립 검토 전 병합/Pages 배포하지 않는다. PR #24는 draft 유지, U2는 아직 시작하지 않았다. `transcript.txt`는 접근하지 않는다.

## 검토 기록

- `2026-10-22 · Codex`: 구현·로컬 재현/정상·RED 검증. 독립 검토·운영 반영 전이므로 해결 완료로 기록하지 않음.

## 사용자 승인에 따른 독립 검토 대체 및 REV-139 (2026-10-22)

사용자가 **“검토 에이전트로 하고 다음거 ㄱㄱ”**라고 직접 지시해 이번 Claude 대기 게이트를 구현에 참여하지 않은 독립 Codex 에이전트 검토로 대체했다. 이어 U2 구현도 Codex로 진행하도록 직접 선택했다. 이를 Claude 승인이나 Claude 한도 해제로 기록하지 않는다.

독립 검토가 **REV-139**를 실제 브라우저에서 발견했다. 서버본 선택의 일반 `writeLocalNow()`가 서버에서 이미 reviewed인 상태를 로컬 초안과 비교해 unreviewed로 바꾼 뒤 변형 객체에 ACK를 세웠다. 부모도 같은 순서/순서 불일치 두 재현의 RED를 확인했다. 선택한 정확한 서버 객체만 `writeLocalNow({serverVersion:incoming})`로 검토 상태를 유지하고, 다른 편집 권은 기존 검토 무효화를 유지한다. 영구 회귀는 **42건**, REV-139 표적 방어 제거/변이 생략 제어도 추가했다. 과거 40건은 REV-138 단독 시점의 증거다.

독립 에이전트는 수정 소스에서 다시 실행해 서버/로컬 reviewed 상태·실제 setJSON·ACK/영속 기준 일치를 확인했다. 별도 로컬 저장 실패 후 재선택, 계정 전환, tx 직전 미래 schema 전환은 보존/차단 정상이다. REV-137 인쇄·키보드·PDF/RED와 REV-138 CAS/목록 변경 방어에 추가 결함 미발견. **합의: 재현 결함 수정/독립 재확인 완료. 미합의: 남은 설계 이견 없음. 다음: 새 head CI → PR #24 병합/Pages → 운영 보류/재진입·출력 확인 → U2.**

검토 index SHA-256 `bd050268d7807339e17578a4e23dbc52dca76b2489d4c9d254b5a8f8f9d1b377`. 근거 `/private/tmp/rev138-agent-review-2026-10-22/{probes,after-fix-probes,rev139-parent-red,rev139-parent-green-red,rev139-target-red,rev139-mutation-control}.log`. 검토자는 제품 수정/커밋/배포를 하지 않았다. 원래 `dccf29d` CI는 verify/check:fast·Rules·cross-platform·hwpx·Sonar 성공이며 REV-139 새 head는 다시 확인한다.

- `2026-10-22 · 독립 Codex 에이전트`: 사용자 대체 승인에 따라 REV-137/138 검토, REV-139 발견·수정 후 재검증. 위 index 해시에 추가 재현 결함 없음. 실제 운영 확인은 구현자가 수행한다.

- 최종 추가 검증: 저장 42/42·기준/REV-138·REV-139 표적 RED 통과, REV-139 변이 생략 제어 exit 1, 기존 브라우저 175/175·JSON 12종 거절·인쇄 정상/RED·공개/CSP 12실패 주입·B6 `test:intake-review` 정상/RED·static·review-hygiene·diff 통과.
