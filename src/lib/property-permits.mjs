/** Dated official permit observations; no inferred parcel join or current work status. */
export const PROPERTY_PERMITS_MANIFEST='/st-louis/permits/manifest.json';
export const CITY_PERMIT_SOURCE_ID='st-louis-city-building-permits-2025';
export const PERMIT_STATUSES=Object.freeze(['cancellation-date-recorded','completion-date-recorded','issue-date-recorded','application-date-recorded','unknown']);
const SOURCE_URL='https://maps8.stlouis-mo.gov/arcgis/rest/services/SLDC/Building_Permits_2025/MapServer/8';
const PUBLIC_FIELDS=['id','sourceId','jurisdiction','sourceObjectId','applicationNumber','applicationTypeCode','longitude','latitude','address','projectTypeCode','structureTypeCode','description','estimatedCostUSD','unitCount','newUse','oldUse','applicationDate','issuedDate','completedDate','cancelledDate','status','statusBasis','cancellationTypeCode','parcelHandle','parcelIdRaw','parcelJoinStatus','sourceRowMultiplicity'];
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function abortable(promise,signal){if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));if(!signal)return promise;return new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(new DOMException('Aborted','AbortError'));};const cleanup=()=>signal.removeEventListener('abort',abort);signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(x=>{cleanup();resolve(x);},e=>{cleanup();reject(e);});});}
export function permitDateStatus(record){return record.cancelledDate?'cancellation-date-recorded':record.completedDate?'completion-date-recorded':record.issuedDate?'issue-date-recorded':record.applicationDate?'application-date-recorded':'unknown';}
export function normalizePermitSnapshot(snapshot,dataset){
 if(snapshot?.schema!=='property-permit-points-v1'||snapshot.sourceId!==CITY_PERMIT_SOURCE_ID||snapshot.jurisdiction!=='st-louis-city'||snapshot.source?.id!==snapshot.sourceId||snapshot.source?.url!==SOURCE_URL||!Number.isFinite(Date.parse(snapshot.retrievedAt))||snapshot.source.retrievedAt!==snapshot.retrievedAt)throw Error('Permit source provenance cannot be verified.');
 if(!Array.isArray(snapshot.records)||snapshot.records.length!==snapshot.recordCount||snapshot.records.length>25000||dataset&&(dataset.sourceId!==snapshot.sourceId||dataset.recordCount!==snapshot.records.length||dataset.jurisdiction!==snapshot.jurisdiction))throw Error('Permit record count or source identity mismatch.');
 const seen=new Set();const today=snapshot.retrievedAt.slice(0,10);
 const records=snapshot.records.map(input=>{
  const r=Object.fromEntries(PUBLIC_FIELDS.map(key=>[key,input[key]??null]));
  if(r.sourceId!==snapshot.sourceId||r.jurisdiction!==snapshot.jurisdiction||!/^\d+$/.test(r.applicationNumber||'')||!/^[A-Z]{1,3}$/.test(r.applicationTypeCode||'')||r.id!==`${snapshot.sourceId}:${r.applicationTypeCode}:${r.applicationNumber}`||seen.has(r.id))throw Error('Permit application identity is missing or ambiguous.');seen.add(r.id);
  if(!Number.isFinite(r.longitude)||!Number.isFinite(r.latitude)||r.longitude<=-91||r.longitude>=-89||r.latitude<=38||r.latitude>=40)throw Error('Permit point location is invalid.');
  for(const key of ['estimatedCostUSD','unitCount'])if(r[key]!==null&&!amount(r[key]))throw Error('Permit amount is invalid.');
  for(const key of ['applicationDate','issuedDate','completedDate','cancelledDate'])if(r[key]!==null&&(!date(r[key])||r[key]>today))throw Error('Permit date is invalid or future.');
  if(r.completedDate&&r.applicationDate&&r.completedDate<r.applicationDate||r.cancelledDate&&r.applicationDate&&r.cancelledDate<r.applicationDate)throw Error('Permit workflow dates are inconsistent.');
  if(r.status!==permitDateStatus(r)||r.parcelJoinStatus!=='not-established'||!Number.isSafeInteger(r.sourceRowMultiplicity)||r.sourceRowMultiplicity<1)throw Error('Permit status or source multiplicity cannot be verified.');
  r.rawDates=Object.fromEntries(['AppDate','IssueDate','CompleteDate','CancelDate'].map(key=>[key,typeof input.rawDates?.[key]==='number'&&Number.isFinite(input.rawDates[key])?input.rawDates[key]:null]));
  r.dateQuality=Array.isArray(input.dateQuality)?input.dateQuality.filter(flag=>typeof flag==='string'&&flag.length<100):[];
  return r;
 });
 return {...snapshot,records};
}
export function filterPropertyPermits(records,{bounds,fromDate=null,toDate=null,status=null}={}){
 if(bounds&&(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>bounds[2]||bounds[1]>bounds[3]))throw Error('Invalid permit bounds.');
 if(fromDate&&!date(fromDate)||toDate&&!date(toDate)||fromDate&&toDate&&fromDate>toDate||status&&!PERMIT_STATUSES.includes(status))throw Error('Invalid permit filter.');
 return records.filter(r=>(!bounds||r.longitude>=bounds[0]&&r.longitude<=bounds[2]&&r.latitude>=bounds[1]&&r.latitude<=bounds[3])&&(!fromDate||r.issuedDate&&r.issuedDate>=fromDate)&&(!toDate||r.issuedDate&&r.issuedDate<=toDate)&&(!status||r.status===status));
}
export function createPropertyPermitData({fetchImpl=(...args)=>fetch(...args),manifestUrl=PROPERTY_PERMITS_MANIFEST,timeoutMs=8000}={}){
 let pending;
 async function read(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await abortable(fetchImpl(url,{signal:controller.signal}),controller.signal);if(!response.ok)throw Error('Permit snapshot is unavailable.');const raw=await abortable(response.text(),controller.signal);if(raw.length>12000000)throw Error('Permit snapshot exceeds its size budget.');return JSON.parse(raw);}finally{clearTimeout(timer);}}
 const shared=()=>pending||=(async()=>{
  const manifest=await read(manifestUrl);if(manifest.schema!=='property-permits-manifest-v1'||!Array.isArray(manifest.datasets)||manifest.datasets.length!==1)throw Error('Permit manifest is invalid.');
  const dataset=manifest.datasets[0];if(dataset.id!==CITY_PERMIT_SOURCE_ID||dataset.sourceId!==CITY_PERMIT_SOURCE_ID||dataset.url!=='/st-louis/permits/city-2025.json')throw Error('Permit dataset path or source is invalid.');
  const snapshot=normalizePermitSnapshot(await read(dataset.url),dataset);if(snapshot.records.length!==manifest.recordCount)throw Error('Permit manifest count mismatch.');
  return {status:'ready',manifest,sources:[snapshot.source],coverage:manifest.coverage,records:snapshot.records};
 })().catch(error=>{pending=null;throw error;});
 async function load({signal}={}){if(signal?.aborted)throw new DOMException('Aborted','AbortError');return abortable(shared(),signal);}
 return {load,async query(options={}){const result=await load(options);const records=filterPropertyPermits(result.records,options);return {...result,records,matchingCount:records.length,totalCount:result.records.length};},clear(){pending=null;}};
}
export function propertyPermitsCsv(records,source){
 const fields=['id','applicationTypeCode','applicationNumber','jurisdiction','address','longitude','latitude','description','projectTypeCode','estimatedCostUSD','unitCount','applicationDate','issuedDate','completedDate','cancelledDate','status','statusBasis','parcelHandle','parcelIdRaw','parcelJoinStatus','sourceRowMultiplicity','sourceId','sourceUrl','sourceRetrievedAt'];
 const cell=v=>typeof v==='number'?String(v):`"${String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')}"`;
 return [fields,...records.map(record=>fields.map(key=>key==='sourceUrl'?source.url:key==='sourceRetrievedAt'?source.retrievedAt:record[key]))].map(row=>row.map(cell).join(',')).join('\r\n');
}
