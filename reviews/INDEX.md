# 리뷰 현황

마지막 정리: 2026-10-25

**이 파일은 새 세션이 매번 읽는다.** 열린 이슈·현재 작업·최근 검토 다섯만 두고 과거는 `handoffs/`와 git에 보존한다. 기록 규칙은
[`README.md`](README.md) 의 '기록의 수명' 절에 있다.

## 열린 이슈

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-074` | `P2` | macOS 폴더 아이콘 파일이 새 Git 폴더에서 재발해 refs를 오염시킨다 | `issues/2026-09/2026-09-09-rules-macos-icon-files-corrupt-git-refs.md` |
| `REV-2026-075` | `P2` | AI 문서에 들어갔다 나오면 로그인이 안 된다(재현 절차 없음) | `issues/2026-09/2026-09-09-document-editor-login-after-return.md` |
| `REV-2026-093` | `P2` | staging Gemini가 결제 전제 미충족(`FAILED_PRECONDITION`)으로 실패한다 | `issues/2026-09/2026-09-14-gemini-staging-provider-request-error.md` |
| `REV-2026-147` | `P2` | 과거 Firebase CLI 환경 덤프에 세션 IPC 토큰 field가 남아 이력 노출 위험이 지속된다 | `issues/2026-10/2026-10-23-security-driveupload-messaging-token-history-exposure.md` |
| `REV-2026-152` | `P2` | 게스트 CI의 RED 로그 확인이 미설치 rg에 의존해 exit127로 실패 | `issues/2026-10/2026-10-25-tests-guest-ci-log-tool.md` |

⚠️ 이 표는 `npm run check:review-hygiene` 가 **실제 이슈 파일의 상태와 양방향으로**
대조한다. 지난 요약을 지워도 안전한 이유가 이 대조다 — 남은 한 곳이 정확해야
'줄인 것' 이 '잊은 것' 이 되지 않는다.

## 지금 하는 일

**R4/U0 계약 독립 검토·연결 시안 완료**(Claude Opus 5 · `HANDOFF-167`):
[계약](../docs/PRODUCT-UX-U0-CONTRACT.md) · [과제·결정표](../docs/PRODUCT-UX-U0-SCENARIOS.md) ·
[시안](../docs/mockups/u0-flow.html). 계약 주장 5건을 코드로 확인했고 `REV-2026-108`을 재현했다.
**D1 사용자 결정: 문항을 다른 권에 넣을 때 독립 사본/수정 연동을 선택 가능하게 한다.**
**현재: U2/PR25 운영 확인·R5 독립 Codex·R6/PR26 완료. R7 PR27 병합(506b33c)·main Verify4개/Pages/5파일 일치. R8 PR28 병합(a3d8a72)·main Verify4개/Pages 완료. 추가 수동 PDF 연결 정상3크기/RED3·독립 Codex·REV151 해결(HANDOFF-200). PR29 병합(1ed8d7f)·main CI 대기. 무료 guest 호스트 코드/정상·RED·독립 검토 완료(HANDOFF-201), 새 head CI/배포 전. Firebase staging403/새 프로젝트 quota 대기. main Sonar 기존 E·App Check·자료 이관·R7/8 운영 전체 완료는 미결.**
U1.5 main `877a8e7`·파일 225개 일치. 실제 Safari/iPad·원본 패널·D3/C1~C3·D1 연동 대기. 운영 보류 0건·기존26권/사본8개 보존·U2 테스트2권 추가 후28권, 원래 JSON/계정 사본 보존.
순서·게이트는 [통합 레일](../docs/DEV-TOKEN-ROADMAP.md), 지시문은 [RAIL-ORDERS](../docs/RAIL-ORDERS.md).
**B3 운영 장애 `REV-2026-109` 해결**(운영 `e50636c` → 문구 정정 `6679676`, 편집·삭제·진짜 충돌 운영 검증).
`REV-2026-111`은 **B4 운영 배포(`451e8ba`)·운영 확인으로 해결**(`HANDOFF-169`).
**B3 3/3 완료**(엄격 Rules · Opus 5.5 검토 결함 없음 · 운영 거절 확인, `HANDOFF-170`).
**B5 검토(결함 없음)·운영 배포 완료**(secret → Worker `a63c4880` → Pages `2264ed7`, `HANDOFF-171`). B6 선행(U0 개정 합의)은 2026-10-01 충족.
`REV-2026-110` 테스트 하네스 수정·고장 주입으로 해결. **Pages 원본은 다시 `main`**(2026-09-25 정리 ·
`main` 푸시 = 운영 배포). R1 독립 검토 완료(결함 없음). C1 외부 대기.

### A. 한글 조판 엔진 (Claude · 2026-09-17)

**머리말·꼬리말을 구현했다**(`b729a24`, `HANDOFF-2026-144`). 엔진의 남은 미구현 요소
셋 중 첫째다. 그 과정에서 **어제 커밋의 결함 둘**을 재현해 고쳤다 —
미리보기가 `pagebreak`·`footnote` 에서 **통째로 죽던 것**(`REV-2026-095` · P1)과
문단 모양이 **머리말·각주 속까지 덮어쓰던 것**(`REV-2026-096`).
⚠️ **여는 것만 보고 근거로 삼았으면 틀렸다** — `secPr` 에 넣은 머리말은 한글이 파일을
열어 주고도 **아무것도 안 찍는다**(PDF 로 갈랐다). 앞선 `HANDOFF-2026-143`도 `main`에 있다(`64e7217`).

**다음 할 일**: 남은 미구현 요소는 **상자 안의 표·그림**(계약이 재귀 구조가 되어야 한다)과
**지문**(일반 문서 계약에 넣을지부터 결정이 필요하다)이다. 절차는
[`docs/HWPX-ELEMENT-SPECS.md`](../docs/HWPX-ELEMENT-SPECS.md) 의 ①~④.

### B. 보안·저장·출시·비용 통합 레일 (Codex)

실행의 유일한 경로: [통합 레일·현재 단계](../docs/DEV-TOKEN-ROADMAP.md).
R1~R10은 보안→제품 범위→저장→독립 검토→검증/운영→출시 순서다.
기존 OPS-7~10은 C1~C3로 편입했다. Gemini 결제 대기는 독립 보안·저장 작업을 막지 않는다.
기존 호출 승인은 소진됐고 C1은 외부 조건 대기다. 모델·완료 조건·검사 선택은 레일을 따른다.

### C. 제품 방향 — AI로 문항 편집을 쉽게, 원하는 문제를 모아 편집·조판

⚠️ **제미나이를 실제로 쟀다**(§12 · `HANDOFF-2026-154`). 된다 — 수식 LaTeX 5/5, 2단 한 장에서
문항 2개 정확 분리, 문항당 약 1원(Haiku 대비 3.5배 저렴). **틀린 것의 원인은 모델이 아니라
우리 프롬프트의 빈 칸**(정답·지문·각주·출처·묶음안내)이었다. 같은 입력에 결과가 흔들려
**"무검토 자동 완성" 은 배제**됐고 **"초안 생성"** 으로 간다.
⚠️ 그 숫자를 **정확도로 인용하지 말 것** — 표본이 우리가 만든 깨끗한 렌더 3장이고 교재 사진이 아니다.

제품 요구는 [PRODUCT-UX-DESIGN](../docs/PRODUCT-UX-DESIGN.md), 투입 측정 근거는 [PROBLEM-INTAKE-DESIGN](../docs/PROBLEM-INTAKE-DESIGN.md).
해리의 결정: **갈래 C**(A 를 남기고 B 를 새 경로로) · **공급자는 제미나이 우선** ·
저작권 선은 클로드에게 위임(§11-4 초안, 확인 대기).

⚠️ **그 논의에서 문제를 한 겹 잘못 잡고 있었던 것이 드러났다(§11-1).** 해리가 원하는
"단원별로 나눠 줘 / 난이도별로 셋으로 / 행렬만 뽑아 줘" 는 **입력이 같고 배열만 다르다** —
즉 **추출 문제가 아니라 재배열 문제**다. 추출·꼬리표를 한 번만 하고 재배열을 **필터 UI**
로 만들면 그 부분은 **AI 호출 0회**다. §2 의 비용 충돌이 상당 부분 여기서 풀린다.
⚠️ 걸림돌: 지금 `newProblem()` 에 **단원·난이도·유형 필드가 없다**(`index.html:2794`).
U0→B6에서 정규화/복원·AI 계약을 함께 다룬다. Rules의 `hasOnly`는 최상위 키 검사라 문항 내부 꼬리표만으로 변경하지 않는다.
⚠️ **R2 를 "라우팅하지 않는다" 로 닫았다**(§19 · 코덱스 2차 검토). 자동 모델 라우팅 없음 ·
저해상도는 호출 전 거절 · **공급자 호출당 한 쪽** · 쪽별 순차 + 부분 성공.
⚠️ "대용량은 앤트로픽" 은 잘림을 못 고친다 — **앤트로픽도 `max_tokens:4096`** 이다.

| 갈래 | 어디를 읽나 |
| --- | --- |
| 제품 전반·함정 | [`CLAUDE.md`](../CLAUDE.md) |
| 보안 구조·미배포 항목 | [`docs/SECURITY-ARCHITECTURE.md`](../docs/SECURITY-ARCHITECTURE.md) · [`docs/SECURITY-OPERATIONS-CHECKLIST.md`](../docs/SECURITY-OPERATIONS-CHECKLIST.md) |
| 상용 출시 차단 항목 | [`docs/COMMERCIAL-LAUNCH.md`](../docs/COMMERCIAL-LAUNCH.md) · `npm run check:launch` |
| 과목별 조판 근거 | `docs/ENGLISH-SUBJECT-DESIGN.md` · `docs/INQUIRY-SUBJECT-DESIGN.md` · `docs/MOCK-STYLE-DESIGN.md` |
| 지난 종합 감사 | [2026-09-08](audits/2026-09-08/REPORT.md) · [2026-09-11](audits/2026-09-11/FOLLOWUP-REVIEW.md) |

## 최근 검토

[HANDOFF-2026-201](handoffs/2026-10/2026-10-23-index-r7-guest-preview.md): 무료 guest 전용 overlay·명시 auth/AI/server 차단·원본 불변·allowlist. UI/RED·실 Wrangler 233자산/헤더/404/iframe·독립 Codex 완료. PR29 병합, guest 새 CI/배포 전.

[HANDOFF-2026-200](handoffs/2026-10/2026-10-23-tests-r8-pdf-source.md): 실제 PDF 수동 연결·픽셀/2쪽 지정·기존 refs/Blob/SHA/재로드 정상3크기·RED3. REV151 수정·독립 재검증. PR28 main CI4개/Pages 완료, Firebase403/새 프로젝트 quota·무료 guest 호스트 준비.

[HANDOFF-2026-199](handoffs/2026-10/2026-10-23-security-r7-static-host-preparation.md): R7 로컬 Static Assets 설정·HTTP headers·fresh manifest·Wrangler/iframe 정상·RED. REV149/150 resolved·PR27 병합/main Verify4개/Pages·main Sonar 기존 E. R8 편집 저장/오프라인 PDF 정상3화면·RED2·독립 Codex 통과; staging 인증/App Check·origin 대기.

[HANDOFF-2026-198](handoffs/2026-10/2026-10-23-security-r6-verification-tools.md): R6 secret diff scan·도구 pin·Python converter·npm audit·Dependabot 판정, Actions Node24 migration, CDN/SRI·license boundary. REV-148 resolved; 독립 검토·CI·PR26 병합 완료.

[HANDOFF-2026-197](handoffs/2026-10/2026-10-22-index-u2-composition.md): U2 독립 Codex 검토·저장20/RED7·UI15/RED9·PR25/병합 CI·Pages 완료. 로그인 두 권 ACK/재진입·고정 ID·원본 JSON 바이트 불변. 다음 R5.




저장 구조의 기존 미결과 상세는 각 인계를 따른다.

## 지난 기록을 찾는 법

과거 핸드오프는 전부 그대로 있다. 목록 대신 아래 검색으로 찾는다.

```bash
ls reviews/handoffs/2026-09/                      # 그 달에 무슨 일이 있었나
grep -rl "REV-2026-078" reviews/                  # 이 이슈를 다룬 기록 전부
grep -rl "flushMocksToCloud" reviews/ docs/       # 이 함수를 건드린 기록
git log --oneline -- reviews/handoffs/2026-09/    # 시간 순서
```

⚠️ **지식은 핸드오프에 두지 않는다.** 다시 알아내는 값이 큰 사실(실물에서 잰 값, 틀린
것으로 드러난 가정, 재현되지 않은 것)은 `docs/` 나 `CLAUDE.md` 로 옮기고 핸드오프에는
포인터만 남긴다. 핸드오프는 **일회용**이고 설계 문서가 **오래 사는 곳**이다.
