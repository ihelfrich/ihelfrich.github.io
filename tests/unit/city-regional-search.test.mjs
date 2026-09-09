import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegionalAddressSearch,COUNTY_ADDRESS_SOURCE} from '../../src/lib/city-regional-search.mjs';

const NOW='2026-09-09T03:00:00.000Z';
const county=(id=1,attributes={},geometry={x:-90.338742,y:38.649335})=>({attributes:{OBJECTID:id,ADRNO:41,ADRDIR:'S',ADRSTR:'CENTRAL',ADRSUF:'AVE',UNITNO:'',UNITDESC:'',MUNI:'CLY',MAILINGCITY:'SAINT LOUIS',ZIPCODE:'63105',STATE:'MO',COUNTY:'SAINT LOUIS COUNTY',FULL_ADDRESS:'41 S CENTRAL AVE',PROP_ADD:'41 S CENTRAL AVE',STATUS:'Current',DATE_PUBLIC:1595289600000,last_edited_date:1739800510000,...attributes},geometry});
const city=(id=1,address='41 S CENTRAL AV')=>({address,recordKey:`st-louis-city:${id}:parcel:${id}`,parcelKey:`st-louis-city:${id}`,parcelId:`parcel:${id}`,jurisdiction:'st-louis-city',longitude:-90.2,latitude:38.6,source:{id:'fixture-city',name:'Synthetic City snapshot',retrievedAt:'2026-01-01'}});
const payload=(features=[],extra={})=>({geometryType:'esriGeometryPoint',spatialReference:{wkid:4326},features,...extra});
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
function fixture({features=[county()],cityRows=[],extra={},fetchImpl,...options}={}) {
  const calls=[],cityCalls=[];
  const search=createRegionalAddressSearch({now:()=>new Date(NOW),citySearch:async(query,opts)=>{cityCalls.push({query,...opts});return cityRows;},fetchImpl:async(url,opts)=>{calls.push({url,opts});return fetchImpl?fetchImpl(url,opts):response(payload(features,extra));},...options});
  return {search,calls,cityCalls};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('County address source is the official County endpoint, with separate address identity and municipal metadata',async()=>{
  const f=fixture();const result=await f.search('41 South Central Avenue, Clayton Missouri 63105');
  assert.equal(result.partial,false);assert.equal(result.results.length,1);
  const row=result.results[0];assert.equal(row.resultKind,'address');assert.equal(row.jurisdiction,'st-louis-county');
  assert.equal(row.sourceAddressId,'st-louis-county-address:1');assert.equal(row.recordKey,undefined);assert.equal(row.parcelKey,undefined);assert.equal(row.parcelId,undefined);
  assert.equal(row.municipality,'CLAYTON');assert.equal(row.mailingCity,'SAINT LOUIS');assert.equal(row.postalCode,'63105');
  assert.equal(row.source.retrievedAt,NOW);assert.equal(row.source.vintage,null);assert.equal(row.sourceRecordUpdatedAt,'2025-02-17T13:55:10.000Z');
  const query=new URL(f.calls[0].url);assert.equal(query.origin,'https://maps.stlouisco.com');assert.equal(query.pathname,new URL(COUNTY_ADDRESS_SOURCE.url).pathname+'/query');
  assert.match(query.searchParams.get('where'),/ADRNO = 41/u);assert.match(query.searchParams.get('where'),/MUNI = 'CLY'/u);assert.match(query.searchParams.get('where'),/ZIPCODE = '63105'/u);
  assert.equal(query.searchParams.get('outSR'),'4326');assert.equal(query.searchParams.get('resultRecordCount'),'64');
  assert.equal(f.calls[0].opts.credentials,'omit');assert.equal(f.calls[0].opts.mode,'cors');assert.equal(f.cityCalls.length,0);
});

test('municipality-only, postal-only, south County and full street queries have bounded source filters',async()=>{
  for(const [query,expected] of [['Wildwood',"MUNI = 'WWD'"],['63017',"ZIPCODE = '63017'"],['3200 Lemay Ferry Road, St Louis MO 63125',"ADRNO = 3200"],['955 Rue Saint Francois, Florissant MO',"MUNI = 'FLO'"]]) {
    const f=fixture();await f.search(query);const where=new URL(f.calls[0].url).searchParams.get('where');
    assert.ok(where.includes(expected));assert.ok(where.includes("COUNTY) = 'SAINT LOUIS COUNTY'"));assert.ok(where.includes("STATUS = 'Current'"));
  }
});

test('street names that are municipality names are not stripped from numbered addresses',async()=>{
  const f=fixture();await f.search('123 Clayton');
  const where=new URL(f.calls[0].url).searchParams.get('where');assert.ok(where.includes("LIKE '%CLAYTON%'"));assert.ok(!where.includes("MUNI = 'CLY'"));
});

test('City full addresses normalize state, ZIP and street suffixes while preserving exact records sharing a HANDLE',async()=>{
  const one=city(1,'4100 LACLEDE AV'),two={...city(2,'4100 LACLEDE AV'),parcelKey:one.parcelKey};
  const f=fixture({features:[],cityRows:[one,two]});
  const result=await f.search('4100 Laclede Avenue, Saint Louis MO 63108');
  assert.equal(f.cityCalls[0].query,'4100 LACLEDE AV');assert.equal(result.results.length,2);
  assert.deepEqual(result.results.map(row=>row.recordKey),[one.recordKey,two.recordKey]);assert.ok(result.results.every(row=>row.resultKind==='parcel'));
});

test('punctuation stays inside escaped SQL literals and user wildcards do not widen queries',async()=>{
  const f=fixture();await f.search("41 O'NEAL_% OR 1=1 --");
  const where=new URL(f.calls[0].url).searchParams.get('where');
  assert.ok(where.includes("LIKE '%O''NEAL%'"));assert.ok(!where.includes("NEAL_"));assert.ok(!where.includes("LIKE '%O'NEAL%'"));
  assert.ok(where.includes("LIKE '%OR%'"));assert.ok(where.includes('ADRNO = 41'));
});

test('invalid or too-broad input never starts requests; result limit is validated',async()=>{
  const f=fixture();for(const query of [null,'','ab','%%%','123','x'.repeat(161),'41\nCENTRAL',Array(17).fill('word').join(' ')])assert.deepEqual((await f.search(query)).results,[]);
  assert.equal(f.calls.length,0);assert.equal(f.cityCalls.length,0);
  await assert.rejects(()=>f.search('CENTRAL',{limit:0}),/limit/u);await assert.rejects(()=>f.search('CENTRAL',{limit:51}),/limit/u);
});

test('duplicate County points collapse, separate units and different coordinates survive',async()=>{
  const f=fixture({features:[county(1),county(2),county(3,{UNITNO:'101',UNITDESC:'APT'}),county(4,{UNITNO:'102',UNITDESC:'APT'}),county(5,{}, {x:-90.3388,y:38.649335})]});
  const result=await f.search('41 Central');assert.equal(result.results.length,4);
  assert.ok(result.results.some(row=>row.address==='41 S CENTRAL AVE APT 101'));assert.ok(result.results.some(row=>row.address==='41 S CENTRAL AVE APT 102'));
});

test('unknown municipality codes remain unknown rather than taking the mailing city',async()=>{
  const f=fixture({features:[county(1,{MUNI:'NEW'})]});const row=(await f.search('41 Central')).results[0];
  assert.equal(row.municipality,null);assert.equal(row.municipalityCode,'NEW');assert.equal(row.mailingCity,'SAINT LOUIS');
});

test('skipped City queries and unverified ZIP constraints are explicit; Town and Country aliases agree',async()=>{
  const f=fixture();const town=await f.search('Town and Country');assert.equal(town.sources[0].skipped,true);assert.match(town.sources[0].reason,/not queried/u);
  const ampersand=await f.search('Town & Country');assert.equal(f.calls.length,1);assert.deepEqual(ampersand.results,town.results);
  const zip=await f.search('63105');assert.equal(zip.sources[0].skipped,true);assert.match(zip.sources[0].reason,/no ZIP search field/u);
  const street=await f.search('41 Central 63105');assert.equal(street.sources[0].skipped,undefined);assert.match(street.sources[0].reason,/ZIP is unavailable/u);
});

test('County designation comes from source attributes, never merely from a coordinate envelope',async()=>{
  const f=fixture({features:[county(1,{COUNTY:'SAINT LOUIS CITY'}),county(2,{STATE:'IL'}),county(3,{STATUS:'Historical'}),county(4,{}, {x:0,y:0}),county(5,{}, {x:'-90.338',y:38.6}),county(6)]});
  const result=await f.search('41 Central');assert.equal(result.results.length,1);assert.equal(result.results[0].sourceAddressId,'st-louis-county-address:6');assert.equal(result.partial,true);assert.equal(result.sources[1].rejectedCount,5);
});

test('explicit address matches outrank broad matches and a source cannot monopolize the visible limit',async()=>{
  const cityRows=Array.from({length:20},(_,i)=>city(i,'41 S CENTRAL AVENUE'));
  const f=fixture({features:[county(1)],cityRows});const result=await f.search('41 South Central Avenue',{limit:4});
  assert.equal(result.results.length,4);assert.ok(result.results.some(row=>row.jurisdiction==='st-louis-county'));assert.ok(result.results.some(row=>row.jurisdiction==='st-louis-city'));
  const g=fixture({features:[county(1)],cityRows:[city(1,'1410 CENTRAL WAY'),city(2,'1411 CENTRAL WAY')]});
  assert.equal((await g.search('41 S Central Ave',{limit:1})).results[0].resultKind,'address');
});

test('County HTTP and ArcGIS rate limits preserve City results without automatic retries',async()=>{
  for(const failure of [()=>new Response('rate limited',{status:429}),()=>response({error:{code:429}})]) {
    const f=fixture({cityRows:[city()],fetchImpl:failure});const result=await f.search('41 Central');
    assert.equal(result.results.length,1);assert.equal(result.results[0].resultKind,'parcel');assert.equal(result.partial,true);assert.equal(result.sources[1].status,'unavailable');assert.match(result.sources[1].reason,/rate limited/u);assert.equal(f.calls.length,1);
  }
});

test('City failure leaves County results available and does not fabricate a zero-source success',async()=>{
  const f=fixture({citySearch:async()=>{throw new Error('Synthetic unavailable source');}});const result=await f.search('41 Central');
  assert.equal(result.results.length,1);assert.equal(result.results[0].resultKind,'address');assert.equal(result.sources[0].status,'unavailable');assert.equal(result.sources[1].status,'ready');assert.equal(result.partial,true);
});

test('unsupported projection, malformed JSON, ArcGIS error and excessive rows are unavailable independently',async()=>{
  for(const value of [payload([county()],{spatialReference:{wkid:3857}}),{error:{code:400}},payload(Array.from({length:65},()=>county()))]) {
    const f=fixture({cityRows:[city()],fetchImpl:()=>response(value)});const result=await f.search('41 Central');
    assert.equal(result.sources[1].status,'unavailable');assert.equal(result.results.length,1);
  }
  const f=fixture({fetchImpl:()=>new Response('{broken')});assert.equal((await f.search('41 Central')).sources[1].status,'unavailable');
});

test('source response is size bounded by declared length and streamed bytes',async()=>{
  const large='x'.repeat(1024*1024+1);
  for(const res of [()=>new Response('{}',{headers:{'Content-Length':String(large.length)}}),()=>new Response(large)]) {
    const f=fixture({fetchImpl:res});const result=await f.search('41 Central');assert.match(result.sources[1].reason,/size limit/u);
  }
});

test('source truncation is explicit and does not pretend the displayed results are complete coverage',async()=>{
  const f=fixture({extra:{exceededTransferLimit:true}});const result=await f.search('Central');
  assert.equal(result.results.length,1);assert.equal(result.sources[1].status,'ready');assert.equal(result.sources[1].truncated,true);assert.equal(result.partial,true);assert.match(result.sources[1].reason,/More County matches/u);
});

test('successful identical County queries are cached with original retrieval time',async()=>{
  const f=fixture();const first=await f.search('41 Central'),second=await f.search('41 CENTRAL');
  assert.equal(f.calls.length,1);assert.deepEqual(first.results,second.results);
});

test('failed County queries are retryable and are not cached',async()=>{
  let count=0;const f=fixture({fetchImpl:()=>++count===1?new Response('',{status:503}):response(payload([county()]))});
  assert.equal((await f.search('41 Central')).sources[1].status,'unavailable');assert.equal((await f.search('41 Central')).sources[1].status,'ready');assert.equal(f.calls.length,2);
});

test('already-aborted calls cause no fetch and in-flight cancellation rejects promptly',async()=>{
  const abort=new AbortController();abort.abort();const f=fixture();await assert.rejects(()=>f.search('41 Central',{signal:abort.signal}),{name:'AbortError'});assert.equal(f.calls.length,0);
  const pending=deferred(),controller=new AbortController();const g=fixture({fetchImpl:()=>pending.promise});
  const running=g.search('41 Central',{signal:controller.signal});await Promise.resolve();await Promise.resolve();controller.abort();
  await assert.rejects(running,{name:'AbortError'});assert.equal(g.calls[0].opts.signal.aborted,true);pending.resolve(response(payload([county()])));
});

test('late canceled replies do not overwrite a newer query or populate successful cache',async()=>{
  const pending=deferred();let first=true;const f=fixture({fetchImpl:()=>{if(first){first=false;return pending.promise;}return response(payload([county(2,{FULL_ADDRESS:'42 S CENTRAL AVE',PROP_ADD:'42 S CENTRAL AVE'})]));}});
  const controller=new AbortController(),old=f.search('41 Central',{signal:controller.signal});await Promise.resolve();await Promise.resolve();controller.abort();await assert.rejects(old,{name:'AbortError'});
  const newer=await f.search('42 Central');pending.resolve(response(payload([county()])));await Promise.resolve();
  assert.equal(newer.results[0].sourceAddressId,'st-louis-county-address:2');await f.search('41 Central');assert.equal(f.calls.length,3);
});

test('deadline settles a fetch that ignores abort while the City result remains usable',async()=>{
  const f=fixture({cityRows:[city()],timeoutMs:15,fetchImpl:()=>new Promise(()=>{})});const result=await f.search('41 Central');
  assert.equal(result.results.length,1);assert.equal(result.sources[1].status,'unavailable');assert.match(result.sources[1].reason,/timed out/u);assert.equal(f.calls[0].opts.signal.aborted,true);
});

test('deadline covers a source whose body reader stalls after headers',async()=>{
  const f=fixture({timeoutMs:15,fetchImpl:()=>new Response(new ReadableStream({start(){}}))});
  assert.match((await f.search('41 Central')).sources[1].reason,/timed out/u);
});
