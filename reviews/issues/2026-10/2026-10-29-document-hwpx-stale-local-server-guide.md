# 일반 문서 한글 내보내기 안내가 실제 기능과 다르다

- ID: `REV-2026-160`
- 날짜: `2026-10-29`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P3`
- 영향 영역: `index | docs`
- 관련 인계: `HANDOFF-2026-207`

## 재현·기대·실제

공개 document-editor.html에서 합성 document-sample JSON을 붙여넣어 검증/미리보기→한글 HWPX 내보내기를 누른다. backend·localhost 요청을 모두 차단한 새 Chromium에서도 다운로드에 성공하고, ZIP 모든 파트는 실제 한글로 검증한 표본과 bytes동일하다. 그런데 미리보기 안내는 'PEDAGOGY 로컬 서버를 켠 상태에서만 사용할 수 있습니다'라고 한다.

기대: 브라우저 직접 생성과 실패 시 로컬 서버 대체 경로를 실제 download() 순서대로 안내한다. 실제: 정상 사용에도 서버가 필수인 것처럼 안내한다. 조판·다운로드 기능 자체 오류는 아니다. 같은 화면의 아래 베타 안내는 각주·쪽 나눔·머리말·꼬리말을 미지원이라고 쓰지만 위쪽 지원 목록과 브라우저/Python 구현 및 실제 Mac 한글 3표본 출력은 지원을 보여 준다.

## 처리 기록

- 2026-10-29 Codex: 실제 공개 UI로 재현. 안내문1문장만 브라우저 직접 생성/실패 시 로컬 서버 시도로 정정. downloadInBrowser→findHwpxServer의 기존 로직/SDK·인증·네트워크 정책은 변경하지 않는다. 독립 검토/확인 후 resolved 처리한다.

- 2026-10-29 Codex: 변경된 로컬 화면에서 JSON 검증·미리보기·HWPX 다운로드 성공, 구 문구 없음, 페이지 오류0. backend/localhost 요청6건 차단 중 브라우저만으로 내려받은 ZIP 11파트가 native 검증 표본과 모두 bytes 동일. [로컬 UI 증거](../../audits/2026-10-29/prelaunch-print/document-local-guide.json). `document-editor.html:358-367`의 브라우저 우선→로컬 서버 시도 순서를 독립 Claude Opus/high가 확인해 차단 의견 없음([검토](../../audits/2026-10-29/prelaunch-print/claude-document-guide-final.md)). 기존 로직 변경 없음.

- 2026-10-29 Codex: 같은 화면의 상충한 베타 안내도 실제 지원 블록·머리말/꼬리말을 HWPX로 내보낼 수 있다는 문장으로 정정했다. 고정 양식의 세밀한 재현 제한은 유지했다. [두 문구 화면 증거](../../audits/2026-10-29/prelaunch-print/document-local-copy.json): 새 문구 둘 표시·구 미지원 문장 없음·페이지 오류0. 지원 범위는 [기존 실제 한글 출력](../../audits/2026-10-29/prelaunch-print/document-native-verification.json)과 `hwpx-document.js:286-300`으로 독립 대조 중.
