// Home-page gravity field: the section list, the pages labelled at rest, and labels used on the home
// page only. Site-wide map labels stay in field-topics.mjs.

/** Section list beside the map, in display order. */
export const HOME_SECTIONS = Object.freeze([
  ["/job-market/", "Job market"],
  ["/cv/", "CV"],
  ["/contact/", "Contact"],
  ["/research/", "Research"],
  ["/teaching/", "Teaching"],
  ["/lab/", "Lab"],
  ["/work/", "Work"],
  ["/projects/", "Projects"],
  ["/datasets/", "Datasets"],
  ["/writing/", "Writing"],
  ["/field/", "Full site map"],
]);

/** Labels that differ on the home page from the site map's short labels. */
export const HOME_LABELS = Object.freeze({
  "/research/helfrich-2026-nmtc-rural-gap/": "Working paper: NMTC rural gap",
});

/** Pages labelled when nothing is chosen, in priority order. The first FORCED_LANDMARKS always show. */
export const LANDMARKS = Object.freeze([
  "/",
  "/job-market/",
  "/research/helfrich-2026-nmtc-rural-gap/",
  "/cv/",
  "/contact/",
  "/research/",
  "/teaching/",
  "/datasets/",
  "/econometrics/",
  "/projects/",
  "/lab/",
  "/work/",
  "/writing/",
  "/spatial/",
  "/research/helfrich-2024-dissertation/",
  "/research/gonchar-helfrich-2026-effective-distance-panel/",
  "/library/",
]);
export const FORCED_LANDMARKS = 7;

/** Label for a page on the home map. */
export const homeLabel = (node) => HOME_LABELS[node.id] ?? node.label;
