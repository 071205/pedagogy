# 게스트 호스트 framing 검사가 top-level 양성 대조를 확인하지 않는다

- ID: `REV-2026-153`
- 날짜: `2026-10-27`
- 보고자: Claude 읽기 전용 배포 검토, Codex 독립 재현
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-201`

## 재현·기대·실제

기존 check-guest-host는 top-level 배너/로그인/guest 상태를 확인하지만 framing 대상
#libraryView의 양성 존재를 보지 않고 타 origin iframe의 count0만 차단 근거로 기록했다.
실제 HTTP CSP 정확 비교는 별도 방어이며 이를 우회한 보안 결함이라는 주장은 아니다.

원래 검사 사본의 부팅 후 top-level #libraryView id만 제거한 격리 브라우저 실험에서
검사가 exit0·crossOriginIndexBlocked=true를 기록했다. 기대는 비교 대상 부재를 실패로
알리는 것이다. 원격 iframe의 빈 결과와 대상 자체 부재를 구별할 증거가 부족했다.
로그 `/private/tmp/pedagogy-guest-positive-before.log`, 재현 코드
`/private/tmp/pedagogy-guest-positive-before.mjs`.

## 처리 기록

- top-level 대상 count1을 명시하고 결과 JSON에 topLevelLibrary=true를 기록한다.
- missing-library-view는 격리 DOM id만 제거하며 새 양성 단언에서 실패해야 한다.
  모든 실패 주입은 원격에서 초기 거절하며 CI도 exit1+정확한 문구를 요구한다.
- 정상/RED와 독립 재검증 전 해결 표시하지 않는다. 제품 실행 파일은 수정하지 않았다.

- 순차 로컬 검증: 정상 exit0·topLevelLibrary=true·234 manifest/233자산 SHA 일치,
  대상 id 제거는 양성 단언에서 exit1, HTTP CSP 제거는 기존 목표 단언에서 exit1이다.
  원격 RED는 verify/네트워크 시작 전 거절된다. 영구 요약은
  reviews/audits/2026-10-27/guest-framing-summary.json이다. Claude 후속 재검증 대기.

- 최종 head88c86d5 Verify40427720314와 merge d65e759 Verify40430188686은 각각 필수4job,
  새 guest 정상/RED 단계까지 success다. PR Sonar도 통과했고 main Sonar 기존 보안 실패는 별도다.
- 신규 guest 원격에서 제공233자산/SHA·aliases/headers/private404·top-level 양성 대조·
  동일 origin mock·다른 origin index 차단까지 exit0으로 확인했다. 배포 version
  b22da34b-4d78-469c-be22-a2d776b9e811, 근거 guest-deployment-verification.json.
- Claude 2차 읽기 전용 검토가 G2 코드/CI 공백 해소·G1/G3 절차 합의, 미합의 없음으로
  판정했다. cwd 밖 로그는 당시 읽지 못했음을 구별했고, 실제 정상/RED 원문과 요약은
  같은 날짜 감사 폴더에 보존했다. CI/원격까지 완료해 같은 이슈를 resolved로 닫는다.
