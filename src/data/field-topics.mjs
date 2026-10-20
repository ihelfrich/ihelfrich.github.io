// Topic tags and guided routes for the site map at /field/.
// Topics are assigned by keyword and corrected by hand in OVERRIDES. Every route page
// listed in ROUTES must exist, or scripts/build-field-data.mjs fails the build.

export const TOPIC_ORDER = Object.freeze(["trade", "measurement", "place", "teaching", "profile"]);

export const TOPIC_NAMES = Object.freeze({
  trade: "International trade",
  measurement: "Measurement",
  place: "Place-based policy",
  teaching: "Teaching",
  profile: "Profile and contact",
});

export const TOPIC_SHORT = Object.freeze({
  trade: "Trade",
  measurement: "Measurement",
  place: "Place",
  teaching: "Teaching",
  profile: "Profile",
});

const KEYWORDS = [
  ["trade", /trade|gravity|distance|effdist|effective|crude|import/],
  ["place", /nmtc|spatial|st-louis|gis|investment|place|property|lidar|terrain|atlas|hidden|ocean|policy-atlas|county/],
  ["measurement", /measure|penumbra|observ|occlusion|ukraine|missing|satellite|hidden-rivers|oceanograph|identif/],
  ["teaching", /teach|econometric|statistic|calculus|macro|practice|ols|market-mechanics|inference|pictures|counting|stataverse|course|tutor|lab\//],
  ["profile", /job-market|\/cv|contact|book|about|people|\/now|third-space|work\/|colophon|writing|reading/],
];

// Hand-set topics, path to topic list. The first topic is the primary one. A page missing from this
// list falls back to the keyword rules above, so new pages appear on the map with a provisional tag.
export const OVERRIDES = Object.freeze({
  "/": ["profile"],
  "/about/": ["profile"],
  "/book/": ["profile", "teaching"],
  "/calculus/": ["teaching"],
  "/colophon/": ["profile"],
  "/contact/": ["profile"],
  "/cv/": ["profile"],
  "/datasets/": ["measurement"],
  "/datasets/counterfactuals-data-lab/": ["teaching", "measurement"],
  "/datasets/effdist-v2026/": ["trade", "measurement"],
  "/datasets/nmtc-national-atlas/": ["place"],
  "/datasets/us-nmtc-panel/": ["place"],
  "/econometrics/": ["teaching"],
  "/econometrics/06-measurement/": ["teaching", "measurement"],
  "/econometrics/measurement/": ["teaching", "measurement"],
  "/econometrics/measurement/field-guide/": ["teaching", "measurement"],
  "/econometrics/measurement/story/": ["teaching", "measurement"],
  "/econometrics/measurement/technical/": ["teaching", "measurement"],
  "/economics-practice/": ["teaching"],
  "/economics-practice/curriculum/": ["teaching"],
  "/gis-portfolio/": ["place", "measurement"],
  "/gis/": ["place", "measurement"],
  "/hidden-rivers/": ["measurement", "place"],
  "/job-market/": ["profile"],
  "/lab/": ["teaching"],
  "/library/": ["profile"],
  "/macroeconomics/": ["teaching"],
  "/now/": ["profile"],
  "/people/": ["profile"],
  "/people/elizaveta-gonchar/": ["profile", "trade"],
  "/people/ian-helfrich/": ["profile"],
  "/program/": ["trade", "place", "measurement"],
  "/projects/": ["profile"],
  "/projects/american-policy-atlas/": ["teaching", "place"],
  "/projects/applied-statistics/": ["teaching"],
  "/projects/climfinrisk/": ["place", "measurement"],
  "/projects/counting-factually/": ["teaching"],
  "/projects/econometric-argument/": ["teaching"],
  "/projects/effdist-v2026/": ["trade", "measurement"],
  "/projects/gis-portfolio/": ["place", "measurement"],
  "/projects/hidden-rivers/": ["measurement", "place"],
  "/projects/macro-research-tools/": ["teaching", "measurement"],
  "/projects/oceanographic-systems/": ["measurement", "place"],
  "/projects/pictures-of-inference/": ["teaching"],
  "/projects/spatial-investment-lab/": ["place"],
  "/projects/st-louis-property-lab/": ["place"],
  "/projects/stataverse/": ["teaching"],
  "/projects/teaching-notes/": ["teaching"],
  "/projects/us-nmtc-viewer/": ["place"],
  "/projects/yellowjacket/": ["measurement"],
  "/reading/": ["profile"],
  "/research/": ["trade", "place", "measurement"],
  "/research/gonchar-helfrich-2025-spotlight/": ["trade"],
  "/research/gonchar-helfrich-2026-effective-distance-panel/": ["trade", "measurement"],
  "/research/gonchar-helfrich-2026-ukraine/": ["measurement"],
  "/research/helfrich-2024-dissertation/": ["trade"],
  "/research/helfrich-2024-ssrn-4772016/": ["trade"],
  "/research/helfrich-2026-nmtc-rural-gap/": ["place"],
  "/research/helfrich-2026-penumbra/": ["measurement", "trade"],
  "/research/helfrich-2026-russian-crude/": ["trade", "measurement"],
  "/research/helfrich-vardanyan-2026-ai-entry-level-labor/": ["measurement"],
  "/search/": ["profile"],
  "/spatial/": ["place"],
  "/spatial-economics/": ["place"],
  "/spatial-economics/national/": ["place"],
  "/st-louis/": ["place"],
  "/st-louis/license/": ["place"],
  "/teaching/": ["teaching"],
  "/teaching/market-mechanics/": ["teaching"],
  "/teaching/ols-assumptions/": ["teaching"],
  "/third-space/": ["profile"],
  "/work/": ["profile"],
  "/writing/": ["profile"],
  "/writing/hello-from-the-hub/": ["profile"],
  "/writing/welcome-to-plot-and-policy/": ["profile"],
});

export function topicsFor(path, title = "", description = "") {
  if (OVERRIDES[path]) return [...OVERRIDES[path]];
  if (path.startsWith("/econometrics/")) return ["teaching"];
  const haystack = `${path} ${title} ${description}`.toLowerCase();
  const found = KEYWORDS.filter(([, pattern]) => pattern.test(haystack)).map(([topic]) => topic);
  const ordered = TOPIC_ORDER.filter((topic) => found.includes(topic));
  return ordered.length ? ordered : ["profile"];
}

export function typeFor(path) {
  if (/^\/research\/./.test(path)) return "paper";
  if (/^\/datasets\/./.test(path)) return "data";
  if (/^\/(projects\/.|spatial|hidden-rivers|st-louis|gis-portfolio|spatial-economics)/.test(path)) return "tool";
  if (/^\/(econometrics\/.|teaching\/.|macroeconomics|calculus|economics-practice)/.test(path)) return "course";
  return "page";
}

export const ROUTES = Object.freeze({
  "Hiring committee": {
    summary: "Job market page, dissertation, a current paper and its data, teaching, CV.",
    steps: [
      ["/job-market/", "Candidate page: field, job market paper, availability."],
      ["/research/helfrich-2024-dissertation/", "Dissertation, Georgia Tech, 2024."],
      ["/research/helfrich-2026-nmtc-rural-gap/", "Current paper on the rural gap in New Markets Tax Credit financing."],
      ["/datasets/us-nmtc-panel/", "Project-level data used in that paper."],
      ["/spatial-economics/national/", "Interactive map of the same financing data."],
      ["/teaching/", "Teaching record."],
      ["/cv/", "CV and contact information."],
    ],
  },
  Student: {
    summary: "Econometrics course, interactive labs, booking.",
    steps: [
      ["/teaching/", "Courses and teaching tools."],
      ["/econometrics/", "Open course in applied econometrics."],
      ["/econometrics/01-argument/", "Chapter 1."],
      ["/teaching/market-mechanics/", "Interactive supply and demand lab."],
      ["/teaching/ols-assumptions/", "Companion to the classical OLS assumptions."],
      ["/book/", "Book a tutoring session."],
    ],
  },
  Collaborator: {
    summary: "Research program, data, tools, Third Space Labs, contact.",
    steps: [
      ["/program/", "Research questions and how they connect."],
      ["/research/helfrich-2026-penumbra/", "Draft on measurement gaps in cross-border trade data."],
      ["/datasets/", "Public datasets."],
      ["/hidden-rivers/", "Ocean transport and satellite imagery project."],
      ["/third-space/", "Third Space Labs, with Elizaveta Gonchar."],
      ["/contact/", "Contact."],
    ],
  },
});
