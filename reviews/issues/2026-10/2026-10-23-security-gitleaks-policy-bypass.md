# Gitleaks diff 검사에서 저장소 allow 정책이 검출을 우회

- ID: `REV-2026-148`
- 날짜: `2026-10-23`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-198`

## 요약과 영향

CI의 Gitleaks diff 스캔이 설정 출처와 CLI 오류를 통제하지 않으면 PR이 inline
`gitleaks:allow`, repository `.gitleaks.toml` broad allowlist, `.gitleaksignore` fingerprint,
또는 잘못된 commit range를 이용해 새 credential을 놓칠 수 있었다.

## 재현 절차

1. 합성 토큰을 새 diff에 추가하면 현재 scanner는 exit 1이다.
2. 같은 토큰을 inline `# gitleaks:allow`로 기록하고 검사하면 exit 0이 된다.
3. `.gitleaks.toml`에 `[allowlist] paths=[".*"]`를 secret과 함께 추가하면 exit 0이 된다.
4. root `.gitleaksignore`에 해당 finding fingerprint를 넣으면 빈 임시 ignore file 지정에도
   Gitleaks가 repository ignore를 따로 읽어 exit 0이 된다.
5. invalid BASE SHA의 git fatal stderr에도 Gitleaks가 exit 0을 반환할 수 있다.

## 기대 결과 / 실제 결과

- 기대: repository 정책·inline 허용·무효 git 입력 및 scanner 진단이 검사 성공으로 오인되지 않는다.
- 실제: 독립 probe에서 inline allow, broad config, ignore fingerprint가 exit 0을 만들었고,
  invalid range는 진단 stderr와 함께 exit 0을 반환했다.

## 근거

독립 검토 synthetic fixture에서 raw token은 출력하지 않고 exit code만 확인했다. fixture 위치와 검증
스크립트는 `/private/tmp/r6-independent-scanner-probe.py` 및 해당 temporary directory에 있다.

## 수정 및 검증

CI에서 RUNNER_TEMP의 `useDefault=true` config를 고정하고 `--ignore-gitleaks-allow`를 사용한다.
root `.gitleaksignore`가 존재하거나 symlink면 거절한다. BASE/HEAD의 40자리 형식과 commit 객체를
검사하고 `git log` preflight를 수행한다. Gitleaks stderr는 임시 파일로만 받고 비어 있지 않으면
CLI exit code와 무관하게 exit 2 처리한다. 진단 원문은 출력하지 않는다.

## 처리 기록

- `2026-10-23` — `Codex`: 독립 probe에서 추가 fail-open(invalid range의 stderr+exit 0)을 확인했다.
  위 사전 검증과 stderr fail-closed 방어를 workflow에 반영했다. clean/inline/broad config/
  ignore fingerprint/invalid base·head/정상 secret synthetic 경계와 각 방어 제거 시 RED를 재검증하고
  독립 리뷰를 기다린다. raw token과 scanner 원문 로그는 이슈에 남기지 않는다.
- `2026-10-23` — `Codex`: 최종 workflow 경계 13개에 대한 독립 probe가 통과했다. clean은 0,
  secret 및 inline/broad config 우회는 1, ignore fingerprint·broken symlink·invalid base/head·
  empty/zero/malformed range·git preflight 실패·Gitleaks stderr+exit 0은 모두 2로 fail-closed였다.
  근거 요약은 `/private/tmp/r6-independent-final-workflow-probe.py`와
  `/private/tmp/r6-independent-final-0xms0765/*.meta.json`에 있다. raw secret이나 scanner 출력은
  검토 기록에 포함하지 않았다. 재현 결함과 같은 변경의 독립 재검증이 완료되어 resolved.
