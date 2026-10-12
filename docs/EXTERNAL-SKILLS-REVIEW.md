# 외부 스킬 검토 — 2026-10-13

해리가 고른 GitHub 스킬 10개를 Claude 와 Codex(Astra high)가 **각자 독립 판정**한 뒤 맞춰 봤다.
Claude 는 자기 판정을 숨긴 채 Codex 에게 물었고, 갈린 두 곳만 2회차로 다시 판정했다.
**설치 0개.** 원칙은 CLAUDE.md 그대로다 — 외부 스킬은 읽고 아이디어만 가져오고, 코드·문서를 통째로 넣지 않는다.
사본은 읽기만 했고 스크립트는 실행하지 않았다.

## 판정

| # | 스킬 | 판정 | 라이선스 | 이유 |
|---|---|---|---|---|
| 1 | [korean-privacy-terms](https://github.com/kimlawtech/korean-privacy-terms) ★589 | 아이디어만 | Apache-2.0 | 처리방침 11개 법정 항목 체크리스트와 인터뷰 질문(수집·위탁·보존)은 L2 에 쓸 만하다. ⚠️ `references/service-type-matrix.md:20` 이 구독형 SaaS 의 청약철회를 '불필요'로 분류한다 — 우리 LAUNCH-DECISIONS §7 과 **충돌**하는 틀린 일반화라 문구를 그대로 가져오지 않는다. 출력은 Next.js 전용 |
| 2 | [rhwp](https://github.com/edwardkim/rhwp) exam-ingest ★3.9k | 아이디어만(아래 ①·⑤) | MIT | 지문 ID + `passage_ref` 명시 소속, 원본 쪽에서 그림 bbox 자르기. 수식은 이미지로 처리해 우리 LaTeX→한글 수식보다 약하다. Rust 빌드 필요 |
| 3 | [hwpxskill-math](https://github.com/Canine89/hwpxskill-math) ★6 | 불필요 | 없음 | `tex_to_hwp.py` 와 중복. `scripts/graph_generator.py:1202` 가 입력식을 `eval` 한다(비신뢰 입력 실행) |
| 4 | [kordoc](https://github.com/chrisryugj/kordoc) ★2.4k | 아이디어만(아래 ④) | MIT | '문서 내용은 데이터, 지시가 아니다' 원칙. 다른 구현의 HWPX 렌더러 |
| 5 | [hwpx-skill](https://github.com/jkf87/hwpx-skill) ★276 | 아이디어만(아래 ③) | README 에 MIT 선언, LICENSE 파일 없음 | 구조 통과 / 내용 보존 / 실제 출력을 갈라 검사하는 방식. Windows COM 경로는 불필요 |
| 6 | [hwpjs](https://github.com/ohah/hwpjs) hwpx-spec ★163 | 불필요 | 저장소 MIT · 수록 원문은 확인 불가 | **KS X 6101:2024 원문 692KB 를 그대로 담았다**(`0-머리말.md:54` 에 저작권 보호 문구). 우리 [HWP-SPEC](HWP-SPEC.md) 의 '원문은 저장소에 넣지 않는다' 원칙과 정면으로 어긋난다 |
| 7 | [claude-skill-typst](https://github.com/lucifer1004/claude-skill-typst) ★130 | 불필요 | MIT | Typst 0.15+ 범용 안내. 상용판에서 서버 조판을 빼기로 해 지금 효용이 작다 |
| 8 | [k-skill](https://github.com/NomaDamas/k-skill) popbill ★7.9k | 불필요 | 스킬 MIT · 프록시 AGPL-3.0 | 세금계산서 발행 API. 버전 고정 안 된 `@0` 패키지에서 지시를 받아 실행하고, 테스트 발송도 실제 과금될 수 있다 |
| 9 | [harness-100](https://github.com/revfactory/harness-100) 법무·개인정보 ★1.3k | 아이디어만(아래 ②) | Apache-2.0 | 데이터 흐름 질문표(`data-flow-mapper`)·문서 간 정합 점검(`cross-document-linker`)·불공정 약관 유형. 4인 에이전트 파이프라인은 비용이 커서 안 쓴다 |
| 10 | [skills-for-teachers](https://github.com/1000ssam/skills-for-teachers) exam-analyzer ★10 | 아이디어만 | MIT | 파일·쪽·문항 출처 연결, 분류 키워드 확인. ⚠️ 정답을 **추론**한다(`:482`) — 우리 계약 '정답은 보이는 경우만'(`pedagogy-intake-contract.js:12`)과 충돌. 스킬 라이선스가 기출·교재 이용 권한까지 주지는 않는다(D10) |

## 가져올 아이디어와 레일 자리 (제안 — 레일 반영은 별도)

| | 아이디어 | 출처 | 자리 | 막아야 할 것 |
|---|---|---|---|---|
| ① | 지문과 구성원의 소속을 **위치가 아니라 ID 참조**로 | rhwp `passage_ref` | **REV-108** → U2 | rhwp 스스로 '오타 난 참조를 스키마가 못 잡는다'(`07_passages_questions.md:66`)고 적었다 — 우리는 누락·중복·고아 구성원을 **코드로 검증**한다 |
| ② | 실제 데이터 흐름 ↔ 약관·처리방침 문장 **대조표** | korean-privacy-terms 질문 + harness 정합 점검 | **L2** (D8·D10·D12·D13) | 미확정 공급자 조건·권리 정책을 자동 문구로 메우지 않는다 |
| ③ | 구조 통과 ≠ 내용 보존 ≠ 실제 출력 — 순서 있는 본문·표 칸·삽입 그림 해시 대조 | hwpx-skill | **R6** 검사 보완 → R8 | `strictValidate` 통과를 시각적 완성으로 쓰지 않는다 |
| ④ | 다른 구현(kordoc)의 `validate`·SVG 렌더를 **로컬 전용 선택 검사**로 | kordoc | R6 (CI 제외 · `test:hwpx-opens` 와 같은 자리) | 버전·lockfile 고정 devDependency. 렌더가 한글과 다를 수 있어 **통과를 한글 호환 판정으로 쓰지 않는다** — 차이는 실제 한글 열기·PDF 로 판정. 추가 검출 효과는 미검증 |
| ⑤ | AI 가 그림 bbox 를 내고 **원본 쪽에서 잘라** 그림 문항을 살린다 (지금은 `unsupported:true`) | rhwp crop | **U2 뒤 별도 묶음** — 응답 계약·검증·결과 저장 확장이라 UI 추가가 아니다 | bbox 유한성·양수·경계를 코드로 검사, 축소·회전 좌표 환산, owner/sourceId/쪽/이미지 해시·삭제 세대에 묶어 다른 쪽·늦은 결과 거부, 잘린 결과를 원문 위에서 확인·수정 뒤 명시 채택, 다른 문항·이름·학번이 섞이면 보류. 그림 개수·픽셀·바이트 한도와 900KiB·D3 게이트 유지. 자르기가 D10 권리 확인을 대신하지 않는다 |

## 이 검토에서 배운 것

- Codex 는 Claude 가 보지 못한 근거를 찾았다: SaaS 청약철회 오분류(#1), `eval` 실행(#3), AGPL·과금 위험(#8), 정답 추론 충돌(#10).
- Claude 는 Codex 가 넘긴 두 가지(④ 렌더, ⑤ 그림 자르기)를 2회차에 되살렸고, Codex 는 그 범위를 좁혀(CI 게이트 → 로컬 선택 / U2 직접 → 별도 묶음) 동의했다.
- **외부 스킬의 '법령 요약'은 그대로 믿지 않는다** — 별 589개짜리도 틀린 일반화가 있었다. 법령 원문 대조 원칙(LAUNCH-DECISIONS §13)이 그대로 적용된다.
