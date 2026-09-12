import test from 'node:test';
import assert from 'node:assert/strict';
import {createCountyLookup,CURRENT_COUNTY_MANIFEST,COUNTY_MANIFEST} from '../../src/lib/county-parcels.mjs';
const geometry={type:'Polygon',coordinates:[[[-90.4,38.6],[-90.3,38.6],[-90.3,38.7],[-90.4,38.7],[-90.4,38.6]]]};
const id='16L640291',key=`st-louis-county-current:${id}:11`,point={longitude:-90.35,latitude:38.65,parcelId:id,parcelKey:`st-louis-county:${id}`,recordKey:key,sourceObjectId:11};
const source={id:'fixture-current',url:'https://maps.stlouisco.com/fixture',retrievedAt:'2026-09-10T12:00:00Z'};
const localFeature=(historical=false)=>({type:'Feature',geometry,bbox:[-90.4,38.6,-90.3,38.7],properties:{parcelId:id,parcelKey:`st-louis-county:${id}`,recordKey:historical?`st-louis-county:${id}:11`:key,sourceObjectId:11,jurisdiction:'st-louis-county',assessedValueUSD:111,assessmentYear:null}});
const liveFeature=(oid=11)=>({type:'Feature',geometry,properties:{LOCATOR:id,OBJECTID:oid,TOTASSMT:222,TOTAPVAL:1168,TAXYR:2026,PROP_ADD:'Synthetic fixture'}});
const jsonResponse=body=>({ok:true,json:async()=>body,text:async()=>JSON.stringify(body)});
function fixtures(liveResponse={ok:false},override){
 const calls=[];const fetchImpl=async(url,options)=>{calls.push(url);if(override){const result=override(url,options);if(result)return result;}
  if(url.startsWith('https:'))return typeof liveResponse==='function'?liveResponse(url,options):liveResponse;
  const historical=url===COUNTY_MANIFEST||url==='/old-tile.json';
  if(url===CURRENT_COUNTY_MANIFEST||url===COUNTY_MANIFEST)return jsonResponse({schema:'st-louis-parcels-v1',coverageGeometry:geometry,source,tiles:[{url:historical?'/old-tile.json':'/tile.json',bounds:[-90.4,38.6,-90.3,38.7]}]});
  return jsonResponse({type:'FeatureCollection',features:[localFeature(historical)]});};
 return {calls,lookup:createCountyLookup({fetchImpl,snapshotTimeoutMs:35,liveTimeoutMs:35})};
}
test('current County inspections prefer current official evidence without loading the dated local snapshot',async()=>{
 const f=fixtures(jsonResponse({type:'FeatureCollection',features:[liveFeature()]}));const result=await f.lookup(point);assert.equal(result.parcel.properties.assessedValueUSD,222);assert.equal(result.parcel.properties.recordKey,key);assert.equal(f.calls.length,1);assert.match(f.calls[0],/^https:/);assert.equal(result.snapshotFallback,undefined);
});
test('a live outage falls back to the exact dated local source and exposes fallback status',async()=>{
 const f=fixtures();const result=await f.lookup(point);assert.equal(result.parcel.properties.assessedValueUSD,111);assert.equal(result.source.retrievedAt,source.retrievedAt);assert.equal(result.snapshotFallback,true);assert.equal(result.liveStatus,'unavailable');assert.match(f.calls[0],/^https:/);assert.equal(f.calls[1],CURRENT_COUNTY_MANIFEST);
});
test('fallback rejects every mismatching requested identity, even without a recordKey',async()=>{
 for(const patch of [{recordKey:undefined,parcelId:'16L640299'},{recordKey:undefined,parcelKey:'st-louis-county:16L640299'},{recordKey:undefined,sourceObjectId:12},{recordKey:`st-louis-county-current:${id}:12`}]){const f=fixtures();const result=await f.lookup({...point,...patch});assert.equal(result.parcel,null);assert.equal(result.reason,'requested-source-unresolved');assert.deepEqual(result.candidates,[]);}
});
test('historical source identities remain pinned to the historical snapshot, with no live request',async()=>{
 const f=fixtures(jsonResponse({type:'FeatureCollection',features:[liveFeature()]}));const result=await f.lookup({...point,recordKey:`st-louis-county:${id}:11`});assert.equal(result.parcel.properties.recordKey,`st-louis-county:${id}:11`);assert.equal(result.parcel.properties.assessedValueUSD,111);assert.equal(f.calls[0],COUNTY_MANIFEST);assert.ok(f.calls.every(url=>!url.startsWith('https:')));
});
test('responding live missing and ambiguous results cannot be replaced by an older unique parcel',async()=>{
 for(const features of [[],[liveFeature(),liveFeature(12)]]){const f=fixtures(jsonResponse({type:'FeatureCollection',features}));const result=await f.lookup({longitude:point.longitude,latitude:point.latitude,parcelId:id});assert.equal(result.parcel,null);assert.equal(f.calls.length,1);if(features.length)assert.equal(result.ambiguous,true);else assert.equal(result.reason,'requested-source-unresolved');}
});
test('caller abort ends a stalled local wait even when a shared snapshot fetch ignores its signal',async()=>{
 let entered;const pending=new Promise(resolve=>{entered=resolve;});
 const f=fixtures({ok:false},url=>{if(url===CURRENT_COUNTY_MANIFEST){entered();return new Promise(()=>{});}});const controller=new AbortController();const result=f.lookup(point,{signal:controller.signal});await pending;controller.abort();await assert.rejects(result,{name:'AbortError'});
});
test('snapshot fetch and response-body stalls meet their deadlines and cannot hide live failure forever',async()=>{
 for(const stall of ['fetch','body']){const f=fixtures({ok:false},url=>url===CURRENT_COUNTY_MANIFEST?(stall==='fetch'?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>new Promise(()=>{})})):null);const result=await f.lookup(point);assert.equal(result.status,'unavailable');assert.equal(result.snapshotFallback,true);assert.equal(result.reason,'snapshot-unavailable');}
});
test('an uncooperative live fetch or body meets its deadline and reaches the local fallback',async()=>{
 for(const stall of ['fetch','body']){const f=fixtures(stall==='fetch'?()=>new Promise(()=>{}):{ok:true,text:()=>new Promise(()=>{})});const result=await f.lookup(point);assert.equal(result.snapshotFallback,true);assert.equal(result.parcel.properties.recordKey,key);}
});

test('local study-area absence cannot become a whole-County absence claim during a live outage',async()=>{
 const outside=fixtures();const unsupported=await outside.lookup({longitude:-90.55,latitude:38.65});
 assert.equal(unsupported.status,'unavailable');assert.equal(unsupported.parcel,null);assert.equal(unsupported.reason,'county-service-unavailable');assert.equal(unsupported.snapshotStatus,'unsupported');assert.equal(unsupported.snapshotReason,'outside-city');assert.equal(unsupported.snapshotSource.retrievedAt,source.retrievedAt);
 const absent=fixtures({ok:false},url=>url==='/tile.json'?Promise.resolve(jsonResponse({type:'FeatureCollection',features:[]})):null);
 const missing=await absent.lookup(point);assert.equal(missing.status,'unavailable');assert.equal(missing.parcel,null);assert.equal(missing.reason,'county-service-unavailable');assert.equal(missing.snapshotStatus,'not-found');assert.equal(missing.snapshotReason,'no-covered-parcel');assert.deepEqual(missing.candidates,[]);
});
