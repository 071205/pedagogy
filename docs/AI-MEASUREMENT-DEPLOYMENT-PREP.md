# OPS-6 — AI 측정 배포 준비 묶음

작성: 2026-09-13. 이 문서는 배포·설정 변경·실제 AI 호출을 실행하지 않은 읽기 전용 준비 기록이다.
목표는 기존 Worker 측정 코드를 승인된 격리 환경에서 검증할 수 있게, 확인 사실과 미확인 사실·최대 호출
범위·복귀 조건을 한곳에 고정하는 것이다.

## 현재 확인한 범위

| 항목 | 로컬에서 확인한 사실 | 운영에서 아직 확인할 사실 |
| --- | --- | --- |
| API 주소 | 문제·문서 화면은 `https://dawn-shape-2664.dbruddl79.workers.dev`를 사용한다. 공개 `GET /health`는 2026-09-13에 `{"ok":true}`를 반환했다. | 이 주소가 production인지, 어떤 Worker version을 가리키는지, 실제 배포 코드가 `caa22f6`과 같은지는 미확인이다. |
| Worker 배치 | `worker/wrangler.toml`은 `dawn-shape-2664`, `QUOTA` Durable Object, migration `v1`을 선언한다. 별도 staging environment·route·custom domain 선언은 없다. | 실제 `QUOTA` binding/migration, 다른 Worker의 전역 quota 공유 여부, preview/workers.dev 우회 차단은 미확인이다. |
| AI 설정 | 로컬 기본 모델은 `claude-haiku-4-5`, 두 경로의 `max_tokens`는 4096, 사용자/전역 일일 상한은 50/5000, kill switch는 0이다. | 배포 변수 override, 실제 모델 ID, plan 상한, `ANTHROPIC_KEY` 연결·범위, Anthropic 지출 제한·알림은 미확인이다. secret 값은 이 문서에 기록하지 않는다. |
| 측정 | `ai_usage`는 작업·모델·입출력 토큰·중단 사유·시간·결과·HTTP 상태만 기록한다. 로컬 `head_sampling_rate`는 0.1이다. | 플랫폼 로그 보존 기간·실제 표본률·로그 접근자와 원문 비노출 경계는 미확인이다. |
| App Check | 클라이언트 전송·Worker 검증 코드는 있으나 로컬 설정은 `APP_CHECK_MODE=off`다. | staging/production의 site key, monitor/enforce 상태와 정상·거절 비율은 미확인이다. |

`GET /health`는 AI key·quota·측정·App Check를 거치지 않는다. 따라서 이 응답은 endpoint 도달만 뜻하며,
배포 version이나 AI 호출 준비 완료를 증명하지 않는다.

## 합성 검증 제안과 최대 비용

승인된 **격리 staging**에서만 권장한다. 운영 사용자 자료·실계정 자료는 사용하지 않는다.

| 항목 | 제안 |
| --- | --- |
| 자료 | 권리 문제가 없는 작은 합성 PNG 1개, 개인정보가 없는 짧은 한국어 문서 요청 1개 |
| 호출 수 | 문제 이미지 1회 + 문서 1회, 합계 최대 2회. 자동 재시도·수동 반복 없음. 인증·quota·JSON 실패 주입은 이미 로컬에서 검증했으므로 유료 호출로 반복하지 않는다. |
| 측정 확인 | task별 `ai_usage`의 안전 필드만 확인한다. 기존 10% 표본으로는 2회에서 이벤트가 없을 수 있으므로, staging에서만 100% 표본으로 올리고 검증 직후 10%로 복원하는 변경을 승인 묶음에 포함한다. production 표본률은 바꾸지 않는다. |
| 출력 비용 상한 | Haiku 4.5의 현재 출력 가격은 $5/MTok이며 각 요청 출력 상한은 4096이다. 따라서 2회 출력 성분의 최대는 `2 × 4096 × $5 / 1,000,000 = $0.04096`이다. [공식 가격](https://www.anthropic.com/pricing) 기준 확인일: 2026-09-13. |
| 입력 비용 | Haiku 4.5의 현재 입력 가격은 $1/MTok이다. 이미지의 실제 시각 토큰과 배포된 system prompt·문서 토큰은 호출 전 정확히 알 수 없어, 위 $0.04096은 총액 상한이 아니라 출력 성분 상한이다. Worker는 이미지 본문 8MiB와 문서 입력 길이를 제한하지만 금액 단위의 입력 예산을 강제하지 않는다. |

2026-09-13에 사용자는 **격리 staging만**, 합성 이미지 1회·문서 1회(총 2회), 자동 재시도 금지,
총 $1 한도, production 배포·설정 변경·실사용자 데이터 접근 제외를 승인했다. 이 승인은 staging
대상과 분리된 자격 증명이 확인된 경우에만 적용된다.

현재 코드의 호출 quota는 금액 상한이 아니며, `GLOBAL_DAILY_LIMIT=5000`도 Anthropic 청구액을 보장하지 않는다.

## 실행 전 읽기 전용 확인 목록

1. staging Worker URL/version, staging Firebase project/App Check app ID, staging Anthropic key가 production과 분리됐는지 확인한다.
2. staging Worker의 `QUOTA` binding과 migration, `DAILY_LIMIT`·`GLOBAL_DAILY_LIMIT`·`AI_KILL_SWITCH`,
   `AI_MODEL`, observability 표본률을 값을 노출하지 않는 방식으로 기록한다.
3. deploy 직전의 Worker version ID, 정적 산출물 commit/manifest, App Check mode, 사용 가능한 롤백 version을 기록한다.
4. Anthropic Console에서 해당 key/workspace의 모델 접근, 사용량 알림·지출 한도·자동 충전 상태를 확인한다.
5. Cloudflare Logs의 접근 권한·보존 기간과 `ai_usage` 이외 원문/헤더를 열지 않는 검토 절차를 확인한다.

현재 저장소에는 staging 대상과 위 운영 콘솔 접근 증적이 없으므로 이 목록은 미완료다. 임의로 계정·키·환경을
만들거나 production의 변수를 바꾸지 않는다.

## 승인 뒤의 한 번의 실행 범위와 복귀

승인을 받으면 별도 OPS-7에서 다음 순서로만 실행한다.

1. 승인된 staging에 현재 Worker를 배포하고 version ID·설정 차이·바로 전 rollback version을 기록한다.
2. staging 표본률을 승인 범위에서 100%로 설정하고, 합성 이미지·문서 요청을 각 1회 실행한다.
3. 응답 결과, 인증 거절 경계, quota, `ai_usage` 안전 필드와 Anthropic Console 사용량을 대조한다.
4. staging 표본률을 10%로 복원하고, 이상이 있으면 직전 Worker version으로 되돌린다.

production은 별도 대상 승인 없이는 배포·호출·표본률 변경을 하지 않는다. rollback은 frontend와 Worker의
App Check 계약을 함께 유지해야 하며, 진행 중인 공급자 요청이나 이미 발생한 비용을 취소하지 않는다.
