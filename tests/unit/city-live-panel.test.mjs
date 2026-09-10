import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createLiveFeeds, ALERTS_URL, POINT_URL } from '../../src/lib/city-live-feeds.mjs';
import { createLivePanel } from '../../src/scripts/city/city-live-panel.mjs';

const NOW = Date.parse('2026-09-08T18:00:00Z'), at = n => new Date(NOW + n).toISOString();
const alerts = { features: [{ properties: { id: 'urn:fixture', status: 'Actual', event: '<img src=x onerror=alert(1)>', messageType: 'Alert', sent: at(-3600000), effective: at(-3600000), onset: at(-3600000), expires: at(3600000), severity: 'Moderate', description: '<script>alert(1)</script>', areaDesc: 'St. Louis City' } }], updated: at(-60000) };
const hourly = { properties: { updateTime: at(-3600000), generatedAt: at(-60000), periods: [{ startTime: at(0), endTime: at(3600000), temperature: 0, temperatureUnit: 'F', probabilityOfPrecipitation: { value: 0 }, shortForecast: 'Clear', windSpeed: '0 mph', windDirection: 'N' }] } };
const river = { observed: { primaryName: 'Stage', primaryUnits: 'ft', data: [{ validTime: at(-3600000), primary: -1.3 }, { validTime: at(-900000), primary: -1.1 }] }, forecast: { primaryName: 'Stage', primaryUnits: 'ft', issuedTime: at(-3600000), data: [{ validTime: at(3600000), primary: -.9 }, { validTime: at(21600000), primary: -.8 }] } };
function fixture(t, options = {}) {
  const window = new Window(), root = window.document.createElement('div'); window.document.body.append(root);
  const located = [], summaries = [], calls = []; let clock = NOW, outage = false;
  const client = createLiveFeeds({ now: () => clock, fetchImpl: async url => {
    calls.push(url); if (outage) throw new Error('upstream outage');
    return new Response(JSON.stringify(url === ALERTS_URL ? options.alerts || alerts : url === POINT_URL ? { properties: { forecastHourly: 'https://api.weather.gov/gridpoints/LSX/95,74/forecast/hourly' } } : url.includes('forecast/hourly') ? hourly : url.includes('vllm7') ? { ...river, forecast: { data: [] } } : river));
  } });
  const panel = createLivePanel(root, { client, now: () => clock, onLocate: p => located.push(p), onSummary: summary => summaries.push(summary) });
  t.after(async () => { panel.dispose(); await window.happyDOM.abort(); });
  return { root, panel, client, located, summaries, calls, setClock: n => { clock = n; }, fail: () => { outage = true; } };
}
test('loads on request, keeps source text literal and separates observations and forecasts', async t => {
  const f = fixture(t); assert.equal(f.calls.length, 0); await f.panel.refresh();
  assert.equal(f.root.querySelectorAll('.live-feed-card').length, 4);
  assert.equal(f.root.querySelector('img'), null); assert.equal(f.root.querySelector('script'), null); assert.match(f.root.textContent, /<script>/);
  assert.match(f.root.querySelector('[data-feed="eadm7"]').textContent, /Observed gauge stage/);
  assert.match(f.root.querySelector('[data-feed="vllm7"]').textContent, /as needed during high water/);
  assert.match(f.root.textContent, /0°F/); assert.match(f.root.textContent, /0% precip/);
  const chart = f.root.querySelector('.river-sparkline'); assert.ok(chart.querySelector('polyline[stroke-dasharray]')); assert.match(chart.getAttribute('aria-label'), /Vertical range -/); assert.match(chart.getAttribute('aria-label'), /dashed: forecast/);
  assert.match(f.root.textContent, /Fetched Sep 8/); assert.match(f.root.textContent, /Issued Sep 8|issued Sep 8/);
  const links = [...f.root.querySelectorAll('a')]; assert.ok(links.every(a => a.protocol === 'https:'));
  assert.equal(f.summaries.at(-1).alerts.count, 1); assert.equal(f.summaries.at(-1).river.value, -1.1);
});
test('locate callbacks target the forecast point and real gauge coordinates', async t => {
  const f = fixture(t); await f.panel.refresh();
  f.root.querySelector('[data-feed="forecast"] button').click(); f.root.querySelector('[data-feed="vllm7"] button').click();
  assert.equal(f.located[0].longitude, -90.1994); assert.equal(f.located[1].latitude, 38.546666666667); assert.equal(f.located[1].longitude, -90.485);
});
test('fresh empty is distinct from outage, stale cached alerts and expired records', async t => {
  const empty = fixture(t, { alerts: { features: [] } }); await empty.panel.refresh();
  assert.match(empty.root.querySelector('[data-feed="alerts"]').textContent, /No active alerts returned/); assert.equal(empty.summaries.at(-1).alerts.count, 0);
  const f = fixture(t); await f.panel.refresh(); f.fail(); f.setClock(NOW + 3600001); await f.panel.refresh({ force: true });
  assert.match(f.root.querySelector('[data-feed="alerts"]').textContent, /Refresh failed/); assert.match(f.root.querySelector('[data-feed="alerts"]').textContent, /expired/); assert.doesNotMatch(f.root.querySelector('[data-feed="alerts"]').textContent, /No active alerts returned/);
  assert.equal(f.summaries.at(-1).alerts.count, null); assert.equal(f.summaries.at(-1).alerts.status, 'stale');
});
test('dispose suppresses late rendering and summary callbacks', async t => {
  const window = new Window(), root = window.document.createElement('div'); let resolve, summaryCount = 0, disposed = 0;
  const idle = Object.fromEntries(['alerts', 'forecast', 'eadm7', 'vllm7'].map(k => [k, { status: 'idle', data: null }]));
  const client = { snapshot: () => idle, refresh: () => new Promise(r => { resolve = r; }), dispose: () => { disposed++; } };
  const panel = createLivePanel(root, { client, onSummary: () => { summaryCount++; } });
  const request = panel.refresh(); panel.dispose(); resolve(idle); await request;
  assert.equal(summaryCount, 1); assert.equal(disposed, 1); assert.match(root.querySelector('#live-status').textContent, /Refreshing/);
  t.after(async () => window.happyDOM.abort());
});
