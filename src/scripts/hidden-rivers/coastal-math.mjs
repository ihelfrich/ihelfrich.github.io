/** Cosine uses the published integer components directly. Each published vector
 * has one positive scale, which cancels from dot(a,b)/(|a||b|). No PCA is used. */
export function vectorNorms(vectors, dimensions, valid) {
  const n = vectors.length / dimensions;
  if (!Number.isInteger(n) || valid.length !== n) throw new Error('Embedding dimensions disagree.');
  const norms = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!valid[i]) continue;
    let ss = 0;
    for (let k = 0; k < dimensions; k++) ss += vectors[i * dimensions + k] ** 2;
    norms[i] = Math.sqrt(ss);
  }
  return norms;
}

export function cosineAt(vectors, norms, dimensions, a, b) {
  if (!norms[a] || !norms[b]) return NaN;
  let dot = 0;
  for (let k = 0; k < dimensions; k++) dot += vectors[a * dimensions + k] * vectors[b * dimensions + k];
  return Math.max(-1, Math.min(1, dot / (norms[a] * norms[b])));
}

export function similarityField(vectors, norms, dimensions, anchor) {
  if (!norms[anchor]) throw new Error('No valid embedding at this reference pixel.');
  const result = new Float32Array(norms.length);
  for (let i = 0; i < norms.length; i++) result[i] = cosineAt(vectors, norms, dimensions, anchor, i);
  return result;
}

export function contrastField(a, b) {
  if (a.length !== b.length) throw new Error('Reference fields disagree.');
  return Float32Array.from(a, (value, i) => value - b[i]);
}

export function fieldSummary(values, threshold) {
  let count = 0, above = 0, sum = 0;
  const histogram = new Uint32Array(40);
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    count++; sum += v; if (v >= threshold) above++;
    histogram[Math.max(0, Math.min(39, Math.floor((v + 1) * 20)))]++;
  }
  return {count, above, fraction: count ? above / count : null, mean: count ? sum / count : null, histogram};
}

/** Greedy spatial exclusion prevents the results being five adjacent pixels.
 * Pixel distance uses the published projected grid, not degrees. */
export function separatedMatches(scores, width, spacing, anchor, {count = 5, separation = 300, excludeRadius = 400} = {}) {
  const ax = anchor % width, ay = Math.floor(anchor / width);
  const candidates = [];
  for (let i = 0; i < scores.length; i++) {
    if (!Number.isFinite(scores[i])) continue;
    if (Math.hypot(i % width - ax, Math.floor(i / width) - ay) * spacing < excludeRadius) continue;
    candidates.push(i);
  }
  candidates.sort((a, b) => scores[b] - scores[a] || a - b);
  const selected = [];
  for (const i of candidates) {
    if (selected.every(j => Math.hypot(i % width - j % width, Math.floor(i / width) - Math.floor(j / width)) * spacing >= separation)) selected.push(i);
    if (selected.length >= count) break;
  }
  return selected;
}
