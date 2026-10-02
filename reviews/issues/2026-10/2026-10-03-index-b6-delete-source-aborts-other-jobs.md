# 원문 하나를 지우면 관계없는 작업의 진행 중 쪽 요청까지 끊겨 그 쪽이 영영 '잠김'이 된다

- ID: `REV-2026-116`
- 날짜: `2026-10-03`
- 보고자: `Claude / Opus 5.5` (PR #8 CodeRabbit 지적을 독립 재현)
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-173` · `HANDOFF-2026-175`

## 요약과 영향

`pedagogy-intake.js` `deleteSource()`(`:269`)가 전역 `stop()`(`:311`)을 부른다. `stop()` 은 `controllers` 의 **모든**
요청을 끊고 모든 object URL 을 해제한다. 그래서 원문 A 를 지우면, A 와 관계없는 작업의 B 쪽 요청도 끊긴다.
`run()` 의 `catch` 는 `AbortError` 를 `locked` 로 기록한다(`:157`). `run()` 은 `locked` 쪽을 재시도 목록에 있어도 건너뛴다(`:101`).
결과: 서버는 그 호출을 처리했을 수 있다(quota·원장). 그런데 그 결과를 이 탭이 받지 못하고, 사용자는 그 쪽을 다시 처리할 수 없다.
삭제 세대 증가(`:264-266`)는 A 를 쓰는 작업에만 걸린다. 그러니 요청을 끊는 범위도 그 작업으로 좁혀야 맞다.
UI(U2/U1.5)가 아직 없어 **지금 사용자 영향은 없다.**

## 재현 절차

`codex/b6-intake-storage` `c178214`, `serve.py`, 외부 차단, `createIntakeFixture`(stub renderer · 끊길 때까지 기다리는 transport):
1. 원문 a.pdf 로 작업 A, b.pdf 로 작업 B 를 만든다.
2. `run(B)` 를 시작한다(요청이 진행 중으로 남는다). 그 사이 `impact(A 원문)` = `ready` → `deleteSource(A 원문)`.
3. B 의 쪽 상태 = **`locked`**. `run(B,{retryPages:[0],confirmCharge:true})` 뒤에도 **`locked`**.

## 제안

진행 중 요청을 sourceId(또는 jobId)로 기록하고, `deleteSource()` 는 지운 원문을 쓰는 요청만 끊는다.
전역 `stop()` 은 계정 전환·`purge()` 에만 남긴다. object URL 도 같은 기준으로 그 원문 것만 해제한다
(object URL 쪽은 코드로만 확인했다. U1.5 뷰어가 없어 재현하지 않았다).
회귀: 위 3번(B 는 `success`, 또는 끊기지 않음)과, A 를 쓰는 작업의 진행 중 요청은 여전히 끊기고 늦은 쓰기가 막히는지.
