import test from 'node:test';
import assert from 'node:assert/strict';
import { geometryIntersectsRadius, selectNeighborhoodTiles, summarizeSpatialRecords, createSpatialStatistics, SPATIAL_MODEL_VERSION } from '../../src/lib/city-spatial-statistics.mjs';
import { Window } from 'happy-dom';
import { createSpatialPanel } from '../../src/scripts/city/city-spatial-panel.mjs';

const point = { longitude: -90.2, latitude: 38.6 };
const deg = 180 / (Math.PI * 6371008.8), coordinate = (x, y) => [point.longitude + x * deg / Math.cos(point.latitude * Math.PI / 180), point.latitude + y * deg];
const ring = (left, bottom, right, top) => [[left,bottom],[right,bottom],[right,top],[left,top],[left,bottom]].map(([x,y])=>coordinate(x,y));
const polygon = (left=-20,bottom=-20,right=20,top=20) => ({ type:'Polygon', coordinates:[ring(left,bottom,right,top)] });
const coverage = polygon(-2000,-2000,2000,2000);
const bounds = g => {const coords=g.coordinates.flat();return [Math.min(...coords.map(c=>c[0])),Math.min(...coords.map(c=>c[1])),Math.max(...coords.map(c=>c[0])),Math.max(...coords.map(c=>c[1]))]};
const record = (id,patch={},geometry=polygon()) => ({type:'Feature',geometry,bbox:bounds(geometry),properties:{recordKey:`record:${id}`,handle:`h:${id}`,parcelKey:`st-louis-city:h:${id}`,parcelId:`p:${id}`,areaSqFt:1000,assessedValueUSD:100000,landUseCode:1000,...patch}});
const options = patch => ({point,radiusMeters:250,coverageGeometry:coverage,source:{retrievedAt:'2026-09-08T12:00:00Z'},...patch});
const tile = (id,geometry=polygon(-100,-100,100,100)) => ({id,url:`/st-louis/parcels/tiles/${id}.json`,bounds:bounds(geometry),bytes:100,count:1});
const manifest = tiles => ({schema:'st-louis-parcels-v1',source:{retrievedAt:'2026-09-08T12:00:00Z'},completeSourceExtraction:true,coverageGeometry:coverage,tiles});

test('inclusion uses source geometry intersection with the radius and honors holes',()=>{
  assert.equal(geometryIntersectsRadius(polygon(245,-10,300,10),point,250),true);
  assert.equal(geometryIntersectsRadius(polygon(260,-10,300,10),point,250),false);
  const donut={type:'Polygon',coordinates:[ring(-1000,-1000,1000,1000),ring(-300,-300,300,300)]};
  assert.equal(geometryIntersectsRadius(donut,point,250),false);
  assert.equal(geometryIntersectsRadius(donut,point,500),true);
  assert.equal(geometryIntersectsRadius({type:'MultiPolygon',coordinates:[polygon(900,900,1000,1000).coordinates,polygon().coordinates]},point,250),true);
});
test('selects every expanded tile bound intersecting radius, in reproducible order',()=>{
  const tiles=[tile('b',polygon(245,-10,2000,10)),tile('z',polygon(1000,1000,1100,1100)),tile('a')];
  assert.deepEqual(selectNeighborhoodTiles(manifest(tiles),{point,radiusMeters:250}).map(t=>t.id),['a','b']);
  assert.throws(()=>selectNeighborhoodTiles(manifest([tile('a')]),{point,radiusMeters:300}),/250 or 500/);
  assert.throws(()=>selectNeighborhoodTiles(manifest(Array.from({length:13},(_,i)=>tile(String(i)))),{point,radiusMeters:250}),/tile budget/);
});
test('deduplicates record keys, distinguishes shared HANDLE accounts and never sums overlapping areas or values',()=>{
  const a=record('a',{assessedValueUSD:0}),b=record('b',{handle:'h:a',parcelKey:'st-louis-city:h:a',areaSqFt:1000,assessedValueUSD:200000}),c=record('c',{areaSqFt:null,assessedValueUSD:null,landUseCode:null});
  const result=summarizeSpatialRecords([a,b,c,structuredClone(a)],options());
  assert.equal(result.modelVersion,SPATIAL_MODEL_VERSION);assert.equal(result.status,'complete');assert.equal(result.counts.sourceRecords,3);assert.equal(result.counts.distinctHandles,2);assert.equal(result.counts.sharedHandleGroups,1);
  assert.deepEqual(result.assessment,{medianUSD:100000,nonNullAccounts:2,unknownAccounts:1,assessmentYear:null});
  assert.equal(result.lotArea.medianSqFt,1000);assert.equal(result.lotArea.nonNullHandles,1);assert.equal(result.lotArea.nonNullRecords,2);assert.equal(result.lotArea.unknownHandles,1);
  assert.equal(Object.hasOwn(result.assessment,'totalUSD'),false);assert.equal(Object.hasOwn(result.lotArea,'totalSqFt'),false);
  assert.deepEqual(result.landUseCodes,[{code:'1000',count:2},{code:null,count:1}]);
});
test('medians scale, source ordering is invariant, conflicting handle lot areas are excluded',()=>{
  const rows=[record('a',{areaSqFt:0,assessedValueUSD:20000}),record('b',{areaSqFt:4000,assessedValueUSD:10000}),record('c',{handle:'h:b',areaSqFt:5000,assessedValueUSD:30000})];
  const a=summarizeSpatialRecords(rows,options()),b=summarizeSpatialRecords([...rows].reverse(),options());assert.deepEqual(a,b);
  const scaled=summarizeSpatialRecords(rows.map(r=>({...r,properties:{...r.properties,assessedValueUSD:r.properties.assessedValueUSD*2}})),options());assert.equal(scaled.assessment.medianUSD,a.assessment.medianUSD*2);
  assert.equal(a.lotArea.conflictingHandles,1);assert.equal(a.lotArea.medianSqFt,0);assert.equal(a.lotArea.nonNullHandles,1);
});
test('empty summaries retain unknown medians, invalid topology is counted and City boundary is explicitly partial',()=>{
  const a=summarizeSpatialRecords([],options());assert.equal(a.counts.sourceRecords,0);assert.equal(a.assessment.medianUSD,null);assert.equal(a.lotArea.medianSqFt,null);
  const b=summarizeSpatialRecords([record('bad',{geometryStatus:'invalid-source'})],options({coverageGeometry:polygon(-100,-1000,1000,1000)}));
  assert.equal(b.excluded.invalidGeometryCandidates,1);assert.equal(b.coverage.geographic,'partial-city-coverage');assert.equal(b.counts.sourceRecords,0);
});
test('public LRA matching requires HANDLE and ParcelId and reports only supplied snapshot subset',()=>{
  const snapshot={retrievedAt:'2026-09-08T10:00:00Z',source:{name:'LRA fixture'},listings:[{id:'good',parcelKey:'st-louis-city:h:a',parcelId:'p:a'},{id:'wrong',parcelKey:'st-louis-city:h:b',parcelId:'other'}]};
  const result=summarizeSpatialRecords([record('a'),record('b')],options({inventorySnapshot:snapshot}));assert.equal(result.publicInventory.matchedSourceRecords,1);assert.equal(result.publicInventory.matchedListingRecords,1);assert.equal(result.publicInventory.status,'provided-subset');
  assert.equal(summarizeSpatialRecords([record('a')],options()).publicInventory.status,'not-provided');
});
test('identity conflicts and record budget fail rather than silently return partial aggregates',()=>{
  assert.throws(()=>summarizeSpatialRecords([record('a'),record('a',{assessedValueUSD:10})],options()),/identity collision/);
  assert.throws(()=>summarizeSpatialRecords([record('a'),record('b')],options({maxRecords:1})),/record budget/);
});
test('loader fetches only intersecting same-origin geometry tiles and measures bytes including the manifest',async()=>{
  const calls=[],m=manifest([tile('a'),tile('far',polygon(2000,2000,2100,2100))]),bodies={'/st-louis/parcels/manifest.json':m,'/st-louis/parcels/tiles/a.json':{type:'FeatureCollection',features:[record('a')]}};
  const load=createSpatialStatistics({fetchImpl:async url=>{calls.push(url);return new Response(JSON.stringify(bodies[url]));},now:()=>0});
  const result=await load(point,{radiusMeters:250});assert.equal(result.counts.sourceRecords,1);assert.deepEqual(calls,['/st-louis/parcels/manifest.json','/st-louis/parcels/tiles/a.json']);assert.ok(result.transport.bytes>500);assert.equal(result.transport.tiles,1);
});
test('failed tile, measured size limit and abort reject without partial statistics',async()=>{
  const m=manifest([tile('a'),tile('b')]);
  const fail=createSpatialStatistics({fetchImpl:async url=>url.endsWith('manifest.json')?new Response(JSON.stringify(m)):new Response('{}',{status:503})});await assert.rejects(fail(point),/HTTP 503/);
  const large=createSpatialStatistics({maxBytes:10,fetchImpl:async()=>new Response(JSON.stringify(m))});await assert.rejects(large(point),/byte budget/);
  const controller=new AbortController();controller.abort();const aborted=createSpatialStatistics({fetchImpl:async()=>{throw new Error('must not fetch')}});await assert.rejects(aborted(point,{signal:controller.signal}),{name:'AbortError'});
  const evil=manifest([{...tile('a'),url:'https://example.org/tile.json'}]);const bad=createSpatialStatistics({fetchImpl:async()=>new Response(JSON.stringify(evil))});await assert.rejects(bad(point),/same-origin/);
});
test('spatial panel clears last-good results on selection change and ignores aborted late results',async t=>{
  const window=new Window(),root=window.document.createElement('div'),pending=[];
  const evidence={point,parcels:{parcel:record('a',{address:'10 Fixture Place'})}};
  const panel=createSpatialPanel(root,{getEvidence:()=>evidence,load:(p,options)=>new Promise(resolve=>pending.push({p,options,resolve}))});
  panel.setEvidence(evidence);root.querySelector('#spatial-run').click();assert.equal(pending.length,1);
  panel.setEvidence({...evidence,parcels:{parcel:record('b',{address:'20 Other Place'})}});assert.equal(pending[0].options.signal.aborted,true);
  pending[0].resolve(summarizeSpatialRecords([record('a')],options()));await new Promise(r=>setTimeout(r,0));
  assert.equal(root.querySelector('#spatial-results').textContent,'');assert.match(root.textContent,/20 Other Place/);
  root.querySelector('#spatial-run').click();pending[1].resolve(summarizeSpatialRecords([record('b')],options()));await new Promise(r=>setTimeout(r,0));
  assert.match(root.querySelector('#spatial-results').textContent,/100,000/);assert.match(root.textContent,/Assessment year.*unknown/i);
  panel.setEvidence(null);assert.equal(root.querySelector('#spatial-results').textContent,'');assert.equal(root.querySelector('#spatial-run').disabled,true);
  panel.dispose();t.after(async()=>window.happyDOM.abort());
});
