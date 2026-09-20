# 리뷰 현황

마지막 정리: 2026-09-20

**이 파일은 새 세션이 매번 읽는다.** 그래서 여기에는 *지금 필요한 것*만 둔다 —
열린 이슈, 지금 하는 일, 최근 검토 다섯. 지난 과정은 `handoffs/` 파일과 git 이 기억한다
(지우는 것은 요약뿐이고 **파일은 하나도 지우지 않는다**). 기록 규칙은
[`README.md`](README.md) 의 '기록의 수명' 절에 있다.

## 열린 이슈

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-074` | `P2` | macOS 폴더 아이콘 파일이 새 Git 폴더에서 재발해 refs를 오염시킨다 | `issues/2026-09/2026-09-09-rules-macos-icon-files-corrupt-git-refs.md` |
| `REV-2026-075` | `P2` | AI 문서에 들어갔다 나오면 로그인이 안 된다(재현 절차 없음) | `issues/2026-09/2026-09-09-document-editor-login-after-return.md` |
| `REV-2026-093` | `P2` | staging Gemini가 결제 전제 미충족(`FAILED_PRECONDITION`)으로 실패한다 | `issues/2026-09/2026-09-14-gemini-staging-provider-request-error.md` |
| `REV-2026-097` | `P2` | CSP 해시 잠금이 스크립트 주입 검사를 막아 `check:fast` 가 빨간불이다 | `issues/2026-09/2026-09-21-csp-hash-lock-breaks-script-injection-harnesses.md` |

⚠️ 이 표는 `npm run check:review-hygiene` 가 **실제 이슈 파일의 상태와 양방향으로**
대조한다. 지난 요약을 지워도 안전한 이유가 이 대조다 — 남은 한 곳이 정확해야
'줄인 것' 이 '잊은 것' 이 되지 않는다.

## 지금 하는 일

2026-09-20 통합 레일 R1 자기검증 완료. **다음은 R2 / GPT-6 Astra high**다.
루트 HTML script hash 잠금·외부 CSP host wildcard 제거·HWPX 런타임 Sonar 편입을 마쳤다.
`6adf121` Sonar는 Bugs 0·취약점 29·Code Smells 390, Security C로 분석 범위 확대가 반영됐다.
HWPX 19건 중 namespace 오탐 16건과 CLI 경로 3건을 판정·분리했고 최종 재분석 대조 전이다.
작업 폴더의 사용자 미추적 `transcript.txt`는 보존한다.
새 세션은 `git status`로 다시 확인하고 이 파일을 커밋하거나 삭제하지 않는다.

### A. 한글 조판 엔진 (Claude · 2026-09-17)

**머리말·꼬리말을 구현했다**(`b729a24`, `HANDOFF-2026-144`). 엔진의 남은 미구현 요소
셋 중 첫째다. 그 과정에서 **어제 커밋의 결함 둘**을 재현해 고쳤다 —
미리보기가 `pagebreak`·`footnote` 에서 **통째로 죽던 것**(`REV-2026-095` · P1)과
문단 모양이 **머리말·각주 속까지 덮어쓰던 것**(`REV-2026-096`).
⚠️ **여는 것만 보고 근거로 삼았으면 틀렸다** — `secPr` 에 넣은 머리말은 한글이 파일을
열어 주고도 **아무것도 안 찍는다**(PDF 로 갈랐다).

앞선 `HANDOFF-2026-143`도 `main`에 올라가 있다(`64e7217`).

**다음 할 일**: 남은 미구현 요소는 **상자 안의 표·그림**(계약이 재귀 구조가 되어야 한다)과
**지문**(일반 문서 계약에 넣을지부터 결정이 필요하다)이다. 절차는
[`docs/HWPX-ELEMENT-SPECS.md`](../docs/HWPX-ELEMENT-SPECS.md) 의 ①~④.

### B. 보안·저장·출시·비용 통합 레일 (Codex)

실행의 유일한 경로: [통합 레일·현재 단계](../docs/DEV-TOKEN-ROADMAP.md).
R1~R10은 보안→제품 범위→저장→독립 검토→검증/운영→출시 순서다.
기존 OPS-7~10은 C1~C3로 편입했다. Gemini 결제 대기는 독립 보안·저장 작업을 막지 않는다.
기존 호출 승인은 소진됐고 C1은 외부 조건 대기다. 모델·완료 조건·검사 선택은 레일을 따른다.

### C. 제품 방향 — **문제 투입 경로** (갈래·공급자 확정 · 2026-09-20)

⚠️ **제미나이를 실제로 쟀다**(§12 · `HANDOFF-2026-154`). 된다 — 수식 LaTeX 5/5, 2단 한 장에서
문항 2개 정확 분리, 문항당 약 1원(Haiku 대비 3.5배 저렴). **틀린 것의 원인은 모델이 아니라
우리 프롬프트의 빈 칸**(정답·지문·각주·출처·묶음안내)이었다. 같은 입력에 결과가 흔들려
**"무검토 자동 완성" 은 배제**됐고 **"초안 생성"** 으로 간다.
⚠️ 그 숫자를 **정확도로 인용하지 말 것** — 표본이 우리가 만든 깨끗한 렌더 3장이고 교재 사진이 아니다.

설계·측정·결정 현황은 [`docs/PROBLEM-INTAKE-DESIGN.md`](../docs/PROBLEM-INTAKE-DESIGN.md).
해리의 결정: **갈래 C**(A 를 남기고 B 를 새 경로로) · **공급자는 제미나이 우선** ·
저작권 선은 클로드에게 위임(§11-4 초안, 확인 대기).

⚠️ **그 논의에서 문제를 한 겹 잘못 잡고 있었던 것이 드러났다(§11-1).** 해리가 원하는
"단원별로 나눠 줘 / 난이도별로 셋으로 / 행렬만 뽑아 줘" 는 **입력이 같고 배열만 다르다** —
즉 **추출 문제가 아니라 재배열 문제**다. 추출·꼬리표를 한 번만 하고 재배열을 **필터 UI**
로 만들면 그 부분은 **AI 호출 0회**다. §2 의 비용 충돌이 상당 부분 여기서 풀린다.
⚠️ 걸림돌: 지금 `newProblem()` 에 **단원·난이도·유형 필드가 없다**(`index.html:2794`).
그 필드가 B 의 첫 공사이고 `normProblem`·`firestore.rules` 의 `hasOnly` 를 함께 고쳐야 한다.
⚠️ **R2 를 "라우팅하지 않는다" 로 닫았다**(§19 · 코덱스 2차 검토). 자동 모델 라우팅 없음 ·
저해상도는 호출 전 거절 · **공급자 호출당 한 쪽** · 쪽별 순차 + 부분 성공.
⚠️ "대용량은 앤트로픽" 은 잘림을 못 고친다 — **앤트로픽도 `max_tokens:4096`** 이다.
⚠️ **구현 0줄** — 남은 것은 모델 등급·쪽 수 비용 상한이고 **C3** 로 넘겼다.

| 갈래 | 어디를 읽나 |
| --- | --- |
| 제품 전반·함정 | [`CLAUDE.md`](../CLAUDE.md) |
| 보안 구조·미배포 항목 | [`docs/SECURITY-ARCHITECTURE.md`](../docs/SECURITY-ARCHITECTURE.md) · [`docs/SECURITY-OPERATIONS-CHECKLIST.md`](../docs/SECURITY-OPERATIONS-CHECKLIST.md) |
| 상용 출시 차단 항목 | [`docs/COMMERCIAL-LAUNCH.md`](../docs/COMMERCIAL-LAUNCH.md) · `npm run check:launch` |
| 과목별 조판 근거 | `docs/ENGLISH-SUBJECT-DESIGN.md` · `docs/INQUIRY-SUBJECT-DESIGN.md` · `docs/MOCK-STYLE-DESIGN.md` |
| 지난 종합 감사 | [2026-09-08](audits/2026-09-08/REPORT.md) · [2026-09-11](audits/2026-09-11/FOLLOWUP-REVIEW.md) |

## 최근 검토

[HANDOFF-2026-156](handoffs/2026-09/2026-09-21-sets-cloud-size-defense.md): R4/B1 — 문제집 클라우드 저장에
크기 선제 방어를 넣었다(`ready`/`tooBig` 분리 · `CLOUD_DOC_MAX` 공용화 · 무한 재시도 차단).
초과 문서 하나가 batch 전체를 실패시키던 결함을 고쳤다. `npm run test:sets-cloud` 5건 + 깨보기.
⚠️ 그 과정에서 선행 결함 `REV-2026-097`(CSP 해시 잠금이 주입식 검사를 막는다)을 발견했다. **독립 검토 대기.**

[HANDOFF-2026-154](handoffs/2026-09/2026-09-20-gemini-quality-measurement.md): 제미나이를 **제품 프롬프트 그대로**
재었다(호출 5회·약 7원·Worker 미경유). 수식 LaTeX 5/5, 2단 한 장에서 문항 2개 정확히 분리.
⚠️ 틀린 것의 원인은 모델이 아니라 **우리 계약의 빈 칸**(정답·지문·각주·출처·묶음안내)이었고,
같은 입력에 결과가 흔들려 **무검토 자동 완성이 배제**됐다. **독립 검토 대기.**

[HANDOFF-2026-153](handoffs/2026-09/2026-09-20-sonar-security-r1.md): 실제 Pages가 루트 HTML을
서비스하는 경계를 확인해 source script 5개를 hash로 잠그고 외부 host wildcard를 제거했다.
HWPX 런타임 9개를 Sonar 범위에 포함했으며 11개 finding을 수정/오탐/수용 위험으로 분류. **독립 검토 대기.**

[HANDOFF-2026-152](handoffs/2026-09/2026-09-20-unified-execution-rail.md): 기존 비용·출시·Sonar·안티그래비티 제안을 단일 레일로 통합.
R0 문서 완료, 다음 R1/Sol high. 모델 전환·최소 검사·외부 조건 대기·사용량 마감 기준 지정.


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
