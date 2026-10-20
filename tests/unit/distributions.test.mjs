import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DISTRIBUTIONS, makeRng, drawMany, fitDistribution, drawScript, plotRange, describe } from "../../src/lib/distributions.mjs";

const reference = JSON.parse(readFileSync(new URL("../fixtures/distribution-reference.json", import.meta.url), "utf8"));
const close = (a, b, tol, label) => {
  const scale = Math.max(1, Math.abs(b));
  assert.ok(Math.abs(a - b) <= tol * scale, `${label}: got ${a}, expected ${b}`);
};

for (const ref of reference) {
  test(`${ref.id} ${JSON.stringify(ref.params)} matches R`, () => {
    const d = DISTRIBUTIONS[ref.id];
    const tol = ["nct", "nchisq", "nf"].includes(ref.id) ? 1e-6 : 1e-8;
    ref.xs.forEach((x, i) => {
      if (Number.isFinite(ref.pdf[i])) close(d.pdf(x, ref.params), ref.pdf[i], tol, `pdf(${x})`);
      close(d.cdf(x, ref.params), ref.cdf[i], tol, `cdf(${x})`);
    });
    ref.ps.forEach((p, i) => {
      const q = d.quantile(p, ref.params);
      if (d.discrete) assert.ok(q === ref.q[i], `q(${p}): got ${q}, expected ${ref.q[i]}`);
      else close(q, ref.q[i], Math.max(tol, 1e-7), `q(${p})`);
    });
  });
}

test("quantile inverts the CDF for continuous families", () => {
  for (const d of Object.values(DISTRIBUTIONS).filter((x) => !x.discrete)) {
    for (const p of [0.05, 0.5, 0.95]) {
      close(d.cdf(d.quantile(p, d.defaults), d.defaults), p, 1e-7, `${d.id} ${p}`);
    }
  }
});

test("sampler moments match theory under a fixed seed", () => {
  const skip = new Set(["cauchy", "pareto", "t", "nct", "f", "nf"]);
  for (const d of Object.values(DISTRIBUTIONS).filter((x) => !skip.has(x.id))) {
    const xs = drawMany(d, d.defaults, 60000, makeRng(7));
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(d.variance(d.defaults));
    assert.ok(Math.abs(m - d.mean(d.defaults)) < 5 * sd / Math.sqrt(xs.length), `${d.id} mean ${m}`);
  }
});

test("sampler CDF agreement (Kolmogorov distance) for every continuous family", () => {
  for (const d of Object.values(DISTRIBUTIONS).filter((x) => !x.discrete)) {
    const n = 4000;
    const xs = Array.from(drawMany(d, d.defaults, n, makeRng(11))).sort((a, b) => a - b);
    let worst = 0;
    xs.forEach((x, i) => { worst = Math.max(worst, Math.abs(d.cdf(x, d.defaults) - (i + 0.5) / n)); });
    assert.ok(worst < 0.04, `${d.id} KS ${worst}`);
  }
});

test("discrete samplers match the pmf", () => {
  for (const d of Object.values(DISTRIBUTIONS).filter((x) => x.discrete)) {
    const n = 30000;
    const xs = drawMany(d, d.defaults, n, makeRng(3));
    const counts = new Map();
    xs.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
    for (const [k, c] of counts) {
      const p = d.pdf(k, d.defaults);
      if (p * n < 30) continue;
      assert.ok(Math.abs(c / n - p) < 5 * Math.sqrt((p * (1 - p)) / n), `${d.id} k=${k}`);
    }
  }
});

test("large-parameter discrete samplers are exact in mean", () => {
  const rng = makeRng(5);
  const pois = drawMany(DISTRIBUTIONS.poisson, { lambda: 55 }, 20000, rng);
  close(pois.reduce((s, x) => s + x, 0) / pois.length, 55, 0.01, "poisson 55");
  const bin = drawMany(DISTRIBUTIONS.binomial, { n: 180, p: 0.4 }, 20000, rng);
  close(bin.reduce((s, x) => s + x, 0) / bin.length, 72, 0.01, "binomial 180");
});

test("fitting recovers parameters from large samples", () => {
  const cases = [["normal", { mu: 2, sigma: 1.5 }], ["lognormal", { mu: 0.5, sigma: 0.6 }], ["gamma", { shape: 2.5, scale: 1.5 }],
    ["weibull", { shape: 1.7, scale: 2 }], ["exponential", { rate: 0.8 }], ["poisson", { lambda: 4 }], ["pareto", { xm: 1, alpha: 2.5 }]];
  for (const [id, truth] of cases) {
    const xs = Array.from(drawMany(DISTRIBUTIONS[id], truth, 40000, makeRng(9)));
    const fit = fitDistribution(id, xs);
    for (const k of Object.keys(truth)) close(fit[k], truth[k], 0.04, `${id}.${k}`);
  }
});

test("code export names every family in all four languages", () => {
  for (const d of Object.values(DISTRIBUTIONS)) {
    const s = drawScript(d.id, d.defaults, { cutoff: 1 });
    for (const lang of ["python", "r", "julia", "stata"]) assert.ok(s[lang].length > 20 && !s[lang].includes("undefined") && !s[lang].includes("NaN"), `${d.id} ${lang}`);
  }
});

test("plot ranges are finite and ordered", () => {
  for (const d of Object.values(DISTRIBUTIONS)) {
    const [lo, hi] = plotRange(d, d.defaults);
    assert.ok(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo, `${d.id} ${lo} ${hi}`);
    assert.ok("median" in describe(d, d.defaults));
  }
});
