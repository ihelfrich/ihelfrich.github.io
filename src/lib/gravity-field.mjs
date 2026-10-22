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
 * and to the number of pages on each ring. counts = [1, ring 1, ring 2, ring 3+].
 */
export function ringGeometry(W, H, { S, RS, narrow, top = 0, counts }) {
  const cx = W / 2, cy = (H + top) / 2, ry = (H - top) / 2 - 24 * S, rx = W / 2 - 24 * S;
  const e = clamp(W / H, 0.82, 1.55);
  const perim = Math.PI * (1 + e);
  let R1 = Math.max((narrow ? 0.4 : 0.36) * ry, (counts[1] * (narrow ? 21 : 24) * RS) / perim);
  let R2 = Math.max(0.7 * ry, R1 + 60 * S, (counts[2] * 12 * RS) / perim);
  R2 = Math.min(R2, 0.8 * ry);
  R1 = Math.min(R1, R2 - 46 * S);
  const PX = Math.min(rx * 0.97, ry * 0.97 * Math.max(e, 1.25)), PY = ry * 0.96;
  return { cx, cy, e, R1, R2, PX, PY, counts };
}

/**
 * Spreads the pages of one ring evenly round an ellipse with semi-axes (fx, fy), keeping their angular
 * order as seen from (ox, oy) and rotating the set to the angle that moves them least.
 */
export function placeOnRing(list, X, Y, ox, oy, e, cx, cy, fx, fy, TX, TY) {
  const m = list.length;
  if (!m) return;
  const th = list.map((i) => [i, Math.atan2(Y[i] - oy, (X[i] - ox) / e)]).sort((a, b) => a[1] - b[1]);
  let sx = 0, sy = 0;
  th.forEach(([, a], k) => { const d = a - (TAU * k) / m; sx += Math.cos(d); sy += Math.sin(d); });
  const off = Math.atan2(sy, sx);
  th.forEach(([i], k) => {
    const a = off + (TAU * k) / m, j = m > 30 ? (hash(i) - 0.5) * 0.06 : 0;
    TX[i] = cx + fx * (1 + j) * Math.cos(a);
    TY[i] = cy + fy * (1 + j) * Math.sin(a);
  });
}

/* ---------- labels ---------- */

/** Fourteen candidate top-left corners for a w x h label beside a mark of radius r at (x, y). */
export function labelCandidates(x, y, r, w, h) {
  return [
    [x + r, y - h / 2], [x - r - w, y - h / 2], [x - w / 2, y - r - h], [x - w / 2, y + r],
    [x + r - 2, y - r - h + 3], [x - r - w + 2, y - r - h + 3], [x + r - 2, y + r - 3], [x - r - w + 2, y + r - 3],
    [x - w / 2, y + r + 12], [x - w / 2, y - r - h - 12], [x + r + 8, y - r - h - 4], [x - r - w - 8, y - r - h - 4],
    [x + r + 8, y + r + 4], [x - r - w - 8, y + r + 4],
  ];
}

/** Candidate order that points a label away from (cx, cy), for pages arranged on rings. */
export function radialPreference(x, y, cx, cy) {
  const a = Math.atan2(y - cy, x - cx), c = Math.cos(a), s = Math.sin(a);
  if (c > 0.45) return s < 0 ? [0, 4, 10, 6, 2, 12] : [0, 6, 12, 4, 3, 10];
  if (c < -0.45) return s < 0 ? [1, 5, 11, 7, 2, 13] : [1, 7, 13, 5, 3, 11];
  return s < 0 ? [2, 9, 4, 5, 10, 11] : [3, 8, 6, 7, 12, 13];
}

/**
 * Greedy collision-free label placement. Items, in priority order: { key, i, x, y, r, w, h, cands?,
 * prefer?, force? }. A label never overlaps an earlier label, stays inside the stage, and avoids every
 * mark (marks: centre and hit radius per page). A forced label may cover the fewest marks instead of
 * disappearing. `last` keeps each label's previous candidate so labels do not flicker.
 * Returns [[item, left, top], ...].
 */
export function placeLabels(items, { X, Y, MR, n, W, H, last = new Map(), inset = 4 }) {
  const boxes = [], out = [];
  const inside = (b) => b[0] >= inset && b[2] <= W - inset && b[1] >= inset && b[3] <= H - inset;
  const hitBox = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const markHits = (b, own, stopAtOne) => {
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (i === own) continue;
      const r = MR[i];
      if (b[0] < X[i] + r && b[2] > X[i] - r && b[1] < Y[i] + r && b[3] > Y[i] - r) { k++; if (stopAtOne) return k; }
    }
    return k;
  };
  for (const it of items) {
    const cands = it.cands || (() => {
      const all = labelCandidates(it.x, it.y, it.r, it.w, it.h);
      return (it.prefer || [0, 1, 2, 3, 4, 5, 6, 7]).map((k) => all[k]);
    })();
    const prev = last.get(it.key);
    const order = prev != null && prev < cands.length ? [prev, ...cands.keys()] : [...cands.keys()];
    const own = it.i ?? -1;
    let done = false;
    for (const c of order) {
      const [bx, by] = cands[c], b = [bx - 2, by - 1, bx + it.w + 2, by + it.h + 1];
      if (!inside(b) || hitBox(b) || markHits(b, own, true)) continue;
      boxes.push(b); out.push([it, bx, by]); last.set(it.key, c); done = true;
      break;
    }
    if (!done && it.force) {
      let best = -1, fewest = Infinity;
      cands.forEach(([bx, by], c) => {
        const b = [bx - 2, by - 1, bx + it.w + 2, by + it.h + 1];
        if (!inside(b) || hitBox(b)) return;
        const k = markHits(b, own, false);
        if (k < fewest) { fewest = k; best = c; }
      });
      if (best >= 0) {
        const [bx, by] = cands[best];
        boxes.push([bx - 2, by - 1, bx + it.w + 2, by + it.h + 1]); out.push([it, bx, by]); last.set(it.key, best);
      }
    }
  }
  return out;
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
