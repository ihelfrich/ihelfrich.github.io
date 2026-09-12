import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPropertyActivityData,aggregatePropertyActivities} from '../../src/lib/property-activity-data.mjs';
import {PUBLIC_LRA_SOURCE} from '../../src/lib/city-public-listings.mjs';

const bounds=[-91,38,-90,39],retrievedAt='2026-09-12T12:00:00Z',permitSource='st-louis-city-building-permits-2025',ownerSource='st-louis-county-business-name-indicators';
const permit=(id='one')=>({id,sourceId:permitSource,jurisdiction:'st-louis-city',sourceObjectId:0,longitude:-90.3,latitude:38.6,address:'Synthetic address',description:'Source description',applicationNumber:id,applicationDate:'2019-05-01',issuedDate:'2025-04-02',completedDate:null,status:'issue-date-recorded',statusBasis:'Supplied date presence',estimatedCostUSD:0});
const permitSnapshot=records=>({schema:'property-permit-points-v1',source:{id:permitSource,url:'https://example.com/official'},retrievedAt,jurisdiction:'st-louis-city',records});
const publicSnapshot=()=>({schemaVersion:1,source:PUBLIC_LRA_SOURCE,retrievedAt,listings:[{id:'lra-one',sourceId:PUBLIC_LRA_SOURCE.id,parcelKey:'st-louis-city:shared',parcelId:'one',handle:'shared',status:'available',sourceStatus:'Available',askingPrice:null,priceStatus:'not-published',longitude:-90.3,latitude:38.6,retrievedAt}]});
const planningSnapshot=()=>({schema:'property-planning-v1',sources:{official:{id:'official',url:'https://example.com/plan',retrievedAt}},records:[{id:'notice',title:'Synthetic planning hearing',jurisdiction:'st-louis-city',category:'zoning-petition',status:'hearing-listed',hearingDate:'2026-10-01',announcedDate:null,statusAsOfDate:'2026-09-10',summary:'Official proposal',geography:{kind:'source-described-area',label:'A described area',addresses:[],geometry:null},sources:['official'],officialUrl:'https://example.com/plan'}]});
const ownerManifest=()=>({schema:'ownership-signals-v1',source:{id:ownerSource,name:'Current public owner-name indicators',url:'https://example.com/owners',retrievedAt},ruleVersion:'v1',tiles:[{id:'a',url:'/st-louis/ownership-signals/tiles/a.json',bounds:[-90.4,38.5,-90.2,38.7],count:1}]});
const ownerTile=()=>({schema:'ownership-signals-tile-v1',id:'a',sourceId:ownerSource,jurisdiction:'st-louis-county',records:[{id:'owner-one',jurisdiction:'st-louis-county',sourceObjectId:101,recordKey:'st-louis-county-current:1:101',parcelKey:'st-louis-county:1',parcelId:'1',longitude:-90.3,latitude:38.6,ownerName:'Synthetic Example LLC',indicator:'name_contains_legal_designator',matchedDesignator:'LLC',ruleVersion:'v1'}]});
function harness(data,options={}){
 const calls=[];const loader=createPropertyActivityData({now:()=>Date.parse(retrievedAt),fetchImpl:async url=>{calls.push(url);const value=data[url];if(value instanceof Error)throw value;return value===undefined?new Response('',{status:404}):new Response(JSON.stringify(value));},...options});
 return {loader,calls};
}
const permitPath='/st-louis/permits/city-2025.json',publicPath='/st-louis/public-listings/latest.json',planningPath='/st-louis/planning/index.json',ownerPath='/st-louis/ownership-signals/index.json',ownerTilePath='/st-louis/ownership-signals/tiles/a.json';

test('date-based permits and unmapped planning notices retain source payloads and different date meanings',async()=>{
 const h=harness({[permitPath]:permitSnapshot([permit()]),[planningPath]:planningSnapshot()});
 const result=await h.loader.query({layers:['permits','planning-notices'],bounds,level:'properties'});
 assert.equal(result.features.length,1);assert.equal(result.records.length,2);assert.equal(result.partial,false);
 const point=result.records[0],notice=result.records[1];
 assert.equal(point.date,'2025-04-02');assert.equal(point.dateBasis,'permit-issue-date');assert.equal(point.original.applicationDate,'2019-05-01');
 assert.equal(point.recordKey,null);assert.equal(point.sourceObjectId,0);assert.equal(point.value,0);
 assert.equal(notice.kind,'planning');assert.equal(notice.longitude,null);assert.equal(notice.date,'2026-10-01');assert.equal(notice.status,'hearing-listed');
 assert.equal(result.layers[1].status,'unmapped');assert.equal(result.layers[1].unmappedCount,1);
 const dated=await h.loader.query({layers:['permits','planning-notices'],bounds,level:'properties',fromYear:2026,toYear:2026});
 assert.equal(dated.records.length,1);assert.equal(dated.records[0].kind,'planning');assert.equal(h.calls.length,2,'cached sources are not fetched for a different year filter');h.loader.dispose();
});
test('public inventory is not dated by retrieval and unlocated source records remain browsable',async()=>{
 const snapshot=publicSnapshot();snapshot.listings.push({...snapshot.listings[0],id:'unlocated',longitude:null,latitude:null});
 const h=harness({[publicPath]:snapshot});
 const result=await h.loader.query({layers:['public-inventory'],bounds,level:'properties',fromYear:1990,toYear:1991});
 assert.equal(result.records.length,2);assert.equal(result.features.length,1);assert.equal(result.layers[0].unmappedCount,1);
 assert.equal(result.records[0].date,null);assert.equal(result.records[0].value,null);assert.equal(result.layers[0].dateFilterApplied,false);h.loader.dispose();
});
test('a failed source is unavailable while independent verified records remain visible',async()=>{
 const h=harness({[permitPath]:permitSnapshot([permit()]),[planningPath]:new Error('offline')});
 const result=await h.loader.query({layers:['permits','planning-notices'],bounds});
 assert.equal(result.partial,true);assert.equal(result.layers[0].status,'ready');assert.equal(result.layers[1].status,'unavailable');assert.equal(result.features.length,1);h.loader.dispose();
});
test('ownership overview uses only count tiles, details retain current identities, and retrieval is not acquisition',async()=>{
 const h=harness({[ownerPath]:ownerManifest(),[ownerTilePath]:ownerTile()});
 const overview=await h.loader.query({layers:['ownership-signals'],bounds,level:'areas'});
 assert.equal(overview.features[0].kind,'activity-cell');assert.equal(overview.features[0].count,1);assert.deepEqual(h.calls,[ownerPath]);
 const detail=await h.loader.query({layers:['ownership-signals'],bounds,level:'properties',fromYear:1900,toYear:1901});
 assert.equal(detail.records[0].kind,'ownership');assert.equal(detail.records[0].recordKey,'st-louis-county-current:1:101');
 assert.equal(detail.records[0].date,null);assert.equal(detail.records[0].dateBasis,'current-observation-not-acquisition');assert.equal(detail.layers[0].dateFilterApplied,false);
 assert.equal(detail.records[0].status,'name-pattern');assert.equal(detail.records[0].indicator,'name_contains_legal_designator');
 const searched=await h.loader.query({layers:['ownership-signals'],bounds,level:'areas',query:'Synthetic'});
 assert.equal(searched.partial,true);assert.equal(searched.features.length,0);assert.equal(searched.layers[0].searchApplied,false);h.loader.dispose();
});
test('swapped ownership tile identities fail verification without producing current-owner records',async()=>{
 const tile=ownerTile();tile.id='wrong';
 const h=harness({[ownerPath]:ownerManifest(),[ownerTilePath]:tile});
 const result=await h.loader.query({layers:['ownership-signals'],bounds,level:'properties'});
 assert.equal(result.features.length,0);assert.equal(result.partial,true);assert.equal(result.layers[0].failedTiles,1);h.loader.dispose();
});
test('wide ownership search uses exact-name summaries without loading every parcel tile or collapsing spelling variants',async()=>{
 const manifest=ownerManifest();manifest.tiles[0].count=5;manifest.nameIndexUrl='/st-louis/ownership-signals/names-index.json';
 const names={schema:'ownership-name-index-v1',sourceId:ownerSource,ruleVersion:'v1',records:[
  {name:'Example LLC',normalizedOwnerName:'example llc',count:3,tiles:[{id:'a',count:2}],unlocatedCount:1},
  {name:'EXAMPLE LLC',normalizedOwnerName:'example llc',count:2,tiles:[{id:'a',count:2}]},
  {name:'Other LLC',normalizedOwnerName:'other llc',count:1,tiles:[{id:'a',count:1}]},
 ]};
 const h=harness({[ownerPath]:manifest,[manifest.nameIndexUrl]:names});
 const result=await h.loader.query({layers:['ownership-signals'],bounds,level:'areas',query:'Ｅｘａｍｐｌｅ'});
 assert.deepEqual(h.calls,[ownerPath,manifest.nameIndexUrl]);assert.equal(result.features.length,1);assert.equal(result.features[0].count,4);
 assert.equal(result.records.length,2,'case variants are separate literal source names');assert.equal(result.records.every(row=>row.recordKey===null&&row.date===null),true);
 assert.equal(result.layers[0].count,5);assert.equal(result.layers[0].unmappedCount,1);assert.equal(result.layers[0].searchApplied,true);h.loader.dispose();
});
test('activity aggregation preserves category counts and a hard 2,000 feature budget without truncation',()=>{
 const points=Array.from({length:4500},(_,i)=>({id:String(i),layerId:i%2?'permits':'public-inventory',kind:i%2?'permit':'listing',longitude:-125+(i%150)*.1,latitude:25+Math.floor(i/150)*.1,color:'#123456'}));
 const cells=aggregatePropertyActivities(points,{level:'properties'});
 assert.ok(cells.length<=2000);assert.equal(cells.reduce((n,c)=>n+c.count,0),points.length);assert.ok(cells.every(c=>c.kind==='activity-cell'&&c.value===null));
 assert.equal(cells.filter(c=>c.layerId==='permits').reduce((n,c)=>n+c.count,0),2250);
});
test('abort and disposal promptly reject a pending view; failed fetches retry rather than cache empty coverage',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 const h=harness({}, {fetchImpl:()=>pending,timeoutMs:500});
 const controller=new AbortController(),first=h.loader.query({layers:['permits'],bounds,signal:controller.signal});controller.abort();
 await assert.rejects(first,{name:'AbortError'});
 const next=h.loader.query({layers:['permits'],bounds});h.loader.dispose();await assert.rejects(next,{name:'AbortError'});
 resolve(new Response(JSON.stringify(permitSnapshot([permit()]))));
 let calls=0;const retry=harness({}, {fetchImpl:async()=>++calls===1?new Response('',{status:503}):new Response(JSON.stringify(permitSnapshot([permit()])))});
 assert.equal((await retry.loader.query({layers:['permits'],bounds})).layers[0].status,'unavailable');
 assert.equal((await retry.loader.query({layers:['permits'],bounds})).layers[0].status,'ready');assert.equal(calls,2);retry.loader.dispose();
});
test('actual public permit and LRA snapshots project their complete record counts into bounded overview cells',async()=>{
 const loader=createPropertyActivityData({fetchImpl:async url=>new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8')),now:()=>Date.parse(retrievedAt)});
 const result=await loader.query({layers:['permits','public-inventory'],bounds:[-90.8,38.3,-90,39],level:'areas'});
 assert.equal(result.layers.find(layer=>layer.id==='permits').count,4581);assert.equal(result.layers.find(layer=>layer.id==='public-inventory').count,8555);
 assert.equal(result.features.reduce((n,cell)=>n+cell.count,0),13136);assert.ok(result.features.length<=2000);
 assert.equal(result.records.filter(r=>r.kind==='permit').every(r=>r.original.issuedDate.startsWith('2025-')&&r.recordKey===null),true);loader.dispose();
});
test('actual countywide name search reconciles literal groups and tile counts without a parcel-tile download',async()=>{
 const calls=[],loader=createPropertyActivityData({fetchImpl:async url=>{calls.push(url);return new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'));}});
 const result=await loader.query({layers:['ownership-signals'],bounds:[-90.8,38.3,-90,39],level:'areas',query:'llc'});
 const source=JSON.parse(await readFile(new URL('../../public/st-louis/ownership-signals/names-index.json',import.meta.url),'utf8'));
 const groups=source.records.filter(row=>row.normalizedOwnerName.includes('llc'));
 const mapped=groups.reduce((sum,row)=>sum+row.tiles.reduce((n,tile)=>n+tile.count,0),0),unmapped=groups.reduce((sum,row)=>sum+(row.unlocatedCount||0),0);
 assert.deepEqual(calls,[ownerPath,'/st-louis/ownership-signals/names-index.json']);
 assert.equal(result.records.length,groups.length);assert.equal(result.layers[0].mappedCount,mapped);assert.equal(result.layers[0].unmappedCount,unmapped);
 assert.equal(result.features.reduce((sum,cell)=>sum+cell.count,0),mapped);assert.equal(result.layers[0].count,mapped+unmapped);
 assert.ok(result.features.length<=2000);assert.equal(result.records.every(row=>row.recordKey===null&&row.parcelKey===null),true);loader.dispose();
});
