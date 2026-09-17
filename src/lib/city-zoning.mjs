/** Public zoning source contract, verified 2026-09-08. No development entitlements inferred. */
import { lookupParcel, parcelContainsPoint } from "./city-parcels.mjs";
const CITY_MAP = "https://maps9.stlouis-mo.gov/arcgis/rest/services/PDA/Zoning/MapServer";
const CITY_CODE = "https://library.municode.com/mo/st._louis/codes/code_of_ordinances?nodeId=TIT26ZO";
const COUNTY_CODE = "https://library.municode.com/mo/st._louis_county/codes/code_of_ordinances?nodeId=TITXPLZO_CH1003ZOOR";
const CITY_MAP_PAGE = "https://www.stlouis-mo.gov/government/departments/public-safety/building/zoning/zoning-map.cfm";
const COUNTY_MAP_PAGE = "https://www.arcgis.com/home/item.html?id=96445a00a5d84419b8f0034568570523";
const OVERLAY_PAGE = "https://www.stlouis-mo.gov/government/departments/planning/planning/zoning-overlay-districts.cfm";
const TERMS = "https://dynamic.stlouis-mo.gov/opendata/terms.cfm";
const citySource = (layer, fields) => ({
  url: `${CITY_MAP}/${layer}`, fields, jurisdiction: "st-louis-city",
  mapUrl: CITY_MAP_PAGE, codeUrl: CITY_CODE, termsUrl: TERMS,
  sourceDate: null, effectiveDate: null, verifiedAt: "2026-09-08",
  browserCors: false, dataDateMeaning: "Source data date not advertised",
});

export const ZONING_SOURCES = Object.freeze({
  "city-base": Object.freeze(citySource(3, "OBJECTID,HANDLE,LAYER")),
  "city-multi": Object.freeze(citySource(2, "OBJECTID,HANDLE,LAYER")),
  "city-overlays": Object.freeze(citySource(0, "OBJECTID,Name,UpDated,ORDINANCE,ItemType")),
  "county-jurisdictions": Object.freeze({
    url: "https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/AGS_Jurisdictions/FeatureServer/10",
    fields: "OBJECTID,MUNICIPALITY,MUNI,MUNICODE", jurisdiction: "st-louis-county",
    mapUrl: "https://www.arcgis.com/home/item.html?id=f0c580f0103d4819ae906005935d42f5",
    sourceDate: "2024-11-18T15:29:35.503Z", effectiveDate: null,
    verifiedAt: "2026-09-08", browserCors: true,
    dataDateMeaning: "Hosted layer dataLastEditDate; current legal boundaries unverified",
    redistribution: "No explicit redistribution grant in item metadata",
  }),
  "county-unincorporated": Object.freeze({
    url: "https://maps.stlouisco.com/hosting/rest/services/Maps/Zoning/FeatureServer/1",
    jurisdiction: "st-louis-county-unincorporated", mapUrl: COUNTY_MAP_PAGE,
    codeUrl: COUNTY_CODE, sourceDate: null, effectiveDate: null, verifiedAt: "2026-09-08",
    accessStatus: "unavailable", accessReason: "Official service returned HTTP 403; schema not verified",
    redistribution: "County open-data item reserves rights; no snapshot approved",
  }),
});

// Labels are descriptive metadata from City layer 3 and the official overlay page.
export const CITY_ZONING_DISTRICTS = Object.freeze({
  A: "Single-Family Dwelling District", B: "Two-Family Dwelling District",
  C: "Multiple-Family Dwelling District", D: "Multiple-Family Dwelling District",
  E: "Multiple-Family Dwelling District", F: "Neighborhood Commercial District",
  G: "Local Commercial and Office District", H: "Area Commercial District",
  I: "Central Business District", J: "Industrial District",
  K: "Unrestricted District", L: "Jefferson Memorial District",
});

export const ZONING_LIMITATIONS = Object.freeze([
  "District labels do not establish permitted development. Uses, overlays, variances, site conditions and later ordinances require verification with the zoning authority.",
  "A point query describes the selected point; it does not establish zoning across an entire parcel.",
  "Retrieval and GIS edit timestamps are not legal effective dates. City code codification can lag adopted ordinances.",
  "All incorporated County municipalities are unsupported for zoning rules; County zoning applies only to positively identified unincorporated areas.",
]);

const districtLabel = (code) => Object.hasOwn(CITY_ZONING_DISTRICTS, code) ? CITY_ZONING_DISTRICTS[code] : null;

function sourceFor(id) {
  const source = Object.hasOwn(ZONING_SOURCES, id) && ZONING_SOURCES[id];
  if (!source) throw new RangeError(`Unknown zoning source: ${id}`);
  return source;
}
function date(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function text(value) {
  return value === null || value === undefined ? null : String(value).trim() || null;
}
function rows(payload) {
  if (!payload || payload.error || payload.exceededTransferLimit || !Array.isArray(payload.features)) return null;
  if (!payload.features.every((f) => f && (f.attributes || f.properties))) return null;
  return payload.features.map((f) => f.attributes || f.properties);
}
function provenance(id, options = {}) {
  const source = sourceFor(id);
  return { sourceId: id, sourceUrl: source.url, mapUrl: source.mapUrl,
    sourceDate: source.sourceDate, effectiveDate: null,
    retrievedAt: date(options.retrievedAt), verifiedAt: source.verifiedAt };
}

/** Builds bounded, exact point-intersection requests; never uses a tolerance radius or raw SQL. */
export function zoningPointQueryUrl(sourceId, { lat, lon }) {
  const source = sourceFor(sourceId);
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new RangeError("Finite WGS84 latitude and longitude required");
  }
  if (!source.fields) throw new Error(source.accessReason || "Source query contract unverified");
  const url = new URL(`${source.url}/query`);
  url.search = new URLSearchParams({ f: "json", geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: source.fields, returnGeometry: "false", resultRecordCount: "100" }).toString();
  return url.toString();
}

/** Normalizes one verified source. Empty, failed and truncated requests are not 'unzoned'. */
export function normalizeZoningResponse(sourceId, payload, options = {}) {
  const source = sourceFor(sourceId);
  const p = provenance(sourceId, options);
  const result = { ...p, status: "unknown", districts: [], overlays: [],
    jurisdiction: source.jurisdiction, codeUrl: source.codeUrl || null, effectiveDate: null };
  if (source.accessStatus === "unavailable") return { ...result, status: "unavailable", reason: source.accessReason };
  if (sourceId === "county-jurisdictions") throw new Error("Use resolveZoningJurisdiction for boundary responses");
  const attributes = rows(payload);
  if (!attributes) return { ...result, status: "unavailable", reason: payload?.exceededTransferLimit ? "Query truncated" : "Missing, failed or malformed source response" };
  if (sourceId === "city-overlays") {
    result.overlays = attributes.map((a) => ({
      id: text(a.OBJECTID) === null ? null : `st-louis-city:overlay:${a.OBJECTID}`,
      label: text(a.Name), type: text(a.ItemType), ordinance: text(a.ORDINANCE),
      sourceDate: date(a.UpDated), effectiveDate: null, sourceUrl: source.url,
      codeUrl: OVERLAY_PAGE,
    }));
    result.status = result.overlays.length ? "matched" : "none-reported";
  } else {
    result.districts = attributes.map((a) => {
      const rawCode = text(a.LAYER);
      // City layer 2 renderer explicitly maps AM..LM to A..L.
      const code = sourceId === "city-multi" && /^[A-L]M$/.test(rawCode || "") ? rawCode[0] : rawCode;
      return { id: text(a.OBJECTID) === null ? null : `st-louis-city:${sourceId}:${a.OBJECTID}`,
        parcelHandle: text(a.HANDLE), code, rawCode, label: districtLabel(code),
        sourceUrl: source.url, codeUrl: CITY_CODE, sourceDate: null, effectiveDate: null };
    });
    const codes = new Set(result.districts.map((d) => d.code).filter((c) => districtLabel(c)));
    result.status = result.districts.length && result.districts.every((d) => d.label)
      ? codes.size > 1 ? "ambiguous" : "matched" : "unknown";
  }
  return result;
}

/**
 * All inputs are official spatial query responses, not parcel postal-city fields.
 * cityBoundary and countyBoundary must be complete point queries on those boundaries.
 * A dated County municipality match is evidence with its date, not a current annexation certification.
 */
export function resolveZoningJurisdiction({ cityBoundary, countyBoundary, countyJurisdictions } = {}, options = {}) {
  const city = rows(cityBoundary), county = rows(countyBoundary), municipalities = rows(countyJurisdictions);
  const observed = municipalities || [];
  const municipalityNames = [...new Set(observed.map((a) => text(a.MUNICIPALITY)).filter(Boolean))];
  const cityHit = city !== null && city.length > 0;
  const countyHits = observed.filter((a) => text(a.MUNI) !== "STL");
  const p = provenance("county-jurisdictions", options);
  if ((cityHit && (county?.length || countyHits.length)) || municipalityNames.length > 1) {
    return { status: "ambiguous", id: null, label: "Jurisdiction boundary ambiguity", evidence: p };
  }
  if (cityHit) return { status: "supported", id: "st-louis-city", label: "City of St. Louis", codeUrl: CITY_CODE, mapUrl: CITY_MAP_PAGE };
  if (observed.length) {
    // Demand agreement between the named jurisdiction and official code, retaining unknowns.
    if (observed.every((a) => text(a.MUNI) === "UNI" && text(a.MUNICIPALITY) === "UNINCORPORATED")) {
      return { status: "supported", id: "st-louis-county-unincorporated", label: "Unincorporated St. Louis County", codeUrl: COUNTY_CODE, mapUrl: COUNTY_MAP_PAGE, evidence: p };
    }
    if (observed.every((a) => text(a.MUNI) && !["UNI", "STL", "WPD"].includes(text(a.MUNI)) && text(a.MUNICIPALITY) && text(a.MUNICIPALITY) !== "UNINCORPORATED")) {
      return { status: "unsupported-municipality", id: `st-louis-county-municipality:${text(observed[0].MUNI)}`,
        label: municipalityNames[0], codeUrl: null, mapUrl: p.mapUrl, evidence: p,
        reason: "This municipality's official zoning map and rules are not implemented" };
    }
  }
  if (city !== null && county !== null && city.length === 0 && county.length === 0 && observed.length === 0) {
    return { status: "outside-coverage", id: null, label: "Outside City and County boundaries" };
  }
  return { status: "unknown", id: null, label: "Jurisdiction not established", evidence: p,
    reason: "No positive supported jurisdiction match; absence of a municipality match does not establish unincorporated status" };
}

/** Assemble City base/multi/overlay results, preserving source failures and legal limits. */
export function combineZoningResults(jurisdiction, { base, multi, overlays } = {}) {
  const result = { status: "unknown", jurisdiction: jurisdiction || null,
    districts: [], overlays: [], codeUrl: jurisdiction?.codeUrl || null,
    mapUrl: jurisdiction?.mapUrl || null, permittedDevelopment: null,
    effectiveDate: null, limitations: [...ZONING_LIMITATIONS], complete: false };
  if (!jurisdiction || jurisdiction.status !== "supported") {
    return { ...result, status: jurisdiction?.status === "supported" ? "unknown" : jurisdiction?.status || "unknown" };
  }
  if (jurisdiction.id === "st-louis-county-unincorporated") {
    return { ...result, status: "unavailable", reason: ZONING_SOURCES["county-unincorporated"].accessReason };
  }
  if (jurisdiction.id !== "st-louis-city") return result;
  const validBase = base?.sourceId === "city-base" ? base : undefined;
  const validMulti = multi?.sourceId === "city-multi" ? multi : undefined;
  const validOverlays = overlays?.sourceId === "city-overlays" ? overlays : undefined;
  result.districts = [...(validBase?.districts || []), ...(validMulti?.districts || [])];
  result.overlays = validOverlays?.overlays || [];
  result.overlayStatus = validOverlays?.status || "unknown";
  result.sources = [validBase, validMulti, validOverlays].filter(Boolean).map(({ districts, overlays, ...p }) => p);
  result.complete = Boolean(validBase && validMulti && validOverlays && result.sources.every((s) => s.status !== "unavailable"));
  const codes = new Set(result.districts.map((d) => d.code));
  result.status = result.districts.length && result.districts.every((d) => d.label)
    ? codes.size > 1 ? "ambiguous" : "matched"
    : result.sources.some((s) => s.status === "unavailable") ? "unavailable" : "unknown";
  if (!result.complete) result.limitations.push("One or more source queries are missing or unavailable; overlay and district coverage is incomplete.");
  return result;
}

/** Browser lookup for static publication. Inject transport and parcel lookup for deterministic tests. */
export function createZoningLookup({
  manifestUrl = "/st-louis/zoning/manifest.json",
  fetchImpl = (...args) => fetch(...args), parcelLookup = lookupParcel,
  jurisdictionTimeoutMs = 6500,
} = {}) {
  let snapshotPromise;
  const read = async (url, signal) => {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) throw new Error("Zoning source unavailable");
    return response.json();
  };
  // A shared immutable download belongs to the cache, never to its first caller.
  const snapshot = () => {
    if (!snapshotPromise) snapshotPromise = (async () => {
      const manifest = await read(manifestUrl);
      if (manifest?.schema !== "st-louis-zoning-v1" || !manifest.base?.url || !manifest.multi?.url || !manifest.overlays?.url) throw new Error("Invalid zoning snapshot");
      const [base, multi, overlays] = await Promise.all([manifest.base, manifest.multi, manifest.overlays].map((s) => read(s.url)));
      if (!base?.byHandle || !Array.isArray(multi?.features) || !Array.isArray(overlays?.features)) throw new Error("Invalid zoning data");
      return { manifest, base, multi, overlays };
    })().catch((error) => { snapshotPromise = null; throw error; });
    return snapshotPromise;
  };
  return async function lookupZoning(point, { parcelResult, signal } = {}) {
    const coordinates = { lat: point?.latitude, lon: point?.longitude };
    try { zoningPointQueryUrl("city-base", coordinates); }
    catch { return { ...combineZoningResults(null), status: "unavailable", reason: "invalid-coordinate" }; }
    const checkAbort = () => { if (signal?.aborted) throw new DOMException("Lookup aborted", "AbortError"); };
    checkAbort();
    const parcels = parcelResult || await parcelLookup(point);
    checkAbort();
    if (parcels?.reason === "outside-city" || parcels?.source?.jurisdiction === "st-louis-county" || parcels?.parcel?.properties?.jurisdiction === "st-louis-county") {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, jurisdictionTimeoutMs);
      try {
        const payload = await read(zoningPointQueryUrl("county-jurisdictions", coordinates), controller.signal);
        checkAbort();
        const jurisdiction = resolveZoningJurisdiction({ countyJurisdictions: payload }, { retrievedAt: new Date().toISOString() });
        const report = combineZoningResults(jurisdiction);
        report.limitations.push("County jurisdiction evidence is a hosted 2024-11-18 boundary snapshot; subsequent boundary changes are unverified.");
        return report;
      } catch (error) {
        checkAbort();
        return { ...combineZoningResults(null), status: "unknown", reason: "county-jurisdiction-unavailable",
          mapUrl: COUNTY_MAP_PAGE, limitations: [...ZONING_LIMITATIONS, "County jurisdiction lookup failed; no municipal or County rules were substituted."] };
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
    }
    if (!["found", "not-found"].includes(parcels?.status)) {
      return { ...combineZoningResults(null), status: "unavailable", reason: "parcel-coverage-unavailable" };
    }
    // County results are routed above; City results require the exact City coverage check.
    const jurisdiction = resolveZoningJurisdiction({ cityBoundary: { features: [{ attributes: {} }] } });
    let data;
    try { data = await snapshot(); checkAbort(); }
    catch (error) {
      checkAbort();
      return { ...combineZoningResults(jurisdiction), status: "unavailable", reason: "zoning-snapshot-unavailable" };
    }
    const candidates = parcels.parcel ? [parcels.parcel] : parcels.candidates || [];
    const handles = [...new Set(candidates.map((f) => text(f.properties?.handle)).filter(Boolean))];
    const multiFeatures = data.multi.features.filter((f) => parcelContainsPoint(f.geometry, point));
    const multiHandles = new Set(multiFeatures.map((f) => text(f.properties?.HANDLE)));
    const baseRows = handles.flatMap((handle) => (data.base.byHandle[handle] || []).map(([OBJECTID, LAYER]) => ({ OBJECTID, HANDLE: handle, LAYER })));
    // Numeric split markers are not districts. Preserve them in the report; use independently
    // intersected multi geometry to resolve a code only for that same parcel HANDLE.
    const resolvedBaseRows = baseRows.filter((row) => districtLabel(row.LAYER) || !multiHandles.has(row.HANDLE));
    const options = { retrievedAt: data.manifest.retrievedAt };
    const report = combineZoningResults(jurisdiction, {
      base: normalizeZoningResponse("city-base", { features: resolvedBaseRows.map((attributes) => ({ attributes })) }, options),
      multi: normalizeZoningResponse("city-multi", { features: multiFeatures }, options),
      overlays: normalizeZoningResponse("city-overlays", { features: data.overlays.features.filter((f) => parcelContainsPoint(f.geometry, point)) }, options),
    });
    report.retrievedAt = date(data.manifest.retrievedAt);
    report.sourceDate = null;
    report.baseAssignment = "Official zoning source joined to official parcel geometry by HANDLE";
    report.rawBaseCodes = baseRows.map((row) => ({ handle: row.HANDLE, code: row.LAYER }));
    report.parcelAmbiguous = Boolean(parcels.ambiguous);
    report.parcelCandidates = candidates.map((f) => ({ parcelKey: f.properties?.parcelKey, recordKey: f.properties?.recordKey, handle: f.properties?.handle, parcelId: f.properties?.parcelId }));
    report.termsUrl = data.manifest.termsUrl;
    if (report.parcelAmbiguous) report.limitations.push("Multiple official parcel accounts intersect the selected point; their district assignments are retained together.");
    if (!handles.length) report.limitations.push("No covered parcel was found at this City point; base zoning is unknown even if an overlay intersects.");
    return report;
  };
}

export const lookupZoning = createZoningLookup();
