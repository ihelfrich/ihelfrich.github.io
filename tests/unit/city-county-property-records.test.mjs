import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTY_RECORD_FIELDS, COUNTY_RECORD_URL, COUNTY_HISTORY_ID, COUNTY_TRANSFER_SOURCE_ID, COUNTY_TRANSFER_ARCHIVE_URL, countyLocator, countyRecordQuery, countyTaxLink, normalizeCountyRecord, normalizeCountyBill, createCountyPropertyRecords } from '../../src/lib/county-property-records.mjs';

const id = '16L640291', otherId = '16L640292', retrievedAt = '2026-09-12T12:00:00Z';
const parcel = { parcelId: id, jurisdiction: 'st-louis-county', recordKey: `st-louis-county-current:${id}:123`, sourceObjectId: 123, assessedValueUSD: 17000, assessmentYear: null, taxYear: 2026 };
const source = { url: COUNTY_RECORD_URL, retrievedAt: '2026-09-11T12:00:00Z', sourceDataEditedAt: null };
const attributes = patch => ({ LOCATOR: id, OBJECTID: 123, TAXYR: 2026, PROP_ADD: 'Synthetic property <b>literal</b>', TOTASSMT: 18710, TOTAPVAL: 98500, ASSTLANDVAL: 3000, ASSTIMPVAL: 15710, APPLANDVAL: 20000, APPIMPVAL: 78500, YEARBLT: 1946, RESQFT: 840, LIVUNIT: 1, ACRES: .15, ...patch });
const response = patch => ({ features: [{ attributes: attributes(patch) }] });
const bill = patch => ({ parcelId: id, taxYear: 2025, amountUSD: 2345.67, otherFeesUSD: 15, totalBilledUSD: 2360.67, amountKind: 'annual-property-tax', taxDistrict: 'Synthetic district', sourceUrl: `${countyTaxLink(id)}/2025`, retrievedAt, ...patch });
const paths = { bills: '/st-louis/county-bills/index.json', history: '/st-louis/county-history/tiles/91.json', assessments: '/st-louis/county-assessment-history/index.json', manifest: '/st-louis/county-history/manifest.json', transfers: '/st-louis/county-transfers-2025/tiles/91.json', transferManifest: '/st-louis/county-transfers-2025/manifest.json' };
const archiveManifest = { schema: 'county-history-manifest-v1', source: { id: COUNTY_HISTORY_ID, name: 'Real Estate Data Extract CERT21', catalogUrl: `https://www.arcgis.com/home/item.html?id=${COUNTY_HISTORY_ID}`, retrievedAt, archiveSha256: 'fixture-source-hash', components: { taxes: { file: 'taxdata.csv', archiveEntryTimestamp: '2021-07-06T09:27:38', timestampTimezone: 'unspecified ZIP timestamp' } } }, limitations: ['Historical source, not a current bill.'] };
const transferManifest = { schema: 'county-transfers-manifest-v1', source: { id: COUNTY_TRANSFER_SOURCE_ID, name: 'St. Louis County 2025 billing extract — sales history', url: COUNTY_TRANSFER_ARCHIVE_URL, archiveUrl: COUNTY_TRANSFER_ARCHIVE_URL, catalogUrl: 'https://revenue.stlouisco.com/pdfs/2025/', retrievedAt, member: 'sales.csv', memberSha256: 'a'.repeat(64), archiveEntryTimestamp: '2025-11-17T09:16:38', timestampTimezone: 'unspecified ZIP timestamp' }, counts: { sales: { maxObservedSaleDateISO: '2025-11-14' } }, limitations: ['Extracted source rows, not certified completeness.'] };
const transferTile = { schema: 'county-transfers-v1', sourceId: COUNTY_TRANSFER_SOURCE_ID, records: { [id]: { parcelId: id, sales: [{ sourceRow: 42, saleDate: '14-NOV-25', saleDateISO: '2025-11-14', saleDateCenturyInferred: true, priceUSD: 100001, priceStatus: 'recorded' }] } } };
const jsonResponse = value => ({ ok: true, text: async () => JSON.stringify(value) });
function setup({ live = response(), bills = { schema: 'county-tax-bills-v1', records: { [id]: bill() } }, history = { schema: 'county-history-tile-v1', sourceId: COUNTY_HISTORY_ID, records: {} }, assessments = { schema: 'county-assessment-history-v1', records: {} }, manifest = archiveManifest, transfers = transferTile, transfersManifest = transferManifest, fail = () => false } = {}) {
  const calls = [];
  const load = createCountyPropertyRecords({ now: () => retrievedAt, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (fail(url, calls)) throw Error('Synthetic outage');
    return jsonResponse(url.startsWith(COUNTY_RECORD_URL) ? live : url === paths.bills ? bills : url === paths.history ? history : url === paths.manifest ? manifest : url === paths.transfers ? transfers : url === paths.transferManifest ? transfersManifest : assessments);
  } });
  return { load, calls };
}

test('County locator validation constrains both public query and tax links', () => {
  assert.equal(countyLocator(' 16l640291 '), id);
  for (const invalid of ['', "' OR 1=1--", '<script>', '../16L640291', '16L640291?x=1']) assert.throws(() => countyLocator(invalid));
  const url = new URL(countyRecordQuery(id));
  assert.equal(url.origin, 'https://maps.stlouisco.com');
  assert.equal(url.searchParams.get('where'), `LOCATOR = '${id}'`);
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.ok(!COUNTY_RECORD_FIELDS.some(field => /OWNER|OWN_|CONTACT|MAIL|CAREOF/i.test(field)));
  assert.equal(countyTaxLink(id), `https://taxpayments.stlouiscountymo.gov/parcel/view/${id}`);
});

test('live normalization rejects absent, mismatched, ambiguous and incomplete source identities', () => {
  const options = { parcelId: id, retrievedAt };
  for (const payload of [{ features: [] }, response({ LOCATOR: otherId }), { features: [response().features[0], response().features[0]] }, response({ OBJECTID: 0 }), { error: { message: 'error' } }, { ...response(), exceededTransferLimit: true }]) assert.throws(() => normalizeCountyRecord(payload, options));
  assert.throws(() => normalizeCountyRecord(response(), { parcelId: id, retrievedAt: 'unknown' }));
  const record = normalizeCountyRecord(response(), options);
  assert.equal(record.taxYear, 2026);
  assert.equal(record.assessmentYear, null);
  assert.equal(record.source.sourceDataEditedAt, null);
  assert.equal(record.assessedValueUSD, 18710);
  assert.equal(record.assessorAppraisedValueUSD, 98500);
});

test('unknown values remain null while a reported zero stays zero', () => {
  const record = normalizeCountyRecord(response({ TOTASSMT: null, TOTAPVAL: 0, ASSTLANDVAL: -1, ASSTIMPVAL: '5000', APPLANDVAL: Infinity, APPIMPVAL: NaN, TAXYR: 0, RESQFT: 0, YEARBLT: 0, LIVUNIT: null }), { parcelId: id, retrievedAt });
  assert.equal(record.assessedValueUSD, null);
  assert.equal(record.assessorAppraisedValueUSD, 0);
  for (const key of ['assessedLandUSD', 'assessedImprovementsUSD', 'appraisedLandUSD', 'appraisedImprovementsUSD', 'taxYear', 'livingAreaSqFt', 'yearBuilt', 'dwellingUnits']) assert.equal(record[key], null, key);
});

test('seven sources including both archive provenances are lazy and static files survive live refreshes', async () => {
  const f = setup();
  assert.equal(f.calls.length, 0);
  const first = await f.load(parcel, { source });
  assert.equal(f.calls.length, 7);
  assert.equal(first.liveStatus, 'ready');
  assert.equal(first.bill.recordKey, parcel.recordKey);
  assert.equal(first.bill.jurisdiction, parcel.jurisdiction);
  assert.equal(first.bill.status, 'matched');
  await f.load(parcel, { source });
  assert.equal(f.calls.length, 8);
  for (const path of Object.values(paths)) assert.equal(f.calls.filter(call => call.url === path).length, 1);
});

test('live failure preserves dated local facts and failed static loads can retry', async () => {
  let failBills = true;
  const f = setup({ fail: url => url.startsWith(COUNTY_RECORD_URL) || url === paths.bills && failBills });
  const first = await f.load(parcel, { source });
  assert.equal(first.liveStatus, 'unavailable');
  assert.equal(first.record.recordKey, parcel.recordKey);
  assert.equal(first.record.assessedValueUSD, 17000);
  assert.deepEqual(first.record.source, source);
  assert.equal(first.bill, null);
  assert.equal(first.billStatus, 'unavailable');
  failBills = false;
  const second = await f.load(parcel, { source });
  assert.equal(second.bill.amountUSD, 2345.67);
  assert.equal(f.calls.filter(call => call.url === paths.bills).length, 2);
});

test('mismatched and ambiguous live replies fall back instead of replacing the selected parcel', async () => {
  for (const live of [response({ LOCATOR: otherId }), { features: [response().features[0], response().features[0]] }]) {
    const result = await setup({ live }).load(parcel, { source });
    assert.equal(result.liveStatus, 'unavailable');
    assert.equal(result.record.recordKey, parcel.recordKey);
    assert.equal(result.record.assessedValueUSD, 17000);
  }
});

test('bill records for another parcel never become selected-parcel evidence', async () => {
  const result = await setup({ bills: { schema: 'county-tax-bills-v1', records: { [id]: bill({ parcelId: otherId }) } } }).load(parcel, { source });
  assert.equal(result.bill, null);
  assert.notEqual(result.billStatus, 'found');
});

test('bill evidence rejects unsafe or nonmatching authoritative source paths before display', async () => {
  const badUrls = ['javascript:alert(1)', 'https://example.org/unverified-bill', `https://taxpayments.stlouiscountymo.gov/parcel/view/${otherId}/2025`, `https://taxpayments.stlouiscountymo.gov.evil.example/parcel/view/${id}/2025`, `https://user:password@taxpayments.stlouiscountymo.gov/parcel/view/${id}/2025`, `https://taxpayments.stlouiscountymo.gov/other/${id}/2025`, `https://taxpayments.stlouiscountymo.gov/parcel/view/${id}/2026`];
  for (const sourceUrl of badUrls) {
    const result = await setup({ bills: { schema: 'county-tax-bills-v1', records: { [id]: bill({ sourceUrl }) } } }).load(parcel, { source });
    assert.equal(result.bill, null, sourceUrl);
  }
});

test('annual bill evidence requires finite amounts, a valid year/date and the annual-tax amount kind', async () => {
  for (const patch of [{ amountUSD: null }, { amountUSD: '2345.67' }, { amountUSD: -1 }, { amountUSD: Infinity }, { taxYear: null }, { taxYear: 2025.5 }, { taxYear: 0 }, { retrievedAt: 'unknown' }, { amountKind: 'balance-due' }, { amountKind: 'payments' }, { otherFeesUSD: -10 }, { totalBilledUSD: -1 }]) {
    const result = await setup({ bills: { schema: 'county-tax-bills-v1', records: { [id]: bill(patch) } } }).load(parcel, { source });
    assert.equal(result.bill, null, JSON.stringify(patch));
  }
});

test('wrong static schemas do not masquerade as matched histories or bills', async () => {
  const result = await setup({ bills: { schema: 'unknown', records: { [id]: bill() } }, history: { schema: 'unknown', records: { [id]: { parcelId: id, taxes: [] } } }, assessments: { schema: 'unknown', records: { [id]: { parcelId: id, assessments: [{ year: 2025, appraisedValueUSD: 98500 }] } } } }).load(parcel, { source });
  assert.equal(result.bill, null);
  assert.equal(result.history, null);
  assert.equal(result.assessmentHistory, null);
});

test('wrong-parcel archive records are ignored and a signal abort prevents evidence delivery', async () => {
  const f = setup({ history: { schema: 'county-history-tile-v1', records: { [id]: { parcelId: otherId, taxes: [] } } }, assessments: { schema: 'county-assessment-history-v1', records: { [id]: { parcelId: otherId, assessments: [] } } } });
  const normal = await f.load(parcel, { source });
  assert.equal(normal.history, null);
  assert.equal(normal.assessmentHistory, null);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(f.load(parcel, { source, signal: controller.signal }), error => error.name === 'AbortError');
});

test('oversized live payloads fall back rather than entering the evidence model', async () => {
  const load = createCountyPropertyRecords({ fetchImpl: async url => ({ ok: true, text: async () => url.startsWith(COUNTY_RECORD_URL) ? ' '.repeat(5_000_001) : JSON.stringify({ records: {} }) }) });
  const result = await load(parcel, { source });
  assert.equal(result.liveStatus, 'unavailable');
  assert.match(result.liveReason, /budget/);
  assert.equal(result.record.recordKey, parcel.recordKey);
});

test('abort settles promptly even when a shared static source is still pending', async () => {
  const load = createCountyPropertyRecords({ fetchImpl: (url, { signal } = {}) => new Promise((resolve, reject) => {
    if (url.startsWith(COUNTY_RECORD_URL)) signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) });
  const controller = new AbortController();
  const pending = load(parcel, { source, signal: controller.signal });
  controller.abort();
  const result = await Promise.race([pending.then(() => 'resolved', error => error.name), new Promise(resolve => setTimeout(() => resolve('still waiting for unrelated static source'), 50))]);
  assert.equal(result, 'AbortError');
});

test('archived source dates, component hashes and limitations follow matched records into export data', async () => {
  const history = { schema: 'county-history-tile-v1', sourceId: COUNTY_HISTORY_ID, records: { [id]: { parcelId: id, taxes: [{ sourceRow: 1, taxYear: 2020, taxAmountUSD: 1082.39, otherFeesUSD: 28 }], sales: [], assessments: [{ taxYear: 2021, appraisedTotalUSD: 55700, assessedTotalUSD: 10590 }], appraisals: [] } } };
  const result = await setup({ history }).load(parcel, { source });
  assert.deepEqual(result.history.source, archiveManifest.source);
  assert.deepEqual(result.history.limitations, archiveManifest.limitations);
  assert.equal(result.history.taxes[0].taxYear, 2020);
  assert.equal(result.history.assessments[0].appraisedTotalUSD, 55700);
  const wrong = await setup({ history: { ...history, sourceId: 'another-archive' } }).load(parcel, { source });
  assert.equal(wrong.history, null);
  const invalid = await setup({ history: { ...history, records: { [id]: { parcelId: id, taxes: 'not-an-array' } } } }).load(parcel, { source });
  assert.equal(invalid.history, null);
});

test('bill charge components reconcile and only allowlisted bill fields survive', () => {
  const value = normalizeCountyBill(bill({ penaltyUSD: 5, interestUSD: 10, totalBilledUSD: 2375.67, ownerName: 'Synthetic excluded owner', paymentBalanceUSD: 123 }), parcel);
  assert.equal(value.amountUSD, 2345.67);
  assert.equal(value.penaltyUSD, 5);
  assert.equal(value.interestUSD, 10);
  assert.equal(value.totalBilledUSD, 2375.67);
  assert.ok(!Object.hasOwn(value, 'ownerName'));
  assert.ok(!Object.hasOwn(value, 'paymentBalanceUSD'));
  assert.throws(() => normalizeCountyBill(bill({ penaltyUSD: 5, interestUSD: 10, totalBilledUSD: 2360.67 }), parcel));
  const missing = normalizeCountyBill(bill({ otherFeesUSD: null, totalBilledUSD: null }), parcel);
  assert.equal(missing.otherFeesUSD, null);
  assert.equal(missing.totalBilledUSD, null);
});

test('newer transfers retain exact locator, archive provenance and interpreted-date scope without replacing older export history', async () => {
  const history = { schema: 'county-history-tile-v1', sourceId: COUNTY_HISTORY_ID, records: { [id]: { parcelId: id, sales: [{ sourceRow: 1, priceUSD: 101, saleDate: '01-JAN-20' }] } } };
  const result = await setup({ history }).load(parcel, { source });
  assert.equal(result.transfers.parcelId, id);
  assert.equal(result.transfers.sales[0].priceUSD, 100001);
  assert.equal(result.transfers.sales[0].saleDateCenturyInferred, true);
  assert.deepEqual(result.transfers.source, transferManifest.source);
  assert.equal(result.transfers.archiveTimestamp, '2025-11-17T09:16:38');
  assert.equal(result.transfers.maxObservedSaleDate, '2025-11-14');
  assert.equal(result.transfers.maxObservedDateScope, 'retained study rows');
  assert.equal(result.history.sales[0].priceUSD, 101);
  const failed = await setup({ history, fail: url => url === paths.transfers }).load(parcel, { source });
  assert.equal(failed.transfers, null);
  assert.equal(failed.history.sales[0].priceUSD, 101);
});

test('transfer loader rejects mismatched schemas, source identity, source URLs, dates, hashes and locators', async () => {
  for (const patch of [{ transfers: { ...transferTile, schema: 'unknown' } }, { transfers: { ...transferTile, sourceId: 'wrong' } }, { transfers: { ...transferTile, records: { [id]: { parcelId: otherId, sales: [] } } } }, { transfers: { ...transferTile, records: { [id]: { parcelId: id, sales: 'invalid' } } } }, { transfersManifest: { ...transferManifest, schema: 'unknown' } }, ...[{ id: 'wrong' }, { url: 'https://example.org/archive.zip' }, { archiveUrl: 'https://example.org/archive.zip' }, { retrievedAt: 'unknown' }, { memberSha256: 'not-a-hash' }, { archiveEntryTimestamp: 'unknown' }].map(patch => ({ transfersManifest: { ...transferManifest, source: { ...transferManifest.source, ...patch } } }))]) {
    const result = await setup(patch).load(parcel, { source });
    assert.equal(result.transfers, null, JSON.stringify(patch));
  }
  const empty = await setup({ transfers: { ...transferTile, records: { [id]: { parcelId: id, sales: [] } } } }).load(parcel, { source });
  assert.deepEqual(empty.transfers.sales, []);
});
