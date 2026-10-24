// Bibliographic output for research records: the BibTeX entry in each record's Cite
// section and the Google Scholar citation_* meta tags. Both are written by hand from the
// collection data, following Scholar's inclusion guidelines
// (https://scholar.google.com/intl/en/scholar/inclusion.html#indexing); no citation
// library is used.

/**
 * Records that never emit citation_* tags, whatever their frontmatter says. Empty since
 * October 24, 2026, when Dr. Helfrich confirmed sole authorship of the NMTC paper; kept
 * so that a record can be withheld again without touching the templates.
 */
export const SCHOLAR_WITHHELD = Object.freeze([]);

const TITLE_STOPWORDS = new Set(["a", "an", "the", "of", "in", "on", "and", "for", "to"]);

const ascii = (text) => text.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");

/** "Ian Helfrich" → "Helfrich, Ian"; a single-word name is returned unchanged. */
export function bibtexName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  const family = parts.pop();
  return `${family}, ${parts.join(" ")}`;
}

/** First author's family name, year, and first significant title word: helfrich2024redefining. */
export function citeKey({ authors, year, title }) {
  const family = ascii(authors[0].trim().split(/\s+/).at(-1)).toLowerCase().replace(/[^a-z]/g, "");
  const word = title.toLowerCase().split(/[^a-z0-9]+/).find((token) => token && !TITLE_STOPWORDS.has(token)) ?? "";
  return `${family}${year}${word}`;
}

const escapeBibtex = (text) => text.replace(/([&%$#_])/g, "\\$1");

/** The public location of the manuscript: the SSRN record, then the PDF, then the record page. */
const manuscriptUrl = (data, recordUrl) => {
  if (data.ssrn) return data.ssrn;
  if (data.pdf) return new URL(data.pdf, recordUrl).href;
  return new URL(recordUrl).href;
};

/** BibTeX for a record with a `citation` block, or null when the record has none. */
export function bibtexFor(entry, recordUrl) {
  const { data } = entry;
  const citation = data.citation;
  if (!citation) return null;
  const fields = [
    ["author", data.authors.map(bibtexName).join(" and ")],
    ["title", data.title],
    ["year", String(data.year)],
  ];
  if (citation.type === "phdthesis") fields.push(["school", citation.school]);
  if (citation.note) fields.push(["note", citation.note]);
  fields.push(["url", manuscriptUrl(data, recordUrl)]);
  const width = Math.max(...fields.map(([name]) => name.length));
  const body = fields
    .map(([name, value]) => `  ${name.padEnd(width)} = {${name === "url" ? value : escapeBibtex(value)}}`)
    .join(",\n");
  return `@${citation.type}{${citeKey(data)},\n${body}\n}`;
}

/** Google Scholar meta tags as [name, content] pairs; empty unless the record opts in. */
export function scholarMetaFor(entry, recordUrl) {
  const { id, data } = entry;
  if (!data.citation?.scholar || SCHOLAR_WITHHELD.includes(id)) return [];
  const tags = [["citation_title", data.title]];
  for (const author of data.authors) tags.push(["citation_author", author]);
  tags.push(["citation_publication_date", String(data.year)]);
  if (data.citation.type === "phdthesis") tags.push(["citation_dissertation_institution", data.citation.school]);
  if (data.pdf) tags.push(["citation_pdf_url", new URL(data.pdf, recordUrl).href]);
  tags.push(["citation_abstract_html_url", new URL(recordUrl).href]);
  return tags;
}
