// Breadcrumb trails for pages two or more levels deep. A parent appears as a link only
// when its route is a real page listed in SECTION_LABELS. Parent hrefs carry the trailing
// slash, the form GitHub Pages serves without a 301; the routes in the tables below do not.

import { withSlash } from "./navigation.mjs";

export const SECTION_LABELS = Object.freeze({
  "/research": "Research",
  "/projects": "Projects",
  "/datasets": "Datasets",
  "/teaching": "Teaching",
  "/writing": "Writing",
  "/people": "People",
  "/spatial-economics": "Spatial investment",
  "/st-louis": "St. Louis",
  "/econometrics": "The Econometric Argument",
  "/econometrics/measurement": "Measurement",
  "/hidden-rivers": "Hidden Rivers",
  "/economics-practice": "Economics practice",
  "/handbook": "Econometrics Across Disciplines",
  "/time-series": "Time-Series Econometrics",
  "/macroeconomics": "Macroeconomics suite",
});

// Sections that sit under another section in the trail, so the trail starts at the right place.
const PARENT_OF = Object.freeze({
  "/econometrics": "/teaching",
  "/handbook": "/teaching",
  "/time-series": "/teaching",
  "/economics-practice": "/teaching",
  "/macroeconomics": "/teaching",
  "/spatial-economics": "/lab",
  "/st-louis": "/lab",
  "/hidden-rivers": "/lab",
});

const TOP_LABELS = Object.freeze({ "/teaching": "Teaching", "/lab": "Lab" });

/** Returns [{label, href}] ending with the current page (no href), or [] when no trail applies. */
export function crumbsFor(pathname, title) {
  const clean = pathname.replace(/\/+$/, "");
  const segments = clean.split("/").filter(Boolean);
  if (segments.length < 2 || !title) return [];

  const trail = [];
  const first = `/${segments[0]}`;
  if (PARENT_OF[first]) trail.push({ label: TOP_LABELS[PARENT_OF[first]], href: withSlash(PARENT_OF[first]) });

  let route = "";
  for (let i = 0; i < segments.length - 1; i += 1) {
    route += `/${segments[i]}`;
    const label = SECTION_LABELS[route];
    if (label) trail.push({ label, href: withSlash(route) });
  }
  if (!trail.length) return [];
  trail.push({ label: title, href: null });
  return trail;
}
