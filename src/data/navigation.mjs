// Single source of truth for site navigation.
//
// The header and footer in src/layouts/Base.astro, the command-K "Go" records in
// src/components/SiteIndex.astro, the static routes in src/pages/sitemap.xml.js,
// the redirects in astro.config.mjs, and the discovery gate in
// scripts/check-public-discovery.mjs all read from here. Change a label or a
// destination once, in this file.

const freezeAll = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

/** Primary header navigation, in display order. */
export const PRIMARY = freezeAll([
  { label: "Work", href: "/work", detail: "Case studies in econometrics, spatial systems, and interactive evidence", start: true },
  { label: "Research", href: "/research", detail: "Papers, programs, methods, data, and current questions", start: true },
  { label: "Teaching", href: "/teaching", detail: "University teaching, online instruction, independent tutoring, and quantitative research-design coaching", start: true },
  { label: "Lab", href: "/lab", detail: "Working analytical instruments with methods and decision context", start: true },
  { label: "Writing", href: "/writing", detail: "Essays and notes on evidence, measurement, and teaching" },
  { label: "About", href: "/about", detail: "Education, current practice, leadership, and service" },
]);

/** The single call to action in the header, and the first Go record. */
export const CONTACT = Object.freeze({
  label: "Contact",
  href: "/contact",
  detail: "Hiring, research, teaching, coaching, and applied quantitative inquiries",
  start: true,
});

/** Secondary "Records" strip under the header, repeated in the footer. */
export const RECORDS = freezeAll([
  { label: "Job market", href: "/job-market", detail: "Candidate page for the 2026-27 economics job market: fields, paper, availability" },
  { label: "Projects", href: "/projects", detail: "Software, viewers, teaching systems, and research infrastructure" },
  { label: "Datasets", href: "/datasets", detail: "Public datasets and release records with provenance" },
  { label: "Public index", href: "/library", detail: "Papers, data, essays, and tools in one searchable record" },
  { label: "CV", href: "/cv", detail: "Executive resume, academic CV, career summary, availability, and contact" },
]);

/** Pages that belong in the command-K index but not in the header or footer. */
export const SECONDARY_PAGES = freezeAll([
  { label: "Third Space Labs", href: "/third-space", detail: "The independent research venture Ian is building with Elizaveta Gonchar, Ph.D." },
  { label: "Colophon", href: "/colophon", detail: "How this site works: the homepage solver's mathematics, the motion doctrine, the stack" },
]);

/** External profiles rendered in the footer. */
export const CONNECT = freezeAll([
  { label: "Email", href: "mailto:ianthelfrich@gmail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ian-helfrich", external: true },
  { label: "GitHub", href: "https://github.com/ihelfrich", external: true },
]);

/** Command-K "Go" records: contact first, then navigation groups, then secondary pages. */
export const GO_RECORDS = freezeAll(
  [CONTACT, ...PRIMARY, ...RECORDS, ...SECONDARY_PAGES].map((item, index) => ({
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
  "/book": "/contact",
  "/work-with-me": "/contact",
  "/capabilities": "/work",
});

/** Indexable pages that are reached from content rather than from the navigation. */
export const STANDALONE_ROUTES = Object.freeze([
  "/",
  "/colophon/",
  "/third-space/",
  "/people/",
  "/program/",
  "/gis/",
  "/now/",
  "/reading/",
  "/search/",
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
]);

const withSlash = (href) => (href.endsWith("/") ? href : `${href}/`);

/** Every internal route the navigation exposes, with trailing slashes, unique. */
export function navRoutes() {
  return [...new Set([CONTACT, ...PRIMARY, ...RECORDS, ...SECONDARY_PAGES].map(({ href }) => withSlash(href)))];
}

/** Static routes for sitemap.xml: navigation routes plus standalone pages, unique. */
export function sitemapStaticRoutes() {
  return [...new Set([...navRoutes(), ...STANDALONE_ROUTES])];
}
