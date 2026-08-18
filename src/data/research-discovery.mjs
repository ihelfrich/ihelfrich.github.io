export const RESEARCH_DISCOVERY = Object.freeze({
  PRIMARY: "primary",
  SECONDARY: "secondary",
  WITHHELD: "withheld",
});

export function isDiscoverableResearch(entry) {
  return entry?.data?.discovery === RESEARCH_DISCOVERY.PRIMARY
    || entry?.data?.discovery === RESEARCH_DISCOVERY.SECONDARY;
}

export function filterDiscoverableResearch(entries) {
  return entries.filter(isDiscoverableResearch);
}
