import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCityParcelQuery, CITY_PARCEL_FIELDS, normalizeCityParcels, parcelContainsPoint, createParcelLookup, createParcelSearch } from '../../src/lib/city-parcels.mjs';

const ring=(x=0,y=0,size=1)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const geometry={type:'Polygon',coordinates:[ring()]};
const raw=(patch={})=>({type:'Feature',geometry:structuredClone(geometry),properties:{OBJECTID:1,HANDLE:'00123',ParcelId:'00987',SITEADDR:'10   Fictional  Way',SQFT:0,AsrLandUse1:5000,AsdTotal:0,LastDate:Date.UTC(2026,8,6),OWNERNAME:'SHOULD NEVER BE RETAINED',...patch}});
const normalize=features=>normalizeCityParcels({type:'FeatureCollection',features},{retrievedAt:'2026-09-08T12:00:00Z'});
const collection=features=>({type:'FeatureCollection',features});
const response=data=>({ok:true,json:async()=>data});
function service({features=normalize([raw()]).features,failFirstTile=false}={}) {
  const calls=[];
  const manifest={schema:'st-louis-parcels-v1',source:{name:'Synthetic source',retrievedAt:'2026-09-08T12:00:00Z'},coverageGeometry:{type:'Polygon',coordinates:[ring(-1,-1,3)]},tiles:[{bounds:[0,0,1,1],url:'/tile'}],search:{url:'/search'}};
  let fail=failFirstTile;
  const fetchImpl=async url=>{calls.push(url);if(url==='/manifest')return response(manifest);if(fail){fail=false;return{ok:false};}return response(collection(features));};
  return{calls,manifest,fetchImpl,lookup:createParcelLookup({manifestUrl:'/manifest',fetchImpl})};
}

test('point queries use exact intersection, allowlisted fields and no generalization',()=>{
  const url=new URL(buildCityParcelQuery({point:{longitude:-90.2,latitude:38.63}}));
  assert.equal(url.searchParams.get('spatialRel'),'esriSpatialRelIntersects');
  assert.equal(url.searchParams.get('geometryType'),'esriGeometryPoint');
  assert.equal(url.searchParams.get('outSR'),'4326');
  assert.deepEqual(url.searchParams.get('outFields').split(','),CITY_PARCEL_FIELDS);
  for(const key of ['distance','maxAllowableOffset','geometryPrecision'])assert.equal(url.searchParams.has(key),false);
  assert.throws(()=>buildCityParcelQuery({point:{longitude:'',latitude:0}}));
  assert.throws(()=>buildCityParcelQuery({limit:2001}));
  assert.throws(()=>buildCityParcelQuery({objectIds:['1 OR 1=1']}));
});

test('normalization preserves source identities, dates and zero without inventing an assessment year',()=>{
  const result=normalize([raw()]),p=result.features[0].properties;
  assert.equal(p.parcelKey,'st-louis-city:00123');assert.equal(p.parcelId,'00987');
  assert.equal(p.address,'10 Fictional Way');assert.equal(p.assessedValueUSD,0);assert.equal(p.areaSqFt,0);
  assert.equal(p.assessmentYear,null);assert.equal(p.sourceRecordDate,'2026-09-06T00:00:00.000Z');
  assert.equal(result.source.retrievedAt,'2026-09-08T12:00:00Z');
  assert.equal('OWNERNAME' in p,false);assert.equal('askingPrice' in p,false);
  const missing=normalize([raw({SQFT:'',AsdTotal:null,LastDate:null})]).features[0].properties;
  assert.equal(missing.areaSqFt,null);assert.equal(missing.assessedValueUSD,null);assert.equal(missing.sourceRecordDate,null);
});

test('exact multipart polygons and holes survive normalization without shared mutable references',()=>{
  const f=raw();f.geometry={type:'MultiPolygon',coordinates:[[ring(),ring(.2,.2,.2)],[ring(2,2)]]};
  const normalized=normalize([f]).features[0];
  assert.deepEqual(normalized.geometry,f.geometry);
  assert.deepEqual(normalized.bbox,[0,0,3,3]);
  f.geometry.coordinates[0][0][0][0]=10;
  assert.equal(normalized.geometry.coordinates[0][0][0][0],0);
});

test('missing or duplicate source identity and invalid geometry do not quietly enter a snapshot',()=>{
  assert.throws(()=>normalize([raw({HANDLE:''})]),/HANDLE/);
  assert.throws(()=>normalize([raw(),raw()]),/Duplicate/);
  const f=raw();f.geometry.coordinates[0].pop();assert.throws(()=>normalize([f]),/closed/);
  assert.throws(()=>normalizeCityParcels({error:{code:500}},{retrievedAt:'2026-09-08'}),/service/);
  assert.throws(()=>normalizeCityParcels(collection([])),/timestamp/);
});

test('point containment handles holes, multipart areas and shared boundary candidates',()=>{
  const g={type:'MultiPolygon',coordinates:[[ring(),ring(.2,.2,.2)],[ring(2,2)]]};
  assert.equal(parcelContainsPoint(g,{longitude:.1,latitude:.1}),true);
  assert.equal(parcelContainsPoint(g,{longitude:.3,latitude:.3}),false);
  assert.equal(parcelContainsPoint(g,{longitude:.2,latitude:.3}),true);
  assert.equal(parcelContainsPoint(g,{longitude:2.5,latitude:2.5}),true);
  assert.equal(parcelContainsPoint(g,{longitude:1.5,latitude:1.5}),false);
});

test('lookup distinguishes covered gaps, outside City, and precise parcel hits',async()=>{
  const f=service();
  const found=await f.lookup({longitude:.5,latitude:.5});
  assert.equal(found.status,'found');assert.equal(found.parcel.properties.handle,'00123');
  assert.equal(found.source.name,'Synthetic source');
  assert.equal((await f.lookup({longitude:1.5,latitude:1.5})).status,'not-found');
  assert.equal((await f.lookup({longitude:3,latitude:3})).status,'unsupported');
  assert.deepEqual(f.calls,['/manifest','/tile']);
});

test('all expanded tile bounds participate and overlapping accounts require explicit selection',async()=>{
  const a=normalize([raw()]).features[0],b=normalize([raw({HANDLE:'00234'})]).features[0];
  const manifest={schema:'st-louis-parcels-v1',source:{},coverageGeometry:geometry,tiles:[{bounds:[0,0,1,1],url:'/a'},{bounds:[0,0,1,1],url:'/b'}]};
  const lookup=createParcelLookup({manifestUrl:'/manifest',fetchImpl:async url=>response(url==='/manifest'?manifest:collection(url==='/a'?[a]:[b]))});
  const point={longitude:.5,latitude:.5};
  const ambiguous=await lookup(point);
  assert.equal(ambiguous.status,'found');assert.equal(ambiguous.parcel,null);assert.equal(ambiguous.ambiguous,true);assert.equal(ambiguous.candidates.length,2);
  const chosen=await lookup({...point,parcelKey:b.properties.parcelKey});
  assert.equal(chosen.parcel.properties.handle,'00234');assert.equal(chosen.ambiguous,false);
});

test('a failed tile request stays unavailable and can be retried',async()=>{
  const f=service({failFirstTile:true}),point={longitude:.5,latitude:.5};
  assert.equal((await f.lookup(point)).status,'unavailable');
  assert.equal((await f.lookup(point)).status,'found');
  assert.deepEqual(f.calls,['/manifest','/tile','/tile']);
});

test('invalid point input causes no data request',async()=>{
  const f=service();assert.equal((await f.lookup({longitude:null,latitude:0})).status,'unavailable');assert.deepEqual(f.calls,[]);
});

test('address index is lazy, stable, bounded, and returns coordinates plus qualified IDs',async()=>{
  const calls=[];
  const manifest={schema:'st-louis-parcels-v1',source:{name:'Synthetic source'},search:{url:'/search'}};
  const index={schema:'st-louis-parcel-addresses-v1',records:[['0001','P1','10 Fictional Way',.1,.2,'tile-a','st-louis-city:0001:P1:1'],['0002','P2','100 Fictional Way',.3,.4,'tile-b','st-louis-city:0002:P2:2'],['0003','P3','22 Imaginary Lane',.5,.6,'tile-c','st-louis-city:0003:P3:3']]};
  const search=createParcelSearch({manifestUrl:'/manifest',fetchImpl:async url=>{calls.push(url);return response(url==='/manifest'?manifest:index);}});
  assert.deepEqual(await search('fi'),[]);assert.deepEqual(calls,[]);
  const results=await search('FICTIONAL 10',{limit:1});
  assert.equal(results.length,1);assert.equal(results[0].parcelKey,'st-louis-city:0001');
  assert.equal(results[0].longitude,.1);assert.equal(results[0].latitude,.2);
  assert.equal((await search('imaginary'))[0].parcelId,'P3');
  assert.deepEqual(calls,['/manifest','/search']);
  await assert.rejects(()=>search('fictional',{limit:0}),/limit/);
});

test('shared HANDLE and ParcelId records remain distinct until exact record selection',async()=>{
  const features=normalize([raw(),raw({OBJECTID:2})]).features;
  assert.equal(features[0].properties.parcelKey,features[1].properties.parcelKey);
  assert.notEqual(features[0].properties.recordKey,features[1].properties.recordKey);
  const f=service({features}),point={longitude:.5,latitude:.5,parcelKey:features[0].properties.parcelKey};
  const result=await f.lookup(point);
  assert.equal(result.candidates.length,2);assert.equal(result.parcel,null);assert.equal(result.ambiguous,true);
  const chosen=await f.lookup({...point,recordKey:features[1].properties.recordKey});
  assert.equal(chosen.parcel.properties.sourceObjectId,2);
});

test('known invalid source topology is unavailable instead of silently repaired or spatially confirmed',async()=>{
  const features=normalize([raw()]).features;features[0].properties.geometryStatus='invalid-source';
  const result=await service({features}).lookup({longitude:.5,latitude:.5});
  assert.equal(result.status,'unavailable');assert.equal(result.reason,'invalid-source-geometry');assert.equal(result.parcel,null);
});
