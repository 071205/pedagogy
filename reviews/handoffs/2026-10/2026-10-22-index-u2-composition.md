# 변경 인계 — U2 구성 초안 저장 엔진과 화면 진행 상태

- ID: `HANDOFF-2026-197`
- 날짜: `2026-10-22`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `index`, `tests`, `docs`
- 관련 이슈: 없음(기존 REV-137/138/139 운영 확인은 HANDOFF-196)

## 현재 상태 — U2 구현·독립 검토 완료, PR #25 최종 CI 진행

- 실제 worktree `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, 브랜치 `codex/u2-composition`. 기본 저장소는 전환하지 않았다. `transcript.txt` 접근 금지.
- [PR #25](https://github.com/071205/pedagogy/pull/25) draft, main/Pages **아직 U2 미배포**. 저장 엔진 체크포인트 bda078e/4b12b0c, UI117c77b 및 후속 검사/설정 보완.
- UI: 선택/새 문제집 메뉴·남은작업·3영역·수동본문/분류·묶음이동/제외·실제Undo/Redo·목적지/순서 diff/권수확인·고정 만들기/실패재시도·D4 결과/설정 켜기·끄기 구현. 상세는 U2-COMPOSITION.md. 유료 일괄 추출 비활성화, C1~C3/D3 게이트 유지.
- 독립 Codex 저장/화면 검토 완료. 초안에서 REV-140~144를 재현·수정·독립 재확인했다. UI15건 정상(저장실패/고정ID재시도·D4·owner재오픈/늦은뷰어해제·순서diff 포함). UI9종 RED(권수/미저장/원문해제/owner/선택/배점/D4/순서/영속표시) 검출. order 변이 생략 제어는 의도한 exit1로 거짓 RED 성공을 거절했다. 저장20건+RED7 통과. 375/768/1194 가로넘침검사와375/1194캡처 육안확인.
- 로컬 check:fast는 test:set-revision까지 모두 통과 후 HWPX 기본Python lxml 부재(skip는 통과아님)·한글 root URL의 cross-platform ENOENT로 중단했다. 번들Python/HWPX_REQUIRE=1로 HWPX12건/시험지/브라우저대조·자기검사 통과. cross-platform URL을 fileURLToPath로고쳐 실제 Chromium4크기/실패주입 통과(REV-145, 독립 확인). 이후 기존 브라우저175/잘못된JSON12·인쇄정상/RED·static·review-contracts 통과. library UI의 기존 U2 disabled/2길기대는 새3길/키보드와D4에맞게 갱신해 통과. 남은 sheet/source/mock-ui도 전체 exit0으로 완료했다. 자기검사가 일부러 출력하는 FAIL을 정상 실패와 구분했다. 로그 `/private/tmp/u2-check-fast-final.log`, `u2-remaining-gates.log`, `u2-library-contract-final.log`.
- PR25 첫 CI verify는 **새 검사 logDir의 /private 경로가 Linux에서 EACCES**라 실패했다. node:os tmpdir()+path.join으로 수정. 첫 head Sonar/hwpx 성공, 새 head 최종CI는 별도 확인한다. 제품runtime실패와구분한다.
- PR #24는 사용자 직접 승인 후 `20881c2` 병합·Pages built·병합 CI 성공/공개 index SHA `d61e3c10…` 일치. 실제 로그인 Chrome에서 보류3→0 후 새로고침해도26권/사본8·문항70/57/72유지. 실제2쪽PDF 링크없음·[01~03]/독립4번유지. REV-137/138/139 resolved, 모든사본/원본JSON보존(HANDOFF-196).
- 다음: 최종 PR25 CI/새댓글 확인 → 실패만 재현수정 → 검토소스와같은head로 PR25병합/Pages → 운영 테스트용 권으로 U2구성/저장/재진입·원본불변 확인 → 레일 R5 연결게이트. 사용자가 이번작업 구현/검토/검증/병합/배포를 계속하도록 직접승인했다. 실제유료AI/실제Safari-iPad/D1수정연동은 별도게이트이며 완료로 확대하지 않는다.

## 변경 내용

사용자 승인으로 U2도 Codex가 구현한다. 먼저 B6 저장소 안에 기존 권 스냅샷·버전 검사·실제 Undo·묶음 유지·기존 원문 grant만 계승하는 구성 API를 추가했고 독립 Codex 검토를 마쳤다. 세부 계약은 [U2-COMPOSITION](../../../docs/U2-COMPOSITION.md). UI는 아직 구현 전이다. 유료 AI 운영 활성화와 Rules 변경은 없다.

## 위험과 검토 요청

부분 채택 후 고정 매핑/다음 provider 시작 차단/이미 시작한 응답 보존/미채택 묶음 fork, owner 전환·실패 재진입을 확인했다. 화면의 명시 적용·오래된 제안·권수 차이 확인과 모바일은 다음 구현/검토 범위다.

## 검증

- `node scripts/check-composition.mjs`: 정상 19/19(`/private/tmp/u2-composition-normal-19.log`).
- `COMPOSITION_RED=stale|groups|frozen|undo|paid|views|fork node scripts/check-composition.mjs`: 각 표적 방어 제거 검출. 앞 네 가지는 이전 14건 이하에서, paid/views/fork는 최종 19건에서 확인했다. 이후 최종 19건 전체 RED 재실행과 변이 생략 제어도 통과했다(위 중단 시점).
- `npm run test:intake`: 이전 엔진에서 통과(`/private/tmp/u2-b6-regression.log`). 마지막 provider/fork 보완 후 재실행도 exit 0(`/private/tmp/u2-b6-final.log`).
- 독립 재현: `/private/tmp/u2-independent-review/{final-probes,concurrent-after,inflight}.log`. 임시 로그 소실 시 위 코드 검사로 재현한다.

## 다음 검토자에게

실제 worktree `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, 브랜치 `codex/u2-composition`. PR #24 head `cb1d26a` CI 모두 통과, CodeRabbit 자동 리뷰는 skipped(승인 아님). main 병합 시도는 자동 승인 심사가 기존 사용자 승인에 main/Pages가 명확하지 않다는 이유로 차단했다. 이후 사용자가 main/Pages를 직접 승인해 병합·Pages built·공개 바이트 일치를 확인했다(위 중단 시점). transcript.txt는 접근 금지.

다음은 저장 정상/RED/생략 제어·B6 회귀 → U2 화면 구현/독립 검토 → U2 PR이다. PR #24 운영 승인 시 HANDOFF-196의 테스트 권·보류 3권·모든 사본/백업 보존 조건으로 운영 확인한다. PR24 배포 파일 해시는 현재 U2 작업 파일이 아닌 `git show cb1d26a:index.html`과 비교한다.

## 검토 기록

- 2026-10-22 · 구현하지 않은 독립 Codex(`/root/independent_review`) · 새 draft ID의 groupOf·source grant·고정 결과 매핑·부분 채택 뒤 provider 직전 차단·진행 중 응답 보존·미채택 원자 묶음 fork를 실제 브라우저에서 재현. 보완 후 추가 결함 없음. UI/모바일/운영 AI 제외. 검토 SHA-256: composition `c271da74e538854feb9463b172f612a8878d33719745ee79200aee83b9c4d6dd`, intake `c5fbdba855556eb5e441592b593e0b2ec6ae537cc5907f6c1a0f9fdea6fd2c81`.

- 2026-10-22 후속: 정상 19/19·7종 RED와 paid 변이 생략 제어(의도한 exit 1)를 최종 코드에서 확인했다(`/private/tmp/u2-composition-final.log`, `u2-composition-skip-control.log`). B6 기존 회귀의 partial adopt 후 paid retry 허용은 U2에서 의도적으로 제한하는 계약 변경이다. 독립 검토로 U0의 고정 구성/미채택 새 구성 계약과 일치함을 확인하고 B6 설계에 명시했다. 실패 쪽 명시 retry/성공 쪽 잠금은 채택 전 별도 검사로 보존하고, 부분 채택 뒤 실행/명시 재시도는 calls 불변 거절을 검사한다.
- 사용자 PR #24 main/Pages 직접 승인 도착 후 `20881c2`로 병합 완료. Pages 배포/운영 확인은 진행 중이며 아직 REV-137/138/139 해결로 닫지 않았다.

## U2 화면 구현·검토 진행 (재개 후 최신 상태)

PR #24 운영 확인을 마치고 REV-137/138/139 해결(HANDOFF-196). U2의 실제 구성 화면을 외부 모듈/스타일로 구현했다. 라이브러리 선택/새 문제집 메뉴→기존 권·남은 B6 작업→목적지/문항/본문·원문→이동/제외/편집/실제Undo→문항별 구성 변경 확인/권수 차이 승인→고정 만들기/권별 결과/미채택 새 구성/D4 선호까지 연결한다. 유료 일괄 추출은 비활성화다. 새 권 과목은 단일 원본 과목 유지/혼합은 제한 없음, 머리말·선색은 새권 기본값(계약에 명시).

독립 UI 검토가 미배포 초안에서 REV-140~144를 재현했고 같은 이슈 파일에 원인·수정·영구 재현 검사를 기록했다. 정상 UI11건 통과(`/private/tmp/u2-ui-boundaries.log`), 375/768/1194 캡처 `/private/tmp/u2-ui/`. 저장20건+RED7도 통과(과목 보존 포함). UI RED는 6종으로 확장해 현재 최종 실행 중이다. 전체 check:fast 첫 실행은 추출 onAuth VM에 새 compositionUI 대역이 없어서 실패해 대역/계정 동일·전환 assertions를 추가했다. 실제 onAuth도 같은 owner 반복 알림에서는 구성 미저장 내용을 닫지 않고 owner 전환에서만 닫는다. audit VM 11/11와 공개/CSP 정상 통과. 최종 독립 판정과 전체 게이트는 아직 진행 중이다.

- 2026-10-22 · 구현하지 않은 독립 Codex · UI 최종 재검증: 자유 난이도/ai 출처/분류 reviewed 보존, 음수 배점 거절/기존 값 유지, 국어 결과/원본 불변, owner 즉시 재오픈 opens2/fields3, 늦은 뷰어 close1, 목적지/선택/상세 일치 확인. 초안의 REV-140~144 수정 후 추가 재현 결함 없음. `/private/tmp/u2-ui-independent-review/{final-probes,selection-final}.log`. UI SHA `9d3ca25c65919421ed638c2469c8101c33fffb49bd09c2d41fce370aa74578c1`, CSS `44df3359b3933a1e456ebe6a6eb24ba7f1d73ed14488e9b13e832749814d5af0`, planner `3f289b5b0d2e513758adf0251b737c4e74a5753376d7c636891ec7cd5270d26f`, intake `5e2f30ecaebab9158453e41530359cfa8c9c9b1d604abb57e321bea93b2cff78`. 실제 유료 AI/운영 배포/모바일 육안은 독립 검토 범위 제외. 부모는 375/768/1194 가로 넘침 검사와 375/1194 캡처 육안 확인.

- 2026-10-22 · 독립 Codex 후속 · D4 설정의 owner별함수/저장실패되돌림, 미사용notify제거, Linux tmpdir, 새3길의 라이브러리/키보드기대를 독립확인했고 추가결함없음. runtime UI모듈/engine/planner/CSS 해시는 위 검토본과동일. 이어 목적지 이름뿐 아니라 권안순서도 diff에표시하는 작은보완은 새검사로 확인한다.

## 마지막 좁은 보완 — 원문 보관 사용자 계약

R5 준비표에서 H193 별도 브랜치의 관리 미구현 설명과 현재 H184 관리 구현을 구분했다. 현재 main에는 원문 목록/용량/삭제가 이미 있다. 다만 U0 §5-2가 요구한 영속 저장 활성/미활성/미지원/확인실패 표시와 백업 보장 아님 안내가 누락된 기존 결함(REV-146)을 재현해 보완했다. 저장/삭제 API·Rules는 변경하지 않았다. 실제 DOM15건 정상·영속표시 RED 통과(`/private/tmp/u2-ui-15.log`, `u2-persistence-red.log`).

- 2026-10-22 · 독립 Codex · 순서 diff의 목적지+번호 비교에 추가결함없음. UI 최종 SHA `7d7ab264ff24dd3baad0da91f3aae2ccd659036ab2f22fc672de532f281a55ef`. REV146의 두 실제함수를 독립 VM으로 4상태/빈목록/owner 전환 중 조회 차단 확인, CSP3개 일치·추가결함없음. index SHA `3fc1f2cc4d95333e369b8cb19f0fa0c7ec3b3ad830b040ca831bcdae12e4eaad`.

공개233파일 build/check/실제공개브라우저 및 세편집기 CSP/RED는 전 단계에서 통과했다(`/private/tmp/u2-public-browser-final.log`). 마지막 index의 영속표시는 CSP재해시와 U2 DOM/독립검사로 좁게 확인했다. 마지막 head의 원격 CI 완료와 운영 U2 확인 전에는 U2 완료/실제AI 운영 완료로 바꾸지 않는다. 사용량 단계 경계 확인에서 5시간 잔여약21%·주간39%였고 범위를 U2최종검증/배포로고정했다.
