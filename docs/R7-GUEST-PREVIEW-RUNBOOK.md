# R7 게스트 호스트 배포 경계

이 문서는 통합 레일 R7의 하위 절차다. 전체 backend staging/Auth/App Check·자료 이관·
운영 전환 완료를 뜻하지 않는다. 실제 자료를 이 origin으로 옮기지 않는다.

## 배포 전

- 필수4job·Sonar 성공과 정확한 PR head, 병합 main CI·Pages를 확인한다.
- fresh `node scripts/build-guest-preview.mjs`와 `--check`로 원본 불변·PUBLIC_FILES·
  guest manifest·config 바이트 일치를 확인한다. manifest234개 중 _headers를 제외한
  HTTP 제공 자산은233개다. root dist/public은 production 빌드여서 사용하지 않는다.
- 실제 배포 cwd는 생성 config 디렉터리 `dist/guest-preview`로 고정하고 CLI와 config는
  절대 경로로 지정한다. config 기준/cwd 기준 어느 해석도 같은 guest dist/public만 가리킨다.
- name은 pedagogy-guest-preview다. 조회가 정확히 code10007(not-found)이고 인증 오류가
  없을 때만 새 리소스를 만든다. 이미 존재/권한 오류/기타 응답이면 deploy·delete 모두 중단한다.
- 도메인·결제·production Firebase/Worker/Rules·Pages/private 설정은 바꾸지 않는다.

## 배포 후와 롤백

- 성공한 deployment version ID·URL·createdInThisSession:true·manifest SHA를 안전한
  메타데이터로 보존한다. raw CLI debug·토큰은 공개/출력하지 않는다.
- 전용 workers.dev origin을 GUEST_HOST_BASE로 지정해 `node scripts/check-guest-host.mjs`를
  실행한다. 모든 자산 bytes/SHA·별칭·HTTP CSP/framing·404·top-level 양성 대조·iframe을 확인한다.
- 실패 시 이번 호출에서 생성 확인한 리소스만 동일 guest config의 delete --force 또는
  검증 guest 산출물 복원으로 중지/롤백한다. 소유가 불확실하면 삭제하지 않고 조사한다.
  삭제는 이 guest origin의 로컬 저장 접근 경로에도 영향을 주므로 실제 자료 이관 금지다.
- 게스트에는 JSON 내보내기가 남아 있지만 원문 Blob/작업까지 무손실 이관하는 형식은 아니다.
  완전 원문 이관은 별도 high 구현·독립 검토·실계정 게이트를 따른다.

## 검사와 근거

Wrangler 검사는 순차 실행한다. 정상 명령은 `node scripts/check-guest-host.mjs`,
로컬 RED는 GUEST_HOST_RED=drop-frame-headers / missing-library-view다.
각각 HTTP CSP/양성 대조의 정확한 단언과 exit1을 요구하며 원격 RED는 초기 거절한다.
[감사 증거](../reviews/audits/2026-10-27/README.md)와
[HANDOFF201](../reviews/handoffs/2026-10/2026-10-23-index-r7-guest-preview.md)을 따른다.


## 2026-10-27 실행 증거

PR30 head88c86d5 CI/Sonar 및 merge d65e759 main CI4개/Pages 확인 후 위 절차로 신규
배포했다. 실제233자산/헤더/404·양성/iframe 정상, 배포 version/manifest/URL·lookup10007·
createdInThisSession 메타데이터는 guest-deployment-verification.json에 보존했다.
기존 production 자원/도메인/결제·실자료는 변경하지 않았다. rollback은 필요 없어 실행하지 않았다.
PR Sonar 성공과 main의 기존 보안지표ERROR는 구별하고 상용 출시 게이트로 남긴다.
