const SOURCE_ID='st-louis-city-water-materials', LAYER_ID='water-materials';
const MANIFEST='/st-louis/utilities/manifest.json';
export const WATER_MATERIAL_COLORS=Object.freeze({'lead':'#bb5279','galvanized-replacement':'#e39759','unknown':'#a0aab4','non-lead':'#77cbd3'});
const statuses=Object.keys(WATER_MATERIAL_COLORS);
const fields=['utilityMaterial','utilityEvidence','utilityStatus','customerMaterial','customerEvidence','customerStatus'];
const rawFields=['utilmaterial','utilsource','utilstatus','custmaterial','custsource','custstatus'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const count=x=>Number.isSafeInteger(x)&&x>=0;
const normalized=x=>typeof x==='string'?x.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' '):'';
const validBounds=b=>Array.isArray(b)&&b.length===4&&b.every(finite)&&b[0]<b[2]&&b[1]<b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const inside=(r,b)=>r.longitude>=b[0]&&r.longitude<=b[2]&&r.latitude>=b[1]&&r.latitude<=b[3];
const path=p=>typeof p==='string'&&/^\/st-louis\/utilities\/[\w/.-]+\.json$/.test(p)&&!p.includes('..');
const https=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(d)&&Number.isFinite(Date.parse(d));
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
function withSignal(promise,signal){
 aborted(signal);if(!signal)return promise;
 return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});
 promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}
function tallyValid(tally,total){return tally&&typeof tally==='object'&&!Array.isArray(tally)&&Object.entries(tally).every(([k,v])=>statuses.includes(k)&&count(v))&&Object.values(tally).reduce((a,b)=>a+b,0)===total;}
function dominant(tally){return statuses.reduce((best,key)=>(tally[key]||0)>(tally[best]||0)?key:best,'unknown');}
function expectedStatus(row){
 if(row.utilityStatus.code===1||row.customerStatus.code===1||row.utilityMaterial.code===109||row.customerMaterial.code===109)return 'lead';
 if(row.utilityStatus.code===3||row.customerStatus.code===3)return 'galvanized-replacement';
 return row.utilityStatus.code===2&&row.customerStatus.code===2?'non-lead':'unknown';
}
function point(raw,manifest){
 if(!Number.isSafeInteger(raw?.sourceObjectId)||raw.sourceObjectId<1||raw.id!==`${SOURCE_ID}:${raw.sourceObjectId}`||raw.sourceId!==SOURCE_ID||raw.jurisdiction!=='st-louis-city'||raw.recordKey!==null||raw.parcelKey!==null||raw.parcelJoinStatus!=='not-established')throw Error('Water source identity cannot be verified.');
 if(raw.sourceGlobalId!==null&&!/^\{?[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\}?$/i.test(raw.sourceGlobalId))throw Error('Water source GlobalID cannot be verified.');
 if(raw.address!==null&&(typeof raw.address!=='string'||raw.address.length>500||raw.address.includes('@')))throw Error('Water address cannot be verified.');
 if(!finite(raw.longitude)||!finite(raw.latitude)||Math.abs(raw.longitude)>180||Math.abs(raw.latitude)>90)throw Error('Water point location cannot be verified.');
 const row={id:raw.id,sourceId:SOURCE_ID,sourceObjectId:raw.sourceObjectId,sourceGlobalId:raw.sourceGlobalId,address:raw.address,longitude:raw.longitude,latitude:raw.latitude,
  jurisdiction:'st-louis-city',recordKey:null,parcelKey:null,parcelJoinStatus:'not-established',status:raw.status};
 fields.forEach((field,i)=>{const code=raw[field]?.code;
  if(code!==null&&!['string','number'].includes(typeof code)||typeof code==='number'&&!finite(code))throw Error('Water material code is malformed.');
  const entry=manifest.domains[rawFields[i]].find(x=>x.code===code);
  const label=entry?.label??(code===null?'Not supplied':`Unrecognized source code (${code})`);
  if(raw[field]?.label!==label||raw[field]?.recognized!==Boolean(entry))throw Error('Water code label differs from the source domain.');
  row[field]={code,label,recognized:Boolean(entry)};
 });
 if(!statuses.includes(row.status)||expectedStatus(row)!==row.status)throw Error('Water source category cannot be verified.');
 const sourceURL=manifest.source.viewerUrl;
 return {...row,kind:'utility',layerId:LAYER_ID,title:row.address||`City water inventory ${row.sourceObjectId}`,
  color:WATER_MATERIAL_COLORS[row.status],pixelSize:7,value:null,date:null,dateBasis:'inventory-observation-not-installation',
  sourceURL,sourceUrl:sourceURL,sourceUpdatedAt:manifest.source.sourceDataEditedAt??null,retrievedAt:manifest.retrievedAt,original:row};
}
function cell(bounds,tally,key,manifest,options={}){
 const amount=Object.values(tally).reduce((a,b)=>a+b,0),status=dominant(tally);
 return {id:`utility-cell:${key}`,kind:'activity-cell',layerId:LAYER_ID,bounds:[...bounds],longitude:(bounds[0]+bounds[2])/2,latitude:(bounds[1]+bounds[3])/2,
  count:amount,status,statusCounts:{...tally},value:null,title:`${amount.toLocaleString()} water-material records`,address:null,
  color:WATER_MATERIAL_COLORS[status],pixelSize:12,colorBasis:'most-common-inventory-status',date:null,dateBasis:'inventory-observation-not-installation',
  sourceURL:manifest.source.viewerUrl,sourceUrl:manifest.source.viewerUrl,retrievedAt:manifest.retrievedAt,original:{statusCounts:{...tally},count:amount},...options};
}
function aggregate(records,manifest,level){
 if(level==='properties'&&records.length<=2000)return records;
 for(let step=0;step<18;step++){
  const size=manifest.gridDegrees*2**step,groups=new Map();
  for(const r of records){const x=Math.floor(r.longitude/size),y=Math.floor(r.latitude/size),key=`${x}_${y}_${step}`;
   let group=groups.get(key);if(!group){group={bounds:[x*size,y*size,(x+1)*size,(y+1)*size],tally:{}};groups.set(key,group);}
   for(const [status,n]of Object.entries(r.kind==='activity-cell'?r.statusCounts:{[r.status]:1}))group.tally[status]=(group.tally[status]||0)+n;
  }
  if(groups.size<=2000)return [...groups].map(([key,g])=>cell(g.bounds,g.tally,key,manifest));
 }
 throw Error('Water visualization exceeds its cell budget.');
}

/** Public City material inventory only. Shared immutable downloads, exact OID
 * validation, bounded point detail and count-preserving overview cells. Material
 * status is not water quality or proof of a parcel's utility connection. */
export function createPropertyUtilitiesData({fetchImpl=(...args)=>fetch(...args),timeoutMs=20000,maxBytes=16000000,cacheBytes=32000000,
 detailLimit=6000,tileLimit=12}={}){
 const cache=new Map(),prepared=new WeakMap(),controllers=new Set(),lifecycle=new AbortController();let bytesHeld=0,disposed=false;
 function read(url,expected){
  if(disposed)return Promise.reject(new DOMException('Aborted','AbortError'));
  if(!path(url))return Promise.reject(Error('Water source path is invalid.'));
  const key=url+'#'+(expected?.sha256||'');
  if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry.promise;}
  const controller=new AbortController();controllers.add(controller);const entry={bytes:0,promise:null};let timer;
  const work=(async()=>{const response=await fetchImpl(url,{signal:controller.signal});if(!response.ok)throw Error('Water inventory source is unavailable.');
   if(Number(response.headers?.get?.('content-length'))>maxBytes)throw Error('Water source exceeds its size budget.');
   const text=await response.text(),bytes=new TextEncoder().encode(text);if(bytes.length>maxBytes||expected&&bytes.length!==expected.bytes)throw Error('Water source byte count cannot be verified.');
   if(expected?.sha256){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw Error('Water source digest differs from its manifest.');}
   const value=JSON.parse(text);if(cache.get(key)===entry){entry.bytes=bytes.length;bytesHeld+=bytes.length;for(const[k,old]of cache){if(bytesHeld<=cacheBytes)break;if(old.bytes){cache.delete(k);bytesHeld-=old.bytes;}}}return value;
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Water source timed out.'));},timeoutMs);});
  entry.promise=Promise.race([work,deadline]).catch(error=>{if(cache.get(key)===entry){cache.delete(key);bytesHeld-=entry.bytes;}throw error;}).finally(()=>{clearTimeout(timer);controllers.delete(controller);});cache.set(key,entry);return entry.promise;
 }
 function manifestData(raw){
  if(prepared.has(raw))return prepared.get(raw);
  if(raw?.schema!=='property-utilities-manifest-v1'||raw.layerId!==LAYER_ID||raw.source?.id!==SOURCE_ID||!date(raw.retrievedAt)||raw.source.retrievedAt!==raw.retrievedAt||!https(raw.source.viewerUrl)||!https(raw.source.url)||!Array.isArray(raw.tiles)||raw.tiles.length>2000||!finite(raw.gridDegrees)||raw.gridDegrees<=0||raw.gridDegrees>1||!count(raw.recordCount)||raw.recordCount>200000||!count(raw.mappedCount)||!count(raw.unlocatedCount)||raw.mappedCount+raw.unlocatedCount!==raw.recordCount||!tallyValid(raw.statusCounts,raw.recordCount))throw Error('Water inventory manifest cannot be verified.');
  if(!rawFields.every(key=>Array.isArray(raw.domains?.[key])&&raw.domains[key].length&&raw.domains[key].every(d=>['string','number'].includes(typeof d.code)&&typeof d.label==='string')&&new Set(raw.domains[key].map(d=>d.code)).size===raw.domains[key].length))throw Error('Water source code domains are unavailable.');
  const expectedStatusLabels={0:'Unknown',1:'Lead',2:'Non-Lead',3:'Galvanized Requiring Replacement'};
  if(['utilstatus','custstatus'].some(key=>raw.domains[key].length!==4||raw.domains[key].some(d=>typeof d.code!=='number'||expectedStatusLabels[d.code]!==d.label))||['utilmaterial','custmaterial'].some(key=>raw.domains[key].find(d=>d.code===109)?.label!=='Lead - LP'))throw Error('Water classification definitions have changed.');
  const seen=new Set();let total=0;
  for(const t of raw.tiles){if(!/^-?\d+_-?\d+$/.test(t.id)||seen.has(t.id)||!validBounds(t.bounds)||!path(t.url)||!count(t.count)||!tallyValid(t.statusCounts,t.count)||!count(t.bytes)||t.bytes>maxBytes||!/^[a-f0-9]{64}$/.test(t.sha256))throw Error('Water tile manifest cannot be verified.');seen.add(t.id);total+=t.count;}
  if(total!==raw.mappedCount||!path(raw.searchIndex?.url)||raw.searchIndex.count!==raw.recordCount||!count(raw.searchIndex.bytes)||!/^[a-f0-9]{64}$/.test(raw.searchIndex.sha256))throw Error('Water manifest totals cannot be verified.');
  prepared.set(raw,raw);return raw;
 }
 async function loadTile(tile,manifest,signal){
  const raw=await withSignal(read(tile.url,tile),signal);aborted(signal);
  if(prepared.has(raw))return prepared.get(raw);
  if(raw?.schema!=='property-utilities-tile-v1'||raw.sourceId!==SOURCE_ID||raw.id!==tile.id||raw.retrievedAt!==manifest.retrievedAt||!Array.isArray(raw.records)||raw.records.length!==tile.count)throw Error('Water tile identity cannot be verified.');
  const rows=raw.records.map(r=>point(r,manifest));const ids=new Set(),tally={};
  for(const r of rows){if(ids.has(r.id)||`${Math.floor(r.longitude/manifest.gridDegrees)}_${Math.floor(r.latitude/manifest.gridDegrees)}`!==tile.id)throw Error('Water point belongs to another source tile.');ids.add(r.id);tally[r.status]=(tally[r.status]||0)+1;}
  if(statuses.some(s=>(tally[s]||0)!==(tile.statusCounts[s]||0)))throw Error('Water tile categories differ from the manifest.');
  prepared.set(raw,rows);return rows;
 }
 async function searchCounts(manifest,tiles,words,material,signal){
  const raw=await withSignal(read(manifest.searchIndex.url,manifest.searchIndex),signal);aborted(signal);
  let rows=prepared.get(raw);
  if(!rows){
   if(raw?.schema!=='property-utilities-search-v1'||raw.sourceId!==SOURCE_ID||raw.retrievedAt!==manifest.retrievedAt||JSON.stringify(raw.fields)!==JSON.stringify(['sourceObjectId','address','tileId','status'])||!Array.isArray(raw.rows)||raw.rows.length!==manifest.recordCount)throw Error('Water address index cannot be verified.');
   const seen=new Set(),known=new Set(manifest.tiles.map(t=>t.id)),counts=new Map();let unlocated=0;
   rows=raw.rows.map(r=>{if(!Array.isArray(r)||r.length!==4||!Number.isSafeInteger(r[0])||r[0]<1||seen.has(r[0])||r[1]!==null&&typeof r[1]!=='string'||r[2]!==null&&!known.has(r[2])||!statuses.includes(r[3]))throw Error('Water search identity cannot be verified.');seen.add(r[0]);if(r[2]===null)unlocated++;else{const tally=counts.get(r[2])||{};tally[r[3]]=(tally[r[3]]||0)+1;counts.set(r[2],tally);}return {oid:r[0],text:normalized(r[1]),tileId:r[2],status:r[3]};});
   if(unlocated!==manifest.unlocatedCount||manifest.tiles.some(t=>statuses.some(s=>(counts.get(t.id)?.[s]||0)!==(t.statusCounts[s]||0))))throw Error('Water search totals differ from the manifest.');
   prepared.set(raw,rows);
  }
  const visible=new Set(tiles.map(t=>t.id)),counts=new Map();let unlocated=0;
  for(const row of rows){if(material!=='all'&&row.status!==material||!words.every(w=>row.text.includes(w)))continue;if(row.tileId===null){unlocated++;continue;}if(!visible.has(row.tileId))continue;const tally=counts.get(row.tileId)||{};tally[row.status]=(tally[row.status]||0)+1;counts.set(row.tileId,tally);}
  return {counts,unlocated};
 }
 async function query({bounds,level='areas',query='',material='all',signal}={}){
  if(!validBounds(bounds)||!['areas','properties'].includes(level)||!['all',...statuses].includes(material)||typeof query!=='string'||query.length>200)throw new RangeError('Invalid water inventory query.');
  const combined=signal?AbortSignal.any([signal,lifecycle.signal]):lifecycle.signal;aborted(combined);
  let manifest;
  try{
   manifest=manifestData(await withSignal(read(MANIFEST),combined));aborted(combined);
   const tiles=manifest.tiles.filter(t=>intersects(t.bounds,bounds)),words=normalized(query).split(' ').filter(Boolean);
   const broad=level==='areas'||tiles.length>tileLimit||tiles.reduce((n,t)=>n+t.count,0)>detailLimit;
   let records=[],failed=0,unlocated=0;
   if(broad){
    const found=words.length?await searchCounts(manifest,tiles,words,material,combined):null;
    for(const t of tiles){const tally=found?found.counts.get(t.id):Object.fromEntries(Object.entries(t.statusCounts).filter(([s])=>material==='all'||s===material));if(tally&&Object.values(tally).some(Boolean))records.push(cell(t.bounds,tally,t.id,manifest,{aggregation:'source-grid-cell',query:query||null}));}
    unlocated=found?.unlocated||0;
   }else{
    for(let i=0;i<tiles.length;i+=4){const results=await Promise.allSettled(tiles.slice(i,i+4).map(t=>loadTile(t,manifest,combined)));aborted(combined);
     for(const result of results){if(result.status==='rejected'){failed++;continue;}records.push(...result.value.filter(r=>inside(r,bounds)&&(material==='all'||r.status===material)&&words.every(w=>normalized(r.address).includes(w))));}}
    if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('Duplicate water identities across source tiles.');
   }
   const mapped=records.reduce((n,r)=>n+(r.kind==='activity-cell'?r.count:1),0),features=aggregate(records,manifest,level);
   const coverage=`${manifest.coverage} ${broad?'Counts describe source grid cells intersecting this view; zoom in for point details.':'Point records are filtered to this exact map window.'}`;
   const layer={id:LAYER_ID,label:'Water service-line materials',status:failed?'partial':'ready',partial:failed>0,coverage,
    count:mapped,mappedCount:mapped,unmappedCount:0,sourceUnmappedCount:manifest.unlocatedCount,matchingUnlocatedCount:unlocated,
    sourceCount:manifest.recordCount,source:manifest.source,retrievedAt:manifest.retrievedAt,failedTiles:failed,
    material,aggregation:broad?'source-grid-cell':'source-points',searchApplied:words.length>0,dateFilterApplied:false};
   return {records,features,layers:[layer],partial:failed>0,counts:{records:mapped,mappedRecords:mapped,unmappedRecords:0,visualFeatures:features.length},coverage:[{id:LAYER_ID,coverage,status:layer.status}]};
  }catch(error){aborted(combined);return {records:[],features:[],layers:[{id:LAYER_ID,label:'Water service-line materials',status:'unavailable',partial:true,coverage:'City water inventory could not be verified; no claim of an empty area.',count:0,mappedCount:0,unmappedCount:0,source:manifest?.source||null,retrievedAt:manifest?.retrievedAt||null,error:error.message}],partial:true,counts:{records:0,mappedRecords:0,unmappedRecords:0,visualFeatures:0}};}
 }
 return {query,async directory({signal}={}){const combined=signal?AbortSignal.any([signal,lifecycle.signal]):lifecycle.signal;const raw=await withSignal(read('/st-louis/utilities/directory.json'),combined);if(raw?.schema!=='property-utility-directory-v1'||!Array.isArray(raw.entries)||raw.entries.some(r=>r.access!=='source-link'||!https(r.url)))throw Error('Utility source links cannot be verified.');return raw;},
  clear(){cache.clear();bytesHeld=0;},dispose(){disposed=true;lifecycle.abort();for(const c of controllers)c.abort();cache.clear();bytesHeld=0;}};
}
