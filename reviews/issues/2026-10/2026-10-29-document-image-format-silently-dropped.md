# 일반 문서가 미지원 그림 형식을 검증 통과시킨 뒤 출력에서 그림을 누락한다

- ID: `REV-2026-161`
- 날짜: `2026-10-29`
- 보고자: `Codex` (Claude 독립 검토 단서, 브라우저 재현으로 확인)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-207`

## 재현·기대·실제

합성1×1 GIF base64를 `document-editor.html`의 `image.data`로 넣는다. `validate()`는 성공하지만 브라우저 HWPX 조판기는 `PNG·JPEG 가 아니어서 그림을 넣지 못했습니다` 경고를 남기고, 생성 ZIP에 그림 BinData 파트가 없다. [실제 브라우저 재현](../../audits/2026-10-29/prelaunch-print/document-image-loss-repro.json). 서버 Python 검증은 PNG/JPEG 여부를 바이트로 확인해 거부한다.

기대: 지원하지 않는 형식·손상된 base64·초과 크기 그림은 미리보기/다운로드 전에 명확히 거부한다. 정상 PNG/JPEG는 브라우저·Python 조판을 유지한다. 실제: 브라우저 UI 검증은 빈 문자열만 거르고 조판에서 그림을 빼므로 사용자가 누락된 HWPX를 받을 수 있다.

## 처리 기록

- 2026-10-29 Codex: 독립 Claude가 지원 문구와 그림 경계를 대조하며 이 공백을 제기했고, 실제 브라우저에서 검증 통과·경고·BinData 0개를 재현했다. 추가한 브라우저 회귀는 수정 전 GIF 입력을 받아들여 exit1(의도한 RED). 브라우저 입력 검증을 Python 계약에 맞추는 중이다.

- 2026-10-29 Codex: `document-editor.html`의 `validatedImageData`로 PNG/JPEG 바이트·base64·2.5MiB·양수 치수를 확인하고, `document_schema.py`는 길이24바이트 이하/0픽셀을 거부한다. 지원 문구는 PNG·JPEG로 한정. 브라우저 엔진 차단 시에는 Python 로컬 서버가 최종 검증하도록 대체 경로를 보존했다. [RED→정상/정합·UI·필수 검사](../../audits/2026-10-29/prelaunch-print/README.md). 첫 Claude 검토에서 Python 느슨함/엔진 부재 시 폴백 차단을 발견했고 코드와 실제 폴백 출력으로 보완. 최종 독립 재검토 진행 중.

- 2026-10-29 Codex: [Claude Opus/high 최종 재검토](../../audits/2026-10-29/prelaunch-print/claude-document-image-final.md)에서 엔진 부재→서버 검증·정상 PNG/JPEG 출력 및 불량5종 차단에 재현 가능한 차단 결함이 없다고 합의했다. 첫 후속 180초 timeout은 검토 완료로 세지 않고, 범위 축소 재시도 240초 성공을 최종으로 사용했다. 남은 서버 오류 메시지 표현/검사 상수 사본·픽셀 비율 비교는 비차단 후속 관찰로 기록; GIF 통과→그림 누락은 재현 절차에서 더는 발생하지 않는다.
