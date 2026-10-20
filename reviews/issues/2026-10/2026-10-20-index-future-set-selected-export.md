# 미래 버전 문제집을 선택 내보내기 하면 폴더 필드가 사라진다

- ID: `REV-2026-135`
- 날짜: `2026-10-20`(재현) · `2026-10-21`(수정 검증)
- 보고자: `부모 Codex 독립 VM 재현 · Codex GPT-6 Sol / high 수정`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-194`
- 검토 기준: `ad5fe91` 이후 REV-108 ② 작업본

## 요약과 영향

미래/손상 `setSchemaVersion` 권은 구조를 해석할 수 없으므로 원형 JSON을 읽기 전용으로 보존해야 한다.
그런데 선택 내보내기 `#selExportBtn`은 모든 권에서 `folderId`를 제거했다. 미래 권의 `folderId`가
이 버전에서 어떤 뜻인지 알 수 없으므로 복구용 JSON이 잘린다. 정상 권의 폴더 제외 정책은 유효하다.

## 재현과 기대/실제

`{id:'future',setSchemaVersion:2,folderId:'opaque-folder',problems:{opaque:true}}`를 선택해
`#selExportBtn`을 누르고 Blob JSON을 읽는다. 기대는 미래 권의 `folderId`와 알 수 없는 필드까지
원형 보존, 정상 권의 `folderId`만 제외다. 수정 전에는 미래 권의 `folderId`가 빠졌다.

## 근거와 처리 기록

- `2026-10-20` — 부모 Codex가 실제 선택 버튼 핸들러를 VM에서 실행해 `folderId` 누락,
  원본 객체 불변을 확인했다(`/private/tmp/rev108-schema-2026-10-20/parent-selected-export-repro.log`).
- `2026-10-21` — Codex GPT-6 Sol / high가 미지원 권만 `portableIntakeSet()`으로 원형 복제하고,
  정상 권은 기존대로 `folderId`를 제외했다. Chromium에서 실제 버튼의 Blob JSON을 읽어 미래 권
  필드 보존·정상 권 폴더 제외·원본 불변을 확인했다. `SET_SCHEMA_RED=export`는 해당 분기 제거 후
  표적 실패, 변이 생략 제어는 정상 14/14 뒤 예상 exit 1. `npm run test:set-schema` exit 0
  (`/private/tmp/rev108-schema-2026-10-20/schema-browser-14-final.log`). CSP 12/12 확인.
  ② 독립 좁은 변경분 판정과 운영 배포는 별개로 남는다.

- `2026-10-21` — 구현 미참여 Codex 에이전트가 수정과 해당 검사를 독립 확인해 추가 재현 결함 미발견으로 판정했다. 후속 Claude는 시간 초과로 최종 답변이 없으며, ② 운영 배포와 분리한다.
