import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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
if (!teachingPage.includes("1,003") || !teachingPage.includes("171")) {
  failures.push("Teaching page must use the verified August 2026 Wyzant snapshot: 1,003 hours and 171 ratings.");
}

if (failures.length) {
  console.error(`Copy check failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Copy check passed across ${files.length} public-facing files. Third Space cofounder: Elizaveta Gonchar, Ph.D. Student coauthor: Shane Vardanyan.`);
