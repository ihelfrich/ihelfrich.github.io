// Build gate for page-view counting (plan item A-08).
//
// GOATCOUNTER_CODE in src/data/analytics.mjs switches GoatCounter on for the whole site.
// While it is empty this gate confirms that no page loads the counter. Once it is set, every
// built page except a redirect stub must load the counter exactly once. In both states the two
// hand-written public/ pages must carry the inline loader with the same code, and the paper,
// CV, resume, booking and email links must carry their click-event names.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { GOATCOUNTER_CODE, GOATCOUNTER_SCRIPT, goatcounterEndpoint, clickEvent, bookingEvent } from "../src/data/analytics.mjs";
import { bookingLinks } from "../src/data/public-record.mjs";

const root = path.resolve("dist");
const failures = [];
const endpoint = goatcounterEndpoint();
const enabled = Boolean(endpoint);

if (GOATCOUNTER_CODE && !enabled) failures.push(`GOATCOUNTER_CODE ${JSON.stringify(GOATCOUNTER_CODE)} is not a GoatCounter site code (lower-case letters, digits and hyphens)`);

const collectHtml = async (directory) => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async (entry) => {
  const entryPath = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectHtml(entryPath);
  return entry.name.endsWith(".html") ? [entryPath] : [];
}))).flat();

const loaderPattern = /<script data-analytics-loader>[\s\S]*?var code="([^"]*)"[\s\S]*?<\/script>/g;
const scriptTagPattern = /<script\b[^>]*\sdata-goatcounter="([^"]*)"[^>]*>/g;
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const decode = (value) => value?.replaceAll("&amp;", "&");

// The static pages cannot import the data module, so their inline loaders repeat the code.
for (const source of ["public/learn/policy-statistics/index.html", "public/teaching/market-mechanics/index.html"]) {
  const html = await readFile(source, "utf8");
  const loaders = [...html.matchAll(loaderPattern)];
  if (loaders.length !== 1) failures.push(`${source} must contain exactly one data-analytics-loader script (found ${loaders.length})`);
  else if (loaders[0][1] !== GOATCOUNTER_CODE) failures.push(`${source} loader code ${JSON.stringify(loaders[0][1])} must equal GOATCOUNTER_CODE ${JSON.stringify(GOATCOUNTER_CODE)}`);
}

const pages = await collectHtml(root);
let counted = 0;
for (const file of pages) {
  const route = `/${path.relative(root, file).split(path.sep).join("/")}`;
  const html = await readFile(file, "utf8");
  const tags = [...html.matchAll(scriptTagPattern)];
  const loaders = [...html.matchAll(loaderPattern)];
  const isRedirect = /<meta http-equiv="refresh"/i.test(html);

  if (!enabled) {
    if (tags.length) failures.push(`${route} loads the counter while GOATCOUNTER_CODE is empty`);
  } else if (!isRedirect) {
    const snippets = tags.filter(([tag, value]) => value === endpoint && attribute(tag, "src") === GOATCOUNTER_SCRIPT).length
      + loaders.filter(([, code]) => code === GOATCOUNTER_CODE).length;
    if (snippets !== 1) failures.push(`${route} must load the GoatCounter snippet exactly once (found ${snippets})`);
    else counted += 1;
    for (const [, value] of tags) if (value !== endpoint) failures.push(`${route} points the counter at ${value}, not ${endpoint}`);
  }

  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = decode(attribute(tag, "href"));
    const expected = clickEvent(href);
    if (!expected) continue;
    const actual = attribute(tag, "data-goatcounter-click");
    if (actual !== expected) failures.push(`${route}: link to ${href} needs data-goatcounter-click="${expected}" (found ${actual === undefined ? "none" : JSON.stringify(actual)})`);
  }
}

const book = await readFile(path.join(root, "book", "index.html"), "utf8");
for (const { id, href } of bookingLinks) {
  const tag = [...book.matchAll(/<a\b[^>]*>/g)].map(([match]) => match).find((match) => decode(attribute(match, "href")) === href);
  if (!tag) failures.push(`/book/ must link the ${id} booking page`);
  else if (attribute(tag, "data-goatcounter-click") !== bookingEvent(id)) failures.push(`/book/: the ${id} booking link needs data-goatcounter-click="${bookingEvent(id)}"`);
}

if (failures.length) {
  console.error(`Analytics check failed:\n- ${[...new Set(failures)].join("\n- ")}`);
  process.exit(1);
}

console.log(enabled
  ? `[analytics] GoatCounter (${GOATCOUNTER_CODE}) loads once on ${counted} pages; click events are tagged`
  : `[analytics] GOATCOUNTER_CODE is empty, so no page loads the counter; ${pages.length} pages checked for click-event tags`);
