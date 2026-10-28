import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRIMARY, CONTACT, BOOK, withSlash } from "../../src/data/navigation.mjs";

// The links SiteBar.astro renders, in order: the sections, the map, then booking and contact.
const sections = [...PRIMARY.map(({ href }) => withSlash(href)), "/field/"];

test("the static Market Mechanics page carries the shared bar's links, booking and Contact, without redirects", async () => {
  const html = await readFile("public/teaching/market-mechanics/index.html", "utf8");
  const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href).filter((href) => href !== "/");
  assert.deepEqual(hrefs, [...sections, withSlash(BOOK.href), withSlash(CONTACT.href)]);
  assert.match(nav, new RegExp(`<a href="${withSlash(BOOK.href)}">${BOOK.label}</a>`), "the booking link carries the shared label");
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
    // The bar is its own <nav aria-label="Site"> landmark; a region wrapped around it only repeats the landmark.
    assert.doesNotMatch(source, /role="region"[^>]*>\s*<SiteBar/, `${layout} must not wrap the shared bar in a second landmark`);
  }
});

// These read the component source, so they run in CI before anything is built. The rendered bar on the
// course pages is checked after the build by scripts/check-public-discovery.mjs.
test("the shared bar is a labelled navigation landmark whose links need no redirect", async () => {
  const source = await readFile("src/components/SiteBar.astro", "utf8");
  const markup = source.replace(/^---[\s\S]*?---\s*/, "");
  assert.match(markup, /^<nav class="site-bar"[^>]*aria-label="Site"[^>]*>/, "the bar root is a <nav> named Site, so its links sit inside a landmark");
  assert.ok(markup.trimEnd().endsWith("</nav>"), "the <nav> wraps the whole bar");
  assert.ok(markup.indexOf("<Breadcrumbs") > markup.indexOf('class="site-bar-name"'), "the trail follows the name link");
  const hrefs = [...markup.matchAll(/href=(?:"([^"]*)"|\{([^}]*)\})/g)].map(([, literal, expression]) => literal ?? expression.trim());
  assert.deepEqual(hrefs, ["/", "withSlash(href)", "/field/", "withSlash(BOOK.href)", "withSlash(CONTACT.href)"],
    "name, section links, Map, Book a time and Contact, each rendered in trailing-slash form");
  assert.match(markup, /PRIMARY\.map\(\(\{ label, href \}\) => <a href=\{withSlash\(href\)\}>/, "the section links come from PRIMARY");
});

test("withSlash gives every navigation target its served form", () => {
  for (const href of [...PRIMARY.map(({ href }) => href), CONTACT.href, "/book", "/field"]) {
    assert.match(withSlash(href), /^\/[a-z0-9-]+\/$/, `${href} renders with a trailing slash`);
  }
  assert.equal(withSlash("/book#tutoring-intro"), "/book/#tutoring-intro");
  assert.equal(withSlash("/cv/ian-helfrich-cv.pdf"), "/cv/ian-helfrich-cv.pdf");
  assert.equal(withSlash("https://example.org/a"), "https://example.org/a");
});
