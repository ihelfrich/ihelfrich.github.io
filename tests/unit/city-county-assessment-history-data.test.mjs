import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const snapshot = JSON.parse(await readFile(new URL('../../public/st-louis/county-assessment-history/index.json', import.meta.url), 'utf8'));
// Independently transcribed published totals, newest year first (2026 through 2016).
const published = {
  '16L640291': [[98500,18710],[98500,18710],[55700,10590],[55700,10590],[55700,10590],[55700,10590],[55800,10610],[55800,10610],[55800,10600],[55800,10600],[46800,8890]],
  '16L640312': [[143200,27210],[143200,27210],[118600,22540],[118600,22540],[97100,18450],[97100,18450],[83800,15930],[83800,15930],[51300,9750],[51300,9750],[45100,8570]],
  '16L640323': [[146800,27890],[146800,27890],[121300,23050],[121300,23050],[99200,18850],[99200,18850],[85900,16320],[85900,16320],[53100,10090],[53100,10090],[42100,8000]],
  '16L630115': [[121000,22990],[121000,22990],[93200,17710],[93200,17710],[74700,14200],[74700,14200],[71500,13590],[71500,13590],[49800,9460],[49800,9460],[40900,7770]],
};

test('assessment starter contains exactly the four reviewed properties and 44 source-year totals', () => {
  assert.equal(snapshot.schema, 'county-assessment-history-v1');
  assert.deepEqual(Object.keys(snapshot.records).sort(), Object.keys(published).sort());
  assert.equal(snapshot.source.recordCount, 4);
  assert.equal(snapshot.source.assessmentCount, 44);
  assert.match(snapshot.source.coverageLabel, /Four nearby properties/);
  for (const [parcelId, totals] of Object.entries(published)) {
    const record = snapshot.records[parcelId];
    assert.equal(record.parcelId, parcelId);
    assert.deepEqual(record.assessments, totals.map(([appraisedValueUSD, assessedValueUSD], i) => ({year: 2026 - i, appraisedValueUSD, assessedValueUSD})));
    assert.equal(record.sourceUrl, `https://revenue.stlouisco.com/RealEstate/AsmtInfo.aspx?Locator=${parcelId}`);
    assert.equal(record.retrievedAt, '2026-09-12');
    assert.equal(record.sourceUpdatedLabel, 'Friday, September 11, 2026.');
  }
});

test('assessment publication is an allowlist with no owner, contact, payment or balance fields', () => {
  assert.deepEqual(Object.keys(snapshot).sort(), ['records', 'schema', 'source']);
  assert.deepEqual(Object.keys(snapshot.source).sort(), ['assessmentCount','coverageLabel','method','name','recordCount','retrievedAt','sourceUpdatedLabel','url']);
  for (const record of Object.values(snapshot.records)) {
    assert.deepEqual(Object.keys(record).sort(), ['assessments','parcelId','retrievedAt','sourceUpdatedLabel','sourceUrl']);
    for (const value of record.assessments) assert.deepEqual(Object.keys(value).sort(), ['appraisedValueUSD','assessedValueUSD','year']);
  }
  assert.doesNotMatch(JSON.stringify(snapshot), /owner|mailing|phone|email|payment|balance|delinquent/i);
});

test('source-rounded assessed amounts are retained rather than recalculated at exactly 19 percent', () => {
  const rows = snapshot.records['16L640291'].assessments;
  assert.equal(rows[0].assessedValueUSD, 18710);
  assert.notEqual(rows[0].assessedValueUSD, rows[0].appraisedValueUSD * 0.19);
  // Appraised totals remain the same while the historical component rounding differs.
  assert.equal(rows.find(r => r.year === 2020).appraisedValueUSD, rows.find(r => r.year === 2018).appraisedValueUSD);
  assert.equal(rows.find(r => r.year === 2020).assessedValueUSD, 10610);
  assert.equal(rows.find(r => r.year === 2018).assessedValueUSD, 10600);
});
