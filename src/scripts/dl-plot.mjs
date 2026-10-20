// Small canvas plotting kit for the distribution lab. Colors come from the page's design tokens.

export function niceTicks(lo, hi, target = 6) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

export function tickLabel(v, step) {
  const digits = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
  if (Math.abs(v) >= 1e6 || (v !== 0 && Math.abs(v) < 1e-4)) return v.toExponential(0);
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function readColors(root) {
  const cs = getComputedStyle(root);
  const get = (name) => cs.getPropertyValue(name).trim();
  return {
    ink: get("--ink"), muted: get("--ink-muted"), rule: get("--rule"), strong: get("--rule-strong"), surface: get("--surface-raised"),
    accent: get("--accent"), pink: get("--topic-teaching"), orange: get("--topic-place"), lime: get("--topic-measurement"),
    font: cs.fontFamily,
  };
}

export function createPlot(canvas, root, margin = {}) {
  const ctx = canvas.getContext("2d");
  const m = { l: 46, r: 14, t: 14, b: 32, ...margin };
  const plot = { canvas, ctx, m, w: 0, h: 0, x0: 0, x1: 1, y0: 0, y1: 1, c: readColors(root), onResize: null };

  plot.refreshColors = () => { plot.c = readColors(root); };
  plot.resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.round(r.width * dpr);
    const H = Math.round(r.height * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    plot.w = r.width;
    plot.h = r.height;
    return true;
  };
  plot.domain = (x0, x1, y0, y1) => { plot.x0 = x0; plot.x1 = x1; plot.y0 = y0; plot.y1 = y1; };
  plot.px = (v) => m.l + ((v - plot.x0) / (plot.x1 - plot.x0)) * (plot.w - m.l - m.r);
  plot.py = (v) => plot.h - m.b - ((v - plot.y0) / (plot.y1 - plot.y0)) * (plot.h - m.t - m.b);
  plot.invX = (px) => plot.x0 + ((px - m.l) / (plot.w - m.l - m.r)) * (plot.x1 - plot.x0);
  plot.clear = () => { ctx.clearRect(0, 0, plot.w, plot.h); };
  const font = (size, weight = 400) => { ctx.font = `${weight} ${size}px ${plot.c.font}`; };
  plot.font = font;

  plot.clip = () => { ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t - 2, plot.w - m.l - m.r, plot.h - m.t - m.b + 4); ctx.clip(); };
  plot.unclip = () => ctx.restore();

  plot.axes = ({ xTicks = true, yTicks = true, grid = true, xLabel = "", yLabel = "", yFormat } = {}) => {
    const { c } = plot;
    font(11);
    ctx.lineWidth = 1;
    const xs = niceTicks(plot.x0, plot.x1, Math.max(3, Math.floor(plot.w / 90)));
    const ys = niceTicks(plot.y0, plot.y1, 4);
    if (grid && yTicks) {
      ctx.strokeStyle = c.rule;
      ctx.beginPath();
      for (const v of ys) { const y = Math.round(plot.py(v)) + 0.5; ctx.moveTo(m.l, y); ctx.lineTo(plot.w - m.r, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = c.strong;
    ctx.beginPath();
    const base = Math.round(plot.py(plot.y0)) + 0.5;
    ctx.moveTo(m.l, base); ctx.lineTo(plot.w - m.r, base);
    ctx.stroke();
    ctx.fillStyle = c.muted;
    if (xTicks) {
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const step = xs.length > 1 ? xs[1] - xs[0] : 1;
      for (const v of xs) {
        const x = plot.px(v);
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, base); ctx.lineTo(Math.round(x) + 0.5, base + 4); ctx.stroke();
        ctx.fillText(tickLabel(v, step), x, base + 6);
      }
    }
    if (yTicks) {
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      const step = ys.length > 1 ? ys[1] - ys[0] : 1;
      for (const v of ys) ctx.fillText(yFormat ? yFormat(v) : tickLabel(v, step), m.l - 6, plot.py(v));
    }
    if (xLabel) { ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(xLabel, plot.w - m.r, plot.h - 1); }
    if (yLabel) { ctx.save(); ctx.translate(11, m.t + (plot.h - m.t - m.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(yLabel, 0, -3); ctx.restore(); }
  };

  plot.curvePoints = (fn, a = plot.x0, b = plot.x1, n = 360) => {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const x = a + ((b - a) * i) / n;
      const y = fn(x);
      pts.push([x, Number.isFinite(y) ? y : plot.y1 * 1.5]);
    }
    return pts;
  };

  plot.line = (pts, { color = plot.c.ink, width = 2, dash = null, alpha = 1 } = {}) => {
    ctx.save(); plot.clip();
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const X = plot.px(x); const Y = plot.py(y); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.stroke();
    plot.unclip(); ctx.restore();
  };

  plot.fillUnder = (pts, a, b, { color = plot.c.accent, alpha = 0.3 } = {}) => {
    const sel = pts.filter(([x]) => x >= a && x <= b);
    if (sel.length < 2) return;
    ctx.save(); plot.clip();
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(plot.px(sel[0][0]), plot.py(0));
    sel.forEach(([x, y]) => ctx.lineTo(plot.px(x), plot.py(y)));
    ctx.lineTo(plot.px(sel[sel.length - 1][0]), plot.py(0));
    ctx.closePath(); ctx.fill();
    plot.unclip(); ctx.restore();
  };

  plot.bars = (bars, { color = plot.c.pink, alpha = 0.5, stroke = true } = {}) => {
    ctx.save(); plot.clip();
    for (const { x0, x1, h, tint } of bars) {
      const X0 = plot.px(x0); const X1 = plot.px(x1); const Y = plot.py(h); const base = plot.py(0);
      ctx.globalAlpha = alpha; ctx.fillStyle = tint ?? color;
      ctx.fillRect(X0, Y, Math.max(1, X1 - X0 - 1), base - Y);
      if (stroke) { ctx.globalAlpha = Math.min(1, alpha + 0.3); ctx.strokeStyle = tint ?? color; ctx.lineWidth = 1; ctx.strokeRect(X0 + 0.5, Y + 0.5, Math.max(1, X1 - X0 - 2), Math.max(0, base - Y - 1)); }
    }
    plot.unclip(); ctx.restore();
  };

  plot.vline = (x, { color = plot.c.ink, width = 1.5, dash = null, label = "", top = true } = {}) => {
    const X = Math.round(plot.px(x)) + 0.5;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(X, m.t); ctx.lineTo(X, plot.h - m.b); ctx.stroke();
    ctx.setLineDash([]);
    if (label) { font(11, 600); ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = top ? "bottom" : "top"; ctx.fillText(label, X, top ? m.t - 1 : plot.h - m.b + 14); }
    ctx.restore();
  };

  plot.handle = (x, { color = plot.c.ink } = {}) => {
    const X = plot.px(x); const Y = plot.py(plot.y0);
    ctx.save();
    ctx.fillStyle = plot.c.surface; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  plot.text = (str, x, y, { color = plot.c.muted, align = "left", baseline = "top", size = 11, weight = 400 } = {}) => {
    font(size, weight);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  };

  plot.dots = (xs, y, { color = plot.c.ink, r = 3.5, alpha = 0.9 } = {}) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (const x of xs) { ctx.beginPath(); ctx.arc(plot.px(x), plot.py(y), r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { if (plot.resize() && plot.onResize) plot.onResize(); }).observe(canvas);
  }
  plot.resize();
  return plot;
}

/** Density-scaled histogram of continuous draws over [a, b]. */
export function histogram(values, a, b, bins) {
  const counts = new Array(bins).fill(0);
  const width = (b - a) / bins;
  for (const v of values) {
    if (v < a || v >= b) continue;
    counts[Math.min(bins - 1, Math.floor((v - a) / width))] += 1;
  }
  const n = values.length || 1;
  return counts.map((c, i) => ({ x0: a + i * width, x1: a + (i + 1) * width, h: c / (n * width), count: c }));
}

/** Relative frequency of integer draws. */
export function tally(values, lo, hi) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const n = values.length || 1;
  const out = [];
  for (let k = lo; k <= hi; k += 1) out.push({ x0: k - 0.4, x1: k + 0.4, h: (counts.get(k) ?? 0) / n, count: counts.get(k) ?? 0 });
  return out;
}
