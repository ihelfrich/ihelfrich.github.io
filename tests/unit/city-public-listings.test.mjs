import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicListingsQuery, normalizePublicListing, createPublicListingsSnapshot, loadPublicListings} from '../../src/lib/city-public-listings.mjs';
const retrievedAt='2026-09-09T04:00:00Z';
const ring=[[-90.22,38.65],[-90.219,38.65],[-90.219,38.651],[-90.22,38.651],[-90.22,38.65]];
const feature=(attributes={},geometry={rings:[ring]})=>({attributes:{OBJECTID:1,Handle:'001234',ParcelId:'987000',Address:' 2414   BACON ST ',LRA:'YES',Case_Status:'Available',Status:'Available',Usage:'Vacant Lot',PropertyType:'Lot',...attributes},geometry});
const options={retrievedAt,spatialReference:{wkid:4326}};

test('only explicit LRA available status qualifies as public purchase inventory',()=>{
  assert.ok(normalizePublicListing(feature(),options));
  for(const status of [null,'','CDA Option','Lease','Greenspace Hold','SOLD','Unknown','PROPNS'])assert.equal(normalizePublicListing(feature({Case_Status:status}),options),null);
  assert.equal(normalizePublicListing(feature({Status:'SOLD'}),options),null);
  assert.equal(normalizePublicListing(feature({LRA:'NO'}),options),null);
});
test('preserves distinct parcel handle and display ID while asking price remains unknown',()=>{
  const item=normalizePublicListing(feature({LRA_PRICING:2500,AssessorsTotal:75000,SALEPRICE:5000,Value:6000,ACQUISITION_DATE:1000}),options);
  assert.equal(item.parcelKey,'st-louis-city:001234');assert.equal(item.parcelId,'987000');assert.equal(item.handle,'001234');assert.equal(item.address,'2414 BACON ST');
  assert.equal(item.askingPrice,null);assert.equal(item.priceStatus,'not-published');assert.equal(item.sourceUpdatedAt,null);assert.equal(item.retrievedAt,retrievedAt);
  assert.ok(item.sourceUrl.endsWith('parcelId=987000'));
});
test('source polygon centroid is accurate with holes, ring orientation and translated coordinates',()=>{
  const outer=[[-90,38],[-89.998,38],[-89.998,38.002],[-90,38.002],[-90,38]];
  const hole=[[-89.9995,38.0005],[-89.999,38.0005],[-89.999,38.001],[-89.9995,38.001],[-89.9995,38.0005]];
  const item=normalizePublicListing(feature({}, {rings:[outer,hole]}),options);
  const expectedX=(-89.999*4-(-89.99925)*.25)/3.75;
  const expectedY=(38.001*4-38.00075*.25)/3.75;
  assert.ok(Math.abs(item.longitude-expectedX)<1e-10);assert.ok(Math.abs(item.latitude-expectedY)<1e-10);
  const reversed=normalizePublicListing(feature({}, {rings:[[...hole].reverse(),[...outer].reverse()]}),options);
  assert.ok(Math.abs(reversed.longitude-item.longitude)<1e-10);assert.ok(Math.abs(reversed.latitude-item.latitude)<1e-10);
});
test('unknown coordinates and spatial references never become invented map locations',()=>{
  const missing=normalizePublicListing(feature({},null),options);assert.equal(missing.longitude,null);assert.equal(missing.latitude,null);
  const unprojected=normalizePublicListing(feature(),{retrievedAt,spatialReference:{wkid:3857}});assert.equal(unprojected.longitude,null);
  const invalid=normalizePublicListing(feature({},{rings:[[[null,38],[-90,38],[-90,39]]]}),options);assert.equal(invalid.latitude,null);
});
test('query encodes a fixed availability filter, bounded object IDs and WGS84 geometry',()=>{
  const query=new URL(buildPublicListingsQuery({objectIds:[3,9]}));
  assert.equal(query.searchParams.get('where'),"LRA='YES' AND Case_Status='Available' AND Status='Available'");assert.equal(query.searchParams.get('outSR'),'4326');assert.equal(query.searchParams.get('objectIds'),'3,9');
  assert.throws(()=>buildPublicListingsQuery({objectIds:['1 OR 1=1']}));
  assert.throws(()=>buildPublicListingsQuery({objectIds:Array.from({length:501},(_,i)=>i+1)}));
});
test('snapshot reports availability coverage separately from prices and rejects duplicate identities',()=>{
  const snapshot=createPublicListingsSnapshot({features:[feature(),feature({Handle:'2',ParcelId:'2',Case_Status:'Lease'})],spatialReference:{wkid:4326}},{retrievedAt});
  assert.equal(snapshot.listings.length,1);assert.equal(snapshot.counts.excluded,1);assert.equal(snapshot.counts.unknownAskingPrices,1);assert.equal(snapshot.sourceUpdatedAt,null);
  assert.throws(()=>createPublicListingsSnapshot({features:[feature(),feature()],spatialReference:{wkid:4326}},{retrievedAt}),/duplicate/i);
  assert.throws(()=>createPublicListingsSnapshot({features:[feature()],exceededTransferLimit:true},{retrievedAt}),/incomplete/i);
});
test('loader returns provenance and labels an aged retrieval snapshot without asserting record update time',async()=>{
  const snapshot=createPublicListingsSnapshot({features:[feature()],spatialReference:{wkid:4326}},{retrievedAt});
  const result=await loadPublicListings({fetchImpl:async()=>({ok:true,json:async()=>snapshot}),now:Date.parse(retrievedAt)+72*3600000});
  assert.equal(result.listings.length,1);assert.equal(result.snapshotStatus,'stale');assert.equal(result.sourceUpdatedAt,null);assert.ok(result.source.termsUrl.includes('terms.cfm'));
});
test('distinct official parcel IDs sharing one handle remain distinct inventory records with an explicit join warning',()=>{
  const result=createPublicListingsSnapshot({features:[feature(),feature({OBJECTID:2,ParcelId:'987001'})],spatialReference:{wkid:4326}},{retrievedAt});
  assert.equal(result.listings.length,2);assert.notEqual(result.listings[0].id,result.listings[1].id);
  assert.equal(result.counts.uniqueParcelKeys,1);assert.equal(result.counts.sharedParcelKeys,1);
  assert.ok(result.listings.every(l=>l.parcelJoinStatus==='shared-handle'));
});
test('loader propagates cancellation and rejects malformed or failed responses',async()=>{
  const controller=new AbortController();controller.abort();let fetched=false;
  await assert.rejects(loadPublicListings({signal:controller.signal,fetchImpl:async()=>{fetched=true}}));assert.equal(fetched,false);
  await assert.rejects(loadPublicListings({fetchImpl:async()=>({ok:false,status:503})}),/unavailable/i);
  await assert.rejects(loadPublicListings({fetchImpl:async()=>({ok:true,json:async()=>({listings:[]})})}),/invalid/i);
});
