import { PROPERTY_INFRASTRUCTURE_LAYERS } from './property-infrastructure-catalog.mjs';
const MANIFEST='/st-louis/infrastructure/manifest.json';
const catalog=new Map(PROPERTY_INFRASTRUCTURE_LAYERS.map(x=>[x.id,x]));
const SOURCES={'city-streetlights':{id:'stl-city-public-streetlights',url:'https://maps8.stlouis-mo.gov/arcgis/rest/services/STREETS/Streets_Permitting/MapServer',layers:[2]},'city-capital-projects':{id:'stl-city-capital-improvement-projects',url:'https://maps8.stlouis-mo.gov/arcgis/rest/services/Capital_Improvement_Projects/MapServer',layers:[0,1,2,3,4]}};
const ATTRIBUTE_FIELDS=['LightID','Lighting_Type','Light_Type','Light_Source','LED_Powered','Date_Installed','Verification_Date','NAME','Name','Name_Locations','Location','Type','Ward','Wards','Status'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const box=b=>Array.isArray(b)&&b.length===4&&b.every(finite)&&b[0]<=b[2]&&b[1]<=b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const inside=(p,b)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
const safeDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
const path=x=>x===MANIFEST||typeof x==='string'&&/^\/st-louis\/infrastructure\/(city-streetlights|city-capital-projects)\/(projects|-?\d+_-?\d+)\.geojson$/.test(x);
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
function signalPromise(promise,signal){aborted(signal);if(!signal)return promise;return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
const text=(value,max=500)=>value===null||typeof value==='string'&&value.length<=max;
function sourceLink(value,source,layer){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&((['stlouis-mo.gov','www.stlouis-mo.gov'].includes(u.hostname))||u.href===source.url+'/'+layer);}catch{return false;}
}
function geometry(raw){
 if(!raw||!['Point','LineString','MultiLineString'].includes(raw.type))throw Error('Infrastructure geometry type cannot be verified.');
 const lines=raw.type==='Point'?[[raw.coordinates]]:raw.type==='LineString'?[raw.coordinates]:raw.coordinates;
 if(!Array.isArray(lines)||!lines.length||lines.length>10000||lines.some(line=>!Array.isArray(line)||line.length<(raw.type==='Point'?1:2)))throw Error('Infrastructure geometry is malformed.');
 const points=lines.flat();if(points.length>100000||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('Infrastructure coordinates cannot be verified.');
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return {value:raw,points,lines,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],count:points.length};
}
// Liang–Barsky clips a segment to the exact query rectangle. Bounding-box-only
// matching would incorrectly include diagonal corridors that miss the view.
function segment(a,b,rect){let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const[p,q]of[[-dx,a[0]-rect[0]],[dx,rect[2]-a[0]],[-dy,a[1]-rect[1]],[dy,rect[3]-a[1]]]){if(p===0){if(q<0)return false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return true;}
function hits(record,bounds){const g=record._shape;if(!intersects(g.bounds,bounds))return false;if(g.value.type==='Point')return inside(g.points[0],bounds);return g.lines.some(line=>line.some((p,i)=>i>0&&segment(line[i-1],p,bounds)));}
function manifestData(raw){
 if(raw?.schema!=='property-infrastructure-manifest-v1'||!Array.isArray(raw.layers)||raw.layers.length!==Object.keys(SOURCES).length)throw Error('Infrastructure manifest cannot be verified.');
 const seen=new Set();
 for(const layer of raw.layers){const expected=SOURCES[layer?.id];if(!expected||seen.has(layer.id)||layer.available!==true||layer.source?.id!==expected.id||layer.source.url!==expected.url||!safeDate(layer.source.retrievedAt)||layer.source.sourceDataEditedAt!==null||layer.source.exactObjectIdsVerified!==true||layer.source.sourceObjectIdsRechecked!==true||layer.source.sourceEditingEpochAvailable!==false||!integer(layer.recordCount)||layer.recordCount>100000||!integer(layer.mappedCount)||!integer(layer.unmappedCount)||layer.mappedCount+layer.unmappedCount!==layer.recordCount||!Array.isArray(layer.tiles)||layer.tiles.length>2000||!text(layer.coverage,2000)||!text(layer.meaning,2000)||layer.mappedCount&& !box(layer.bounds))throw Error('Infrastructure source identity or coverage cannot be verified.');
  seen.add(layer.id);let total=0;const ids=new Set();
  for(const t of layer.tiles){const validId=layer.id==='city-streetlights'?/^-?\d+_-?\d+$/.test(t.id):t.id==='projects';if(!validId||ids.has(t.id)||t.url!==`/st-louis/infrastructure/${layer.id}/${t.id}.geojson`||!path(t.url)||!box(t.bounds)||!integer(t.count)||!t.count||!integer(t.coordinateCount)||t.coordinateCount<t.count||!integer(t.bytes)||t.bytes>16000000||!/^[a-f0-9]{64}$/.test(t.sha256)||!Array.isArray(t.geometryTypes)||!t.geometryTypes.length||t.geometryTypes.some(x=>!['Point','LineString','MultiLineString'].includes(x)))throw Error('Infrastructure tile metadata cannot be verified.');ids.add(t.id);total+=t.count;}
  if(total!==layer.mappedCount||layer.id==='city-streetlights'&&(layer.gridDegrees!==.01||layer.tiles.some(t=>t.geometryTypes.length!==1||t.geometryTypes[0]!=='Point')))throw Error('Infrastructure manifest totals cannot be verified.');
 }
 return raw;
}
function normalize(raw,layer,tile){
 if(raw?.schema!=='property-infrastructure-geojson-v1'||raw.type!=='FeatureCollection'||raw.layerId!==layer.id||raw.sourceId!==layer.source.id||raw.tileId!==tile.id||raw.retrievedAt!==layer.source.retrievedAt||!Array.isArray(raw.features)||raw.features.length!==tile.count)throw Error('Infrastructure tile identity cannot be verified.');
 const ids=new Set();let coordinates=0;const kinds=new Set();
 const result=raw.features.map(f=>{const p=f?.properties,s=SOURCES[layer.id];if(f?.type!=='Feature'||!p||!Number.isSafeInteger(p.sourceObjectId)||p.sourceObjectId<1||!s.layers.includes(p.sourceLayerId)||p.id!==`${s.id}:${p.sourceLayerId}:${p.sourceObjectId}`||f.id!==p.id||ids.has(p.id)||!text(p.title)||!p.title||!text(p.address)||!sourceLink(p.sourceURL,s,p.sourceLayerId)||!p.attributes||typeof p.attributes!=='object'||Array.isArray(p.attributes)||Object.entries(p.attributes).some(([key,value])=>!ATTRIBUTE_FIELDS.includes(key)||!(text(value)||finite(value))))throw Error('Infrastructure record source identity cannot be verified.');
  const g=geometry(f.geometry);if(g.points.some(point=>!inside(point,tile.bounds)))throw Error('Infrastructure geometry is outside its declared source tile.');
  if(layer.id==='city-streetlights'&&(g.value.type!=='Point'||`${Math.floor(g.points[0][0]/.01)}_${Math.floor(g.points[0][1]/.01)}`!==tile.id))throw Error('Street-light point belongs to another tile.');
  ids.add(p.id);coordinates+=g.count;kinds.add(g.value.type);const nav=g.points[Math.floor(g.points.length/2)];
  const original={id:p.id,sourceId:s.id,sourceObjectId:p.sourceObjectId,sourceLayerId:p.sourceLayerId,attributes:{...p.attributes},recordKey:null,parcelKey:null,parcelJoinStatus:'not-established'};
  return {...original,kind:'infrastructure',layerId:layer.id,title:p.title,address:p.address,longitude:nav[0],latitude:nav[1],geometry:g.value,_shape:g,
   geometryRole:g.value.type==='Point'?'source-point':'source-project-corridor',navigationPointBasis:g.value.type==='Point'?'source-point':'middle-source-vertex-not-parcel-location',
   sourceURL:p.sourceURL,sourceUrl:p.sourceURL,date:null,dateBasis:'no-verified-activity-date',retrievedAt:layer.source.retrievedAt,sourceUpdatedAt:null,
   color:catalog.get(layer.id).color,pixelSize:6,value:null,original};
 });
 if(coordinates!==tile.coordinateCount||JSON.stringify([...kinds].sort())!==JSON.stringify([...tile.geometryTypes].sort()))throw Error('Infrastructure geometry totals differ from the manifest.');
 return result;
}
function cell(layer,bounds,count,key,aggregation){const longitude=(bounds[0]+bounds[2])/2,latitude=(bounds[1]+bounds[3])/2;return {id:`infrastructure-cell:${layer.id}:${key}`,kind:'activity-cell',layerId:layer.id,title:`${count.toLocaleString()} ${catalog.get(layer.id).label.toLowerCase()}`,count,bounds,longitude,latitude,geometry:{type:'Point',coordinates:[longitude,latitude]},geometryRole:'inventory-count-cell',aggregation,color:catalog.get(layer.id).color,pixelSize:11,value:null,date:null,dateBasis:'no-verified-activity-date',sourceURL:layer.source.url,sourceUrl:layer.source.url,retrievedAt:layer.source.retrievedAt,original:{count,aggregation,recordKey:null,parcelKey:null}};}
function compactCells(cells,layer,limit){
 if(cells.length<=limit)return cells;
 for(let step=0;step<18;step++){const size=.02*2**step,groups=new Map();for(const c of cells){const key=`${Math.floor(c.longitude/size)}_${Math.floor(c.latitude/size)}`;let g=groups.get(key);if(!g){g={count:0,bounds:[...c.bounds]};groups.set(key,g);}g.count+=c.count;g.bounds=[Math.min(g.bounds[0],c.bounds[0]),Math.min(g.bounds[1],c.bounds[1]),Math.max(g.bounds[2],c.bounds[2]),Math.max(g.bounds[3],c.bounds[3])];}if(groups.size<=limit)return [...groups].map(([key,g])=>cell(layer,g.bounds,g.count,key,'combined-source-grid-cells'));}
 throw Error('Infrastructure count-cell budget cannot be met.');
}
const publicRecord=({_shape,...record})=>record;

/** Same-origin, integrity-checked public source snapshots. Point overviews retain
 * every contributing count; detailed geometry is never silently truncated. */
export function createPropertyInfrastructureData({fetchImpl=(...args)=>fetch(...args),timeoutMs=15000,maxBytes=16000000,cacheBytes=32000000,detailLimit=6000,tileLimit=12,maxFeatures=1500,maxCoordinates=15000}={}){
 const cache=new Map(),sizes=new Map(),prepared=new WeakMap(),controllers=new Set(),lifecycle=new AbortController();let disposed=false,bytesHeld=0;
 function drop(key){cache.delete(key);bytesHeld-=sizes.get(key)||0;sizes.delete(key);}
 function evict(url,expected,promise){const key=url+'#'+(expected?.sha256||'');if(cache.get(key)===promise)drop(key);}
 function read(url,expected){if(disposed)return Promise.reject(new DOMException('Aborted','AbortError'));if(!path(url))return Promise.reject(Error('Infrastructure path is invalid.'));const key=url+'#'+(expected?.sha256||'');if(cache.has(key))return cache.get(key);
  const controller=new AbortController();controllers.add(controller);let timer;
  const work=(async()=>{const response=await fetchImpl(url,{signal:controller.signal});if(!response.ok)throw Error('Infrastructure source is unavailable.');if(Number(response.headers?.get?.('content-length'))>maxBytes)throw Error('Infrastructure source exceeds its size budget.');const body=await response.text(),bytes=new TextEncoder().encode(body);if(bytes.length>maxBytes||expected&&bytes.length!==expected.bytes)throw Error('Infrastructure source byte count cannot be verified.');if(expected){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(digest!==expected.sha256)throw Error('Infrastructure source digest differs from its manifest.');}const result=JSON.parse(body);if(cache.get(key)===promise){sizes.set(key,bytes.length);bytesHeld+=bytes.length;for(const old of cache.keys()){if(bytesHeld<=cacheBytes)break;drop(old);}}return result;})();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Infrastructure source timed out.'));},timeoutMs);});
  let promise;promise=Promise.race([work,deadline]).catch(error=>{evict(url,expected,promise);throw error;}).finally(()=>{clearTimeout(timer);controllers.delete(controller);});cache.set(key,promise);
  // Snapshots have bounded tile sizes. Limit retained downloads across map pans.
  while(cache.size>48)drop(cache.keys().next().value);return promise;
 }
 async function verified(url,expected,validate,signal){const promise=read(url,expected);try{const raw=await signalPromise(promise,signal);aborted(signal);if(prepared.has(raw))return prepared.get(raw);const value=validate(raw);prepared.set(raw,value);return value;}catch(error){if(error.name!=='AbortError')evict(url,expected,promise);throw error;}}
 async function query({layers=PROPERTY_INFRASTRUCTURE_LAYERS.filter(x=>x.available).map(x=>x.id),bounds,signal}={}){
  if(!box(bounds)||bounds[0]===bounds[2]||bounds[1]===bounds[3]||!Array.isArray(layers)||new Set(layers).size!==layers.length||layers.some(id=>!catalog.has(id)))throw new RangeError('Invalid infrastructure query.');
  const combined=signal?AbortSignal.any([signal,lifecycle.signal]):lifecycle.signal;aborted(combined);
  if(!layers.length)return {records:[],features:[],layers:[],counts:{records:0,visualFeatures:0},partial:false};
  const statuses=[],features=[];let manifest,total=0;const connected=layers.filter(id=>catalog.get(id).available),featureBudget=Math.max(1,Math.floor(maxFeatures/Math.max(1,connected.length))),coordinateBudget=Math.max(1,Math.floor(maxCoordinates/Math.max(1,connected.length)));
  if(connected.length){try{manifest=await verified(MANIFEST,null,manifestData,combined);}catch(error){aborted(combined);for(const id of connected)statuses.push({...catalog.get(id),status:'unavailable',count:0,mappedCount:0,partial:true,reason:error.message});}}
  for(const id of layers){const meta=catalog.get(id);if(!meta.available){statuses.push({...meta,status:'not-connected',count:0,mappedCount:0,partial:false});continue;}if(!manifest)continue;
   const layer=manifest.layers.find(x=>x.id===id),tiles=layer.tiles.filter(t=>intersects(t.bounds,bounds));let count=0,output=[],aggregation='source-geometry',failed=0,reason=null;
   try{
    const broad=id==='city-streetlights'&&(tiles.length>tileLimit||tiles.reduce((n,t)=>n+t.count,0)>detailLimit);
    if(broad){count=tiles.reduce((n,t)=>n+t.count,0);output=compactCells(tiles.map(t=>cell(layer,t.bounds,t.count,t.id,'source-grid-cell')),layer,Math.min(featureBudget,coordinateBudget));aggregation='source-grid-cells';reason='Counts cover complete source grid cells intersecting this view; zoom in for exact light locations.';}
    else{
     let rows=[];for(let offset=0;offset<tiles.length;offset+=2){const batch=tiles.slice(offset,offset+2),results=await Promise.allSettled(batch.map(t=>verified(t.url,t,raw=>normalize(raw,layer,t),combined)));aborted(combined);for(const result of results){if(result.status==='rejected'){failed++;reason=result.reason.message;}else rows.push(...result.value.filter(r=>hits(r,bounds)));}}
     if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Duplicate infrastructure identities across source tiles.');count=rows.length;
     if(id==='city-streetlights'&&rows.length>Math.min(featureBudget,coordinateBudget)){output=compactCells(rows.map(r=>cell(layer,[r.longitude,r.latitude,r.longitude,r.latitude],1,r.id,'exact-query-points')),layer,Math.min(featureBudget,coordinateBudget));aggregation='exact-query-point-cells';reason='Exact matching light locations are grouped into count cells at this scale.';}
     else if(rows.length>featureBudget||rows.reduce((n,r)=>n+r._shape.count,0)>coordinateBudget){aggregation='zoom-required';reason='Matching source geometry exceeds the display budget. Zoom in to inspect it; no partial corridor geometry is drawn.';}
     else output=rows.map(publicRecord);
    }
    const status=aggregation==='zoom-required'?'zoom-required':failed?(output.length?'partial':'unavailable'):'ready';
    statuses.push({id,label:meta.label,status,count,mappedCount:count,sourceCount:layer.recordCount,sourceMappedCount:layer.mappedCount,sourceUnmappedCount:layer.unmappedCount,unmappedCount:0,partial:failed>0||status==='zoom-required',failedTiles:failed,aggregation,reason,coverage:layer.coverage,meaning:layer.meaning,source:layer.source,retrievedAt:layer.source.retrievedAt});total+=count;features.push(...output);
   }catch(error){aborted(combined);statuses.push({id,label:meta.label,status:'unavailable',count:0,mappedCount:0,partial:true,reason:error.message,coverage:layer.coverage,source:layer.source});}
  }
  const partial=statuses.some(x=>x.partial);return {records:features,features,layers:statuses,counts:{records:total,mappedRecords:total,visualFeatures:features.length},partial};
 }
 return {query,clear(){cache.clear();sizes.clear();bytesHeld=0;},dispose(){disposed=true;lifecycle.abort();for(const c of controllers)c.abort();cache.clear();sizes.clear();bytesHeld=0;}};
}
