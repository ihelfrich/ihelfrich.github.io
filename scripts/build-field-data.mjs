// Builds field.json for the site map at /field/ from the built site in dist/.
// Pages come from dist/sitemap.xml. Links are the internal links inside each page's <main>,
// so header and footer links (present on every page) do not join everything to everything.
// Usage: node scripts/build-field-data.mjs [--public]   (--public also refreshes public/field.json for dev)
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { OVERRIDES, ROUTES, labelFor, topicsFor, typeFor } from "../src/data/field-topics.mjs";

const dist = path.resolve("dist");
const SITE = "https://ihelfrich.github.io";
const COLLECTIONS = ["research", "projects", "datasets", "writing", "teaching"];

const decode = (text) => text
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ");

const normalise = (href) => {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean.startsWith("/") || clean.startsWith("//")) return null;
  return clean.endsWith("/") ? clean : `${clean}/`;
};

export function extractPage(html) {
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim())
    .replace(/\s*[|·]\s*Ian Helfrich.*$/, "");
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  const main = html.match(/<main[\s>][\s\S]*?<\/main>/)?.[0] ?? html;
  const hrefs = [...main.matchAll(/href="([^"]+)"/g)].map(([, href]) => normalise(decode(href))).filter(Boolean);
  return { title, description, hrefs };
}

async function frontmatterFor(route) {
  const [, collection, slug] = route.split("/");
  if (!COLLECTIONS.includes(collection) || !slug) return null;
  const file = path.resolve("src/content", collection, `${slug}.md`);
  const source = await readFile(file, "utf8").catch(() => null);
  if (source === null) return null;
  const block = source.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return null;
  const data = parseYaml(block[1]) ?? {};
  const authors = Array.isArray(data.authors) ? data.authors : [];
  const year = data.year ?? (data.date ? new Date(data.date).getUTCFullYear() : null);
  const status = data.displayStatus ?? data.status ?? "";
  const question = typeof data.question === "string" ? data.question : "";
  const role = typeof data.role === "string" ? data.role : "";
  const limit = typeof data.limit === "string" ? data.limit : "";
  const methods = Array.isArray(data.method) ? data.method.map(String).slice(0, 5) : [];
  if (!authors.length && !year && !status && !question && !role && !limit) return null;
  return {
    authors,
    year: year ? String(year) : "",
    status: String(status),
    question: question.slice(0, 180),
    role,
    limit: limit.slice(0, 260),
    methods,
  };
}

export async function buildField() {
  const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
  const routes = [...sitemap.matchAll(/<loc>https:\/\/ihelfrich\.github\.io(\/[^<]*)<\/loc>/g)]
    .map(([, route]) => route)
    .filter((route) => route !== "/field/")
    .sort();
  const known = new Set(routes);

  const pages = new Map();
  for (const route of routes) {
    const html = await readFile(path.join(dist, route, "index.html"), "utf8");
    pages.set(route, { ...extractPage(html), kb: Math.round(html.length / 1024) });
  }

  const nodes = [];
  for (const route of routes) {
    const page = pages.get(route);
    const topics = topicsFor(route, page.title, page.description);
    const section = route === "/" ? "core" : route.split("/")[1];
    const node = {
      id: route,
      title: page.title || route,
      label: labelFor(route, page.title || route),
      desc: page.description.slice(0, 200),
      kb: page.kb,
      type: typeFor(route),
      topics,
      section,
    };
    const meta = await frontmatterFor(route);
    if (meta) node.meta = meta;
    nodes.push(node);
  }

  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const edges = new Set();
  for (const [route, page] of pages) {
    for (const target of page.hrefs) {
      if (target === route || !known.has(target)) continue;
      const [a, b] = [index.get(route), index.get(target)];
      edges.add(a < b ? `${a},${b}` : `${b},${a}`);
    }
  }
  const links = [...edges].map((pair) => pair.split(",").map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  const routesOut = {};
  for (const [name, route] of Object.entries(ROUTES)) {
    for (const [id] of route.steps) {
      if (!index.has(id)) throw new Error(`Route "${name}" lists ${id}, which is not a built page.`);
    }
    routesOut[name] = route;
  }

  // The graph is built from sitemap pages, so a page with no links in or out has nowhere to sit. Report it.
  const linked = new Set(links.flat());
  const isolated = nodes.filter((_, i) => !linked.has(i)).map((node) => node.id);

  // Pages whose topics come from the keyword rules rather than a hand-set entry. They still appear on the map.
  const provisional = nodes.filter((node) => !OVERRIDES[node.id] && !node.id.startsWith("/econometrics/")).map((node) => node.id);

  return { generated: new Date().toISOString().slice(0, 10), site: SITE, nodes, links, routes: routesOut, isolated, provisional };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = await buildField();
  const json = JSON.stringify(data);
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, "field.json"), json);
  if (process.argv.includes("--public")) await writeFile(path.resolve("public/field.json"), json);
  console.log(`field.json: ${data.nodes.length} pages, ${data.links.length} links, ${data.isolated.length} unlinked (${(json.length / 1024).toFixed(0)} KB)`);
  if (data.isolated.length) console.log(`Unlinked from other pages: ${data.isolated.join(", ")}`);
  if (data.provisional.length) console.log(`Provisional topics (add to OVERRIDES in src/data/field-topics.mjs): ${data.provisional.join(", ")}`);
}
