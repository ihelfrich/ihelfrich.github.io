import assert from "node:assert/strict";
import test from "node:test";

import {
  CDE_FACTS,
  GRAPH_MAX_FRAMES,
  MINIMUM_SVG_TARGET_CSS_PX,
  binPointMass,
  buildResearchGraph,
  cdeState,
  filterResearchGraph,
  fitLeastSquares,
  formatSinkhornReadout,
  relayGraphGeometry,
  relayState,
  resolveLeastSquaresGesture,
  shouldContinueGraphLayout,
  solveEntropicGridTransport,
  svgHitRadiusForCssTarget,
} from "../../src/lib/fieldbook-math.mjs";

test("Sinkhorn readout names the normalized regularized coupling cost", () => {
  assert.equal(
    formatSinkhornReadout({ normalizedRms: 0.1246, iterations: 28, maxMarginalError: 1e-10 }, { sampleSize: 3000 }),
    "regularized W₂ approximation = 0.125 viewport diagonals · Sinkhorn k=28 · marginal max 1.0e-10 · n=3,000",
  );
});

test("entropic transport includes conditional variance for one source and two targets", () => {
  const result = solveEntropicGridTransport({
    source: [0, 1, 0],
    target: [0.5, 0, 0.5],
    width: 3,
    height: 1,
    sigma: 1,
    minIterations: 1,
    maxIterations: 200,
    tolerance: 1e-12,
    xCoordinates: [-1, 0, 1],
    yCoordinates: [0, 0, 0],
    normalization: 1,
  });

  assert.ok(Math.abs(result.normalizedRms - 1) < 1e-10);
  assert.ok(Math.abs(result.normalizedBarycentricRms) < 1e-10);
  assert.ok(Math.abs(result.normalizedConditionalRms - 1) < 1e-10);
  assert.ok(Math.abs(result.conditionalSecondMoment[1] - 1) < 1e-10);
  assert.ok(Math.abs(result.conditionalVariance[1] - 1) < 1e-10);
  assert.ok(Math.abs(result.normalizedRms ** 2 - result.normalizedBarycentricRms ** 2 - result.normalizedConditionalRms ** 2) < 1e-12);
  assert.ok(result.maxMarginalError < 1e-10);
});

test("entropic transport enforces both marginals at a finite-grid boundary", () => {
  const result = solveEntropicGridTransport({
    source: [0.7, 0.2, 0.1, 0, 0],
    target: [0, 0, 0.1, 0.3, 0.6],
    width: 5,
    height: 1,
    sigma: 0.8,
    minIterations: 28,
    maxIterations: 3000,
    tolerance: 1e-11,
    normalization: 5,
  });

  assert.ok(result.sourceMarginalL1 < 1e-9, `source L1 ${result.sourceMarginalL1}`);
  assert.ok(result.targetMarginalL1 < 1e-9, `target L1 ${result.targetMarginalL1}`);
  assert.ok(result.maxMarginalError < 1e-9, `max error ${result.maxMarginalError}`);
  assert.ok(result.normalizedRms >= 0 && result.normalizedRms <= 1);
});

test("entropic transport is identical across repeated fixed-source runs", () => {
  const source = [6, 3, 1, 0];
  const target = [1, 2, 3, 4];
  const options = {
    source,
    target,
    width: 4,
    height: 1,
    sigma: 1.1,
    minIterations: 28,
    maxIterations: 1000,
    tolerance: 1e-12,
    normalization: 4,
  };
  const first = solveEntropicGridTransport(options);
  const second = solveEntropicGridTransport(options);
  assert.deepEqual(second, first);
  assert.deepEqual(source, [6, 3, 1, 0]);
  assert.deepEqual(target, [1, 2, 3, 4]);
});

test("point binning uses floor-consistent cells", () => {
  assert.deepEqual(
    binPointMass({
      points: [{ x: 0, y: 0 }, { x: 9.999, y: 9.999 }, { x: 10, y: 0 }],
      width: 2,
      height: 1,
      cellWidth: 10,
      cellHeight: 10,
    }),
    [2 / 3, 1 / 3],
  );
});

test("least-squares fit returns the hand-checked OLS and HC1 fixture", () => {
  const fit = fitLeastSquares([
    { x: 0, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 5 },
  ]);

  assert.ok(fit);
  assert.equal(fit.n, 4);
  assert.ok(Math.abs(fit.b0 - 0.7) < 1e-12);
  assert.ok(Math.abs(fit.b1 - 1.2) < 1e-12);
  assert.ok(Math.abs(fit.seHC1 - Math.sqrt(0.1288)) < 1e-12);
  assert.ok(Math.abs(fit.r2 - 0.8) < 1e-12);
  assert.equal(fit.tcrit, 4.30265273);
});

test("least-squares fit rejects an unidentified slope", () => {
  assert.equal(
    fitLeastSquares([
      { x: 2, y: 1 },
      { x: 2, y: 3 },
      { x: 2, y: 5 },
    ]),
    null,
  );
});

test("least-squares fit uses an accurate large-sample t critical value at n=102", () => {
  const points = Array.from({ length: 102 }, (_, x) => ({ x, y: 2 * x + (x % 3) - 1 }));
  const fit = fitLeastSquares(points);
  assert.ok(fit);
  assert.ok(Math.abs(fit.tcrit - 1.983971519) < 5e-7, `tcrit ${fit.tcrit}`);
});

test("SVG hit radii remain at least 44 CSS pixels after mobile viewBox scaling", () => {
  for (const scale of [236.41 / 1000, 276.41 / 1000]) {
    const radius = svgHitRadiusForCssTarget({ scaleX: scale, scaleY: scale });
    const renderedDiameter = 2 * radius * scale;
    assert.ok(renderedDiameter >= 44.5, `rendered diameter ${renderedDiameter}`);
    assert.ok(renderedDiameter < 45.000001, `rendered diameter ${renderedDiameter}`);
  }
  const anisotropicRadius = svgHitRadiusForCssTarget({ scaleX: 0.5, scaleY: 0.25 });
  assert.ok(2 * anisotropicRadius * 0.25 >= 44);
  assert.equal(MINIMUM_SVG_TARGET_CSS_PX, 44);
});

test("canceling an existing least-squares drag restores its original coordinates", () => {
  const moved = [{ x: 12, y: 18 }, { x: 70, y: 90 }];
  assert.deepEqual(
    resolveLeastSquaresGesture({
      points: moved,
      index: 1,
      originalPoint: { x: 40, y: 50 },
      addedDuringGesture: false,
      canceled: true,
      movement: 70,
    }),
    [{ x: 12, y: 18 }, { x: 40, y: 50 }],
  );
});

test("completing an existing least-squares drag commits its moved coordinates", () => {
  const moved = [{ x: 12, y: 18 }, { x: 70, y: 90 }];
  assert.deepEqual(
    resolveLeastSquaresGesture({
      points: moved,
      index: 1,
      originalPoint: { x: 40, y: 50 },
      addedDuringGesture: false,
      canceled: false,
      movement: 70,
    }),
    moved,
  );
});

test("relay state keeps all representations on one demand-curve result", () => {
  assert.deepEqual(relayState(20), {
    price: 20,
    quantity: 50,
    revenue: 1000,
    elasticity: -0.8,
  });
});

test("relay graph geometry agrees with Q = 90 - 2P", () => {
  assert.deepEqual(relayGraphGeometry(20), {
    point: { x: 295, y: 168 },
    path: "M60 53L483 260",
  });
});

test("CDE facts use the reported exact interval and preserve descriptive limits", () => {
  assert.deepEqual(CDE_FACTS, {
    rawGap: -0.262,
    meanWithinCde: -0.047,
    exact95Ci: [-0.245, 0.152],
    medianWithinCde: -0.001,
    baseComposition: -0.185,
    explainedShare: 0.86,
    design: "descriptive and noncausal",
    mechanism: "unresolved",
  });
});

test("CDE state sequence distinguishes estimates from explained movement", () => {
  assert.deepEqual(cdeState("raw"), {
    key: "raw",
    label: "Raw rural gap",
    estimate: -0.262,
    interval: null,
    interpretation: "Unadjusted rural-versus-urban private-leverage gap.",
  });
  assert.deepEqual(cdeState("within"), {
    key: "within",
    label: "Mean within-CDE estimate",
    estimate: -0.047,
    interval: [-0.245, 0.152],
    interpretation: "Exact 95% confidence interval [−0.245, +0.152].",
  });
  assert.deepEqual(cdeState("composition"), {
    key: "composition",
    label: "Observed CDE composition",
    estimate: -0.185,
    interval: null,
    interpretation: "86% of explained movement in the base descriptive decomposition.",
  });
});

test("CDE observed-composition movement is 86 percent of raw-to-within movement", () => {
  const rawToWithin = CDE_FACTS.meanWithinCde - CDE_FACTS.rawGap;
  assert.ok(Math.abs(Math.abs(CDE_FACTS.baseComposition) / rawToWithin - CDE_FACTS.explainedShare) < 0.001);
});

test("research graph derives one weighted edge from shared tags", () => {
  const graph = buildResearchGraph([
    { id: "a", title: "Paper A", year: 2026, tags: ["panel", "trade"] },
    { id: "b", title: "Paper B", year: 2025, tags: ["network", "trade"] },
    { id: "c", title: "Paper C", year: 2024, tags: ["education"] },
  ]);

  assert.equal(graph.nodes.length, 3);
  assert.deepEqual(graph.edges, [{ a: 0, b: 1, w: 1, shared: ["trade"] }]);
});

test("research graph filter retains matching nodes and only their edges", () => {
  const graph = buildResearchGraph([
    { id: "a", title: "Paper A", year: 2026, maturity: "working", tags: ["panel", "trade"] },
    { id: "b", title: "Paper B", year: 2025, maturity: "circulating", tags: ["network", "trade"] },
    { id: "c", title: "Paper C", year: 2024, maturity: "working", tags: ["education"] },
  ]);
  assert.deepEqual(filterResearchGraph(graph, { tag: "trade", maturity: "working" }), {
    nodeIndexes: [0],
    edgeIndexes: [],
  });
});

test("research graph layout always stops at its frame cap", () => {
  assert.equal(shouldContinueGraphLayout({ energy: 10, dragging: true, frame: GRAPH_MAX_FRAMES }), false);
  assert.equal(shouldContinueGraphLayout({ energy: 10, dragging: false, frame: GRAPH_MAX_FRAMES - 1 }), true);
  assert.equal(shouldContinueGraphLayout({ energy: 0.001, dragging: false, frame: 1 }), false);
});
