// @ts-check
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { REDIRECTS } from './src/data/navigation.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://ihelfrich.github.io',
  base: '/',
  trailingSlash: 'ignore',
  // Retired routes stay reachable; the table lives with the rest of the navigation.
  redirects: { ...REDIRECTS },
  // Discover the lazy photographic engine before a visitor submits a token.
  vite: { optimizeDeps: { include: ['cesium'] } },
  markdown: { remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { strict: 'error' }]] },
  build: {
    format: 'directory'
  }
});
