import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, POOLS, makeHistory, initialParameters, parameterRange, scoreEvent, simulateYears, replayYear, departmentScript, stats } from "../../src/lib/department.mjs";
import { DISTRIBUTIONS, drawExpressions } from "../../src/lib/distributions.mjs";

test("every event has a valid hidden truth, a pool that contains a fitting family, and four quips", () => {
  for (const s of SCENARIOS) {
    assert.equal(s.events.length, 4);
    for (const e of s.events) {
      assert.ok(DISTRIBUTIONS[e.truth.family], e.id);
      assert.ok(POOLS[e.pool].length >= 3);
      assert.deepEqual(Object.keys(e.quips).sort(), ["extreme", "high", "low", "typical"]);
      assert.ok(Object.values(e.quips).every((q) => q.includes("{v}")));
    }
  }
});

test("history is reproducible and respects support", () => {
  for (const s of SCENARIOS) {
    const a = makeHistory(s, 5);
    const b = makeHistory(s, 5);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, makeHistory(s, 6));
    a.forEach((xs, i) => {
      assert.equal(xs.length, 12);
      const e = s.events[i];
      if (e.pool === "proportion") assert.ok(xs.every((x) => x > 0 && x < 1));
      if (e.pool === "count") assert.ok(xs.every((x) => Number.isInteger(x) && x >= (e.min ?? 0)));
    });
  }
});

test("the true family scores near zero distance at the true parameters", () => {
  for (const s of SCENARIOS) {
    for (const e of s.events) {
      const sc = scoreEvent(e, e.truth.family, e.truth.params);
      assert.ok(sc.gap < 1e-9, `${e.id} ${sc.gap}`);
      assert.ok(Math.abs(sc.pModel - sc.pTruth) < 1e-12);
      assert.ok(sc.coverage > 0.85 && sc.coverage <= 0.9 + 1e-9 || DISTRIBUTIONS[e.truth.family].discrete, `${e.id} coverage ${sc.coverage}`);
    }
  }
});

test("a Poisson model understates the negative binomial tail", () => {
  const e = SCENARIOS[0].events[1];
  const mean = DISTRIBUTIONS.negbin.mean(e.truth.params);
  const sc = scoreEvent(e, "poisson", { lambda: mean });
  assert.ok(sc.ratio < 0.2, `ratio ${sc.ratio}`);
});

test("initial parameters are inside the slider ranges and valid", () => {
  for (const s of SCENARIOS) {
    const hist = makeHistory(s, 1);
    s.events.forEach((e, i) => {
      for (const fam of POOLS[e.pool]) {
        const { params } = initialParameters(fam, hist[i]);
        for (const q of DISTRIBUTIONS[fam].params) {
          const r = parameterRange(fam, q, hist[i]);
          assert.ok(params[q.id] >= r.min - 1e-12 && params[q.id] <= r.max + 1e-12, `${e.id} ${fam}.${q.id}`);
          assert.ok(Number.isFinite(params[q.id]));
        }
      }
    });
  }
});

test("simulation frequencies agree with the exact tail probabilities", () => {
  const s = SCENARIOS[1];
  const models = s.events.map((e) => ({ family: e.truth.family, params: e.truth.params }));
  const sim = simulateYears(s, models, 20000, 4);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum(sim.troubleModel) - 1) < 1e-9);
  for (let k = 0; k < sim.troubleModel.length; k += 1) assert.ok(Math.abs(sim.troubleModel[k] - sim.troubleTruth[k]) < 0.02);
});

test("replay produces one line per event and is deterministic", () => {
  const s = SCENARIOS[0];
  const models = s.events.map((e) => ({ family: e.truth.family, params: e.truth.params }));
  const a = replayYear(s, models, 9);
  assert.equal(a.lines.length, 4);
  assert.deepEqual(a, replayYear(s, models, 9));
  assert.ok(a.lines.every((l) => !l.text.includes("{v}")));
});

test("department script mentions every event and parses as four languages", () => {
  const s = SCENARIOS[0];
  const models = s.events.map((e) => ({ family: e.truth.family, params: e.truth.params }));
  const out = departmentScript(s, models, 5000, 2026, drawExpressions);
  for (const lang of ["python", "r", "julia", "stata"]) assert.ok(out[lang].includes("x4"), lang);
  assert.ok(out.python.includes(".astype(int)"));
  assert.ok(stats([1, 2, 3, 4]).mean === 2.5);
});
