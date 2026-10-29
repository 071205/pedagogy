# 모의고사 선지 측정이 실제 표시와 다른 CSS 컨텍스트를 사용함

- ID: `REV-2026-129`
- 날짜: `2026-10-15`
- 보고자: `Codex 독립 에이전트 · 주 구현자 독립 재현`
- 상태: `confirmed`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-192`

## 요약과 영향

`#measure`는 Hamchorom/11.04pt이고 실제 선지는 `.paper/.ch/.it`의 ExamBody·크기·자간을 받는다.
같은 폰트로 통제해도 측정 크기/자간이 달라 한 줄에 들어가는 선지를 3+2로 결정하는 반례가 있다.
이 배치는 `hwpxPayload().layoutResolved`로 JS/서버 HWPX writer에도 전달된다.

## 재현 절차

1. 현재 mock-exam-editor.html의 style과 실제 measureCh/layoutOf 함수를 새 Chromium DOM에 넣는다.
2. 웹폰트/외부 요청을 막고 실제 표시·측정의 family를 둘 다 Arial로 통제한다. tex는 plain text로
   처리하고 수식 없는 자체 선지 MMMMM 다섯 개를 쓴다.
3. 측정 DOM과 `.paper > .col > .prob > .ch.ch-1 > .r > .it`의 Range 문자 폭을 비교한다.
4. 두 폭에 같은 safety 기준20.6mm를 적용한다.

기대: 같은 출력 컨텍스트로 자동 배치를 판단한다.
실제: 숨은 폭20.6375mm(fits1=false)·표시 문자19.61224mm(fits1=true), 실제 layoutOf는2.
Chromium151.0.7922.34/Mac의 두 독립 재현 결과다. 숫자 자체를 모든 OS의 golden으로 고정하지 않는다.

## 근거

- mock-exam-editor.html: #measure(602), measureCh(702), layoutOf(723), 선지CSS(399), hwpxPayload(2199).
- `experiments/hwp-export/research/h1-web-typography-audit.json`: 소스 hash·브라우저·관찰·범위.
- 로컬 재현: `/private/tmp/hwp-web-2026-10-15/probe-measure-context.cjs`, 결과 measure-context.json.
- KaTeX/한글 실물 일치·실제 폰트 로드 경합은 이 재현 범위 밖이다.

## 처리 기록

- `2026-10-15` · 확인, 제품 수정 전. H1-f1에서 실제 CSS 컨텍스트 측정·일반/수식/라벨·로드 상태를
  함께 고친다. 이 반례를 정식 회귀와 이전 정책 RED로 연결한다. 계약은 docs/HWP-WEB-TYPESETTING-DESIGN.md.

- Claude 검토 보완: family뿐 아니라 size/자간도 선언이 다르다. 130의 준비 경계와 함께 수정하고,
  원본09 auto 배치 전후를 비교해 기존 safety 여유의 유지/재도출 근거를 남긴다.
