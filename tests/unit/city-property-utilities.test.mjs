import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPropertyUtilitiesData,WATER_MATERIAL_COLORS} from '../../src/lib/property-utilities-data.mjs';
const sourceId='st-louis-city-water-materials',retrievedAt='2026-09-12T20:00:00Z',viewerUrl='https://example.org/official-water-view';
const metadata=JSON.parse(await readFile(new URL('../fixtures/utilities/city-water-metadata.json',import.meta.url),'utf8'));
const domains=Object.fromEntries(metadata.fields.filter(f=>f.domain).map(f=>[f.name,f.domain.codedValues.map(v=>({code:v.code,label:v.name}))]));
const fields=['utilityMaterial','utilityEvidence','utilityStatus','customerMaterial','customerEvidence','customerStatus'];
const rawFields=['utilmaterial','utilsource','utilstatus','custmaterial','custsource','custstatus'];
const counts=rows=>rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
function row(oid,status='unknown',longitude=-90.205){const codes=[84,1,2,84,3,status==='lead'?1:status==='galvanized-replacement'?3:status==='non-lead'?2:0];return {id:`${sourceId}:${oid}`,sourceId,sourceObjectId:oid,sourceGlobalId:null,jurisdiction:'st-louis-city',recordKey:null,parcelKey:null,parcelJoinStatus:'not-established',address:`${oid} FIXTURE ST`,longitude,latitude:38.625,status,...Object.fromEntries(fields.map((f,i)=>[f,{code:codes[i],label:domains[rawFields[i]].find(d=>d.code===codes[i]).label,recognized:true}]))};}
function fixture(rows=[row(1,'lead'),row(2,'unknown'),row(3,'non-lead',-90.215)]){
 const files=new Map(),calls=[],tiles=[],groups=new Map();
 const put=(path,json)=>{const text=JSON.stringify(json);files.set(path,text);return {bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};};
 const tileId=r=>`${Math.floor(r.longitude/.01)}_${Math.floor(r.latitude/.01)}`;
 for(const r of rows){const id=tileId(r);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 for(const [id,rs]of groups){const [x,y]=id.split('_').map(Number),url=`/st-louis/utilities/city-water/tiles/${id}.json`;tiles.push({id,url,bounds:[x*.01,y*.01,(x+1)*.01,(y+1)*.01],count:rs.length,statusCounts:counts(rs),...put(url,{schema:'property-utilities-tile-v1',id,sourceId,retrievedAt,records:rs})});}
 const searchUrl='/st-louis/utilities/city-water/search-index.json';
 const searchIndex={url:searchUrl,count:rows.length,...put(searchUrl,{schema:'property-utilities-search-v1',sourceId,retrievedAt,fields:['sourceObjectId','address','tileId','status'],rows:rows.map(r=>[r.sourceObjectId,r.address,tileId(r),r.status])})};
 const manifest={schema:'property-utilities-manifest-v1',layerId:'water-materials',source:{id:sourceId,viewerUrl,url:'https://example.org/source',retrievedAt},retrievedAt,recordCount:rows.length,mappedCount:rows.length,unlocatedCount:0,gridDegrees:.01,statusCounts:counts(rows),tiles,domains:structuredClone(domains),searchIndex,coverage:'City inventory only'};
 const saveManifest=()=>put('/st-louis/utilities/manifest.json',manifest);saveManifest();
 return {files,calls,tiles,manifest,saveManifest,put,fetchImpl:async url=>{calls.push(url);return new Response(files.get(url)||'',{status:files.has(url)?200:404});}};
}
const bounds=[-90.3,38.5,-90.1,38.7];
test('overview category filtering uses the manifest only and distinguishes unknown from non-lead',async()=>{
 const f=fixture(),data=createPropertyUtilitiesData(f);for(const material of ['lead','unknown','non-lead']){const r=await data.query({bounds,material});assert.equal(r.counts.records,1);assert.equal(r.features[0].count,1);assert.equal(r.features[0].color,WATER_MATERIAL_COLORS[material]);assert.equal(r.features[0].value,null);assert.equal(r.features[0].date,null);assert.equal(r.layers[0].aggregation,'source-grid-cell');}
 assert.deepEqual(f.calls,['/st-louis/utilities/manifest.json']);data.dispose();
});
test('point detail preserves separate side/evidence codes and exact source identity without parcel claims',async()=>{
 const rows=[row(1,'galvanized-replacement')];rows[0].customerMaterial={code:null,label:'Not supplied',recognized:false};rows[0].utilityEvidence={code:999,label:'Unrecognized source code (999)',recognized:false};rows[0].accountid='never-publish';
 const f=fixture(rows),data=createPropertyUtilitiesData(f),r=await data.query({bounds,level:'properties'});assert.equal(r.partial,false);const p=r.features[0];assert.equal(p.id,rows[0].id);assert.equal(p.sourceObjectId,1);assert.equal(p.recordKey,null);assert.equal(p.parcelKey,null);assert.equal(p.customerMaterial.code,null);assert.equal(p.utilityEvidence.code,999);assert.equal(p.date,null);assert.equal(p.original.accountid,undefined);assert.equal(p.sourceURL,viewerUrl);assert.equal(p.kind,'utility');data.dispose();
});
test('broad normalized address search downloads one compact index and no point tiles',async()=>{
 const f=fixture(),data=createPropertyUtilitiesData(f);const r=await data.query({bounds,query:'１ ＦＩＸＴＵＲＥ'});assert.equal(r.partial,false);assert.equal(r.counts.records,1);assert.equal(r.layers[0].searchApplied,true);assert.deepEqual(f.calls,['/st-louis/utilities/manifest.json','/st-louis/utilities/city-water/search-index.json']);assert.equal(r.features[0].kind,'activity-cell');data.dispose();
});
test('a malformed tile cannot suppress a valid neighboring tile; digest and source identities are checked',async()=>{
 const f=fixture(),bad=f.tiles[0],payload=JSON.parse(f.files.get(bad.url));payload.id='wrong-tile';Object.assign(bad,f.put(bad.url,payload));f.saveManifest();
 const data=createPropertyUtilitiesData(f),r=await data.query({bounds,level:'properties'});assert.equal(r.partial,true);assert.equal(r.layers[0].failedTiles,1);assert.deepEqual(r.records.map(p=>p.sourceObjectId),[3]);data.dispose();
 const g=fixture();g.files.set(g.tiles[0].url,g.files.get(g.tiles[0].url)+' ');const other=createPropertyUtilitiesData(g),result=await other.query({bounds,level:'properties'});assert.equal(result.layers[0].failedTiles,1);other.dispose();
});
test('missing source, malformed domains, and aborted/disposed views are never successful empty data',async()=>{
 const f=fixture();f.files.delete('/st-louis/utilities/manifest.json');const data=createPropertyUtilitiesData(f);assert.equal((await data.query({bounds})).layers[0].status,'unavailable');f.saveManifest();assert.equal((await data.query({bounds})).partial,false);
 const abort=new AbortController();abort.abort();await assert.rejects(data.query({bounds,signal:abort.signal}),{name:'AbortError'});data.dispose();await assert.rejects(data.query({bounds}),{name:'AbortError'});
 const g=fixture();delete g.manifest.domains.custstatus;g.saveManifest();const bad=createPropertyUtilitiesData(g);assert.equal((await bad.query({bounds})).layers[0].status,'unavailable');bad.dispose();
});
test('2,100 point details aggregate without losing records or category totals',async()=>{
 const f=fixture(Array.from({length:2100},(_,i)=>row(i+1,i%2?'unknown':'lead'))),data=createPropertyUtilitiesData(f);const r=await data.query({bounds,level:'properties'});assert.equal(r.partial,false);assert.equal(r.records.length,2100);assert.ok(r.features.length<=2000);assert.equal(r.features.reduce((n,p)=>n+p.count,0),2100);assert.equal(r.features[0].statusCounts.lead,1050);assert.equal(r.features[0].statusCounts.unknown,1050);data.dispose();
});
test('invalid bounds, material, and oversized text are rejected before retrieval',async()=>{
 const f=fixture(),data=createPropertyUtilitiesData(f);for(const options of [{bounds:[0,0,0,1]},{bounds,material:'safe'},{bounds,query:'x'.repeat(201)}])await assert.rejects(data.query(options),RangeError);assert.equal(f.calls.length,0);data.dispose();
});
test('actual City overview reconciles source categories and directory has no invented location parameters',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../public/st-louis/utilities/manifest.json',import.meta.url),'utf8'));
 const calls=[],data=createPropertyUtilitiesData({fetchImpl:async url=>{calls.push(url);return new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'));}});
 const r=await data.query({bounds:[-91,38,-89,40]});assert.equal(r.partial,false);assert.equal(r.counts.records,manifest.mappedCount);assert.ok(r.features.length<=2000);assert.equal(r.features.reduce((n,p)=>n+p.count,0),manifest.mappedCount);assert.equal(calls.length,1);
 const directory=await data.directory();const fcc=directory.entries.find(e=>e.id==='fcc-broadband');assert.equal(new URL(fcc.url).search,'');assert.equal(directory.entries.find(e=>e.id==='american-water').url,'https://www.amwater.com/');data.dispose();
});
test('actual broad street search reconciles every matched source address without point-tile downloads',async()=>{
 const index=JSON.parse(await readFile(new URL('../../public/st-louis/utilities/city-water/search-index.json',import.meta.url),'utf8'));
 const expected=index.rows.filter(r=>r[1]?.normalize('NFKC').toLowerCase().includes('gravois')).length;
 const calls=[],data=createPropertyUtilitiesData({fetchImpl:async url=>{calls.push(url);return new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'));}});
 const r=await data.query({bounds:[-91,38,-89,40],query:'GRAVOIS'});assert.equal(r.partial,false);assert.ok(expected>0);assert.equal(r.counts.records,expected);assert.equal(r.features.reduce((n,p)=>n+p.count,0),expected);assert.equal(calls.length,2);assert.equal(calls.some(p=>p.includes('/tiles/')),false);data.dispose();
});
test('actual point detail applies the viewport, source-domain labels and a material filter',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../public/st-louis/utilities/manifest.json',import.meta.url),'utf8'));
 const tile=manifest.tiles.find(t=>t.count>0&&t.count<200),raw=JSON.parse(await readFile(new URL('../../public'+tile.url,import.meta.url),'utf8')).records[0];
 const data=createPropertyUtilitiesData({fetchImpl:async url=>new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'))});
 const r=await data.query({bounds:[raw.longitude-.000001,raw.latitude-.000001,raw.longitude+.000001,raw.latitude+.000001],level:'properties',material:raw.status});
 assert.equal(r.partial,false);assert.ok(r.records.some(p=>p.sourceObjectId===raw.sourceObjectId));for(const p of r.records){assert.equal(p.status,raw.status);assert.equal(p.recordKey,null);assert.equal(p.parcelKey,null);for(const f of fields)assert.ok(p[f].label);assert.equal(p.date,null);}data.dispose();
});
