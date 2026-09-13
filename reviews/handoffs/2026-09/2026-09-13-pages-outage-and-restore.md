# 변경 인계 — 배포본이 내려가 있던 것을 복구했다

- ID: `HANDOFF-2026-136`
- 날짜: `2026-09-13`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `docs`
- 관련 이슈: `없음`

## 무슨 일이었나

윈도우(패러럴즈)에서 화면을 확인하려고 `https://071205.github.io/pedagogy/` 를 열었더니
**404** 였다. 윈도우 문제가 아니라 **사이트가 존재하지 않았다.**

```
gh repo view  → {"isPrivate": true}
gh api …/pages → 404          ← Pages 설정 자체가 없음
gh api -X POST …/pages → 422 "Your current plan does not support GitHub Pages
                               for this repository."
```

⚠️ **무료 플랜은 비공개 저장소에 Pages 를 붙이지 못한다.** 그리고 비공개로 바꾸는 순간
Pages 설정이 **지워지므로**, 되살릴 때는 켜는 것이 아니라 다시 만들어야 한다.

⚠️ **이 저장소의 체크리스트가 이미 그 순서를 정해 두고 있었다** —
`docs/SECURITY-OPERATIONS-CHECKLIST.md` A 항목: "**새 호스트 정상 확인 후** 기존 Pages 는
이전 안내로 전환". 대체 호스트(Workers Static Assets)가 아직 없는데 비공개 전환이 먼저
일어나, 그 사이 제품이 통째로 내려가 있었다. 세 항목 모두 여전히 미체크 상태였다.

## 한 것

사용자가 **공개 복귀**를 선택했다(세 선택지 — 공개 복귀 · GitHub Pro · Workers 이전 — 중).

1. `gh repo edit --visibility public`
2. `gh api -X POST …/pages -f "source[branch]=main" -f "source[path]=/"`
3. 미푸시 17커밋(코덱스 14 · Claude 3) 푸시 — `dfa0a51..6f4f828`

⚠️ **새로 드러난 코드는 없다.** 푸시돼 있던 이력은 `dfa0a51` 그대로였고 그때까지 공개였다.
되돌린 것이지 새로 연 것이 아니다.

## 검증

- `https://071205.github.io/pedagogy/` → **200**, 40초 만에 빌드 완료
- 모듈 7개(`pedagogy-normalize/render/print` · `mock-library-store` · `service-config` ·
  `mock-exam-editor.html` · `legal.html`) 전부 200
- 푸시 뒤 재배포 확인 — `libraryModeBtn` 마커 4회 · `pedagogy-ai-image.js` 200
- Pages 빌드 `status: built`, `error: null`
- Windows 11 · Chrome 실측: 라이브러리 레이아웃·레일·모드 스위처·카드·푸터·한글 글꼴 정상

## 남은 것

- 비공개로 다시 가려면 **Workers Static Assets 를 먼저 띄운다**(A 항목 순서).
- 윈도우에서 아직 확인 못 한 것: 편집기 한글 IME 입력 · 인쇄 · HWPX 를 윈도우 한글로 열기.
  ⚠️ 패러럴즈로 보내는 합성 입력이 불안정해(클릭이 드래그로 잡히고 IME 가 영문을 한글로
  바꾼다) 사람이 직접 눌러야 한다.

## 검토 기록
