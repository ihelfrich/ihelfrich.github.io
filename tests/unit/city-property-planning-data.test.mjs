import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../../public/st-louis/planning/',import.meta.url);
const index=JSON.parse(await readFile(new URL('index.json',base),'utf8'));
const raw=await readFile(new URL('county-zoning-petitions.geojson',base));const gis=JSON.parse(raw);
test('planning registry contains bounded actual cases, source URLs, and explicitly unmapped affected areas',()=>{
 assert.equal(index.schema,'property-planning-v1');assert.equal(index.records.length,14);assert.equal(index.coverage.recordCount,14);assert.deepEqual(index.coverage.jurisdictions,{'st-louis-county':8,'st-louis-city':6});assert.equal(index.coverage.completeProjectInventory,false);assert.equal(index.coverage.completePermitInventory,false);
 const seen=new Set();for(const r of index.records){
  assert.ok(!seen.has(r.id));seen.add(r.id);assert.equal(r.geography.kind,'source-described-area');assert.equal(r.geography.geometry,null);assert.deepEqual(r.geography.parcelIds,[]);assert.ok(r.summary&&r.geography.label&&r.statusLabel);
  assert.ok(r.sources.every(id=>index.sources[id]));assert.equal(r.officialUrl,index.sources[r.sources[0]].url);
  assert.match(new URL(r.officialUrl).hostname,/^(?:stlouisco\.civicweb\.net|www\.stlouis-mo\.gov)$/);
  assert.ok(r.evidence.requiredText.length>=3);assert.equal(r.evidence.sourceId,r.sources[0]);
  for(const key of ['statusAsOfDate','announcedDate','hearingDate'])assert.ok(r[key]===null||/^\d{4}-\d\d-\d\d$/.test(r[key]));
  assert.ok(!Object.keys(r).some(k=>/applicant|owner|contact|phone|email/i.test(k)));
 }
 for(const s of Object.values(index.sources)){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isFinite(Date.parse(s.retrievedAt)));}
 const page=index.records.find(r=>r.id==='county-pc-17-26');assert.deepEqual(page.geography.addresses,['10500 Page Avenue','1605 Ashby Road']);assert.equal(page.hearingDate,'2026-08-03');assert.equal(page.status,'hearing-postponed');
 const bill=index.records.find(r=>r.id==='city-data-center-bb49-2026');assert.equal(bill.status,'delivered-to-mayor');assert.match(bill.summary,/does not establish signature or an effective ordinance date/);
 const ourPlan=index.records.find(r=>r.id==='city-ourplan-adoption-2026');assert.equal(ourPlan.status,'adoption-reported');assert.equal(ourPlan.geography.neighborhoods.length,6);
 const fairground=index.records.find(r=>r.id==='city-fairground-plan-2026');assert.equal(fairground.status,'agenda-listed');assert.match(fairground.summary,/does not show adoption/);
 assert.ok(!JSON.stringify(index.records.map(r=>r.geography)).includes('41 S. Central'));
 assert.ok(!JSON.stringify(index.records.map(r=>r.geography)).includes('3140 Cass'));
});
test('historical zoning points preserve official source identity and unknown decisions without date manufacture',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),index.mapIndex.sha256);assert.equal(raw.length,index.mapIndex.bytes);assert.equal(gis.type,'FeatureCollection');assert.equal(gis.features.length,3945);assert.equal(gis.source.id,'st-louis-county-zoning-petitions');
 const seen=new Set();let mapped=0,invalid=0;
 for(const f of gis.features){const p=f.properties;assert.equal(f.type,'Feature');assert.equal(f.id,p.id);assert.equal(p.id,`county-zoning-petition:${p.sourceObjectId}`);assert.ok(!seen.has(p.sourceObjectId));seen.add(p.sourceObjectId);assert.equal(p.sourceId,gis.source.id);assert.equal(p.status,'decision-unknown');assert.equal(p.sourceEditedAt,null);assert.equal(p.jurisdiction,'st-louis-county');
  assert.equal(new URL(p.officialUrl).searchParams.get('where'),`OBJECTID=${p.sourceObjectId}`);
  if(f.geometry){assert.equal(f.geometry.type,'Point');assert.equal(f.geometry.coordinates.length,2);assert.ok(f.geometry.coordinates.every(Number.isFinite));assert.equal(p.geometryStatus,'source-point');mapped++;}else{assert.equal(p.geometryStatus,'invalid-source-coordinate');invalid++;}
  assert.ok(!('hearingDate' in p));assert.ok(!('approvalDate' in p));assert.ok(!('parcelId' in p));
 }
 assert.equal(mapped,3943);assert.equal(invalid,2);assert.equal(gis.coverage.mappedPointCount,mapped);assert.equal(gis.coverage.invalidGeometryCount,invalid);assert.equal(gis.coverage.missingEditDateCount,3945);assert.equal(gis.coverage.latestSourceEditDate,null);
 assert.match(gis.source.dateMeaning,/not a filing, hearing, decision or permit date/);
});
