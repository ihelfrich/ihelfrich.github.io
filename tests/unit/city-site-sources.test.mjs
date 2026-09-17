import test from "node:test";
import assert from "node:assert/strict";
import { createSiteSourceLoader } from "../../src/lib/city-site-sources.mjs";

const NOW = Date.parse("2026-09-09T04:00:00Z");
const points = [{ longitude: -90.211, latitude: 38.617 }, { longitude: -90.2109, latitude: 38.6171 }];
const attributes = { Name: "MO_SaintLouis_2017", ProductName: "USGS_3DEP", Source: "USGS", VerticalDatum: "North American Vertical Datum of 1988 (NAVD 88)", AcquisitionDate: 1488153600000, StartDate: 20170217, EndDate: "20170227", URL: "https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/MO_SaintLouis_2017/TIFF/example.tif" };
const sample = (index, value = "157.02", extra = {}) => ({ location: { x: points[index].longitude, y: points[index].latitude, spatialReference: { wkid: 4326 } }, locationId: index, value, rasterId: 75536, resolution: 1, attributes, ...extra });
const floodBody = { features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "AREA OF MINIMAL FLOOD HAZARD", SFHA_TF: "F", STATIC_BFE: -9999, LEN_UNIT: "FEET", V_DATUM: null, SOURCE_CIT: "290385_STUDY1", DFIRM_ID: "290385" } }] };
const response = (body, options) => new Response(JSON.stringify(body), options);
function fixture({ terrain = { samples: [sample(1, "158"), sample(0)] }, flood = floodBody, terrainResponse, floodResponse, ...options } = {}) {
  const calls = [];
  const loader = createSiteSourceLoader({ now: () => NOW, fetchImpl: async (url, init) => { calls.push({ url, init }); return String(url).includes("getSamples") ? (terrainResponse ? terrainResponse() : response(terrain)) : (floodResponse ? floodResponse() : response(flood)); }, ...options });
  return { loader, calls };
}

test("small authoritative requests preserve source dates, units and requested sample order", async () => {
  const h = fixture(), result = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(result.terrain.status, "ready");
  assert.equal(result.terrain.units, "m");
  assert.deepEqual(result.terrain.samples.map((s) => s.elevationMetres), [157.02, 158]);
  assert.equal(result.terrain.sources[0].project, "MO_SaintLouis_2017");
  assert.equal(result.terrain.sources[0].resolutionMetres, 1);
  assert.equal(result.terrain.sources[0].startDate, "2017-02-17");
  assert.equal(result.terrain.sources[0].endDate, "2017-02-27");
  assert.equal(result.terrain.sources[0].acquisitionDate, "2017-02-27");
  assert.equal(result.terrain.fetchedAt, "2026-09-09T04:00:00.000Z");
  assert.equal(result.flood.status, "ready");
  assert.equal(result.flood.coverage, "selected point");
  assert.equal(result.flood.effectiveDate, null);
  assert.equal(result.flood.zones[0].baseFloodElevation, null);
  assert.equal(result.flood.zones[0].specialFloodHazardArea, false);
  assert.equal(h.calls.length, 2);
  const request = new URL(h.calls.find((x) => x.url.includes("getSamples")).url);
  assert.equal(request.hostname, "elevation.nationalmap.gov");
  assert.equal(request.searchParams.get("interpolation"), "RSP_BilinearInterpolation");
  assert.equal(JSON.parse(request.searchParams.get("geometry")).points.length, 2);
  for (const call of h.calls) assert.equal(call.init.credentials, "omit");
});

test("NoData, absent and malformed values remain missing instead of elevation zero", async () => {
  for (const value of ["NoData", "", null, "1,2", "0x10", "NaN", "-3.402823466e38"]) {
    const h = fixture({ terrain: { samples: [sample(0, value)] } });
    const { terrain } = await h.loader({ points, selectedPoint: points[0] });
    assert.equal(terrain.status, "unavailable");
    assert.deepEqual(terrain.samples.map((s) => s.elevationMetres), [null, null]);
    assert.equal(terrain.availableCount, 0);
  }
  const h = fixture({ terrain: { samples: [sample(0, "0")] } });
  const { terrain } = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(terrain.status, "partial");
  assert.deepEqual(terrain.samples.map((s) => s.elevationMetres), [0, null]);
});

test("unknown source units or conflicting vertical datums cannot become a terrain grade input", async () => {
  const unknown = fixture({ terrain: { samples: [sample(0, "157", { attributes: { Name: "Unknown source" } })] } });
  const result = await unknown.loader({ points, selectedPoint: points[0] });
  assert.equal(result.terrain.units, null);
  assert.equal(result.terrain.samples[0].elevationMetres, null);
  assert.equal(result.terrain.sources[0].project, "Unknown source");
  const conflict = fixture({ terrain: { samples: [sample(0), sample(1, "158", { rasterId: 2, attributes: { ...attributes, Name: "Second project", VerticalDatum: "NGVD 29" } })] } });
  const mixed = await conflict.loader({ points, selectedPoint: points[0] });
  assert.equal(mixed.terrain.status, "unavailable");
  assert.ok(mixed.terrain.samples.every((s) => s.elevationMetres === null));
  assert.match(mixed.terrain.reason, /datum/i);
});

test("the actual mosaic provenance is retained for other projects without applying a fixed local date", async () => {
  const h = fixture({ terrain: { samples: [sample(0, "150", { rasterId: 900, resolution: 10, attributes: { ...attributes, Name: "Another_Project", StartDate: null, EndDate: null, AcquisitionDate: null, URL: "https://untrusted.example/record" } })] } });
  const { terrain } = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(terrain.sources[0].project, "Another_Project");
  assert.equal(terrain.sources[0].resolutionMetres, 10);
  assert.equal(terrain.sources[0].startDate, null);
  assert.equal(terrain.sources[0].url, null);
});

test("duplicate IDs, coordinate mismatches, and wrong coordinate reference do not silently remap samples", async () => {
  for (const bad of [sample(0, "158", { location: { x: -90, y: 38 } }), sample(0, "158", { location: { ...sample(0).location, spatialReference: { wkid: 3857 } } })]) {
    const h = fixture({ terrain: { samples: [bad, sample(1)] } });
    const { terrain } = await h.loader({ points, selectedPoint: points[0] });
    assert.equal(terrain.samples[0].elevationMetres, null);
    assert.equal(terrain.samples[1].elevationMetres, 157.02);
  }
  const h = fixture({ terrain: { samples: [sample(0), sample(0, "159"), sample(1)] } });
  const { terrain } = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(terrain.samples[0].elevationMetres, null);
});

test("terrain failure and a FEMA empty response remain independent unavailable states", async () => {
  const h = fixture({ terrain: { error: { code: 400, message: "raw-source-diagnostic" } }, flood: { features: [] } });
  const result = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(result.terrain.status, "unavailable");
  assert.equal(result.flood.status, "unavailable");
  assert.equal(result.flood.zones.length, 0);
  assert.equal(JSON.stringify(result).includes("raw-source-diagnostic"), false);
  const workingFlood = fixture({ terrainResponse: () => response({}, { status: 503 }) });
  const independent = await workingFlood.loader({ points, selectedPoint: points[0] });
  assert.equal(independent.terrain.status, "unavailable");
  assert.equal(independent.flood.status, "ready");
});

test("flood classification keeps multiple zones, explicit units, missingness, and rejects truncation", async () => {
  const flood = { features: [...floodBody.features, { attributes: { FLD_ZONE: "AE", ZONE_SUBTY: null, SFHA_TF: "T", STATIC_BFE: 432.5, LEN_UNIT: "FEET", V_DATUM: "NAVD88", DFIRM_ID: "other", SOURCE_CIT: "citation" } }] };
  const h = fixture({ flood }), { flood: data } = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(data.zones.length, 2);
  const ae = data.zones.find((z) => z.zone === "AE");
  assert.equal(ae.specialFloodHazardArea, true);
  assert.equal(ae.baseFloodElevation, 432.5);
  assert.equal(ae.baseFloodElevationUnits, "FEET");
  const truncated = fixture({ flood: { ...flood, exceededTransferLimit: true } });
  assert.equal((await truncated.loader({ points, selectedPoint: points[0] })).flood.status, "unavailable");
  const missing = fixture({ flood: { features: [{ attributes: { FLD_ZONE: "AE", SFHA_TF: "?", STATIC_BFE: 420, LEN_UNIT: null } }] } });
  const zone = (await missing.loader({ points, selectedPoint: points[0] })).flood.zones[0];
  assert.equal(zone.specialFloodHazardArea, null);
  assert.equal(zone.baseFloodElevation, null);
});

test("oversized stream and malformed JSON are bounded failures without dropping the other source", async () => {
  const tooLarge = fixture({ maxResponseBytes: 5000, terrainResponse: () => new Response("x".repeat(5001)) });
  const result = await tooLarge.loader({ points, selectedPoint: points[0] });
  assert.equal(result.terrain.status, "unavailable");
  assert.equal(result.flood.status, "ready");
  const malformed = fixture({ terrainResponse: () => new Response("{"), floodResponse: () => new Response("", { status: 403 }) });
  const bad = await malformed.loader({ points, selectedPoint: points[0] });
  assert.equal(bad.terrain.status, "unavailable");
  assert.equal(bad.flood.status, "unavailable");
});

test("invalid bounds or too many points prevent that source request only", async () => {
  const h = fixture();
  const tooMany = await h.loader({ points: Array.from({ length: 26 }, () => points[0]), selectedPoint: points[0] });
  assert.equal(tooMany.terrain.status, "unavailable");
  assert.equal(tooMany.flood.status, "ready");
  assert.equal(h.calls.length, 1);
  const badPoint = fixture();
  const invalid = await badPoint.loader({ points, selectedPoint: { longitude: 200, latitude: 0 } });
  assert.equal(invalid.terrain.status, "ready");
  assert.equal(invalid.flood.status, "unavailable");
  assert.equal(badPoint.calls.length, 1);
  const noGrid = fixture();
  const narrow = await noGrid.loader({ points: [], selectedPoint: points[0] });
  assert.equal(narrow.terrain.status, "unavailable");
  assert.equal(narrow.terrain.requestedCount, 0);
  assert.equal(narrow.flood.status, "ready");
  assert.equal(noGrid.calls.length, 1);
});

test("zero and negative DEM heights remain valid, and invalid calendar dates remain unknown", async () => {
  const h = fixture({ terrain: { samples: [sample(0, "-4.25", { attributes: { ...attributes, StartDate: 20170230, EndDate: "invalid", AcquisitionDate: null } }), sample(1, "0")] } });
  const { terrain } = await h.loader({ points, selectedPoint: points[0] });
  assert.equal(terrain.status, "ready");
  assert.deepEqual(terrain.samples.map((s) => s.elevationMetres), [-4.25, 0]);
  const source = terrain.sources[0];
  assert.equal(source.startDate, null);
  assert.equal(source.endDate, null);
  assert.equal(source.acquisitionDate, null);
  assert.equal(source.metadataConflict, true);
});

test("timeouts finish even if a provider ignores abort, and an aborted caller starts no requests", async () => {
  const loader = createSiteSourceLoader({ fetchImpl: () => new Promise(() => {}), now: () => NOW, timeoutMs: 5 });
  const result = await loader({ points, selectedPoint: points[0] });
  assert.equal(result.terrain.status, "unavailable");
  assert.match(result.terrain.reason, /timed out/i);
  const h = fixture(), controller = new AbortController();
  controller.abort();
  const aborted = await h.loader({ points, selectedPoint: points[0] }, { signal: controller.signal });
  assert.equal(aborted.terrain.status, "unavailable");
  assert.equal(h.calls.length, 0);
});
