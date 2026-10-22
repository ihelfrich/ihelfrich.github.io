import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { SCHOLAR_WITHHELD, bibtexFor, bibtexName, citeKey, scholarMetaFor } from "../../src/data/research-citation.mjs";

const researchDirectory = path.resolve("src/content/research");
const records = await Promise.all((await readdir(researchDirectory))
  .filter((filename) => filename.endsWith(".md"))
  .map(async (filename) => {
    const source = await readFile(path.join(researchDirectory, filename), "utf8");
    const data = parseYaml(source.match(/^---\n([\s\S]*?)\n---/)[1]);
    return { id: filename.replace(/\.md$/, ""), data };
  }));
const byId = (id) => records.find((record) => record.id === id);
const recordUrl = (id) => new URL(`https://ihelfrich.github.io/research/${id}/`);
const tagNames = (tags) => tags.map(([name]) => name);

test("BibTeX names and keys follow the usual conventions", () => {
  assert.equal(bibtexName("Ian Helfrich"), "Helfrich, Ian");
  assert.equal(bibtexName("Elizaveta Gonchar"), "Gonchar, Elizaveta");
  assert.equal(citeKey({ authors: ["Ian Helfrich"], year: 2026, title: "The rural mobilization gap" }), "helfrich2026rural");
  assert.equal(citeKey({ authors: ["Elizaveta Gonchar", "Ian Helfrich"], year: 2025, title: "Trade in the spotlight" }), "gonchar2025trade");
});

test("Scholar tags are emitted for the Spotlight, SSRN 4772016 and dissertation records", () => {
  for (const id of ["gonchar-helfrich-2025-spotlight", "helfrich-2024-ssrn-4772016", "helfrich-2024-dissertation"]) {
    const record = byId(id);
    const tags = scholarMetaFor(record, recordUrl(id));
    assert.ok(tags.length > 0, `${id} must emit citation_* tags`);
    assert.deepEqual(tags.filter(([name]) => name === "citation_author").map(([, value]) => value), record.data.authors);
    for (const name of ["citation_title", "citation_publication_date", "citation_abstract_html_url"]) {
      assert.ok(tagNames(tags).includes(name), `${id} must emit ${name}`);
    }
    for (const [name, value] of tags.filter(([tag]) => tag.endsWith("_url"))) {
      assert.match(value, /^https:\/\//, `${id}: ${name} must be absolute`);
    }
  }
  const dissertation = scholarMetaFor(byId("helfrich-2024-dissertation"), recordUrl("helfrich-2024-dissertation"));
  assert.ok(tagNames(dissertation).includes("citation_pdf_url"));
  assert.ok(tagNames(dissertation).includes("citation_dissertation_institution"));
});

test("the NMTC record never emits Scholar tags, even if its frontmatter opts in", () => {
  const id = "helfrich-2026-nmtc-rural-gap";
  assert.ok(SCHOLAR_WITHHELD.includes(id));
  const record = byId(id);
  assert.equal(record.data.pdf, "/research/ian-helfrich-nmtc-working-paper.pdf", "the NMTC record header links the PDF");
  assert.deepEqual(scholarMetaFor(record, recordUrl(id)), []);
  assert.equal(record.data.citation, undefined, "no citation block until the authorship decision");
  assert.equal(bibtexFor(record, recordUrl(id)), null);
  const optedIn = { ...record, data: { ...record.data, citation: { type: "misc", scholar: true } } };
  assert.deepEqual(scholarMetaFor(optedIn, recordUrl(id)), []);
});

test("records without a citation block have no Cite entry and no Scholar tags", () => {
  for (const record of records.filter(({ data }) => !data.citation)) {
    assert.equal(bibtexFor(record, recordUrl(record.id)), null, `${record.id} has no citation block`);
    assert.deepEqual(scholarMetaFor(record, recordUrl(record.id)), []);
  }
});

test("BibTeX entries are well formed and point at the public manuscript", () => {
  const dissertation = bibtexFor(byId("helfrich-2024-dissertation"), recordUrl("helfrich-2024-dissertation"));
  assert.match(dissertation, /^@phdthesis\{helfrich2024redefining,\n/);
  assert.match(dissertation, /school += \{Georgia Institute of Technology\}/);
  const spotlight = bibtexFor(byId("gonchar-helfrich-2025-spotlight"), recordUrl("gonchar-helfrich-2025-spotlight"));
  assert.match(spotlight, /author += \{Gonchar, Elizaveta and Helfrich, Ian\}/);
  assert.match(spotlight, /url += \{https:\/\/ssrn\.com\/abstract=5202676\}/);
  for (const entry of [dissertation, spotlight]) {
    assert.equal((entry.match(/\{/g) ?? []).length, (entry.match(/\}/g) ?? []).length, "braces balance");
    assert.match(entry, /\n\}$/);
  }
});

test("every discoverable record has a meta summary of at most 155 characters", () => {
  for (const record of records.filter(({ data }) => data.discovery !== "withheld")) {
    assert.ok(record.data.summary, `${record.id} needs a summary`);
    assert.ok(record.data.summary.length <= 155, `${record.id}: summary is ${record.data.summary.length} characters`);
  }
});
