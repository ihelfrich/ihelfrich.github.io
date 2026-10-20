import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRIMARY, CONTACT } from "../../src/data/navigation.mjs";

const expected = [...PRIMARY.map(({ href }) => href), "/field", CONTACT.href];

test("the static Market Mechanics page carries the same site links as the shared bar", async () => {
  const html = await readFile("public/teaching/market-mechanics/index.html", "utf8");
  const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href).filter((href) => href !== "/");
  assert.deepEqual(hrefs, expected);
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
