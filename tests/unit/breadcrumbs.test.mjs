import test from "node:test";
import assert from "node:assert/strict";
import { crumbsFor, SECTION_LABELS } from "../../src/data/breadcrumbs.mjs";

test("top-level pages have no trail", () => {
  assert.deepEqual(crumbsFor("/research/", "Research"), []);
  assert.deepEqual(crumbsFor("/", "Home"), []);
});

test("a research paper sits under Research and ends with its own title", () => {
  assert.deepEqual(crumbsFor("/research/helfrich-2026-penumbra/", "Penumbra"), [
    { label: "Research", href: "/research" },
    { label: "Penumbra", href: null },
  ]);
});

test("course pages sit under Teaching and the course", () => {
  assert.deepEqual(crumbsFor("/econometrics/07-instruments/", "Instruments"), [
    { label: "Teaching", href: "/teaching" },
    { label: "The Econometric Argument", href: "/econometrics" },
    { label: "Instruments", href: null },
  ]);
  const deep = crumbsFor("/econometrics/measurement/field-guide/", "Field guide");
  assert.deepEqual(deep.map(({ label }) => label), ["Teaching", "The Econometric Argument", "Measurement", "Field guide"]);
});

test("instrument pages sit under Lab", () => {
  const trail = crumbsFor("/st-louis/license/", "Licensing");
  assert.deepEqual(trail.map(({ label }) => label), ["Lab", "St. Louis", "Licensing"]);
});

test("only the last crumb lacks a link, and every parent route is a labelled section", () => {
  const trail = crumbsFor("/spatial-economics/national/", "National Investment Atlas");
  assert.equal(trail.at(-1).href, null);
  for (const { href } of trail.slice(0, -1)) assert.ok(href, "parents link somewhere");
  for (const route of Object.keys(SECTION_LABELS)) assert.match(route, /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
});

test("a page with no known parent gets no trail", () => {
  assert.deepEqual(crumbsFor("/unknown/page/", "Page"), []);
});

test("the time-series course and the handbook use their published titles in the trail", () => {
  assert.deepEqual(crumbsFor("/time-series/03-arma/", "ARMA models and recoverable innovations").map(({ label }) => label), [
    "Teaching", "Time-Series Econometrics", "ARMA models and recoverable innovations",
  ]);
  assert.deepEqual(crumbsFor("/time-series/lectures/03-arma/", "Lecture 3").map(({ label, href }) => [label, href]), [
    ["Teaching", "/teaching"], ["Time-Series Econometrics", "/time-series"], ["Lecture 3", null],
  ]);
  assert.deepEqual(crumbsFor("/handbook/01-questions/", "Economic questions").map(({ label }) => label), [
    "Teaching", "Econometrics Across Disciplines", "Economic questions",
  ]);
});
