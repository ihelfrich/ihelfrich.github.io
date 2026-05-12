/**
 * Pull the rendered HTML of each spoke site into the local dist/ directory so
 * Pagefind can index all of them in one pass.
 *
 * This runs in two modes:
 *   - LOCAL: copy from sibling Quarto build folders if they exist
 *           (/Users/ian/Downloads/inference-lab/docs, etc.)
 *   - CI:   download the latest rendered HTML from GitHub Pages
 *
 * The merged index is what the /search page actually queries.
 */
import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';

const HUB_DIST = resolve('./dist');
const SPOKES = [
  {
    name: 'inference-lab',
    localBuild: '/Users/ian/Downloads/inference-lab/docs',
    remoteUrl: 'https://ihelfrich.github.io/inference-lab/',
    subpath: 'inference-lab'
  },
  {
    name: 'macroprep',
    localBuild: '/Users/ian/Downloads/macroprep/docs',
    remoteUrl: 'https://ihelfrich.github.io/macroprep/',
    subpath: 'macroprep'
  }
];

console.log(`[fetch-spokes] merging spoke HTML into ${HUB_DIST}`);

for (const spoke of SPOKES) {
  const dest = join(HUB_DIST, spoke.subpath);
  if (existsSync(spoke.localBuild)) {
    console.log(`  [${spoke.name}] copying from ${spoke.localBuild}`);
    mkdirSync(dest, { recursive: true });
    cpSync(spoke.localBuild, dest, { recursive: true });
  } else {
    console.log(`  [${spoke.name}] local build not found at ${spoke.localBuild}; skipping (CI should use a sparse-checkout or wget mirror instead)`);
  }
}

console.log('[fetch-spokes] done');
