import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const dist = resolve("dist");
const retiredArtifacts = [
  "cv/helfrich-cv.pdf",
  "cv/helfrich-cv-full.pdf",
  "cv/helfrich-cv-july-2026.pdf",
];
const publicPages = ["cv/index.html", "job-market/index.html"];
const failures = [];

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
const recordAuthors = nmtcRecord.match(/<p class="record-authors">([^<]*)<\/p>/)?.[1];
const jobMarketTitle = jobMarket.match(/<p class="paper-jmp-title"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";

if (recordAuthors !== nmtcAuthor) {
  failures.push(`NMTC research record authors are "${recordAuthors ?? "missing"}"; expected sole author "${nmtcAuthor}"`);
}

if (!jobMarketTitle.includes(nmtcAuthor) || !/sole-authored/i.test(jobMarketTitle)) {
  failures.push("job-market NMTC title line must identify Ian Helfrich as the sole author");
}
for (const contributor of nmtcContributors) {
  if (jobMarketTitle.includes(contributor)) {
    failures.push(`job-market NMTC title line incorrectly lists contributor as an author: ${contributor}`);
  }
  if (!nmtcRecord.includes(contributor)) {
    failures.push(`NMTC research record omits contributor acknowledgment: ${contributor}`);
  }
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
  "talks index": await readFile(resolve(dist, "talks/index.html"), "utf8"),
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

for (const [label, html] of Object.entries({ "NMTC research record": nmtcRecord, "job-market page": jobMarket })) {
  if (!/\u22120\.185[\s\S]{0,180}86 percent/i.test(html)) {
    failures.push(`${label} does not pair the base-decomposition contribution −0.185 with 86 percent`);
  }
  if (/\u22120\.185[\s\S]{0,180}88 percent/i.test(html)) {
    failures.push(`${label} combines incompatible NMTC base and purpose-augmented decomposition figures`);
  }
}
if (!jobMarket.includes("19,907 QLICI transactions covering 8,024 projects")) {
  failures.push("job-market page does not describe the NMTC project panel with the verified QLICI scope");
}
if (!/descriptive, noncausal/i.test(nmtcRecord) || !/mechanism remains unresolved/i.test(nmtcRecord)) {
  failures.push("NMTC record does not state the descriptive, noncausal scope and unresolved mechanism");
}
if (/target does not bind/i.test(nmtcRecord) || /target does not bind/i.test(jobMarket)) {
  failures.push("NMTC public summary overstates the 20 percent target result");
}

const researchStatusChecks = [
  {
    page: "research/helfrich-2026-russian-crude/index.html",
    required: ["The planned design will estimate", "No empirical results yet"],
    forbidden: ["Provides the first direct empirical estimate"],
  },
  {
    page: "research/gonchar-helfrich-2026-effective-distance-panel/index.html",
    required: ["planned 2000-2024 panel", "structural-gravity validation"],
    forbidden: ["Builds the first global", "Validated in", "Material revisions to ACR", "Released as CC-BY", "No competitor has released"],
  },
  {
    page: "research/gonchar-helfrich-2026-ukraine/index.html",
    required: ["will combine", "aims to decompose", "planned quarterly Ukraine Shadow-Activity Index"],
    forbidden: ["best-instrumented", "Pathway to the KSE Institute"],
  },
  {
    page: "research/helfrich-2026-aroe/index.html",
    required: ["Draft; authorship configuration under review"],
    forbidden: ["Existence is established", "delivers uniqueness"],
  },
  {
    page: "research/helfrich-2026-penumbra/index.html",
    required: ["Draft; not yet posted to SSRN"],
    forbidden: ["Headed to SSRN in late spring 2026"],
  },
];
for (const check of researchStatusChecks) {
  const html = await readFile(resolve(dist, check.page), "utf8");
  for (const phrase of check.required) {
    if (!html.includes(phrase)) failures.push(`${check.page} omits bounded status wording: ${phrase}`);
  }
  for (const phrase of check.forbidden) {
    if (html.includes(phrase)) failures.push(`${check.page} retains research-status overclaim: ${phrase}`);
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
