import { getCollection } from "astro:content";
import { isArchivalProject } from "../data/archival-projects.mjs";

export async function GET({ site }) {
  const [papers, datasets, essays, tools] = await Promise.all([
    getCollection("research"),
    getCollection("datasets"),
    getCollection("writing", ({ data }) => !data.draft),
    getCollection("projects", (entry) => !isArchivalProject(entry.id)),
  ]);
  const base = site ?? new URL("https://ihelfrich.github.io");
  const records = [
    ...papers.map((entry) => ({ type: "paper", title: entry.data.title, year: entry.data.year, status: entry.data.status, authors: entry.data.authors, tags: entry.data.tags, url: new URL(`/research/${entry.id}/`, base) })),
    ...datasets.map((entry) => ({ type: "dataset", title: entry.data.title, year: entry.data.year, status: entry.data.status, authors: entry.data.authors, license: entry.data.license, tags: entry.data.tags, url: new URL(`/datasets/${entry.id}/`, base), repo: entry.data.repo, viewer: entry.data.viewer })),
    ...essays.map((entry) => ({ type: "essay", title: entry.data.title, date: entry.data.date.toISOString(), summary: entry.data.summary, tags: entry.data.tags, url: new URL(`/writing/${entry.id}/`, base) })),
    ...tools.map((entry) => ({ type: "tool", title: entry.data.title, date: entry.data.date.toISOString(), status: entry.data.status, summary: entry.data.blurb, tags: entry.data.tags, url: entry.data.url ?? new URL(`/projects/${entry.id}/`, base), repo: entry.data.repo })),
  ];
  return new Response(JSON.stringify({ version: "1.0", generated: new Date().toISOString(), home: base, count: records.length, records }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
