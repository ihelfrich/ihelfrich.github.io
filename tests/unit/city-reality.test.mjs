import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../../src/scripts/city/city-reality.mjs", import.meta.url),
  "utf8",
);
const overlaySource = await readFile(new URL("../../src/lib/city-parcel-overlay.mjs", import.meta.url), "utf8");
const toneSource = await readFile(new URL("../../src/lib/city-tone.mjs", import.meta.url), "utf8");
const volumeSource = await readFile(new URL("../../src/lib/city-development-volume.mjs", import.meta.url), "utf8");
const parcelsSource = await readFile(new URL("../../src/lib/city-parcels.mjs", import.meta.url), "utf8");
async function fixture(resource) {
  let created = 0,
    destroyed = 0;
  const event = { addEventListener: () => () => {} };
  class PostProcessStage {
    constructor(options) { Object.assign(this, options); }
    isDestroyed() { return !!this.dead; }
  }
  class Viewer {
    constructor() {
      created++;
      this.scene = {
        screenSpaceCameraController: {},
        fog: {},
        renderError: event,
        postProcessStages: { add: value => value, remove: value => { value.dead = true; } },
      };
      this.canvas = { setAttribute() {} };
      this.screenSpaceEventHandler = { removeInputAction() {} };
    }
    isDestroyed() {
      return !!this.dead;
    }
    destroy() {
      assert.equal(this.dead, undefined);
      this.dead = true;
      destroyed++;
    }
  }
  const context = vm.createContext({
    AbortController,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    document: {
      querySelector: () => null,
      createElement: () => ({ dataset: {} }),
      head: { append() {} },
    },
    matchMedia: () => ({ matches: false }),
  });
  const dependency = new vm.SyntheticModule(
    ["Viewer", "IonResource", "ScreenSpaceEventType", "PostProcessStage", "Cartesian3"],
    function () {
      this.setExport("Viewer", Viewer);
      this.setExport("PostProcessStage", PostProcessStage);
      this.setExport("Cartesian3", class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } });
      this.setExport("IonResource", { fromAssetId: resource });
      this.setExport("ScreenSpaceEventType", {
        LEFT_CLICK: 1,
        LEFT_DOUBLE_CLICK: 2,
      });
    },
    { context },
  );
  await dependency.link(() => {});
  await dependency.evaluate();
  const module = new vm.SourceTextModule(source, {
    context,
    importModuleDynamically: async () => dependency,
  });
  const overlay = new vm.SourceTextModule(overlaySource, {context});
  const tone = new vm.SourceTextModule(toneSource, {context});
  const volume = new vm.SourceTextModule(volumeSource, {context});
  const parcels = new vm.SourceTextModule(parcelsSource, {context});
  await overlay.link(() => {});
  await tone.link(() => {});
  await parcels.link(() => {});
  await volume.link(() => parcels);
  await module.link(specifier => specifier.endsWith("city-tone.mjs") ? tone : specifier.endsWith("city-development-volume.mjs") ? volume : overlay);
  await module.evaluate();
  return { api: module.namespace, counts: () => ({ created, destroyed }) };
}

test("photographic failures sanitize provider errors and allow independent retries", async () => {
  let calls = 0;
  const { api, counts } = await fixture(async (id, { accessToken }) => {
    assert.equal(id, 2275207);
    assert.equal(accessToken, "synthetic-sensitive-sentinel");
    calls++;
    throw new Error(
      "Synthetic provider URL ?token=synthetic-sensitive-sentinel",
    );
  });
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      () =>
        api.createRealityScene({}, null, {
          token: "synthetic-sensitive-sentinel",
        }),
      (error) => {
        assert.match(error.message, /could not connect/);
        assert.ok(!String(error).includes("sentinel"));
        assert.equal(error.cause, undefined);
        return true;
      },
    );
  assert.equal(calls, 2);
  assert.deepEqual(counts(), { created: 2, destroyed: 2 });
});

test("abort releases the Viewer immediately while provider metadata remains pending", async () => {
  let rejectMetadata, resourceStarted;
  const started = new Promise((resolve) => (resourceStarted = resolve));
  const { api, counts } = await fixture(() => {
    resourceStarted();
    return new Promise((resolve, reject) => (rejectMetadata = reject));
  });
  const controller = new AbortController();
  const connection = api.createRealityScene({}, null, {
    token: "synthetic-sensitive-sentinel",
    signal: controller.signal,
  });
  const rejected = assert.rejects(connection, /could not connect/);
  await started;
  assert.deepEqual(counts(), { created: 1, destroyed: 0 });
  controller.abort();
  assert.deepEqual(counts(), { created: 1, destroyed: 1 });
  rejectMetadata(new Error("synthetic delayed metadata failure"));
  await rejected;
  assert.deepEqual(counts(), { created: 1, destroyed: 1 });
});

test("already cancelled connections allocate no renderer; county coordinate round trips preserve positions", async () => {
  const { api, counts } = await fixture(() => {
    throw new Error("Unexpected request");
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      api.createRealityScene({}, null, {
        token: "synthetic-sensitive-sentinel",
        signal: controller.signal,
      }),
    /could not connect/,
  );
  assert.deepEqual(counts(), { created: 0, destroyed: 0 });
  for (const [x, z] of [
    [0, 0],
    [-47000, 26000],
    [6500, -29000],
  ]) {
    const geo = api.localToGeographic(x, z),
      local = api.geographicToLocal(geo.longitude, geo.latitude);
    assert.ok(Math.abs(local.x - x) < 1e-7);
    assert.ok(Math.abs(local.z - z) < 1e-7);
  }
  assert.equal(api.REALITY_CAPABILITIES.lightStudy, false);
  assert.equal(api.REALITY_CAPABILITIES.meshExport, false);
});

test("connection diagnostics reveal only a fixed phase and numeric HTTP status", async () => {
  const {api} = await fixture(()=>{});
  const provider = {statusCode:403, message:'sensitive-sentinel', response:'sensitive-sentinel', url:'https://example.invalid/?token=sensitive-sentinel'};
  const d = api.connectionDiagnostic('authorization',provider);
  assert.equal(d.phase,'authorization'); assert.equal(d.status,403);
  assert.match(d.message,/assets:read/); assert.ok(!JSON.stringify(d).includes('sentinel'));
  const unknown = api.connectionDiagnostic('sensitive-sentinel',{statusCode:'sensitive-sentinel'});
  assert.equal(unknown.phase,'unknown'); assert.equal(unknown.status,null);
  assert.ok(!JSON.stringify(unknown).includes('sentinel'));
  assert.match(api.connectionDiagnostic('renderer',provider).message,/WebGL/);
  assert.match(api.connectionDiagnostic('tileset',{statusCode:404}).message,/asset/);
});
