// Distribution Lab: bench, constructions, test desk and department simulator.
import {
  DISTRIBUTIONS as DIST, groups, makeRng, plotRange, describe, drawMany, drawExpressions, drawScript, fitDistribution,
} from "../lib/distributions.mjs";
import { normCdf, normPdf, normQuantile } from "../lib/special-functions.mjs";
import {
  SCENARIOS, POOLS, scenarioById, makeHistory, stats, parameterRange, initialParameters, scoreEvent, gradeGap,
  simulateYears, replayYear, departmentScript, tailProbability,
} from "../lib/department.mjs";
import { createPlot, histogram, tally, niceTicks, tickLabel } from "./dl-plot.mjs";

const root = document.querySelector("[data-distribution-lab]");
if (root) init(root);

function init(root) {
  const $ = (sel, scope = root) => scope.querySelector(sel);
  const $$ = (sel, scope = root) => [...scope.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------------ formatting
  const fmt = (x, sig = 4) => {
    if (x === null || x === undefined || Number.isNaN(x)) return "undefined";
    if (!Number.isFinite(x)) return x > 0 ? "∞" : "−∞";
    if (x === 0) return "0";
    const ax = Math.abs(x);
    if (ax >= 1e7 || ax < 1e-4) return x.toExponential(2).replace("e", "×10^").replace("^+", "^");
    return Number(x.toPrecision(sig)).toLocaleString("en-US", { maximumFractionDigits: 8 });
  };
  const pfmt = (p) => (p >= 0.0001 || p === 0 ? p.toFixed(4) : p.toExponential(2).replace("e", "×10^").replace("^-", "^−"));
  const pct = (p) => `${(100 * p).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: p < 0.001 ? 3 : 1 })}%`;
  const oneIn = (p) => (p > 0 && p < 0.5 ? `about 1 in ${Math.round(1 / p).toLocaleString("en-US")}` : "");
  const status = (msg) => { $("#dl-status").textContent = msg; };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const frame = (fn) => { let queued = false; return () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(); }); }; };

  // ------------------------------------------------------------------ state and sharing
  const state = {
    tab: "bench",
    bench: { dist: "normal", params: { ...DIST.normal.defaults }, mode: "between", a: -1.96, b: 1.96, view: "pdf", overlay: false, lock: false },
    build: { recipe: "chisq", params: {} },
    desk: { test: "t", tail: "two", alpha: 0.05, n: 20, n2: 20, effect: 0.5, world: "alt", obs: null },
    dept: { scenario: "department", seed: 7, years: 5000, models: null },
  };
  const live = { draws: new Float64Array(200000), n: 0, sum: 0, cps: [], next: 1, streaming: false };

  function loadHash() {
    try {
      const raw = location.hash.replace(/^#s=/, "");
      if (!raw || raw === location.hash) return;
      const saved = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/")))));
      if (saved.tab) state.tab = saved.tab;
      for (const k of ["bench", "build", "desk", "dept"]) if (saved[k]) Object.assign(state[k], saved[k]);
      if (!DIST[state.bench.dist]) state.bench.dist = "normal";
    } catch { /* an unreadable link falls back to defaults */ }
  }
  const saveHash = (() => {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const json = JSON.stringify(state);
          const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_");
          history.replaceState(null, "", `#s=${b64}`);
        } catch { /* storage of state is a convenience */ }
      }, 250);
    };
  })();
  loadHash();

  // ------------------------------------------------------------------ generic controls
  function sliderRow(container, spec, value, onInput, fmtValue = fmt) {
    const id = `sl-${Math.random().toString(36).slice(2, 8)}`;
    const wrap = document.createElement("div");
    wrap.className = "dl-param";
    wrap.innerHTML = `<div class="row"><label for="${id}">${spec.symbol ? `${spec.symbol} · ` : ""}${spec.label}</label><output for="${id}"></output></div><input id="${id}" type="range">`;
    const input = $("input", wrap);
    const out = $("output", wrap);
    input.min = spec.min; input.max = spec.max; input.step = spec.step ?? "any"; input.value = value;
    out.textContent = fmtValue(Number(value));
    input.addEventListener("input", () => { const v = Number(input.value); out.textContent = fmtValue(v); onInput(v); });
    container.append(wrap);
    return { set(v) { input.value = v; out.textContent = fmtValue(v); }, input };
  }

  function drawFamilySelect(select, ids) {
    select.innerHTML = "";
    if (!ids) {
      for (const [group, list] of groups()) {
        const og = document.createElement("optgroup");
        og.label = group;
        for (const d of list) og.append(new Option(d.name, d.id));
        select.append(og);
      }
    } else for (const id of ids) select.append(new Option(DIST[id].name, id));
  }

  // ------------------------------------------------------------------ tabs
  const tabs = $$("[role=tab]");
  const panels = { bench: $("#dl-bench"), build: $("#dl-build"), desk: $("#dl-desk"), dept: $("#dl-dept") };
  const renderers = {};
  function showTab(name, focus = false) {
    state.tab = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== name;
    requestAnimationFrame(() => { renderers[name]?.(true); });
    saveHash();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => showTab(t.dataset.tab));
    t.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (e.key === "Home") showTab(tabs[0].dataset.tab, true);
      else if (e.key === "End") showTab(tabs[tabs.length - 1].dataset.tab, true);
      else if (step) { e.preventDefault(); showTab(tabs[(i + step + tabs.length) % tabs.length].dataset.tab, true); }
    });
  });

  // ================================================================== BENCH
  const B = state.bench;
  const bPlot = createPlot($("#b-canvas"), root, { l: 50 });
  const mPlot = createPlot($("#b-mean"), root, { l: 50, t: 16 });
  let bControls = {};

  drawFamilySelect($("#b-dist"));
  $("#b-dist").value = B.dist;

  function resetCalc() {
    const p = B.mode === "between" ? 0.95 : B.mode === "outside" ? 0.05 : 0.05;
    setFromProb(p);
  }
  const quantile = (u) => DIST[B.dist].quantile(clamp(u, 1e-9, 1 - 1e-9), B.params);
  function setFromProb(p) {
    const q = quantile;
    if (B.mode === "le") B.a = q(p);
    else if (B.mode === "ge") B.a = q(1 - p);
    else if (B.mode === "between") { B.a = q((1 - p) / 2); B.b = q(1 - (1 - p) / 2); }
    else { B.a = q(p / 2); B.b = q(1 - p / 2); }
    if (DIST[B.dist].discrete) { B.a = Math.round(B.a); B.b = Math.round(B.b); }
  }
  function calcProb() {
    const d = DIST[B.dist];
    const F = (x) => d.cdf(x, B.params);
    const Fm = (x) => (d.discrete ? d.cdf(Math.ceil(x) - 1, B.params) : F(x));
    if (B.mode === "le") return F(B.a);
    if (B.mode === "ge") return 1 - Fm(B.a);
    if (B.mode === "between") return B.b >= B.a ? F(B.b) - Fm(B.a) : 0;
    return clamp(Fm(B.a) + 1 - F(B.b), 0, 1);
  }
  const inRegion = (k) => (B.mode === "le" ? k <= B.a : B.mode === "ge" ? k >= B.a : B.mode === "between" ? k >= B.a && k <= B.b : k < B.a || k > B.b);

  function buildBenchControls() {
    const d = DIST[B.dist];
    $("#b-formula").textContent = d.formula;
    $("#b-note").textContent = d.note;
    const box = $("#b-params");
    box.innerHTML = "";
    bControls = {};
    for (const spec of d.params) {
      bControls[spec.id] = sliderRow(box, spec, B.params[spec.id], (v) => {
        B.params[spec.id] = spec.integer ? Math.round(v) : v;
        if (!d.valid(B.params)) { status("Upper limit must exceed lower limit."); return; }
        if (B.lock) setFromProb(lastProb); else if (!cutoffsVisible()) setFromProb(lastProb);
        clearDraws();
        scheduleBench();
      });
    }
    $$("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === B.mode));
    $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === B.view));
    $("#b-norm").checked = B.overlay;
    $("#b-lock").checked = B.lock;
  }
  let lastProb = 0.95;
  function cutoffsVisible() {
    const [lo, hi] = plotRange(DIST[B.dist], B.params);
    const ok = (x) => x >= lo - (hi - lo) * 0.05 && x <= hi + (hi - lo) * 0.05;
    return B.mode === "le" || B.mode === "ge" ? ok(B.a) : ok(B.a) && ok(B.b);
  }

  function renderStats() {
    const s = describe(DIST[B.dist], B.params);
    $("#b-stats").innerHTML = [["Mean", s.mean], ["Median", s.median], ["Variance", s.variance], ["Std. deviation", s.sd]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${fmt(v)}</dd></div>`).join("");
  }

  function renderCalcInputs() {
    const single = B.mode === "le" || B.mode === "ge";
    $("#b-b").disabled = single;
    $("#b-a").value = Number(B.a.toFixed(6));
    $("#b-b").value = single ? "" : Number(B.b.toFixed(6));
    const p = calcProb();
    lastProb = p;
    $("#b-p").value = Number(p.toFixed(6));
    const label = { le: `P(X ≤ ${fmt(B.a)})`, ge: `P(X ≥ ${fmt(B.a)})`, between: `P(${fmt(B.a)} ≤ X ≤ ${fmt(B.b)})`, outside: `P(X < ${fmt(B.a)} or X > ${fmt(B.b)})` }[B.mode];
    $("#b-result").innerHTML = `${label} = ${pfmt(p)}<small>${pct(p)}${oneIn(p) ? `, ${oneIn(p)}` : ""}</small>`;
  }

  function benchDomain() {
    const d = DIST[B.dist];
    const [x0, x1] = plotRange(d, B.params);
    let ymax = 0;
    const grid = [];
    if (d.discrete) {
      for (let k = Math.ceil(x0); k <= x1; k += 1) { const v = d.pdf(k, B.params); grid.push(v); ymax = Math.max(ymax, v); }
    } else {
      for (let i = 1; i < 240; i += 1) { const v = d.pdf(x0 + ((x1 - x0) * i) / 240, B.params); if (Number.isFinite(v)) { grid.push(v); ymax = Math.max(ymax, v); } }
      const sorted = [...grid].sort((p, q) => p - q);
      ymax = Math.min(ymax, 4 * sorted[Math.floor(0.9 * sorted.length)] || ymax);
    }
    const s = describe(d, B.params);
    let norm = null;
    if (B.overlay && Number.isFinite(s.sd) && s.sd > 0) {
      norm = (x) => normPdf((x - s.mean) / s.sd) / s.sd;
      if (!d.discrete) ymax = Math.max(ymax, norm(s.mean));
    }
    if (live.n && !d.discrete) {
      const bins = histogram(live.draws.subarray(0, live.n), x0, x1, 40);
      ymax = Math.max(ymax, ...bins.map((b) => b.h)) ;
    }
    if (live.n && d.discrete) ymax = Math.max(ymax, ...tally(live.draws.subarray(0, live.n), Math.ceil(x0), Math.floor(x1)).map((b) => b.h));
    return { d, x0, x1, ymax: ymax * 1.12 || 1, s, norm };
  }

  function drawBench() {
    if (!bPlot.resize()) return;
    bPlot.refreshColors();
    const { d, x0, x1, ymax, s, norm } = benchDomain();
    const c = bPlot.c;
    bPlot.clear();
    const cdfView = B.view === "cdf";
    bPlot.domain(x0, x1, 0, cdfView ? 1.04 : ymax);
    bPlot.axes({ xLabel: "x", yLabel: cdfView ? "F(x)" : d.discrete ? "probability" : "density" });
    const single = B.mode === "le" || B.mode === "ge";

    if (cdfView) {
      const pts = d.discrete
        ? stepPoints(d, x0, x1)
        : bPlot.curvePoints((x) => d.cdf(x, B.params));
      bPlot.line(pts, { color: c.ink });
      if (norm) bPlot.line(bPlot.curvePoints((x) => normCdf((x - s.mean) / s.sd)), { color: c.muted, dash: [5, 4], width: 1.5 });
      for (const [x, y] of [[B.a, B.a], [B.b, B.b]].slice(0, single ? 1 : 2)) bPlot.dots([x], Math.min(1, d.cdf(y, B.params)), { color: c.accent, r: 4 });
    } else if (d.discrete) {
      const bars = [];
      for (let k = Math.ceil(x0); k <= x1; k += 1) bars.push({ x0: k - 0.4, x1: k + 0.4, h: d.pdf(k, B.params), tint: inRegion(k) ? c.accent : c.muted });
      bPlot.bars(bars.map((b) => ({ ...b })), { alpha: 0.55 });
      if (live.n) bPlot.bars(tally(live.draws.subarray(0, live.n), Math.ceil(x0), Math.floor(x1)).map((b) => ({ x0: b.x0 + 0.12, x1: b.x1 - 0.12, h: b.h, tint: c.pink })), { alpha: 0.7, stroke: false });
      if (norm) bPlot.line(bPlot.curvePoints(norm), { color: c.muted, dash: [5, 4], width: 1.5 });
    } else {
      if (live.n) bPlot.bars(histogram(live.draws.subarray(0, live.n), x0, x1, 40), { color: c.pink, alpha: 0.4 });
      const pts = bPlot.curvePoints((x) => d.pdf(x, B.params));
      const regions = B.mode === "le" ? [[x0, B.a]] : B.mode === "ge" ? [[B.a, x1]] : B.mode === "between" ? [[B.a, B.b]] : [[x0, B.a], [B.b, x1]];
      for (const [a, b] of regions) bPlot.fillUnder(pts, a, b, { color: c.accent, alpha: 0.35 });
      bPlot.line(pts, { color: c.ink });
      if (norm) bPlot.line(bPlot.curvePoints(norm), { color: c.muted, dash: [5, 4], width: 1.5 });
    }
    // Cutoff lines and handles
    const handles = single ? [B.a] : [B.a, B.b];
    handles.forEach((x, i) => {
      if (x < x0 || x > x1) return;
      bPlot.vline(x, { color: c.accent, width: 1.5, dash: [4, 3], label: single ? "a" : i ? "b" : "a" });
      bPlot.handle(x, { color: c.accent });
    });
    if (Number.isFinite(s.mean) && s.mean >= x0 && s.mean <= x1 && !cdfView) bPlot.vline(s.mean, { color: c.muted, width: 1, dash: [2, 3] });
    drawHover();
    $("#b-canvas").setAttribute("aria-label", `${cdfView ? "Distribution function" : "Density"} of ${d.name} (${d.params.map((q) => `${q.symbol} = ${fmt(B.params[q.id])}`).join(", ")}). ${$("#b-result").textContent}`);
    drawRunningMean();
  }

  function stepPoints(d, x0, x1) {
    const pts = [];
    for (let k = Math.ceil(x0); k <= x1; k += 1) {
      const prev = d.cdf(k - 1, B.params);
      pts.push([k, prev], [k, d.cdf(k, B.params)]);
    }
    return pts;
  }

  let hover = null;
  function drawHover() {
    const out = $("#b-readout");
    if (hover === null) { out.textContent = ""; return; }
    const d = DIST[B.dist];
    let x = hover;
    if (d.discrete) x = Math.round(x);
    const [lo, hi] = [bPlot.x0, bPlot.x1];
    if (x < lo || x > hi) { out.textContent = ""; return; }
    const X = bPlot.px(x);
    const ctx = bPlot.ctx;
    ctx.save();
    ctx.strokeStyle = bPlot.c.muted; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(X, bPlot.m.t); ctx.lineTo(X, bPlot.h - bPlot.m.b); ctx.stroke();
    ctx.restore();
    out.textContent = `x = ${fmt(x)}   ${d.discrete ? "P(X = x)" : "f(x)"} = ${fmt(d.pdf(x, B.params))}   F(x) = ${fmt(d.cdf(x, B.params))}`;
  }

  function drawRunningMean() {
    if (!mPlot.resize()) return;
    mPlot.refreshColors();
    mPlot.clear();
    const c = mPlot.c;
    const d = DIST[B.dist];
    const s = describe(d, B.params);
    const nmax = Math.max(10, live.n);
    const cps = live.cps;
    const finite = Number.isFinite(s.mean);
    let lo; let hi;
    if (finite && Number.isFinite(s.sd)) { lo = s.mean - 3 * s.sd; hi = s.mean + 3 * s.sd; }
    else {
      const vals = cps.map((p) => p[1]).sort((a, b) => a - b);
      if (vals.length > 4) { lo = vals[Math.floor(0.02 * vals.length)]; hi = vals[Math.floor(0.98 * vals.length)]; } else { lo = d.quantile(0.1, B.params); hi = d.quantile(0.9, B.params); }
      const pad = (hi - lo) * 0.2 || 1; lo -= pad; hi += pad;
    }
    if (!(hi > lo)) { lo = (finite ? s.mean : 0) - 1; hi = lo + 2; }
    mPlot.domain(0, Math.log10(nmax), lo, hi);
    mPlot.axes({ xTicks: false, yLabel: "running mean" });
    mPlot.ctx.fillStyle = c.muted; mPlot.font(11);
    mPlot.ctx.textAlign = "center"; mPlot.ctx.textBaseline = "top";
    for (let k = 0; 10 ** k <= nmax; k += 1) { const x = mPlot.px(k); mPlot.ctx.fillText(10 ** k >= 1000 ? `${10 ** k / 1000}k` : String(10 ** k), x, mPlot.h - mPlot.m.b + 6); }
    mPlot.text("draws (log scale)", mPlot.w - mPlot.m.r, mPlot.h - 1, { align: "right", baseline: "bottom" });
    if (finite && Number.isFinite(s.sd)) {
      const env = [];
      for (let k = 0; k <= 80; k += 1) { const n = 10 ** ((Math.log10(nmax) * k) / 80); env.push([Math.log10(n), s.mean + (2 * s.sd) / Math.sqrt(n)]); }
      mPlot.line(env, { color: c.muted, dash: [4, 4], width: 1 });
      mPlot.line(env.map(([x, y]) => [x, 2 * s.mean - y]), { color: c.muted, dash: [4, 4], width: 1 });
    }
    if (finite) mPlot.line([[0, s.mean], [Math.log10(nmax), s.mean]], { color: c.ink, width: 1.5 });
    if (cps.length > 1) mPlot.line(cps.map(([n, m]) => [Math.log10(n), m]), { color: c.pink, width: 2 });
    $("#b-meannote").textContent = !finite
      ? `${d.name} with these parameters has no mean, so the average of n draws does not converge. The running mean keeps jumping, whatever the sample size.`
      : !Number.isFinite(s.sd)
        ? "The mean exists but the variance is infinite. The average converges, but slowly and with occasional large jumps."
        : "Dashed curves mark ±2 standard errors, 2σ/√n. The running mean of independent draws stays inside them about 95% of the time at any given n.";
  }

  function clearDraws() { live.n = 0; live.sum = 0; live.cps = []; live.next = 1; updateCount(); }
  function addDraws(k) {
    const d = DIST[B.dist];
    const rng = live.rng ?? (live.rng = makeRng((state.dept.seed * 2654435761) >>> 0));
    const room = live.draws.length - live.n;
    const take = Math.min(k, room);
    for (let i = 0; i < take; i += 1) {
      const x = d.sample(rng, B.params);
      live.draws[live.n] = x;
      live.n += 1;
      live.sum += x;
      if (live.n >= live.next) { live.cps.push([live.n, live.sum / live.n]); live.next = Math.max(live.n + 1, Math.round(live.n * 1.02)); }
    }
    updateCount();
    if (take < k) { stopStream(); status("Draw limit of 200,000 reached."); }
  }
  function updateCount() {
    const n = live.n;
    if (!n) { $("#b-count").textContent = "No draws yet"; return; }
    const d = DIST[B.dist];
    const xs = live.draws.subarray(0, n);
    const m = live.sum / n;
    let v = 0;
    for (let i = 0; i < n; i += 1) v += (xs[i] - m) ** 2;
    const sd = Math.sqrt(v / Math.max(1, n - 1));
    const s = describe(d, B.params);
    $("#b-count").textContent = `n = ${n.toLocaleString("en-US")}   mean ${fmt(m)} (true ${fmt(s.mean)})   sd ${fmt(sd)} (true ${fmt(s.sd)})`;
  }
  function stopStream() { live.streaming = false; const b = $("#b-stream"); b.setAttribute("aria-pressed", "false"); b.textContent = "Stream"; }
  function streamLoop() {
    if (!live.streaming) return;
    addDraws(Math.max(20, Math.floor(live.n * 0.03)));
    drawBench();
    requestAnimationFrame(streamLoop);
  }

  const scheduleBench = frame(() => { renderStats(); renderCalcInputs(); drawBench(); saveHash(); });

  // events
  $("#b-dist").addEventListener("change", (e) => {
    B.dist = e.target.value;
    B.params = { ...DIST[B.dist].defaults };
    clearDraws();
    buildBenchControls();
    resetCalc();
    scheduleBench();
    status(`${DIST[B.dist].name} distribution selected.`);
  });
  $$("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    B.mode = b.dataset.mode;
    $$("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    setFromProb(lastProb > 0 && lastProb < 1 ? lastProb : 0.95);
    if (B.mode === "outside" || B.mode === "le" || B.mode === "ge") resetCalc();
    scheduleBench();
  }));
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => {
    B.view = b.dataset.view;
    $$("[data-view]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    scheduleBench();
  }));
  $("#b-norm").addEventListener("change", (e) => { B.overlay = e.target.checked; scheduleBench(); });
  $("#b-lock").addEventListener("change", (e) => { B.lock = e.target.checked; });
  const readNum = (el) => { const v = parseFloat(el.value); return Number.isFinite(v) ? v : null; };
  $("#b-a").addEventListener("input", (e) => { const v = readNum(e.target); if (v === null) return; B.a = v; if (B.b < B.a && !(B.mode === "le" || B.mode === "ge")) B.b = B.a; scheduleBenchKeepInputs(); });
  $("#b-b").addEventListener("input", (e) => { const v = readNum(e.target); if (v === null) return; B.b = v; if (B.b < B.a) B.a = B.b; scheduleBenchKeepInputs(); });
  $("#b-p").addEventListener("change", (e) => { const v = readNum(e.target); if (v === null) return; setFromProb(clamp(v, 1e-9, 1 - 1e-9)); scheduleBench(); });
  function scheduleBenchKeepInputs() { renderStats(); const p = calcProb(); lastProb = p; $("#b-p").value = Number(p.toFixed(6)); const aa = document.activeElement; if (aa?.id !== "b-a") $("#b-a").value = Number(B.a.toFixed(6)); if (aa?.id !== "b-b" && !(B.mode === "le" || B.mode === "ge")) $("#b-b").value = Number(B.b.toFixed(6)); renderResult(); drawBench(); saveHash(); }
  function renderResult() {
    const p = calcProb();
    const label = { le: `P(X ≤ ${fmt(B.a)})`, ge: `P(X ≥ ${fmt(B.a)})`, between: `P(${fmt(B.a)} ≤ X ≤ ${fmt(B.b)})`, outside: `P(X < ${fmt(B.a)} or X > ${fmt(B.b)})` }[B.mode];
    $("#b-result").innerHTML = `${label} = ${pfmt(p)}<small>${pct(p)}${oneIn(p) ? `, ${oneIn(p)}` : ""}</small>`;
  }

  $$("[data-draw]").forEach((b) => b.addEventListener("click", () => { addDraws(Number(b.dataset.draw)); drawBench(); }));
  $("#b-clear").addEventListener("click", () => { clearDraws(); stopStream(); drawBench(); });
  if (reduceMotion) { $("#b-stream").disabled = true; $("#b-stream").title = "Streaming is off because reduced motion is enabled."; }
  $("#b-stream").addEventListener("click", () => {
    live.streaming = !live.streaming;
    $("#b-stream").setAttribute("aria-pressed", live.streaming);
    $("#b-stream").textContent = live.streaming ? "Stop" : "Stream";
    if (live.streaming) streamLoop();
  });

  // pointer: hover readout and dragging cutoffs
  const canvasB = $("#b-canvas");
  let drag = null;
  const xAt = (e) => bPlot.invX(e.clientX - canvasB.getBoundingClientRect().left);
  canvasB.addEventListener("pointermove", (e) => {
    const x = xAt(e);
    if (drag) {
      let v = clamp(x, bPlot.x0, bPlot.x1);
      if (DIST[B.dist].discrete) v = Math.round(v);
      const single = B.mode === "le" || B.mode === "ge";
      if (drag === "a") { B.a = v; if (!single && B.a > B.b) { B.b = B.a; drag = "b"; B.a = B.a; } }
      else { B.b = v; if (B.b < B.a) { B.a = B.b; drag = "a"; } }
      scheduleBenchKeepInputs();
    } else { hover = x; drawBench(); }
  });
  canvasB.addEventListener("pointerleave", () => { hover = null; if (!drag) drawBench(); });
  canvasB.addEventListener("pointerdown", (e) => {
    const x = xAt(e);
    const single = B.mode === "le" || B.mode === "ge";
    drag = single || Math.abs(x - B.a) <= Math.abs(x - B.b) ? "a" : "b";
    canvasB.setPointerCapture(e.pointerId);
    canvasB.style.cursor = "ew-resize";
    canvasB.dispatchEvent(new PointerEvent("pointermove", e));
  });
  const endDrag = () => { drag = null; canvasB.style.cursor = ""; };
  canvasB.addEventListener("pointerup", endDrag);
  canvasB.addEventListener("pointercancel", endDrag);
  canvasB.style.touchAction = "none";

  bPlot.onResize = drawBench;
  mPlot.onResize = drawRunningMean;

  renderers.bench = () => { buildBenchControls(); if (!Number.isFinite(B.a)) resetCalc(); renderStats(); renderCalcInputs(); drawBench(); updateCount(); };

  // ================================================================== CONSTRUCTIONS
  const U = (a, b) => (rng) => a + (b - a) * rng.next();
  const logMoments = (a, b) => {
    const g = (x) => Math.log(x);
    const n = 2000; let m1 = 0; let m2 = 0;
    for (let i = 0; i < n; i += 1) { const x = a + ((i + 0.5) / n) * (b - a); m1 += g(x); m2 += g(x) ** 2; }
    m1 /= n; m2 /= n;
    return { mean: m1, variance: m2 - m1 * m1 };
  };
  const chiBuild = (rng, k, parts) => { let s = 0; for (let i = 0; i < k; i += 1) { const z = rng.normal(); s += z * z; if (parts && i < 4) parts.push(z); } return s; };
  const f3 = (x) => fmt(x, 3);
  const SOURCES = {
    exponential: { name: "Exponential(1)", draw: (r) => -Math.log(r.open()), mean: 1, sd: 1 },
    lognormal: { name: "Log-normal(0, 1)", draw: (r) => Math.exp(r.normal()), mean: Math.exp(0.5), sd: Math.sqrt((Math.E - 1) * Math.E) },
    uniform: { name: "Uniform(0, 1)", draw: (r) => r.next(), mean: 0.5, sd: Math.sqrt(1 / 12) },
    pareto15: { name: "Pareto, α = 1.5 (infinite variance)", draw: (r) => 1 / r.open() ** (1 / 1.5), mean: 3, sd: Infinity },
    cauchy: { name: "Cauchy(0, 1) (no mean)", draw: (r) => Math.tan(Math.PI * (r.next() - 0.5)), mean: NaN, sd: Infinity },
  };
  const RECIPES = {
    chisq: {
      name: "Chi-square: sum of squared normals", formula: "χ²ₖ = Z₁² + … + Zₖ²",
      params: [{ id: "k", label: "Number of normals", symbol: "k", min: 1, max: 30, step: 1, value: 3, integer: true }],
      note: "Each squared standard normal has mean 1, so the sum has mean k. The density is exactly gamma with shape k/2 and scale 2.",
      build(rng, p) { const parts = []; const v = chiBuild(rng, p.k, parts); return { value: v, steps: [...parts.map((z, i) => `Z${sub(i + 1)} = ${f3(z)}, Z${sub(i + 1)}² = ${f3(z * z)}`), ...(p.k > 4 ? [`… ${p.k - 4} more terms`] : []), `Sum = ${f3(v)}`] }; },
      target: (p) => ({ d: "chisq", params: { k: p.k } }),
    },
    t: {
      name: "Student t: normal over root chi-square", formula: "T = Z / √(χ²ν / ν)",
      params: [{ id: "nu", label: "Degrees of freedom", symbol: "ν", min: 1, max: 30, step: 1, value: 4, integer: true }],
      note: "The numerator is a standard normal. The denominator estimates the scale and varies from draw to draw, which fattens the tails.",
      build(rng, p) { const z = rng.normal(); const parts = []; const q = chiBuild(rng, p.nu, parts); const v = z / Math.sqrt(q / p.nu); return { value: v, steps: [`Z = ${f3(z)}`, `χ²${sub(p.nu)} = ${f3(q)} from ${p.nu} squared normals`, `Scale √(χ²/ν) = ${f3(Math.sqrt(q / p.nu))}`, `T = ${f3(z)} / ${f3(Math.sqrt(q / p.nu))} = ${f3(v)}`] }; },
      target: (p) => ({ d: "t", params: { df: p.nu } }),
    },
    f: {
      name: "F: ratio of scaled chi-squares", formula: "F = (χ²d₁ / d₁) / (χ²d₂ / d₂)",
      params: [
        { id: "d1", label: "Numerator df", symbol: "d₁", min: 1, max: 20, step: 1, value: 4, integer: true },
        { id: "d2", label: "Denominator df", symbol: "d₂", min: 1, max: 40, step: 1, value: 10, integer: true },
      ],
      note: "Each chi-square is divided by its degrees of freedom so that its mean is 1. The ratio therefore centers near 1 under the null.",
      build(rng, p) { const a = chiBuild(rng, p.d1); const b = chiBuild(rng, p.d2); const v = (a / p.d1) / (b / p.d2); return { value: v, steps: [`χ²${sub(p.d1)} = ${f3(a)}, divided by ${p.d1}: ${f3(a / p.d1)}`, `χ²${sub(p.d2)} = ${f3(b)}, divided by ${p.d2}: ${f3(b / p.d2)}`, `F = ${f3(a / p.d1)} / ${f3(b / p.d2)} = ${f3(v)}`] }; },
      target: (p) => ({ d: "f", params: { d1: p.d1, d2: p.d2 } }),
    },
    clt: {
      name: "Sample mean and the central limit theorem", formula: "X̄ₘ = (X₁ + … + Xₘ) / m",
      params: [
        { id: "m", label: "Observations averaged", symbol: "m", min: 1, max: 200, step: 1, value: 5, integer: true },
        { id: "src", label: "Source", select: Object.entries(SOURCES).map(([id, s]) => [id, s.name]), value: "exponential" },
      ],
      note: "With finite variance the mean of m draws approaches a normal distribution as m grows. For Cauchy draws the mean has the same distribution as one draw, and for infinite variance the approach is slow.",
      build(rng, p) { const S = SOURCES[p.src]; let s = 0; const first = []; for (let i = 0; i < p.m; i += 1) { const x = S.draw(rng); s += x; if (i < 4) first.push(x); } const v = s / p.m; return { value: v, steps: [...first.map((x, i) => `X${sub(i + 1)} = ${f3(x)}`), ...(p.m > 4 ? [`… ${p.m - 4} more draws`] : []), `Mean = ${f3(v)}`] }; },
      target(p) {
        const S = SOURCES[p.src];
        if (p.src === "cauchy") return { d: "cauchy", params: { x0: 0, gamma: 1 } };
        if (!Number.isFinite(S.sd)) return null;
        return { d: "normal", params: { mu: S.mean, sigma: S.sd / Math.sqrt(p.m) }, label: "Normal approximation" };
      },
      window: (p) => (SOURCES[p.src].sd === Infinity ? null : null),
    },
    lognormal: {
      name: "Log-normal: product of random growth factors", formula: "X = G₁ × G₂ × … × Gₘ,  Gᵢ ~ Uniform(0.6, 1.5)",
      params: [{ id: "m", label: "Number of factors", symbol: "m", min: 1, max: 60, step: 1, value: 12, integer: true }],
      note: "The logarithm of a product is a sum, so the product of many independent positive factors is approximately log-normal. This is Gibrat's account of firm and city sizes.",
      build(rng, p) { let v = 1; const first = []; for (let i = 0; i < p.m; i += 1) { const g = 0.6 + 0.9 * rng.next(); v *= g; if (i < 4) first.push(g); } return { value: v, steps: [...first.map((g, i) => `G${sub(i + 1)} = ${f3(g)}`), ...(p.m > 4 ? [`… ${p.m - 4} more factors`] : []), `Product = ${f3(v)}`] }; },
      target(p) { const mo = logMoments(0.6, 1.5); return { d: "lognormal", params: { mu: p.m * mo.mean, sigma: Math.sqrt(p.m * mo.variance) }, label: "Log-normal approximation" }; },
    },
    cauchy: {
      name: "Cauchy: ratio of two normals", formula: "C = Z₁ / Z₂",
      params: [],
      note: "The ratio of independent standard normals has no mean and no variance, because the denominator is close to zero with non-negligible probability.",
      build(rng) { const a = rng.normal(); const b = rng.normal(); return { value: a / b, steps: [`Z₁ = ${f3(a)}`, `Z₂ = ${f3(b)}`, `C = ${f3(a / b)}`] }; },
      target: () => ({ d: "cauchy", params: { x0: 0, gamma: 1 } }),
    },
    poisson: {
      name: "Poisson: arrivals with exponential gaps", formula: "N = number of exponential(1) gaps that fit in time λ",
      params: [{ id: "lambda", label: "Time window", symbol: "λ", min: 0.5, max: 25, step: 0.5, value: 4 }],
      note: "If gaps between events are independent exponentials, the count in a fixed window is Poisson. The mean of the count equals the window times the arrival rate.",
      build(rng, p) { let t = 0; let n = 0; const gaps = []; for (;;) { const g = -Math.log(rng.open()); if (t + g > p.lambda) break; t += g; n += 1; if (gaps.length < 4) gaps.push(g); } return { value: n, steps: [...gaps.map((g, i) => `Gap ${i + 1} = ${f3(g)}`), ...(n > 4 ? [`… ${n - 4} more arrivals`] : []), `${n} arrivals fit in ${fmt(p.lambda)}`] }; },
      target: (p) => ({ d: "poisson", params: { lambda: p.lambda } }),
    },
  };
  function sub(n) { return String(n).split("").map((ch) => "₀₁₂₃₄₅₆₇₈₉"[Number(ch)]).join(""); }

  const C = state.build;
  const cPlot = createPlot($("#c-canvas"), root);
  const cLive = { values: [], rng: makeRng(99), last: null };
  Object.entries(RECIPES).forEach(([id, r]) => $("#c-recipe").append(new Option(r.name, id)));
  if (!RECIPES[C.recipe]) C.recipe = "chisq";
  $("#c-recipe").value = C.recipe;

  function buildRecipeControls() {
    const r = RECIPES[C.recipe];
    $("#c-formula").textContent = r.formula;
    $("#c-note").textContent = r.note;
    const box = $("#c-params");
    box.innerHTML = "";
    for (const spec of r.params) {
      if (C.params[spec.id] === undefined || C.params[spec.id] === null || (spec.select && !SOURCES[C.params[spec.id]])) C.params[spec.id] = spec.value;
      if (spec.select) {
        const label = document.createElement("label");
        label.className = "dl-field";
        label.textContent = spec.label;
        const sel = document.createElement("select");
        for (const [v, name] of spec.select) sel.append(new Option(name, v));
        sel.value = C.params[spec.id];
        sel.addEventListener("change", () => { C.params[spec.id] = sel.value; clearBuild(); renderBuild(); });
        label.append(sel);
        box.append(label);
      } else {
        sliderRow(box, spec, C.params[spec.id], (v) => { C.params[spec.id] = spec.integer ? Math.round(v) : v; clearBuild(); renderBuild(); });
      }
    }
  }
  function clearBuild() { cLive.values = []; cLive.last = null; $("#c-steps").innerHTML = ""; $("#c-count").textContent = "No draws yet"; saveHash(); }
  function buildDraws(k) {
    const r = RECIPES[C.recipe];
    for (let i = 0; i < k; i += 1) {
      const out = r.build(cLive.rng, C.params);
      cLive.values.push(out.value);
      cLive.last = out;
    }
    if (cLive.last) $("#c-steps").innerHTML = cLive.last.steps.map((s) => `<li>${s}</li>`).join("");
    $("#c-count").textContent = `n = ${cLive.values.length.toLocaleString("en-US")}`;
    renderBuild();
  }
  function renderBuild() {
    if (!cPlot.resize()) return;
    cPlot.refreshColors();
    const c = cPlot.c;
    const r = RECIPES[C.recipe];
    cPlot.clear();
    const t = r.target(C.params);
    const vals = cLive.values;
    let x0; let x1; let discrete = false; let pdf = null;
    if (t) {
      const d = DIST[t.d];
      [x0, x1] = plotRange(d, t.params);
      discrete = d.discrete;
      pdf = (x) => d.pdf(x, t.params);
    } else if (vals.length) {
      const s = [...vals].sort((a, b) => a - b);
      x0 = s[Math.floor(0.02 * s.length)]; x1 = s[Math.floor(0.98 * s.length)];
    } else { x0 = 0; x1 = 10; }
    if (vals.length && t && DIST[t.d].id === "cauchy") { x0 = -10; x1 = 10; }
    if (!(x1 > x0)) x1 = x0 + 1;
    let ymax = 0;
    if (pdf) {
      if (discrete) for (let k = Math.ceil(x0); k <= x1; k += 1) ymax = Math.max(ymax, pdf(k));
      else for (let i = 1; i < 200; i += 1) { const v = pdf(x0 + ((x1 - x0) * i) / 200); if (Number.isFinite(v)) ymax = Math.max(ymax, v); }
    }
    let bars = [];
    if (vals.length) {
      bars = discrete ? tally(vals, Math.ceil(x0), Math.floor(x1)) : histogram(vals, x0, x1, 36);
      ymax = Math.max(ymax, ...bars.map((b) => b.h));
    }
    cPlot.domain(x0, x1, 0, (ymax || 1) * 1.12);
    cPlot.axes({ yLabel: discrete ? "probability" : "density", xLabel: "value" });
    if (bars.length) cPlot.bars(bars, { color: c.pink, alpha: discrete ? 0.55 : 0.45 });
    if (pdf) {
      if (discrete) {
        const dots = []; for (let k = Math.ceil(x0); k <= x1; k += 1) dots.push([k, pdf(k)]);
        cPlot.line(dots, { color: c.ink, width: 1.5, dash: [3, 3] });
        dots.forEach(([k, y]) => cPlot.dots([k], y, { color: c.ink, r: 3.5 }));
      } else cPlot.line(cPlot.curvePoints(pdf), { color: c.ink, width: 2 });
      cPlot.text(t.label ? `Curve: ${t.label}` : `Curve: exact ${DIST[t.d].name} density`, cPlot.m.l + 8, cPlot.m.t + 4, { color: c.ink });
    } else cPlot.text("No limiting normal curve exists for this source.", cPlot.m.l + 8, cPlot.m.t + 4, { color: c.ink });
    $("#c-readout").textContent = vals.length > 1
      ? `Sample mean ${fmt(vals.reduce((s, v) => s + v, 0) / vals.length)}${t ? `; exact mean ${fmt(DIST[t.d].mean(t.params))}` : ""}. ${vals.length < 1000 ? "Build more draws to see the histogram settle onto the curve." : ""}`
      : "Build a few draws to see each recipe executed.";
    $("#c-canvas").setAttribute("aria-label", `Histogram of ${vals.length} constructed draws for ${r.name}`);
  }
  $("#c-recipe").addEventListener("change", (e) => { C.recipe = e.target.value; C.params = {}; buildRecipeControls(); clearBuild(); renderBuild(); });
  $$("[data-build]").forEach((b) => b.addEventListener("click", () => buildDraws(Number(b.dataset.build))));
  $("#c-clear").addEventListener("click", () => { clearBuild(); renderBuild(); });
  cPlot.onResize = renderBuild;
  renderers.build = () => { buildRecipeControls(); if (!cLive.values.length) $("#c-count").textContent = "No draws yet"; renderBuild(); };

  // ================================================================== TEST DESK
  const Tt = state.desk;
  const tPlot = createPlot($("#t-canvas"), root);
  const pPlot = createPlot($("#t-pcanvas"), root, { t: 18 });
  const D = DIST;
  const tdraw = makeRng(2026);

  function deskPower(cfg) {
    const { test, tail, alpha, n, n2, effect } = cfg;
    const crit = { lo: -Infinity, hi: Infinity };
    let nullQ; let altCdf;
    if (test === "z") { const delta = effect * Math.sqrt(n); nullQ = normQuantile; altCdf = (x) => normCdf(x - delta); }
    else if (test === "t") { const delta = effect * Math.sqrt(n); const p = { df: n - 1 }; nullQ = (u) => D.t.quantile(u, p); altCdf = (x) => D.nct.cdf(x, { df: n - 1, delta }); }
    else if (test === "chisq") { const p = { k: n - 1 }; nullQ = (u) => D.chisq.quantile(u, p); altCdf = (x) => D.chisq.cdf(x / effect, p); }
    else { const p = { d1: n - 1, d2: n2 - 1 }; nullQ = (u) => D.f.quantile(u, p); altCdf = (x) => D.f.cdf(x / effect, p); }
    if (tail === "two") { crit.lo = nullQ(alpha / 2); crit.hi = nullQ(1 - alpha / 2); }
    else if (tail === "upper") crit.hi = nullQ(1 - alpha);
    else crit.lo = nullQ(alpha);
    const power = (Number.isFinite(crit.lo) ? altCdf(crit.lo) : 0) + (Number.isFinite(crit.hi) ? 1 - altCdf(crit.hi) : 0);
    return { crit, power: clamp(power, 0, 1), nullQ, altCdf };
  }

  function requiredN(cfg, target = 0.8) {
    const nullEffect = cfg.test === "z" || cfg.test === "t" ? cfg.effect === 0 : cfg.effect === 1;
    if (nullEffect) return null;
    const at = (m) => deskPower({ ...cfg, n: m, n2: cfg.test === "f" ? m : cfg.n2 }).power;
    const lo0 = cfg.test === "t" ? 2 : 2;
    if (at(20000) < target) return Infinity;
    let lo = lo0; let hi = 20000;
    if (at(lo) >= target) return lo;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (at(mid) >= target) hi = mid; else lo = mid; }
    return hi;
  }

  function deskSetup() {
    const cfg = Tt;
    const { test } = cfg;
    const { crit, power, nullQ } = deskPower(cfg);
    let nullPdf; let altPdf; let x0; let x1; let nonneg = false; let delta = 0; let statName;
    if (test === "z") {
      delta = cfg.effect * Math.sqrt(cfg.n); statName = "z";
      nullPdf = (x) => normPdf(x); altPdf = (x) => normPdf(x - delta);
      x0 = Math.min(-3.8, delta - 3.8); x1 = Math.max(3.8, delta + 3.8);
    } else if (test === "t") {
      delta = cfg.effect * Math.sqrt(cfg.n); statName = "t";
      const p = { df: cfg.n - 1 };
      nullPdf = (x) => D.t.pdf(x, p); altPdf = (x) => D.nct.pdf(x, { df: p.df, delta });
      x0 = Math.min(nullQ(0.001), delta - 4, -3); x1 = Math.max(nullQ(0.999), delta + 4, 3);
      if (cfg.n < 4) { x0 = Math.max(x0, -12 + Math.min(0, delta)); x1 = Math.min(x1, 12 + Math.max(0, delta)); }
    } else if (test === "chisq") {
      statName = "χ²"; nonneg = true;
      const p = { k: cfg.n - 1 };
      nullPdf = (x) => D.chisq.pdf(x, p); altPdf = (x) => D.chisq.pdf(x / cfg.effect, p) / cfg.effect;
      x0 = 0; x1 = Math.max(nullQ(0.999), cfg.effect * nullQ(0.995));
    } else {
      statName = "F"; nonneg = true;
      const p = { d1: cfg.n - 1, d2: cfg.n2 - 1 };
      nullPdf = (x) => D.f.pdf(x, p); altPdf = (x) => D.f.pdf(x / cfg.effect, p) / cfg.effect;
      x0 = 0; x1 = Math.min(Math.max(nullQ(0.99), cfg.effect * nullQ(0.97)), 40);
    }
    return { crit, power, nullPdf, altPdf, x0, x1, nonneg, delta, statName };
  }

  const deskParams = () => {
    const t = Tt.test;
    if (t === "z" || t === "t") return [
      { key: "n", label: "Sample size", symbol: "n", min: 2, max: 400, step: 1, integer: true },
      { key: "effect", label: "True effect in standard deviations", symbol: "d", min: -2, max: 2, step: 0.05 },
      { key: "alpha", label: "Significance level", symbol: "α", min: 0.001, max: 0.2, step: 0.001 },
    ];
    if (t === "chisq") return [
      { key: "n", label: "Sample size", symbol: "n", min: 2, max: 200, step: 1, integer: true },
      { key: "effect", label: "Variance ratio σ² / σ₀²", symbol: "ρ", min: 0.2, max: 5, step: 0.05 },
      { key: "alpha", label: "Significance level", symbol: "α", min: 0.001, max: 0.2, step: 0.001 },
    ];
    return [
      { key: "n", label: "Sample size, group 1", symbol: "n₁", min: 2, max: 200, step: 1, integer: true },
      { key: "n2", label: "Sample size, group 2", symbol: "n₂", min: 2, max: 200, step: 1, integer: true },
      { key: "effect", label: "Variance ratio σ₁² / σ₂²", symbol: "ρ", min: 0.2, max: 5, step: 0.05 },
      { key: "alpha", label: "Significance level", symbol: "α", min: 0.001, max: 0.2, step: 0.001 },
    ];
  };
  function normalizeDesk() {
    if ((Tt.test === "chisq" || Tt.test === "f") && !(Tt.effect > 0)) Tt.effect = 2;
    if (Tt.test === "chisq" || Tt.test === "f") Tt.effect = clamp(Tt.effect, 0.2, 5);
    if (Tt.test === "z" || Tt.test === "t") Tt.effect = clamp(Tt.effect, -2, 2);
    if (Tt.tail === "upper" && (Tt.test === "z" || Tt.test === "t") && Tt.effect < 0) Tt.effect = Math.abs(Tt.effect);
  }
  function buildDeskControls() {
    normalizeDesk();
    $("#t-test").value = Tt.test; $("#t-tail").value = Tt.tail;
    const box = $("#t-params");
    box.innerHTML = "";
    for (const spec of deskParams()) {
      sliderRow(box, { ...spec }, Tt[spec.key], (v) => { Tt[spec.key] = spec.integer ? Math.round(v) : v; if (spec.key === "alpha") Tt.alpha = Number(v.toFixed(4)); scheduleDesk(); }, (v) => (spec.key === "alpha" ? v.toFixed(3) : spec.integer ? String(Math.round(v)) : fmt(v, 3)));
    }
  }
  function renderDesk() {
    if (!tPlot.resize()) return;
    tPlot.refreshColors();
    const c = tPlot.c;
    const S = deskSetup();
    const effectNull = Tt.test === "z" || Tt.test === "t" ? Tt.effect === 0 : Tt.effect === 1;
    // y range
    let ymax = 0;
    for (let i = 1; i < 200; i += 1) { const x = S.x0 + ((S.x1 - S.x0) * i) / 200; ymax = Math.max(ymax, S.nullPdf(x), S.altPdf(x)); }
    tPlot.clear();
    tPlot.domain(S.x0, S.x1, 0, ymax * 1.1);
    tPlot.axes({ xLabel: S.statName, yLabel: "density" });
    const nullPts = tPlot.curvePoints(S.nullPdf, S.x0, S.x1, 320);
    const altPts = tPlot.curvePoints(S.altPdf, S.x0, S.x1, 320);
    const { lo, hi } = S.crit;
    const regions = [];
    if (Number.isFinite(lo)) regions.push([S.x0, lo]);
    if (Number.isFinite(hi)) regions.push([hi, S.x1]);
    for (const [a, b] of regions) { tPlot.fillUnder(altPts, a, b, { color: c.orange, alpha: 0.4 }); tPlot.fillUnder(nullPts, a, b, { color: c.accent, alpha: 0.5 }); }
    tPlot.line(nullPts, { color: c.accent, width: 2 });
    tPlot.line(altPts, { color: c.orange, width: 2 });
    if (Number.isFinite(lo)) tPlot.vline(lo, { color: c.ink, dash: [4, 3], label: fmt(lo, 3) });
    if (Number.isFinite(hi)) tPlot.vline(hi, { color: c.ink, dash: [4, 3], label: fmt(hi, 3) });
    $("#t-legend").innerHTML = `<span><i class="a"></i>Sampling distribution if the null is true; shaded area = significance level α</span><span><i class="o"></i>Sampling distribution under the stated effect; shaded area = power</span><span><i class="k"></i>Critical value</span>`;
    const nullCdf = Tt.test === "z" ? normCdf : Tt.test === "t" ? (x) => D.t.cdf(x, { df: Tt.n - 1 }) : Tt.test === "chisq" ? (x) => D.chisq.cdf(x, { k: Tt.n - 1 }) : (x) => D.f.cdf(x, { d1: Tt.n - 1, d2: Tt.n2 - 1 });
    let obsRow = null;
    if (Number.isFinite(Tt.obs)) {
      const lowP = nullCdf(Tt.obs);
      const pv = Tt.tail === "upper" ? 1 - lowP : Tt.tail === "lower" ? lowP : Math.min(1, 2 * Math.min(lowP, 1 - lowP));
      obsRow = ["p-value at observed statistic", `${pfmt(pv)} (${pv < Tt.alpha ? "reject" : "do not reject"} at α = ${Tt.alpha.toFixed(3)})`];
      if (Tt.obs >= S.x0 && Tt.obs <= S.x1) tPlot.vline(Tt.obs, { color: c.pink, width: 2, label: `obs ${fmt(Tt.obs, 3)}`, top: false });
    }
    const req = requiredN({ ...Tt });
    const beta = 1 - S.power;
    const reqText = req === null ? "Not defined without an effect" : req === Infinity ? "More than 20,000" : Tt.test === "f" ? `${req} per group` : String(req);
    const crits = Tt.tail === "two" ? `${fmt(lo, 4)} and ${fmt(hi, 4)}` : fmt(Tt.tail === "upper" ? hi : lo, 4);
    const rows = [["Critical value(s)", crits], ["Power, 1 − β", effectNull ? `${pfmt(S.power)} (equals α)` : pfmt(S.power)], ["Type II error, β", pfmt(beta)], ["Sample size for 80% power", reqText]];
    if (obsRow) rows.push(obsRow);
    if (Tt.test === "z" || Tt.test === "t") rows.splice(1, 0, ["Non-centrality δ = d√n", fmt(S.delta, 4)]);
    $("#t-out").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    $("#t-note").textContent = {
      z: "With σ known, the statistic is normal under the null and shifts by δ = d√n under the alternative.",
      t: "With σ estimated, the null distribution is t with n − 1 degrees of freedom and the alternative is non-central t. Power is lower than the z test at small n.",
      chisq: "Under the null, (n − 1)s²/σ₀² follows χ² with n − 1 degrees of freedom. If the true variance is ρσ₀², the statistic is ρ times that chi-square.",
      f: "Under equal variances the ratio s₁²/s₂² follows F with n₁ − 1 and n₂ − 1 degrees of freedom. If the true ratio is ρ, the statistic is ρ times an F variable.",
    }[Tt.test];
    $("#t-canvas").setAttribute("aria-label", `Null and alternative distributions of the ${S.statName} statistic. Power ${pfmt(S.power)}.`);
    renderP();
    saveHash();
  }
  const scheduleDesk = frame(renderDesk);

  const pLive = { ps: null };
  function runStudies() {
    const M = 4000;
    const cfg = Tt;
    const world = cfg.world;
    const alt = world === "alt";
    const effect = alt ? cfg.effect : cfg.test === "z" || cfg.test === "t" ? 0 : 1;
    const ps = new Float64Array(M);
    const df = cfg.n - 1;
    const delta = effect * Math.sqrt(cfg.n);
    let nullCdf;
    if (cfg.test === "z") nullCdf = normCdf;
    else if (cfg.test === "t") nullCdf = (x) => D.t.cdf(x, { df });
    else if (cfg.test === "chisq") nullCdf = (x) => D.chisq.cdf(x, { k: df });
    else nullCdf = (x) => D.f.cdf(x, { d1: df, d2: cfg.n2 - 1 });
    for (let i = 0; i < M; i += 1) {
      let x;
      if (cfg.test === "z") x = tdraw.normal() + delta;
      else if (cfg.test === "t") x = (tdraw.normal() + delta) / Math.sqrt((2 * tdraw.gamma(df / 2)) / df);
      else if (cfg.test === "chisq") x = effect * 2 * tdraw.gamma(df / 2);
      else x = effect * (tdraw.gamma(df / 2) / df) / (tdraw.gamma((cfg.n2 - 1) / 2) / (cfg.n2 - 1));
      const lowP = nullCdf(x);
      const upP = 1 - lowP;
      ps[i] = cfg.tail === "upper" ? upP : cfg.tail === "lower" ? lowP : Math.min(1, 2 * Math.min(lowP, upP));
    }
    pLive.ps = ps;
    pLive.world = world;
    pLive.alpha = cfg.alpha;
    pLive.power = deskPower(alt ? cfg : { ...cfg, effect: cfg.test === "z" || cfg.test === "t" ? 0 : 1 }).power;
    $("#t-count").textContent = `${M.toLocaleString("en-US")} studies`;
    renderP();
  }
  function renderP() {
    if (!pPlot.resize()) return;
    pPlot.refreshColors();
    const c = pPlot.c;
    pPlot.clear();
    const bins = 20;
    const ps = pLive.ps;
    pPlot.domain(0, 1, 0, 1);
    if (!ps) {
      pPlot.axes({ xLabel: "p-value", yLabel: "density" });
      pPlot.text("Run repeated studies to see the distribution of p-values.", pPlot.w / 2, pPlot.h / 2 - 20, { align: "center", color: c.muted });
      $("#t-pnote").textContent = "";
      return;
    }
    const bars = histogram(ps, 0, 1, bins);
    const ymax = Math.max(1.4, ...bars.map((b) => b.h)) * 1.1;
    pPlot.domain(0, 1, 0, ymax);
    pPlot.axes({ xLabel: "p-value", yLabel: "density" });
    pPlot.bars(bars.map((b) => ({ ...b, tint: b.x1 <= pLive.alpha + 1e-9 ? c.orange : c.pink })), { alpha: 0.6 });
    pPlot.line([[0, 1], [1, 1]], { color: c.ink, dash: [4, 4], width: 1.2 });
    let reject = 0;
    for (const p of ps) if (p < pLive.alpha) reject += 1;
    const share = reject / ps.length;
    const se = Math.sqrt((share * (1 - share)) / ps.length);
    $("#t-pnote").textContent = pLive.world === "null"
      ? `With no effect, p-values are uniform on (0, 1). The share below α = ${pLive.alpha.toFixed(3)} was ${pct(share)} (Monte Carlo error about ${pct(se)}); the test rejects a true null with probability α.`
      : `With the stated effect, p-values pile up near zero. The share below α = ${pLive.alpha.toFixed(3)} was ${pct(share)}; the analytic power is ${pct(pLive.power)}. Orange bars lie below α.`;
  }
  $("#t-test").addEventListener("change", (e) => {
    Tt.test = e.target.value;
    Tt.effect = Tt.test === "chisq" || Tt.test === "f" ? 2 : 0.5;
    pLive.ps = null;
    buildDeskControls(); scheduleDesk();
  });
  $("#t-tail").addEventListener("change", (e) => { Tt.tail = e.target.value; pLive.ps = null; scheduleDesk(); });
  $$("[data-world]").forEach((b) => b.addEventListener("click", () => { Tt.world = b.dataset.world; $$("[data-world]").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  $("#t-run").addEventListener("click", runStudies);
  $("#t-obs").addEventListener("input", (e) => { const v = parseFloat(e.target.value); Tt.obs = Number.isFinite(v) ? v : null; scheduleDesk(); });
  tPlot.onResize = renderDesk; pPlot.onResize = renderP;
  renderers.desk = () => { buildDeskControls(); $("#t-obs").value = Number.isFinite(Tt.obs) ? Tt.obs : ""; $$("[data-world]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.world === Tt.world)); renderDesk(); };

  // ================================================================== DEPARTMENT
  const Dp = state.dept;
  let scenario = scenarioById(Dp.scenario);
  let history = makeHistory(scenario, Dp.seed);
  let models = null;
  let sim = null;
  let revealed = false;
  const eventPlots = [];
  const troublePlot = createPlot($("#d-trouble"), root, { t: 16 });

  function resetModels(keep) {
    scenario = scenarioById(Dp.scenario);
    history = makeHistory(scenario, Dp.seed);
    if (keep && Array.isArray(Dp.models) && Dp.models.length === scenario.events.length && Dp.models.every((m) => DIST[m?.family])) models = Dp.models.map((m) => ({ family: m.family, params: { ...m.params } }));
    else models = scenario.events.map((event, i) => {
      const family = POOLS[event.pool].includes("lognormal") && event.pool === "positive" ? "lognormal" : event.pool === "count" ? "poisson" : event.pool === "proportion" ? "beta" : "gamma";
      return { family, params: initialParameters(family, history[i]).params };
    });
    Dp.models = models;
    sim = null; revealed = false;
  }

  function renderScenarioButtons() {
    const box = $("#d-scen");
    box.innerHTML = "";
    for (const s of SCENARIOS) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = s.name; b.setAttribute("aria-pressed", s.id === Dp.scenario);
      b.addEventListener("click", () => { Dp.scenario = s.id; Dp.models = null; resetModels(false); renderDept(); });
      box.append(b);
    }
    $("#d-blurb").textContent = scenario.blurb;
  }

  function eventCard(event, i) {
    const data = history[i];
    const st = stats(data);
    const card = document.createElement("article");
    card.className = "dl-event";
    const isCount = event.pool === "count";
    card.innerHTML = `
      <header><span class="agent">${event.agent}</span><h3>${event.name}</h3><p class="blurb">${event.blurb} Stress point: ${event.thresholdText}.</p></header>
      <div class="dl-chips" aria-label="Twelve past observations">${data.map((v) => `<span>${v.toLocaleString("en-US", { maximumFractionDigits: event.digits ?? 1, minimumFractionDigits: event.digits ?? 0 })}</span>`).join("")}</div>
      <p class="sum">Mean ${fmt(st.mean)} · sd ${fmt(st.sd)} · range ${fmt(st.min)}–${fmt(st.max)}${isCount ? ` · variance/mean ${fmt(st.dispersion, 3)}` : ""}</p>
      <div class="dl-stage"><canvas class="dl-canvas short" role="img" aria-label="${event.name}: observed values and your model"></canvas></div>
      <div class="model">
        <label class="dl-field">Your model<select data-family></select></label>
        <button class="dl-btn" type="button" data-fit>Fit to data</button>
      </div>
      <div class="dl-params" data-params></div>
      <p class="warn" data-warn></p>`;
    const sel = $("[data-family]", card);
    drawFamilySelect(sel, POOLS[event.pool]);
    sel.value = models[i].family;
    sel.addEventListener("change", () => {
      models[i].family = sel.value;
      models[i].params = initialParameters(sel.value, data).params;
      sim = null; revealed = false;
      renderParams(card, i); drawEvent(i); markStale(); saveHash();
    });
    $("[data-fit]", card).addEventListener("click", () => {
      const r = initialParameters(models[i].family, data);
      models[i].params = r.params;
      status(r.fitted ? `${DIST[models[i].family].name} fitted to the twelve observations.` : "No closed-form fit for this family; parameters reset to starting values.");
      renderParams(card, i); drawEvent(i); markStale(); saveHash();
    });
    const canvas = $("canvas", card);
    const plot = createPlot(canvas, root, { l: 42, t: 12, b: 28 });
    plot.onResize = () => drawEvent(i);
    eventPlots[i] = plot;
    renderParams(card, i);
    return card;
  }

  function renderParams(card, i) {
    const m = models[i];
    const d = DIST[m.family];
    const box = $("[data-params]", card);
    box.innerHTML = "";
    for (const spec of d.params) {
      const r = parameterRange(m.family, spec, history[i]);
      const value = clamp(m.params[spec.id], r.min, r.max);
      m.params[spec.id] = value;
      sliderRow(box, { ...spec, min: r.min, max: r.max, step: spec.integer ? 1 : r.step }, value, (v) => {
        m.params[spec.id] = spec.integer ? Math.round(v) : v;
        sim = null; revealed = false;
        drawEvent(i); markStale(); saveHash();
      });
    }
  }

  function modelWarning(i) {
    const m = models[i];
    const d = DIST[m.family];
    if (!d.valid(m.params)) return "The upper limit must exceed the lower limit.";
    const bad = history[i].filter((x) => !(d.pdf(x, m.params) > 0));
    if (bad.length) return `This model assigns zero probability to ${bad.length === 1 ? "an observed value" : `${bad.length} observed values`} (${bad.slice(0, 3).map((x) => fmt(x)).join(", ")}${bad.length > 3 ? ", …" : ""}).`;
    return "";
  }

  function drawEvent(i) {
    const plot = eventPlots[i];
    if (!plot || !plot.resize()) return;
    plot.refreshColors();
    const c = plot.c;
    const event = scenario.events[i];
    const m = models[i];
    const d = DIST[m.family];
    const data = history[i];
    const warn = modelWarning(i);
    const card = plot.canvas.closest(".dl-event");
    $("[data-warn]", card).textContent = warn;
    plot.clear();
    const T = DIST[event.truth.family];
    let [x0, x1] = d.valid(m.params) ? plotRange(d, m.params) : [Math.min(...data), Math.max(...data)];
    const dmin = Math.min(...data); const dmax = Math.max(...data);
    x0 = Math.min(x0, dmin); x1 = Math.max(x1, dmax, event.threshold * (event.direction === "upper" ? 1.1 : 1));
    if (revealed) { const [a, b] = plotRange(T, event.truth.params); x0 = Math.min(x0, a); x1 = Math.max(x1, b); }
    if (event.pool === "proportion" && !revealed && m.family === "beta") { x0 = 0; x1 = 1; }
    if (!(x1 > x0)) x1 = x0 + 1;
    const discrete = d.discrete || T.discrete;
    const fm = (x) => (d.valid(m.params) ? d.pdf(discrete ? Math.round(x) : x, m.params) : 0);
    const ft = (x) => T.pdf(discrete ? Math.round(x) : x, event.truth.params);
    let ymax = 0;
    for (let k = 1; k < 200; k += 1) { const x = x0 + ((x1 - x0) * k) / 200; for (const f of revealed ? [fm, ft] : [fm]) { const v = f(x); if (Number.isFinite(v)) ymax = Math.max(ymax, v); } }
    const bins = discrete ? tally(data, Math.ceil(x0), Math.floor(x1)) : histogram(data, x0, x1, Math.max(5, Math.min(12, Math.round((x1 - x0) / ((x1 - x0) / 8)))));
    ymax = Math.max(ymax, ...bins.map((b) => b.h)) * 1.12 || 1;
    plot.domain(x0, x1, 0, ymax);
    plot.axes({ xLabel: event.unit, yLabel: discrete ? "probability" : "density" });
    plot.bars(bins, { color: c.pink, alpha: 0.28 });
    if (discrete) {
      const pts = []; for (let k = Math.ceil(x0); k <= x1; k += 1) pts.push([k, fm(k)]);
      plot.line(pts, { color: c.accent, width: 1.5 }); pts.forEach(([k, y]) => plot.dots([k], y, { color: c.accent, r: 3.5 }));
      if (revealed) { const q = []; for (let k = Math.ceil(x0); k <= x1; k += 1) q.push([k, ft(k)]); plot.line(q, { color: c.orange, width: 1.5, dash: [4, 3] }); }
    } else {
      plot.line(plot.curvePoints(fm, x0, x1, 280), { color: c.accent, width: 2.2 });
      if (revealed) plot.line(plot.curvePoints(ft, x0, x1, 280), { color: c.orange, width: 2, dash: [5, 4] });
    }
    plot.dots(data, 0, { color: c.ink, r: 3.6 });
    plot.vline(event.threshold, { color: c.muted, width: 1, dash: [3, 3], label: "stress point" });
    plot.canvas.setAttribute("aria-label", `${event.name}. Your ${d.name} model${revealed ? " and the true distribution" : ""} against twelve observations.`);
  }

  function markStale() {
    $("#d-replay").disabled = !sim;
    $("#d-reveal").disabled = !sim;
    $("#d-results").hidden = !sim;
    $("#d-msg").textContent = sim ? "" : "Model changed. Simulate again to update the results.";
    scenario.events.forEach((_, i) => drawEvent(i));
  }

  function renderDept(first) {
    renderScenarioButtons();
    const box = $("#d-events");
    box.innerHTML = "";
    eventPlots.length = 0;
    scenario.events.forEach((event, i) => box.append(eventCard(event, i)));
    $("#d-years").value = String(Dp.years);
    $("#d-results").hidden = true; $("#d-replay").disabled = true; $("#d-reveal").disabled = true;
    $("#d-msg").textContent = "";
    requestAnimationFrame(() => scenario.events.forEach((_, i) => drawEvent(i)));
    saveHash();
  }

  function runSim() {
    for (let i = 0; i < models.length; i += 1) {
      const w = modelWarning(i);
      if (w && w.startsWith("The upper")) { $("#d-msg").textContent = `Fix event ${i + 1}: ${w}`; return; }
    }
    Dp.years = Number($("#d-years").value);
    sim = simulateYears(scenario, models, Dp.years, Dp.seed * 101 + 17);
    revealed = false;
    $("#d-results").hidden = false; $("#d-replay").disabled = false; $("#d-reveal").disabled = false;
    $("#d-msg").textContent = `${Dp.years.toLocaleString("en-US")} years simulated`;
    replaySeed = Dp.seed * 13 + 1;
    renderResults();
    doReplay();
    scenario.events.forEach((_, i) => drawEvent(i));
    status("Simulation complete.");
    $("#d-results").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    saveHash();
  }

  function drawTrouble() {
    const p = troublePlot;
    if (!sim || !p.resize()) return;
    p.refreshColors();
    const c = p.c;
    const K = scenario.events.length + 1;
    p.clear();
    const ymax = Math.max(...sim.troubleModel, ...(revealed ? sim.troubleTruth : [0])) * 1.15 || 1;
    p.domain(-0.6, K - 0.4, 0, ymax);
    p.axes({ xTicks: false, yLabel: "share of years", yFormat: (v) => `${Math.round(v * 100)}%` });
    p.ctx.fillStyle = c.muted; p.font(11); p.ctx.textAlign = "center"; p.ctx.textBaseline = "top";
    for (let k = 0; k < K; k += 1) p.ctx.fillText(String(k), p.px(k), p.h - p.m.b + 6);
    p.text("events beyond their stress point in a year", p.w - p.m.r, p.h - 1, { align: "right", baseline: "bottom" });
    const bars = [];
    for (let k = 0; k < K; k += 1) bars.push({ x0: revealed ? k - 0.4 : k - 0.3, x1: revealed ? k : k + 0.3, h: sim.troubleModel[k], tint: c.accent });
    p.bars(bars, { alpha: 0.65 });
    if (revealed) p.bars(Array.from({ length: K }, (_, k) => ({ x0: k, x1: k + 0.4, h: sim.troubleTruth[k], tint: c.orange })), { alpha: 0.65 });
    const mean = sim.troubleModel.reduce((s, v, k) => s + v * k, 0);
    const meanT = sim.troubleTruth.reduce((s, v, k) => s + v * k, 0);
    $("#d-trouble-note").textContent = revealed
      ? `Blue: your model; orange: reality. Your model expects ${fmt(mean, 3)} problem events per year; reality delivers ${fmt(meanT, 3)}. Probability of three or more: ${pct(sim.troubleModel.slice(3).reduce((s, v) => s + v, 0))} in your model against ${pct(sim.troubleTruth.slice(3).reduce((s, v) => s + v, 0))}.`
      : `Your model expects ${fmt(mean, 3)} problem events per year, and no problems at all in ${pct(sim.troubleModel[0])} of years.`;
  }
  troublePlot.onResize = drawTrouble;

  let replaySeed = 1;
  function doReplay() {
    if (!sim) return;
    replaySeed += 1;
    const r = replayYear(scenario, models, replaySeed);
    const log = $("#d-log");
    log.innerHTML = "";
    r.lines.forEach((l, i) => {
      const li = document.createElement("li");
      if (l.exceed) li.className = "trouble";
      li.style.animationDelay = reduceMotion ? "0s" : `${i * 0.35}s`;
      li.innerHTML = `<span class="who">${l.agent}</span>${l.text}${l.exceed ? `<span class="surprise">Stress point crossed: ${l.thresholdText}.${l.note ? ` ${l.note}` : ""}</span>` : l.note ? `<span class="surprise">${l.note}</span>` : ""}`;
      log.append(li);
    });
    const end = document.createElement("li");
    end.style.animationDelay = reduceMotion ? "0s" : `${r.lines.length * 0.35}s`;
    end.innerHTML = `<span class="who">Year end</span>${r.troubles === 0 ? "No stress points were crossed this year. Reviewers noted the absence of events." : `${r.troubles} of ${r.lines.length} stress points were crossed this year.`}`;
    log.append(end);
  }

  function renderResults() {
    drawTrouble();
    const rows = scenario.events.map((event, i) => {
      const m = models[i];
      const d = DIST[m.family];
      const p = tailProbability(d, m.params, event);
      const s = scoreEvent(event, m.family, m.params);
      return { event, m, d, p, s };
    });
    if (!revealed) {
      $("#d-score").innerHTML = `<div class="dl-scroll"><table class="dl-table"><caption>What your model implies</caption><thead><tr><th>Event</th><th>Your family</th><th class="num">Median</th><th class="num">90% interval</th><th class="num">Probability of the stress point</th></tr></thead><tbody>${rows.map(({ event, m, d, p, s }) => `<tr><td>${event.name}</td><td>${d.name}</td><td class="num">${fmt(d.quantile(0.5, m.params))}</td><td class="num">${fmt(s.lo)} to ${fmt(s.hi)}</td><td class="num">${pfmt(p)}</td></tr>`).join("")}</tbody></table></div><p class="dl-hint">Reveal reality to compare each model with the true process.</p>`;
      return;
    }
    const lines = rows.map(({ event, m, d, p, s }) => {
      const T = DIST[event.truth.family];
      const dispersionNote = event.pool === "count" && m.family === "poisson" && event.truth.family !== "poisson" ? " A Poisson model forces the variance to equal the mean, which the data do not." : "";
      const ratio = s.pTruth > 0 ? s.pModel / s.pTruth : NaN;
      const direction = !Number.isFinite(ratio) ? "" : ratio < 0.67 ? `Your model understates this risk by a factor of ${fmt(1 / ratio, 3)}.` : ratio > 1.5 ? `Your model overstates this risk by a factor of ${fmt(ratio, 3)}.` : "Your model gets this risk about right.";
      return `<p><strong>${event.name}.</strong> The true process is ${T.name.toLowerCase()} with ${T.params.map((q) => `${q.symbol} = ${fmt(event.truth.params[q.id])}`).join(", ")}. The probability that ${event.thresholdText} is ${pfmt(s.pTruth)}; your ${d.name.toLowerCase()} model gives ${pfmt(s.pModel)}. ${direction}${dispersionNote}</p>`;
    }).join("");
    $("#d-score").innerHTML = `<div class="dl-scroll"><table class="dl-table"><caption>Your model against reality</caption><thead><tr><th>Event</th><th>Your family</th><th>True family</th><th class="num">Stress-point probability, yours</th><th class="num">True</th><th class="num">Coverage of your 90% interval</th><th class="num">Largest CDF gap</th></tr></thead><tbody>${rows.map(({ event, d, s }) => `<tr><td>${event.name}</td><td>${d.name}</td><td>${DIST[event.truth.family].name}</td><td class="num">${pfmt(s.pModel)}</td><td class="num">${pfmt(s.pTruth)}</td><td class="num">${pct(s.coverage)}</td><td class="num">${fmt(s.gap, 3)} · ${gradeGap(s.gap)}</td></tr>`).join("")}</tbody></table></div><div class="dl-read">${lines}<p>Twelve observations can distinguish a few families only crudely. Models that fit the center of the data equally well can differ by an order of magnitude in the tail, and the tail is where the stress points sit.</p></div>`;
  }

  $("#d-run").addEventListener("click", runSim);
  $("#d-replay").addEventListener("click", doReplay);
  $("#d-reveal").addEventListener("click", () => {
    if (!sim) return;
    revealed = true;
    renderResults();
    scenario.events.forEach((_, i) => drawEvent(i));
    $("#d-reveal").disabled = true;
    status("Reality revealed.");
  });
  $("#d-history").addEventListener("click", () => { Dp.seed += 1; Dp.models = null; resetModels(false); renderDept(); });
  $("#d-years").addEventListener("change", () => { Dp.years = Number($("#d-years").value); });
  resetModels(true);
  renderers.dept = () => { if (!$("#d-events").children.length) renderDept(true); else { scenario.events.forEach((_, i) => drawEvent(i)); drawTrouble(); } };

  // ================================================================== CODE DIALOG
  const dialog = $("#dl-code");
  let lang = "python";
  function codeFor() {
    if (state.tab === "dept") {
      return departmentScript(scenario, models, Dp.years, 2026, drawExpressions);
    }
    if (state.tab === "desk") return deskCode();
    if (state.tab === "build") {
      const t = RECIPES[C.recipe].target(C.params);
      if (t) return drawScript(t.d, t.params, { n: 20000, seed: 2026 });
    }
    const cut = B.mode === "le" || B.mode === "ge" ? B.a : B.b;
    return drawScript(B.dist, B.params, { n: 10000, seed: 2026, cutoff: Number(cut.toFixed(4)) });
  }
  function deskCode() {
    const { test, tail, alpha, n, n2, effect } = Tt;
    const a = alpha;
    const alt = tail === "two" ? "two-sided" : tail === "upper" ? "greater" : "less";
    const lowQ = tail === "two" ? a / 2 : a;
    const hiQ = tail === "two" ? 1 - a / 2 : 1 - a;
    const critPy = (q, name) => `${name} = ${q}`;
    const power = (loExpr, hiExpr) => {
      const parts = [];
      if (tail !== "upper") parts.push(loExpr);
      if (tail !== "lower") parts.push(hiExpr);
      return parts.join(" + ");
    };
    void critPy;
    if (test === "z") {
      const d = effect * Math.sqrt(n);
      return {
        python: `from scipy.stats import norm\n\nn, d, alpha = ${n}, ${effect}, ${a}\ndelta = d * n ** 0.5\nlo, hi = norm.ppf(${lowQ}), norm.ppf(${hiQ})\npower = ${power("norm.cdf(lo, loc=delta)", "norm.sf(hi, loc=delta)")}\nprint(lo, hi, power)  # delta = ${fmt(d)}`,
        r: `n <- ${n}; d <- ${effect}; alpha <- ${a}\ndelta <- d * sqrt(n)\nlo <- qnorm(${lowQ}); hi <- qnorm(${hiQ})\npower <- ${power("pnorm(lo, delta)", "1 - pnorm(hi, delta)")}\nc(lo, hi, power)`,
        julia: `using Distributions\n\nn, d, alpha = ${n}, ${effect}, ${a}\ndelta = d * sqrt(n)\nlo, hi = quantile(Normal(), ${lowQ}), quantile(Normal(), ${hiQ})\npower = ${power("cdf(Normal(delta, 1), lo)", "ccdf(Normal(delta, 1), hi)")}\nprintln((lo, hi, power))`,
        stata: `* Power of a one-sample z test with known sigma = 1\npower onemean 0 ${effect}, sd(1) n(${n}) alpha(${a}) knownsd${tail === "two" ? "" : " onesided"}`,
      };
    }
    if (test === "t") {
      return {
        python: `from statsmodels.stats.power import TTestPower\n\nanalysis = TTestPower()\npower = analysis.power(effect_size=${effect}, nobs=${n}, alpha=${a}, alternative="${alt === "two-sided" ? "two-sided" : alt === "greater" ? "larger" : "smaller"}")\nn_needed = analysis.solve_power(effect_size=${effect}, power=0.8, alpha=${a}, alternative="${alt === "two-sided" ? "two-sided" : alt === "greater" ? "larger" : "smaller"}")\nprint(power, n_needed)`,
        r: `power.t.test(n = ${n}, delta = ${effect}, sd = 1, sig.level = ${a}, type = "one.sample", alternative = "${tail === "two" ? "two.sided" : "one.sided"}")\npower.t.test(power = 0.8, delta = ${effect}, sd = 1, sig.level = ${a}, type = "one.sample", alternative = "${tail === "two" ? "two.sided" : "one.sided"}")`,
        julia: `using Distributions\n\nn, d, alpha = ${n}, ${effect}, ${a}\ndelta = d * sqrt(n)\nlo, hi = quantile(TDist(n - 1), ${lowQ}), quantile(TDist(n - 1), ${hiQ})\nalt = NoncentralT(n - 1, delta)\npower = ${power("cdf(alt, lo)", "ccdf(alt, hi)")}\nprintln((lo, hi, power))`,
        stata: `power onemean 0 ${effect}, sd(1) n(${n}) alpha(${a})${tail === "two" ? "" : " onesided"}\npower onemean 0 ${effect}, sd(1) power(0.8) alpha(${a})${tail === "two" ? "" : " onesided"}`,
      };
    }
    if (test === "chisq") {
      const df = n - 1;
      return {
        python: `from scipy.stats import chi2\n\ndf, rho, alpha = ${df}, ${effect}, ${a}\nlo, hi = chi2.ppf(${lowQ}, df), chi2.ppf(${hiQ}, df)\npower = ${power("chi2.cdf(lo / rho, df)", "chi2.sf(hi / rho, df)")}\nprint(lo, hi, power)`,
        r: `df <- ${df}; rho <- ${effect}; alpha <- ${a}\nlo <- qchisq(${lowQ}, df); hi <- qchisq(${hiQ}, df)\npower <- ${power("pchisq(lo / rho, df)", "1 - pchisq(hi / rho, df)")}\nc(lo, hi, power)`,
        julia: `using Distributions\n\ndf, rho, alpha = ${df}, ${effect}, ${a}\nlo, hi = quantile(Chisq(df), ${lowQ}), quantile(Chisq(df), ${hiQ})\npower = ${power("cdf(Chisq(df), lo / rho)", "ccdf(Chisq(df), hi / rho)")}\nprintln((lo, hi, power))`,
        stata: `* Critical values and power for the chi-square variance test\ndisplay invchi2(${df}, ${lowQ}), invchi2(${df}, ${hiQ})\ndisplay ${power(`chi2(${df}, invchi2(${df}, ${lowQ}) / ${effect})`, `1 - chi2(${df}, invchi2(${df}, ${hiQ}) / ${effect})`)}`,
      };
    }
    const d1 = n - 1; const d2 = n2 - 1;
    return {
      python: `from scipy.stats import f\n\nd1, d2, rho, alpha = ${d1}, ${d2}, ${effect}, ${a}\nlo, hi = f.ppf(${lowQ}, d1, d2), f.ppf(${hiQ}, d1, d2)\npower = ${power("f.cdf(lo / rho, d1, d2)", "f.sf(hi / rho, d1, d2)")}\nprint(lo, hi, power)`,
      r: `d1 <- ${d1}; d2 <- ${d2}; rho <- ${effect}; alpha <- ${a}\nlo <- qf(${lowQ}, d1, d2); hi <- qf(${hiQ}, d1, d2)\npower <- ${power("pf(lo / rho, d1, d2)", "1 - pf(hi / rho, d1, d2)")}\nc(lo, hi, power)`,
      julia: `using Distributions\n\nd1, d2, rho, alpha = ${d1}, ${d2}, ${effect}, ${a}\nlo, hi = quantile(FDist(d1, d2), ${lowQ}), quantile(FDist(d1, d2), ${hiQ})\npower = ${power("cdf(FDist(d1, d2), lo / rho)", "ccdf(FDist(d1, d2), hi / rho)")}\nprintln((lo, hi, power))`,
      stata: `display invF(${d1}, ${d2}, ${lowQ}), invF(${d1}, ${d2}, ${hiQ})\ndisplay ${power(`F(${d1}, ${d2}, invF(${d1}, ${d2}, ${lowQ}) / ${effect})`, `1 - F(${d1}, ${d2}, invF(${d1}, ${d2}, ${hiQ}) / ${effect})`)}`,
    };
  }
  function renderCode() {
    $("#dl-code-body").textContent = codeFor()[lang];
    $$("#dl-lang button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  }
  $("#dl-code-open").addEventListener("click", () => { renderCode(); if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); });
  $$("#dl-lang button").forEach((b) => b.addEventListener("click", () => { lang = b.dataset.lang; renderCode(); }));
  $("#dl-code-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#dl-code-body").textContent); $("#dl-code-msg").textContent = "Copied"; } catch { $("#dl-code-msg").textContent = "Select the code and copy it manually."; }
  });
  $("#dl-csv").addEventListener("click", () => {
    let csv = "";
    if (state.tab === "dept" && sim) {
      csv = `year,${scenario.events.map((e) => `${e.id}_model,${e.id}_truth`).join(",")}\n`;
      for (let y = 0; y < sim.years; y += 1) csv += `${y + 1},${scenario.events.map((_, i) => `${sim.model[i][y]},${sim.truth[i][y]}`).join(",")}\n`;
    } else if (state.tab === "build" && cLive.values.length) {
      csv = `draw,value\n${cLive.values.map((v, i) => `${i + 1},${v}`).join("\n")}\n`;
    } else if (live.n) {
      csv = `draw,value\n${Array.from(live.draws.subarray(0, live.n), (v, i) => `${i + 1},${v}`).join("\n")}\n`;
    } else { $("#dl-code-msg").textContent = "No draws or simulation to export yet."; return; }
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "distribution-lab-draws.csv"; a.click();
    URL.revokeObjectURL(url);
    $("#dl-code-msg").textContent = "Downloaded";
  });
  $("#dl-share").addEventListener("click", async () => {
    saveHash();
    await new Promise((r) => setTimeout(r, 300));
    try { await navigator.clipboard.writeText(location.href); status("Link copied. It restores the active section and its settings."); $("#dl-share").textContent = "Copied"; setTimeout(() => { $("#dl-share").textContent = "Copy link"; }, 1600); } catch { status("Copy the address bar to share this state."); }
  });

  // ------------------------------------------------------------------ start
  window.addEventListener("resize", frame(() => renderers[state.tab]?.()));
  showTab(panels[state.tab] ? state.tab : "bench");
  buildBenchControls();
  if (!Number.isFinite(B.a) || !Number.isFinite(B.b)) resetCalc();
  scheduleBench();
  void niceTicks; void tickLabel; void U;
}
