import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Window } from "happy-dom";

// Execute the production lifecycle functions without invoking page startup or a real provider.
const source = fs.readFileSync(
  new URL("../../src/scripts/city/city-app.mjs", import.meta.url),
  "utf8",
);
const functions = source
  .slice(
    source.indexOf("async function connectReality"),
    source.indexOf("async function start()"),
  )
  .replace(/await import\(\s*["']\.\/city-reality\.mjs["']\s*,?\s*\)/u, "await getRealityModule()");
const adapter = (engine) => ({
  engine,
  disposed: false,
  disposeCalls: 0,
  toggles: [],
  dispose() {
    if (!this.disposed) this.disposeCalls++;
    this.disposed = true;
  },
  toggle(...args) {
    this.toggles.push(args);
  },
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  const nodes = new Map(),
    timers = new Map(),
    calls = [],
    adapters = [],
    events = [];
  let nextTimer = 0;
  const element = () => ({
    style: {},
    value: "",
    disabled: false,
    hidden: false,
    open: false,
    checked: true,
    children: [],
    append(x) {
      this.children.push(x);
    },
    remove() {
      this.removed = true;
    },
    replaceChildren() {
      this.children = [];
    },
    close() {
      this.open = false;
    },
  });
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  $("ion-source").value = "2275207";
  const initial = adapter("three");
  const context = vm.createContext({
    $,
    make: element,
    city: initial,
    data: {},
    connectionSerial: 0,
    openSceneSerial: 0,
    pendingReality: null,
    realityHost: null,
    activeLayer: "city",
    mode: "explore",
    AbortController,
    setTimeout(fn) {
      const id = ++nextTimer;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    console: { error() {} },
    showFallback() {
      events.push("fallback");
    },
    updateLight() {},
    rendererUI() {
      events.push("renderer-ui");
    },
    setLayer() {},
    drawRoutes() {
      events.push("draw-routes");
    },
    selectBuilding() {
      events.push("selection");
    },
    regionReady() {
      events.push("manifest");
    },
    regionStatus() {
      events.push("status");
    },
    visitDistrict() {
      events.push("visit-clears-routes");
    },
    notice() {},
    estate: {
      selectPoint() {
        events.push("point");
      },
    },
  });
  context.createCityScene = async () => adapter("three");
  context.createRealityScene = async (host, data, options) => {
    const a = adapter("cesium");
    calls.push(options);
    adapters.push(a);
    return a;
  };
  context.getRealityModule = async () => ({
    createRealityScene: context.createRealityScene,
  });
  vm.runInContext(functions, context);
  return {
    context,
    nodes,
    timers,
    calls,
    adapters,
    initial,
    events,
    $,
    connect() {
      $("ion-token").value = "synthetic-test-sentinel";
      return context.connectReality({ preventDefault() {} });
    },
  };
}

test("a canceled attempt clears its deadline and a queued stale timeout cannot invalidate a retry", async () => {
  const h = harness();
  await h.connect();
  const deadline = h.timers.values().next().value,
    signal = h.calls[0].signal;
  await h.context.returnToOpenMap();
  assert.equal(signal.aborted, true);
  assert.equal(h.timers.size, 0);
  await h.connect();
  const currentSerial = h.context.connectionSerial;
  deadline();
  assert.equal(h.context.connectionSerial, currentSerial);
  h.calls[1].onReady();
  assert.equal(h.context.city, h.adapters[1]);
  assert.equal(h.adapters[1].disposed, false);
  assert.equal(h.context.pendingReality, null);
  assert.equal(h.$("connect-reality").disabled, false);
});

test("a late Three result is disposed and cannot replace a newer photographic scene or emit stale UI callbacks", async () => {
  const h = harness();
  let resolveThree, threeCallbacks;
  h.context.createCityScene = (_, data, callbacks) => {
    threeCallbacks = callbacks;
    return new Promise((resolve) => {
      resolveThree = resolve;
    });
  };
  const opening = h.context.openScene();
  await h.connect();
  h.calls[0].onReady();
  const photograph = h.context.city,
    stale = adapter("stale-three");
  resolveThree(stale);
  await opening;
  assert.equal(h.context.city, photograph);
  assert.equal(photograph.disposed, false);
  assert.equal(stale.disposed, true);
  h.events.length = 0;
  threeCallbacks.onReady();
  threeCallbacks.onError("fixture");
  threeCallbacks.onRegionReady({});
  threeCallbacks.onRegionStatus({});
  threeCallbacks.onSelect({});
  assert.deepEqual(h.events, []);
});

test("timeout aborts a pending factory immediately and disposes any late returned adapter", async () => {
  const h = harness();
  let resolveFactory,
    aborted = false;
  h.context.createRealityScene = async (host, data, options) => {
    const a = adapter("cesium");
    h.adapters.push(a);
    options.signal.addEventListener(
      "abort",
      () => {
        aborted = true;
        a.dispose();
      },
      { once: true },
    );
    await new Promise((resolve) => {
      resolveFactory = resolve;
    });
    return a;
  };
  const pending = h.connect();
  await flush();
  h.timers.values().next().value();
  assert.equal(aborted, true);
  assert.equal(h.adapters[0].disposed, true);
  assert.equal(h.context.pendingReality, null);
  assert.equal(h.$("connect-reality").disabled, false);
  assert.equal(h.context.city, h.initial);
  assert.equal(h.initial.disposed, false);
  resolveFactory();
  await pending;
  assert.equal(h.adapters[0].disposeCalls, 1);
});

test("rejected connection preserves the existing scene and allows a successful retry", async () => {
  const h = harness();
  h.context.createRealityScene = async () => {
    throw new Error("synthetic rejection");
  };
  await h.connect();
  assert.equal(h.context.city, h.initial);
  assert.equal(h.initial.disposed, false);
  assert.equal(h.$("connect-reality").disabled, false);
  assert.equal(h.timers.size, 0);
  h.context.createRealityScene = async (host, data, options) => {
    options.onReady();
    return adapter("cesium");
  };
  await h.connect();
  assert.equal(h.context.city.engine, "cesium");
  assert.equal(h.initial.disposeCalls, 1);
  assert.equal(h.context.pendingReality, null);
});

test("ready before Three assignment restores the building checkbox after assignment", async () => {
  const h = harness();
  h.$("toggle-buildings").checked = false;
  const three = adapter("three");
  h.context.createCityScene = async (host, data, options) => {
    options.onReady();
    return three;
  };
  await h.context.openScene();
  assert.equal(h.context.city, three);
  assert.deepEqual(three.toggles, [["buildings", false]]);
  assert.equal(h.$("loading").hidden, true);
});

test("concurrent open-map starts dispose the older result and keep the newest scene", async () => {
  const h = harness(),
    resolvers = [];
  h.context.createCityScene = () =>
    new Promise((resolve) => resolvers.push(resolve));
  const first = h.context.openScene(),
    second = h.context.openScene();
  const older = adapter("older"),
    newer = adapter("newer");
  resolvers[1](newer);
  await second;
  resolvers[0](older);
  await first;
  assert.equal(h.context.city, newer);
  assert.equal(older.disposed, true);
  assert.equal(newer.disposed, false);
});

test("photographic handoff redraws comparison routes after resetting the default district", async () => {
  const h = harness();
  h.context.mode = "compare";
  await h.connect();
  h.calls[0].onReady();
  assert.ok(
    h.events.lastIndexOf("draw-routes") >
      h.events.lastIndexOf("visit-clears-routes"),
  );
});

test("custom-asset handoff keeps its captured location and does not reset the district/hash", async () => {
  const h = harness();
  h.$("ion-source").value = "custom";
  h.$("ion-asset").value = "12345";
  await h.connect();
  h.calls[0].onReady();
  assert.equal(h.$("district-name").textContent, "YOUR 3D CAPTURE");
  assert.equal(h.$("scene-coordinate").textContent, "USER-SUPPLIED ASSET");
  assert.equal(h.events.includes("visit-clears-routes"), false);
});

test("callbacks from a canceled photographic attempt cannot mutate the active page", async () => {
  const h = harness();
  await h.connect();
  const old = h.calls[0];
  await h.context.returnToOpenMap();
  h.events.length = 0;
  old.onError();
  old.onReady();
  old.onRegionReady({});
  old.onRegionStatus({ message: "stale" });
  old.onSelect({});
  old.onMapSelect({});
  assert.deepEqual(h.events, []);
  assert.equal(h.context.city.engine, "three");
});

test("mapped-building scenario uses polygon centroid coordinates and omits estimated height", (t) => {
  const window = new Window(),
    document = window.document;
  t.after(() => window.happyDOM.abort());
  const panel = document.createElement("div");
  panel.id = "building-details";
  document.body.append(panel);
  let selected;
  const selection = source.slice(
    source.indexOf("function selectBuilding(b)"),
    source.indexOf("function showPlaces("),
  );
  const context = vm.createContext({
    $: (id) => document.getElementById(id),
    data: { origin: [-90.193, 38.628] },
    make(tag, cls, text) {
      const e = document.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    },
    sourceUrl: () => "https://www.openstreetmap.org/way/1",
    setMode() {},
    estate: {
      selectPoint(point) {
        selected = point;
      },
    },
  });
  vm.runInContext(selection, context);
  context.selectBuilding({
    id: "w-fixture",
    height: 30,
    heightSource: "default",
    polygon: [
      [0, 0],
      [120, 0],
      [0, 60],
      [0, 0],
    ],
  });
  const button = panel.querySelector("button");
  assert.ok(button);
  button.click();
  assert.ok(
    Math.abs(
      selected.longitude -
        (-90.193 + 40 / (111195 * Math.cos((38.628 * Math.PI) / 180))),
    ) < 1e-12,
  );
  assert.ok(Math.abs(selected.latitude - (38.628 - 20 / 111195)) < 1e-12);
  assert.equal(Object.hasOwn(selected, "height"), false);
});
