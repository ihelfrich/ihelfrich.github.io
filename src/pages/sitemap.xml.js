import { getCollection } from "astro:content";
import { isArchivalProject } from "../data/archival-projects.mjs";
import { filterDiscoverableResearch } from "../data/research-discovery.mjs";

const staticRoutes = [
  "/",
  "/about/",
  "/contact/",
  "/cv/",
  "/job-market/",
  "/colophon/",
  "/work-with-me/",
  "/teaching/",
  "/third-space/",
  "/research/",
  "/projects/",
  "/datasets/",
  "/writing/",
  "/library/",
  "/people/",
  "/program/",
  "/gis/",
  "/now/",
  "/reading/",
  "/econometrics/",
  "/econometrics/lab/",
  "/econometrics/readings/",
  "/econometrics/teach/",
  "/econometrics/edition/",
  "/econometrics/measurement/",
];

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
    ...chapters.map((entry) => `/econometrics/${entry.id}/`),
    ...measurement.map((entry) => `/econometrics/measurement/${entry.id}/`),
    ...research.map((entry) => `/research/${entry.id}/`),
    ...projects.filter((entry) => !isArchivalProject(entry.id)).map((entry) => `/projects/${entry.id}/`),
    ...datasets.map((entry) => `/datasets/${entry.id}/`),
    ...writing.map((entry) => `/writing/${entry.id}/`),
    ...people.map((entry) => `/people/${entry.id}/`),
  ];

  const urls = [...new Set([...staticRoutes, ...dynamicRoutes])]
    .map((route) => `  <url><loc>${escapeXml(new URL(route, base).toString())}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
