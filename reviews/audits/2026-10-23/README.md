# R8 연결 여정 로컬 감사 probe — 2026-10-23

보존 위치: `reviews/audits/2026-10-23/r8-connected-journey.mjs`와 같은 폴더의 이 `README.md`.
저장소 루트는 이 위치에서 상대 경로로 계산한다. 복사 전 임시 위치에서 검증할 때만
`R8_REPO_ROOT=/absolute/repo/root`를 지정한다. Playwright와 서버 lifecycle helper는
그 루트의 pinned `node_modules`와 `scripts/serve-static-staging.mjs`에서 로드한다.
기본 결과 폴더는 OS temp 아래의 새 `pedagogy-r8-*` 폴더다. `R8_OUT_DIR`로 별도
임시 결과 폴더를 지정할 수 있다. 기존 사용자 브라우저 프로필은 열지 않는다.

저장소 루트에서 정상 실행 한 명령:

```sh
node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

한 화면 RED 대조 한 명령(종료 코드 1이 기대값):

```sh
R8_RED=drop-result-local node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

이식 전 실제 검증은 `R8_REPO_ROOT`를 지정해 임시 파일을 실행했다. 정상 로그는
`/private/tmp/r8-2026-10-23/portable/normal.log`, 결과 JSON은
`/private/tmp/r8-2026-10-23/portable/normal/connected-journey.json`이다.
1194×834, 768×1024, 375×812 모두 `complete:true`, exit 0이었다.
RED 로그는 `/private/tmp/r8-2026-10-23/portable/red.log`, 결과 JSON은
`/private/tmp/r8-2026-10-23/portable/red/connected-journey-red.json`이다.
1194×834에서 `PM_SETS_V7:guest`의 결과 5권을 격리된 context에서만 제거해
6권→1권으로 만든 뒤, 재로드 결과 ID 보존 단언에서 `complete:false`, exit 1이었다.
두 실행 모두 임시 브라우저 close 및 소유 `serve.py` SIGTERM 정리가 기록됐다.

합성 guest 원본 8문항과 합성 PNG 원문 1쪽은 fixture로만 준비한다. 이후 라이브러리에서
보존 구성 초안 열기, 5권 요청(자동 제안 4권의 차이 확인), 오분류 이동·Undo,
원문 열기, 다섯째 목적지 수동 추가, 채택, 결과 편집기↔지면, 재로드·재진입은 UI 클릭으로
이어간다. 전체 plan snapshot과 목적지 문항 목록의 Undo 복구, 원본·결과 8문항의
고유 본문 payload(title·answer·desc·blocks) 보존, 결과 문항 ID의 별도 신규 발급과
중복·누락 없음, 다섯 결과 ID의 재로드 보존을 단언한다. 결과 행은 모두 guest 로컬 저장
상태여야 한다.

이 검사는 실제 PDF 추출, 실패 쪽/부분 채택, 새 편집 저장, 인쇄·한글 출력, 실계정·
클라우드 ACK, 실기기, 유료 AI, 인간의 첫 클릭·오조작·복구 관찰을 증명하지 않는다.
소유 127.0.0.1 `serve.py`, 임시 Playwright context만 사용하고 외부 요청을 차단한다.

세션 인계 마감 때 영구 경로에서 `R8_REPO_ROOT` 없이 정상 명령을 다시 실행해 세 화면 complete=true·exit0 및 브라우저/소유 서버 정리를 확인했다. 인계 로그: `/private/tmp/r8-2026-10-23/handoff-location.log`. 원래 정상/RED JSON은 같은 폴더의 `r8-connected-journey-normal.json`, `r8-connected-journey-red.json`에 보존한다.
