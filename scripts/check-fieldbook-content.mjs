import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const failures = [];

const requireText = (source, path, text, label = text) => {
  if (!source.includes(text)) failures.push(`${path}: missing ${label}`);
};

const forbidText = (source, path, text, label = text) => {
  if (source.includes(text)) failures.push(`${path}: still contains ${label}`);
};

const basePath = "src/layouts/Base.astro";
const homePath = "src/pages/index.astro";
const workPath = "src/pages/work.astro";
const researchPath = "src/pages/research/index.astro";
const teachingPath = "src/pages/teaching/index.astro";
const aboutPath = "src/pages/about.astro";
const cvPath = "src/pages/cv.astro";
const contactPath = "src/pages/contact.astro";
const jobMarketPath = "src/pages/job-market.astro";
const programPath = "src/pages/program.astro";
const capabilitiesPath = "src/pages/capabilities.astro";
const startPath = "src/pages/start.astro";
const workWithMePath = "src/pages/work-with-me.astro";

const [base, home, work, research, teaching, about, cv, contact, jobMarket, program, capabilities, start, workWithMe] = await Promise.all([
  read(basePath),
  read(homePath),
  read(workPath),
  read(researchPath),
  read(teachingPath),
  read(aboutPath),
  read(cvPath),
  read(contactPath),
  read(jobMarketPath),
  read(programPath),
  read(capabilitiesPath),
  read(startPath),
  read(workWithMePath),
]);

for (const [href, label] of [
  ["/work", "Work"],
  ["/research", "Research"],
  ["/teaching", "Teaching"],
  ["/about", "About"],
  ["/cv", "CV"],
]) {
  if (!new RegExp(`<a\\s+href=["']${href}["'][^>]*>[^<]*${label}`, "i").test(base)) {
    failures.push(`${basePath}: primary navigation is missing ${label} (${href})`);
  }
}
if (/<nav id="primary-nav"[\s\S]*?<a href="\/job-market"/.test(base)) {
  failures.push(`${basePath}: Job market remains in primary navigation`);
}
requireText(base, basePath, 'href="/contact"', "the Contact primary action");

requireText(home, homePath, "selectedRecordIds", "the explicit selected-record list");
for (const id of ["human-or-machine", "trade-in-the-spotlight", "applied-statistics"]) {
  requireText(home, homePath, id, `the ${id} selected record`);
}
for (const text of ["Journal of Economic Theory", "Securing America's Future"]) {
  requireText(home, homePath, text);
}
requireText(home, homePath, "CdeDecomposition", "the NMTC evidence component");
requireText(home, homePath, "tutoringRecord", "canonical tutoring evidence");
forbidText(home, homePath, "Hiring committees", "the audience-choice front door");
forbidText(home, homePath, "quiet-routes", "the audience-choice card wall");

requireText(work, workPath, "workCases", "the canonical work-case data");
for (const id of ["nmtc-rural-gap", "human-or-machine", "trade-in-the-spotlight", "applied-statistics", "nncta"]) {
  requireText(work, workPath, id, `the ${id} case`);
}
forbidText(work, workPath, "The same six moves", "the proprietary-looking six-move synthesis");

for (const heading of [
  "Public and circulating",
  "Current work",
  "Active development",
  "Earlier work",
]) requireText(research, researchPath, heading);
requireText(research, researchPath, "research-discovery", "the canonical discovery rules");
forbidText(research, researchPath, "Nine papers", "the obsolete paper-count claim");

requireText(teaching, teachingPath, "Teaching &amp; Coaching", "the Teaching & Coaching H1");
requireText(teaching, teachingPath, "RepresentationRelay", "the flagship representation relay");
requireText(teaching, teachingPath, "platform-recorded", "the Wyzant source label");
requireText(teaching, teachingPath, "practice-recorded", "the private-practice source label");
requireText(teaching, teachingPath, "/projects/applied-statistics", "the relocated applied-statistics lab link");
forbidText(teaching, teachingPath, 'id="est"', "the duplicated inline least-squares lab");

for (const text of [
  "Ad hoc referee, Journal of Economic Theory",
  "Vice President for Campus Services",
  "Senator of the Year, 2020",
  "Additional contributor to the semiconductor demonstration",
]) requireText(about, aboutPath, text);
forbidText(about, aboutPath, "fiancee", "private relationship history");
forbidText(about, aboutPath, "partners since", "private relationship history");

requireText(cv, cvPath, 'id="contact"', "the canonical contact section");
requireText(cv, cvPath, "Ad hoc referee, Journal of Economic Theory");
requireText(cv, cvPath, "tutoringRecord", "canonical tutoring evidence");
requireText(cv, cvPath, "/job-market", "the contextual academic job-market link");
requireText(contact, contactPath, "/cv#contact", "the canonical CV and contact destination");
requireText(jobMarket, jobMarketPath, "research-discovery", "the canonical research discovery rules");
forbidText(program, programPath, "helfrich-2026-aroe", "the withheld AROE route");
forbidText(program, programPath, "Adaptive-regularization observation equilibria", "the withheld AROE title");

for (const [path, source, destination] of [
  [capabilitiesPath, capabilities, "/work"],
  [startPath, start, "/contact"],
  [workWithMePath, workWithMe, "/contact"],
]) {
  requireText(source, path, "noindex", "the noindex compatibility boundary");
  requireText(source, path, destination, `the canonical ${destination} destination`);
}

const primaryPages = [home, work, research, teaching, about, cv].join("\n");
for (const prohibited of [
  "PPD 504 Studio",
  "Russell Qualifier Lab",
  "LearnScope",
  "Macro Prep",
  "Inference Lab",
  "Stats Lab",
]) {
  if (primaryPages.includes(prohibited)) failures.push(`primary pages expose prohibited bespoke material: ${prohibited}`);
}

if (failures.length) {
  console.error(`Fieldbook content check failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("Fieldbook content check passed for primary navigation and six evidence-led routes.");
