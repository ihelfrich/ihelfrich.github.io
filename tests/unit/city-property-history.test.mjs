import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base=new URL('../../public/st-louis/',import.meta.url);
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const load=async path=>JSON.parse(await readFile(new URL(path,base),'utf8'));

test('observation ledger is dated, reconstructible and bounded without invented baseline transactions',async()=>{
 const manifest=await load('history/manifest.json');assert.equal(manifest.schema,'property-observation-history-v1');
 const ids=new Set();let initialBytes=0;
 for(const source of manifest.sources){
  assert.ok(!ids.has(source.id));ids.add(source.id);assert.match(source.sourceURL,/^https:\/\//);assert.ok(['healthy','unavailable'].includes(source.status));
  if(!source.baseline){assert.equal(source.latestState,null);continue;}
  const blobs=new Map();
  for(const ref of [source.baseline,source.latestState,...source.observations,...source.events]){
   assert.ok(ref.url.startsWith('/st-louis/history/'));assert.ok(!ref.url.includes('..'));
   const raw=await readFile(new URL(ref.url.slice('/st-louis/'.length),base));assert.equal(hash(raw),ref.sha256);assert.equal(raw.length,ref.bytes);blobs.set(ref.url,JSON.parse(raw));
  }
  const baseline=blobs.get(source.baseline.url),latest=blobs.get(source.latestState.url);
  assert.equal(baseline.schema,'property-observation-state-v1');assert.equal(baseline.sourceId,source.id);assert.deepEqual(latest.fields,baseline.fields);
  assert.equal(baseline.rows.length,source.baseline.recordCount);assert.equal(latest.rows.length,source.recordCount);
  assert.equal(source.semanticSha256,source.latestState.sha256);
  assert.equal(source.observations.filter(r=>r.baseline).length,1);
  let previous=null;const ownership=source.id==='st-louis-county-business-name-indicators';
  const stateKey=row=>ownership?`st-louis-county-current:${row[1]}:${row[0]}`:row[0];
  const reconstructed=new Map(baseline.rows.map(row=>[stateKey(row),row]));
  for(const ref of source.events){const eventFile=blobs.get(ref.url);assert.equal(eventFile.schema,'property-observation-events-v1');assert.equal(eventFile.id,ref.id);assert.equal(eventFile.sourceId,source.id);assert.equal(eventFile.events.length,ref.eventCount);assert.equal(eventFile.previousPartitionSha256,previous);previous=ref.sha256;
   for(const event of eventFile.events){assert.equal(event.sourceId,source.id);assert.ok(event.before||event.after);assert.match(event.kind,/^(owner|source-record)-observation-/);assert.ok(Number.isFinite(Date.parse(event.observedAt)));assert.ok(!['acquisition','purchase','sale'].includes(event.kind));
    if(event.before){const key=ownership?event.before.recordKey:event.before.id;assert.deepEqual(reconstructed.get(key),baseline.fields.map(k=>event.before[k]));reconstructed.delete(key);}
    if(event.after){const key=ownership?event.after.recordKey:event.after.id;assert.ok(!reconstructed.has(key));reconstructed.set(key,baseline.fields.map(k=>event.after[k]));}
   }
  }
  assert.deepEqual([...reconstructed].sort((a,b)=>a[0].localeCompare(b[0])),latest.rows.map(row=>[stateKey(row),row]).sort((a,b)=>a[0].localeCompare(b[0])),'Baseline plus every immutable delta reconstructs current state exactly');
  if(source.id==='st-louis-county-business-name-indicators'){
   assert.equal(source.baseline.recordCount,50307,'Fixed initial baseline; fresh counts may legitimately differ');
   assert.deepEqual(baseline.fields,['sourceObjectId','parcelId','ownerName','longitude','latitude']);
   assert.equal(source.baselineObservedAt,'2026-09-12T18:29:23.745785+00:00');
   assert.equal(blobs.get(source.observations.find(r=>r.baseline).url).eventCount,0);
   initialBytes=source.baseline.bytes+source.latestState.bytes;
  }
 }
 assert.ok(initialBytes>0&&initialBytes<20_000_000,'Baseline and latest state stay under the initial storage budget');
});

test('entity evidence preserves issuer statements and an unresolved exact parcel candidate without PE inference',async()=>{
 const registry=await load('entities/registry.json');assert.equal(registry.schema,'property-entity-evidence-v1');
 const sources=new Map(registry.sources.map(r=>[r.id,r])),entities=new Map(registry.entities.map(r=>[r.id,r]));
 for(const source of sources.values()){assert.match(source.url,/^https:\/\//);assert.ok(Number.isFinite(Date.parse(source.accessedAt)));}
 for(const edge of registry.relationships){assert.equal(edge.status,'documented-issuer-claim');assert.ok(sources.has(edge.sourceId));assert.ok(entities.has(edge.subjectId)&&entities.has(edge.objectId));assert.equal(edge.effectiveFrom,null);assert.equal(edge.effectiveTo,null);}
 const candidate=registry.parcelCandidates[0];assert.equal(candidate.status,'unresolved');assert.equal(candidate.recordKey,`st-louis-county-current:${candidate.parcelId}:${candidate.sourceObjectId}`);assert.ok(entities.has(candidate.candidateEntityId));assert.equal(candidate.acquisitionDate,null);assert.match(candidate.requiredEvidence.join(' '),/deed/);
 assert.ok(registry.entities.every(e=>e.classifications.every(c=>c.kind!=='private-equity')));
 assert.match(registry.limitations.join(' '),/not proof of common control/);
});

test('collector enforces idempotency, literal changes, failure retention, atomic interruption and hostile-identity guards',()=>{
 const local=process.platform==='darwin';const command=local?'uv':'python3';
 const args=local?['run','--no-project','python','tests/unit/property_history_test.py']:['tests/unit/property_history_test.py'];
 const result=spawnSync(command,args,{cwd:new URL('../../',import.meta.url),encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
});
