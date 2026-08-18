import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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

const thirdSpace = `${await readFile("src/pages/third-space.astro", "utf8")}\n${await readFile("src/components/ThirdSpacePortal.astro", "utf8")}`;
if (!thirdSpace.includes("ELIZAVETA GONCHAR") || !thirdSpace.includes("Elizaveta Gonchar")) {
  failures.push("Third Space must name Elizaveta Gonchar, Ph.D., in both display and prose.");
}
if (/Vardanyan/i.test(thirdSpace)) failures.push("A Vardanyan reference appears in Third Space source.");
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
