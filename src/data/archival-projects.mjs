export const ARCHIVAL_PROJECTS = Object.freeze([
  Object.freeze({ id: "corpo-finance", title: "Corporate Finance Decision Lab" }),
  Object.freeze({ id: "inference-lab", title: "Inference Lab" }),
  Object.freeze({ id: "macroprep", title: "Macro Prep" }),
  Object.freeze({ id: "ppd504-studio", title: "Public-Data Statistics Studio" }),
  Object.freeze({ id: "stats-lab", title: "Stats Lab" }),
]);

export const ARCHIVAL_PROJECT_IDS = Object.freeze(ARCHIVAL_PROJECTS.map(({ id }) => id));

const archivalProjectIdSet = new Set(ARCHIVAL_PROJECT_IDS);

export const isArchivalProject = (id) => archivalProjectIdSet.has(id);
