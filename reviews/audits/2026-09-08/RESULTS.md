# 독립 분석 실행 증거

이 파일은 **수정 전** 결과다. 이후 안전 회귀 및 수정 결과는
[HANDOFF-2026-067](../../handoffs/2026-09/2026-09-08-audit-findings-fixed.md)에 기록했다.

기준: cbd951e · 2026-09-08 · 사용자 데이터 없이 합성 fixture만 사용.
사본 위치: `/private/tmp/pedagogy-audit.YkXLIt` (임시 경로이므로 영구 보관을 보장하지 않음).
재현 소스는 이 디렉터리에 함께 보관했다. 테스트가 mock 처리한 경계와 실제 코드를 구분한다.

## 결과

```text
QUOTA_RESET: statuses=[200,429,204,200], aiCalls=2, DAILY_LIMIT=1
BODY_LIMIT: Content-Length=null, bytes=8388666, status=200
FALSE_SYNC_ACK: sent=v1, current=v2, markedSynced=true
STALE_ACCOUNT_LOAD: owner=B, data=[{id:A-only,name:A private fixture}]
IMAGE_UNDO: restored=fixture-image, deleted=[fixture-image]
FAILED_LOCAL_SAVE: first=false, dirty=false, second=true, closeWarning=false
CONCURRENT_EXPORT: errors=[], sequential=[Contents/section1.xml], interleaved=[Contents/section0.xml]
CLOUD_NORMALIZATION: headerBefore=500,headerAfter=200,blocksBefore=51,blocksAfter=50
MALFORMED_RENDER: UND_ERR_SOCKET
```

검사별 경계:

- `audit-repro.mjs`: createWorker/DailyQuota 및 추출한 실제 프런트 함수 실행.
  인증 사용자·AI·DO 영속 storage·Firestore·Storage·DOM 상태 전달은 fixture.
  quota의 MemoryStorage.transaction은 순차 실험용이며 플랫폼의 동시 트랜잭션을 대체 검증하지 않는다.
  이미지 복구는 실제 Undo가 수행하는 이전 데이터 복원을 재현한다. 실파일을 지우지 않는다.
- `audit-concurrency.py`: 실제 Python build 두 개를 스레드로 실행. A emit 진입에서만
  Event를 기다려 순서를 고정한다. 생성 HWPX XML의 고유 본문 표식을 비교한다.
- `audit-auth.mjs`: 테스트 RSA 키를 메모리에서 생성하고 JWKS fetch만 모의 응답으로 대체.
  실제 서명 검증에서 정상 토큰 허용, 잘못된 aud·만료·미래 iat·빈 sub·서명 변조를 거절했다.
- `audit-browser.mjs`: 격리한 serve.py + Chromium. 운영 Worker 호출은 차단.
  기존 회귀 페이지 **128/128 통과**, 브라우저 내 실제 setToDoc/docToSet로 잘림 재현.
  첫 실행에서는 회귀 통과 뒤 frame URL 선택 오류로 추가 검사가 실행되지 않았다.
  URL pathname 선택으로 고친 뒤 재실행해 추가 검사까지 완료했다. 최종 결과만 성공으로 집계한다.

기존 Worker 검사 및 정적 검사 통과. npm advisory 조회는 총 92개 의존성, 취약점 0건.
check:launch는 아래 6개를 보고하며 실패:

1. App Check site key 공란
2. 지원 이메일 공란
3. 약관·개인정보 고지 버전 공란
4. 결제/구독 포털 미연결
5. legal.html TODO
6. 운영 Worker 허용 출처에 localhost 포함

## 최신 코드 재확인

Claude의 추가 커밋을 포함한 **ae5740e**에서도 위 4개 도구를 모두 재실행했다.
9건의 결함 출력은 동일했고 로컬 RSA 인증 검사도 통과했다. 브라우저 기존 회귀는
**136/136 통과, FAILED=[]**로 늘었다. 이미지 Undo 관련 최신 UX 변경은 원본 삭제 경로를
수정한 것이 아니며 해당 재현도 그대로다. 최신 서버·브라우저 검사는 실제 제품 함수를
읽되 외부 AI·계정·저장소 경계는 이전과 같은 합성 fixture로 제한했다.

최신 snapshot 중앙값(ms): 100문항 0.10, 500문항 0.30, 2000문항 3.50.
최대(ms): 0.60 / 1.20 / 5.60. 동시 작업·환경 변동이 있어 커밋 간 벤치마크로 해석하지 않는다.
최신 브라우저 실행은 sandbox의 loopback bind 제한(EPERM)으로 한 차례 기동 실패한 뒤,
승인된 로컬 서버/브라우저 실행 권한으로 재실행해 완료했다. 기동 실패를 테스트 실패로 집계하지 않는다.
Worker/정적/launch/npm audit 결과는 최초 격리 사본에서 실행한 결과이며 최신 전체 게이트를
다시 실행했다는 의미는 아니다. 새 브라우저 emitter/ZIP 구현 전체 감사 역시 이번 재검사 범위 밖이다.

## 실행 방법

재현 도구는 현재 코드의 결함 재현용이며, 수정 후에는 결함 assert가 실패할 수 있다.
보안 회귀 통과 여부를 판단하는 CI 도구로 그대로 사용하면 안 된다.

저장소 루트 또는 해당 커밋의 격리 사본을 작업 디렉터리로 두고 실행한다.
현재 저장소에 대해 실행하려면:

```bash
node reviews/audits/2026-09-08/audit-repro.mjs
node reviews/audits/2026-09-08/audit-auth.mjs
python3 reviews/audits/2026-09-08/audit-concurrency.py
node reviews/audits/2026-09-08/audit-browser.mjs
```

Python에는 lxml이 필요하다. 이번 검증은 데스크톱 내장 Python을 사용했다.
브라우저 검사는 Playwright 및 Chromium 설치가 필요하고 일회성 빈 브라우저 프로필로 실행된다.
`HWPX_PYTHON`으로 Python 실행 파일, `AUDIT_PLAYWRIGHT_ROOT`로 node_modules가 있는 저장소
루트를 지정할 수 있다. 일반 테스트 준비물 외에 운영 자격 증명은 필요 없다.

별도 사본에서 실행할 때는 이 도구들의 절대 경로를 인자로 주되 작업 디렉터리는 사본 루트로
한다. 오래된 커밋에서 scripts가 아직 없더라도 현재 문서 폴더의 도구를 사용할 수 있다.
