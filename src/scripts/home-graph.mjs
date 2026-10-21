// Home page network in the site map's visual language: shape = page type, ink by default,
// topic color only for the page in focus and its neighbours. Data: /field.json.
import * as d3 from "d3";
import { TOPIC_ORDER, TOPIC_NAMES, TOPIC_SHORT } from "../data/field-topics.mjs";

const SYM = { paper: d3.symbolSquare, data: d3.symbolDiamond, tool: d3.symbolStar, course: d3.symbolTriangle, page: d3.symbolCircle };
const KIND = { paper: "Paper", data: "Dataset", tool: "Instrument", course: "Course", page: "Page" };
const SECTIONS = new Set(["/research/", "/teaching/", "/lab/", "/work/", "/projects/", "/datasets/", "/writing/", "/econometrics/"]);
const COL = Object.fromEntries(TOPIC_ORDER.map((t) => [t, `var(--topic-${t})`]));

export function mountHomeGraph(root) {
  const svgEl = root.querySelector("[data-hg-svg]");
  const card = root.querySelector("[data-hg-card]");
  const shockBtn = root.querySelector("[data-hg-shock]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const gl = svg.append("g"), ga = svg.append("g"), gn = svg.append("g"), gp = svg.append("g");
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
    node.append("path").attr("class", "hg-sh").attr("d", (d) => symD(d));
    node.filter((d) => (d.topics || []).length > 1).append("circle").attr("class", "hg-ring").attr("r", (d) => R(d) + 3.5);
    node.filter((d) => SECTIONS.has(d.id)).append("text").attr("x", (d) => R(d) + 6).attr("y", 4).text((d) => d.label);

    const PR = 38;
    svg.append("defs").append("clipPath").attr("id", "hg-pc").append("circle").attr("r", PR);
    const hub = gp.append("g").attr("class", "hg-hub");
    hub.append("circle").attr("r", PR + 3);
    hub.append("image").attr("href", root.dataset.portrait).attr("x", -PR).attr("y", -PR).attr("width", PR * 2).attr("height", PR * 2)
      .attr("clip-path", "url(#hg-pc)").attr("preserveAspectRatio", "xMidYMid slice");

    const paint = (focus) => {
      const near = focus ? adj.get(focus.id) : null;
      node.classed("dim", (x) => !!focus && x !== focus && !near.has(x.id)).classed("sel", (x) => x === focus)
        .select("path").style("fill", (x) => (focus && (x === focus || near.has(x.id)) ? COL[x.p] : null));
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
    node.on("mouseenter focus", (e, d) => show(d)).on("mouseleave blur", () => paint(null))
      .on("click", (e, d) => { location.href = d.id; })
      .on("keydown", (e, d) => { if (e.key === "Enter") location.href = d.id; });

    let W = 0, H = 0, cx = 0, cy = 0, anchors = {}, placed = false;
    const tick = () => {
      others.forEach((n) => { n.x = Math.max(12, Math.min(W - 12, n.x)); n.y = Math.max(12, Math.min(H - 12, n.y)); });
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      hub.attr("transform", `translate(${cx},${cy})`);
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
        if (side === "start" && lx + tw > W) side = "end";
        if (side === "end" && lx - tw < 0) side = "start";
        g.select("text").attr("text-anchor", side).attr("x", side === "start" ? 8 : side === "end" ? -8 : 0).attr("y", side === "middle" ? (uy < 0 ? -8 : 16) : 4);
      });
    };
    const layout = () => {
      const box = svgEl.getBoundingClientRect();
      W = box.width; H = box.height;
      if (!W || !H) return;
      cx = W / 2; cy = H / 2;
      const rad = Math.min(W, H) * 0.32;
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
        .force("collide", d3.forceCollide((d) => (d === home ? PR + 10 : R(d) + (SECTIONS.has(d.id) ? 14 : 3))))
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
