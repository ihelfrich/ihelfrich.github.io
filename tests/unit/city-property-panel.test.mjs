import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPropertyPanel} from '../../src/scripts/city/city-property-panel.mjs';
const point={longitude:-90.193,latitude:38.628};
const parcel=(id='one',patch={})=>({type:'Feature',geometry:{type:'Polygon',coordinates:[[[-90.194,38.627],[-90.192,38.627],[-90.192,38.629],[-90.194,38.627]]]},properties:{parcelKey:'st-louis-city:h',parcelId:id,recordKey:'record:'+id,sourceObjectId:1,address:'10 Fixture Place',assessedValueUSD:0,assessmentYear:null,sourceRecordDate:null,...patch}});
const evidence=(p=point,selected=parcel())=>({point:{...p},parcels:{status:'found',parcel:selected,candidates:[selected],source:{url:'https://www.stlouis-mo.gov/data/',retrievedAt:'2026-09-08T12:00:00Z',catalogPublishedAt:'2026-08-27'}},zoning:{status:'matched',complete:false,jurisdiction:{label:'City of St. Louis'},districts:[{code:'A',label:'Single-Family Dwelling District'}],overlays:[],overlayStatus:'unavailable',effectiveDate:null,codeUrl:'https://example.org/zoning',sources:[{sourceId:'city-base',sourceUrl:'https://example.org/layer',retrievedAt:'2026-09-08T12:00:00Z',sourceDate:null}]},inventory:{status:'not-in-public-inventory',listings:[],reason:'No matching land-bank record; private sale status is unknown.'}});
const settle=()=>new Promise(resolve=>setTimeout(resolve,8));
const listing=(id='lra-one',patch={})=>({id,parcelKey:'st-louis-city:h',parcelId:id,address:'Fixture parcel '+id,...point,askingPrice:null,priceStatus:'not-published',status:'available',usage:'Vacant Lot',...patch});
const snapshot=listings=>({listings,source:{name:'Official LRA',url:'https://www.stlouis-mo.gov/data/',termsUrl:'https://example.org/terms'},retrievedAt:'2026-09-08T12:00:00Z',sourceUpdatedAt:null,snapshotStatus:'recent',counts:{listings:listings.length}});
function fixture(t,options={}) {
 const window=new Window(),prior=globalThis.document;globalThis.document=window.document;
 const root=document.createElement('section'),original=document.createElement('p');original.id='existing-estate';root.append(original);document.body.append(root);
 const selected=[],applied=[],outlines=[],markers=[],notices=[];let panel;
 const city={controls:{target:{x:0,z:0}},setParcel(p){outlines.push(p)},setListings(){throw new Error('Public panel must not replace imported markers')},flyTo(){}};
 const estate={selectPoint(p){selected.push(p);panel?.clearSelection()},setPropertyEvidence(e){applied.push(e);return true}};
 panel=createPropertyPanel(root,{estate,getCity:()=>city,notice:m=>notices.push(m),onPublicMarkers:(records,select)=>markers.push({records,select}),lookup:async p=>evidence(p),search:async()=>[],inventoryLoader:async()=>snapshot([]),debounceMs:0,...options});
 t.after(async()=>{panel.clearSelection();await window.happyDOM.abort();globalThis.document=prior});
 const $=id=>root.querySelector('#property-'+id),type=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event('input',{bubbles:true}))};
 return {root,original,panel,$,type,window,city,selected,applied,outlines,markers,notices};
}

test('prepends native controls while preserving the estate panel and the three-character search threshold',async t=>{
 let searches=0;const f=fixture(t,{search:async()=>{searches++;return []}});
 assert.equal(f.root.querySelector('#existing-estate'),f.original);assert.ok(f.root.querySelector('details'));assert.ok(f.$('search'));
 f.type('search','ab');await settle();assert.equal(searches,0);assert.match(f.$('search-status').textContent,/3 characters/i);
});
test('debounced search ignores old successes and old errors after the query changes',async t=>{
 const pending=new Map();const f=fixture(t,{search:q=>new Promise((resolve,reject)=>pending.set(q,{resolve,reject}))});
 f.type('search','old');await settle();f.type('search','new');await settle();
 pending.get('new').resolve([{...point,recordKey:'record:new',parcelKey:'st-louis-city:h',parcelId:'new',address:'New Result'}]);await settle();
 pending.get('old').reject(new Error('stale error'));await settle();
 assert.match(f.$('search-results').textContent,/New Result/);assert.doesNotMatch(f.$('search-status').textContent,/unavailable/i);
});
test('inspection resets estate first, then guards its new lookup from older results and applies the parcel',async t=>{
 const pending=[];const f=fixture(t,{lookup:(p,{signal})=>new Promise(resolve=>pending.push({p,signal,resolve}))});
 const a=f.panel.inspectPoint(point);assert.equal(f.selected.length,1);assert.equal(pending.length,1);
 const other={longitude:-90.2,latitude:38.64},b=f.panel.inspectPoint(other);
 assert.equal(pending[0].signal.aborted,true);
 pending[0].resolve(evidence(point));await a;assert.equal(f.applied.length,0);
 pending[1].resolve(evidence(other));await b;assert.equal(f.applied.length,1);assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');
 const before=f.outlines.length;f.panel.refreshMarkers();assert.equal(f.outlines.length,before+1);assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');
});
test('ambiguous candidates require an exact source record choice and show unknown assessment year',async t=>{
 const a=parcel('one'),b=parcel('two');const calls=[];
 const f=fixture(t,{lookup:async p=>{calls.push(p);return p.recordKey?evidence(p,p.recordKey===b.properties.recordKey?b:a):{...evidence(p),parcels:{...evidence(p).parcels,parcel:null,candidates:[a,b],ambiguous:true}}}});
 await f.panel.inspectPoint(point);assert.equal(f.outlines.at(-1),null);
 const choices=f.$('evidence').querySelectorAll('button[data-record-key]');assert.equal(choices.length,2);choices[1].click();await settle();
 assert.equal(calls.at(-1).recordKey,'record:two');assert.equal(f.applied.at(-1).parcels.parcel.properties.parcelId,'two');
 assert.match(f.$('evidence').textContent,/Assessment year[\s\S]*Unknown/);assert.match(f.$('evidence').textContent,/\$0/);assert.match(f.$('evidence').textContent,/Overlay coverage[\s\S]*unavailable/i);
});
test('public centroid cannot silently select a neighboring parcel',async t=>{
 const f=fixture(t,{lookup:async p=>evidence(p,parcel('different',{parcelKey:'st-louis-city:other'}))});
 await f.panel.inspectPoint({...point,parcelKey:'st-louis-city:intended',parcelId:'intended'});
 assert.equal(f.applied.at(-1).parcels.parcel,null);assert.equal(f.outlines.at(-1),null);assert.match(f.$('evidence').textContent,/centroid|source parcel/i);
});
test('unsupported parcel/zoning coverage is explicit and source strings remain literal',async t=>{
 const f=fixture(t,{lookup:async p=>({point:p,parcels:{status:'unsupported',parcel:null,reason:'outside-city'},zoning:{status:'unsupported-municipality',jurisdiction:{label:'<img src=x onerror=alert(1)>'},districts:[],overlays:[],complete:false},inventory:{status:'unresolved',listings:[]}})});
 await f.panel.inspectPoint(point);assert.equal(f.$('evidence').querySelector('img'),null);assert.match(f.$('evidence').textContent,/unavailable|not connected/i);assert.match(f.$('evidence').textContent,/private sale status.*unknown/i);
});
test('public inventory uses the separate callback, caps markers and states matching versus mapped counts',async t=>{
 const rows=Array.from({length:300},(_,i)=>listing(String(i)));rows.push(listing('far',{longitude:-91}));
 const f=fixture(t,{inventoryLoader:async()=>snapshot(rows)});f.$('public-map').click();await settle();
 assert.equal(f.markers.at(-1).records.length,250);assert.match(f.$('public-counts').textContent,/300 matching/);assert.match(f.$('public-counts').textContent,/250.*map/i);assert.match(f.$('public-counts').textContent,/300.*unknown/i);
 f.$('public-radius').value='0';f.$('public-radius').dispatchEvent(new f.window.Event('change',{bubbles:true}));assert.match(f.$('public-counts').textContent,/301 matching/);
 f.markers.at(-1).select(rows[0]);await settle();assert.equal(f.selected.at(-1).parcelKey,rows[0].parcelKey);assert.equal(f.selected.at(-1).parcelId,rows[0].parcelId);
 f.$('public-clear').click();assert.equal(f.markers.at(-1).records.length,0);f.panel.refreshMarkers();assert.equal(f.markers.at(-1).records.length,0);
});
test('clearing an in-flight public overlay request prevents late marker re-enabling',async t=>{
 let resolve;const f=fixture(t,{inventoryLoader:()=>new Promise(r=>{resolve=r})});f.$('public-map').click();f.$('public-clear').click();resolve(snapshot([listing()]));await settle();
 assert.equal(f.markers.at(-1).records.length,0);assert.equal(f.$('public-map').disabled,false);assert.doesNotMatch(f.$('public-status').textContent,/loading/i);
});
test('clearSelection cancels outstanding evidence without clearing imported or public marker channels',async t=>{
 let resolve;const f=fixture(t,{lookup:p=>new Promise(r=>{resolve=r})});const waiting=f.panel.inspectPoint(point);const count=f.markers.length;f.panel.clearSelection();resolve(evidence(point));await waiting;
 assert.equal(f.applied.length,0);assert.equal(f.outlines.at(-1),null);assert.equal(f.markers.length,count);
});
