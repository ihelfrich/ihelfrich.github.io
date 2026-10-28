// Single source of truth for site navigation.
//
// The header and footer in src/layouts/Base.astro, the command-K "Go" records in
// src/components/SiteIndex.astro, the static routes in src/pages/sitemap.xml.js,
// the redirects in astro.config.mjs, and the discovery gate in
// scripts/check-public-discovery.mjs all read from here. Change a label or a
// destination once, in this file.

const freezeAll = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

/**
 * Primary header navigation, in display order. During the 2026-27 academic market the
 * header leads with the candidate page and the CV. "Work" keeps its label until after
 * ASSA (January 2027); whether it becomes "Consulting" is Dr. Helfrich's decision.
 */
export const PRIMARY = freezeAll([
  { label: "Job market", href: "/job-market", detail: "Candidate page for the 2026–27 economics job market: fields, paper, availability", start: true },
  { label: "Research", href: "/research", detail: "Papers, programs, methods, data, and current questions", start: true },
  { label: "Teaching", href: "/teaching", detail: "University teaching, online instruction, independent tutoring, and quantitative research-design coaching", start: true },
  { label: "Work", href: "/work", detail: "Case studies in econometrics, spatial systems, and interactive evidence", start: true },
  { label: "CV", href: "/cv", detail: "Executive resume, academic CV, career summary, availability, and contact", start: true },
]);

/** The single filled call to action in the header, and the first Go record. */
export const CONTACT = Object.freeze({
  label: "Contact",
  href: "/contact",
  detail: "Hiring, research, teaching, coaching, and applied quantitative inquiries",
  start: true,
});

/** The booking page, linked beside Contact in the header and under Connect in the footer. */
export const BOOK = Object.freeze({
  label: "Book a time",
  href: "/book",
  detail: "Tutoring, consulting, and job-market meetings, booked against Ian's open calendar times",
  start: true,
});

/** Secondary "Records" strip under the header, repeated in the footer. */
export const RECORDS = freezeAll([
  { label: "Lab", href: "/lab", detail: "Working analytical instruments with methods and decision context" },
  { label: "Writing", href: "/writing", detail: "Essays and notes on evidence, measurement, and teaching" },
  { label: "About", href: "/about", detail: "Education, current practice, leadership, and service" },
  { label: "Projects", href: "/projects", detail: "Software, viewers, teaching systems, and research infrastructure" },
  { label: "Spatial & 3D GIS", href: "/spatial", detail: "Spatial investment, LiDAR and terrain work, and geospatial applications, with data types and limits stated" },
  { label: "Datasets", href: "/datasets", detail: "Public datasets and release records with provenance" },
  { label: "Public index", href: "/library", detail: "Papers, data, essays, and tools in one searchable record" },
]);

/** Pages that belong in the command-K index but not in the header or footer. */
export const SECONDARY_PAGES = freezeAll([
  { label: "Economics practice", href: "/economics-practice", detail: "Economics course practice, diagnostic sessions, worked explanations, and course directory" },
  { label: "Third Space Labs", href: "/third-space", detail: "The independent research venture Ian is building with Elizaveta Gonchar, Ph.D." },
  { label: "Distribution Lab", href: "/teaching/distributions", detail: "Interactive probability distributions, test power, constructions of t, chi-square and F, and a department simulator for fitting models" },
  { label: "Site map", href: "/field", detail: "Interactive map of every page and the links between them, with routes for hiring committees, students, and collaborators" },
  // Reached from /projects since it left the Records strip.
  { label: "Hidden Rivers", href: "/hidden-rivers", detail: "Ocean transport, flow diagnostics, Tessera coastal search, and a reproducible 3D film" },
  { label: "Colophon", href: "/colophon", detail: "How this site works: the homepage solver's mathematics, the motion doctrine, the stack" },
  { label: "National Investment Atlas", href: "/spatial-economics/national", detail: "Nationwide spatial investment geography: observed New Markets Tax Credit (NMTC) financing, 8,439 projects and $71.019 billion in QLICI, 2001–2023 origination" },
  { label: "LiDAR & 3D GIS portfolio", href: "/gis-portfolio", detail: "Classified LiDAR, terrain diagnostics, survey design, and an interactive Haiti terrain mesh" },
  { label: "Asheville spatial investment scenario", href: "/spatial-economics", detail: "Conditional 3D scenario of incentive offers, additional jobs, and road-network job access in Asheville, NC" },
]);

/** External profiles rendered in the footer; the external ones are also the Person schema's sameAs. */
export const CONNECT = freezeAll([
  { label: "Email", href: "mailto:ianthelfrich@gmail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ian-helfrich", external: true },
  { label: "GitHub", href: "https://github.com/ihelfrich", external: true },
  { label: "ORCID", href: "https://orcid.org/0000-0002-4105-1635", external: true },
  // TODO(Dr. Helfrich): add Google Scholar, SSRN author and RePEc profile URLs here if they exist.
]);

/** Command-K "Go" records: contact and booking first, then navigation groups, then secondary pages. */
export const GO_RECORDS = freezeAll(
  [CONTACT, BOOK, ...PRIMARY, ...RECORDS, ...SECONDARY_PAGES].map((item, index) => ({
    code: `GO-${String(index + 1).padStart(2, "0")}`,
    label: item.label,
    detail: item.detail,
    href: item.href,
    start: Boolean(item.start),
  })),
);

/** Retired routes kept alive as redirects so old links and search results still land. */
export const REDIRECTS = Object.freeze({
  "/start": "/contact",
  "/work-with-me": "/contact",
  "/capabilities": "/work",
  // The research list lives on /research alone.
  "/program": "/research",
});

/** Indexable pages that are reached from content rather than from the navigation. */
export const STANDALONE_ROUTES = Object.freeze([
  "/",
  "/colophon/",
  "/third-space/",
  "/people/",
  "/gis/",
  "/now/",
  "/reading/",
  "/search/",
  "/economics-practice/curriculum/",
  "/macroeconomics/",
  "/calculus/",
  "/st-louis/",
  "/st-louis/license/",
  "/econometrics/",
  "/econometrics/lab/",
  "/econometrics/readings/",
  "/econometrics/teach/",
  "/econometrics/edition/",
  "/econometrics/measurement/",
  // Time-Series Econometrics: the landing page and its static companions. The fifteen chapters and
  // fifteen lecture summaries are added from their sources in src/pages/sitemap.xml.js.
  "/time-series/",
  "/time-series/lectures/",
  "/time-series/experiments/",
  "/time-series/practice/",
  "/time-series/projects/",
  "/time-series/code/",
  "/time-series/methods/",
  "/time-series/research/",
  // Econometrics Across Disciplines, the working handbook; its chapters come from the handbook collection.
  "/handbook/",
  // Hidden Rivers companion pages, reached from /hidden-rivers/.
  "/hidden-rivers/folio/",
  "/hidden-rivers/prints/",
  "/hidden-rivers/research/",
  "/hidden-rivers/tank/",
]);

/**
 * The form of a route that GitHub Pages serves without a redirect. The navigation data keeps
 * slash-free hrefs as identifiers; links rendered from it should pass through this helper,
 * because /teaching answers with a 301 to /teaching/ before the page starts to load.
 */
export const withSlash = (href) => {
  const [, path, suffix] = href.match(/^([^?#]*)(.*)$/);
  if (!path.startsWith("/") || path.endsWith("/") || /\.[a-z0-9]+$/i.test(path)) return href;
  return `${path}/${suffix}`;
};

/** Every internal route the navigation exposes, with trailing slashes, unique. */
export function navRoutes() {
  return [...new Set([CONTACT, BOOK, ...PRIMARY, ...RECORDS, ...SECONDARY_PAGES].map(({ href }) => withSlash(href)))];
}

/** Static routes for sitemap.xml: navigation routes plus standalone pages, unique. */
export function sitemapStaticRoutes() {
  return [...new Set([...navRoutes(), ...STANDALONE_ROUTES])];
}
