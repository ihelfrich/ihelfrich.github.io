import {test} from 'node:test';import assert from 'node:assert/strict';
import {countyLiveParcelQuery,normalizeLiveCountyParcels,createCountyLiveLookup} from '../../src/lib/county-live-parcels.mjs';
const geometry={type:'Polygon',coordinates:[[[-90.4,38.6],[-90.3,38.6],[-90.3,38.7],[-90.4,38.7],[-90.4,38.6]]]};
const feature=(id='16L640291',oid=11)=>({type:'Feature',geometry,properties:{LOCATOR:id,OBJECTID:oid,TOTASSMT:18710,TOTAPVAL:98500,TAXYR:2026,PROP_ADD:'9419 PAGE AVE'}});
const point={longitude:-90.35,latitude:38.65};
test('whole County queries preserve exact source object identity and never simplify inspection geometry',()=>{
 const url=new URL(countyLiveParcelQuery({...point,recordKey:'st-louis-county-current:16L640291:11'}));assert.equal(url.searchParams.get('objectIds'),'11');assert.equal(url.searchParams.get('returnGeometry'),'true');assert.equal(url.searchParams.has('maxAllowableOffset'),false);assert.equal(url.searchParams.get('resultRecordCount'),'64');
});
test('duplicate locators need exact OID selection; no arbitrary condo record chosen',()=>{
 const payload={type:'FeatureCollection',features:[feature(),feature('16L640291',12)]};const result=normalizeLiveCountyParcels(payload,{...point,parcelId:'16L640291'});assert.equal(result.ambiguous,true);assert.equal(result.parcel,null);
 const exact=normalizeLiveCountyParcels(payload,{...point,recordKey:'st-louis-county-current:16L640291:12'});assert.equal(exact.parcel.properties.sourceObjectId,12);assert.equal(exact.parcel.properties.taxYear,2026);assert.equal(exact.parcel.properties.assessmentYear,null);
});
test('exact representative point can be outside polygon, but mismatched source IDs cannot join',()=>{
 const payload={type:'FeatureCollection',features:[feature()]};const exact=normalizeLiveCountyParcels(payload,{longitude:-90.5,latitude:38.7,recordKey:'st-louis-county-current:16L640291:11'});assert.equal(exact.status,'found');
 const bad=normalizeLiveCountyParcels(payload,{...point,recordKey:'st-louis-county-current:16L640291:12'});assert.equal(bad.parcel,null);assert.equal(bad.reason,'requested-source-unresolved');
});
test('missing locator remains unknown, not a fabricated tax join',()=>{const r=normalizeLiveCountyParcels({type:'FeatureCollection',features:[feature(null,17)]},{...point,recordKey:'st-louis-county-current:objectid:17'});assert.equal(r.parcel.properties.parcelKey,null);assert.equal(r.parcel.properties.parcelId,null);});
test('source transfer limits and service failures cannot look like an empty parcel dataset',async()=>{
 assert.throws(()=>normalizeLiveCountyParcels({type:'FeatureCollection',features:[],exceededTransferLimit:true},point),/incomplete/);
 const result=await createCountyLiveLookup({fetchImpl:async()=>({ok:false})})(point);assert.equal(result.status,'unavailable');
});
