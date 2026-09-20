/* 고장을 심은 HTML 의 CSP 인라인 해시를 다시 계산한다.
 *
 * ⚠️ **왜 필요한가**(`REV-2026-097`): `index.html` 은 인라인 스크립트를 CSP `sha256-` 으로
 *    잠그고 `'unsafe-inline'` 을 두지 않는다. 그래서 **한 글자라도 고쳐서 서빙하면 그 블록이
 *    통째로 차단되고, 오류도 나지 않아** 앱이 조용히 안 뜬다 — 깨보기가 '고장을 잡았다' 가
 *    아니라 '아무것도 안 떴다' 로 터진다. 둘은 다른 것이고, 섞이면 깨보기가 값을 잃는다.
 *
 * ⚠️ **CSP 를 지우는 것으로 때우지 말 것.** 그러면 깨보기가 제품과 다른 보안 자세를
 *    시험하게 된다. 해시만 다시 계산해 **원래 정책 그대로** 유지한다.
 */
import { createHash } from 'node:crypto';

const SCRIPT_TAG = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

export function rehashInlineScripts(html) {
  const bodies = [...html.matchAll(SCRIPT_TAG)]
    .filter(m => m[1] !== undefined && !/\bsrc\s*=/.test(m[1]))
    .map(m => m[2]);
  const want = bodies.map(b => `'sha256-${createHash('sha256').update(b).digest('base64')}'`);
  const meta = html.match(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([\s\S]*?)(")/i);
  if (!meta) return html;                 // 정책이 없는 문서는 그대로 둔다
  const have = [...meta[2].matchAll(/'sha256-[^']+'/g)].map(m => m[0]);
  /* 스타일 해시가 섞여 있을 수 있으므로 script-src 안의 것만 센다. 개수가 다르면
     손대지 않는다 — 조용히 틀린 정책을 만드느니 그대로 두고 터지게 한다. */
  const scriptPolicy = meta[2].match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] || '';
  const scriptHashes = [...scriptPolicy.matchAll(/'sha256-[^']+'/g)].map(m => m[0]);
  if (scriptHashes.length !== want.length) return html;
  let policy = meta[2];
  scriptHashes.forEach((old, i) => { policy = policy.replace(old, want[i]); });
  return html.slice(0, meta.index + meta[1].length) + policy + html.slice(meta.index + meta[1].length + meta[2].length);
}
