import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const publicUrl = path => new URL('../../public' + path, import.meta.url);
const manifest = JSON.parse(await readFile(publicUrl('/st-louis/county-history/manifest.json'), 'utf8'));
const collections = ['taxes', 'sales', 'assessments', 'appraisals'];
const tiles = await Promise.all(manifest.tiles.map(async descriptor => {
  const bytes = await readFile(publicUrl(descriptor.url));
  return {descriptor, bytes, parsed: JSON.parse(bytes)};
}));
const records = tiles.flatMap(tile => Object.values(tile.parsed.records));
const lookup = new Map(records.map(record => [record.parcelId, record]));
const fields = {
  taxes: ['sourceRow','taxYear','rollType','assessmentClass','taxAmountUSD','otherFeesUSD'],
  sales: ['sourceRow','priceUSD','priceStatus','saleDate','saleDateISO','saleDateCenturyInferred','transactionDate','transactionDateISO','transactionDateCenturyInferred','transferNumber','book','page','sourceCode','saleTypeCode','validityCode','instrumentNumber','instrumentTypeCode','marketValidityCode','flags'],
  assessments: ['sourceRow','taxYear','reasonCode','assessmentClass','classification','landUseCode','taxCode','appraisedLandUSD','appraisedBuildingUSD','appraisedTotalUSD','assessedLandUSD','assessedBuildingUSD','assessedTotalUSD','taxableAssessedUSD','exemptAssessedLandUSD','exemptAssessedBuildingUSD','exemptAssessedTotalUSD'],
  appraisals: ['sourceRow','taxYear','reasonCode','rollType','appraisedLandUSD','appraisedBuildingUSD','appraisedTotalUSD','costValueUSD','sourceMarketValueUSD','sourceAssessedValueUSD'],
};

test('historical tiles reconcile byte hashes and exactly cover the current study locator set', async () => {
  const currentBytes = await readFile(publicUrl('/st-louis/county-current/index.json'));
  const current = JSON.parse(currentBytes);
  assert.equal(manifest.schema, 'county-history-manifest-v1');assert.equal(manifest.historical, true);
  assert.equal(createHash('sha256').update(currentBytes).digest('hex'), manifest.currentStudyIndexSha256);
  assert.equal(manifest.studyLocatorCount, 11151);assert.equal(records.length, 11151);assert.equal(lookup.size, 11151);
  assert.deepEqual([...lookup.keys()].sort(), current.records.map(record => record.parcelId).sort());
  assert.equal(tiles.length, 100);
  for (const {descriptor, bytes, parsed} of tiles) {
    assert.equal(parsed.schema, 'county-history-tile-v1');assert.equal(parsed.sourceId, manifest.source.id);
    assert.equal(bytes.length, descriptor.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
    assert.equal(Object.keys(parsed.records).length, descriptor.locatorCount);
    assert.ok(bytes.length < 600000, 'Bound individual lazy requests, not just total archive size');
    assert.ok(Object.entries(parsed.records).every(([locator, record]) => locator === record.parcelId && locator.slice(-2) === descriptor.id));
  }
});

test('all emitted records use strict public field allowlists and reconcile row-level coverage', () => {
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), ['parcelId', ...collections].sort());
    for (const collection of collections) for (const row of record[collection]) {
      assert.deepEqual(Object.keys(row).sort(), fields[collection].sort());
      assert.ok(Number.isSafeInteger(row.sourceRow) && row.sourceRow >= 2);
      assert.ok(Object.values(row).every(value => typeof value !== 'number' || Number.isFinite(value)));
    }
  }
  for (const collection of collections) {
    const rows = records.flatMap(record => record[collection]);
    assert.equal(rows.length, manifest.counts[collection].retainedRows);
    assert.equal(new Set(rows.map(row => row.sourceRow)).size, rows.length, 'Keep each original source record exactly once');
    assert.equal(records.filter(record => record[collection].length).length, manifest.counts[collection].matchedLocators);
    assert.equal(records.filter(record => record[collection].length > 1).length, manifest.counts[collection].locatorsWithMultipleRows);
    assert.equal(records.filter(record => !record[collection].length).length, manifest.counts[collection].unmatchedLocators);
  }
  assert.equal(manifest.counts.taxes.retainedRows, 10816);
  assert.equal(manifest.counts.sales.retainedRows, 36467);
  assert.equal(manifest.counts.assessments.retainedRows, 11109);
  assert.equal(manifest.counts.appraisals.retainedRows, 11078);
});

test('historical tax classes and other fees remain separate; source zero and absent records differ', () => {
  assert.deepEqual(lookup.get('14L321101').taxes, [
    {sourceRow:107392,taxYear:2020,rollType:'REAL',assessmentClass:'C',taxAmountUSD:1351.7,otherFeesUSD:208.93},
    {sourceRow:107393,taxYear:2020,rollType:'REAL',assessmentClass:'R',taxAmountUSD:995.54,otherFeesUSD:0},
  ]);
  assert.equal(lookup.get('16K620304').taxes[0].taxAmountUSD, 0);
  assert.ok(records.some(record => record.taxes.length === 0));
  assert.equal(manifest.counts.taxes.locatorsWithMultipleRows, 27);
  assert.ok(records.flatMap(record => record.taxes).every(row => row.taxYear === 2020));
  assert.ok(records.flatMap(record => record.assessments).every(row => row.taxYear === 2021));
  assert.ok(records.flatMap(record => record.appraisals).every(row => row.taxYear === 2021));
});

test('sales preserve uncertain prices, source validity codes, duplicate rows and original date strings', () => {
  const sales = records.flatMap(record => record.sales);
  assert.equal(sales.filter(row => row.priceStatus === 'zero-recorded').length, 9672);
  assert.equal(sales.filter(row => row.priceStatus === 'missing').length, 2343);
  assert.equal(sales.filter(row => row.priceStatus === 'low-recorded-amount').length, 34);
  assert.ok(sales.filter(row => row.priceStatus === 'low-recorded-amount').every(row => row.priceUSD > 0 && row.priceUSD <= 100));
  assert.ok(sales.some(row => row.flags.includes('source-deleted-or-duplicate')));
  assert.ok(sales.some(row => row.flags.includes('source-not-open-market')));
  assert.ok(sales.some(row => row.validityCode === 'X'));
  assert.ok(sales.every(row => row.priceStatus !== 'verified-comparable'));
  for (const row of sales) {
    if (row.saleDateCenturyInferred) assert.match(row.saleDate, /^\d{1,2}-[A-Z]{3}-\d{2}$/i);
    if (row.saleDateISO) assert.match(row.saleDateISO, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('source dates distinguish the 2021 archive, 2020 tax year and 2026 retrieval', () => {
  assert.equal(manifest.source.archiveSha256, 'bf971584fe06588165053e6b51cd04313ebe98c037b7b8a587e3f8e1a3346e11');
  assert.match(manifest.source.retrievedAt, /^2026-09-12/);
  assert.ok(Object.values(manifest.source.components).every(component => component.archiveEntryTimestamp.startsWith('2021-07-06')));
  assert.match(manifest.limitations.join(' '), /do not establish current bills/);
  assert.match(manifest.limitations.join(' '), /not independently verified comparable/);
  assert.match(manifest.dateRule, /every such interpretation is flagged/);
});
