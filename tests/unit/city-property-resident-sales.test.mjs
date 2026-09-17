import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResidentSaleEvidence} from '../../src/lib/property-resident-sales.mjs';
import {createPropertyRegionData} from '../../src/lib/property-region-data.mjs';

const now=()=>new Date('2026-09-13T15:00:00Z'),jurisdiction='st-louis-county';
const source={id:'stlco-real-billing-2025-sales',name:'County archive',url:'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip',retrievedAt:'2026-09-12T17:29:42Z',archiveEntryTimestamp:'2025-11-17T09:16:38'};
const manifest={jurisdiction,source:{id:'st-louis-county-current',url:'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0',retrievedAt:'2026-09-12T18:00:00Z'},saleSource:source,maxObservedLatestTransferDateISO:'2025-10-29'};
const evidence={point:{longitude:-90.36,latitude:38.70},parcels:{parcel:{properties:{jurisdiction,recordKey:'st-louis-county-current:14L000001:1',parcelKey:'st-louis-county:14L000001',parcelId:'14L000001',handle:'14L000001',sourceObjectId:1,address:'Subject'}},source:manifest.source}};
const sale=(n,patch={})=>({id:`st-louis-county-current:14L${String(n).padStart(6,'0')}:${n}`,recordKey:`st-louis-county-current:14L${String(n).padStart(6,'0')}:${n}`,parcelKey:`st-louis-county:14L${String(n).padStart(6,'0')}`,parcelId:`14L${String(n).padStart(6,'0')}`,sourceObjectId:n,jurisdiction,kind:'parcel',longitude:-90.36+n*.00001,latitude:38.70,address:`${n} Example`,latestSaleDateISO:'2025-05-01',latestSaleDateRaw:'01-MAY-25',latestSalePriceUSD:150000,latestSalePriceStatus:'recorded',latestSaleValidityCode:'X',latestSaleMarketValidityCode:null,latestSaleInstrumentTypeCode:'WD',latestSaleDateCenturyInferred:true,latestSaleSourceId:source.id,...patch});
const view=(features,patch={})=>({features,level:'properties',sources:[manifest],partial:false,failedTiles:0,unavailable:[],...patch});
function fixture(result){const calls=[];const regionData={query:async options=>{calls.push(options);return typeof result==='function'?result(options):result;},clear(){calls.push('clear');}};const loader=createResidentSaleEvidence({regionData,now});return {loader,calls};}

test('requires exact selected parcel identity, not a standalone searched address',async()=>{
 const f=fixture(view([sale(2)]));const r=await f.loader.load({point:evidence.point});assert.equal(r.status,'unavailable');assert.equal(f.calls.length,0);assert.equal(r.valuation.status,'not-estimated');
 for(const patch of [{recordKey:null},{sourceObjectId:null},{jurisdiction:'elsewhere'}])assert.equal((await f.loader.load({...evidence,parcels:{...evidence.parcels,parcel:{properties:{...evidence.parcels.parcel.properties,...patch}}}})).status,'unavailable');
});

test('query is bounded and date/radius exact; source flags and interpreted date remain evidence',async()=>{
 const f=fixture(view([sale(2),sale(3,{longitude:-90.36+.025,latitude:38.70+.01}),sale(4,{latestSaleDateISO:'2023-09-12'}),sale(5,{latestSaleDateISO:'2027-01-01'})]));const r=await f.loader.load(evidence);
 assert.equal(f.calls[0].jurisdiction,jurisdiction);assert.equal(f.calls[0].metric,'latestSalePriceUSD');assert.equal(f.calls[0].fromYear,2023);assert.equal(f.calls[0].toYear,2026);
 assert.equal(r.status,'ready');assert.equal(r.totalCandidates,1);assert.equal(r.candidates[0].recordKey,sale(2).recordKey);assert.equal(r.candidates[0].latestSaleDateCenturyInferred,true);assert.equal(r.candidates[0].source.url,source.url);
 assert.equal(r.exclusionCounts['outside-radius'],1);assert.equal(r.exclusionCounts['outside-date-window'],1);assert.equal(r.exclusionCounts['future-sale-date'],1);
 assert.equal(r.coverage.latestObservedSaleDateISO,'2025-10-29');assert.equal(r.coverage.fromDate,'2023-09-13');assert.equal(r.valuation.status,'not-estimated');
});

test('zero, nominal, missing, conflicting, multi-parcel and explicitly non-market flags never become candidate prices',async()=>{
 const rows=[sale(2,{latestSalePriceUSD:0}),sale(3,{latestSalePriceUSD:null}),sale(4,{latestSalePriceUSD:1}),sale(5,{latestSalePriceStatus:'conflicting-same-date'}),sale(6,{latestSalePriceStatus:'multi-parcel-total-withheld'}),sale(7,{latestSaleValidityCode:'4'}),sale(8,{latestSaleMarketValidityCode:'1'}),sale(9,{latestSaleDateISO:'2025-02-30'})];
 const r=await fixture(view(rows)).loader.load(evidence);assert.equal(r.status,'insufficient');assert.equal(r.totalCandidates,0);assert.equal(Object.values(r.exclusionCounts).reduce((a,b)=>a+b,0),rows.length);assert.equal(r.sources.some(s=>s.id===source.id),true);
});

test('subject and shared handle/parcel identities are excluded; ambiguous candidate parcel identities are not counted twice',async()=>{
 const own=sale(1),shared={...own,recordKey:'st-louis-county-current:14L000001:2',sourceObjectId:2},duplicateA=sale(3),duplicateB={...duplicateA,recordKey:'st-louis-county-current:14L000003:4',sourceObjectId:4},clean=sale(5);
 const r=await fixture(view([own,shared,duplicateA,duplicateB,clean])).loader.load(evidence);assert.deepEqual(r.candidates.map(x=>x.recordKey),[clean.recordKey]);assert.equal(r.exclusionCounts.subject,2);assert.equal(r.exclusionCounts['ambiguous-parcel-identity'],2);
});

test('candidate limit is explicit, deterministic, and distance then date ordered without mutating sources',async()=>{
 const rows=Array.from({length:26},(_,i)=>sale(i+2,{longitude:-90.359,latestSaleDateISO:`2025-05-${String(i+1).padStart(2,'0')}`}));const before=structuredClone(rows);
 const r=await fixture(view(rows.reverse())).loader.load(evidence);assert.equal(r.totalCandidates,26);assert.equal(r.candidates.length,20);assert.equal(r.omittedByLimit,6);assert.equal(r.candidates[0].saleDateISO,'2025-05-26');assert.deepEqual(rows,before.reverse());
});

test('aggregate-only and partially failed views retain source coverage without turning cells into sale records',async()=>{
 const overview=await fixture(view([{kind:'cell',value:200000,count:100}],{level:'areas'})).loader.load(evidence);assert.equal(overview.status,'zoom-required');assert.equal(overview.candidates.length,0);assert.equal(overview.sources.some(s=>s.id===source.id),true);
 const partial=await fixture(view([sale(2)],{partial:true,failedTiles:1})).loader.load(evidence);assert.equal(partial.status,'ready');assert.equal(partial.partial,true);assert.match(partial.coverage.warnings.join(' '),/partial/i);
 const failure=await fixture(()=>{throw Error('offline')}).loader.load(evidence);assert.equal(failure.status,'unavailable');assert.equal(failure.valuation.status,'not-estimated');
});

test('bad source URL, foreign jurisdiction, and malformed source identity are excluded',async()=>{
 const rows=[sale(2,{jurisdiction:'st-louis-city'}),sale(3,{recordKey:'foreign:3'}),sale(4)];
 const bad={...manifest,saleSource:{...source,url:'https://user:secret@example.com/unsafe'}};
 const r=await fixture(view(rows,{sources:[bad]})).loader.load(evidence);assert.equal(r.totalCandidates,0);assert.equal(r.sources.some(s=>String(s.url).includes('secret')),false);
});

test('aborted, superseded, and disposed loads settle promptly even when the underlying query ignores its signal',async()=>{
 const pending=[],f=fixture(()=>new Promise(resolve=>pending.push(resolve)));const a=f.loader.load(evidence);const rejectedA=assert.rejects(a,{name:'AbortError'});
 const b=f.loader.load(evidence);await rejectedA;pending[1](view([sale(2)]));assert.equal((await b).totalCandidates,1);pending[0](view([sale(3)]));
 const controller=new AbortController(),c=f.loader.load(evidence,{signal:controller.signal});const rejectedC=assert.rejects(c,{name:'AbortError'});controller.abort();await rejectedC;
 const d=f.loader.load(evidence);const rejectedD=assert.rejects(d,{name:'AbortError'});f.loader.dispose();await rejectedD;await assert.rejects(f.loader.load(evidence),{name:'AbortError'});
});

test('City source-specific coverage and unknown sale validation are retained without automatic qualification',async()=>{
 const city='st-louis-city',id='st-louis-city-gis-residential-sale-fields',sourceCity={id,url:'https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0',retrievedAt:source.retrievedAt,maxObservedSaleDateISO:'2025-02-28'};
 const m={jurisdiction:city,source:{...sourceCity,id:'city-current'},sources:{[id]:sourceCity},maxObservedLatestTransferDateISO:'2025-02-28'};
 const p={...evidence.parcels.parcel.properties,jurisdiction:city,recordKey:'st-louis-city:111:222:1',parcelKey:'st-louis-city:111',parcelId:'222',handle:'111'};
 const row=sale(2,{jurisdiction:city,recordKey:'st-louis-city:333:444:2',parcelKey:'st-louis-city:333',parcelId:'444',latestSaleDateISO:'2025-02-28',latestSaleSourceId:id,latestSaleValidityCode:null});
 const result=await fixture(view([row],{sources:[m]})).loader.load({...evidence,parcels:{...evidence.parcels,parcel:{properties:p}}});
 assert.equal(result.totalCandidates,1);assert.equal(result.coverage.latestObservedSaleDateISO,'2025-02-28');assert.equal(result.candidates[0].latestSaleValidityCode,null);assert.equal(result.valuation.status,'not-estimated');
});

test('calendar windows clamp month ends and exact source coverage cannot be exceeded',async()=>{
 const api=createResidentSaleEvidence({now:()=>new Date('2024-03-31T12:00:00Z'),regionData:{query:async()=>view([sale(2,{latestSaleDateISO:'2024-02-29'}),sale(3,{latestSaleDateISO:'2024-02-28'})])}});
 const r=await api.load(evidence,{lookbackMonths:1});assert.equal(r.coverage.fromDate,'2024-02-29');assert.equal(r.totalCandidates,1);
 const s=await fixture(view([sale(2,{latestSaleDateISO:'2025-11-01'}),sale(3,{flags:['source-related-parties']})])).loader.load(evidence);
 assert.equal(s.exclusionCounts['beyond-source-coverage'],1);assert.equal(s.exclusionCounts['source-flagged-transfer'],1);
 await assert.rejects(api.load(evidence,{radiusKm:NaN}),RangeError);await assert.rejects(api.load(evidence,{lookbackMonths:1.5}),RangeError);api.dispose();
});

test('current study identity works with real regional tiles and keeps the bounded report descriptive',async()=>{
 const root=new URL('../../public/',import.meta.url),index=JSON.parse(await readFile(new URL('st-louis/county-current/index.json',root),'utf8'));
 const p=index.records.find(r=>r.parcelId==='16L640291');assert.ok(p,'the named study anchor must still exist, or the fixture scope needs review');
 const calls=[];const data=createPropertyRegionData({fetchImpl:async url=>{assert.match(url,/^\/st-louis\/regions\/(st-louis-city|st-louis-county)\/(manifest\.json|tiles\/[\w-]+\.json)$/);calls.push(url);return {ok:true,json:async()=>JSON.parse(await readFile(new URL(url.slice(1),root),'utf8'))};}});
 const loader=createResidentSaleEvidence({regionData:data,now});const r=await loader.load({point:{longitude:p.longitude,latitude:p.latitude},parcels:{parcel:{properties:p},source:index.source}},{radiusKm:.5});
 assert.ok(['ready','insufficient'].includes(r.status));assert.equal(r.partial,false);assert.ok(r.candidates.length<=20);assert.equal(r.valuation.status,'not-estimated');
 assert.ok(calls.filter(url=>url.includes('/tiles/')).length<=20);
 for(const c of r.candidates){assert.notEqual(c.parcelKey,p.parcelKey);assert.equal(c.jurisdiction,p.jurisdiction);assert.ok(c.distanceKm<=.5);assert.ok(c.saleDateISO>=r.coverage.fromDate&&c.saleDateISO<=r.coverage.toDate);assert.equal(c.source.id,source.id);}
 const manifestNow=JSON.parse(await readFile(new URL('st-louis/regions/st-louis-county/manifest.json',root),'utf8'));
 assert.equal(r.coverage.latestObservedSaleDateISO,manifestNow.maxObservedLatestTransferDateISO);loader.dispose();
});
