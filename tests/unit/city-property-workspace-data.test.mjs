import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPropertyHistoryData} from '../../src/lib/property-history-data.mjs';
import {createPropertyWorkspaceData,propertyPeriod} from '../../src/lib/property-workspace-data.mjs';
import {createPropertyActivityData} from '../../src/lib/property-activity-data.mjs';
const bounds=[-91,38,-90,39],sourceId='st-louis-county-business-name-indicators';
const checksum=s=>createHash('sha256').update(s).digest('hex');
const event=(patch={})=>({id:'change1',sourceId,kind:'owner-observation-changed',recordKey:'st-louis-county-current:ABC:1',parcelKey:'st-louis-county:ABC',parcelId:'ABC',sourceObjectId:1,longitude:-90.4,latitude:38.7,observedAt:'2026-09-12T14:00:00Z',previousObservedAt:'2026-09-11T14:00:00Z',before:{ownerName:'A LLC'},after:{ownerName:'B LLC'},meaning:'Not a purchase.',...patch});
function historyFixture({events=[],status='healthy',hash=true}={}){
 const paths=new Map(),parts=[];
 for(let i=0;i<events.length;i++){const e=events[i],body=JSON.stringify({schema:'property-observation-events-v1',sourceId,events:[e]});const url=`/st-louis/history/events/2026-09/${i}.json`;paths.set(url,body);parts.push({url,sha256:hash?checksum(body):'0'.repeat(64),eventCount:1,observedAt:e.observedAt});}
 paths.set('/st-louis/history/manifest.json',JSON.stringify({schema:'property-observation-history-v1',sources:[{id:sourceId,status,baselineObservedAt:'2026-09-11T14:00:00Z',lastSuccessAt:'2026-09-12T14:00:00Z',events:parts,limitations:['Observed names, not purchases.']}]}));
 const calls=[],fetchImpl=async url=>{calls.push(url);return new Response(paths.get(url)||'',{status:paths.has(url)?200:404})};return {paths,calls,fetchImpl};
}
test('periods use inclusive calendar days and reject invented dates/reversed ranges',()=>{
 assert.deepEqual(propertyPeriod('30',null,null,new Date('2026-09-12T15:00:00Z')),{fromDate:'2026-08-14',toDate:'2026-09-12'});
 assert.deepEqual(propertyPeriod('all'),{fromDate:null,toDate:null});
 assert.throws(()=>propertyPeriod('custom','2026-02-30','2026-03-01'),/valid calendar/);
 assert.throws(()=>propertyPeriod('custom','2026-09-13','2026-09-12'),/valid calendar/);
});
test('a saved baseline is not invented acquisition history and needs no full-state download',async()=>{
 const f=historyFixture(),data=createPropertyHistoryData(f);const r=await data.query({bounds});assert.equal(r.partial,false);assert.equal(r.layers[0].status,'baseline-only');assert.equal(r.records.length,0);assert.deepEqual(f.calls,['/st-louis/history/manifest.json']);data.dispose();
});
test('history filters on observed date and exact map area while preserving literal before/after names',async()=>{
 const f=historyFixture({events:[event(),event({id:'outside',longitude:-89}),event({id:'older',observedAt:'2026-09-10T00:00:00Z'})]});const data=createPropertyHistoryData(f);
 const r=await data.query({bounds,fromDate:'2026-09-12',toDate:'2026-09-12',query:'B LLC',level:'properties'});
 assert.equal(r.records.length,1);assert.equal(r.records[0].original.before.ownerName,'A LLC');assert.equal(r.records[0].kind,'ownership-observation');assert.equal(r.records[0].dateBasis,'observation-date-not-transaction');assert.ok(!f.calls.some(url=>/state|baseline/.test(url)));
 const outsideDate=await data.query({bounds,fromDate:'2026-10-01'});assert.equal(outsideDate.layers[0].status,'no-matching-observations');data.dispose();
});
test('failed source health and checksum corruption stay visible without producing changes',async()=>{
 const f=historyFixture({events:[event()],status:'failed',hash:false}),data=createPropertyHistoryData(f),r=await data.query({bounds});assert.equal(r.records.length,0);assert.equal(r.partial,true);assert.equal(r.layers[0].status,'partial');assert.match(r.layers[0].error,/checksum/);assert.equal(r.health[0].lastSuccessAt,'2026-09-12T14:00:00Z');data.dispose();
});
test('bounded change history discloses omitted partitions and does not fetch unbounded states',async()=>{
 const f=historyFixture({events:[event({id:'1'}),event({id:'2'}),event({id:'3'})]}),data=createPropertyHistoryData({...f,maxPartitions:2,maxEvents:1});const r=await data.query({bounds});assert.equal(r.records.length,1);assert.equal(r.partial,true);assert.equal(r.layers[0].historyWindow.availablePartitions,3);assert.equal(f.calls.length,2);data.dispose();
});
test('workspace isolates a source failure and enforces the combined 2000-feature budget without dropping counts',async()=>{
 const calls=[],points=Array.from({length:1300},(_,i)=>({id:`a${i}`,layerId:'permits',kind:'permit',longitude:-90.5+i*.0001,latitude:38.5,value:null}));
 const adapter=(name,id,fail=false)=>({query:async options=>{calls.push([name,options]);if(fail)throw Error('Unavailable fixture');const features=points.map(p=>({...p,id:name+p.id,layerId:id}));return {records:features,features,layers:[{id,count:1300,mappedCount:1300}],partial:false};},dispose(){}});
 const data=createPropertyWorkspaceData({activity:adapter('activity','permits'),planning:adapter('planning','tif-districts'),utilities:adapter('utilities','water-materials',true),history:adapter('history','ownership-history')});
 const r=await data.query({layers:['permits','tif-districts','water-materials'],bounds,level:'properties',fromDate:'2026-01-11'});assert.equal(r.partial,true);assert.equal(r.records.length,2600);assert.ok(r.features.length<=2000);assert.equal(r.features.reduce((n,f)=>n+f.count,0),2600);assert.equal(r.layers.find(l=>l.id==='water-materials').status,'unavailable');assert.ok(calls.every(([,o])=>o.fromDate==='2026-01-11'));data.dispose();
});
test('legacy permit adapter applies exact days before map aggregation',async()=>{
 const body=await readFile(new URL('../../public/st-louis/permits/city-2025.json',import.meta.url),'utf8');
 const data=createPropertyActivityData({fetchImpl:async()=>new Response(body)});
 const full=await data.query({layers:['permits'],bounds:[-180,-90,180,90]});const chosen=full.records.find(r=>r.date)?.date.slice(0,10);assert.ok(chosen);
 const narrow=await data.query({layers:['permits'],bounds:[-180,-90,180,90],fromDate:chosen,toDate:chosen});assert.ok(narrow.records.length>0);assert.ok(narrow.records.every(r=>r.date.slice(0,10)===chosen));assert.equal(narrow.features.reduce((n,f)=>n+(f.count||1),0),narrow.records.length);data.dispose();
});
