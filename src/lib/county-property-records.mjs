/** Public County attributes; property charges stay separate from people/payment data. */
import {normalizeTaxEvidence} from './property-tax-evidence.mjs';
export const COUNTY_RECORD_URL='https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0';
export const COUNTY_HISTORY_ID='3ad7bec2310d4a4ab36f7668d4bca6e5';
export const COUNTY_TRANSFER_SOURCE_ID='stlco-real-billing-2025-sales';
export const COUNTY_TRANSFER_ARCHIVE_URL='https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip';
export const COUNTY_RECORD_FIELDS=['OBJECTID','LOCATOR','TAXYR','PROP_ADD','PROP_ZIP','ASSTLANDVAL','ASSTIMPVAL','TOTASSMT','APPLANDVAL','APPIMPVAL','TOTAPVAL','PROPCLASS','LUC','LANDUSE2','TAXCODE','YEARBLT','RESQFT','LIVUNIT','MUNICIPALITY','SCHOOL_DISTRICT','FIRE_DISTRICT','LIBRARY_DISTRICT','ACRES','DEEDBKPG','RECDATEDAILY','DEEDTYPE','LOTDIM','SUBDIVISION','MUNI_ZONING'];
export function countyLocator(value){const id=String(value||'').trim().toUpperCase();if(!/^[A-Z0-9]{9}$/.test(id))throw Error('A valid County locator is required.');return id;}
export const countyTaxLink=id=>`https://taxpayments.stlouiscountymo.gov/parcel/view/${countyLocator(id)}`;
export function countyRecordQuery(id){return `${COUNTY_RECORD_URL}/query?${new URLSearchParams({f:'json',where:`LOCATOR = '${countyLocator(id)}'`,outFields:COUNTY_RECORD_FIELDS.join(','),returnGeometry:'false'})}`;}
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
function abortable(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const aborted=()=>{cleanup();reject(new DOMException('Aborted','AbortError'));};
  const cleanup=()=>signal.removeEventListener('abort',aborted);
  promise.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  if(signal.aborted){aborted();return;}
  signal.addEventListener('abort',aborted,{once:true});
 });
}
/** A bill is publishable only after identity, annual amount and exact official URL checks. */
export function normalizeCountyBill(bill,parcel){
 const id=countyLocator(parcel?.parcelId);
 if(!bill||bill.parcelId!==id||parcel.jurisdiction!=='st-louis-county')throw Error('Bill parcel does not match.');
 if(bill.recordKey!=null&&bill.recordKey!==parcel.recordKey)throw Error('Bill source record does not match.');
 if(bill.jurisdiction!=null&&bill.jurisdiction!==parcel.jurisdiction)throw Error('Bill jurisdiction does not match.');
 const base=normalizeTaxEvidence({...bill,status:'matched',recordKey:parcel.recordKey,jurisdiction:parcel.jurisdiction},parcel);
 const url=new URL(base.sourceUrl);
 if(url.href!==`${countyTaxLink(id)}/${base.taxYear}`)throw Error('Bill source must be the exact official parcel and tax year.');
 const amounts={};
 for(const key of ['otherFeesUSD','penaltyUSD','interestUSD','totalBilledUSD']){
  if(bill[key]!=null&&(number(bill[key])===null||bill[key]>1e9))throw Error('Bill charge component is invalid.');
  amounts[key]=bill[key]??null;
 }
 const components=[base.amountUSD,amounts.otherFeesUSD,amounts.penaltyUSD,amounts.interestUSD];
 if(amounts.totalBilledUSD!==null){
  const known=components.filter(v=>v!==null).reduce((sum,v)=>sum+Math.round(v*100),0);
  const total=Math.round(amounts.totalBilledUSD*100);
  if(total<known||(components.every(v=>v!==null)&&total!==known))throw Error('Bill charge components do not reconcile with total billed.');
 }
 return {...base,...amounts,taxDistrict:text(bill.taxDistrict),sourceUpdatedLabel:text(bill.sourceUpdatedLabel)};
}
function historyRecord(tile,manifest,id){
 if(tile?.schema!=='county-history-tile-v1'||manifest?.schema!=='county-history-manifest-v1'||manifest.source?.id!==COUNTY_HISTORY_ID||tile.sourceId!==COUNTY_HISTORY_ID)return null;
 const record=tile.records?.[id];
 if(record?.parcelId!==id)return null;
 const result={parcelId:id};
 for(const key of ['taxes','sales','assessments','appraisals']){
  const rows=record[key]??[];
  if(!Array.isArray(rows)||rows.length>10000||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))return null;
  result[key]=rows;
 }
 return {...result,source:manifest.source,codeLabels:manifest.codeLabels||{},limitations:Array.isArray(manifest.limitations)?manifest.limitations:[]};
}
function assessmentRecord(index,id){
 if(index?.schema!=='county-assessment-history-v1')return null;
 const record=index.records?.[id];
 if(record?.parcelId!==id||!Array.isArray(record.assessments)||record.assessments.length>200||record.assessments.some(row=>!row||typeof row!=='object'||Array.isArray(row)))return null;
 return {...record,source:index.source||null};
}
function transferRecord(tile,manifest,id){
 const source=manifest?.source;
 if(tile?.schema!=='county-transfers-v1'||manifest?.schema!=='county-transfers-manifest-v1'||tile.sourceId!==COUNTY_TRANSFER_SOURCE_ID||source?.id!==COUNTY_TRANSFER_SOURCE_ID)return null;
 if(source.url!==COUNTY_TRANSFER_ARCHIVE_URL||source.archiveUrl!==COUNTY_TRANSFER_ARCHIVE_URL||!Number.isFinite(Date.parse(source.retrievedAt)))return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(source.archiveEntryTimestamp||'')||!Number.isFinite(Date.parse(source.archiveEntryTimestamp)))return null;
 if(typeof source.member!=='string'||!source.member||!/^[a-f0-9]{64}$/i.test(source.memberSha256||''))return null;
 const record=tile.records?.[id];
 if(record?.parcelId!==id||!Array.isArray(record.sales)||record.sales.length>10000||record.sales.some(row=>!row||typeof row!=='object'||Array.isArray(row)))return null;
 const observed=manifest.counts?.sales?.maxObservedSaleDateISO;
 return {parcelId:id,sales:record.sales,source,codeLabels:manifest.codeLabels||{},archiveTimestamp:source.archiveEntryTimestamp,
  maxObservedSaleDate:/^\d{4}-\d{2}-\d{2}$/.test(observed||'')&&Number.isFinite(Date.parse(observed))?observed:null,
  maxObservedDateScope:'retained study rows',limitations:Array.isArray(manifest.limitations)?manifest.limitations:[]};
}
export function normalizeCountyRecord(payload,{parcelId,retrievedAt}={}){
 const id=countyLocator(parcelId);if(!Number.isFinite(Date.parse(retrievedAt)))throw Error('A retrieval date is required.');
 if(payload?.error||payload?.exceededTransferLimit||!Array.isArray(payload?.features))throw Error('County record response was incomplete.');
 if(payload.features.length!==1)throw Error(payload.features.length?'Multiple source records require review.':'No current County record matched this locator.');
 const a=payload.features[0].attributes;if(countyLocator(a?.LOCATOR)!==id)throw Error('County source identity did not match.');
 if(!Number.isSafeInteger(a.OBJECTID)||a.OBJECTID<=0)throw Error('County source record ID is missing.');
 return {parcelId:id,sourceObjectId:a.OBJECTID,address:text(a.PROP_ADD),postalCode:text(a.PROP_ZIP),taxYear:Number.isInteger(a.TAXYR)&&a.TAXYR>=1900&&a.TAXYR<=2100?a.TAXYR:null,assessmentYear:null,
 assessedValueUSD:number(a.TOTASSMT),assessorAppraisedValueUSD:number(a.TOTAPVAL),assessedLandUSD:number(a.ASSTLANDVAL),assessedImprovementsUSD:number(a.ASSTIMPVAL),appraisedLandUSD:number(a.APPLANDVAL),appraisedImprovementsUSD:number(a.APPIMPVAL),
 propertyClass:text(a.PROPCLASS),landUseCode:text(a.LUC),taxCode:text(a.TAXCODE),yearBuilt:number(a.YEARBLT)>0?a.YEARBLT:null,livingAreaSqFt:number(a.RESQFT)>0?a.RESQFT:null,dwellingUnits:number(a.LIVUNIT),areaSqFt:number(a.ACRES)==null?null:a.ACRES*43560,
 municipality:text(a.MUNICIPALITY),schoolDistrict:text(a.SCHOOL_DISTRICT),fireDistrict:text(a.FIRE_DISTRICT),libraryDistrict:text(a.LIBRARY_DISTRICT),subdivision:text(a.SUBDIVISION),deedBookPage:text(a.DEEDBKPG),deedType:text(a.DEEDTYPE),recordingDateRaw:text(a.RECDATEDAILY),lotDimensions:text(a.LOTDIM),municipalZoning:text(a.MUNI_ZONING),source:{url:COUNTY_RECORD_URL,queryUrl:countyRecordQuery(id),retrievedAt,sourceDataEditedAt:null}};
}
export function createCountyPropertyRecords({fetchImpl=(...args)=>fetch(...args),now=()=>new Date().toISOString()}={}){
 const cache=new Map();
 async function json(url,signal){const deadline=AbortSignal.timeout(8000),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;const r=await abortable(fetchImpl(url,{signal:requestSignal,cache:'no-cache'}),requestSignal);if(!r.ok)throw Error('Source unavailable.');const raw=await abortable(r.text(),requestSignal);if(raw.length>5_000_000)throw Error('Source response exceeds the record budget.');return JSON.parse(raw);}
 function shared(url){if(!cache.has(url))cache.set(url,json(url).catch(error=>{cache.delete(url);throw error;}));return cache.get(url);}
 return async function load(parcel,{signal,source}={}){
  const id=countyLocator(parcel.parcelId);if(parcel.jurisdiction!=='st-louis-county')throw Error('County records require a County parcel.');
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const [live,bills,history,examples,historyManifest,transfers,transferManifest]=await abortable(Promise.allSettled([
   json(countyRecordQuery(id),signal).then(payload=>normalizeCountyRecord(payload,{parcelId:id,retrievedAt:now()})),
   shared('/st-louis/county-bills/index.json'),shared(`/st-louis/county-history/tiles/${id.slice(-2).toLowerCase()}.json`),shared('/st-louis/county-assessment-history/index.json'),shared('/st-louis/county-history/manifest.json'),
   shared(`/st-louis/county-transfers-2025/tiles/${id.slice(-2).toLowerCase()}.json`),shared('/st-louis/county-transfers-2025/manifest.json')
  ]),signal);
  let bill=null,billStatus=bills.status==='rejected'?'unavailable':'not-imported';
  const billIndex=bills.status==='fulfilled'&&bills.value?.schema==='county-tax-bills-v1'?bills.value:null;
  if(bills.status==='fulfilled'&&!billIndex)billStatus='invalid';
  const candidate=billIndex?.records?.[id];
  if(candidate){try{bill=normalizeCountyBill(candidate,parcel);billStatus='found';}catch{billStatus='invalid';}}
  const historical=history.status==='fulfilled'&&historyManifest.status==='fulfilled'?historyRecord(history.value,historyManifest.value,id):null;
  const assessmentHistory=examples.status==='fulfilled'?assessmentRecord(examples.value,id):null;
  const transferHistory=transfers.status==='fulfilled'&&transferManifest.status==='fulfilled'?transferRecord(transfers.value,transferManifest.value,id):null;
  return {parcelId:id,record:live.status==='fulfilled'?live.value:{...parcel,source},liveStatus:live.status==='fulfilled'?'ready':'unavailable',liveReason:live.status==='rejected'?live.reason.message:null,
   bill,billStatus,billCoverage:billIndex?Object.keys(billIndex.records||{}).length:0,
   history:historical,assessmentHistory,transfers:transferHistory};
 };
}
export const loadCountyPropertyRecords=createCountyPropertyRecords();
