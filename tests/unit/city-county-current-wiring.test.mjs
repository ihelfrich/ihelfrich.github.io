import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCountyLookup,createCountyIndex,loadCountyIndex,countyParcelCsv,COUNTY_MANIFEST,CURRENT_COUNTY_MANIFEST} from '../../src/lib/county-parcels.mjs';

const json = async path => JSON.parse(await readFile(new URL('../../public' + path, import.meta.url), 'utf8'));
const currentManifest = await json(CURRENT_COUNTY_MANIFEST), historicalManifest = await json(COUNTY_MANIFEST);
const current = await json(currentManifest.indexUrl), historical = await json(historicalManifest.indexUrl);
const oldByLocator = new Map(historical.records.map(record => [record.parcelId, record]));
const currentRecord = current.records.find(record => record.taxYear === 2026 && record.dwellingUnits > 0 && oldByLocator.get(record.parcelId)?.assessmentYear === 2023);
const historicalRecord = oldByLocator.get(currentRecord.parcelId);
function localFetch() {
  const paths = [], parsed = new Map();
  return {paths, fetchImpl: async path => {
    assert.ok(path.startsWith('/st-louis/'), 'Tests must never make a network request');
    paths.push(path);
    if (!parsed.has(path)) parsed.set(path, json(path));
    return {ok: true, json: () => parsed.get(path)};
  }};
}

test('exact current and saved historical identities resolve their original geometry and source independently', async () => {
  const fake = localFetch(), lookup = createCountyLookup({fetchImpl: fake.fetchImpl});
  const now = await lookup(currentRecord);
  assert.equal(now.status, 'found');assert.equal(now.parcel.properties.recordKey, currentRecord.recordKey);
  assert.equal(now.parcel.properties.parcelKey, `st-louis-county:${currentRecord.parcelId}`);
  assert.equal(now.parcel.properties.taxYear, 2026);assert.equal(now.parcel.properties.assessmentYear, null);
  assert.equal(now.source.id, 'st-louis-county-current');
  assert.ok(fake.paths.every(path => path.startsWith('/st-louis/county-current/')));
  const currentFetches = fake.paths.length;
  assert.equal((await lookup(currentRecord)).parcel.properties.recordKey, currentRecord.recordKey);
  assert.equal(fake.paths.length, currentFetches, 'Repeated current lookups reuse the manifest and tile cache');

  const then = await lookup(historicalRecord);
  assert.equal(then.status, 'found');assert.equal(then.parcel.properties.recordKey, historicalRecord.recordKey);
  assert.equal(then.parcel.properties.assessmentYear, 2023);
  assert.equal(then.parcel.properties.parcelId, now.parcel.properties.parcelId);
  assert.notEqual(then.parcel.properties.recordKey, now.parcel.properties.recordKey);
  assert.equal(then.source.id, historicalManifest.source.id);
  assert.ok(fake.paths.slice(currentFetches).every(path => path.startsWith('/st-louis/county-parcels/')));
});

test('coordinate and durable parcel-key selection use the current snapshot, not the legacy record namespace', async () => {
  const fake = localFetch(), lookup = createCountyLookup({fetchImpl: fake.fetchImpl});
  const point = {longitude:currentRecord.longitude,latitude:currentRecord.latitude,parcelKey:currentRecord.parcelKey};
  const result = await lookup(point);
  assert.equal(result.status, 'found');assert.equal(result.parcel.properties.recordKey, currentRecord.recordKey);
  assert.equal(result.source.id, 'st-louis-county-current');
  assert.ok(fake.paths.every(path => path.startsWith('/st-louis/county-current/')));
  const coordinate = await lookup({longitude:point.longitude,latitude:point.latitude});
  assert.equal(coordinate.source.id, 'st-louis-county-current');
  assert.ok(coordinate.candidates.some(candidate => candidate.properties.recordKey === currentRecord.recordKey));
});

test('explicit current loading and the production default preserve tax-year versus valuation-year semantics', async t => {
  const fake = localFetch(), explicit = createCountyIndex({fetchImpl:fake.fetchImpl,manifestUrl:CURRENT_COUNTY_MANIFEST});
  const loaded = await explicit();
  assert.equal(loaded.records.length,11151);assert.equal(loaded.manifestUrl,CURRENT_COUNTY_MANIFEST);
  assert.equal(loaded.records.filter(record => record.taxYear === 2026).length,11138);
  assert.equal(loaded.records.filter(record => record.taxYear === null).length,13);
  assert.ok(loaded.records.every(record => record.assessmentYear === null));
  assert.equal(loaded.source.sourceDataEditedAt,null);assert.equal(loaded.source.taxYears['2026'],11138);
  t.mock.method(globalThis,'fetch',fake.fetchImpl);
  const production = await loadCountyIndex();
  assert.equal(production.manifestUrl,CURRENT_COUNTY_MANIFEST);assert.equal(production.source.id,'st-louis-county-current');
  const legacy = await createCountyIndex({fetchImpl:fake.fetchImpl})();
  assert.equal(legacy.records.length,11152);assert.equal(legacy.manifestUrl,COUNTY_MANIFEST);
});

test('current CSV includes the source tax year and leaves unreported valuation/edit dates blank', () => {
  const csv=countyParcelCsv([currentRecord],current.source),lines=csv.split('\r\n');
  const cells=line=>[...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(match=>match[1].startsWith('"')?match[1].slice(1,-1).replaceAll('""','"'):match[1]);
  const headers=cells(lines[0]),values=cells(lines[1]),row=Object.fromEntries(headers.map((key,i)=>[key,values[i]]));
  assert.equal(values.length,headers.length);assert.equal(row.recordKey,currentRecord.recordKey);
  assert.equal(row.taxYear,'2026');assert.equal(row.assessmentYear,'');assert.equal(row.sourceDataEditedAt,'');
  assert.equal(row.sourceUrl,current.source.url);assert.equal(row.retrievedAt,current.source.retrievedAt);
});
