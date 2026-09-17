import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { createStreetLabelLoader, streetLabelPlan, selectStreetLabels, thinStreetLabels } from "../../src/lib/city-street-labels.mjs";
import { createStreetLabelLayer } from "../../src/scripts/city/city-street-labels.mjs";

const anchor = (id, x = 0, z = 0, priority = 4, name = `Test street ${id}`) => ({ id, name, x, z, priority });
const json = data => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const manifest = (count = 2) => ({ version: 1, origin: [-90.193, 38.628], units: "meters",
  source: { osmSnapshotTimestamp: "2026-09-07T20:21:20Z" }, tiles: Array.from({ length: count }, (_, i) => ({ id: `${i}_0`, bounds: [i * 2000, 0, (i + 1) * 2000, 2000], bytes: 1000 })) });
const settle = () => new Promise(resolve => setTimeout(resolve, 5));

test("camera plans fall back to the regional overview instead of exceeding the tile budget", () => {
  assert.equal(streetLabelPlan(manifest(30), [0, 0, 90000, 90000]).level, "overview");
  assert.equal(streetLabelPlan(manifest(30), [0, 0, 10000, 2000], 3).level, "overview");
  assert.equal(streetLabelPlan(manifest(), [1, 1, 1999, 1999]).tiles.length, 1);
  assert.equal(streetLabelPlan(manifest(), [NaN, 0, 1, 1]).level, "empty");
});

test("scale and geographic filtering keep local roads out of a County overview", () => {
  const rows = [anchor("local"), anchor("main", 100, 0, 1), anchor("secondary", 300, 0, 2), anchor("outside", 100000)];
  assert.deepEqual(selectStreetLabels(rows, [-40000, -40000, 40000, 40000]).map(r => r.id), ["main"]);
  assert.deepEqual(selectStreetLabels(rows, [-500, -500, 500, 500]).map(r => r.id), ["main", "secondary", "local"]);
  assert.equal(selectStreetLabels(rows, [-500, -500, 500, 500], 0).length, 0);
});

test("collision priority, repeated-name spacing, viewport edges, and credit space stay clear", () => {
  const point = (id, x, y, name = id) => ({ ...anchor(id, 0, 0, 1, name), screenX: x, screenY: y });
  const rows = [point("first", 200, 100), point("overlap", 205, 100), point("repeated", 350, 100, "first"), point("other", 200, 180), point("credit", 500, 760), point("offscreen", -5, 250)];
  assert.deepEqual(thinStreetLabels(rows, { width: 1000, height: 800 }).map(r => r.id), ["first", "other"]);
  assert.equal(thinStreetLabels(rows, { width: 390, height: 844, limit: 0 }).length, 0);
});

test("detail requests contain no building payload and cached tiles avoid repeated fetches", async t => {
  const urls = [];
  const loader = createStreetLabelLoader({ fetchImpl: async url => {
    urls.push(url);
    return json(url.endsWith("manifest.json") ? manifest() : { version: 1, labels: [anchor("one", 500, 500)] });
  } }); t.after(() => loader.dispose());
  const result = await loader.load([1, 1, 1999, 1999]);
  assert.equal(result.status, "ready"); assert.equal(result.labels.length, 1);
  assert.equal(result.source.snapshot, "2026-09-07T20:21:20Z");
  await loader.load([1, 1, 1999, 1999]);
  assert.deepEqual(urls, ["/st-louis/street-labels/manifest.json", "/st-louis/street-labels/tiles/0_0.json"]);
});

test("tile failures preserve the independent successful labels with a partial status", async t => {
  const loader = createStreetLabelLoader({ fetchImpl: async url => {
    if (url.endsWith("manifest.json")) return json(manifest());
    if (url.endsWith("1_0.json")) return new Response("unavailable", { status: 503 });
    return json({ version: 1, labels: [anchor("good", 500, 500)] });
  } }); t.after(() => loader.dispose());
  const result = await loader.load([1, 1, 3999, 1999]);
  assert.equal(result.status, "partial"); assert.equal(result.labels[0].id, "good");
  assert.match(result.reason, /Some local/);
});

test("loader rejects bad names, invalid coordinates, and untrusted tile path identifiers", async t => {
  for (const bad of [anchor("bad", NaN), { ...anchor("bad"), name: "Bad\nname" }, { ...anchor("bad"), priority: 9 }]) {
    const loader = createStreetLabelLoader({ fetchImpl: async url => json(url.endsWith("manifest.json") ? manifest(1) : { version: 1, labels: [bad] }) });
    t.after(() => loader.dispose());
    assert.equal((await loader.load([1, 1, 1999, 1999])).status, "unavailable");
  }
  let calls = 0;
  const loader = createStreetLabelLoader({ fetchImpl: async () => { calls++; return json({ ...manifest(1), tiles: [{ ...manifest(1).tiles[0], id: "../../secret" }] }); } });
  t.after(() => loader.dispose());
  assert.equal((await loader.load([1, 1, 1999, 1999])).status, "unavailable"); assert.equal(calls, 1);
});

test("byte limits and deadlines also bound a stalled response body", async t => {
  const large = createStreetLabelLoader({ fetchImpl: async () => new Response("{}", { headers: { "content-length": String(900000) } }) });
  t.after(() => large.dispose());
  assert.equal((await large.load([0, 0, 1, 1])).status, "unavailable");
  const stalled = createStreetLabelLoader({ timeoutMs: 15, fetchImpl: async () => new Response(new ReadableStream({ start() {} })) });
  t.after(() => stalled.dispose());
  const before = Date.now();
  assert.equal((await stalled.load([0, 0, 1, 1])).status, "unavailable");
  assert.ok(Date.now() - before < 400);
});

test("cancellation discards late responses and disposal rejects future work", async () => {
  let resolve;
  const loader = createStreetLabelLoader({ fetchImpl: () => new Promise(r => { resolve = r; }) });
  const controller = new AbortController(), pending = loader.load([0, 0, 1, 1], { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  resolve(json(manifest())); loader.dispose();
  await assert.rejects(loader.load([0, 0, 1, 1]), { name: "AbortError" });
});

test("cache admission evicts older tiles and limits network concurrency to four", async t => {
  let active = 0, maximum = 0; const requests = [];
  const loader = createStreetLabelLoader({ maxCachedTiles: 2, fetchImpl: async url => {
    if (url.endsWith("manifest.json")) return json(manifest(7));
    requests.push(url); active++; maximum = Math.max(maximum, active); await settle(); active--;
    return json({ version: 1, labels: [] });
  } }); t.after(() => loader.dispose());
  await loader.load([1, 1, 11999, 1999]); assert.ok(maximum <= 4);
  await loader.load([1, 1, 1999, 1999]);
  assert.equal(requests.filter(url => url.endsWith("0_0.json")).length, 2);
});

function runtimeFixture(t, load) {
  const window = new Window(), container = window.document.createElement("div"); window.document.body.append(container);
  const event = () => { const listeners = new Set(); return { addEventListener(fn) { listeners.add(fn); return () => listeners.delete(fn); }, fire() { for (const fn of listeners) fn(); }, get size() { return listeners.size; } }; };
  const moveEnd = event(), postRender = event(); const collections = [], credits = new Set(); let loaderDisposed = false;
  class LabelCollection {
    constructor() { this.items = []; }
    add(options) { assert.equal(options.show, false); assert.equal(options.text, ""); assert.equal(options.heightReference, 5);
      const label = { ...options, computeScreenSpacePosition: () => ({ x: 250, y: 200 }) }; this.items.push(label); return label; }
    removeAll() { this.items = []; }
  }
  const C = { LabelCollection, Cartesian3: { fromDegrees: (longitude, latitude) => ({ longitude, latitude }) },
    HeightReference: { CLAMP_TO_3D_TILE: 5 }, Credit: class { constructor(text) { this.text = text; } } };
  const viewer = { canvas: { clientWidth: 1000, clientHeight: 800 }, camera: { moveEnd, positionCartographic: { height: 500 }, pitch: -.7 },
    creditDisplay: { addStaticCredit: credit => credits.add(credit), removeStaticCredit: credit => credits.delete(credit) },
    scene: { primitives: { add(collection) { collections.push(collection); return collection; }, remove(collection) { collection.removeAll(); collections.splice(collections.indexOf(collection), 1); } }, postRender, requestRender() {} }, isDestroyed: () => false };
  const statuses = [], layer = createStreetLabelLayer(C, viewer, container, { onStatus: s => statuses.push(s), loader: { load, dispose() { loaderDisposed = true; } } });
  t.after(() => { layer.dispose(); window.happyDOM.abort(); });
  return { container, layer, statuses, moveEnd, postRender, collections, credits, isLoaderDisposed: () => loaderDisposed };
}

test("visible labels are noninteractive DOM text, while hidden clamped anchors add no pick geometry", async t => {
  const f = runtimeFixture(t, async () => ({ status: "ready", labels: [anchor("road", 0, 0, 1, "Market Street")], reason: null }));
  await settle();
  const overlay = f.container.querySelector(".city-photographic-street-labels");
  assert.equal(overlay.style.pointerEvents, "none"); assert.equal(overlay.getAttribute("aria-hidden"), "true");
  assert.equal(overlay.textContent, "Market Street"); assert.equal(overlay.firstElementChild.style.display, "block");
  assert.equal(f.layer.getStreetLabelStatus().visibleCount, 1); assert.equal(f.credits.size, 1);
  f.layer.setStreetLabels(false);
  assert.equal(f.layer.getStreetLabelStatus().status, "disabled"); assert.equal(f.credits.size, 0); assert.equal(overlay.style.display, "none");
  f.layer.setStreetLabels(true); await settle(); assert.equal(f.layer.getStreetLabelStatus().status, "ready");
  f.layer.dispose(); assert.equal(f.moveEnd.size, 0); assert.equal(f.postRender.size, 0); assert.equal(f.collections.length, 0);
  assert.equal(f.container.children.length, 0); assert.equal(f.credits.size, 0); assert.equal(f.isLoaderDisposed(), true);
});

test("switching labels off prevents a late request from restoring visible labels", async t => {
  let finish, signal;
  const f = runtimeFixture(t, (view, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  f.layer.setStreetLabels(false); assert.equal(signal.aborted, true);
  finish({ status: "ready", labels: [anchor("late")], reason: null }); await settle();
  assert.equal(f.layer.getStreetLabelStatus().status, "disabled"); assert.equal(f.container.textContent, "");
});

test("retained artifact covers City and County with bounded label-only payloads and source attribution", async () => {
  const root = new URL("../../public/st-louis/street-labels/", import.meta.url);
  const data = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  assert.equal(data.source.attribution, "© OpenStreetMap contributors"); assert.ok(data.counts.labels > 40000);
  assert.ok(data.tiles.some(t => t.id === "0_0")); assert.ok(data.tiles.some(t => t.id.startsWith("-20_")));
  assert.ok(data.tiles.every(t => t.bytes < 768 * 1024)); assert.ok(data.overviewBytes < 768 * 1024);
  const downtown = JSON.parse(await readFile(new URL("tiles/0_0.json", root), "utf8"));
  const west = JSON.parse(await readFile(new URL("tiles/-20_0.json", root), "utf8"));
  assert.ok(downtown.labels.some(label => label.name.includes("Street"))); assert.ok(west.labels.length > 0);
  assert.deepEqual(Object.keys(downtown).sort(), ["labels", "version"]);
});
