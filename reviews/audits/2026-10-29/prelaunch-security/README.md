# 출시 전1 보안 지적 대조 — 2026-10-29

Sonar API 읽기 전용 조회. 최신 main analysis fc829bff-cdfd-48b6-918c-4bb905a810b3,
revision9cff81d·2026-10-28T09:25:01Z. gate ERROR/new_security_rating5, 미해결 취약점23건.
관련 제품 코드와 origin/main diff0. Git 기본 checkout 전환/제품 수정 없음.

- [전체 지적](issues.json) · [분류](triage.json) · [분석](analyses.json) · [gate](quality-gate.json).
- XML namespace16건: 해당 줄을 모두 직접 읽어 식별자임을 확인. HTTP 요청이 아니다.
- style unsafe-inline3건: script가 아닌 style 잔여 위험. 기존 R1 판정을 재사용하되 위험0으로 쓰지 않는다.
- 로컬 HTTP3건: 기본 loopback·명시 LAN·Host/Origin 방어의 기존 수용 범위. 공개 서버 TLS 보증 아님.
- 새로 추적한 S5131 AaDzlq6Uo2rmfWZ12byK는 이전 HWPX 응답 지적과 ID/flow가 다르다.
  GET /font → find_font → read_bytes → _send이며 MIME은 suffix allowlist의 font/ttf·otf·collection,
  _send는 항상 nosniff다. HTML 본문 응답으로 단정할 근거가 없다.
- [합성 HTTP 확인](font-http-probe.json): HTML 형태 bytes를 담은 임시 .ttf의 고정 MIME/nosniff,
  html 확장자/경로조작 거절·LAN403 확인. 실제 글꼴/사용자 파일은 사용하지 않았다.
  브라우저 실행 검증은 아니며 악성 폰트 파서 취약점까지 안전하다는 뜻이 아니다.
- Python 기본 인증서 저장소 오류 뒤 시스템 curl의 정상 TLS 검증으로 API 회수. TLS 우회 없음.
- inNewCodePeriod 요청에서도 전체23건을 반환해 개별 신규 여부는 추정하지 않았다.

현재 분류는 플랫폼 resolution이 아니다. Sonar OPEN/gate ERROR는 그대로다.
독립 검토 뒤 근거를 반영하고 인증된 Sonar triage 권한/대상 ID를 확인해야 한다.
기존 REV147은 과거 IPC session token 잔여 이력이며 보안 지적과 별도 유지한다.
해당 원문 로그·토큰은 이번에 읽거나 유효성을 시험하지 않았다.

## 독립 검토 최종

Claude opus/high foreground2회 성공. [1차](claude-first-review.md)는 코드 결론에 합의했으나 분석 revision/건수/디코딩 순서/style 전환 불가 주장이 잘못됐다. 구현자가 최신 API/코드를 재대조해 [정정 판정](claude-corrected-review.md)을 회수했다. 최종 합의: 글꼴XSS1+namespace16 오탐, style3+로컬HTTP3 제한적 잔여위험. 과거 재분석 필요 주장/22건 주장 철회. Sonar 플랫폼 상태 반영·출시 게이트 완료는 별개다. 파일 변경으로 동작을 우회하거나 issue를 숨기지 않았다.

## 원격 반영 완료

사용자 새 로그인 완료 뒤 Chrome의 Sonar 계정071205·변경권한을 확인했다. XSS1건과 XML16건은 각각 False positive, 기존 R1에서 수용한 style3/로컬HTTP3은 Accepted로 실제 반영하고 근거·재검토 조건을 기록했다. 위험 수용은 자동재개 Never이며 공개 HTTP나 새로운 신뢰 경계 변경을 승인하는 뜻이 아니다.
[최종 전체23건](all-after.json): FALSE_POSITIVE17/ACCEPTED6. [미해결 조회](after-issues.json)0건, [Quality Gate](after-gate.json)OK·new_security_rating1. 원래 분석 revision9cff81d의 판정 갱신이며 코드 수정/새 분석 실행/규칙 비활성화/기준 완화는 없다. 앞의 OPEN/ERROR 문구는 작업 전 상태다. Sonar 보안 미결만 해소됐고 기존 REV147 이력 위험과 R7/R8 실제 운영 게이트는 남는다.
