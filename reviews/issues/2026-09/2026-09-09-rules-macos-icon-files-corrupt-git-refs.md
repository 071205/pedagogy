# macOS 폴더 아이콘 파일이 Git refs를 오염시킨다

- ID: `REV-2026-074`
- 날짜: `2026-09-09`
- 보고자: `Codex (독립 확인)`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `rules`
- 관련 인계: `없음`
- 처리 요청: `Claude`

## 요약과 영향

파일명이 `Icon` + 캐리지리턴(바이트 `49 63 6f 6e 0d`)인 macOS 사용자 폴더 아이콘
메타파일이 저장소에 113개 있다. 모두 0바이트이며, 104개는 `.git/refs` 아래에 있어 Git이
빈 파일을 ref로 해석한다. 이 때문에 `git show-ref`가 실패하고 `git for-each-ref`가 대량의
broken-ref 경고를 낸다. 나머지 9개는 `reviews/` 아래에 있으며 기존 `Icon?` ignore 규칙으로
추적되지는 않지만 같은 재발 원인을 보여 준다.

## 재현 절차

1. 저장소 루트에서 아래 개수를 확인한다.

   ```bash
   find .git/refs -type f -name $'Icon\r' | wc -l
   find reviews -type f -name $'Icon\r' | wc -l
   find .git/refs reviews -type f -name $'Icon\r' ! -size 0 | wc -l
   ```

2. `git check-ref-format $'refs/Icon\r'`를 실행한다.
3. `git show-ref --head`와 `git for-each-ref --format='%(refname)'`를 실행한다.

## 기대 결과 / 실제 결과

- 기대: `.git/refs`에는 유효한 Git ref만 있고 ref 열거 명령이 경고 없이 성공한다.
- 실제: 각각 `104`, `9`, `0`개가 집계된다. `check-ref-format`은 종료 코드 1이고,
  `git show-ref --head`는 `fatal: git show-ref: bad ref refs/Icon?`와 종료 코드 128을 낸다.
  `for-each-ref`는 잘못된 ref를 무시한다는 경고를 반복한다.

## 근거

- `od -An -tx1c`로 확인한 basename은 `49 63 6f 6e 0d`이며 화면에 보이는 `?`는 실제
  물음표가 아니라 캐리지리턴이다.
- 113개 파일 모두 0바이트이고, 현재 main 트리에는 `Icon...` 경로가 추적되어 있지 않다.
- 113개 상위 폴더의 `com.apple.FinderInfo` 값은 모두
  `0000000000000000040000000000000000000000000000000000000000000000`이다. 다른 비트 없이
  macOS 사용자 아이콘 플래그(`0x0400`)만 설정돼 있어 같은 이름의 파일이 생긴 원인이
  확인된다.
- `.gitignore`에는 이미 `Icon?` 규칙이 있으나 `.git/` 내부 ref 탐색에는 적용되지 않는다.

## 제안 (Claude 처리 범위)

1. 먼저 정확한 basename이 `Icon\r`이고 크기가 0인 대상만 다시 dry-run으로 집계한다.
   `Icon*` 같은 넓은 패턴으로 삭제하지 않는다.
2. 각 대상의 상위 폴더에서 다른 FinderInfo 비트가 없음을 확인한 뒤 `/usr/bin/SetFile -a c`
   로 사용자 아이콘 속성을 해제해 재생성을 막는다.
3. 그 다음 검증된 0바이트 `Icon\r` 파일만 `.git/refs`와 `reviews`에서 제거한다. 정상 ref와
   다른 `Icon...` 파일은 건드리지 않는다.
4. 한 번만 `git show-ref --head`, `git for-each-ref --format='%(refname)'`, `git status --short`
   를 실행해 fatal·broken-ref 경고가 사라졌는지 확인한다. 원격 작업 전 `git fsck --full`도
   한 번 실행해 실제 ref/object 손상이 없음을 확인한다.
5. `.gitignore`의 기존 `Icon?` 규칙은 작업 트리 재유입 방지용으로 유지한다. 단, 이 규칙이
   `.git/refs` 재발을 막는다고 기록하지 않는다.

## 처리 기록

- `2026-09-09` — `Codex`: 삭제나 속성 변경 없이 파일명 바이트, 개수, 크기, Git 명령 실패,
  FinderInfo 값을 독립 확인해 등록했다. Claude가 위의 좁은 대상 조건으로 정리·검증하도록
  남겼다.

- `2026-09-09` — `Claude`: 해결. ⚠️ **범위가 보고보다 넓었다** — `.git/refs`·`reviews` 만
  세면 115개인데 **저장소 전체로는 3,737개**였다(`.git/objects`·`.git/logs` 등 곳곳).
  `for-each-ref` 의 남은 경고 9줄도 그것들 때문이었고, 두 하위 트리만 지웠을 때는 사라지지
  않았다. **좁은 조건은 유지**했다 — 정확히 `Icon\r` 이고 **0바이트인 것만**(전체 3,737개가
  모두 0바이트임을 먼저 확인했고, 다른 `Icon*` 이름은 0개였다).
  상위 폴더 115개의 `com.apple.FinderInfo` 가 전부
  `...0400...` 하나뿐임을 `xattr -px` 로 **직접 재확인**한 뒤 `SetFile -a c` 로 해제했다
  (보고된 값을 그대로 믿지 않았다 — 처음 `xattr -p` 로 읽었을 때는 바이너리라 빈 값처럼
  보여 '속성이 없다' 고 오판할 뻔했다).
  검증: `git show-ref --head` 종료코드 **0** · `for-each-ref` stderr **0줄** ·
  `git fsck --full` 은 dangling object 만(손상 없음) · `git status` 정상.
  `.gitignore` 의 `Icon?` 규칙은 작업 트리 재유입 방지용으로 그대로 두었다 —
  **그 규칙이 `.git` 안쪽 재발을 막지는 않는다.**

- `2026-09-10` — `Codex`: 독립 검토 중 재발을 확인해 다시 열었다. Claude의 정리 직후
  검증은 유효했지만 새로 만들어진 디렉터리에는 예방 효과가 없었다. 정확히 `Icon\r`인
  0바이트 파일이 다시 13개 생겼고(새 `.git/refs/codex/turn-diffs/...` 10개,
  `.git/objects/...` 3개), 해당 13개 상위 폴더에 `0x0400` FinderInfo 플래그도 다시 붙었다.
  `git show-ref --head`는 다시 종료 코드 128과 `bad ref .../Icon?`을 냈다. 기존 상위 폴더의
  플래그를 한 번 해제하는 방식은 새 폴더 생성자를 막지 못하므로, 생성 주체를 찾아 끄거나
  Git 명령 직전 안전 정리를 자동화하는 별도 재발 방지가 필요하다. 이번 리뷰에서는 원인을
  모른 채 정리만 반복하지 않았다.

- `2026-09-10` — `Claude`: 코덱스가 재발을 확인해(`HANDOFF-2026-104`) 다시 열었다.
  **단순 재삭제로 닫지 않았다.** 재현을 시도했고 **실패했다** — 저장소 루트·상위에는
  플래그가 없고, `.git/refs` 아래에 손으로 `mkdir` 하고 파일을 써도 안 붙는다. 그런데
  git 이 만든 `.git/objects/58`(내 커밋 시각)과 codex turn-diff 폴더에는 붙어 있었다.
  **무엇이 붙이는지는 모른다 — 모른다고 남긴다.**
  대신 **자동 안전 정리 지점**을 만들었다: `npm run fix:icons`(정확히 `Icon\r` · 0바이트만 ·
  상위 폴더의 FinderInfo 가 아이콘 비트 하나뿐일 때만 해제) · `npm run check:icons`
  (**`.git/refs` 안이면 종료코드 1** — `git show-ref` 가 죽는 자리다) · `check:fast` 맨 앞에 연결.
  CI 에는 이 파일이 없어 통과하고 재발하는 이 컴퓨터에서만 걸린다.
  ⚠️ **원인이 남아 있으므로 이슈는 열어 둔다.**

- `2026-09-11` — `Codex` (`HANDOFF-2026-118`): `.git/refs`의 정확한 0바이트 Icon 메타파일
  4개 재발로 `check:icons` 실패를 확인했다. 기존 정리 코드의 대상 조건을 읽고
  `npm run fix:icons`로 4개만 제거한 뒤 `check:fast`를 통과했다. 생성 원인을 규명하거나
  예방했다고 주장하지 않으며 열린 상태를 유지한다.

- `2026-09-11` — `Codex` (`HANDOFF-2026-119`): 전체 회귀 중 32개(그중 `.git/refs` 12개)가
  다시 생겨 `check:icons`를 실패시켰다. 기존 조건으로 32개만 제거하고 재실행을 통과했다.
  반복 정리는 예방이 아니므로 상태는 `open` 그대로다.

- `2026-09-11` — `Codex` (`HANDOFF-2026-122`): 최초 check:fast가 11개(그중 refs 2개) 재발로 중단됐다. 기존의 정확한 0바이트 basename/FinderInfo 조건을 확인하고 11개만 정리했다. 생성 주체를 입증하지 못했으므로 열린 상태를 유지한다.

- `2026-09-12` — `Codex` (`HANDOFF-2026-122` 마무리): 작업 재개 후 39개(그중 refs 7개) 재발을 확인했다. 기존 정리 스크립트로 정확한 0바이트 파일 39개와 아이콘 전용 폴더 속성 39개만 정리했다. 재발 원인은 여전히 미확인이므로 `open`을 유지한다.

## 원인 — Google Drive 동기화다 (2026-09-17 · `Claude / Opus 5`)

⚠️ **`/Users/huryul/pedagogy-main` 자체가 Google Drive for Desktop 의 동기화 루트다.**

```
~/Library/Application Support/Google/DriveFS/root_preference_sqlite.db
  4|…|pedagogy-main|Users/huryul/pedagogy-main|…|/Users/huryul/pedagogy-main
```

**근거 넷이 같은 곳을 가리킨다:**

1. 위 DB 행 — 이 폴더가 mirror 루트로 등록돼 있다.
2. **시각이 맞는다.** `npm run fix:icons` 로 전부 지운 직후, 커밋·푸시한 `10:14:13` 에
   정확히 네 개가 새로 생겼고 자리가 `.git/objects/13`·`6d`·`80`·`fc` — **git 이 그때
   만든 느슨한 개체 폴더들**이다. 빈 폴더를 새로 만드는 것만으로는 안 생긴다(실험함).
3. `Google Drive.app` 의 `FinderSyncExtension` 이 떠 있다.
4. **`git fsck` 가 이름을 댄다** — `bad sha1 file: .git/objects/13/Icon` 외 3건.

즉 Drive 가 자기가 만지는 폴더마다 `Icon\r` 를 쓰고, 그 대상에 **`.git` 내부가 포함된다.**
`.git/refs` 안에 들어가면 `git show-ref` 가 죽는 것이 그 결과다.

## 이것은 미관 문제가 아니다

- ⚠️ **Drive 가 살아 있는 git 저장소를 동기화하는 것 자체가 위험하다.** git 이 개체를
  쓰는 도중 부분 동기화되거나 충돌 사본(`파일 (1).js`)이 `.git` 안에 생기면 저장소가
  깨진다. **지금은 충돌 사본이 없고 `fsck` 도 Icon 말고는 깨끗하다** — 운이 좋았다.
- ⚠️ **`.gitignore` 로 막아 둔 저작물이 Drive 에는 올라간다.** `.gitignore` 는 git 만
  막고 Drive 는 파일 시스템을 본다. 평가원 양식 `.hwp`·`.hwpx` 와 67MB PDF 가 포함된다.
  폴더 전체 **354MB** 가 동기화 대상이고 그중 `.git` 이 28MB 다.

## 고치는 법 — 사람이 해야 한다

`npm run fix:icons` 는 **증상만 지운다.** 원인을 끄려면 Drive 설정을 바꿔야 한다.

1. **권장** — Google Drive 환경설정에서 이 폴더의 동기화를 **끈다**(저장소는 GitHub 이
   이미 원격이다. Drive 로 이중 백업할 이유가 약하고 위험이 크다).
2. 그래도 동기화하겠다면 **최소한 `.git` 을 제외**한다.
3. 저장소를 Drive 루트 **밖으로 옮긴다**.

셋 중 하나를 하기 전에는 `Icon\r` 이 계속 재발하고 `check:fast` 가 첫 단계에서 막힌다.
