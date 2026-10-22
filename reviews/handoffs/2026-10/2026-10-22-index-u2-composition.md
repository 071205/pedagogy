# 변경 인계 — U2 구성 초안 저장 엔진과 화면 진행 상태

- ID: `HANDOFF-2026-197`
- 날짜: `2026-10-22`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `index`, `tests`, `docs`
- 관련 이슈: 없음(기존 REV-137/138/139 운영 확인은 HANDOFF-196)

## 중단 시점 — 사용자 요청으로 일시 중단

- 실제 worktree: `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, 브랜치 `codex/u2-composition`. 기본 저장소는 전환하지 않았다.
- U2 저장 엔진 체크포인트 `bda078e` + 본 기록/검사 정리 커밋. **UI는 아직 만들지 않았다. U2 PR·배포 없음.**
- `npm run test:composition` 최종 정상 19/19 + RED 7종 통과, paid 변이 생략은 의도한 exit 1. `npm run test:intake` 최종 exit 0(B6 28건·기존 정상/RED·B7 SW 실제 브라우저). `check:review-hygiene`, `check:sonar`, `git diff --check` 통과.
- PR #24는 사용자 직접 승인 뒤 `20881c2c8c62b9eabab0db49e407f2265972ee26`로 main 병합, Pages **built**. 공개 index와 검토 원본 `cb1d26a:index.html`의 SHA-256은 모두 `d61e3c101c7b8a745539d9c18dcee3eaf7342d2f0f401ec589691cbac4908f6a`로 정확히 일치했다. Python urllib 로컬 인증서 오류 후 정상 TLS curl로 확인했다. `/private/tmp/pr24-public-verification.json`.
- **미완료:** PR #24 운영 로그인 탭의 테스트 권/보류 3권 재선택·재진입·ACK·PDF 확인. REV-137/138/139는 운영 확인 전까지 in-progress 유지. 모든 26권·사본 8개와 내보낸 원본 백업을 보존한다. 병합 커밋 CI 완료는 아직 조회하지 않았다(PR head CI는 전부 성공).
- **재개 순서:** HANDOFF-196의 보존 조건대로 운영 확인 → U2 저장 API를 사용하는 목적지/문항/상세 UI → 실제 Undo·제안 diff/명시 적용·오래된 제안·부분 실패/재진입·375/768/1194 화면·독립 Codex 검토 → 공개/CSP/브라우저 회귀와 U2 PR. 운영 유료 AI는 C1~C3/D3 조건 전 활성화하지 않는다.
- UI 연결 예정 위치: index `renderSelectBar`·`startNewSet`·`NEW_SET_PATHS`의 batch placeholder. `createIntakeStorageClient`, `intakeResultRoute`, `PedagogyRender.blockHTML`, 기존 `openSourceView`를 재사용한다. 새 외부 모듈은 build-public·serve.py allowlist·Sonar scope에 함께 등록해야 한다.
- `test:composition`은 package에 추가했으나 `check:fast` 연결은 아직 하지 않았다. 제품 수정 시 Sonar의 함수 복잡도(`patchDraftProblem`, `propose`)도 확인한다. 전체 check:fast/최종 기존 브라우저 회귀는 U2 UI 최종 코드에서 필요하다.

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
