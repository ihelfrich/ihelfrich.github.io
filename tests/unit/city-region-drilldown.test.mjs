import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPropertyRegionData} from '../../src/lib/property-region-data.mjs';
import {OrthographicCamera} from 'three';
import {threeAtlasFit,threeViewportBounds} from '../../src/scripts/city/city-property-atlas.mjs';
const jurisdiction='st-louis-county',fields=['recordKey','parcelKey','sourceObjectId','longitude','latitude','assessedValueUSD'];
function fixture({maxPoints=4,maxTiles=20,eastBoundary=1,eastCount=4}={}){
 const calls=[],files=new Map(),region={id:jurisdiction,name:'Fixture County',manifestUrl:'/manifest.json'};
 let oid=0;const rows=points=>points.map(([x,y])=>{const id=++oid;return [`st-louis-county-current:FIXTURE${id}:${id}`,`st-louis-county:FIXTURE${id}`,id,x,y,100];});
 const sets=[['core',[0,0,1,1],rows([[.5,.5],[0,0]])],['east',[1,0,2,1],rows(Array.from({length:eastCount},(_,i)=>[i<eastBoundary?1:1.5,.25+i*.05]))],['west',[-1,0,0,1],rows([[0,.5],[-.5,.25],[-.5,.5],[-.5,.75]])]];
 const tiles=sets.map(([id,bounds,values])=>{const url='/'+id+'.json';files.set(url,{schema:'property-region-tile-v1',jurisdiction,id,sourceId:'fixture',fields,rows:values});return {id,url,bounds,count:values.length,metrics:{assessedValueUSD:{sum:values.length*100,count:values.length}}};});
 const manifest={schema:'property-region-v1',jurisdiction,source:{id:'fixture'},fields,tiles};files.set(region.manifestUrl,manifest);
 const data=createPropertyRegionData({regions:[region],maxPoints,maxTiles,fetchImpl:async url=>{calls.push(url);return new Response(JSON.stringify(files.get(url)));}});
 return {data,calls,files,manifest};
}
test('boundary-only tile counts do not prevent detail, while exact edges and corners remain included',async()=>{
 const f=fixture(),r=await f.data.query({bounds:[0,0,1,1]});assert.equal(r.level,'properties');assert.equal(r.count,4);assert.equal(r.partial,false);
 assert.ok(r.features.some(p=>p.longitude===1));assert.ok(r.features.some(p=>p.longitude===0&&p.latitude===.5));assert.ok(r.features.some(p=>p.longitude===0&&p.latitude===0));
 assert.equal(f.calls.length,4,'All three touching tiles are inspected; no silent boundary exclusion');
 assert.equal(new Set(r.features.map(p=>p.recordKey)).size,4);
});
test('actual in-view overflow returns source aggregates rather than truncating visible records',async()=>{
 const f=fixture({eastBoundary:2}),r=await f.data.query({bounds:[0,0,1,1]});assert.equal(r.level,'areas');assert.equal(r.count,10);assert.equal(r.features.length,3);assert.equal(r.partial,false);
});
test('boundary over-read and tile limits remain bounded before any point requests',async()=>{
 for(const options of [{eastCount:11},{maxTiles:2}]){const f=fixture(options),r=await f.data.query({bounds:[0,0,1,1]});assert.equal(r.level,'areas');assert.deepEqual(f.calls,['/manifest.json']);}
});
test('failure in a boundary source stays partial and cannot turn into assumed zero boundary coverage',async()=>{
 const f=fixture();f.files.get('/east.json').sourceId='foreign-source';const r=await f.data.query({bounds:[0,0,1,1]});assert.equal(r.level,'properties');assert.equal(r.failedTiles,1);assert.equal(r.partial,true);assert.equal(r.features.length,3);
});
// Derive expectations before executing the loader, so a loader that silently
// omits a touching source tile cannot omit that same tile from the oracle.
async function currentSourceFixture(bounds){
 const files=new Map(),calls=[],expected=[],matchingTiles=[];let readCount=0;
 const read=async url=>{const raw=await readFile(new URL('../../public'+url,import.meta.url),'utf8');files.set(url,raw);return JSON.parse(raw);};
 for(const id of ['st-louis-city','st-louis-county']){
  const manifest=await read(`/st-louis/regions/${id}/manifest.json`);
  for(const tile of manifest.tiles){const b=tile.bounds;if(b[0]>bounds[2]||b[2]<bounds[0]||b[1]>bounds[3]||b[3]<bounds[1])continue;matchingTiles.push({tile,manifest});}
 }
 assert.ok(matchingTiles.length<=20,'Only the bounded target footprint is read');
 assert.ok(matchingTiles.reduce((n,{tile})=>n+tile.count,0)<=32000,'Target source rows stay within the detail-read ceiling');
 for(const {tile,manifest} of matchingTiles){
  const body=await read(tile.url);assert.deepEqual(body.fields,manifest.fields);assert.equal(body.rows.length,tile.count);readCount+=body.rows.length;
  const field=name=>manifest.fields.indexOf(name),x=field('longitude'),y=field('latitude'),key=field('recordKey');assert.ok(x>=0&&y>=0&&key>=0);
  for(const row of body.rows)if(row[x]>=bounds[0]&&row[x]<=bounds[2]&&row[y]>=bounds[1]&&row[y]<=bounds[3])expected.push({recordKey:row[key],jurisdiction:manifest.jurisdiction,longitude:row[x],latitude:row[y]});
 }
 const data=createPropertyRegionData({fetchImpl:async url=>{calls.push(url);assert.ok(files.has(url),`Loader requested an unrelated source: ${url}`);return new Response(files.get(url));}});
 return {data,calls,expected,matchingTiles,readCount};
}
const keys=records=>records.map(row=>row.recordKey).sort();
const subtotals=records=>Object.fromEntries(['st-louis-city','st-louis-county'].map(id=>[id,records.filter(row=>row.jurisdiction===id).length]));
test('the known County cell reaches exact current properties despite touching source tiles',async()=>{
 const bounds=[-90.28,38.7,-90.26,38.72],f=await currentSourceFixture(bounds),r=await f.data.query({bounds});
 assert.equal(r.level,'properties');assert.ok(r.count>0&&r.count<=8000);assert.equal(r.count,f.expected.length);assert.equal(r.partial,false);
 assert.deepEqual(keys(r.features),keys(f.expected));assert.deepEqual(subtotals(r.features),subtotals(f.expected));
 assert.ok(f.calls.length<=22,'Existing20-tile gate plus two manifests');assert.equal(new Set(keys(r.features)).size,f.expected.length);
 const boundary=rows=>rows.filter(p=>[bounds[0],bounds[2]].includes(p.longitude)||[bounds[1],bounds[3]].includes(p.latitude));
 assert.deepEqual(keys(boundary(r.features)),keys(boundary(f.expected)),'Every current exact-boundary source point is preserved');
 const county=await f.data.query({bounds,jurisdiction:'st-louis-county'}),countyExpected=f.expected.filter(row=>row.jurisdiction==='st-louis-county');
 assert.equal(county.level,'properties');assert.equal(county.count,countyExpected.length);assert.deepEqual(keys(county.features),keys(countyExpected));
});
test('a real drilldown stays in property detail after native camera padding and viewport polling',async()=>{
 const bounds=[-90.28,38.7,-90.26,38.72],origin=[-90.193,38.628],camera=new OrthographicCamera(-500,500,500,-500,2,5000000);
 const fit=threeAtlasFit(camera,bounds,origin);camera.zoom=fit.zoom;camera.position.set(fit.x,3000/fit.zoom,fit.z+3/fit.zoom);camera.lookAt(fit.x,0,fit.z);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const viewport=threeViewportBounds(camera,origin),f=await currentSourceFixture(viewport),result=await f.data.query({bounds:viewport});
 assert.equal(result.level,'properties');assert.ok(result.count>0&&result.count<=8000);assert.equal(result.count,f.expected.length);
 assert.deepEqual(keys(result.features),keys(f.expected));assert.deepEqual(subtotals(result.features),subtotals(f.expected));assert.ok(f.matchingTiles.length<=20);assert.ok(f.readCount<=32000);
});
