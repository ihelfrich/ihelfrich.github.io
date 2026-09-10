/** Public NOAA/NWS feeds. Cache transport results, re-evaluate currentness on use.
 * County UGC queries include intersecting zone alerts (NWS Geolocation Guide).
 * Stage is relative to each gauge datum; negative stage is valid, -999 is not.
 */
export const LIVE_CACHE_MS = 5 * 60 * 1000;
export const RIVER_STALE_MS = 2 * 60 * 60 * 1000;
export const FORECAST_STALE_MS = 12 * 60 * 60 * 1000;
export const DOWNTOWN = Object.freeze({ latitude: 38.627, longitude: -90.1994 });
export const ALERTS_URL = 'https://api.weather.gov/alerts/active?zone=MOC189,MOC510';
export const POINT_URL = 'https://api.weather.gov/points/38.6270,-90.1994';
export const RIVER_GAUGES = Object.freeze([
  Object.freeze({ id: 'eadm7', name: 'Mississippi River at St. Louis', latitude: 38.628888888889, longitude: -90.179722222222, forecastNote: 'Forecasts are issued routinely.', url: 'https://water.noaa.gov/gauges/eadm7' }),
  Object.freeze({ id: 'vllm7', name: 'Meramec River at Valley Park', latitude: 38.546666666667, longitude: -90.485, forecastNote: 'Forecasts are issued as needed during high water.', url: 'https://water.noaa.gov/gauges/vllm7' }),
]);
const iso = n => new Date(n).toISOString();
const finite = n => typeof n === 'number' && Number.isFinite(n);
const str = value => typeof value === 'string' ? value : null;
const instant = value => {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const stamp = value => { const n = instant(value); return n === null ? null : iso(n); };
const stage = value => finite(value) && value !== -999 && value !== -9999 ? value : null;
const severityRank = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
const text = (value, max = 12000) => (str(value) || '').slice(0, max);

export function parseAlerts(payload, { now = Date.now() } = {}) {
  if (!Array.isArray(payload?.features)) throw new Error('NWS alert response is incomplete');
  const seen = new Set(), alerts = [], excluded = { expired: 0, invalid: 0, nonActual: 0 };
  for (const feature of payload.features.slice(0, 250)) {
    const p = feature?.properties || {}, id = str(p.id) || str(feature?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (p.status !== 'Actual' || p.messageType === 'Cancel') { excluded.nonActual++; continue; }
    const issued = instant(p.sent), expires = instant(p.expires), ends = instant(p.ends), effective = instant(p.effective);
    if (issued === null || expires === null || issued > now || (effective !== null && effective > expires)) { excluded.invalid++; continue; }
    if (Math.min(expires, ends ?? Infinity) <= now) { excluded.expired++; continue; }
    alerts.push({ id, event: text(p.event, 160) || 'NWS alert', headline: text(p.headline, 500), description: text(p.description), instruction: text(p.instruction), area: text(p.areaDesc, 1500), severity: text(p.severity, 30) || 'Unknown', certainty: text(p.certainty, 30), urgency: text(p.urgency, 30), issuedAt: iso(issued), effectiveAt: effective === null ? null : iso(effective), onsetAt: stamp(p.onset), expiresAt: iso(expires), endsAt: ends === null ? null : iso(ends), url: `https://api.weather.gov/alerts/${encodeURIComponent(id.replace(/^https:\/\/api\.weather\.gov\/alerts\//, ''))}` });
  }
  alerts.sort((a, b) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4) || Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  const incomplete = Boolean(payload.pagination?.next) || payload.features.length > 250;
  const status = incomplete || excluded.invalid ? 'invalid' : alerts.length ? 'current' : excluded.expired ? 'expired' : 'empty';
  return { kind: 'alerts', status, alerts, excluded, incomplete, updatedAt: stamp(payload.updated), coverage: 'St. Louis City + St. Louis County; includes intersecting NWS forecast and fire zones.', sourceUrl: ALERTS_URL };
}

export function parseHourlyForecast(payload, { now = Date.now(), sourceUrl = null } = {}) {
  const p = payload?.properties;
  if (!Array.isArray(p?.periods)) throw new Error('NWS hourly response is incomplete');
  const issuedAt = stamp(p.updateTime), generatedAt = stamp(p.generatedAt);
  let rejected = 0;
  const periods = p.periods.slice(0, 200).flatMap(period => {
    const start = instant(period?.startTime), end = instant(period?.endTime);
    if (start === null || end === null || end <= start) { rejected++; return []; }
    if (end <= now) return [];
    return [{ startAt: iso(start), endAt: iso(end), temperature: finite(period.temperature) ? period.temperature : null, temperatureUnit: ['F', 'C'].includes(period.temperatureUnit) ? period.temperatureUnit : null, precipitationPct: finite(period.probabilityOfPrecipitation?.value) && period.probabilityOfPrecipitation.value >= 0 && period.probabilityOfPrecipitation.value <= 100 ? period.probabilityOfPrecipitation.value : null, windSpeed: text(period.windSpeed, 60), windDirection: text(period.windDirection, 20), description: text(period.shortForecast, 200) }];
  }).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)).slice(0, 12);
  const age = issuedAt ? now - Date.parse(issuedAt) : null;
  const status = age === null || age < 0 || rejected ? 'invalid' : !periods.length ? p.periods.length ? 'expired' : 'empty' : age > FORECAST_STALE_MS ? 'stale' : 'current';
  return { kind: 'forecast', status, issuedAt, generatedAt, validTimes: str(p.validTimes), periods, coverage: 'NWS forecast grid covering downtown St. Louis (38.6270, −90.1994).', sourceUrl, point: DOWNTOWN };
}

function riverSeries(product, { now, forecast }) {
  const units = str(product?.primaryUnits), issuedAt = forecast ? stamp(product?.issuedTime) : null;
  const validShape = Array.isArray(product?.data), validUnit = ['ft', 'm'].includes(units) && product?.primaryName?.toLowerCase() === 'stage';
  const points = validShape && validUnit ? product.data.slice(-5000).flatMap(p => {
    const when = instant(p?.validTime), value = stage(p?.primary);
    if (when === null || value === null || (!forecast && when > now)) return [];
    return [{ validAt: iso(when), generatedAt: stamp(p.generatedTime), value }];
  }).sort((a, b) => Date.parse(a.validAt) - Date.parse(b.validAt)) : [];
  const latest = forecast ? null : points.at(-1) || null;
  const validPoints = forecast ? points.filter(p => Date.parse(p.validAt) > now && Date.parse(p.validAt) <= now + 3 * 86400000) : points.filter(p => Date.parse(p.validAt) >= now - 48 * 3600000);
  const age = forecast ? issuedAt ? now - Date.parse(issuedAt) : null : latest ? now - Date.parse(latest.validAt) : null;
  let status;
  if (!validShape) status = 'invalid';
  else if (!product.data.length) status = 'empty';
  else if (!validUnit || !points.length || (forecast && (age === null || age < 0))) status = 'invalid';
  else if (forecast && !validPoints.length) status = 'expired';
  else if (age > (forecast ? 48 * 3600000 : RIVER_STALE_MS)) status = 'stale';
  else status = 'current';
  return { status, units, issuedAt, latest, points: validPoints, ageMs: age };
}

export function parseRiver(payload, { now = Date.now(), gauge = RIVER_GAUGES[0] } = {}) {
  if (!payload || typeof payload.observed !== 'object' || typeof payload.forecast !== 'object') throw new Error('NWPS river response is incomplete');
  const observed = riverSeries(payload.observed, { now, forecast: false });
  const forecast = riverSeries(payload.forecast, { now, forecast: true });
  // A common vertical axis is meaningful only when the source units match.
  if (forecast.points.length && observed.units !== forecast.units) forecast.status = 'invalid';
  return { kind: 'river', status: observed.status, gauge, observed, forecast, sourceUrl: `https://api.water.noaa.gov/nwps/v1/gauges/${gauge.id}/stageflow`, coverage: 'Gauge stage relative to the local datum; not water depth or parcel flood exposure.' };
}

async function requestJSON(url, { fetchImpl, timeoutMs, controllers }) {
  const controller = new AbortController(); controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const maxBytes = 2_000_000;
    if (Number(response.headers?.get?.('content-length')) > maxBytes) throw new Error('Source response exceeds the size limit');
    if (!response.body?.getReader) {
      const body = await response.text();
      if (body.length > maxBytes) throw new Error('Source response exceeds the size limit');
      return JSON.parse(body);
    }
    const reader = response.body.getReader(), decoder = new TextDecoder(); let body = '', count = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      count += value.byteLength;
      if (count > maxBytes) { await reader.cancel(); throw new Error('Source response exceeds the size limit'); }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { clearTimeout(timeout); controllers.delete(controller); }
}

/** Four independent feeds; no background polling or persisted public responses.
 * refresh({force}) -> {alerts, forecast, eadm7, vllm7}; snapshot() rechecks age.
 * Every entry has status/fetchedAt/attemptedAt/error, with previous data on failure.
 */
export function createLiveFeeds({ fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 10000 } = {}) {
  const records = new Map(), pending = new Map(), controllers = new Set();
  let disposed = false, mapping = null;
  const keys = ['alerts', 'forecast', ...RIVER_GAUGES.map(g => g.id)];
  const parser = (key, payload, sourceUrl) => key === 'alerts' ? parseAlerts(payload, { now: now() }) : key === 'forecast' ? parseHourlyForecast(payload, { now: now(), sourceUrl }) : parseRiver(payload, { now: now(), gauge: RIVER_GAUGES.find(g => g.id === key) });
  const snapshotEntry = key => {
    const record = records.get(key);
    if (!record?.payload) return { status: record?.error ? 'unavailable' : 'idle', data: null, fetchedAt: null, attemptedAt: record?.attemptedAt || null, error: record?.error || null };
    const data = parser(key, record.payload, record.sourceUrl), old = now() - Date.parse(record.fetchedAt) >= LIVE_CACHE_MS;
    return { status: record.error || old ? 'stale' : data.status, data, fetchedAt: record.fetchedAt, attemptedAt: record.attemptedAt, error: record.error || null };
  };
  const snapshot = () => Object.fromEntries(keys.map(key => [key, snapshotEntry(key)]));
  const request = url => requestJSON(url, { fetchImpl, timeoutMs, controllers });
  async function refreshOne(key, force) {
    if (pending.has(key)) return pending.get(key);
    const record = records.get(key);
    if (!force && record?.payload && !record.error && now() - Date.parse(record.fetchedAt) < LIVE_CACHE_MS) return snapshotEntry(key);
    const operation = (async () => {
      const attemptedAt = iso(now());
      try {
        let sourceUrl;
        if (key === 'forecast') {
          if (!mapping || now() - mapping.fetchedMs >= 86400000) {
            const point = await request(POINT_URL), url = point?.properties?.forecastHourly;
            if (typeof url !== 'string' || !/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(url)) throw new Error('NWS forecast grid is unavailable');
            mapping = { url, fetchedMs: now() };
          }
          sourceUrl = mapping.url;
        } else sourceUrl = key === 'alerts' ? ALERTS_URL : `https://api.water.noaa.gov/nwps/v1/gauges/${key}/stageflow`;
        const payload = await request(sourceUrl); parser(key, payload, sourceUrl);
        if (!disposed) records.set(key, { payload, sourceUrl, fetchedAt: iso(now()), attemptedAt, error: null });
      } catch (error) {
        if (!disposed) records.set(key, { ...record, attemptedAt, error: error?.name === 'AbortError' || error?.name === 'TimeoutError' ? 'Request timed out or was cancelled' : text(error?.message, 200) || 'Source unavailable' });
      }
      return snapshotEntry(key);
    })();
    pending.set(key, operation);
    try { return await operation; } finally { pending.delete(key); }
  }
  return { snapshot, async refresh({ force = false } = {}) { if (!disposed) await Promise.all(keys.map(key => refreshOne(key, force))); return snapshot(); }, dispose() { disposed = true; for (const controller of controllers) controller.abort(); } };
}
