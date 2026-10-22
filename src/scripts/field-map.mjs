import * as d3 from "d3";
import { TOPIC_ORDER, TOPIC_NAMES, TOPIC_SHORT } from "../data/field-topics.mjs";
import {
  buildGraph,
  bfs as bfsOn,
  shortest as shortestOn,
  maxHop,
  ringRadii as ringRadiiOf,
  withinHops,
  parentRoute,
  byline,
  reference,
  groupLinked,
  searchRank,
  stepThrough,
} from "../lib/field-graph.mjs";

const rootEl = document.querySelector("[data-field-map]");
if (rootEl) {
  fetch(rootEl.dataset.src)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(init)
    .catch(() => {
      const panel = document.getElementById("fm-panel");
      if (panel)
        panel.innerHTML =
          '<div class="pad"><h2>Map data unavailable</h2><p class="d">The map could not load its data. The index of all pages is at <a href="/library/">the public index</a>.</p></div>';
    });
}

function init(D) {
  const SITE = location.origin;
  const LINKS = D.links.map(([a, b]) => ({ source: D.nodes[a].id, target: D.nodes[b].id }));
  const WALKS = Object.fromEntries(Object.entries(D.routes).map(([name, route]) => [name, route.steps]));
  const COL = Object.fromEntries(TOPIC_ORDER.map((t) => [t, `var(--topic-${t})`]));
  const NAME = TOPIC_NAMES;
  const SHORT = TOPIC_SHORT;
  const ORDER = TOPIC_ORDER;
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SYM = {
    paper: d3.symbolSquare,
    data: d3.symbolDiamond,
    tool: d3.symbolStar,
    course: d3.symbolTriangle,
    page: d3.symbolCircle,
  };
  const KIND = { paper: "Paper", data: "Dataset", tool: "Instrument", course: "Course", page: "Page" };
  const GROUPS = [
    ["paper", "Papers"],
    ["data", "Data"],
    ["tool", "Instruments"],
    ["course", "Courses"],
    ["page", "Other pages"],
  ];
  const nodes = D.nodes.map((n, i) => ({
    ...n,
    idx: i,
    full: n.title,
    title: n.label || n.title,
    lens: n.topics,
    p: n.topics[0],
    meta: n.meta || null,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { adj, deg } = buildGraph(nodes.map((n) => n.id), LINKS);
  const R = (n) => Math.max(4.5, Math.min(13, 3.5 + Math.sqrt(n.kb) * 0.45));
  const symD = (n, k = 1) =>
    d3
      .symbol()
      .type(SYM[n.type])
      .size(Math.PI * R(n) * R(n) * (n.type === "page" ? 1 : 1.25) * k)();
  const bfs = (start) => bfsOn(adj, start);
  const shortest = (a, b) => shortestOn(adj, a, b);
  const HOME = bfs("/");
  const MXH = maxHop(HOME);
  const mkLinks = () => LINKS.map((l) => ({ source: l.source, target: l.target }));
  const cite = (n) => byline(n.meta);
  /* folder hierarchy for the Sections layout */
  const parentOf = (id) => parentRoute(id, (route) => byId.has(route));
  const H = d3
    .stratify()
    .id((d) => d.id)
    .parentId((d) => (d.id === "/" ? null : parentOf(d.id)))(nodes);
  H.sort((a, b) => a.height - b.height || (a.id < b.id ? -1 : 1));
  d3
    .cluster()
    .size([2 * Math.PI, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.7))(H);
  const hn = new Map(H.descendants().map((d) => [d.id, d]));
  const topOf = (d) => {
    let x = d;
    while (x.depth > 1) x = x.parent;
    return x;
  };
  nodes.forEach((n) => {
    const d = hn.get(n.id);
    const t = d.depth === 0 ? null : topOf(d);
    n.osection = t && t.children ? t.id : "core";
  });
  function forces(sim, links, w, h, lens, hp) {
    const sm = Math.min(w, h),
      R0 = sm * 0.17,
      mx = hp ? maxHop(hp) : 0;
    sim
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(hp ? 30 : 55)
          .strength(
            (l) =>
              (hp ? 0.05 : 1) *
              Math.min(0.9, 1.6 / Math.min(deg[l.source.id || l.source], deg[l.target.id || l.target])),
          ),
      )
      .force("charge", d3.forceManyBody().strength(hp ? -60 : -95))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(hp ? 0 : 0.06))
      .force("x", d3.forceX(w / 2).strength(hp ? 0 : 0.05))
      .force("y", d3.forceY(h / 2).strength(hp ? 0 : 0.05))
      .force(
        "col",
        d3.forceCollide((d) => R(d) + 3),
      )
      .force(
        "rad",
        d3
          .forceRadial(
            (d) =>
              hp
                ? d.id === hp.__s
                  ? 0
                  : (hp[d.id] ?? mx + 1) * R0
                : lens === "all" || d.lens.includes(lens)
                  ? sm * 0.12
                  : sm * 0.46,
            w / 2,
            h / 2,
          )
          .strength(hp ? 0.95 : lens === "all" ? 0 : 0.85),
      );
  }
  const svg = d3.select("#fm-svg"),
    stage = document.getElementById("fm-stage");
  let routeMsg = "",
    W = stage.clientWidth,
    Hh = stage.clientHeight,
    lens = "all",
    sel = null,
    hov = null,
    walk = null,
    hp = null,
    mode = "terrain",
    fitted = false,
    tc = 0,
    trail = [],
    dossier = [],
    tracing = null,
    cand = null,
    route = null;
  const defs = svg.append("defs");
  const gr = defs.append("radialGradient").attr("id", "pen").attr("gradientUnits", "userSpaceOnUse");
  gr.append("stop").attr("offset", "55%").attr("stop-color", "currentColor").attr("stop-opacity", 0);
  gr.append("stop").attr("offset", "100%").attr("stop-color", "currentColor").attr("stop-opacity", 0.1);
  const root = svg.append("g");
  const cg = root.append("g").attr("pointer-events", "none");
  const pen = root
    .append("circle")
    .attr("fill", "url(#pen)")
    .attr("opacity", 0)
    .attr("pointer-events", "none");
  const pl = root
    .append("text")
    .attr("font-size", 12)
    .style("fill", "var(--ink-muted)")
    .attr("text-anchor", "middle")
    .text("Not related to this topic")
    .attr("opacity", 0);
  const rg = root.append("g").attr("pointer-events", "none");
  const og = root.append("g").attr("pointer-events", "none").attr("opacity", 0);
  const bg = root.append("g").attr("opacity", 0);
  const links = mkLinks();
  const eg = root.append("g"),
    wg = root.append("g").attr("pointer-events", "none"),
    pg = root.append("g").attr("pointer-events", "none"),
    ng = root.append("g"),
    sg = root.append("g").attr("pointer-events", "none");
  const edge = eg.selectAll("line").data(links).join("line").attr("class", "edge");
  const hlinks = LINKS.map((l) => ({
    s: l.source,
    t: l.target,
    path: hn.get(l.source).path(hn.get(l.target)),
  }));
  const bund = bg.selectAll("path").data(hlinks).join("path").attr("class", "bu");
  const node = ng
    .selectAll("g")
    .data(nodes, (d) => d.id)
    .join("g")
    .attr("class", "nd")
    .attr("tabindex", 0)
    .attr("role", "link")
    .attr("aria-label", (d) => d.title + ", " + KIND[d.type])
    .style("--i", (d, i) => i);
  const shape = node
    .append("path")
    .attr("class", "sh")
    .attr("d", (d) => symD(d));
  node
    .filter((d) => d.lens.length > 1)
    .append("circle")
    .attr("class", "ring")
    .attr("r", (d) => R(d) + 3.5);
  const txt = node
    .append("text")
    .attr("x", (d) => R(d) + 6)
    .attr("y", 4)
    .text((d) => (d.title.length > 30 ? d.title.slice(0, 28) + "…" : d.title));
  const sim = d3.forceSimulation(nodes);
  forces(sim, links, W, Hh, "all", null);
  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", (e) => {
      root.attr("transform", e.transform);
      if (mode !== "orbit") qLabels();
    });
  svg.call(zoom);
  /* ---------- layouts ---------- */
  const ORB = () => Math.max(120, Math.min(W / 2 - 130, Hh / 2 - 84));
  function orbitPos() {
    const r = ORB();
    nodes.forEach((n) => {
      const d = hn.get(n.id),
        th = d.x - Math.PI / 2,
        rr = d.y * r;
      n.ox = W / 2 + rr * Math.cos(th);
      n.oy = Hh / 2 + rr * Math.sin(th);
      n.th = th;
    });
  }
  const ringRadii = (RR) =>
    ringRadiiOf(nodes.map((n) => n.id), HOME, MXH, RR);
  const WITHIN2 = withinHops(nodes.map((n) => n.id), HOME, 2);
  const CR = () => Math.max(120, Math.min(W / 2 - 90, Hh / 2 - 110));
  function compassPos() {
    const RR = CR(),
      rr = ringRadii(RR),
      cx = W / 2,
      cy = Hh / 2,
      half = (Math.PI / 5) * 0.86,
      groups = {};
    nodes.forEach((n) => {
      const k = n.id === "/" ? 0 : (HOME[n.id] ?? MXH + 1);
      n.ck = k;
      (groups[n.p + "|" + k] = groups[n.p + "|" + k] || []).push(n);
    });
    Object.values(groups).forEach((g) => {
      g.sort((a, b) => (a.id < b.id ? -1 : 1));
      const ac = -Math.PI / 2 + (ORDER.indexOf(g[0].p) * 2 * Math.PI) / 5;
      g.forEach((n, i) => {
        const a = g.length === 1 ? ac : ac - half + ((i + 0.5) / g.length) * 2 * half;
        n.cx = cx + rr[n.ck] * Math.cos(a);
        n.cy = cy + rr[n.ck] * Math.sin(a);
      });
    });
    const pts = nodes.map((n) => ({ x: n.cx, y: n.cy, tx: n.cx, ty: n.cy, r: R(n) }));
    const s = d3
      .forceSimulation(pts)
      .stop()
      .force("x", d3.forceX((d) => d.tx).strength(0.3))
      .force("y", d3.forceY((d) => d.ty).strength(0.3))
      .force(
        "c",
        d3.forceCollide((d) => d.r + 2.5),
      );
    for (let i = 0; i < 160; i++) s.tick();
    nodes.forEach((n, i) => {
      n.cx = pts[i].x;
      n.cy = pts[i].y;
    });
    return { RR, rr };
  }
  function drawOrbit() {
    orbitPos();
    const r = ORB();
    bg.attr("transform", `translate(${W / 2},${Hh / 2})`);
    const lr = d3
      .lineRadial()
      .curve(d3.curveBundle.beta(0.85))
      .angle((d) => d.x)
      .radius((d) => d.y * r);
    bund.attr("d", (d) => lr(d.path));
    og.selectAll("*").remove();
    og.attr("transform", `translate(${W / 2},${Hh / 2})`);
    const secs = d3.group(nodes, (n) => n.osection);
    const arc = d3.arc();
    secs.forEach((ns, id) => {
      const xs = ns.map((n) => hn.get(n.id).x),
        a0 = Math.min(...xs) - 0.012,
        a1 = Math.max(...xs) + 0.012;
      const lab = id === "core" ? "Main pages" : id.replace(/^\//, "").replace(/\/$/, "").replace(/-/g, " ");
      og.append("path")
        .attr("d", arc({ innerRadius: r + 16, outerRadius: r + 18, startAngle: a0, endAngle: a1 }))
        .style("fill", "var(--ink)");
      const m = (a0 + a1) / 2,
        flip = Math.cos(m - Math.PI / 2) < 0,
        dg = ((m - Math.PI / 2) * 180) / Math.PI + (flip ? 180 : 0);
      og.append("text")
        .attr("class", "sec-l")
        .attr("transform", `rotate(${dg}) translate(${flip ? -(r + 28) : r + 28},4)`)
        .attr("text-anchor", flip ? "end" : "start")
        .text(lab.charAt(0).toUpperCase() + lab.slice(1) + " (" + ns.length + ")");
    });
    og.append("text").attr("class", "core-t").attr("y", -30).text("Ian Helfrich");
    og.append("text")
      .attr("class", "core-s")
      .attr("y", -10)
      .text(nodes.length + " pages, " + LINKS.length + " links");
  }
  function drawCompass() {
    const { RR, rr } = compassPos();
    bg.attr("transform", null);
    og.attr("transform", null);
    og.selectAll("*").remove();
    const cx = W / 2,
      cy = Hh / 2;
    const cp = (a, b) => {
      const mx = (a.cx + b.cx) / 2,
        my = (a.cy + b.cy) / 2;
      return `M${a.cx},${a.cy}Q${mx + (cx - mx) * 0.45},${my + (cy - my) * 0.45} ${b.cx},${b.cy}`;
    };
    bund.attr("d", (d) => cp(byId.get(d.s), byId.get(d.t)));
    for (let k = 1; k <= MXH + 1; k++) {
      og.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", rr[k])
        .attr("fill", "none")
        .style("stroke", "var(--ink)")
        .attr("stroke-opacity", 0.14)
        .attr("stroke-dasharray", "2 5");
      og.append("text")
        .attr("class", "ring-l")
        .attr("x", cx + 5)
        .attr("y", cy - rr[k] + 12)
        .text(k <= MXH ? k + (k > 1 ? " links" : " link") + " from home" : "not linked from home");
    }
    const wide = W > 760;
    ORDER.forEach((l, i) => {
      const ac = -Math.PI / 2 + (i * 2 * Math.PI) / 5,
        a = ac + Math.PI / 5,
        x = cx + RR * 1.05 * Math.cos(a),
        y = cy + RR * 1.05 * Math.sin(a);
      og.append("line")
        .attr("x1", cx)
        .attr("y1", cy)
        .attr("x2", x)
        .attr("y2", y)
        .style("stroke", "var(--ink)")
        .attr("stroke-opacity", 0.14);
      const lx = cx + RR * 1.12 * Math.cos(ac),
        ly = cy + RR * 1.12 * Math.sin(ac);
      const an = Math.abs(Math.cos(ac)) < 0.2 ? "middle" : Math.cos(ac) > 0 ? "start" : "end";
      og.append("text")
        .attr("class", "sec-l")
        .attr("x", lx)
        .attr("y", ly + (Math.sin(ac) > 0.5 ? 10 : 0))
        .attr("text-anchor", an)
        .text(wide ? NAME[l] : SHORT[l]);
    });
  }
  /* ---------- labels ---------- */
  function prio() {
    const s = new Map();
    const add = (id, v) => {
      if (!s.has(id) || s.get(id) < v) s.set(id, v);
    };
    if (sel) {
      add(sel, 1e6);
      adj.get(sel).forEach((b) => add(b, 5e5 + (deg[b] || 0)));
    }
    if (hov) {
      add(hov, 9e5);
      adj.get(hov).forEach((b) => add(b, 4e5));
    }
    const seq = seqIds();
    if (seq) seq.forEach((id) => add(id, 8e5));
    nodes.forEach((n) => {
      let v = n.kb + (deg[n.id] || 0) * 2;
      if (lens !== "all" && n.lens.includes(lens)) v += 300;
      if (lens !== "all" && !n.lens.includes(lens)) v -= 1e3;
      if (dossier.includes(n.id)) v += 2e5;
      add(n.id, v);
    });
    return s;
  }
  const seqIds = () => (walk ? walk.steps.map((s) => s[0]) : route);
  let lq;
  function qLabels() {
    clearTimeout(lq);
    lq = setTimeout(placeLabels, 90);
  }
  function placeLabels() {
    const t = d3.zoomTransform(svg.node());
    if (mode === "orbit") {
      const seq = seqIds() || [];
      txt
        .attr("transform", (d) => {
          const th = d.th,
            flip = Math.cos(th) < 0;
          return `rotate(${(th * 180) / Math.PI + (flip ? 180 : 0)}) translate(${flip ? -(R(d) + 6) : R(d) + 6},0)`;
        })
        .attr("x", 0)
        .attr("text-anchor", (d) => (Math.cos(d.th) < 0 ? "end" : "start"))
        .attr("font-size", 10.5)
        .attr("opacity", (d) =>
          (sel && (d.id === sel || adj.get(sel).has(d.id))) ||
          (hov && (d.id === hov || adj.get(hov).has(d.id))) ||
          seq.includes(d.id)
            ? 1
            : 0,
        );
      return;
    }
    txt
      .attr("transform", null)
      .attr("x", (d) => R(d) + 6)
      .attr("text-anchor", "start")
      .attr("font-size", null);
    const p = prio(),
      order = [...nodes].sort((a, b) => p.get(b.id) - p.get(a.id)),
      boxes = [],
      show = new Set(),
      max = sel ? 26 : mode === "compass" ? 30 : 34;
    for (const n of order) {
      if (show.size >= max) break;
      const sx = t.applyX(n.x),
        sy = t.applyY(n.y);
      if (sx < 0 || sy < 0 || sx > W || sy > Hh) continue;
      const lab = n.title.length > 30 ? n.title.slice(0, 28) + "…" : n.title;
      const w = lab.length * 6.1 + 8,
        b = [sx + R(n) * t.k + 4, sy - 8, sx + R(n) * t.k + 4 + w, sy + 8];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b);
      show.add(n.id);
    }
    txt.attr("opacity", (d) => (show.has(d.id) ? 1 : 0));
  }
  function terrain() {
    if (mode !== "terrain") return;
    const pts = nodes.map((n) => ({
      x: n.x + W / 2,
      y: n.y + Hh / 2,
      w: lens === "all" || n.lens.includes(lens) ? 1 : 0.12,
    }));
    const cd = d3
      .contourDensity()
      .x((d) => d.x)
      .y((d) => d.y)
      .weight((d) => d.w)
      .size([W * 2, Hh * 2])
      .bandwidth(24)
      .thresholds(10)(pts);
    cg.attr("transform", `translate(${-W / 2},${-Hh / 2})`);
    cg.selectAll("path")
      .data(cd)
      .join("path")
      .attr("d", d3.geoPath())
      .style("fill", "var(--ink)")
      .style("fill-opacity", ".02")
      .style("stroke", "var(--ink)")
      .style("stroke-opacity", ".13")
      .attr("stroke-width", 0.6);
  }
  function overlay() {
    wg.selectAll("*").remove();
    sg.selectAll("*").remove();
    const seq = seqIds();
    if (!seq) return;
    const pts = seq.map((id) => byId.get(id));
    if (pts.some((p) => !isFinite(p.x) || !isFinite(p.y))) return;
    wg.append("path")
      .attr("d", d3.line()(pts.map((p) => [p.x, p.y])))
      .attr("fill", "none")
      .style("stroke", "var(--accent)")
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round");
    pts.forEach((p, i) => {
      const cur = walk && i === walk.i;
      const g = sg.append("g").attr("transform", `translate(${p.x},${p.y - R(p) - 11})`);
      g.append("circle")
        .attr("r", 9)
        .style("fill", cur ? "var(--ink)" : "var(--accent)")
        .style("stroke", "var(--surface)")
        .attr("stroke-width", 1.5);
      g.append("text")
        .attr("class", "stepn")
        .attr("y", 4)
        .style("fill", "#fff")
        .text(i + 1);
    });
  }
  function tick() {
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    if (mode === "terrain") {
      edge
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      if (++tc % 6 === 0) terrain();
      if (tc % 10 === 0) placeLabels();
    }
    if (seqIds()) overlay();
    if (!fitted && mode === "terrain" && sim.alpha() < 0.1) {
      fitted = true;
      fit();
    }
  }
  function fit() {
    if (mode !== "terrain") {
      (REDUCE ? svg : svg.transition().duration(700)).call(zoom.transform, d3.zoomIdentity);
      return;
    }
    if (hp) {
      const R0 = Math.min(W, Hh) * 0.17,
        mx = maxHop(hp),
        k = Math.min(W, Hh) / (2 * (mx + 1.25) * R0);
      (REDUCE ? svg : svg.transition().duration(700)).call(
        zoom.transform,
        d3.zoomIdentity.translate(W / 2 - (k * W) / 2, Hh / 2 - (k * Hh) / 2).scale(k),
      );
      return;
    }
    const xs = nodes.map((n) => n.x),
      ys = nodes.map((n) => n.y),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const k = Math.min(1.5, (W - 120) / Math.max(1, x1 - x0), (Hh - 150) / Math.max(1, y1 - y0));
    (REDUCE ? svg : svg.transition().duration(700)).call(
      zoom.transform,
      d3.zoomIdentity.translate(W / 2 - (k * (x0 + x1)) / 2, Hh / 2 - (k * (y0 + y1)) / 2 + 10).scale(k),
    );
  }
  sim.on("tick", tick).on("end", () => {
    terrain();
    placeLabels();
    if (seqIds()) overlay();
    fit();
  });
  function settle() {
    if (mode !== "terrain") return;
    if (REDUCE) {
      sim.stop();
      for (let i = 0; i < 320; i++) sim.tick();
      tick();
      terrain();
      overlay();
      rings();
      placeLabels();
      fit();
    } else {
      fitted = false;
      sim.alpha(0.9).restart();
    }
  }
  function rings() {
    rg.selectAll("*").remove();
    if (!hp || mode !== "terrain") return;
    const R0 = Math.min(W, Hh) * 0.17,
      mx = maxHop(hp);
    for (let k = 1; k <= mx + 1; k++) {
      rg.append("circle")
        .attr("cx", W / 2)
        .attr("cy", Hh / 2)
        .attr("r", k * R0)
        .attr("fill", "none")
        .style("stroke", "var(--ink)")
        .attr("stroke-opacity", 0.16)
        .attr("stroke-dasharray", "2 5");
      rg.append("text")
        .attr("class", "ring-l")
        .attr("x", W / 2)
        .attr("y", Hh / 2 - k * R0 - 5)
        .attr("text-anchor", "middle")
        .text(k <= mx ? k + (k > 1 ? " links" : " link") : "not linked");
    }
  }
  function seedRings() {
    const R0 = Math.min(W, Hh) * 0.17,
      mx = maxHop(hp),
      by = {};
    nodes.forEach((n) => {
      const k = n.id === sel ? 0 : (hp[n.id] ?? mx + 1);
      (by[k] = by[k] || []).push(n);
    });
    Object.keys(by).forEach((k) => {
      const a = by[k].sort((x, y) => ORDER.indexOf(x.p) - ORDER.indexOf(y.p) || (x.id < y.id ? -1 : 1));
      a.forEach((n, i) => {
        const th = (i / a.length) * 2 * Math.PI - Math.PI / 2;
        n.x = W / 2 + k * R0 * Math.cos(th);
        n.y = H_() / 2 + k * R0 * Math.sin(th);
        n.vx = 0;
        n.vy = 0;
      });
    });
  }
  const H_ = () => Hh;
  /* ---------- painting ---------- */
  const member = (d) => lens === "all" || d.lens.includes(lens);
  function fillOf(d) {
    if (d.id === sel || d.id === hov) return COL[d.p];
    if (mode === "compass") return COL[d.p];
    if (lens === "all") return "var(--ink)";
    return member(d) ? COL[d.p] : "var(--ink-muted)";
  }
  function paintEdges() {
    const f = hov || sel;
    const hot = (a, b) => f && (a === f || b === f);
    edge
      .style("opacity", (e) => {
        if (mode !== "terrain") return 0;
        let o = 0.2;
        if (lens !== "all" && !(e.source.lens.includes(lens) && e.target.lens.includes(lens))) o = 0.04;
        if (f) o = hot(e.source.id, e.target.id) ? 0.9 : 0.05;
        return o;
      })
      .classed("flow", (e) => !REDUCE && sel && (e.source.id === sel || e.target.id === sel))
      .style("stroke", (e) => (hot(e.source.id, e.target.id) ? COL[byId.get(f).p] : null));
    bund
      .style("stroke", (d) =>
        (f && hot(d.s, d.t)) || mode === "compass" ? COL[byId.get(d.s).p] : "var(--rule-strong)",
      )
      .style("opacity", (e) => {
        if (mode === "terrain") return 0;
        const a = byId.get(e.s),
          b = byId.get(e.t);
        let o = mode === "compass" ? 0.34 : 0.28;
        if (lens !== "all" && !(a.lens.includes(lens) && b.lens.includes(lens))) o = 0.04;
        if (f) o = hot(e.s, e.t) ? 0.95 : 0.04;
        return o;
      })
      .attr("stroke-width", (e) => (hot(e.s, e.t) ? 1.8 : 1));
    startParticles();
  }
  function paint() {
    shape.style("fill", fillOf).style("stroke", (d) => (d.id === sel ? "var(--ink)" : "var(--surface)"));
    node.style("opacity", (d) => {
      let o = 1;
      if (lens !== "all" && !d.lens.includes(lens)) o = 0.2;
      if (sel && mode === "terrain" && d.id !== sel && hp && hp[d.id] > 2) o = Math.min(o, 0.35);
      if (sel && mode !== "terrain" && d.id !== sel && !adj.get(sel).has(d.id)) o = Math.min(o, 0.4);
      if (route && !route.includes(d.id)) o = Math.min(o, 0.22);
      return o;
    });
    node.classed("sel", (d) => d.id === sel).classed("inpack", (d) => dossier.includes(d.id));
    node
      .select(".ring")
      .style("stroke", (d) => COL[d.lens.find((l) => l !== d.p)])
      .style("opacity", lens === "all" && mode !== "compass" ? 0 : 1);
    paintEdges();
    document.getElementById("fm-cap").textContent = {
      terrain:
        "Each point is a page and each line is a link. Pages that link to each other sit closer together.",
      orbit: "Pages are grouped by site section around the ring. Curves are links between pages.",
      compass:
        "Each wedge is a topic. Rings count the links needed to reach a page from the home page; " +
        WITHIN2 +
        " of " +
        nodes.length +
        " pages are within two.",
    }[mode];
    document.getElementById("fm-dn").textContent = dossier.length;
    placeLabels();
    overlay();
    rose();
    writeHash();
  }
  /* ---------- particles ---------- */
  let ptimer = null,
    parts = [];
  function startParticles() {
    const f = sel || hov;
    if (ptimer) {
      ptimer.stop();
      ptimer = null;
    }
    pg.selectAll("*").remove();
    parts = [];
    if (!f || REDUCE) return;
    const idx = [];
    LINKS.forEach((l, i) => {
      if (l.source === f || l.target === f) idx.push([i, l.source === f]);
    });
    const paths = bund.nodes();
    parts = idx
      .slice(0, 40)
      .flatMap(([i, fwd]) =>
        [0, 1].map((k) => ({ i, fwd, t: Math.random(), sp: 0.004 + Math.random() * 0.004, el: null })),
      );
    const col = COL[byId.get(f).p];
    parts.forEach((p) => {
      p.el = pg.append("circle").attr("r", 2.2).style("fill", col);
    });
    ptimer = d3.timer(() => {
      parts.forEach((p) => {
        p.t = (p.t + p.sp) % 1;
        const u = p.fwd ? p.t : 1 - p.t;
        let x, y;
        if (mode === "terrain") {
          const l = links[p.i],
            a = l.source,
            b = l.target;
          if (!a || a.x == null) return;
          x = a.x + (b.x - a.x) * u;
          y = a.y + (b.y - a.y) * u;
        } else {
          const el = paths[p.i];
          const L = el.getTotalLength();
          const pt = el.getPointAtLength(L * u);
          x = pt.x;
          y = pt.y;
          if (mode === "orbit") {
            x += W / 2;
            y += Hh / 2;
          }
        }
        p.el.attr("cx", x).attr("cy", y);
      });
    });
  }
  /* ---------- state changes ---------- */
  function setLens(l) {
    lens = l;
    if (mode === "terrain" && !sel) {
      forces(sim, links, W, Hh, l, null);
      settle();
    }
    const r = Math.min(W, Hh) * 0.46,
      on = l !== "all" && !sel && mode === "terrain" ? 1 : 0;
    pen
      .attr("cx", W / 2)
      .attr("cy", Hh / 2)
      .attr("r", r * 1.55)
      .attr("opacity", on);
    gr.attr("cx", W / 2)
      .attr("cy", Hh / 2)
      .attr("r", r * 1.55);
    pl.attr("x", W / 2)
      .attr("y", Hh / 2 - r - 10)
      .attr("opacity", on);
    if (mode === "terrain") terrain();
    renderPanel();
    paint();
    renderIndex();
  }
  function setMode(m, instant) {
    if (m === mode && !instant) return;
    mode = m;
    ["t", "o", "c"].forEach((k) =>
      document
        .getElementById("fm-m-" + k)
        .setAttribute("aria-pressed", { t: "terrain", o: "orbit", c: "compass" }[k] === m),
    );
    if (m === "terrain") {
      og.attr("opacity", 0);
      bg.attr("opacity", 0);
      cg.attr("opacity", 1);
      if (sel) {
        hp = Object.assign(bfs(sel), { __s: sel });
        seedRings();
      }
      forces(sim, links, W, Hh, lens, hp);
      rings();
      settle();
      setLens(lens);
    } else {
      sim.stop();
      hp = null;
      rg.selectAll("*").remove();
      if (m === "orbit") drawOrbit();
      else drawCompass();
      pen.attr("opacity", 0);
      pl.attr("opacity", 0);
      cg.attr("opacity", 0);
      bg.attr("opacity", 0);
      og.attr("opacity", 0);
      const done = () => {
        og.transition().duration(500).attr("opacity", 1);
        bg.transition().duration(500).attr("opacity", 1);
        fit();
        paint();
      };
      tween(
        nodes.map((n) => (m === "orbit" ? [n.ox, n.oy] : [n.cx, n.cy])),
        REDUCE || instant ? 0 : 1000,
        done,
      );
      fit();
      renderPanel();
    }
    paint();
  }
  function tween(tg, ms, done) {
    if (!ms) {
      nodes.forEach((n, i) => {
        n.x = tg[i][0];
        n.y = tg[i][1];
      });
      tick();
      done && done();
      return;
    }
    const s = nodes.map((n) => [n.x, n.y]),
      t0 = performance.now();
    const t = d3.timer(() => {
      const k = d3.easeCubicInOut(Math.min(1, (performance.now() - t0) / ms));
      nodes.forEach((n, i) => {
        n.x = s[i][0] + (tg[i][0] - s[i][0]) * k;
        n.y = s[i][1] + (tg[i][1] - s[i][1]) * k;
      });
      tick();
      if (k >= 1) {
        t.stop();
        done && done();
      }
    });
  }
  const glyph = (n, s = 11) =>
    `<svg width="${s * 2}" height="${s * 2}" viewBox="${-s} ${-s} ${s * 2} ${s * 2}" aria-hidden="true"><path d="${d3
      .symbol()
      .type(SYM[n.type])
      .size(s * s * 2.6)()}" style="fill:${COL[n.p]};stroke:var(--ink);stroke-width:1"/></svg>`;
  const li = (m, s = 8) =>
    `<li><button data-id="${m.id}">${glyph(m, s)}<b>${m.title.length > 46 ? m.title.slice(0, 44) + "…" : m.title}</b></button></li>`;
  const SELECTED = [
    "/research/helfrich-2026-nmtc-rural-gap/",
    "/research/helfrich-2024-dissertation/",
    "/research/gonchar-helfrich-2025-spotlight/",
    "/econometrics/",
  ];
  const selectedWork = () => {
    const items = SELECTED.filter((id) => byId.has(id)).map((id) => li(byId.get(id)));
    return items.length ? `<h3>Selected work</h3><ul class="near">${items.join("")}</ul>` : "";
  };
  const orderedLinked = (id) =>
    groupLinked([...adj.get(id)].map((b) => byId.get(b)), deg, GROUPS);
  function linked(id) {
    return orderedLinked(id)
      .map(
        ({ label, items }) =>
          `<h3>${label}</h3><ul class="near">${items.map((m) => li(m)).join("")}</ul>`,
      )
      .join("");
  }
  function renderPanel() {
    const p = document.getElementById("fm-panel");
    let h = "";
    const n = sel && byId.get(sel);
    h += `<div class="stripe" style="background:${n ? COL[n.p] : lens === "all" ? "var(--ink)" : COL[lens]}"></div><div class="pad">`;
    if (walk) {
      const s = walk.steps[walk.i];
      h += `<div class="walkbox"><div class="t">Route for ${walk.name.toLowerCase()}, ${walk.i + 1} of ${walk.steps.length}</div><p>${s[1]}</p><button class="fm-btn" id="wp" ${walk.i === 0 ? "disabled" : ""}>Back</button> <button class="fm-btn fill" id="wn">${walk.i === walk.steps.length - 1 ? "Finish" : "Next"}</button> <button class="fm-btn" id="we">End route</button></div>`;
    }
    if (tracing) {
      h += `<div class="walkbox"><div class="t">Trace path</div><p>Select a second page to see the shortest chain of links from “${byId.get(tracing).title.slice(0, 40)}”.</p><button class="fm-btn" id="tc">Cancel</button></div>`;
    }
    if (routeMsg && !route) {
      h += `<div class="walkbox"><p>${routeMsg}</p></div>`;
    }
    if (route) {
      const names = route.map((id) => byId.get(id));
      h += `<div class="walkbox"><div class="t">Path: ${route.length - 1} link${route.length > 2 ? "s" : ""}</div><ol class="steps">${names.map((m) => `<li><button data-id="${m.id}">${m.title.length > 44 ? m.title.slice(0, 42) + "…" : m.title}</button></li>`).join("")}</ol><button class="fm-btn" id="rc">Clear path</button></div>`;
    }
    if (!n) {
      h +=
        lens === "all"
          ? `<div class="fm-portrait"><img src="${rootEl.dataset.portrait}" alt="${rootEl.dataset.portraitAlt}" width="72" height="72" decoding="async"><div><h2>Ian Helfrich</h2><span>PhD in Economics, Georgia Tech, 2024</span></div></div><p class="d">Applied economist. Field: applied microeconomics and econometrics.</p><p class="d">Available for academic and industry roles, research collaborations, teaching, and select advisory work.</p><p class="acts"><a class="fm-btn fill" href="${SITE}/cv/">CV</a> <a class="fm-btn" href="${SITE}/job-market/">Job market page</a> <a class="fm-btn" href="${SITE}/contact/">Contact</a></p>${selectedWork()}<p class="mut sm">Select a page on the map to see what it links to. The map shows ${nodes.length} pages and ${LINKS.length} links, last built ${D.generated}.</p>`
          : `<h2>${NAME[lens]}</h2><p class="d">${nodes.filter((d) => d.lens.includes(lens)).length} pages are tagged with this topic. They are colored on the map; other pages are gray.</p><ul class="near">${nodes
              .filter((d) => d.lens.includes(lens))
              .sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0))
              .slice(0, 10)
              .map((m) => li(m))
              .join("")}</ul>`;
    } else {
      const tr = trail.slice(-5);
      const c = cite(n);
      const inD = dossier.includes(n.id);
      h += `<div class="trail">${tr.length > 1 ? tr.map((id, i) => (i === tr.length - 1 ? `<b>${byId.get(id).title.slice(0, 22)}</b>` : `<button data-id="${id}">${byId.get(id).title.slice(0, 22)}</button> ›`)).join(" ") : ""}</div><div class="kind">${glyph(n)}${KIND[n.type]}</div><p class="tags">${n.lens
        .map((t) => `<button class="fm-tag" data-topic="${t}"><i style="background:${COL[t]}"></i>${NAME[t]}</button>`)
        .join("")}</p><h2>${n.full}</h2>${c ? `<p class="cite">${c}</p>` : ""}<p class="d">${n.desc || ""}</p>${n.meta && n.meta.question ? `<p class="q">${n.meta.question}</p>` : ""}${n.meta && n.meta.role ? `<p class="cite"><b>Role.</b> ${n.meta.role}</p>` : ""}${n.meta && n.meta.limit ? `<p class="cite"><b>Limit.</b> ${n.meta.limit}</p>` : ""}${n.meta && n.meta.methods && n.meta.methods.length ? `<p class="cite"><b>Methods.</b> ${n.meta.methods.join(", ")}</p>` : ""}<p class="acts"><a class="fm-btn fill" href="${SITE}${n.id}">Open page</a> <button class="fm-btn" id="ad">${inD ? "Remove from dossier" : "Add to dossier"}</button> <button class="fm-btn" id="tr">Trace path</button> <button class="fm-btn" id="cp">Copy link</button> <button class="fm-btn" id="clr">Deselect</button></p>${mode === "terrain" ? '<p class="mut sm">Rings show the number of links between each page and this one.</p>' : ""}<p class="mut sm">Arrow keys preview the pages this one links to, Enter travels to the previewed page, and O opens this page.</p>${linked(n.id)}`;
    }
    p.innerHTML = h + "</div>";
    p.querySelectorAll("[data-id]").forEach(
      (b) =>
        (b.onclick = () => {
          walk = null;
          if (tracing) {
            finishTrace(b.dataset.id);
          } else pick(b.dataset.id);
        }),
    );
    p.querySelectorAll("[data-topic]").forEach(
      (b) =>
        (b.onclick = () => {
          walk = null;
          if (sel) {
            sel = null;
            hp = null;
            rings();
          }
          setLens(b.dataset.topic);
        }),
    );
    const $ = (i) => document.getElementById(i);
    if ($("clr"))
      $("clr").onclick = () => {
        walk = null;
        pick(null);
      };
    if ($("ad")) $("ad").onclick = () => toggleDossier(sel);
    if ($("tr"))
      $("tr").onclick = () => {
        tracing = sel;
        route = null;
        renderPanel();
        paint();
      };
    if ($("tc"))
      $("tc").onclick = () => {
        tracing = null;
        renderPanel();
      };
    if ($("rc"))
      $("rc").onclick = () => {
        route = null;
        renderPanel();
        paint();
      };
    if ($("cp"))
      $("cp").onclick = async () => {
        const b = $("cp");
        try {
          await navigator.clipboard.writeText(location.href);
          b.textContent = "Copied";
        } catch (e) {
          b.textContent = "Copy from the address bar";
        }
        setTimeout(() => {
          b.textContent = "Copy link";
        }, 1800);
      };
    if ($("wn")) {
      $("wn").onclick = () => {
        if (walk.i < walk.steps.length - 1) step(walk.i + 1);
        else endWalk();
      };
      $("wp").onclick = () => step(walk.i - 1);
      $("we").onclick = endWalk;
    }
  }
  function finishTrace(id) {
    const a = tracing;
    tracing = null;
    routeMsg = "";
    if (id === a) {
      renderPanel();
      return;
    }
    route = shortest(a, id);
    if (!route)
      routeMsg =
        "No chain of links connects “" +
        byId.get(a).title.slice(0, 30) +
        "” and “" +
        byId.get(id).title.slice(0, 30) +
        "”.";
    renderPanel();
    paint();
  }
  function pick(id) {
    cand = null;
    if (tracing && id && id !== tracing) {
      finishTrace(id);
      return;
    }
    sel = id;
    route = route && id ? route : null;
    if (id && trail[trail.length - 1] !== id) trail.push(id);
    if (!id) {
      trail = [];
      route = null;
      tracing = null;
    }
    if (mode === "terrain") {
      hp = id ? Object.assign(bfs(id), { __s: id }) : null;
      if (hp) seedRings();
      forces(sim, links, W, Hh, lens, hp);
      rings();
      const off = lens === "all" || sel ? 0 : 1;
      pen.attr("opacity", off);
      pl.attr("opacity", off);
      settle();
    }
    renderPanel();
    paint();
  }
  function step(i) {
    walk.i = i;
    route = null;
    pick(walk.steps[i][0]);
  }
  function startWalk(name) {
    walk = { name, steps: WALKS[name], i: 0 };
    closeIntro();
    step(0);
  }
  function endWalk() {
    walk = null;
    pick(null);
  }
  /* ---------- dossier ---------- */
  const dos = document.getElementById("fm-dos");
  function toggleDossier(id) {
    const i = dossier.indexOf(id);
    if (i < 0) dossier.push(id);
    else dossier.splice(i, 1);
    renderPanel();
    renderDossier();
    paint();
  }
  const dossierText = () =>
    "Selected pages from ihelfrich.github.io\n\n" +
    dossier.map((id, i) => `${i + 1}. ${reference(byId.get(id), SITE + id)}`).join("\n") +
    "\n";
  function renderDossier() {
    document.getElementById("fm-dn").textContent = dossier.length;
    dos.innerHTML = `<div class="fm-dos-in"><div class="fm-dos-h"><h2>Dossier</h2><button class="fm-btn" id="dx">Close</button></div>${
      dossier.length
        ? `<ol class="fm-dl">${dossier
            .map((id) => {
              const n = byId.get(id);
              return `<li><div><b>${n.full}</b><span>${SITE}${id}</span></div><button class="fm-btn" data-rm="${id}" aria-label="Remove ${n.full}">Remove</button></li>`;
            })
            .join(
              "",
            )}</ol><p class="acts"><button class="fm-btn fill" id="dl">Copy link to this dossier</button> <button class="fm-btn" id="dt">Copy as list</button> <a class="fm-btn" id="dm" href="mailto:?subject=${encodeURIComponent("Materials from Ian Helfrich")}&body=${encodeURIComponent(dossierText())}">Email</a> <button class="fm-btn" id="dp">Print</button> <button class="fm-btn" id="dc">Clear</button></p>`
        : `<p class="d">No pages selected. Select a page on the map and choose Add to dossier. A dossier can be copied as a link, copied as a list of references, emailed, or printed.</p>`
    }</div>`;
    const $ = (i) => document.getElementById(i);
    $("dx").onclick = () => {
      dos.classList.remove("on");
    };
    dos.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => toggleDossier(b.dataset.rm)));
    const flash = (b, t) => {
      const o = b.textContent;
      b.textContent = t;
      setTimeout(() => (b.textContent = o), 1600);
    };
    if ($("dl"))
      $("dl").onclick = async () => {
        try {
          await navigator.clipboard.writeText(location.href);
          flash($("dl"), "Copied");
        } catch (e) {
          flash($("dl"), "Copy from the address bar");
        }
      };
    if ($("dt"))
      $("dt").onclick = async () => {
        try {
          await navigator.clipboard.writeText(dossierText());
          flash($("dt"), "Copied");
        } catch (e) {
          flash($("dt"), "Not copied");
        }
      };
    if ($("dp"))
      $("dp").onclick = () => {
        document.getElementById("fm-dosprint").innerHTML =
          "<h1>Selected pages from ihelfrich.github.io</h1><ol>" +
          dossier
            .map((id) => {
              const n = byId.get(id);
              return `<li><b>${n.full}</b><br>${SITE}${id}<br>${n.desc || ""}</li>`;
            })
            .join("") +
          "</ol>";
        window.print();
      };
    if ($("dc"))
      $("dc").onclick = () => {
        dossier = [];
        renderDossier();
        renderPanel();
        paint();
      };
  }
  document.getElementById("fm-dbtn").onclick = () => {
    renderDossier();
    dos.classList.toggle("on");
  };
  /* ---------- interaction ---------- */
  const tip = document.getElementById("fm-tip");
  node
    .on("click", (e, d) => {
      e.stopPropagation();
      if (walk && !walk.steps.some((s) => s[0] === d.id)) walk = null;
      pick(d.id);
    })
    .on("keydown", (e, d) => {
      if (e.key === "Enter") pick(d.id);
    })
    .on("mouseenter", (e, d) => {
      hov = d.id;
      paintEdges();
      placeLabels();
    })
    .on("mousemove", (e, d) => {
      const r = stage.getBoundingClientRect();
      tip.style.display = "block";
      tip.style.left = e.clientX - r.left + 14 + "px";
      tip.style.top = e.clientY - r.top + 14 + "px";
      tip.textContent = d.title + " · " + KIND[d.type] + " · " + (deg[d.id] || 0) + " links";
    })
    .on("mouseleave", () => {
      hov = null;
      tip.style.display = "none";
      paintEdges();
      placeLabels();
    });
  svg.on("click", () => {
    if (sel || route || tracing) {
      walk = null;
      tracing = null;
      route = null;
      pick(null);
    }
  });
  const statusEl = document.getElementById("fm-status");
  const stageIdle = () =>
    document.activeElement === document.body || svg.node().contains(document.activeElement);
  addEventListener("keydown", (e) => {
    if (sel && stageIdle() && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (dir) {
        e.preventDefault();
        const list = orderedLinked(sel).flatMap((g) => g.items.map((m) => m.id));
        cand = stepThrough(list, cand, dir);
        hov = cand;
        paintEdges();
        placeLabels();
        if (statusEl && cand) statusEl.textContent = `${byId.get(cand).title}. Press Enter to travel to it.`;
        return;
      }
      if (e.key === "Enter" && cand && document.activeElement === document.body) {
        e.preventDefault();
        const next = cand;
        cand = null;
        hov = null;
        pick(next);
        return;
      }
      if (e.key.toLowerCase() === "o" && document.activeElement === document.body) {
        location.href = SITE + sel;
        return;
      }
    }
    if (e.key === "Escape") {
      cand = null;
      if (!document.getElementById("fm-intro").hidden) {
        closeIntro();
        return;
      }
      if (dos.classList.contains("on")) {
        dos.classList.remove("on");
        return;
      }
      if (document.getElementById("fm-res").classList.contains("on")) {
        closeRes();
        return;
      }
      if (tracing) {
        tracing = null;
        renderPanel();
        return;
      }
      if (sel || walk || route) {
        walk = null;
        route = null;
        pick(null);
      }
    }
  });
  document.getElementById("fm-m-t").onclick = () => setMode("terrain");
  document.getElementById("fm-m-o").onclick = () => setMode("orbit");
  document.getElementById("fm-m-c").onclick = () => setMode("compass");
  /* topic selector */
  function rose() {
    const g = d3.select("#fm-rose");
    g.selectAll("*").remove();
    const Rr = 40;
    g.append("circle")
      .attr("r", Rr)
      .attr("fill", "none")
      .style("stroke", "var(--ink)")
      .attr("stroke-opacity", 0.2);
    ORDER.forEach((l, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5,
        on = lens === l,
        k = g
          .append("g")
          .attr("role", "button")
          .attr("tabindex", 0)
          .attr("aria-pressed", on)
          .attr("aria-label", NAME[l])
          .classed("on", on);
      k.append("title").text(NAME[l]);
      k.append("line")
        .attr("x1", Math.cos(a) * 10)
        .attr("y1", Math.sin(a) * 10)
        .attr("x2", Math.cos(a) * Rr)
        .attr("y2", Math.sin(a) * Rr)
        .style("stroke", COL[l])
        .attr("stroke-width", on ? 3 : 1.5)
        .attr("opacity", on || lens === "all" ? 1 : 0.35);
      k.append("circle")
        .attr("cx", Math.cos(a) * (Rr + 4))
        .attr("cy", Math.sin(a) * (Rr + 4))
        .attr("r", on ? 6 : 4)
        .style("fill", COL[l])
        .style("stroke", "var(--ink)")
        .attr("stroke-width", 1);
      const lx = Math.cos(a) * (Rr + 15),
        ly = Math.sin(a) * (Rr + 15) + 4;
      k.append("text")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end")
        .text(SHORT[l]);
      k.append("rect")
        .attr("x", lx - (Math.cos(a) > 0.2 ? 0 : Math.cos(a) < -0.2 ? 56 : 28))
        .attr("y", ly - 14)
        .attr("width", 56)
        .attr("height", 18)
        .attr("fill", "transparent");
      const act = () => {
        if (sel) {
          sel = null;
          hp = null;
          walk = null;
          rings();
        }
        setLens(on ? "all" : l);
      };
      k.on("click", act).on("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          act();
        }
      });
    });
    const c = g
      .append("g")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", "All topics")
      .attr("aria-pressed", lens === "all");
    c.append("circle")
      .attr("r", 10)
      .style("fill", lens === "all" ? "var(--ink)" : "var(--surface-raised)")
      .style("stroke", "var(--ink)");
    c.append("text")
      .attr("y", 3.5)
      .attr("text-anchor", "middle")
      .style("fill", lens === "all" ? "var(--surface-raised)" : "var(--ink)")
      .style("stroke", "none")
      .attr("font-size", 9)
      .text("All");
    const ca = () => {
      if (sel) {
        sel = null;
        hp = null;
        walk = null;
        rings();
      }
      setLens("all");
    };
    c.on("click", ca).on("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ca();
      }
    });
  }
  /* routes dialog */
  const intro = document.getElementById("fm-intro");
  const SUB = Object.fromEntries(Object.entries(D.routes).map(([k, v]) => [k, v.summary]));
  document.getElementById("fm-go").innerHTML = Object.keys(WALKS)
    .map((k) => `<button data-w="${k}"><b>${k}</b><span>${SUB[k]} ${WALKS[k].length} pages.</span></button>`)
    .join("");
  document.querySelectorAll("#fm-go button").forEach((b) => (b.onclick = () => startWalk(b.dataset.w)));
  function openIntro() {
    intro.hidden = false;
    document.querySelector("#fm-go button").focus();
  }
  function closeIntro() {
    intro.hidden = true;
  }
  document.getElementById("fm-free").onclick = closeIntro;
  document.getElementById("fm-start").onclick = openIntro;
  intro.addEventListener("click", (e) => {
    if (e.target === intro) closeIntro();
  });
  /* search */
  const qi = document.getElementById("fm-q"),
    res = document.getElementById("fm-res");
  let ri = 0,
    rl = [];
  function closeRes() {
    res.classList.remove("on");
    res.innerHTML = "";
  }
  function showRes() {
    const q = qi.value.trim().toLowerCase();
    if (!q) {
      closeRes();
      return;
    }
    rl = searchRank(nodes, deg, qi.value);
    ri = 0;
    res.innerHTML =
      rl
        .map(
          (d, i) =>
            `<button role="option" data-i="${i}" aria-selected="${i === 0}">${glyph(d, 8)}<span>${d.title.slice(0, 40)}</span><small>${d.id}</small></button>`,
        )
        .join("") || "<button disabled>No matching page</button>";
    res.classList.add("on");
    res.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => go(rl[+b.dataset.i])));
  }
  function go(d) {
    if (!d) return;
    walk = null;
    closeRes();
    qi.value = "";
    qi.blur();
    pick(d.id);
  }
  qi.addEventListener("input", showRes);
  qi.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!rl.length) return;
      ri = (ri + (e.key === "ArrowDown" ? 1 : -1) + rl.length) % rl.length;
      res.querySelectorAll("[data-i]").forEach((b, i) => b.setAttribute("aria-selected", i === ri));
    } else if (e.key === "Enter") go(rl[ri]);
  });
  qi.addEventListener("blur", () => setTimeout(closeRes, 150));
  function renderIndex() {
    const ix = document.getElementById("fm-idx");
    const g = {};
    nodes
      .filter((d) => lens === "all" || d.lens.includes(lens))
      .forEach((d) => (g[d.section] = g[d.section] || []).push(d));
    ix.innerHTML = Object.keys(g)
      .sort()
      .map((s) => `<h3>${s}</h3>` + g[s].map((d) => `<a href="${SITE}${d.id}">${d.title}</a>`).join(""))
      .join("");
  }
  const vt = document.getElementById("fm-vt");
  vt.onclick = () => {
    const on = document.getElementById("fm-idx").classList.toggle("on");
    vt.setAttribute("aria-pressed", on);
    vt.textContent = on ? "Map" : "Index";
  };
  function writeHash() {
    if (!window.__ready) return;
    const p = new URLSearchParams();
    if (sel) p.set("p", sel);
    if (lens !== "all") p.set("l", lens);
    if (mode !== "terrain") p.set("m", mode);
    if (dossier.length) p.set("d", dossier.join("~"));
    try {
      history.replaceState(null, "", p.toString() ? "#" + p.toString() : location.pathname + location.search);
    } catch (e) {}
  }
  document.querySelector(".fm-key").innerHTML = ["paper", "data", "tool", "course", "page"]
    .map((t) => `<span>${glyph({ type: t, p: "work" }, 7)}${KIND[t]}</span>`)
    .join("");
  const setBar = () => {
    const h = document.querySelector(".site-header"),
      t = document.querySelector(".fm-toolbar");
    document.documentElement.style.setProperty(
      "--fm-top",
      (h ? h.offsetHeight : 0) + (t ? t.offsetHeight : 0) + "px",
    );
  };
  setBar();
  let rz;
  new ResizeObserver(() => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      setBar();
      const w = stage.clientWidth,
        h = stage.clientHeight;
      if (Math.abs(w - W) < 4 && Math.abs(h - Hh) < 4) return;
      W = w;
      Hh = h;
      if (mode === "orbit") {
        drawOrbit();
        tween(
          nodes.map((n) => [n.ox, n.oy]),
          0,
        );
        fit();
        paint();
      } else if (mode === "compass") {
        drawCompass();
        tween(
          nodes.map((n) => [n.cx, n.cy]),
          0,
        );
        fit();
        paint();
      } else if (sel) pick(sel);
      else setLens(lens);
    }, 150);
  }).observe(stage);
  const hs = new URLSearchParams(location.hash.slice(1));
  if (hs.get("d"))
    dossier = hs
      .get("d")
      .split("~")
      .filter((id) => byId.has(id));
  setLens(hs.get("l") && ORDER.includes(hs.get("l")) ? hs.get("l") : "all");
  setTimeout(() => {
    stage.classList.remove("fm-boot");
  }, 3200);
  setTimeout(() => {
    const m = hs.get("m");
    if (m === "orbit" || m === "compass") setMode(m, true);
    if (hs.get("p") && byId.has(hs.get("p"))) pick(hs.get("p"));
    else if (mode === "terrain") setLens(lens);
    window.__ready = true;
    renderDossier();
    if (dossier.length) dos.classList.add("on");
    writeHash();
    if (!hs.has("p") && !hs.has("l") && !hs.has("m") && !hs.has("d")) openIntro();
  }, 800);
}
