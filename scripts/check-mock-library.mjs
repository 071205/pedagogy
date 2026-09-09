/* 모의고사 라이브러리 저장 계층 검사 — 순수 함수와 저장 어댑터를 실패 주입으로 본다.
   (`docs/MOCK-LIBRARY-DESIGN.md` 1단계: "실패 주입 검사를 먼저 만든다")

   ⚠️ **브라우저가 필요 없다.** 고전 스크립트를 `vm` 에 그대로 올려 CI 에서 늘 돈다.
   ⚠️ **자기검사가 들어 있다** — `MOCK_STORE_RED=1` 로 돌리면 저장 계약을 일부러
      깨뜨려 이 검사가 빨간불이 되는지 스스로 본다. 늘 통과하는 검사는 없느니만 못하다. */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const RED = process.env.MOCK_STORE_RED === "1";
let src = fs.readFileSync(new URL("../mock-library-store.js", import.meta.url), "utf8");
if (RED) {
  /* 고장 주입 — 쓰기 실패를 성공으로 보고하게 만든다(설계의 '저장 실패 경고' 계약). */
  src = src.replace("catch(e){ return {ok:false,error:e}; }", "catch(e){ return {ok:true}; }");
}

/* 던지게 만들 수 있는 가짜 저장소 — 실제 localStorage 는 사파리 설정·용량에서 던진다. */
function fakeStorage(opts = {}) {
  const map = new Map();
  return {
    map,
    fail: opts.fail || null,          // 'get' | 'set' | 'all'
    getItem(k) {
      if (this.fail === "get" || this.fail === "all") throw new Error("blocked");
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (this.fail === "set" || this.fail === "all") throw new Error("QuotaExceededError");
      map.set(k, String(v));
    },
    removeItem(k) {
      if (this.fail === "all") throw new Error("blocked");
      map.delete(k);
    },
  };
}

const sandbox = { window: {}, crypto: globalThis.crypto, Date, Math, JSON, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "mock-library-store.js" });
const S = sandbox.window.MockLibraryStore;
assert.ok(S, "window.MockLibraryStore 가 없습니다");

/* ⚠️ vm 안에서 만들어진 값은 **다른 realm** 이라 `deepStrictEqual` 이 구조가 같아도
   실패한다(prototype 이 다르다). 비교 전에 이쪽 realm 의 평범한 값으로 옮긴다. */
const plain = v => JSON.parse(JSON.stringify(v));

const fails = [];
function test(name, fn) {
  try { fn(); console.log("PASS", name); }
  catch (e) { fails.push(name); console.error("FAIL", name, "—", e.message); }
}

test("이름·선택과목·문항 개수를 화이트리스트로 고정한다", () => {
  const e = S.normMock({ name: "x".repeat(500), elective: "javascript:alert(1)",
                         problems: [...Array(200)].map((_, i) => ({ n: i })) });
  assert.equal(e.name.length, S.NAME_MAX);
  assert.equal(e.elective, "확률과 통계");
  assert.equal(e.problems.length, S.MAX_PROBLEMS);
  /* 문항 안쪽은 일부러 건드리지 않는다 — 편집기 sanitize 가 유일한 정답표다. */
  assert.equal(e.problems[0].n, 0);
});

test("배열이 아닌 것·문항이 아닌 것을 버린다", () => {
  assert.equal(S.normMock(null), null);
  assert.equal(S.normMock([1, 2]), null);
  assert.deepEqual(plain(S.normMock({ problems: ["x", null, 3, { ok: 1 }] }).problems), [{ ok: 1 }]);
  assert.deepEqual(plain(S.normMockList("not an array")), []);
});

/* ⚠️ 이 sandbox 에는 `window.crypto` 가 없다 — **그 폴백 경로가 검사 대상이다.**
   처음 구현은 crypto 가 없으면 영바이트를 써서 모든 id 가 같았다. */
test("id 는 crypto 가 없어도 서로 다르다", () => {
  const seen = new Set([...Array(500)].map(() => S.newId()));
  assert.equal(seen.size, 500, "같은 id 가 생기면 다른 카드를 열게 된다");
});

test("가져온 id 는 모양이 맞을 때만 지킨다", () => {
  assert.equal(S.normMock({ id: "mock_abc123" }, { keepId: true }).id, "mock_abc123");
  const bad = S.normMock({ id: '"><img src=x>' }, { keepId: true }).id;
  assert.match(bad, /^mock_[A-Za-z0-9]+$/);
});

test("같은 id 가 둘이면 뒤엣것을 버리고 개수 상한을 지킨다", () => {
  const dup = S.normMockList([{ id: "mock_aaaaaa" }, { id: "mock_aaaaaa" }], {});
  assert.equal(dup.length, 1);
  assert.equal(S.normMockList([...Array(500)].map(() => ({}))).length, S.MAX_ENTRIES);
});

test("복제는 새 id 와 깊은 사본을 준다", () => {
  const a = S.normMock({ name: "6월", problems: [{ stmt: "원본" }] });
  const b = S.duplicateMock(a, 1000);
  assert.notEqual(a.id, b.id);
  assert.equal(b.name, "6월 복제");
  b.problems[0].stmt = "바뀜";
  assert.equal(a.problems[0].stmt, "원본", "얕은 사본이면 원본까지 바뀐다");
});

test("upsert 는 같은 id 를 덮어쓰고 remove 는 그것만 지운다", () => {
  const a = S.newMock({ name: "가" }), b = S.newMock({ name: "나" });
  let list = S.upsertMock(S.upsertMock([], a), b);
  assert.equal(list.length, 2);
  list = S.upsertMock(list, { ...a, name: "가2" });
  assert.equal(list.length, 2);
  assert.equal(S.findMock(list, a.id).name, "가2");
  assert.deepEqual(plain(S.removeMock(list, a.id).map(e => e.id)), [b.id]);
});

test("정렬은 최근 수정·만든 시각·이름 셋을 지원하고 모르는 값은 최근 수정순", () => {
  const list = [
    S.normMock({ name: "나", createdAt: 3, updatedAt: 1 }),
    S.normMock({ name: "가", createdAt: 1, updatedAt: 3 }),
  ];
  assert.deepEqual(plain(S.sortMocks(list, "updated").map(e => e.name)), ["가", "나"]);
  assert.deepEqual(plain(S.sortMocks(list, "created").map(e => e.name)), ["나", "가"]);
  assert.deepEqual(plain(S.sortMocks(list, "name").map(e => e.name)), ["가", "나"]);
  assert.deepEqual(plain(S.sortMocks(list, "??").map(e => e.name)), ["가", "나"]);
});

test("저장 키는 계정별로 갈라지고 소유자가 없으면 guest 다", () => {
  const a = S.keysFor("uid-1"), g = S.keysFor("");
  assert.notEqual(a.list, g.list);
  assert.match(g.list, /:guest$/);
  /* 이상한 소유자 문자열이 키 이름을 흔들지 않는다 */
  assert.equal(S.keysFor("a/b c:d").list, S.keysFor("ab c:d".replace(/[^A-Za-z0-9_.:-]/g, "")).list);
});

test("읽기·쓰기가 막힌 저장소에서 던지지 않고 실패를 알린다", () => {
  const blocked = fakeStorage({ fail: "all" });
  const r = S.readMocks("u", blocked);
  assert.equal(r.ok, false);
  assert.deepEqual(plain(r.list), []);
  const w = S.writeMocks("u", [S.newMock({ name: "가" })], blocked);
  assert.equal(w.ok, false, "저장 실패를 성공으로 보고하면 사용자가 안전망을 믿는다");
  assert.equal(S.readLastMock("u", blocked), "");
  assert.equal(S.writeLastMock("u", "mock_a", blocked).ok, false);
});

test("손상된 저장 내용은 빈 목록으로 떨어지되 조용하지 않다", () => {
  const st = fakeStorage();
  st.map.set(S.keysFor("u").list, "{not json");
  const r = S.readMocks("u", st);
  assert.equal(r.ok, false);
  assert.equal(r.corrupt, true);
});

test("왕복 — 쓴 것을 그대로 다시 읽는다", () => {
  const st = fakeStorage();
  const e = S.normMock({ name: "9월", elective: "미적분", problems: [{ stmt: "가" }] });
  assert.equal(S.writeMocks("u", [e], st).ok, true);
  const back = S.readMocks("u", st);
  assert.deepEqual(plain(back.list.map(x => [x.id, x.name, x.elective, x.problems.length])),
                   [[e.id, "9월", "미적분", 1]]);
});

test("구형 임시본을 카드 하나로 옮기고 원본 키는 남긴다", () => {
  const st = fakeStorage();
  st.map.set(S.LEGACY_KEY, JSON.stringify({ v: 1, round: "옛 시험", elective: "기하",
                                            problems: [{ stmt: "가" }, { stmt: "나" }], savedAt: 777 }));
  const r = S.migrateLegacyDraft("u", st, 1000);
  assert.equal(r.status, "done");
  assert.equal(r.entry.name, "복구된 모의고사");
  assert.equal(r.entry.round, "옛 시험");
  assert.equal(r.entry.problems.length, 2);
  assert.ok(st.map.has(S.LEGACY_KEY), "원본 키를 즉시 지우면 이전이 잘못돼도 되돌릴 수 없다");
  assert.ok(st.map.has(S.keysFor("u").migrated));
});

test("이전은 멱등하다 — 다시 불러도 카드가 늘지 않는다", () => {
  const st = fakeStorage();
  st.map.set(S.LEGACY_KEY, JSON.stringify({ problems: [{ stmt: "가" }] }));
  S.migrateLegacyDraft("u", st, 1000);
  assert.equal(S.migrateLegacyDraft("u", st, 2000).status, "already");
  /* 마커가 사라져도 '목록이 비어 있을 때만' 조건이 두 번째 방어선이다 */
  st.map.delete(S.keysFor("u").migrated);
  assert.equal(S.migrateLegacyDraft("u", st, 3000).status, "skip");
  assert.equal(S.readMocks("u", st).list.length, 1);
});

test("이전 실패는 원본을 보존한 채 실패로 보고한다", () => {
  const st = fakeStorage();
  st.map.set(S.LEGACY_KEY, JSON.stringify({ problems: [{ stmt: "가" }] }));
  st.fail = "set";
  const r = S.migrateLegacyDraft("u", st, 1000);
  assert.equal(r.status, "error", "쓰기가 막혔는데 성공이라 하면 구형 키를 지울 근거가 생긴다");
  assert.ok(st.map.has(S.LEGACY_KEY));
  assert.equal(st.map.has(S.keysFor("u").migrated), false);
});

test("옮길 것이 없거나 손상됐으면 각각 다르게 답한다", () => {
  const empty = fakeStorage();
  assert.equal(S.migrateLegacyDraft("u", empty, 1).status, "none");
  const junk = fakeStorage();
  junk.map.set(S.LEGACY_KEY, "{broken");
  assert.equal(S.migrateLegacyDraft("u", junk, 1).status, "corrupt");
  assert.equal(junk.map.has(S.keysFor("u").migrated), false, "손상된 원본에 이전 완료 표시를 남기면 안 된다");
});

if (RED) {
  if (!fails.length) {
    console.error("자기검사 실패: 저장 실패를 성공으로 바꿨는데 검사가 통과했습니다");
    process.exit(1);
  }
  console.log(`자기검사 통과 — 고장 주입에서 ${fails.length}건이 빨간불`);
  process.exit(0);
}
if (fails.length) { console.error("실패:", fails.join(", ")); process.exit(1); }
console.log("모의고사 라이브러리 저장 계층 통과");
