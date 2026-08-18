const T95 = Object.freeze([
  12.706204736, 4.30265273, 3.182446305, 2.776445105, 2.570581836,
  2.446911851, 2.364624252, 2.306004135, 2.262157163, 2.228138852,
  2.20098516, 2.17881283, 2.160368656, 2.144786688, 2.131449546,
  2.119905299, 2.109815578, 2.10092204, 2.093024054, 2.085963447,
  2.079613845, 2.073873068, 2.06865761, 2.063898562, 2.059538553,
  2.055529439, 2.051830516, 2.048407142, 2.045229642, 2.042272456,
]);

const NORMAL_975 = 1.959963984540054;
export const GRAPH_MAX_FRAMES = 700;
export const MINIMUM_SVG_TARGET_CSS_PX = 44;
const SVG_HIT_TARGET_ROUNDING_GUARD_CSS_PX = 1;

export const CDE_FACTS = Object.freeze({
  rawGap: -0.262,
  meanWithinCde: -0.047,
  exact95Ci: Object.freeze([-0.245, 0.152]),
  medianWithinCde: -0.001,
  baseComposition: -0.185,
  explainedShare: 0.86,
  design: "descriptive and noncausal",
  mechanism: "unresolved",
});

export function cdeState(key) {
  if (key === "within") {
    return {
      key,
      label: "Mean within-CDE estimate",
      estimate: CDE_FACTS.meanWithinCde,
      interval: [...CDE_FACTS.exact95Ci],
      interpretation: "Exact 95% confidence interval [−0.245, +0.152].",
    };
  }
  if (key === "composition") {
    return {
      key,
      label: "Observed CDE composition",
      estimate: CDE_FACTS.baseComposition,
      interval: null,
      interpretation: "86% of explained movement in the base descriptive decomposition.",
    };
  }
  return {
    key: "raw",
    label: "Raw rural gap",
    estimate: CDE_FACTS.rawGap,
    interval: null,
    interpretation: "Unadjusted rural-versus-urban private-leverage gap.",
  };
}

export function formatSinkhornReadout(result, { sampleSize = 3000 } = {}) {
  return `regularized W₂ approximation = ${result.normalizedRms.toFixed(3)} viewport diagonals · Sinkhorn k=${result.iterations} · marginal max ${result.maxMarginalError.toExponential(1)} · n=${sampleSize.toLocaleString("en-US")}`;
}

export function studentTCritical95(df) {
  if (!Number.isFinite(df) || df < 1) throw new RangeError("df must be a positive finite number");
  const integerDf = Math.floor(df);
  if (integerDf <= T95.length) return T95[integerDf - 1];
  const z = NORMAL_975;
  const inverseDf = 1 / df;
  const first = (z ** 3 + z) * inverseDf / 4;
  const second = (5 * z ** 5 + 16 * z ** 3 + 3 * z) * inverseDf ** 2 / 96;
  const third = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) * inverseDf ** 3 / 384;
  return z + first + second + third;
}

function normalizedMass(values, label) {
  if (!values || values.length === 0) throw new RangeError(`${label} must contain mass`);
  let sum = 0;
  const normalized = Float64Array.from(values, (value) => {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} mass must be finite and nonnegative`);
    sum += value;
    return value;
  });
  if (!(sum > 0)) throw new RangeError(`${label} mass must have a positive total`);
  for (let index = 0; index < normalized.length; index += 1) normalized[index] /= sum;
  return normalized;
}

function gaussianKernel(length, sigma) {
  const kernel = new Float64Array(length);
  for (let distance = 0; distance < length; distance += 1) {
    kernel[distance] = Math.exp(-(distance * distance) / (2 * sigma * sigma));
  }
  return kernel;
}

function applySymmetricGaussian(values, width, height, horizontalKernel, verticalKernel) {
  const temporary = new Float64Array(values.length);
  const output = new Float64Array(values.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let sourceX = 0; sourceX < width; sourceX += 1) {
        sum += values[y * width + sourceX] * horizontalKernel[Math.abs(sourceX - x)];
      }
      temporary[y * width + x] = sum;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let sourceY = 0; sourceY < height; sourceY += 1) {
        sum += temporary[sourceY * width + x] * verticalKernel[Math.abs(sourceY - y)];
      }
      output[y * width + x] = sum;
    }
  }
  return output;
}

function marginalDiagnostics(source, target, u, v, applyKernel) {
  const kernelV = applyKernel(v);
  const kernelU = applyKernel(u);
  const sourceMarginal = new Float64Array(source.length);
  const targetMarginal = new Float64Array(target.length);
  let sourceMarginalL1 = 0;
  let targetMarginalL1 = 0;
  let maxMarginalError = 0;
  for (let index = 0; index < source.length; index += 1) {
    sourceMarginal[index] = u[index] * kernelV[index];
    targetMarginal[index] = v[index] * kernelU[index];
    const sourceError = Math.abs(sourceMarginal[index] - source[index]);
    const targetError = Math.abs(targetMarginal[index] - target[index]);
    sourceMarginalL1 += sourceError;
    targetMarginalL1 += targetError;
    maxMarginalError = Math.max(maxMarginalError, sourceError, targetError);
  }
  return { sourceMarginal, targetMarginal, sourceMarginalL1, targetMarginalL1, maxMarginalError, kernelV };
}

export function solveEntropicGridTransport({
  source,
  target,
  width,
  height,
  sigma = 5,
  minIterations = 28,
  maxIterations = 1000,
  tolerance = 1e-9,
  xCoordinates,
  yCoordinates,
  normalization = 1,
}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new RangeError("width and height must be positive integers");
  const cellCount = width * height;
  if (source.length !== cellCount || target.length !== cellCount) throw new RangeError("mass arrays must match width × height");
  if (!(sigma > 0) || !(normalization > 0)) throw new RangeError("sigma and normalization must be positive");
  const sourceMass = normalizedMass(source, "source");
  const targetMass = normalizedMass(target, "target");
  const horizontalKernel = gaussianKernel(width, sigma);
  const verticalKernel = gaussianKernel(height, sigma);
  const applyKernel = (values) => applySymmetricGaussian(values, width, height, horizontalKernel, verticalKernel);
  const u = new Float64Array(cellCount).fill(1);
  const v = new Float64Array(cellCount).fill(1);
  let diagnostics;
  let iterations = 0;
  for (; iterations < maxIterations; iterations += 1) {
    const kernelV = applyKernel(v);
    for (let index = 0; index < cellCount; index += 1) {
      u[index] = sourceMass[index] === 0 ? 0 : sourceMass[index] / Math.max(kernelV[index], Number.MIN_VALUE);
    }
    const kernelU = applyKernel(u);
    for (let index = 0; index < cellCount; index += 1) {
      v[index] = targetMass[index] === 0 ? 0 : targetMass[index] / Math.max(kernelU[index], Number.MIN_VALUE);
    }
    if (iterations + 1 >= minIterations) {
      diagnostics = marginalDiagnostics(sourceMass, targetMass, u, v, applyKernel);
      if (diagnostics.maxMarginalError <= tolerance) { iterations += 1; break; }
    }
  }
  diagnostics ??= marginalDiagnostics(sourceMass, targetMass, u, v, applyKernel);
  if (iterations === maxIterations) diagnostics = marginalDiagnostics(sourceMass, targetMass, u, v, applyKernel);

  const coordinateX = xCoordinates
    ? Float64Array.from(xCoordinates)
    : Float64Array.from({ length: cellCount }, (_, index) => (index % width) + 0.5);
  const coordinateY = yCoordinates
    ? Float64Array.from(yCoordinates)
    : Float64Array.from({ length: cellCount }, (_, index) => Math.floor(index / width) + 0.5);
  if (coordinateX.length !== cellCount || coordinateY.length !== cellCount) throw new RangeError("coordinate arrays must match mass arrays");

  const weightedX = Float64Array.from(v, (value, index) => value * coordinateX[index]);
  const weightedY = Float64Array.from(v, (value, index) => value * coordinateY[index]);
  const weightedSecondMoment = Float64Array.from(v, (value, index) => value * (coordinateX[index] ** 2 + coordinateY[index] ** 2));
  const kernelWeightedX = applyKernel(weightedX);
  const kernelWeightedY = applyKernel(weightedY);
  const kernelWeightedSecondMoment = applyKernel(weightedSecondMoment);
  const conditionalMeanX = new Float64Array(cellCount);
  const conditionalMeanY = new Float64Array(cellCount);
  const conditionalSecondMoment = new Float64Array(cellCount);
  const conditionalVariance = new Float64Array(cellCount);
  let barycentricCost = 0;
  let conditionalVarianceContribution = 0;
  let couplingMass = 0;
  for (let index = 0; index < cellCount; index += 1) {
    const denominator = diagnostics.kernelV[index];
    if (!(denominator > 0)) continue;
    conditionalMeanX[index] = kernelWeightedX[index] / denominator;
    conditionalMeanY[index] = kernelWeightedY[index] / denominator;
    conditionalSecondMoment[index] = kernelWeightedSecondMoment[index] / denominator;
    conditionalVariance[index] = Math.max(0, conditionalSecondMoment[index] - conditionalMeanX[index] ** 2 - conditionalMeanY[index] ** 2);
    const rowMass = diagnostics.sourceMarginal[index];
    barycentricCost += rowMass * ((conditionalMeanX[index] - coordinateX[index]) ** 2 + (conditionalMeanY[index] - coordinateY[index]) ** 2);
    conditionalVarianceContribution += rowMass * conditionalVariance[index];
    couplingMass += rowMass;
  }
  const transportCost = Math.max(0, barycentricCost + conditionalVarianceContribution);
  const rms = Math.sqrt(transportCost / couplingMass);
  const barycentricRms = Math.sqrt(Math.max(0, barycentricCost) / couplingMass);
  const conditionalRms = Math.sqrt(Math.max(0, conditionalVarianceContribution) / couplingMass);
  return {
    iterations,
    converged: diagnostics.maxMarginalError <= tolerance,
    tolerance,
    transportCost,
    rms,
    normalizedRms: rms / normalization,
    normalizedBarycentricRms: barycentricRms / normalization,
    normalizedConditionalRms: conditionalRms / normalization,
    sourceMarginal: Array.from(diagnostics.sourceMarginal),
    targetMarginal: Array.from(diagnostics.targetMarginal),
    sourceMarginalL1: diagnostics.sourceMarginalL1,
    targetMarginalL1: diagnostics.targetMarginalL1,
    maxMarginalError: diagnostics.maxMarginalError,
    conditionalMeanX: Array.from(conditionalMeanX),
    conditionalMeanY: Array.from(conditionalMeanY),
    conditionalSecondMoment: Array.from(conditionalSecondMoment),
    conditionalVariance: Array.from(conditionalVariance),
  };
}

export function binPointMass({ points, width, height, cellWidth, cellHeight }) {
  const bins = new Float64Array(width * height);
  for (const point of points) {
    const x = Math.min(width - 1, Math.max(0, Math.floor(point.x / cellWidth)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(point.y / cellHeight)));
    bins[y * width + x] += 1;
  }
  const total = points.length;
  return Array.from(bins, (value) => value / total);
}

export function fitLeastSquares(points) {
  const n = points.length;
  if (n < 3) return null;

  let sx = 0;
  let sy = 0;
  for (const point of points) {
    sx += point.x;
    sy += point.y;
  }
  const mx = sx / n;
  const my = sy / n;

  let Sxx = 0;
  let Sxy = 0;
  for (const point of points) {
    Sxx += (point.x - mx) ** 2;
    Sxy += (point.x - mx) * (point.y - my);
  }
  if (Sxx < 1e-9) return null;

  const b1 = Sxy / Sxx;
  const b0 = my - b1 * mx;
  let sse = 0;
  let sst = 0;
  let hc = 0;
  for (const point of points) {
    const residual = point.y - (b0 + b1 * point.x);
    sse += residual * residual;
    sst += (point.y - my) ** 2;
    hc += residual * residual * (point.x - mx) ** 2;
  }

  const df = n - 2;
  const s2 = sse / df;
  const seHC1 = Math.sqrt((hc / (Sxx * Sxx)) * (n / df));
  const r2 = sst > 1e-9 ? 1 - sse / sst : 1;
  const tcrit = studentTCritical95(df);
  return { n, mx, Sxx, b0, b1, s2, seHC1, r2, tcrit };
}

export function svgHitRadiusForCssTarget({
  scaleX,
  scaleY,
  minimumCssPixels = MINIMUM_SVG_TARGET_CSS_PX,
}) {
  const limitingScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
  if (!(limitingScale > 0) || !Number.isFinite(limitingScale)) throw new RangeError("SVG screen scales must be finite and nonzero");
  if (!(minimumCssPixels > 0) || !Number.isFinite(minimumCssPixels)) throw new RangeError("minimum CSS target size must be positive and finite");
  return (minimumCssPixels + SVG_HIT_TARGET_ROUNDING_GUARD_CSS_PX) / (2 * limitingScale);
}

export function resolveLeastSquaresGesture({
  points,
  index,
  originalPoint,
  addedDuringGesture = false,
  canceled = false,
  movement = 0,
  clickThreshold = 5,
}) {
  const next = points.map((point) => ({ ...point }));
  if (!Number.isInteger(index) || index < 0 || index >= next.length) return next;
  if (canceled) {
    if (addedDuringGesture) next.splice(index, 1);
    else if (originalPoint) next[index] = { ...originalPoint };
    return next;
  }
  if (!addedDuringGesture && movement < clickThreshold) next.splice(index, 1);
  return next;
}

export function relayState(price) {
  const quantity = 90 - 2 * price;
  return {
    price,
    quantity,
    revenue: price * quantity,
    elasticity: (-2 * price) / quantity,
  };
}

export function relayGraphGeometry(price) {
  const { quantity } = relayState(price);
  return {
    point: {
      x: 60 + quantity / 100 * 470,
      y: 260 - price / 50 * 230,
    },
    path: "M60 53L483 260",
  };
}

export function shouldContinueGraphLayout({ energy, dragging, frame, maxFrames = GRAPH_MAX_FRAMES }) {
  if (frame >= maxFrames) return false;
  return dragging || energy >= 0.02;
}

export function buildResearchGraph(papers) {
  const nodes = papers.map((paper) => ({
    id: paper.id,
    short: paper.short ?? paper.title.slice(0, 16),
    title: paper.title,
    year: paper.year,
    maturity: paper.maturity,
    status: paper.status,
    tags: [...paper.tags],
  }));
  const edges = [];
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const shared = nodes[a].tags.filter((tag) => nodes[b].tags.includes(tag));
      if (shared.length > 0) edges.push({ a, b, w: shared.length, shared });
    }
  }
  return { nodes, edges };
}

export function filterResearchGraph(graph, { tag = "all", maturity = "all" } = {}) {
  const nodeIndexes = [];
  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    const matchesTag = tag === "all" || node.tags.includes(tag);
    const matchesMaturity = maturity === "all" || node.maturity === maturity;
    if (matchesTag && matchesMaturity) nodeIndexes.push(index);
  }
  const included = new Set(nodeIndexes);
  const edgeIndexes = [];
  for (let index = 0; index < graph.edges.length; index += 1) {
    const edge = graph.edges[index];
    if (included.has(edge.a) && included.has(edge.b)) edgeIndexes.push(index);
  }
  return { nodeIndexes, edgeIndexes };
}
