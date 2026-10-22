import test from "node:test";
import assert from "node:assert/strict";
import { contours } from "d3-contour";
import {
  ASSOCIATION, adjacency, boxDistance, contourLevels, createState, firstSentence, glyphPathData, glyphRadius, glyphReach,
  glyphVertices, hopRings, integrate, labelBox, labelCandidates, padReach, pageMass, pageRings, placeLabels, placeOnRing,
  potentialAt, reserveLabelRoom, ringContains, ringGeometry, sampleField, scaleLayout, traceSmoothRing, wellLevels, wellRadius,
} from "../../src/lib/gravity-field.mjs";
import { LAYOUT_FRAMES, computeLayouts } from "../../src/lib/gravity-layout.mjs";

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("page mass rises with length and with links, from a positive floor", () => {
  close(pageMass(0, 0), 0.4);
  close(pageMass(60, 10), 0.4 + 0.5 + 1);
  close(pageMass(-5, 0), 0.4, 0);
  assert.ok(pageMass(240, 3) > pageMass(60, 3));
  assert.ok(pageMass(60, 4) > pageMass(60, 3));
});

test("the softened potential is positive, finite at a mass, and symmetric", () => {
  const X = [100, 300], Y = [200, 200], M = [2, 2], K = [12, 12];
  assert.ok(potentialAt(-1e4, 5e3, X, Y, M, K) > 0);
  close(potentialAt(100, 200, [100], [200], [3], [12]), 3 / 12);
  // Mirror symmetry about the midpoint of two equal masses.
  for (const [dx, dy] of [[0, 0], [37, 11], [150, -80], [5, 400]]) close(potentialAt(200 + dx, 200 + dy, X, Y, M, K), potentialAt(200 - dx, 200 + dy, X, Y, M, K), 1e-12);
  // Radial symmetry of a single mass, and invariance to the order of the bodies.
  const one = (x, y) => potentialAt(x, y, [0], [0], [1.7], [9]);
  close(one(40, 0), one(0, -40)); close(one(40, 0), one(-24, 32));
  close(potentialAt(150, 260, X, Y, M, K), potentialAt(150, 260, [...X].reverse(), [...Y].reverse(), M, K), 1e-15);
});

test("the sampled grid, including the margin outside the stage, matches the potential pointwise", () => {
  const X = new Float64Array([40, 160, 90]), Y = new Float64Array([50, 70, 140]), M = new Float64Array([1, 2.5, 0.8]), K = new Float64Array([12, 12, 20]);
  const g = { gw: 31, gh: 27, cell: 8, ox: -48, oy: -48 };
  const vals = sampleField(new Float64Array(g.gw * g.gh), g, X, Y, M, K);
  for (const [gx, gy] of [[0, 0], [6, 6], [17, 9], [30, 26], [12, 20]]) close(vals[gy * g.gw + gx], potentialAt(g.ox + gx * g.cell, g.oy + gy * g.cell, X, Y, M, K), 1e-12);
});

test("breadth-first rings on a toy graph cap at three links", () => {
  // 0-1-2-3-4, 1-5, and 6 unconnected.
  const { adj, deg } = adjacency(7, [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5]]);
  assert.deepEqual([...deg], [1, 3, 2, 2, 1, 1, 0]);
  assert.deepEqual([...hopRings(adj, 0)], [0, 1, 2, 3, 3, 2, 3]);
  assert.deepEqual([...hopRings(adj, 2)], [2, 1, 0, 1, 2, 2, 3]);
  assert.deepEqual([...hopRings(adj, 6)], [3, 3, 3, 3, 3, 3, 0]);
});

test("a contour that encloses no page is removed, and contours around pages are kept", () => {
  // Eight pages on a circle: the field has a local minimum at the empty centre, so some levels have a hole there.
  const n = 8, X = new Float64Array(n), Y = new Float64Array(n), M = new Float64Array(n).fill(1), K = new Float64Array(n).fill(10);
  for (let i = 0; i < n; i++) { X[i] = 160 + 90 * Math.cos((i * Math.PI) / 4); Y[i] = 160 + 90 * Math.sin((i * Math.PI) / 4); }
  const g = { gw: 81, gh: 81, cell: 4, ox: 0, oy: 0 };
  const vals = sampleField(new Float64Array(g.gw * g.gh), g, X, Y, M, K);
  const px = Array.from(X, (x) => x / g.cell + 0.5), py = Array.from(Y, (y) => y / g.cell + 0.5);
  const centre = vals[40 * g.gw + 40];
  const level = centre * 1.05; // just above the central minimum
  const [geometry] = contours().size([g.gw, g.gh]).thresholds([level])(vals);
  const holes = geometry.coordinates.flatMap((p) => p.slice(1));
  assert.ok(holes.some((h) => ringContains(h, 40.5, 40.5)), "the raw contour has a hole round the empty centre");
  const kept = pageRings(geometry, px, py);
  assert.ok(kept.length >= 1);
  assert.ok(!kept.some((r) => ringContains(r, 40.5, 40.5) && !px.some((x, k) => ringContains(r, x, py[k]))), "no kept ring is empty");
  for (const r of kept) assert.ok(px.some((x, k) => ringContains(r, x, py[k])), "every kept ring encloses a page");
  // A synthetic island with no page is dropped with its holes; the page's polygon stays.
  const square = (x0, y0, s) => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]];
  const kept2 = pageRings({ coordinates: [[square(0, 0, 10)], [square(20, 20, 10), square(22, 22, 2)]] }, [5], [5]);
  assert.deepEqual(kept2, [square(0, 0, 10)]);
});

test("contour levels are geometric and the chosen page's own contours are exact circles", () => {
  const { levels, top } = contourLevels(Array.from({ length: 1000 }, (_, i) => 0.1 + i / 1000));
  assert.ok(levels.length > 10 && levels.length <= 34);
  const ratios = levels.slice(1).map((v, i) => v / levels[i]);
  for (const r of ratios) close(r, ratios[0], 1e-9);
  close(top, 0.1 + 999 / 1000, 1e-12);
  for (const t of [0.2, 0.5, 0.85]) { // the peak is 30 / 34
    const r = wellRadius(30, 34, t);
    for (const a of [0, 1, 2.5, 4]) close(potentialAt(r * Math.cos(a), r * Math.sin(a), [0], [0], [30], [34]), t, 1e-12);
  }
  assert.equal(wellRadius(1, 10, 1), 0, "levels above the peak have no contour");
  const well = wellLevels(30, 34, 80, 7);
  assert.equal(well.length, 7);
  close(wellRadius(30, 34, well[0]), 80, 1e-9);
  for (let k = 1; k < well.length; k++) assert.ok(wellRadius(30, 34, well[k]) < wellRadius(30, 34, well[k - 1]), "circles shrink towards the centre");
  assert.ok(wellRadius(30, 34, well.at(-1)) > 0, "the deepest level is below the peak");
  assert.ok(wellRadius(3, 34, well[0]) === 0, "a light page has no contour at the well's levels, so the circles grow as its mass rises");
});

test("rings are traced as closed smooth curves through edge midpoints", () => {
  const calls = [];
  const path = { moveTo: (...a) => calls.push(["M", ...a]), quadraticCurveTo: (...a) => calls.push(["Q", ...a]), closePath: () => calls.push(["Z"]) };
  traceSmoothRing(path, [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]], 2, 10, 20);
  assert.equal(calls.filter((c) => c[0] === "Q").length, 4, "the duplicated closing vertex is not traced twice");
  assert.deepEqual(calls[0], ["M", 10 + 0.5 * 2, 20 + 1.5 * 2]);
  assert.deepEqual(calls.at(-2).slice(3), calls[0].slice(1), "the curve ends where it began");
  assert.deepEqual(calls.at(-1), ["Z"]);
  calls.length = 0; traceSmoothRing(path, [[0, 0], [1, 1]], 1, 0, 0); assert.equal(calls.length, 0);
});

test("a dragged page is kinematic and its neighbours follow; free pages settle on their targets", () => {
  const links = [[0, 1], [1, 2]];
  const s = createState(3, links);
  [[100, 100], [140, 100], [180, 100]].forEach(([x, y], i) => { s.X[i] = s.TX[i] = x; s.Y[i] = s.TY[i] = y; });
  s.M0.fill(1); s.MV.fill(1); s.MT.fill(1); s.R0.fill(4); s.RAD.fill(4); s.RADT.fill(4); s.KR.fill(12); s.KRT.fill(12);
  for (let l = 0; l < links.length; l++) s.REST[l] = 40;
  for (let k = 0; k < 30; k++) {
    integrate(s, 1 / 60, { drag: 0, dragX: 100, dragY: 220, coupling: 16 });
    assert.equal(s.X[0], 100); assert.equal(s.Y[0], 220);
  }
  assert.ok(s.Y[1] > 140, `the linked page follows (y = ${s.Y[1].toFixed(1)})`);
  assert.ok(s.Y[2] > 100 && s.Y[2] < s.Y[1], "the page two links away lags behind");
  let busy = Infinity;
  for (let k = 0; k < 600; k++) busy = integrate(s, 1 / 60, {});
  assert.ok(busy < 2.5, `the system comes to rest (busy ${busy})`);
  for (let i = 0; i < 3; i++) { close(s.X[i], s.TX[i], 0.5); close(s.Y[i], s.TY[i], 0.5); }
});

test("ring geometry nests inside the stage and pages land on their ellipse in angular order", () => {
  const geo = ringGeometry(900, 700, { S: 1, RS: 1, narrow: false, counts: [1, 17, 28, 44] });
  const ry = 700 / 2 - 24;
  assert.ok(geo.R1 > 0 && geo.R1 < geo.R2 && geo.R2 <= 0.8 * ry + 1e-9);
  const X = [500, 300, 450, 600], Y = [200, 360, 520, 380], TX = [], TY = [];
  placeOnRing([0, 1, 2, 3], X, Y, 450, 350, geo.e, geo.cx, geo.cy, geo.R1 * geo.e, geo.R1, TX, TY);
  for (let i = 0; i < 4; i++) close(((TX[i] - geo.cx) / (geo.R1 * geo.e)) ** 2 + ((TY[i] - geo.cy) / geo.R1) ** 2, 1, 1e-9);
  const angle = (i) => Math.atan2(TY[i] - geo.cy, TX[i] - geo.cx);
  const order = [0, 1, 2, 3].sort((a, b) => angle(a) - angle(b));
  const before = [0, 1, 2, 3].sort((a, b) => Math.atan2(Y[a] - 350, X[a] - 450) - Math.atan2(Y[b] - 350, X[b] - 450));
  const rot = order.indexOf(before[0]);
  assert.deepEqual([...order.slice(rot), ...order.slice(0, rot)], before, "cyclic order is preserved");
});

test("labels never overlap one another, stay inside the stage, and avoid marks", () => {
  // Regression from the old network: "Econometric Argument" among a run of course marks.
  const marks = [[300, 500], [320, 500], [342, 497], [364, 503], [388, 500], [412, 499], [300, 520], [300, 481]];
  const X = marks.map((m) => m[0]), Y = marks.map((m) => m[1]), MR = marks.map(() => 7), W = 800, H = 640;
  const item = (key, i, w) => ({ key, i, x: X[i], y: Y[i], r: 5, w, h: 15, force: true });
  const placed = placeLabels([item("a", 0, 130), item("b", 4, 60), item("c", 6, 90)], { X, Y, MR, n: marks.length, W, H });
  assert.equal(placed.length, 3);
  const boxes = placed.map(([it, x, y]) => [x - 2, y - 1, x + it.w + 2, y + it.h + 1]);
  for (const [i, b] of boxes.entries()) {
    assert.ok(b[0] >= 4 && b[2] <= W - 4 && b[1] >= 4 && b[3] <= H - 4, "inside the stage");
    for (const o of boxes.slice(i + 1)) assert.ok(!(b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]), "labels do not overlap");
  }
  const [it, bx, by] = placed[0];
  for (let k = 1; k < marks.length; k++) assert.ok(!(bx - 2 < X[k] + 7 && bx + it.w + 2 > X[k] - 7 && by - 1 < Y[k] + 7 && by + it.h + 1 > Y[k] - 7), `label a clears mark ${k}`);
  // A label at the right edge moves inside; an unforced label with no free spot is left out.
  const edge = placeLabels([{ key: "e", x: 790, y: 200, r: 4, w: 60, h: 15 }], { X: [], Y: [], MR: [], n: 0, W, H });
  assert.ok(edge[0][1] + 60 <= W - 4);
  const crowded = placeLabels([{ key: "x", x: 10, y: 10, r: 4, w: 900, h: 15 }], { X: [], Y: [], MR: [], n: 0, W, H });
  assert.equal(crowded.length, 0);
  assert.equal(labelCandidates(0, 0, 4, 10, 10).length, 18);
});

test("every label position clears its own glyph by the requested gap, for every page type", () => {
  // Points along each glyph's outline; a label box must keep at least `gap` from all of them.
  const outline = (type, r) => {
    const v = glyphVertices(type, r);
    if (!v) return Array.from({ length: 90 }, (_, k) => [r * Math.cos((k * Math.PI) / 45), r * Math.sin((k * Math.PI) / 45)]);
    return v.flatMap(([x0, y0], k) => { const [x1, y1] = v[(k + 1) % v.length]; return Array.from({ length: 20 }, (_, t) => [x0 + ((x1 - x0) * t) / 20, y0 + ((y1 - y0) * t) / 20]); });
  };
  for (const type of ["paper", "data", "course", "tool", "page"]) {
    const r = 7, gap = 5, pts = outline(type, r);
    const cands = labelCandidates(0, 0, padReach(glyphReach(type, r), gap), 80, 15);
    cands.forEach(([bx, by], k) => {
      const box = [bx, by, bx + 80, by + 15], d = Math.min(...pts.map(([x, y]) => boxDistance(box, x, y)));
      assert.ok(d >= gap - 1e-6, `${type} candidate ${k} is ${d.toFixed(2)} px from the glyph`);
    });
    assert.ok(glyphRadius(type, r) >= Math.max(...pts.map(([x, y]) => Math.hypot(x, y))) - 1e-9);
  }
});

test("a label is never placed where another mark is nearly as close as its own", () => {
  // The right-hand place would put the label's far end beside another page; the label goes left instead.
  const X = [200, 280], Y = [200, 206], MR = [6, 6], W = 600, H = 400;
  const it = { key: "a", i: 0, x: 200, y: 200, r: 10, w: 60, h: 15 };
  const [[, bx, by]] = placeLabels([it], { X, Y, MR, n: 2, W, H });
  const box = labelBox(it, bx, by), own = boxDistance(box, X[0], Y[0]);
  assert.ok(boxDistance(box, X[1], Y[1]) >= ASSOCIATION * own + 2, "the other page is clearly farther");
  assert.ok(bx + it.w < 200, "the label sits to the left of its mark");
});

test("room is reserved for forced labels: covered pages move aside, the labelled pages stay put", () => {
  // A crowd round page 0: every place for its label would cover or crowd a neighbour.
  const X = [300, 330, 270, 300, 300, 352, 248, 355, 245], Y = [200, 200, 200, 172, 228, 182, 182, 219, 219];
  const n = X.length, MR = X.map(() => 6), W = 600, H = 400, X0 = X.slice(), Y0 = Y.slice();
  const items = [{ key: 0, i: 0, r: 9, w: 70, h: 15 }, { key: 5, i: 5, r: 9, w: 40, h: 15 }];
  const seeds = reserveLabelRoom(items, { X, Y, MR, n, W, H });
  assert.equal(X[0], X0[0]); assert.equal(Y[0], Y0[0]); assert.equal(X[5], X0[5]); assert.equal(Y[5], Y0[5]);
  const moved = X.map((x, j) => Math.hypot(x - X0[j], Y[j] - Y0[j]));
  assert.ok(moved.some((d) => d > 0), "some neighbours moved");
  assert.ok(Math.max(...moved) < 45, "and none moved far");
  const last = new Map(seeds);
  const placed = placeLabels(items.map((it) => ({ ...it, x: X[it.i], y: Y[it.i] })), { X, Y, MR, n, W, H, last });
  assert.equal(placed.length, 2);
  for (const [it, bx, by] of placed) {
    const box = labelBox(it, bx, by), own = boxDistance(box, X[it.i], Y[it.i]);
    for (let j = 0; j < n; j++) {
      if (j === it.i) continue;
      assert.ok(boxDistance(box, X[j], Y[j]) >= ASSOCIATION * own + 2 - 1e-9, `label ${it.key} is clearly nearest its own page, not ${j}`);
    }
  }
});

test("precomputed layouts are deterministic, normalised, and scale to any stage", () => {
  const nodes = [
    { id: "/", kb: 80, topics: ["profile"] }, { id: "/a/", kb: 40, topics: ["trade"] }, { id: "/b/", kb: 20, topics: ["trade", "measurement"] },
    { id: "/c/", kb: 60, topics: ["teaching"] }, { id: "/d/", kb: 10, topics: ["place"] }, { id: "/e/", kb: 30, topics: ["measurement"] },
  ];
  const links = [[0, 1], [0, 3], [1, 2], [2, 5], [3, 4], [0, 4]];
  const a = computeLayouts(nodes, links), b = computeLayouts(nodes, links);
  assert.deepEqual(a, b);
  for (const [name, [w, h]] of Object.entries(LAYOUT_FRAMES)) {
    assert.equal(a[name].w, w); assert.equal(a[name].h, h); assert.equal(a[name].xy.length, 2 * nodes.length);
    for (const v of a[name].xy) assert.ok(v > 0 && v < 1, `${name} coordinates lie inside the stage`);
  }
  const scaled = scaleLayout(a.wide, nodes.length, 1000, 500);
  close(scaled.X[2], a.wide.xy[4] * 1000); close(scaled.Y[2], a.wide.xy[5] * 500);
  assert.equal(scaleLayout(a.wide, nodes.length + 1, 1000, 500), null);
  assert.equal(scaleLayout(undefined, 3, 10, 10), null);
});

test("descriptions are cut at the first real full stop, and glyphs match the page types", () => {
  assert.equal(firstSentence("A St. Louis lab for U.S. data. Second sentence."), "A St. Louis lab for U.S. data.");
  assert.equal(firstSentence("No full stop here"), "No full stop here");
  assert.equal(glyphVertices("tool", 4).length, 10);
  assert.equal(glyphVertices("page", 4), null);
  assert.equal(glyphPathData("page", 4), null);
  assert.match(glyphPathData("paper", 4.6), /^M[-\d. L]+Z$/);
});
