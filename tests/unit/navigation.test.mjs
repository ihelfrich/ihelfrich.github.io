import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PRIMARY,
  RECORDS,
  CONTACT,
  BOOK,
  SECONDARY_PAGES,
  GO_RECORDS,
  REDIRECTS,
  navRoutes,
  sitemapStaticRoutes,
} from "../../src/data/navigation.mjs";

const hrefs = (items) => items.map(({ href }) => href);

test("every navigation link is a root-relative path with a unique label and destination", () => {
  const all = [...PRIMARY, CONTACT, BOOK, ...RECORDS, ...SECONDARY_PAGES];
  for (const item of all) {
    assert.match(item.href, /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/, `${item.label} must be a root-relative path without a trailing slash: ${item.href}`);
    assert.ok(item.label.trim(), `${item.href} needs a label`);
    assert.ok(item.detail.trim(), `${item.href} needs a detail line for the site index`);
  }
  assert.equal(new Set(hrefs(all)).size, all.length, "navigation destinations must not repeat");
  assert.equal(new Set(all.map(({ label }) => label)).size, all.length, "navigation labels must not repeat");
});

test("primary navigation is the approved label set in order", () => {
  assert.deepEqual(PRIMARY.map(({ label, href }) => `${label}:${href}`), [
    "Job market:/job-market",
    "Research:/research",
    "Teaching:/teaching",
    "Work:/work",
    "CV:/cv",
  ]);
  assert.deepEqual(hrefs(RECORDS), ["/lab", "/writing", "/about", "/projects", "/spatial", "/datasets", "/library"]);
  assert.equal(CONTACT.href, "/contact");
  assert.deepEqual([BOOK.label, BOOK.href], ["Book a time", "/book"]);
});

test("Hidden Rivers leaves the Records strip but stays indexed and published", () => {
  assert.ok(!hrefs(RECORDS).includes("/hidden-rivers"), "Hidden Rivers is reached from /projects, not the Records strip");
  assert.ok(hrefs(SECONDARY_PAGES).includes("/hidden-rivers"), "Hidden Rivers stays in the command-K index");
  assert.ok(navRoutes().includes("/hidden-rivers/"), "Hidden Rivers stays in the sitemap");
});

test("go records are numbered without gaps and begin with the seven starting points", () => {
  assert.deepEqual(GO_RECORDS.map(({ code }) => code), GO_RECORDS.map((_, index) => `GO-${String(index + 1).padStart(2, "0")}`));
  assert.deepEqual(GO_RECORDS.slice(0, 7).map(({ href }) => href), ["/contact", "/book", "/job-market", "/research", "/teaching", "/work", "/cv"]);
  assert.equal(GO_RECORDS.filter(({ start }) => start).length, 7);
});

test("the sitemap static list covers every navigation route exactly once", () => {
  const routes = sitemapStaticRoutes();
  assert.equal(new Set(routes).size, routes.length, "sitemap static routes must be unique");
  for (const route of routes) assert.match(route, /^\/([a-z0-9-]+\/)*$/, `sitemap routes end with a slash: ${route}`);
  for (const route of navRoutes()) assert.ok(routes.includes(route), `${route} is in the navigation but not the sitemap`);
  assert.ok(routes.includes("/"), "the home page is in the sitemap");
  for (const retired of ["/work-with-me/", "/start/", "/capabilities/", "/program/"]) {
    assert.ok(!routes.includes(retired), `${retired} is redirected and must leave the sitemap`);
  }
});

test("redirects point at routes that are themselves published", () => {
  const routes = sitemapStaticRoutes();
  for (const [from, to] of Object.entries(REDIRECTS)) {
    assert.match(from, /^\/[a-z-]+$/);
    assert.ok(routes.includes(`${to}/`), `${from} redirects to ${to}, which is not in the sitemap`);
    assert.ok(!routes.includes(`${from}/`), `${from} cannot be both redirected and listed`);
  }
});

test("the Astro config publishes the same redirects", async () => {
  const config = await readFile(new URL("../../astro.config.mjs", import.meta.url), "utf8");
  assert.match(config, /REDIRECTS/, "astro.config.mjs must import the redirect table from navigation.mjs");
});
