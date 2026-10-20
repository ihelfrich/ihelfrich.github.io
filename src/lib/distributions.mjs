// Probability distributions for the distribution lab: densities, distribution functions, quantiles, samplers,
// moments, fitting, and code that reproduces a draw in Python, R, Julia and Stata.
// Tested against R in tests/unit/distributions.test.mjs.
import {
  lgamma, gammaP, gammaQ, betaI, betaISf, normCdf, normSf, normPdf, normQuantile, solveIncreasing,
} from "./special-functions.mjs";

// ---------------------------------------------------------------- random numbers
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  let spare = null;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const open = () => 1 - next(); // in (0, 1]
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const r = Math.sqrt(-2 * Math.log(open()));
    const th = 2 * Math.PI * next();
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
  const gamma = (k) => {
    if (k < 1) return gamma(k + 1) * Math.pow(open(), 1 / k);
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x;
      let v;
      do {
        x = normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = open();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  return { next, open, normal, gamma };
}

// ---------------------------------------------------------------- helpers
const LN2 = Math.LN2;
const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
const isInt = (x) => Number.isInteger(x);

const chisqPdf = (x, k) => (x < 0 ? 0 : x === 0 ? (k < 2 ? Infinity : k === 2 ? 0.5 : 0) : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * LN2 - lgamma(k / 2)));
const chisqCdf = (x, k) => gammaP(k / 2, x / 2);
const fPdf = (x, d1, d2) => (x < 0 ? 0 : x === 0 ? (d1 < 2 ? Infinity : d1 === 2 ? 1 : 0)
  : Math.exp(lgamma((d1 + d2) / 2) - lgamma(d1 / 2) - lgamma(d2 / 2) + (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x) - ((d1 + d2) / 2) * Math.log(1 + (d1 * x) / d2)));
const fCdf = (x, d1, d2) => (x <= 0 ? 0 : betaI((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2));
const tPdf = (x, df) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (x * x) / df));
const tCdf = (x, df) => {
  const tail = 0.5 * betaI(df / (df + x * x), df / 2, 0.5);
  return x > 0 ? 1 - tail : tail;
};

function poissonWeights(mu) {
  // Weights exp(-mu) mu^j / j! for j = 0..J, with J far into the upper tail.
  const J = Math.ceil(mu + 14 * Math.sqrt(mu + 1) + 40);
  const w = new Array(J + 1);
  for (let j = 0; j <= J; j += 1) w[j] = Math.exp(-mu + j * Math.log(mu || 1e-300) - lgamma(j + 1));
  if (mu === 0) { w.fill(0); w[0] = 1; }
  return w;
}

function simpson(g, a, b, n = 4000) {
  const h = (b - a) / n;
  let s = g(a) + g(b);
  for (let i = 1; i < n; i += 1) s += g(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

// Non-central t via the representation T = (Z + delta) / sqrt(V / df), integrating over s = sqrt(V).
function chiDensityInS(s, df) {
  if (s === 0) return df === 1 ? Math.exp(LN2 - 0.5 * LN2 - lgamma(0.5)) : 0;
  return Math.exp(LN2 + (df - 1) * Math.log(s) - (s * s) / 2 - (df / 2) * LN2 - lgamma(df / 2));
}
function sRange(df) {
  const c = Math.sqrt(df);
  return [df < 50 ? 0 : Math.max(0, c - 10), c + 12];
}
const nctCdf = (t, df, delta) => {
  const [lo, hi] = sRange(df);
  return Math.min(1, Math.max(0, simpson((s) => chiDensityInS(s, df) * normCdf((t * s) / Math.sqrt(df) - delta), lo, hi)));
};
const nctPdf = (t, df, delta) => {
  const [lo, hi] = sRange(df);
  return simpson((s) => chiDensityInS(s, df) * normPdf((t * s) / Math.sqrt(df) - delta) * (s / Math.sqrt(df)), lo, hi);
};

const nchisqPdf = (x, k, lam) => poissonWeights(lam / 2).reduce((acc, w, j) => acc + w * chisqPdf(x, k + 2 * j), 0);
const nchisqCdf = (x, k, lam) => poissonWeights(lam / 2).reduce((acc, w, j) => acc + w * chisqCdf(x, k + 2 * j), 0);
const nfPdf = (x, d1, d2, lam) => poissonWeights(lam / 2).reduce((acc, w, j) => {
  const m = d1 + 2 * j;
  return acc + w * (d1 / m) * fPdf((x * d1) / m, m, d2);
}, 0);
const nfCdf = (x, d1, d2, lam) => poissonWeights(lam / 2).reduce((acc, w, j) => acc + w * fCdf((x * d1) / (d1 + 2 * j), d1 + 2 * j, d2), 0);

// Discrete helpers
function quantileDiscrete(cdf, u, minimum = 0) {
  if (u <= 0) return minimum;
  if (u >= 1) return Infinity;
  const target = u * (1 - 64 * Number.EPSILON);
  let hi = minimum + 1;
  while (cdf(hi) < target && hi < 1e9) hi *= 2;
  let lo = minimum;
  if (cdf(lo) >= target) return lo;
  while (hi - lo > 1) {
    const m = Math.floor((lo + hi) / 2);
    if (cdf(m) >= target) hi = m;
    else lo = m;
  }
  return hi;
}

function poissonSample(rng, mu) {
  if (mu >= 30) {
    // Exact decomposition: Poisson(mu) = m + Poisson(mu - G) when G ~ Gamma(m) < mu, else Binomial(m - 1, mu / G).
    const m = Math.floor(0.875 * mu);
    const g = rng.gamma(m);
    if (g < mu) return m + poissonSample(rng, mu - g);
    return binomialSample(rng, m - 1, mu / g);
  }
  const L = Math.exp(-mu);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

function binomialSample(rng, n, p) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= 60) {
    let k = 0;
    for (let i = 0; i < n; i += 1) if (rng.next() < p) k += 1;
    return k;
  }
  // Beta splitting: exact recursion on the order statistic.
  const a = 1 + Math.floor(n / 2);
  const b = n + 1 - a;
  const ga = rng.gamma(a);
  const gb = rng.gamma(b);
  const x = ga / (ga + gb);
  if (x >= p) return binomialSample(rng, a - 1, p / x);
  return a + binomialSample(rng, b - 1, (p - x) / (1 - x));
}

// ---------------------------------------------------------------- catalogue
const P = (id, label, symbol, min, max, step, value, extra = {}) => ({ id, label, symbol, min, max, step, value, ...extra });
const fmt = (x) => String(Number(x.toPrecision(10)));

const D = {};
const add = (d) => { D[d.id] = d; };

add({
  id: "normal", name: "Normal", group: "Continuous, symmetric", kind: "continuous",
  params: [P("mu", "Mean", "μ", -10, 10, 0.1, 0), P("sigma", "Standard deviation", "σ", 0.1, 5, 0.05, 1)],
  formula: "f(x) = exp(−(x−μ)²/2σ²) / (σ√2π)", trim: 0.0005,
  pdf: (x, p) => normPdf((x - p.mu) / p.sigma) / p.sigma,
  cdf: (x, p) => normCdf((x - p.mu) / p.sigma),
  quantile: (u, p) => p.mu + p.sigma * normQuantile(u),
  sample: (rng, p) => p.mu + p.sigma * rng.normal(),
  mean: (p) => p.mu, variance: (p) => p.sigma ** 2,
  note: "Sums of many small independent contributions are approximately normal. Standardizing gives the z-score.",
});

add({
  id: "t", name: "Student t", group: "Continuous, symmetric", kind: "continuous",
  params: [P("df", "Degrees of freedom", "ν", 1, 100, 0.5, 5)],
  formula: "T = Z / √(χ²ν / ν)", trim: 0.003, bounds: [-Infinity, Infinity],
  pdf: (x, p) => tPdf(x, p.df), cdf: (x, p) => tCdf(x, p.df),
  quantile: (u, p) => solveIncreasing((x) => tCdf(x, p.df), u, -2, 2),
  sample: (rng, p) => rng.normal() / Math.sqrt((2 * rng.gamma(p.df / 2)) / p.df),
  mean: (p) => (p.df > 1 ? 0 : NaN),
  variance: (p) => (p.df > 2 ? p.df / (p.df - 2) : p.df > 1 ? Infinity : NaN),
  note: "Heavier tails than the normal because the scale is estimated. As ν grows the t approaches the normal; with ν = 1 it is the Cauchy.",
});

add({
  id: "nct", name: "Non-central t", group: "Continuous, test statistics", kind: "continuous",
  params: [P("df", "Degrees of freedom", "ν", 1, 100, 0.5, 10), P("delta", "Non-centrality", "δ", -6, 6, 0.1, 1.5)],
  formula: "T = (Z + δ) / √(χ²ν / ν)", trim: 0.003,
  pdf: (x, p) => nctPdf(x, p.df, p.delta), cdf: (x, p) => nctCdf(x, p.df, p.delta),
  quantile: (u, p) => solveIncreasing((x) => nctCdf(x, p.df, p.delta), u, -2, 2 + Math.abs(p.delta)),
  sample: (rng, p) => (rng.normal() + p.delta) / Math.sqrt((2 * rng.gamma(p.df / 2)) / p.df),
  mean: (p) => (p.df > 1 ? p.delta * Math.sqrt(p.df / 2) * Math.exp(lgamma((p.df - 1) / 2) - lgamma(p.df / 2)) : NaN),
  variance(p) {
    if (p.df <= 2) return p.df > 1 ? Infinity : NaN;
    const m = this.mean(p);
    return (p.df * (1 + p.delta ** 2)) / (p.df - 2) - m * m;
  },
  note: "The distribution of a t statistic when the true mean is δ standard errors from the null. Its upper tail beyond the critical value is the power of the test.",
});

add({
  id: "chisq", name: "Chi-square", group: "Continuous, test statistics", kind: "continuous",
  params: [P("k", "Degrees of freedom", "k", 1, 60, 1, 4, { integer: true })],
  formula: "χ²k = Z₁² + … + Z²k", trim: 0.0005, bounds: [0, Infinity],
  pdf: (x, p) => chisqPdf(x, p.k), cdf: (x, p) => chisqCdf(x, p.k),
  quantile: (u, p) => solveIncreasing((x) => chisqCdf(x, p.k), u, 0, p.k + 5, [0, Infinity]),
  sample: (rng, p) => 2 * rng.gamma(p.k / 2),
  mean: (p) => p.k, variance: (p) => 2 * p.k,
  note: "The sum of k squared independent standard normals. It governs variance tests, goodness-of-fit tests, and Wald and likelihood-ratio statistics.",
});

add({
  id: "nchisq", name: "Non-central chi-square", group: "Continuous, test statistics", kind: "continuous",
  params: [P("k", "Degrees of freedom", "k", 1, 60, 1, 4, { integer: true }), P("lambda", "Non-centrality", "λ", 0, 60, 0.5, 6)],
  formula: "Σ (Zᵢ + μᵢ)², λ = Σ μᵢ²", trim: 0.0005, bounds: [0, Infinity],
  pdf: (x, p) => nchisqPdf(x, p.k, p.lambda), cdf: (x, p) => nchisqCdf(x, p.k, p.lambda),
  quantile: (u, p) => solveIncreasing((x) => nchisqCdf(x, p.k, p.lambda), u, 0, p.k + p.lambda + 5, [0, Infinity]),
  sample(rng, p) {
    let s = 0;
    const a = Math.sqrt(p.lambda);
    s += (rng.normal() + a) ** 2;
    if (p.k > 1) s += 2 * rng.gamma((p.k - 1) / 2);
    return s;
  },
  mean: (p) => p.k + p.lambda, variance: (p) => 2 * (p.k + 2 * p.lambda),
  note: "The Wald or likelihood-ratio statistic when the null is false by an amount λ. The area beyond the central χ² critical value is the power.",
});

add({
  id: "f", name: "F", group: "Continuous, test statistics", kind: "continuous",
  params: [P("d1", "Numerator df", "d₁", 1, 60, 1, 5, { integer: true }), P("d2", "Denominator df", "d₂", 1, 200, 1, 12, { integer: true })],
  formula: "F = (χ²d₁ / d₁) / (χ²d₂ / d₂)", trim: 0.003, bounds: [0, Infinity],
  pdf: (x, p) => fPdf(x, p.d1, p.d2), cdf: (x, p) => fCdf(x, p.d1, p.d2),
  quantile: (u, p) => solveIncreasing((x) => fCdf(x, p.d1, p.d2), u, 0, 4, [0, Infinity]),
  sample: (rng, p) => (rng.gamma(p.d1 / 2) / p.d1) / (rng.gamma(p.d2 / 2) / p.d2),
  mean: (p) => (p.d2 > 2 ? p.d2 / (p.d2 - 2) : NaN),
  variance: (p) => (p.d2 > 4 ? (2 * p.d2 ** 2 * (p.d1 + p.d2 - 2)) / (p.d1 * (p.d2 - 2) ** 2 * (p.d2 - 4)) : p.d2 > 2 ? Infinity : NaN),
  note: "The ratio of two scaled chi-squares. It tests joint restrictions in regression and compares variances. With d₁ = 1 it is the square of a t.",
});

add({
  id: "nf", name: "Non-central F", group: "Continuous, test statistics", kind: "continuous",
  params: [P("d1", "Numerator df", "d₁", 1, 60, 1, 4, { integer: true }), P("d2", "Denominator df", "d₂", 1, 200, 1, 20, { integer: true }), P("lambda", "Non-centrality", "λ", 0, 60, 0.5, 6)],
  formula: "F′ = (χ²′d₁(λ) / d₁) / (χ²d₂ / d₂)", trim: 0.003, bounds: [0, Infinity],
  pdf: (x, p) => nfPdf(x, p.d1, p.d2, p.lambda), cdf: (x, p) => nfCdf(x, p.d1, p.d2, p.lambda),
  quantile: (u, p) => solveIncreasing((x) => nfCdf(x, p.d1, p.d2, p.lambda), u, 0, 4, [0, Infinity]),
  sample(rng, p) {
    const num = (rng.normal() + Math.sqrt(p.lambda)) ** 2 + (p.d1 > 1 ? 2 * rng.gamma((p.d1 - 1) / 2) : 0);
    return (num / p.d1) / ((2 * rng.gamma(p.d2 / 2)) / p.d2);
  },
  mean: (p) => (p.d2 > 2 ? (p.d2 * (p.d1 + p.lambda)) / (p.d1 * (p.d2 - 2)) : NaN),
  variance: (p) => (p.d2 > 4 ? 2 * (p.d2 / p.d1) ** 2 * (((p.d1 + p.lambda) ** 2 + (p.d1 + 2 * p.lambda) * (p.d2 - 2)) / ((p.d2 - 2) ** 2 * (p.d2 - 4))) : NaN),
  note: "The F statistic when the restrictions are false. The area beyond the central F critical value is the power of the joint test.",
});

add({
  id: "exponential", name: "Exponential", group: "Continuous, positive", kind: "continuous",
  params: [P("rate", "Rate", "λ", 0.05, 5, 0.05, 1)],
  formula: "f(x) = λ exp(−λx)", trim: 0.001, bounds: [0, Infinity],
  pdf: (x, p) => (x < 0 ? 0 : p.rate * Math.exp(-p.rate * x)), cdf: (x, p) => (x <= 0 ? 0 : 1 - Math.exp(-p.rate * x)),
  quantile: (u, p) => -Math.log(1 - u) / p.rate,
  sample: (rng, p) => -Math.log(rng.open()) / p.rate,
  mean: (p) => 1 / p.rate, variance: (p) => 1 / p.rate ** 2,
  note: "Waiting time with a constant hazard. It has no memory: the time still to wait does not depend on the time already waited.",
});

add({
  id: "gamma", name: "Gamma", group: "Continuous, positive", kind: "continuous",
  params: [P("shape", "Shape", "k", 0.2, 20, 0.1, 2.5), P("scale", "Scale", "θ", 0.1, 5, 0.05, 1.5)],
  formula: "f(x) = x^(k−1) exp(−x/θ) / (Γ(k) θ^k)", trim: 0.0005, bounds: [0, Infinity],
  pdf: (x, p) => (x < 0 ? 0 : x === 0 ? (p.shape < 1 ? Infinity : p.shape === 1 ? 1 / p.scale : 0) : Math.exp((p.shape - 1) * Math.log(x) - x / p.scale - lgamma(p.shape) - p.shape * Math.log(p.scale))),
  cdf: (x, p) => gammaP(p.shape, x / p.scale),
  quantile: (u, p) => solveIncreasing((x) => gammaP(p.shape, x / p.scale), u, 0, p.shape * p.scale + 5, [0, Infinity]),
  sample: (rng, p) => p.scale * rng.gamma(p.shape),
  mean: (p) => p.shape * p.scale, variance: (p) => p.shape * p.scale ** 2,
  note: "The sum of k independent exponential waiting times when k is an integer. Flexible for positive, right-skewed quantities.",
});

add({
  id: "beta", name: "Beta", group: "Continuous, bounded", kind: "continuous",
  params: [P("a", "Shape a", "a", 0.2, 20, 0.1, 2), P("b", "Shape b", "b", 0.2, 20, 0.1, 5)],
  formula: "f(x) ∝ x^(a−1) (1−x)^(b−1)", trim: 0, bounds: [0, 1], fixedRange: [0, 1],
  pdf: (x, p) => (x < 0 || x > 1 ? 0 : x === 0 ? (p.a < 1 ? Infinity : p.a === 1 ? p.b : 0) : x === 1 ? (p.b < 1 ? Infinity : p.b === 1 ? p.a : 0)
    : Math.exp(lgamma(p.a + p.b) - lgamma(p.a) - lgamma(p.b) + (p.a - 1) * Math.log(x) + (p.b - 1) * Math.log(1 - x))),
  cdf: (x, p) => betaI(x, p.a, p.b),
  quantile: (u, p) => solveIncreasing((x) => betaI(x, p.a, p.b), u, 0.1, 0.9, [0, 1]),
  sample(rng, p) { const x = rng.gamma(p.a); return x / (x + rng.gamma(p.b)); },
  mean: (p) => p.a / (p.a + p.b), variance: (p) => (p.a * p.b) / ((p.a + p.b) ** 2 * (p.a + p.b + 1)),
  note: "A distribution for proportions and probabilities. It is the conjugate prior for a binomial probability.",
});

add({
  id: "lognormal", name: "Log-normal", group: "Continuous, positive", kind: "continuous",
  params: [P("mu", "Mean of log", "μ", -2, 4, 0.05, 0.5), P("sigma", "SD of log", "σ", 0.1, 2, 0.02, 0.7)],
  formula: "ln X ~ Normal(μ, σ²)", trim: 0.002, bounds: [0, Infinity],
  pdf: (x, p) => (x <= 0 ? 0 : normPdf((Math.log(x) - p.mu) / p.sigma) / (x * p.sigma)),
  cdf: (x, p) => (x <= 0 ? 0 : normCdf((Math.log(x) - p.mu) / p.sigma)),
  quantile: (u, p) => Math.exp(p.mu + p.sigma * normQuantile(u)),
  sample: (rng, p) => Math.exp(p.mu + p.sigma * rng.normal()),
  mean: (p) => Math.exp(p.mu + p.sigma ** 2 / 2), variance: (p) => (Math.exp(p.sigma ** 2) - 1) * Math.exp(2 * p.mu + p.sigma ** 2),
  note: "Products of many independent positive factors. Common for incomes, firm sizes, and durations. The mean exceeds the median.",
});

add({
  id: "weibull", name: "Weibull", group: "Continuous, positive", kind: "continuous",
  params: [P("shape", "Shape", "k", 0.3, 6, 0.05, 1.7), P("scale", "Scale", "λ", 0.2, 6, 0.05, 2)],
  formula: "F(x) = 1 − exp(−(x/λ)^k)", trim: 0.001, bounds: [0, Infinity],
  pdf: (x, p) => (x < 0 ? 0 : x === 0 ? (p.shape < 1 ? Infinity : p.shape === 1 ? 1 / p.scale : 0) : (p.shape / p.scale) * (x / p.scale) ** (p.shape - 1) * Math.exp(-((x / p.scale) ** p.shape))),
  cdf: (x, p) => (x <= 0 ? 0 : 1 - Math.exp(-((x / p.scale) ** p.shape))),
  quantile: (u, p) => p.scale * (-Math.log(1 - u)) ** (1 / p.shape),
  sample: (rng, p) => p.scale * (-Math.log(rng.open())) ** (1 / p.shape),
  mean: (p) => p.scale * Math.exp(lgamma(1 + 1 / p.shape)), variance: (p) => p.scale ** 2 * (Math.exp(lgamma(1 + 2 / p.shape)) - Math.exp(2 * lgamma(1 + 1 / p.shape))),
  note: "Durations whose hazard rises (k > 1) or falls (k < 1) over time. With k = 1 it is the exponential.",
});

add({
  id: "pareto", name: "Pareto", group: "Continuous, heavy tailed", kind: "continuous",
  params: [P("xm", "Minimum", "xₘ", 0.2, 5, 0.05, 1), P("alpha", "Tail index", "α", 0.5, 6, 0.05, 2.2)],
  formula: "P(X > x) = (xₘ / x)^α", trim: 0.03, upperOnlyTrim: true, bounds: [0, Infinity],
  pdf: (x, p) => (x < p.xm ? 0 : (p.alpha * p.xm ** p.alpha) / x ** (p.alpha + 1)),
  cdf: (x, p) => (x < p.xm ? 0 : 1 - (p.xm / x) ** p.alpha),
  quantile: (u, p) => p.xm / (1 - u) ** (1 / p.alpha),
  sample: (rng, p) => p.xm / rng.open() ** (1 / p.alpha),
  mean: (p) => (p.alpha > 1 ? (p.alpha * p.xm) / (p.alpha - 1) : Infinity),
  variance: (p) => (p.alpha > 2 ? (p.xm ** 2 * p.alpha) / ((p.alpha - 1) ** 2 * (p.alpha - 2)) : Infinity),
  note: "A power-law tail. With α ≤ 2 the variance is infinite and with α ≤ 1 the mean is, so sample averages do not settle down.",
});

add({
  id: "cauchy", name: "Cauchy", group: "Continuous, heavy tailed", kind: "continuous",
  params: [P("x0", "Location", "x₀", -5, 5, 0.1, 0), P("gamma", "Scale", "γ", 0.1, 5, 0.05, 1)],
  formula: "f(x) = 1 / (πγ (1 + ((x−x₀)/γ)²))", trim: 0.04,
  pdf: (x, p) => 1 / (Math.PI * p.gamma * (1 + ((x - p.x0) / p.gamma) ** 2)),
  cdf: (x, p) => 0.5 + Math.atan((x - p.x0) / p.gamma) / Math.PI,
  quantile: (u, p) => p.x0 + p.gamma * Math.tan(Math.PI * (u - 0.5)),
  sample: (rng, p) => p.x0 + p.gamma * Math.tan(Math.PI * (rng.next() - 0.5)),
  mean: () => NaN, variance: () => NaN,
  note: "The ratio of two independent normals. It has no mean, and the average of n draws is distributed exactly like one draw.",
});

add({
  id: "uniform", name: "Uniform", group: "Continuous, bounded", kind: "continuous",
  params: [P("a", "Lower", "a", -5, 5, 0.1, 0), P("b", "Upper", "b", -4, 10, 0.1, 4)],
  formula: "f(x) = 1 / (b − a)", trim: 0, bounds: [-Infinity, Infinity],
  valid: (p) => p.b > p.a,
  pdf: (x, p) => (x < p.a || x > p.b ? 0 : 1 / (p.b - p.a)), cdf: (x, p) => (x <= p.a ? 0 : x >= p.b ? 1 : (x - p.a) / (p.b - p.a)),
  quantile: (u, p) => p.a + u * (p.b - p.a), sample: (rng, p) => p.a + (p.b - p.a) * rng.next(),
  mean: (p) => (p.a + p.b) / 2, variance: (p) => (p.b - p.a) ** 2 / 12,
  note: "Every value in the interval equally likely. Applying a distribution's CDF to a draw from it gives a Uniform(0, 1) variable, which is the basis of simulation and of p-values.",
});

add({
  id: "binomial", name: "Binomial", group: "Discrete", kind: "discrete",
  params: [P("n", "Trials", "n", 1, 200, 1, 12, { integer: true }), P("p", "Success probability", "p", 0.01, 0.99, 0.01, 0.35)],
  formula: "P(X = k) = C(n, k) pᵏ (1−p)ⁿ⁻ᵏ", min: 0,
  pdf: (x, p) => (!isInt(x) || x < 0 || x > p.n ? 0 : Math.exp(lchoose(p.n, x) + x * Math.log(p.p) + (p.n - x) * Math.log(1 - p.p))),
  cdf: (x, p) => (x < 0 ? 0 : x >= p.n ? 1 : betaISf(p.p, Math.floor(x) + 1, p.n - Math.floor(x))),
  quantile(u, p) { return Math.min(p.n, quantileDiscrete((k) => this.cdf(k, p), u, 0)); },
  sample: (rng, p) => binomialSample(rng, p.n, p.p),
  mean: (p) => p.n * p.p, variance: (p) => p.n * p.p * (1 - p.p),
  note: "The number of successes in n independent trials with the same probability.",
});

add({
  id: "poisson", name: "Poisson", group: "Discrete", kind: "discrete",
  params: [P("lambda", "Mean", "λ", 0.1, 60, 0.1, 3.4)],
  formula: "P(X = k) = λᵏ exp(−λ) / k!", min: 0,
  pdf: (x, p) => (!isInt(x) || x < 0 ? 0 : Math.exp(-p.lambda + x * Math.log(p.lambda) - lgamma(x + 1))),
  cdf: (x, p) => (x < 0 ? 0 : gammaQ(Math.floor(x) + 1, p.lambda)),
  quantile(u, p) { return quantileDiscrete((k) => this.cdf(k, p), u, 0); },
  sample: (rng, p) => poissonSample(rng, p.lambda),
  mean: (p) => p.lambda, variance: (p) => p.lambda,
  note: "Counts of independent rare events. The mean equals the variance, and real counts are often more dispersed.",
});

add({
  id: "geometric", name: "Geometric", group: "Discrete", kind: "discrete",
  params: [P("p", "Success probability", "p", 0.02, 0.98, 0.01, 0.3)],
  formula: "P(X = k) = (1−p)ᵏ⁻¹ p, k = 1, 2, …", min: 1,
  pdf: (x, p) => (!isInt(x) || x < 1 ? 0 : (1 - p.p) ** (x - 1) * p.p),
  cdf: (x, p) => (x < 1 ? 0 : 1 - (1 - p.p) ** Math.floor(x)),
  quantile(u, p) { return quantileDiscrete((k) => this.cdf(k, p), u, 1); },
  sample: (rng, p) => 1 + Math.floor(Math.log(rng.open()) / Math.log(1 - p.p)),
  mean: (p) => 1 / p.p, variance: (p) => (1 - p.p) / p.p ** 2,
  note: "The number of independent trials needed for the first success. It is the discrete analogue of the exponential.",
});

add({
  id: "negbin", name: "Negative binomial", group: "Discrete", kind: "discrete",
  params: [P("r", "Successes", "r", 0.5, 40, 0.5, 3), P("p", "Success probability", "p", 0.02, 0.98, 0.01, 0.4)],
  formula: "failures before the r-th success", min: 0,
  pdf: (x, p) => (!isInt(x) || x < 0 ? 0 : Math.exp(lgamma(x + p.r) - lgamma(p.r) - lgamma(x + 1) + p.r * Math.log(p.p) + x * Math.log(1 - p.p))),
  cdf: (x, p) => (x < 0 ? 0 : betaI(p.p, p.r, Math.floor(x) + 1)),
  quantile(u, p) { return quantileDiscrete((k) => this.cdf(k, p), u, 0); },
  sample: (rng, p) => poissonSample(rng, (rng.gamma(p.r) * (1 - p.p)) / p.p),
  mean: (p) => (p.r * (1 - p.p)) / p.p, variance: (p) => (p.r * (1 - p.p)) / p.p ** 2,
  note: "A count whose variance exceeds its mean, as a Poisson count with a gamma-distributed rate. The usual model for overdispersed counts.",
});

for (const d of Object.values(D)) {
  d.defaults = Object.fromEntries(d.params.map((q) => [q.id, q.value]));
  d.valid ??= () => true;
  d.discrete = d.kind === "discrete";
}

export const DISTRIBUTIONS = Object.freeze(D);
export const DISTRIBUTION_IDS = Object.freeze(Object.keys(D));

export function groups() {
  const out = new Map();
  for (const d of Object.values(D)) {
    if (!out.has(d.group)) out.set(d.group, []);
    out.get(d.group).push(d);
  }
  return [...out.entries()];
}

/** Plot window for a distribution at the given parameters. */
export function plotRange(d, p) {
  if (d.fixedRange) return [...d.fixedRange];
  if (d.kind === "discrete") {
    const hi = Math.max(d.min + 6, d.quantile(0.9995, p));
    return [d.min, Math.min(hi, d.min + 400)];
  }
  if (d.id === "uniform") return [p.a - 0.15 * (p.b - p.a), p.b + 0.15 * (p.b - p.a)];
  const lo = d.bounds && Number.isFinite(d.bounds[0]) ? Math.max(d.bounds[0], d.quantile(d.trim, p)) : d.quantile(d.trim, p);
  const hi = d.quantile(1 - d.trim, p);
  const low = d.upperOnlyTrim || (d.bounds && d.bounds[0] === 0) ? Math.max(0, Math.min(lo, 0)) : lo;
  return [d.id === "pareto" ? p.xm * 0.9 : low, hi];
}

export function describe(d, p) {
  const mean = d.mean(p);
  const variance = d.variance(p);
  return { mean, variance, sd: Number.isFinite(variance) ? Math.sqrt(variance) : variance, median: d.quantile(0.5, p) };
}

/** Draws n values. */
export function drawMany(d, p, n, rng) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = d.sample(rng, p);
  return out;
}

// ---------------------------------------------------------------- fitting
function digamma(x) {
  let r = 0;
  let z = x;
  while (z < 6) { r -= 1 / z; z += 1; }
  const f = 1 / (z * z);
  return r + Math.log(z) - 0.5 / z - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}
function trigamma(x) {
  let r = 0;
  let z = x;
  while (z < 6) { r += 1 / (z * z); z += 1; }
  const f = 1 / (z * z);
  return r + 1 / z + f / 2 + (f / z) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30)));
}
const meanOf = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const varOf = (xs) => { const m = meanOf(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length; };

/** Maximum likelihood where it has a convenient form, otherwise method of moments. Returns parameters or null. */
export function fitDistribution(id, xs) {
  const n = xs.length;
  if (n < 2) return null;
  const m = meanOf(xs);
  const v = varOf(xs);
  const min = Math.min(...xs);
  switch (id) {
    case "normal": return { mu: m, sigma: Math.sqrt(v) || 1e-6 };
    case "lognormal": {
      if (min <= 0) return null;
      const l = xs.map(Math.log);
      return { mu: meanOf(l), sigma: Math.sqrt(varOf(l)) || 1e-6 };
    }
    case "exponential": return m > 0 ? { rate: 1 / m } : null;
    case "gamma": {
      if (min <= 0) return null;
      const s = Math.log(m) - meanOf(xs.map(Math.log));
      let k = (3 - s + Math.sqrt((s - 3) ** 2 + 24 * s)) / (12 * s);
      for (let i = 0; i < 6; i += 1) k -= (Math.log(k) - digamma(k) - s) / (1 / k - trigamma(k));
      return { shape: k, scale: m / k };
    }
    case "weibull": {
      if (min <= 0) return null;
      const l = xs.map(Math.log);
      const ml = meanOf(l);
      const g = (k) => {
        const w = xs.map((x) => x ** k);
        const sw = w.reduce((s, a) => s + a, 0);
        return w.reduce((s, a, i) => s + a * l[i], 0) / sw - 1 / k - ml;
      };
      let lo = 0.05;
      let hi = 50;
      for (let i = 0; i < 200; i += 1) {
        const mid = 0.5 * (lo + hi);
        if (g(mid) > 0) hi = mid; else lo = mid;
      }
      const k = 0.5 * (lo + hi);
      return { shape: k, scale: (xs.reduce((s, x) => s + x ** k, 0) / n) ** (1 / k) };
    }
    case "pareto": {
      if (min <= 0) return null;
      const s = xs.reduce((a, x) => a + Math.log(x / min), 0);
      return { xm: min, alpha: s > 0 ? n / s : 50 };
    }
    case "poisson": return { lambda: Math.max(m, 0.01) };
    case "geometric": return m >= 1 ? { p: 1 / m } : null;
    case "negbin": {
      const pp = v > m ? m / v : 0.98;
      return { r: Math.max(0.5, (m * pp) / (1 - pp)), p: Math.min(0.98, Math.max(0.02, pp)) };
    }
    case "binomial": return null;
    case "beta": {
      if (min <= 0 || Math.max(...xs) >= 1 || v <= 0) return null;
      const c = (m * (1 - m)) / v - 1;
      return { a: m * c, b: (1 - m) * c };
    }
    case "uniform": return { a: min, b: Math.max(...xs) };
    default: return null;
  }
}

// ---------------------------------------------------------------- code generation
const num = (x) => fmt(x);

const CODE = {
  normal: { py: (p) => `rng.normal(${num(p.mu)}, ${num(p.sigma)}, n)`, r: (p) => `rnorm(n, ${num(p.mu)}, ${num(p.sigma)})`, jl: (p) => `rand(Normal(${num(p.mu)}, ${num(p.sigma)}), n)`, st: (p) => `rnormal(${num(p.mu)}, ${num(p.sigma)})` },
  t: { py: (p) => `rng.standard_t(${num(p.df)}, n)`, r: (p) => `rt(n, ${num(p.df)})`, jl: (p) => `rand(TDist(${num(p.df)}), n)`, st: (p) => `rt(${num(p.df)})` },
  nct: { py: (p) => `rng.normal(${num(p.delta)}, 1, n) / np.sqrt(rng.chisquare(${num(p.df)}, n) / ${num(p.df)})`, r: (p) => `rt(n, ${num(p.df)}, ncp = ${num(p.delta)})`, jl: (p) => `rand(NoncentralT(${num(p.df)}, ${num(p.delta)}), n)`, st: (p) => `rnormal(${num(p.delta)}, 1) / sqrt(rchi2(${num(p.df)}) / ${num(p.df)})` },
  chisq: { py: (p) => `rng.chisquare(${num(p.k)}, n)`, r: (p) => `rchisq(n, ${num(p.k)})`, jl: (p) => `rand(Chisq(${num(p.k)}), n)`, st: (p) => `rchi2(${num(p.k)})` },
  nchisq: { py: (p) => `rng.noncentral_chisquare(${num(p.k)}, ${num(p.lambda)}, n)`, r: (p) => `rchisq(n, ${num(p.k)}, ncp = ${num(p.lambda)})`, jl: (p) => `rand(NoncentralChisq(${num(p.k)}, ${num(p.lambda)}), n)`, st: (p) => `(rnormal(sqrt(${num(p.lambda)}), 1))^2 + ${p.k > 1 ? `rchi2(${num(p.k - 1)})` : "0"}` },
  f: { py: (p) => `rng.f(${num(p.d1)}, ${num(p.d2)}, n)`, r: (p) => `rf(n, ${num(p.d1)}, ${num(p.d2)})`, jl: (p) => `rand(FDist(${num(p.d1)}, ${num(p.d2)}), n)`, st: (p) => `(rchi2(${num(p.d1)}) / ${num(p.d1)}) / (rchi2(${num(p.d2)}) / ${num(p.d2)})` },
  nf: { py: (p) => `rng.noncentral_f(${num(p.d1)}, ${num(p.d2)}, ${num(p.lambda)}, n)`, r: (p) => `rf(n, ${num(p.d1)}, ${num(p.d2)}, ncp = ${num(p.lambda)})`, jl: (p) => `rand(NoncentralF(${num(p.d1)}, ${num(p.d2)}, ${num(p.lambda)}), n)`, st: (p) => `(((rnormal(sqrt(${num(p.lambda)}), 1))^2 + ${p.d1 > 1 ? `rchi2(${num(p.d1 - 1)})` : "0"}) / ${num(p.d1)}) / (rchi2(${num(p.d2)}) / ${num(p.d2)})` },
  exponential: { py: (p) => `rng.exponential(${num(1 / p.rate)}, n)`, r: (p) => `rexp(n, ${num(p.rate)})`, jl: (p) => `rand(Exponential(${num(1 / p.rate)}), n)`, st: (p) => `rexponential(${num(1 / p.rate)})` },
  gamma: { py: (p) => `rng.gamma(${num(p.shape)}, ${num(p.scale)}, n)`, r: (p) => `rgamma(n, shape = ${num(p.shape)}, scale = ${num(p.scale)})`, jl: (p) => `rand(Gamma(${num(p.shape)}, ${num(p.scale)}), n)`, st: (p) => `rgamma(${num(p.shape)}, ${num(p.scale)})` },
  beta: { py: (p) => `rng.beta(${num(p.a)}, ${num(p.b)}, n)`, r: (p) => `rbeta(n, ${num(p.a)}, ${num(p.b)})`, jl: (p) => `rand(Beta(${num(p.a)}, ${num(p.b)}), n)`, st: (p) => `rbeta(${num(p.a)}, ${num(p.b)})` },
  lognormal: { py: (p) => `rng.lognormal(${num(p.mu)}, ${num(p.sigma)}, n)`, r: (p) => `rlnorm(n, ${num(p.mu)}, ${num(p.sigma)})`, jl: (p) => `rand(LogNormal(${num(p.mu)}, ${num(p.sigma)}), n)`, st: (p) => `exp(rnormal(${num(p.mu)}, ${num(p.sigma)}))` },
  weibull: { py: (p) => `${num(p.scale)} * rng.weibull(${num(p.shape)}, n)`, r: (p) => `rweibull(n, shape = ${num(p.shape)}, scale = ${num(p.scale)})`, jl: (p) => `rand(Weibull(${num(p.shape)}, ${num(p.scale)}), n)`, st: (p) => `rweibull(${num(p.shape)}, ${num(p.scale)})` },
  pareto: { py: (p) => `${num(p.xm)} * (1 + rng.pareto(${num(p.alpha)}, n))`, r: (p) => `${num(p.xm)} / runif(n)^(1 / ${num(p.alpha)})`, jl: (p) => `rand(Pareto(${num(p.alpha)}, ${num(p.xm)}), n)`, st: (p) => `${num(p.xm)} / runiform()^(1 / ${num(p.alpha)})` },
  cauchy: { py: (p) => `${num(p.x0)} + ${num(p.gamma)} * rng.standard_cauchy(n)`, r: (p) => `rcauchy(n, ${num(p.x0)}, ${num(p.gamma)})`, jl: (p) => `rand(Cauchy(${num(p.x0)}, ${num(p.gamma)}), n)`, st: (p) => `${num(p.x0)} + ${num(p.gamma)} * tan(_pi * (runiform() - 0.5))` },
  uniform: { py: (p) => `rng.uniform(${num(p.a)}, ${num(p.b)}, n)`, r: (p) => `runif(n, ${num(p.a)}, ${num(p.b)})`, jl: (p) => `rand(Uniform(${num(p.a)}, ${num(p.b)}), n)`, st: (p) => `${num(p.a)} + (${num(p.b)} - ${num(p.a)}) * runiform()` },
  binomial: { py: (p) => `rng.binomial(${num(p.n)}, ${num(p.p)}, n)`, r: (p) => `rbinom(n, ${num(p.n)}, ${num(p.p)})`, jl: (p) => `rand(Binomial(${num(p.n)}, ${num(p.p)}), n)`, st: (p) => `rbinomial(${num(p.n)}, ${num(p.p)})` },
  poisson: { py: (p) => `rng.poisson(${num(p.lambda)}, n)`, r: (p) => `rpois(n, ${num(p.lambda)})`, jl: (p) => `rand(Poisson(${num(p.lambda)}), n)`, st: (p) => `rpoisson(${num(p.lambda)})` },
  geometric: { py: (p) => `rng.geometric(${num(p.p)}, n)`, r: (p) => `rgeom(n, ${num(p.p)}) + 1`, jl: (p) => `rand(Geometric(${num(p.p)}), n) .+ 1`, st: (p) => `rnbinomial(1, ${num(p.p)}) + 1` },
  negbin: { py: (p) => `rng.negative_binomial(${num(p.r)}, ${num(p.p)}, n)`, r: (p) => `rnbinom(n, size = ${num(p.r)}, prob = ${num(p.p)})`, jl: (p) => `rand(NegativeBinomial(${num(p.r)}, ${num(p.p)}), n)`, st: (p) => `rnbinomial(${num(p.r)}, ${num(p.p)})` },
};

/** Expression strings that draw n values in each language. */
export function drawExpressions(id, p) {
  const c = CODE[id];
  return { python: c.py(p), r: c.r(p), julia: c.jl(p), stata: c.st(p) };
}

/** A short, runnable script that draws n values, then reports the mean and a tail probability. */
export function drawScript(id, p, { n = 10000, seed = 2026, cutoff = null } = {}) {
  const e = drawExpressions(id, p);
  const cut = cutoff ?? null;
  const py = ["import numpy as np", "", `rng = np.random.default_rng(${seed})`, `n = ${n}`, `x = ${e.python}`, "print(x.mean(), x.var(ddof=1))"];
  const r = [`set.seed(${seed})`, `n <- ${n}`, `x <- ${e.r}`, "print(c(mean(x), var(x)))"];
  const jl = ["using Distributions, Random, Statistics", "", `Random.seed!(${seed})`, `n = ${n}`, `x = ${e.julia}`, "println((mean(x), var(x)))"];
  const st = ["clear", `set seed ${seed}`, `set obs ${n}`, `generate x = ${e.stata}`, "summarize x"];
  if (cut !== null) {
    py.push(`print((x > ${num(cut)}).mean())`);
    r.push(`print(mean(x > ${num(cut)}))`);
    jl.push(`println(mean(x .> ${num(cut)}))`);
    st.push(`generate byte exceed = x > ${num(cut)}`, "summarize exceed");
  }
  return { python: py.join("\n"), r: r.join("\n"), julia: jl.join("\n"), stata: st.join("\n") };
}
