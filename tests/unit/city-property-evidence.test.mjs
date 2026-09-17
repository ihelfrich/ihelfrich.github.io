import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createPropertyLookup,matchPublicInventory} from '../../src/lib/city-property-context.mjs';
import {parcelOutlineRings} from '../../src/lib/city-parcel-overlay.mjs';
import {createParcelLookup} from '../../src/lib/city-parcels.mjs';

const ring=(x=0,y=0)=>[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]];
const feature={type:'Feature',geometry:{type:'MultiPolygon',coordinates:[[ring(),ring(.2,.2)],[ring(2,2)]]},properties:{parcelKey:'st-louis-city:SYNTHETIC',parcelId:'A',recordKey:'synthetic-record'}};
const found={status:'found',parcel:feature,candidates:[feature],source:{name:'Synthetic parcel source'}};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

test('public inventory join requires both source identifiers and an exact selected record',()=>{
  const snapshot={source:{name:'Synthetic inventory'},retrievedAt:'2026-09-08T00:00:00Z',snapshotStatus:'recent',listings:[
    {id:'right',parcelKey:'st-louis-city:SYNTHETIC',parcelId:'A'},
    {id:'same-handle-wrong-account',parcelKey:'st-louis-city:SYNTHETIC',parcelId:'B'},
    {id:'same-account-wrong-jurisdiction',parcelKey:'st-louis-county:SYNTHETIC',parcelId:'A'},
  ]};
  assert.deepEqual(matchPublicInventory(found,snapshot).listings.map(l=>l.id),['right']);
  assert.equal(matchPublicInventory({...found,parcel:null},snapshot).status,'unresolved');
  assert.equal(matchPublicInventory(found,null).status,'unavailable');
  assert.equal(matchPublicInventory(found,{...snapshot,listings:[]}).status,'not-in-public-inventory');
});

test('failed inventory or zoning requests preserve independently verified parcel evidence',async()=>{
  const lookup=createPropertyLookup({parcelLookup:async()=>found,inventoryLoader:async()=>{throw Error('Synthetic inventory failure');},zoningLookup:async()=>{throw Error('Synthetic zoning failure');}});
  const result=await lookup({longitude:0,latitude:0});
  assert.equal(result.parcels,found);assert.equal(result.inventory.status,'unavailable');assert.equal(result.zoning.status,'unavailable');
});

test('successful inventory loads are shared while failures can be retried',async()=>{
  let calls=0;
  const lookup=createPropertyLookup({parcelLookup:async()=>found,zoningLookup:async()=>({status:'found'}),inventoryLoader:async()=>{calls++;if(calls===1)throw Error('Synthetic retry');return{listings:[],source:{}};}});
  await lookup({longitude:0,latitude:0});await lookup({longitude:0,latitude:0});await lookup({longitude:0,latitude:0});assert.equal(calls,2);
});

test('aborted property requests cannot proceed to zoning or return stale evidence',async()=>{
  const pending=deferred();let zoningCalls=0;
  const controller=new AbortController();
  const lookup=createPropertyLookup({parcelLookup:()=>pending.promise,inventoryLoader:async()=>({listings:[]}),zoningLookup:async()=>{zoningCalls++;return{};}});
  const result=lookup({longitude:0,latitude:0},{signal:controller.signal});
  controller.abort();pending.resolve(found);
  await assert.rejects(result,error=>error.name==='AbortError');assert.equal(zoningCalls,0);
  await assert.rejects(()=>lookup({longitude:0,latitude:0},{signal:controller.signal}),error=>error.name==='AbortError');
});

test('multipart parcel outlines preserve all rings separately without altering source positions',()=>{
  const before=structuredClone(feature),rings=parcelOutlineRings(feature);
  assert.equal(rings.length,3);assert.deepEqual(rings,[feature.geometry.coordinates[0][0],feature.geometry.coordinates[0][1],feature.geometry.coordinates[1][0]]);
  assert.deepEqual(feature,before);assert.deepEqual(parcelOutlineRings(null),[]);
});

test('Three parcel replacement disposes previous resources and rejects allocations after disposal',()=>{
  // Exercise the actual nested setter with real Three geometry/material objects,
  // avoiding an unrelated WebGL/browser setup for this lifecycle contract.
  const source=fs.readFileSync(new URL('../../src/scripts/city/city-scene.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  function setParcel(feature)');
  const end=source.indexOf('\n  const listingsLayer',start);
  assert.ok(start>=0&&end>start);
  const makeSetter=new Function('T','parcelOutline','data','parcelOutlineRings','disposed',`${source.slice(start,end)};return setParcel;`);
  const group=new T.Group(),data={origin:[0,0]};
  const set=makeSetter(T,group,data,parcelOutlineRings,false);
  set(feature);assert.equal(group.children.length,3);
  let geometryDisposals=0,materialDisposals=0;
  for(const line of group.children){line.geometry.addEventListener('dispose',()=>geometryDisposals++);line.material.addEventListener('dispose',()=>materialDisposals++);}
  set(null);assert.equal(group.children.length,0);assert.equal(geometryDisposals,3);assert.equal(materialDisposals,3);
  set(feature);const afterDisposal=makeSetter(T,group,data,parcelOutlineRings,true);
  afterDisposal(null);assert.equal(group.children.length,0);
  afterDisposal(feature);assert.equal(group.children.length,0);
});

test('actual shared-HANDLE geometry joins only explicitly synthetic inventory membership',async()=>{
  const publicRoot=new URL('../../public/',import.meta.url);
  const read=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL(String(url).replace(/^\//,''),publicRoot),'utf8'))});
  const index=JSON.parse(fs.readFileSync(new URL('st-louis/parcels/search.json',publicRoot),'utf8'));
  const rows=index.records.filter(row=>row[2]==='4821 NATURAL BRIDGE AV');
  assert.ok(rows.length>1,'The parcel snapshot preserves distinct source records at this address');
  assert.equal(new Set(rows.map(row=>row[0])).size,1);
  assert.ok(new Set(rows.map(row=>row[1])).size>1);
  // Membership below is invented solely to exercise the identity join. It does
  // not load current inventory or assert that any real account is available.
  const listedParcelId=rows[0][1],parcelKey=`st-louis-city:${rows[0][0]}`;
  const inventory={source:{name:'Synthetic join-only fixture',synthetic:true},listings:[
    {id:'synthetic-matching-account',parcelKey,parcelId:listedParcelId},
    {id:'synthetic-wrong-jurisdiction',parcelKey:`st-louis-county:${rows[0][0]}`,parcelId:listedParcelId},
  ]};
  const lookup=createParcelLookup({fetchImpl:read});
  let matched=0,unmatched=0;
  for(const row of rows){
    const parcel=await lookup({longitude:row[3],latitude:row[4],recordKey:row[6]});assert.equal(parcel.status,'found');
    const result=matchPublicInventory(parcel,inventory);
    if(row[1]===listedParcelId){matched++;assert.equal(result.status,'matched');assert.deepEqual(result.listings.map(l=>l.id),['synthetic-matching-account']);}
    else{unmatched++;assert.equal(result.status,'not-in-public-inventory');assert.deepEqual(result.listings,[]);}
  }
  assert.ok(matched>0);assert.ok(unmatched>0);assert.equal(matched+unmatched,rows.length);
});
