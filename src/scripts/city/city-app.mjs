import { createCityScene } from "./city-scene.mjs";
import { createEstatePanel } from "./city-estate.mjs";
import { createPropertyPanel } from "./city-property-panel.mjs";
import { createWorkbench } from "./city-workbench.mjs";
import { createLivePanel } from "./city-live-panel.mjs";
import { createDevelopmentPanel } from "./city-development-panel.mjs";
import { createSpatialPanel } from "./city-spatial-panel.mjs";
import { createHeightStudy } from "./city-height-study.mjs";
import { createRealityPreferences } from "./city-reality-preferences.mjs";
import { createSitePanel } from "./city-site-panel.mjs";
import { getConditions, solarPosition } from "../../lib/city-conditions.mjs";
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
let connectionSerial = 0,
  openSceneSerial = 0,
  pendingReality = null,
  realityHost = null;
let property = null, workbench = null, importedMarkers = [], publicMarkers = [];
let selectedEvidence=null,development=null,spatial=null,heightStudy=null,heightStudyVisible=false,sitePanel=null;
let savedReality=null;
let selectImportedMarker = () => {}, selectPublicMarker = () => {};
function syncPropertyMarkers() {
  const records=[],actions=new Map();
  for(const [prefix,items,select] of [["import",importedMarkers,selectImportedMarker],["public",publicMarkers,selectPublicMarker]]) {
    for(const item of items) {const id=`${prefix}:${item.id}`;records.push({...item,id});actions.set(id,()=>select(item));}
  }
  city?.setListings?.(records,record=>actions.get(record.id)?.());
  workbench?.updateLegend({publicCount:publicMarkers.length,importCount:importedMarkers.length,heightStudy:heightStudyVisible});
}
const estate = createEstatePanel($("properties-panel"), {
  getCity: () => city,
  onOpen: () => setMode("properties"),
  onMarkers: (records,select) => {importedMarkers=records;selectImportedMarker=select;syncPropertyMarkers();},
  onSelectionChange: () => property?.clearSelection(),
  notice,
});
property = createPropertyPanel($("properties-panel"), {
  estate,getCity:()=>city,notice,onOpen:()=>setMode("properties"),
  onEvidence:evidence=>{
    selectedEvidence=evidence;development?.setEvidence(evidence);spatial?.setEvidence(evidence);heightStudy?.setEvidence(evidence);sitePanel?.setEvidence(evidence);
    if(evidence?.point)showSceneLocation(evidence.point,evidence.parcels?.parcel?.properties?.address||"SELECTED LOCATION");
    else if(city?.controls?.target) {
      const p=city.controls.target;
      showSceneLocation({longitude:p.x/(111195*Math.cos(38.628*Math.PI/180))-90.193,latitude:38.628-p.z/111195},"MAP CENTER");
    }
  },
  onInventory:snapshot=>{if(selectedEvidence){selectedEvidence={...selectedEvidence,inventorySnapshot:snapshot};spatial?.setEvidence(selectedEvidence)}},
  onPublicMarkers:(records,select)=>{publicMarkers=records;selectPublicMarker=select;syncPropertyMarkers();},
});
const developRoot=$("property-panel-develop");
developRoot.innerHTML='<div id="spatial-workspace"></div><details class="height-study-section"><summary>Visualize a parcel height study</summary><div id="height-study-workspace"></div></details><div id="development-workspace"></div>';
development=createDevelopmentPanel($("development-workspace"),{getEvidence:()=>selectedEvidence,getScenario:()=>estate.getScenario(),notice});
spatial=createSpatialPanel($("spatial-workspace"),{getEvidence:()=>selectedEvidence,onLocate:locateMapPoint});
heightStudy=createHeightStudy($("height-study-workspace"),{getCity:()=>city,getEvidence:()=>selectedEvidence,onChange:visible=>{heightStudyVisible=visible;workbench?.updateLegend({publicCount:publicMarkers.length,importCount:importedMarkers.length,heightStudy:visible})}});
sitePanel=createSitePanel($("property-panel-site"),{getEvidence:()=>selectedEvidence});
const livePanel = createLivePanel($("live-panel"), {
  onLocate:locateMapPoint,
  onSummary:summary=>{
    const alert=summary.alerts,badge=$("live-feed-count");
    badge.hidden=alert.status!=="current"||!Number.isFinite(alert.count)||alert.count===0;
    badge.textContent=Number.isFinite(alert.count)?String(alert.count):"";
    badge.title="Active NWS alerts for St. Louis City and County";
  },
});
workbench=createWorkbench(document,{getCity:()=>city,setMode,property,showPlaces,onNow:()=>{environmentMode="now";updateLight()}});
function locateMapPoint({longitude,latitude,label}) {
  if(!city||!Number.isFinite(longitude)||!Number.isFinite(latitude))return;
  const x=(longitude+90.193)*111195*Math.cos(38.628*Math.PI/180),z=(38.628-latitude)*111195;
  city.flyTo(x,z,3);city.pin?.(x,z,"#e3bc76");showSceneLocation({longitude,latitude},label);notice(label);
}
function showSceneLocation(point,label) {
  $("district-name").textContent=label;
  $("scene-coordinate").textContent=`${Math.abs(point.latitude).toFixed(5)}° ${point.latitude<0?"S":"N"} · ${Math.abs(point.longitude).toFixed(5)}° ${point.longitude<0?"W":"E"}`;
}
let regionManifest = null,
  conditions = null,
  environmentMode = "now";
const localTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
function localHour(now) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return (
    Number(p.find((p) => p.type === "hour").value) +
    Number(p.find((p) => p.type === "minute").value) / 60
  );
}
async function refreshConditions(force = false) {
  $("refresh-weather").disabled = true;
  try {
    conditions = await getConditions({ force });
    const p = conditions.presentation,
      o = conditions.observation;
    $("weather-temperature").textContent =
      p?.temperatureC !== null && p?.temperatureC !== undefined
        ? `${Math.round((p.temperatureC * 9) / 5 + 32)}°F`
        : "—";
    $("weather-description").textContent = p?.usable
      ? p.description || "Conditions partly reported"
      : conditions.status === "stale"
        ? "Report is stale"
        : "Weather unavailable";
    $("weather-wind").textContent =
      p?.windSpeedMps !== null && p?.windSpeedMps !== undefined
        ? `Wind ${Math.round(p.windSpeedMps * 2.23694)} mph`
        : "Wind not reported";
    $("weather-time").textContent = o?.observedAt
      ? `KCPS · ${localTime.format(new Date(o.observedAt))}`
      : "NWS · KCPS";
    if (o?.observedAt) $("weather-time").dateTime = o.observedAt;
    $("weather-status").textContent = p?.usable
      ? "Observed"
      : conditions.status === "stale"
        ? "Stale"
        : "Unavailable";
    $("conditions-card").title =
      "National Weather Service · St. Louis Downtown Airport, about 8 km from downtown. Airport conditions may differ from individual neighborhoods.";
    $("weather-symbol").textContent = !p?.usable
      ? "◌"
      : ["rain", "mixed"].includes(p.precipitationKind)
        ? "☂"
        : p.precipitationKind === "snow"
          ? "❄"
          : p.cloudCoverFraction === null || p.cloudCoverFraction === undefined
            ? "◌"
            : p.cloudCoverFraction > 0.6
              ? "☁"
              : "☀";
  } catch {
    $("weather-description").textContent = "Weather unavailable";
    $("weather-status").textContent = "Unavailable";
  } finally {
    $("refresh-weather").disabled = false;
    updateLight();
  }
}
function regionReady(manifest, restore = true) {
  regionManifest = manifest;
  const select = $("district-select");
  select.querySelectorAll("option[data-regional]").forEach((n) => n.remove());
  for (const p of manifest.places) {
    const o = new Option(p.name, p.id);
    o.dataset.regional = "true";
    select.append(o);
  }
  const row = make("div");
  $("source-statistics").querySelector("[data-region-stat]")?.remove();
  row.dataset.regionStat = "true";
  row.append(
    make("dt", "", "City & County"),
    make(
      "dd",
      "",
      `${manifest.counts.buildings.toLocaleString()} mapped buildings · ${manifest.tiles.length} sections`,
    ),
  );
  $("source-statistics").append(row);
  if (restore && location.hash.startsWith("#district=")) {
    try {
      const id = decodeURIComponent(location.hash.slice(10));
      if (id === "overview" || manifest.places.some((p) => p.id === id)) {
        select.value = id;
        visitDistrict(id, false);
      }
    } catch {}
  }
}
function regionStatus(status) {
  if (status.engine === "cesium") {
    $("region-status").textContent =
      status.message || "Streaming captured photographic geometry";
    return;
  }
  if (city?.engine === "cesium") return;
  if (status.error) {
    $("region-status").textContent =
      "Regional map unavailable. Downtown remains available.";
    return;
  }
  const count = status.manifest?.counts?.buildings || 0;
  $("region-status").textContent = status.pending
    ? `Loading ${status.pending} map sections…`
    : status.failed
      ? "Some map sections could not load. They will retry."
      : `${count.toLocaleString()} mapped buildings · ${status.level === "overview" ? "Zoom in for building detail" : "City & County"}`;
}
function visitDistrict(id, write = true) {
  if (id === "riverfront") {
    city?.reset();
    $("district-name").textContent = "DOWNTOWN & RIVERFRONT";
  } else if (id === "overview" && regionManifest) {
    const b = regionManifest.bounds;
    city?.flyTo((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0.014);
    $("district-name").textContent = "ST. LOUIS CITY & COUNTY";
  } else {
    const p = regionManifest?.places.find((p) => p.id === id);
    if (!p) return;
    city?.flyTo(p.x, p.z, 0.8);
    $("district-name").textContent = p.name.toUpperCase();
  }
  $("district-select").value = id;
  city?.clearRoutes();
  $("scene-coordinate").textContent =
    id === "riverfront" ? "38.628° N · 90.193° W" : "OPENSTREETMAP · MISSOURI";
  if (write) {
    const url = new URL(location.href);
    url.hash = id === "riverfront" ? "" : `district=${encodeURIComponent(id)}`;
    history.replaceState(null, "", url);
  }
}
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
    environment: environmentMode,
  };
}
function setMode(next) {
  if(!["explore","compare","layers","properties","live"].includes(next))return;
  mode = next;
  for (const n of ["explore", "compare", "layers", "properties", "live"])
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
    properties: "PLACE & POSSIBILITY",
    live: "THE REGION, RIGHT NOW",
  }[next];
  $("explorer").classList.toggle("estate-open", next === "properties");
  if (!panelOpen) togglePanel();
  if (next === "compare") compare();
  else city?.clearRoutes();
  if(next==="live")livePanel.refresh();
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
  const polygon = b.polygon;
  if (
    polygon?.length >= 3 &&
    polygon.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  ) {
    let twiceArea = 0,
      xMoment = 0,
      zMoment = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        next = polygon[(i + 1) % polygon.length];
      const cross = a[0] * next[1] - next[0] * a[1];
      twiceArea += cross;
      xMoment += (a[0] + next[0]) * cross;
      zMoment += (a[1] + next[1]) * cross;
    }
    const x =
      Math.abs(twiceArea) > 1e-8
        ? xMoment / (3 * twiceArea)
        : (Math.min(...polygon.map((p) => p[0])) +
            Math.max(...polygon.map((p) => p[0]))) /
          2;
    const z =
      Math.abs(twiceArea) > 1e-8
        ? zMoment / (3 * twiceArea)
        : (Math.min(...polygon.map((p) => p[1])) +
            Math.max(...polygon.map((p) => p[1]))) /
          2;
    const origin = data.origin || [-90.193, 38.628];
    const scenario = make("button", "", "Test a rental scenario here");
    scenario.type = "button";
    scenario.addEventListener("click", () =>
      property.inspectPoint({
        longitude:
          origin[0] + x / (111195 * Math.cos((origin[1] * Math.PI) / 180)),
        latitude: origin[1] - z / 111195,
      }),
    );
    el.append(scenario);
  }
  setMode("explore");
}
function showPlaces(query = "") {
  const list = $("place-list");
  list.replaceChildren();
  const q = query.trim().toLowerCase();
  let shown = q
    ? [
        ...(regionManifest?.places || []).map((p) => ({
          ...p,
          regional: true,
        })),
        ...places,
      ]
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, 18)
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
      if (p.regional) {
        visitDistrict(p.id);
        return;
      }
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
  const hour = Math.floor(v),
    minute = Math.round((v - hour) * 60);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
function updateLight() {
  const now = new Date();
  $("local-clock").textContent = localTime.format(now);
  $("live-environment").setAttribute(
    "aria-pressed",
    String(environmentMode === "now"),
  );
  if (environmentMode === "now") {
    $("sun-hour").value = Math.floor(localHour(now) * 4) / 4;
    $("sun-label").textContent = "St. Louis now";
    city?.setEnvironment(solarPosition(now), conditions?.presentation);
  } else {
    const v = Number($("sun-hour").value);
    $("sun-label").textContent = `${sunLabel(v)} · study`;
    city?.setEnvironment(
      solarPosition(new Date(now.getTime() + (v - localHour(now)) * 3600000)),
      conditions?.presentation,
    );
  }
  workbench?.updateSolar(Number($("sun-hour").value),environmentMode==="now");
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
function rendererUI() {
  const photo = city?.engine === "cesium";
  document.body.classList.toggle("photographic-view", photo);
  $("use-open-map").hidden = !photo;
  $("open-reality").textContent = photo
    ? "Change photographic connection ↗"
    : "Photographic city ↗";
  $("render-basis").textContent = photo
    ? "Captured photographic geometry · provider credits below. Select a surface to start a location-based scenario."
    : "Open map · OSM geometry with authored materials. Connect Cesium ion for captured photographic surfaces.";
  $("layer-basis").textContent = photo
    ? "Photographic surfaces contain captured lighting and weather. Current observations remain in the weather panel. Separate building, tree, traffic and light-study controls require the open map."
    : "Now uses the current sun position and fresh airport weather observations. Surface wetness, water, vegetation and traffic are visual interpretations. Traffic is illustrative.";
  for (const id of [
    "show-network",
    "toggle-buildings",
    "toggle-green",
    "toggle-traffic",
    "sun-hour",
  ])
    $(id).disabled = photo;
  workbench?.refreshRenderer();
  city?.setPaused(paused);
  city?.setQuality($("quality").value);
  estate.refreshMarkers();
  property.refreshMarkers();
  heightStudy?.refreshRenderer();
  if (mode === "compare") drawRoutes();
  updateLight();
}

async function connectReality(event, restored = null) {
  event?.preventDefault();
  if(event)savedReality?.consumeRestore();
  if (!data || pendingReality) return;
  const token = (typeof restored?.token==="string"?restored.token:$("ion-token").value).trim();
  if (!token) return;
  if(token.length>8192){$("reality-status").textContent="The token exceeds the supported length. Check the copied token.";return}
  const assetId = Number(restored?.assetId ?? (
    $("ion-source").value === "custom"
      ? $("ion-asset").value
      : $("ion-source").value
  ));
  if (!Number.isSafeInteger(assetId) || assetId <= 0) {
    $("reality-status").textContent =
      "Enter a positive whole-number 3D Tiles asset ID.";
    return;
  }
  const persistConnection=savedReality?.prepareAttempt({token,assetId});
  const serial = ++connectionSerial,
    host = make("div", "reality-host");
  host.style.visibility = "hidden";
  $("city-viewport").append(host);
  const abort = new AbortController();
  const attempt = {
    serial,
    host,
    adapter: null,
    abort,
    timeout: null,
    phase: "module",
  };
  pendingReality = attempt;
  $("connect-reality").disabled = true;
  $("reality-status").textContent = "Connecting to Cesium ion…";
  $("ion-token").value = "";
  let candidate = null,
    readyBeforeAssignment = false,
    connected = false,
    pendingManifest = null,
    diagnose = null;
  const failure = (error) => {
    if (serial !== connectionSerial) return;
    ++connectionSerial;
    clearTimeout(attempt.timeout);
    abort.abort();
    candidate?.dispose();
    host.remove();
    pendingReality = null;
    $("connect-reality").disabled = false;
    const diagnostic = error?.diagnostic || diagnose?.(attempt.phase);
    const safe =
      diagnostic &&
      [
        "module",
        "renderer",
        "authorization",
        "tileset",
        "tiles",
        "surface",
        "render",
        "unknown",
      ].includes(diagnostic.phase);
    $("reality-status").textContent = safe
      ? `${diagnostic.message} [Step: ${diagnostic.phase}${diagnostic.status ? `; HTTP ${diagnostic.status}` : ""}]`
      : "The photographic layer could not connect. Check token permissions, selected asset and network, then enter the token again to retry.";
    if(restored)notice("The saved Cesium connection could not open. Check its settings in Photographic city; it will not retry automatically during this visit.");
    if (safe) {
      try {
        sessionStorage.setItem(
          "stl-reality-check",
          JSON.stringify({
            phase: diagnostic.phase,
            status: diagnostic.status,
          }),
        );
      } catch {}
    }
    if (city === candidate) {
      city = null;
      realityHost = null;
      showFallback(
        "The photographic renderer stopped. Use Try 3D again to return to the open map.",
      );
    }
  };
  const ready = () => {
    if (serial !== connectionSerial) {
      candidate?.dispose();
      host.remove();
      return;
    }
    if (!candidate) {
      readyBeforeAssignment = true;
      return;
    }
    if (connected) return;
    connected = true;
    clearTimeout(attempt.timeout);
    ++openSceneSerial;
    city?.dispose();
    realityHost?.remove();
    city = candidate;
    realityHost = host;
    host.style.visibility = "visible";
    pendingReality = null;
    if (pendingManifest) regionReady(pendingManifest, false);
    activeLayer = "city";
    rendererUI();
    setLayer("city");
    $("loading").hidden = true;
    $("fallback").hidden = true;
    $("connect-reality").disabled = false;
    $("reality-status").textContent =
      "Connected. Photographic surfaces retain their captured lighting and weather.";
    // Persistence errors must never discard a successfully rendered connection.
    try {persistConnection?.()} catch {}
    try {
      sessionStorage.removeItem("stl-reality-check");
    } catch {}
    $("methods-dialog").open && $("methods-dialog").close();
    $("reality-dialog").close();
    if (assetId === 2275207) {
      visitDistrict("riverfront");
      if (mode === "compare") drawRoutes();
    } else {
      $("district-name").textContent = "YOUR 3D CAPTURE";
      $("scene-coordinate").textContent = "USER-SUPPLIED ASSET";
    }
    regionStatus({
      engine: "cesium",
      message: "Photographic view connected · captured imagery",
    });
    notice(
      "Photographic view connected. Imported listings and scenarios remain in this page.",
    );
  };
  attempt.timeout = setTimeout(failure, 60000);
  try {
    const { createRealityScene, connectionDiagnostic } = await import(
      "./city-reality.mjs"
    );
    if (typeof connectionDiagnostic === "function")
      diagnose = connectionDiagnostic;
    if (serial !== connectionSerial) {
      host.remove();
      return;
    }
    candidate = await createRealityScene(host, data, {
      token,
      assetId,
      signal: abort.signal,
      onReady: ready,
      onError: failure,
      onSelect: (building) => {
        if (serial === connectionSerial && candidate && city === candidate)
          selectBuilding(building);
      },
      onMapSelect: (point) => {
        if (serial === connectionSerial && candidate && city === candidate)
          property.inspectPoint(point);
      },
      onRegionReady: (manifest) => {
        if (serial !== connectionSerial) return;
        pendingManifest = manifest;
        if (candidate && city === candidate) regionReady(manifest, false);
      },
      onRegionStatus: (status) => {
        if (serial !== connectionSerial) return;
        attempt.phase =
          {
            authorizing: "authorization",
            authorized: "tileset",
            loading: "surface",
            streaming: "surface",
            partial: "tiles",
          }[status.state] || attempt.phase;
        if (city === candidate && candidate) regionStatus(status);
        else
          $("reality-status").textContent =
            status.message || "Loading photographic detail…";
      },
    });
    if (serial !== connectionSerial) {
      candidate.dispose();
      host.remove();
      return;
    }
    if (pendingReality) pendingReality.adapter = candidate;
    if (readyBeforeAssignment) ready();
  } catch (error) {
    failure(error);
  }
}

async function returnToOpenMap() {
  savedReality?.consumeRestore();
  ++connectionSerial;
  clearTimeout(pendingReality?.timeout);
  pendingReality?.abort?.abort();
  pendingReality?.adapter?.dispose();
  pendingReality?.host?.remove();
  pendingReality = null;
  city?.dispose();
  city = null;
  realityHost?.remove();
  realityHost = null;
  $("city-viewport").replaceChildren();
  $("loading").hidden = false;
  $("connect-reality").disabled = false;
  await openScene();
}
function restoreSavedReality() {
  if(connectionSerial!==0||pendingReality||$("reality-dialog").open) {savedReality?.consumeRestore();return}
  const restored=savedReality?.takeRestore();
  if(restored)void connectReality(null,restored);
}
async function openScene() {
  const serial = ++openSceneSerial;
  let candidate = null,
    readyBeforeAssignment = false,
    pendingManifest = null,
    pendingStatus = null;
  const current = () => serial === openSceneSerial;
  const ready = () => {
    if (!current()) return;
    if (!candidate) {
      readyBeforeAssignment = true;
      return;
    }
    if (city !== candidate) return;
    $("loading").hidden = true;
    $("fallback").hidden = true;
    updateLight();
    rendererUI();
    city.toggle("buildings", $("toggle-buildings").checked);
    setLayer(activeLayer);
    if (mode === "compare") drawRoutes();
    restoreSavedReality();
  };
  try {
    candidate = await createCityScene($("city-viewport"), data, {
      onSelect: (building) => {
        if (current() && candidate && city === candidate)
          selectBuilding(building);
      },
      onReady: ready,
      onError: (message) => {
        if (current()) showFallback(message);
      },
      onRegionReady: (manifest) => {
        if (!current()) return;
        pendingManifest = manifest;
        if (candidate && city === candidate) regionReady(manifest);
      },
      onRegionStatus: (status) => {
        if (!current()) return;
        pendingStatus = status;
        if (candidate && city === candidate) regionStatus(status);
      },
    });
    if (!current()) {
      candidate.dispose();
      return;
    }
    if (city && city !== candidate) city.dispose();
    city = candidate;
    if (pendingManifest) regionReady(pendingManifest);
    if (pendingStatus) regionStatus(pendingStatus);
    if (readyBeforeAssignment) ready();
  } catch (error) {
    if (!current()) return;
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
      environmentMode = saved.environment || "study";
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
    if (matchMedia("(max-width:720px)").matches && !saved && panelOpen && mode==="explore" && !$("city-search-query").value && !$("place-search").value)
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
savedReality=createRealityPreferences(document,{onReconnect:credentials=>{savedReality.consumeRestore();void connectReality(null,credentials)}});
$("open-reality").addEventListener("click", () => {
  savedReality.consumeRestore();$("reality-dialog").showModal();
});
$("close-reality").addEventListener("click", () => $("reality-dialog").close());
$("reality-form").addEventListener("submit", connectReality);
$("ion-source").addEventListener("change", () => {
  const custom = $("ion-source").value === "custom";
  $("custom-asset-label").hidden = !custom;
  $("ion-asset").required = custom;
});
$("use-open-map").addEventListener("click", returnToOpenMap);
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
$("sun-hour").addEventListener("input", () => {
  environmentMode = "study";
  updateLight();
});
$("live-environment").addEventListener("click", () => {
  environmentMode = "now";
  updateLight();
});
$("refresh-weather").addEventListener("click", () => refreshConditions(true));
$("district-select").addEventListener("change", (e) =>
  visitDistrict(e.target.value),
);
$("county-overview").addEventListener("click", () => visitDistrict("overview"));
$("street-detail").addEventListener("click", () => {
  if (city) {
    city.flyTo(city.controls.target.x, city.controls.target.z, 5);
    if (panelOpen) togglePanel();
  }
});
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
  if (data) returnToOpenMap();
  else start();
});
if (paused) {
  $("pause-motion").textContent = "▷";
  $("pause-motion").setAttribute("aria-pressed", "true");
  $("pause-motion").setAttribute("aria-label", "Resume ambient motion");
}
$("ion-allowed-origin").textContent = location.origin;
try {
  const previous = JSON.parse(
    sessionStorage.getItem("stl-reality-check") || "null",
  );
  if (previous)
    import("./city-reality.mjs")
      .then(({ connectionDiagnostic }) => {
        if (pendingReality || city?.engine === "cesium") return;
        const d = connectionDiagnostic(previous.phase, {
          statusCode: previous.status,
        });
        $("reality-status").textContent =
          `Previous attempt: ${d.message} [Step: ${d.phase}${d.status ? `; HTTP ${d.status}` : ""}]`;
      })
      .catch(() => {});
} catch {}
start();
refreshConditions();
setInterval(() => {
  if (!document.hidden) {
    refreshConditions();
    if(mode==="live")livePanel.refresh();
  }
}, 60000);
