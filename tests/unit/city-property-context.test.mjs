import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPublicInventory,createPropertyLookup} from '../../src/lib/city-property-context.mjs';
const parcel={status:'found',parcel:{properties:{parcelKey:'st-louis-city:100',parcelId:'A'}}};
const snapshot={listings:[{id:'one',parcelKey:'st-louis-city:100',parcelId:'A',askingPrice:null},{id:'two',parcelKey:'st-louis-city:100',parcelId:'B',askingPrice:null}],retrievedAt:'2026-09-08T00:00:00Z',snapshotStatus:'recent'};
test('inventory join requires both handle and source parcel identifier',()=>{
 const r=matchPublicInventory(parcel,snapshot);assert.equal(r.status,'matched');assert.deepEqual(r.listings.map(l=>l.id),['one']);assert.equal(r.listings[0].askingPrice,null);
});
test('overlapping accounts remain unresolved; absent public record is not a private-market status',()=>{
 assert.equal(matchPublicInventory({parcel:null,ambiguous:true,candidates:[parcel]},snapshot).status,'unresolved');
 const r=matchPublicInventory({parcel:{properties:{parcelKey:'st-louis-city:101',parcelId:'A'}}},snapshot);assert.equal(r.status,'not-in-public-inventory');assert.match(r.reason,/Private sale status is unknown/);
});
test('failed inventory is distinguishable from no match and can retry',async()=>{
 let calls=0;const lookup=createPropertyLookup({parcelLookup:async()=>parcel,inventoryLoader:async()=>{if(++calls===1)throw Error();return snapshot;},zoningLookup:async(p,{parcelResult})=>({status:parcelResult.parcel?'matched':'unavailable'})});
 const a=await lookup({longitude:-90.2,latitude:38.6});assert.equal(a.inventory.status,'unavailable');assert.equal(a.zoning.status,'matched');
 const b=await lookup({longitude:-90.2,latitude:38.6});assert.equal(b.inventory.status,'matched');assert.equal(calls,2);
});
test('aborted property request cannot publish stale evidence',async()=>{
 const c=new AbortController();const lookup=createPropertyLookup({parcelLookup:async()=>{c.abort();return parcel;},inventoryLoader:async()=>snapshot});
 await assert.rejects(lookup({longitude:-90.2,latitude:38.6},{signal:c.signal}),{name:'AbortError'});
});
