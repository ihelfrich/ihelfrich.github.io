import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { PRIMARY, CONTACT, BOOK, withSlash } from "../../src/data/navigation.mjs";

// The links SiteBar.astro renders, in order: the sections, the map, then booking and contact.
const sections = [...PRIMARY.map(({ href }) => withSlash(href)), "/field/"];
const barLinks = [...sections, withSlash(BOOK.href), withSlash(CONTACT.href)];
const built = await access("dist/time-series/03-arma/index.html").then(() => true, () => false);

test("the static Market Mechanics page carries the shared bar's section links and Contact", async () => {
  const html = await readFile("public/teaching/market-mechanics/index.html", "utf8");
  const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href).filter((href) => href !== "/");
  // The static page has no Book link yet; it is compared on the routes it does carry.
  assert.deepEqual(hrefs.map(withSlash), [...sections, withSlash(CONTACT.href)]);
});

test("the St. Louis lab links home, to the Lab, the map, and contact", async () => {
  const source = await readFile("src/pages/st-louis.astro", "utf8");
  const nav = source.match(/<nav class="city-sitelinks"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
  assert.deepEqual(hrefs, ["/", "/lab", "/field", "/contact"]);
});

test("every course layout renders the shared bar before its own header", async () => {
  for (const layout of ["Econometrics", "Handbook", "TimeSeries"]) {
    const source = await readFile(`src/layouts/${layout}.astro`, "utf8");
    assert.ok(source.indexOf("<SiteBar") > 0 && source.indexOf("<SiteBar") < source.indexOf('<header class="ea-header">'), `${layout} needs the shared bar above its header`);
  }
});

test("the shared bar is a labelled landmark that offers booking beside Contact without redirect hops", { skip: !built }, async () => {
  for (const route of ["time-series/03-arma", "handbook/01-questions", "econometrics/03-projection"]) {
    const html = await readFile(`dist/${route}/index.html`, "utf8");
    const bar = html.match(/<nav class="site-bar"[\s\S]*?<\/div>\s*<div class="site-bar-actions">[\s\S]*?<\/div>\s*<\/nav>/)?.[0];
    assert.ok(bar, `${route} must render the shared bar`);
    assert.match(bar, /^<nav class="site-bar"[^>]*aria-label="Site"/, `${route}: the bar is a navigation landmark, so its name link is inside one`);
    const links = bar.replace(/<nav class="crumbs[\s\S]*?<\/nav>/, "");
    const hrefs = [...links.matchAll(/href="([^"]+)"/g)].map(([, href]) => href).filter((href) => href !== "/");
    assert.deepEqual(hrefs, barLinks, `${route}: section links, Map, Book a time and Contact, each with its trailing slash`);
  }
});
