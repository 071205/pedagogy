# 변경 인계 — 법률 벤치마크와 동의·고지 교정

- ID: `HANDOFF-2026-094`
- 날짜: `2026-09-09`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | legal | docs | tests`
- 관련 이슈: `REV-2026-073` (resolved)

## 변경

- 공식 법령과 국내·해외 교육/문서/AI 서비스 공식 문서를 비교한
  `docs/LEGAL-BENCHMARK-AUDIT.md`를 작성했다.
- 필수 로그인/클라우드 국외이전에서 선택적 AI 전송을 분리했다. AI는 실제 실행 시 기존
  확인창에서 별도로 알린다.
- 개인정보 수집·이용 동의에 처리 목적·항목·계정 삭제 시까지의 기간·거부 효과를 표시했다.
- 비로그인 개인정보, 콘텐츠 권리, 완전 삭제, Firebase 국가, App Check enforcement,
  국내 사업자, 통신판매업 의무에 관한 과장 또는 미확인 단정을 제거했다.
- Firebase 읽기 전용 조회로 Firestore 위치가 서울(`asia-northeast3`)임을 확인해 정책에
  반영했다. Authentication은 Firebase 공식 문서상 미국이며 Storage 위치는 아직 확인 대상이다.
- 문서/동의 버전을 `v2026-09-09-2`로 올렸다.
- 동의 기록이 이용자 수정 가능·클라이언트 시각 기반이라 불변 법적 증적이 아님을 문서화했다.

## 의도적으로 유지한 것

저작권·내보내기·만 14세 미만 제한·AI 오류 검토·개별 AI 전송 확인·면책 제한의 기존 구조는
제품과 맞아 유지했다. Firebase/Cloudflare 실제 위치와 운영자 신원은 추측해서 채우지 않았다.

## 검증

- `git diff --check`
- `npm run check:static`
- 실패 주입: `csAbroad`에 `AI 사진 변환은 로그인 동의에 함께 포함`을 잠시 넣자 새 검사가
  의도한 오류로 실패했고, 원문 복구 뒤 다시 통과했다.
- `npm run check:launch`는 운영자 정보·Firebase/Cloudflare 위치·App Check 등 실제 출시
  설정이 채워질 때까지 실패하는 것이 의도된 상태다.
