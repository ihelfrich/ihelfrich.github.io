import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import * as publicRecordData from "../src/data/public-record.mjs";
import { workCases } from "../src/data/work-cases.mjs";

const readDirectoryIfPresent = async (directory) => {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

const collectAstro = async (directory) => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectAstro(path));
    else if (entry.name.endsWith(".astro")) found.push(path);
  }
  return found;
};

const files = await collectAstro("src");

const rules = [
  { name: "em dash", pattern: /—/g },
  { name: "not-X-but-Y construction", pattern: /\bnot\b[^.!?\n]{0,80}\bbut\b/gi },
  { name: "rather-than construction", pattern: /\brather than\b/gi },
  { name: "wrong Third Space cofounder", pattern: /Elizabeth Vardanyan|Elizaveta Vardanyan/gi },
  { name: "abbreviated Shane Vardanyan", pattern: /\bS\. Vardanyan\b/g },
  { name: "stale 1,200-hour teaching claim", pattern: /\b1,?200(?:\+|\s+(?:hours?|hrs?))/gi },
  { name: "stale 1,003-hour Wyzant claim", pattern: /\b1,003\b/g },
  { name: "stale 171-rating Wyzant claim", pattern: /\b171\s+(?:public\s+)?(?:Wyzant\s+)?ratings?\b/gi },
  { name: "stale 450-student teaching claim", pattern: /\b450\+(?:\s+(?:students?|learners?))?/gi },
  { name: "stale 175-rating teaching claim", pattern: /\b175\+(?:\s+(?:public\s+)?ratings?)?/gi },
  { name: "one-off PPD 504 project name", pattern: /PPD 504 Studio/g },
  { name: "one-off Russell qualifier project name", pattern: /Russell Qualifier Lab/g },
  { name: "one-off LearnScope project name", pattern: /LearnScope/g },
  { name: "one-off Macro Prep project name", pattern: /Macro Prep/g },
  { name: "one-off Inference Lab project name", pattern: /Inference Lab/g },
  { name: "one-off Stats Lab project name", pattern: /Stats Lab/g },
];

const failures = [];
const packageManifest = JSON.parse(await readFile("package.json", "utf8"));
if (!packageManifest.devDependencies?.["js-yaml"]) {
  failures.push("package.json must declare js-yaml directly because the public-copy and discovery gates import it.");
}
for (const file of files) {
  const source = await readFile(file, "utf8");
  const lines = source.split("\n");
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${file}:${line} [${rule.name}] ${lines[line - 1].trim()}`);
    }
  }
}

const researchDirectory = "src/content/research";
const researchFiles = (await readdir(researchDirectory)).filter((name) => name.endsWith(".md"));
const allowedMaturity = new Set(["circulating", "working", "development", "earlier"]);
const allowedDiscovery = new Set(["primary", "secondary", "withheld"]);
const allowedDisplayStatus = new Set([
  "Public working paper",
  "Preprint",
  "Published dissertation",
  "Current working paper",
  "Active development · no results yet",
  "Draft · claims under verification",
]);
const researchRecords = [];
for (const filename of researchFiles) {
  const source = await readFile(join(researchDirectory, filename), "utf8");
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    failures.push(`${filename} has no readable YAML frontmatter.`);
    continue;
  }
  const data = parseYaml(frontmatterMatch[1]);
  const body = source.slice(frontmatterMatch[0].length).trim();
  researchRecords.push({ id: filename.replace(/\.md$/, ""), filename, source, body, data });
  for (const field of ["question", "maturity", "role", "method", "limit", "discovery", "displayStatus"]) {
    if (data?.[field] == null || data[field] === "") failures.push(`${filename} is missing required research field: ${field}.`);
  }
  if (data?.maturity && !allowedMaturity.has(data.maturity)) failures.push(`${filename} has invalid maturity: ${data.maturity}.`);
  if (data?.discovery && !allowedDiscovery.has(data.discovery)) failures.push(`${filename} has invalid discovery: ${data.discovery}.`);
  if (data?.displayStatus && !allowedDisplayStatus.has(data.displayStatus)) failures.push(`${filename} has unapproved displayStatus: ${data.displayStatus}.`);
  if (data?.method && (!Array.isArray(data.method) || data.method.length === 0 || data.method.some((item) => typeof item !== "string" || !item.trim()))) {
    failures.push(`${filename} method must be a non-empty string array.`);
  }
  if (data?.maturity === "development" && !/\bno (?:completed |empirical )?results?\b/i.test(`${data.abstract ?? ""} ${data.limit ?? ""}`)) {
    failures.push(`${filename} is in development and must explicitly state that it has no results.`);
  }
}

const withheldResearch = researchRecords.filter(({ data }) => data?.discovery === "withheld");
for (const record of withheldResearch) {
  if (!record.data.distinctiveQuery?.trim()) failures.push(`${record.filename} must provide a distinctiveQuery for public-discovery regression testing.`);
}
for (const record of researchRecords.filter(({ data }) => data?.discovery !== "withheld")) {
  for (const withheld of withheldResearch) {
    for (const forbidden of [withheld.id, withheld.data.title, withheld.data.distinctiveQuery].filter(Boolean)) {
      if (record.source.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase())) {
        failures.push(`${record.filename} publicly cross-references withheld research: ${forbidden}.`);
      }
    }
  }
}

for (const record of researchRecords.filter(({ data }) => data?.maturity === "development")) {
  if (!["Active development · no results yet", "Draft · claims under verification"].includes(record.data.displayStatus)) {
    failures.push(`${record.filename} must use a maturity-safe development displayStatus.`);
  }
}
for (const record of researchRecords.filter(({ data }) => data?.maturity === "working")) {
  if (record.data.displayStatus !== "Current working paper") failures.push(`${record.filename} must display as Current working paper.`);
}
for (const record of researchRecords.filter(({ data }) => data?.maturity === "circulating")) {
  const expected = record.data.status === "preprint" ? "Preprint" : "Public working paper";
  if (record.data.displayStatus !== expected) failures.push(`${record.filename} must display as ${expected}.`);
}
for (const record of researchRecords.filter(({ data }) => data?.maturity === "earlier")) {
  if (record.data.displayStatus !== "Published dissertation") failures.push(`${record.filename} must display as Published dissertation.`);
}

const ssrnTheory = researchRecords.find(({ id }) => id === "helfrich-2024-ssrn-4772016")?.source ?? "";
for (const claim of [/\bexistence\b/i, /\buniqueness\b/i, /allocation(?:s)? as optimal transport/i, /prices? as gradients?/i, /Penumbra program/i, /Paper [01]/i]) {
  if (claim.test(ssrnTheory)) failures.push(`helfrich-2024-ssrn-4772016.md retains an uncleared theorem or genealogy claim: ${claim}.`);
}
const penumbraRecord = researchRecords.find(({ id }) => id === "helfrich-2026-penumbra");
for (const claim of [/\bexistence\b/i, /\buniqueness\b/i, /sections? 1[–-]10/i, /compiles? cleanly/i, /section drafts complete/i, /Paper [012]/i, /adaptive-regularization/i]) {
  if (claim.test(penumbraRecord?.source ?? "")) failures.push(`helfrich-2026-penumbra.md retains an uncleared theorem, completion, or genealogy claim: ${claim}.`);
}
const ukraineRecord = researchRecords.find(({ id }) => id === "gonchar-helfrich-2026-ukraine");
for (const claim of [/Flagship/i, /Four research questions/i, /Sanctions counterfactual/i, /Shadow-Activity Index/i, /Penumbra/i]) {
  if (claim.test(ukraineRecord?.source ?? "")) failures.push(`gonchar-helfrich-2026-ukraine.md exceeds the approved development record: ${claim}.`);
}
if (((ukraineRecord?.body.match(/[.!?]+(?=\s|$)/g) ?? []).length) > 2) failures.push("gonchar-helfrich-2026-ukraine.md body must remain a restrained two-sentence development record.");

for (const exportName of ["identityRecord", "tutoringRecord", "teachingRecognition", "serviceRecord", "availabilityRecord", "publicLinks"]) {
  if (!publicRecordData[exportName] || typeof publicRecordData[exportName] !== "object") {
    failures.push(`The canonical public record is missing structured export: ${exportName}.`);
  }
}
if (publicRecordData.tutoringRecord?.asOf !== "August 2026") failures.push("Wyzant evidence must retain its August 2026 date.");
if (publicRecordData.tutoringRecord?.wyzantHoursProse !== "more than 1,035") failures.push("Wyzant evidence must retain the verified more-than-1,035 wording.");
if (publicRecordData.tutoringRecord?.privateHoursProse !== "nearly 1,000") failures.push("Private-practice evidence must remain a separate nearly-1,000 record.");
if ("combinedHours" in (publicRecordData.tutoringRecord ?? {})) failures.push("Wyzant and private-practice hours must not be presented as a combined exact total.");
if (publicRecordData.teachingRecognition?.award !== "Georgia Tech Economics Graduate Teaching Assistant of the Year") failures.push("The canonical teaching recognition must retain its verified departmental scope.");
if (publicRecordData.identityRecord?.role !== "Applied economist, quantitative research designer, and educator") failures.push("The canonical identity role does not use the approved public positioning.");
if (publicRecordData.identityRecord?.compact !== "Ian Helfrich: Applied economist, quantitative research designer, and educator") failures.push("The canonical compact identity does not use the approved wording.");
if (publicRecordData.serviceRecord?.journalReferee !== "Ad hoc referee, Journal of Economic Theory") failures.push("The canonical service record must expose only the approved Journal of Economic Theory statement.");

const nncta = workCases.find(({ id }) => id === "nncta-semiconductor-demonstration");
const nnctaCredit = "Additional contributor to the semiconductor demonstration in the 2023 NNCTA report Securing America's Future.";
if (nncta?.role !== nnctaCredit) failures.push("The NNCTA case must use the exact bounded canonical credit.");
if (nncta?.reportTitle !== "Securing America's Future: A Framework for Critical Technology Assessment") failures.push("The NNCTA case must use the official report title.");
if (nncta?.status !== "Additional contributor · Public report · 2023") failures.push("The NNCTA case must use the approved bounded status.");
if (!nncta?.links?.some(({ href }) => href === "https://nncta.org/_files/documents/nncta-final-report.pdf")) failures.push("The NNCTA case must link the verified official report.");

const thirdSpace = `${await readFile("src/pages/third-space.astro", "utf8")}\n${await readFile("src/components/ThirdSpacePortal.astro", "utf8")}`;
if (!thirdSpace.includes("ELIZAVETA GONCHAR") || !thirdSpace.includes("Elizaveta Gonchar")) {
  failures.push("Third Space must name Elizaveta Gonchar, Ph.D., in both display and prose.");
}
if (/Vardanyan/i.test(thirdSpace)) failures.push("A Vardanyan reference appears in Third Space source.");
const ianProfile = await readFile("src/content/people/ian-helfrich.md", "utf8");
if (!ianProfile.includes('role: "Applied economist · quantitative research designer · educator"')) {
  failures.push("Ian's people record must use the approved public positioning.");
}
if (/instrument builder/i.test(ianProfile)) failures.push("Ian's people record retains the obsolete instrument-builder label.");
const elizavetaProfile = await readFile("src/content/people/elizaveta-gonchar.md", "utf8");
for (const claim of [/Penumbra-program/i, /Co-PI and collaborator/i, /Paper 5/i, /Joint Paper 1/i]) {
  if (claim.test(elizavetaProfile)) failures.push(`Elizaveta's people record retains an unverified internal program label: ${claim}.`);
}
const shanePaper = await readFile("src/content/research/helfrich-vardanyan-2026-ai-entry-level-labor.md", "utf8");
if (!shanePaper.includes('"Shane Vardanyan"')) failures.push("The AI labor paper must spell out Shane Vardanyan's name.");

for (const [path, label] of [
  ["src/content/research/helfrich-2026-human-or-machine.md", "the sole-authored Human or Machine working paper"],
  ["src/content/research/helfrich-2024-dissertation.md", "the Georgia Tech doctoral dissertation"],
]) {
  try {
    await readFile(path, "utf8");
  } catch {
    failures.push(`The research collection is missing ${label}.`);
  }
}

const researchIndex = await readFile("src/pages/research/index.astro", "utf8");
if (/Nine papers/i.test(researchIndex)) failures.push("The research index hard-codes an obsolete paper count.");

let publicRecord = "";
try {
  publicRecord = await readFile("src/data/public-record.mjs", "utf8");
} catch {
  failures.push("Tutoring evidence must live in src/data/public-record.mjs, not be maintained page by page.");
}
for (const required of ["1,035+", "more than 1,035", "nearly 1,000", "August 2026", 'publicRating: "5.0"']) {
  if (publicRecord && !publicRecord.includes(required)) failures.push(`The canonical public record is missing: ${required}.`);
}
if (/wyzantHoursHeadline:\s*"1,000\+"|hoursHeadline:\s*"1,000\+"/.test(publicRecord)) {
  failures.push("The canonical Wyzant headline must not retain the stale 1,000+ shorthand.");
}

for (const surface of [
  "src/pages/index.astro",
  "src/pages/about.astro",
  "src/pages/capabilities.astro",
  "src/pages/cv.astro",
  "src/pages/job-market.astro",
  "src/pages/teaching/index.astro",
  "src/pages/work.astro",
  "src/components/StudioFrontDoor.astro",
]) {
  const source = await readFile(surface, "utf8");
  if (!source.includes("tutoringRecord")) failures.push(`${surface} must render tutoring evidence from the canonical public record.`);
}

const teachingPage = await readFile("src/pages/teaching/index.astro", "utf8");
for (const required of [
  "Statistics & inference",
  "Econometrics & research design",
  "Python & SQL",
  "Microeconomics",
  "Macroeconomics",
  "Business, strategy & marketing",
  "GIS & public data",
  "Pictures of Inference",
]) {
  if (!teachingPage.includes(required)) failures.push(`Teaching page must present the durable capability family: ${required}.`);
}
const cvPage = await readFile("src/pages/cv.astro", "utf8");
if (!cvPage.includes("Referee, Journal of Economic Theory")) {
  failures.push("CV page must include the confirmed Journal of Economic Theory referee service.");
}

for (const filename of await readDirectoryIfPresent("src/content/talks")) {
  if (!filename.endsWith(".md")) continue;
  const source = await readFile(join("src/content/talks", filename), "utf8");
  if (/ASSA\s*\/\s*AEA Annual Meeting/i.test(source) && /Atlanta/i.test(source)) {
    failures.push(`${filename} assigns the 2026 ASSA/AEA meeting to Atlanta; the official meeting was in Philadelphia.`);
  }
  if (/^upcoming:\s*true\s*$/m.test(source) && /^abstract:\s*["']?Submitted\./mi.test(source)) {
    failures.push(`${filename} presents a submission as an upcoming talk.`);
  }
}

if (failures.length) {
  console.error(`Copy check failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Copy check passed across ${files.length} public-facing files. Third Space cofounder: Elizaveta Gonchar, Ph.D. Student coauthor: Shane Vardanyan.`);
