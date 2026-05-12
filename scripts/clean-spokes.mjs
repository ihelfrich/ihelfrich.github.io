/**
 * After Pagefind indexes the merged dist/, remove the spoke HTML so the hub
 * repo doesn't ship duplicate copies. Pagefind results URLs (e.g.,
 * /inference-lab/chapters/04_DiD.html) will still resolve in production
 * because GitHub Pages routes those subpaths to the real spoke project repos.
 */
import { rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DIST = resolve('./dist');
const SPOKE_DIRS = ['inference-lab', 'macroprep'];

console.log('[clean-spokes] removing local spoke copies (Pagefind index already built)');
for (const dir of SPOKE_DIRS) {
  const path = join(DIST, dir);
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`  removed dist/${dir}`);
  }
}
console.log('[clean-spokes] done');
