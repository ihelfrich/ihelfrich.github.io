import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base = new URL('../../public/st-louis/county-transfers-2025/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
const currentBytes = await readFile(new URL('../../public/st-louis/county-current/index.json', import.meta.url));
const current = JSON.parse(currentBytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tiles = await Promise.all(manifest.tiles.map(async meta => {
  const bytes = await readFile(new URL(`tiles/${meta.id}.json`, base));
  return {meta, bytes, data: JSON.parse(bytes)};
}));
const records = Object.assign({}, ...tiles.map(tile => tile.data.records));
const sales = Object.values(records).flatMap(record => record.sales);

test('2025 transfers preserve the verified exact-member provenance without claiming a whole-archive hash', () => {
  assert.equal(manifest.schema, 'county-transfers-manifest-v1');
  assert.equal(manifest.source.id, 'stlco-real-billing-2025-sales');
  assert.equal(manifest.source.url, 'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip');
  assert.equal(manifest.source.archiveUrl, manifest.source.url);
  assert.equal(manifest.source.member, 'STLCOMO_ASMTROLL_BILLING_2025/sales.txt');
  assert.equal(manifest.source.memberBytes, 109392062);
  assert.equal(manifest.source.memberCompressedBytes, 29047437);
  assert.equal(manifest.source.memberSha256, '1375668e9ff8a3b3a28a1364c29de9188def3ca2adc3d382164b22a15240ab15');
  assert.equal(manifest.source.memberCrc32, '5ec5e88e');
  assert.equal(manifest.source.archiveEntryTimestamp, '2025-11-17T09:16:38');
  assert.equal(manifest.source.archiveSha256, null);
  assert.match(manifest.source.extractionMethod, /HTTP 206 byte ranges/);
  assert.equal(manifest.currentStudyIndexSha256, hash(currentBytes));
});

test('100 verified suffix tiles contain exactly all 11151 study locators, including OL identifiers', () => {
  assert.deepEqual(manifest.tiles.map(t => t.id), Array.from({length: 100}, (_, i) => String(i).padStart(2, '0')));
  assert.equal(manifest.studyLocatorCount, 11151);
  assert.deepEqual(Object.keys(records).sort(), current.records.map(r => r.parcelId).sort());
  const seen = new Set();
  for (const {meta, bytes, data} of tiles) {
    assert.equal(meta.bytes, bytes.length);assert.equal(meta.sha256, hash(bytes));
    assert.equal(data.schema, 'county-transfers-v1');assert.equal(data.sourceId, manifest.source.id);
    assert.equal(meta.locatorCount, Object.keys(data.records).length);
    for (const [id, record] of Object.entries(data.records)) {
      assert.equal(id.slice(-2), meta.id);assert.equal(record.parcelId, id);
      assert.equal(seen.has(id), false);seen.add(id);
    }
  }
  assert.ok(records.OL0505007);
});

test('study coverage, source maximum dates and raw two-digit dates remain distinct', () => {
  const stats = manifest.counts.sales;
  assert.equal(stats.sourceRowsScanned, 1528094);assert.equal(sales.length, 41627);
  assert.equal(stats.retainedRows, sales.length);
  assert.equal(Object.values(records).filter(r => r.sales.length).length, 10128);
  assert.equal(Object.values(records).filter(r => !r.sales.length).length, 1023);
  assert.equal(stats.maxObservedSaleDateISO, '2025-09-26');
  assert.deepEqual(stats.maxObservedSaleDateRaw, ['26-SEP-25']);
  assert.match(stats.maxObservedSaleDateScope, /current study/);
  assert.equal(stats.wholeArchiveMaxObservedSaleDateISO, '2025-10-29');
  assert.equal(stats.twoDigitCenturyInterpretations, 41627);
  assert.equal(stats.unparsedNonemptySaleDates, 0);
  assert.equal(sales.filter(s => s.saleDateCenturyInferred).length, 41627);
  assert.equal(sales.map(s => s.saleDateISO).sort().at(-1), '2025-09-26');
});

test('new source revisions and post-2021 transactions are retained without rewriting archived history', async () => {
  const revised = records['16L640291'].sales.find(r => r.saleDate === '12-MAY-21');
  assert.equal(revised.priceUSD, 0);assert.equal(revised.priceStatus, 'zero-recorded');
  assert.equal(revised.validityCode, '4');assert.deepEqual(revised.flags, ['source-related-parties']);
  assert.equal(revised.book, '24858');assert.equal(revised.page, '958');
  const newer = records['16L640323'].sales.find(r => r.saleDate === '02-MAY-23');
  assert.equal(newer.saleDateISO, '2023-05-02');assert.equal(newer.priceUSD, 14500);
  assert.equal(newer.validityCode, '2');assert.deepEqual(newer.flags, ['source-not-open-market']);
  const archived = JSON.parse(await readFile(new URL('../../public/st-louis/county-history/tiles/91.json', import.meta.url), 'utf8'));
  assert.equal(archived.records['16L640291'].sales.find(r => r.saleDate === '12-MAY-21').validityCode, 'V');
  assert.equal(archived.records['16L640291'].taxes[0].taxAmountUSD, 1082.39);
});

test('all published transfer rows have only the existing allowlisted history shape', () => {
  const allowed = ['book','flags','instrumentNumber','instrumentTypeCode','marketValidityCode','page','priceStatus','priceUSD','saleDate','saleDateCenturyInferred','saleDateISO','saleTypeCode','sourceCode','sourceRow','transactionDate','transactionDateCenturyInferred','transactionDateISO','transferNumber','validityCode'].sort();
  for (const record of Object.values(records)) {
    assert.deepEqual(Object.keys(record).sort(), ['parcelId','sales']);
    for (const row of record.sales) {
      assert.deepEqual(Object.keys(row).sort(), allowed);
      assert.ok(Number.isInteger(row.sourceRow) && row.sourceRow >= 2);
      assert.ok(row.priceUSD === null || Number.isFinite(row.priceUSD));
      for (const key of Object.keys(row)) assert.doesNotMatch(key, /notes|owner|address|contact|phone|email|payment|balance/i);
    }
  }
});
