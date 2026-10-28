// Pure physics and geometry for the home-page gravity field. No DOM and no d3, so every part can be
// tested directly (tests/unit/gravity-field.test.mjs). The page layer is src/scripts/home-graph.mjs.
//
// Model. Each page i is a mass m_i set by its length and its number of links. The terrain is the
// softened potential phi(x) = sum_i m_i / sqrt(|x - x_i|^2 + h_i^2), sampled on a grid and drawn as
// contours. Choosing a page gives it a deep well; the other pages are pulled by springs towards rings
// at their link distance (breadth-first hops) from the chosen page. The rings are a layout rule, not a
// consequence of the potential, and the public copy says so.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Deterministic jitter in [0, 1) for page index i. */
export const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Mass of a page from its size in KB and its number of links. */
export function pageMass(kb, degree) {
  return 0.4 + 0.5 * Math.sqrt(Math.max(0, kb) / 60) + degree / 10;
}

/** Scale factors for a stage of W x H pixels: S scales distances, RS scales mark radii. */
export function stageScales(W, H) {
  const m = Math.min(W, H) / 620;
  return { S: clamp(m, 0.6, 1.2), RS: clamp(m, 0.74, 1.1) };
}

/** Drawn radius of a page mark at rest. */
export function markRadius(mass, isHome, RS) {
  return RS * (isHome ? 7.6 : 1.1 + 2.5 * Math.sqrt(mass));
}

/** Topic basins, as fractions of the half-width and half-height of the stage. */
export const TOPIC_ANCHORS = Object.freeze({
  trade: [-0.72, -0.06],
  measurement: [-0.16, -0.66],
  place: [0.5, -0.48],
  teaching: [0.62, 0.34],
  profile: [-0.36, 0.58],
});

/** Mean of a page's topic anchors, in stage coordinates. */
export function topicAnchor(topics, cx, cy, ax, ay) {
  const list = topics && topics.length ? topics : ["profile"];
  let x = 0, y = 0;
  for (const t of list) { const a = TOPIC_ANCHORS[t] || TOPIC_ANCHORS.profile; x += a[0]; y += a[1]; }
  return [cx + (x / list.length) * ax, cy + (y / list.length) * ay];
}

/** First sentence of a description, ignoring full stops in abbreviations and initials. */
export function firstSentence(text) {
  const t = String(text || "");
  const re = /([.!?])\s+(?=[A-Z0-9])/g;
  let m;
  while ((m = re.exec(t))) {
    const w = t.slice(0, m.index).split(/\s/).pop();
    if (w.length > 2 && !/^(St|Dr|Mr|Ms|Mrs|U\.S|e\.g|i\.e|vs|No)$/.test(w)) return t.slice(0, m.index + 1);
  }
  return t;
}

/** Adjacency lists and degrees for n pages and [a, b] index links. */
export function adjacency(n, links) {
  const adj = Array.from({ length: n }, () => []);
  const deg = new Int32Array(n);
  for (const [a, b] of links) { adj[a].push(b); adj[b].push(a); deg[a]++; deg[b]++; }
  return { adj, deg };
}

/** Breadth-first link distance from page c, capped: every page three or more links away gets `cap`. */
export function hopRings(adj, c, cap = 3) {
  const h = new Int8Array(adj.length).fill(cap);
  h[c] = 0;
  const q = [c];
  for (let k = 0; k < q.length; k++) {
    const u = q[k];
    if (h[u] >= cap - 1) continue;
    for (const v of adj[u]) if (h[v] > h[u] + 1) { h[v] = h[u] + 1; q.push(v); }
  }
  return h;
}

/* ---------- potential ---------- */

/** Softened potential at (x, y) of the first n bodies with positions X, Y, masses M and softening lengths K. */
export function potentialAt(x, y, X, Y, M, K, n = X.length) {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const dx = x - X[i], dy = y - Y[i];
    v += M[i] / Math.sqrt(dx * dx + dy * dy + K[i] * K[i]);
  }
  return v;
}

/**
 * Samples the potential on a grid. Sample (gx, gy) sits at pixel (ox + gx * cell, oy + gy * cell), so a
 * negative origin samples a margin outside the stage and contours close beyond the frame.
 */
export function sampleField(vals, { gw, gh, cell, ox, oy }, X, Y, M, K, n = X.length) {
  vals.fill(0);
  for (let i = 0; i < n; i++) {
    const m = M[i];
    if (m < 1e-4) continue;
    const x = X[i] - ox, y = Y[i] - oy, h2 = K[i] * K[i];
    for (let gy = 0; gy < gh; gy++) {
      const dy = gy * cell - y, q = dy * dy + h2, o = gy * gw;
      let dx = -x;
      for (let gx = 0; gx < gw; gx++, dx += cell) vals[o + gx] += m / Math.sqrt(dx * dx + q);
    }
  }
  return vals;
}

/** Geometric contour levels from the 30th percentile of `values` past their maximum. */
export function contourLevels(values, { low = 0.3, perDecade = 16, max = 34 } = {}) {
  const v = Array.from(values).sort((a, b) => a - b);
  const lo = v[Math.floor(v.length * low)], hi = v[v.length - 1];
  if (!(lo > 0) || !(hi > lo)) return { levels: [], top: hi || 0 };
  const q = Math.pow(hi / lo, 1 / perDecade);
  const levels = [];
  for (let t = lo; levels.length < max && t < hi * 3; t *= q) levels.push(t);
  return { levels, top: hi };
}

/** Radius of the level-t contour of a single softened mass m with softening h: an exact circle. */
export function wellRadius(m, h, t) {
  const r = m / t;
  return r > h ? Math.sqrt(r * r - h * h) : 0;
}

/**
 * Contour levels for a single well of mass m and softening h: geometric from the level whose circle has
 * radius rOuter up to 90 per cent of the peak, so `count` circles fill the well at full depth.
 */
export function wellLevels(m, h, rOuter, count = 7) {
  const lo = m / Math.sqrt(rOuter * rOuter + h * h), hi = (0.9 * m) / h;
  if (!(hi > lo) || count < 2) return [lo];
  return Array.from({ length: count }, (_, k) => lo * Math.pow(hi / lo, k / (count - 1)));
}

/* ---------- contours ---------- */

/** Even-odd test of point (x, y) against a closed ring of [x, y] vertices. */
export function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringHasPoint(ring, px, py, count) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [u, v] of ring) { if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
  for (let k = 0; k < count; k++) {
    const x = px[k], y = py[k];
    if (x > x0 && x < x1 && y > y0 && y < y1 && ringContains(ring, x, y)) return true;
  }
  return false;
}

/**
 * Rings of one contour (a GeoJSON-style MultiPolygon from d3-contour) that enclose at least one page.
 * A closed contour around no page is a genuine local extremum of the field; it is left out of the
 * drawing because it suggests a page that is not there. px, py hold page positions in grid units.
 */
export function pageRings(geometry, px, py, count = px.length) {
  const out = [];
  for (const polygon of geometry.coordinates) {
    if (!polygon.length || !ringHasPoint(polygon[0], px, py, count)) continue;
    out.push(polygon[0]);
    for (let h = 1; h < polygon.length; h++) if (ringHasPoint(polygon[h], px, py, count)) out.push(polygon[h]);
  }
  return out;
}

/**
 * Traces a closed ring as a smooth curve through the midpoints of its edges (a quadratic B-spline),
 * mapping grid coordinate u to pixel ox + (u - 0.5) * k. `path` needs moveTo, quadraticCurveTo, closePath.
 */
export function traceSmoothRing(path, ring, k, ox, oy) {
  let m = ring.length;
  if (m > 1 && ring[0][0] === ring[m - 1][0] && ring[0][1] === ring[m - 1][1]) m--;
  if (m < 3) return;
  const X = (u) => ox + (u - 0.5) * k, Y = (v) => oy + (v - 0.5) * k;
  const mid = (a, b) => [(ring[a][0] + ring[b][0]) / 2, (ring[a][1] + ring[b][1]) / 2];
  const start = mid(m - 1, 0);
  path.moveTo(X(start[0]), Y(start[1]));
  for (let i = 0; i < m; i++) {
    const p = ring[i], q = mid(i, (i + 1) % m);
    path.quadraticCurveTo(X(p[0]), Y(p[1]), X(q[0]), Y(q[1]));
  }
  path.closePath();
}

/* ---------- physics ---------- */

/** Typed-array state for n pages and L links. */
export function createState(n, links) {
  const L = links.length;
  const f = () => new Float64Array(n);
  const s = {
    n, L, X: f(), Y: f(), VX: f(), VY: f(), FX: f(), FY: f(), TX: f(), TY: f(), PX0: f(), PY0: f(),
    M0: f(), MV: f(), MT: f(), KR: f(), KRT: f(), R0: f(), RAD: f(), RADT: f(),
    LA: new Int32Array(L), LB: new Int32Array(L), REST: new Float64Array(L), REST0: new Float64Array(L),
  };
  links.forEach(([a, b], l) => { s.LA[l] = a; s.LB[l] = b; });
  return s;
}

/**
 * Advances the state by dt seconds in three damped substeps and returns how busy it still is.
 * Forces: a spring from each page to its target, a spring along each link, and soft collisions.
 * A dragged page is kinematic: it sits exactly at (dragX, dragY) and its links pull the neighbours,
 * whose lag shows their mass.
 */
export function integrate(s, dt, { sel = -1, home = -1, drag = -1, dragX = 0, dragY = 0, gamma = 3.2, S = 1, RS = 1, coupling = 4.5 } = {}) {
  const { n, L, X, Y, VX, VY, FX, FY, TX, TY, M0, RAD, LA, LB, REST } = s;
  const sub = 3, h = dt / sub, amax = 2100 * S, damp = Math.exp(-gamma * h), pad = 2.5 * RS;
  for (let step = 0; step < sub; step++) {
    if (drag >= 0) { X[drag] = dragX; Y[drag] = dragY; VX[drag] = 0; VY[drag] = 0; }
    for (let i = 0; i < n; i++) {
      let k = 7 * Math.sqrt(M0[i]);
      if (i === sel) k = 30 * M0[i]; else if (sel < 0 && i === home) k = 60 * M0[i];
      FX[i] = k * (TX[i] - X[i]); FY[i] = k * (TY[i] - Y[i]);
    }
    for (let l = 0; l < L; l++) {
      const a = LA[l], b = LB[l], dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const f = ((a === drag || b === drag ? coupling : 4.5) * (d - REST[l])) / d;
      FX[a] += f * dx; FY[a] += f * dy; FX[b] -= f * dx; FY[b] -= f * dy;
    }
    for (let i = 0; i < n; i++) {
      const xi = X[i], yi = Y[i], ri = RAD[i] + pad;
      for (let j = i + 1; j < n; j++) {
        const dx = X[j] - xi, dy = Y[j] - yi, m = ri + RAD[j];
        if (dx > m || dx < -m || dy > m || dy < -m) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= m * m) continue;
        const d = Math.sqrt(d2) + 1e-6, f = (260 * (m - d)) / d;
        FX[i] -= f * dx; FY[i] -= f * dy; FX[j] += f * dx; FY[j] += f * dy;
      }
    }
    for (let i = 0; i < n; i++) {
      if (i === drag) continue;
      let ax = FX[i] / M0[i], ay = FY[i] / M0[i];
      const a = Math.hypot(ax, ay);
      if (a > amax) { ax *= amax / a; ay *= amax / a; }
      VX[i] = (VX[i] + ax * h) * damp; VY[i] = (VY[i] + ay * h) * damp;
      X[i] += VX[i] * h; Y[i] += VY[i] * h;
    }
  }
  const r = 1 - Math.exp(-dt * 3.6), rr = 1 - Math.exp(-dt * 7);
  let busy = 0;
  for (let i = 0; i < n; i++) {
    s.MV[i] += (s.MT[i] - s.MV[i]) * r; s.KR[i] += (s.KRT[i] - s.KR[i]) * r; RAD[i] += (s.RADT[i] - RAD[i]) * rr;
    busy = Math.max(busy, Math.abs(VX[i]) + Math.abs(VY[i]), Math.abs(s.MT[i] - s.MV[i]) * 40, Math.abs(s.KRT[i] - s.KR[i]));
  }
  return busy;
}

/* ---------- rings around a chosen page ---------- */

/**
 * Ellipses for the chosen page's first and second rings and for the outer band, sized to the stage
 * and to the number of pages on each ring. counts = [1, ring 1, ring 2, ring 3+]. minR1 asks for a first
 * ring at least that large (in its vertical semi-axis), within the room the stage allows.
 */
export function ringGeometry(W, H, { S, RS, narrow, top = 0, counts, minR1 = 0 }) {
  const cx = W / 2, cy = (H + top) / 2, ry = (H - top) / 2 - 24 * S, rx = W / 2 - 24 * S;
  const e = clamp(W / H, 0.82, 1.55);
  const perim = Math.PI * (1 + e);
  let R1 = Math.max((narrow ? 0.4 : 0.36) * ry, (counts[1] * (narrow ? 21 : 24) * RS) / perim, minR1);
  let R2 = Math.max(0.7 * ry, R1 + 60 * S, (counts[2] * 12 * RS) / perim);
  R2 = Math.min(R2, 0.8 * ry);
  R1 = Math.min(R1, R2 - 46 * S);
  const PX = Math.min(rx * 0.97, ry * 0.97 * Math.max(e, 1.25)), PY = ry * 0.96;
  return { cx, cy, e, R1, R2, PX, PY, counts };
}

/**
 * Spreads the pages of one ring evenly round an ellipse with semi-axes (fx, fy), keeping their angular
 * order as seen from (ox, oy) and rotating the set to the angle that moves them least. With a weight
 * function, each page takes a share of the ring in proportion to its weight instead of an equal one.
 */
export function placeOnRing(list, X, Y, ox, oy, e, cx, cy, fx, fy, TX, TY, weight = null) {
  const m = list.length;
  if (!m) return;
  const th = list.map((i) => [i, Math.atan2(Y[i] - oy, (X[i] - ox) / e)]).sort((a, b) => a[1] - b[1]);
  let slot = (k) => (TAU * k) / m;
  if (weight) {
    const w = th.map(([i]) => weight(i)), total = w.reduce((s, v) => s + v, 0), at = [];
    let run = 0;
    for (const v of w) { at.push((TAU * (run + v / 2)) / total); run += v; }
    slot = (k) => at[k];
  }
  let sx = 0, sy = 0;
  th.forEach(([, a], k) => { const d = a - slot(k); sx += Math.cos(d); sy += Math.sin(d); });
  const off = Math.atan2(sy, sx);
  th.forEach(([i], k) => {
    const a = off + slot(k), j = m > 30 ? (hash(i) - 0.5) * 0.06 : 0;
    TX[i] = cx + fx * (1 + j) * Math.cos(a);
    TY[i] = cy + fy * (1 + j) * Math.sin(a);
  });
}

/*
 * A ring can be closed off in places, so that the labels of the pages inside it can run through. A track
 * samples the ellipse (semi-axes fx, fy) at K points; closeTrack marks the samples near a label as closed,
 * and placeOnTrack spreads a ring's pages evenly along what is left open.
 */
export function ellipseTrack(cx, cy, fx, fy, K = 720) {
  const px = new Float64Array(K), py = new Float64Array(K), seg = new Float64Array(K);
  for (let k = 0; k < K; k++) { const a = (TAU * k) / K; px[k] = cx + fx * Math.cos(a); py[k] = cy + fy * Math.sin(a); }
  for (let k = 0; k < K; k++) { const j = (k + 1) % K; seg[k] = Math.hypot(px[j] - px[k], py[j] - py[k]); }
  return { K, cx, cy, fx, fy, px, py, seg, closed: new Uint8Array(K), open: -1 };
}

/** Open samples of track t within distance d of box b. */
export function trackHits(t, b, d) {
  // A box that, grown by d, lies inside the ellipse (which is convex) is nowhere near it.
  const { cx, cy, fx, fy } = t, inside = (x, y) => ((x - cx) / fx) ** 2 + ((y - cy) / fy) ** 2 < 1;
  const x0 = b[0] - d, y0 = b[1] - d, x1 = b[2] + d, y1 = b[3] + d;
  if (inside(x0, y0) && inside(x1, y0) && inside(x0, y1) && inside(x1, y1)) return [];
  const hits = [];
  for (let k = 0; k < t.K; k++) if (!t.closed[k] && boxDistance(b, t.px[k], t.py[k]) < d) hits.push(k);
  return hits;
}

/** Length of the open part of track t, as it would be with the samples in `also` closed too. */
export function trackLength(t, also = []) {
  if (!also.length && t.open >= 0) return t.open;
  for (const k of also) t.closed[k] = 2;
  let s = 0;
  for (let k = 0; k < t.K; k++) if (!t.closed[k] && !t.closed[(k + 1) % t.K]) s += t.seg[k];
  for (const k of also) t.closed[k] = 0;
  if (!also.length) t.open = s;
  return s;
}

export function closeTrack(t, hits) {
  for (const k of hits) t.closed[k] = 1;
  if (hits.length) t.open = -1;
}

/**
 * As placeOnRing, on the open part of track t: the pages keep their angular order as seen from (ox, oy)
 * (x scaled by 1/e), are spaced evenly along the open arcs, and take the rotation that moves them least.
 * A ring of more than 30 pages gets a radial jitter of up to +-jitter/2 of its radius.
 */
export function placeOnTrack(list, X, Y, ox, oy, e, t, TX, TY, jitter = 0.06) {
  const m = list.length, { K, cx, cy, fx, fy, px, py, seg, closed } = t;
  if (!m) return;
  const cum = new Float64Array(K + 1);
  for (let k = 0; k < K; k++) cum[k + 1] = cum[k] + (!closed[k] && !closed[(k + 1) % K] ? seg[k] : 0);
  const total = cum[K];
  if (total <= 0) { placeOnRing(list, X, Y, ox, oy, e, cx, cy, fx, fy, TX, TY); return; }
  const at = (u) => {
    u = ((u % total) + total) % total;
    let lo = 0, hi = K; // smallest hi with cum[hi] > u; segment hi - 1 is open and contains u
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] > u) hi = mid; else lo = mid; }
    const k = hi - 1, j = (k + 1) % K, f = (u - cum[k]) / seg[k];
    return [px[k] + (px[j] - px[k]) * f, py[k] + (py[j] - py[k]) * f];
  };
  const th = list.map((i) => [i, Math.atan2(Y[i] - oy, (X[i] - ox) / e)]).sort((a, b) => a[1] - b[1]);
  const step = total / m;
  let best = [0, 0], cost = Infinity;
  for (let q = 0; q < 4; q++) {
    const u0 = (step * q) / 4;
    const phi = th.map((_, k) => { const [x, y] = at(u0 + k * step); return Math.atan2((y - cy) / fy, (x - cx) / fx); });
    for (let r = 0; r < m; r++) {
      let c = 0;
      for (let k = 0; k < m; k++) c += 1 - Math.cos(th[k][1] - phi[(k + r) % m]);
      if (c < cost) { cost = c; best = [u0, r]; }
    }
  }
  const [u0, r] = best;
  th.forEach(([i], k) => {
    const [x, y] = at(u0 + ((k + r) % m) * step), j = m > 30 ? (hash(i) - 0.5) * jitter : 0;
    TX[i] = cx + (x - cx) * (1 + j);
    TY[i] = cy + (y - cy) * (1 + j);
  });
}

/* ---------- labels ---------- */

/**
 * Splits a label wider than maxW into two lines: after a colon or comma when that brings both lines
 * within maxW, otherwise at the space that best balances them. measure(text) returns a width. A label
 * with no ordinary space stays on one line (a no-break space keeps "Title ↗" together).
 */
export function wrapLabel(text, measure, maxW) {
  if (measure(text) <= maxW) return [text];
  const best = (ks) => {
    let out = null, w = Infinity;
    for (const k of ks) {
      const a = text.slice(0, k), b = text.slice(k + 1), v = Math.max(measure(a), measure(b));
      if (v < w) { w = v; out = [a, b]; }
    }
    return [out, w];
  };
  const spaces = [];
  for (let k = text.indexOf(" "); k > 0; k = text.indexOf(" ", k + 1)) spaces.push(k);
  if (!spaces.length) return [text];
  const [p, pw] = best(spaces.filter((k) => /[:,]$/.test(text.slice(0, k))));
  return p && pw <= maxW ? p : best(spaces)[0];
}

/**
 * How far a mark reaches from its centre: { e, w, n, s } along the axes and { ne, nw, se, sw }, the
 * smallest t such that no part of the mark lies beyond both x = ±t and y = ±t in that quadrant. A label
 * whose box starts beyond these distances clears the mark. ext is a radius (a circle) or reach object.
 */
export function reachBox(ext) {
  if (typeof ext !== "number") return ext;
  const d = ext / Math.SQRT2;
  return { e: ext, w: ext, n: ext, s: ext, ne: d, nw: d, se: d, sw: d };
}

/** Grows every reach by `pad` pixels. */
export function padReach(reach, pad) {
  const o = {};
  for (const k in reach) o[k] = reach[k] + pad;
  return o;
}

/** Reach of a page-type glyph of nominal radius r (see reachBox), measured from its outline. */
export function glyphReach(type, r) {
  const unit = GLYPH_REACH[type] || GLYPH_REACH.page, o = {};
  for (const k in unit) o[k] = unit[k] * r;
  return o;
}

/** Largest reach of a glyph of radius r in any direction: the radius of its circumscribed circle. */
export function glyphRadius(type, r) {
  const v = glyphVertices(type, r);
  return v ? Math.max(...v.map(([x, y]) => Math.hypot(x, y))) : r;
}

/**
 * Candidate top-left corners for a w x h label beside a mark at (x, y), whose reach is `ext` (a radius
 * or a reach object). 0-3 sit beside, above and below; 4-7 at the diagonals; 8-13 further out; 14-17
 * above and below, slid sideways so the label runs on from the mark rather than centring on it.
 */
export function labelCandidates(x, y, ext, w, h) {
  const r = reachBox(ext);
  return [
    [x + r.e, y - h / 2], [x - r.w - w, y - h / 2], [x - w / 2, y - r.n - h], [x - w / 2, y + r.s],
    [x + r.ne, y - r.ne - h], [x - r.nw - w, y - r.nw - h], [x + r.se, y + r.se], [x - r.sw - w, y + r.sw],
    [x - w / 2, y + r.s + 12], [x - w / 2, y - r.n - h - 12], [x + r.ne + 8, y - r.ne - h - 4], [x - r.nw - w - 8, y - r.nw - h - 4],
    [x + r.se + 8, y + r.se + 4], [x - r.sw - w - 8, y + r.sw + 4],
    [x - 0.2 * w, y - r.n - h], [x - 0.8 * w, y - r.n - h], [x - 0.2 * w, y + r.s], [x - 0.8 * w, y + r.s],
  ];
}

/** Candidate order for a page at rest: beside, above or below, diagonal, slid, then further out. */
export const LABEL_ORDER = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17, 10, 11, 12, 13, 8, 9]);

/** Candidate order that points a label away from (cx, cy), for pages arranged on rings. */
export function radialPreference(x, y, cx, cy) {
  const a = Math.atan2(y - cy, x - cx), c = Math.cos(a), s = Math.sin(a);
  if (c > 0.45) return s < 0 ? [0, 4, 10, 6, 2, 14, 12] : [0, 6, 12, 4, 3, 16, 10];
  if (c < -0.45) return s < 0 ? [1, 5, 11, 7, 2, 15, 13] : [1, 7, 13, 5, 3, 17, 11];
  return s < 0 ? [2, 14, 15, 9, 4, 5, 10, 11] : [3, 16, 17, 8, 6, 7, 12, 13];
}

/**
 * A label reads as belonging to its own mark when every other mark is at least this many times as far
 * from the label (plus a 2 px margin) as its own mark is.
 */
export const ASSOCIATION = 1.5;

/** Distance from point (x, y) to the box [x0, y0, x1, y1]; zero inside it. */
export function boxDistance(b, x, y) {
  const dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3]);
  return Math.hypot(dx, dy);
}

/** Box a label occupies, with its halo, when its text starts at (bx, by). */
export const labelBox = (it, bx, by) => [bx - 2, by - 1, bx + it.w + 2, by + it.h + 1];

/**
 * Greedy collision-free label placement. Items, in priority order: { key, i, x, y, r, w, h, cands?,
 * prefer?, force?, ratio? }, where r is the mark's reach (a radius or a reachBox object). A label never
 * overlaps an earlier label, stays inside the stage, avoids every other mark (centre X, Y and half-size
 * MR; a page with a negative MR is left out), and sits clearly closer to its own mark than to any other
 * (by `ratio`, or the item's own; see ASSOCIATION), so it cannot be read as another page's label.
 * `rival`, when given, grades the pages for that test: 2 for pages drawn at full strength (the full
 * margin applies), 1 for faded pages (the label must be nearer its own mark by `margin`), 0 for pages
 * that do not count. Without `cost`, the first place in the item's order that passes these tests wins.
 * `cost(item, box, k)`, when given, prices every place that passes (k is its rank in the item's order;
 * Infinity refuses it): the cheapest wins, ties going to the earlier place, and `onPlace(item, box)` is
 * told the choice. A forced label with no such place takes the one that covers, then misleads about, the
 * fewest marks. `last` keeps each label's previous candidate, tried first, so labels do not flicker.
 * Returns [[item, left, top], ...].
 */
export function placeLabels(items, { X, Y, MR, n, W, H, last = new Map(), inset = 4, ratio = ASSOCIATION, margin = 2, rival = null, cost = null, onPlace = null }) {
  const boxes = [], out = [];
  const inside = (b) => b[0] >= inset && b[2] <= W - inset && b[1] >= inset && b[3] <= H - inset;
  const hitBox = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const markHits = (b, own, stopAtOne) => {
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (i === own) continue;
      const r = MR[i];
      if (r < 0) continue;
      if (b[0] < X[i] + r && b[2] > X[i] - r && b[1] < Y[i] + r && b[3] > Y[i] - r) { k++; if (stopAtOne) return k; }
    }
    return k;
  };
  // Marks nearly as close to the label as its own mark is (measured centre to box).
  const rivals = (b, own, stopAtOne, kr = ratio) => {
    if (own < 0) return 0;
    const near = boxDistance(b, X[own], Y[own]), d = near * kr + margin;
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (i === own || (rival && !rival[i])) continue;
      const di = rival && rival[i] === 1 ? near + margin : d;
      const dx = Math.max(b[0] - X[i], 0, X[i] - b[2]);
      if (dx >= di) continue;
      if (Math.hypot(dx, Math.max(b[1] - Y[i], 0, Y[i] - b[3])) < di) { k++; if (stopAtOne) return k; }
    }
    return k;
  };
  for (const it of items) {
    const cands = it.cands || (() => {
      const all = labelCandidates(it.x, it.y, it.r, it.w, it.h);
      return (it.prefer || LABEL_ORDER).map((k) => all[k]);
    })();
    const prev = last.get(it.key);
    const order = prev != null && prev < cands.length ? [prev, ...cands.keys()] : [...cands.keys()];
    const own = it.i ?? -1;
    let pick = -1, price = Infinity;
    for (const c of order) {
      const [bx, by] = cands[c], b = labelBox(it, bx, by);
      if (!inside(b) || hitBox(b) || markHits(b, own, true) || rivals(b, own, true, it.ratio ?? ratio)) continue;
      if (!cost) { pick = c; break; }
      const k = cost(it, b, c);
      if (k < price) { price = k; pick = c; }
    }
    if (pick < 0 && it.force) {
      let fewest = Infinity;
      cands.forEach(([bx, by], c) => {
        const b = labelBox(it, bx, by);
        if (!inside(b) || hitBox(b)) return;
        const k = markHits(b, own, false) * 1000 + rivals(b, own, false, it.ratio ?? ratio);
        if (k < fewest) { fewest = k; pick = c; }
      });
    }
    if (pick < 0) continue;
    const [bx, by] = cands[pick], b = labelBox(it, bx, by);
    boxes.push(b); out.push([it, bx, by]); last.set(it.key, pick);
    if (onPlace) onPlace(it, b);
  }
  return out;
}

/**
 * Makes room in a rest layout for labels that must always show. For each item in turn (as placeLabels
 * takes them, with `i` set), picks the candidate place that needs the least movement of other pages, then
 * moves those pages (X, Y, in place) just far enough that the label covers none of them and its own
 * mark stays the nearest. Pages that carry one of these labels never move. Returns, per item key, the
 * index of the chosen candidate in the item's preference order, to seed placeLabels' `last`.
 */
export function reserveLabelRoom(items, { X, Y, MR, n, W, H, inset = 4, ratio = ASSOCIATION, margin = 2, slack = 2 }) {
  const pinned = new Set(items.map((it) => it.i)), boxes = [], chosen = new Map();
  const inside = (b) => b[0] >= inset && b[2] <= W - inset && b[1] >= inset && b[3] <= H - inset;
  const taken = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  // Clearance page j needs from box b: outside its own half-size on both axes, and farther than the owner.
  const need = (b, own, j) => Math.max(MR[j] * Math.SQRT2, boxDistance(b, X[own], Y[own]) * ratio + margin + slack);
  for (const it of items) {
    const all = labelCandidates(X[it.i], Y[it.i], it.r, it.w, it.h), order = it.prefer || LABEL_ORDER;
    let best = -1, cost = Infinity;
    order.forEach((k, c) => {
      const b = labelBox(it, ...all[k]);
      if (!inside(b) || taken(b)) return;
      let move = c * 0.5; // a slight preference for the usual order
      for (let j = 0; j < n && move < cost; j++) {
        if (j === it.i) continue;
        const gap = need(b, it.i, j) - boxDistance(b, X[j], Y[j]);
        if (gap <= 0) continue;
        if (pinned.has(j)) { move = Infinity; break; }
        move += gap;
      }
      if (move < cost) { cost = move; best = c; }
    });
    if (best < 0 || cost === Infinity) continue;
    const b = labelBox(it, ...all[order[best]]);
    boxes.push(b); chosen.set(it.key, best);
    for (let j = 0; j < n; j++) {
      if (j === it.i || pinned.has(j)) continue;
      const r = need(b, it.i, j);
      if (boxDistance(b, X[j], Y[j]) >= r) continue;
      // Push j straight away from the nearest point of the box; from inside, out through the nearest side.
      const px = clamp(X[j], b[0], b[2]), py = clamp(Y[j], b[1], b[3]);
      let dx = X[j] - px, dy = Y[j] - py, d = Math.hypot(dx, dy);
      if (d < 1e-6) {
        const sides = [[X[j] - b[0], -1, 0], [b[2] - X[j], 1, 0], [Y[j] - b[1], 0, -1], [b[3] - Y[j], 0, 1]].sort((a, c) => a[0] - c[0]);
        [, dx, dy] = sides[0]; d = 1;
        X[j] = (dx ? (dx < 0 ? b[0] : b[2]) : X[j]) + dx * r; Y[j] = (dy ? (dy < 0 ? b[1] : b[3]) : Y[j]) + dy * r;
      } else { X[j] = px + (dx / d) * (r + 0.5); Y[j] = py + (dy / d) * (r + 0.5); }
      X[j] = clamp(X[j], inset + MR[j], W - inset - MR[j]); Y[j] = clamp(Y[j], inset + MR[j], H - inset - MR[j]);
    }
  }
  return chosen;
}

/* ---------- marks ---------- */

/** Vertices of a page-type glyph of nominal radius r (null for a circle), shared by canvas and SVG. */
export function glyphVertices(type, r) {
  if (type === "paper") { const s = r * 0.89; return [[-s, -s], [s, -s], [s, s], [-s, s]]; }
  if (type === "data") { const s = r * 1.26; return [[0, -s], [s, 0], [0, s], [-s, 0]]; }
  if (type === "course") { const s = r * 1.5; return [[0, -s], [s * 0.866, s * 0.5], [-s * 0.866, s * 0.5]]; }
  if (type === "tool") {
    const o = r * 1.5, q = o * 0.46, p = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? q : o; p.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    return p;
  }
  return null;
}

// Reach of each glyph at unit radius (see reachBox), from points sampled along its outline. The
// quadrant reach max(min(±x, ±y)) of a polygon is attained on its outline.
const GLYPH_REACH = Object.freeze(Object.fromEntries(["paper", "data", "course", "tool", "page"].map((type) => {
  const v = glyphVertices(type, 1), pts = [];
  if (!v) for (let k = 0; k < 72; k++) pts.push([Math.cos((k * TAU) / 72), Math.sin((k * TAU) / 72)]);
  else v.forEach(([x0, y0], k) => {
    const [x1, y1] = v[(k + 1) % v.length];
    for (let t = 0; t < 1; t += 1 / 24) pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  });
  const max = (f) => Math.max(...pts.map(f));
  return [type, Object.freeze({
    e: max(([x]) => x), w: max(([x]) => -x), n: max(([, y]) => -y), s: max(([, y]) => y),
    ne: max(([x, y]) => Math.min(x, -y)), nw: max(([x, y]) => Math.min(-x, -y)),
    se: max(([x, y]) => Math.min(x, y)), sw: max(([x, y]) => Math.min(-x, y)),
  })];
})));

/** SVG path data for a glyph centred on the origin (circles return null). */
export function glyphPathData(type, r) {
  const v = glyphVertices(type, r);
  return v ? `M${v.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z` : null;
}

/* ---------- precomputed layout ---------- */

/** Reads a precomputed layout ({ w, h, xy: [x0, y0, x1, y1, ...] in 0..1 }) scaled to a W x H stage. */
export function scaleLayout(layout, n, W, H) {
  if (!layout || !Array.isArray(layout.xy) || layout.xy.length !== 2 * n) return null;
  const X = new Float64Array(n), Y = new Float64Array(n);
  for (let i = 0; i < n; i++) { X[i] = layout.xy[2 * i] * W; Y[i] = layout.xy[2 * i + 1] * H; }
  return { X, Y };
}
