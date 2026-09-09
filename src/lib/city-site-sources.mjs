const TERRAIN_URL = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer";
const FLOOD_URL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28";
const MAX_POINTS = 25;
const MAX_BYTES = 2 * 1024 * 1024;
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const pointValid = (point) => Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude) && Math.abs(point.longitude) <= 180 && Math.abs(point.latitude) <= 90;
const text = (value, max = 200) => typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
const numeric = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !NUMERIC.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const calendarDate = (value) => {
  const digits = String(value ?? "");
  if (!/^\d{8}$/u.test(digits)) return null;
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().startsWith(date) ? date : null;
};
const epochDate = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString().slice(0, 10) : null;
};
const sourceLink = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && ["prd-tnm.s3.amazonaws.com", "rockyweb.usgs.gov", "www.usgs.gov"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
};
const datumKey = (value) => {
  if (!value) return null;
  const compact = value.toLowerCase().replace(/[^a-z0-9]/gu, "");
  return compact.includes("navd88") || compact.includes("northamericanverticaldatumof1988") ? "navd88" : compact;
};
class SourceFailure extends Error {}

async function boundedJson(url, { fetchImpl, signal, timeoutMs, maxBytes }) {
  const abort = new AbortController();
  let timer, onAbort;
  const stopped = new Promise((_, reject) => {
    onAbort = () => {
      abort.abort();
      reject(new SourceFailure("The source request was canceled."));
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      abort.abort();
      reject(new SourceFailure("The source request timed out."));
    }, timeoutMs);
  });
  const request = async () => {
    if (signal?.aborted) throw new SourceFailure("The source request was canceled.");
    const response = await fetchImpl(url, { signal: abort.signal, mode: "cors", credentials: "omit", headers: { Accept: "application/json" } });
    if (!response.ok) throw new SourceFailure(`The source is unavailable (HTTP ${response.status}).`);
    const declaredLength = Number(response.headers?.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new SourceFailure("The source response exceeded the size limit.");
    if (!response.body?.getReader) throw new SourceFailure("The source response could not be read safely.");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, body = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => {});
          throw new SourceFailure("The source response exceeded the size limit.");
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    let payload;
    try { payload = JSON.parse(body); } catch { throw new SourceFailure("The source returned an unreadable response."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.error) throw new SourceFailure("The source could not supply data for this location.");
    return payload;
  };
  try { return await Promise.race([request(), stopped]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function terrainResult(payload, points, fetchedAt) {
  const sourceMap = new Map(), knownDatums = new Set();
  const byLocation = new Map(), duplicates = new Set();
  for (const sample of Array.isArray(payload.samples) ? payload.samples : []) {
    if (!Number.isInteger(sample?.locationId) || sample.locationId < 0 || sample.locationId >= points.length) continue;
    if (byLocation.has(sample.locationId)) duplicates.add(sample.locationId);
    else byLocation.set(sample.locationId, sample);
  }
  const samples = points.map((point, index) => {
    const result = { ...point, elevationMetres: null, sourceId: null };
    const sample = byLocation.get(index);
    if (!sample || duplicates.has(index)) return result;
    const location = sample.location;
    if (!location || Math.abs(location.x - point.longitude) > 1e-7 || Math.abs(location.y - point.latitude) > 1e-7 || !Number.isFinite(location.x) || !Number.isFinite(location.y) || (location.spatialReference?.latestWkid ?? location.spatialReference?.wkid) !== 4326) return result;
    const attributes = sample.attributes || {}, project = text(attributes.Name);
    const rasterId = Number.isSafeInteger(sample.rasterId) && sample.rasterId >= 0 ? sample.rasterId : null;
    const sourceId = `${rasterId ?? "unknown"}:${project ?? "unknown"}`;
    const resolution = numeric(sample.resolution), verticalDatum = text(attributes.VerticalDatum);
    const source = {
      id: sourceId, rasterId, project, resolutionMetres: resolution !== null && resolution > 0 && resolution <= 1000 ? resolution : null,
      verticalDatum, acquisitionDate: epochDate(attributes.AcquisitionDate), startDate: calendarDate(attributes.StartDate), endDate: calendarDate(attributes.EndDate), url: sourceLink(attributes.URL),
      identityKnown: rasterId !== null && project !== null,
    };
    const existing = sourceMap.get(sourceId);
    if (existing) {
      for (const field of ["resolutionMetres", "verticalDatum", "acquisitionDate", "startDate", "endDate", "url"]) {
        if (existing[field] !== source[field]) {
          existing[field] = null;
          existing.metadataConflict = true;
        }
      }
    } else sourceMap.set(sourceId, source);
    result.sourceId = sourceId;
    // The official 3DEP elevation product is expressed in metres. A source with
    // missing/different attribution is retained as unknown, never relabeled.
    if (attributes.Source !== "USGS" || attributes.ProductName !== "USGS_3DEP") return result;
    const value = numeric(sample.value);
    if (value === null || Math.abs(value) > 100000) return result;
    result.elevationMetres = value;
    knownDatums.add(datumKey(verticalDatum) ?? `unknown:${sourceId}`);
    return result;
  });
  const conflictingDatum = knownDatums.size > 1;
  if (conflictingDatum) for (const sample of samples) sample.elevationMetres = null;
  const availableCount = samples.filter((sample) => sample.elevationMetres !== null).length;
  const result = {
    status: availableCount === points.length ? "ready" : availableCount ? "partial" : "unavailable",
    fetchedAt, units: availableCount ? "m" : null, samples, sources: [...sourceMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    availableCount, requestedCount: points.length, sourceUrl: TERRAIN_URL,
    method: "USGS 3DEP bare-earth DEM; bilinear interpolation at requested WGS84 coordinates",
    horizontalReference: "EPSG:4326", coverage: "requested sample points",
  };
  if (result.status !== "ready") result.reason = conflictingDatum
    ? "The returned elevations use conflicting or unverified vertical datums; a combined terrain estimate is unavailable."
    : availableCount ? "Some requested elevations were unavailable or could not be validated." : "No requested elevations could be validated in metres.";
  return result;
}

function floodResult(payload, fetchedAt) {
  if (payload.exceededTransferLimit) throw new SourceFailure("The flood source returned an incomplete result.");
  if (!Array.isArray(payload.features) || !payload.features.length) throw new SourceFailure("No mapped flood-zone feature was returned for this point; hazard classification is unknown.");
  if (payload.features.length > 20) throw new SourceFailure("The flood source returned too many overlapping records.");
  const zones = payload.features.map(({ attributes: a }) => {
    if (!a || !text(a.FLD_ZONE, 40)) throw new SourceFailure("The flood source returned incomplete classification fields.");
    const units = text(a.LEN_UNIT, 40), datum = text(a.V_DATUM, 80), rawBfe = numeric(a.STATIC_BFE);
    const validUnits = units && ["FEET", "METERS"].includes(units.toUpperCase());
    return {
      zone: text(a.FLD_ZONE, 40), subtype: text(a.ZONE_SUBTY), specialFloodHazardArea: a.SFHA_TF === "T" ? true : a.SFHA_TF === "F" ? false : null,
      baseFloodElevation: rawBfe !== null && rawBfe !== -9999 && rawBfe !== -8888 && validUnits && datum ? rawBfe : null,
      baseFloodElevationUnits: validUnits ? units.toUpperCase() : null, verticalDatum: datum,
      studyId: text(a.DFIRM_ID, 40), sourceCitation: text(a.SOURCE_CIT, 80),
    };
  }).sort((a, b) => `${a.zone}|${a.subtype}|${a.studyId}|${a.sourceCitation}`.localeCompare(`${b.zone}|${b.subtype}|${b.studyId}|${b.sourceCitation}`));
  return { status: "ready", fetchedAt, zones, effectiveDate: null, sourceUrl: FLOOD_URL, coverage: "selected point", method: "FEMA NFHL point intersection; effective panel/revision date not yet verified" };
}

export function createSiteSourceLoader({ fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 20000, maxResponseBytes = MAX_BYTES } = {}) {
  const deadline = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(20000, timeoutMs)) : 20000;
  const maxBytes = Number.isFinite(maxResponseBytes) ? Math.max(1, Math.min(MAX_BYTES, maxResponseBytes)) : MAX_BYTES;
  const request = (url, signal) => boundedJson(url, { fetchImpl, signal, timeoutMs: deadline, maxBytes });
  return async ({ points = [], selectedPoint } = {}, { signal } = {}) => {
    const fetchedAt = new Date(now()).toISOString();
    const acceptedPoints = Array.isArray(points) && points.length > 0 && points.length <= MAX_POINTS && points.every(pointValid)
      ? points.map(({ longitude, latitude }) => ({ longitude, latitude })) : null;
    const fail = (source, error) => ({
      status: "unavailable", fetchedAt, sourceUrl: source === "terrain" ? TERRAIN_URL : FLOOD_URL,
      reason: error instanceof SourceFailure ? error.message : "The source is temporarily unavailable.",
      ...(source === "terrain" ? { units: null, samples: (acceptedPoints || []).map((p) => ({ ...p, elevationMetres: null, sourceId: null })), sources: [], availableCount: 0, requestedCount: Array.isArray(points) ? points.length : 0, coverage: "requested sample points" } : { zones: [], effectiveDate: null, coverage: "selected point" }),
    });
    const terrainTask = async () => {
      try {
        if (!acceptedPoints) throw new SourceFailure("Terrain sampling requires 1–25 valid geographic points.");
        const url = new URL(`${TERRAIN_URL}/getSamples`);
        url.search = new URLSearchParams({ f: "json", geometryType: "esriGeometryMultipoint", geometry: JSON.stringify({ points: acceptedPoints.map((p) => [p.longitude, p.latitude]), spatialReference: { wkid: 4326 } }), returnFirstValueOnly: "true", interpolation: "RSP_BilinearInterpolation", outFields: "Name,ProductName,Source,VerticalDatum,AcquisitionDate,StartDate,EndDate,URL" }).toString();
        return terrainResult(await request(url.href, signal), acceptedPoints, fetchedAt);
      } catch (error) { return fail("terrain", error); }
    };
    const floodTask = async () => {
      try {
        if (!pointValid(selectedPoint)) throw new SourceFailure("Flood lookup requires a valid selected geographic point.");
        const url = new URL(`${FLOOD_URL}/query`);
        url.search = new URLSearchParams({ f: "json", geometry: `${selectedPoint.longitude},${selectedPoint.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,LEN_UNIT,V_DATUM,SOURCE_CIT,DFIRM_ID", returnGeometry: "false", resultRecordCount: "20" }).toString();
        return floodResult(await request(url.href, signal), fetchedAt);
      } catch (error) { return fail("flood", error); }
    };
    const [terrain, flood] = await Promise.all([terrainTask(), floodTask()]);
    return { terrain, flood };
  };
}
