import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {normalizePermitSnapshot,filterPropertyPermits,createPropertyPermitData,propertyPermitsCsv} from '../../src/lib/property-permits.mjs';
const root=path.resolve(import.meta.dirname,'../..');const read=url=>fs.readFileSync(path.join(root,'public',url),'utf8');const manifest=JSON.parse(read('/st-louis/permits/manifest.json'));const dataset=manifest.datasets[0],raw=read(dataset.url),snapshot=JSON.parse(raw),records=snapshot.records;
const fixture=()=>({...snapshot,records:[structuredClone(records[0])],recordCount:1});
const response=x=>({ok:true,text:async()=>JSON.stringify(x)});
test('published permit identities and bytes reconcile after explicit duplicate collapse',()=>{
 assert.equal(manifest.schema,'property-permits-manifest-v1');assert.equal(records.length,4581);assert.equal(dataset.bytes,Buffer.byteLength(raw));assert.equal(dataset.sha256,createHash('sha256').update(raw).digest('hex'));assert.equal(new Set(records.map(r=>r.id)).size,4581);assert.equal(records.reduce((n,r)=>n+r.sourceRowMultiplicity,0),7986);assert.equal(manifest.duplicateSourceRowsCollapsed,3405);assert.equal(snapshot.source.sourceObjectIdUnique,false);assert.equal(new Set(records.map(r=>r.sourceObjectId)).size,2);assert.equal(normalizePermitSnapshot(snapshot,dataset).records.length,4581);
});
test('permit scope is the observed 2025 issue cohort and County absence remains unknown',()=>{
 assert.equal(snapshot.coverage.scope,'2025-issued permit cohort');assert.equal(snapshot.coverage.completeForJurisdiction,false);assert.equal(manifest.coverage['st-louis-county'].status,'not-connected');assert.ok(records.every(r=>r.issuedDate>='2025-01-01'&&r.issuedDate<='2025-12-31'));assert.equal(snapshot.coverage.observedDates.applicationDate.min,'2019-02-19');assert.equal(snapshot.coverage.observedDates.cancelledDate.max,'2026-08-06');assert.ok(records.every(r=>r.parcelJoinStatus==='not-established'));
});
test('invalid source workflow dates remain raw and cannot establish a completed status',()=>{
 const bad=records.filter(r=>r.dateQuality.length);assert.equal(bad.length,18);const future=bad.filter(r=>r.rawDates.CompleteDate&&new Date(r.rawDates.CompleteDate).toISOString().slice(0,10)>snapshot.retrievedAt.slice(0,10));assert.ok(future.length>=2);for(const row of future){assert.equal(row.completedDate,null);assert.notEqual(row.status,'completion-date-recorded');assert.ok(row.statusBasis.includes('not a live'));}
 const f=fixture();f.records[0].completedDate='2035-01-01';assert.throws(()=>normalizePermitSnapshot(f),/future/);
});
test('source identity, duplicate identities, negative amounts and privacy fields are checked',()=>{
 const wrong=fixture();wrong.records[0].sourceId='unrelated-source';assert.throws(()=>normalizePermitSnapshot(wrong),/identity/);
 const duplicate=fixture();duplicate.records.push(structuredClone(duplicate.records[0]));duplicate.recordCount=2;assert.throws(()=>normalizePermitSnapshot(duplicate),/ambiguous/);
 const negative=fixture();negative.records[0].estimatedCostUSD=-1;assert.throws(()=>normalizePermitSnapshot(negative),/amount/);
 const injected=fixture();injected.records[0].OWNERNAME='Excluded fixture';injected.records[0].email='excluded@example.invalid';const normalized=normalizePermitSnapshot(injected).records[0];assert.equal(normalized.OWNERNAME,undefined);assert.equal(normalized.email,undefined);assert.equal(normalized.recordKey,undefined);
});
test('permit filters use issue dates, inclusive bounds and explicit observed status',()=>{
 const selected=records[0];const bounds=[selected.longitude,selected.latitude,selected.longitude,selected.latitude];const matches=filterPropertyPermits(records,{bounds,fromDate:selected.issuedDate,toDate:selected.issuedDate,status:selected.status});assert.ok(matches.some(r=>r.id===selected.id));assert.ok(matches.every(r=>r.issuedDate===selected.issuedDate&&r.status===selected.status));assert.throws(()=>filterPropertyPermits(records,{fromDate:'2026-01-01',toDate:'2025-01-01'}),/filter/);assert.throws(()=>filterPropertyPermits(records,{status:'currently-under-construction'}),/filter/);
});
test('lazy loading is shared, abortable and retryable after source failure',async()=>{
 let calls=0,fail=true;const loader=createPropertyPermitData({fetchImpl:async url=>{calls++;if(fail){fail=false;throw Error('temporary outage');}return response(url.includes('manifest')?manifest:snapshot);}});await assert.rejects(loader.load(),/outage/);const a=await loader.load();const b=await loader.query({fromDate:'2025-12-01'});assert.equal(a.records.length,4581);assert.ok(b.records.length<4581);assert.equal(calls,3);
 let resolve;const stalled=createPropertyPermitData({timeoutMs:35,fetchImpl:()=>new Promise(r=>{resolve=r;})});const controller=new AbortController();const waiting=stalled.load({signal:controller.signal});controller.abort();await assert.rejects(waiting,{name:'AbortError'});resolve({ok:false});
});
test('stalled permit bodies time out and malformed source paths cannot be fetched',async()=>{
 const stalled=createPropertyPermitData({timeoutMs:25,fetchImpl:async()=>({ok:true,text:()=>new Promise(()=>{})})});await assert.rejects(stalled.load(),{name:'AbortError'});
 let calls=0;const malformed=structuredClone(manifest);malformed.datasets[0].url='https://unrelated.invalid/records';const loader=createPropertyPermitData({fetchImpl:async()=>{calls++;return response(malformed);}});await assert.rejects(loader.load(),/path/);assert.equal(calls,1);
});
test('CSV preserves source provenance and guards spreadsheet formulas without adding private fields',()=>{
 const row={...records[0],description:'=1+1',address:'A "quoted" address'};const csv=propertyPermitsCsv([row],snapshot.source);assert.match(csv,/sourceUrl/);assert.ok(csv.includes(snapshot.source.url));assert.ok(csv.includes(snapshot.source.retrievedAt));assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes('A ""quoted"" address'));assert.doesNotMatch(csv.split('\r\n')[0],/owner|contractor|occupant|email|phone/i);
});
