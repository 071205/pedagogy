# Sonar 전체 목록 및 1차 분류 — 2026-09-20

- 기준: 공개 Sonar API `api/issues/search`, project `071205_pedagogy`, branch `main`, resolved=false. 이전 분석 원본 364건 / 48규칙.
- 전수 **목록 수집과 규칙 단위 분류**이며, 364개 코드 경로 전부를 독립 재현한 감사가 아니다. 개별 심층 검토가 남은 항목은 후속으로 표시한다.
- 이번 변경은 28개 기존 finding에 대응(코드 수정 26개 + 바이너리 응답 보강 2개). 이는 Cloud에서 28건 해결됐다는 뜻이 아니다. 그 밖의 336개는 이번에 수정하지 않았다.
- Cloud 이슈의 false-positive/accepted 상태를 일괄 변경하지 않았다. 원격 재분석·최종 개수·등급은 미확인.
- Python XSS 두 건은 HTML 응답이 아닌 HWPX 바이너리 다운로드. 응답 헤더 누락과 오류 내부정보 노출은 별도로 재현하여 보강했다.
- 과거 835→364 감소를 전부 오탐 제거라고 단정할 수 없다. 특히 experiments/hwp-export는 serve.py에서 실행되므로 분석 제외를 안전 판정으로 해석하면 안 된다.

## 규칙별 처리

| 규칙 | 건수 | 처리 / 다음 판단 |
| --- | ---: | --- |
| javascript:S2187 | 4 | 오탐 후보: standalone assert 실행 파일. 테스트를 삭제하지 말 것 |
| Web:InputWithoutLabelCheck | 8 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S7723 | 27 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S2681 | 70 | 후속: 한 줄 조건문 70건. 블록 경계와 실패 경로를 각각 검토 후 가독성 정리 |
| javascript:S3776 | 28 | 후속 설계: 복잡도 분해. 인증·저장·렌더링 동작 보존 검증 필요 |
| javascript:S3358 | 27 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7780 | 19 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7758 | 5 | 변경 보류: base64 디코딩 바이트 코드. Unicode 코드포인트 권고를 기계 적용하지 말 것 |
| python:S1192 | 8 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| Web:S7039 | 7 | 판정 보류: script unsafe-inline은 build-public에서 제거; style은 사용 중. raw HTML 로컬 경로와 구분 |
| javascript:S7784 | 7 | 후속: JSON 정규화와 structuredClone의 의미가 달라 기계 변경 금지 |
| javascript:S7781 | 7 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S2486 | 23 | 후속: 각 catch가 선택적 기능 실패인지 유실인지 호출 흐름 확인 필요 |
| Web:S6819 | 7 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S1481 | 1 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S1854 | 1 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S7765 | 3 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| css:S4666 | 18 | 후속: 미디어쿼리·테마 cascade 의미 확인 후 통합 여부 판단 |
| javascript:S6661 | 3 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S3626 | 2 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7756 | 4 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7761 | 12 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| python:S3776 | 3 | 후속 설계: HTTP 보안 관문 순서를 보존하는 분해 필요 |
| javascript:S7768 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| githubactions:S6505 | 6 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| githubactions:S8543 | 3 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S7718 | 2 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7773 | 9 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7770 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S4624 | 16 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S6535 | 5 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| pythonsecurity:S5131 | 2 | 보강: HWPX ZIP 응답에 attachment·nosniff·no-store. XSS 재현은 안 됨. Cloud 판정 미확인 |
| javascript:S2757 | 1 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| Web:S5255 | 1 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S3735 | 2 | 의도 확인 대상: 인쇄 복구 강제 reflow를 읽는 void 연산 |
| python:S5332 | 3 | 설계 검토: loopback 및 선택적 LAN HTTP. LAN은 신뢰망 전제이며 HTTPS 전환은 별도 설계 |
| python:S8517 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| python:S3457 | 3 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| Web:PageWithoutTitleCheck | 1 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S8786 | 3 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S7766 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S6594 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| python:S5713 | 2 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| css:S7924 | 1 | 코드 수정·관련 로컬 검사 통과 (Cloud 미확인) |
| javascript:S7778 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S7785 | 2 | 오탐 후보: classic script 전역 계약이 있어 top-level await 기계 적용 불가 |
| python:S7494 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |
| javascript:S6660 | 1 | 후속: 스타일·API 사용 권고. 개별 호출부 의미 확인 후 수정 여부 결정 |

## 모든 finding 식별자 (분석 당시 위치)

각 항목의 처리 상태는 위 규칙 표를 따른다. 현재 파일 줄 번호는 수정으로 달라질 수 있다.

### javascript:S2187

- `AaC4sPPHpkl6Y9sKPLiU` — `worker/gemini.test.mjs:0`
- `AaC4hiYvGvjr3YIaEa1r` — `worker/worker-contract.test.mjs:0`
- `AaC4hiZBGvjr3YIaEa1x` — `worker/app-check.test.mjs:0`
- `AaC4hiWNGvjr3YIaEa1b` — `worker/quota.test.mjs:0`

### Web:InputWithoutLabelCheck

- `AaC4sPTapkl6Y9sKPLiV` — `document-editor.html:206`
- `AaC4hiiTGvjr3YIaEa_n` — `index.html:1801`
- `AaC4hiiTGvjr3YIaEa_o` — `index.html:1831`
- `AaC4hiiTGvjr3YIaEa_p` — `index.html:2062`
- `AaC4hiiTGvjr3YIaEa_q` — `index.html:2106`
- `AaC4higoGvjr3YIaEa9N` — `mock-exam-editor.html:539`
- `AaC4higoGvjr3YIaEa9O` — `mock-exam-editor.html:540`
- `AaC4hiiTGvjr3YIaEa_m` — `index.html:1694`

### javascript:S7723

- `AaC4sPTapkl6Y9sKPLi-` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi0` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi2` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi4` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi6` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi8` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiW` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiY` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLib` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLid` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLig` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLii` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLik` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLip` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLir` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLit` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiw` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiy` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLjA` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLjC` — `document-editor.html:221`
- `AaC4hiZNGvjr3YIaEa2u` — `document-editor.html:341`
- `AaC4hiZNGvjr3YIaEa2m` — `document-editor.html:309`
- `AaC4hiZNGvjr3YIaEa2o` — `document-editor.html:309`
- `AaC4hiZNGvjr3YIaEa2r` — `document-editor.html:310`
- `AaC4hiYWGvjr3YIaEa1f` — `worker/app-check.js:26`
- `AaC4hiiTGvjr3YIaEbAD` — `index.html:3824`
- `AaC4hiZNGvjr3YIaEa2y` — `document-editor.html:366`

### javascript:S2681

- `AaC4sPTapkl6Y9sKPLi1` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi3` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi5` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi7` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi9` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiX` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiZ` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLi_` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLia` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLic` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLie` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLih` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLij` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLil` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLim` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLin` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLio` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiq` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLis` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiu` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLix` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLiz` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLjB` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLjE` — `document-editor.html:223`
- `AaC4sPTapkl6Y9sKPLjG` — `document-editor.html:223`
- `AaC4hiZNGvjr3YIaEa2n` — `document-editor.html:309`
- `AaC4hiZNGvjr3YIaEa2p` — `document-editor.html:309`
- `AaC4hiZNGvjr3YIaEa2q` — `document-editor.html:310`
- `AaC4hiZNGvjr3YIaEa2s` — `document-editor.html:310`
- `AaC4hiiTGvjr3YIaEbAj` — `index.html:5454`
- `AaC4hiiTGvjr3YIaEa_x` — `index.html:1992`
- `AaC4hiiTGvjr3YIaEa_y` — `index.html:2004`
- `AaC4hiiUGvjr3YIaEbBh` — `index.html:7812`
- `AaC4hiiTGvjr3YIaEbAa` — `index.html:5059`
- `AaC4hiiTGvjr3YIaEbAg` — `index.html:5414`
- `AaC4hiiTGvjr3YIaEbAk` — `index.html:5462`
- `AaC4hiiUGvjr3YIaEbAt` — `index.html:5774`
- `AaC4hiiTGvjr3YIaEbAE` — `index.html:3864`
- `AaC4hiiTGvjr3YIaEbAJ` — `index.html:4324`
- `AaC4hiiTGvjr3YIaEbAK` — `index.html:4687`
- `AaC4hiiTGvjr3YIaEa_1` — `index.html:2524`
- `AaC4hiiUGvjr3YIaEbAu` — `index.html:5799`
- `AaC4hiZNGvjr3YIaEa2x` — `document-editor.html:357`
- `AaC4hiZNGvjr3YIaEa2f` — `document-editor.html:222`
- `AaC4hiZNGvjr3YIaEa2l` — `document-editor.html:308`
- `AaC4hiiUGvjr3YIaEbA5` — `index.html:6332`
- `AaC4hiiUGvjr3YIaEbA6` — `index.html:6336`
- `AaC4hiiUGvjr3YIaEbA7` — `index.html:6344`
- `AaC4hiiUGvjr3YIaEbA9` — `index.html:6442`
- `AaC4hiiUGvjr3YIaEbA-` — `index.html:6511`
- `AaC4hiiTGvjr3YIaEbAs` — `index.html:5766`
- `AaC4hiiTGvjr3YIaEa_z` — `index.html:2385`
- `AaC4hiiTGvjr3YIaEa_0` — `index.html:2388`
- `AaC4higoGvjr3YIaEa97` — `mock-exam-editor.html:1601`
- `AaC4higoGvjr3YIaEa9q` — `mock-exam-editor.html:1092`
- `AaC4higoGvjr3YIaEa9r` — `mock-exam-editor.html:1092`
- `AaC4higoGvjr3YIaEa9t` — `mock-exam-editor.html:1101`
- `AaC4higoGvjr3YIaEa9u` — `mock-exam-editor.html:1106`
- `AaC4higoGvjr3YIaEa9v` — `mock-exam-editor.html:1159`
- `AaC4higoGvjr3YIaEa9y` — `mock-exam-editor.html:1192`
- `AaC4higoGvjr3YIaEa90` — `mock-exam-editor.html:1203`
- `AaC4higoGvjr3YIaEa91` — `mock-exam-editor.html:1235`
- `AaC4hiiUGvjr3YIaEbBY` — `index.html:7178`
- `AaC4hiiUGvjr3YIaEbAw` — `index.html:5853`
- `AaC4hiiUGvjr3YIaEbAx` — `index.html:5858`
- `AaC4hiiUGvjr3YIaEbA3` — `index.html:6055`
- `AaC4hiiTGvjr3YIaEbAL` — `index.html:4748`
- `AaC4hiiUGvjr3YIaEbBc` — `index.html:7285`
- `AaC4hiiUGvjr3YIaEbBd` — `index.html:7286`
- `AaC4hiiUGvjr3YIaEbBL` — `index.html:7025`

### javascript:S3776

- `AaC4sPTapkl6Y9sKPLif` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLjD` — `document-editor.html:223`
- `AaC4hiYjGvjr3YIaEa1p` — `worker/index.js:553`
- `AaC4hiYjGvjr3YIaEa1h` — `worker/index.js:249`
- `AaC4hiiTGvjr3YIaEbAI` — `index.html:4064`
- `AaC4hiiTGvjr3YIaEbAe` — `index.html:5165`
- `AaC4hiiUGvjr3YIaEbBB` — `index.html:6779`
- `AaC4hiiTGvjr3YIaEbAO` — `index.html:4805`
- `AaC4hiiTGvjr3YIaEbAi` — `index.html:5440`
- `AaC4hiiUGvjr3YIaEbA_` — `index.html:6552`
- `AaC4hiiUGvjr3YIaEbA2` — `index.html:6046`
- `AaC4hiiUGvjr3YIaEbA8` — `index.html:6432`
- `AaC4hiiUGvjr3YIaEbBl` — `index.html:7920`
- `AaC4hiiTGvjr3YIaEbAd` — `index.html:5133`
- `AaC4higoGvjr3YIaEa9x` — `mock-exam-editor.html:1184`
- `AaC4higoGvjr3YIaEa-M` — `mock-exam-editor.html:2309`
- `AaC4higoGvjr3YIaEa-R` — `mock-exam-editor.html:2486`
- `AaC4higoGvjr3YIaEa-S` — `mock-exam-editor.html:2509`
- `AaC4hiiTGvjr3YIaEa_9` — `index.html:3093`
- `AaC4hiiTGvjr3YIaEbAB` — `index.html:3500`
- `AaC4higoGvjr3YIaEa9b` — `mock-exam-editor.html:836`
- `AaC4hiiTGvjr3YIaEa_7` — `index.html:2717`
- `AaC4hiiTGvjr3YIaEa_-` — `index.html:3172`
- `AaC4higoGvjr3YIaEa-H` — `mock-exam-editor.html:2089`
- `AaC4higoGvjr3YIaEa9s` — `mock-exam-editor.html:1094`
- `AaC4hiiUGvjr3YIaEbAv` — `index.html:5845`
- `AaC4hiiUGvjr3YIaEbBa` — `index.html:7267`
- `AaC4hiiTGvjr3YIaEa__` — `index.html:3392`

### javascript:S3358

- `AaC4sPTapkl6Y9sKPLiv` — `document-editor.html:221`
- `AaC4sPTapkl6Y9sKPLjF` — `document-editor.html:223`
- `AaC4hiYjGvjr3YIaEa1m` — `worker/index.js:475`
- `AaC4hiYjGvjr3YIaEa1q` — `worker/index.js:711`
- `AaC4hiYjGvjr3YIaEa1i` — `worker/index.js:298`
- `AaC4hiiTGvjr3YIaEbAP` — `index.html:4812`
- `AaC4hiiTGvjr3YIaEbAQ` — `index.html:4813`
- `AaC4hiiTGvjr3YIaEbAl` — `index.html:5499`
- `AaC4hiiTGvjr3YIaEbAm` — `index.html:5500`
- `AaC4hiiTGvjr3YIaEbAS` — `index.html:4842`
- `AaC4higoGvjr3YIaEa93` — `mock-exam-editor.html:1319`
- `AaC4hiiUGvjr3YIaEbA0` — `index.html:5986`
- `AaC4hiiTGvjr3YIaEbAH` — `index.html:4053`
- `AaC4higoGvjr3YIaEa9g` — `mock-exam-editor.html:944`
- `AaC4higoGvjr3YIaEa9j` — `mock-exam-editor.html:966`
- `AaC4higoGvjr3YIaEa92` — `mock-exam-editor.html:1257`
- `AaC4hiiUGvjr3YIaEbBF` — `index.html:6888`
- `AaC4hiiUGvjr3YIaEbBH` — `index.html:6888`
- `AaC4hiiUGvjr3YIaEbBO` — `index.html:7080`
- `AaC4hiiUGvjr3YIaEbBQ` — `index.html:7080`
- `AaC4higoGvjr3YIaEa9Y` — `mock-exam-editor.html:727`
- `AaC4higoGvjr3YIaEa9l` — `mock-exam-editor.html:1058`
- `AaC4higoGvjr3YIaEa9n` — `mock-exam-editor.html:1068`
- `AaC4higoGvjr3YIaEa9o` — `mock-exam-editor.html:1071`
- `AaC4hiiUGvjr3YIaEbBM` — `index.html:7079`
- `AaC4hiiUGvjr3YIaEbBA` — `index.html:6554`
- `AaC4hiiUGvjr3YIaEbBD` — `index.html:6887`

### javascript:S7780

- `AaC4hiYjGvjr3YIaEa1o` — `worker/index.js:516`
- `AaC4higoGvjr3YIaEa98` — `mock-exam-editor.html:1616`
- `AaC4higoGvjr3YIaEa9_` — `mock-exam-editor.html:1861`
- `AaC4hiYjGvjr3YIaEa1n` — `worker/index.js:488`
- `AaC4higoGvjr3YIaEa9P` — `mock-exam-editor.html:640`
- `AaC4higoGvjr3YIaEa9Q` — `mock-exam-editor.html:642`
- `AaC4higoGvjr3YIaEa9R` — `mock-exam-editor.html:646`
- `AaC4higoGvjr3YIaEa9S` — `mock-exam-editor.html:650`
- `AaC4higoGvjr3YIaEa9T` — `mock-exam-editor.html:650`
- `AaC4higoGvjr3YIaEa9U` — `mock-exam-editor.html:650`
- `AaC4higoGvjr3YIaEa9V` — `mock-exam-editor.html:650`
- `AaC4higoGvjr3YIaEa9W` — `mock-exam-editor.html:650`
- `AaC4higoGvjr3YIaEa9X` — `mock-exam-editor.html:654`
- `AaC4higoGvjr3YIaEa-C` — `mock-exam-editor.html:1863`
- `AaC4higoGvjr3YIaEa-D` — `mock-exam-editor.html:1869`
- `AaC4hiiUGvjr3YIaEbBJ` — `index.html:6895`
- `AaC4hiiUGvjr3YIaEbBK` — `index.html:6895`
- `AaC4hiiUGvjr3YIaEbBS` — `index.html:7094`
- `AaC4hiiUGvjr3YIaEbBT` — `index.html:7094`

### javascript:S7758

- `AaC4hiZNGvjr3YIaEa2v` — `document-editor.html:342`
- `AaC4hiYWGvjr3YIaEa1e` — `worker/app-check.js:20`
- `AaC4higoGvjr3YIaEa-I` — `mock-exam-editor.html:2239`
- `AaC4hiY5Gvjr3YIaEa1w` — `worker/auth.js:44`
- `AaC4hiiTGvjr3YIaEa_4` — `index.html:2638`

### python:S1192

- `AaC4hijuGvjr3YIaEbB8` — `serve.py:44`
- `AaC4hijuGvjr3YIaEbB6` — `serve.py:89`
- `AaC4hijuGvjr3YIaEbB5` — `serve.py:49`
- `AaC4hijuGvjr3YIaEbB9` — `serve.py:95`
- `AaC4hijuGvjr3YIaEbCA` — `serve.py:451`
- `AaC4hijuGvjr3YIaEbB-` — `serve.py:453`
- `AaC4hijuGvjr3YIaEbB7` — `serve.py:48`
- `AaC4hijuGvjr3YIaEbB_` — `serve.py:48`

### Web:S7039

- `AaC4hiZNGvjr3YIaEa1y` — `document-editor.html:7`
- `AaC4hiZNGvjr3YIaEa1z` — `document-editor.html:7`
- `AaC4hiiTGvjr3YIaEa_e` — `index.html:26`
- `AaC4hiiTGvjr3YIaEa_f` — `index.html:26`
- `AaC4higoGvjr3YIaEa9K` — `mock-exam-editor.html:12`
- `AaC4higoGvjr3YIaEa9L` — `mock-exam-editor.html:12`
- `AaC4hihRGvjr3YIaEa_H` — `legal.html:10`

### javascript:S7784

- `AaC4hiiTGvjr3YIaEbAf` — `index.html:5171`
- `AaC4hiiTGvjr3YIaEbAC` — `index.html:3508`
- `AaC4hiiTGvjr3YIaEbAF` — `index.html:3872`
- `AaC4hiiTGvjr3YIaEbAr` — `index.html:5754`
- `AaC4higoGvjr3YIaEa9z` — `mock-exam-editor.html:1200`
- `AaC4hiiUGvjr3YIaEbA4` — `index.html:6149`
- `AaC4hiiTGvjr3YIaEbAM` — `index.html:4751`

### javascript:S7781

- `AaC4hiYWGvjr3YIaEa1c` — `worker/app-check.js:17`
- `AaC4hiYWGvjr3YIaEa1d` — `worker/app-check.js:17`
- `AaC4hiY5Gvjr3YIaEa1u` — `worker/auth.js:40`
- `AaC4hiY5Gvjr3YIaEa1v` — `worker/auth.js:40`
- `AaC4higoGvjr3YIaEa-A` — `mock-exam-editor.html:1863`
- `AaC4higoGvjr3YIaEa-B` — `mock-exam-editor.html:1863`
- `AaC4higoGvjr3YIaEa-E` — `mock-exam-editor.html:1872`

### javascript:S2486

- `AaC4hiYjGvjr3YIaEa1l` — `worker/index.js:443`
- `AaC4hiiTGvjr3YIaEbAW` — `index.html:4939`
- `AaC4hiiTGvjr3YIaEbAX` — `index.html:4976`
- `AaC4hiiTGvjr3YIaEbAZ` — `index.html:5012`
- `AaC4hiiTGvjr3YIaEbAc` — `index.html:5075`
- `AaC4hiiTGvjr3YIaEbAh` — `index.html:5437`
- `AaC4hiiTGvjr3YIaEbAn` — `index.html:5540`
- `AaC4hiiTGvjr3YIaEbAG` — `index.html:3891`
- `AaC4hiiTGvjr3YIaEbAN` — `index.html:4772`
- `AaC4hiiUGvjr3YIaEbBj` — `index.html:7882`
- `AaC4hiiUGvjr3YIaEbBk` — `index.html:7890`
- `AaC4hiZNGvjr3YIaEa2t` — `document-editor.html:325`
- `AaC4higoGvjr3YIaEa-L` — `mock-exam-editor.html:2296`
- `AaC4hiZNGvjr3YIaEa21` — `document-editor.html:422`
- `AaC4higoGvjr3YIaEa-J` — `mock-exam-editor.html:2286`
- `AaC4hiYjGvjr3YIaEa1k` — `worker/index.js:399`
- `AaC4hiiTGvjr3YIaEa_8` — `index.html:2854`
- `AaC4hiiTGvjr3YIaEbAq` — `index.html:5576`
- `AaC4hiiUGvjr3YIaEbBX` — `index.html:7164`
- `AaC4hiiTGvjr3YIaEa_v` — `index.html:1904`
- `AaC4hiiTGvjr3YIaEa_w` — `index.html:1976`
- `AaC4hiiTGvjr3YIaEa_5` — `index.html:2658`
- `AaC4hiiTGvjr3YIaEa_2` — `index.html:2626`

### Web:S6819

- `AaC4hiiTGvjr3YIaEa_h` — `index.html:1787`
- `AaC4hiiTGvjr3YIaEa_i` — `index.html:1819`
- `AaC4hihRGvjr3YIaEa_I` — `legal.html:174`
- `AaC4hiiTGvjr3YIaEa_l` — `index.html:2308`
- `AaC4higoGvjr3YIaEa9M` — `mock-exam-editor.html:547`
- `AaC4hiiTGvjr3YIaEa_j` — `index.html:2251`
- `AaC4hiiTGvjr3YIaEa_k` — `index.html:2279`

### javascript:S1481

- `AaC4hiiUGvjr3YIaEbAy` — `index.html:5877`

### javascript:S1854

- `AaC4hiiUGvjr3YIaEbAz` — `index.html:5877`

### javascript:S7765

- `AaC4hiiTGvjr3YIaEbAR` — `index.html:4823`
- `AaC4hiiTGvjr3YIaEbAT` — `index.html:4842`
- `AaC4hiiTGvjr3YIaEbAV` — `index.html:4938`

### css:S4666

- `AaC4hiiUGvjr3YIaEbB3` — `index.html:1376`
- `AaC4hiiUGvjr3YIaEbB4` — `index.html:1572`
- `AaC4hiiUGvjr3YIaEbBw` — `index.html:961`
- `AaC4hiiUGvjr3YIaEbBx` — `index.html:1051`
- `AaC4hiiUGvjr3YIaEbB1` — `index.html:1197`
- `AaC4hiiUGvjr3YIaEbB2` — `index.html:1278`
- `AaC4hiiUGvjr3YIaEbB0` — `index.html:1166`
- `AaC4hiiUGvjr3YIaEbBy` — `index.html:1132`
- `AaC4hiiUGvjr3YIaEbBu` — `index.html:865`
- `AaC4hiiUGvjr3YIaEbBr` — `index.html:601`
- `AaC4hiiUGvjr3YIaEbBs` — `index.html:611`
- `AaC4hiiUGvjr3YIaEbBt` — `index.html:717`
- `AaC4hiiUGvjr3YIaEbBp` — `index.html:313`
- `AaC4hiiUGvjr3YIaEbBz` — `index.html:1164`
- `AaC4hiiUGvjr3YIaEbBn` — `index.html:233`
- `AaC4hiiUGvjr3YIaEbBo` — `index.html:236`
- `AaC4hiiUGvjr3YIaEbBq` — `index.html:586`
- `AaC4hiiUGvjr3YIaEbBv` — `index.html:909`

### javascript:S6661

- `AaC4hiiTGvjr3YIaEbAY` — `index.html:5011`
- `AaC4higoGvjr3YIaEa-O` — `mock-exam-editor.html:2406`
- `AaC4higoGvjr3YIaEa-N` — `mock-exam-editor.html:2340`

### javascript:S3626

- `AaC4hiiTGvjr3YIaEbAb` — `index.html:5061`
- `AaC4higoGvjr3YIaEa-T` — `mock-exam-editor.html:2527`

### javascript:S7756

- `AaC4hiiTGvjr3YIaEbAo` — `index.html:5542`
- `AaC4higoGvjr3YIaEa-U` — `mock-exam-editor.html:2667`
- `AaC4hiiTGvjr3YIaEbAU` — `index.html:4912`
- `AaC4hiiUGvjr3YIaEbBe` — `index.html:7318`

### javascript:S7761

- `AaC4higoGvjr3YIaEa-P` — `mock-exam-editor.html:2417`
- `AaC4higoGvjr3YIaEa-Q` — `mock-exam-editor.html:2417`
- `AaC4hiZNGvjr3YIaEa22` — `document-editor.html:425`
- `AaC4hiZNGvjr3YIaEa23` — `document-editor.html:425`
- `AaC4hiiUGvjr3YIaEbBZ` — `index.html:7192`
- `AaC4higoGvjr3YIaEa96` — `mock-exam-editor.html:1558`
- `AaC4hiiTGvjr3YIaEa_r` — `index.html:1897`
- `AaC4hiiTGvjr3YIaEa_s` — `index.html:1897`
- `AaC4hiiTGvjr3YIaEa_t` — `index.html:1902`
- `AaC4hiiTGvjr3YIaEa_u` — `index.html:1903`
- `AaC4higoGvjr3YIaEa94` — `mock-exam-editor.html:1532`
- `AaC4higoGvjr3YIaEa95` — `mock-exam-editor.html:1532`

### python:S3776

- `AaC4hijuGvjr3YIaEbCG` — `serve.py:512`
- `AaC4hijuGvjr3YIaEbCF` — `serve.py:460`
- `AaC4hijuGvjr3YIaEbCI` — `serve.py:657`

### javascript:S7768

- `AaC4hiZNGvjr3YIaEa2k` — `document-editor.html:298`

### githubactions:S6505

- `AaC4higVGvjr3YIaEa9E` — `.github/workflows/verify.yml:89`
- `AaC4higVGvjr3YIaEa9F` — `.github/workflows/verify.yml:91`
- `AaC4higVGvjr3YIaEa9H` — `.github/workflows/verify.yml:162`
- `AaC4higVGvjr3YIaEa9I` — `.github/workflows/verify.yml:164`
- `AaC4higVGvjr3YIaEa9B` — `.github/workflows/verify.yml:28`
- `AaC4higVGvjr3YIaEa9C` — `.github/workflows/verify.yml:37`

### githubactions:S8543

- `AaC4higVGvjr3YIaEa9G` — `.github/workflows/verify.yml:91`
- `AaC4higVGvjr3YIaEa9J` — `.github/workflows/verify.yml:164`
- `AaC4higVGvjr3YIaEa9D` — `.github/workflows/verify.yml:37`

### javascript:S7718

- `AaC4hiZNGvjr3YIaEa20` — `document-editor.html:388`
- `AaC4hiiUGvjr3YIaEbBi` — `index.html:7861`

### javascript:S7773

- `AaC4hiiUGvjr3YIaEbA1` — `index.html:5991`
- `AaC4hiYjGvjr3YIaEa1g` — `worker/index.js:103`
- `AaC4hiiUGvjr3YIaEbBU` — `index.html:7141`
- `AaC4hiiTGvjr3YIaEbAp` — `index.html:5575`
- `AaC4hiiUGvjr3YIaEbBW` — `index.html:7163`
- `AaC4higoGvjr3YIaEa9w` — `mock-exam-editor.html:1160`
- `AaC4hiiUGvjr3YIaEbBV` — `index.html:7155`
- `AaC4hiY5Gvjr3YIaEa1t` — `worker/auth.js:33`
- `AaC4hiYjGvjr3YIaEa1j` — `worker/index.js:324`

### javascript:S7770

- `AaC4higoGvjr3YIaEa9d` — `mock-exam-editor.html:847`

### javascript:S4624

- `AaC4higoGvjr3YIaEa9e` — `mock-exam-editor.html:928`
- `AaC4higoGvjr3YIaEa9h` — `mock-exam-editor.html:950`
- `AaC4higoGvjr3YIaEa9f` — `mock-exam-editor.html:930`
- `AaC4higoGvjr3YIaEa9i` — `mock-exam-editor.html:951`
- `AaC4higoGvjr3YIaEa9k` — `mock-exam-editor.html:967`
- `AaC4hiiUGvjr3YIaEbBG` — `index.html:6888`
- `AaC4hiiUGvjr3YIaEbBI` — `index.html:6888`
- `AaC4hiiUGvjr3YIaEbBP` — `index.html:7080`
- `AaC4hiiUGvjr3YIaEbBR` — `index.html:7080`
- `AaC4higoGvjr3YIaEa9Z` — `mock-exam-editor.html:738`
- `AaC4higoGvjr3YIaEa9m` — `mock-exam-editor.html:1068`
- `AaC4higoGvjr3YIaEa9p` — `mock-exam-editor.html:1076`
- `AaC4higoGvjr3YIaEa-F` — `mock-exam-editor.html:1912`
- `AaC4hiiUGvjr3YIaEbBN` — `index.html:7079`
- `AaC4hiiUGvjr3YIaEbBC` — `index.html:6887`
- `AaC4hiiUGvjr3YIaEbBE` — `index.html:6887`

### javascript:S6535

- `AaC4hiZNGvjr3YIaEa2w` — `document-editor.html:345`
- `AaC4hiZNGvjr3YIaEa2z` — `document-editor.html:366`
- `AaC4higoGvjr3YIaEa9-` — `mock-exam-editor.html:1861`
- `AaC4higoGvjr3YIaEa99` — `mock-exam-editor.html:1861`
- `AaC4hiiTGvjr3YIaEa_6` — `index.html:2670`

### pythonsecurity:S5131

- `AaC65vk_rFF_D3zH8_MV` — `serve.py:652`
- `AaC65vk_rFF_D3zH8_MU` — `serve.py:613`

### javascript:S2757

- `AaC4higoGvjr3YIaEa-K` — `mock-exam-editor.html:2289`

### Web:S5255

- `AaC4hihRGvjr3YIaEa_J` — `legal.html:282`

### javascript:S3735

- `AaC4hiiUGvjr3YIaEbBf` — `index.html:7502`
- `AaC4hiiUGvjr3YIaEbBg` — `index.html:7504`

### python:S5332

- `AaC4hijuGvjr3YIaEbCC` — `serve.py:375`
- `AaC4hijuGvjr3YIaEbCD` — `serve.py:375`
- `AaC4hijuGvjr3YIaEbCN` — `serve.py:724`

### python:S8517

- `AaC4hijuGvjr3YIaEbCJ` — `serve.py:702`

### python:S3457

- `AaC4hijuGvjr3YIaEbCK` — `serve.py:711`
- `AaC4hijuGvjr3YIaEbCL` — `serve.py:713`
- `AaC4hijuGvjr3YIaEbCM` — `serve.py:714`

### Web:PageWithoutTitleCheck

- `AaC4hiiTGvjr3YIaEa_g` — `index.html:110`

### javascript:S8786

- `AaC4higoGvjr3YIaEa9a` — `mock-exam-editor.html:774`
- `AaC4higoGvjr3YIaEa9c` — `mock-exam-editor.html:839`
- `AaC4hiiTGvjr3YIaEa_3` — `index.html:2636`

### javascript:S7766

- `AaC4hiiUGvjr3YIaEbBb` — `index.html:7274`

### javascript:S6594

- `AaC4hiY5Gvjr3YIaEa1s` — `worker/auth.js:32`

### python:S5713

- `AaC4hijuGvjr3YIaEbCB` — `serve.py:366`
- `AaC4hijuGvjr3YIaEbCE` — `serve.py:441`

### css:S7924

- `AaC4hiiUGvjr3YIaEbBm` — `index.html:326`

### javascript:S7778

- `AaC4higoGvjr3YIaEa-G` — `mock-exam-editor.html:1914`

### javascript:S7785

- `AaC4higoGvjr3YIaEa-V` — `mock-exam-editor.html:2739`
- `AaC4higoGvjr3YIaEa-W` — `mock-exam-editor.html:2740`

### python:S7494

- `AaC4hijuGvjr3YIaEbCH` — `serve.py:558`

### javascript:S6660

- `AaC4hiiTGvjr3YIaEbAA` — `index.html:3410`
