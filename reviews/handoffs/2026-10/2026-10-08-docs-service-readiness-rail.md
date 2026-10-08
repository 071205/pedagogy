# 변경 인계 — 서비스 준비 설계와 기존 레일 통합

- ID: `HANDOFF-2026-186`
- 날짜: `2026-10-08`
- 작성자: `Codex`
- 상태: `reviewed` — Claude 검토 2026-10-08: 결함 0 · 보완 권고 3 · 사용자 결정 1(유료 1차 최소 범위)
- 영향 영역: `docs`
- 관련 이슈: `없음` — 기존 열린 이슈 상태 유지

## 변경 내용

사용자가 Claude의 레일 통합을 다시 꼼꼼히 검토하고, 서비스에 필요한 구조·보안·UI·운영을
시장조사/코드 대조로 보완하도록 요청했다. 이번 범위는 설계이며 런타임 구현은 없다.

- [서비스 준비 설계](../../../docs/SERVICE-READINESS-DESIGN.md): 코드 근거 12개 요구, 계정/탈퇴·API·동의·영속 작업·환불·운영 도구·전체 고객 화면·알림/지원·복구·출시 증거.
- [통합 레일](../../../docs/DEV-TOKEN-ROADMAP.md) R9 세부와 [지시문](../../../docs/RAIL-ORDERS.md) ⑮: 기존 F 확장, F3c·L4·D12/D13 추가. F3a는 R5 후, F4 뒤 R8 결제 확장, F5 준비→R10 판정→승인된 활성화. 다음 U1.5 유지.
- 결제 설계 2개·시장조사·출시 게이트·보안 운영 체크리스트·런북을 연결했다. 기존 185 합의를 이번 확장 승인으로 승격하지 않았다.

변경 파일은 11개다: `docs/SERVICE-READINESS-DESIGN.md`, `docs/DEV-TOKEN-ROADMAP.md`,
`docs/RAIL-ORDERS.md`, `docs/BILLING-FOUNDATION-DESIGN.md`, `docs/BILLING-ARCHITECTURE.md`,
`docs/LAUNCH-DECISIONS.md`, `docs/COMMERCIAL-LAUNCH.md`, `docs/SECURITY-OPERATIONS-CHECKLIST.md`,
`docs/OPERATIONS-RUNBOOK.md`, `reviews/INDEX.md`, 이 인계 파일.

코드 대조의 주요 근거는 `worker/auth.js:verifyIdToken`, `worker/index.js:dailyLimit`/quota/intake gate,
`index.html:deleteAccountEverything`/`recordConsent`/`updatePlanBadge`/export, Firebase 직접 쓰기 Rules,
`scripts/check-launch-readiness.mjs`다. 기존 코드의 새 취약점을 재현했다고 주장하지 않으며,
향후 서비스 확장의 필수 구조와 현재 구현 범위를 구별했다.

## 위험과 검토 요청

1. 서버 탈퇴의 단계별 재개와 현재 기기 B6/B7·B5 확인 후 Auth 삭제하는 U0 계약이 양립하는지.
   PG 장애로 개인자료 파기를 무기한 막지 않되, 원격으로 모든 기기 IDB를 지웠다고 표시하지 않는다.
2. 현재 계정 상태를 Worker/Firebase 직접 쓰기 양쪽에 적용하는 전환, 오래된 토큰/claim·삭제·복구 경합.
3. 영속 청구/환불/claim/알림 작업, 단일 DO alarm/재시도 소진/색인 불일치·PG 멱등 창 이후 대조.
4. F1/F2 격리 예외와 F3a→F3b→F3c→F4, R8 결제 확장→F5→R10 의존성이 순환하지 않는지.
5. 공식 자료와 제품 판단의 구별. NOVA 월 가격, Gemini API 연령/데이터 조건, 호스트 승인안의 일치.
   무료 체험=환불 요건 충족, 소표본=손익 증명, 무료 SaaS=Pages 허용이라는 단정을 제거했다.

공식 조사 링크/해석은 서비스 설계 §3~§10에 남겼다. 기존 시장조사의 모든 경쟁사·PG 견적·법률
쟁점을 전수 검증한 것은 아니다. 재확인하지 않은 가격/수수료는 잔여 자료로 표시했다.
독립 검토 후 구현은 별도 요청으로 시작하며, UI는 상태/접근성 계약까지이고 시각 시안은 아직 없다.

## 검증

- `npm run check:static`: **pass**. 리뷰 위생(이슈 117/열림 4, INDEX 119/120줄, 최근 5/5,
  자기검사 6/6), 상용 정적/출시 검사기 자체 테스트, 접근성 35개, 문서 블록/디자인 토큰/조판 역할 검사 통과.
  로그: `/tmp/service-readiness-static.log`.
- `npm run check:launch`: **기존 차단 8건으로 예상 실패(exit 1)**. site key·지원 이메일·법무 버전·결제 포털·
  legal TODO·유료 AI 상한·App Check enforce·localhost origin. 설정 파일 변경 없음.
  로그: `/tmp/service-readiness-launch.log`. 이는 출시 불가 상태 확인이며 신규 실패 주입 테스트가 아니다.
- 변경 Markdown 11개 상대 파일 링크 **115개 pass**, 새 파일 포함 공백 검사 pass.
- `git diff --check`: **pass**. 새 F3c/L4/D12/D13 참조·기존 다음 U1.5·F4 후 R8/F5/R10 순서를 대조.
- 브라우저·Worker 실행 검사는 문서 전용 변경이라 재실행하지 않았다. sandbox 실패로 분류하지 않는다.
- 런타임/Rules/비밀/배포 설정·package scripts는 변경하지 않았다. Worker intake 503 유지.
- 신규 실행 검사는 만들지 않았다. 수용 검사와 red mode 요구를 후속 구현 묶음에 배정했다.
- 실기기/브라우저·실계정·PG·AI·메일 발송·운영 백업/복원·법률/세무 적격성은 이번에 검증하지 않았다.

## 다음 검토자에게

Claude Opus가 `6af3c91` 이후 작업 트리의 문서 diff와 새 서비스 설계를 독립 검토해 주세요.
핵심 입력은 서비스 설계, 통합 레일 R9 세부, 지시문 ⑮, 결제 기반 §7~§9,
저장 계약/U0 삭제 계약이다. 나머지 문서는 이 설계와 연결된 변경 부분만 대조하면 된다.
이전 HANDOFF-185의 합의는 유지하고 이번 확장 판단은 이 파일에 기록한다.
커밋·배포 없음. `transcript.txt`는 열거나 수정/추가하지 않았다.

## 검토 기록

**Claude(Opus 5.5) 검토 · 2026-10-08.** 새 설계 전문과 `6af3c91` 이후 문서 diff 9개를 읽고 근거를 직접 대조했다.

확인한 주장(맞음):
- `worker/auth.js:54-79` 는 서명·시간만 보고 폐기(revocation)를 조회하지 않는다. `firestore.rules:168` 의 `prefs/consent` 는
  본인이 덮어쓴다 — 서버 동의 증적으로 승격할 수 없다는 판단에 동의.
- 호스트: `SECURITY-ARCHITECTURE.md:23`·`SECURITY-OPERATIONS-CHECKLIST.md:20` 이 이미 **Workers Static Assets** 를 골라 두었다.
  내가 LAUNCH-DECISIONS 에 쓴 'Cloudflare Pages 추천'이 그 결정과 어긋나 있었다 — **내 오류이고 정정이 맞다.**
- Gemini API 추가 약관의 **18세 미만 대상·접근 가능 API client 제한**을 확인했다(현행·2024 판 모두). 14세 가입 기준과 충돌하므로 D12 신설에 동의.
- 토스 멱등키 **15일**: 공식 문서 원문 확인("처음 요청에 사용한 날부터 15일간 유효").
- LAUNCH-DECISIONS '혼합 모델'이 R2 자동 라우팅 금지에 걸린다는 지적 — 맞다.
- 탈퇴: `PRODUCT-UX-U0-CONTRACT.md:246` 의 '로컬 정리·B5 파기 확인 뒤 Auth 삭제' 순서를 유지하면서 PG 정리를 독립 작업으로 뗐다 — 양립한다.
- 순환 없음: R5 → F3a → F3b → F3c → F4 → R8 결제 확장 → F5 → R10 → 승인된 활성화. L3 는 R7·L2 뒤.

보완 권고(결함 아님):
1. **유료 1차 최소 범위가 없다 — 사용자 결정.** F5 선행에 F3c 운영 도구(MFA·감사), L4(SPF/DKIM/DMARC·RPO/RTO 리허설),
   ReleaseManifest, 고객 화면 전 여정(카드 교체·영수증·환불 UI)이 **전부 동시에** 걸렸다. 1인 운영·소수 유료 사용자로
   시작할 때도 같은 문턱이다. 요구 목록 자체는 맞으니 SR 표에 '유료 1차 필수 / 규모 확장 때' 열을 두고, 1차는 PG 호스팅
   화면·비공개 CLI·PG 콘솔 대조 등으로 대체할 수 있는 항목을 가르자. 경계는 해리 결정.
2. **직렬이 필요 이상이다.** F3c(Codex)는 F3b(Claude) merge 를 기다릴 이유가 코드에 없다 — 구현자가 다르고 파일이 겹치지 않으면
   F3a 뒤 병행할 수 있다. F4 sandbox 도 F3a 의 장부 연결이 핵심이고 운영 도구가 선행일 필요는 없다(R8 결제 확장 전에만 모이면 된다).
3. **LAUNCH-DECISIONS §5 의 구체 사실이 지워졌다.** '간이과세자 중 직전 연도 4,800만 원 미만은 세금계산서 발급 불가'와
   '간이과세자 통신판매업 신고 면제'는 추천의 근거였는데 일반론('확인한다')으로 바뀌었다. ⚖️ 표시를 단 채 사실로 되살리는 편이 낫다.
4. (명확화) '무료 공개도 Pages 예외 아님'이 **지금 운영 중인 무료 사이트**에 무엇을 요구하는지 쓰이지 않았다.
   '현행 무료 운영은 유지, 공개 확대·홍보 전 R7' 처럼 현재 상태의 처리 한 줄이 필요하다(제품 결정).

186 번호는 다른 브랜치와 겹치지 않는다. `check:review-hygiene` 통과.

**반영 · 2026-10-08 (Claude 구현 → Codex Astra high 검토).** 해리 결정 **A — 출시 2단계(P1 초대 유료 베타 → P2 공개 판매)**.
권고 1은 이 결정으로 닫았다: R9 세부 표의 완료 조건을 P1/P2 로 가르고, P1 에서도 줄이지 않는 것(결제 정확성·재동의·
약관/처리방침/환불·연령·탈퇴·권한·R7)을 명시했다. 권고 2: F3c·F4 선행을 F3a merge 로 풀고 F3b 와 병행 가능하게 했다.
권고 3: LAUNCH-DECISIONS §5 세무 사실을 조문과 함께 되살렸다. 권고 4: 지금의 무료 운영은 유지·홍보 확대는 R7 뒤.
해리 지시로 법무·세무는 Claude↔Codex 교차 작성·법령 대조로 덮는다 — LAUNCH-DECISIONS §13(표준약관·작성지침·공공 무료 창구).
Codex 검토: 세 세무 사실 law.go.kr 원문 대조 일치, 단 제36조 인용 위치 정정(제1항 제2호 가목) · ⑮-F2 알림 단계 표기 정정 —
둘 다 반영했고, 콘솔 환불 → 장부 → 권한 회수 수렴을 F4 완료 조건에 명시했다. 불변조건 파손·순환 없음.

