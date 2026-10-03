# 남은 레일 — 클라우드 / 로컬 나누기 (초안 · Codex 합의 전)

> 2026-10-03 · Claude(클라우드 세션) 초안. **아직 Codex 와 합의하지 않았다.**
> 로컬 세션이 아래 「Codex 질문」을 래퍼로 돌려 합의하면, 결과를
> [`DEV-TOKEN-ROADMAP.md`](DEV-TOKEN-ROADMAP.md)·[`RAIL-ORDERS.md`](RAIL-ORDERS.md) 에 옮기고 이 파일은 지운다
> (초안은 일회용이다 — 정답표는 그 두 문서다).

## 왜 나누나

해리는 두 종류의 세션을 쓴다. **할 수 있는 일이 다르다.**

| | 클라우드 세션 (claude.ai/code · 앱 원격) | 로컬 세션 (해리 맥 `pedagogy-main`) |
|---|---|---|
| 코드 구현·커밋·푸시·PR | ✅ | ✅ |
| CI·CodeRabbit·SonarCloud 대응, merge(= 운영 배포), 운영 바이트 대조 | ✅ (Sonar 상세는 `sonarcloud.io` 차단으로 못 봄) | ✅ |
| Node·Python 검사, Playwright 브라우저 검사 | ✅ 단 **`cdn.jsdelivr.net` 차단** → KaTeX·글꼴 의존 검사는 CI 에 맡김 | ✅ |
| **Codex 호출**(래퍼·`codex:codex-rescue`) | ❌ CLI·로그인 없음, `api.openai.com` 차단 | ✅ |
| Firebase Rules·Worker 배포, secret | ❌ (자격 증명 없음) | ✅ |
| 로그인된 크롬 운영 확인 | ❌ | ✅ |
| 한글 앱 열기·PDF(`test:hwpx-opens`)·맥 시각 기준본 | ❌ | ✅ |
| 실기기(Safari/iOS·카톡) | ❌ | 해리 손 |

⚠️ **검토자 제약이 핵심이다.** 구현자≠검토자 계약 때문에 **Claude 구현의 검토자는 Codex** 이고,
Codex 는 로컬에만 있다. 그래서 "클라우드에서 구현 → PR → **로컬에서 Codex 검토**" 가 기본 흐름이 된다.
반대로 **Codex 구현의 검토자인 Claude(Opus)** 는 어디서든 된다.

## 남은 일 분류 (초안)

| 남은 일 | 클라우드 | 로컬에서만 |
|---|---|---|
| **U1 2차 PR #11** | CI·CodeRabbit·merge·운영 바이트 대조 (진행 중) | 로그인된 크롬 운영 확인 · 배포 기록(HANDOFF-180 deployed·INDEX·ROADMAP)은 다음 PR 에 |
| **U1.5 원본 대조** (Claude 구현) | 구현·자체 검사·PR | **Codex Sol medium 독립 검토** |
| **REV-2026-108** 지문 묶음이 위치로만 정해짐 | 구현 (판정 뒤) | **Codex 선행 판정** — 묶음 데이터 모델·호환이 걸린다(스키마 → CLAUDE.md 'Codex 선행' 조건) |
| **U2 AI 일괄 구성 UX** (Claude 구현) | 구현·PR (실호출 없음) | Codex 검토 · 저장/Worker 변경이 생기면 Sol high 별도 묶음 |
| **R5 종합 게이트** | Codex diff 를 Claude Opus 가 보는 부분 | Claude diff 를 Codex Sol medium 이 보는 부분 |
| **R6 검사·의존성** | CI 대조·의존성 점검 실행은 가능 | 레일 배정은 Codex Luna — 바꿀지 Codex 와 정한다 |
| **R7 배포 전환**(호스트·App Check·origin) | — | 전부 (콘솔·자격 증명) |
| **R8 운영 검증** | 자동화 가능한 여정 검사 | 로그인 여정 · 한글 · 실기기 |
| **R9 결제** | Opus 독립 검토 | 해리 결정 → Astra 설계 → Sol high 구현 |
| **R10 출시 판정** | — | Codex Sol high |
| **C1~C3 AI 비용** | — | 결제·staging 키 (외부 대기) |
| **A. HWPX 상자 안 표·그림 / 지문** (보류) | ③ 코드 | ①②④ 한글로 열기·PDF |
| **M1 Sonar 스타일 정리**(선택) | 가능 | — |
| 열린 이슈 `REV-074`(Drive 아이콘) · `REV-075`(문서 편집기 로그인) · `REV-093`(Gemini 결제) | — | 전부 (맥 Drive · 실제 로그인 재현 · 외부 결제) |

## 레일 재구성 초안 — 두 줄로 병렬

```
클라우드 줄:  PR #11 마무리 ─▶ U1.5 구현·PR ─▶ (REV-108 판정 나오면) 구현·PR ─▶ U2 구현·PR ─▶ M1(선택)
                                   │                                                │
로컬 줄:      Codex 레일 합의 ─▶ REV-108 선행 판정 ─▶ U1.5 검토 ─▶ U2 검토 ─▶ R5 ─▶ R6 ─▶ R7 ─▶ R8 ─▶ R9 ─▶ R10
              + 로그인 운영 확인 · 배포 기록 · Rules/Worker 배포 · C1 외부 대기
```

- 클라우드는 **PR 을 만들고 멈춘다.** 로컬이 PR 브랜치를 받아 Codex 검토 → 결함이면 같은 PR 에
  이슈/고침 → 승인 뒤 merge 는 어느 쪽이든 한다.
- 한 PR 에는 한 구현자만 쓴다. 클라우드와 로컬이 **같은 브랜치에 동시에 쓰지 않는다**.
- 배포 기록(HANDOFF 상태·INDEX·ROADMAP)은 별도 main 푸시로 하지 않고 다음 PR 에 함께 싣는다.

## Codex 질문 (로컬에서 래퍼로)

아래 블록을 `/tmp/pedagogy-codex/ask-codex.txt` 로 저장하고 CLAUDE.md 의 래퍼 명령을
`--model gpt-6-astra --effort high` 로 돌린다(레일 구성은 R0 때처럼 Astra high 몫이다).

```text
역할: PEDAGOGY 통합 레일 재구성의 설계 판정자. 읽기 전용. 코드 수정 금지.
읽을 것: docs/RAIL-CLOUD-LOCAL-SPLIT.md(이 초안), docs/DEV-TOKEN-ROADMAP.md 의 '현재 위치'·'남은 R4 작업 묶음'·
'사용자 결정', docs/RAIL-ORDERS.md 의 '지금 위치', reviews/INDEX.md 의 열린 이슈, CLAUDE.md 의 단계별 계약 표.

배경: 해리는 이제 클라우드 세션(Codex 없음, cdn.jsdelivr.net·sonarcloud.io·api.openai.com 차단,
Firebase 자격 증명 없음)과 로컬 세션(맥, Codex 래퍼 있음)을 병렬로 쓴다. 구현자≠검토자 계약은 유지한다.

질문 1. 초안의 '남은 일 분류'에서 클라우드/로컬 배정이 틀렸거나 빠진 항목이 있는가?
        특히 REV-2026-108 을 Codex 선행 판정으로 둔 것, R6 를 클라우드 Claude 가 실행해도 되는지.
질문 2. '두 줄 병렬' 순서가 기존 선행 조건(U1.5 ← U1 검토 + B6, U2 ← U1·B4~B7 검토, R5 ← U0~U2·R4.5)을
        깨는 곳이 있는가? 깨면 고친 순서를 제시하라.

완료 조건: 각 항목을 합의 / 미합의 / 근거 / 다음 행동 으로 닫는다. 새 기능·범위를 더하지 않는다.
```

## 로컬 세션을 열면 붙여 넣을 말

> `git pull` 하고 `codex/b7-outbox-tg08vw` 브랜치의 `docs/RAIL-CLOUD-LOCAL-SPLIT.md` 를 읽어.
> 거기 Codex 질문을 래퍼로 돌려서 남은 레일을 클라우드/로컬로 재구성하고, 합의되면
> DEV-TOKEN-ROADMAP·RAIL-ORDERS 에 반영해. 맥에 stash 해 둔 transcript.txt 는 `git stash pop` 으로 되돌리고 커밋하지 마.
