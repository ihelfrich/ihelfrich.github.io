// Real-browser checks for the home-page gravity field: what synthetic events in happy-dom cannot show,
// chiefly how the browser resolves touch-action against scrolling. Serves the built site from dist/
// (run `npm run build:fast` first) and drives the installed Google Chrome through playwright-core.
// Set HG_CHROME to a Chrome executable to use another browser binary; without one the checks are skipped.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { homeLabel } from "../../src/data/home-graph.mjs";

const DIST = path.resolve("dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain" };

async function serve() {
  const server = createServer(async (req, res) => {
    let file = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

// Counts animation frames requested by the home-graph module, records (and cancels) navigations, and
// keeps the text drawn in the latest frame of the map's scene canvas.
const INSTRUMENT = `(() => {
  window.__hgFrames = 0; window.__navs = []; window.__hgTexts = [];
  const P = CanvasRenderingContext2D.prototype, clear = P.clearRect, fill = P.fillText;
  const scene = (c) => c.canvas && c.canvas.hasAttribute && c.canvas.hasAttribute("data-hg-scene");
  P.clearRect = function (...a) { if (scene(this)) window.__hgTexts = []; return clear.apply(this, a); };
  P.fillText = function (t, ...a) { if (scene(this)) window.__hgTexts.push(t); return fill.call(this, t, ...a); };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { const mine = /home-graph/.test(new Error().stack || ""); return raf((t) => { if (mine) window.__hgFrames++; cb(t); }); };
  try { navigation.addEventListener("navigate", (e) => { const u = new URL(e.destination.url); if (u.pathname === location.pathname) return; window.__navs.push(u.pathname); e.preventDefault(); }); } catch {}
})();`;

let browser = null, site = null, skip = null;
const field = JSON.parse(await readFile(path.join(DIST, "field.json"), "utf8"));
try {
  const { chromium } = await import("playwright-core");
  browser = await chromium.launch(process.env.HG_CHROME ? { executablePath: process.env.HG_CHROME } : { channel: "chrome" });
  site = await serve();
} catch (err) { skip = `no browser to drive (${String(err.message || err).split("\n")[0]})`; }

const when = skip ? { skip } : {};
test.after(async () => { await browser?.close(); site?.server.close(); });

async function open({ phone = false, reduced = false, width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width, height }, deviceScaleFactor: 2,
    isMobile: phone, hasTouch: phone, reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  await page.goto(site.base + "/", { waitUntil: "load" });
  await centre(page);
  await page.waitForSelector('[data-hg-stage][aria-busy="false"]');
  await settle(page);
  return { ctx, page };
}
const centre = (page) => page.evaluate(() => document.querySelector("[data-hg-stage]").scrollIntoView({ block: "center" }));
const stage = (page) => page.evaluate(() => { const r = document.querySelector("[data-hg-stage]").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const frames = (page) => page.evaluate(() => window.__hgFrames);
async function settle(page, quiet = 1200, limit = 20000) {
  let last = await frames(page), since = Date.now();
  for (const t0 = Date.now(); Date.now() - t0 < limit;) {
    await page.waitForTimeout(150);
    const now = await frames(page);
    if (now !== last) { last = now; since = Date.now(); } else if (Date.now() - since >= quiet) return;
  }
  throw new Error("the map did not come to rest");
}
// Where a landmark page rests: landmarks keep their precomputed positions, scaled to the stage.
function restPoint(id, box) {
  const i = field.nodes.findIndex((d) => d.id === id), xy = field.layout[box.w < 600 ? "narrow" : "wide"].xy;
  return [box.x + xy[2 * i] * Math.round(box.w), box.y + xy[2 * i + 1] * Math.round(box.h)];
}
const selected = (page) => page.evaluate(() => document.querySelector('[data-hg-stage] [aria-selected="true"]')?.id ?? null);

test("on a phone, a swipe from any point of the map scrolls the page and chooses nothing", when, async () => {
  const { ctx, page } = await open({ phone: true });
  const cdp = await ctx.newCDPSession(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "no horizontal overflow at 390 px");
  let scrolled = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
    await centre(page); await page.waitForTimeout(120);
    const b = await stage(page), x = b.x + (b.w * (c + 0.5)) / 5, y = b.y + (b.h * (r + 0.5)) / 6;
    const before = await page.evaluate(() => scrollY);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let k = 1; k <= 8; k++) { await page.waitForTimeout(16); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - (220 * k) / 8 }] }); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(350);
    if ((await page.evaluate(() => scrollY)) - before > 30) scrolled++;
    assert.equal(await selected(page), null, `the swipe at (${Math.round(x)}, ${Math.round(y)}) chose no page`);
  }
  assert.equal(scrolled, 30, "every swipe scrolled the page");
  await ctx.close();
});

// Where an element is, and whether it is the topmost element at its centre (not under a sticky bar).
const shown = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s), r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { top: r.top, bottom: r.bottom, vh: innerHeight, onTop: !!top && (top === el || el.contains(top)) };
}, sel);

test("on a phone, a tap chooses a page with Open page and Back in view, and a second tap opens it", when, async () => {
  for (const id of ["/contact/", "/job-market/", "/research/helfrich-2026-nmtc-rural-gap/"]) {
    const { ctx, page } = await open({ phone: true });
    const [x, y] = restPoint(id, await stage(page));
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(1200);
    assert.equal(await page.textContent("[data-hg-card] h3"), field.nodes.find((d) => d.id === id).title);
    for (const sel of [".hg-open", "[data-hg-back]"]) {
      const b = await shown(page, sel);
      assert.ok(b.top >= 0 && b.bottom <= b.vh && b.onTop, `${sel} is in view and uncovered after choosing ${id} (${Math.round(b.top)}-${Math.round(b.bottom)} of ${b.vh})`);
    }
    if (id === "/contact/") {
      await settle(page);
      const b = await stage(page);
      await page.touchscreen.tap(b.x + b.w / 2, b.y + b.h / 2); // the chosen page moves to the centre of its rings
      await page.waitForTimeout(300);
      assert.deepEqual(await page.evaluate(() => window.__navs), [id]);
    }
    await ctx.close();
  }
});

// First-ring labels drawn in the latest frame; a wrapped label's two lines count once.
async function ringLabels(page, i) {
  const ring = new Set(field.links.flatMap(([a, b]) => (a === i ? [b] : b === i ? [a] : [])).map((j) => homeLabel(field.nodes[j])));
  const texts = await page.evaluate(() => window.__hgTexts), out = [];
  for (let k = 0; k < texts.length; k++) {
    if (ring.has(texts[k])) out.push(texts[k]);
    else if (ring.has(`${texts[k]} ${texts[k + 1]}`)) { out.push(`${texts[k]} ${texts[k + 1]}`); k++; }
  }
  return { size: ring.size, labels: out };
}

test("on a phone, a chosen page labels at least six of its first ring, the landmark pages first", when, async () => {
  const { ctx, page } = await open({ phone: true, reduced: true });
  await page.focus("[data-hg-stage]");
  for (const id of ["/", "/job-market/", "/teaching/", "/econometrics/", "/projects/", "/library/"]) {
    const i = field.nodes.findIndex((d) => d.id === id);
    for (let k = 0; k < field.nodes.length && !(await page.getAttribute("[data-hg-stage]", "aria-activedescendant")).endsWith(`-${i}`); k++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const { size, labels } = await ringLabels(page, i);
    assert.ok(labels.length >= Math.min(size, 6), `${id}: ${labels.length} of ${size} first-ring pages labelled`);
    if (id === "/") for (const s of ["Job market", "Working paper: NMTC rural gap", "CV", "Contact", "Research"]) assert.ok(labels.includes(s), `${s} is labelled when Home is chosen`);
    await page.keyboard.press("Escape");
  }
  await ctx.close();
});

test("on a desktop, Enter centers the page under the cursor and a second Enter opens it", when, async () => {
  const { ctx, page } = await open();
  await page.focus("[data-hg-stage]");
  await page.keyboard.press("ArrowRight");
  const cursor = await page.getAttribute("[data-hg-stage]", "aria-activedescendant");
  const target = field.nodes[Number(cursor.split("-").pop())].id;
  await page.keyboard.press("Enter");
  assert.equal(await selected(page), cursor);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(() => window.__navs), [target]);
  await ctx.close();
});

test("the section list comes before the map and the card in both tab order and reading order", when, async () => {
  for (const width of [1440, 390]) {
    const { ctx, page } = await open(width === 390 ? { phone: true } : {});
    await page.focus("[data-hg-stage]"); await page.keyboard.press("Enter"); // shows the card
    const order = await page.evaluate(() => {
      const root = document.querySelector("[data-home-graph]"), q = (s) => root.querySelector(s);
      const at = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left }; };
      const els = [q(".hg-links a"), q("[data-hg-stage]"), q(".hg-all summary")];
      const pos = (el) => [...root.querySelectorAll("a, summary, [tabindex], button")].indexOf(el);
      return { dom: els.map(pos), nav: at(els[0]), card: at(q("[data-hg-card]")), stage: at(els[1]) };
    });
    assert.ok(order.dom[0] < order.dom[1] && order.dom[1] < order.dom[2], "links, then map, then the page list");
    assert.ok(order.nav.top < order.card.top, `the section list sits above the card at ${width} px`);
    await ctx.close();
  }
});

test("the map requests no animation frames once it has settled, and none under reduced motion", when, async () => {
  const { ctx, page } = await open();
  const n0 = await frames(page);
  await page.waitForTimeout(6000);
  assert.equal((await frames(page)) - n0, 0, "idle for six seconds after settling");
  await ctx.close();
  const rm = await open({ reduced: true });
  const [x, y] = restPoint("/research/", await stage(rm.page));
  const n1 = await frames(rm.page);
  await rm.page.mouse.click(x, y);
  await rm.page.waitForTimeout(1500);
  assert.ok(await selected(rm.page), "the click chose a page");
  assert.ok((await frames(rm.page)) - n1 <= 3, "a choice under reduced motion draws once, without animating");
  await rm.ctx.close();
});
