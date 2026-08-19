import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { ARCHIVAL_PROJECTS as archivalProjects } from "../src/data/archival-projects.mjs";

const root = path.resolve("dist");

const collectHtml = async (directory) => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async (entry) => {
  const entryPath = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectHtml(entryPath);
  return entry.name.endsWith(".html") ? [entryPath] : [];
}))).flat();

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
const nmtcResearchId = "helfrich-2026-nmtc-rural-gap";
const nmtcResearch = researchRecords.find(({ id }) => id === nmtcResearchId);
assert.ok(nmtcResearch, "the flagship NMTC research record must exist");
assert.ok(nmtcResearch.searchTerms?.some((term) => term.includes("NMTC")), "the flagship research record must expose the NMTC acronym as searchable metadata");
const withheldResearch = researchRecords.filter(({ discovery }) => discovery === "withheld");
assert.ok(withheldResearch.length > 0, "the discovery regression requires at least one data-derived withheld record");
for (const record of withheldResearch) assert.ok(record.distinctiveQuery, `${record.id} must define a distinctiveQuery`);
for (const record of researchRecords.filter(({ discovery }) => discovery !== "withheld")) {
  const detail = await readFile(path.join(root, "research", record.id, "index.html"), "utf8");
  assert.ok(detail.includes(record.displayStatus), `/research/${record.id}/ must render displayStatus: ${record.displayStatus}`);
  assert.ok(detail.includes(record.role), `/research/${record.id}/ must render the canonical role: ${record.role}`);
  assert.ok(detail.includes(record.limit), `/research/${record.id}/ must render the canonical evidentiary limit`);
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
  assert.ok(html.includes("Learner-specific context and linked artifacts are not republished"), `${id} must render the generic privacy boundary`);
  assert.ok(!html.includes('class="artifact-links"'), `${id} must not relink archived artifacts`);
  assert.ok(!html.includes("<dt>Topics</dt>"), `${id} must not republish promotional topic metadata`);
}

const builtHtml = await collectHtml(root);
for (const { id, title } of archivalProjects) {
  const allowedPath = path.join(root, "projects", id, "index.html");
  for (const htmlPath of builtHtml) {
    if (htmlPath === allowedPath) continue;
    const html = await readFile(htmlPath, "utf8");
    assert.ok(!html.includes(title), `${path.relative(root, htmlPath)} must not name direct-only archival project ${title}`);
  }
}

for (const id of ["macro-research-tools", "climfinrisk"]) {
  const source = await readFile(path.resolve("src/content/projects", `${id}.md`), "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter, `${id}.md must have readable frontmatter`);
  const project = parseYaml(frontmatter[1]);
  assert.ok(!project.repo, `${id} must not advertise an unavailable or uncleared repository`);
}

const deadNmtcViewer = "https://ihelfrich.github.io/us-nmtc-viewer/";
const nmtcProjectSource = await readFile(path.resolve("src/content/projects/us-nmtc-viewer.md"), "utf8");
const nmtcProjectFrontmatter = parseYaml(nmtcProjectSource.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "");
const nmtcDatasetSource = await readFile(path.resolve("src/content/datasets/us-nmtc-panel.md"), "utf8");
const nmtcDatasetFrontmatter = parseYaml(nmtcDatasetSource.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "");
assert.ok(!nmtcProjectFrontmatter.url, "the NMTC project must not advertise the dead hosted viewer");
assert.notEqual(nmtcProjectFrontmatter.status, "live", "the NMTC project must not claim a live viewer while no hosted release resolves");
assert.ok(!nmtcDatasetFrontmatter.viewer, "the NMTC dataset must not advertise the dead hosted viewer");
const nmtcProjectDetail = await readFile(path.join(root, "projects", "us-nmtc-viewer", "index.html"), "utf8");
const nmtcDatasetDetail = await readFile(path.join(root, "datasets", "us-nmtc-panel", "index.html"), "utf8");
const nmtcResearchDetail = await readFile(path.join(root, "research", nmtcResearchId, "index.html"), "utf8");
for (const [surface, source] of [
  ["archive.json", archiveText],
  ["Library and SiteIndex", library],
  ["NMTC project", nmtcProjectDetail],
  ["NMTC dataset", nmtcDatasetDetail],
]) assert.ok(!source.includes(deadNmtcViewer), `${surface} must not link the dead hosted NMTC viewer`);
assert.ok(nmtcResearchDetail.includes('data-pagefind-weight="10"'), "the flagship NMTC detail must give its subject metadata strong Pagefind weight");
assert.ok(nmtcResearchDetail.includes('data-pagefind-meta="title:New Markets Tax Credit (NMTC):'), "the flagship NMTC detail must add the acronym to its Pagefind title metadata");
assert.ok(nmtcResearchDetail.includes("New Markets Tax Credit (NMTC)"), "the flagship NMTC detail must spell out and expose the searchable acronym");
assert.match(library, new RegExp(`data-search="[^"]*nmtc[^"]*"[^>]*href="/research/${nmtcResearchId}"|href="/research/${nmtcResearchId}"[^>]*data-search="[^"]*nmtc[^"]*"`), "SiteIndex must surface the flagship research record for NMTC");

const exactAward = "Georgia Tech Economics Graduate Teaching Assistant of the Year, 2023";
const accuracyPages = ["about", "cv", "job-market", "teaching"];
for (const route of accuracyPages) {
  const html = await readFile(path.join(root, route, "index.html"), "utf8");
  assert.ok(html.includes(exactAward), `/${route}/ must use the verified teaching-award scope`);
  assert.doesNotMatch(html, /Georgia Tech Graduate (?:Teaching Assistant|TA) of the Year/, `/${route}/ broadens the teaching award`);
}

const jobMarket = await readFile(path.join(root, "job-market", "index.html"), "utf8");
assert.match(jobMarket, new RegExp(`<article[^>]*><span[^>]*>Award</span><strong[^>]*>${exactAward}</strong></article>`), "award must stand on its own evidence record");
assert.match(jobMarket, /<article[^>]*><span[^>]*>Evaluations<\/span><strong[^>]*><a [^>]+>Georgia Tech course-evaluation record, 2022 →<\/a><\/strong><\/article>/, "evaluations must remain separate teaching-quality evidence");

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
    for (const record of records) {
      const indexedRecord = JSON.stringify(record);
      assert.ok(!indexedRecord.includes(title), `Pagefind query must not expose archival project title ${title}`);
      assert.ok(!indexedRecord.includes(id), `Pagefind query must not expose archival project id ${id}`);
    }
  }
  const flagshipResult = await pagefind.search(reusableLearningFlagship.title);
  const flagshipRecords = await Promise.all(flagshipResult.results.map((entry) => entry.data()));
  const flagshipPaths = flagshipRecords.map((entry) => new URL(entry.url, origin).pathname);
  assert.ok(
    flagshipPaths.includes(`/projects/${reusableLearningFlagship.id}/`),
    "Pagefind must publish the generalized statistics library",
  );
  const nmtcResult = await pagefind.search("NMTC");
  const nmtcRecords = await Promise.all(nmtcResult.results.map((entry) => entry.data()));
  const nmtcPaths = nmtcRecords.map((entry) => new URL(entry.url, origin).pathname);
  assert.equal(nmtcPaths[0], `/research/${nmtcResearchId}/`, "Pagefind must rank the flagship NMTC research record first for NMTC");
  for (const { id, title, distinctiveQuery } of withheldResearch) {
    const titleResult = await pagefind.search(title);
    const titleRecords = await Promise.all(titleResult.results.map((entry) => entry.data()));
    for (const record of titleRecords) {
      const indexedRecord = JSON.stringify(record);
      assert.ok(!indexedRecord.includes(id), `Pagefind must not index withheld research id ${id}`);
      assert.ok(!indexedRecord.includes(title), `Pagefind must not expose the withheld title in a result or excerpt: ${title}`);
    }
    const distinctiveResult = await pagefind.search(distinctiveQuery);
    const distinctiveRecords = await Promise.all(distinctiveResult.results.map((entry) => entry.data()));
    for (const record of distinctiveRecords) {
      const indexedRecord = JSON.stringify(record).toLocaleLowerCase();
      for (const forbidden of [id, title, distinctiveQuery]) {
        assert.ok(
          !indexedRecord.includes(forbidden.toLocaleLowerCase()),
          `Pagefind query ${JSON.stringify(distinctiveQuery)} exposed withheld research text: ${forbidden}`,
        );
      }
    }
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`[public-discovery] ${archivalProjects.length} archival projects are excluded; Applied Statistics is present in Pagefind, sitemap, RSS, and archive.json`);
