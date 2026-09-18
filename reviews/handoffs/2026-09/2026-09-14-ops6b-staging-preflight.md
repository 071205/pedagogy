# 변경 인계 — OPS-6B staging 배포 preflight

- ID: `HANDOFF-2026-140`
- 날짜: `2026-09-14`
- 작성자: `Codex / Terra medium`
- 상태: `ready-for-ops7`
- 영향 영역: `staging config | deployment evidence | roadmap`
- 관련 이슈: 없음

## 확인 및 변경

Cloudflare 콘솔을 읽기 전용으로 확인했다. 정확한 격리 대상은
`pedagogy-ai-staging.dbruddl79.workers.dev`이며, active version은 `2c23c722` 하나(수동 Hello World
배포)다. runtime variables/secrets와 connected bindings는 모두 비어 있고 logs sampling은 100%다.
그러므로 현재 원격 Worker는 Gemini Worker를 실행하거나 승인된 합성 호출을 받을 준비가 되어 있지 않다.

Firebase Console에서 staging project `pedagogy-ai-staging`의 프로젝트 번호와 웹 app ID, App Check
reCAPTCHA Enterprise 등록을 대조했다. Google Cloud의 enabled APIs에 Gemini API가 있다. API key 원문은
열거나 기록하지 않았고, Cloudflare에 전송하지 않았다.

`worker/wrangler.staging.toml`을 새로 추가했다. 이 파일만 명시하는 배포는 production
`dawn-shape-2664`를 가리키지 않는다. staging Firebase 식별자, Gemini 2.5 Flash, `APP_CHECK_MODE=monitor`,
로컬 origin만, 일일/전역 2회 quota, `QUOTA` Durable Object migration, 정상 logs 10%를 선언한다.
`GEMINI_API_KEY`는 의도적으로 이 파일에 없으며 staging Worker secret으로만 넣어야 한다.

## 승인 범위 및 실행 결과

- 기존 승인 그대로: staging 합성 이미지 1회 + 문서 1회, 누적 2회·총 $1, 재시도 금지, production 제외.
- 사용자의 staging secret 저장·배포 및 키 회전 승인 안에서만 변경했다. production Worker
  `dawn-shape-2664`와 production 설정은 수정하지 않았다.
- Google Cloud에는 Gemini API만 허용하고 `pedagogy-ai-staging-gemini` service account에 바인드한
  `pedagogy-ai-staging-gemini-live`만 서버용 활성 key로 남겼다. 전송 과정에서 생성된 미사용 key 3개는
  삭제했고, Firebase 자동 생성 browser key는 건드리지 않았다. key 값은 파일·인계에 기록하지 않는다.
- Cloudflare staging Worker에 `GEMINI_API_KEY`를 `secret_text`로 저장했다. Wrangler의 이름 전용 조회로
  secret 존재를 확인했으며 값은 조회하지 않았다.
- `worker/wrangler.staging.toml`로 제품 Worker를 배포했다. 새 version은
  `e9b40db6-ba58-436d-8a99-e0fc9a1df840`이며 `QUOTA`/`DailyQuota` migration, staging Firebase 식별자,
  `APP_CHECK_MODE=monitor`, 사용자·전역 일일 2회, Gemini 2.5 Flash, logs 10%가 반영됐다.
- 배포 후 `GET /health`가 `{"ok":true}`를 반환했다. 이 검사는 provider 호출을 하지 않으므로 Gemini
  호출 수는 여전히 0회다.
- `npx wrangler deploy --dry-run --config wrangler.staging.toml`은 로컬에 Wrangler가 없어서 `npx`가
  registry 응답을 기다리기만 해 중단했다. 배포나 Cloudflare 변경은 발생하지 않았다. `npm run test:worker`와
  `git diff --check`는 통과했다.

## 키 회전 완료 기록

기존 Gemini 전용 key와 전송 과정의 미사용 key를 폐기했다. 최종 credentials 목록에는 서버용
`pedagogy-ai-staging-gemini-live`와 Firebase browser key만 남아 있다. 서버용 key는 Gemini API 제한과
staging service account 바인딩을 UI에서 확인했다. secret 값은 어떤 저장소 문서에도 남기지 않았다.

## 다음 행동과 복귀

OPS-6B는 완료했다. 롤백 기준은 수동 Hello World `2c23c722`, 현재 제품 배포 version은
`e9b40db6-ba58-436d-8a99-e0fc9a1df840`이다. OPS-7에서만 staging logs를 임시 100%로 올리고 합성
이미지·문서를 각 1회 실행한 뒤 10%로 복원한다. 실제 두 호출 전까지 `$1` 승인 잔여는 2회이며 자동·수동
재시도는 금지하고 production은 계속 제외한다.
