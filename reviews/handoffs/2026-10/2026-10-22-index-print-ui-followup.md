# 변경 인계 — REV-137 출력 링크 수정·운영 충돌 보존 체크포인트

- ID: `HANDOFF-2026-195`
- 날짜: `2026-10-22`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-137` (`in-progress`, 수정/로컬 검증 완료·독립 검토/배포 대기)
- 작업 사본: `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`
- 브랜치/PR: `codex/rev108-operational-checks` · PR #24 (draft)

## 변경 내용

사용자가 발견 문제 해결을 요청해 Codex가 좁은 출력 수정을 수행했다. `index.html`의 인쇄 숨김 목록에 `.skip-link`를 추가해 화면용 본문 건너뛰기 링크를 PDF에서 제외한다. 화면 CSS/키보드 접근, 저장/Rules는 변경하지 않았다.
`scripts/check-print-ui.mjs`가 실제 소스 페이지의 첫 Tab→Enter, print 미디어, 생성 PDF 2쪽/문항 1·4 보존/탐색 문구 부재, screen 복귀를 검사한다. `package.json`의 `test:audit-browser`에 정상/RED를 연결했다.

## 검증

- 수정 전 새 검사: exit 1, `screen navigation excluded in print media`, `flex !== none`.
- `npm run test:print-ui`: 정상 및 `PRINT_UI_RED=1`(응답 CSS에서 인쇄 숨김 제거) 통과. `PRINT_UI_RED=1 PRINT_UI_SKIP_MUTATION=1 node scripts/check-print-ui.mjs`: exit 1, `RED target stayed green or mutation skipped`.
- `PRINT_UI_OUTPUT=/private/tmp/rev137-fix-2026-10-22 npm run test:print-ui`: 정상 PDF와 RED PDF를 별도 경로에 보존. 정상 2쪽 전체 PNG 렌더·육안 확인에서 문항과 지면 유지/탐색 링크 없음. 처음 검사 작성 중 `PDFDocumentProxy.destroy()`를 호출한 하네스 오류는 저장소 PDF.js 6의 loading task `destroy()`로 고쳤고 그 뒤 정상/RED를 완료했다.
- `npm run test:audit-browser`: 기존 회귀 **175/175**, JSON 오류 입력 12종 거절, 새 PDF 정상/RED 포함 exit 0.
- `npm run test:public`, `npm run check:static`: 완료 로그 통과. 기록 최종 diff/review-hygiene도 커밋 전 확인한다.
- 실제 운영 반영은 **미완료**. 현재 운영 `625e19c`에는 수정 전 출력 코드가 있다. PR #24 새 head 원격 CI는 별도 확인해야 한다. 전체 check:fast/Rules를 로컬에서 반복하지 않았다(저장/Rules 무변경).

## 독립 검토와 정확한 중단 이유

`claude auth status` 로그인 확인 뒤 `scripts/ask-claude-readonly.mjs` foreground, `--model opus --effort high --timeout-seconds 300`으로 출력 수정/검사 및 기존 충돌 선택의 사본 보존 경로만 질문했다. 이번 모델 호출 1회는 **exit 1, Claude 주간 사용량 한도**로 최종 답변을 받지 못했다. 표시된 재개 시각은 `Oct 25 at 8pm (Asia/Seoul)`이다. **승인/결함 없음으로 세지 않는다.** 같은 질문을 우회 재호출하지 않았다.

## 운영 자료 정리 상태 — 반드시 그대로 이어받기

- 사용자 요청으로 보류 원인을 UI에서 확인: 다섯 권 모두 **no-base(편집 시작 기준 없음)** 안내이며, 각 초안 사본이 **계정에도 저장됨**을 확인했다. 첫 비교에는 다른 문항 1개가 표시돼 양쪽 내용이 같다고 단정하지 않는다. no-base 발생 원인을 새 제품 버그로 확정하지 않았다.
- 다섯 충돌 당시 초안 JSON을 모두 **다운로드 폴더**에 내보내고 문항 수 `38/40/70/57/72`를 검증했다. 사본은 삭제하지 않는다. 별도 보조 사본/해시는 `/private/tmp/rev137-fix-2026-10-22/conflict-backups/`(디렉터리 700, 초안 파일 600)에 있다. 사용자 본문·계정 식별자/토큰은 저장소에 넣지 않았다.
- **정리 완료 2권:** 좌표 기출 모음(서버 revision 7/38문항), 직선의 방정식 기출 모음(revision 10/40문항). 각 초안 JSON과 계정 저장 사본을 확인한 뒤 UI의 **계정 저장본 쓰기**를 선택했다. 서버본으로 로컬 원래 권을 맞추고 초안 사본은 그대로 보존했다. 보류 **5→4→3**을 실제 화면에서 확인했다. 서버 문서를 초안으로 덮어쓰거나 자료를 삭제하지 않았다.
- **남은 3권:** 원의 방정식 기출 모음 / 도형의 이동 기출 모음 / 집합 기출 모음. JSON 백업과 계정 초안 사본까지 확인했고 **선택은 아직 하지 않았다**. 사용자 요청대로 이 안정 상태에서 체크포인트를 남긴다. 실제 라이브러리는 23권이며 확인창은 닫힌 상태다. 새로고침 후 보류 해제 지속 여부/전체 ACK는 아직 미검증이다.
- 브라우저 도구 한계: native 클릭/키 입력이 간헐적으로 무반응이었다. Chrome 확장 연결은 일반 UI가 동작했으나 download 이벤트 대기에서 476초 지연/커널 재시작을 겪었다(파일 다운로드 자체는 성공 확인). JS confirm 후 확장 상태가 낡아 active confirm으로 오인한 적도 있어 실제 native 화면으로 3권 보류를 확인했다. 이를 제품 결함으로 등록하지 않는다. `browser-checkpoint.png`는 종료 시점 화면이다.

## 재개 후 정정 — 아래 과거 다음 행동보다 우선

사용자 재개 요청 뒤 남은 세 권에서 서버본을 선택해 일시적으로 보류 0을 확인했지만, 새로고침에서 같은 세 권이 다시 보류되고 사본이 중복 생성됐다. 이 재현은 **REV-138**, 수정·검증은 [HANDOFF-196](2026-10-22-index-conflict-server-choice-reentry.md)으로 분리했다. 현재 26권/보류 3/사본 8이며 새 사본 세 개는 **이 기기에만 보존됨**이다. 백업/기존 사본은 보존했고 삭제하지 않았다. 앞선 '확인창 닫힘' 관측은 도구 지연으로 잘못됐으며 `browser-checkpoint.png`는 비교창 화면이다. 최신 증거는 `rev138-operational-holds.png`다. 아래 3번의 운영 반복은 수정 배포 전 실행하지 않는다. PR #24 `37b1500` CI는 모두 성공했지만 CodeRabbit은 draft 검토 생략이며 Claude 승인도 아직 없다.

## 다음 행동 (당시 기록, 최신 순서는 HANDOFF-196)

1. 이 커밋/PR #24의 새 head와 CI부터 확인한다. 코드가 바뀌지 않았으면 통과한 로컬 검사를 반복하지 않는다.
2. Claude 한도 해제 뒤 기존 프롬프트 범위로 독립 검토를 마친다. 프롬프트/실패 기록은 `/private/tmp/rev137-fix-2026-10-22/review-prompt.md`, `claude-progress.log`에 있다. 임시 자료가 없으면 위 세 변경 파일과 REV-137에서 재구성한다.
3. 남은 3권은 각 JSON 백업/계정 사본을 다시 확인한 뒤 **계정 저장본 쓰기**로 정리한다. 초안 사본은 보존하고, 0건/새로고침 유지까지 확인한다. 내용 동일이나 문제 원인 해결을 추정하지 않는다.
4. 독립 검토·CI와 기존 배포 승인 범위를 확인한 뒤 출력 수정 병합/Pages 적용·운영 PDF를 확인한다. 그때까지 REV-137은 `in-progress`, PR은 draft, 운영 수정 완료로 표시하지 않는다. 이후 U2의 기존 모델 배정(Claude Sonnet 5 → Codex Sol medium)을 따른다.
5. 기본 폴더의 예전 브랜치와 `transcript.txt`는 읽거나 수정하지 않는다.

## 검토 기록

- `2026-10-22 · Codex`: 구현·로컬 정상/RED 완료. Claude 최종 판정 없음(주간 한도). 사용자가 사용량 종료 전 정리를 요청해 독립 검토/배포와 남은 자료 정리는 위 상태로 인계한다.
