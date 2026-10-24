// Rest-state layout for the home-page gravity field: each page settles in its topic basin under
// d3-force, then the result is fitted to the stage. scripts/build-field-data.mjs runs this once per
// build and stores normalised coordinates in field.json, so the browser only scales them.
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import { adjacency, hash, markRadius, pageMass, stageScales, topicAnchor } from "./gravity-field.mjs";

/** Reference stages, in CSS pixels: the desktop map at 1440 x 900 and the phone map at 390 px wide. */
export const LAYOUT_FRAMES = Object.freeze({ wide: Object.freeze([930, 656]), narrow: Object.freeze([358, 470]) });

/** Settled positions, in pixels, for nodes ({ id, kb, topics }) and [a, b] links on a W x H stage. */
export function layoutPositions(nodes, links, W, H) {
  const n = nodes.length;
  const { deg } = adjacency(n, links);
  const { S, RS } = stageScales(W, H);
  const home = Math.max(0, nodes.findIndex((d) => d.id === "/"));
  const R0 = nodes.map((d, i) => markRadius(pageMass(d.kb, deg[i]), i === home, RS));
  const cx = W / 2, cy = H / 2, ax = W * 0.31, ay = H * 0.31;
  const sim = nodes.map((d, i) => {
    const [x, y] = topicAnchor(d.topics, cx, cy, ax, ay);
    return { i, ax: x, ay: y, x: x + (hash(i) - 0.5) * 40 * S, y: y + (hash(i + 91) - 0.5) * 40 * S };
  });
  sim[home].fx = cx; sim[home].fy = cy;
  const shared = (a, b) => (nodes[a].topics || []).some((t) => (nodes[b].topics || []).includes(t));
  const springs = links.map(([a, b]) => ({ source: a, target: b, same: shared(a, b) }));
  const force = forceSimulation(sim).stop()
    .force("link", forceLink(springs).distance((l) => (l.same ? 30 : 78) * S)
      .strength((l) => (l.same ? 0.7 : 0.35) / Math.max(1, Math.min(deg[l.source.i], deg[l.target.i]))))
    .force("charge", forceManyBody().strength(-40 * S).distanceMax(170 * S))
    .force("collide", forceCollide((d) => R0[d.i] + 5 * S).iterations(2))
    .force("x", forceX((d) => d.ax).strength(0.17))
    .force("y", forceY((d) => d.ay).strength(0.17));
  for (let k = 0; k < 320; k++) force.tick();

  // Fit the bounding box to the stage, leaving room for labels at the sides.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const d of sim) {
    const r = R0[d.i];
    x0 = Math.min(x0, d.x - r); x1 = Math.max(x1, d.x + r); y0 = Math.min(y0, d.y - r); y1 = Math.max(y1, d.y + r);
  }
  const narrow = W < 600;
  const padX = (narrow ? 20 : 96) * S, padT = 46 * S, padB = (narrow ? 34 : 46) * S;
  let kx = (W - 2 * padX) / (x1 - x0), ky = (H - padT - padB) / (y1 - y0);
  kx = Math.min(kx, ky * 1.45); ky = Math.min(ky, kx * 1.45);
  const ox = padX + (W - 2 * padX - (x1 - x0) * kx) / 2, oy = padT + (H - padT - padB - (y1 - y0) * ky) / 2;
  for (const d of sim) {
    d.x = ox + (d.x - x0) * kx; d.y = oy + (d.y - y0) * ky;
    d.ax = d.x; d.ay = d.y; d.vx = 0; d.vy = 0;
  }
  sim[home].fx = sim[home].x; sim[home].fy = sim[home].y;

  // Relax at the final scale so marks do not overlap.
  force.force("link", null).force("charge", null)
    .force("x", forceX((d) => d.ax).strength(0.25)).force("y", forceY((d) => d.ay).strength(0.25)).alpha(0.4);
  for (let k = 0; k < 80; k++) force.tick();
  return { X: sim.map((d) => d.x), Y: sim.map((d) => d.y) };
}

/** Layouts for every reference stage, as { w, h, xy } with coordinates divided by the stage size. */
export function computeLayouts(nodes, links) {
  const out = {};
  for (const [name, [w, h]] of Object.entries(LAYOUT_FRAMES)) {
    const { X, Y } = layoutPositions(nodes, links, w, h);
    const xy = [];
    for (let i = 0; i < nodes.length; i++) xy.push(Math.round((X[i] / w) * 1e4) / 1e4, Math.round((Y[i] / h) * 1e4) / 1e4);
    out[name] = { w, h, xy };
  }
  return out;
}
