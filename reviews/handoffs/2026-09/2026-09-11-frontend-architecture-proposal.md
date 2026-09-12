# 프론트엔드 아키텍처 개편 제안서 (Frontend Architecture Proposal)

- ID: `HANDOFF-2026-120`
- 검토: `HANDOFF-2026-122` · 아래 후속 판정 참조

- **작성:** Antigravity
- **대상:** Codex 및 다음 작업자
- **관련 문서:** `docs/COMMERCIAL-LAUNCH.md`, `scripts/build-public.mjs`

## 1. 현재 아키텍처의 한계와 위험성

현재 `index.html`은 전체 8,035줄 중 약 **5,650줄이 단일 인라인 `<script>`**로 작성되어 있습니다.
외부로 분리된 `pedagogy-*.js` 스크립트들도 전역(Global) 네임스페이스를 오염시키는 방식으로 로드되고 있습니다.

이러한 Monolithic(단일 구조) 바닐라 JS 방식은 상용 SaaS 단계에서 다음 세 가지 큰 문제를 일으킵니다.

1. **초기 로딩 지연 (Performance Bottleneck):**
   사용자가 페이지에 접속할 때 당장 쓰지 않는 기능(예: 인쇄 로직, HWPX 생성 로직)까지 모두 다운로드하고 파싱해야만 인터랙션이 가능해집니다.
2. **유지보수성 한계 (Spaghetti Code):**
   하나의 파일 안에 API 통신(Firebase/Cloudflare), 상태 관리(State), DOM 이벤트 리스너, 렌더링 로직이 모두 뒤섞여 있어, 한 부분을 고치면 다른 곳이 예상치 못하게 깨지기 쉽습니다.
3. **테스트의 어려움:**
   함수들이 전역 환경과 DOM에 강하게 결합되어 있어, 독립적인 Unit Test 작성이 불가능에 가깝습니다. (현재 Node `vm` 모듈이나 Playwright를 통해 우회적으로 테스트 중)

---

## 2. 단계별 리팩토링 설계 (개선 계획)

위험을 최소화하면서 프론트엔드를 현대화하기 위한 3단계 마이그레이션 계획입니다.

### Phase 1: ES Module (ESM) 도입 및 파일 분리
현재 브라우저들은 ES Modules를 완벽하게 지원합니다. 빌드 툴 없이도 즉시 적용할 수 있습니다.

- **작업 내용:**
  1. `index.html`의 거대한 인라인 스크립트를 `editor-app.js` 등 별도 파일로 분리.
  2. 모든 `<script src="..."></script>`를 `<script type="module" src="editor-app.js"></script>` 구조로 전환.
  3. `pedagogy-normalize.js`, `pedagogy-render.js` 등에서 전역 함수를 제거하고 `export` / `import` 문법을 사용해 의존성을 명확히 함.
- **기대 효과:** 전역 변수 충돌 방지, 코드 가독성 대폭 향상, 독립적인 단위 테스트(Unit Test) 가능성 열림.

### Phase 2: 지연 로딩 (Lazy Loading) 적용
초기 진입 속도(FCP, TTI)를 개선하기 위한 조치입니다.

- **작업 내용:**
  1. 처음 화면을 그릴 때 필요한 뼈대 로직(DOM 초기화, Auth 확인 등)만 먼저 로드.
  2. 사용자가 **"HWPX 내보내기"** 또는 **"인쇄"** 버튼을 눌렀을 때 비로소 `import('./hwpx-engine.js')`나 `import('./pedagogy-print.js')`를 동적으로 호출하여 로드.
  3. KaTeX 등 외부 의존성도 초기 화면 렌더링에 당장 필요하지 않다면 Defer/Async 또는 Dynamic Import로 미룸.
- **기대 효과:** 초기 파싱해야 할 자바스크립트 용량 절반 이하로 감소. 네트워크 페이로드 감소.

### Phase 3: 로직(State)과 뷰(DOM)의 분리
5,600줄의 JS가 비대해진 핵심 원인은 상태 데이터와 UI 조작이 섞여 있기 때문입니다.

- **작업 내용:**
  1. **Data Layer (상태):** 현재 문제집/모의고사 데이터 JSON 구조를 관리하는 순수 자바스크립트 클래스/함수 집합으로 분리.
  2. **API Layer (통신):** Firebase Auth, Storage, Cloudflare Worker 통신부 격리.
  3. **UI Layer (렌더링):** State 변경을 감지하고 DOM을 갱신하는 영역. (향후 Web Components나 Lit 같은 초경량 라이브러리 도입을 고려할 수 있는 기반 마련)

### Phase 4: Build 파이프라인 최적화 (선택/추후)
현재 `scripts/build-public.mjs`가 단순 복사 위주로 동작하고 있습니다. ES Module로 쪼개진 파일들을 `esbuild`나 `rollup`을 통해 묶어주고(Bundling) 난독화(Minification)해주면 브라우저 네트워크 요청 횟수까지 줄일 수 있습니다.

---

## 3. Codex(다음 작업자)를 위한 착수 가이드

이 문서를 확인했다면, **Phase 1 (ES Module 분리)**부터 시도를 권장합니다.

1. `index.html` 하단의 5,600줄짜리 인라인 스크립트를 `editor/main.js` 파일로 그대로 빼냅니다.
2. 기존 전역 변수로 작동하던 `pedagogy-*.js` 파일들 끝에 `export { ... }`를 달아 모듈화합니다.
3. `index.html`에서는 `<script type="module" src="editor/main.js"></script>` 하나만 호출하도록 변경합니다.
4. **주의사항:** 기존 `scripts/check-*.mjs` 테스트들이 정규식이나 `vm`을 써서 인라인 스크립트를 테스트하고 있을 가능성이 큽니다. 모듈 분리 시 이 테스트 스크립트들도 `import` 기반의 정상적인 테스트로 고쳐지거나, 모듈을 직접 로드하는 방식으로 리팩토링 되어야 합니다. (이것이 가장 큰 허들이 될 것입니다.)

## 독립 검토와 적용 결과 (2026-09-11 · Codex)

- 전역을 일괄 ESM으로 바꾸는 제안은 현재 `file://` 계약과 맞지 않아 그대로 채택하지 않았다. 모듈은 file 출처에서 CORS 제한을 받고, 기존 함수/lexical scope·iframe·회귀의 공개 표면을 별도로 이관해야 한다.
- 공개 빌드에서 인라인 JS 5개를 외부 고전 스크립트로 추출했다. 순서와 바이트를 보존하고 공개 script-src의 unsafe-inline을 제거했다. 세 엔진에서 실제 편집·인쇄·모의고사 저장·HWPX·file 실행을 검증했다.
- 본체는 HWPX를 초기 로드하지 않고 모의고사 iframe 진입 후에 로드한다. `pedagogy-print.js`는 미리보기에서도 쓰므로 인쇄 버튼 때만 로드하면 안 된다. 제안의 초기 파싱 절반 감소는 측정값이 아니며 구현 효과로 주장하지 않는다.
- 소스 전체의 ESM/상태·뷰 재작성과 번들링은 이번에 구현하지 않았다. 안전한 분리 단계는 공개 빌드에 적용 완료했다.
- 근거: [MDN Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [후속 검토](../../audits/2026-09-11/FOLLOWUP-REVIEW.md).
