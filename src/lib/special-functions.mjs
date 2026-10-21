// Special functions for the distribution lab: log-gamma, regularized incomplete gamma and beta,
// the normal distribution, and a monotone root finder. Accurate to about 1e-13 in the central range.

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i += 1) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

const TINY = 1e-300;
const EPS = 1e-16;

/** Regularized lower incomplete gamma P(a, x) and upper Q(a, x) = 1 - P, each computed on its accurate side. */
function gammaSeries(a, x) {
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 0; n < 100000; n += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

function gammaContinuedFraction(a, x) {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100000; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

export function gammaP(a, x) {
  if (x <= 0) return 0;
  if (!Number.isFinite(x)) return 1;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

export function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (!Number.isFinite(x)) return 0;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

function betaContinuedFraction(x, a, b) {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 100000; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(x, a, b)) / a;
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Upper tail 1 - I_x(a, b), computed on the accurate side. */
export function betaISf(x, a, b) {
  if (x <= 0) return 1;
  if (x >= 1) return 0;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return 1 - (bt * betaContinuedFraction(x, a, b)) / a;
  return (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

export const SQRT2 = Math.SQRT2;

export function erfc(z) {
  if (z >= 0) return gammaQ(0.5, z * z);
  return 2 - gammaQ(0.5, z * z);
}

export const normCdf = (x) => 0.5 * erfc(-x / SQRT2);
export const normSf = (x) => 0.5 * erfc(x / SQRT2);
export const normPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

/** Standard normal quantile: Acklam's approximation followed by two Halley refinements. */
export function normQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  let x;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  for (let i = 0; i < 2; i += 1) {
    const e = (p < 0.5 ? normCdf(x) - p : -(normSf(x) - (1 - p)));
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    x -= u / (1 + (x * u) / 2);
  }
  return x;
}

/**
 * Solves f(x) = target for increasing f by bracketing and bisection. `lo` and `hi` are starting guesses;
 * the bracket expands geometrically when needed. `bounds` limits expansion (for supports with a hard edge).
 */
export function solveIncreasing(f, target, lo, hi, bounds = [-Infinity, Infinity]) {
  let a = lo;
  let b = hi;
  let width = Math.max(1, Math.abs(b - a));
  for (let i = 0; i < 200 && f(a) > target; i += 1) {
    if (a <= bounds[0]) return bounds[0];
    a = Math.max(bounds[0], a - width);
    width *= 2;
  }
  width = Math.max(1, Math.abs(b - a));
  for (let i = 0; i < 400 && f(b) < target; i += 1) {
    if (b >= bounds[1]) return bounds[1];
    b = Math.min(bounds[1], b + width);
    width *= 2;
  }
  for (let i = 0; i < 300; i += 1) {
    const m = 0.5 * (a + b);
    if (m === a || m === b) break;
    if (f(m) < target) a = m;
    else b = m;
    if (Math.abs(b - a) <= 1e-15 * Math.max(1, Math.abs(m))) break;
  }
  return 0.5 * (a + b);
}
