# 리뷰 현황

마지막 정리: 2026-09-17

**이 파일은 새 세션이 매번 읽는다.** 그래서 여기에는 *지금 필요한 것*만 둔다 —
열린 이슈, 지금 하는 일, 최근 검토 다섯. 지난 과정은 `handoffs/` 파일과 git 이 기억한다
(지우는 것은 요약뿐이고 **파일은 하나도 지우지 않는다**). 기록 규칙은
[`README.md`](README.md) 의 '기록의 수명' 절에 있다.

## 열린 이슈

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-074` | `P2` | macOS 폴더 아이콘 파일이 새 Git 폴더에서 재발해 refs를 오염시킨다 | `issues/2026-09/2026-09-09-rules-macos-icon-files-corrupt-git-refs.md` |
| `REV-2026-075` | `P2` | AI 문서에 들어갔다 나오면 로그인이 안 된다(재현 절차 없음) | `issues/2026-09/2026-09-09-document-editor-login-after-return.md` |
| `REV-2026-093` | `P2` | staging Gemini 이미지·문서 요청이 provider HTTP 응답 전에 모두 실패한다 | `issues/2026-09/2026-09-14-gemini-staging-provider-request-error.md` |

⚠️ 이 표는 `npm run check:review-hygiene` 가 **실제 이슈 파일의 상태와 양방향으로**
대조한다. 지난 요약을 지워도 안전한 이유가 이 대조다 — 남은 한 곳이 정확해야
'줄인 것' 이 '잊은 것' 이 되지 않는다.

## 지금 하는 일 — **갈래가 둘이고 한 작업 폴더에 섞여 있다**

⚠️ **새 세션은 먼저 `git status` 를 보고 어느 갈래의 파일인지 가를 것.** 커밋되지 않은
변경이 두 갈래 것이 함께 있다. 남의 갈래 파일을 함께 커밋하지 말 것.

### A. 한글 조판 엔진 (Claude · 2026-09-17)

**머리말·꼬리말을 구현했다 — 미커밋**(`HANDOFF-2026-144`). 엔진의 남은 미구현 요소
셋 중 첫째다. 그 과정에서 **어제 커밋의 결함 둘**을 재현해 고쳤다 —
미리보기가 `pagebreak`·`footnote` 에서 **통째로 죽던 것**(`REV-2026-095` · P1)과
문단 모양이 **머리말·각주 속까지 덮어쓰던 것**(`REV-2026-096`).
⚠️ **여는 것만 보고 근거로 삼았으면 틀렸다** — `secPr` 에 넣은 머리말은 한글이 파일을
열어 주고도 **아무것도 안 찍는다**(PDF 로 갈랐다).

앞선 `HANDOFF-2026-143` 은 `main` 에 올라가 있다(`64e7217`, **미푸시·미검토**).

⚠️ **`git add -A` 를 쓰지 말 것** — 이 작업 폴더에는 B 갈래 변경과 `transcript.txt` 가
함께 있다(`HANDOFF-2026-134`).

**다음 할 일**: 남은 미구현 요소는 **상자 안의 표·그림**(계약이 재귀 구조가 되어야 한다)과
**지문**(일반 문서 계약에 넣을지부터 결정이 필요하다)이다. 절차는
[`docs/HWPX-ELEMENT-SPECS.md`](../docs/HWPX-ELEMENT-SPECS.md) 의 ①~④.

### B. 비용 개선 레일 (Codex)

비용 개선의 유일한 경로: [통합 레일·현재 단계](../docs/DEV-TOKEN-ROADMAP.md).
DEV-1~5 → OPS-6A·6B~10 → REL-11~15 순서다. **2026-09-19 에 Claude 가 이어받았다** — 5일째
미커밋이던 이 갈래를 커밋하고(`e68b73f`), OPS-7 문서 호출 2회로 **502 의 원인을 확정**했다:
`thinkingLevel: "minimal"` 은 Gemini 2.5 값이라 `gemini-3.1-flash-lite` 가 **400** 을 냈다.
`"low"` 로 고치고, 공급자 **표준 오류 코드만** telemetry 에 남기게 했다(`HANDOFF-2026-145`).
⚠️ **실제 성공은 아직 못 봤다** — 오늘 한도 2/2 소진. UTC 날짜가 바뀐 뒤(한국 09:00) 문서 1회,
새 승인 필요. production 제외는 그대로다.

### C. 제품 방향 — **문제 투입 경로** (해리 ↔ 코덱스 논의 대기)

사용자가 낸 문제다: **"한 문제에 사진 한 장" 구조가 비효율적이다. PDF 여러 개를 넣고
'이렇게 배치해서 만들어줘' 가 되면 좋겠다.** 제품의 정체성 질문이라 코드로 답할 수 없다.
설계·측정·막힌 지점은 [`docs/PROBLEM-INTAKE-DESIGN.md`](../docs/PROBLEM-INTAKE-DESIGN.md).
⚠️ **구현 0줄** — 사용자가 "새로 만들지 말고 남겨 두라" 고 했다. 코덱스에게 묻는 것이
그 문서 §7 에 있다. 핵심 충돌: **묶어 받으면 '호출 1회' 원가가 10원→수백원이라 호출 수로
세는 지금 한도 모델이 무너진다.**

| 갈래 | 어디를 읽나 |
| --- | --- |
| 제품 전반·함정 | [`CLAUDE.md`](../CLAUDE.md) |
| 보안 구조·미배포 항목 | [`docs/SECURITY-ARCHITECTURE.md`](../docs/SECURITY-ARCHITECTURE.md) · [`docs/SECURITY-OPERATIONS-CHECKLIST.md`](../docs/SECURITY-OPERATIONS-CHECKLIST.md) |
| 상용 출시 차단 항목 | [`docs/COMMERCIAL-LAUNCH.md`](../docs/COMMERCIAL-LAUNCH.md) · `npm run check:launch` |
| 과목별 조판 근거 | `docs/ENGLISH-SUBJECT-DESIGN.md` · `docs/INQUIRY-SUBJECT-DESIGN.md` · `docs/MOCK-STYLE-DESIGN.md` |
| 지난 종합 감사 | [2026-09-08](audits/2026-09-08/REPORT.md) · [2026-09-11](audits/2026-09-11/FOLLOWUP-REVIEW.md) |

## 최근 검토

[HANDOFF-2026-147](handoffs/2026-09/2026-09-19-ecc-analysis-and-borrowed-guards.md): 외부 하네스
ECC(MIT)를 받아 읽고 **기법 셋만** 우리 것으로 만들었다(코드 0줄). 통째로 넣으면 설명만 세션당
≈26,600 토큰이라 비용 레일과 반대다. `.claude/` 에 짝 파일 알림 · `git add -A` 가드 · HWPX 새 요소
스킬. ⚠️ **막지 않고 알리기만 하며 exit 0** — 판정은 검사가 한다. 자기검사는 `check:hooks` 로
`check:fast` 에 걸었다. 검토 요청: **저장소가 에이전트 동작을 규정하는 첫 파일**이 옳은가. **미검토.**

[HANDOFF-2026-146](handoffs/2026-09/2026-09-19-check-coverage-map.md): 검사 30개의 실행/건너뜀을
전수 대조했다. 자동 경로가 없던 여섯 중 다섯은 의도된 제외였고 **`check:review-hygiene` 만 진짜
구멍이라 `check:fast` 맨 앞에 걸었다**(깨보기로 첫 단계에서 멈추는 것 확인). ⚠️ **`check:fast` 는
`lxml` 이 없으면 HWPX 셋을 건너뛰며 초록불을 낸다** — 같은 세션에서 한 번은 12건 실행, 한 번은 전부
건너뜀. CI 는 `HWPX_REQUIRE=1` 로 안전하고 위험한 것은 로컬이다. **미검토.**

[HANDOFF-2026-145](handoffs/2026-09/2026-09-19-ops7-gemini-thinking-level.md): OPS-7 의 502 는
`thinkingLevel: "minimal"` 이었다 — Gemini 3 은 `low·medium·high` 를 받는다. 승인 2회 중 **첫 회는
로그 표본 10% 에 걸려 통째로 잃었고**, 둘째를 `wrangler tail` 로 받아 `http_error·400·토큰 null` 을
확보했다. `"low"` 로 고치고 공급자 **표준 오류 코드만** 남기게 했다(메시지는 안 남긴다 — 여기가
검토 요청 지점). 갈래 B 를 `e68b73f` 로 커밋. **미검토 · 실제 성공 미확인.**

[HANDOFF-2026-144](handoffs/2026-09/2026-09-18-header-footer-element.md): 머리말·꼬리말을 구현했다
(문서 수준 값 `header`·`footer`). ⚠️ `secPr` 에 넣고 `headerApply` 로 가리키면 **한글이 파일은
열어 주고 아무것도 안 찍는다** — 변종 둘을 PDF 로 뽑아 갈랐다. 그 과정에서 어제 커밋의 결함 둘을
재현해 고쳤다(`REV-2026-095` P1 미리보기 사망 · `REV-2026-096` 속 run 덮어쓰기). 깨보기 셋으로
검사가 실제로 잡는 것까지 확인했다. **미검토 · 미커밋.**

[HANDOFF-2026-143](handoffs/2026-09/2026-09-17-engine-browser-validation-and-note-style.md):
브라우저 엔진 `toBlob()` 이 이제 `strictValidate()` 를 부른다(예전엔 파이썬 `save()` 만 검사했고
정작 사용자에게 나가는 경로는 아무것도 안 봤다). 각주 본문 스타일을 이름으로 찾게 고쳤다
(`REV-2026-094` — 미주 스타일로 나가고 있었다). 고장 다섯을 심어 브라우저·파이썬이 **같은 문구로**
잡는 것과, 실물 한글 PDF 눈검사까지 확인했다. **미검토 · `main` 에 올라감(`64e7217`, 미푸시).**

## 지난 기록을 찾는 법

과거 핸드오프는 전부 그대로 있다. 목록을 여기 두지 않는 이유는 **찾는 방법이
목록보다 빠르기 때문**이다.

```bash
ls reviews/handoffs/2026-09/                      # 그 달에 무슨 일이 있었나
grep -rl "REV-2026-078" reviews/                  # 이 이슈를 다룬 기록 전부
grep -rl "flushMocksToCloud" reviews/ docs/       # 이 함수를 건드린 기록
git log --oneline -- reviews/handoffs/2026-09/    # 시간 순서
```

⚠️ **지식은 핸드오프에 두지 않는다.** 다시 알아내는 값이 큰 사실(실물에서 잰 값, 틀린
것으로 드러난 가정, 재현되지 않은 것)은 `docs/` 나 `CLAUDE.md` 로 옮기고 핸드오프에는
포인터만 남긴다. 핸드오프는 **일회용**이고 설계 문서가 **오래 사는 곳**이다.
