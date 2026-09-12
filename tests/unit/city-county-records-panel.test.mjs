import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createCountyRecordsPanel } from '../../src/scripts/city/city-county-records-panel.mjs';
import { createCountyPropertyRecords, COUNTY_RECORD_URL } from '../../src/lib/county-property-records.mjs';

const id = '16L640291', retrievedAt = '2026-09-12T12:00:00Z';
const source = { url: COUNTY_RECORD_URL, retrievedAt: '2026-09-11T12:00:00Z', sourceDataEditedAt: null };
const parcel = { parcelId: id, jurisdiction: 'st-louis-county', recordKey: `st-louis-county-current:${id}:123`, sourceObjectId: 123, assessedValueUSD: 18710, assessorAppraisedValueUSD: 98500, taxYear: 2026, assessmentYear: null, dwellingUnits: 1, livingAreaSqFt: 840, yearBuilt: 1946 };
const bill = patch => ({ parcelId: id, recordKey: parcel.recordKey, jurisdiction: parcel.jurisdiction, status: 'matched', taxYear: 2025, amountUSD: 2345.67, otherFeesUSD: 15, totalBilledUSD: 2360.67, amountKind: 'annual-property-tax', sourceUrl: `https://taxpayments.stlouiscountymo.gov/parcel/view/${id}/2025`, retrievedAt, ...patch });
const evidence = patch => ({ parcelId: id, record: { ...parcel, source: { ...source, retrievedAt } }, liveStatus: 'ready', bill: bill(), billStatus: 'found', billCoverage: 1, history: null, assessmentHistory: null, ...patch });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture(t, options = {}) {
  const window = new Window(), root = window.document.createElement('section');
  window.document.body.append(root);
  const taxes = [], scenarios = [];
  const panel = createCountyRecordsPanel(root, { parcel, source, load: async () => evidence(), onTaxEvidence: value => taxes.push(value), onScenario: value => scenarios.push(value), ...options });
  t.after(async () => { panel.dispose(); await window.happyDOM.abort(); });
  return { window, root, panel, taxes, scenarios, q: name => root.querySelector(`[data-cr-${name}]`) };
}

test('novice view separates appraised value, assessed base, annual charge and additional fees', async t => {
  const f = fixture(t); await settle();
  assert.match(f.q('values').textContent, /County appraised value[\s\S]*\$98,500\.00/);
  assert.match(f.q('values').textContent, /Assessed value[\s\S]*\$18,710\.00/);
  assert.match(f.q('bill').textContent, /2025 ANNUAL PROPERTY TAX[\s\S]*\$2,345\.67/);
  assert.match(f.q('bill').textContent, /\$15\.00 separate costs\/fees[\s\S]*\$2,360\.67 total billed/);
  assert.match(f.q('status').textContent, /2026/);
  assert.match(f.q('bill').textContent, /not a live payment-status check/i);
  assert.match(f.root.textContent, /not a sale price[\s\S]*not a bill/);
  assert.match(f.root.textContent, /Fees, payments and unpaid balances are different amounts/);
  assert.match(f.root.textContent, /County values do not fill those assumptions automatically/);
  assert.equal(f.scenarios.length, 0);
  f.q('scenario').click();
  assert.equal(f.scenarios.length, 1);
});

test('bill callback carries the explicitly selected current record identity', async t => {
  const f = fixture(t); await settle();
  assert.equal(f.taxes.length, 1);
  assert.equal(f.taxes[0].recordKey, parcel.recordKey);
  assert.equal(f.taxes[0].parcelId, parcel.parcelId);
  assert.equal(f.taxes[0].jurisdiction, parcel.jurisdiction);
  assert.equal(f.taxes[0].amountKind, 'annual-property-tax');
  assert.equal(f.taxes[0].amountUSD, 2345.67);
  assert.equal(f.taxes[0].taxYear, 2025);
});

test('missing evidence displays unknown amounts without fabricating a zero bill', async t => {
  const f = fixture(t, { load: async () => evidence({ record: { ...parcel, assessedValueUSD: null, assessorAppraisedValueUSD: null, dwellingUnits: null, livingAreaSqFt: null, yearBuilt: null, source }, bill: null, billCoverage: 0, billStatus: 'not-imported' }) });
  await settle();
  assert.match(f.q('summary').textContent, /Dwelling count not reported[\s\S]*Living area not reported[\s\S]*build year not reported/);
  assert.equal(f.q('values').textContent.match(/Not reported/g)?.length, 2);
  assert.doesNotMatch(f.q('values').textContent + f.q('bill').textContent, /\$0(?:\.00)?\b/);
  assert.match(f.q('bill').textContent, /has not been imported/);
  assert.match(f.q('bill').textContent, /assessed value cannot substitute for a bill/);
  assert.equal(f.taxes.at(-1), null);
});

test('a failed live refresh keeps dated saved facts available with an honest retry status', async t => {
  const f = fixture(t, { load: async () => evidence({ record: { ...parcel, source }, liveStatus: 'unavailable', bill: null }) });
  await settle();
  assert.match(f.q('status').textContent, /saved parcel record from 2026-09-11[\s\S]*Live refresh unavailable/i);
  assert.match(f.q('values').textContent, /\$98,500\.00/);
  assert.equal(f.q('refresh').disabled, false);
});

test('an old request cannot overwrite a newer response or emit stale tax evidence', async t => {
  const pending = [];
  const f = fixture(t, { load: (p, options) => new Promise((resolve, reject) => pending.push({ resolve, reject, options })) });
  f.q('refresh').dispatchEvent(new f.window.Event('click'));
  assert.equal(pending.length, 2);
  pending[1].resolve(evidence({ record: { ...parcel, assessorAppraisedValueUSD: 123456, source: { ...source, retrievedAt } } }));
  await settle();
  pending[0].reject(Error('Old request failed'));
  await settle();
  assert.match(f.q('values').textContent, /\$123,456\.00/);
  assert.doesNotMatch(f.q('status').textContent, /unavailable/i);
  assert.equal(f.taxes.length, 1);
  assert.equal(f.q('refresh').disabled, false);
});

test('disposal aborts the active request and prevents late rendering or callbacks', async t => {
  let resolve, signal;
  const f = fixture(t, { load: (p, options) => { signal = options.signal; return new Promise(r => { resolve = r; }); } });
  const before = f.root.innerHTML;
  f.panel.dispose();
  assert.equal(signal.aborted, true);
  resolve(evidence()); await settle();
  assert.equal(f.root.innerHTML, before);
  assert.equal(f.taxes.length, 0);
});

test('disposed controls cannot invoke actions or start a new request', async t => {
  let calls = 0;
  const f = fixture(t, { load: async () => { calls++; return evidence(); } });
  await settle(); f.panel.dispose();
  f.q('scenario').click(); f.q('refresh').click(); await settle();
  assert.equal(f.scenarios.length, 0);
  assert.equal(calls, 1);
});

test('source-derived strings render literally and JSON export retains exact IDs and sources', async t => {
  const injected = '<img src=x onerror=alert(1)>';
  const data = evidence({ record: { ...parcel, subdivision: injected, deedBookPage: '1" <b>2</b>', source: { ...source, retrievedAt } }, history: { parcelId: id, taxes: [], sales: [{ saleDate: injected, priceUSD: null, validityCode: injected, book: '<svg>', page: '12' }] } });
  const f = fixture(t, { load: async () => data }); await settle();
  assert.equal(f.root.querySelector('img, svg, script'), null);
  assert.match(f.q('details').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(f.q('history').textContent, /<img src=x onerror=alert\(1\)>/);
  const blobs = [], downloads = [];
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:synthetic-evidence'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(f.window.HTMLAnchorElement.prototype, 'click', function () { downloads.push(this.download); });
  const nativeTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => nativeTimeout(fn, ms === 60000 ? 0 : ms, ...args));
  f.q('export').click();
  assert.equal(blobs.length, 1);
  assert.equal(downloads[0], `${id}-property-evidence.json`);
  const exported = JSON.parse(await blobs[0].text());
  assert.equal(exported.schema, 'county-property-evidence-v1');
  assert.equal(exported.parcelId, id);
  assert.equal(exported.selectedRecordKey, parcel.recordKey);
  assert.equal(exported.bill.recordKey, parcel.recordKey);
  assert.equal(exported.bill.sourceUrl, bill().sourceUrl);
  assert.equal(exported.record.subdivision, injected);
  assert.equal(exported.record.assessmentYear, null);
  assert.equal(exported.record.source.sourceDataEditedAt, null);
});

test('a rejected bill URL cannot render an executable link or emit tax evidence', async t => {
  const load = createCountyPropertyRecords({ fetchImpl: async url => ({ ok: true, text: async () => JSON.stringify(url.startsWith(COUNTY_RECORD_URL) ? { features: [{ attributes: { LOCATOR: id, OBJECTID: 123, TAXYR: 2026 } }] } : url.includes('county-bills') ? { schema: 'county-tax-bills-v1', records: { [id]: bill({ sourceUrl: 'javascript:alert(1)' }) } } : { schema: 'county-history-tile-v1', records: {} }) }) });
  const f = fixture(t, { load }); await settle();
  assert.equal(Boolean(f.root.querySelector('a[href^="javascript:"]')), false, 'Rejected source URLs must not reach rendered anchors');
  assert.doesNotMatch(f.q('bill').textContent, /\$2,345\.67/);
  assert.equal(f.taxes.at(-1), null);
});

test('nonzero penalties and interest stay separate from annual tax and reconcile to total billed', async t => {
  const f = fixture(t, { load: async () => evidence({ bill: bill({ penaltyUSD: 5, interestUSD: 10, totalBilledUSD: 2375.67 }) }) });
  await settle();
  assert.match(f.q('bill').textContent, /\$2,345\.67/);
  assert.match(f.q('bill').textContent, /\$15\.00 separate costs\/fees/);
  assert.match(f.q('bill').textContent, /\$5\.00 penalties/);
  assert.match(f.q('bill').textContent, /\$10\.00 interest/);
  assert.match(f.q('bill').textContent, /\$2,375\.67 total billed/);
  assert.equal(f.taxes.at(-1).amountUSD, 2345.67);
});

test('historical valuation and tax records show a dated official citation inside optional sections', async t => {
  const archiveSource = { id: '3ad7bec2310d4a4ab36f7668d4bca6e5', name: 'Real Estate Data Extract CERT21', catalogUrl: 'https://www.arcgis.com/home/item.html?id=3ad7bec2310d4a4ab36f7668d4bca6e5', retrievedAt, archiveSha256: 'fixture-sha' };
  const f = fixture(t, { load: async () => evidence({ history: { parcelId: id, source: archiveSource, taxes: [{ taxYear: 2020, assessmentClass: 'R', taxAmountUSD: 1082.39, otherFeesUSD: 28 }], sales: [], assessments: [{ taxYear: 2021, assessmentClass: 'R', appraisedTotalUSD: 55700, assessedTotalUSD: 10590 }], appraisals: [{ taxYear: 2021, rollType: 'REAL', appraisedTotalUSD: 55700, sourceMarketValueUSD: 55700 }] } }) });
  await settle();
  assert.match(f.q('history').textContent, /Historical tax records/);
  assert.match(f.q('history').textContent, /Archived valuation records/);
  assert.match(f.q('history').textContent, /Real Estate Data Extract CERT21[\s\S]*2026-09-12/);
  assert.ok([...f.q('history').querySelectorAll('details')].every(detail => !detail.open));
  assert.equal(f.q('history').querySelector('a').href, archiveSource.catalogUrl);
  assert.match(f.q('history').textContent, /not added together into an annual bill/);
});

test('new transfer archive is preferred, dated explicitly, and sorted by interpreted date without claiming completeness', async t => {
  const newer = { parcelId: id, archiveTimestamp: '2025-11-17T09:16:38', maxObservedSaleDate: '2025-11-14', source: { name: 'County 2025 billing extract', catalogUrl: 'https://revenue.stlouisco.com/pdfs/2025/', retrievedAt, timestampTimezone: 'unspecified ZIP timestamp' }, sales: [{ sourceRow: 1, saleDate: '01-JAN-20', saleDateISO: '2020-01-01', priceUSD: 100001, priceStatus: 'recorded' }, { sourceRow: 2, saleDate: '14-NOV-25', saleDateISO: '2025-11-14', priceUSD: 200002, priceStatus: 'recorded' }] };
  const f = fixture(t, { load: async () => evidence({ transfers: newer, history: { parcelId: id, sales: [{ priceUSD: 101, saleDate: '01-JAN-19' }], taxes: [] } }) });
  await settle();
  const text = f.q('history').textContent;
  assert.match(text, /November 2025 archive/);
  assert.match(text, /2025-11-17T09:16:38 \(unspecified ZIP timestamp\)/);
  assert.match(text, /Latest interpreted sale date among retained study rows: 2025-11-14/);
  assert.match(text, /does not establish complete coverage through that date/);
  assert.ok(text.indexOf('$200,002.00') < text.indexOf('$100,001.00'));
  assert.doesNotMatch(text, /\$101\.00/);
  assert.equal(f.q('history').querySelector('a').href, newer.source.catalogUrl);
});

test('unavailable newer transfers retain the old display while a valid empty extract remains an explicit empty result', async t => {
  const older = { parcelId: id, sales: [{ priceUSD: 101, saleDate: '01-JAN-19' }], taxes: [] };
  const old = fixture(t, { load: async () => evidence({ transfers: null, history: older }) });
  await settle();
  assert.match(old.q('history').textContent, /Historical transfer records/);
  assert.match(old.q('history').textContent, /\$101\.00/);
  const empty = fixture(t, { load: async () => evidence({ history: older, transfers: { parcelId: id, sales: [], archiveTimestamp: '2025-11-17T09:16:38', source: { retrievedAt } } }) });
  await settle();
  assert.match(empty.q('history').textContent, /No matching transfer rows in this extract/);
  assert.doesNotMatch(empty.q('history').textContent, /\$101\.00/);
});
