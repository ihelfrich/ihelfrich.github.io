// Scenarios for the department simulator. Each event has a hidden true distribution. A learner sees twelve
// past observations, chooses a family and parameters, and the simulator compares that model with the truth.
import { DISTRIBUTIONS, makeRng, drawMany, fitDistribution, plotRange } from "./distributions.mjs";

export const POOLS = {
  positive: ["exponential", "gamma", "lognormal", "weibull", "pareto", "normal", "uniform"],
  count: ["poisson", "negbin", "geometric", "binomial", "normal"],
  proportion: ["beta", "uniform", "normal"],
};

const E = (event) => ({ digits: 1, direction: "upper", ...event });

export const SCENARIOS = [
  {
    id: "department",
    name: "An academic year",
    blurb: "A department with four recurring sources of uncertainty: a referee, a student queue, a coffee machine, and a grant agency.",
    events: [
      E({
        id: "referee", agent: "Referee 2", name: "Time to the referee report", unit: "days", pool: "positive", digits: 0,
        blurb: "Days between submitting a manuscript and receiving the second referee's report.",
        truth: { family: "lognormal", params: { mu: 4.45, sigma: 0.5 } }, threshold: 180, thresholdText: "the report takes more than 180 days",
        quips: {
          low: "The report arrived after {v} days. The editor verified that the email was genuine.",
          typical: "The report arrived after {v} days and began with the phrase \"the authors should consider\".",
          high: "After {v} days the report arrived. It requests a different paper.",
          extreme: "The report took {v} days. The literature it cites has since been superseded.",
        },
      }),
      E({
        id: "office", agent: "Students", name: "Students at office hours, exam week", unit: "students", pool: "count", digits: 0,
        blurb: "Number of students who come to one office-hour session in the week before an exam.",
        truth: { family: "negbin", params: { r: 2.5, p: 0.28 } }, threshold: 18, thresholdText: "more than 18 students attend",
        quips: {
          low: "{v} students attended. The syllabus appears to be clear.",
          typical: "{v} students attended, mostly with questions answered on the first page of the syllabus.",
          high: "{v} students attended. The binding constraint was chairs.",
          extreme: "{v} students attended. The hallway became a seminar.",
        },
      }),
      E({
        id: "coffee", agent: "Coffee machine", name: "Time between machine failures", unit: "days", pool: "positive", direction: "lower", digits: 0,
        blurb: "Days of operation between breakdowns of the department coffee machine.",
        truth: { family: "weibull", params: { shape: 1.8, scale: 30 } }, threshold: 7, thresholdText: "the machine fails within a week",
        quips: {
          low: "The machine failed after {v} days. A technician was summoned and a seminar was moved.",
          typical: "The machine ran {v} days before failing. Faculty rediscovered the café across the street.",
          high: "The machine ran {v} days without a fault. Nobody remembers who fixed it.",
          extreme: "The machine ran {v} days without a failure. The warranty expired, as a matter of principle.",
        },
      }),
      E({
        id: "grant", agent: "Grant agency", name: "Size of an external award", unit: "$ thousand", pool: "positive", digits: 0,
        blurb: "Size of an external research award, in thousands of dollars, for a funded proposal.",
        truth: { family: "pareto", params: { xm: 25, alpha: 1.8 } }, threshold: 250, thresholdText: "an award exceeds $250,000",
        quips: {
          low: "The award was ${v}k. It covered a graduate student for most of a semester.",
          typical: "The award was ${v}k, after an overhead negotiation that took longer than the research.",
          high: "The award was ${v}k. The dean's office scheduled a photograph.",
          extreme: "The award was ${v}k. A new administrative position was created to hold it.",
        },
      }),
    ],
  },
  {
    id: "cafe",
    name: "A café on Saturday morning",
    blurb: "A small café where arrivals, tips, preparation times, and pastry sales each follow a different process.",
    events: [
      E({
        id: "arrivals", agent: "Customers", name: "Customers arriving per hour", unit: "customers", pool: "count", digits: 0,
        blurb: "Customers walking in during one hour of the Saturday rush.",
        truth: { family: "poisson", params: { lambda: 24 } }, threshold: 36, thresholdText: "more than 36 customers arrive in an hour",
        quips: {
          low: "{v} customers arrived. The barista reorganized the napkins.",
          typical: "{v} customers arrived, in a pattern that would have satisfied a queueing theorist.",
          high: "{v} customers arrived. The line reached the bookstore next door.",
          extreme: "{v} customers arrived. The milk supply was reclassified as a scarce resource.",
        },
      }),
      E({
        id: "tips", agent: "Tippers", name: "Tip per order", unit: "$", pool: "positive", digits: 2,
        blurb: "Tip left on one order, in dollars, among orders that include a tip.",
        truth: { family: "lognormal", params: { mu: 0.6, sigma: 0.7 } }, threshold: 10, thresholdText: "a single tip exceeds $10",
        quips: {
          low: "The tip was ${v}. It was accompanied by a thoughtful nod.",
          typical: "The tip was ${v}, rounded up by a payment screen that makes rounding awkward to decline.",
          high: "The tip was ${v}. The barista has framed the receipt.",
          extreme: "The tip was ${v}. An audit would be inconclusive.",
        },
      }),
      E({
        id: "prep", agent: "Espresso machine", name: "Minutes from order to cup", unit: "minutes", pool: "positive", digits: 1,
        blurb: "Minutes between an order and the drink reaching the counter.",
        truth: { family: "gamma", params: { shape: 3, scale: 1.4 } }, threshold: 9, thresholdText: "a drink takes more than 9 minutes",
        quips: {
          low: "The drink took {v} minutes. The customer checked whether it was decaf.",
          typical: "The drink took {v} minutes, the sum of several short and entirely reasonable delays.",
          high: "The drink took {v} minutes. The customer began a different conversation.",
          extreme: "The drink took {v} minutes. It was delivered with an apology and a pastry.",
        },
      }),
      E({
        id: "pastry", agent: "Pastry case", name: "Share of pastries sold by noon", unit: "share", pool: "proportion", digits: 2,
        blurb: "Proportion of the morning's pastries sold by noon.",
        truth: { family: "beta", params: { a: 4, b: 2.5 } }, threshold: 0.95, thresholdText: "the case is nearly sold out (above 95%)",
        quips: {
          low: "Only {v} of the pastries sold. The croissants are tomorrow's bread pudding.",
          typical: "{v} of the pastries sold, leaving a dignified assortment.",
          high: "{v} of the pastries sold. The last scone was negotiated over.",
          extreme: "{v} of the pastries sold. Late arrivals were offered a recipe.",
        },
      }),
    ],
  },
  {
    id: "startup",
    name: "A startup's first year",
    blurb: "Four uncertainties that a founder might otherwise summarize by a single average: first sales, sign-ups, contract sizes, and churn.",
    events: [
      E({
        id: "first", agent: "The market", name: "Time to the first paying customer", unit: "days", pool: "positive", digits: 0,
        blurb: "Days from launch to the first paying customer.",
        truth: { family: "weibull", params: { shape: 0.7, scale: 40 } }, threshold: 120, thresholdText: "the first sale takes more than 120 days",
        quips: {
          low: "The first customer paid on day {v}, to the founders' visible disbelief.",
          typical: "The first customer paid on day {v}. The pitch deck was revised in the interim.",
          high: "The first customer paid on day {v}. Runway became a topic of conversation.",
          extreme: "The first customer paid on day {v}. The company had since pivoted twice.",
        },
      }),
      E({
        id: "signups", agent: "The website", name: "New sign-ups per day", unit: "sign-ups", pool: "count", digits: 0,
        blurb: "New sign-ups on one ordinary weekday.",
        truth: { family: "negbin", params: { r: 1.5, p: 0.2 } }, threshold: 25, thresholdText: "more than 25 sign-ups arrive in a day",
        quips: {
          low: "{v} sign-ups arrived. The dashboard was refreshed with some determination.",
          typical: "{v} sign-ups arrived, a figure the team described as encouraging.",
          high: "{v} sign-ups arrived after a single post was shared.",
          extreme: "{v} sign-ups arrived. The server was introduced to its limits.",
        },
      }),
      E({
        id: "contract", agent: "Enterprise buyers", name: "Contract value", unit: "$ thousand", pool: "positive", digits: 0,
        blurb: "Annual value of a signed contract, in thousands of dollars.",
        truth: { family: "pareto", params: { xm: 10, alpha: 2.4 } }, threshold: 100, thresholdText: "a contract exceeds $100,000",
        quips: {
          low: "The contract was worth ${v}k, enough to justify the legal review.",
          typical: "The contract was worth ${v}k and arrived with twelve pages of terms.",
          high: "The contract was worth ${v}k. The founders considered hiring.",
          extreme: "The contract was worth ${v}k. It accounted for most of the year's revenue.",
        },
      }),
      E({
        id: "churn", agent: "Customers", name: "Months until a customer cancels", unit: "months", pool: "count", digits: 0, min: 1,
        blurb: "Number of months a customer stays before the first cancellation, counting the first month as 1.",
        truth: { family: "geometric", params: { p: 0.12 } }, threshold: 30, thresholdText: "a customer lasts more than 30 months",
        quips: {
          low: "The customer cancelled in month {v}, citing a spreadsheet that did the same job.",
          typical: "The customer cancelled in month {v}. The exit survey was thorough and unread.",
          high: "The customer stayed through month {v}. Their invoice became a point of pride.",
          extreme: "The customer stayed {v} months. They are now described as a reference account.",
        },
      }),
    ],
  },
];

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/** Twelve past observations of every event, reproducible from a seed. */
export function makeHistory(scenario, seed, n = 12) {
  return scenario.events.map((event, index) => {
    const d = DISTRIBUTIONS[event.truth.family];
    const rng = makeRng((seed * 7919 + index * 104729 + 13) >>> 0);
    const raw = Array.from(drawMany(d, event.truth.params, n, rng));
    const values = raw.map((x) => {
      const places = event.digits ?? 1;
      const r = Number(x.toFixed(places));
      if (event.pool === "proportion") return Math.min(0.995, Math.max(0.005, r));
      return d.discrete ? Math.round(x) : r;
    });
    return values;
  });
}

export function stats(xs) {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(variance), variance, min: Math.min(...xs), max: Math.max(...xs), dispersion: variance / mean };
}

const KIND = {
  normal: { mu: "loc", sigma: "scale" }, exponential: { rate: "rate" }, gamma: { shape: "shape", scale: "scale" },
  lognormal: { mu: "logloc", sigma: "shape" }, weibull: { shape: "shape", scale: "scale" }, pareto: { xm: "scale", alpha: "shape" },
  uniform: { a: "loc", b: "loc" }, poisson: { lambda: "scale" }, negbin: { r: "shape", p: "prob" }, geometric: { p: "prob" },
  binomial: { n: "count", p: "prob" }, beta: { a: "shape", b: "shape" },
};

/** Slider ranges for one parameter, widened so scale and location parameters can reach the data. */
export function parameterRange(familyId, param, data) {
  const kind = KIND[familyId]?.[param.id] ?? "shape";
  const s = stats(data);
  let lo = param.min;
  let hi = param.max;
  if (kind === "loc") { lo = Math.min(lo, s.min - 2 * s.sd); hi = Math.max(hi, s.max + 2 * s.sd); }
  if (kind === "scale") { lo = Math.min(lo, s.mean * 0.02); hi = Math.max(hi, s.max * 4); }
  if (kind === "rate") { lo = Math.min(lo, 1 / (s.max * 12)); hi = Math.max(hi, 6 / Math.max(s.mean, 1e-9)); }
  if (kind === "logloc") { lo = Math.min(lo, Math.log(Math.max(s.min, 1e-6)) - 1.5); hi = Math.max(hi, Math.log(Math.max(s.max, 1e-6)) + 1.5); }
  if (kind === "count") { hi = Math.max(hi, s.max * 3); }
  const step = param.integer ? 1 : Number(((hi - lo) / 600).toPrecision(1));
  return { min: lo, max: hi, step: Math.max(step, param.integer ? 1 : 1e-9) };
}

/** Starting parameters for a family: the fitted values when available, clipped into the slider range. */
export function initialParameters(familyId, data) {
  const d = DISTRIBUTIONS[familyId];
  const fit = fitDistribution(familyId, data);
  const out = { ...d.defaults };
  const fitted = Boolean(fit);
  for (const param of d.params) {
    const { min, max } = parameterRange(familyId, param, data);
    const v = fit?.[param.id] ?? out[param.id];
    out[param.id] = Math.min(max, Math.max(min, param.integer ? Math.round(v) : v));
  }
  return { params: out, fitted };
}

export function tailProbability(d, p, event) {
  if (event.direction === "lower") return d.cdf(event.threshold, p);
  return 1 - d.cdf(event.threshold, p);
}

/** Comparison of a learner's model with the truth for one event. All quantities are exact, not simulated. */
export function scoreEvent(event, familyId, params) {
  const M = DISTRIBUTIONS[familyId];
  const T = DISTRIBUTIONS[event.truth.family];
  const tp = event.truth.params;
  const lo = M.quantile(0.05, params);
  const hi = M.quantile(0.95, params);
  const below = (x) => (T.discrete ? T.cdf(Math.ceil(x) - 1, tp) : T.cdf(x, tp));
  const coverage = Math.max(0, T.cdf(hi, tp) - below(lo));
  const [a1, b1] = plotRange(M, params);
  const [a2, b2] = plotRange(T, tp);
  const a = Math.min(a1, a2);
  const b = Math.max(b1, b2);
  let gap = 0;
  for (let i = 0; i <= 400; i += 1) {
    const x = a + ((b - a) * i) / 400;
    const xx = T.discrete || M.discrete ? Math.round(x) : x;
    gap = Math.max(gap, Math.abs(M.cdf(xx, params) - T.cdf(xx, tp)));
  }
  const pModel = tailProbability(M, params, event);
  const pTruth = tailProbability(T, tp, event);
  return {
    family: familyId, truthFamily: event.truth.family, pModel, pTruth,
    ratio: pTruth > 0 ? pModel / pTruth : NaN, coverage, gap, lo, hi,
    meanModel: M.mean(params), meanTruth: T.mean(tp),
  };
}

export function gradeGap(gap) {
  if (gap < 0.04) return "Close";
  if (gap < 0.09) return "Reasonable";
  if (gap < 0.18) return "Noticeably off";
  return "Far off";
}

/** Simulates `years` years under the learner's models and under reality, with the same number of draws each. */
export function simulateYears(scenario, models, years, seed) {
  const model = scenario.events.map(() => new Float64Array(years));
  const truth = scenario.events.map(() => new Float64Array(years));
  scenario.events.forEach((event, i) => {
    const M = DISTRIBUTIONS[models[i].family];
    const T = DISTRIBUTIONS[event.truth.family];
    model[i] = drawMany(M, models[i].params, years, makeRng(seed + 31 * (i + 1)));
    truth[i] = drawMany(T, event.truth.params, years, makeRng(seed + 977 * (i + 1) + 5));
  });
  const trouble = (draws) => {
    const counts = new Array(scenario.events.length + 1).fill(0);
    for (let y = 0; y < years; y += 1) {
      let c = 0;
      scenario.events.forEach((event, i) => {
        const x = draws[i][y];
        if (event.direction === "lower" ? x <= event.threshold : x > event.threshold) c += 1;
      });
      counts[c] += 1;
    }
    return counts.map((c) => c / years);
  };
  return { model, truth, troubleModel: trouble(model), troubleTruth: trouble(truth), years };
}

const bucket = (u) => (u < 0.1 ? "low" : u < 0.8 ? "typical" : u < 0.97 ? "high" : "extreme");

/** One realized year drawn from reality, with a comment for every event and a note on how surprising it was to the model. */
export function replayYear(scenario, models, seed) {
  const rng = makeRng(seed);
  const lines = [];
  let troubles = 0;
  scenario.events.forEach((event, i) => {
    const T = DISTRIBUTIONS[event.truth.family];
    const M = DISTRIBUTIONS[models[i].family];
    const u = Math.min(0.9999, Math.max(0.0001, rng.next()));
    const x = T.quantile(u, event.truth.params);
    const value = Number(x.toFixed(event.digits ?? 1));
    const shown = value.toLocaleString("en-US", { minimumFractionDigits: event.digits ?? 0, maximumFractionDigits: event.digits ?? 0 });
    const text = event.quips[bucket(event.direction === "lower" ? 1 - u : u)].replaceAll("{v}", shown);
    const pm = T.discrete ? M.cdf(value, models[i].params) : M.cdf(x, models[i].params);
    const percentile = Math.min(pm, 1 - pm);
    const exceed = event.direction === "lower" ? x <= event.threshold : x > event.threshold;
    if (exceed) troubles += 1;
    let note = "";
    if (percentile < 0.01) note = `Your model gave an outcome this extreme or more about ${percentile < 0.0005 ? "once in 2,000+ years" : `1 year in ${Math.round(1 / (2 * percentile))}`}.`;
    else if (percentile < 0.05) note = "Your model rated this outcome unusual.";
    lines.push({ agent: event.agent, name: event.name, text, note, value, exceed, thresholdText: event.thresholdText });
  });
  return { lines, troubles };
}

/** Code that simulates the learner's models in each language. */
export function departmentScript(scenario, models, years, seed, expressions) {
  const rows = scenario.events.map((event, i) => ({ event, expr: expressions(models[i].family, models[i].params) }));
  const cond = (event, v, lang) => (event.direction === "lower" ? `${v} <= ${event.threshold}` : `${v} > ${event.threshold}`);
  const name = (i) => `x${i + 1}`;
  const py = ["import numpy as np", "", `rng = np.random.default_rng(${seed})`, `n = ${years}  # simulated years`];
  const r = [`set.seed(${seed})`, `n <- ${years}  # simulated years`];
  const jl = ["using Distributions, Random, Statistics", "", `Random.seed!(${seed})`, `n = ${years}  # simulated years`];
  const st = ["clear", `set seed ${seed}`, `set obs ${years}`];
  rows.forEach(({ event, expr }, i) => {
    py.push(`${name(i)} = ${expr.python}  # ${event.name}`);
    r.push(`${name(i)} <- ${expr.r}  # ${event.name}`);
    jl.push(`${name(i)} = ${expr.julia}  # ${event.name}`);
    st.push(`generate ${name(i)} = ${expr.stata}  // ${event.name}`);
  });
  const pyT = rows.map(({ event }, i) => `(${cond(event, name(i))}).astype(int)`).join(" + ");
  py.push(`trouble = ${pyT}`, "print(np.bincount(trouble, minlength=" + (rows.length + 1) + ") / n)");
  r.push(`trouble <- ${rows.map(({ event }, i) => `(${cond(event, name(i))})`).join(" + ")}`, "print(table(factor(trouble, levels = 0:" + rows.length + ")) / n)");
  jl.push(`trouble = ${rows.map(({ event }, i) => `(${cond(event, name(i)).replace(/ ([<>]=?) /, " .$1 ")})`).join(" .+ ")}`, "println([mean(trouble .== k) for k in 0:" + rows.length + "])");
  st.push(`generate trouble = ${rows.map(({ event }, i) => `(${cond(event, name(i))})`).join(" + ")}`, "tabulate trouble");
  return { python: py.join("\n"), r: r.join("\n"), julia: jl.join("\n"), stata: st.join("\n") };
}
