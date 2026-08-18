import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ARCHIVAL_PROJECTS as archivalProjects } from "../src/data/archival-projects.mjs";

const root = path.resolve("dist");

const archive = JSON.parse(await readFile(path.join(root, "archive.json"), "utf8"));
const archiveText = JSON.stringify(archive);
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const rss = await readFile(path.join(root, "rss.xml"), "utf8");
for (const { id, title } of archivalProjects) {
  assert.ok(!archiveText.includes(id), `/archive.json must not publish archival project ${id}`);
  assert.ok(!sitemap.includes(`/projects/${id}/`), `/sitemap.xml must not publish archival project ${id}`);
  for (const forbiddenFeedText of [id, title, `/projects/${id}/`, `/${id}/`]) {
    assert.ok(!rss.includes(forbiddenFeedText), `/rss.xml must not publish archival project text: ${forbiddenFeedText}`);
  }
}

const reusableLearningFlagship = { id: "applied-statistics", title: "Applied Statistics" };
assert.ok(archiveText.includes(reusableLearningFlagship.id), "/archive.json must publish the generalized statistics library");
assert.ok(sitemap.includes(`/projects/${reusableLearningFlagship.id}/`), "/sitemap.xml must publish the generalized statistics library");
assert.ok(rss.includes(reusableLearningFlagship.title), "/rss.xml must publish the generalized statistics library");

for (const { id } of archivalProjects) {
  const html = await readFile(path.join(root, "projects", id, "index.html"), "utf8");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/, `${id} must be noindex`);
  assert.match(html, /<html lang="en" data-pagefind-ignore="all">/, `${id} must be excluded from Pagefind`);
}

const exactAward = "Georgia Tech Economics Graduate Teaching Assistant of the Year, 2023";
const accuracyPages = ["about", "capabilities", "cv", "job-market", "teaching", "work"];
for (const route of accuracyPages) {
  const html = await readFile(path.join(root, route, "index.html"), "utf8");
  assert.ok(html.includes(exactAward), `/${route}/ must use the verified teaching-award scope`);
  assert.doesNotMatch(html, /Georgia Tech Graduate (?:Teaching Assistant|TA) of the Year/, `/${route}/ broadens the teaching award`);
}

const jobMarket = await readFile(path.join(root, "job-market", "index.html"), "utf8");
assert.match(jobMarket, new RegExp(`<tr[^>]*><td[^>]*>Recognition</td><td[^>]*>${exactAward}</td><td class="num"[^>]*>Award</td></tr>`), "award row must stand on its own evidence");
assert.match(jobMarket, /<tr[^>]*><td[^>]*>Teaching-quality evidence<\/td><td[^>]*>Georgia Tech course evaluations \(<a [^>]+>2022 evaluations<\/a>\)<\/td><td class="num"[^>]*>2022<\/td><\/tr>/, "evaluations must be separate teaching-quality evidence");

const publicBio = await readFile(path.join(root, "people", "ian-helfrich", "index.html"), "utf8");
for (const excludedClaim of ["Political Science", "Working languages", "Earlier graduate TA appointments at Duke", "since July 2022"]) {
  assert.ok(!publicBio.includes(excludedClaim), `public bio must omit unresolved claim: ${excludedClaim}`);
}
for (const conservativeClaim of ["BA in Economics from UNC Chapel Hill", "Teaching support in the Duke Global Executive MBA program, 2016-17", "Online instructor for Campus / MTI College cohorts, 2022-23"]) {
  assert.ok(publicBio.includes(conservativeClaim), `public bio must include conservative wording: ${conservativeClaim}`);
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = path.join(root, pathname);
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, "index.html");
    if (file.endsWith(".wasm")) response.setHeader("content-type", "application/wasm");
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;

try {
  const pagefind = await import(path.join(root, "pagefind", "pagefind.js"));
  await pagefind.options({ basePath: `${origin}/pagefind/` });
  for (const { id, title } of archivalProjects) {
    const result = await pagefind.search(title);
    const records = await Promise.all(result.results.map((entry) => entry.data()));
    const paths = records.map((entry) => new URL(entry.url, origin).pathname);
    const forbiddenPaths = [`/projects/${id}/`, `/${id}/`];
    for (const forbiddenPath of forbiddenPaths) {
      assert.ok(!paths.includes(forbiddenPath), `Pagefind must not publish ${forbiddenPath}`);
    }
  }
  const flagshipResult = await pagefind.search(reusableLearningFlagship.title);
  const flagshipRecords = await Promise.all(flagshipResult.results.map((entry) => entry.data()));
  const flagshipPaths = flagshipRecords.map((entry) => new URL(entry.url, origin).pathname);
  assert.ok(
    flagshipPaths.includes(`/projects/${reusableLearningFlagship.id}/`),
    "Pagefind must publish the generalized statistics library",
  );
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`[public-discovery] ${archivalProjects.length} archival projects are excluded; Applied Statistics is present in Pagefind, sitemap, RSS, and archive.json`);
