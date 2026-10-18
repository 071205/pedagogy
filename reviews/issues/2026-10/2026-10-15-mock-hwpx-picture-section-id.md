# 그림 이름이 미래 구역 ID를 사용해 새 출력 gate에 걸림

- ID: `REV-2026-126`
- 날짜: `2026-10-15`
- 보고자: `Claude 후보 · Codex 재현`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-191`

## 요약과 영향

blank1구역에서 append_picture/appendPicture에 section1.png를 전달하면 manifest id=section1이 되어 새 canonical export가 거절했다. 파일명과 리소스 ID 생성 정책이 충돌한 회귀다.

## 재현 절차 / 기대 결과 / 실제 결과

새 picture-section-name 사례를 양쪽 실제 writer로 실행해 수정 전 PICTURE_RESERVED_ID exit1을 확인했다.
검사: `scripts/check-hwpx-section-package.py`와 실제 DOM의 `.mjs`.
그림 파일명 때문에 정상 출력이 거절되지 않아야 하며 manifest ID와 본문의 이미지 참조·바이너리 경로를 보존해야 한다.

## 처리 기록

- `2026-10-15` · Codex: Python/JS _manifest_id/_manifestId가 기존 ID와 section[0-9]+ 예약 ID를 모두 피한다. 그림 경로/이미지 참조·바이트를 보존하고 save/toBlob/재열기를 확인한다. picture-id RED가 양쪽 PICTURE_RESERVED_ID로 실패한다.
  최종56사례·기존출력 대조·Claude 좁은 후속 검토는191에 모은다.
- Claude F의 검사 보완에 따라 생성한 ID/href도 양쪽 결과 레코드에서 비교한다.
  다른 유효 ID로 주입한 JS `picture-id-parity` RED가 `SECTION_PACKAGE_PARITY`로 실패한다.
