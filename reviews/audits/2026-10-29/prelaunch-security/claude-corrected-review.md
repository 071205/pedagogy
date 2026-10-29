## 정정 동의 (S5131 평가 유지, 오류 3건 철회)

**합의:** S5131 코드 판정은 귀하의 독립 HTTP 프로브와 일치합니다 — `font/ttf` + `nosniff`, html/traversal 거부, LAN 403.

**1. 분석 메타데이터 — 철회합니다.**
최신 main 분석은 `fc829bff-cdfd-48b6-918c-4bb905a810b3`, 2026-10-28, revision `9cff81dd7fa3501aed7e59c4849dcfe72997d473`입니다. 제가 인용한 `6adf121`은 오류이며, origin/main 대비 소스 diff는 0이므로 **stale 가정과 재분석 요구를 모두 철회**합니다. 미해결 VULNERABILITY는 **23건** (font XSS 1 + namespace 16 + style 3 + local HTTP 3)이고, 이 23건에 **S8707은 없습니다**. 게이트 ERROR 사유는 `new_security_rating` 5입니다. 이전 건수 주장도 철회합니다.

**2. 순서 주장 — 철회합니다.**
`serve.py:503`의 `unquote`는 whitelist 이후가 아니라 **`find_font` 호출보다 앞섭니다**. 실제 제약은 `find_font:190-207`의 정확한 이름/확장자 일치와 resolved parent 검증입니다. 네임스페이스 식별자는 hancom뿐 아니라 **idpf.org도 포함**됩니다.

**3. style hash — 철회합니다.**
"불가능"이 아니라 **속성 리팩터링이 필요한 작업**입니다. R1 리뷰(9/23)가 local HTTP/style의 제한적 잔여 위험을 이미 수용했으므로, 선행 수용이 없었다는 추론과 읽기 전용 문서/프로브에 새 허가가 필요하다는 요구를 철회합니다. Sonar 상태 변경은 수행하지 않았고, 익명 읽기에서 transitions/actions는 비어 있었습니다.

**한계:** 본 판정은 Sonar 게이트를 자동으로 닫지 않으며(ERROR, 미해결 23건 유지), 프로덕션 출시 전반의 안전성을 입증하지도 않습니다.
