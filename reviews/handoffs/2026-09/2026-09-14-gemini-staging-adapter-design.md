# 변경 인계 — OPS-6A Gemini staging 어댑터 설계

- ID: `HANDOFF-2026-137`
- 날짜: `2026-09-14`
- 작성자: `Codex / Astra high`
- 상태: `ready-for-review`
- 영향 영역: `docs`
- 관련 이슈: `없음` (열린 REV-074·075 상태 유지)

## 변경 내용

[어댑터 설계](../../../docs/GEMINI-STAGING-ADAPTER-DESIGN.md)에 실제 Worker 계약·Google 공식 자료를
대조해 변경 파일·환경 선택·오류/측정 매핑·비용 전제·회귀/실패 주입·복귀를 고정했다.
[통합 레일](../../../docs/DEV-TOKEN-ROADMAP.md)의 사용자 중단을 재개 요청에 맞춰
**설계 완료·Terra medium 구현 대기**로 바꾸고 준비 기록/INDEX를 연결했다.

## 위험과 검토 요청

Gemini 직접 GIF는 quota 전 400, 잘림/차단은 502로 명시했다. 기존 브라우저는 JPEG 전처리한다.
Gemini에만 thinking_tokens 로그 키를 추가하고 Anthropic 10키 계약은 유지하도록 설계했다.
4096/생각0은 smoke 설정이지 품질 채택 결론이 아니다. 실제 staging 모델 접근·키·App Check와
전체 $1 비용 조건은 OPS-6B에서 확인한다. 실사용자 자료 적격성과 production 채택은 미완료다.

## 검증

- 실제 createWorker/callAI/callDocumentAI/aiTelemetry, quota 소비 순서, 문서 validator, 이미지 전처리,
  기존 계약/원문 누출 변이 검사와 package 연결을 대조했다.
- Google 모델·종료 일정·가격·생각·REST·이미지 형식·키·추가 약관을 조회했다. 출처는 설계에 연결했다.
- check:review-hygiene 종료0: 열린 이슈2 양방향 일치·INDEX62/120줄·최근5/5·자기검사6/6.
- git diff --check 종료0. 이번 문서5개의 상대 링크 대상32개 존재 확인, 비용 산식2개·현재 위치/인계 일치 확인.
  외부 링크/anchor 전체 자동 검사는 아니며 기능/검사 코드는 무수정이므로 제품 회귀는 재실행하지 않았다.
- 이번 원격 콘솔 변경/배포/AI 생성 호출 0회. 사용자 transcript.txt와 이전 턴 문서 변경을 보존했다.

## 다음 검토자에게

Terra medium은 설계 §2 범위만 오프라인 구현하고 §7 회귀/실패 주입을 확인한다. 실제 키 없이 착수 가능하다.
구현 인계 뒤 Sol medium이 독립 검토한다. 두 단계가 끝나기 전 OPS-6B/7 실배포로 넘어가지 않는다.
기존 staging 합성 이미지1+문서1·누적2회/$1·재시도금지·production제외 승인은 유지한다.

## 검토 기록

- 2026-09-14 · Codex 자체 검증 · 문서 링크·비용 산식·레일/인계 일치·리뷰 위생 확인 · 설계 완료, 독립 승인 아님.
