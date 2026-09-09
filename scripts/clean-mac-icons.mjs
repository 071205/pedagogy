/* macOS 폴더 아이콘 메타파일(`Icon\r`) 정리 — `REV-2026-074`.
 *
 * ⚠️ **왜 필요한가.** 파일명이 `Icon` + 캐리지리턴인 0바이트 파일이 `.git/refs` 아래에
 *    생기면 Git 이 그것을 ref 로 읽어 `git show-ref` 가 **종료코드 128 로 죽는다.**
 *    한 번 지웠는데 다시 생겼다(`-097` → `-104`).
 *
 * ⚠️ **원인을 지어내지 않는다.** 재현을 시도했지만 **못 했다** —
 *      · 저장소 루트·상위 폴더에는 아이콘 플래그가 **없다**
 *      · `.git/refs` 아래에 손으로 `mkdir` 하고 파일을 써도 플래그가 **안 붙는다**
 *      · 그런데 git·codex 가 만든 새 폴더(`.git/objects/XX`, turn-diff 체크포인트)에는 붙어 있다
 *    그래서 '무엇이 붙이는가' 는 **모른다고 적어 둔다.** 대신 안전한 정리 지점을 둔다.
 *
 * ⚠️ **좁은 조건만 지운다.** 이름이 정확히 `Icon\r` 이고 **0바이트**인 것만.
 *    `Icon*` 같은 넓은 패턴으로 지우지 않는다 — 정상 파일을 지울 수 있다.
 * ⚠️ 상위 폴더의 `com.apple.FinderInfo` 가 **아이콘 비트 하나뿐일 때만** 해제한다.
 *    다른 비트(라벨·잠금 등)가 섞여 있으면 건드리지 않고 남긴다.
 *
 *   npm run fix:icons          정리한다
 *   npm run fix:icons -- --check   보고만 한다 (`.git/refs` 에 있으면 종료코드 1)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHECK = process.argv.includes("--check");
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NAME = "Icon\r";
const ICON_ONLY = "0000000000000000040000000000000000000000000000000000000000000000";

function walk(dir, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) walk(p, out);
    else if (e.isFile() && e.name === NAME) out.push(p);
  }
  return out;
}
const finderInfo = (dir) => {
  try { return execFileSync("xattr", ["-px", "com.apple.FinderInfo", dir], { encoding: "utf8" })
    .replace(/\s/g, ""); } catch { return ""; }
};

const found = walk(ROOT).filter((p) => { try { return fs.statSync(p).size === 0; } catch { return false; } });
const inRefs = found.filter((p) => p.includes(`${path.sep}.git${path.sep}refs${path.sep}`));

if (!found.length) { console.log("macOS 아이콘 메타파일 없음"); process.exit(0); }

console.log(`macOS 아이콘 메타파일 ${found.length}개 (그중 .git/refs 안 ${inRefs.length}개)`);
if (CHECK) {
  if (inRefs.length) {
    console.error("⚠️ `.git/refs` 안에 있으면 `git show-ref` 가 죽습니다 — `npm run fix:icons` 로 정리하세요");
    process.exit(1);
  }
  console.error("⚠️ 해로운 자리는 아니지만 쌓입니다 — `npm run fix:icons` 로 정리하세요");
  process.exit(0);
}

const dirs = [...new Set(found.map((p) => path.dirname(p)))];
let cleared = 0, skipped = [];
for (const d of dirs) {
  const info = finderInfo(d);
  if (info && info !== ICON_ONLY) { skipped.push(d); continue; }   // 다른 비트가 섞였다 — 안 건드린다
  try { execFileSync("/usr/bin/SetFile", ["-a", "c", d]); cleared++; } catch { /* SetFile 없음 */ }
}
for (const p of found) { try { fs.unlinkSync(p); } catch (e) { console.warn("못 지움:", p, e.message); } }
console.log(`파일 ${found.length}개 삭제 · 폴더 ${cleared}개 아이콘 속성 해제`
  + (skipped.length ? ` · 다른 속성이 섞인 폴더 ${skipped.length}개는 건드리지 않음` : ""));
