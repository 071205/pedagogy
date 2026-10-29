# 출시 전2 — 실제 출력 여정·한글 전체 쪽수 수정

- ID: `HANDOFF-2026-207`
- 날짜: `2026-10-29`
- 작성자: `Codex Sol high`
- 상태: `needs-follow-up` (두 수정·독립 검토 완료, PR/배포 확인 및 전2 남은 범위)
- 영향 영역: `mock | tests | docs`
- 관련 이슈: `REV-2026-158` (resolved) · `REV-2026-159` (resolved) · `REV-2026-160` (resolved) · `REV-2026-161` (resolved)

## 변경 내용

합성4문항을 실제 Chrome/Safari에서 가져오기→수정→저장/재진입→미리보기→native PDF저장/복귀로 검증했다. 각각A4 2쪽·수식/표/그림/정답 보존.

시험지 HWPX는 실제 Mac 한글3쪽에1/20·2/20·3/20을 출력하는 REV158을 재현했다. native 한글에서 TOTAL_PAGE 필드를 저장해 증명한 뒤 JS/Python 틀 열기에서 바탕쪽의 고정 분모만 전환한다. 계획 쪽나눔 수를 총수로 쓰지 않고 기존 양식/본문/원본 자산을 보존한다. [증거](../../audits/2026-10-29/prelaunch-print/README.md)·[지식](../../../docs/HWPX-ELEMENT-SPECS.md).

## 위험과 검토 요청

바탕쪽의 PAGE+숫자만 든 분모인 셀로 제한되는지, 동적 필드/현재 쪽번호/다른 내용 보존과 Python/JS 일치 확인. 원본 틀의 고정20 자체는 보존하지만 결과물에서는 자동 필드가 된다. 새 enum 추측/실자료·계정 변경 없음.

## 검증

- 정상 HWPX 시험지 정합: 역할22·문단13·배치7·표3·9문항/쪽나눔1·바탕쪽4 구조 정합 및 PAGE4/TOTAL_PAGE4/고정 숫자 없음.
- RED browser/python/both 전환 각각 비활성 → exit1/목표 쪽수 오류. 양쪽이 같이 틀려도 잡음.
- HWPX12묶음·문서 브라우저 정합·check:static·serve.py regression175/175 통과.
- 실제 한글 수정본3쪽 PDF1/3·2/3·3/3, 9문항/수식/표/그림/고의 누락 안내. 다른 이름 저장→닫기→재열기 PDF3쪽 PNG 모두 수정본과 bytes동일.
- 수정 전후 생성물은 masterpage0~3만 변경, 나머지 파트 bytes동일.
- Windows 한글/iPad/iOS/실프린터·범용 문서 별도 표본·로그인/클라우드/AI 여정은 이번 증거가 아님.

## 검토 기록

- 2026-10-29 · Claude Opus/high 진단 · 실제 분모 오류·parity 공백 합의. 당시 TOTAL_PAGE 미증명 의견은 이후 native 한글 저장/PDF 실험으로 해소. 최종 수정 독립 합의 완료.

## 재개 체크포인트

실제 worktree pedagogy-u15b·branch codex/r7-guest-host-verified, 기본 checkout 전환 없음·transcript.txt 접근 금지 유지. 전2 남은 지원 약속/실기기·문서 경로 대조를 먼저 진행한다. 전3~6 및 전체 출시는 미완료. guest 호스트는 별도 이전 배포이며 이번에 갱신하지 않았다.

## 사용자 출력 관찰·REV159

사용자가3쪽 선택과목 제목의 왼쪽 치우침을 지적했다. 원본 paraPr24 JUSTIFY+앞공백8개에 긴 확률과 통계 대신 기하를 넣으면서 ink 중심329.5px/종이380px로 치우침을 재현했다. JS/Python 틀 열기에서 제목 단독 문단만 CENTER 서식 사본을 쓰고 앞쪽 공백/줄 위치 캐시를 지운다. 공통/이어지는 쪽 머리말을 떠오기 전에 처리해 이후 복사에도 적용하며, 공유 원본 서식은 바꾸지 않는다.

실제 한글 수정본3쪽의 과목 제목 ink중심377.5/380/379px(종이380),9문항/1/3~3/3 유지. Save As→닫기→재열기 PDF3쪽 PNG bytes동일. 정상 제목4개 정렬·공유5/24 보존/정합·RED3·HWPX12·브라우저 정합·정적·회귀175/175 통과. [측정/해시](../../audits/2026-10-29/prelaunch-print/hwpx-centering-verification.json).

- 2026-10-29 · Claude Opus/high · REV158 최종 가드/저장ZIP/기대값·native 증거 검토 합의, 미합의/블로커 없음. REV159도 아래 정정 최종 의견으로 합의 완료.
- 사용자 요청에 따라 완료된 한글 시험 창5개를 닫고 현재 정렬 수정본1개만 유지했다.

- 2026-10-29 · Claude Opus/high · REV159 첫 호출240s timeout 후 inline 검토. 실제 생성물 제목4개가 선후행 공백0/CENTER·여백0이고 검사도 buildExam 뒤라는 근거로 초기 가설을 철회했다. 정정 최종 합의: 지원 소스 틀에 미합의/재현 블로커 없음. 임의 철자/새 템플릿 견고성으로 범위를 넓히지 않는다. 진단/조건부/정정 원문은 감사 폴더에 보존.

## PR·배포

로컬 구현·독립 검토·필수 검증 완료. 동일 브랜치로 PR을 만들고 해당 head CI·병합 main CI/Pages·실제 배포 파일을 확인한다. guest Worker 갱신은 이번 범위가 아니다.

### PR37 검사와 대체 브랜치

PR37 head9fc2dde는 verify/cross-platform/hwpx·PR Sonar 성공, secrets만 실패했다. 공식 해시 검증한 같은 Gitleaks8.30.1로 재현하니 기존 보안 감사 커밋의 Sonar object `key`가 generic-api-key75건이었다. 분석/이슈 식별자임을 JSON 스키마로 확인했고, 해당 증거5파일의 필드명만 sonarObjectId로 정규화했다(값 보존/역변환 동일). 검사/ignore/CI를 약화하지 않았다.

원본 branch codex/r7-guest-host-verified와 커밋은 그대로 보존한다. **현재 실제 worktree는 같은 pedagogy-u15b, branch codex/prelaunch-output-verified**이며 origin/main 기준 동일 변경을 하나로 옮겨 대체 PR을 진행한다. 기본 checkout 전환/force-push/기존 이력 rewrite 없음. 검증용 serve.py8896도 종료했다.

### 원격 반영 확인 (PR38)

PR38 head e3b402f의 필수4개/PR Sonar 성공 후 merge0fbe60420cfde5f89a2b3577cc0594105a81f9b4로 병합했다. Pages40831760039 built, 변경 helper/실제 호출부 포함7파일 bytes 일치. 공개 사이트의 새 Chromium 문맥에서 backend를 차단하고9문항 HWPX 생성→저장ZIP의 자동 총수4/제목4 CENTER·공백0·공유원형 보존 확인. main Verify40831760704 필수4개 모두 success, 같은 revision의 Sonar Quality Gate OK/new_security_rating=1. [근거](../../audits/2026-10-29/prelaunch-print/pr38-main-ci.json)·[Sonar](../../audits/2026-10-29/prelaunch-print/pr38-main-sonar.json).

현재 worktree 같은 pedagogy-u15b·branch codex/prelaunch-output-verified. squash 뒤 origin/main과 파일 동일성을 확인하고 이력 재작성 없이 merge로 계보를 연결했다. 원래 codex/r7-guest-host-verified는 그대로 보존, 기본 checkout 전환 없음.

### 일반 문서 native 검증

문서 편집기 기존 브라우저 표본3종(기본/확장블록/머리말꼬리말)을 실제 Mac 한글에서 출력·재저장/닫기/재열기했다. 총4쪽 모두 수식·표·상자·선지·각주1/2·쪽나눔·머리말/꼬리말 표시, 왕복 PDF4쪽 PNG모두 동일. [근거](../../audits/2026-10-29/prelaunch-print/document-native-verification.json). 제품 코드 추가 변경 없음. 기본 조판 경로의 native 공백 보완이며 REV075 실제 계정/문서복귀나 iOS·Windows를 해결한 것으로 세지 않는다. 사용자 요청에 맞춰 완료 시험 창을 정리하고 빈 창만 남은 한글 앱도 종료했다(실행 상태 false 확인).

### 공개 문서 UI와 안내 정정 (REV160)

공개 문서 편집기에서 합성 JSON 검증·미리보기→HWPX 버튼 다운로드를 backend/localhost 차단 문맥으로 확인했다. 파일 ZIP 11파트가 위 실제 Mac 한글 검증 표본과 bytes동일하다. 다만 화면에는 로컬 서버 필수라는 구 안내가 남아 REV160으로 등록했다. 해당 문구를 브라우저 우선/실패 시 로컬 서버 시도라는 실제 제어 흐름으로 수정했다. 같은 화면의 베타 안내도 각주·쪽 나눔·머리말·꼬리말을 미지원으로 잘못 적어, 구현/한글 native 표본에 맞게 정정했다. 수정 후 로컬 serve.py UI도 같은 다운로드/새 안내·페이지 오류0, ZIP 11파트 동일. [두 문구 렌더](../../audits/2026-10-29/prelaunch-print/document-local-copy.json)도 별도 확인. Claude Opus/high 독립 검토 합의. [공개·로컬 증거](../../audits/2026-10-29/prelaunch-print/README.md). 본문 조판/다운로드 로직 변경 없음. 후속 PR 및 Pages 반영을 확인한다.

### 문서 그림 검증 누락 (REV161)

독립 검토의 새 단서로 합성 GIF가 문서 JSON 검증을 통과한 뒤 HWPX 그림 BinData에서 빠지는 것을 브라우저에서 재현했다. 브라우저 그림 입력을 PNG/JPEG 실제 바이트·base64·2.5MiB·양수 치수로 검증하고, 서버 Python도 24바이트 이하/0픽셀 그림을 거부한다. 브라우저 엔진을 막았을 때 정상 PNG가 로컬 서버에서 BinData1로 출력되는 대체 경로를 확인했다. [재현·RED/정상·UI/폴백·회귀](../../audits/2026-10-29/prelaunch-print/README.md): 미지원5종 양쪽 거부, 정상 PNG/JPEG 각각 browser↔Python/ZIP 정합, HWPX12·정적·공개 빌드·CSP·회귀175 통과. 일반 문서 그림을 native 한글로 별도 열어 본 것은 아니다. Claude 첫 독립 의견의 폴백/서버 검증 지적을 반영했고 [최종 재검토](../../audits/2026-10-29/prelaunch-print/claude-document-image-final.md)에서 차단 의견 없음. 180초 timeout은 완료로 세지 않고 축소 재시도 240초 성공으로 닫았다. 서버 오류 표현·상수/그림 치수 검사 범위는 비차단 후속 관찰이다.

### 후속 PR40 첫 품질 게이트

PR40 head ac882c9의 HWPX/secrets CI 성공, Sonar 새 보안·신뢰성1/OK지만 유지보수성4/ERROR(신규 CODE_SMELL52). 기존 단일행 validate를 직접 건드린 결과 전체 함수가 새 코드로 분류된 것이 주원인이다. [원격 조건](../../audits/2026-10-29/prelaunch-print/pr40-initial-sonar.json). 정책/임계값을 약화하지 않고 그 원형 줄을 main과 같게 되돌렸다. `window.validate` 후처리로 정규화된 image만 검사하고 CSP 해시만 다시 계산했다. [독립 검토](../../audits/2026-10-29/prelaunch-print/claude-document-image-wrapper-final.md)·직접 UI/서버 폴백·PNG/JPEG·5종 거절·정적/공개/회귀175 재통과. 새 head CI/Sonar까지 확인한다.

### PR40 병합 main·공개 그림 검증

PR40 최신 head `f098170`은 CI 필수4개와 PR Sonar가 성공했고, `1bae4347b7eb900b7a279b427327af74668bfe33`으로 squash 병합됐다. 같은 revision의 main CI4개(40889188409)·Pages(40889187048, `built`)·Sonar gate `OK`/신규 보안·신뢰성·유지보수성 1을 확인했다. 공개 `document-editor.html`은 이 작업 사본과 SHA-256/bytes가 같고, 실제 공개 UI에서 GIF 입력은 HWPX 이전 거절, PNG는 미리보기·다운로드 성공. 생성 HWPX 12파트에 그림 BinData1/`hp:pic`1, 페이지 오류0. [요약 증거](../../audits/2026-10-29/prelaunch-print/pr40-final-verification.json).

새 PNG/JPEG 그림 표본을 Mac 한글에서 직접 인쇄한 것은 이번 PR 검증에 포함되지 않았다. PR38 일반 문서 native3표본4쪽 근거와 혼동하지 않는다. Windows 한글·iPad/iOS·실계정 문서 복귀는 계속 전2/전3 미검증이다. 별도 REA/출력 검증 적용 계획은 [계획](../../../docs/PRELAUNCH-HWPX-REA-RENDER-PLAN.md)을 따른다.
