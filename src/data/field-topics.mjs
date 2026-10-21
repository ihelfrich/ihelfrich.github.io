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
  "/teaching/distributions/": ["teaching", "measurement"],
  "/teaching/ols-assumptions/": ["teaching"],
  "/third-space/": ["profile"],
  "/work/": ["profile"],
  "/writing/": ["profile"],
  "/writing/hello-from-the-hub/": ["profile"],
  "/writing/welcome-to-plot-and-policy/": ["profile"],
});


// Short names for the map's labels and lists. A page missing here uses its full title.
export const LABELS = Object.freeze({
  "/": "Home",
  "/about/": "About",
  "/book/": "Book a time",
  "/calculus/": "Calculus in motion",
  "/colophon/": "Colophon",
  "/contact/": "Contact",
  "/cv/": "CV",
  "/datasets/": "Datasets",
  "/datasets/counterfactuals-data-lab/": "Counterfactuals data lab",
  "/datasets/effdist-v2026/": "EffDist V2026 data",
  "/datasets/nmtc-national-atlas/": "NMTC national atlas data",
  "/datasets/us-nmtc-panel/": "NMTC project panel",
  "/econometrics/": "Econometric Argument",
  "/econometrics/01-argument/": "Ch. 1: Argument",
  "/econometrics/02-probability/": "Ch. 2: Probability",
  "/econometrics/03-projection/": "Ch. 3: Projection",
  "/econometrics/04-uncertainty/": "Ch. 4: Uncertainty",
  "/econometrics/05-design/": "Ch. 5: Design",
  "/econometrics/06-measurement/": "Ch. 6: Measurement",
  "/econometrics/07-instruments/": "Ch. 7: Instruments",
  "/econometrics/08-panels/": "Ch. 8: Panels",
  "/econometrics/09-local-designs/": "Ch. 9: Local designs",
  "/econometrics/10-learning/": "Ch. 10: Learning",
  "/econometrics/11-dependence/": "Ch. 11: Dependence",
  "/econometrics/12-decisions/": "Ch. 12: Decisions",
  "/econometrics/edition/": "Edition and methods",
  "/econometrics/lab/": "Econometrics experiments",
  "/econometrics/measurement/": "Measurement thread",
  "/econometrics/measurement/field-guide/": "Measurement field guide",
  "/econometrics/measurement/story/": "Measurement: the story",
  "/econometrics/measurement/technical/": "Measurement: technical companion",
  "/econometrics/readings/": "Econometrics reading room",
  "/econometrics/teach/": "Teach and apply",
  "/economics-practice/": "Economics practice",
  "/economics-practice/curriculum/": "Economics curriculum",
  "/gis-portfolio/": "LiDAR and 3D GIS",
  "/gis/": "Spatial and GIS record",
  "/hidden-rivers/": "Hidden Rivers",
  "/job-market/": "Job market",
  "/lab/": "Lab",
  "/library/": "Public index",
  "/macroeconomics/": "Macroeconomics lab",
  "/now/": "Now",
  "/people/": "People",
  "/people/elizaveta-gonchar/": "Elizaveta Gonchar",
  "/people/ian-helfrich/": "Ian Helfrich",
  "/projects/": "Projects",
  "/projects/american-policy-atlas/": "American Policy Atlas",
  "/projects/applied-statistics/": "Applied Statistics",
  "/projects/climfinrisk/": "ClimFinRisk",
  "/projects/counting-factually/": "Counting, Factually",
  "/projects/econometric-argument/": "Econometric Argument, project record",
  "/projects/effdist-v2026/": "EffDist V2026, project record",
  "/projects/gis-portfolio/": "LiDAR and 3D GIS, project record",
  "/projects/hidden-rivers/": "Hidden Rivers, project record",
  "/projects/macro-research-tools/": "MacroResearchTools",
  "/projects/oceanographic-systems/": "Oceanographic systems",
  "/projects/pictures-of-inference/": "Pictures of Inference",
  "/projects/spatial-investment-lab/": "Spatial Investment Lab, project record",
  "/projects/st-louis-property-lab/": "St. Louis Property Lab",
  "/projects/stataverse/": "STATAverse",
  "/projects/teaching-notes/": "TeachingNotes",
  "/projects/us-nmtc-viewer/": "NMTC viewer",
  "/projects/yellowjacket/": "Yellowjacket",
  "/reading/": "Reading list",
  "/research/": "Research",
  "/research/gonchar-helfrich-2025-spotlight/": "Trade in the spotlight (2025)",
  "/research/gonchar-helfrich-2026-effective-distance-panel/": "Effective-distance panel",
  "/research/gonchar-helfrich-2026-ukraine/": "Ukraine occlusion model",
  "/research/helfrich-2024-dissertation/": "Dissertation (2024)",
  "/research/helfrich-2024-ssrn-4772016/": "Equilibrium and optimal transport",
  "/research/helfrich-2026-nmtc-rural-gap/": "NMTC rural gap (2026)",
  "/research/helfrich-2026-penumbra/": "Penumbra",
  "/research/helfrich-2026-russian-crude/": "Russian seaborne crude",
  "/research/helfrich-vardanyan-2026-ai-entry-level-labor/": "AI and entry-level labor",
  "/search/": "Search",
  "/spatial/": "Spatial and 3D GIS",
  "/spatial-economics/": "Spatial Investment Lab",
  "/spatial-economics/national/": "National Investment Atlas",
  "/st-louis/": "St. Louis lab",
  "/st-louis/license/": "Property Lab licensing",
  "/teaching/": "Teaching",
  "/teaching/distributions/": "Distribution Lab",
  "/teaching/market-mechanics/": "Market Mechanics Lab",
  "/teaching/ols-assumptions/": "OLS assumptions lab",
  "/third-space/": "Third Space Labs",
  "/work/": "Work",
  "/writing/": "Writing",
  "/writing/hello-from-the-hub/": "Rebuilding the research site",
  "/writing/welcome-to-plot-and-policy/": "Plot and Policy",
});

export const labelFor = (path, title = "") => LABELS[path] ?? title;

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
      ["/teaching/distributions/", "Distributions, test power and model fitting."],
      ["/teaching/ols-assumptions/", "Companion to the classical OLS assumptions."],
      ["/book/", "Book a tutoring session."],
    ],
  },
  "Industry and policy": {
    summary: "Selected cases, place-based policy models, the GIS portfolio, Third Space Labs, booking.",
    steps: [
      ["/work/", "Selected cases in applied economics, measurement, spatial analysis, and policy."],
      ["/spatial-economics/national/", "National map of New Markets Tax Credit financing."],
      ["/spatial-economics/", "Scenario model for investment incentives in Asheville, North Carolina."],
      ["/gis-portfolio/", "LiDAR and 3D GIS portfolio."],
      ["/third-space/", "Third Space Labs, with Elizaveta Gonchar."],
      ["/book/", "Book a consulting introduction."],
      ["/contact/", "Contact."],
    ],
  },
  Collaborator: {
    summary: "Research program, data, tools, Third Space Labs, contact.",
    steps: [
      ["/research/", "Research questions, by current stage."],
      ["/research/helfrich-2026-penumbra/", "Draft on measurement gaps in cross-border trade data."],
      ["/datasets/", "Public datasets."],
      ["/hidden-rivers/", "Ocean transport and satellite imagery project."],
      ["/third-space/", "Third Space Labs, with Elizaveta Gonchar."],
      ["/contact/", "Contact."],
    ],
  },
});
