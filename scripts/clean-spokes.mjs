/**
 * After Pagefind indexes the merged dist/, remove the spoke HTML so the hub
 * repo doesn't ship duplicate copies. Pagefind result URLs still resolve in
 * production because GitHub Pages routes the subpath to the real spoke repo.
 */
import { rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DIST = resolve('./dist');
const SPOKE_DIRS = ['american-policy-atlas'];

console.log('[clean-spokes] removing local spoke copies (Pagefind index already built)');
for (const dir of SPOKE_DIRS) {
  const path = join(DIST, dir);
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`  removed dist/${dir}`);
  }
}
console.log('[clean-spokes] done');
