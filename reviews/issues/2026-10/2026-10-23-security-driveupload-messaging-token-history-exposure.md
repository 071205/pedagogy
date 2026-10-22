# Firebase CLI 환경 덤프에 과거 세션 IPC 인증 토큰 포함

- ID: `REV-2026-147`
- 날짜: `2026-10-23`
- 보고자: `Codex`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `docs`
- 관련 인계: `HANDOFF-2026-198`

## 요약과 영향

과거 저장소 이력의 `.tmp.driveupload` 아래 로그 두 건에 Firebase CLI subprocess 환경 덤프가 포함되어,
Claude Code의 `CLAUDE_CODE_MESSAGING_TOKEN` 필드가 이력에 남았다. 이는 API/OAuth key가 아니라
per-session inbox socket의 자식 인증 토큰이다. 로그에 들어간 시점의 노출은 사실이며 무해 오탐으로
분류하지 않는다. 확인 당시 해당 세션 socket은 존재하지 않았고 현재 환경에도 변수가 없다.
과거 공개 이력의 복사본은 회수할 수 없으며 이 이슈는 잔여 이력 위험을 추적한다.

## 재현 절차

1. 이력 전용 Gitleaks JSON 결과에서 commit `42b62d8`의 두 `.tmp.driveupload` 경로를 확인한다.
2. secret 값을 출력하지 않고 해당 finding의 field label과 주변 JSON key만 로컬에서 확인한다.
3. 당시 세션 socket의 파일 존재 여부만 `lstat`으로 확인한다.

## 기대 결과 / 실제 결과

- 기대: credential-bearing subprocess environment dump가 git 이력 및 공개 배포 경계에 들어가지 않는다.
- 실제: 두 historical log finding에서 동일 IPC session token field가 검출됐다. 값은 보고서나 외부에
  출력하지 않았고, 실제 사용/API 유효성 시험도 하지 않았다.

## 근거

- baseline Gitleaks finding: commit `42b62d8`, `.tmp.driveupload` 두 로그, field `CLAUDE_CODE_MESSAGING_TOKEN`.
- 독립 triage: 관련 socket은 확인 시점에 모두 부재했고 현재 환경변수도 부재.
- 공식 정의: [Claude Code environment variables](https://code.claude.com/docs/en/env-vars), § `CLAUDE_CODE_MESSAGING_TOKEN`.
- 현재 `.gitignore`는 `.tmp.driveupload/` 및 `*-debug.log`를 제외한다. R6 diff scanner는 신규 변경을
  차단하도록 추가했으며 synthetic credential로 exit 1을 확인했다.

## 제안 (선택)

과거 전체 이력은 rewrite하지 않는다. 세션 토큰의 per-session 수명과 endpoint 부재를 잔여 위험으로
기록하고, 로그 경계·ignore·새 변경의 fail-closed 검사를 유지한다.

## 처리 기록

- `2026-10-23` — `Codex`: 역사적 노출 후보를 확인해 등록. 값 검증·회전·이력 rewrite는 하지 않음.
  `.tmp.driveupload/` 및 debug log ignore를 확인했고, Gitleaks 전체 이력 기준선에서 root/재귀
  `transcript.txt`를 pathspec 제외했다. CI용 diff scanner의 clean/RED 경로를 synthetic secret으로
  검증했다. 잔여 이력은 그대로 남아 있어 이슈를 open 상태로 유지한다.
