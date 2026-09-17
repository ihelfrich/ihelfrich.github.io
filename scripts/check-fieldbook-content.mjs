import { access, readFile } from "node:fs/promises";
import { PRIMARY, RECORDS, CONTACT, REDIRECTS } from "../src/data/navigation.mjs";

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
const navigationPath = "src/data/navigation.mjs";

const [base, home, work, research, teaching, about, cv, contact, jobMarket, program] = await Promise.all([
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
]);

// The shell renders its links from navigation.mjs, so the contract is checked there.
const navigationLinks = new Map([...PRIMARY, ...RECORDS].map(({ href, label }) => [href, label]));
for (const [href, label] of [
  ["/work", "Work"],
  ["/research", "Research"],
  ["/teaching", "Teaching"],
  ["/about", "About"],
  ["/cv", "CV"],
]) {
  if (navigationLinks.get(href) !== label) failures.push(`${navigationPath}: navigation is missing ${label} (${href})`);
}
if (PRIMARY.some(({ href }) => href === "/job-market")) failures.push(`${navigationPath}: Job market remains in primary navigation`);
if (CONTACT.href !== "/contact") failures.push(`${navigationPath}: Contact must remain the single primary action`);
for (const token of ["PRIMARY.map", "RECORDS.map", "CONTACT.href"]) requireText(base, basePath, token, `navigation rendered from ${navigationPath} (${token})`);

requireText(home, homePath, "selectedRecordIds", "the explicit selected-record list");
for (const id of ["nmtc-rural-gap", "trade-in-the-spotlight", "applied-statistics"]) {
  requireText(home, homePath, id, `the ${id} selected record`);
}
for (const text of ["Journal of Economic Theory", "Securing America's Future"]) {
  requireText(home, homePath, text);
}
requireText(home, homePath, 'href="/research"', "the complete research record link");
for (const component of ["ResearchContinuum", "HomepageInstruments"]) requireText(home, homePath, component, "the interactive homepage experience");
requireText(home, homePath, "mountHomepage", "the progressive homepage controls");
requireText(home, homePath, "portrait", "the verified portrait record");
forbidText(home, homePath, "CdeDecomposition", "the NMTC-first homepage signature");
forbidText(home, homePath, "Signature research record", "the single-paper homepage framing");
requireText(home, homePath, "tutoringRecord", "canonical tutoring evidence");
forbidText(home, homePath, "Hiring committees", "the audience-choice front door");
forbidText(home, homePath, "quiet-routes", "the audience-choice card wall");

requireText(work, workPath, "workCases", "the canonical work-case data");
for (const id of ["nmtc-rural-gap", "trade-in-the-spotlight", "applied-statistics", "nncta"]) {
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

requireText(teaching, teachingPath, "<h1>Teaching</h1>", "the teaching headline");
requireText(teaching, teachingPath, "Economics and quantitative methods", "the teaching and coaching context");
requireText(teaching, teachingPath, 'href="/econometrics/"', "the course entry link");
requireText(teaching, teachingPath, 'href="#teaching-relay"', "the live explanation entry link");
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

// Retired funnels are redirects, not pages: no page file may shadow a redirect.
for (const [from, to] of Object.entries(REDIRECTS)) {
  const shadow = `src/pages${from}.astro`;
  const exists = await access(shadow).then(() => true, () => false);
  if (exists) failures.push(`${shadow}: a page file shadows the ${from} → ${to} redirect`);
  if (!["/contact", "/work"].includes(to)) failures.push(`${navigationPath}: ${from} must redirect to /contact or /work, not ${to}`);
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
