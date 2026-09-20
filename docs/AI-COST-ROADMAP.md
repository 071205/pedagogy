# 서비스 AI 비용 레일 이관 안내

2026-09-13: 사용자 요청으로 기존 독립 레일을 해체하고 필요한 내용을
[통합 비용 개선 레일](DEV-TOKEN-ROADMAP.md)에 흡수했다.
이 파일에는 별도 현재 단계·재개 조건·실행 순서를 두지 않는다.
2026-09-20 개정에서 OPS-7~10은 활성 레일의 C1~C3로 흡수했다.
아래 표의 DEV/OPS ID는 과거 이관 대응 기록이며 현재 실행 순서는 활성 레일을 따른다.
“비용 개선 레일대로 다음 단계 진행해”는 통합 문서의 현재 위치를 따른다.

| 기존 내용 | 처리 |
| --- | --- |
| A·B 로그 검사·독립 검토 | 완료 결과 보존. 다시 구현하거나 반복 승인하지 않음 |
| C 배포 준비 | 통합 OPS-6으로 흡수. 기존에는 문서 탐색만 수행 |
| D 실환경 확인 | 통합 OPS-7로 흡수. 실제 배포·호출 승인 경계 유지 |
| E 표본 분석 | 통합 OPS-8로 흡수 |
| F 출력 한도 판단 | 통합 OPS-9로 흡수. 근거가 없으면 4096 유지 |
| G·H 공급자 비교·어댑터 | 통합 OPS-10의 필요성 판단·조건부 실행으로 축소 |
| I 프런트 분리 | 통합 DEV-1~5에 흡수 |

측정 코드·일일 quota·원문 비노출 검사와 기존 검증 증거는 삭제하지 않았다.
완료 증거는 [HANDOFF-124](../reviews/handoffs/2026-09/2026-09-13-worker-ai-usage-observability.md),
[125](../reviews/handoffs/2026-09/2026-09-13-worker-ai-usage-observability-followup.md),
[126](../reviews/handoffs/2026-09/2026-09-13-ai-cost-roadmap-review.md),
[127](../reviews/handoffs/2026-09/2026-09-13-ai-cost-roadmap-test-coverage.md)에 남아 있다.
통합 변경 기록: [HANDOFF-128](../reviews/handoffs/2026-09/2026-09-13-development-token-rails.md).
과거 인계의 “다음 C” 또는 “서비스 별도 재개” 문구보다 통합 레일의 현재 위치가 우선한다.
