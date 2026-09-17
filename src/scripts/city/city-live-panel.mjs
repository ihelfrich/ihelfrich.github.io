import { createLiveFeeds, DOWNTOWN, LIVE_CACHE_MS, RIVER_GAUGES } from '../../lib/city-live-feeds.mjs';

const time = value => value ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value)) : 'Unknown';
const hour = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric' }).format(new Date(value));
const number = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'Unknown';
const labels = { idle: 'Not loaded', loading: 'Loading', current: 'Current', empty: 'No records', expired: 'Expired', stale: 'Stale', invalid: 'Source data incomplete', unavailable: 'Unavailable' };

/** Independent public feeds. The host refreshes when opening; no network polling.
 * onSummary({alerts:{status,count,fetchedAt}, forecast:{status,temperature,unit,
 * fetchedAt}, river:{status,value,unit,observedAt,name}}), unknown values null.
 */
export function createLivePanel(root, { onLocate = () => {}, onSummary = () => {}, client = createLiveFeeds(), now = Date.now } = {}) {
  const doc = root.ownerDocument, section = doc.createElement('section');
  section.className = 'live-workspace';
  section.innerHTML = `<div class="live-feed-heading"><div><span class="eyebrow">NOAA / NATIONAL WEATHER SERVICE</span><h2>Live conditions</h2></div><button type="button" class="secondary-button" id="live-refresh">Refresh feeds</button></div><p class="small-note">Regional alerts, downtown forecasts and river gauges. Times are Central. Sources refresh on opening or on request; cached for five minutes.</p><p id="live-status" class="small-note" role="status">Open a source to see its coverage and timestamps.</p><div id="live-feed-cards"></div>`;
  root.append(section);
  const cards = section.querySelector('#live-feed-cards'), button = section.querySelector('#live-refresh'), status = section.querySelector('#live-status');
  let disposed = false, inFlight = null, freshnessTimer = null;
  const el = (tag, value, className) => { const node = doc.createElement(tag); if (value !== undefined) node.textContent = value; if (className) node.className = className; return node; };
  const link = (label, href) => { const node = el('a', label); node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; };
  const note = text => el('p', text, 'small-note');
  const locate = (label, point) => { const node = el('button', label, 'text-button'); node.type = 'button'; node.addEventListener('click', () => onLocate({ ...point, label })); return node; };
  function card(title, entry, id) {
    const node = el('article', undefined, 'live-feed-card'); node.dataset.feed = id;
    const header = el('div', undefined, 'live-feed-card-heading'); header.append(el('h3', title));
    const state = el('span', labels[entry.status] || 'Unavailable', 'feed-state'); state.dataset.state = entry.status; header.append(state); node.append(header);
    if (entry.error) node.append(note(`Refresh failed: ${entry.error}. ${entry.data ? 'Last successful response retained.' : 'No current result is available.'}`));
    if (entry.status === 'stale') node.append(note('This response or its source data is stale. Refresh before treating it as current.'));
    if (entry.fetchedAt) node.append(note(`Fetched ${time(entry.fetchedAt)}`));
    return node;
  }
  function sourceDetails(entry, lines, links) {
    const details = el('details', undefined, 'live-source-details'); details.append(el('summary', 'Source & coverage'));
    for (const line of lines) details.append(note(line));
    if (entry.attemptedAt) details.append(note(`Last attempted ${time(entry.attemptedAt)}`));
    for (const [title, href] of links) if (href) { const row = note(''); row.append(link(title, href)); details.append(row); }
    return details;
  }
  function renderAlerts(entry) {
    const node = card('Regional alerts', entry, 'alerts'), data = entry.data;
    node.append(note('St. Louis City + St. Louis County. An alert may cover only part of a county.'));
    if (!data) node.append(note(entry.status === 'idle' ? 'Refresh to load active NWS alerts.' : 'Alert status is unknown.'));
    else {
      if (!data.alerts.length) node.append(note(entry.status === 'empty' ? 'No active alerts returned for this coverage at fetch time.' : data.status === 'expired' ? 'Previously returned alerts have expired. Refresh to check for new alerts.' : 'No active records remain in this response; current alert status is unknown.'));
      for (const alert of data.alerts) {
        const item = el('details', undefined, 'live-alert');
        const summary = el('summary'); summary.append(el('strong', alert.event), el('span', ` · ${alert.severity} severity`)); item.append(summary);
        if (alert.headline) item.append(note(alert.headline));
        item.append(note(alert.area), note(`Issued ${time(alert.issuedAt)} · Effective ${time(alert.effectiveAt)}`), note(`Onset ${time(alert.onsetAt)} · Expires ${time(alert.expiresAt)}${alert.endsAt ? ` · Ends ${time(alert.endsAt)}` : ''}`));
        if (alert.description) item.append(el('p', alert.description, 'live-alert-text'));
        if (alert.instruction) item.append(el('p', alert.instruction, 'live-alert-text'));
        item.append(link('Official alert', alert.url)); node.append(item);
      }
      if (data.incomplete || data.excluded.invalid) node.append(note('Some source records could not be validated. This is not a complete all-clear.'));
    }
    node.append(sourceDetails(entry, [data?.coverage || 'County UGC MOC510 (City) and MOC189 (County), including intersecting forecast/fire zones.', `NWS collection updated ${time(data?.updatedAt)}`], [['NWS active alert response', data?.sourceUrl || 'https://api.weather.gov/alerts/active?zone=MOC189,MOC510'], ['NWS alerts documentation', 'https://www.weather.gov/documentation/services-web-alerts']]));
    return node;
  }
  function renderForecast(entry) {
    const node = card('Downtown · next 12 hours', entry, 'forecast'), data = entry.data;
    node.append(note('Hourly forecast · modeled future conditions.'), locate('Locate forecast point', DOWNTOWN));
    if (data?.periods?.length) {
      node.append(note(`Forecast issued ${time(data.issuedAt)}`));
      const strip = el('ol', undefined, 'forecast-strip'); strip.setAttribute('aria-label', 'Hourly forecast in Central time');
      for (const period of data.periods) {
        const item = el('li');
        item.append(el('time', hour(period.startAt)), el('strong', period.temperature !== null && period.temperatureUnit ? `${number(period.temperature)}°${period.temperatureUnit}` : 'Temp unknown'), el('span', period.description), el('span', period.precipitationPct === null ? 'Precip. unknown' : `${number(period.precipitationPct)}% precip.`), el('span', [period.windDirection, period.windSpeed].filter(Boolean).join(' ') || 'Wind unknown'));
        item.querySelector('time').dateTime = period.startAt; strip.append(item);
      }
      node.append(strip);
      node.append(note(`Displayed valid period: ${time(data.periods[0].startAt)} – ${time(data.periods.at(-1).endAt)}`));
    } else node.append(note(entry.status === 'expired' ? 'The returned forecast periods have expired.' : 'No usable hourly forecast is available.'));
    node.append(sourceDetails(entry, [data?.coverage || 'NWS forecast grid covering downtown St. Louis at 38.6270, −90.1994.', `Issued ${time(data?.issuedAt)} · Generated ${time(data?.generatedAt)}`], [['Hourly forecast source', data?.sourceUrl], ['NWS point and grid mapping', 'https://api.weather.gov/points/38.6270,-90.1994']]));
    return node;
  }
  function sparkline(observed, forecast) {
    const observations = observed.points, predictions = forecast.status !== 'invalid' && observed.units === forecast.units ? forecast.points : [], points = [...observations, ...predictions];
    if (points.length < 2) return null;
    const values = points.map(p => p.value), times = points.map(p => Date.parse(p.validAt));
    const min = Math.min(...values), max = Math.max(...values), padding = Math.max((max - min) * .15, .05), low = min - padding, high = max + padding;
    const start = Math.min(...times), end = Math.max(...times);
    const ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 360 130'); svg.classList.add('river-sparkline'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `River stage. Solid: observations; dashed: forecast. Vertical range ${number(low)} to ${number(high)} ${observed.units}. ${time(new Date(start).toISOString())} to ${time(new Date(end).toISOString())}.`);
    const add = (tag, attrs, content) => { const element = doc.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value)); if (content) element.textContent = content; svg.append(element); };
    const x = p => 42 + (Date.parse(p.validAt) - start) / (end - start || 1) * 306;
    const y = p => 96 - (p.value - low) / (high - low) * 80;
    add('line', { x1: 42, x2: 348, y1: 96, y2: 96, stroke: 'currentColor', opacity: '.25' });
    add('text', { x: 2, y: 20, fill: 'currentColor', 'font-size': 10 }, `${number(high)}`);
    add('text', { x: 2, y: 96, fill: 'currentColor', 'font-size': 10 }, `${number(low)}`);
    for (const [series, dashed] of [[observations, false], [predictions, true]]) {
      if (series.length < 2) continue;
      add('polyline', { points: series.map(p => `${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 2, ...(dashed ? { 'stroke-dasharray': '5 4' } : {}) });
    }
    add('text', { x: 42, y: 119, fill: 'currentColor', 'font-size': 10 }, `${hour(new Date(start).toISOString())} CT`);
    add('text', { x: 348, y: 119, fill: 'currentColor', 'font-size': 10, 'text-anchor': 'end' }, `${hour(new Date(end).toISOString())} CT`);
    return svg;
  }
  function renderRiver(entry, gauge) {
    const node = card(gauge.name, entry, gauge.id), data = entry.data;
    node.append(locate('Locate gauge', { latitude: gauge.latitude, longitude: gauge.longitude }));
    if (data?.observed.latest) {
      node.append(el('p', `${number(data.observed.latest.value)} ${data.observed.units}`, 'live-feed-value'));
      node.append(note(`Observed gauge stage · ${time(data.observed.latest.validAt)}`));
      const chart = sparkline(data.observed, data.forecast); if (chart) node.append(chart);
      node.append(note(`Solid: observations from the last 48 hours. Dashed: forecast up to 72 hours ahead. Units: ${data.observed.units}; fitted vertical axis.`));
    } else node.append(note('No usable stage observation is available.'));
    if (data?.forecast.points.length && data.forecast.status !== 'invalid') {
      node.append(note(`Forecast ${labels[data.forecast.status]?.toLowerCase() || 'unavailable'} · Issued ${time(data.forecast.issuedAt)}`));
      const next = data.forecast.points[0]; node.append(note(`Next forecast: ${number(next.value)} ${data.forecast.units} valid ${time(next.validAt)}`));
    } else node.append(note(`No current usable river forecast in this response. ${gauge.forecastNote}`));
    node.append(sourceDetails(entry, [data?.coverage || 'Stage relative to the gauge datum; negative values are possible. This is not parcel flood exposure.', `Gauge ${gauge.id.toUpperCase()} · ${gauge.latitude.toFixed(5)}, ${gauge.longitude.toFixed(5)}`, `Latest observation generated ${time(data?.observed.latest?.generatedAt)}`], [['NOAA gauge page', gauge.url], ['NWPS stage / forecast response', data?.sourceUrl || `https://api.water.noaa.gov/nwps/v1/gauges/${gauge.id}/stageflow`]]));
    return node;
  }
  function render(snapshot) {
    if (disposed) return;
    cards.replaceChildren(renderAlerts(snapshot.alerts), renderForecast(snapshot.forecast), ...RIVER_GAUGES.map(g => renderRiver(snapshot[g.id], g)));
    const river = snapshot.eadm7, forecast = snapshot.forecast, alert = snapshot.alerts;
    onSummary({ alerts: { status: alert.status, count: ['current', 'empty'].includes(alert.status) ? alert.data?.alerts.length ?? null : null, fetchedAt: alert.fetchedAt }, forecast: { status: forecast.status, temperature: forecast.data?.periods[0]?.temperature ?? null, unit: forecast.data?.periods[0]?.temperatureUnit ?? null, fetchedAt: forecast.fetchedAt }, river: { status: river.status, value: river.data?.observed.latest?.value ?? null, unit: river.data?.observed.units ?? null, observedAt: river.data?.observed.latest?.validAt ?? null, name: RIVER_GAUGES[0].name } });
  }
  function scheduleFreshness() {
    clearTimeout(freshnessTimer);
    const snapshot = client.snapshot(), current = now();
    const transitions = Object.values(snapshot).flatMap(entry => [entry.fetchedAt ? Date.parse(entry.fetchedAt) + LIVE_CACHE_MS : null, ...(entry.data?.alerts || []).flatMap(a => [Date.parse(a.expiresAt), a.endsAt ? Date.parse(a.endsAt) : null])]).filter(at => Number.isFinite(at) && at > current);
    if (transitions.length) freshnessTimer = setTimeout(() => { render(client.snapshot()); scheduleFreshness(); }, Math.min(...transitions) - current + 10);
  }
  const refresh = ({ force = false } = {}) => {
    if (disposed) return Promise.resolve(client.snapshot());
    if (inFlight) return inFlight;
    button.disabled = true; status.textContent = 'Refreshing independent sources…';
    inFlight = client.refresh({ force }).then(snapshot => {
      if (!disposed) { render(snapshot); status.textContent = `Checked ${time(new Date(now()).toISOString())}. Each card reports its own source status.`; scheduleFreshness(); }
      return snapshot;
    }).finally(() => { inFlight = null; if (!disposed) button.disabled = false; });
    return inFlight;
  };
  const handleRefresh = () => refresh({ force: true }); button.addEventListener('click', handleRefresh);
  render(client.snapshot());
  return { refresh, dispose() { disposed = true; clearTimeout(freshnessTimer); button.removeEventListener('click', handleRefresh); client.dispose(); } };
}
