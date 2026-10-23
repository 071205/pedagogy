# 정적 호스트 설정 검사가 다른 TOML 구역의 값을 실제 assets 설정으로 오인

- ID: `REV-2026-149`
- 날짜: `2026-10-23`
- 보고자: `Codex 독립 검토 /root/r5_gate_review; 부모 재현 확인`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests | server`
- 관련 인계: `HANDOFF-2026-199`

## 요약과 영향

`prepareStaticStaging()`은 설정 원문 전체에 대한 정규식으로 directory를 검사한다.
다른 TOML 구역에 `directory = "./dist/public"`이 있고 실제 `[assets]`에는
`directory = "."`이 있으면 통과한다. fresh public build가 정확해도 Wrangler가
서빙할 실제 루트는 저장소 전체가 될 수 있어 assets-only 경계를 보장하지 못한다.
현재 승인된 설정 자체와 운영 호스트에서 유출이 발생했다는 증거는 없다.

## 재현 절차

1. `PUBLIC_INPUTS`만 복사한 합성 임시 저장소에 정상 name/compatibility date를 둔다.
2. `[vars]`에 `directory = "./dist/public"`, `[assets]`에 `directory = "."` 및 정상
   html/not_found 설정을 둔다.
3. 실제 `prepareStaticStaging()` 및 가짜 spawn을 주입한 `startStaticStaging()`을 호출한다.

## 기대 결과 / 실제 결과

- 기대: 실제 TOML assets.directory가 dist/public이 아니므로 build/spawn 전에 거절.
- 실제: preparationAccepted=true, manifestAssets=234, reachedSpawn=true.
  Python tomllib으로 실제 assets.directory가 `.`임도 독립 확인했다.

## 근거

- `scripts/serve-static-staging.mjs`: prepareStaticStaging의 전역 정규식 검사.
- 독립 probe와 로그: `/private/tmp/r7-independent-2026-10-23/config-probe.mjs`, `config-probe.log`.
- 부모도 같은 probe를 별도 임시 fixture `config-fixture-iYi9MY`에서 재실행해 동일 결과 확인.
- 실제 Wrangler 서버·원격 배포는 실행하지 않았고 합성 decoy만 사용했다.

## 처리 기록

- 2026-10-23 · 독립 Codex 재현, 부모 코드 대조 및 합성 probe 재확인. 실제 TOML 구조를
  검증하고 동일 경계의 정상/RED를 추가한 뒤 독립 재검증이 필요하다.
- 2026-10-23 · 구현자 수정. `scripts/serve-static-staging.mjs`의 전역 정규식 판정을
  `scripts/check-static-staging-config.py`의 Python 표준 `tomllib` 파싱과 정확한
  top-level/[assets] key·값 계약으로 교체했다. 다른 섹션/인라인 테이블/quoted key
  decoy는 fresh build·spawn 전에 거절하고, 동등한 quoted assets key는 허용한다.
  pinned Wrangler의 TOML 파서는 배포 번들 내부이며 `smol-toml`을 공개 모듈로
  제공하지 않아 직접 import할 수 없음을 확인했다. 새 npm 의존성 없이 CI verify에
  기존 pinned `setup-python`의 3.12를 추가했다. Python 미설치/3.11 미만은
  검사 실패이며 설정 원문은 오류에 출력하지 않는다.
  `red-review-config.log`: validator 검사를 끄면 새 회귀가 exit 1;
  `test-rev149-150-final.log`: 복구 후 통과. 실제 로컬 Wrangler
  `test-static-host-review-fixes.log` 통과. 독립 재검증은 별도 대기.

- 2026-10-23 · 비구현자 독립 Codex 최종 재검증 통과. 부모가 코드·원 재현/수정 근거를 대조했고, 새 head CI 확인을 후속으로 남긴다.
