import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../public/st-louis/',import.meta.url);
const index=JSON.parse(await readFile(new URL('ownership-signals/index.json',root),'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const designation=/(?:^|[^A-Z0-9])(?:L\.?\s*L\.?\s*C\.?|L\.?\s*L\.?\s*P\.?|L\.?\s*P\.?|INC(?:ORPORATED)?\.?|CORP(?:ORATION)?\.?|LTD\.?|LIMITED)(?=$|[^A-Z0-9])/i;
const keys=['id','indicator','jurisdiction','latitude','longitude','matchedDesignator','ownerName','parcelId','parcelKey','recordKey','ruleVersion','sourceObjectId'];
test('ownership publication is a source-filtered, dated name indicator with a small viewport index',async()=>{
 assert.equal(index.schema,'ownership-signals-v1');assert.equal(index.source.id,'st-louis-county-business-name-indicators');assert.equal(index.ruleVersion,'county-business-designator-v1');
 assert.deepEqual(index.source.requestedFields,['OBJECTID','LOCATOR','OWNER_NAME']);assert.equal(index.source.sourceOwnerNameMaxLength,40);assert.match(index.source.where,/UPPER\(OWNER_NAME\) LIKE/);
 assert.equal(index.records,undefined);assert.equal(index.gridDegrees,.02);assert.equal(index.tiles.length,368);
 assert.ok((await readFile(new URL('ownership-signals/index.json',root))).length<100000);assert.ok(index.largestTileBytes<500000);
 assert.equal(index.coverage.candidateFeatureCount,50364);assert.equal(index.coverage.publishedIndicatorCount,50307);assert.equal(index.coverage.rejectedTokenCandidates,57);assert.equal(index.coverage.unmatchedExactRegionIdentityCount,0);
 assert.equal(index.source.sourceDataEditedAt,null);assert.ok(Number.isFinite(Date.parse(index.source.retrievedAt)));
 assert.match(index.source.recordDateMeaning,/no ownership-start or acquisition date/);
 assert.match(index.limitations.join(' '),/does not establish private-equity affiliation/);
});
test('every published indicator is token-matched and joins the exact regional feature and viewport cell',async()=>{
 const seen=new Set();let mapped=0,totalBytes=0;
 for(const meta of index.tiles){
  const bytes=await readFile(new URL(`ownership-signals/tiles/${meta.id}.json`,root));totalBytes+=bytes.length;
  assert.equal(bytes.length,meta.bytes);assert.equal(hash(bytes),meta.sha256);
  const tile=JSON.parse(bytes);assert.equal(tile.schema,'ownership-signals-tile-v1');assert.equal(tile.id,meta.id);assert.equal(tile.sourceId,index.source.id);assert.equal(tile.jurisdiction,'st-louis-county');assert.equal(tile.records.length,meta.count);
  const region=JSON.parse(await readFile(new URL(`regions/st-louis-county/tiles/${meta.id}.json`,root),'utf8'));
  const field=Object.fromEntries(region.fields.map((f,i)=>[f,i]));const points=new Map(region.rows.map(r=>[r[field.sourceObjectId],r]));
  for(const r of tile.records){
   assert.deepEqual(Object.keys(r).sort(),keys);assert.ok(!seen.has(r.sourceObjectId));seen.add(r.sourceObjectId);
   assert.equal(r.indicator,'name_contains_legal_designator');assert.equal(r.ruleVersion,index.ruleVersion);assert.ok(designation.test(r.ownerName));assert.ok(r.ownerName.length<=40);assert.ok(r.ownerName.includes(r.matchedDesignator));
   assert.equal(r.id,`county-business-name:${r.sourceObjectId}`);const p=points.get(r.sourceObjectId);assert.ok(p);
   for(const name of ['parcelId','recordKey','parcelKey','longitude','latitude'])assert.equal(r[name],p[field[name]]);
   const[x,y]=[r.longitude,r.latitude];assert.ok(x>=meta.bounds[0]-1e-8&&x<=meta.bounds[2]+1e-8&&y>=meta.bounds[1]-1e-8&&y<=meta.bounds[3]+1e-8);mapped++;
  }
 }
 const unlocated=JSON.parse(await readFile(new URL('ownership-signals/unlocated.json',root),'utf8'));
 assert.equal(unlocated.records.length,2);
 for(const r of unlocated.records){assert.equal(r.longitude,null);assert.equal(r.latitude,null);assert.ok(designation.test(r.ownerName));assert.ok(!seen.has(r.sourceObjectId));seen.add(r.sourceObjectId);}
 assert.equal(mapped,index.coverage.mappedIndicatorCount);assert.equal(mapped,50305);assert.equal(seen.size,index.recordCount);assert.equal(totalBytes,index.totalTileBytes);
});

test('countywide name index reconciles every exact name and tile count without inferring aliases',async()=>{
 assert.equal(index.nameIndexUrl,'/st-louis/ownership-signals/names-index.json');
 const bytes=await readFile(new URL('ownership-signals/names-index.json',root));assert.equal(bytes.length,index.nameIndexBytes);assert.equal(hash(bytes),index.nameIndexSha256);
 const names=JSON.parse(bytes);assert.equal(names.schema,'ownership-name-index-v1');assert.equal(names.sourceId,index.source.id);assert.equal(names.ruleVersion,index.ruleVersion);assert.equal(names.retrievedAt,index.source.retrievedAt);assert.match(names.normalization,/no aliases/);
 const expected=new Map();
 function add(r,tileId){const e=expected.get(r.ownerName)??{count:0,tiles:new Map(),unlocatedCount:0};e.count++;if(tileId)e.tiles.set(tileId,(e.tiles.get(tileId)??0)+1);else e.unlocatedCount++;expected.set(r.ownerName,e);}
 for(const meta of index.tiles){const tile=JSON.parse(await readFile(new URL(`ownership-signals/tiles/${meta.id}.json`,root),'utf8'));for(const r of tile.records)add(r,meta.id);}
 for(const r of JSON.parse(await readFile(new URL('ownership-signals/unlocated.json',root),'utf8')).records)add(r,null);
 assert.equal(names.records.length,expected.size);assert.equal(names.records.length,index.nameCount);assert.equal(index.nameCount,23221);
 const seen=new Set();const tileTotals=new Map();let count=0,mapped=0,unlocated=0;
 for(const entry of names.records){
  assert.ok(!seen.has(entry.name));seen.add(entry.name);assert.ok(expected.has(entry.name));const original=expected.get(entry.name);
  assert.deepEqual(Object.keys(entry).sort(),['count','name','normalizedOwnerName','tiles',...(entry.unlocatedCount?['unlocatedCount']:[])].sort());
  assert.equal(entry.normalizedOwnerName,entry.name.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' '));assert.equal(entry.count,original.count);assert.equal(entry.unlocatedCount??0,original.unlocatedCount);
  const cells=new Map();for(const tile of entry.tiles){assert.deepEqual(Object.keys(tile).sort(),['count','id']);assert.ok(!cells.has(tile.id));cells.set(tile.id,tile.count);tileTotals.set(tile.id,(tileTotals.get(tile.id)??0)+tile.count);mapped+=tile.count;}
  assert.deepEqual(cells,original.tiles);assert.equal(entry.count,[...cells.values()].reduce((s,n)=>s+n,0)+(entry.unlocatedCount??0));count+=entry.count;unlocated+=entry.unlocatedCount??0;
 }
 for(const tile of index.tiles)assert.equal(tileTotals.get(tile.id),tile.count);
 assert.deepEqual(names.coverage,{indicatorCount:count,mappedIndicatorCount:mapped,unlocatedIndicatorCount:unlocated,nameCount:expected.size,representedTileCount:index.tiles.length});
 assert.equal(count,50307);assert.equal(mapped,50305);assert.equal(unlocated,2);assert.ok(bytes.length<4000000,'Name-only lookup avoids loading the 20MB full ownership record set');
});
