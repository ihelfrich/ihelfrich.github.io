#!/usr/bin/env node
// Imports an already reviewed public-browser batch. This does not fetch county pages.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const fields = ['parcelId','amountUSD','otherFeesUSD','totalBilledUSD','penaltyUSD','interestUSD','district'];
const moneyFields = ['amountUSD','otherFeesUSD','totalBilledUSD','penaltyUSD','interestUSD'];
const cents = value => Math.round(value * 100);
const officialUrl = (id, year) => `https://taxpayments.stlouiscountymo.gov/parcel/view/${id}/${year}`;

export function buildCountyTaxBills(batch, {retrievedAt = new Date().toISOString(), knownParcelIds} = {}) {
  if (!Number.isInteger(batch.taxYear) || batch.taxYear < 2000 || batch.taxYear > 2100) throw new Error('A reviewed billing year is required.');
  if (!Array.isArray(batch.fields) || JSON.stringify(batch.fields) !== JSON.stringify(fields)) throw new Error('Unexpected source column order.');
  if (!Array.isArray(batch.rows) || !Array.isArray(batch.unavailable)) throw new Error('Reviewed rows and unavailable records are required.');
  if (typeof batch.sourceUpdatedLabel !== 'string' || !batch.sourceUpdatedLabel.startsWith('Data updated: ')) throw new Error('The visible source-update label is required.');
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('A valid retrieval timestamp is required.');
  const records = {}, unavailable = {}, seen = new Set();
  const validateId = id => {
    if (!/^\d{2}[A-Z]\d{6}$/.test(id ?? '')) throw new Error('Unexpected parcel identifier.');
    if (seen.has(id)) throw new Error(`Duplicate reviewed parcel: ${id}`);
    if (knownParcelIds && !knownParcelIds.has(id)) throw new Error(`Parcel not in the county study index: ${id}`);
    seen.add(id);
  };
  for (const row of batch.rows) {
    if (!Array.isArray(row) || row.length !== fields.length) throw new Error('Incomplete source row.');
    const value = Object.fromEntries(fields.map((field, i) => [field, row[i]]));
    validateId(value.parcelId);
    for (const key of moneyFields) if (!Number.isFinite(value[key]) || value[key] < 0 || Math.abs(value[key] * 100 - cents(value[key])) > 0.000001) throw new Error(`Invalid currency amount: ${value.parcelId}/${key}`);
    if (cents(value.amountUSD) + cents(value.otherFeesUSD) + cents(value.penaltyUSD) + cents(value.interestUSD) !== cents(value.totalBilledUSD)) throw new Error(`Billed components do not reconcile: ${value.parcelId}`);
    if (!/^[A-Z0-9]+$/.test(value.district ?? '')) throw new Error(`Invalid tax district: ${value.parcelId}`);
    records[value.parcelId] = {
      parcelId: value.parcelId, taxYear: batch.taxYear, amountUSD: value.amountUSD, amountKind: 'annual-property-tax',
      otherFeesUSD: value.otherFeesUSD, penaltyUSD: value.penaltyUSD, interestUSD: value.interestUSD, totalBilledUSD: value.totalBilledUSD,
      taxDistrict: value.district, sourceUrl: officialUrl(value.parcelId, batch.taxYear),
      sourceUpdatedLabel: batch.sourceUpdatedLabel, retrievedAt,
    };
  }
  for (const value of batch.unavailable) {
    validateId(value.parcelId);
    if (value.taxYear !== batch.taxYear || typeof value.reason !== 'string' || !value.reason.trim()) throw new Error('An unavailable record must identify its reviewed year and reason.');
    unavailable[value.parcelId] = {parcelId: value.parcelId, taxYear: value.taxYear, reason: value.reason, sourceUrl: officialUrl(value.parcelId, value.taxYear), sourceUpdatedLabel: batch.sourceUpdatedLabel, retrievedAt};
  }
  return {
    schema: 'county-tax-bills-v1',
    source: {
      name: 'St. Louis County, Missouri public property tax portal', url: 'https://taxpayments.stlouiscountymo.gov/',
      method: 'Public browser page review', acquisition: 'Visible Current Year billing table only; each total reconciled against tax, cost, penalty and interest.',
      retrievedAt, sourceUpdatedLabel: batch.sourceUpdatedLabel, sourceUpdatedTimezone: 'Not stated by source', taxYear: batch.taxYear,
      recordCount: Object.keys(records).length, reviewedPropertyCount: seen.size, unavailablePropertyCount: Object.keys(unavailable).length,
      coverageLabel: `${seen.size} explicitly reviewed nearby properties; ${Object.keys(records).length} published ${batch.taxYear} bills. Not Overland-wide or county-wide billing coverage.`,
      amountDefinition: 'Tax Billed from the visible Current Year table. Other fees, penalties, interest and total billed are separate fields.',
    }, records, unavailable,
  };
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node scripts/import-county-tax-bills.mjs <reviewed-browser-batch.json> [output.json]. See scripts/refresh-county-tax-evidence.md for browser acquisition.');
  const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const batch = JSON.parse(await readFile(input, 'utf8'));
  const county = JSON.parse(await readFile(resolve(project, 'public/st-louis/county-current/index.json'), 'utf8'));
  const output = buildCountyTaxBills(batch, {knownParcelIds: new Set(county.records.map(r => r.parcelId))});
  const target = resolve(process.argv[3] ?? resolve(project, 'public/st-louis/county-bills/index.json'));
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({path: target, reviewed: output.source.reviewedPropertyCount, published: output.source.recordCount, unavailable: output.source.unavailablePropertyCount, retrievedAt: output.source.retrievedAt})}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {console.error(error.message);process.exitCode = 1;});
