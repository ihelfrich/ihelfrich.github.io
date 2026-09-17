import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterCountyParcels, countyParcelCsv} from '../../src/lib/county-parcels.mjs';

const row = (recordKey, extra) => Object.freeze({recordKey, address: `${recordKey} PAGE AVE`, parcelId: `PID-${recordKey}`, municipality: 'OVERLAND', postalCode: '63114', scope: Object.freeze(['overland']), dwellingUnits: 1, ...extra});
const fixture = Object.freeze([
  row('10', {yearBuilt: 1980, livingAreaSqFt: 1500, areaSqFt: 5000, assessedValueUSD: 20000}),
  row('2', {yearBuilt: 1950, livingAreaSqFt: 1000, areaSqFt: 9000, assessedValueUSD: 12000}),
  row('20', {yearBuilt: null, livingAreaSqFt: null, assessedValueUSD: null, dwellingUnits: 0}),
  row('3', {yearBuilt: 1950, livingAreaSqFt: 1000, areaSqFt: 2000, assessedValueUSD: 0, dwellingUnits: 2}),
  row('4', {yearBuilt: undefined, livingAreaSqFt: NaN, assessedValueUSD: Infinity, scope: Object.freeze(['page-i170'])}),
  row('5', {yearBuilt: '1950', livingAreaSqFt: '1000', assessedValueUSD: '12000', dwellingUnits: null, address: null}),
]);
const all = {scope: 'all', residential: false, limit: 30000};
const keys = result => result.records.map(record => record.recordKey);

test('bounds are inclusive, intersect, and refer to living area rather than parcel area', () => {
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, builtMin: 1950, builtMax: 1950, areaMin: 1000, areaMax: 1000})), ['2', '3']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, unitsMin: 2, unitsMax: 2})), ['3']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, unitsMin: 0, unitsMax: 0})), ['20']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, areaMin: 2000})), []);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, builtMin: 0})), ['10', '2', '3']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, builtMin: '', builtMax: null})), keys(filterCountyParcels(fixture, all)));
});

test('malformed numeric bounds, reversed ranges, unknown sorts and invalid pagination reject', () => {
  for (const invalid of [-1, NaN, Infinity, '1950', ' ', true, {}]) assert.throws(() => filterCountyParcels(fixture, {builtMin: invalid}), RangeError);
  for (const options of [{builtMin: 2000, builtMax: 1900}, {areaMin: 2, areaMax: 1}, {unitsMin: 2, unitsMax: 1}, {sort: 'owner'}, {direction: 'sideways'}, {scope: 'county'}, {offset: -1}, {offset: 0.5}, {limit: 0}, {limit: 30001}]) assert.throws(() => filterCountyParcels(fixture, options), RangeError);
});

test('address ordering is numeric and missing values remain last in both directions', () => {
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, sort: 'address'})), ['2', '3', '4', '10', '20', '5']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, sort: 'address', direction: 'desc'})), ['20', '10', '4', '3', '2', '5']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, sort: 'yearBuilt'})), ['2', '3', '10', '20', '4', '5']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, sort: 'yearBuilt', direction: 'desc'})), ['10', '2', '3', '20', '4', '5']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, sort: 'livingAreaSqFt', direction: 'desc'})), ['10', '2', '3', '20', '4', '5']);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, sort: 'assessedValueUSD'})), ['3', '2', '10', '20', '4', '5']);
});

test('sort/filter results preserve source records, default source order and total beyond the page', () => {
  const before = [...fixture];
  filterCountyParcels(fixture, {...all, sort: 'yearBuilt'});
  const source = filterCountyParcels(fixture, all);
  assert.deepEqual(source.records, before);
  assert.equal(source.records[0], fixture[0]);
  const page = filterCountyParcels(fixture, {...all, offset: 2, limit: 2});
  assert.equal(page.total, 6);
  assert.deepEqual(keys(page), ['20', '3']);
  assert.deepEqual(filterCountyParcels(fixture, {...all, offset: 100, limit: 2}), {total: 6, records: [], offset: 100, limit: 2});
  const replacement = [...fixture, row('6', {yearBuilt: 2000})];
  assert.equal(filterCountyParcels(replacement, all).total, 7);
  assert.deepEqual(fixture, before);
});

test('query tokens intersect scope, dwelling filter, numeric bounds and export order', () => {
  const options = {scope: 'overland', query: 'PAGE 63114', builtMax: 1980, sort: 'address', direction: 'desc', limit: 1};
  assert.deepEqual(keys(filterCountyParcels(fixture, options)), ['10']);
  const exported = filterCountyParcels(fixture, {...options, limit: 30000});
  assert.deepEqual(keys(exported), ['10', '3', '2']);
  for (let offset = 0; offset < exported.total; offset++) assert.equal(filterCountyParcels(fixture, {...options, offset}).records[0], exported.records[offset]);
  assert.deepEqual(keys(filterCountyParcels(fixture, {...all, query: 'pid-2 overland'})), ['2', '20']);
  const csv = countyParcelCsv(exported.records, {url: 'https://example.org/source', sourceDataEditedAt: '2024-10-02', retrievedAt: '2026-09-11'});
  assert.equal(csv.split('\r\n').length, 4);
  assert.ok(csv.indexOf('10 PAGE AVE') < csv.indexOf('3 PAGE AVE'));
});

test('prepared queries exactly retain legacy results over the real 11,152-record snapshot', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../public/st-louis/county-parcels/manifest.json', import.meta.url), 'utf8'));
  const {records} = JSON.parse(await readFile(new URL(`../../public${manifest.indexUrl}`, import.meta.url), 'utf8'));
  const norm = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const scope of ['overland', 'page-i170', 'all']) for (const residential of [true, false]) for (const query of ['', 'page', '9509 Lackland', '63114', records[0].parcelId, 'missing address xyz']) {
    const options = {scope, residential, query, offset: 3, limit: 17};
    const tokens = norm(query).split(' ').filter(Boolean);
    const expected = records.filter(record => (scope === 'all' || record.scope?.includes(scope)) && (!residential || record.dwellingUnits > 0) && tokens.every(token => norm([record.address, record.parcelId, record.municipality, record.postalCode].join(' ')).includes(token)));
    assert.deepEqual(filterCountyParcels(records, options), {total: expected.length, records: expected.slice(3, 20), offset: 3, limit: 17});
  }
});
