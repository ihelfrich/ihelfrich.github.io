import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPropertyPlanningData} from '../../src/lib/property-planning-data.mjs';
const root=new URL('../../public/',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL('.'+path,root),'utf8'));
const fixtures={};
for(const [id,path] of Object.entries({'tif-districts':'/st-louis/incentives/tif-districts.json','tax-abatements':'/st-louis/incentives/tax-abatements.json','planning-documents':'/st-louis/planning-documents/index.json'}))fixtures[id]=await load(path);
const response=data=>({ok:true,headers:new Headers(),text:async()=>JSON.stringify(data)});
const fetcher=async url=>response(fixtures[url.includes('tif-districts')?'tif-districts':url.includes('tax-abatements')?'tax-abatements':'planning-documents']);
test('all source records remain distinct and source polygons are retained behind representative map points',async()=>{
 const client=createPropertyPlanningData({fetchImpl:fetcher});const result=await client.query({layers:['tif-districts','tax-abatements']});
 assert.equal(result.records.length,1637);assert.equal(result.features.length,1637);assert.equal(result.partial,false);
 assert.equal(new Set(result.records.map(r=>r.id)).size,1637);
 for(const r of result.records){assert.ok(['Polygon','MultiPolygon'].includes(r.geometry.type));assert.equal(r.geometryRole,'source-polygon');}
 for(const f of result.features){assert.equal(f.geometry.type,'Point');assert.equal(f.geometryRole,'representative-point-of-source-polygon');assert.ok(f.original.geometry);}
 assert.equal(result.records.filter(r=>r.recordKey).length,1195);client.dispose();
});
test('approval dates filter exact days and undated records remain available only without an active date filter',async()=>{
 const selected=structuredClone(fixtures['tif-districts']);selected.records=selected.records.slice(0,3).map((r,i)=>({...r,approvalDate:['2020-06-01','2020-06-02',null][i]}));
 const client=createPropertyPlanningData({fetchImpl:async()=>response(selected)});
 assert.equal((await client.query({layers:['tif-districts']})).records.length,3);
 const r=await client.query({layers:['tif-districts'],fromDate:'2020-06-02',toDate:'2020-06-02'});assert.equal(r.records.length,1);assert.equal(r.records[0].approvalDate,'2020-06-02');
 assert.equal((await client.query({layers:['tif-districts'],fromYear:2026})).records.length,0);
 await assert.rejects(client.query({fromDate:'2026-02-30'}),/calendar date/);await assert.rejects(client.query({fromDate:'2026-02-01',toDate:'2026-01-01'}),/reversed/);client.dispose();
});
test('abatement periods overlap filter years without manufacturing exact start or end days',async()=>{
 const selected=structuredClone(fixtures['tax-abatements']);selected.records=selected.records.slice(0,3).map((r,i)=>({...r,abatementStartYear:[2019,2027,null][i],abatementEndYear:[2026,2030,null][i]}));
 const client=createPropertyPlanningData({fetchImpl:async()=>response(selected)});const r=await client.query({layers:['tax-abatements'],fromDate:'2026-12-31',toDate:'2026-12-31'});
 assert.equal(r.records.length,1);assert.equal(r.records[0].date,null);assert.equal(r.records[0].datePrecision,'year');assert.equal(r.layers[0].dateBasis,'recorded-year-interval-overlap');client.dispose();
});
test('documents stay unmapped regardless of viewport and can be filtered by an explicit hearing day',async()=>{
 const client=createPropertyPlanningData({fetchImpl:fetcher});const r=await client.query({layers:['planning-documents'],bounds:[-90.4,38.5,-90.3,38.6],fromDate:'2026-09-21',toDate:'2026-09-21'});
 assert.ok(r.records.length>=2);assert.equal(r.features.length,0);assert.ok(r.records.every(r=>r.hearingDate==='2026-09-21'&&r.longitude===null&&r.recordKey===null));assert.equal(r.layers[0].status,'unmapped');client.dispose();
});
test('unavailable source reports null counts, does not cache failure, and respects byte bounds',async()=>{
 let calls=0;const client=createPropertyPlanningData({fetchImpl:async()=>++calls===1?{ok:false}:response(fixtures['tif-districts'])});
 let r=await client.query({layers:['tif-districts']});assert.equal(r.partial,true);assert.equal(r.layers[0].count,null);assert.equal(r.layers[0].status,'unavailable');
 r=await client.query({layers:['tif-districts']});assert.equal(r.records.length,197);assert.equal(calls,2);client.dispose();
 const tiny=createPropertyPlanningData({fetchImpl:fetcher,maxBytes:10});assert.equal((await tiny.query({layers:['tif-districts']})).layers[0].count,null);tiny.dispose();
});
test('false parcel association and altered source identity fail closed',async()=>{
 for(const mutate of [d=>d.source.url='https://example.com/data',d=>{d.records[0].recordKey='false-join';d.records[0].parcelJoinStatus='nearby';}]){
  const d=structuredClone(fixtures['tif-districts']);mutate(d);const c=createPropertyPlanningData({fetchImpl:async()=>response(d)});assert.equal((await c.query({layers:['tif-districts']})).layers[0].count,null);c.dispose();
 }
});
test('feature budget aggregates with count conservation, and search preserves exact individual records',async()=>{
 const c=createPropertyPlanningData({fetchImpl:fetcher,maxFeatures:30});const r=await c.query({layers:['tax-abatements']});assert.ok(r.features.length<=30);assert.equal(r.features.reduce((sum,f)=>sum+(f.count??1),0),1440);
 const a=fixtures['tax-abatements'].records[0].address;const found=await c.query({layers:['tax-abatements'],query:a});assert.ok(found.records.some(x=>x.address===a));c.dispose();
});
test('consumer abort and disposal reject promptly even if a fetch implementation ignores its abort signal',async()=>{
 const c=createPropertyPlanningData({fetchImpl:()=>new Promise(()=>{}),timeoutMs:10000});const controller=new AbortController();const p=c.query({layers:['tif-districts'],signal:controller.signal});controller.abort();await assert.rejects(p,{name:'AbortError'});c.dispose();
 const d=createPropertyPlanningData({fetchImpl:()=>new Promise(()=>{}),timeoutMs:10000});const q=d.query({layers:['tif-districts']});d.dispose();await assert.rejects(q,{name:'AbortError'});
});
test('published incentive hashes, source counts, and privacy allowlists reconcile with the manifest',async()=>{
 const m=await load('/st-louis/incentives/manifest.json');assert.equal(m.recordCount,1637);assert.equal(m.confirmedCurrentYearCoverage,false);
 for(const entry of m.datasets){const raw=await readFile(new URL('.'+entry.url,root));assert.equal(raw.length,entry.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256);const d=JSON.parse(raw);assert.equal(d.records.length,entry.recordCount);assert.equal(d.source.sourceDataEditedAt,null);assert.equal(d.coverage.amountSuppliedCount,0);
  for(const r of d.records){assert.ok(!Object.keys(r).some(k=>/owner|mail|contact|phone|email/i.test(k)));assert.equal(r.amountUSD,null);}
 }
 const h=await load('/st-louis/incentives/history-input.json');assert.equal(h.records.length,1637);assert.ok(h.records.every(r=>r.recordKey===null&&r.parcelId===null&&r.parcelKey===null));
});
