import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERATORS,
  fitOls1,
  fitOls2,
  histogram,
  makeRng,
  readVerdicts,
  runExperiment,
} from "../../src/lib/ols-assumptions.mjs";

/**
 * Fixture checked by hand.
 * Points (0,1), (1,2), (2,4), (3,5): mx = 1.5, Sxx = 5, Sxy = 7, so b1 = 1.4
 * and b0 = 0.9. Residuals are 0.1, -0.3, 0.3, -0.1, so SSE = 0.20 and s2 = 0.10.
 * Conventional slope SE is sqrt(0.02). The HC1 meat is 0.09, giving a robust SE
 * of sqrt(0.09 / 25 * 4 / 2) = sqrt(0.0072).
 */
test("simple OLS reproduces the hand-checked slope and both standard errors", () => {
  const fit = fitOls1([0, 1, 2, 3], [1, 2, 4, 5]);
  assert.ok(fit);
  assert.equal(fit.n, 4);
  assert.ok(Math.abs(fit.b1 - 1.4) < 1e-12, `b1 ${fit.b1}`);
  assert.ok(Math.abs(fit.b0 - 0.9) < 1e-12, `b0 ${fit.b0}`);
  assert.ok(Math.abs(fit.seConventional - Math.sqrt(0.02)) < 1e-12, `se ${fit.seConventional}`);
  assert.ok(Math.abs(fit.seHC1 - Math.sqrt(0.0072)) < 1e-12, `seHC1 ${fit.seHC1}`);
});

test("simple OLS refuses a sample with no variation in the regressor", () => {
  assert.equal(fitOls1([2, 2, 2, 2], [1, 2, 3, 4]), null);
  assert.equal(fitOls1([0, 1], [1, 2]), null);
});

/** Data lying exactly on 1 + 2*x1 + 3*x2 must return those coefficients with zero residual. */
test("two-regressor OLS recovers an exactly-determined plane", () => {
  const x1 = [0, 1, 0, 1, 2];
  const x2 = [0, 0, 1, 1, 1];
  const y = x1.map((value, index) => 1 + 2 * value + 3 * x2[index]);
  const fit = fitOls2(x1, x2, y);
  assert.ok(fit);
  assert.ok(Math.abs(fit.b1 - 2) < 1e-10, `b1 ${fit.b1}`);
  assert.ok(Math.abs(fit.b2 - 3) < 1e-10, `b2 ${fit.b2}`);
  assert.ok(Math.abs(fit.b0 - 1) < 1e-10, `b0 ${fit.b0}`);
  assert.ok(fit.seConventional < 1e-10, `se ${fit.seConventional}`);
});

test("two-regressor OLS refuses perfectly collinear regressors", () => {
  const x1 = [1, 2, 3, 4, 5];
  const x2 = x1.map((value) => 3 * value + 2);
  assert.equal(fitOls2(x1, x2, [2, 4, 6, 8, 11]), null);
});

test("the generator is deterministic and stays inside the unit interval", () => {
  const first = Array.from({ length: 6 }, makeRng(2026));
  const second = Array.from({ length: 6 }, makeRng(2026));
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, Array.from({ length: 6 }, makeRng(2027)));
  for (const draw of first) assert.ok(draw >= 0 && draw < 1, `draw ${draw}`);
});

test("every named assumption has a generator and an unknown one is rejected", () => {
  const expected = [
    "specification",
    "zeroMean",
    "exogeneity",
    "independence",
    "homoskedasticity",
    "noCollinearity",
    "normality",
  ];
  assert.deepEqual(Object.keys(GENERATORS).sort(), [...expected].sort());
  assert.throws(() => runExperiment({ assumption: "nope" }), RangeError);
});

test("with every assumption satisfied the estimator is unbiased and the test has its nominal size", () => {
  for (const assumption of Object.keys(GENERATORS)) {
    const result = runExperiment({ assumption, strength: 0, n: 60, reps: 3000 });
    assert.ok(Math.abs(result.bias) < 0.03, `${assumption} bias ${result.bias}`);
    assert.ok(Math.abs(result.seRatio - 1) < 0.12, `${assumption} sd/SE ${result.seRatio}`);
    assert.ok(Math.abs(result.sizeConventional - 0.05) < 0.025, `${assumption} size ${result.sizeConventional}`);
  }
});

/**
 * With x uniform on [0,1] the omitted square carries bias exactly equal to the
 * curvature, because Cov(x, x^2) and Var(x) are both 1/12.
 */
test("misspecification bias equals the omitted curvature", () => {
  const result = runExperiment({ assumption: "specification", strength: 1, n: 200, reps: 1500 });
  assert.ok(Math.abs(result.bias - 2.4) < 0.05, `bias ${result.bias}`);
  assert.ok(result.sizeConventional > 0.9, `size ${result.sizeConventional}`);
});

/** Omitted-variable bias is gamma * delta = 1.5 * 0.8 when the regressor is standardised. */
test("omitted-variable bias equals gamma times the regressor-confounder correlation", () => {
  const result = runExperiment({ assumption: "exogeneity", strength: 1, n: 200, reps: 1500 });
  assert.ok(Math.abs(result.bias - 1.2) < 0.05, `bias ${result.bias}`);
  assert.ok(result.sizeConventional > 0.9, `size ${result.sizeConventional}`);
});

test("a non-zero error mean moves nothing about the slope", () => {
  const held = runExperiment({ assumption: "zeroMean", strength: 0, n: 60, reps: 800 });
  const broken = runExperiment({ assumption: "zeroMean", strength: 1, n: 60, reps: 800 });
  assert.ok(Math.abs(broken.bias - held.bias) < 1e-9, `bias moved by ${broken.bias - held.bias}`);
  assert.ok(Math.abs(broken.meanReportedSe - held.meanReportedSe) < 1e-9);
  assert.equal(broken.sizeConventional, held.sizeConventional);
});

test("serial correlation leaves the slope unbiased, wrecks the standard error, and resists HC1", () => {
  const result = runExperiment({ assumption: "independence", strength: 1, n: 60, reps: 3000 });
  assert.ok(Math.abs(result.bias) < 0.05, `bias ${result.bias}`);
  assert.ok(result.seRatio > 3, `sd/SE ${result.seRatio}`);
  assert.ok(result.sizeConventional > 0.4, `size ${result.sizeConventional}`);
  // The heteroskedasticity-robust fix is the wrong tool here; it must not rescue it.
  assert.ok(result.sizeRobust > 0.4, `robust size ${result.sizeRobust}`);
});

test("heteroskedasticity leaves the slope unbiased, inflates size, and is largely repaired by HC1", () => {
  const result = runExperiment({ assumption: "homoskedasticity", strength: 1, n: 60, reps: 3000 });
  assert.ok(Math.abs(result.bias) < 0.05, `bias ${result.bias}`);
  assert.ok(result.seRatio > 1.3, `sd/SE ${result.seRatio}`);
  assert.ok(result.sizeConventional > 0.15, `size ${result.sizeConventional}`);
  assert.ok(result.sizeRobust < result.sizeConventional / 2, `robust size ${result.sizeRobust}`);
});

test("near-collinearity destroys precision while the reported standard error stays honest", () => {
  const held = runExperiment({ assumption: "noCollinearity", strength: 0, n: 60, reps: 3000 });
  const broken = runExperiment({ assumption: "noCollinearity", strength: 1, n: 60, reps: 3000 });
  assert.ok(Math.abs(broken.bias) < 0.05, `bias ${broken.bias}`);
  assert.ok(broken.sdB1 > held.sdB1 * 5, `spread ${held.sdB1} -> ${broken.sdB1}`);
  // The defining contrast: the standard error grows with the true spread, so size holds.
  assert.ok(Math.abs(broken.seRatio - 1) < 0.1, `sd/SE ${broken.seRatio}`);
  assert.ok(Math.abs(broken.sizeConventional - 0.05) < 0.025, `size ${broken.sizeConventional}`);
});

/**
 * The measured result that contradicts the intuition: badly non-normal errors
 * never inflate the size of a two-sided slope test, at any sample size shown.
 */
test("non-normal errors never inflate the size of a slope test", () => {
  for (const n of [10, 20, 60, 120]) {
    const result = runExperiment({ assumption: "normality", strength: 1, n, reps: 3000 });
    assert.ok(Math.abs(result.bias) < 0.12, `n=${n} bias ${result.bias}`);
    assert.ok(result.sizeConventional <= 0.07, `n=${n} size ${result.sizeConventional}`);
  }
});

test("the normality panel exposes error draws for the shape comparison", () => {
  const result = runExperiment({ assumption: "normality", strength: 1, n: 60, reps: 100 });
  assert.ok(result.errorDraws.length > 0);
  assert.ok(result.sample.xs.length === 60);
  // Lognormal errors are right-skewed: the mean sits above the median.
  const sorted = [...result.errorDraws].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  assert.ok(median < 0, `median ${median} should sit below the zero mean`);
});

test("histogram bins on a fixed domain and reports a usable peak", () => {
  const { counts, peak, width } = histogram([0, 0.5, 0.5, 0.99, -5, 5], { min: 0, max: 1, bins: 2 });
  assert.deepEqual(counts, [1, 3]);
  assert.equal(peak, 3);
  assert.equal(width, 0.5);
  assert.equal(histogram([1], { min: 1, max: 1, bins: 4 }).peak, 0);
});

test("the three verdicts move independently of one another", () => {
  const clean = readVerdicts(runExperiment({ assumption: "homoskedasticity", strength: 0, n: 60, reps: 2000 }));
  assert.equal(clean.centre.state, "clean");
  assert.equal(clean.honesty.state, "clean");
  assert.equal(clean.size.state, "clean");

  // Heteroskedasticity: centred, dishonest, failing test.
  const hetero = readVerdicts(runExperiment({ assumption: "homoskedasticity", strength: 1, n: 60, reps: 2000 }));
  assert.equal(hetero.centre.state, "clean");
  assert.notEqual(hetero.honesty.state, "clean");
  assert.notEqual(hetero.size.state, "clean");

  // Collinearity: imprecise, yet honest about it, so the test still holds.
  const collinear = readVerdicts(runExperiment({ assumption: "noCollinearity", strength: 1, n: 60, reps: 2000 }));
  assert.equal(collinear.centre.state, "clean");
  assert.equal(collinear.honesty.state, "clean");
  assert.equal(collinear.size.state, "clean");

  // Omitted variables: off target, and no standard error can repair it.
  const omitted = readVerdicts(runExperiment({ assumption: "exogeneity", strength: 1, n: 60, reps: 2000 }));
  assert.equal(omitted.centre.state, "broken");
  assert.match(omitted.reading, /answering a different question/);
});

test("robust standard errors change the verdict for heteroskedasticity but not for serial correlation", () => {
  // HC1 is an asymptotic correction, so at n = 60 it improves the test without
  // fully restoring nominal size. The verdict must say so rather than flatter it.
  const hetero = runExperiment({ assumption: "homoskedasticity", strength: 1, n: 60, reps: 2000 });
  assert.equal(readVerdicts(hetero, { robust: false }).size.state, "broken");
  assert.equal(readVerdicts(hetero, { robust: true }).size.state, "warn");
  assert.ok(readVerdicts(hetero, { robust: true }).misses < readVerdicts(hetero, { robust: false }).misses);

  const serial = runExperiment({ assumption: "independence", strength: 1, n: 60, reps: 2000 });
  assert.equal(readVerdicts(serial, { robust: false }).size.state, "broken");
  assert.equal(readVerdicts(serial, { robust: true }).size.state, "broken");
});

test("the experiment keeps one hundred whole samples so intervals can be drawn", () => {
  const result = runExperiment({ assumption: "homoskedasticity", strength: 0, n: 60, reps: 500 });
  assert.equal(result.intervals.length, 100);
  for (const interval of result.intervals) {
    assert.ok(interval.se > 0 && interval.seRobust > 0 && interval.tcrit > 1.9);
  }
  // Counting the intervals that miss must agree with the rejection rate: they are the same test.
  const misses = result.intervals.filter((i) => {
    const half = i.tcrit * i.se;
    return i.b1 - half > result.trueB1 || i.b1 + half < result.trueB1;
  }).length;
  assert.ok(Math.abs(misses / 100 - result.sizeConventional) < 0.06, `misses ${misses} vs size ${result.sizeConventional}`);
});
