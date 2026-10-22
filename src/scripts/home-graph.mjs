// Home page network in the site map's visual language: shape = page type, ink by default,
// topic color only for the page in focus and its neighbours. Data: /field.json.
import * as d3 from "d3";
import { TOPIC_ORDER, TOPIC_NAMES, TOPIC_SHORT } from "../data/field-topics.mjs";
import { placeLabels } from "../lib/graph-labels.mjs";

const SYM = { paper: d3.symbolSquare, data: d3.symbolDiamond, tool: d3.symbolStar, course: d3.symbolTriangle, page: d3.symbolCircle };
const KIND = { paper: "Paper", data: "Dataset", tool: "Instrument", course: "Course", page: "Page" };
const SECTIONS = new Set(["/research/", "/teaching/", "/lab/", "/work/", "/projects/", "/datasets/", "/writing/", "/econometrics/"]);
const COL = Object.fromEntries(TOPIC_ORDER.map((t) => [t, `var(--topic-${t})`]));

export function mountHomeGraph(root) {
  const svgEl = root.querySelector("[data-hg-svg]");
  const card = root.querySelector("[data-hg-card]");
  const shockBtn = root.querySelector("[data-hg-shock]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastPointer = "mouse";
  let sim = null, ro = null, disposed = false, selected = null;

  const idle = () => {
    card.replaceChildren();
    const t = document.createElement("strong"); t.textContent = "Nothing selected";
    const s = document.createElement("span"); s.textContent = "Shapes show the kind of page; colour shows its topic once you point at it.";
    card.append(t, s);
    shockBtn.disabled = true;
  };
  idle();

  fetch("/field.json").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((data) => {
    if (disposed) return;
    const nodes = data.nodes.map((n) => ({ ...n, p: (n.topics && n.topics[0]) || "profile" }));
    const links = data.links.map(([a, b]) => ({ source: nodes[a], target: nodes[b] }));
    const adj = new Map(nodes.map((n) => [n.id, new Set()]));
    links.forEach((l) => { adj.get(l.source.id).add(l.target.id); adj.get(l.target.id).add(l.source.id); });
    const home = nodes.find((n) => n.id === "/");
    const R = (n) => Math.max(3.4, Math.min(9, 2.8 + Math.sqrt(n.kb || 20) * 0.32));
    const symD = (n, k = 1) => d3.symbol().type(SYM[n.type] || d3.symbolCircle).size(Math.PI * R(n) * R(n) * (n.type === "page" ? 1 : 1.25) * k)();

    const svg = d3.select(svgEl);
    // Paint order: links, marks, then every label above the marks so no mark can cover one.
    const LAYERS = ["hg-links-layer", "hg-marks", "hg-anchors", "hg-labels", "hg-hub-layer"];
    const [gl, gn, ga, gt, gp] = LAYERS.map((name) => svg.append("g").attr("class", name));
    gt.attr("aria-hidden", "true");
    const link = gl.selectAll("line").data(links).join("line").attr("class", "hg-link");
    const anchorLabel = ga.selectAll("g").data(TOPIC_ORDER).join("g").attr("class", "hg-topic");
    anchorLabel.append("circle").attr("r", 4).style("fill", (t) => COL[t]);
    anchorLabel.append("text").attr("y", 4).text((t) => TOPIC_SHORT[t]);
    const others = nodes.filter((n) => n !== home);
    const node = gn.selectAll("g").data(others).join("g")
      .attr("class", (d) => "hg-node" + (SECTIONS.has(d.id) ? " sec" : ""))
      .attr("tabindex", (d) => (SECTIONS.has(d.id) ? 0 : null))
      .attr("role", (d) => (SECTIONS.has(d.id) ? "link" : null))
      .attr("aria-label", (d) => (SECTIONS.has(d.id) ? `${d.label}, ${KIND[d.type]}` : null));
    node.append("circle").attr("class", "hg-hit").attr("r", 12);
    node.append("path").attr("class", "hg-sh").attr("d", (d) => symD(d));
    const ringed = (d) => (d.topics || []).length > 1;
    const outerR = (d) => R(d) + (ringed(d) ? 3.5 : 0);
    node.filter(ringed).append("circle").attr("class", "hg-ring").attr("r", outerR);
    const sections = others.filter((d) => SECTIONS.has(d.id));
    const label = gt.selectAll("text").data(sections).join("text").attr("class", "hg-label").text((d) => d.label);
    const labelWidths = new Map();
    const labelPositions = new Map();
    const measureLabels = () => label.each(function (d) {
      // A hidden label (phones, until selected) measures 0; estimate it from the text instead.
      labelWidths.set(d.id, this.getComputedTextLength() || d.label.length * 6.3);
    });

    const PR = 16;
    const hub = gp.append("g").attr("class", "hg-hub");
    hub.append("circle").attr("r", 9);
    hub.append("circle").attr("class", "hg-hub-ring").attr("r", 15);
    hub.append("text").attr("y", 31).attr("text-anchor", "middle").text("Home");

    const paint = (focus) => {
      const near = focus ? adj.get(focus.id) : null;
      node.classed("dim", (x) => !!focus && x !== focus && !near.has(x.id)).classed("sel", (x) => x === focus)
        .select("path").style("fill", (x) => (focus && (x === focus || near.has(x.id)) ? COL[x.p] : null));
      label.classed("dim", (x) => !!focus && x !== focus && !near.has(x.id)).classed("sel", (x) => x === focus);
      node.select(".hg-ring").style("stroke", (x) => (focus && (x === focus || near.has(x.id)) ? COL[(x.topics || [])[1]] : null));
      link.classed("on", (l) => !!focus && (l.source === focus || l.target === focus)).classed("dim", (l) => !!focus && l.source !== focus && l.target !== focus);
    };
    const show = (d) => {
      selected = d;
      paint(d);
      const near = adj.get(d.id);
      card.replaceChildren();
      const kind = document.createElement("small"); kind.textContent = `${KIND[d.type]} · ${TOPIC_NAMES[d.p] || ""}`;
      const title = document.createElement("strong"); title.textContent = d.title;
      const desc = document.createElement("span"); desc.textContent = `${d.desc || ""} Links to ${near.size} page${near.size === 1 ? "" : "s"}.`;
      const open = document.createElement("a"); open.href = d.id; open.textContent = "Open this page";
      card.append(kind, title, desc, open);
      shockBtn.disabled = false;
    };
    svg.on("pointerdown pointermove", (e) => { lastPointer = e.pointerType || "mouse"; });
    node.on("mouseenter", (e, d) => { if (lastPointer === "mouse") show(d); }).on("focus", (e, d) => { if (e.currentTarget.matches(":focus-visible")) show(d); })
      .on("mouseleave blur", () => { if (lastPointer === "mouse") paint(null); })
      .on("click", (e, d) => {
        if (lastPointer !== "mouse" && e.detail !== 0 && selected !== d) { show(d); return; }
        location.href = d.id;
      })
      .on("keydown", (e, d) => { if (e.key === "Enter") location.href = d.id; });

    let W = 0, H = 0, cx = 0, cy = 0, anchors = {}, placed = false;
    const tick = () => {
      others.forEach((n) => { n.x = Math.max(12, Math.min(W - 12, n.x)); n.y = Math.max(12, Math.min(H - 12, n.y)); });
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      hub.attr("transform", `translate(${cx},${cy})`);
      // The topic labels and the Home label are fixed boxes that the section labels avoid.
      const fixedBoxes = [{ x0: cx - 22, y0: cy + 20, x1: cx + 22, y1: cy + 35 }];
      anchorLabel.each(function (t) {
        const [ax, ay] = anchors[t] || [cx, cy];
        const ux = ax - cx, uy = ay - cy, len = Math.hypot(ux, uy) || 1;
        let reach = 0;
        others.forEach((n) => { if (n.p === t) reach = Math.max(reach, ((n.x - cx) * ux + (n.y - cy) * uy) / len); });
        const lx = Math.max(60, Math.min(W - 60, cx + (ux / len) * (reach + 22)));
        const ly = Math.max(14, Math.min(H - 10, cy + (uy / len) * (reach + 22)));
        const g = d3.select(this).attr("transform", `translate(${lx},${ly})`);
        const tw = d3.select(this).select("text").node().getComputedTextLength() + 10;
        let side = ux > 8 ? "start" : ux < -8 ? "end" : "middle";
        let above = false;
        if ((side === "start" && lx + tw > W) || (side === "end" && lx - tw < 0)) { side = "middle"; above = true; }
        const half = tw / 2;
        const mx = side === "middle" ? Math.max(half - 6, Math.min(W - half + 6, lx)) - lx : 0;
        const ty = side === "middle" ? (above || uy < 0 ? -9 : 17) : 4;
        g.select("text").attr("text-anchor", side).attr("x", side === "start" ? 8 : side === "end" ? -8 : mx).attr("y", ty);
        const textLength = tw - 10;
        const tx0 = side === "start" ? lx + 8 : side === "end" ? lx - 8 - textLength : lx + mx - textLength / 2;
        fixedBoxes.push({ x0: Math.min(tx0, lx - 4) - 2, y0: Math.min(ly + ty - 10, ly - 4), x1: Math.max(tx0 + textLength, lx + 4) + 2, y1: Math.max(ly + ty + 4, ly + 4) });
      });
      const marks = others.map((n) => ({ id: n.id, x: n.x, y: n.y, r: outerR(n) + 1 }));
      marks.push({ id: home.id, x: cx, y: cy, r: PR });
      const spots = placeLabels(
        sections.map((d) => ({ id: d.id, x: d.x, y: d.y, r: outerR(d), width: labelWidths.get(d.id) || d.label.length * 6.3 })),
        { marks, obstacles: fixedBoxes, bounds: { x0: 0, y0: 0, x1: W, y1: H }, previous: labelPositions },
      );
      label.attr("x", (d) => spots.get(d.id).x).attr("y", (d) => spots.get(d.id).y).attr("text-anchor", (d) => spots.get(d.id).anchor);
    };
    const layout = () => {
      const box = svgEl.getBoundingClientRect();
      W = box.width; H = box.height;
      if (!W || !H) return;
      cx = W / 2; cy = H / 2;
      measureLabels();
      const rad = Math.min(W, H) * (W < 560 ? 0.24 : 0.32);
      TOPIC_ORDER.forEach((t, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / TOPIC_ORDER.length;
        anchors[t] = [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      });

      home.fx = cx; home.fy = cy;
      if (sim) sim.stop();
      sim = d3.forceSimulation(nodes).alphaDecay(0.04)
        .force("link", d3.forceLink(links).distance(40).strength(0.015))
        .force("charge", d3.forceManyBody().strength(-22))
        .force("x", d3.forceX((d) => (anchors[d.p] || [cx])[0]).strength(0.16))
        .force("y", d3.forceY((d) => (anchors[d.p] || [0, cy])[1]).strength(0.16))
        .force("collide", d3.forceCollide((d) => (d === home ? PR + 14 : R(d) + (SECTIONS.has(d.id) ? 14 : 3))))
        .on("tick", tick);
      others.forEach((n, i) => {
        if (n.x == null || !placed) {
          const [ax, ay] = anchors[n.p] || [cx, cy];
          n.x = ax + Math.cos(i * 2.4) * (8 + (i % 7) * 6);
          n.y = ay + Math.sin(i * 2.4) * (8 + (i % 7) * 6);
        }
      });
      placed = true;
      sim.stop();
      for (let i = 0; i < 260; i += 1) sim.tick();
      tick();
      if (!reduce) sim.alpha(0.04).restart();
    };
    layout();
    let lastW = W, lastH = H;
    ro = new ResizeObserver(() => {
      const b = svgEl.getBoundingClientRect();
      if (Math.abs(b.width - lastW) < 2 && Math.abs(b.height - lastH) < 2) return;
      lastW = b.width; lastH = b.height;
      layout();
    });
    ro.observe(svgEl);

    shockBtn.addEventListener("click", () => {
      const start = selected || home;
      const dist = { [start.id]: 0 };
      const q = [start.id];
      while (q.length) { const h = q.shift(); for (const x of adj.get(h)) if (dist[x] == null) { dist[x] = dist[h] + 1; q.push(x); } }
      paint(null);
      node.each(function (d) {
        const k = dist[d.id];
        if (k == null || reduce) return;
        d3.select(this).select("path").transition().delay(k * 420).duration(240).attr("d", symD(d, 3)).style("fill", COL[d.p])
          .transition().duration(900).attr("d", symD(d)).style("fill", null);
      });
    });
  }).catch(() => {
    card.replaceChildren();
    const t = document.createElement("strong"); t.textContent = "Map unavailable";
    const s = document.createElement("span"); s.textContent = "The section links above go to the same pages.";
    card.append(t, s);
  });

  return () => { disposed = true; if (sim) sim.stop(); if (ro) ro.disconnect(); };
}
