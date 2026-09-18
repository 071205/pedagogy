# 상용화 감수서와 실제 코드의 대조

2026-09-14 · 기준 HEAD `6f4f828` · 제품 코드 변경 없는 정적 대조와 출시 검사.
외부 입력: [PEDAGOGY 감수서](https://claude.ai/code/artifact/2811cfbb-0cdb-4e5c-a785-b78e6921ea76).
분석용 사본에서는 사용자 의도로 주석·핸드오프·검사 자료 등을 제외했다. 설명을 기능 증거로
취급하지 않되, 빠진 자료를 미구현으로 판정하지도 않는다. 줄 수 차이만으로 구버전이라고 할 수 없다.
감수서의 65%·기간 추정·경쟁 우위는 검증된 측정치가 아니므로 완료 기준으로 사용하지 않는다.

진행 상태와 다음 순서는 오직 [통합 레일](DEV-TOKEN-ROADMAP.md)에 둔다.

| 지적 | 실제 코드에서 확인한 범위 | 남길 작업 |
| --- | --- | --- |
| 결제 없음 | `service-config.js`의 `billingPortalUrl`은 비었고 Worker의 `pedagogy_plan` 소비와 서버 발급은 별개다. 결제 설계 문서는 구현 증거가 아니다. | REL-14: 서버 원장·webhook·권한 회수·결제 E2E. 사업/PG 결정 필요 |
| 로컬 Typst 의존 | `serve.py`의 `find_typst`·컴파일 경로는 로컬 실행 의존. 별도 `hwpx-engine.js`·`hwpx-document.js` 브라우저 경로도 존재한다. 제품 전체가 서버 없이는 불가능하다는 뜻은 아니다. | REL-11/13: 웹/로컬 지원 범위와 실제 출력 검증. 클라우드 Typst 이전은 자동 채택하지 않음 |
| 다중 기기 덮어쓰기 | `index.html`의 `mergeSets`·`mergeMocks`는 시각 기반 전체 항목 선택. `writeCloudSnapshot`은 문서 전체 batch.set이며 서버 revision 충돌 검출 없음. snapshot 수신 시 안내·로컬 저장은 있으므로 모든 손실이 무음이라는 표현은 과장이다. | REL-12: 충돌 사본/복구 보장과 두 기기 재현. 단순 서버 시각 치환으로 종료하지 않음 |
| Firestore 단일 문서 크기 | `setToDoc`는 problems 배열 포함, Rules는 20,000문항 상한. `writeCloudSnapshot`에 용량 실패 안내가 있고 모의고사는 `MOCK_DOC_MAX=900*1024` 사전 검사가 있다. 문제집의 선제 크기 방어는 별도다. | REL-12: 경계 크기·일부 배치 실패·export 확인. subcollection은 수용량 근거가 있을 때 선택 |
| App Check 미가동 | `service-config.js` site key 공란, `worker/wrangler.toml` mode off. 클라이언트 전달·Worker verifier와 회귀는 구현돼 있다. staging 등록은 enforce 증거가 아니다. | REL-13: 실제 발급·monitor→enforce·자원별 거절 증적. 비용 smoke에도 6B 계약 확인 |
| 제품 관측 부족 | `worker/index.js`의 `aiTelemetry`는 안전한 공급자 호출 메타데이터다. 이것으로 저장·출력 퍼널/재방문을 측정할 수 없다. | REL-13: 최소 성공/실패 관측·보존/접근 정책. 추적 SDK·개인 식별 자동 도입 금지 |
| 큰 파일·중복 엔진 | 파일 크기 자체는 결함이 아니다. `scripts/check-hwpx-browser.mjs`는 브라우저/Python 의미 대조를 구현하며 CI에도 연결돼 있다. 모든 조판의 실물 일치를 보장하지는 않는다. | 전면 분할 보류 유지. REL-13에서 공통 fixture·동등성 검사와 미검증 출력 경계 보강 |
| 테스트/CI 불명 | `package.json`과 `.github/workflows/verify.yml`에 Worker·Rules·브라우저·HWPX 검사가 존재한다. 분석본 누락은 테스트 부재가 아니다. CI 일부 visual/실물 템플릿 비교 제외와 실제 인증 검증은 별개다. | 새 체계 재구축 대신 기존 검사 재사용. 최신 실행/skip·실기기 증거는 따로 확인 |
| 영어 UI·팀/학원 상품 | `team`/`academy` 라벨은 공동 편집·좌석 구현의 증거가 아니다. 일부 번역은 완전한 다국어 지원 증거가 아니다. | REL-11: 한국어 개인용 범위를 제안. 협업·다국어·문제은행은 별도 사업 결정 |

## 이번 검증과 한계

- `npm run check:launch`: 종료 코드 1. site key, 지원 이메일, 약관 버전, 결제 포털,
  법무 TODO, 유료 플랜 AI 한도, Worker enforce, production localhost의 8개 차단을 확인했다.
  저장소 기본 설정에 대한 검사이며 원격 배포본 상태를 증명하지 않는다.
- 저장 병합/크기 문제는 실제 함수·쓰기/오류 경로를 대조했다. 이번에는 두 기기 실계정 재현이나
  데이터 손실 실험을 하지 않았으므로 새 재현 이슈/해결 승인을 만들지 않았다.
- 테스트 존재·CI 연결 확인과 전체 검사 재실행을 구별한다. 이번은 문서만 변경하므로 제품 회귀는
  재실행하지 않았다. 열린 REV-074·075를 해결된 것으로 바꾸지 않았다.
- Gemini 연결과 제품 적합성은 아직 검증 전이다. 2회 smoke 호출로 모델 우열이나 절감률을 만들지 않는다.
  유료 출시·production 변경·실사용자 초대는 이번 승인 밖이다.
