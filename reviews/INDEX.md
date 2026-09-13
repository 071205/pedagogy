# 리뷰 현황

마지막 정리: 2026-09-13

**이 파일은 새 세션이 매번 읽는다.** 그래서 여기에는 *지금 필요한 것*만 둔다 —
열린 이슈, 지금 하는 일, 최근 검토 다섯. 지난 과정은 `handoffs/` 파일과 git 이 기억한다
(지우는 것은 요약뿐이고 **파일은 하나도 지우지 않는다**). 기록 규칙은
[`README.md`](README.md) 의 '기록의 수명' 절에 있다.

## 열린 이슈

| ID | 심각도 | 요약 | 파일 |
| --- | --- | --- | --- |
| `REV-2026-074` | `P2` | macOS 폴더 아이콘 파일이 새 Git 폴더에서 재발해 refs를 오염시킨다 | `issues/2026-09/2026-09-09-rules-macos-icon-files-corrupt-git-refs.md` |
| `REV-2026-075` | `P2` | AI 문서에 들어갔다 나오면 로그인이 안 된다(재현 절차 없음) | `issues/2026-09/2026-09-09-document-editor-login-after-return.md` |

⚠️ 이 표는 `npm run check:review-hygiene` 가 **실제 이슈 파일의 상태와 양방향으로**
대조한다. 지난 요약을 지워도 안전한 이유가 이 대조다 — 남은 한 곳이 정확해야
'줄인 것' 이 '잊은 것' 이 되지 않는다.

## 지금 하는 일

비용 개선의 유일한 경로: [통합 레일·현재 단계](../docs/DEV-TOKEN-ROADMAP.md).
개발 DEV-1~5 → 서비스 OPS-6~10 순서다. 지금 위치는 **OPS-6**(staging 대상·접근 정보 대기).

| 갈래 | 어디를 읽나 |
| --- | --- |
| 제품 전반·함정 | [`CLAUDE.md`](../../CLAUDE.md) |
| 보안 구조·미배포 항목 | [`docs/SECURITY-ARCHITECTURE.md`](../docs/SECURITY-ARCHITECTURE.md) · [`docs/SECURITY-OPERATIONS-CHECKLIST.md`](../docs/SECURITY-OPERATIONS-CHECKLIST.md) |
| 상용 출시 차단 항목 | [`docs/COMMERCIAL-LAUNCH.md`](../docs/COMMERCIAL-LAUNCH.md) · `npm run check:launch` |
| 과목별 조판 근거 | `docs/ENGLISH-SUBJECT-DESIGN.md` · `docs/INQUIRY-SUBJECT-DESIGN.md` · `docs/MOCK-STYLE-DESIGN.md` |
| 지난 종합 감사 | [2026-09-08](audits/2026-09-08/REPORT.md) · [2026-09-11](audits/2026-09-11/FOLLOWUP-REVIEW.md) |

## 최근 검토

[HANDOFF-2026-134](handoffs/2026-09/2026-09-13-new-chat-ops6-context.md): 새 채팅 인계. staging 합성 2회·$1 한도 승인과 production 제외를 반영했다. 대상·접근 정보가 없어 OPS-6 대기이며 배포·실호출은 하지 않았다.

[HANDOFF-2026-133](handoffs/2026-09/2026-09-13-ai-measurement-deployment-prep.md): Worker 측정 배포 준비 완료. 공개 health만 읽었고 staging/version/binding/secret/콘솔 증적은 미확인이다.

[HANDOFF-2026-132](handoffs/2026-09/2026-09-13-development-token-effect-check.md): 첫 분리의 탐색 범위와 검증 부담을 비교했다. **개발 토큰 절감은 입증되지 않아** 추가 프런트 분리를 보류한다.

[HANDOFF-2026-131](handoffs/2026-09/2026-09-13-ai-image-helper-extraction.md): AI 이미지 전처리·응답 변환 classic script 추출을 독립 승인했다. 주입·전역 계약·`file://` 로딩·정규화 우회 변이를 재확인했고 재현 결함은 없다.

[HANDOFF-2026-130](handoffs/2026-09/2026-09-13-ai-image-extraction-design.md): 추출 범위를 호환 표면·회귀·실패 주입·복귀 조건으로 고정했다.

## 지난 기록을 찾는 법

핸드오프는 135개이고 전부 그대로 있다. 목록을 여기 두지 않는 이유는 **찾는 방법이
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
