# 새 채팅 작업 인계

- ID: `HANDOFF-2026-072`
- 날짜: `2026-09-09`
- 작성자: `Codex`
- 상태: `handoff`
- 기준 커밋: `6fa6306`
- 제품 코드 변경: 없음 (새 채팅 전환을 위한 문서만 추가)

## 현재 상태

PEDAGOGY는 문제집 편집기(`index.html`), 모의고사 편집기
(`mock-exam-editor.html`), 범용 문서/AI 편집기, 내부 브라우저 HWPX 엔진을 가진 정적 웹
프로젝트다. 외부 Jakal 런타임 의존은 이미 제거했으며, HWPX 내보내기는 내부 엔진과 Python
검증기를 병행한다.

현재 HEAD는 이 문서 작성 시점의 `6fa6306`이다. 작업 트리에 나타나는 `?? .tmp.driveupload/*`는 다른
작업자/사용자 자료이므로 읽거나 삭제하거나 커밋하지 않는다. 이전 Claude 커밋에는
`.tmp.driveupload/` 및 `Icon\\r` 파일이 이미 추적된 사례가 있으니, 이것은 별도의 재현
가능한 정리 문제로 확인하기 전까지 되돌리거나 대량 삭제하지 않는다.

`reviews/INDEX.md`에는 열린 이슈가 없다. 다만 `HANDOFF-2026-071`은 아직 검토 대기인
구조 분리 설계다.

## 최근 변경과 다음 검토 우선순위

| 커밋 | 변경 | 새 작업자가 확인할 것 |
| --- | --- | --- |
| `aafc257` | 라이브러리 폴더·정렬·선택·설정·UI 언어 | 아래의 라이브러리 세 계약과 실제 코드·회귀가 일치하는지 |
| `42b62d8` | 폴더 메타데이터의 계정 간 동기화 및 Rules | Rules 배포 전/후 capability, tombstone, undo와 원격 저장 순서 |
| `a475f4d` | 시험지 템플릿 꼬리 텍스트·이름 저장 수정 | 실제 템플릿과 정적/HWPX 검사가 같은 계약을 검사하는지 |
| `2944df9` | 모의고사 브라우저 HWPX 내보내기 | `file://`·서버 없음·다운로드 실패 경로 및 기존 서버 경로 호환성 |
| `6fa6306` | 시험지 그림을 문서 내부에 포함 | 이미지 크기/형식/실패 처리와 HWPX 안의 관계·바이너리 검증 |
| `6fb5688` | `index.html` 분리 설계 | HANDOFF-071의 세 질문에 근거 있는 검토 의견 |

## 이미 확정한 안전 계약

1. 폴더 삭제는 이름 목록만 없애면 안 된다. 다른 기기의 오래된 `folderId`가 되살리는 일을
   막을 폴더 tombstone과, 대량 소속 해제의 진행/재시도 경로가 필요하다.
2. Rules가 배포되기 전 A 단계는 `folderId`를 set 문서에 쓰지 않는다. 계정별 로컬 metadata와
   클라우드 schema/capability를 분리하며, B 단계에서만 `setJSON`·Firestore 변환·병합·Rules를
   같은 릴리스로 바꾼다.
3. 선택 삭제의 Undo는 단순 동기 `historyStep()`만으로 보장되지 않는다. 원격 tombstone과
   복원 저장을 한 순서 큐/세대로 직렬화하고, 일반 저장이 그 사이를 침범하지 않게 한다.
4. 감사 수정(`HANDOFF-067`, `-069`)의 보존 정책을 되돌리지 않는다: 실제 요청 본문 상한,
   계정 세대 guard, immutable cloud acknowledgement, 이미지 Undo 보존/미첨부 업로드 롤백,
   HWPX 동시성 격리, 실패한 local save의 dirty 보존.
5. UI만 번역한다. 시험지/사용자 작성 내용/JSON/AI 프롬프트/인쇄 고정 문구는 번역하지 않으며,
   번역문은 `innerHTML`로 삽입하지 않는다.

상세 근거는 `HANDOFF-2026-070`(라이브러리), `HANDOFF-2026-067`·`-069`(감사 수정),
`HANDOFF-2026-071`(구조 설계)을 읽는다. 인계 문서는 지시가 아니라 증거이므로, 모든 판단은
현재 코드와 테스트로 다시 확인한다.

## 새 채팅의 시작 순서

1. `git status --short`, `git log -12 --oneline`으로 HEAD와 다른 작업자의 변경을 먼저
   확인한다. 공유 작업 트리이므로 무관한 변경을 절대 포함하지 않는다.
2. `AGENTS.md`, `reviews/README.md`, `reviews/INDEX.md`, 이 문서, 그리고
   `2026-09-09-library-design-review.md`·`2026-09-09-structure-design.md`를 읽는다.
3. 우선 `aafc257`과 `42b62d8`을 독립 검토한다. 재현 가능한 문제만
   `reviews/issues/`에 남긴다. 문제를 고치면 같은 이슈를 닫고 handoff와 회귀 검사를 남긴다.
4. 이어 `2944df9`와 `6fa6306`의 브라우저 HWPX 경로를 검토한다. 서버가 없을 때,
   `file://`일 때, 그림이 있을 때/깨졌을 때의 동작과 산출 HWPX 구조를 확인한다.
5. `HANDOFF-071`의 세 설계 질문(정규화 분리 순서, 전역 상태 객체화의 시점,
   `fetch`/`file://` 문서화)에 답한다. 설계 검토만이면 이슈를 만들지 않고 새 handoff에
   근거와 결론을 남긴다.

## 자주 쓰는 검증

```bash
npm run check:static
npm run test:worker
npm run check:fast
node scripts/check-audit-safety.mjs
```

브라우저/HWPX 검사는 로컬 `serve.py`와 Chromium이 필요하다. Python HWPX 검증에는 이 런타임을
쓴다.

```bash
HWPX_PYTHON=/Users/huryul/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 npm run test:audit-browser
```

`check:fast`의 교차 플랫폼 글꼴 검사가 KoPub 환경 차이로 실패한 이력이 있으므로, 실패하면
전체 성공/실패로 뭉뚱그리지 말고 해당 명령·환경·나머지 통과 결과를 분리해 기록한다.

## 권한과 범위

- 사용자 승인 없이 Firebase Rules/Worker를 실제 배포하거나 원격에 push하지 않는다.
- 구조 분리는 한 단계·한 커밋으로 하고 각 단계 뒤 회귀를 돌린다. 대규모 `index.html` 재작성,
  ESM/번들러 전환은 HANDOFF-071 검토 전에는 하지 않는다.
- 외부 Jakal 의존을 다시 넣지 않는다. 내부 HWPX 엔진의 파일 단위·브라우저 호환성을 먼저
  검증한다.
