import test from "node:test";
import assert from "node:assert/strict";
import { checkPrediction } from "../../public/learn/policy-statistics/challenges.mjs";

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
  summarize,
  groupedSummary,
  groupedCounts,
  simpsonRates,
} from "../../public/learn/policy-statistics/stats.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("230 village population statistics match independently computed totals", () => {
  const d = villageData();
  const s = summarize(d);
  assert.equal(d.length, 230);
  assert.equal(s.total, 97400);
  close(s.mean, 97400 / 230);
  assert.equal(s.median, 450);
  assert.deepEqual(s.modes, [450]);
  close(s.variance, 75735500 / 230 - (97400 / 230) ** 2);
});
test("moving one village preserves the sample and leaves the median unchanged", () => {
  const s = summarize(villageData(600));
  assert.equal(s.n, 230);
  close(s.mean, 400);
  assert.equal(s.median, 450);
});
test("grouped slide estimates preserve counts and locate the median bin", () => {
  const s = groupedSummary(groupedCounts, 250, 25);
  assert.equal(s.n, 245);
  close(s.mean, 338.5204081632653);
  close(s.median, 339.77272727272725);
  assert.deepEqual(s.medianBin, [325, 350]);
  assert.deepEqual(s.modalBins, [[325, 350]]);
  close(s.sd, 41.94237533584614);
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
