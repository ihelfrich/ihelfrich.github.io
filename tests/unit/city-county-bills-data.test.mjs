import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCountyTaxBills} from '../../scripts/import-county-tax-bills.mjs';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [snapshot, source, county] = await Promise.all([
  read('../../public/st-louis/county-bills/index.json'),
  read('../fixtures/county-bills-browser-review-2026-09-12.json'),
  read('../../public/st-louis/county-current/index.json'),
]);
const known = new Set(county.records.map(row => row.parcelId));
const options = {retrievedAt: snapshot.source.retrievedAt, knownParcelIds: known};
const clone = () => structuredClone(source);
const cents = n => Math.round(n * 100);

test('published billing snapshot exactly matches the reviewed visible table batch', () => {
  assert.deepEqual(snapshot, buildCountyTaxBills(source, options));
  assert.equal(snapshot.schema, 'county-tax-bills-v1');
  assert.equal(snapshot.source.method, 'Public browser page review');
  assert.equal(snapshot.source.sourceUpdatedLabel, 'Data updated: 2026-09-12 12:15:01');
  assert.equal(snapshot.source.sourceUpdatedTimezone, 'Not stated by source');
  assert.match(snapshot.source.retrievedAt, /^2026-09-12T17:/);
  assert.equal(snapshot.source.taxYear, 2025);
  for (const row of source.rows) {
    const [id, amountUSD, otherFeesUSD, totalBilledUSD, penaltyUSD, interestUSD, district] = row;
    const record = snapshot.records[id];
    assert.equal(record.parcelId, id);
    assert.equal(record.amountKind, 'annual-property-tax');
    assert.deepEqual([record.amountUSD,record.otherFeesUSD,record.totalBilledUSD,record.penaltyUSD,record.interestUSD,record.taxDistrict], [amountUSD,otherFeesUSD,totalBilledUSD,penaltyUSD,interestUSD,district]);
    assert.equal(record.taxYear, 2025);
    assert.equal(record.sourceUrl, `https://taxpayments.stlouiscountymo.gov/parcel/view/${id}/2025`);
    assert.equal(record.sourceUpdatedLabel, source.sourceUpdatedLabel);
    assert.equal(record.retrievedAt, snapshot.source.retrievedAt);
  }
});

test('67 actual bills plus one explicit unavailable year cover exactly 68 indexed properties', () => {
  assert.equal(Object.keys(snapshot.records).length, 67);
  assert.equal(Object.keys(snapshot.unavailable).length, 1);
  assert.equal(snapshot.source.recordCount, 67);
  assert.equal(snapshot.source.reviewedPropertyCount, 68);
  assert.equal(snapshot.source.unavailablePropertyCount, 1);
  assert.match(snapshot.source.coverageLabel, /Not Overland-wide or county-wide/);
  assert.deepEqual(Object.keys(snapshot.unavailable), ['16K610558']);
  assert.equal(snapshot.records['16K610558'], undefined);
  assert.match(snapshot.unavailable['16K610558'].reason, /no available billing history.*not a zero bill/i);
  for (const id of [...Object.keys(snapshot.records), ...Object.keys(snapshot.unavailable)]) assert.ok(known.has(id), `Study index contains exact parcel ${id}`);
});

test('tax, fees, penalties and interest reconcile separately without turning the total into annual tax', () => {
  for (const record of Object.values(snapshot.records)) {
    assert.equal(cents(record.amountUSD) + cents(record.otherFeesUSD) + cents(record.penaltyUSD) + cents(record.interestUSD), cents(record.totalBilledUSD), record.parcelId);
  }
  const feeOnly = snapshot.records['16L640291'];
  assert.equal(feeOnly.amountUSD, 1417.64);assert.equal(feeOnly.otherFeesUSD, 28);assert.equal(feeOnly.totalBilledUSD, 1445.64);
  const amended = snapshot.records['16L640323'];
  assert.equal(amended.amountUSD, 2113.19);assert.equal(amended.penaltyUSD, 49.87);assert.equal(amended.interestUSD, 380.37);assert.equal(amended.totalBilledUSD, 2571.43);
  // The observed charge differs from multiplying the composite rate once; retain the source amount.
  assert.equal(snapshot.records['16L640312'].amountUSD, 2061.66);
  assert.notEqual(snapshot.records['16L640312'].amountUSD, Math.round(27210 / 100 * 7.5769 * 100) / 100);
});

test('public bill records use a strict field allowlist without owner, contact, payment or balance data', () => {
  assert.deepEqual(Object.keys(snapshot).sort(), ['records','schema','source','unavailable']);
  const recordKeys = ['amountKind','amountUSD','interestUSD','otherFeesUSD','parcelId','penaltyUSD','retrievedAt','sourceUpdatedLabel','sourceUrl','taxDistrict','taxYear','totalBilledUSD'];
  for (const record of Object.values(snapshot.records)) assert.deepEqual(Object.keys(record).sort(), recordKeys);
  for (const record of Object.values(snapshot.unavailable)) assert.deepEqual(Object.keys(record).sort(), ['parcelId','reason','retrievedAt','sourceUpdatedLabel','sourceUrl','taxYear']);
  const checkKeys = object => {
    if (!object || typeof object !== 'object') return;
    for (const [key,value] of Object.entries(object)) {
      assert.doesNotMatch(key, /owner|contact|address|phone|email|payment|paid|balance|delinquen/i);
      checkKeys(value);
    }
  };
  checkKeys(snapshot);
});

test('import rejects incomplete, duplicate, mismatched, unknown or unreconciled source rows', () => {
  const duplicate = clone();duplicate.rows.push(duplicate.rows[0]);assert.throws(() => buildCountyTaxBills(duplicate, options), /Duplicate/);
  const missing = clone();missing.rows[0].pop();assert.throws(() => buildCountyTaxBills(missing, options), /Incomplete/);
  const wrongColumns = clone();[wrongColumns.fields[1],wrongColumns.fields[2]] = [wrongColumns.fields[2],wrongColumns.fields[1]];assert.throws(() => buildCountyTaxBills(wrongColumns, options), /column order/);
  const wrongTotal = clone();wrongTotal.rows[0][3] += 0.01;assert.throws(() => buildCountyTaxBills(wrongTotal, options), /reconcile/);
  const invalidMoney = clone();invalidMoney.rows[0][1] = null;assert.throws(() => buildCountyTaxBills(invalidMoney, options), /Invalid currency/);
  const unknown = clone();unknown.rows[0][0] = '00A000000';assert.throws(() => buildCountyTaxBills(unknown, options), /not in the county/);
  const inconsistentYear = clone();inconsistentYear.unavailable[0].taxYear = 2026;assert.throws(() => buildCountyTaxBills(inconsistentYear, options), /reviewed year/);
});
