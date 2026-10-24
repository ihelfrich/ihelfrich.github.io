// Page-view counting with GoatCounter (cookieless; hosted script under EUPL-1.2).
//
// One constant switches it on for the whole site. src/components/Analytics.astro reads it for
// every Astro layout and standalone page; the two hand-written pages in public/
// (learn/policy-statistics and teaching/market-mechanics) carry a small inline loader whose
// `var code` literal must equal this value; scripts/check-analytics.mjs enforces both.
//
// Site code for https://ihelfrich.goatcounter.com (set October 24, 2026). The inline loaders in both
// public/ pages carry the same literal.
export const GOATCOUNTER_CODE = "ihelfrich";

// The /colophon Privacy paragraph states that GoatCounter counts page views and clicks without cookies.

export const GOATCOUNTER_SCRIPT = "https://gc.zgo.at/count.js";

const CODE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** The count endpoint for a site code, or "" when analytics is off or the code is malformed. */
export function goatcounterEndpoint(code = GOATCOUNTER_CODE) {
  return CODE_PATTERN.test(code) ? `https://${code}.goatcounter.com/count` : "";
}

// Click events (data-goatcounter-click) for the documents a committee or client opens and for
// email. GitHub Pages keeps no server logs, so a direct PDF request is otherwise invisible.
const CLICK_EVENTS = Object.freeze({
  "/research/ian-helfrich-nmtc-working-paper.pdf": "pdf-nmtc-paper",
  "/cv/ian-helfrich-cv.pdf": "pdf-cv",
  "/cv/ian-helfrich-executive-resume.pdf": "pdf-resume",
  "mailto:ianthelfrich@gmail.com": "email",
});

/** The event name for a counted link (query and fragment ignored), or undefined. */
export function clickEvent(href) {
  if (typeof href !== "string") return undefined;
  return CLICK_EVENTS[href.split(/[?#]/)[0]];
}

/** The event name for a Motion booking link on /book. */
export const bookingEvent = (id) => `booking-${id}`;

/** Rehype plugin for Markdown content: tags counted links the way the Astro pages do. */
export function rehypeClickEvents() {
  const visit = (node) => {
    if (node.type === "element" && node.tagName === "a") {
      const name = clickEvent(node.properties?.href);
      if (name) node.properties.dataGoatcounterClick = name;
    }
    node.children?.forEach(visit);
  };
  return visit;
}
