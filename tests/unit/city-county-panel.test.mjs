import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createCountyPanel} from '../../src/scripts/city/city-county-panel.mjs';

const viewKey = 'st-louis-parcel-views-v1';
const parcel = (n, patch = {}) => ({
  recordKey: `fixture-record-${n}`, parcelId: `fixture-parcel-${n}`,
  address: `${n} Fixture Page Road`, municipality: 'Overland', postalCode: '63114',
  dwellingUnits: 1, yearBuilt: 1900 + n, livingAreaSqFt: 1000 + n * 100,
  areaSqFt: 5000, assessmentYear: 2023, assessedValueUSD: 10000 + n * 1000,
  assessorAppraisedValueUSD: 50000 + n * 5000, longitude: -90.37, latitude: 38.7,
  scope: ['overland', 'page-i170'], ...patch,
});
const snapshot = records => ({
  records,
  source: {url: 'https://example.org/synthetic-county-source', assessmentYears: {'2023': records.length}, sourceDataEditedAt: '2024-10-02T00:00:00Z', retrievedAt: '2026-09-12T00:00:00Z'},
  manifest: {invalidSourceGeometryRecords: 0},
});

function fixture(t, {records = Array.from({length: 45}, (_, i) => parcel(i + 1)), store = new Map(), storage, load} = {}) {
  const window = new Window(), root = window.document.createElement('section');
  window.document.body.append(root);
  const selected = [], located = [], data = snapshot(records);
  const backing = storage ?? {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
  const panel = createCountyPanel(root, {load: load ?? (async () => data), storage: () => backing, onSelect: value => selected.push(value), onLocate: value => located.push(value)});
  const q = name => root.querySelector(`[data-county-${name}]`);
  const set = (name, value) => {const control = q(name);control.value = String(value);control.dispatchEvent(new window.Event(control.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));};
  const bound = (name, value) => {const control = root.querySelector(`[data-county-bound="${name}"]`);control.value = String(value);control.dispatchEvent(new window.Event('input', {bubbles: true}));};
  const keys = () => [...root.querySelectorAll('[data-county-inspect]')].map(button => button.dataset.countyInspect);
  const inspect = key => root.querySelector(`[data-county-inspect="${key}"]`).click();
  const pin = key => {const control = root.querySelector(`[data-county-pin="${key}"]`);assert.ok(control, `Visible compare control for ${key}`);control.click();};
  t.after(() => window.happyDOM.abort());
  return {window, root, panel, q, set, bound, keys, inspect, pin, selected, located, store, data};
}

function captureDownloads(t, f) {
  const blobs = [], links = [], cleanup = [];
  t.mock.method(URL, 'createObjectURL', blob => {blobs.push(blob);return `blob:county-fixture-${blobs.length}`;});
  t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(f.window.HTMLAnchorElement.prototype, 'click', function () {links.push({name: this.download, href: this.href});});
  const originalTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    if (delay === 60000) {cleanup.push(callback);return 0;}
    return originalTimeout(callback, delay, ...args);
  });
  t.after(() => cleanup.forEach(callback => callback()));
  return {blobs, links};
}

test('live range and sort controls use the whole cohort, reset pagination and exclude unknown measurements', async t => {
  const f = fixture(t, {records: [...Array.from({length: 45}, (_, i) => parcel(i + 1)), parcel(99, {yearBuilt: null, livingAreaSqFt: null})]});
  await f.panel.start('overland');
  assert.equal(f.keys().length, 20);
  f.q('next').click();assert.match(f.q('page').textContent, /^21–40/);
  f.bound('areaMin', 2000);f.bound('areaMax', 3500);
  assert.match(f.q('total').textContent, /^16 matching/);
  assert.match(f.q('page').textContent, /^1–16/);
  assert.equal(f.keys().includes('fixture-record-99'), false);
  f.set('sort', 'yearBuilt:desc');
  assert.equal(f.keys()[0], 'fixture-record-25');
  assert.equal(f.keys().at(-1), 'fixture-record-10');
  f.set('query', 'fixture-parcel-12');
  assert.deepEqual(f.keys(), ['fixture-record-12']);
  f.q('reset').click();
  assert.match(f.q('total').textContent, /^46 matching/);
  assert.equal(f.q('sort').value, 'address:asc');
});

test('comparison pins stop at three, remain through filters and can inspect a hidden pinned record', async t => {
  const f = fixture(t);await f.panel.start('overland');
  for (const n of [1, 2, 3]) f.pin(`fixture-record-${n}`);
  assert.equal(f.panel.getComparison().length, 3);
  assert.equal(f.root.querySelector('[data-county-pin="fixture-record-4"]').disabled, true);
  f.pin('fixture-record-4');assert.equal(f.panel.getComparison().length, 3);
  f.set('query', 'fixture-parcel-45');
  assert.deepEqual(f.keys(), ['fixture-record-45']);
  assert.equal(f.q('comparison').hidden, false);
  assert.deepEqual(f.panel.getComparison().map(r => r.recordKey), ['fixture-record-1', 'fixture-record-2', 'fixture-record-3']);
  f.root.querySelector('[data-county-compare-inspect="fixture-record-2"]').click();
  assert.equal(f.selected.at(-1).recordKey, 'fixture-record-2');
  f.root.querySelector('[data-county-remove="fixture-record-1"]').click();
  assert.equal(f.root.querySelector('[data-county-pin="fixture-record-45"]').disabled, false);
  f.pin('fixture-record-45');
  assert.deepEqual(f.panel.getComparison().map(r => r.recordKey), ['fixture-record-2', 'fixture-record-3', 'fixture-record-45']);
  f.q('clear-compare').click();assert.equal(f.q('comparison').hidden, true);
});

test('selection and comparison retain exact source identity when address and parcel ID are duplicated', async t => {
  const first = parcel(1, {address: '1 Shared Fixture Way', parcelId: 'SHARED'});
  const second = parcel(2, {address: '1 Shared Fixture Way', parcelId: 'SHARED', dwellingUnits: 2});
  const f = fixture(t, {records: [first, second]});await f.panel.start('overland');
  f.inspect(second.recordKey);
  assert.deepEqual(f.selected[0], {...second, resultKind: 'parcel', source: f.data.source});
  assert.equal(f.root.querySelector(`[data-county-inspect="${second.recordKey}"]`).closest('tr').getAttribute('aria-selected'), 'true');
  assert.equal(f.root.querySelector(`[data-county-inspect="${first.recordKey}"]`).closest('tr').getAttribute('aria-selected'), 'false');
  f.pin(first.recordKey);f.pin(second.recordKey);
  assert.deepEqual(f.panel.getComparison().map(r => r.recordKey), [first.recordKey, second.recordKey]);
  f.set('sort', 'assessedValueUSD:desc');
  assert.equal(f.root.querySelector(`[data-county-inspect="${second.recordKey}"]`).closest('tr').getAttribute('aria-selected'), 'true');
});

test('all-matches CSV exports the full filtered cohort from later pages with the same sort and source dates', async t => {
  const f = fixture(t), exports = captureDownloads(t, f);await f.panel.start('overland');
  f.bound('areaMin', 1500);f.set('sort', 'yearBuilt:desc');
  f.q('next').click();assert.match(f.q('page').textContent, /^21–40 of 41/);
  f.q('export').click();
  assert.equal(exports.blobs.length, 1);assert.equal(exports.links[0].name, 'overland-filtered-parcels.csv');
  const csv = await exports.blobs[0].text(), lines = csv.split('\r\n');
  assert.equal(lines.length, 42);
  assert.match(lines[1], /"fixture-record-45"/);
  assert.match(lines.at(-1), /"fixture-record-5"/);
  assert.equal(lines.some(line => line.includes('"fixture-record-4"')), false);
  assert.ok(lines.slice(1).every(line => line.includes('2024-10-02T00:00:00Z') && line.includes('2026-09-12T00:00:00Z')));
  assert.match(f.q('status').textContent, /Exported 41 records/);
});

test('comparison export contains pinned source records even when none match the visible query', async t => {
  const f = fixture(t), exports = captureDownloads(t, f);await f.panel.start('overland');
  f.pin('fixture-record-2');f.pin('fixture-record-7');f.set('query', 'missing-property');
  assert.equal(f.keys().length, 0);f.q('export-compare').click();
  assert.equal(exports.links[0].name, 'parcel-comparison.csv');
  const lines = (await exports.blobs[0].text()).split('\r\n');
  assert.equal(lines.length, 3);assert.match(lines[1], /"fixture-record-2"/);assert.match(lines[2], /"fixture-record-7"/);
});

test('invalid ranges pause results and all-matches exports until corrected without clearing pinned records', async t => {
  const f = fixture(t), exports = captureDownloads(t, f);await f.panel.start('overland');
  f.pin('fixture-record-1');f.bound('builtMin', 1940);f.bound('builtMax', 1920);
  assert.match(f.q('status').textContent, /minimum cannot exceed/);
  assert.equal(f.q('total').textContent, 'Check filter ranges');assert.equal(f.keys().length, 0);
  assert.equal(f.q('prev').disabled, true);assert.equal(f.q('next').disabled, true);assert.equal(f.q('export').disabled, true);
  f.q('export').click();assert.equal(exports.blobs.length, 0);
  assert.equal(f.panel.getComparison().length, 1);
  f.bound('builtMax', 1945);assert.equal(f.q('export').disabled, false);assert.match(f.q('total').textContent, /^6 matching/);
  assert.equal(f.q('status').textContent, '');
});

test('saved views restore complete filter and sort state after a new panel loads and do not store results', async t => {
  const store = new Map(), first = fixture(t, {store});await first.panel.start('page-i170');
  first.set('use', 'all');first.set('query', 'Fixture Page');first.set('sort', 'livingAreaSqFt:desc');
  first.bound('builtMin', 1905);first.bound('builtMax', 1925);first.bound('areaMin', 1500);first.bound('areaMax', 3500);first.bound('unitsMin', 1);first.bound('unitsMax', 2);
  const expected = first.keys();first.set('view-name', 'Page cohort');first.q('save-view').click();
  const saved = JSON.parse(store.get(viewKey));assert.equal(saved.length, 1);assert.deepEqual(Object.keys(saved[0]).sort(), ['name', 'options']);
  const second = fixture(t, {store});await second.panel.start('overland');
  second.set('views', 'Page cohort');second.q('load-view').click();
  assert.equal(second.q('scope').value, 'page-i170');assert.equal(second.q('use').value, 'all');assert.equal(second.q('sort').value, 'livingAreaSqFt:desc');
  assert.equal(second.q('query').value, 'Fixture Page');assert.deepEqual(second.keys(), expected);
  assert.equal(second.located.at(-1), 'page-i170');assert.match(second.q('status').textContent, /Loaded Page cohort/);
});

test('failed saved-view storage keeps earlier views intact and does not claim a successful save', async t => {
  const prior = [{name: 'Existing', options: {scope: 'overland', query: '', residential: true, sort: 'address', direction: 'asc'}}];
  const raw = JSON.stringify(prior), writes = [];
  const f = fixture(t, {storage: {getItem: () => raw, setItem: (key, value) => {writes.push({key, value});throw Error('Synthetic storage quota exceeded');}}});
  await f.panel.start('overland');f.set('view-name', 'Unsaved filters');f.q('save-view').click();
  assert.equal(writes.length, 1);assert.match(f.q('status').textContent, /Synthetic storage quota exceeded/);
  assert.deepEqual([...f.q('views').options].map(option => option.value), ['', 'Existing']);
  f.set('views', 'Existing');f.q('load-view').click();assert.match(f.q('total').textContent, /^45 matching/);
  assert.equal(f.q('views').querySelector('[value="Unsaved filters"]'), null);
});

test('failed snapshot requests remain retryable and cannot expose an enabled empty workspace', async t => {
  let calls = 0;const data = snapshot([parcel(1)]);
  const f = fixture(t, {load: async () => {if (++calls === 1) throw Error('Synthetic network outage');return data;}});
  await f.panel.start('overland');assert.equal(f.q('controls').hidden, true);assert.match(f.q('status').textContent, /could not load/);
  await f.panel.start('overland');assert.equal(f.q('controls').hidden, false);assert.deepEqual(f.keys(), ['fixture-record-1']);assert.deepEqual(f.located, ['overland']);
});

test('an older delayed snapshot cannot replace the active source behind visible results', async t => {
  const pending = [], f = fixture(t, {load: () => new Promise(resolve => pending.push(resolve))});
  const first = f.panel.start('overland'), second = f.panel.start('page-i170');
  const newer = parcel(2), older = parcel(1);
  pending[1](snapshot([newer]));await second;
  assert.deepEqual(f.keys(), [newer.recordKey]);
  pending[0](snapshot([older]));await first;
  assert.deepEqual(f.keys(), [newer.recordKey]);
  f.set('query', '');
  assert.deepEqual(f.keys(), [newer.recordKey], 'A late abandoned request must not silently replace active query data');
  f.inspect(newer.recordKey);assert.equal(f.selected.at(-1).recordKey, newer.recordKey);
  assert.deepEqual(f.located, ['page-i170']);
});

test('changing the area selector updates result scope and routes the map callback without changing other filters', async t => {
  const f = fixture(t, {records: [parcel(1, {scope: ['overland']}), parcel(2, {scope: ['page-i170']}), parcel(3)]});
  await f.panel.start('overland');f.set('query', 'Fixture');f.bound('areaMin', 1100);f.set('sort', 'yearBuilt:desc');
  assert.deepEqual(f.keys(), ['fixture-record-3', 'fixture-record-1']);
  f.set('scope', 'page-i170');
  assert.deepEqual(f.keys(), ['fixture-record-3', 'fixture-record-2']);
  assert.deepEqual(f.located, ['overland', 'page-i170']);
  assert.equal(f.q('query').value, 'Fixture');assert.equal(f.q('sort').value, 'yearBuilt:desc');
  assert.equal(f.root.querySelector('[data-county-bound="areaMin"]').value, '1100');
  f.set('scope', 'all');
  assert.deepEqual(f.keys(), ['fixture-record-3', 'fixture-record-2', 'fixture-record-1']);
  assert.deepEqual(f.located, ['overland', 'page-i170', 'all']);
});

test('invalid or unsupported saved-view options cannot partly replace active controls, rows or map scope', async t => {
  const valid = {scope: 'page-i170', query: '', residential: true, sort: 'address', direction: 'asc'};
  const invalid = [
    {...valid, scope: undefined}, {...valid, scope: 'unrecognized'},
    {...valid, query: 12}, {...valid, query: 'x'.repeat(161)},
    {...valid, residential: 'false'}, {...valid, sort: undefined},
    {...valid, direction: undefined}, {...valid, direction: 'desc'},
    {...valid, builtMin: 2020, builtMax: 1950}, {...valid, unitsMin: -1},
  ];
  const store = new Map([[viewKey, JSON.stringify(invalid.map((options, i) => ({name: `Invalid ${i}`, options})))]]);
  const f = fixture(t, {store});await f.panel.start('overland');
  f.set('query', 'Fixture');f.set('sort', 'yearBuilt:desc');f.bound('areaMin', 1500);f.q('next').click();
  const current = () => ({
    scope: f.q('scope').value, query: f.q('query').value, use: f.q('use').value, sort: f.q('sort').value,
    bounds: [...f.root.querySelectorAll('[data-county-bound]')].map(control => control.value),
    keys: f.keys(), page: f.q('page').textContent, total: f.q('total').textContent, locations: [...f.located],
  });
  const expected = current();
  for (let i = 0; i < invalid.length; i++) {
    f.set('views', `Invalid ${i}`);f.q('load-view').click();
    assert.deepEqual(current(), expected, `Invalid saved view ${i} must be rejected before applying any control`);
    assert.doesNotMatch(f.q('status').textContent, /^Loaded /);
    assert.equal(f.q('export').disabled, false);
  }
});

test('deleting a saved view is atomic on storage failure and preserves active filters after a successful retry', async t => {
  const options = {scope: 'page-i170', query: '', residential: true, sort: 'address', direction: 'asc'};
  const store = new Map([[viewKey, JSON.stringify([{name: 'Remove this', options}, {name: 'Keep this', options}])]]);
  let denyWrite = true;
  const storage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => {if (denyWrite) throw Error('Synthetic storage unavailable');store.set(key, value);}};
  const f = fixture(t, {storage});await f.panel.start('overland');
  f.set('query', 'Fixture');f.bound('builtMin', 1910);f.set('sort', 'assessedValueUSD:desc');f.q('next').click();
  const expectedKeys = f.keys(), expectedPage = f.q('page').textContent;
  f.set('views', 'Remove this');f.q('delete-view').click();
  assert.match(f.q('status').textContent, /Synthetic storage unavailable/);
  assert.deepEqual(JSON.parse(store.get(viewKey)).map(view => view.name), ['Remove this', 'Keep this']);
  assert.deepEqual([...f.q('views').options].map(option => option.value), ['', 'Remove this', 'Keep this']);
  assert.equal(f.q('views').value, 'Remove this');
  denyWrite = false;f.q('delete-view').click();
  assert.deepEqual(JSON.parse(store.get(viewKey)).map(view => view.name), ['Keep this']);
  assert.deepEqual([...f.q('views').options].map(option => option.value), ['', 'Keep this']);
  assert.match(f.q('status').textContent, /Current filters are unchanged/);
  assert.equal(f.q('scope').value, 'overland');assert.equal(f.q('query').value, 'Fixture');
  assert.equal(f.q('sort').value, 'assessedValueUSD:desc');
  assert.equal(f.root.querySelector('[data-county-bound="builtMin"]').value, '1910');
  assert.deepEqual(f.keys(), expectedKeys);assert.equal(f.q('page').textContent, expectedPage);
  assert.deepEqual(f.located, ['overland']);
});

test('removing the last comparison pin returns keyboard focus to the visible parcel query', async t => {
  const f = fixture(t);await f.panel.start('overland');f.pin('fixture-record-1');
  const remove = f.root.querySelector('[data-county-remove="fixture-record-1"]');remove.focus();remove.click();
  assert.equal(f.panel.getComparison().length, 0);assert.equal(f.q('comparison').hidden, true);
  assert.equal(f.window.document.activeElement, f.q('query'));
});
