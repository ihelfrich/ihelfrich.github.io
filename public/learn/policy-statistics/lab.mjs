import {
  groupedCounts,
  groupedSummary,
  villageData,
  villageValues,
  villageFrequencies,
  summarize,
  simpsonRates,
} from "./stats.mjs";
const $ = (s) => document.querySelector(s),
  stage = $("#stage"),
  controls = $("#controls"),
  metrics = $("#metrics");
const colors = {
  blue: "#435cd5",
  orange: "#ba481a",
  green: "#167654",
  light: "#dce4ff",
  muted: "#58647b",
  line: "#d8dfec",
};
const fmt = (v, d = 2) =>
  v === null
    ? "—"
    : v.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
const presets = [
  ["Lecture", [...groupedCounts]],
  ["Bell", [1, 4, 12, 26, 44, 56, 56, 44, 26, 12, 4, 1]],
  ["Flat", Array(12).fill(30)],
  ["Right tail", [8, 50, 60, 45, 30, 20, 13, 8, 5, 3, 2, 1]],
  ["Left tail", [1, 2, 3, 5, 8, 13, 20, 30, 45, 60, 50, 8]],
  ["Two peaks", [3, 18, 48, 56, 25, 6, 6, 25, 56, 48, 18, 3]],
];
const defaults = () => ({
  shapes: { choice: 0, counts: [...groupedCounts], selected: 0, edited: false },
  outlier: { value: 6000 },
  median: { pairs: 0, selected: -1 },
  spread: { scale: 1 },
  simpson: { a: 90, b: 10 },
});
let state = defaults(),
  active = ["shapes", "outlier", "median", "spread", "simpson"].includes(
    location.hash.slice(1),
  )
    ? location.hash.slice(1)
    : "shapes";
const activities = {
  shapes: {
    title: "Give the data a shape.",
    source: "Lecture histogram · 245 villages to start",
    challenge:
      "Draw a long right tail with your finger or mouse. Which side should have the short bars?",
    next: "Choose Flat. Turn it into two peaks. Can you make the mean sit in a valley?",
    why: "<p>The tall bars show where observations pile up. The tail is the side where a few observations stretch away from the pile.</p><p>A right tail points toward larger values, even though most observations may be on the left.</p>",
    note: "Drag across the chart to sculpt it. You can also select a bin and move its count slider. Estimates treat each bin’s observations as grouped data.",
  },
  outlier: {
    title: "One village can pull the mean.",
    source: "Lecture exercise · All 230 villages",
    challenge:
      "Before you move it: will bringing the 6,000-person village closer change the mean, the median, or both?",
    next: "Slide it from 6,000 to 600 and back. Watch the magnified center. Explain why the green marker stays put.",
    why: "<p>The mean shares the total population equally across 230 villages. Changing one village changes that total.</p><p>The median depends on the two middle positions. Both still contain 450 people, so the median stays at 450.</p>",
    note: "The large chart keeps the same scale as you move. The ruler below magnifies the center. Only one village changes; the number of villages stays at 230.",
  },
  median: {
    title: "Meet in the middle.",
    source: "Lecture exercise · 230 villages in order",
    challenge:
      "Cross off one village from the small end and one from the large end. Keep going. Where do the two sides meet?",
    next: "Tap a square to see its population. Why are there two middle villages instead of one?",
    why: "<p>There are 230 observations: an even number. After crossing off 114 from each end, positions 115 and 116 remain.</p><p>Both have 450 people. Their average is 450, the median of the original 230 villages.</p>",
    note: "Read left to right, then continue on the next row. Each square is one village, not one person. Crossing off is a counting trick; it does not change the dataset.",
  },
  spread: {
    title: "Same center. Different spread.",
    source: "Illustrative data · Seven villages",
    challenge:
      "Stretch the villages apart without moving the center. If the distances double, what happens to variance? What happens to standard deviation?",
    next: "Pull the spread all the way to zero. Now try twice the original spread. Watch the blue squares grow.",
    why: "<p>Each blue square has area proportional to one squared distance from the mean. Variance averages those squared distances.</p><p>Double every distance: variance becomes four times as large. Standard deviation becomes twice as large, returning to the original units.</p>",
    note: "These seven villages are an illustration, not the lecture exercise. Every village has equal weight. All displayed variances use the population denominator.",
  },
  simpson: {
    title: "Change the mix. Flip the headline.",
    source: "Illustrative admissions · 100 applicants per group",
    challenge:
      "Group B has the higher admission rate in both departments. How can Group A have the higher overall rate?",
    next: "Send 50% of each group to the easier department. Then restore the uneven mix. Which rates change?",
    why: "<p>Overall rates are weighted averages. A group applying mostly to the easier department can have the higher overall rate even while its rate is lower in each department.</p><p>This is Simpson’s paradox. The aggregate comparison and the department comparisons answer different questions.</p>",
    note: "Illustrative rates, not historical Berkeley data. Within-department rates stay fixed. Department choices alone do not establish whether a real admissions process is fair.",
  },
};
function metric(label, value, unit = "", cls = "") {
  return `<div class="metric ${cls}"><span>${label}</span><strong>${value}</strong>${unit ? `<small>${unit}</small>` : ""}</div>`;
}
function svg(id, h, interactive = false) {
  return `<svg id="${id}" class="figure ${interactive ? "interactive" : ""}" height="${h}" role="img"></svg>`;
}
function text(x, y, s, anchor = "start", fill = "") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}"${fill ? ` style="fill:${fill}"` : ""}>${s}</text>`;
}
function line(x1, y1, x2, y2, c = colors.line, dash = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}
function setupChart(el, h, domain, ymax) {
  const w = Math.max(260, stage.clientWidth),
    left = 54,
    right = w - 18,
    top = 28,
    bottom = h - 46;
  el.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const x = (v) =>
      left + ((v - domain[0]) / (domain[1] - domain[0])) * (right - left),
    y = (v) => bottom - (v / ymax) * (bottom - top);
  return { w, h, left, right, top, bottom, x, y };
}
function axes(c, xticks, yticks, xlabel, ylabel) {
  let s = `<rect x="${c.left}" y="${c.top}" width="${c.right - c.left}" height="${c.bottom - c.top}" fill="none" stroke="${colors.line}"/>`;
  yticks.forEach((v) => {
    s +=
      line(c.left, c.y(v), c.right, c.y(v)) +
      text(c.left - 9, c.y(v) + 4, fmt(v, 0), "end");
  });
  xticks.forEach((v) => {
    s +=
      line(c.x(v), c.bottom, c.x(v), c.bottom + 5) +
      text(c.x(v), c.bottom + 20, fmt(v, 0), "middle");
  });
  return (
    s +
    `<text class="axis-label" x="${(c.left + c.right) / 2}" y="${c.h - 5}" text-anchor="middle">${xlabel}</text><text class="axis-label" transform="translate(13,${(c.top + c.bottom) / 2}) rotate(-90)" text-anchor="middle">${ylabel}</text>`
  );
}
function bindRange(id, callback) {
  $(id).addEventListener("input", (e) => {
    callback(+e.target.value);
    draw();
  });
}
function begin() {
  const a = activities[active];
  $("#activity-title").textContent = a.title;
  $("#provenance").textContent = a.source;
  $("#challenge").textContent = a.challenge;
  $("#next-challenge").textContent = a.next;
  $("#explanation").innerHTML = a.why;
  $("#explanation").hidden = true;
  $("#explain").setAttribute("aria-expanded", "false");
  $("#explain").textContent = "Show me why";
  $("#activity-note").textContent = a.note;
  document
    .querySelectorAll("[data-activity]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.activity === active)),
    );
  $("#next-activity").innerHTML =
    active === "simpson"
      ? 'Back to shapes <span aria-hidden="true">↻</span>'
      : 'Next activity <span aria-hidden="true">→</span>';
  controls.innerHTML = "";
  stage.innerHTML = "";
  metrics.innerHTML = "";
  $("#math-content").innerHTML = "";
  if (active === "shapes") initShapes();
  if (active === "outlier") initOutlier();
  if (active === "median") initMedian();
  if (active === "spread") initSpread();
  if (active === "simpson") initSimpson();
  draw();
}
function initShapes() {
  const s = state.shapes;
  controls.innerHTML =
    '<div class="presets">' +
    presets
      .map(
        ([name, counts], i) =>
          `<button type="button" class="preset" data-preset="${i}" aria-pressed="${s.choice === i}"><svg viewBox="0 0 60 25" aria-hidden="true">${counts.map((v, j) => `<rect x="${(j * 60) / counts.length}" y="${25 - (v / 70) * 25}" width="${60 / counts.length - 1}" height="${(v / 70) * 25}" fill="${colors.blue}"/>`).join("")}</svg>${name}</button>`,
      )
      .join("") +
    '</div><div class="control-row"><label for="bin-select">Bin</label><select id="bin-select" aria-label="Choose a histogram bin"></select><label for="bin-count">Count</label><input id="bin-count" type="range" min="0" max="70" step="1"><output id="bin-count-value"></output></div>';
  stage.innerHTML = svg("shape-chart", 310, true);
  controls.querySelectorAll("[data-preset]").forEach(
    (b) =>
      (b.onclick = () => {
        s.choice = +b.dataset.preset;
        s.counts = [...presets[s.choice][1]];
        s.selected = 0;
        s.edited = false;
        begin();
      }),
  );
  bindRange("#bin-count", (v) => {
    s.counts[s.selected] = v;
    s.edited = true;
  });
  $("#bin-select").onchange = (e) => {
    s.selected = +e.target.value;
    draw();
  };
  let down = false;
  const chart = $("#shape-chart");
  function paint(e) {
    const c = shapeCoords,
      b = chart.getBoundingClientRect(),
      px = ((e.clientX - b.left) * c.w) / b.width,
      py = ((e.clientY - b.top) * c.h) / b.height;
    if (px < c.left || px > c.right) return;
    s.selected = Math.min(
      s.counts.length - 1,
      Math.max(
        0,
        Math.floor(((px - c.left) / (c.right - c.left)) * s.counts.length),
      ),
    );
    s.counts[s.selected] = Math.max(
      0,
      Math.min(70, Math.round(((c.bottom - py) / (c.bottom - c.top)) * 70)),
    );
    s.edited = true;
    drawShapes();
  }
  chart.onpointerdown = (e) => {
    down = true;
    chart.setPointerCapture(e.pointerId);
    paint(e);
  };
  chart.onpointermove = (e) => {
    if (down) paint(e);
  };
  chart.onpointerup = chart.onpointercancel = () => (down = false);
}
let shapeCoords;
function drawShapes() {
  const s = state.shapes,
    lecture = s.choice === 0,
    start = lecture ? 250 : 0,
    width = lecture ? 25 : 1,
    end = start + s.counts.length * width,
    chart = $("#shape-chart"),
    c = (shapeCoords = setupChart(chart, 310, [start, end], 70));
  const tickStep =
      c.w < 420
        ? Math.ceil(s.counts.length / 3)
        : Math.ceil(s.counts.length / 6),
    ticks = s.counts
      .map((_, i) => start + i * width)
      .filter((_, i) => i % tickStep === 0);
  let out = axes(
    c,
    ticks,
    [0, 20, 40, 60],
    lecture ? "Village population (people)" : "Value (illustrative units)",
    lecture ? "Number of villages" : "Frequency",
  );
  const barwidth = (c.right - c.left) / s.counts.length;
  s.counts.forEach((v, i) => {
    const x = c.x(start + i * width);
    out += `<rect x="${x + 1}" y="${c.y(v)}" width="${barwidth - 2}" height="${c.bottom - c.y(v)}" fill="${i === s.selected ? "#7957af" : colors.blue}"/>`;
    if (c.w > 450 || s.counts.length <= 7)
      out += text(x + barwidth / 2, c.y(v) - 7, v, "middle");
  });
  chart.innerHTML = out;
  chart.setAttribute("aria-label", "Histogram counts: " + s.counts.join(", "));
  const q = groupedSummary(s.counts, start, width),
    bins = s.counts.map((_, i) => [start + i * width, start + (i + 1) * width]);
  $("#bin-select").innerHTML = bins
    .map(
      ([a, b], i) =>
        `<option value="${i}" ${s.selected === i ? "selected" : ""}>${a}–${b}</option>`,
    )
    .join("");
  $("#bin-count").value = s.counts[s.selected];
  $("#bin-count-value").textContent = s.counts[s.selected];
  metrics.innerHTML =
    metric("Observations", q.n) +
    metric(
      "Mean ≈",
      fmt(q.mean),
      lecture ? "people · midpoint estimate" : "midpoint estimate",
      "mean",
    ) +
    metric("Median ≈", fmt(q.median), "within-bin estimate", "median") +
    metric(
      "Standard deviation ≈",
      fmt(q.sd),
      lecture ? "people" : "illustrative units",
    );
  $("#provenance").textContent = s.edited
    ? "Your edited histogram"
    : lecture
      ? "Lecture histogram · Original grouped counts"
      : "Illustrative shape · " + presets[s.choice][0];
  const mode =
    q.modalBins.length === bins.length
      ? "All bins are tied"
      : q.modalBins.map((b) => b.join("–")).join(", ");
  $("#math-content").innerHTML =
    `<p>Mean: multiply each bin midpoint by its count, add those products, and divide by ${q.n}. The median estimate assumes observations are spread evenly within the median bin. Exact individual values cannot be recovered from the histogram.</p><p>Median bin: <strong>${q.medianBin ? q.medianBin.join("–") : "none"}</strong>. Modal bin(s): <strong>${q.n ? mode : "none"}</strong>. Population variance ≈ <strong>${fmt(q.variance)}</strong> ${lecture ? "people²" : "units²"}.</p><div class="table-wrap"><table><thead><tr><th>Bin</th><th>Count</th><th>Midpoint</th></tr></thead><tbody>${bins.map(([a, b], i) => `<tr><td>${a}–${b}</td><td>${s.counts[i]}</td><td>${(a + b) / 2}</td></tr>`).join("")}</tbody></table></div>`;
}
function initOutlier() {
  controls.innerHTML =
    '<div class="control-row"><label for="outlier-value">Large village</label><input id="outlier-value" type="range" min="600" max="6000" step="25"><output id="outlier-output"></output></div>';
  stage.innerHTML = svg("outlier-chart", 230, true) + svg("center-chart", 150);
  bindRange("#outlier-value", (v) => (state.outlier.value = v));
  let down = false;
  const el = $("#outlier-chart");
  function move(e) {
    const r = el.getBoundingClientRect(),
      c = outlierCoords,
      x = ((e.clientX - r.left) * c.w) / r.width;
    state.outlier.value = Math.max(
      600,
      Math.min(
        6000,
        Math.round((100 + ((x - c.left) / (c.right - c.left)) * 6100) / 25) *
          25,
      ),
    );
    drawOutlier();
  }
  el.onpointerdown = (e) => {
    down = true;
    el.setPointerCapture(e.pointerId);
    move(e);
  };
  el.onpointermove = (e) => {
    if (down) move(e);
  };
  el.onpointerup = el.onpointercancel = () => (down = false);
}
let outlierCoords;
function drawOutlier() {
  const value = state.outlier.value,
    d = villageData(value),
    q = summarize(d),
    el = $("#outlier-chart"),
    c = (outlierCoords = setupChart(el, 230, [100, 6200], 90)),
    bins = Array(61).fill(0);
  d.forEach((v) => bins[Math.floor((v - 200) / 100)]++);
  let out = axes(
    c,
    c.w < 420 ? [1000, 3000, 6000] : [1000, 2000, 3000, 4000, 5000, 6000],
    [0, 40, 80],
    "Village population (people)",
    "Villages",
  );
  bins.forEach((v, i) => {
    if (v)
      out += `<rect x="${c.x(200 + i * 100)}" y="${c.y(v)}" width="${Math.max(1, c.x(300 + i * 100) - c.x(200 + i * 100) - 0.5)}" height="${c.bottom - c.y(v)}" fill="${i === Math.floor((value - 200) / 100) && value >= 700 ? colors.orange : colors.blue}"/>`;
  });
  out +=
    line(c.x(value), c.top + 9, c.x(value), c.bottom, colors.orange, "3 4") +
    `<circle cx="${c.x(value)}" cy="${c.top + 9}" r="9" fill="${colors.orange}"/><circle cx="${c.x(value)}" cy="${c.top + 9}" r="23" fill="transparent"/>`;
  el.innerHTML = out;
  el.setAttribute(
    "aria-label",
    `230 villages. Largest village ${value}. Mean ${fmt(q.mean)}. Median 450.`,
  );
  const ruler = $("#center-chart"),
    rc = setupChart(ruler, 150, [395, 455], 1);
  let r =
    line(rc.left, 105, rc.right, 105) + text(rc.left, 18, "Center, magnified");
  [400, 420, 440].forEach(
    (v) =>
      (r += line(rc.x(v), 105, rc.x(v), 110) + text(rc.x(v), 125, v, "middle")),
  );
  [
    [q.mean, colors.orange, 43, "Mean"],
    [450, colors.green, 76, "Median"],
  ].forEach(([v, color, y, label]) => {
    r +=
      line(rc.x(v), y, rc.x(v), 105, color, "3 3") +
      `<circle cx="${rc.x(v)}" cy="${y}" r="7" fill="${color}"/>` +
      text(rc.x(v), y - 13, label, "middle", color);
  });
  r += text(
    (rc.left + rc.right) / 2,
    146,
    "Village population (people)",
    "middle",
  );
  ruler.innerHTML = r;
  ruler.setAttribute(
    "aria-label",
    `Magnified center: mean ${fmt(q.mean)}, median 450.`,
  );
  $("#outlier-value").value = value;
  $("#outlier-output").textContent = fmt(value, 0);
  $("#provenance").textContent =
    value === 6000
      ? "Lecture exercise · All 230 villages"
      : "What-if data · Only one village changed";
  metrics.innerHTML =
    metric("Mean", fmt(q.mean), "people", "mean") +
    metric("Median", 450, "people", "median") +
    metric("Standard deviation", fmt(q.sd), "people");
  $("#math-content").innerHTML =
    `<p>Total population: ${fmt(q.total, 0)} people. Mean = ${fmt(q.total, 0)} ÷ 230 = ${fmt(q.mean)}. Median = (450 + 450) ÷ 2 = 450.</p><p>Population variance = sum of squared distances from the mean ÷ 230 = ${fmt(q.variance)} people². Standard deviation = square root of variance = ${fmt(q.sd)} people.</p><p>A long right tail does not guarantee that the mean exceeds the median. The original data are a counterexample: 423.48 is below 450.</p>${villageTable(value)}`;
}
function villageTable(value = 6000) {
  return `<div class="table-wrap"><table><thead><tr><th>Population</th><th>Villages</th><th>Cumulative</th></tr></thead><tbody>${villageValues.map((v, i) => `<tr><td>${fmt(i === 9 ? value : v, 0)}</td><td>${villageFrequencies[i]}</td><td>${villageFrequencies.slice(0, i + 1).reduce((a, b) => a + b, 0)}</td></tr>`).join("")}</tbody></table></div>`;
}
function initMedian() {
  controls.innerHTML =
    '<div class="pair-actions"><button class="small-button" type="button" data-pairs="1">Cross off 1 pair</button><button class="small-button" type="button" data-pairs="10">Cross off 10 pairs</button></div><div class="control-row"><label for="pairs-value">Pairs crossed off</label><input id="pairs-value" type="range" min="0" max="114" step="1"><output id="pairs-output"></output></div>';
  stage.innerHTML =
    svg("median-chart", 350) +
    '<div id="median-status" class="status-line" aria-live="polite"></div>';
  bindRange("#pairs-value", (v) => {
    state.median.pairs = v;
    state.median.selected = -1;
  });
  controls.querySelectorAll("[data-pairs]").forEach(
    (b) =>
      (b.onclick = () => {
        state.median.pairs = Math.min(
          114,
          state.median.pairs + +b.dataset.pairs,
        );
        state.median.selected = -1;
        draw();
      }),
  );
  $("#median-chart").onclick = (e) => {
    const c = medianCoords,
      r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) * c.w) / r.width,
      y = ((e.clientY - r.top) * c.h) / r.height,
      col = Math.floor((x - c.left) / c.cell),
      row = Math.floor((y - 18) / c.cell),
      i = row * c.cols + col;
    if (col >= 0 && col < c.cols && row >= 0 && i < 230) {
      state.median.selected = i;
      drawMedian();
    }
  };
}
let medianCoords;
function drawMedian() {
  const s = state.median,
    d = villageData(),
    w = Math.max(260, stage.clientWidth),
    cols = w < 440 ? 10 : 23,
    left = 34,
    cell = (w - left - 4) / cols,
    rows = Math.ceil(230 / cols),
    h = rows * cell + 25;
  medianCoords = { w, h, cols, left, cell };
  const el = $("#median-chart");
  el.setAttribute("viewBox", `0 0 ${w} ${h}`);
  el.setAttribute("height", h);
  let out = "";
  for (let row = 0; row < rows; row++)
    out += text(left - 7, 18 + row * cell + cell * 0.66, 1 + row * cols, "end");
  d.forEach((v, i) => {
    const crossed = i < s.pairs || i >= 230 - s.pairs,
      x = left + (i % cols) * cell,
      y = 18 + Math.floor(i / cols) * cell,
      size = cell - 3,
      middle = s.pairs === 114 && !crossed;
    out += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${middle ? colors.green : colors.blue}" opacity="${crossed ? 0.13 : 1}" ${s.selected === i ? 'stroke="#202d49" stroke-width="2"' : ""}><title>Position ${i + 1}: ${fmt(v, 0)} people</title></rect>`;
    if (crossed)
      out += `<path d="M${x + 3} ${y + 3}l${size - 6} ${size - 6}m0 -${size - 6}l-${size - 6} ${size - 6}" stroke="${colors.muted}" opacity=".4" fill="none"/>`;
  });
  el.innerHTML = out;
  el.setAttribute(
    "aria-label",
    `Sorted village grid. ${230 - 2 * s.pairs} remain after crossing off ${s.pairs} pairs.`,
  );
  $("#pairs-value").value = s.pairs;
  $("#pairs-output").textContent = s.pairs + " / 114";
  controls
    .querySelectorAll("[data-pairs]")
    .forEach((b) => (b.disabled = s.pairs === 114));
  const status = $("#median-status");
  status.className = s.pairs === 114 ? "center-answer" : "status-line";
  status.textContent =
    s.selected >= 0
      ? `Position ${s.selected + 1}: ${fmt(d[s.selected], 0)} people`
      : s.pairs === 114
        ? "450 + 450, divided by 2. The median is 450."
        : `${230 - 2 * s.pairs} villages remain. Ends: ${fmt(d[s.pairs], 0)} and ${fmt(d[229 - s.pairs], 0)} people.`;
  metrics.innerHTML =
    metric("Starting villages", 230) +
    metric("Crossed off", s.pairs * 2) +
    metric("Still visible", 230 - s.pairs * 2);
  $("#math-content").innerHTML =
    "<p>For 230 sorted observations, the two middle positions are 230 ÷ 2 = 115 and 116. The cumulative counts reach 100 at population 300, and 150 at population 450. Both middle positions therefore have population 450.</p>" +
    villageTable();
}
function initSpread() {
  controls.innerHTML =
    '<div class="control-row"><label for="spread-value">Stretch factor</label><input id="spread-value" type="range" min="0" max="3" step="0.25"><output id="spread-output"></output></div>';
  stage.innerHTML =
    svg("spread-chart", 260) +
    '<div class="status-line">Squared distances from the mean</div><div id="squares" class="square-row"></div>';
  bindRange("#spread-value", (v) => (state.spread.scale = v));
}
function drawSpread() {
  const k = state.spread.scale,
    d = [-75, -50, -25, 0, 25, 50, 75].map((v) => 325 + v * k),
    q = summarize(d),
    el = $("#spread-chart"),
    c = setupChart(el, 260, [75, 575], 1);
  let out = "";
  [100, 250, 400, 550].forEach(
    (v) =>
      (out +=
        line(c.x(v), c.bottom, c.x(v), c.bottom + 5) +
        text(c.x(v), c.bottom + 20, v, "middle")),
  );
  out +=
    line(c.left, c.bottom, c.right, c.bottom) +
    line(c.x(325), c.top, c.x(325), c.bottom, colors.orange, "3 3") +
    text(c.x(325), 16, "Mean stays at 325", "middle", colors.orange);
  d.forEach((v, i) => {
    const y = 40 + i * 24;
    out +=
      line(c.x(325), y, c.x(v), y, colors.blue) +
      `<circle cx="${c.x(v)}" cy="${y}" r="6" fill="${colors.blue}"/>`;
    out += text(
      c.x(v) + (v < 325 || c.x(v) > c.right - 45 ? -11 : 11),
      y + 4,
      fmt(v, v % 1 ? 2 : 0),
      v < 325 || c.x(v) > c.right - 45 ? "end" : "start",
    );
  });
  out += text(
    (c.left + c.right) / 2,
    256,
    "Village population (people)",
    "middle",
  );
  el.innerHTML = out;
  el.setAttribute(
    "aria-label",
    `Seven illustrative villages. Mean 325. Stretch ${k}. Standard deviation ${fmt(q.sd)}. Variance ${fmt(q.variance)}.`,
  );
  const maxSide = Math.min(75, (stage.clientWidth - 42) / 7);
  $("#squares").innerHTML = d
    .map((v) => {
      const delta = v - 325,
        side = (Math.abs(delta) / 225) * maxSide;
      return `<div class="square-cell"><div class="box-slot"><div class="square" style="width:${side}px;height:${side}px;${side === 0 ? "border:0" : ""}"></div></div><span>${fmt(delta * delta, (delta * delta) % 1 ? 1 : 0)}</span></div>`;
    })
    .join("");
  $("#spread-value").value = k;
  $("#spread-output").textContent = fmt(k, k % 1 ? 2 : 0) + "×";
  metrics.innerHTML =
    metric("Mean", 325, "people", "mean") +
    metric("Variance", fmt(q.variance), "people²") +
    metric("Standard deviation", fmt(q.sd), "people");
  $("#math-content").innerHTML =
    `<p>Seven illustrative populations: ${d.map((v) => fmt(v, v % 1 ? 2 : 0)).join(", ")}.</p><p>Distances from the mean: ${d.map((v) => fmt(v - 325, (v - 325) % 1 ? 2 : 0)).join(", ")}. Their signed sum is zero. Squaring prevents cancellation.</p><p>Variance = (${d.map((v) => fmt((v - 325) ** 2, (v - 325) ** 2 % 1 ? 2 : 0)).join(" + ")}) ÷ 7 = ${fmt(q.variance)} people².</p><p>Standard deviation = √${fmt(q.variance)} = ${fmt(q.sd)} people. The blue squares use a fixed area scale as you stretch.</p>`;
}
function initSimpson() {
  controls.innerHTML =
    '<div class="control-row"><label for="mix-a">Group A → easier department</label><input id="mix-a" type="range" min="0" max="100" step="10"><output id="mix-a-output"></output></div><div class="control-row"><label for="mix-b">Group B → easier department</label><input id="mix-b" type="range" min="0" max="100" step="10"><output id="mix-b-output"></output></div>';
  stage.innerHTML =
    '<div class="key"><span><i style="background:#435cd5"></i>Easier department</span><span><i style="background:#7957af"></i>Harder department</span></div><div id="mix-strips"></div><div id="rate-facets" class="rate-facets"></div><div id="simpson-status" class="status-line" aria-live="polite"></div>';
  bindRange("#mix-a", (v) => (state.simpson.a = v));
  bindRange("#mix-b", (v) => (state.simpson.b = v));
}
function drawSimpson() {
  const s = state.simpson,
    q = simpsonRates(s.a, s.b);
  $("#mix-a").value = s.a;
  $("#mix-b").value = s.b;
  $("#mix-a-output").textContent = s.a + "%";
  $("#mix-b-output").textContent = s.b + "%";
  $("#mix-strips").innerHTML = [
    ["A", s.a],
    ["B", s.b],
  ]
    .map(
      ([name, v]) =>
        `<div class="mix-label">Group ${name}: ${v} easier / ${100 - v} harder</div><div class="mix-strip" role="img" aria-label="Group ${name}: ${v} applicants to easier, ${100 - v} to harder"><span style="width:${v}%;background:#435cd5">${v >= 20 ? v : ""}</span><span style="width:${100 - v}%;background:#7957af">${v <= 80 ? 100 - v : ""}</span></div>`,
    )
    .join("");
  const row = (name, v, c) =>
    `<div class="rate-row"><span>Group ${name} · ${fmt(v, v % 1 ? 1 : 0)}%</span><div class="rate-track"><div class="rate-fill" style="width:${v}%;background:${c}"></div></div></div>`;
  $("#rate-facets").innerHTML = [
    ["Easier", 80, 90],
    ["Harder", 10, 20],
    ["Overall", q.a, q.b],
  ]
    .map(
      ([name, a, b]) =>
        `<div class="rate-facet"><h4>${name}</h4>${row("A", a, colors.orange)}${row("B", b, colors.green)}</div>`,
    )
    .join("");
  $("#simpson-status").textContent =
    q.a > q.b
      ? "The reversal: A leads overall. B still leads in both departments."
      : q.a === q.b
        ? "An overall tie, even though B has higher rates in both departments."
        : "B leads overall and in both departments.";
  metrics.innerHTML =
    metric(
      "Group A overall",
      fmt(q.a, q.a % 1 ? 1 : 0) + "%",
      "admission rate",
      "mean",
    ) +
    metric(
      "Group B overall",
      fmt(q.b, q.b % 1 ? 1 : 0) + "%",
      "admission rate",
      "median",
    );
  $("#math-content").innerHTML =
    `<p>Group A: ${s.a}% × 80% + ${100 - s.a}% × 10% = ${fmt(q.a)}%.</p><p>Group B: ${s.b}% × 90% + ${100 - s.b}% × 20% = ${fmt(q.b)}%.</p><p>Each group has 100 applicants. The fixed within-department rates are model assumptions for this illustration. When no one from a group applies to a department, that department’s displayed rate is the assumed rate, not an observed sample rate.</p><p>Changing who applies where changes the weights. It does not change the assumed department-specific admission rates.</p>`;
}
function draw() {
  if (active === "shapes") drawShapes();
  else if (active === "outlier") drawOutlier();
  else if (active === "median") drawMedian();
  else if (active === "spread") drawSpread();
  else drawSimpson();
}
function choose(name) {
  active = name;
  history.replaceState(null, "", "#" + name);
  begin();
}
document
  .querySelectorAll("[data-activity]")
  .forEach((b) => (b.onclick = () => choose(b.dataset.activity)));
$("#reset").onclick = () => {
  state[active] = defaults()[active];
  begin();
};
$("#explain").onclick = () => {
  const open = $("#explanation").hidden;
  $("#explanation").hidden = !open;
  $("#explain").setAttribute("aria-expanded", String(open));
  $("#explain").textContent = open ? "Hide explanation" : "Show me why";
};
$("#next-activity").onclick = () => {
  const order = Object.keys(activities);
  choose(order[(order.indexOf(active) + 1) % order.length]);
  $("#workspace").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
};
window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);
  if (activities[hash]) {
    active = hash;
    begin();
  }
});
new ResizeObserver(() => draw()).observe(stage);
begin();
