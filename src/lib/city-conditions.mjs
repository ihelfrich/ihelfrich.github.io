/**
 * Observed weather: NOAA/NWS KCPS. No forecast/model fallback.
 * Solar direction: NOAA fractional-year equations, an illustrative geometric model.
 * Weather timestamps are never substituted for the solar evaluation date.
 * https://www.weather.gov/documentation/services-web-api
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export const STATION = Object.freeze({
  id: "KCPS",
  name: "St. Louis Downtown Airport",
  latitude: 38.56403,
  longitude: -90.14871,
  url: "https://api.weather.gov/stations/KCPS",
  observationUrl: "https://api.weather.gov/stations/KCPS/observations/latest",
});
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const rad = Math.PI / 180;
const milliseconds = (value) =>
  value instanceof Date
    ? value.getTime()
    : typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
function quantity(q, dimension) {
  if (!q || typeof q.value !== "number" || !Number.isFinite(q.value))
    return null;
  const value = q.value,
    unit = typeof q.unitCode === "string" ? q.unitCode.split(":").at(-1) : "";
  let result = null;
  if (dimension === "temperature") {
    if (["degC", "Cel"].includes(unit)) result = value;
    else if (unit === "degF") result = ((value - 32) * 5) / 9;
    else if (unit === "K") result = value - 273.15;
  } else if (dimension === "speed") {
    if (["m_s-1", "m/s"].includes(unit)) result = value;
    else if (["km_h-1", "km/h"].includes(unit)) result = value / 3.6;
    else if (["kn", "kt"].includes(unit)) result = (value * 1852) / 3600;
    else if (["mi_h-1", "mph"].includes(unit)) result = value * 0.44704;
  } else if (dimension === "distance" || dimension === "precipitation") {
    const factors = {
      m: 1,
      km: 1000,
      mm: 0.001,
      cm: 0.01,
      ft: 0.3048,
      mi: 1609.344,
      in: 0.0254,
    };
    if (Object.hasOwn(factors, unit))
      result =
        value * factors[unit] * (dimension === "precipitation" ? 1000 : 1);
  } else if (
    dimension === "direction" &&
    ["degree_(angle)", "degree", "deg"].includes(unit)
  ) {
    result = value >= 0 && value <= 360 ? value % 360 : null;
  } else if (dimension === "humidity" && ["percent", "%"].includes(unit)) {
    result = value >= 0 && value <= 100 ? value : null;
  }
  if (result !== null && dimension !== "temperature" && result < 0) return null;
  return result;
}

/** Parse one GeoJSON NWS observation. Numeric weather values are metric or null. */
export function parseObservation(
  feature,
  { now = Date.now(), station = STATION } = {},
) {
  const current = milliseconds(now);
  if (!Number.isFinite(current))
    throw new RangeError("A valid observation evaluation time is required");
  const p =
    feature?.properties && typeof feature.properties === "object"
      ? feature.properties
      : {};
  const timestamp = typeof p.timestamp === "string" ? p.timestamp : null;
  // Require an explicit offset. Date.parse must not invent the browser's local zone.
  const observedMs =
    timestamp && /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)
      ? Date.parse(timestamp)
      : NaN;
  const ageMs = Number.isFinite(observedMs) ? current - observedMs : null;
  let status = "fresh",
    invalidReason = null;
  if (!Number.isFinite(observedMs)) {
    status = "invalid";
    invalidReason = "missing-or-invalid-timestamp";
  } else if (ageMs < 0) {
    status = "invalid";
    invalidReason = "future-timestamp";
  } else if (ageMs > STALE_AFTER_MS) status = "stale";
  if (
    typeof p.station === "string" &&
    p.station.split("/").filter(Boolean).at(-1) !== station.id
  ) {
    status = "invalid";
    invalidReason = "station-mismatch";
  }
  const layers = Array.isArray(p.cloudLayers)
    ? p.cloudLayers.map((layer) => ({
        amount:
          typeof layer?.amount === "string" ? layer.amount.toUpperCase() : null,
        baseMeters: quantity(layer?.base, "distance"),
      }))
    : null;
  const presentWeather = Array.isArray(p.presentWeather)
    ? p.presentWeather
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          weather: typeof x.weather === "string" ? x.weather : null,
          intensity: typeof x.intensity === "string" ? x.intensity : null,
          modifier: typeof x.modifier === "string" ? x.modifier : null,
        }))
    : null;
  const description =
    typeof p.textDescription === "string" && p.textDescription.trim()
      ? p.textDescription.trim()
      : null;
  return {
    status,
    invalidReason,
    observedAt: Number.isFinite(observedMs)
      ? new Date(observedMs).toISOString()
      : null,
    evaluatedAt: new Date(current).toISOString(),
    ageMs,
    temperatureC: quantity(p.temperature, "temperature"),
    dewpointC: quantity(p.dewpoint, "temperature"),
    windSpeedMps: quantity(p.windSpeed, "speed"),
    windGustMps: quantity(p.windGust, "speed"),
    windFromDegrees: quantity(p.windDirection, "direction"),
    visibilityMeters: quantity(p.visibility, "distance"),
    relativeHumidityPct: quantity(p.relativeHumidity, "humidity"),
    precipitationLastHourMm: quantity(p.precipitationLastHour, "precipitation"),
    precipitationLast3HoursMm: quantity(
      p.precipitationLast3Hours,
      "precipitation",
    ),
    cloudLayers: layers,
    presentWeather,
    description,
    qualityControl: Object.fromEntries(
      [
        "temperature",
        "windSpeed",
        "windGust",
        "visibility",
        "precipitationLastHour",
      ].map((k) => [
        k,
        typeof p[k]?.qualityControl === "string" ? p[k].qualityControl : null,
      ]),
    ),
    source: {
      provider: "NOAA / National Weather Service",
      stationId: station.id,
      stationName: station.name,
      stationUrl: station.url,
      stationLatitude: station.latitude,
      stationLongitude: station.longitude,
      endpoint: station.observationUrl,
      observationUrl:
        typeof feature?.id === "string" ? feature.id : station.observationUrl,
      documentationUrl:
        "https://www.weather.gov/documentation/services-web-api",
    },
  };
}

/** Conservative presentation mapping. Cloud fractions are categorical estimates,
 * precipitation is a preceding-hour accumulation, and wind points TO its motion.
 * Stale/invalid observations are retained by the parser but not applied here.
 */
export function weatherToPresentation(observation) {
  const usable = observation?.status === "fresh";
  const result = {
    usable,
    status: observation?.status || "unavailable",
    observedAt: observation?.observedAt || null,
    temperatureC: null,
    windSpeedMps: null,
    windGustMps: null,
    windFromDegrees: null,
    windVector: null,
    visibilityMeters: null,
    relativeHumidityPct: null,
    cloudCoverFraction: null,
    cloudCoverBasis: null,
    cloudAmount: null,
    cloudBaseMeters: null,
    precipitationLastHourMm: null,
    precipitationKind: "unknown",
    precipitationReported: null,
    fogReported: null,
    description: observation?.description || null,
  };
  if (!usable) return result;
  for (const key of [
    "temperatureC",
    "windSpeedMps",
    "windGustMps",
    "windFromDegrees",
    "visibilityMeters",
    "relativeHumidityPct",
    "precipitationLastHourMm",
  ])
    result[key] = observation[key] ?? null;
  if (result.windSpeedMps === 0) result.windVector = { x: 0, z: 0 };
  else if (result.windSpeedMps !== null && result.windFromDegrees !== null) {
    const angle = result.windFromDegrees * rad;
    result.windVector = {
      x: -Math.sin(angle) * result.windSpeedMps,
      z: Math.cos(angle) * result.windSpeedMps,
    };
  }
  // FEW 1–2, SCT 3–4, BKN 5–7 and OVC 8 oktas. Midpoints are styling estimates.
  const fractions = {
    CLR: 0,
    SKC: 0,
    FEW: 1.5 / 8,
    SCT: 3.5 / 8,
    BKN: 6 / 8,
    OVC: 1,
  };
  const known = (observation.cloudLayers || []).filter((x) =>
    Object.hasOwn(fractions, x.amount),
  );
  if (known.length) {
    const layer = known.reduce((a, b) =>
      fractions[a.amount] >= fractions[b.amount] ? a : b,
    );
    result.cloudCoverFraction = fractions[layer.amount];
    result.cloudAmount = layer.amount;
    result.cloudCoverBasis = "categorical-estimate";
    const bases = known
      .filter((x) => fractions[x.amount] > 0 && x.baseMeters !== null)
      .map((x) => x.baseMeters);
    if (bases.length) result.cloudBaseMeters = Math.min(...bases);
  } else if (/^clear$/i.test(observation.description || "")) {
    result.cloudCoverFraction = 0;
    result.cloudAmount = "clear-report";
    result.cloudCoverBasis = "explicit-description";
  }
  const weather = (observation.presentWeather || [])
    .map((w) => w.weather || "")
    .join(" ")
    .toLowerCase();
  const reported = [weather, observation.description || ""]
    .join(" ")
    .toLowerCase();
  const rain = /\brain\b|\bdrizzle\b/.test(reported),
    snow = /\bsnow\b/.test(reported),
    ice = /\bice\b|\bhail\b|\bsleet\b|\bfreezing\b/.test(reported);
  if (rain && snow) result.precipitationKind = "mixed";
  else if (ice) result.precipitationKind = "ice";
  else if (snow) result.precipitationKind = "snow";
  else if (rain) result.precipitationKind = "rain";
  if (rain || snow || ice) result.precipitationReported = true;
  // A zero accumulation does not establish that it is not currently raining.
  else if (result.precipitationLastHourMm !== null)
    result.precipitationReported = result.precipitationLastHourMm > 0;
  if (/\bfog\b|\bmist\b/.test(reported)) result.fogReported = true;
  // Absence of a report remains unknown; no fair-weather or dry fallback.
  return result;
}

/** NOAA geometric solar position. latitude/longitude are degrees, longitude east+.
 * Vector points toward the sun: x east, y up, z south. No atmospheric refraction.
 * This low-order model supports visual lighting, not precision shadow surveys.
 */
export function solarPosition(date, latitude = 38.628, longitude = -90.193) {
  const ms = milliseconds(date);
  if (
    !Number.isFinite(ms) ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    throw new RangeError("Invalid solar date or coordinates");
  const utc = new Date(ms),
    year = utc.getUTCFullYear(),
    day =
      (Date.UTC(year, utc.getUTCMonth(), utc.getUTCDate()) -
        Date.UTC(year, 0, 1)) /
        86400000 +
      1;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const hour =
    utc.getUTCHours() +
    utc.getUTCMinutes() / 60 +
    utc.getUTCSeconds() / 3600 +
    utc.getUTCMilliseconds() / 3600000;
  const gamma = ((2 * Math.PI) / days) * (day - 1 + (hour - 12) / 24);
  const equationOfTimeMinutes =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const solarMinutes =
    (((hour * 60 + equationOfTimeMinutes + 4 * longitude) % 1440) + 1440) %
    1440;
  const hourAngle = (solarMinutes / 4 - 180) * rad,
    lat = latitude * rad;
  const direction = {
    x: -Math.cos(declination) * Math.sin(hourAngle),
    y:
      Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
    z:
      Math.sin(lat) * Math.cos(declination) * Math.cos(hourAngle) -
      Math.cos(lat) * Math.sin(declination),
  };
  const altitudeDegrees = Math.asin(clamp(direction.y, -1, 1)) / rad;
  const horizontal = Math.hypot(direction.x, direction.z);
  const azimuthDegrees =
    horizontal < 1e-12
      ? null
      : (((Math.atan2(direction.x, -direction.z) / rad) % 360) + 360) % 360;
  return {
    evaluatedAt: utc.toISOString(),
    latitude,
    longitude,
    direction,
    altitudeDegrees,
    azimuthDegrees,
    aboveHorizon: direction.y > 0,
    declinationDegrees: declination / rad,
    equationOfTimeMinutes,
    model: "NOAA fractional-year geometric approximation",
    refractionApplied: false,
    sourceUrl: "https://gml.noaa.gov/grad/solcalc/solareqns.PDF",
  };
}

/** Create an isolated, injectable client. Cache stores raw observations so age is
 * recalculated on each read. A failed request is also held for ten minutes, avoiding
 * retry storms; explicit force bypasses that backoff. Concurrent requests coalesce.
 */
export function createConditionsClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  now = Date.now,
  timeoutMs = 10000,
  cacheTtlMs = CACHE_TTL_MS,
  station = STATION,
} = {}) {
  if (
    typeof now !== "function" ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isFinite(cacheTtlMs) ||
    cacheTtlMs < 0
  )
    throw new RangeError("Invalid conditions client options");
  let cache = null,
    lastAttempt = null,
    lastError = null,
    inFlight = null;
  function result(cacheHit) {
    const current = milliseconds(now());
    const observation = cache
      ? parseObservation(cache.raw, { now: current, station })
      : null;
    return {
      status: observation?.status || "unavailable",
      observation,
      presentation: weatherToPresentation(observation),
      cacheHit,
      fetchError: lastError,
      fetchedAt: cache ? new Date(cache.fetchedAt).toISOString() : null,
      checkedAt: new Date(current).toISOString(),
      lastAttemptAt:
        lastAttempt === null ? null : new Date(lastAttempt).toISOString(),
      station,
      endpoint: station.observationUrl,
    };
  }
  async function request() {
    const started = milliseconds(now());
    lastAttempt = started;
    const controller = new AbortController();
    let timer;
    try {
      const transport = (async () => {
        if (typeof fetchImpl !== "function")
          throw Object.assign(new Error("Fetch unavailable"), {
            conditionCode: "network",
          });
        // Accept is CORS safelisted. Browser supplies its User-Agent; no custom header
        // or credentials are needed, avoiding a preflight or blocked User-Agent write.
        const response = await fetchImpl(station.observationUrl, {
          headers: { Accept: "application/geo+json" },
          credentials: "omit",
          mode: "cors",
          signal: controller.signal,
        });
        if (!response?.ok)
          throw Object.assign(new Error("NWS response failed"), {
            conditionCode: "http",
          });
        try {
          return await response.json();
        } catch {
          throw Object.assign(new Error("Invalid NWS JSON"), {
            conditionCode: "invalid-json",
          });
        }
      })();
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            Object.assign(new Error("NWS observation request timed out"), {
              conditionCode: "timeout",
            }),
          );
          controller.abort();
        }, timeoutMs);
      });
      const raw = await Promise.race([transport, deadline]);
      const parsed = parseObservation(raw, {
        now: milliseconds(now()),
        station,
      });
      if (parsed.status === "invalid") {
        lastError = "invalid-observation";
        if (!cache) cache = { raw, fetchedAt: milliseconds(now()) };
      } else {
        cache = { raw, fetchedAt: milliseconds(now()) };
        lastError = null;
      }
    } catch (error) {
      lastError = error?.conditionCode || "network";
    } finally {
      clearTimeout(timer);
    }
    return result(false);
  }
  return {
    getConditions({ force = false } = {}) {
      const current = milliseconds(now());
      if (!Number.isFinite(current))
        return Promise.reject(new RangeError("Invalid current time"));
      if (inFlight) return inFlight;
      if (
        !force &&
        lastAttempt !== null &&
        current >= lastAttempt &&
        current - lastAttempt < cacheTtlMs
      )
        return Promise.resolve(result(true));
      inFlight = request().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    clearCache() {
      cache = null;
      lastAttempt = null;
      lastError = null;
    },
  };
}
const defaultClient = createConditionsClient();
export const getConditions = (options) => defaultClient.getConditions(options);
