import fs from "node:fs";

let html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (process.env.A11Y_RED === "1") {
  html = html.replace('href="#appMain"', 'href="#missing-main"');
}

const checks = [
  [/<a class="skip-link" href="#appMain">본문으로 건너뛰기<\/a>/, "본문 건너뛰기 링크"],
  [/<main id="appMain" tabindex="-1">/, "건너뛰기 포커스 대상"],
  [/<button type="button" class="brand" id="brandBtn"[^>]+aria-label="문제집 라이브러리로 이동"/, "키보드로 동작하는 브랜드 탐색"],
  [/id="headerInput"[^>]+aria-label="인쇄물 상단 문구"/, "상단 문구 입력 이름"],
  [/id="setSubject"[^>]+aria-label="문제집 과목"/, "과목 선택 이름"],
  [/id="qTitle"[^>]+aria-label="문항 제목"/, "문항 제목 입력 이름"],
  [/id="qDesc"[^>]+aria-label="문항 부제목"/, "문항 부제목 입력 이름"],
  [/id="qAnswer"[^>]+aria-label="문항 정답"/, "정답 입력 이름"],
  [/id="qGroupSpan"[^>]+aria-label="함께 묶을 문항 수"/, "묶음 선택 이름"],
  [/id="blockType"[^>]+aria-label="추가할 블록 종류"/, "블록 선택 이름"],
  [/id="qAnswerImgBtn"[^>]+aria-label="정답 이미지 넣기"/, "키보드 정답 이미지 선택"],
  [/id="aiDropZone"[^>]+aria-label="문제 사진으로 자동 생성"/, "키보드 AI 이미지 선택"],
  [/ta\.setAttribute\("aria-label",blk\.type==="boxed"\?"박스형 해설 본문":"문제 본문"\)/, "동적 본문 입력 이름"],
  [/lead\.setAttribute\("aria-label","지문 안내"\)/, "동적 지문 안내 이름"],
  [/tt\.setAttribute\("aria-label","표 제목"\)/, "동적 표 제목 이름"],
  [/who\.setAttribute\("aria-label",`대화 \$\{ii\+1\} 말한이`\)/, "동적 대화 입력 이름"],
  [/inp\.setAttribute\("aria-label",labelText\+" 내용"\)/, "동적 선지 입력 이름"],
  [/rm\.setAttribute\("aria-label",labelText\+" 삭제"\)/, "동적 선지 삭제 이름"],
  [/const pick=el\("button","iconbtn"\); pick\.type="button"/, "키보드 선지 이미지 선택"],
  [/const openBtn=el\("button","q-open"\)/, "키보드로 여는 문항 목록"],
  [/const addBtn=el\("button","add-q","\+ 문항 추가"\)/, "키보드로 추가하는 문항"],
  [/focusQuestionControl\(q\.id\)/, "문항 열기 뒤 포커스 복원"],
  [/focusQuestionControl\(np\.id\)/, "문항 추가 뒤 포커스 복원"],
  [/t\.setAttribute\("role",type==="error"\?"alert":"status"\)/, "토스트 의미 역할"],
  [/t\.setAttribute\("aria-live",type==="error"\?"assertive":"polite"\)/, "토스트 상태 알림"],
  [/t\.setAttribute\("aria-atomic","true"\)/, "토스트 전체 읽기"],
  /* 라이브러리 종류 전환은 제목 자리를 대신한다 — 탭 의미와 문서 제목이 함께 있어야 한다. */
  [/<h2 class="sr-only">라이브러리<\/h2>/, "라이브러리 문서 제목"],
  [/<div class="lib-tabs" role="tablist" aria-label="라이브러리 종류">/, "라이브러리 탭 목록"],
  [/id="tabMocks"[^>]+role="tab"[^>]+aria-selected="false" aria-controls="mocksPanel"/, "모의고사 탭 상태"],
  [/<div id="mocksPanel" role="tabpanel" aria-labelledby="tabMocks" hidden>/, "모의고사 탭 패널"],
];

const failed = checks.filter(([pattern]) => !pattern.test(html)).map(([, label]) => label);
if (failed.length) {
  console.error("접근성 계약 실패:", failed.join(", "));
  process.exit(1);
}
const blind = checks.filter(([pattern]) => pattern.test(html.replace(pattern, ""))).map(([, label]) => label);
if (blind.length) {
  console.error("접근성 계약 자기검사 실패:", blind.join(", "));
  process.exit(1);
}
console.log(`접근성 계약 통과 — ${checks.length}개`);
