// Home-page gravity field. Each page is a mass weighted by its length and its links; the terrain is
// the softened potential of those masses, drawn as contours. Choosing a page gives it a deep well and
// sets the other pages in rings by link distance. Physics and geometry are in src/lib/gravity-field.mjs;
// this module owns the canvases, the events and the listbox. mountHomeGraph(root) returns dispose().
import { contours as contourGenerator } from "d3-contour";
import { KIND_NAMES, TOPIC_NAMES, TOPIC_ORDER, TOPIC_SHORT } from "../data/field-topics.mjs";
import { FORCED_LANDMARKS, LANDMARKS, homeLabel } from "../data/home-graph.mjs";
import {
  TAU, adjacency, clamp, contourLevels, createState, firstSentence, glyphPathData, glyphVertices, hash, hopRings,
  integrate, markRadius, pageMass, pageRings, placeLabels, placeOnRing, radialPreference, ringGeometry,
  sampleField, scaleLayout, stageScales, traceSmoothRing, wellLevels, wellRadius,
} from "../lib/gravity-field.mjs";

/** Canvas paint order: labels come last, over every mark, each with a halo in the stage colour. */
export const PAINT_ORDER = Object.freeze(["terrain", "links", "marks", "labels"]);
export const LABEL_HALO_PX = 4;
const CHOSEN_HALO_PX = 7;
const WELL = 30; // mass of the chosen page's well
const LONG_PRESS_MS = 300; // touch: hold this long, nearly still, to drag a page
const TOUCH_SLOP = 8;
const STREAK_MS = 250;
const FRAME_BUDGET_MS = 8;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function glyphSVG(type, fill = "currentColor") {
  const d = glyphPathData(type, 4.6);
  const body = d ? `<path d="${d}"` : '<circle r="4.6"';
  return `<svg viewBox="-7 -7 14 14" aria-hidden="true" focusable="false">${body} fill="${fill}"/></svg>`;
}

function shapePath(c, type, x, y, r) {
  const v = glyphVertices(type, r);
  c.beginPath();
  if (!v) { c.arc(x, y, r, 0, TAU); return; }
  c.moveTo(x + v[0][0], y + v[0][1]);
  for (let k = 1; k < v.length; k++) c.lineTo(x + v[k][0], y + v[k][1]);
  c.closePath();
}

async function loadField() {
  const res = await fetch("/field.json");
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

let mounts = 0;

export function mountHomeGraph(root, { load = loadField, navigate } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const go = navigate || ((url) => win.location.assign(url));
  const stage = root.querySelector("[data-hg-stage]");
  const cvT = root.querySelector("[data-hg-terrain]"), cvS = root.querySelector("[data-hg-scene]");
  const card = root.querySelector("[data-hg-card]"), live = root.querySelector("[data-hg-live]");
  const backBtn = root.querySelector("[data-hg-back]"), ringKey = root.querySelector("[data-hg-rings]");
  const wrap = root.querySelector("[data-hg-wrap]");
  const ac = new AbortController();
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: ac.signal });
  const prefix = `hg${++mounts}-`;
  let disposed = false, teardown = null;

  const unavailable = () => {
    card.hidden = false;
    card.innerHTML = '<p class="hg-desc">The map could not be loaded. The section list goes to the same pages.</p>';
  };
  Promise.resolve().then(load).then(async (data) => {
    if (disposed) return;
    if (!data.layout) await fillLayout(data);
    if (!disposed) teardown = init(data);
  }).catch((err) => { if (disposed) return; unavailable(); console.error("Home map:", err); });

  // field.json written before the layout was precomputed: lay it out once, off the critical path.
  async function fillLayout(data) {
    await new Promise((r) => (win.requestIdleCallback ? win.requestIdleCallback(r, { timeout: 600 }) : win.setTimeout(r, 1)));
    const { computeLayouts } = await import("../lib/gravity-layout.mjs");
    data.layout = computeLayouts(data.nodes, data.links);
  }

  function init(D) {
    const N = D.nodes, n = N.length;
    const { adj, deg } = adjacency(n, D.links);
    const byId = new Map(N.map((d, i) => [d.id, i]));
    const HOME = byId.get("/") ?? 0;
    const s = createState(n, D.links);
    const { X, Y, VX, VY, TX, TY, PX0, PY0, M0, MV, MT, KR, KRT, R0, RAD, RADT, LA, LB, REST, REST0, L } = s;
    const topic = N.map((d) => (d.topics && d.topics[0]) || "profile");
    const label = N.map(homeLabel);
    const lead = N.map((d) => firstSentence(d.desc));
    for (let i = 0; i < n; i++) M0[i] = pageMass(N[i].kb, deg[i]);
    const ALLORDER = [...Array(n).keys()].sort((a, b) => TOPIC_ORDER.indexOf(topic[a]) - TOPIC_ORDER.indexOf(topic[b]) || M0[b] - M0[a]);
    const landmarks = LANDMARKS.map((id) => byId.get(id)).filter((i) => i != null);
    const RM = win.matchMedia("(prefers-reduced-motion: reduce)");
    const DARK = win.matchMedia("(prefers-color-scheme: dark)");
    const ctT = cvT.getContext("2d"), ctS = cvS.getContext("2d");
    const MR = new Float64Array(n);
    const PGX = new Float64Array(n), PGY = new Float64Array(n);
    const far = new Uint8Array(n);
    let hop = new Int8Array(n).fill(-1);
    let W = 0, H = 0, dpr = 1, S = 1, RS = 1, narrow = false;
    let sel = -1, hov = -1, cursor = -1, drag = -1, dragX = 0, dragY = 0;
    let ring = null, ringA = 0, ringAT = 0, introA = 1, gamma = 3.2, streakT0 = -1e9;
    let levels = [], topLand = 1, coarse = false, well = [];
    let family = "system-ui, sans-serif", theme = null;
    const F = (w, px) => `${w} ${px}px ${family}`;

    /* ---------- theme: every colour comes from the site's tokens ---------- */
    function readTheme() {
      const cs = win.getComputedStyle(root);
      family = cs.getPropertyValue("--font-display").trim() || family;
      const probe = doc.createElement("span");
      probe.style.display = "none";
      root.appendChild(probe);
      const resolve = (expr, fallback) => {
        probe.style.color = "";
        probe.style.color = expr;
        const c = win.getComputedStyle(probe).color;
        return c || fallback;
      };
      const t = { ink: resolve("var(--ink)", "#0b0b0d"), muted: resolve("var(--ink-muted)", "#6a6a73"), paper: resolve("var(--surface-raised)", "#ffffff"), topic: {} };
      for (const k of TOPIC_ORDER) t.topic[k] = resolve(`var(--topic-${k})`, t.ink);
      probe.remove();
      const ink = rgbOf(t.ink, [11, 11, 13]), paper = rgbOf(t.paper, [255, 255, 255]);
      const mix = (w) => `rgb(${ink.map((v, k) => Math.round(v * (1 - w) + paper[k] * w)).join(",")})`;
      t.shade = [t.ink, t.ink, mix(0.48), mix(0.74)];
      t.faded = mix(0.76);
      for (const k of TOPIC_ORDER) t.topic[k] = canvasColor(t.topic[k], t.ink);
      return t;
    }
    function rgbOf(color, fallback) {
      try {
        const c = doc.createElement("canvas");
        c.width = c.height = 1;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.fillStyle = "#000";
        x.fillStyle = color;
        x.fillRect(0, 0, 1, 1);
        const d = x.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      } catch { return fallback; }
    }
    function canvasColor(color, fallback) {
      // A colour the 2D context cannot parse would leave the previous fill in place; fall back instead.
      try {
        ctS.fillStyle = "#010203";
        ctS.fillStyle = color;
        return String(ctS.fillStyle).toLowerCase() === "#010203" ? fallback : color;
      } catch { return fallback; }
    }

    /* ---------- stage geometry ---------- */
    let cell = 6, margin = 0, gw = 0, gh = 0, vals = null, gridOX = 0, gridOY = 0;
    const contours = contourGenerator();
    function grid() {
      cell = coarse ? 8 : narrow ? 5 : 6;
      margin = Math.round(Math.max(48, 0.1 * Math.max(W, H)) / cell) * cell;
      gridOX = gridOY = -margin;
      gw = Math.ceil((W + 2 * margin) / cell) + 1;
      gh = Math.ceil((H + 2 * margin) / cell) + 1;
      vals = new Float64Array(gw * gh);
      contours.size([gw, gh]);
    }
    function measure() {
      const r = stage.getBoundingClientRect();
      W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
      dpr = Math.min(2, win.devicePixelRatio || 1);
      for (const c of [cvT, cvS]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ({ S, RS } = stageScales(W, H));
      narrow = W < 600;
      for (let i = 0; i < n; i++) R0[i] = markRadius(M0[i], i === HOME, RS);
      grid();
    }
    function landscape() {
      const pos = scaleLayout(D.layout && D.layout[narrow ? "narrow" : "wide"], n, W, H);
      if (pos) { PX0.set(pos.X); PY0.set(pos.Y); }
      else for (let i = 0; i < n; i++) { PX0[i] = W * (0.15 + 0.7 * hash(i)); PY0[i] = H * (0.15 + 0.7 * hash(i + 41)); }
      for (let l = 0; l < L; l++) REST0[l] = Math.hypot(PX0[LB[l]] - PX0[LA[l]], PY0[LB[l]] - PY0[LA[l]]);
    }
    const bodyKernel = () => 12 * S;
    function setLevels() {
      X.set(PX0); Y.set(PY0);
      for (let i = 0; i < n; i++) { MV[i] = M0[i]; KR[i] = bodyKernel(); }
      sampleField(vals, { gw, gh, cell, ox: gridOX, oy: gridOY }, X, Y, MV, KR, n);
      // Levels come from the visible part of the stage only, so the margin does not thin them out.
      const seen = [];
      const g0 = Math.ceil(margin / cell), gx1 = Math.floor((margin + W) / cell), gy1 = Math.floor((margin + H) / cell);
      for (let gy = g0; gy <= gy1; gy++) for (let gx = g0; gx <= gx1; gx++) seen.push(vals[gy * gw + gx]);
      ({ levels, top: topLand } = contourLevels(seen));
      contours.thresholds(levels);
    }

    /* ---------- targets for the two states ---------- */
    function toLandscape() {
      for (let i = 0; i < n; i++) { TX[i] = PX0[i]; TY[i] = PY0[i]; RADT[i] = R0[i]; MT[i] = M0[i]; KRT[i] = bodyKernel(); }
      REST.set(REST0); hop.fill(-1); ring = null; ringAT = 0;
    }
    function toRings(c) {
      hop = hopRings(adj, c);
      const g = [[], [], [], []];
      for (let i = 0; i < n; i++) g[hop[i]].push(i);
      ring = ringGeometry(W, H, { S, RS, narrow, top: narrow ? 40 : 0, counts: g.map((x) => x.length) });
      const { cx, cy, e, R1, R2, PX, PY } = ring, ox = X[c], oy = Y[c];
      placeOnRing(g[1], X, Y, ox, oy, e, cx, cy, R1 * e, R1, TX, TY);
      placeOnRing(g[2], X, Y, ox, oy, e, cx, cy, R2 * e, R2, TX, TY);
      placeOnRing(g[3], X, Y, ox, oy, e, cx, cy, PX, PY, TX, TY);
      TX[c] = cx; TY[c] = cy;
      const scale = [1.25, 1, 0.8, 0.66];
      const soft = [12, 12, 17, 26]; // outer pages are more diffuse masses, so they do not form isolated rings
      for (let i = 0; i < n; i++) { RADT[i] = R0[i] * scale[hop[i]]; MT[i] = M0[i]; KRT[i] = soft[hop[i]] * S; }
      MT[c] = WELL; KRT[c] = 34 * S;
      well = wellLevels(WELL, KRT[c], 0.72 * R1);
      for (let l = 0; l < L; l++) REST[l] = Math.hypot(TX[LB[l]] - TX[LA[l]], TY[LB[l]] - TY[LA[l]]);
      ringAT = 1;
    }

    /* ---------- terrain ---------- */
    let tCost = 0;
    function drawTerrain() {
      const t0 = win.performance.now();
      sampleField(vals, { gw, gh, cell, ox: gridOX, oy: gridOY }, X, Y, MV, KR, n);
      const polys = contours(vals);
      for (let i = 0; i < n; i++) { PGX[i] = (X[i] - gridOX) / cell + 0.5; PGY[i] = (Y[i] - gridOY) / cell + 0.5; }
      const c = ctT;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cvT.width, cvT.height);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.lineJoin = "round";
      const kept = polys.map((p, i) => (sel >= 0 && levels[i] > topLand ? null : pageRings(p, PGX, PGY, n)));
      const trace = (rings) => { c.beginPath(); for (const r of rings) traceSmoothRing(c, r, cell, gridOX, gridOY); };
      // Faint fills of every third level shade the terrain towards its peaks.
      c.fillStyle = theme.ink;
      c.globalAlpha = 0.02 * introA;
      kept.forEach((rings, i) => { if (i % 3 === 0 && rings && rings.length) { trace(rings); c.fill("evenodd"); } });
      // Every fifth level is an index contour; each class is stroked as one path.
      c.strokeStyle = theme.ink;
      for (const index of [false, true]) {
        c.beginPath();
        kept.forEach((rings, i) => { if (rings && (i % 5 === 0) === index) for (const r of rings) traceSmoothRing(c, r, cell, gridOX, gridOY); });
        c.globalAlpha = (index ? 0.3 : 0.13) * introA;
        c.lineWidth = index ? 0.9 : 0.55;
        c.stroke();
      }
      // The chosen page's well: contours of its own potential term alone, which are exact circles.
      if (sel >= 0 && ringA > 0.02) {
        const profile = topic[sel] === "profile";
        c.strokeStyle = profile ? theme.ink : theme.topic[topic[sel]];
        c.globalAlpha = (profile ? 0.62 : 0.55) * ringA * introA;
        c.lineWidth = profile ? 1.7 : 1.2;
        c.beginPath();
        for (const t of well) {
          const r = wellRadius(MV[sel], KR[sel], t);
          if (r > 1.5) { c.moveTo(X[sel] + r, Y[sel]); c.arc(X[sel], Y[sel], r, 0, TAU); }
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      tCost = tCost * 0.8 + (win.performance.now() - t0) * 0.2;
    }
    // Governor: when frames run long, first coarsen the contour grid, then redraw the terrain on alternate
    // frames while pages move. The step persists for the visit, since a slow device stays slow.
    let quality = 0, slowEMA = 16.7, sinceChange = 0;
    function govern(interval) {
      slowEMA = slowEMA * 0.85 + Math.min(interval, 100) * 0.15;
      if (++sinceChange < 20 || quality >= 2) return;
      if (slowEMA > 22 || tCost > FRAME_BUDGET_MS) {
        quality++; sinceChange = 0;
        if (quality === 1) { coarse = true; grid(); contours.thresholds(levels); }
      }
    }

    /* ---------- scene ---------- */
    const widths = new Map();
    function textW(text, font) {
      const key = font + text;
      let w = widths.get(key);
      if (w == null) { ctS.font = font; w = ctS.measureText(text).width || text.length * 6.5; widths.set(key, w); }
      return w;
    }
    const last = new Map();
    const speed = (i) => Math.hypot(VX[i], VY[i]);
    let basins = [];
    function basinItems() {
      return TOPIC_ORDER.map((t, k) => {
        const xs = [], ys = [];
        let sx = 0, sy = 0, sw = 0;
        for (let i = 0; i < n; i++) {
          if (!N[i].topics.includes(t) || i === HOME) continue;
          const w = 1 / N[i].topics.length;
          sx += PX0[i] * w; sy += PY0[i] * w; sw += w;
          if (N[i].topics.length === 1) { xs.push(PX0[i]); ys.push(PY0[i]); }
        }
        if (!sw || !xs.length) return null;
        xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
        const pc = (v, p) => v[Math.round((v.length - 1) * p)];
        const x0 = pc(xs, 0.12), x1 = pc(xs, 0.88), y0 = pc(ys, 0.12), y1 = pc(ys, 0.88);
        const cx = sx / sw, cy = sy / sw, text = (narrow ? TOPIC_SHORT[t] : TOPIC_NAMES[t]).toUpperCase(), font = F(600, 11);
        const w = textW(text, font) * 1.1, h = 14;
        const ud = cy < H / 2 ? [[cx - w / 2, y0 - 30], [cx - w / 2, y1 + 16]] : [[cx - w / 2, y1 + 16], [cx - w / 2, y0 - 30]];
        return { key: "b" + k, text, font, size: 11, w, h, color: "muted", alpha: 1, track: true, cands: [[cx - w / 2, cy - 7], ...ud, [x0 - w - 16, cy - 7], [x1 + 16, cy - 7], [cx - w / 2, cy - 30], [cx - w / 2, cy + 16]] };
      }).filter(Boolean);
    }
    function item(i, weight, size, extra = "") {
      const text = label[i] + extra, font = F(weight, size);
      return {
        key: i, i, x: X[i], y: Y[i], r: RAD[i], text, font, size, w: textW(text, font), h: size * 1.25, color: "ink",
        alpha: clamp(1.25 - speed(i) / 140, 0, 1),
        prefer: sel >= 0 && i !== sel ? radialPreference(X[i], Y[i], ring ? ring.cx : W / 2, ring ? ring.cy : H / 2) : [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 8, 9],
      };
    }
    function labelItems() {
      const items = [];
      const focus = hov;
      const small = narrow ? 11 : 12;
      if (sel >= 0) {
        items.push(Object.assign(item(sel, 650, narrow ? 14 : 15, " ↗"), { alpha: 1, force: true, chosen: true, prefer: [3, 2, 8, 9, 0, 1, 10, 11, 12, 13] }));
        if (focus >= 0 && focus !== sel) items.push(Object.assign(item(focus, 600, 13), { alpha: 1, force: true }));
        const r1 = [];
        for (let i = 0; i < n; i++) if (hop[i] === 1) r1.push(i);
        r1.sort((a, b) => M0[b] - M0[a]).forEach((i) => items.push(item(i, 500, small)));
      } else if (focus >= 0) {
        items.push(Object.assign(item(focus, 650, 14), { alpha: 1, force: true }));
        adj[focus].slice().sort((a, b) => M0[b] - M0[a]).forEach((i) => items.push(item(i, 500, small)));
      } else {
        const lm = landmarks.map((i, k) => Object.assign(item(i, k === 0 ? 650 : 520, k === 0 ? 13 : small), { force: k < FORCED_LANDMARKS }));
        let vs = 0;
        for (let i = 0; i < n; i++) vs += speed(i);
        const calm = clamp(1.3 - vs / n / 40, 0, 1); // topic names appear once the pages have settled
        basins.forEach((b) => { b.alpha = introA * calm; });
        items.push(...lm.slice(0, FORCED_LANDMARKS), ...basins, ...lm.slice(FORCED_LANDMARKS));
      }
      return items;
    }
    function drawScene() {
      const c = ctS, now = win.performance.now();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const focus = hov;
      const nb = new Uint8Array(n);
      if (focus >= 0) { nb[focus] = 2; for (const j of adj[focus]) nb[j] = 1; }
      c.globalAlpha = 1;
      // ring guides
      if (ring && ringA > 0.02) {
        c.save(); c.setLineDash([1.5, 4.5]); c.lineWidth = 1; c.strokeStyle = theme.ink; c.globalAlpha = 0.34 * ringA;
        for (const r of [ring.R1, ring.R2]) { c.beginPath(); c.ellipse(ring.cx, ring.cy, r * ring.e, r, 0, 0, TAU); c.stroke(); }
        c.restore();
      }
      // links; a spring under tension darkens. Links are batched into one path per opacity and width.
      c.lineCap = "round"; c.strokeStyle = theme.ink;
      const bins = new Map();
      for (let l = 0; l < L; l++) {
        const a = LA[l], b = LB[l];
        let al, w = 0.8;
        if (focus >= 0 && (a === focus || b === focus)) { al = 0.6; w = 1.2; }
        else if (sel >= 0) {
          const ha = hop[a], hb = hop[b];
          if (ha === 0 || hb === 0) { al = 0.4; w = 1; } else if (Math.min(ha, hb) === 1 && Math.max(ha, hb) === 2) al = 0.07; else al = 0.03;
          if (focus >= 0) al *= 0.5;
        } else al = focus >= 0 ? 0.035 : 0.06;
        const dx = X[b] - X[a], dy = Y[b] - Y[a], st = Math.abs(Math.hypot(dx, dy) - REST[l]) / (REST[l] + 30);
        const pulled = a === drag || b === drag;
        al = Math.min(0.85, al + (pulled ? st * 1.2 : Math.min(0.12, st * 0.3))) * introA;
        if (al < 0.02) continue;
        const width = Math.round((w + (pulled ? Math.min(1.4, st * 3) : 0)) * 5) / 5, k = `${Math.round(al * 100)}|${width}`;
        let bin = bins.get(k);
        if (!bin) bins.set(k, (bin = []));
        bin.push(l);
      }
      for (const [k, list] of bins) {
        const [al, width] = k.split("|").map(Number);
        c.globalAlpha = al / 100; c.lineWidth = width;
        c.beginPath();
        for (const l of list) { c.moveTo(X[LA[l]], Y[LA[l]]); c.lineTo(X[LB[l]], Y[LB[l]]); }
        c.stroke();
      }
      // motion streaks: only for pages that travel far after a choice, fading within STREAK_MS
      const fade = clamp(1 - (now - streakT0) / STREAK_MS, 0, 1);
      if (fade > 0) {
        for (let i = 0; i < n; i++) {
          const v = speed(i);
          if (!far[i] || v < 60) continue;
          c.globalAlpha = Math.min(0.22, v / 1600) * fade; c.lineWidth = RAD[i] * 0.8;
          c.beginPath(); c.moveTo(X[i], Y[i]); c.lineTo(X[i] - VX[i] * 0.04, Y[i] - VY[i] * 0.04); c.stroke();
        }
      }
      // marks
      c.lineJoin = "round";
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n; i++) {
          const hot = i === sel || i === focus || (focus >= 0 && nb[i]);
          if ((pass === 0) === !!hot) continue;
          let fill = theme.ink;
          if (sel >= 0) fill = theme.shade[hop[i]] || theme.ink;
          const faded = focus >= 0 && !nb[i] && i !== sel && sel < 0;
          if (faded) fill = theme.faded;
          if (focus >= 0 && nb[i]) fill = theme.ink;
          if (i === sel) fill = topic[i] === "profile" ? theme.ink : theme.topic[topic[i]];
          const r = RAD[i];
          c.globalAlpha = 1;
          shapePath(c, N[i].type, X[i], Y[i], r);
          if (!faded && fill !== theme.shade[3]) { c.lineWidth = 3; c.strokeStyle = theme.paper; c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1; }
          c.fillStyle = fill; c.fill();
          if (i === sel) { c.lineWidth = 1.6; c.strokeStyle = theme.ink; c.stroke(); }
          if (i === HOME || i === sel || i === focus) {
            c.beginPath(); c.arc(X[i], Y[i], r * (N[i].type === "page" ? 1 : 1.35) + (i === sel ? 6 : 4), 0, TAU);
            c.lineWidth = i === sel ? 1.4 : 1.1; c.strokeStyle = theme.ink; c.stroke();
          }
        }
      }
      // keyboard cursor
      if (doc.activeElement === stage && cursor >= 0) {
        c.save(); c.setLineDash([3, 3]); c.lineWidth = 1.5; c.strokeStyle = theme.ink;
        c.beginPath(); c.arc(X[cursor], Y[cursor], RAD[cursor] * 1.5 + 10, 0, TAU); c.stroke(); c.restore();
      }
      // labels, last, over every mark
      for (let i = 0; i < n; i++) MR[i] = RAD[i] * 1.2 + 1;
      const placed = placeLabels(labelItems(), { X, Y, MR, n, W, H, last });
      c.textBaseline = "top";
      for (const [it, bx, by] of placed) {
        if (it.alpha < 0.03) continue;
        c.font = it.font;
        if (it.track && "letterSpacing" in c) c.letterSpacing = "1px";
        c.globalAlpha = it.alpha * (it.chosen ? 1 : 0.94);
        c.lineWidth = it.chosen ? CHOSEN_HALO_PX : LABEL_HALO_PX; c.strokeStyle = theme.paper; c.strokeText(it.text, bx, by);
        c.globalAlpha = it.alpha;
        c.fillStyle = it.color === "muted" ? theme.muted : theme.ink; c.fillText(it.text, bx, by);
        if (it.track && "letterSpacing" in c) c.letterSpacing = "0px";
      }
      c.globalAlpha = 1;
    }

    /* ---------- loop ---------- */
    let awake = false, raf = 0, pending = 0, tPrev = 0, visible = true, calm = 0, started = false, frameNo = 0;
    function frame(t) {
      raf = 0;
      const interval = t - tPrev;
      const dt = Math.min(1 / 30, Math.max(1 / 240, interval / 1000));
      tPrev = t;
      if (frameNo > 2) govern(interval);
      const busy = integrate(s, dt, { sel, home: HOME, drag, dragX, dragY, gamma, S, RS, coupling: sel >= 0 ? 9 : 16 });
      const rr = 1 - Math.exp(-dt * 7), r = 1 - Math.exp(-dt * 3.6);
      ringA += (ringAT - ringA) * rr; introA += (1 - introA) * r;
      const moving = busy > 2.5 || drag >= 0 || Math.abs(ringAT - ringA) > 0.01 || introA < 0.995;
      frameNo++;
      if (quality < 2 || frameNo % 2 === 0 || !moving) drawTerrain();
      drawScene();
      calm = moving ? 0 : calm + 1;
      if (calm > 12) { VX.fill(0); VY.fill(0); }
      if (calm > 12 || !visible || doc.hidden) { awake = false; return; }
      raf = win.requestAnimationFrame(frame);
    }
    function wake() {
      if (!started) return;
      if (RM.matches) { settle(); return; }
      calm = 0;
      if (awake || !visible || doc.hidden) return;
      awake = true; tPrev = win.performance.now(); frameNo = 0; raf = win.requestAnimationFrame(frame);
    }
    function redraw() {
      if (awake || pending || !started) return;
      pending = win.requestAnimationFrame(() => { pending = 0; drawScene(); });
    }
    function settle() {
      // Reduced motion: jump to the equilibrium and draw once.
      for (let i = 0; i < n; i++) { X[i] = TX[i]; Y[i] = TY[i]; VX[i] = VY[i] = 0; MV[i] = MT[i]; KR[i] = KRT[i]; RAD[i] = RADT[i]; }
      const g = gamma;
      for (let k = 0; k < 60; k++) integrate(s, 1 / 60, { sel, home: HOME, drag: -1, gamma: 30, S, RS });
      gamma = g;
      for (let i = 0; i < n; i++) { VX[i] = VY[i] = 0; MV[i] = MT[i]; RAD[i] = RADT[i]; }
      ringA = ringAT; introA = 1; streakT0 = -1e9;
      drawTerrain(); drawScene();
    }

    /* ---------- state changes ---------- */
    const announce = (text) => { if (live) live.textContent = text; };
    function ringKeyHTML() {
      if (!ring) return "";
      return [[theme.shade[1], "1 link", ring.counts[1]], [theme.shade[2], "2 links", ring.counts[2]], [theme.shade[3], "3 or more", ring.counts[3]]]
        .map(([col, text, k]) => `<li><i style="background:${esc(col)}"></i>${text} <b>${k}</b></li>`).join("");
    }
    function select(i) {
      if (i < 0) return;
      const before = sel;
      sel = i; cursor = i; gamma = 2.9;
      toRings(i);
      for (let k = 0; k < n; k++) far[k] = Math.hypot(TX[k] - X[k], TY[k] - Y[k]) > 0.3 * Math.min(W, H) ? 1 : 0;
      streakT0 = win.performance.now();
      backBtn.hidden = false; wrap.classList.add("is-ringed");
      ringKey.innerHTML = ringKeyHTML(); ringKey.hidden = false;
      renderCard(); syncOptions();
      if (before !== i) announce(`${N[i].title}, ${KIND_NAMES[N[i].type].toLowerCase()}. ${ring.counts[1]} linked pages, ${ring.counts[2]} two links away.`);
      wake();
    }
    function release() {
      if (sel < 0) return;
      sel = -1; gamma = 3.4; toLandscape();
      backBtn.hidden = true; wrap.classList.remove("is-ringed"); ringKey.hidden = true;
      renderCard(); syncOptions(); announce("All pages, by topic.");
      wake();
    }
    function setHover(i) {
      if (i === hov) return;
      hov = i;
      renderCard(); redraw();
    }
    const open = (i) => go(N[i].id);

    /* ---------- card ---------- */
    let cardFor = null;
    function renderCard() {
      const i = hov >= 0 ? hov : sel;
      const key = `${i}:${i === sel}`;
      if (key === cardFor) return;
      cardFor = key;
      if (i < 0) { card.hidden = true; card.innerHTML = ""; return; }
      const d = N[i], linked = adj[i].slice().sort((a, b) => M0[b] - M0[a]), shown = linked.slice(0, 6), rest = linked.slice(6);
      const tint = i === sel && topic[i] !== "profile" ? `var(--topic-${topic[i]})` : "currentColor";
      const row = (j) => `<li><button type="button" data-hg-page="${j}">${glyphSVG(N[j].type)}<span>${esc(label[j])}</span></button></li>`;
      card.hidden = false;
      card.innerHTML = `<p class="hg-meta">${glyphSVG(d.type, tint)}<span class="hg-kind">${KIND_NAMES[d.type]}</span>${d.topics.map((t) => `<span class="hg-topic"><i style="background:var(--topic-${t})"></i>${esc(TOPIC_NAMES[t])}</span>`).join("")}</p>
        <h3>${esc(d.title)}</h3><p class="hg-desc">${esc(lead[i])}</p>
        <a class="hg-open" href="${esc(d.id)}">Open page <span aria-hidden="true">↗</span></a>
        ${linked.length ? `<p class="hg-linked">Linked pages <span>${linked.length}</span></p><ul>${shown.map(row).join("")}</ul>` : ""}
        ${rest.length ? `<details class="hg-more"><summary>${rest.length} more linked pages</summary><ul>${rest.map(row).join("")}</ul></details>` : ""}`;
    }
    on(card, "click", (e) => {
      const b = e.target.closest("button[data-hg-page]");
      if (b) { hov = -1; select(+b.dataset.hgPage); }
    });

    /* ---------- listbox ---------- */
    // The stage becomes a listbox only once it has options; without the script it is a plain figure.
    stage.setAttribute("role", "listbox");
    stage.setAttribute("aria-label", "Site pages. Arrow keys move between pages, Enter centres a page and Enter again opens it, Escape returns to all topics.");
    stage.tabIndex = 0;
    const opts = N.map((d, i) => {
      const o = doc.createElement("div");
      o.id = prefix + i; o.setAttribute("role", "option"); o.setAttribute("aria-selected", "false"); o.className = "hg-sr";
      o.textContent = `${d.title}. ${KIND_NAMES[d.type]}, ${d.topics.map((t) => TOPIC_NAMES[t]).join(" and ")}. ${deg[i]} linked pages.`;
      stage.appendChild(o);
      return o;
    });
    function syncOptions() {
      opts.forEach((o, i) => o.setAttribute("aria-selected", i === sel ? "true" : "false"));
      if (cursor >= 0) stage.setAttribute("aria-activedescendant", prefix + cursor); else stage.removeAttribute("aria-activedescendant");
    }
    function cycle() {
      if (sel < 0) return ALLORDER;
      const r1 = [];
      for (let i = 0; i < n; i++) if (hop[i] === 1) r1.push(i);
      r1.sort((a, b) => Math.atan2(TY[a] - ring.cy, TX[a] - ring.cx) - Math.atan2(TY[b] - ring.cy, TX[b] - ring.cx));
      return [sel, ...r1];
    }
    on(stage, "keydown", (e) => {
      const k = e.key;
      if (k === "ArrowRight" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowUp") {
        const order = cycle(), p = order.indexOf(cursor), dir = k === "ArrowRight" || k === "ArrowDown" ? 1 : -1;
        cursor = order[(p < 0 ? 0 : p + dir + order.length) % order.length];
        hov = cursor === sel ? -1 : cursor; cardFor = null; renderCard(); syncOptions(); redraw(); e.preventDefault();
      } else if (k === "Enter" || k === " ") {
        if (cursor < 0) return;
        e.preventDefault();
        if (cursor === sel && k === "Enter") open(sel); else { hov = -1; select(cursor); }
      } else if (k === "Escape" && sel >= 0) { e.preventDefault(); hov = -1; release(); }
    });
    on(stage, "focus", () => { if (cursor < 0) cursor = sel >= 0 ? sel : HOME; syncOptions(); redraw(); });
    on(stage, "blur", () => { if (hov >= 0 && !ptr.inside) { hov = -1; cardFor = null; renderCard(); } redraw(); });
    on(backBtn, "click", () => { hov = -1; release(); stage.focus({ preventScroll: true }); });

    /* ---------- pointer: hover, choose, drag ---------- */
    // Touch never blocks scrolling: a page is dragged only after a still long press, and only then is
    // touchmove cancelled. A quick swipe anywhere on the map scrolls the page.
    const ptr = { down: false, id: -1, type: "", cand: -1, sx: 0, sy: 0, x: 0, y: 0, drag: false, moved: false, inside: false, timer: 0 };
    const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function hit(x, y, pad) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.hypot(X[i] - x, Y[i] - y) - RAD[i] * 1.3; if (d < pad && d < bd) { bd = d; best = i; } }
      return best;
    }
    function startDrag() {
      if (ptr.cand < 0 || RM.matches) return;
      ptr.drag = true; drag = ptr.cand; dragX = clamp(ptr.x, 4, W - 4); dragY = clamp(ptr.y, 4, H - 4);
      if (hov >= 0) { hov = -1; renderCard(); }
      stage.classList.add("is-dragging");
      try { stage.setPointerCapture(ptr.id); } catch { /* the pointer may already be gone */ }
      wake();
    }
    on(stage, "pointerdown", (e) => {
      if (e.button > 0) return;
      const [x, y] = local(e);
      win.clearTimeout(ptr.timer);
      Object.assign(ptr, { down: true, id: e.pointerId, type: e.pointerType, sx: x, sy: y, x, y, drag: false, moved: false });
      ptr.cand = hit(x, y, e.pointerType === "touch" ? 18 : 8);
      if (ptr.cand >= 0 && e.pointerType === "touch") ptr.timer = win.setTimeout(startDrag, LONG_PRESS_MS);
    });
    on(stage, "pointermove", (e) => {
      const [x, y] = local(e);
      ptr.inside = true;
      if (ptr.down && e.pointerId === ptr.id) {
        ptr.x = x; ptr.y = y;
        if (!ptr.drag && !ptr.moved && Math.hypot(x - ptr.sx, y - ptr.sy) > (ptr.type === "touch" ? TOUCH_SLOP : 6)) {
          ptr.moved = true; win.clearTimeout(ptr.timer);
          if (ptr.type !== "touch") startDrag();
        }
        if (ptr.drag) { dragX = clamp(x, 4, W - 4); dragY = clamp(y, 4, H - 4); wake(); }
        return;
      }
      if (e.pointerType === "mouse") { const i = hit(x, y, 8); stage.classList.toggle("is-pointing", i >= 0); setHover(i); }
    });
    on(stage, "touchmove", (e) => { if (ptr.drag && e.cancelable) e.preventDefault(); }, { passive: false });
    on(stage, "contextmenu", (e) => { if (ptr.down && ptr.type === "touch") e.preventDefault(); });
    function endPointer(cancel) {
      win.clearTimeout(ptr.timer);
      if (!ptr.down) return;
      ptr.down = false;
      if (ptr.drag) { drag = -1; ptr.drag = false; stage.classList.remove("is-dragging"); wake(); return; }
      if (cancel || ptr.moved) return;
      const i = ptr.cand;
      if (i >= 0) { if (i === sel) open(i); else { if (ptr.type !== "mouse") hov = -1; select(i); } }
      else if (sel >= 0) { hov = -1; release(); }
    }
    on(stage, "pointerup", () => endPointer(false));
    on(stage, "pointercancel", () => endPointer(true));
    on(stage, "pointerleave", (e) => { ptr.inside = false; if (e.pointerType === "mouse" && !ptr.down) { stage.classList.remove("is-pointing"); setHover(-1); } });
    for (const a of root.querySelectorAll(".hg-links a[data-id]")) {
      const i = byId.get(a.dataset.id);
      if (i == null) continue;
      on(a, "mouseenter", () => setHover(i)); on(a, "mouseleave", () => setHover(-1));
      on(a, "focus", () => setHover(i)); on(a, "blur", () => setHover(-1));
    }

    /* ---------- lifecycle ---------- */
    function build(keep) {
      measure(); landscape(); setLevels(); widths.clear(); basins = basinItems();
      if (sel >= 0) toRings(sel); else toLandscape();
      if (!keep) {
        // Start outside the equilibrium so the first view shows the pages falling into their basins.
        for (let i = 0; i < n; i++) {
          const dx = PX0[i] - W / 2, dy = PY0[i] - H / 2, a = 0.55 * (hash(i + 7) - 0.5);
          X[i] = W / 2 + 1.45 * (dx * Math.cos(a) - dy * Math.sin(a)); Y[i] = H / 2 + 1.45 * (dx * Math.sin(a) + dy * Math.cos(a));
          VX[i] = VY[i] = 0; MV[i] = M0[i] * 0.2; KR[i] = KRT[i]; RAD[i] = R0[i];
        }
        X[HOME] = PX0[HOME]; Y[HOME] = PY0[HOME]; introA = 0;
      }
      if (RM.matches || keep) settle(); else { drawTerrain(); drawScene(); }
    }
    function retheme() {
      theme = readTheme(); widths.clear(); basins = basinItems();
      if (sel >= 0) ringKey.innerHTML = ringKeyHTML();
      drawTerrain(); drawScene();
    }
    let rsT = 0, lastW = 0, lastH = 0;
    const ro = new win.ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      if (Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 2) return;
      const first = !lastW;
      lastW = r.width; lastH = r.height;
      if (first || !started) return;
      win.clearTimeout(rsT);
      rsT = win.setTimeout(() => build(true), 140);
    });
    ro.observe(stage);
    const io = new win.IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) wake(); });
    io.observe(stage);
    const mo = new win.MutationObserver(() => started && retheme());
    mo.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    on(DARK, "change", () => started && retheme());
    on(RM, "change", () => { if (RM.matches && started) settle(); });
    on(doc, "visibilitychange", () => { if (!doc.hidden) wake(); });

    theme = readTheme();
    const fontsReady = doc.fonts && doc.fonts.load
      ? Promise.all([doc.fonts.load(F(500, 12)), doc.fonts.load(F(650, 15))]).catch(() => null)
      : Promise.resolve();
    fontsReady.then(() => {
      if (disposed) return;
      const r = stage.getBoundingClientRect();
      lastW = r.width; lastH = r.height;
      build(false); renderCard(); syncOptions();
      stage.setAttribute("aria-busy", "false");
      started = true; wake();
    });

    return () => {
      started = false;
      win.cancelAnimationFrame(raf); win.cancelAnimationFrame(pending); raf = pending = 0; awake = false;
      win.clearTimeout(rsT); win.clearTimeout(ptr.timer);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      for (const o of opts) o.remove();
      for (const a of ["aria-activedescendant", "role", "aria-label", "tabindex"]) stage.removeAttribute(a);
    };
  }

  return () => {
    if (disposed) return;
    disposed = true;
    ac.abort();
    if (teardown) teardown();
  };
}
