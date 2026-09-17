import { getCollection } from "astro:content";
import { isArchivalProject } from "../data/archival-projects.mjs";
import { filterDiscoverableResearch } from "../data/research-discovery.mjs";
import { sitemapStaticRoutes } from "../data/navigation.mjs";
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Teaching labs are not a content collection. They arrive two ways, and both are
// discovered from the file system so a new lab never needs a manual sitemap edit:
//   src/pages/teaching/<name>.astro          -> /teaching/<name>/
//   public/teaching/<name>/index.html        -> /teaching/<name>/
const pageLabRoutes = Object.keys(import.meta.glob("./teaching/*.astro"))
  .map((file) => file.replace(/^\.\/teaching\//, "").replace(/\.astro$/, ""))
  .filter((name) => name !== "index");
const staticLabDirectory = resolve("public/teaching");
const staticLabRoutes = existsSync(staticLabDirectory)
  ? readdirSync(staticLabDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(staticLabDirectory, entry.name, "index.html")))
    .map((entry) => entry.name)
  : [];
const teachingLabRoutes = [...new Set([...pageLabRoutes, ...staticLabRoutes])].sort().map((name) => `/teaching/${name}/`);

const escapeXml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export async function GET({ site }) {
  const base = site ?? new URL("https://ihelfrich.github.io");
  const [allResearch, projects, datasets, writing, people] = await Promise.all([
    getCollection("research"),
    getCollection("projects"),
    getCollection("datasets"),
    getCollection("writing", ({ data }) => !data.draft),
    getCollection("people"),
  ]);
  const research = filterDiscoverableResearch(allResearch);
  const chapters = await getCollection('econometrics');
  const measurement = await getCollection('measurement');
  const dynamicRoutes = [
    ...teachingLabRoutes,
    ...chapters.map((entry) => `/econometrics/${entry.id}/`),
    ...measurement.map((entry) => `/econometrics/measurement/${entry.id}/`),
    ...research.map((entry) => `/research/${entry.id}/`),
    ...projects.filter((entry) => !isArchivalProject(entry.id)).map((entry) => `/projects/${entry.id}/`),
    ...datasets.map((entry) => `/datasets/${entry.id}/`),
    ...writing.map((entry) => `/writing/${entry.id}/`),
    ...people.map((entry) => `/people/${entry.id}/`),
  ];

  const urls = [...new Set([...sitemapStaticRoutes(), ...dynamicRoutes])]
    .map((route) => `  <url><loc>${escapeXml(new URL(route, base).toString())}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
