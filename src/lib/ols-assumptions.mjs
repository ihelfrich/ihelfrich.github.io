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
 * while staying honest about it, and A7 skews the errors without inflating the
 * size of the slope test.
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
  /**
   * A1. Truth curves; we fit a line. Omitted x^2 is correlated with x.
   *
   * The relationship is concave, y = 1 + x - c x^2 with c = 0.5 * strength, so
   * the marginal effect 1 - 2cx falls as x rises and never turns negative on
   * [0, 1]: the first dollar does the most, the last at full curvature does
   * nothing. With x uniform on [0, 1], Cov(x, x^2) / Var(x) = 1, so the OLS
   * slope converges to 1 - c. That is the average marginal effect E[1 - 2cx],
   * and it differs from the linear-term coefficient by exactly -c.
   */
  specification(rng, n, strength) {
    const curvature = 0.5 * strength;
    const xs = [];
    const ys = [];
    for (let i = 0; i < n; i += 1) {
      const x = rng();
      xs.push(x);
      ys.push(1 + TRUE_B1 * x - curvature * x * x + 0.25 * standardNormal(rng));
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
  const reps = result.reps ?? 500;
  const gap = Math.abs(result.bias).toFixed(2);
  const direction = result.bias < 0 ? "below" : "above";
  const times = (value) => `${value.toFixed(value < 2 ? 2 : 1)}×`;
  const seName = robust ? "robust standard error" : "reported standard error";

  const centre =
    biasInSes < 0.5
      ? { state: "clean", label: "On target", detail: "the estimate centres on the truth" }
      : biasInSes < 2
        ? { state: "warn", label: "Drifting", detail: `average ${gap} ${direction} the truth` }
        : { state: "broken", label: "Off target", detail: `average ${gap} ${direction} the truth` };

  /**
   * The ratio is the actual spread of the estimates over the average reported
   * standard error. Above one, the regression claims more precision than it has.
   */
  const honesty =
    ratio < 0.87
      ? { state: "warn", label: "Cautious", detail: `reported error is ${times(1 / ratio)} the actual spread` }
      : ratio < 1.15
        ? { state: "clean", label: "Honest", detail: "the reported error matches the real spread" }
        : ratio < 1.5
          ? { state: "warn", label: "Optimistic", detail: `actual spread is ${times(ratio)} the reported error` }
          : { state: "broken", label: "Overconfident", detail: `actual spread is ${times(ratio)} the reported error` };

  const sizeDetail = `${(size * 100).toFixed(0)}% across all ${reps} samples, against a promised 5%`;
  const sizeVerdict =
    size <= 0.08
      ? { state: "clean", label: "Test holds", detail: sizeDetail }
      : size < 0.2
        ? { state: "warn", label: "Test slipping", detail: sizeDetail }
        : { state: "broken", label: "Test lies", detail: sizeDetail };

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
  const missed = `${misses} of the hundred intervals drawn ${misses === 1 ? "misses" : "miss"}`;
  const sizeClause =
    sizeVerdict.state === "clean"
      ? `Even so, the test rejects the true null in ${(size * 100).toFixed(0)}% of the ${reps} samples, so it keeps its size, and ${missed} the truth.`
      : `${missed[0].toUpperCase()}${missed.slice(1)} the truth they were built to cover, and the test rejects the true null in ${(size * 100).toFixed(0)}% of the ${reps} samples.`;

  /**
   * The sentence must never contradict a chip: it calls the estimate centred
   * only when the centre reading is clean, and it calls all three readings
   * clean only when they are.
   */
  const rejection = `The test rejects the true null in ${(size * 100).toFixed(0)}% of the ${reps} samples, against a promised 5%.`;
  let reading;
  if (centre.state === "broken") {
    reading = `The average estimate sits ${gap} ${direction} the true coefficient. No correction to the standard error can bring it back, because the coefficient is now answering a different question. ${rejection}`;
  } else if (centre.state === "warn") {
    reading = `The average estimate has drifted ${gap} ${direction} the true coefficient, about ${biasInSes.toFixed(1)} times the ${seName}. A larger sample shrinks the standard error but not this gap. ${rejection}`;
  } else if (honesty.state !== "clean" && ratio > 1) {
    reading = `The estimate is centred, but the estimates actually spread ${times(ratio)} as far as the average ${seName} claims. ${sizeClause}`;
  } else if (honesty.state !== "clean") {
    reading = `The estimate is centred, and the average ${seName} is ${times(1 / ratio)} the actual spread, so the intervals are wider than they need to be. ${sizeClause}`;
  } else if (sizeVerdict.state !== "clean") {
    reading = `The estimate is centred and the standard error is close, yet ${missed} the truth, and the test rejects the true null in ${(size * 100).toFixed(0)}% of the ${reps} samples.`;
  } else {
    /**
     * The hundred drawn intervals are a sample: under exact 95% coverage the
     * miss count is Binomial(100, 0.05), and 0 or 10 misses both occur. The
     * sentence states the promise as an average so it holds for any count.
     */
    reading = `All three readings are clean. The estimate centres on the truth, the reported uncertainty matches the real spread, and the test rejects the true null in ${(size * 100).toFixed(0)}% of the ${reps} samples, against a promised 5%. ${missed[0].toUpperCase()}${missed.slice(1)} the truth; 95% coverage means five misses per hundred on average, and the count in any particular hundred varies around that figure.`;
  }

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

/**
 * Tick values at round numbers inside [min, max]: the largest step of 1, 2,
 * 2.5 or 5 times a power of ten that still yields at least `target` ticks.
 */
export function niceTicks(min, max, target = 4) {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const top = 10 ** Math.ceil(Math.log10(span));
  for (let power = top; power > top / 1e4; power /= 10) {
    for (const multiple of [5, 2.5, 2, 1]) {
      const step = multiple * power;
      const first = Math.ceil(min / step - 1e-9);
      const last = Math.floor(max / step + 1e-9);
      if (last - first + 1 < target) continue;
      const ticks = [];
      for (let k = first; k <= last; k += 1) ticks.push(k === 0 ? 0 : Number((k * step).toFixed(10)));
      return ticks;
    }
  }
  return [min, max];
}

/** Advance width of the monospaced data face (Geist Mono): 0.6 em per character. */
function textWidth(text, size, tracking = 0) {
  return String(text).length * size * (0.6 + tracking);
}

/** Keep a label inside [lo, hi]: centred on x where it fits, otherwise flush to the nearer edge. */
function placeLabel(x, width, lo, hi) {
  if (x - width / 2 < lo) return { x: lo, anchor: "start" };
  if (x + width / 2 > hi) return { x: hi, anchor: "end" };
  return { x, anchor: "middle" };
}

const formatTick = (value) => {
  const text = Number(value.toFixed(2)).toString();
  return value < 0 ? `−${text.slice(1)}` : text;
};

/**
 * The lab figure as SVG markup, laid out for the width it will actually be
 * drawn at. The coordinate system is one unit per CSS pixel, so every label
 * renders at its stated size: 12px headings and flags, 11px ticks. Below 560
 * units the layout narrows: shorter headings, fewer ticks, and the miss count
 * on its own line. The narrowest layout, 240 units, is below the figure's
 * width on a 320px phone, so a phone never scales the text down.
 *
 * Returns the markup that goes inside the <svg>, the viewBox size, and the
 * number of drawn intervals that miss the truth.
 */
export const FIGURE_MIN_WIDTH = 240;
export function renderFigure(result, { domain, width = 720, robust = false } = {}) {
  const W = Math.round(Math.max(FIGURE_MIN_WIDTH, Math.min(1100, width)));
  const narrow = W < 560;
  const [dMin, dMax] = domain;
  const span = dMax - dMin;
  const L = 40;
  const R = W - 6;
  const size = { head: 12, tick: 11, flag: 12, span: 12 };
  const headTracking = 0.06;

  const y = {};
  y.head = 14;
  y.flagTruth = 34;
  y.flagMean = 50;
  y.distTop = 58;
  y.distBase = y.distTop + (narrow ? 96 : 128);
  y.tick = y.distBase + 16;
  y.actualBar = y.distBase + 36;
  y.actualLabel = y.actualBar + 18;
  y.reportedBar = y.actualLabel + 18;
  y.reportedLabel = y.reportedBar + 18;
  y.combHead = y.reportedLabel + 36;
  y.count = narrow ? y.combHead + 18 : y.combHead;
  y.combTop = y.count + 16;
  y.combBase = y.combTop + (narrow ? 168 : 216);
  y.legend = y.combBase + 24;

  const toX = (value) => L + ((value - dMin) / span) * (R - L);
  const clampX = (value) => Math.max(L, Math.min(R, toX(value)));
  const toY = (value) => y.combBase - Math.max(0, Math.min(1, (value - dMin) / span)) * (y.combBase - y.combTop);
  const n = (value) => Number(value.toFixed(2));
  const parts = [];
  const text = (x, yy, content, cls, anchor = "start") =>
    parts.push(`<text x="${n(x)}" y="${n(yy)}" class="${cls}"${anchor === "start" ? "" : ` text-anchor="${anchor}"`}>${content}</text>`);

  // Region A: where the estimates land.
  const headA = narrow ? `Where ${result.reps} estimates land` : "Where five hundred estimates land";
  text(0, y.head, headA, "lab-head");
  const bins = histogram(result.estimates, { min: dMin, max: dMax, bins: 40 });
  const binWidth = (R - L) / bins.counts.length;
  parts.push("<g>");
  bins.counts.forEach((count, index) => {
    const h = (count / bins.peak) * (y.distBase - y.distTop);
    if (h <= 0) return;
    parts.push(`<rect x="${n(L + index * binWidth)}" y="${n(y.distBase - h)}" width="${n(Math.max(1, binWidth - 1.2))}" height="${n(h)}" class="lab-bar"/>`);
  });
  parts.push("</g>");
  parts.push(`<line x1="${L}" x2="${R}" y1="${y.distBase}" y2="${y.distBase}" class="lab-axis"/>`);
  const ticks = niceTicks(dMin, dMax, narrow ? 3 : 4);
  for (const tick of ticks) {
    parts.push(`<line x1="${n(toX(tick))}" x2="${n(toX(tick))}" y1="${y.distBase}" y2="${y.distBase + 4}" class="lab-axis"/>`);
    const label = placeLabel(toX(tick), textWidth(formatTick(tick), size.tick), 0, W);
    text(label.x, y.tick, formatTick(tick), "lab-axis-tick", label.anchor);
  }

  const truthX = clampX(result.trueB1);
  const meanX = clampX(result.meanB1);
  parts.push(`<line x1="${n(truthX)}" x2="${n(truthX)}" y1="${y.flagTruth + 5}" y2="${y.distBase + 6}" class="lab-truth"/>`);
  parts.push(`<line x1="${n(meanX)}" x2="${n(meanX)}" y1="${y.flagMean + 5}" y2="${y.distBase}" class="lab-mean"/>`);
  const truthText = `true β₁ = ${formatTick(result.trueB1)}`;
  const truthFlag = placeLabel(truthX, textWidth(truthText, size.flag), 0, W);
  text(truthFlag.x, y.flagTruth, truthText, "lab-flag lab-flag--truth", truthFlag.anchor);
  const meanFlag = placeLabel(meanX, textWidth("average", size.flag), 0, W);
  text(meanFlag.x, y.flagMean, "average", "lab-flag lab-flag--mean", meanFlag.anchor);

  const reportedSe = robust ? result.meanRobustSe : result.meanReportedSe;
  // A span label starts under the plot when it fits there, and at the left edge when it does not.
  const spanLabelX = (content) => (L + textWidth(content, size.span) <= W ? L : 0);
  parts.push(`<line x1="${n(clampX(result.trueB1 - result.sdB1))}" x2="${n(clampX(result.trueB1 + result.sdB1))}" y1="${y.actualBar}" y2="${y.actualBar}" class="lab-span lab-span--actual"/>`);
  const actualText = `${narrow ? "actual spread" : "how far estimates really move:"} ±${result.sdB1.toFixed(3)}`;
  text(spanLabelX(actualText), y.actualLabel, actualText, "lab-span-label lab-span-label--actual");
  parts.push(`<line x1="${n(clampX(result.trueB1 - reportedSe))}" x2="${n(clampX(result.trueB1 + reportedSe))}" y1="${y.reportedBar}" y2="${y.reportedBar}" class="lab-span lab-span--reported"/>`);
  const reportedText = narrow
    ? `${robust ? "robust" : "reported"} standard error ±${reportedSe.toFixed(3)}`
    : `${robust ? "how far the robust standard error says they move" : "how far the regression says they move"}: ±${reportedSe.toFixed(3)}`;
  text(spanLabelX(reportedText), y.reportedLabel, reportedText, "lab-span-label lab-span-label--reported");

  // Region B: one hundred intervals, drawn inside their own band.
  const sorted = [...result.intervals].sort((a, b) => a.b1 - b.b1);
  let misses = 0;
  const pitch = (R - L) / Math.max(1, sorted.length);
  const stroke = Math.max(1.2, Math.min(4, pitch * 0.55));
  parts.push(`<g style="--lab-ci-width:${n(stroke)}px;--lab-ci-miss-width:${n(Math.min(5, stroke * 1.3))}px">`);
  sorted.forEach((interval, index) => {
    const half = interval.tcrit * (robust ? interval.seRobust : interval.se);
    const lo = interval.b1 - half;
    const hi = interval.b1 + half;
    const covers = lo <= result.trueB1 && hi >= result.trueB1;
    if (!covers) misses += 1;
    const x = L + (index + 0.5) * pitch;
    parts.push(`<line x1="${n(x)}" x2="${n(x)}" y1="${n(toY(lo))}" y2="${n(toY(hi))}" class="lab-ci${covers ? "" : " lab-ci--miss"}"/>`);
  });
  parts.push("</g>");
  parts.push(`<line x1="${L}" x2="${R}" y1="${n(toY(result.trueB1))}" y2="${n(toY(result.trueB1))}" class="lab-truth-rule"/>`);
  for (const tick of ticks) {
    text(L - 6, toY(tick) + 4, formatTick(tick), "lab-axis-tick", "end");
  }
  const combHead = `${sorted.length} intervals at 95%, one per study`;
  text(0, y.combHead, !narrow ? `One hundred 95% intervals, one per study` : textWidth(combHead, size.head, headTracking) <= W ? combHead : "95% intervals, one per study", "lab-head");
  text(narrow ? 0 : W, y.count, `${misses} of these ${sorted.length} miss`, "lab-head lab-head--count", narrow ? "start" : "end");

  // Legend under the band: what the rule is, what a miss looks like, and the
  // ordering. The items run left to right and wrap to a new line when the next
  // one would cross the frame. On a wide figure the ordering sits flush right.
  const ruleText = `the truth, β₁ = ${formatTick(result.trueB1)}`;
  const longOrder = "sorted by estimate, smallest to largest";
  const orderText = L + textWidth(longOrder, size.tick) <= R ? longOrder : "sorted by estimate";
  const items = [
    { width: 24 + textWidth(ruleText, size.tick), draw: (x, yy) => {
      parts.push(`<line x1="${n(x)}" x2="${n(x + 18)}" y1="${yy - 4}" y2="${yy - 4}" class="lab-truth-rule"/>`);
      text(x + 24, yy, ruleText, "lab-axis-tick");
    } },
    { width: 7 + textWidth("a miss", size.tick), draw: (x, yy) => {
      parts.push(`<line x1="${n(x)}" x2="${n(x)}" y1="${yy - 11}" y2="${yy + 2}" class="lab-ci lab-ci--miss" style="stroke-width:3px"/>`);
      text(x + 7, yy, "a miss", "lab-axis-tick");
    } },
    { width: textWidth(orderText, size.tick), order: true, draw: (x, yy, flush) => {
      if (flush) text(R, yy, orderText, "lab-axis-tick", "end");
      else text(x, yy, orderText, "lab-axis-tick");
    } },
  ];
  let legendX = L;
  let legendY = y.legend;
  for (const item of items) {
    if (legendX > L && legendX + item.width > R) {
      legendX = L;
      legendY += 18;
    }
    item.draw(legendX, legendY, item.order && legendX > L);
    legendX += item.width + 18;
  }
  const height = legendY + 8;

  return { width: W, height, markup: parts.join(""), misses };
}
