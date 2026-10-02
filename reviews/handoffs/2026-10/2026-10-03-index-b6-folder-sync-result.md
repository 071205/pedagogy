# 변경 인계 — B6 보류 권과 정상 권의 폴더 저장 결과 분리

- ID: `HANDOFF-2026-176`
- 날짜: `2026-10-03`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-115` (수정·재현 검사 완료)

## 변경 내용

기준 `5ef97af`·브랜치 `codex/b6-intake-storage`. 사용자 요청 범위는 HANDOFF-175의 **115만**이다.
112·113·114 해소 재검토 결과를 유지한다. `writeCloudSnapshot()`의 읽기 전용 보류 갈래는 정상 대상의
ACK 뒤 `localSaved`를 반환한다. X가 업데이트 보류돼 있어도 정상 Y의 폴더 이동을 거짓 실패로 알리지 않는다.
보류 표시와 X 편집·이동 차단은 유지하며, 실제 로컬 실패는 false다. CAS/용량/형식/일반 오류 갈래는 그대로다.
inline CSP 해시 갱신, 실제 큐와 폴더 재시도를 쓰는 검사 추가 및 `test:intake-review` 연결을 포함한다.

## 위험과 검토 요청

Y의 폴더 소속이 서버/로컬에 확정되면 토스트·pending·재시도 버튼이 사라지는지,
X의 원문/초안·보류 상태·자기 폴더 이동 차단은 유지되는지 확인한다.
Y/prefs transaction 실패와 로컬 quota 실패를 성공으로 바꾸지 않는지도 확인한다.
**REV-2026-116은 미수정**이며 B6 완료·병합 게이트는 계속 열려 있다.

## 검증

브라우저 검사는 serve.py·Chromium, 외부 요청 차단, Firestore/AI fixture로 실행했다.

- `npm run test:intake`: B6 수용 28개·두 탭/image/PDF, 112/113 재현 14개·114 재현 11개,
  신규 115 재현/경계 **8개** 통과. 각 기존 빨간불과 신규 `B6_FOLDER_RED=1`(수정 전 `5ef97af`,
  Y 서버/로컬 ACK 후 거짓 pending **2개 실패 탐지**)도 통과. `/tmp/b6-rev115-intake.log`.
- `npm run test:set-revision`: 정상 35/35·과거판 35개 실패 탐지. `/tmp/b6-rev115-cas.log`.
- `npm run test:audit-browser`: regression-test.html 167/167·malformed JSON 12개 거절.
  `/tmp/b6-rev115-browser.log`.
- `npm run test:sets-cloud`: 정상 10개·과거판 7개 실패 탐지 통과. `/tmp/b6-rev115-size.log`.
- `npm run test:worker`, `npm run test:public`, `npm run check:static`, `git diff --check` 통과.
  `/tmp/b6-rev115-worker.log`, `/tmp/b6-rev115-static.log`. 리뷰 hygiene: 열린 5개·최근 5개 일치.

B3/B4/B5 완료·운영 AI 차단·저장 계약·D1/D3/C1~C3 게이트를 보존했다.
Safari/iPad 장기 보관·실제 AI 품질/비용은 기존 미검증 상태다. B7/U1.5/U2는 시작하지 않았다.
`transcript.txt` 접근/변경/추가, main 병합·push·배포 없음.

## 다음 검토자에게

**Claude Opus 5**: `5ef97af` 이후 115 수정 diff·같은 이슈 처리 기록·8개 검사/빨간불만 독립 재검토한다.
판정은 이 인계에 남긴다. 112·113·114/B3/B4/B5 승인 diff는 반복 검토하지 않는다.
남은 116은 **Codex GPT-6 Sol high**로 별도 수정·실패 주입·독립 검토 후 PR #8 CI → 해리 승인 merge(운영 배포).
B7은 B6 합의/병합 뒤 **Codex GPT-6 Sol high**다.

## 검토 기록

독립 재검토 대기.
