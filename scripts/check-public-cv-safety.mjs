import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { load as parseYaml } from "js-yaml";

const dist = resolve("dist");
const retiredArtifacts = [
  "cv/helfrich-cv.pdf",
  "cv/helfrich-cv-full.pdf",
  "cv/helfrich-cv-july-2026.pdf",
];
const publicPages = ["cv/index.html", "job-market/index.html"];
const failures = [];

const publishedPdfs = [
  {
    path: "cv/ian-helfrich-executive-resume.pdf",
    pages: 2,
    required: [
      "Applied Economist",
      "Quantitative Research Designer",
      "Georgia Tech Economics Graduate Teaching Assistant of the Year",
      "More than 1,035 hours through Wyzant",
      "nearly 1,000 additional direct",
      "Ad hoc referee, Journal of Economic Theory",
    ],
  },
  {
    path: "cv/ian-helfrich-cv.pdf",
    pages: 4,
    required: [
      "Sole author and originator",
      "With contributions from Katia Antunes and Elizaveta Gonchar",
      "Georgia Tech Economics Graduate Teaching Assistant of the Year",
      "More than 1,035 hours through Wyzant",
      "nearly 1,000 additional direct",
      "Ad hoc referee, Journal of Economic Theory",
    ],
  },
  {
    path: "research/ian-helfrich-nmtc-working-paper.pdf",
    pages: 27,
    required: [
      "The Rural Mobilization Gap in a U.S. Place-Based Tax Credit",
      "Sole author and originator",
      "With contributions from Katia Antunes and Elizaveta Gonchar",
    ],
  },
];

const forbiddenPdfPatterns = [
  [/4949\s+Oakdale/i, "legacy residential address"],
  [/910[\s().+-]*922[\s.-]*5152/i, "legacy phone number"],
  [/@outlook\.com/i, "superseded Outlook address"],
  [/Saudi Arabia/i, "unratified ministry-adjacent client detail"],
  [/PPD\s*504/i, "one-off course artifact"],
  [/ECON\s*101A/i, "one-off course artifact"],
  [/tutoring client/i, "private client relationship"],
  [/Ad hoc referee, Journal of Economic Theory\s*,?\s*2025/i, "unnecessary referee date"],
];

async function extractPdfText(path) {
  const bytes = new Uint8Array(await readFile(path));
  const loadingTask = getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str).join(" ")}\n`;
  }
  const pages = pdf.numPages;
  await loadingTask.destroy();
  return { pages, text: text.replace(/\s+/g, " ").trim() };
}

for (const artifact of publishedPdfs) {
  const path = resolve(dist, artifact.path);
  try {
    const { pages, text } = await extractPdfText(path);
    if (pages !== artifact.pages) {
      failures.push(`${artifact.path} has ${pages} pages; expected ${artifact.pages}`);
    }
    if (text.length < 500) {
      failures.push(`${artifact.path} did not yield clean extractable text`);
    }
    for (const phrase of artifact.required) {
      if (!text.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`${artifact.path} omits required PDF text: ${phrase}`);
      }
    }
    for (const [pattern, label] of forbiddenPdfPatterns) {
      if (pattern.test(text)) failures.push(`${artifact.path} exposes ${label}`);
    }
    if (
      artifact.path.includes("nmtc") &&
      /Ian Helfrich\s*,?\s*Katia Antunes\s*,?\s*(?:and\s*)?Elizaveta Gonchar/i.test(text)
    ) {
      failures.push(`${artifact.path} presents NMTC contributors as coauthors`);
    }
  } catch (error) {
    failures.push(`${artifact.path} is missing or unreadable: ${error.message}`);
  }
}

for (const artifact of retiredArtifacts) {
  try {
    await access(resolve(dist, artifact), constants.F_OK);
    failures.push(`retired CV artifact is still published: ${artifact}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

for (const page of publicPages) {
  const html = await readFile(resolve(dist, page), "utf8");
  for (const artifact of retiredArtifacts) {
    if (html.includes(`/${artifact}`)) {
      failures.push(`${page} still links to retired CV artifact: ${artifact}`);
    }
  }
}

const nmtcAuthor = "Ian Helfrich";
const nmtcContributors = ["Katia Antunes", "Elizaveta Gonchar"];
const nmtcRecord = await readFile(
  resolve(dist, "research/helfrich-2026-nmtc-rural-gap/index.html"),
  "utf8",
);
const jobMarket = await readFile(resolve(dist, "job-market/index.html"), "utf8");
const visibleText = (html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " ")
  .trim();
const nmtcText = visibleText(nmtcRecord);
const jobMarketText = visibleText(jobMarket);

if (!nmtcText.includes(nmtcAuthor) || !/Ian Helfrich originated the project and is its sole author\./i.test(nmtcText)) {
  failures.push(`NMTC research record must identify ${nmtcAuthor} as the originator and sole author`);
}
if (!/sole author and originator/i.test(jobMarketText) || !/my original idea, and I am its sole author/i.test(jobMarketText)) {
  failures.push("job-market NMTC record must identify Ian Helfrich as the originator and sole author");
}
for (const contributor of nmtcContributors) {
  if (!nmtcRecord.includes(contributor)) {
    failures.push(`NMTC research record omits contributor acknowledgment: ${contributor}`);
  }
  if (!jobMarketText.includes(contributor)) failures.push(`job-market NMTC record omits contributor acknowledgment: ${contributor}`);
}
if (!nmtcRecord.includes("Ian Helfrich originated the project and is its sole author.")) {
  failures.push("NMTC research record omits the authoritative origin and sole-authorship statement");
}
if (/SSRN preprint \(forthcoming\)/i.test(nmtcRecord)) {
  failures.push("NMTC research record still claims an unverified forthcoming SSRN posting");
}

const publicClaimPages = {
  "NMTC research record": nmtcRecord,
  "job-market page": jobMarket,
  "NMTC project record": await readFile(resolve(dist, "projects/us-nmtc-viewer/index.html"), "utf8"),
  "program page": await readFile(resolve(dist, "program/index.html"), "utf8"),
};
const falseNmtcBylines = [
  "Helfrich, Antunes, and Gonchar",
  "Helfrich, Ian, Katia Antunes, and Elizaveta Gonchar",
  "Ian Helfrich, Katia Antunes, and Elizaveta Gonchar",
];
for (const [label, html] of Object.entries(publicClaimPages)) {
  for (const falseByline of falseNmtcBylines) {
    if (html.includes(falseByline)) failures.push(`${label} contains false NMTC coauthor byline: ${falseByline}`);
  }
}

const collectHtml = async (directory) => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectHtml(path));
    else if (entry.name.endsWith(".html")) found.push(path);
  }
  return found;
};
const builtHtml = await Promise.all((await collectHtml(dist)).map((path) => readFile(path, "utf8")));
for (const staleTalkClaim of [
  "Effective-distance bilateral exposure under sanctions",
  "Atlanta GA (virtual session)",
  "NEUDC (Northeast Universities Development Consortium)",
  "Submitted. Presents the solo-authored descriptive",
]) {
  if (builtHtml.some((html) => html.includes(staleTalkClaim))) {
    failures.push(`built site contains an unverified or submission-only public record: ${staleTalkClaim}`);
  }
}

for (const [label, html] of Object.entries({ "NMTC research record": nmtcRecord, "job-market page": jobMarket })) {
  if (!/\u22120\.185[\s\S]{0,220}86(?:\s*%| percent)/i.test(html)) {
    failures.push(`${label} does not pair the base-decomposition contribution −0.185 with 86 percent`);
  }
  if (/\u22120\.185[\s\S]{0,180}88 percent/i.test(html)) {
    failures.push(`${label} combines incompatible NMTC base and purpose-augmented decomposition figures`);
  }
}
if (!/19,907(?: QLICI)? transactions[\s\S]{0,80}8,024 projects/i.test(jobMarketText)) {
  failures.push("job-market page does not describe the NMTC project panel with the verified QLICI scope");
}
if (!/descriptive, noncausal/i.test(nmtcText) || !/mechanism remains unresolved/i.test(nmtcText)) {
  failures.push("NMTC record does not state the descriptive, noncausal scope and unresolved mechanism");
}
if (/target does not bind/i.test(nmtcRecord) || /target does not bind/i.test(jobMarket)) {
  failures.push("NMTC public summary overstates the 20 percent target result");
}

const researchSource = resolve("src/content/research");
const researchRecords = [];
for (const filename of await readdir(researchSource)) {
  if (!filename.endsWith(".md")) continue;
  const source = await readFile(resolve(researchSource, filename), "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    failures.push(`research source has unreadable frontmatter: ${filename}`);
    continue;
  }
  researchRecords.push({ id: filename.slice(0, -3), ...parseYaml(frontmatter[1]) });
}

for (const record of researchRecords) {
  const route = resolve(dist, "research", record.id, "index.html");
  if (record.discovery === "withheld") {
    try {
      await access(route, constants.F_OK);
      failures.push(`withheld research route was generated: research/${record.id}/index.html`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    for (const forbidden of [record.id, record.title, record.distinctiveQuery].filter(Boolean)) {
      if (builtHtml.some((html) => html.includes(forbidden))) {
        failures.push(`built public HTML exposes withheld research: ${forbidden}`);
      }
    }
    continue;
  }

  try {
    const html = await readFile(route, "utf8");
    const text = visibleText(html);
    for (const [label, value] of [
      ["display status", record.displayStatus],
      ["research question", record.question],
      ["role", record.role],
      ["evidentiary limit", record.limit],
    ]) {
      if (value && !text.includes(value)) failures.push(`research/${record.id}/ omits canonical ${label}: ${value}`);
    }
  } catch (error) {
    failures.push(`discoverable research route is missing or unreadable: research/${record.id}/ (${error.message})`);
  }
}

for (const forbiddenClaim of [
  "Provides the first direct empirical estimate",
  "Builds the first global",
  "Material revisions to ACR",
  "No competitor has released",
  "best-instrumented",
  "Pathway to the KSE Institute",
  "Existence is established",
  "delivers uniqueness",
  "Headed to SSRN in late spring 2026",
]) {
  if (builtHtml.some((html) => html.includes(forbiddenClaim))) {
    failures.push(`built site retains research-status overclaim: ${forbiddenClaim}`);
  }
}

const writingSource = resolve("src/content/writing");
const forbiddenWritingSourcePhrases = [
  "tutoring client",
  "has her ticket",
  "has his ticket",
  "twenty-five interviews scheduled",
  "hanna-finals-studyhub",
  "Macroecon_Intro",
];
for (const filename of await readdir(writingSource)) {
  if (!filename.endsWith(".md")) continue;
  const source = await readFile(resolve(writingSource, filename), "utf8");
  for (const phrase of forbiddenWritingSourcePhrases) {
    if (source.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`writing source exposes private or student-specific detail: ${filename} (${phrase})`);
    }
  }
  if (!/^draft:\s*true\s*$/m.test(source)) continue;

  failures.push(`draft writing source remains in the public repository: ${filename}`);

  const slug = filename.slice(0, -3);
  try {
    await access(resolve(dist, "writing", slug, "index.html"), constants.F_OK);
    failures.push(`draft writing record is publicly built: writing/${slug}/index.html`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

if (failures.length > 0) {
  console.error("Public CV safety check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public CV safety check passed: retired, inaccurate CV artifacts are absent and unlinked.");
