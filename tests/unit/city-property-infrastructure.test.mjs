import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPropertyInfrastructureData} from '../../src/lib/property-infrastructure-data.mjs';
import {PROPERTY_INFRASTRUCTURE_LAYERS} from '../../src/lib/property-infrastructure-catalog.mjs';
const base='/st-louis/infrastructure/',retrievedAt='2026-09-13T00:00:00Z';
const sources={'city-streetlights':{id:'stl-city-public-streetlights',url:'https://maps8.stlouis-mo.gov/arcgis/rest/services/STREETS/Streets_Permitting/MapServer'},'city-capital-projects':{id:'stl-city-capital-improvement-projects',url:'https://maps8.stlouis-mo.gov/arcgis/rest/services/Capital_Improvement_Projects/MapServer'}};
const bounds=[-90.4,38.5,-90.1,38.8];
function point(oid,x=-90.205,y=38.625){return feature('city-streetlights',2,oid,{type:'Point',coordinates:[x,y]});}
function line(oid,points){return feature('city-capital-projects',4,oid,{type:'LineString',coordinates:points});}
function feature(layer,sourceLayerId,oid,geometry){const s=sources[layer],id=`${s.id}:${sourceLayerId}:${oid}`;return {type:'Feature',id,geometry,properties:{id,sourceObjectId:oid,sourceLayerId,title:`Fixture ${oid}`,address:null,sourceURL:s.url+'/'+sourceLayerId,attributes:{}}};}
const coordinates=g=>g.type==='Point'?[g.coordinates]:g.type==='LineString'?g.coordinates:g.coordinates.flat();
function fixture(lights=[point(1),point(2,-90.215)],projects=[line(1,[[-90.22,38.62],[-90.2,38.64]])]){
 const files=new Map(),calls=[],layers=[];
 const put=(url,raw)=>{const body=JSON.stringify(raw);files.set(url,body);return {bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')};};
 for(const [id,rows]of[['city-streetlights',lights],['city-capital-projects',projects]]){
  const groups=new Map();for(const f of rows){const key=id==='city-streetlights'?f.geometry.coordinates.map(v=>Math.floor(v/.01)).join('_'):'projects';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
  const tiles=[];for(const [key,features]of groups){const pts=features.flatMap(f=>coordinates(f.geometry)),[x,y]=key.split('_').map(Number);const bounds=id==='city-streetlights'?[x*.01,y*.01,(x+1)*.01,(y+1)*.01]:[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];const url=`${base}${id}/${key}.geojson`;
   tiles.push({id:key,url,bounds,count:features.length,coordinateCount:pts.length,geometryTypes:[...new Set(features.map(f=>f.geometry.type))].sort(),...put(url,{schema:'property-infrastructure-geojson-v1',type:'FeatureCollection',layerId:id,sourceId:sources[id].id,tileId:key,retrievedAt,features})});}
  layers.push({id,available:true,recordCount:rows.length,mappedCount:rows.length,unmappedCount:0,coverage:'Fixture inventory',meaning:'Fixture geometry',gridDegrees:id==='city-streetlights'?.01:null,bounds,source:{...sources[id],retrievedAt,sourceDataEditedAt:null,exactObjectIdsVerified:true,sourceObjectIdsRechecked:true,sourceEditingEpochAvailable:false},tiles});
 }
 const manifest={schema:'property-infrastructure-manifest-v1',layers};const save=()=>put(base+'manifest.json',manifest);save();return {files,calls,layers,manifest,put,save,fetchImpl:async url=>{calls.push(url);return new Response(files.get(url)||'',{status:files.has(url)?200:404});}};
}
test('catalog separates connected City layers from unverified bridge redistribution',()=>{assert.deepEqual(PROPERTY_INFRASTRUCTURE_LAYERS.filter(x=>x.available).map(x=>x.id),['city-streetlights','city-capital-projects']);assert.equal(PROPERTY_INFRASTRUCTURE_LAYERS.find(x=>x.id==='modot-bridges').available,false);});
test('detail preserves actual line geometry and exact foreign-source identities without parcel joins',async()=>{
 const f=fixture(),data=createPropertyInfrastructureData(f),r=await data.query({bounds});assert.equal(r.partial,false);assert.equal(r.counts.records,3);assert.equal(r.features.length,3);const corridor=r.features.find(x=>x.layerId==='city-capital-projects');assert.equal(corridor.geometry.type,'LineString');assert.deepEqual(corridor.geometry.coordinates,[[-90.22,38.62],[-90.2,38.64]]);assert.equal(corridor.date,null);assert.equal(corridor.recordKey,null);assert.equal(corridor.parcelKey,null);assert.equal(corridor.geometryRole,'source-project-corridor');data.dispose();
});
test('exact line clipping includes crossing segments and excludes bbox-only diagonal misses',async()=>{
 const f=fixture([],[line(1,[[-90.3,38.6],[-90.1,38.8]]),line(2,[[-90.22,38.7],[-90.18,38.7]])]),data=createPropertyInfrastructureData(f);
 const r=await data.query({layers:['city-capital-projects'],bounds:[-90.21,38.695,-90.19,38.705]});assert.equal(r.counts.records,2);
 const miss=await data.query({layers:['city-capital-projects'],bounds:[-90.2,38.6,-90.18,38.61]});assert.equal(miss.counts.records,0);data.dispose();
});
test('point detail groups all 2,100 matching points without silent truncation',async()=>{
 const f=fixture(Array.from({length:2100},(_,i)=>point(i+1)),[]),data=createPropertyInfrastructureData(f);const r=await data.query({layers:['city-streetlights'],bounds});assert.equal(r.counts.records,2100);assert.ok(r.features.length<=1500);assert.equal(r.features.reduce((n,x)=>n+x.count,0),2100);assert.equal(r.layers[0].aggregation,'exact-query-point-cells');data.dispose();
});
test('broad point overview uses manifest cells only and states edge-cell coverage',async()=>{
 const f=fixture(Array.from({length:20},(_,i)=>point(i+1,-90.205+i*.001)),[]),data=createPropertyInfrastructureData({...f,detailLimit:5});const r=await data.query({layers:['city-streetlights'],bounds});assert.equal(r.counts.records,20);assert.equal(r.features.reduce((n,x)=>n+x.count,0),20);assert.match(r.layers[0].reason,/complete source grid cells/);assert.deepEqual(f.calls,[base+'manifest.json']);data.dispose();
});
test('geometry budget reports zoom-required with known count and does not draw a truncated line',async()=>{
 const f=fixture([],[line(1,Array.from({length:50},(_,i)=>[-90.25+i*.001,38.6+i*.001]))]),data=createPropertyInfrastructureData({...f,maxCoordinates:20});const r=await data.query({layers:['city-capital-projects'],bounds});assert.equal(r.counts.records,1);assert.equal(r.features.length,0);assert.equal(r.layers[0].status,'zoom-required');assert.equal(r.partial,true);data.dispose();
});
test('digest mismatch isolates the failed layer while preserving the other source',async()=>{
 const f=fixture();f.files.set(f.layers[1].tiles[0].url,f.files.get(f.layers[1].tiles[0].url)+' ');const data=createPropertyInfrastructureData(f),r=await data.query({bounds});assert.equal(r.partial,true);assert.equal(r.features.length,2);assert.equal(r.layers.find(x=>x.id==='city-capital-projects').status,'unavailable');data.dispose();
});
test('source identity, malicious links, attributes and geometry are rejected before publication',async()=>{
 for(const mutate of [p=>p.sourceObjectId=999,p=>p.sourceURL='javascript:alert(1)',p=>p.sourceURL='https://maps8.stlouis-mo.gov.evil.test/',p=>p.attributes={Responsible_Party:'private contact'}]){
  const f=fixture(),t=f.layers[0].tiles[0],raw=JSON.parse(f.files.get(t.url));mutate(raw.features[0].properties);Object.assign(t,f.put(t.url,raw));f.save();const data=createPropertyInfrastructureData(f);const r=await data.query({layers:['city-streetlights'],bounds});assert.equal(r.partial,true);assert.equal(r.features.length,1);data.dispose();
 }
});
test('invalid schema retries a repaired response and caller abort does not wait for a stuck fetch',async()=>{
 const f=fixture(),good=f.files.get(base+'manifest.json');f.files.set(base+'manifest.json','{}');const data=createPropertyInfrastructureData(f);assert.equal((await data.query({bounds})).partial,true);f.files.set(base+'manifest.json',good);assert.equal((await data.query({bounds})).partial,false);data.dispose();
 const controller=new AbortController(),slow=createPropertyInfrastructureData({fetchImpl:()=>new Promise(()=>{}),timeoutMs:50});const pending=slow.query({bounds,signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});slow.dispose();await assert.rejects(slow.query({bounds}),{name:'AbortError'});
});
test('unconnected source is explicit and does not fetch a misleading empty dataset',async()=>{const f=fixture(),data=createPropertyInfrastructureData(f),r=await data.query({layers:['modot-bridges'],bounds});assert.equal(r.layers[0].status,'not-connected');assert.match(r.layers[0].reason,/unverified/);assert.equal(f.calls.length,0);data.dispose();});
test('invalid inputs reject without retrieval',async()=>{const f=fixture(),data=createPropertyInfrastructureData(f);for(const args of[{bounds:[0,0,0,1]},{bounds,layers:['owner-names']},{bounds,layers:['city-streetlights','city-streetlights']}])await assert.rejects(data.query(args),RangeError);assert.equal(f.calls.length,0);data.dispose();});
test('published City snapshots reconcile all identities, hashes and geometry counts through the real adapter',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../public/st-louis/infrastructure/manifest.json',import.meta.url),'utf8'));
 const calls=[],data=createPropertyInfrastructureData({fetchImpl:async url=>{calls.push(url);return new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'));},detailLimit:100000,tileLimit:1000});
 const r=await data.query({bounds:[-91,38,-89,40]});assert.equal(r.partial,false);assert.equal(r.counts.records,manifest.layers.reduce((n,l)=>n+l.mappedCount,0));assert.ok(r.features.length<=1500);assert.ok(r.features.reduce((n,f)=>n+coordinates(f.geometry).length,0)<=15000);
 for(const layer of manifest.layers){assert.equal(r.layers.find(x=>x.id===layer.id).count,layer.mappedCount);assert.equal(layer.source.sourceEditingEpochAvailable,false);assert.equal(layer.source.sourceDataEditedAt,null);}
 const projectFeatures=r.features.filter(f=>f.layerId==='city-capital-projects');assert.equal(projectFeatures.length,manifest.layers.find(x=>x.id==='city-capital-projects').mappedCount);assert.ok(projectFeatures.some(f=>f.geometry.type==='MultiLineString'));assert.ok(projectFeatures.every(f=>f.recordKey===null&&f.date===null));
 assert.equal(calls.filter(x=>x.endsWith('.geojson')).length,manifest.layers.reduce((n,l)=>n+l.tiles.length,0));data.dispose();
});
test('published wide overview fetches no street-light geometry and reports all inventory counts',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../public/st-louis/infrastructure/manifest.json',import.meta.url),'utf8'));
 const calls=[],data=createPropertyInfrastructureData({fetchImpl:async url=>{calls.push(url);return new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'));}});
 const r=await data.query({bounds:[-90.742,38.389,-90.122,38.892]});assert.equal(r.partial,false);assert.equal(r.counts.records,manifest.layers.reduce((n,l)=>n+l.mappedCount,0));assert.equal(r.layers.find(x=>x.id==='city-streetlights').aggregation,'source-grid-cells');assert.equal(calls.some(x=>x.includes('/city-streetlights/')),false);assert.equal(r.features.filter(x=>x.layerId==='city-streetlights').reduce((n,x)=>n+x.count,0),manifest.layers.find(x=>x.id==='city-streetlights').mappedCount);data.dispose();
});
