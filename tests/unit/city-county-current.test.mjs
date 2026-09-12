import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parcelContainsPoint, createParcelLookup } from '../../src/lib/city-parcels.mjs';

const root = process.env.COUNTY_CURRENT_ROOT || new URL('../../public/st-louis/county-current/', import.meta.url).pathname;
const bytes = path => readFile(resolve(root, path.replace('/st-louis/county-current/', '')));
const json = async path => JSON.parse(await bytes(path));
const manifest = await json('manifest.json');
const index = await json(manifest.indexUrl);
const byKey = new Map(index.records.map(record => [record.recordKey, record]));

test('current County bundle has reconciled scope coverage and separate tax/source dates', () => {
  assert.equal(index.records.length, 11151);
  assert.equal(manifest.featureCount, 11151);
  assert.equal(byKey.size, 11151);
  assert.equal(new Set(index.records.map(r => r.sourceObjectId)).size, 11151);
  for (const [scope, count] of Object.entries({ overland: 6931, 'page-i170': 7147 })) {
    assert.equal(manifest.scopes[scope].sourceCount, count);
    assert.equal(index.records.filter(r => r.scope.includes(scope)).length, count);
  }
  assert.deepEqual(index.source, manifest.source);
  assert.equal(index.source.sourceDataEditedAt, null);
  assert.equal(index.source.catalogModifiedAt, '2026-05-05T18:50:23+00:00');
  assert.ok(Number.isFinite(Date.parse(index.source.retrievedAt)));
  assert.ok(Date.parse(index.source.identityRecheckedAt) >= Date.parse(index.source.retrievalStartedAt));
  assert.equal(index.records.filter(r => r.taxYear === 2026).length, 11138);
  assert.equal(index.records.filter(r => r.taxYear === null).length, 13);
  assert.deepEqual(index.source.taxYears, { 2026: 11138, unknown: 13 });
  assert.ok(index.records.every(r => r.assessmentYear === null && r.sourceRecordDate === null));
  assert.equal(index.records.filter(r => r.geometryStatus === 'invalid-source').length, 2);
  assert.equal(manifest.invalidSourceGeometryRecords, 2);
});

test('current identities are distinct from historical records and no personal owner/contact fields are published', () => {
  for (const record of index.records) {
    assert.equal(record.parcelKey, `st-louis-county:${record.parcelId}`);
    assert.equal(record.recordKey, `st-louis-county-current:${record.parcelId}:${record.sourceObjectId}`);
    assert.ok(!Object.keys(record).some(key => /owner|mail|phone|contact|careof/i.test(key)));
    for (const key of ['assessedValueUSD', 'assessorAppraisedValueUSD', 'assessedLandUSD', 'assessedImprovementsUSD', 'appraisedLandUSD', 'appraisedImprovementsUSD']) {
      assert.ok(record[key] === null || Number.isFinite(record[key]) && record[key] >= 0);
    }
  }
  const record = index.records.find(r => r.parcelId === '16L640291');
  assert.ok(record);
  assert.equal(record.taxYear, 2026);
  assert.equal(record.assessedValueUSD, 18710);
  assert.equal(record.assessorAppraisedValueUSD, 98500);
  assert.equal(record.yearBuilt, 1946);
  assert.equal(record.livingAreaSqFt, 840);
  assert.equal(record.schoolDistrict, 'RITENOUR');
  assert.equal(record.fireDistrict, 'COMMUNITY');
  assert.equal(record.taxCode, 'A');
  assert.equal(record.deedBookPage, '24858-958');
});

test('every tile reconciles hashes, identities, attributes and valid representative points', async () => {
  const seen = new Set();
  for (const tile of manifest.tiles) {
    const raw = await bytes(tile.url);
    assert.equal(raw.length, tile.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), tile.sha256);
    const collection = JSON.parse(raw);
    assert.equal(collection.type, 'FeatureCollection');
    assert.equal(collection.features.length, tile.count);
    for (const feature of collection.features) {
      const record = byKey.get(feature.properties.recordKey);
      assert.ok(record);
      assert.equal(feature.id, record.recordKey);
      assert.ok(!seen.has(feature.id));
      seen.add(feature.id);
      const { longitude, latitude, ...attributes } = record;
      assert.deepEqual(feature.properties, attributes);
      if (record.geometryStatus !== 'invalid-source') assert.ok(parcelContainsPoint(feature.geometry, record));
    }
  }
  assert.equal(seen.size, manifest.featureCount);
});

test('the current bundle resolves exact source geometry while preserving current tax-year labels', async () => {
  const lookup = createParcelLookup({
    manifestUrl: '/st-louis/county-current/manifest.json',
    fetchImpl: async url => ({ ok: true, json: () => json(url) }),
  });
  const record = index.records.find(r => r.parcelId === '16L640291');
  const result = await lookup(record);
  assert.equal(result.status, 'found');
  assert.equal(result.parcel.properties.recordKey, record.recordKey);
  assert.equal(result.parcel.properties.taxYear, 2026);
  assert.equal(result.parcel.properties.assessmentYear, null);
});
