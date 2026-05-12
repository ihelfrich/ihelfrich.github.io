// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://ihelfrich.github.io',
  base: '/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory'
  }
});
