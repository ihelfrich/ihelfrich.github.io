// Rendered check: on a phone, does every display equation on a course chapter page fit its column?
// Serves the built site from dist/ (run `npx astro build` first) and drives the installed Google Chrome,
// headless, through playwright-core. Every disclosure in the chapter text is opened first, so worked
// solutions are measured too.
//
//   node scripts/check-display-width.mjs [--width 375[,320,...]] [--port 4425] [--strict handbook|all|none]
//
// A display is reported when its content is wider than its box. On the --strict courses (default:
// handbook, whose displays are written to fit a phone) any such display fails the check. On the other
// courses a wide display may rely on its scroll box, but it fails if the box cannot take keyboard focus
// or has no label. A page that scrolls sideways fails on any course.
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const COURSES = [
  { name: 'econometrics', content: 'src/content/econometrics', prefix: '/econometrics/' },
  { name: 'time-series', content: 'src/content/time-series', prefix: '/time-series/' },
  { name: 'handbook', content: 'src/content/handbook', prefix: '/handbook/' },
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const widths = option('width', '375').split(',').map(Number);
const port = Number(option('port', '4425'));
const strictOption = option('strict', 'handbook');
const strict = new Set(strictOption === 'all' ? COURSES.map((c) => c.name) : strictOption === 'none' ? [] : strictOption.split(','));
const DIST = path.resolve('dist');

const pages = [];
for (const course of COURSES) {
  const files = (await readdir(course.content)).filter((file) => file.endsWith('.md')).sort();
  for (const file of files) pages.push({ course: course.name, url: `${course.prefix}${file.replace(/\.md$/, '')}/` });
}

const server = createServer(async (request, response) => {
  let file = path.join(DIST, decodeURIComponent(new URL(request.url, 'http://x').pathname));
  if (!file.startsWith(DIST)) { response.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${port}`;

const { chromium } = await import('playwright-core');
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: true } : { channel: 'chrome', headless: true });

const MEASURE = async () => {
  document.querySelectorAll('.ea-prose details').forEach((details) => { details.open = true; });
  await document.fonts.ready;
  // Two frames let the layout's ResizeObserver mark the boxes that now overflow.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const displays = [...document.querySelectorAll('.ea-prose .katex-display')];
  return {
    displays: displays.length,
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    wide: displays.flatMap((box, index) => box.scrollWidth > box.clientWidth + 1 ? [{
      index: index + 1,
      content: box.scrollWidth,
      column: box.clientWidth,
      focusable: box.tabIndex === 0,
      labelled: Boolean(box.getAttribute('aria-label')),
      tex: (box.querySelector('annotation')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
    }] : []),
  };
};

let failures = 0;
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const totals = {};
    for (const { course, url } of pages) {
      const response = await page.goto(base + url, { waitUntil: 'load' });
      if (!response || response.status() !== 200) { console.log(`FAIL ${width}px ${url}: HTTP ${response?.status()}; build the site first`); failures++; continue; }
      const result = await page.evaluate(MEASURE);
      totals[course] ??= { displays: 0, wide: 0 };
      totals[course].displays += result.displays;
      totals[course].wide += result.wide.length;
      if (result.pageWidth > result.viewport) { console.log(`FAIL ${width}px ${url}: the page scrolls sideways (${result.pageWidth} px in a ${result.viewport} px window)`); failures++; }
      for (const box of result.wide) {
        const reachable = box.focusable && box.labelled;
        const failed = strict.has(course) || !reachable;
        if (failed) failures++;
        const status = failed ? 'FAIL' : 'scrolls';
        const access = reachable ? 'focusable, labelled' : 'NOT focusable or labelled';
        console.log(`${status} ${width}px ${url} equation ${box.index}: ${box.content} px in a ${box.column} px column (${access}) ${box.tex}`);
      }
    }
    console.log(`${width}px: ${Object.entries(totals).map(([course, t]) => `${course} ${t.wide}/${t.displays} wider than the column`).join('; ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.error(`Display width check failed: ${failures} problem(s). Strict courses: ${[...strict].join(', ') || 'none'}.`);
  process.exit(1);
}
console.log(`Display width check passed on ${pages.length} chapter pages at ${widths.join(', ')} px. Strict courses: ${[...strict].join(', ') || 'none'}.`);
