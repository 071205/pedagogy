# 남겨진 인계·제안 후속 검토 (2026-09-11)

작업 시작 시 인계 문서 **122개**와 이슈 문서 **81개**의 목록·미결 항목·후속 기록을 대조했다.
과거 커밋을 각각 다시 실행한 것은 아니며, 현재 코드의 전체 회귀를 실행하고 열린 이슈,
최신 미커밋 구현과 아직 반영되지 않은 제안을 집중 검토했다. 기존 미커밋 변경은 보존했다.

## 적용 결과

- 모의고사 전송 중 수정본 ACK, 로컬 실패 복구·종료 경고, 계정 삭제 필수 하위 문서 실패 처리를 수정했다 (`REV-2026-082~084`).
- App Check 공개키 조회 폭증을 제한했다 (`REV-2026-085`).
- 문서 로그인 CSP와 App Check 장애에 의한 Auth 중단을 고쳤다 (`REV-2026-086~087`).
- Python 런타임을 무시하던 HWPX 검사도 수정해 실제 양쪽 구현 대조를 실행했다 (`REV-2026-088`).
- 공개 빌드: 허용 입력 17개 → 산출물 22개. 인라인 JS 5개를 바이트·순서·전역 표면을 유지한 외부 고전 스크립트로 추출하고 script-src의 unsafe-inline을 제거했다. 주석 제거·minify·난독화는 하지 않았다.
- 신규 검사는 수정 전 실패를 확인했다. 공개 CSP는 정책만 되돌린 주입도 검출한다.

## 미결 항목 판정

| 항목 | 현재 판정 |
|---|---|
| 104·097·099·101·102 UI 검토 요청 | 이미 106이 독립 검토했고 이번 전체 라이브러리/교차/시각 검사를 통과했다. INDEX의 오래된 검토 요청을 정리했다. |
| 110·111·112·113 영어/탐구 후속 | cells 이관과 합치기 명세는 이미 113으로 완료. 현재 코드·명세와 회귀 158개, 인쇄 9종을 확인했다. |
| 090 모의고사 클라우드 | 실제 저장·ACK·실패 경로를 다시 검토해 082·084 수정. Undo 부재는 명시된 삭제 정책이며 새 기능 요청으로 추정해 추가하지 않았다. |
| 114·115·117 보안 제안 | WAF가 Firebase 직접 SDK 앞을 지킨다는 주장과 정규식 DLP 보증은 채택하지 않았다. 기존 독립 검토와 118 설계를 유지했다. |
| 118·119 보안 코드 | 공개 파일 경계·CSP·App Check/Worker 검증 재확인, 발견 결함 수정. 콘솔 enforcement와 실제 site key는 미확인이다. |
| 120 프론트엔드 제안 | 공개 빌드의 외부 스크립트 분리는 적용. source 전체 ESM 전환은 file://·전역 계약 때문에 미적용. 인쇄 모듈은 미리보기에도 사용되고 HWPX는 이미 모의고사 진입 후 로드된다. 성능 절반 개선 주장은 근거가 없다. |
| 121 오프라인 제안 | 전체 IndexedDB/PWA/Firestore 지속 캐시는 미구현. 트랜잭션 완료 ACK·계정 삭제 큐·레거시 마이그레이션·업데이트 버전 계약이 빠진 원안을 그대로 적용하지 않았다. 현재 디바운스/onSnapshot 존재와 compat API 이름을 정정했다. |
| REV-074 | 11개(그중 refs 2개)를 정리했고, 9월 12일 재개 후 재발한 39개(그중 refs 7개)도 같은 정확한 0바이트 조건으로 정리했다. 생성 주체를 입증하지 못했으므로 open 유지. |
| REV-075 | 별도 문서 CSP/Auth 결함은 수정. 원래 실계정 본체 복귀 신고의 원인은 입증하지 못해 open 유지. SDK fixture의 왕복 통과를 실계정 검증으로 과장하지 않았다. |
| 운영/출시 | site key, 고객지원, 약관 버전, 결제 포털, 법률 정보 TODO, 유료 플랜 상한, Worker enforce, localhost 분리 등 8개 출시 차단 유지. 도메인/배포/실기기/Storage CORS/라이선스·운영 정보는 추가 증적이 필요하다. |

## 검증 결과

| 명령 | 결과 |
|---|---|
| HWPX_PYTHON=<bundled python> HWPX_REQUIRE=1 npm run check:fast | exit 0. serve.py regression 158/158, 실패 0. Worker·저장·라이브러리·정적·HWPX 통과. 고장 주입의 FAIL 출력은 기대값. |
| AUTH_ENGINES=chromium,webkit,firefox npm run test:auth-navigation | exit 0. SDK fixture로 초기화 장애, redirect 결과, 화면 왕복, A/B/A 격리. |
| PUBLIC_ENGINES=chromium,webkit,firefox npm run test:public-browser | exit 0. 공개 산출물만 /pedagogy/에서 서비스, 편집·인쇄·모의고사 저장·HWPX·strict CSP·file 실행·내부 파일 404. |
| CSP_ENGINES=chromium,webkit,firefox npm run test:csp | exit 0. 세 편집기 CSP·로그인 helper/iframe·정책 제거 고장 주입. |
| npm run test:cross | exit 0. 세 엔진·네 뷰포트와 고장 주입. 콘솔 경고 10건(CDN/정책 차단 포함)은 로그에 보존. |
| npm run test:visual | exit 0. 9종, 최대 픽셀 0.001%, 최대 배치 0.018%. 글줄 제거 고장 주입 28.50% 검출. |
| npm run check:public / git diff --check | 통과. |
| npm run check:launch | 기대된 exit 1. 8개 출시 차단. |

실제 Google 계정, reCAPTCHA site key, 배포 Worker/DO, 운영 Firebase Rules, 실제 iOS 키보드/프린터/한글 앱은 이번 자동 검사가 대체하지 않는다. Rules 파일은 바꾸지 않았고 emulator는 재실행하지 않았다.

[실행 로그](followup-evidence/)에 수정 전 빨간불과 최종 실행 결과를 남겼다.

## 전수 인계 목록

아래 목록은 이력 누락 확인용이다. `ready-for-review` 같은 과거 문구는 당시 기록이며 현재 모든 항목이 미검토라는 뜻이 아니다. 089 번호는 두 문서가 공유하므로 파일 경로로 구별한다.

| ID | 기록 |
|---|---|
| HANDOFF-2026-002 | [변경 인계 — 초기 감사 4건 해결](../../handoffs/2026-08/2026-08-27-fix-audit-findings.md) |
| HANDOFF-2026-001 | [독립 점검 인계 — 초기 전체 감사](../../handoffs/2026-08/2026-08-27-independent-initial-audit.md) |
| HANDOFF-2026-003 | [변경 인계 — 상용 출시 보안·권한·운영 기반](../../handoffs/2026-08/2026-08-28-commercial-launch-hardening.md) |
| HANDOFF-2026-006 | [변경 인계 — HANDOFF-2026-003/004/005 독립 검토 + CSP·CI 결함 수정](../../handoffs/2026-08/2026-08-28-independent-review-csp-fix.md) |
| HANDOFF-2026-004 | [변경 인계 — 본문·수식 크기 및 국어 발문 굵기 정렬](../../handoffs/2026-08/2026-08-28-index-type-scale-alignment.md) |
| HANDOFF-2026-005 | [변경 인계 — 리팩터링 시작 기준선](../../handoffs/2026-08/2026-08-28-refactor-baseline.md) |
| HANDOFF-2026-007 | [변경 인계 — 계층형 회귀·권한 검사 강화](../../handoffs/2026-08/2026-08-28-tests-layered-hardening.md) |
| HANDOFF-2026-008 | [변경 인계 — 문제집 카드 메뉴 레이어 수정](../../handoffs/2026-08/2026-08-29-index-library-menu-layering.md) |
| HANDOFF-2026-010 | [변경 인계 — HWP 조판 가능성 실험 (베타, 제품 미연결)](../../handoffs/2026-08/2026-08-30-experiments-hwp-export-spike.md) |
| HANDOFF-2026-011 | [변경 인계 — 모의고사 → 한글(HWPX) 내보내기 완성 (베타, 제품 미연결)](../../handoffs/2026-08/2026-08-30-experiments-hwpx-mock-export.md) |
| HANDOFF-2026-009 | [변경 인계 — 국어 보기 내 표 및 모의고사 연속 쪽 머리말 수정](../../handoffs/2026-08/2026-08-30-index-mock-korean-bogi-and-header.md) |
| HANDOFF-2026-018 | [변경 인계 — 범용 AI 문서 JSON·미리보기·HWPX 베타](../../handoffs/2026-08/2026-08-31-document-ai-json-hwpx-beta.md) |
| HANDOFF-2026-019 | [변경 인계 — 범용 문서 HWPX에 표 블록 추가](../../handoffs/2026-08/2026-08-31-document-table-block.md) |
| HANDOFF-2026-020 | [변경 인계 — 한컴 공개 규격서 확보, 수식 변환기를 추측에서 규격 기반으로](../../handoffs/2026-08/2026-08-31-hwp-spec-based-equations.md) |
| HANDOFF-2026-016 | [변경 인계 — HWPX 엔드포인트 검사 실패 시 임시 그림 정리](../../handoffs/2026-08/2026-08-31-hwpx-endpoint-cleanup.md) |
| HANDOFF-2026-015 | [변경 인계 — 30문항·선택과목 시험지 검증, 구역 분리, HWPX 검사 CI 연결](../../handoffs/2026-08/2026-08-31-hwpx-full-exam-sections-and-ci.md) |
| HANDOFF-2026-013 | [변경 인계 — HWPX 그림 경로 제한 및 work 폴더 연결](../../handoffs/2026-08/2026-08-31-hwpx-image-path-safety.md) |
| HANDOFF-2026-014 | [변경 인계 — HWPX 검사를 실행 경로에 연결 + 엔드포인트 동작 검사](../../handoffs/2026-08/2026-08-31-hwpx-tests-wired-and-endpoint-check.md) |
| HANDOFF-2026-017 | [변경 인계 — 자칼 런타임 제거 및 내부 HWPX 엔진 이관](../../handoffs/2026-08/2026-08-31-internal-hwpx-runtime.md) |
| HANDOFF-2026-012 | [변경 인계 — 모의고사 한글(HWPX) 내보내기 · 베타 (제품 연결)](../../handoffs/2026-08/2026-08-31-mock-hwpx-export-beta.md) |
| HANDOFF-2026-029 | [변경 인계 — 브라우저에서 도는 HWPX 조판기 (AI 문서)](../../handoffs/2026-09/2026-09-01-browser-hwpx-engine.md) |
| HANDOFF-2026-025 | [변경 인계 — 새 블록을 네 경계에 함께 반영 (Codex 검토 반영)](../../handoffs/2026-09/2026-09-01-document-block-boundaries-fix.md) |
| HANDOFF-2026-022 | [변경 인계 — 범용 문서에 테두리 상자 블록 추가](../../handoffs/2026-09/2026-09-01-document-box-block.md) |
| HANDOFF-2026-026 | [변경 인계 — AI 문서 화면을 본체 디자인에 맞춤](../../handoffs/2026-09/2026-09-01-document-editor-design-unified.md) |
| HANDOFF-2026-023 | [변경 인계 — 범용 문서에 <보기>·선지 블록 추가](../../handoffs/2026-09/2026-09-01-document-exam-blocks.md) |
| HANDOFF-2026-021 | [변경 인계 — 범용 문서에 그림 블록 추가 (base64)](../../handoffs/2026-09/2026-09-01-document-image-block.md) |
| HANDOFF-2026-028 | [변경 인계 — 한글 내보내기가 로컬 서버를 제대로 찾게](../../handoffs/2026-09/2026-09-01-hwpx-export-server-discovery.md) |
| HANDOFF-2026-024 | [변경 인계 — 범용 문서 블록 경계 독립 검토](../../handoffs/2026-09/2026-09-01-independent-review-document-block-boundaries.md) |
| HANDOFF-2026-032 | [변경 인계 — 문항별 단 배치를 실물 시험지에서 가져왔다](../../handoffs/2026-09/2026-09-01-mock-default-column-layout.md) |
| HANDOFF-2026-031 | [변경 인계 — 문항 간격 2차: 한글에게 직접 물어봤다](../../handoffs/2026-09/2026-09-01-mock-hwpx-column-spacing-2.md) |
| HANDOFF-2026-030 | [변경 인계 — 한 단 안에서 문항을 벌린다 (편집기가 재서 보낸다)](../../handoffs/2026-09/2026-09-01-mock-hwpx-column-spacing.md) |
| HANDOFF-2026-027 | [변경 인계 — 시험지 문항 번호(탭)와 이어지는 쪽 머리말](../../handoffs/2026-09/2026-09-01-mock-hwpx-number-tab-and-page-header.md) |
| HANDOFF-2026-033 | [변경 인계 — 실물 조판 디테일 1·2단계 (수식 앞 공백 · 그림 문단 모양)](../../handoffs/2026-09/2026-09-01-mock-style-step12.md) |
| HANDOFF-2026-034 | [변경 인계 — 실물 조판 4단계: 조건 상자 안 별행 수식](../../handoffs/2026-09/2026-09-02-mock-style-step4-cond-display-eq.md) |
| HANDOFF-2026-040 | [변경 인계 — 영어 순서 문항의 (A)(B)(C) 라벨을 문단 첫머리로](../../handoffs/2026-09/2026-09-03-english-order-inline-label.md) |
| HANDOFF-2026-038 | [변경 인계 — 영어 과목 조판의 토대 (실물 대조)](../../handoffs/2026-09/2026-09-03-english-subject-foundation.md) |
| HANDOFF-2026-035 | [변경 인계 — 실물 조판 3+5단계: 구획 태그와 ※ 확인 사항](../../handoffs/2026-09/2026-09-03-mock-style-step35-section-tag-and-note.md) |
| HANDOFF-2026-036 | [변경 인계 — 실물 조판 6단계: 역할 표를 한 곳으로](../../handoffs/2026-09/2026-09-03-mock-style-step6-role-table.md) |
| HANDOFF-2026-039 | [변경 인계 — 지문 문단 모델: 문단마다 첫 줄 들여쓰기](../../handoffs/2026-09/2026-09-03-passage-paragraph-model.md) |
| HANDOFF-2026-037 | [변경 인계 — 시각 회귀 검사: 견줄 수 있는 것만 견주게, 그리고 실제로 잡게](../../handoffs/2026-09/2026-09-03-visual-regression-cross-platform.md) |
| HANDOFF-2026-043 | [변경 인계 — 실물은 굵게가 아니라 **글꼴 갈래**로 가른다](../../handoffs/2026-09/2026-09-04-emphasis-by-typeface-not-weight.md) |
| HANDOFF-2026-041 | [변경 인계 — 영어 듣기 답란(밑줄 한 줄)](../../handoffs/2026-09/2026-09-04-english-listening-answer-line.md) |
| HANDOFF-2026-044 | [변경 인계 — 안내문 상자 (영어 27·28번)](../../handoffs/2026-09/2026-09-04-english-notice-box.md) |
| HANDOFF-2026-042 | [변경 인계 — 지문 없는 문항 묶음의 안내 줄](../../handoffs/2026-09/2026-09-04-group-lead-without-passage.md) |
| HANDOFF-2026-046 | [변경 인계 — 영어 표 문항 (10번) + 표 머리글 굵기](../../handoffs/2026-09/2026-09-06-english-table-question.md) |
| HANDOFF-2026-045 | [변경 인계 — 선지에 그림 넣기 (교과서 그래프 문항)](../../handoffs/2026-09/2026-09-06-image-choices.md) |
| HANDOFF-2026-048 | [변경 인계 — 이미 실패한 그림의 인쇄 대기 제거](../../handoffs/2026-09/2026-09-06-print-broken-image-wait.md) |
| HANDOFF-2026-047 | [변경 인계 — 인쇄가 느리다는 신고, 실측과 조치](../../handoffs/2026-09/2026-09-06-print-speed.md) |
| HANDOFF-2026-051 | [변경 인계 — 범용성 설계 독립 검토와 수정 요청](../../handoffs/2026-09/2026-09-07-cross-platform-design-review.md) |
| HANDOFF-2026-050 | [변경 인계 — 범용성(플랫폼·기기) 설계안, 검토 요청](../../handoffs/2026-09/2026-09-07-cross-platform-design.md) |
| HANDOFF-2026-052 | [변경 인계 — 범용성 설계 검토 반영 + 재현된 P1 수정](../../handoffs/2026-09/2026-09-07-cross-platform-review-applied.md) |
| HANDOFF-2026-053 | [변경 인계 — 범용성 1단계: 세 엔진 × 세 뷰포트 연기 검사](../../handoffs/2026-09/2026-09-07-cross-platform-step1.md) |
| HANDOFF-2026-055 | [변경 인계 — 2단계 검토 반영 (REV-2026-024 · 025 · 026)](../../handoffs/2026-09/2026-09-07-cross-platform-step2-review-applied.md) |
| HANDOFF-2026-054 | [변경 인계 — 범용성 2단계: 되돌릴 수 없는 실패 (인앱 브라우저 · pagehide)](../../handoffs/2026-09/2026-09-07-cross-platform-step2.md) |
| HANDOFF-2026-056 | [변경 인계 — 범용성 3단계: 손가락](../../handoffs/2026-09/2026-09-07-cross-platform-step3.md) |
| HANDOFF-2026-057 | [변경 인계 — 범용성 4단계: 화면 (dvh · 문서 편집기 · safe-area) + REV-2026-027](../../handoffs/2026-09/2026-09-07-cross-platform-step4.md) |
| HANDOFF-2026-058 | [변경 인계 — 범용성 5단계: 글꼴을 인쇄할 사람에게만 (+ REV-2026-028)](../../handoffs/2026-09/2026-09-07-cross-platform-step5.md) |
| HANDOFF-2026-059 | [변경 인계 — 범용성 6단계: 안 되는 것을 미리 말하기 (+ REV-2026-029)](../../handoffs/2026-09/2026-09-07-cross-platform-step6.md) |
| HANDOFF-2026-060 | [변경 인계 — 시험지 틀을 저장소에 넣었다 (결정 1)](../../handoffs/2026-09/2026-09-07-exam-template-bundled.md) |
| HANDOFF-2026-049 | [변경 인계 — 발문 별행 수식의 탭(14.11mm)과 왼쪽 정렬](../../handoffs/2026-09/2026-09-07-stem-display-eq-tab.md) |
| HANDOFF-2026-067 | [변경 인계 — 독립 감사 9건 수정](../../handoffs/2026-09/2026-09-08-audit-findings-fixed.md) |
| HANDOFF-2026-066 | [변경 인계 — 독립 보안·안정성·효율성 종합 분석](../../handoffs/2026-09/2026-09-08-independent-security-stability-audit.md) |
| HANDOFF-2026-076 | [HANDOFF-2026-076 — A단계·정규화 분리 독립 검토](../../handoffs/2026-09/2026-09-08-library-and-normalize-review.md) |
| HANDOFF-2026-065 | [변경 인계 — 라이브러리(폴더·정렬·선택·설정) 설계, 검토 요청](../../handoffs/2026-09/2026-09-08-library-design.md) |
| HANDOFF-2026-073 | [변경 인계 — 라이브러리·브라우저 HWPX 독립 검토](../../handoffs/2026-09/2026-09-08-library-hwpx-independent-review.md) |
| HANDOFF-2026-074 | [변경 인계 — 코덱스 8건 독립 검증 · A단계로 내림 · 검사의 플래그 의존 제거](../../handoffs/2026-09/2026-09-08-library-review-verified-and-schema-a.md) |
| HANDOFF-2026-075 | [변경 인계 — 구조 1단계: 정규화(신뢰 경계)를 별도 파일로](../../handoffs/2026-09/2026-09-08-structure-step1-normalize.md) |
| HANDOFF-2026-063 | [변경 인계 — UX 수정 설계, 검토 반영](../../handoffs/2026-09/2026-09-08-ux-fixes-design-applied.md) |
| HANDOFF-2026-062 | [변경 인계 — UX 수정 설계 독립 검토](../../handoffs/2026-09/2026-09-08-ux-fixes-design-review.md) |
| HANDOFF-2026-061 | [변경 인계 — 사용자 수정 요청 셋의 설계 (검토 요청)](../../handoffs/2026-09/2026-09-08-ux-fixes-design.md) |
| HANDOFF-2026-064 | [변경 인계 — UX 수정 셋 구현](../../handoffs/2026-09/2026-09-08-ux-fixes-implemented.md) |
| HANDOFF-2026-100 | [변경 인계 — AI 문서를 화면에서 빼고 코드로 남김](../../handoffs/2026-09/2026-09-09-ai-document-scope.md) |
| HANDOFF-2026-069 | [변경 인계 — 감사 수정 후속 검토 3건 해결](../../handoffs/2026-09/2026-09-09-audit-review-findings-fixed.md) |
| HANDOFF-2026-084 | [변경 인계 — 부팅 구간 노출 수정 · 운영 배포 기록 · HANDOFF-083 회신](../../handoffs/2026-09/2026-09-09-boot-flash-fix-and-deploy-record.md) |
| HANDOFF-2026-087 | [Claude 아이패드 후속 변경 독립 검토·보완](../../handoffs/2026-09/2026-09-09-claude-ipad-followup-independent-review.md) |
| 번호 없음 | [HANDOFF-2026-081 — Claude 최신 변경 독립 검토와 수정 설계](../../handoffs/2026-09/2026-09-09-claude-latest-design-review.md) |
| 번호 없음 | [HANDOFF-2026-083 — Claude 후속 변경 독립 검토와 코멘트](../../handoffs/2026-09/2026-09-09-claude-post081-independent-review.md) |
| HANDOFF-2026-088 | [변경 인계 — 편집기 접근성 디자인 점검과 수정](../../handoffs/2026-09/2026-09-09-editor-accessibility-design-audit.md) |
| HANDOFF-2026-102 | [변경 인계 — 한컴 규격서 고지를 `설정 → 정보` 로](../../handoffs/2026-09/2026-09-09-hancom-notice-in-settings.md) |
| HANDOFF-2026-085 | [변경 인계 — 한컴 규격서 출처 고지를 UI·매뉴얼에](../../handoffs/2026-09/2026-09-09-hwp-spec-attribution-in-ui.md) |
| HANDOFF-2026-086 | [변경 인계 — 아이패드 실사용 신고 두 건 수정](../../handoffs/2026-09/2026-09-09-ipad-report-fixes.md) |
| HANDOFF-2026-094 | [변경 인계 — 법률 벤치마크와 동의·고지 교정](../../handoffs/2026-09/2026-09-09-legal-benchmark-and-consent-corrections.md) |
| HANDOFF-2026-091 | [변경 인계 — 이용약관 확장 초안과 사실·법령 대조 보정](../../handoffs/2026-09/2026-09-09-legal-compliance-audit-and-terms-review.md) |
| HANDOFF-2026-095 | [변경 인계 — 다국어 법률정보 읽기 안내](../../handoffs/2026-09/2026-09-09-legal-multilingual-reader-guide.md) |
| HANDOFF-2026-092 | [변경 인계 — 법률 문서 구조 개편과 라이브러리 푸터 회귀 수정](../../handoffs/2026-09/2026-09-09-legal-page-structure-and-footer.md) |
| HANDOFF-2026-093 | [변경 인계 — 법정 기재사항 완성과 항목별 동의 절차](../../handoffs/2026-09/2026-09-09-legal-statutory-completion-and-consent.md) |
| HANDOFF-2026-070 | [변경 인계 — 라이브러리 설계 독립 검토](../../handoffs/2026-09/2026-09-09-library-design-review.md) |
| HANDOFF-2026-089 | [변경 인계 — 라이브러리 헤더 정돈과 모의고사 라이브러리 설계](../../handoffs/2026-09/2026-09-09-library-header-and-mock-library-plan.md) |
| HANDOFF-2026-097 | [변경 인계 — 왼쪽 레일 · 푸터 축약 · 설정 좌측 갈래 · 코덱스 이슈 처리](../../handoffs/2026-09/2026-09-09-library-rail-and-settings.md) |
| HANDOFF-2026-080 | [검토 인계 — 라이브러리 사용 흐름(HANDOFF-2026-078) 실제 화면 독립 검증](../../handoffs/2026-09/2026-09-09-library-ui-independent-review.md) |
| HANDOFF-2026-078 | [변경 인계 — 라이브러리 폴더·선택·정렬 사용 흐름 수정](../../handoffs/2026-09/2026-09-09-library-ui-workflows.md) |
| HANDOFF-2026-098 | [변경 인계 — 라이브러리 UX 설계 질문에 대한 결정](../../handoffs/2026-09/2026-09-09-library-ux-design-decisions.md) |
| HANDOFF-2026-096 | [변경 인계 — 라이브러리 화면 재설계 **설계안** (구현 전 · 검토 요청)](../../handoffs/2026-09/2026-09-09-library-ux-design.md) |
| HANDOFF-2026-099 | [변경 인계 — 코덱스 결정 반영: 휴대폰 하단 탐색](../../handoffs/2026-09/2026-09-09-mobile-bottom-nav.md) |
| HANDOFF-2026-090 | [변경 인계 — 모의고사 라이브러리 (다중 모의고사) 구현](../../handoffs/2026-09/2026-09-09-mock-library-implementation.md) |
| HANDOFF-2026-089 | [새 채팅 인계 — 2026-09-09 저녁 기준](../../handoffs/2026-09/2026-09-09-new-chat-handoff.md) |
| HANDOFF-2026-072 | [새 채팅 작업 인계](../../handoffs/2026-09/2026-09-09-new-chat-project-context.md) |
| HANDOFF-2026-082 | [변경 인계 — 검토 지적 2건 수정 (REV-2026-059 · -060)](../../handoffs/2026-09/2026-09-09-review-fixes-applied.md) |
| HANDOFF-2026-068 | [변경 인계 — 감사 수정 9건 검토](../../handoffs/2026-09/2026-09-09-review-of-audit-fixes.md) |
| HANDOFF-2026-101 | [변경 인계 — 설정을 전체 화면 뷰로, 데이터 관리를 그 안으로](../../handoffs/2026-09/2026-09-09-settings-view-and-data.md) |
| HANDOFF-2026-071 | [변경 인계 — `index.html` 쪼개기 설계](../../handoffs/2026-09/2026-09-09-structure-design.md) |
| 번호 없음 | [HANDOFF-2026-077 — 구조 2단계: 안전한 HTML 렌더 분리](../../handoffs/2026-09/2026-09-09-structure-step2-render.md) |
| HANDOFF-2026-079 | [변경 인계 — 구조 3단계: 인쇄 배치 엔진 분리](../../handoffs/2026-09/2026-09-09-structure-step3-print.md) |
| HANDOFF-2026-107 | [변경 인계 — 화학식: 재 보니 하나만 없었다 (mhchem)](../../handoffs/2026-09/2026-09-10-chemistry-formulas.md) |
| HANDOFF-2026-106 | [변경 인계 — 코덱스 `-104` 독립 검토 확인과 아이콘 재발 처리](../../handoffs/2026-09/2026-09-10-codex-review-verified.md) |
| HANDOFF-2026-103 | [변경 인계 — 영어 ②: 가정이 틀렸고, 진짜 빠진 것은 짝 선지였다](../../handoffs/2026-09/2026-09-10-english-paired-choices.md) |
| HANDOFF-2026-105 | [변경 인계 — 탐구(사회·과학) 조판 규칙](../../handoffs/2026-09/2026-09-10-inquiry-typography.md) |
| HANDOFF-2026-104 | [변경 인계 — 097·099·101·102 독립 검토와 UX 수정](../../handoffs/2026-09/2026-09-10-library-ux-independent-review-and-fixes.md) |
| HANDOFF-2026-113 | [변경 인계 — 짝 선지를 `cells` 로 · 합치기 규칙을 명세로 (`-111` 후속)](../../handoffs/2026-09/2026-09-10-paired-cells-and-merge-spec.md) |
| HANDOFF-2026-112 | [변경 인계 — 인쇄 보정이 넘치는 표를 줄인다 (`REV-2026-078`)](../../handoffs/2026-09/2026-09-10-print-table-overflow-fix.md) |
| HANDOFF-2026-110 | [검토 요청 — 영어 짝 선지 · 탐구 과목 (`-103` `-105` `-107` `-108` `-109`)](../../handoffs/2026-09/2026-09-10-review-request-subjects.md) |
| HANDOFF-2026-111 | [독립 검토 — 영어 짝 선지·탐구 과목 다섯 건](../../handoffs/2026-09/2026-09-10-subjects-independent-review.md) |
| HANDOFF-2026-108 | [변경 인계 — 표 칸에 그림 (탐구 자료)](../../handoffs/2026-09/2026-09-10-table-cell-images.md) |
| HANDOFF-2026-109 | [변경 인계 — 표 칸 합치기 (colspan · rowspan)](../../handoffs/2026-09/2026-09-10-table-cell-merge.md) |
| HANDOFF-2026-119 | [변경 인계 — App Check 클라이언트·Worker 2단계](../../handoffs/2026-09/2026-09-11-app-check-worker-phase2.md) |
| HANDOFF-2026-120 | [프론트엔드 아키텍처 개편 제안서 (Frontend Architecture Proposal)](../../handoffs/2026-09/2026-09-11-frontend-architecture-proposal.md) |
| HANDOFF-2026-116 | [변경 인계 — 라이브러리 모드 선택기와 설정 모달](../../handoffs/2026-09/2026-09-11-library-mode-switcher-settings-modal.md) |
| HANDOFF-2026-121 | [오프라인 생존성 및 데이터 동기화 아키텍처 제안서](../../handoffs/2026-09/2026-09-11-offline-persistence-architecture.md) |
| HANDOFF-2026-114 | [변경 인계 — 엔터프라이즈 SaaS 보안 강화 제안서](../../handoffs/2026-09/2026-09-11-saas-security-enhancement-proposals.md) |
| HANDOFF-2026-115 | [변경 인계 — SaaS 보안 제안 독립 검토와 출시 게이트 보정](../../handoffs/2026-09/2026-09-11-saas-security-proposals-independent-review.md) |
| HANDOFF-2026-118 | [변경 인계 — 상용 보안 아키텍처 확정과 안전한 1단계](../../handoffs/2026-09/2026-09-11-security-architecture-phase1.md) |
| HANDOFF-2026-117 | [변경 인계 — 라이브러리 UI와 보안 후속 변경 독립 검토](../../handoffs/2026-09/2026-09-11-ui-security-followup-independent-review.md) |

## 2026-09-12 마무리 확인

문서 정리 중 INDEX 내용을 REV-080 파일에 잘못 저장한 오류를 확인했다. 작성하려던 내용은 INDEX에 반영하고 REV-080은 변경 전 Git 원문과 바이트 단위로 같게 복원했다. 기존 목록에서 빠진 해결 이슈 REV-030·078과 인계 068·071·087·089(Claude)도 연결했다. 이슈 88개와 인계 123개(이번 인계 포함)의 파일·ID·연결·열린 상태를 다시 대조했다. 제품 코드는 앞선 전체 검증 뒤 추가로 바꾸지 않았다.
