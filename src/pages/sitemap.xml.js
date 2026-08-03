import { getCollection } from "astro:content";

const staticRoutes = [
  "/",
  "/about/",
  "/contact/",
  "/cv/",
  "/work-with-me/",
  "/teaching/",
  "/third-space/",
  "/research/",
  "/projects/",
  "/datasets/",
  "/writing/",
  "/talks/",
  "/people/",
  "/program/",
  "/gis/",
  "/now/",
  "/reading/",
];

const escapeXml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export async function GET({ site }) {
  const base = site ?? new URL("https://ihelfrich.github.io");
  const [research, projects, datasets, writing, people] = await Promise.all([
    getCollection("research"),
    getCollection("projects"),
    getCollection("datasets"),
    getCollection("writing", ({ data }) => !data.draft),
    getCollection("people"),
  ]);

  const dynamicRoutes = [
    ...research.map((entry) => `/research/${entry.id}/`),
    ...projects.map((entry) => `/projects/${entry.id}/`),
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
