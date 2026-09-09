# PEDAGOGY 법률 고지·동의 벤치마크 감사

- 검토일: 2026-09-09
- 범위: 대한민국 이용자를 대상으로 하는 무료 교육용 문서 편집기, 구글 로그인·클라우드 저장,
  선택적 이미지 AI 변환
- 성격: 공개 법령·공식 사업자 문서를 바탕으로 한 제품 감사이며 개별 사건의 법률 자문이 아니다.

## 결론

문서의 전체 구조와 저작권·내보내기·만 14세 미만 제한·AI 오류 경고는 유지할 만하다. 이번에
손댈 필요가 있었던 것은 세 가지였다.

1. 로그인 동의에서 필수 클라우드 이전과 선택적 AI 전송을 한 항목으로 묶은 부분
2. 비로그인 상태에서도 호스팅 사업자가 접속 정보를 처리하는데 “개인정보를 받지 않는다”고 한 요약
3. 확인하지 않은 운영자 소재지·App Check 적용·통신판매업 의무를 이미 확정된 사실처럼 쓴 부분

반대로 해외 대기업 약관의 긴 면책·배상·중재 문구를 복사하거나, 아직 없는 결제·광고·공유 기능을
가정해 조항을 늘리는 것은 하지 않았다. 문서가 길어질수록 실제 제품과 어긋날 위험도 커진다.

## 적용 법령과 판단

| 쟁점 | 공식 근거 | PEDAGOGY에 적용한 판단 |
|---|---|---|
| 수집·이용 동의 | [개인정보 보호법 제15조](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1020398625) | 목적·항목·보유기간·거부권과 불이익을 로그인 전에 함께 알림 |
| 동의의 구분 | [개인정보 보호법 제22조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1006185927) | 개인정보, 국외이전, 선택적 AI 처리를 기능 단위로 구분 |
| 국외이전 | [개인정보 보호법 제28조의8](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334953) 및 [고지 항목](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1033215841) | 수령자·국가·시기/방법·항목·목적·기간·거부 방법을 정책에서 실제 계약 기준으로 공개해야 함 |
| 알아보기 쉬운 동의 | [개인정보 보호법 시행령 제17조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=286175) | 필수 여부와 거부 시 이용 가능한 로컬 모드를 짧은 문장으로 표시 |
| 생성형 AI 고지 | [인공지능기본법 제31조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1031809549) | AI 실행 전에 AI 기반 처리·외부 전송·오류 가능성을 알리는 기존 별도 확인창 유지 |
| 유출 통지 | [개인정보 보호법 제34조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033216011) | 법정 개별 통지를 일반 공지로 갈음한다고 단정하지 않도록 예외를 명시 |
| 약관 설명 | [약관규제법 제3조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025032403) | 로그인 전에 전문 링크와 핵심 효과를 제공 |

[개인정보보호위원회의 2025 개인정보 처리방침 작성지침](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=11133)도
요약 라벨과 본문의 일치, 실제 처리 현황에 근거한 공개를 우선한다. 법률 문구보다 콘솔 설정과
수탁계약이 먼저 확정되어야 하는 이유다.

## 공식 서비스 벤치마크

| 서비스 | 확인한 공식 문서와 좋은 패턴 | PEDAGOGY 반영 여부 |
|---|---|---|
| 미리캔버스 | [처리방침](https://help.miricanvas.com/hc/ko/articles/54468379134745-%EB%AF%B8%EB%A6%AC%EC%BA%94%EB%B2%84%EC%8A%A4-%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EC%B2%98%EB%A6%AC%EB%B0%A9%EC%B9%A8-%EC%8B%9C%ED%96%89%EC%9D%BC%EC%9E%90-2026%EB%85%84-2%EC%9B%94-14%EC%9D%BC)은 국외이전을 수령자·국가·시점/방법·항목·목적·기간·연락처로 분리하고 법적 근거도 표시 | 제5조 표의 목표 형식으로 채택. 아직 모르는 Firebase·Cloudflare 값은 추측하지 않고 출시 게이트로 유지 |
| 미리캔버스 | [변경 사전 안내](https://help.miricanvas.com/hc/ko/articles/57644425502105--%ED%95%84%EB%8F%85-%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EC%B2%98%EB%A6%AC%EB%B0%A9%EC%B9%A8-%EB%B3%80%EA%B2%BD-%EC%82%AC%EC%A0%84-%EC%95%88%EB%82%B4)는 공지일·시행일·변경 조항·이의제기 경로를 분리 | 개정 이력과 불리한 변경 30일 공지 유지 |
| Google | [이용약관](https://policies.google.com/terms?hl=en-US)은 이용자가 원래 가진 권리를 유지하되 서비스 제공에 필요한 제한적 라이선스와 제3자 권리 보유 책임을 함께 설명 | “만든 것은 전부 내 것”이라는 과장을 “적법하게 가진 권리 유지”로 교정 |
| Firebase | [개인정보·보안 안내](https://firebase.google.com/support/privacy/)는 Authentication은 미국, Firestore·Storage 등은 선택 위치 또는 글로벌 처리일 수 있다고 구분 | 모든 Firebase 자료를 단순히 “Google(미국)”이라고 한 동의 문구 삭제 |
| Firebase | [Firestore 위치 문서](https://firebase.google.com/docs/firestore/enterprise/locations)는 프로젝트별 선택 위치가 고정되며 콘솔이나 CLI로 확인해야 한다고 안내 | 읽기 전용 CLI로 실제 `asia-northeast3`(서울)을 확인해 반영하고 Storage 위치는 별도 확인 대상으로 남김 |
| GitHub Pages | [공식 설명](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)은 방문자 IP를 보안 목적으로 기록한다고 밝힘 | “비로그인 시 개인정보를 전혀 받지 않는다”는 요약을 접속 정보 예외와 일치시킴 |
| Notion | [AI 보안·개인정보](https://www.notion.com/help/notion-ai-security-practices)는 AI 처리 단계, 하위 처리자, 암호화, 학습 여부, 보존기간을 기능 문서에서 별도로 설명 | 일반 로그인 동의와 AI 실행 고지를 분리하는 구조 유지 |
| Notion | [AI 안전 원칙](https://www.notion.com/help/ai-safety)은 기본 학습 미사용과 자동 의사결정 용도가 아님을 기능 범위로 한정 | 실제 Anthropic 상용 API 정책 범위 안에서만 학습 미사용·보조 기능을 고지 |
| Canva | [AI 제품 약관](https://www.canva.com/policies/ai-product-terms/)은 입력 권리, 출력 비유일성, 제3자 라이선스, 오류 검토, 기술 파트너 전송을 한곳에 모음 | 기존 AI 특칙의 검토 의무·제3자 권리 예외 유지; 무조건적 출력 소유 표현은 피함 |
| Canva | [일반 이용약관](https://www.canva.com/policies/terms-of-use/)은 콘텐츠 소유권과 서비스 제공용 라이선스를 구분 | PEDAGOGY 제7조의 제한적 처리 라이선스 유지 |
| Adobe | [생성형 AI 지침](https://www.adobe.com/legal/licenses-terms/adobe-gen-ai-user-guidelines.html)은 결과 오류·전문 조언 아님·콘텐츠 출처·AI 표시를 기능별로 설명 | 교육 문항 초안의 수식·정답을 출제자가 검토해야 한다는 기존 조항 유지 |
| Goodnotes | [AI 추가 개인정보 고지](https://www.goodnotes.com/supplemental-privacy-notice-for-ai-beta-features)는 일반 처리방침보다 AI 입력·출력 처리를 우선하는 별도 고지를 둠 | AI 실행 시 별도 확인창을 유지하고 로그인 단계에서는 AI 동의를 받지 않음 |
| Quizlet | [개인정보처리방침](https://quizlet.com/privacy)은 아동 계정, 제한 기능, 서비스 제공자, 자동 수집 정보를 별도 구획으로 설명 | 법정대리인 확인 체계가 없는 현재는 만 14세 미만 로그인을 막고 로컬 모드만 제공 |
| Quizlet | [커뮤니티 가이드](https://quizlet.com/guidelines)는 시험은행·개인정보·저작권 등 교육 서비스 고유 위험을 일반 약관과 분리 | 현재 공개 공유 기능이 없으므로 별도 커뮤니티 정책은 만들지 않고 금지행위·AI 개인정보 경고만 유지 |
| Microsoft | [서비스 약관](https://www.microsoft.com/en-us/servicesagreement)은 AI 입력·출력에 대해 소유권을 주장하지 않으면서 권리 보유 책임과 결과 권리의 불확실성을 함께 알림 | 출력물의 제3자 권리 예외와 이용자 검토 책임 유지 |
| Anthropic | [상용 API 학습 안내](https://privacy.anthropic.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training)와 [보존기간 안내](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)를 구분해 공개 | 상용 API 기본 학습 미사용과 기본 30일 보존을 서로 다른 사실로 고지 |

## 변경하지 않은 부분

- 콘텐츠를 공개·판매·광고에 쓰지 않고 서비스 제공 범위에서만 처리한다는 조항
- 제3자 저작물을 업로드할 권리와 최종 산출물 검토 책임
- 계정 삭제 전 내보내기 안내, JSON/HWPX 반출 경로
- 만 14세 미만 로그인 제한과 로컬 모드 대안
- AI를 직접 실행할 때만 이미지가 Cloudflare·Anthropic으로 전송된다는 점
- 고의·중과실 면책 배제, 일반 법정 관할, 유료화 전 환불 기준 별도 고지

## 출시 전 반드시 사람이 확인할 항목

1. Firebase Authentication은 미국, Firestore는 읽기 전용 CLI로 서울(`asia-northeast3`)임을
   확인했다. Console에서 Cloud Storage와 App Check의 실제 처리·저장 국가를 추가 확인한다.
2. Cloudflare Workers/KV 계약과 데이터 위치, 이전 방법, 보존기간, 개인정보 연락처를 확인한다.
3. 운영자 상호·주소·연락처·개인정보 보호책임자와 국내대리인 적용 여부를 확정한다.
4. 위 사실로 `legal.html#thirdparty`의 노란 항목을 채우기 전에는 현재 동의 화면만으로
   국외이전 고지가 완성됐다고 보지 않는다.
5. 유료 결제 전 사업자 형태에 따른 신고·표시·청약철회·미성년자 결제 절차를 별도 검토한다.
6. Firestore의 이용자 수정 가능 기록은 불변 증적이 아니다. 유료 출시 전 서버 시각, 정책 원문
   또는 해시, 철회 이력을 조작 방지 저장소에 남긴다.

## 검증 기준

- 약관/방침 버전과 `CONSENT_VERSION`이 일치한다.
- 로그인 개인정보 동의에 목적·항목·기간·거부 효과가 보인다.
- 로그인 국외이전 동의가 선택적 AI 전송을 포함하지 않는다.
- 비로그인 요약이 GitHub Pages 등의 기술적 접속 정보 처리를 부정하지 않는다.
- 구현하지 않은 App Check enforcement를 현재 안전조치라고 표시하지 않는다.
