# 변경 인계 — U2 구성 저장·화면·운영 확인

- ID: `HANDOFF-2026-197`
- 날짜: `2026-10-22`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index`, `tests`, `docs`
- 관련 이슈: `REV-2026-140`~`146` resolved(기존 REV-137/138/139 운영 확인은 HANDOFF-196)

## 현재 상태 — U2 독립 검토·CI·배포·로그인 운영 확인 완료, 다음 R5

- 실제 worktree `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, 브랜치 `codex/u2-composition`. 기본 저장소는 전환하지 않았다. `transcript.txt` 접근 금지.
- [PR #25](https://github.com/071205/pedagogy/pull/25)는 검토 head `580a7facd87c5aba9898763a86129f940e8b0e03`에서 병합했다. main merge `7c6386e10d9e01d323a8ef58af119c28d74b56ca`, Pages `built`. 공개 index/UI/planner/CSS/intake 5파일이 아래 검토 SHA와 같다(`/private/tmp/u2-public-deployed.json`). Rules/Worker 변경·배포 없음.
- PR head Verify [39757671461](https://github.com/071205/pedagogy/actions/runs/39757671461)의 verify/check:fast·cross-platform·hwpx 및 SonarCloud 모두 성공. 병합 Verify [39761068480](https://github.com/071205/pedagogy/actions/runs/39761068480)도 성공. CodeRabbit의 skipped review를 독립 승인으로 세지 않는다.
- 사용자가 Claude 주간 한도 대기를 독립 Codex 검토로 대체하고 U2 Codex 구현, 이번 작업의 구현·검토·검증·병합·배포를 직접 승인했다. 저장/화면을 구현하지 않은 독립 Codex가 검토했다. Claude 승인이 아니다. 초안 결함 REV-140~146은 같은 이슈 파일에 수정·검증을 기록해 resolved.
- 구현 계약: [U2-COMPOSITION](../../../docs/U2-COMPOSITION.md). 선택/새 문제집 메뉴·남은 작업·3영역·수동 본문/분류·묶음 이동/제외·실제 Undo/Redo·목적지+순서 diff/권수 확인·고정 만들기/실패 재시도·D4 결과/설정 켜기·끄기. B6의 owner/삭제 세대·원문 grant·부분 채택/고정 ID/미채택 fork를 계승한다. 실제 유료 일괄 추출은 비활성화이며 D3/C1~C3 게이트를 유지한다.

## 검증 — 재실행할 때의 기준

- `npm run test:composition`: 정상 **20/20**, stale/groups/frozen/undo/paid/views/fork **7종 RED** 및 paid 변이 생략 제어. `npm run test:intake` 기존 전체 정상/RED도 최종 코드에서 통과. `/private/tmp/u2-composition-final.log`, `u2-composition-skip-control.log`, `u2-b6-final.log`.
- `npm run test:composition-ui`: 실제 DOM **15건 정상 + 9종 RED**(권수/미저장/원문 해제/owner/선택/배점/D4/순서/영속 표시). order 변이 생략 제어 exit1 확인. `/private/tmp/u2-ui-15.log`, `u2-persistence-red.log`, `u2-ui-order-red.log`, `u2-ui-pref-red.log`, `u2-ui-skip-control.log`.
- 375/768/1194 가로 넘침 없음, 375/1194 캡처 육안 확인. 실제 Safari/iPad 검증과 구분한다.
- 로컬 check:fast는 set-revision까지 통과 후 기본 Python lxml 부재와 한글 cwd URL의 cross-platform ENOENT로 중단했다. 번들 Python+HWPX_REQUIRE=1로 HWPX12/시험지/브라우저 대조·자기검사 통과. fileURLToPath 수정(REV-145) 후 Chromium4크기/실패 주입 통과. 기존 브라우저175/잘못된JSON12·인쇄 정상/RED·static·review-contracts·library UI·sheet/source/mock-ui를 이어 실행해 전체 exit0 확인. 원격 최종 CI의 check:fast는 일괄 성공이다. `/private/tmp/u2-check-fast-final.log`, `u2-remaining-gates.log`, `u2-library-contract-final.log`.
- 공개233파일 build/check/실제 public 브라우저와 세 편집기 CSP 정상/RED 통과(`/private/tmp/u2-public-browser-final.log`). 첫 CI의 Linux /private EACCES는 os.tmpdir()+path.join으로 수정했으며 제품 실패와 구분한다.

## 로그인 운영 확인 — 2026-10-22 Chrome

자체 작성한 기존 `REV108 운영 검증 020409 (테스트)` 4문항만 사용했다. 기존 자료/사본/백업은 보존했다. 유료 AI 호출은 0회다.

1. 다른 PEDAGOGY 탭이 없음을 확인하고 U2에서 원하는 권수 2의 제안을 미리 확인·적용했다. 공통지문 3문항은 A, 독립 1문항은 B로 갔고 미분류/제외는 0이었다.
2. `U2 운영 검증 A (테스트)` 3문항, B 1문항 생성. 처음에는 계정 저장 대기였고 상태 조회 뒤 **두 권 모두 계정 저장 확인됨**을 표시했다.
3. 실제 편집기에서 두 권의 국어 과목, A의 `[01~03]` 지문 묶음, B의 독립 문항을 확인했다. 실제 A권 문항 편집→지면 배치의 2쪽 조립·`[01~03]`·3문항 유지도 확인했다. 새로고침 후 로그인 복원·라이브러리 **28권(기존26+검증2)**, 저장한 구성 작업 재진입·두 권 ACK 유지. 중복 권 생성 없음.
4. 재진입 전후 UI 내보내기로 결과 ID/문항 ID/본문/묶음/과목을 대조했다. A ID `4f6ab081-e2a9-47ef-9522-562fb1f4e820`, B ID `d23b84eb-1581-473b-ba14-4070cfb7c03a` 유지. 새 권 JSON은 루트 폴더의 `folderId` 누락→빈 문자열 정규화만 달랐고 나머지 전체 데이터는 같다. 이를 바이트 동일로 기록하지 않는다.
5. 기존 원본 JSON은 작업 전후 **2888바이트 완전 동일**, SHA-256 `dee58a702dc0474cb5c64e86a51bab182ae3c254825062c848ab631e973eac01`. 원본 4문항과 묶음도 그대로다. `/private/tmp/u2-operational-export-comparison.json`, `u2-operational-{original,A,B}-{before,after}.json`, 결과 캡처 `u2-operational-results.png`.

임시 자료는 소실될 수 있다. 영구 근거는 위 단계·재현 가능한 검사와 CI다. PR24의 보류3→0·새로고침26권/사본8 유지·실제2쪽PDF는 HANDOFF-196의 별도 운영 근거를 따른다.

## 다음 행동·남은 범위

**U2의 로컬/보존 결과 구성·독립 채택 경로는 검토·배포·운영 확인을 마쳤다. 다음은 [R5 연결 게이트](../../../docs/R5-INTEGRATION-GATE.md)**다. R1·B1~B7·R4.5·U0~U2의 기존 승인 증거를 합치고 미검토/수정 영향/채택→충돌→편집·지면 연결만 확인한다. 같은 diff 전체를 다시 검토하지 않는다.

실제 유료 AI/D3/C1~C3·실제 Safari/iPad·D1 수정 연동 활성화·사용자 과제 관찰은 완료로 확대하지 않는다. R5의 모델별 종합 판정과 R6~R10 완료도 아직 아니다.

## 검토 기록

- 2026-10-22 · 구현하지 않은 독립 Codex(`/root/independent_review`) · 새 draft ID의 groupOf·source grant·고정 결과 매핑·부분 채택 뒤 provider 직전 차단·진행 중 응답 보존·미채택 원자 묶음 fork를 실제 브라우저에서 재현. 보완 후 추가 결함 없음. UI/모바일/운영 AI 제외. 검토 SHA-256: composition `c271da74e538854feb9463b172f612a8878d33719745ee79200aee83b9c4d6dd`, intake `c5fbdba855556eb5e441592b593e0b2ec6ae537cc5907f6c1a0f9fdea6fd2c81`.

- 2026-10-22 후속: 정상 19/19·7종 RED와 paid 변이 생략 제어(의도한 exit 1)를 최종 코드에서 확인했다(`/private/tmp/u2-composition-final.log`, `u2-composition-skip-control.log`). B6 기존 회귀의 partial adopt 후 paid retry 허용은 U2에서 의도적으로 제한하는 계약 변경이다. 독립 검토로 U0의 고정 구성/미채택 새 구성 계약과 일치함을 확인하고 B6 설계에 명시했다. 실패 쪽 명시 retry/성공 쪽 잠금은 채택 전 별도 검사로 보존하고, 부분 채택 뒤 실행/명시 재시도는 calls 불변 거절을 검사한다.
- 사용자 PR #24 main/Pages 직접 승인 도착 후 `20881c2`로 병합 완료. Pages 배포/운영 확인은 진행 중이며 아직 REV-137/138/139 해결로 닫지 않았다.

## U2 화면 구현·검토 당시 기록(최종 판정은 위 현재 상태)

PR #24 운영 확인을 마치고 REV-137/138/139 해결(HANDOFF-196). U2의 실제 구성 화면을 외부 모듈/스타일로 구현했다. 라이브러리 선택/새 문제집 메뉴→기존 권·남은 B6 작업→목적지/문항/본문·원문→이동/제외/편집/실제Undo→문항별 구성 변경 확인/권수 차이 승인→고정 만들기/권별 결과/미채택 새 구성/D4 선호까지 연결한다. 유료 일괄 추출은 비활성화다. 새 권 과목은 단일 원본 과목 유지/혼합은 제한 없음, 머리말·선색은 새권 기본값(계약에 명시).

독립 UI 검토가 미배포 초안에서 REV-140~144를 재현했고 같은 이슈 파일에 원인·수정·영구 재현 검사를 기록했다. 정상 UI11건 통과(`/private/tmp/u2-ui-boundaries.log`), 375/768/1194 캡처 `/private/tmp/u2-ui/`. 저장20건+RED7도 통과(과목 보존 포함). UI RED는 6종으로 확장해 현재 최종 실행 중이다. 전체 check:fast 첫 실행은 추출 onAuth VM에 새 compositionUI 대역이 없어서 실패해 대역/계정 동일·전환 assertions를 추가했다. 실제 onAuth도 같은 owner 반복 알림에서는 구성 미저장 내용을 닫지 않고 owner 전환에서만 닫는다. audit VM 11/11와 공개/CSP 정상 통과. 최종 독립 판정과 전체 게이트는 아직 진행 중이다.

- 2026-10-22 · 구현하지 않은 독립 Codex · UI 최종 재검증: 자유 난이도/ai 출처/분류 reviewed 보존, 음수 배점 거절/기존 값 유지, 국어 결과/원본 불변, owner 즉시 재오픈 opens2/fields3, 늦은 뷰어 close1, 목적지/선택/상세 일치 확인. 초안의 REV-140~144 수정 후 추가 재현 결함 없음. `/private/tmp/u2-ui-independent-review/{final-probes,selection-final}.log`. UI SHA `9d3ca25c65919421ed638c2469c8101c33fffb49bd09c2d41fce370aa74578c1`, CSS `44df3359b3933a1e456ebe6a6eb24ba7f1d73ed14488e9b13e832749814d5af0`, planner `3f289b5b0d2e513758adf0251b737c4e74a5753376d7c636891ec7cd5270d26f`, intake `5e2f30ecaebab9158453e41530359cfa8c9c9b1d604abb57e321bea93b2cff78`. 실제 유료 AI/운영 배포/모바일 육안은 독립 검토 범위 제외. 부모는 375/768/1194 가로 넘침 검사와 375/1194 캡처 육안 확인.

- 2026-10-22 · 독립 Codex 후속 · D4 설정의 owner별함수/저장실패되돌림, 미사용notify제거, Linux tmpdir, 새3길의 라이브러리/키보드기대를 독립확인했고 추가결함없음. runtime UI모듈/engine/planner/CSS 해시는 위 검토본과동일. 이어 목적지 이름뿐 아니라 권안순서도 diff에표시하는 작은보완은 새검사로 확인한다.

## 마지막 좁은 보완 — 원문 보관 사용자 계약

R5 준비표에서 H193 별도 브랜치의 관리 미구현 설명과 현재 H184 관리 구현을 구분했다. 현재 main에는 원문 목록/용량/삭제가 이미 있다. 다만 U0 §5-2가 요구한 영속 저장 활성/미활성/미지원/확인실패 표시와 백업 보장 아님 안내가 누락된 기존 결함(REV-146)을 재현해 보완했다. 저장/삭제 API·Rules는 변경하지 않았다. 실제 DOM15건 정상·영속표시 RED 통과(`/private/tmp/u2-ui-15.log`, `u2-persistence-red.log`).

- 2026-10-22 · 독립 Codex · 순서 diff의 목적지+번호 비교에 추가결함없음. UI 최종 SHA `7d7ab264ff24dd3baad0da91f3aae2ccd659036ab2f22fc672de532f281a55ef`. REV146의 두 실제함수를 독립 VM으로 4상태/빈목록/owner 전환 중 조회 차단 확인, CSP3개 일치·추가결함없음. index SHA `3fc1f2cc4d95333e369b8cb19f0fa0c7ec3b3ad830b040ca831bcdae12e4eaad`.

공개233파일 build/check/실제공개브라우저 및 세편집기 CSP/RED는 전 단계에서 통과했다(`/private/tmp/u2-public-browser-final.log`). 마지막 index의 영속표시는 CSP재해시와 U2 DOM/독립검사로 좁게 확인했다. 이 시점 뒤 최종 CI·병합·운영 확인을 완료했다(위 현재 상태). 실제 AI 운영 완료로 확대하지 않는다.

## R5 준비 후속 — 2026-10-22

[R5 연결 근거표](../../../docs/R5-INTEGRATION-GATE.md)에 기존 R1/B1~B7/R4.5/U0~U2 승인·후속 수정/배포·남은 외부 게이트를 합쳤다. 구현하지 않은 독립 Codex가 보존 초안→실제 U2 채택→편집/인쇄 DOM/지면→B4 보류/사본→원문 삭제/뷰어 해제를 폐기 가능한 Chromium에서 확인(exit0·새 결함 없음). 후속 CAS probe도 exit0: stale20/current21 거절/쓰기0·최신 순서 CAS revision22/쓰기1·다른 로컬/미관측/pending의 거짓ACK 차단·확정snapshot 뒤ACK·실제page.reload/같은 결과ID·편집/지면/인쇄DOM/원문/사본 유지. Firestore 서버·transaction·snapshot 전달만 메모리 대역이며 원격 인증/Rules/CAS 왕복으로 확대하지 않는다. `/private/tmp/r5-integration-review-2026-10-22/cas-probe.{mjs,log}`. 제품 파일 수정 없음. Claude 로그인 정상 후 Opus foreground 래퍼1회가 주간 한도로 exit1·최종 답변 없음(10/25 20시KST 해제)이므로 **R5 Claude 승인/완료로 기록하지 않는다.** 반복 호출하지 않고 근거표/정확한 남은 경계를 보존한다.
