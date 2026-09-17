import { test } from "node:test";
import assert from "node:assert/strict";
import { ZONING_SOURCES, zoningPointQueryUrl, normalizeZoningResponse, resolveZoningJurisdiction, combineZoningResults } from "../../src/lib/city-zoning.mjs";
const response = (...attributes) => ({ features: attributes.map((a) => ({ attributes: a })) });
const city = () => resolveZoningJurisdiction({ cityBoundary: response({ OBJECTID: 1 }) });
const normalize = (id, payload) => normalizeZoningResponse(id, payload, { retrievedAt: "2026-09-08T23:00:00Z" });

test("exact WGS84 point query is bounded and has no nearest-district tolerance", () => {
  const url = new URL(zoningPointQueryUrl("city-base", { lat: 38.626, lon: -90.2006 }));
  assert.equal(url.pathname, "/arcgis/rest/services/PDA/Zoning/MapServer/3/query");
  assert.equal(url.searchParams.get("geometry"), "-90.2006,38.626");
  assert.equal(url.searchParams.get("spatialRel"), "esriSpatialRelIntersects");
  assert.equal(url.searchParams.get("resultRecordCount"), "100");
  assert.equal(url.searchParams.has("distance"), false);
  for (const lat of [NaN, Infinity, "38.6", 91]) assert.throws(() => zoningPointQueryUrl("city-base", { lat, lon: -90 }));
  assert.throws(() => zoningPointQueryUrl("county-unincorporated", { lat: 38, lon: -90 }), /not verified/);
});

test("live City Hall sample retains source handle and unknown legal date", () => {
  const r = normalize("city-base", response({ OBJECTID: 17035956, HANDLE: "10207000011", LAYER: "I" }));
  assert.equal(r.status, "matched");
  assert.equal(r.districts[0].parcelHandle, "10207000011");
  assert.equal(r.districts[0].code, "I");
  assert.equal(r.sourceDate, null);
  assert.equal(r.effectiveDate, null);
  assert.equal(r.retrievedAt, "2026-09-08T23:00:00.000Z");
});

test("multi-zone renderer suffix is normalized only on verified multi layer", () => {
  const r = normalize("city-multi", response({ OBJECTID: 154345, HANDLE: "10337000010", LAYER: "JM" }, { OBJECTID: 154346, HANDLE: "10337000010", LAYER: "KM" }));
  assert.equal(r.status, "ambiguous");
  assert.deepEqual(r.districts.map((x) => x.code), ["J", "K"]);
  assert.equal(normalize("city-base", response({ LAYER: "JM" })).status, "unknown");
});

test("Forest Park Southeast overlay keeps GIS date separate from effective ordinance date", () => {
  const r = normalize("city-overlays", response({ OBJECTID: 7, Name: "Forest Park Southeast FBD", UpDated: 1596717163000, ORDINANCE: "70732", ItemType: "FBD" }));
  assert.equal(r.overlays[0].ordinance, "70732");
  assert.equal(r.overlays[0].sourceDate, "2020-08-06T12:32:43.000Z");
  assert.equal(r.overlays[0].effectiveDate, null);
  assert.match(r.overlays[0].codeUrl, /zoning-overlay-districts/);
});

test("empty, malformed and truncated responses cannot establish no zoning", () => {
  assert.equal(normalize("city-base", response()).status, "unknown");
  assert.equal(normalize("city-overlays", response()).status, "none-reported");
  for (const payload of [null, {}, { error: { code: 403 } }, { features: [{}] }, { features: [], exceededTransferLimit: true }]) {
    assert.equal(normalize("city-base", payload).status, "unavailable");
  }
  for (const LAYER of ["NEW", "toString", "__proto__"]) assert.equal(normalize("city-base", response({ LAYER })).status, "unknown");
});

test("Clayton jurisdiction sample is unsupported and never uses County zoning code", () => {
  const jurisdiction = resolveZoningJurisdiction({ countyJurisdictions: response({ OBJECTID: 100, MUNICIPALITY: "CLAYTON", MUNI: "CLY", MUNICODE: "014" }) });
  assert.equal(jurisdiction.status, "unsupported-municipality");
  assert.equal(jurisdiction.codeUrl, null);
  const result = combineZoningResults(jurisdiction, { base: normalize("city-base", response({ LAYER: "A" })) });
  assert.equal(result.status, "unsupported-municipality");
  assert.equal(result.districts.length, 0);
});

test("positive Mehlville unincorporated sample retains boundary date but zoning unavailable", () => {
  const jurisdiction = resolveZoningJurisdiction({ countyJurisdictions: response({ OBJECTID: 122, MUNICIPALITY: "UNINCORPORATED", MUNI: "UNI", MUNICODE: "000" }) });
  assert.equal(jurisdiction.id, "st-louis-county-unincorporated");
  assert.equal(jurisdiction.evidence.sourceDate, ZONING_SOURCES["county-jurisdictions"].sourceDate);
  assert.equal(combineZoningResults(jurisdiction).status, "unavailable");
  assert.equal(normalize("county-unincorporated", response({ ZONING: "R-1" })).status, "unavailable");
});

test("absence and county membership never infer unincorporated jurisdiction", () => {
  assert.equal(resolveZoningJurisdiction({ countyBoundary: response({}), countyJurisdictions: response() }).status, "unknown");
  assert.equal(resolveZoningJurisdiction({ cityBoundary: { error: {} }, countyBoundary: response() }).status, "unknown");
  assert.equal(resolveZoningJurisdiction({ cityBoundary: response(), countyBoundary: response(), countyJurisdictions: response() }).status, "outside-coverage");
  assert.equal(resolveZoningJurisdiction({ countyJurisdictions: response({ MUNICIPALITY: "CLAYTON", MUNI: "UNI" }) }).status, "unknown");
});

test("overlapping jurisdiction evidence remains ambiguous", () => {
  const unincorp = { MUNICIPALITY: "UNINCORPORATED", MUNI: "UNI" };
  const clayton = { MUNICIPALITY: "CLAYTON", MUNI: "CLY" };
  assert.equal(resolveZoningJurisdiction({ countyJurisdictions: response(unincorp, clayton) }).status, "ambiguous");
  assert.equal(resolveZoningJurisdiction({ cityBoundary: response({}), countyJurisdictions: response(clayton) }).status, "ambiguous");
});

test("combined report does not erase failed overlay query or infer development permission", () => {
  const base = normalize("city-base", response({ OBJECTID: 1, LAYER: "I" }));
  const multi = normalize("city-multi", response());
  const overlays = normalize("city-overlays", { error: { code: 503 } });
  const report = combineZoningResults(city(), { base, multi, overlays });
  assert.equal(report.status, "matched");
  assert.equal(report.complete, false);
  assert.equal(report.overlayStatus, "unavailable");
  assert.equal(report.permittedDevelopment, null);
  assert.equal(combineZoningResults(city(), { base, multi, overlays: normalize("city-overlays", response()) }).complete, true);
});

import { createZoningLookup } from "../../src/lib/city-zoning.mjs";
const point = { longitude: -90.2, latitude: 38.6 };
const polygon = { type: "Polygon", coordinates: [[[-90.21,38.59],[-90.19,38.59],[-90.19,38.61],[-90.21,38.61],[-90.21,38.59]]] };
const feature = (properties, geometry = polygon) => ({ type: "Feature", properties, geometry });
function transport({ base = { byHandle: { h: [[1,"I"]] } }, multi = [], overlays = [], jurisdiction = response() } = {}) {
  const fixtures = {
    "/st-louis/zoning/manifest.json": { schema: "st-louis-zoning-v1", retrievedAt: "2026-09-08T23:00:00Z", base: { url: "/base" }, multi: { url: "/multi" }, overlays: { url: "/overlays" } },
    "/base": base, "/multi": { features: multi }, "/overlays": { features: overlays },
  };
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { ok: true, json: async () => fixtures[url] || jurisdiction }; };
  return { fetchImpl, calls };
}
const parcelResult = { status: "found", parcel: feature({ handle: "h", parcelKey: "st-louis-city:h", recordKey: "st-louis-city:h:p:1" }), ambiguous: false };

test("static City lookup uses same-origin snapshot and source dates without remote City query", async () => {
  const { fetchImpl, calls } = transport();
  const lookup = createZoningLookup({ fetchImpl });
  const result = await lookup(point, { parcelResult });
  assert.equal(result.status, "matched");
  assert.equal(result.districts[0].code, "I");
  assert.equal(result.retrievedAt, "2026-09-08T23:00:00.000Z");
  assert.equal(result.effectiveDate, null);
  assert.equal(calls.length, 4);
  assert.ok(calls.every((u) => u.startsWith("/")));
  await lookup(point, { parcelResult });
  assert.equal(calls.length, 4);
});

test("split parcel uses intersected multi geometry and retains original non-district marker", async () => {
  const { fetchImpl } = transport({ base: { byHandle: { h: [[1,"2"]] } }, multi: [feature({ OBJECTID: 2, HANDLE: "h", LAYER: "JM" })] });
  const result = await createZoningLookup({ fetchImpl })(point, { parcelResult });
  assert.equal(result.status, "matched");
  assert.equal(result.districts[0].code, "J");
  assert.deepEqual(result.rawBaseCodes, [{ handle: "h", code: "2" }]);
});

test("multiple account ambiguity survives even with one shared district", async () => {
  const { fetchImpl } = transport();
  const candidates = [feature({ handle: "h", recordKey: "first" }), feature({ handle: "h", recordKey: "second" })];
  const result = await createZoningLookup({ fetchImpl })(point, { parcelResult: { status: "found", candidates, parcel: null, ambiguous: true } });
  assert.equal(result.status, "matched");
  assert.equal(result.parcelAmbiguous, true);
  assert.equal(result.parcelCandidates.length, 2);
  assert.equal(result.districts.length, 1);
});

test("City point with no parcel never invents base district", async () => {
  const { fetchImpl } = transport();
  const result = await createZoningLookup({ fetchImpl })(point, { parcelResult: { status: "not-found", candidates: [] } });
  assert.equal(result.status, "unknown");
  assert.equal(result.districts.length, 0);
});

test("async County routing requires positive boundary response and never loads City districts", async () => {
  const { fetchImpl, calls } = transport({ jurisdiction: response({ MUNICIPALITY: "CLAYTON", MUNI: "CLY" }) });
  const result = await createZoningLookup({ fetchImpl })(point, { parcelResult: { status: "unsupported", reason: "outside-city" } });
  assert.equal(result.status, "unsupported-municipality");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /AGS_Jurisdictions/);
  assert.equal(result.codeUrl, null);
});

test("failed County jurisdiction request remains unknown and an aborted lookup rejects", async () => {
  const lookup = createZoningLookup({ fetchImpl: async () => { throw new Error("offline"); } });
  const result = await lookup(point, { parcelResult: { status: "unsupported", reason: "outside-city" } });
  assert.equal(result.status, "unknown");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => lookup(point, { parcelResult, signal: controller.signal }), { name: "AbortError" });
});

test("aborting the first selection cannot cancel the shared snapshot for a later selection", async () => {
  const fixture = transport();
  let releaseManifest;
  const gate = new Promise((resolve) => { releaseManifest = resolve; });
  let manifestRequests = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(options.signal, undefined, "Shared City downloads must not inherit a selection signal");
    if (url === "/st-louis/zoning/manifest.json") { manifestRequests++; await gate; }
    return fixture.fetchImpl(url);
  };
  const lookup = createZoningLookup({ fetchImpl });
  const firstController = new AbortController();
  const first = lookup(point, { parcelResult, signal: firstController.signal });
  const firstRejected = assert.rejects(first, { name: "AbortError" });
  const second = lookup(point, { parcelResult });
  firstController.abort();
  releaseManifest();
  await firstRejected;
  const secondResult = await second;
  assert.equal(secondResult.status, "matched");
  assert.equal(secondResult.districts[0].code, "I");
  assert.equal(manifestRequests, 1);
  assert.equal(fixture.calls.length, 4);
});
test('a found County parcel cannot be misclassified as City zoning evidence', async () => {
  const {fetchImpl,calls}=transport({jurisdiction:response({MUNICIPALITY:'OVERLAND',MUNI:'OVR'})});
  const result=await createZoningLookup({fetchImpl})(point,{parcelResult:{status:'found',source:{jurisdiction:'st-louis-county'},parcel:{properties:{jurisdiction:'st-louis-county',handle:'county-handle'}}}});
  assert.equal(result.status,'unsupported-municipality');assert.equal(result.jurisdiction.label,'OVERLAND');assert.equal(result.districts.length,0);assert.equal(calls.length,1);assert.ok(!calls.includes('/st-louis/zoning/manifest.json'));
});
