import {BANK_VERSION,buildBank} from '../../src/lib/econ-practice/index.mjs';
import {query,all,hash,iso,requireValue} from './common.mjs';
async function prepare(version,items){
 requireValue(typeof version==='string'&&version.length>0&&items.length>0,'Invalid bank archive.',500);
 const groups=new Map(),ids=new Set();
 for(const item of items){
  requireValue(item.version===version&&!ids.has(item.id),'Invalid or duplicate archived item.',500);ids.add(item.id);
  const key=JSON.stringify([item.course,item.unit]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);
 }
 const chunks=[];
 for(const [key,group] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const [course,unit]=JSON.parse(key),json=JSON.stringify(group.sort((a,b)=>a.id.localeCompare(b.id)));
  requireValue(new TextEncoder().encode(json).length<=512*1024,'Bank archive chunk exceeds the configured size limit.',500);
  chunks.push({course,unit,count:group.length,sha256:await hash(json),json});
 }
 const manifest=JSON.stringify({version,itemCount:items.length,chunks:chunks.map(({json,...metadata})=>metadata)});
 return {version,chunks,manifest,digest:await hash(manifest)};
}
let current;
export async function ensureCurrentBank(db){current??=prepare(BANK_VERSION,buildBank());return registerPrepared(db,await current);}
export async function registerBank(db,version,items){return registerPrepared(db,await prepare(version,items));}
async function registerPrepared(db,prepared){
 const {version,chunks,manifest,digest}=prepared;
 let existing=await query(db,'SELECT manifest_sha256 FROM bank_versions WHERE version=?',version).first();
 if(!existing){
  await db.batch([
   query(db,"INSERT INTO bank_versions (version,manifest_json,manifest_sha256,created_at) VALUES (?,?,?,?) ON CONFLICT(version) DO NOTHING",version,manifest,digest,iso()),
   ...chunks.map(c=>query(db,'INSERT INTO bank_chunks (version,course,unit,items_json) SELECT ?,?,?,? FROM bank_versions WHERE version=? AND manifest_sha256=? ON CONFLICT(version,course,unit) DO NOTHING',version,c.course,c.unit,c.json,version,digest))
  ]);
  existing=await query(db,'SELECT manifest_sha256 FROM bank_versions WHERE version=?',version).first();
 }
 requireValue(existing?.manifest_sha256===digest,'Bank content changed without a new version. New sessions are unavailable.',503);
 return version;
}
export async function archivedBank(db,version,course){
 const record=await query(db,'SELECT * FROM bank_versions WHERE version=?',version).first();
 requireValue(record,'The original question bank is unavailable. This session has not been completed; please retry after it is restored.',503);
 requireValue(await hash(record.manifest_json)===record.manifest_sha256,'Bank manifest integrity check failed.',503);
 const manifest=JSON.parse(record.manifest_json),expected=manifest.chunks.filter(c=>c.course===course);
 const chunks=await all(db,'SELECT unit,items_json FROM bank_chunks WHERE version=? AND course=? ORDER BY unit',version,course);
 requireValue(expected.length>0&&chunks.length===expected.length,'The original question bank is incomplete.',503);
 const items=[];
 for(const chunk of chunks){const metadata=expected.find(c=>c.unit===chunk.unit);requireValue(metadata&&await hash(chunk.items_json)===metadata.sha256,'Bank chunk integrity check failed.',503);const parsed=JSON.parse(chunk.items_json);requireValue(parsed.length===metadata.count,'Bank item count mismatch.',503);items.push(...parsed);}
 return items;
}
