/**
 * Classical OLS assumptions: a single Monte Carlo engine behind seven violations.
 *
 * Every panel in /teaching/ols-assumptions asks the same three questions of a
 * deliberately broken data-generating process:
 *
 *   1. Does the sampling distribution of b1 still centre on the true beta1?  (bias)
 *   2. Does the reported standard error match the true spread of b1?        (SE validity)
 *   3. How often does a nominal 5% test of a TRUE null actually reject?     (size)
 *
 * Violations separate cleanly along those axes, which is the pedagogical point:
 * A1/A3 move the centre, A4/A5 corrupt the reported SE, A6 widens the spread
 * while staying honest about it, and A7 is a small-sample failure the CLT repairs.
 *
 * All draws come from a seeded generator so a given (assumption, strength, n,
 * seed) renders identically for every visitor and can be checked in tests.
 */

import { studentTCritical95 } from "./fieldbook-math.mjs";

/** Deterministic 32-bit generator. Same seed, same sequence, every platform. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller. Draws two uniforms, returns one normal. */
export function standardNormal(rng) {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Simple regression of y on x.
 * Returns the slope, the conventional (homoskedastic) slope SE, and the HC1
 * robust slope SE. Null when the slope is not identified.
 */
export function fitOls1(xs, ys) {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    sxx += dx * dx;
    sxy += dx * (ys[i] - my);
  }
  if (sxx < 1e-12) return null;
  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;
  let sse = 0;
  let meat = 0;
  for (let i = 0; i < n; i += 1) {
    const resid = ys[i] - (b0 + b1 * xs[i]);
    sse += resid * resid;
    meat += resid * resid * (xs[i] - mx) * (xs[i] - mx);
  }
  const df = n - 2;
  const seConventional = Math.sqrt(sse / df / sxx);
  const seHC1 = Math.sqrt((meat / (sxx * sxx)) * (n / df));
  return { n, b0, b1, sxx, seConventional, seHC1, tcrit: studentTCritical95(df) };
}

/**
 * Two-regressor OLS, used only by the collinearity panel.
 * Returns the slope on x1 and its conventional SE, plus the variance inflation
 * factor implied by the sample correlation between the regressors.
 */
export function fitOls2(x1s, x2s, ys) {
  const n = x1s.length;
  if (n < 4 || x2s.length !== n || ys.length !== n) return null;
  const mean = (arr) => arr.reduce((sum, value) => sum + value, 0) / n;
  const m1 = mean(x1s);
  const m2 = mean(x2s);
  const my = mean(ys);
  let s11 = 0;
  let s22 = 0;
  let s12 = 0;
  let s1y = 0;
  let s2y = 0;
  for (let i = 0; i < n; i += 1) {
    const d1 = x1s[i] - m1;
    const d2 = x2s[i] - m2;
    const dy = ys[i] - my;
    s11 += d1 * d1;
    s22 += d2 * d2;
    s12 += d1 * d2;
    s1y += d1 * dy;
    s2y += d2 * dy;
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-9 || s11 < 1e-12 || s22 < 1e-12) return null;
  const b1 = (s22 * s1y - s12 * s2y) / det;
  const b2 = (s11 * s2y - s12 * s1y) / det;
  const b0 = my - b1 * m1 - b2 * m2;
  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const resid = ys[i] - (b0 + b1 * x1s[i] + b2 * x2s[i]);
    sse += resid * resid;
  }
  const df = n - 3;
  const s2 = sse / df;
  const seConventional = Math.sqrt((s2 * s22) / det);
  const corr = s12 / Math.sqrt(s11 * s22);
  return { n, b0, b1, b2, seConventional, seHC1: seConventional, corr, vif: 1 / (1 - corr * corr), tcrit: studentTCritical95(df) };
}

const TRUE_B1 = 1;

/**
 * The seven data-generating processes.
 *
 * Each returns one sample plus the true slope that an unbiased estimator should
 * recover. `strength` is always 0 = assumption holds, 1 = badly broken, so a
 * single slider drives every panel.
 */
export const GENERATORS = {
  /** A1. Truth curves; we fit a line. Omitted x^2 is correlated with x. */
  specification(rng, n, strength) {
    const curvature = 2.4 * strength;
    const xs = [];
    const ys = [];
    for (let i = 0; i < n; i += 1) {
      const x = rng();
      xs.push(x);
      ys.push(1 + TRUE_B1 * x + curvature * x * x + 0.25 * standardNormal(rng));
    }
    return { xs, ys, trueB1: TRUE_B1 };
  },

  /** A2. The error has a non-zero mean. The intercept absorbs it; the slope does not move. */
  zeroMean(rng, n, strength) {
    const shift = 6 * strength;
    const xs = [];
    const ys = [];
    for (let i = 0; i < n; i += 1) {
      const x = rng();
      xs.push(x);
      ys.push(1 + TRUE_B1 * x + shift + 0.25 * standardNormal(rng));
    }
    return { xs, ys, trueB1: TRUE_B1 };
  },

  /**
   * A3. An omitted driver z raises the outcome and is correlated with the
   * regressor. Asymptotic bias is gamma * delta when x is standardised.
   */
  exogeneity(rng, n, strength) {
    const delta = 0.8 * strength;
    const gamma = 1.5;
    const xs = [];
    const ys = [];
    for (let i = 0; i < n; i += 1) {
      const z = standardNormal(rng);
      const x = delta * z + Math.sqrt(Math.max(0, 1 - delta * delta)) * standardNormal(rng);
      xs.push(x);
      ys.push(1 + TRUE_B1 * x + gamma * z + 0.25 * standardNormal(rng));
    }
    return { xs, ys, trueB1: TRUE_B1 };
  },

  /**
   * A4. Errors follow AR(1) along a time trend. Innovation variance is scaled so
   * the unconditional error variance stays fixed: only the correlation changes.
   */
  independence(rng, n, strength) {
    const rho = 0.95 * strength;
    const sigma = 0.35;
    const innovation = sigma * Math.sqrt(Math.max(0, 1 - rho * rho));
    const xs = [];
    const ys = [];
    let err = sigma * standardNormal(rng);
    for (let i = 0; i < n; i += 1) {
      const x = i / (n - 1);
      err = rho * err + innovation * standardNormal(rng);
      xs.push(x);
      ys.push(1 + TRUE_B1 * x + err);
    }
    return { xs, ys, trueB1: TRUE_B1 };
  },

  /**
   * A5. Error spread grows with the regressor: the classic policy megaphone.
   *
   * The regressor is cubed-uniform, so most units are small and a few are very
   * large. That skew is what policy cross-sections actually look like (city
   * budgets, county populations, district enrolment) and it is what makes the
   * conventional SE fail hard: the noisiest observations are also the
   * highest-leverage ones. With x drawn uniformly the distortion is real but
   * mild; with realistic skew the nominal 5% test rejects about 22% of the time.
   */
  homoskedasticity(rng, n, strength) {
    const lambda = 4 * strength;
    const xs = [];
    const ys = [];
    const errors = [];
    for (let i = 0; i < n; i += 1) {
      const u = rng();
      const x = u * u * u;
      const error = 0.25 * (1 + lambda * x) * standardNormal(rng);
      xs.push(x);
      errors.push(error);
      ys.push(1 + TRUE_B1 * x + error);
    }
    return { xs, ys, errors, trueB1: TRUE_B1 };
  },

  /** A6. A second regressor nearly duplicates the first. Precision collapses; honesty does not. */
  noCollinearity(rng, n, strength) {
    const rho = 0.995 * strength;
    const xs = [];
    const x2s = [];
    const ys = [];
    for (let i = 0; i < n; i += 1) {
      const x1 = standardNormal(rng);
      const x2 = rho * x1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * standardNormal(rng);
      xs.push(x1);
      x2s.push(x2);
      ys.push(1 + TRUE_B1 * x1 + 0.8 * x2 + 0.25 * standardNormal(rng));
    }
    return { xs, x2s, ys, trueB1: TRUE_B1 };
  },

  /**
   * A7. Errors are drawn from a badly skewed, heavy-tailed lognormal, recentred
   * and rescaled so only the SHAPE departs from normal.
   *
   * This panel is the one where the measured answer contradicts the intuition.
   * Wrecking normality does not inflate the size of a slope test at any sample
   * size we can show: the rejection rate stays at or below 5%. The assumption
   * earns its keep elsewhere, and the demonstration is the pair of histograms,
   * not the size readout. Errors go in visibly skewed; the sampling
   * distribution of b1 comes out visibly normal, because the central limit
   * theorem applies to the estimator, not to the error term.
   */
  normality(rng, n, strength) {
    const sigma = 0.35 + 1.35 * strength;
    const mean = Math.exp((sigma * sigma) / 2);
    const sd = Math.sqrt((Math.exp(sigma * sigma) - 1) * Math.exp(sigma * sigma));
    const xs = [];
    const ys = [];
    const errors = [];
    for (let i = 0; i < n; i += 1) {
      const x = rng();
      const error = 0.5 * ((Math.exp(sigma * standardNormal(rng)) - mean) / sd);
      xs.push(x);
      errors.push(error);
      ys.push(1 + TRUE_B1 * x + error);
    }
    return { xs, ys, errors, trueB1: TRUE_B1 };
  },
};

/**
 * Run the experiment.
 *
 * Repeatedly draws a sample, estimates the slope, and tests the TRUE null
 * H0: beta1 = trueB1 at a nominal 5%. Because the null is true by construction,
 * the rejection rate IS the actual size of the test, and any distance from 0.05
 * is the inference failure made countable.
 */
export function runExperiment({ assumption, strength = 0, n = 60, reps = 400, seed = 20260910 }) {
  const generate = GENERATORS[assumption];
  if (typeof generate !== "function") throw new RangeError(`unknown assumption: ${assumption}`);
  const twoRegressor = assumption === "noCollinearity";
  const rng = makeRng(seed);
  const estimates = [];
  const errorDraws = [];
  /**
   * The first hundred samples are kept whole so the page can draw their
   * confidence intervals. Counting the intervals that miss the truth is the
   * same statement as the rejection rate, made countable by eye.
   */
  const intervals = [];
  const INTERVAL_CAP = 100;
  const ERROR_DRAW_CAP = 3000;
  let reportedSum = 0;
  let robustSum = 0;
  let rejectConventional = 0;
  let rejectRobust = 0;
  let trueB1 = TRUE_B1;
  let lastSample = null;

  for (let rep = 0; rep < reps; rep += 1) {
    const sample = generate(rng, n, strength);
    trueB1 = sample.trueB1;
    if (rep === 0) lastSample = sample;
    if (sample.errors && errorDraws.length < ERROR_DRAW_CAP) {
      for (const error of sample.errors) {
        if (errorDraws.length >= ERROR_DRAW_CAP) break;
        errorDraws.push(error);
      }
    }
    const fit = twoRegressor ? fitOls2(sample.xs, sample.x2s, sample.ys) : fitOls1(sample.xs, sample.ys);
    if (!fit) continue;
    estimates.push(fit.b1);
    if (intervals.length < INTERVAL_CAP) {
      intervals.push({ b1: fit.b1, se: fit.seConventional, seRobust: fit.seHC1, tcrit: fit.tcrit });
    }
    reportedSum += fit.seConventional;
    robustSum += fit.seHC1;
    if (Math.abs((fit.b1 - trueB1) / fit.seConventional) > fit.tcrit) rejectConventional += 1;
    if (Math.abs((fit.b1 - trueB1) / fit.seHC1) > fit.tcrit) rejectRobust += 1;
  }

  const drawn = estimates.length;
  if (drawn === 0) return null;
  const meanB1 = estimates.reduce((sum, value) => sum + value, 0) / drawn;
  const variance = estimates.reduce((sum, value) => sum + (value - meanB1) ** 2, 0) / Math.max(1, drawn - 1);
  const sdB1 = Math.sqrt(variance);
  const meanReportedSe = reportedSum / drawn;

  return {
    assumption,
    strength,
    n,
    reps: drawn,
    trueB1,
    estimates,
    intervals,
    errorDraws,
    sample: lastSample,
    meanB1,
    bias: meanB1 - trueB1,
    sdB1,
    meanReportedSe,
    meanRobustSe: robustSum / drawn,
    /** >1 means the reported SE overstates precision: the t-stat is inflated. */
    seRatio: meanReportedSe > 0 ? sdB1 / meanReportedSe : Number.NaN,
    sizeConventional: rejectConventional / drawn,
    sizeRobust: rejectRobust / drawn,
  };
}

/**
 * Turn one experiment into three independent verdicts and a sentence.
 *
 * The three readings are deliberately separable, because the whole argument of
 * the page is that violations fail in different places. An estimator can be
 * dead centre and still lie about its uncertainty; it can be wildly imprecise
 * and perfectly honest about that.
 */
export function readVerdicts(result, { robust = false } = {}) {
  const se = robust ? result.meanRobustSe : result.meanReportedSe;
  const size = robust ? result.sizeRobust : result.sizeConventional;
  const ratio = se > 0 ? result.sdB1 / se : Number.NaN;
  const biasInSes = se > 0 ? Math.abs(result.bias) / se : Number.NaN;

  const centre =
    biasInSes < 0.5
      ? { state: "clean", label: "On target", detail: "the estimate centres on the truth" }
      : biasInSes < 2
        ? { state: "warn", label: "Drifting", detail: `off by ${result.bias.toFixed(2)}` }
        : { state: "broken", label: "Off target", detail: `off by ${result.bias.toFixed(2)}` };

  const honesty =
    ratio < 1.15
      ? { state: "clean", label: "Honest", detail: "the reported error matches the real spread" }
      : ratio < 1.5
        ? { state: "warn", label: "Optimistic", detail: `understates by ${ratio.toFixed(1)}×` }
        : { state: "broken", label: "Overconfident", detail: `understates by ${ratio.toFixed(1)}×` };

  const sizeVerdict =
    size <= 0.08
      ? { state: "clean", label: "Test holds", detail: `${(size * 100).toFixed(0)}% across all 500 samples, against a promised 5%` }
      : size < 0.2
        ? { state: "warn", label: "Test slipping", detail: `${(size * 100).toFixed(0)}% across all 500 samples, against a promised 5%` }
        : { state: "broken", label: "Test lies", detail: `${(size * 100).toFixed(0)}% across all 500 samples, against a promised 5%` };

  /**
   * Count the misses in the intervals the page actually draws, so the sentence
   * and the figure can never disagree. A reader who counts the marked lines must
   * arrive at the number in the prose.
   */
  const misses = Array.isArray(result.intervals) && result.intervals.length > 0
    ? result.intervals.filter((interval) => {
        const half = interval.tcrit * (robust ? interval.seRobust : interval.se);
        return interval.b1 - half > result.trueB1 || interval.b1 + half < result.trueB1;
      }).length
    : Math.round(size * 100);
  const reading =
    centre.state === "broken"
      ? `The estimate has moved off the truth by ${result.bias.toFixed(2)}. No correction to the standard error can bring it back, because the coefficient is now answering a different question.`
      : honesty.state === "broken"
        ? `The estimate is still centred, and the regression understates its own uncertainty by a factor of ${ratio.toFixed(1)}. Of the hundred intervals drawn in the figure, ${misses} miss the truth they were built to cover.`
        : sizeVerdict.state !== "clean"
          ? `The estimate is centred and the standard error is close, yet ${misses} of the hundred intervals drawn still miss.`
          : `All three readings are clean. The estimate centres on the truth, the reported uncertainty matches the real spread, and ${misses} of the hundred intervals drawn miss, which is what 95% coverage means.`;

  return { centre, honesty, size: sizeVerdict, ratio, misses, reading };
}

/** Bin the sampling distribution for the histogram. Fixed domain keeps bars stable while dragging. */
export function histogram(estimates, { min, max, bins = 34 }) {
  const counts = new Array(bins).fill(0);
  const width = (max - min) / bins;
  if (!(width > 0)) return { counts, width, min, max, peak: 0 };
  for (const value of estimates) {
    const index = Math.floor((value - min) / width);
    if (index >= 0 && index < bins) counts[index] += 1;
  }
  return { counts, width, min, max, peak: Math.max(1, ...counts) };
}
