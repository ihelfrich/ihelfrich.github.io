import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERTS_URL, POINT_URL, LIVE_CACHE_MS, parseAlerts, parseHourlyForecast, parseRiver, createLiveFeeds } from '../../src/lib/city-live-feeds.mjs';

const NOW = Date.parse('2026-09-08T18:00:00Z');
const at = offset => new Date(NOW + offset).toISOString();
const alert = (patch = {}) => ({ properties: { id: 'urn:test:one', status: 'Actual', messageType: 'Alert', event: 'Air Quality Alert', sent: at(-3600000), effective: at(-3600000), expires: at(3600000), severity: 'Unknown', geocode: { UGC: ['MOZ064'], SAME: ['029510'] }, ...patch } });
const alertPayload = features => ({ type: 'FeatureCollection', features, updated: at(-60000) });
const hourly = () => ({ properties: { updateTime: at(-3600000), generatedAt: at(-30000), validTimes: at(-3600000) + '/P1D', periods: [{ startTime: at(0), endTime: at(3600000), temperature: 0, temperatureUnit: 'F', probabilityOfPrecipitation: { value: 0 }, windSpeed: '0 mph', windDirection: 'N', shortForecast: 'Clear' }, { startTime: at(3600000), endTime: at(7200000), temperature: null, temperatureUnit: 'F', probabilityOfPrecipitation: { value: null } }] } });
const river = () => ({ observed: { primaryName: 'Stage', primaryUnits: 'ft', data: [{ validTime: at(-3600000), generatedTime: at(-3500000), primary: -1.25 }, { validTime: at(-900000), primary: -1.1 }, { validTime: at(-600000), primary: -999 }] }, forecast: { primaryName: 'Stage', primaryUnits: 'ft', issuedTime: at(-3600000), data: [{ validTime: at(3600000), primary: -1 }, { validTime: at(21600000), primary: -.8 }] } });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function fetcher({ fail = () => false, calls = [] } = {}) {
  return async url => { calls.push(url); if (fail(url)) throw new Error('fixture outage'); return response(url === ALERTS_URL ? alertPayload([alert()]) : url === POINT_URL ? { properties: { forecastHourly: 'https://api.weather.gov/gridpoints/LSX/95,74/forecast/hourly' } } : url.includes('/forecast/hourly') ? hourly() : river()); };
}

test('county union includes intersecting forecast-zone alerts and deduplicates by identifier', () => {
  assert.equal(new URL(ALERTS_URL).searchParams.get('zone'), 'MOC189,MOC510');
  const data = parseAlerts(alertPayload([alert(), alert()]), { now: NOW });
  assert.equal(data.status, 'current'); assert.equal(data.alerts.length, 1); assert.match(data.alerts[0].url, /urn%3Atest%3Aone/);
});
test('alert empty, expired, invalid, and actual states remain distinct', () => {
  assert.equal(parseAlerts(alertPayload([]), { now: NOW }).status, 'empty');
  assert.equal(parseAlerts(alertPayload([alert({ expires: at(-1) })]), { now: NOW }).status, 'expired');
  assert.equal(parseAlerts(alertPayload([alert({ ends: at(-1) })]), { now: NOW }).status, 'expired');
  assert.equal(parseAlerts(alertPayload([alert({ expires: null })]), { now: NOW }).status, 'invalid');
  assert.equal(parseAlerts(alertPayload([alert({ sent: at(1) })]), { now: NOW }).status, 'invalid');
  assert.equal(parseAlerts(alertPayload([alert({ status: 'Test' })]), { now: NOW }).alerts.length, 0);
  assert.equal(parseAlerts({ ...alertPayload([]), pagination: { next: 'https://api.weather.gov/next' } }, { now: NOW }).status, 'invalid');
  assert.throws(() => parseAlerts({ error: 'source problem' }), /incomplete/);
});
test('forecast retains zeros, missing values, source issue times and valid times', () => {
  const data = parseHourlyForecast(hourly(), { now: NOW });
  assert.equal(data.status, 'current'); assert.equal(data.periods[0].temperature, 0); assert.equal(data.periods[0].precipitationPct, 0); assert.equal(data.periods[1].temperature, null);
  assert.equal(data.issuedAt, at(-3600000)); assert.equal(data.generatedAt, at(-30000)); assert.equal(data.periods[0].startAt, at(0));
  assert.equal(parseHourlyForecast(hourly(), { now: NOW + 3 * 3600000 }).status, 'expired');
  const stale = hourly(); stale.properties.updateTime = at(-13 * 3600000); assert.equal(parseHourlyForecast(stale, { now: NOW }).status, 'stale');
  stale.properties.updateTime = '2026-09-08T17:00:00'; assert.equal(parseHourlyForecast(stale, { now: NOW }).status, 'invalid');
});
test('river stages may be negative; sentinel and future observations never become current measurements', () => {
  const payload = river(); payload.observed.data.push({ validTime: at(1000), primary: 10 });
  const data = parseRiver(payload, { now: NOW });
  assert.equal(data.status, 'current'); assert.equal(data.observed.latest.value, -1.1); assert.equal(data.observed.latest.validAt, at(-900000));
  assert.equal(data.observed.points.length, 2); assert.equal(data.forecast.points.length, 2); assert.equal(data.forecast.issuedAt, at(-3600000)); assert.equal(data.observed.issuedAt, null);
});
test('river missing forecast is explicit and stale observations remain observations', () => {
  const payload = river(); payload.forecast = { data: [], issuedTime: '0001-01-01T00:00:00Z', primaryUnits: '' };
  assert.equal(parseRiver(payload, { now: NOW }).forecast.status, 'empty');
  assert.equal(parseRiver(payload, { now: NOW + 3 * 3600000 }).status, 'stale');
  payload.observed.primaryUnits = ''; assert.equal(parseRiver(payload, { now: NOW }).status, 'invalid');
});
test('coalesces concurrent loads, caches successes, and independently retries a failed feed', async () => {
  let clock = NOW, outage = true; const calls = [];
  const client = createLiveFeeds({ now: () => clock, fetchImpl: fetcher({ calls, fail: url => outage && url.includes('/vllm7/') }) });
  const [a, b] = await Promise.all([client.refresh(), client.refresh({ force: true })]);
  assert.equal(calls.length, 5); assert.equal(a.alerts.status, 'current'); assert.equal(b.vllm7.status, 'unavailable');
  outage = false; const recovered = await client.refresh(); assert.equal(calls.length, 6); assert.equal(recovered.vllm7.status, 'current');
  clock += LIVE_CACHE_MS; assert.equal(client.snapshot().alerts.status, 'stale');
  await client.refresh(); assert.equal(calls.length, 10); assert.equal(client.snapshot().alerts.status, 'current'); client.dispose();
});
test('failed refresh retains known data, timestamps and stale status instead of claiming an empty feed', async () => {
  let clock = NOW, outage = false;
  const client = createLiveFeeds({ now: () => clock, fetchImpl: fetcher({ fail: () => outage }) });
  await client.refresh(); outage = true; clock += 3600000;
  const result = await client.refresh({ force: true });
  assert.equal(result.alerts.status, 'stale'); assert.equal(result.alerts.data.status, 'expired'); assert.equal(result.alerts.data.alerts.length, 0); assert.equal(result.alerts.fetchedAt, at(0)); assert.equal(result.alerts.attemptedAt, at(3600000)); assert.match(result.alerts.error, /outage/); client.dispose();
});
test('untrusted forecast mapping, oversized responses and timeouts fail without fetching arbitrary hosts', async () => {
  const urls = [];
  const client = createLiveFeeds({ now: () => NOW, timeoutMs: 5, fetchImpl: async (url, options) => {
    urls.push(url);
    if (url === POINT_URL) return response({ properties: { forecastHourly: 'https://example.com/redirect' } });
    if (url === ALERTS_URL) return new Response('{}', { headers: { 'content-length': '2000001' } });
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError'))));
  } });
  const data = await client.refresh(); assert.equal(data.forecast.status, 'unavailable'); assert.equal(data.alerts.status, 'unavailable'); assert.match(data.alerts.error, /size limit/); assert.match(data.eadm7.error, /timed out/); assert.equal(urls.some(u => u.includes('example.com')), false); client.dispose();
});
test('disposal aborts pending network calls and prevents late state mutation', async () => {
  const signals = [];
  const client = createLiveFeeds({ fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => { signals.push(signal); signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError'))); }) });
  const pending = client.refresh(); client.dispose(); await pending;
  assert.equal(signals.length, 4); assert.ok(signals.every(s => s.aborted)); assert.equal(client.snapshot().alerts.status, 'idle');
});
