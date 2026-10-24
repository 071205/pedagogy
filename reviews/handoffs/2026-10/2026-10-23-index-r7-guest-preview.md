# 변경 인계 — R7 무료 게스트 미리보기 정적 오버레이

- ID: `HANDOFF-2026-201`
- 날짜: `2026-10-23`
- 작성자: Codex (GPT-6 Sol)
- 상태: `reviewed`
- 영향 영역: `index | mock | tests`
- 관련 이슈: 없음

## 변경 내용

`scripts/build-guest-preview.mjs`는 기존 `PUBLIC_INPUTS`의 일반 파일만 임시 루트로 복사하고 세 편집 HTML·공개 설정을 게스트 전용으로 변환한다. 기존 `buildPublic/verifyPublic`의 정확한 `PUBLIC_FILES` allowlist와 헤더 생성/검증을 이용한다. 산출물은 `dist/guest-preview/dist/public`, 구별되는 `guest-manifest.json`, 자산 전용 `wrangler.toml`이다. 생성 Wrangler의 `./dist/public`은 해당 게스트 루트 안에서만 해석된다. 원본 공개 입력은 바이트를 전후 비교하며 수정하지 않는다.

게스트 HTML은 운영 Firebase 설정/SDK, Worker 주소와 backend·loopback CSP 출처를 제거한다. 공개 설정의 `guestPreview:true`로 인증·AI·계정 Worker·문서/모의고사 서버 탐색을 명시 차단하고 세 편집 화면에 게스트 배너를 둔다. 브라우저 로컬 저장, JSON, 인쇄, 같은 출처 모의고사 iframe과 브라우저 HWPX 경로는 유지한다. KaTeX/폰트 CDN을 사용하므로 완전 오프라인은 아니다. 운영 `index.html`, `document-editor.html`, `mock-exam-editor.html`, `service-config.js`, 기존 정적 staging 설정과 production 배포 파일은 수정하지 않았다.

## 위험과 검토 요청

- 변환 앵커·개수가 원본 변경을 놓치지 않고 fail-closed 하는지, 특히 계정 Worker `fetch`와 게스트 설정 로드 순서를 확인한다.
- 운영 호스트의 실제 HTTP `_headers`·alias·404 및 assets-only Wrangler 시작은 별도 독립 검토/배포 전 검증이 필요하다. 이 인계의 Node HTTP 서버는 HTML meta CSP와 브라우저 흐름을 검사한다.
- 게스트 미리보기는 R7 전체 staging/Auth/App Check/이관 완료의 대체가 아니다. 실제 자료를 새 origin으로 자동 이관하지 않는다.

## 검증

- `node scripts/guest-preview.test.mjs`: Chromium에서 UI 문항 제목/본문 편집→reload, 인쇄, 모의고사 iframe 저장, 문서 JSON 저장/재로드, 로그인·AI·서버 탐색 차단, CSP 및 private 404 통과. 배너·backend CSP·Firebase SDK·iframe CSP·운영 endpoint·설정 플래그·runtime/account guard 제거, 인라인 스크립트, symlink, private 파일 혼입 RED 통과.
- `node scripts/build-guest-preview.mjs --check`: 기존 빌드 `PUBLIC_FILES`와 manifest, 공개 헤더, 게스트 정책 통과.
- `npm run test:public`: 원본 공개 빌드/CSP/정적 staging 검사 통과.
- `node scripts/check-audit-browser.mjs`: `serve.py`의 `regression-test.html` 실패 0건 및 JSON root 거절 12건 통과.
- 아직 실행하지 못한 검증: 실제 Wrangler dev/원격 HTTP 헤더·새 호스트 운영 증거(후속 독립 검토/배포 단계).

## 다음 검토자에게

검토 diff는 `scripts/build-guest-preview.mjs`, `scripts/guest-preview.test.mjs`와 이 인계다. 게스트 빌드는 `node scripts/build-guest-preview.mjs`, 검사는 `node scripts/guest-preview.test.mjs` 및 `node scripts/build-guest-preview.mjs --check`이다. 생성 Wrangler는 `dist/guest-preview/wrangler.toml`; 배포 대상은 그 설정의 `./dist/public`이다. 기존 `dist/public`은 운영 설정 산출물이므로 게스트 호스트에 지정하지 않는다.

## 검토 기록




## 후속 검증·독립 검토

독립 Codex `/root/r8_edit_print_review`(GPT-6 Sol / medium)가 빌더/정상·RED/생성 JS와
공개 빌드 계약을 읽어 재현 가능한 결함 없음·미합의 없음으로 판정했다. Claude 승인이 아니다.

root가 기존 check-static-host를 재사용한 `scripts/check-guest-host.mjs`를 추가했다.
로컬 생성 Wrangler에서 234 manifest 중 HTTP 제공 233개(_headers 제외)의 모든 바이트·SHA,
HTML 별칭/정확 HTTP CSP·frame-ancestors·nosniff·referrer policy·비공개404와
동일 origin mock iframe/타 origin index 차단이 통과했다. 원본 파일은 변하지 않았다.
정상 명령은 `node scripts/check-guest-host.mjs`, 원격은
`GUEST_HOST_BASE=https://pedagogy-guest-preview.<label>.workers.dev node scripts/check-guest-host.mjs`다.
원격은 이 전용 host 형식만 허용하며 생성 manifest와 대조한다.

`GUEST_HOST_RED=drop-frame-headers node scripts/check-guest-host.mjs`는 격리 로컬 프록시가
실제 CSP 응답 헤더를 지워 `Guest HTTP CSP must match verified framing`에서 exit1이다.
브라우저·프록시·소유 Wrangler·임시 state는 finally로 정리한다. 원격 실패 주입은 거절한다.
독립 Codex가 추가 스크립트·정상/RED 로그와 lifecycle을 대조해 합의했다.
로그는 `/private/tmp/pedagogy-r7-guest-host-normal.log`와 `-red.log`다.
로컬 정상 manifest SHA는 `311046226308c8356c39e7e97626b0cfd360721043b6d1899546484dd00a6fa3`다.

package scripts와 Verify에 guest 정상·RED 및 실제 Wrangler 검사를 연결했다.
새 무료 host 이름 조회는 worker-not-found이며 인증 오류는 아니었다. 원격 배포는 아직 전이다.


## 2026-10-25 재개 체크포인트

사용량으로 실패했던 브랜치 생성은 실행되지 않았고, 재개 시 실제 변경을 확인했다.
PR29 head `b1f1678791e6edb4fb7e6a4a1bac462d7fec5ab4`의 필수 Verify4개와 Sonar 성공·
댓글을 확인해 `1ed8d7f1d96e41e06d8d9ea81cd1e303c4833f48`로 병합했다.
기본 checkout을 바꾸지 않고 본 worktree만 `codex/r7-guest-preview-host`로 옮겨 main에
fast-forward했다. PR29 main CI/Pages는 아직 완료 확인 전이다.
추가 package/CI 연결도 독립 Codex가 정확한 파일/옵션·RED exit1과 실패 문구 검사로
합의했다. 이후 에이전트의 사용량 한도 오류는 이 실질 답변과 구별하며 새 승인으로 세지 않는다.

다음은 이 변경의 별도 head CI·PR 검토/병합, 전용 guest config로 새 호스트 배포,
GUEST_HOST_BASE 원격 전체 바이트/헤더/404/iframe 검증이다. 도메인 구매·production
Firebase/Worker·실제 자료·기존 Pages/private 전환은 하지 않는다. 실패 시 새 guest
리소스만 중지/삭제하거나 검증된 guest 산출물로 복귀하며 production은 롤백 대상이 아니다.
