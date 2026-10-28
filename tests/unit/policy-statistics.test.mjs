import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkPrediction, challenges } from "../../public/learn/policy-statistics/challenges.mjs";

test("predictions provide correct feedback and reject invalid choices", () => {
  assert.equal(checkPrediction("outlier", 0).correct, true);
  assert.equal(checkPrediction("outlier", 2).correct, false);
  assert.equal(checkPrediction("spread", 1).correct, true);
  assert.equal(checkPrediction("median", 1).correct, true);
  assert.equal(checkPrediction("simpson", 0).correct, true);
  assert.equal(checkPrediction("shapes", 1).correct, true);
  assert.equal(checkPrediction("shapes", 99), null);
  assert.equal(checkPrediction("unknown", 0), null);
});
import {
  villageData,
  villageCount,
  largestVillage,
  largestVillageFloor,
  summarize,
  groupedSummary,
  groupedCounts,
  groupedStart,
  groupedWidth,
  simpsonRates,
} from "../../public/learn/policy-statistics/stats.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

/**
 * Synthetic frequency table, checked by hand:
 * values 100..800 in steps of 100 with frequencies 10, 24, 30, 26, 44, 34, 20,
 * 11, plus one town of 5,000. Total = 95,400 people over 200 villages, so the
 * mean is 477. Cumulative counts reach 90 at 400 and 134 at 500, so positions
 * 100 and 101 are both 500. The sum of squares is 73,000,000.
 */
test("200-village synthetic table statistics match hand-computed totals", () => {
  const d = villageData();
  const s = summarize(d);
  assert.equal(villageCount, 200);
  assert.equal(d.length, 200);
  assert.equal(largestVillage, 5000);
  assert.equal(largestVillageFloor, 800);
  assert.equal(s.total, 95400);
  close(s.mean, 477);
  assert.equal(s.median, 500);
  assert.deepEqual(s.modes, [500]);
  close(s.variance, 73000000 / 200 - 477 ** 2);
  // The long right tail does not put the mean above the median in this table.
  assert.ok(s.mean < s.median);
});

test("shrinking the town preserves the sample and leaves the median unchanged", () => {
  const s = summarize(villageData(largestVillageFloor));
  assert.equal(s.n, 200);
  close(s.mean, (95400 - 4200) / 200);
  assert.equal(s.median, 500);
});

/**
 * Grouped synthetic table: counts 14, 32, 44, 36, 22, 14, 8 in bins of width
 * 50 from 100. Midpoint mean = 42,950 / 170. Half of 170 is 85; 46 villages
 * lie below 200, so the median is 200 + (85 - 46) / 44 * 50.
 */
test("grouped synthetic estimates preserve counts and locate the median bin", () => {
  const s = groupedSummary(groupedCounts, groupedStart, groupedWidth);
  assert.equal(s.n, 170);
  close(s.mean, 42950 / 170);
  close(s.median, 200 + (39 / 44) * 50);
  assert.deepEqual(s.medianBin, [200, 250]);
  assert.deepEqual(s.modalBins, [[200, 250]]);
  close(s.sd, 78.02936187666084);
  // Right skew: the grouped mean exceeds the interpolated median.
  assert.ok(s.mean > s.median);
});

test("empty drawings have no invented center or spread", () => {
  const s = groupedSummary([0, 0, 0], 0, 1);
  assert.equal(s.n, 0);
  assert.equal(s.mean, null);
  assert.equal(s.median, null);
  assert.deepEqual(s.modalBins, []);
});
test("doubling distances quadruples variance and doubles SD", () => {
  const d = [250, 275, 300, 325, 350, 375, 400],
    a = summarize(d),
    b = summarize(d.map((x) => 325 + 2 * (x - 325)));
  close(a.mean, b.mean);
  close(b.variance, 4 * a.variance);
  close(b.sd, 2 * a.sd);
  assert.equal(summarize(d.map(() => 325)).variance, 0);
});
test("composition reverses aggregate admission rates despite fixed within-department advantage", () => {
  const a = simpsonRates(90, 10);
  close(a.a, 73);
  close(a.b, 27);
  const b = simpsonRates(50, 50);
  close(b.a, 45);
  close(b.b, 55);
});

test("prediction explanations quote the synthetic table's own numbers", () => {
  assert.match(challenges.outlier.question, /5,000 to 800/);
  assert.match(challenges.outlier.explanation, /500 people/);
  assert.match(challenges.median.question, /200 villages/);
  assert.match(challenges.median.explanation, /Positions 100 and 101/);
});

const dir = new URL("../../public/learn/policy-statistics/", import.meta.url);
const read = (name) => readFileSync(new URL(name, dir), "utf8");

test("the lab cites no source lecture and labels its tables as synthetic", () => {
  for (const name of ["index.html", "lab.mjs", "stats.mjs", "challenges.mjs", "README.md"]) {
    const text = read(name);
    assert.doesNotMatch(text, /lecture|slide \d|September 2/i, `${name} still refers to a source lecture`);
  }
  assert.match(read("index.html"), /Every table on this page is synthetic/);
});

test("the lab stays unindexed, links back to the site, and promises only what it teaches", () => {
  const html = read("index.html");
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(html, /data-pagefind-ignore="all"/);
  assert.match(html, /<header>[\s\S]*href="\/"[\s\S]*<\/header>/);
  const footer = html.slice(html.indexOf("<footer>"), html.indexOf("</footer>"));
  assert.match(footer, /href="\/teaching\/"/);
  assert.match(footer, /href="\/book\/"/);
  assert.doesNotMatch(html, /regression|uncertainty/i);
});
