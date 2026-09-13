const PATHS={ 'planning-documents':'/st-louis/planning-documents/index.json', 'tif-districts':'/st-louis/incentives/tif-districts.json', 'tax-abatements':'/st-louis/incentives/tax-abatements.json' };
const SOURCE_URLS={ 'tif-districts':'https://static.stlouis-mo.gov/open-data/SLDC/INCENTIVES/TIF/STLTIFs.geojson', 'tax-abatements':'https://static.stlouis-mo.gov/open-data/SLDC/TAX-ABATEMENT/taxabatedparcels.geojson' };
const SOURCE_IDS={'tif-districts':'st-louis-city-tif-districts','tax-abatements':'st-louis-city-tax-abatements'};
const DOCUMENT_SOURCE_IDS=new Set(['city-planning-commission','city-preservation-board','city-tif-commission','city-capital-budget','county-planning-commission']);
const LABELS={'planning-documents':'Planning documents','tif-districts':'TIF districts','tax-abatements':'Tax abatements'};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const boundsOK=b=>Array.isArray(b)&&b.length===4&&b.every(finite)&&b[0]<b[2]&&b[1]<b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const text=x=>typeof x==='string'?x:'';
const search=x=>text(x).normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
function isoDay(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;const d=new Date(x+'T00:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===x?x:null;}
function https(x){try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&['www.stlouis-mo.gov','static.stlouis-mo.gov','stlouisco.civicweb.net'].includes(u.hostname)?u.href:null;}catch{return null;}}
const abort=signal=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
function waitFor(promise,signal){abort(signal);if(!signal)return promise;return new Promise((resolve,reject)=>{const stop=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',stop,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));});}
function dateRange(options){
 for(const k of ['fromDate','toDate'])if(options[k]!=null&&!isoDay(options[k]))throw new RangeError('Planning date filter must be a real ISO calendar date.');
 for(const k of ['fromYear','toYear'])if(options[k]!=null&&(!Number.isInteger(options[k])||options[k]<1900||options[k]>2200))throw new RangeError('Planning year filter is invalid.');
 const from=options.fromDate??(options.fromYear!=null?`${options.fromYear}-01-01`:null),to=options.toDate??(options.toYear!=null?`${options.toYear}-12-31`:null);
 if(from&&to&&from>to)throw new RangeError('Planning date range is reversed.');return {from,to,active:!!(from||to)};
}
function matchesDate(row,layer,range){
 if(!range.active)return true;
 if(layer==='tax-abatements'){
  const start=row.abatementStartYear,end=row.abatementEndYear;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start>end)return false;
  return (!range.from||end>=Number(range.from.slice(0,4)))&&(!range.to||start<=Number(range.to.slice(0,4)));
 }
 const date=isoDay(layer==='tif-districts'?row.approvalDate:row.hearingDate||row.meetingDate||row.publishedDate||row.documentDate||row.landingPagePublishedDate);
 return !!date&&(!range.from||date>=range.from)&&(!range.to||date<=range.to);
}
function normalize(layer,snapshot){
 if(layer==='planning-documents'){
  if(snapshot.schema!=='property-planning-documents-v1'||!Array.isArray(snapshot.records)||!snapshot.sources)throw Error('Planning document index cannot be verified.');
  const ids=new Set();const records=snapshot.records.map(row=>{
   const source=snapshot.sources[row.sourceId];
   if(!text(row.id)||ids.has(row.id)||!text(row.title)||!https(row.sourceURL)||!DOCUMENT_SOURCE_IDS.has(row.sourceId)||source?.id!==row.sourceId||!https(source.url)||!Number.isFinite(Date.parse(source.retrievedAt))||!row.id.startsWith(row.sourceId+':'))throw Error('Planning document identity or source is invalid.');ids.add(row.id);
   const day=isoDay(row.hearingDate||row.meetingDate||row.publishedDate||row.documentDate||row.landingPagePublishedDate);
   return {...row,layerId:layer,kind:'planning-document',longitude:null,latitude:null,bounds:null,geometry:null,geometryRole:'unmapped-document',recordKey:null,parcelKey:null,parcelId:null,date:day,
    dateBasis:row.hearingDate?'verified-hearing-date':row.meetingDate?'source-associated-meeting-date':row.publishedDate?'source-publication-date':row.documentDate?'document-date':row.landingPagePublishedDate?'landing-page-publication-date':'not-supplied',original:row};
  });return {records,source:{id:'official-planning-documents',name:LABELS[layer],url:null,retrievedAt:snapshot.retrievedAt},coverage:snapshot.coverage,partial:!!snapshot.partial||snapshot.complete===false};
 }
 if(snapshot.schema!=='property-incentive-records-v1'||snapshot.layerId!==layer||snapshot.source?.id!==SOURCE_IDS[layer]||snapshot.source?.url!==SOURCE_URLS[layer]||!Array.isArray(snapshot.records))throw Error('Incentive source identity cannot be verified.');
 const ids=new Set();const records=snapshot.records.map(row=>{
  if(!text(row.id)||ids.has(row.id)||row.sourceId!==snapshot.source.id||row.sourceURL!==snapshot.source.url||!Number.isSafeInteger(row.sourceObjectId)||row.jurisdiction!=='st-louis-city')throw Error('Incentive record identity cannot be verified.');ids.add(row.id);
  if(row.bounds!=null&&!boundsOK(row.bounds))throw Error('Incentive polygon bounds are invalid.');
  if((row.longitude!=null||row.latitude!=null)&&(!finite(row.longitude)||!finite(row.latitude)||row.longitude<-180||row.longitude>180||row.latitude<-90||row.latitude>90))throw Error('Incentive point cannot be verified.');
  if(row.recordKey!=null&&(layer!=='tax-abatements'||row.parcelJoinStatus!=='exact-identifiers-unique-in-current-snapshot'||!text(row.parcelKey)||!text(row.parcelId)))throw Error('Incentive parcel association cannot be verified.');
  return {...row,layerId:layer,kind:'incentive',date:layer==='tif-districts'?isoDay(row.approvalDate):null,dateBasis:layer==='tif-districts'?'recorded-approval-date':'recorded-abatement-year-interval',original:row};
 });return {records,source:snapshot.source,coverage:snapshot.coverage,partial:false};
}
function aggregate(features,limit){
 if(features.length<=limit)return features;
 for(let power=0;power<14;power++){
  const size=.01*2**power,cells=new Map();
  for(const r of features){const x=Math.floor(r.longitude/size),y=Math.floor(r.latitude/size),id=`planning-cell:${r.layerId}:${size}:${x}:${y}`;let cell=cells.get(id);if(!cell){const bounds=[x*size,y*size,(x+1)*size,(y+1)*size];cell={id,layerId:r.layerId,kind:'activity-cell',geometryRole:'count-cell',title:LABELS[r.layerId]+' area',count:0,bounds,longitude:(bounds[0]+bounds[2])/2,latitude:(bounds[1]+bounds[3])/2,value:null,color:r.color,pixelSize:12};cells.set(id,cell);}cell.count++;}
  if(cells.size<=limit)return [...cells.values()];
 }throw Error('Planning display budget cannot preserve all source counts.');
}
/** Source-observation timestamps never become approval or abatement-event dates. */
export function createPropertyPlanningData({fetchImpl=(...args)=>fetch(...args),timeoutMs=20000,maxBytes=16000000,maxFeatures=2000}={}){
 if(!Number.isSafeInteger(maxFeatures)||maxFeatures<1||maxFeatures>2000)throw new RangeError('Planning map feature budget must be1–2000.');
 const cache=new Map(),controllers=new Set();let disposed=false;
 function read(layer){
  if(disposed)return Promise.reject(new DOMException('Aborted','AbortError'));
  if(cache.has(layer))return cache.get(layer);
  const controller=new AbortController();controllers.add(controller);let timer;
  const operation=(async()=>{const response=await fetchImpl(PATHS[layer],{signal:controller.signal});if(!response.ok)throw Error(`${LABELS[layer]} source is unavailable.`);if(Number(response.headers?.get?.('content-length'))>maxBytes)throw Error('Planning source exceeds its byte budget.');const body=await response.text();if(new TextEncoder().encode(body).byteLength>maxBytes)throw Error('Planning source exceeds its byte budget.');return normalize(layer,JSON.parse(body));})();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error(`${LABELS[layer]} source timed out.`));controller.abort();},timeoutMs);});
  const cancelled=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  const promise=Promise.race([operation,deadline,cancelled]).catch(e=>{cache.delete(layer);throw e;}).finally(()=>{clearTimeout(timer);controllers.delete(controller);});cache.set(layer,promise);return promise;
 }
 async function query(options={}){
  abort(options.signal);if(disposed)throw new DOMException('Aborted','AbortError');
  const layers=options.layers??Object.keys(PATHS);if(!Array.isArray(layers)||new Set(layers).size!==layers.length||layers.some(id=>!Object.hasOwn(PATHS,id)))throw new RangeError('Unsupported planning layer.');
  const bounds=options.bounds??[-180,-90,180,90];if(!boundsOK(bounds))throw new RangeError('Planning bounds are invalid.');const range=dateRange(options),words=search(options.query).split(' ').filter(Boolean);
  const results=await Promise.all(layers.map(async id=>{try{
   const data=await waitFor(read(id),options.signal);abort(options.signal);
   const selected=data.records.filter(row=>{
    if(row.bounds&&!intersects(row.bounds,bounds))return false;
    if(!matchesDate(row,id,range))return false;
    const haystack=search([row.title,row.address,row.status,row.caseNumberRaw,row.ordinanceRaw,row.tifIdRaw,row.parcelIdRaw,row.parcelHandleRaw,...(row.caseIds??[])].filter(v=>v!=null).join(' '));return words.every(word=>haystack.includes(word));
   });
   const mapped=selected.filter(r=>finite(r.longitude)&&finite(r.latitude));
   return {records:selected,features:mapped.map(r=>({...r,geometry:{type:'Point',coordinates:[r.longitude,r.latitude]},geometryRole:'representative-point-of-source-polygon',color:id==='tif-districts'?'#b6a5df':'#80b8b7',pixelSize:9})),summary:{id,label:LABELS[id],status:data.partial?'partial':selected.length&&!mapped.length?'unmapped':'ready',count:selected.length,mappedCount:mapped.length,unmappedCount:selected.length-mapped.length,sourceCount:data.records.length,source:data.source,coverage:data.coverage,partial:data.partial,dateFilterApplied:range.active,dateBasis:id==='tax-abatements'?'recorded-year-interval-overlap':id==='tif-districts'?'recorded-approval-date':'verified-document-event-or-publication-date',datePrecision:id==='tax-abatements'?'year':'day-or-unknown'}};
  }catch(error){if(error?.name==='AbortError')throw error;return {records:[],features:[],summary:{id,label:LABELS[id],status:'unavailable',count:null,mappedCount:null,unmappedCount:null,sourceCount:null,partial:true,error:text(error?.message)||'Planning source failed'}};}}));
  abort(options.signal);const records=results.flatMap(r=>r.records),rawFeatures=results.flatMap(r=>r.features),features=aggregate(rawFeatures,maxFeatures),summaries=results.map(r=>r.summary);
  return {records,features,layers:summaries,partial:summaries.some(s=>s.partial),counts:{records:records.length,mappedRecords:rawFeatures.length,unmappedRecords:records.length-rawFeatures.length,displayedFeatures:features.length},level:options.level??'properties'};
 }
 function dispose(){disposed=true;for(const c of controllers)c.abort();controllers.clear();cache.clear();}
 return {query,dispose};
}
