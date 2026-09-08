import { createCityScene } from "./city-scene.mjs";
import {
  walkingComparison,
  encodeCityState,
  decodeCityState,
} from "../../lib/city-analysis.mjs";
const $ = (id) => document.getElementById(id);
let city = null,
  data = null,
  mode = "explore",
  panelOpen = true,
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
  activeLayer = "city",
  aResult = null,
  bResult = null,
  places = [],
  origins = [],
  selectedDestination = null;
let toastTimer;
function notice(text) {
  $("notice").textContent = text;
  $("notice").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("notice").classList.remove("visible"), 4200);
}
function make(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}
function version() {
  return data?.source?.version || "unknown-snapshot";
}
function sourceUrl(id) {
  const p = id[0],
    n = id.slice(1).split(":")[0];
  return (
    "https://www.openstreetmap.org/" +
    ({ n: "node", w: "way", r: "relation" }[p] || "way") +
    "/" +
    n
  );
}
function state() {
  return {
    v: 1,
    data: version(),
    a: $("origin-a").value || null,
    b: $("origin-b").value || null,
    destination: selectedDestination,
    minutes: Number($("walk-minutes").value),
    light: Number($("sun-hour").value),
    layer: activeLayer,
  };
}
function setMode(next) {
  mode = next;
  for (const n of ["explore", "compare", "layers"])
    $(n + "-panel").hidden = n !== next;
  document.querySelectorAll("[data-mode]").forEach((b) => {
    const active = b.dataset.mode === next;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("panel-kicker").textContent = {
    explore: "THE RIVER CITY",
    compare: "PLACES & CONNECTIONS",
    layers: "ATMOSPHERE & GEOGRAPHY",
  }[next];
  if (!panelOpen) togglePanel();
  if (next === "compare") compare();
  else city?.clearRoutes();
}
function togglePanel() {
  panelOpen = !panelOpen;
  $("explorer").classList.toggle("collapsed", !panelOpen);
  $("collapse-panel").textContent = panelOpen ? "−" : "+";
  $("collapse-panel").setAttribute("aria-expanded", String(panelOpen));
  $("collapse-panel").setAttribute(
    "aria-label",
    panelOpen ? "Collapse explorer" : "Expand explorer",
  );
}
function selectBuilding(b) {
  $("building-details").hidden = false;
  const el = $("building-details");
  el.replaceChildren(make("h3", "", b.name || "Mapped building"));
  const dl = make("dl");
  const rows = [
    ["Height", `${Number(b.height.toFixed(1))} m`],
    [
      "Height basis",
      {
        tagged: "OSM height tag",
        levels: "Estimated from floors",
        default: "Visual default",
      }[b.heightSource] || "Visual default",
    ],
    ["Mapped use", b.kind || "Building"],
  ];
  if (b.levels > 0) rows.push(["Floors", String(b.levels)]);
  if (b.minHeight > 0) rows.push(["Base above ground", `${b.minHeight} m`]);
  for (const [k, v] of rows) {
    const d = make("div");
    d.append(make("dt", "", k), make("dd", "", v));
    dl.append(d);
  }
  el.append(dl);
  const link = make("a", "", `Inspect ${b.id} in OpenStreetMap ↗`);
  link.href = sourceUrl(b.id);
  link.target = "_blank";
  link.rel = "noopener";
  el.append(link);
  setMode("explore");
}
function showPlaces(query = "") {
  const list = $("place-list");
  list.replaceChildren();
  const q = query.trim().toLowerCase();
  let shown = q
    ? places.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 18)
    : places.slice(0, 6);
  if (q) {
    for (const b of data.buildings
      .filter((b) => b.name && b.name.toLowerCase().includes(q))
      .slice(0, 6))
      if (!shown.some((p) => p.id === b.id)) {
        const x = b.polygon.reduce((s, p) => s + p[0], 0) / b.polygon.length,
          z = b.polygon.reduce((s, p) => s + p[1], 0) / b.polygon.length;
        shown.push({ ...b, x, z, building: b });
      }
  }
  if (!shown.length) {
    list.append(
      make("p", "small-note", "No mapped place matches that search."),
    );
    return;
  }
  shown.forEach((p, i) => {
    const b = make("button", "place-button");
    b.append(make("span", "place-number", String(i + 1).padStart(2, "0")));
    const label = make("span", "", p.name);
    label.append(make("small", "", p.kind || "Mapped place"));
    b.append(label, make("span", "place-arrow", "↗"));
    b.addEventListener("click", () => {
      city?.flyTo(p.x, p.z, p.name === "Gateway Arch" ? 2.2 : 2.5);
      list
        .querySelectorAll("button")
        .forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      const building = p.building || data.buildings.find((b) => b.id === p.id);
      if (building) {
        city?.selectBuilding(building);
        selectBuilding(building);
      } else {
        $("building-details").hidden = false;
        $("building-details").replaceChildren(
          make("h3", "", p.name),
          make(
            "p",
            "small-note",
            `${p.kind || "Place"} · OpenStreetMap ${p.id}`,
          ),
        );
      }
    });
    list.append(b);
  });
}
function compare() {
  if (!data) return;
  const a = origins.find((p) => p.id === $("origin-a").value),
    b = origins.find((p) => p.id === $("origin-b").value);
  if (!a || !b) return;
  const seconds = Number($("walk-minutes").value) * 60;
  $("minutes-label").textContent = `${seconds / 60} min`;
  const destinations = places.filter(
    (p) =>
      ["park", "museum", "attraction"].includes(p.kind) &&
      p.id !== a.id &&
      p.id !== b.id,
  );
  aResult = walkingComparison(data.graph, a, destinations, seconds, 1.3);
  bResult = walkingComparison(data.graph, b, destinations, seconds, 1.3);
  const summary = $("comparison-summary"),
    counts = make("div", "compare-counts");
  summary.replaceChildren(counts);
  for (const [label, result, c] of [
    ["A", aResult, "#e3bc76"],
    ["B", bResult, "#a5bece"],
  ]) {
    const d = make("div"),
      strong = make("strong", "", String(result.reachable.length));
    strong.style.color = c;
    d.append(strong, make("small", "", `from ${label} · mapped places`));
    counts.append(d);
  }
  const destList = $("destination-list");
  destList.replaceChildren();
  const sorted = aResult.places
    .filter(
      (p) =>
        Number.isFinite(p.seconds) ||
        Number.isFinite(bResult.places.find((q) => q.id === p.id)?.seconds),
    )
    .sort(
      (p, q) =>
        Math.min(
          p.seconds,
          bResult.places.find((r) => r.id === p.id)?.seconds ?? Infinity,
        ) -
        Math.min(
          q.seconds,
          bResult.places.find((r) => r.id === q.id)?.seconds ?? Infinity,
        ),
    );
  sorted.slice(0, 12).forEach((p) => {
    const q = bResult.places.find((q) => q.id === p.id),
      button = make("button", "destination-row"),
      fmt = (t) => (Number.isFinite(t) ? `${Math.ceil(t / 60)}m` : "—");
    button.append(
      make("span", "", p.name),
      make("b", "", fmt(p.seconds)),
      make("b", "", fmt(q?.seconds)),
    );
    button.title = `Inspect walking routes to ${p.name}`;
    button.dataset.destination = p.id;
    button.addEventListener("click", () => {
      selectedDestination = p.id;
      drawRoutes();
      city?.flyTo((a.x + b.x + p.x) / 3, (a.z + b.z + p.z) / 3, 1.5);
    });
    destList.append(button);
  });
  if (!selectedDestination || !sorted.some((p) => p.id === selectedDestination))
    selectedDestination =
      sorted.find((p) => p.seconds > 60)?.id || sorted[0]?.id;
  drawRoutes();
}
function drawRoutes() {
  for (const button of document.querySelectorAll("#destination-list button")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.destination === selectedDestination),
    );
  }
  if (!city || !aResult || !bResult) return;
  city.clearRoutes();
  const a = origins.find((p) => p.id === $("origin-a").value),
    b = origins.find((p) => p.id === $("origin-b").value);
  city.pin(a.x, a.z, "#e3bc76");
  city.pin(b.x, b.z, "#a5bece");
  for (const [r, origin, color] of [
    [aResult, a, "#e3bc76"],
    [bResult, b, "#a5bece"],
  ]) {
    const p = r.places.find((p) => p.id === selectedDestination);
    if (!p?.path.length) continue;
    const pts = [
      [origin.x, origin.z],
      ...p.path.map((i) => data.graph.nodes[i]),
      [p.x, p.z],
    ];
    city.route(pts, color, 4);
    city.pin(p.x, p.z, "#e5e1cd");
  }
}
function setLayer(layer) {
  activeLayer = layer;
  $("show-city").setAttribute("aria-pressed", String(layer === "city"));
  $("show-network").setAttribute("aria-pressed", String(layer === "network"));
  city?.setNetwork(layer === "network");
  if (layer === "city") {
    city?.toggle("green", $("toggle-green").checked);
    city?.toggle("traffic", $("toggle-traffic").checked);
  }
}
function sunLabel(v) {
  return v < 9
    ? "Early morning"
    : v < 15
      ? "Daylight"
      : v < 19
        ? "Golden hour"
        : v < 21
          ? "Blue hour"
          : "Nightfall";
}
function updateLight() {
  const v = Number($("sun-hour").value);
  $("sun-label").textContent = sunLabel(v);
  city?.setLight(v);
}
function download(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function share() {
  const url = new URL(location.href);
  url.hash = encodeCityState(state());
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url.href);
    notice("Comparison link copied.");
  } catch {
    notice("The address bar now contains your comparison link.");
  }
}
function methods() {
  if (!$("methods-dialog").open) $("methods-dialog").showModal();
}
function setPause() {
  paused = !paused;
  $("pause-motion").textContent = paused ? "▷" : "Ⅱ";
  $("pause-motion").setAttribute(
    "aria-label",
    paused ? "Resume ambient motion" : "Pause ambient motion",
  );
  $("pause-motion").setAttribute("aria-pressed", String(paused));
  city?.setPaused(paused);
}
function showFallback(message) {
  $("loading").hidden = true;
  $("fallback").hidden = false;
  $("fallback-message").textContent = message;
}
async function openScene() {
  try {
    city = await createCityScene($("city-viewport"), data, {
      onSelect: selectBuilding,
      onReady() {
        $("loading").hidden = true;
        $("fallback").hidden = true;
        updateLight();
        setLayer(activeLayer);
        if (mode === "compare") drawRoutes();
      },
      onError: showFallback,
    });
  } catch (error) {
    console.error("City renderer:", error);
    showFallback(
      "The 3D scene could not start on this device. Place search and walking comparisons are still available.",
    );
  }
}
async function start() {
  try {
    const response = await fetch("/st-louis/city.json");
    if (!response.ok) throw new Error("The city snapshot could not be loaded.");
    data = await response.json();
    $("explorer").hidden = false;
    for (const id of ["origin-a", "origin-b"]) $(id).replaceChildren();
    $("source-statistics").replaceChildren();
    const seen = new Set();
    places = data.pois.filter(
      (p) => p.name && !seen.has(p.id) && seen.add(p.id),
    );
    const priorities = [
      "Gateway Arch",
      "Citygarden",
      "Old Courthouse",
      "Kiener Plaza",
      "Gateway Arch National Park",
      "Museum at the Gateway Arch",
    ];
    places.sort((a, b) => {
      const i = priorities.indexOf(a.name),
        j = priorities.indexOf(b.name);
      return (
        (i < 0 ? 100 : i) - (j < 0 ? 100 : j) || a.name.localeCompare(b.name)
      );
    });
    origins = places.filter((p) => Number.isInteger(p.nodeIndex));
    for (const id of ["origin-a", "origin-b"])
      for (const p of origins) $(id).append(new Option(p.name, p.id));
    $("origin-b").selectedIndex = Math.min(1, origins.length - 1);
    showPlaces();
    const stats = $("source-statistics");
    for (const [k, v] of [
      [
        "Snapshot",
        data.source?.osmSnapshotTimestamp?.slice(0, 10) || version(),
      ],
      ["Building objects", data.buildings.length.toLocaleString()],
      ["Walking network", `${data.graph.nodes.length.toLocaleString()} nodes`],
      ["Mapped places", places.length.toLocaleString()],
      ["Coordinates", "Local metres from 38.628° N, 90.193° W"],
    ]) {
      const row = make("div");
      row.append(make("dt", "", k), make("dd", "", v));
      stats.append(row);
    }
    const saved = decodeCityState(location.hash);
    if (saved) {
      if (saved.data !== version())
        notice(`This link used ${saved.data}; results use ${version()}.`);
      if (origins.some((p) => p.id === saved.a)) $("origin-a").value = saved.a;
      if (origins.some((p) => p.id === saved.b)) $("origin-b").value = saved.b;
      $("walk-minutes").value = saved.minutes;
      $("sun-hour").value = saved.light;
      activeLayer = saved.layer;
      selectedDestination = saved.destination || null;
      if (
        selectedDestination &&
        !places.some((p) => p.id === selectedDestination)
      ) {
        notice(
          "The saved destination is absent from this snapshot. Choose another destination.",
        );
        selectedDestination = null;
      }
      setMode("compare");
    }
    if (matchMedia("(max-width:650px)").matches && !saved && panelOpen)
      togglePanel();
    $("load-detail").textContent =
      `Placing ${data.buildings.length.toLocaleString()} mapped building objects`;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await openScene();
  } catch (error) {
    console.error("City data:", error);
    showFallback(
      "The city data could not be loaded. Please reload the page or return to the portfolio.",
    );
    $("explorer").hidden = true;
  }
}
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
$("collapse-panel").addEventListener("click", togglePanel);
$("place-search").addEventListener("input", (e) => showPlaces(e.target.value));
for (const id of ["origin-a", "origin-b", "walk-minutes"])
  $(id).addEventListener("input", compare);
$("share-comparison").addEventListener("click", share);
$("download-comparison").addEventListener("click", () =>
  download("st-louis-comparison.json", {
    state: state(),
    source: data.source,
    assumptions: {
      walkingSpeedMetresPerSecond: 1.3,
      entranceConnections:
        "Straight-line nearest-node links; not field verified",
      scope:
        "Mapped parks, museums and attractions in bounded downtown extract",
    },
    a: aResult?.places.map(({ path, ...p }) => p),
    b: bResult?.places.map(({ path, ...p }) => p),
  }),
);
$("sun-hour").addEventListener("input", updateLight);
$("pause-motion").addEventListener("click", setPause);
$("show-city").addEventListener("click", () => setLayer("city"));
$("show-network").addEventListener("click", () => setLayer("network"));
for (const [id, key] of [
  ["toggle-buildings", "buildings"],
  ["toggle-green", "green"],
  ["toggle-traffic", "traffic"],
])
  $(id).addEventListener("change", (e) => city?.toggle(key, e.target.checked));
$("quality").addEventListener("change", (e) =>
  city?.setQuality(e.target.value),
);
$("zoom-in").addEventListener("click", () => city?.zoom(1.25));
$("zoom-out").addEventListener("click", () => city?.zoom(0.8));
$("reset-view").addEventListener("click", () => city?.reset());
$("north").addEventListener("click", () => city?.north());
$("data-info").addEventListener("click", methods);
$("open-methods").addEventListener("click", methods);
$("close-methods").addEventListener("click", () => $("methods-dialog").close());
$("methods-dialog").addEventListener("click", (e) => {
  if (e.target === $("methods-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
$("retry").addEventListener("click", () => {
  city?.dispose();
  $("city-viewport").replaceChildren();
  if (data) openScene();
  else start();
});
if (paused) {
  $("pause-motion").textContent = "▷";
  $("pause-motion").setAttribute("aria-pressed", "true");
  $("pause-motion").setAttribute("aria-label", "Resume ambient motion");
}
start();
