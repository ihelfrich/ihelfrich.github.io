import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { ARCHIVAL_PROJECTS as archivalProjects } from "../src/data/archival-projects.mjs";

const root = path.resolve("dist");

const archive = JSON.parse(await readFile(path.join(root, "archive.json"), "utf8"));
const archiveText = JSON.stringify(archive);
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const rss = await readFile(path.join(root, "rss.xml"), "utf8");
const library = await readFile(path.join(root, "library", "index.html"), "utf8");
const researchIndex = await readFile(path.join(root, "research", "index.html"), "utf8");

const researchDirectory = path.resolve("src/content/research");
const researchRecords = await Promise.all((await readdir(researchDirectory))
  .filter((filename) => filename.endsWith(".md"))
  .map(async (filename) => {
    const source = await readFile(path.join(researchDirectory, filename), "utf8");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatter, `${filename} must have readable frontmatter`);
    return { id: filename.replace(/\.md$/, ""), ...parseYaml(frontmatter[1]) };
  }));
const withheldResearch = researchRecords.filter(({ discovery }) => discovery === "withheld");
assert.ok(withheldResearch.length > 0, "the discovery regression requires at least one data-derived withheld record");
for (const record of withheldResearch) assert.ok(record.distinctiveQuery, `${record.id} must define a distinctiveQuery`);
for (const record of researchRecords.filter(({ discovery }) => discovery !== "withheld")) {
  const detail = await readFile(path.join(root, "research", record.id, "index.html"), "utf8");
  const topline = detail.match(/<div class="record-topline">([\s\S]*?)<\/div>/)?.[1] ?? "";
  assert.ok(topline.includes(record.displayStatus), `/research/${record.id}/ must render displayStatus in its record topline: ${record.displayStatus}`);
}
for (const { id, title } of withheldResearch) {
  for (const [surface, source] of [["Research index", researchIndex], ["archive.json", archiveText], ["sitemap.xml", sitemap], ["rss.xml", rss], ["Library and SiteIndex", library]]) {
    assert.ok(!source.includes(id), `${surface} must not publish withheld research ${id}`);
    assert.ok(!source.includes(title), `${surface} must not publish the withheld title: ${title}`);
  }
  await assert.rejects(
    access(path.join(root, "research", id, "index.html")),
    { code: "ENOENT" },
    `withheld research must not generate /research/${id}/`,
  );
}
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
  for (const { id, title, distinctiveQuery } of withheldResearch) {
    const titleResult = await pagefind.search(title);
    const titleRecords = await Promise.all(titleResult.results.map((entry) => entry.data()));
    for (const record of titleRecords) {
      const indexedRecord = JSON.stringify(record);
      assert.ok(!indexedRecord.includes(id), `Pagefind must not index withheld research id ${id}`);
      assert.ok(!indexedRecord.includes(title), `Pagefind must not expose the withheld title in a result or excerpt: ${title}`);
    }
    const distinctiveResult = await pagefind.search(distinctiveQuery);
    assert.equal(distinctiveResult.results.length, 0, `Pagefind query ${JSON.stringify(distinctiveQuery)} must return zero results for withheld research ${id}`);
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`[public-discovery] ${archivalProjects.length} archival projects are excluded; Applied Statistics is present in Pagefind, sitemap, RSS, and archive.json`);
