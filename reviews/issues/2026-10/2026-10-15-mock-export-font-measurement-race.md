# 모의고사 내보내기 높이 측정에 글꼴 준비 경계가 없음

- ID: `REV-2026-130`
- 날짜: `2026-10-15`
- 보고자: `Codex 독립 에이전트 · 호출 경로 주 구현자 확인`
- 상태: `confirmed`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-192`

## 요약과 영향

toHwpx는 그림 준비 뒤 동기 hwpxPayload를 호출하지만 필요한 글꼴의 준비/실패 상태는 확인하지 않는다.
글꼴 도착 전후 같은 문항의 heightMm가 달라지고, 그 높이는 writer의 문항 간격 계산에 쓰인다.
fonts.ready 후 미리보기를 다시 그리는 기존 처리가 이미 내보낸 payload를 안정화하지는 않는다.

## 재현 절차 / 기대 결과 / 실제 결과

1. 외부 요청을 차단한 새 Chromium context에서 자체 영문 문항을 표시하고 hwpxPayload를 만든다.
2. 이미 저장소에 있는 LiberationSans-Regular.ttf를 시험용 ExamBody face로 로컬 주입한다.
3. face 적용 뒤 같은 입력의 payload와 실제 사용 폰트를 다시 관찰한다.

기대: 출력 직전 사용 폰트의 준비/실패를 명시적으로 판정한 뒤 일관된 context로 측정한다.
실제 자체 표본: 본문 폭397.97→358.92px, heightMm98.96→92.61mm. measureCh는124.61875mm로 유지.
CDP의 본문 사용 폰트는 A053 SinMyungjo→Liberation Sans, 숨은 측정은 AppleMyungjo로 유지했다.
단일 Mac/Chromium·해당 자체 문자의 관찰이며 운영 파일/PDF의 잘림을 재현했다고 하지 않는다.

## 근거

- mock-exam-editor.html: measureProblemHeights(2172), hwpxPayload(2199), toHwpx(2261), fonts.ready 재렌더(2040/2748).
- hwpx-exam.js(591~)와 Python mock_to_hwpx.py가 heightMm를 소비하는 경로.
- 독립 Codex와 주 구현자가 같은 전체 페이지/fixture에서 실제 headless/CDP로 각각 재현. 공개 관찰은
  `experiments/hwp-export/research/h1-web-typography-audit.json`의 fontTiming, 로컬 스크립트/결과는
  `/private/tmp/hwp-web-2026-10-15/probe-font-timing.cjs`·font-timing.json. 제품 파일·새 폰트 다운로드/배포 없음.

## 처리 기록

- `2026-10-15` · 확인, 제품 수정 전. H1-f1에 폰트/이미지 준비·실패/대체·타임아웃·취소/generation과
  측정 identity를 묶는다. 저장 원문/Rules를 변경하지 않는다. 원래 폰트 변동을 없애는 것이 아니라
  출력 작업의 준비 경계와 관찰 범위를 명시한다. 계약은 docs/HWP-WEB-TYPESETTING-DESIGN.md.

- Claude 검토 보완: 129를 먼저 고치면 선지 측정도 폰트 도착 시점에 민감해진다. 준비 경계를 먼저/동시에 세우며,
  회귀는 절대mm가 아니라 같은 준비 상태의 일관성·미준비 처리·입력 보존 관계로 고정한다.
