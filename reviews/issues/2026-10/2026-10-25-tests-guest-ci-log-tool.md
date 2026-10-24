# 게스트 CI의 RED 로그 확인이 미설치 rg에 의존한다

- ID: `REV-2026-152`
- 날짜: `2026-10-25`
- 보고자: Codex
- 상태: `in-progress`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-201`

## 재현과 영향

PR30 head 4dcc11f의 Verify 40123745055에서 guest-preview 정상/RED 및 실제
Wrangler 233자산/헤더/404/iframe 정상은 통과했다. HTTP CSP 제거 RED의 exit1 확인 뒤
로그 문구를 찾는 rg가 러너에 없어 `rg: command not found`/exit127로 verify job이 실패했다.
새 CI wrapper의 도구 가정 결함이며 제품 실행 오류는 아니다.

## 기대 결과 / 실제 결과

- 기대: RED의 원래 exit1과 정확한 대상 단언 문구를 확인한다.
- 실제: 필수 설치에 없는 검색 명령 때문에 확인 단계가 실패한다.

## 처리 기록

- CI 로그 `/private/tmp/pedagogy-pr30-failed.log`에서 재현했다.
- wrapper의 마지막 검색만 기본 grep -F로 바꾸며 원래 exit 코드·정확한 실패 문구 검사는 유지한다.
  rg가 없는 PATH의 셸 대조 및 새 head CI 검증 전 해결로 표시하지 않는다.

- 제한 PATH=/usr/bin:/bin에서 실제 보존 HTTP CSP RED 로그를 사용한 셸 대조:
  수정 전 rg 명령 exit127, 수정 후 exit0, 잘못된 원래 exit0 거절(exit1),
  잘못된 실패 문구 거절(exit1). 실행 summary는 임시 pedagogy-rev152-* 폴더에 보존했다.
- 독립 Codex GPT-6 Sol / medium이 CI 실제 실패 로그·한 줄 diff·코드/문구 검사를
  대조해 최소 수정 합의·미합의 없음으로 판정했다. 새 head CI 완료 전 in-progress 유지.
