import test from 'node:test';
import assert from 'node:assert/strict';
import {createPropertyViewUrl,readPropertyViewHash} from '../../src/lib/property-view-link.mjs';
import {PROPERTY_LENSES} from '../../src/lib/property-workspace-data.mjs';

const base='https://ihelfrich.github.io/other/?notes=do-not-share#district=overview';
const state=patch=>({version:1,lens:'ownership',bounds:[-90.38,38.68,-90.34,38.71],layers:['ownership-signals','ownership-history'],query:'VineBrook',fromDate:'2026-09-01',toDate:'2026-09-13',material:'all',level:'properties',...patch});
const rawHash=input=>'#evidence='+encodeURIComponent(JSON.stringify(input));
const roundtrip=input=>readPropertyViewHash(new URL(createPropertyViewUrl(input,base)).hash);

test('share links preserve fixed geography and absolute criteria, in the fragment only',()=>{
  const input=state(),url=new URL(createPropertyViewUrl(input,base));
  assert.equal(url.origin,'https://ihelfrich.github.io');assert.equal(url.pathname,'/st-louis/');
  assert.equal(url.search,'?area=region&workspace=activity');assert.ok(url.hash.startsWith('#evidence='));
  assert.deepEqual(readPropertyViewHash(url.hash),{ok:true,state:input});
  assert.equal(url.search.includes('VineBrook'),false);assert.equal(url.href.includes('do-not-share'),false);
});

test('every supported lens, empty source choice and material classification roundtrips',()=>{
  for(const [lens,def] of Object.entries(PROPERTY_LENSES))for(const layers of [[],def.layers]){
    const input=state({lens,layers,fromDate:null,toDate:null,level:'areas'});assert.deepEqual(roundtrip(input),{ok:true,state:input});
  }
  for(const material of ['all','lead','non-lead','unknown','galvanized-replacement']){
    const input=state({lens:'utilities',layers:['water-materials'],fromDate:null,toDate:null,material});assert.deepEqual(roundtrip(input),{ok:true,state:input});
  }
});

test('links whitelist fields without serializing notes, records, getters or custom toJSON',()=>{
  const extra=state({notes:'PRIVATE_NOTE',records:[{ownerName:'DO_NOT_SHARE'}],sourceDate:'1900-01-01',toJSON(){throw Error('Must not run');}});
  Object.defineProperty(extra,'privateGetter',{enumerable:true,get(){throw Error('Must not run');}});
  extra.circular=extra;
  const url=createPropertyViewUrl(extra,base);assert.doesNotMatch(decodeURIComponent(url),/PRIVATE_NOTE|DO_NOT_SHARE|1900-01-01|toJSON|circular|privateGetter/);
  assert.deepEqual(readPropertyViewHash(new URL(url).hash).state,state());
  const decoded=readPropertyViewHash(rawHash({...state(),notes:'PRIVATE_NOTE',records:[],__proto__:{polluted:true}}));
  assert.deepEqual(decoded.state,state());assert.equal({}.polluted,undefined);
});

test('unrelated and legacy fragments are ignored, malformed owned fragments are errors',()=>{
  for(const hash of ['',null,undefined,42,'#district=overland','#v=1&a=x','#evidence','#evidence-other={}'])assert.equal(readPropertyViewHash(hash),null);
  for(const hash of ['#evidence=','#evidence=%','#evidence=%ZZ','#evidence=%C0%AF','#evidence={','#evidence=null','#evidence=[]','#evidence=true','#evidence='+encodeURIComponent(encodeURIComponent('{}'))]){
    const r=readPropertyViewHash(hash);assert.equal(r.ok,false,hash);assert.equal(typeof r.error,'string');assert.equal(r.state,undefined);
  }
});

test('invalid versions, fields, inherited lens names, foreign layers and duplicates are rejected',()=>{
  for(const patch of [{version:2},{version:'1'},{lens:'toString'},{lens:'__proto__'},{lens:'unavailable'},{layers:['water-materials']},{layers:['ownership-signals','ownership-signals']},{layers:['__proto__']},{layers:[null]},{layers:'ownership-signals'},{query:null},{query:12},{query:'x'.repeat(161)},{level:'neighborhood'},{material:'lead'},{material:'unknown-status'}]){
    const input=state(patch);assert.throws(()=>createPropertyViewUrl(input,base),RangeError,JSON.stringify(patch));assert.equal(readPropertyViewHash(rawHash(input)).ok,false,JSON.stringify(patch));
  }
  const sparse=state({layers:new Array(1)});assert.throws(()=>createPropertyViewUrl(sparse,base),RangeError);
  for(const field of Object.keys(state())){const input=state();delete input[field];assert.equal(readPropertyViewHash(rawHash(input)).ok,false,field);}
  assert.throws(()=>createPropertyViewUrl(Object.create(state()),base),RangeError);
});

test('geographic bounds must be finite numbers, ordered and within the globe',()=>{
  for(const bounds of [[-90.3,38.5,-90.4,38.6],[-90.4,38.6,-90.3,38.6],[-181,38,-90,39],[-90,-91,-89,40],[-90,38,181,39],[-90,38,-89,91],[-90,38,-89],['-90',38,-89,39],[-90,38,NaN,39],[-90,38,Infinity,39],null]){
    assert.throws(()=>createPropertyViewUrl(state({bounds}),base),RangeError);assert.equal(readPropertyViewHash(rawHash(state({bounds}))).ok,false);
  }
  assert.equal(roundtrip(state({bounds:[-180,-90,180,90]})).ok,true);
});

test('calendar validation rejects rollover, reversed, relative and empty dates; leap days are exact',()=>{
  for(const patch of [{fromDate:'2026-02-29'},{toDate:'2026-02-30'},{fromDate:'2026-13-01'},{fromDate:'2026-09-14'},{fromDate:''},{fromDate:0},{fromDate:'30'},{fromDate:'2026-9-01'},{fromDate:'2026-09-01T00:00:00Z'},{fromDate:undefined}]){
    assert.throws(()=>createPropertyViewUrl(state(patch),base),RangeError);assert.equal(readPropertyViewHash(rawHash(state(patch))).ok,false);
  }
  for(const dates of [{fromDate:'2024-02-29',toDate:'2024-02-29'},{fromDate:null,toDate:'2026-09-13'},{fromDate:'2026-09-01',toDate:null},{fromDate:null,toDate:null}])assert.equal(roundtrip(state(dates)).ok,true);
  assert.equal(readPropertyViewHash(rawHash(state({lens:'utilities',layers:['water-materials']}))).ok,false);
});

test('base URL credentials and non-web protocols cannot leak into generated links',()=>{
  for(const url of ['javascript:alert(1)','data:text/plain,secret','file:///tmp/a','ftp://example.com','https://user:password@example.com','https://%75ser@example.com','https://example.com/\nunsafe','not a URL','/relative',{},null])assert.throws(()=>createPropertyViewUrl(state(),url),RangeError);
  assert.equal(new URL(createPropertyViewUrl(state(),'http://localhost:3000/test')).origin,'http://localhost:3000');
  assert.equal(new URL(createPropertyViewUrl(state(),new URL(base))).hostname,'ihelfrich.github.io');
});

test('query text stays literal, delimiter-safe and detached from caller arrays',()=>{
  const query='<script>alert(1)</script> & #evidence=% + / café 🏠\nA LLC';
  const input=state({query}),url=createPropertyViewUrl(input,base),decoded=readPropertyViewHash(new URL(url).hash);
  input.bounds[0]=-180;input.layers.length=0;
  assert.equal(decoded.state.query,query);assert.deepEqual(decoded.state.bounds,state().bounds);assert.deepEqual(decoded.state.layers,state().layers);
  assert.equal((url.match(/#evidence=/g)||[]).length,1);
  assert.equal(roundtrip(state({query:'x'.repeat(160)})).ok,true);
});

test('owned hash budget counts UTF-8 bytes, not string characters; valid boundary payloads parse',()=>{
  const basePayload={...state(),unused:''};let raw='#evidence='+JSON.stringify(basePayload);
  const allowed=raw.length;const exact='#evidence='+JSON.stringify({...basePayload,unused:'x'.repeat(4096-allowed)});
  assert.equal(new TextEncoder().encode(exact).length,4096);assert.equal(readPropertyViewHash(exact).ok,true);
  assert.equal(readPropertyViewHash(exact+' ').ok,false);
  const unicode='#evidence='+JSON.stringify({...basePayload,unused:'é'.repeat(2000)});
  assert.ok(unicode.length<4096);assert.ok(new TextEncoder().encode(unicode).length>4096);assert.equal(readPropertyViewHash(unicode).ok,false);
});
