// @ts-check
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: 'https://ihelfrich.github.io',
  base: '/',
  trailingSlash: 'ignore',
  markdown: { remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { strict: 'error' }]] },
  build: {
    format: 'directory'
  }
});
