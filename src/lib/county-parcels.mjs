import {createParcelLookup} from './city-parcels.mjs';
import {createCountyLiveLookup} from './county-live-parcels.mjs';
export const COUNTY_MANIFEST='/st-louis/county-parcels/manifest.json';
export const CURRENT_COUNTY_MANIFEST='/st-louis/county-current/manifest.json';
const aborted=()=>new DOMException('Aborted','AbortError');
function abortable(promise,signal){
 if(signal?.aborted)return Promise.reject(aborted());
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{const stop=()=>{cleanup();reject(aborted());};const cleanup=()=>signal.removeEventListener('abort',stop);signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});});
}
function matchesIdentity(properties,point){return !!properties&&['recordKey','parcelKey','parcelId','sourceObjectId'].every(key=>point[key]==null||properties[key]===point[key]);}
function exactLocalResult(result,point){
 if(result.status!=='found')return result;
 if(result.parcel&&matchesIdentity(result.parcel.properties,point))return result;
 const candidates=(result.candidates||[]).filter(feature=>matchesIdentity(feature.properties,point));
 if(candidates.length)return {...result,parcel:candidates.length===1?candidates[0]:null,candidates,ambiguous:candidates.length>1};
 return {...result,status:'unavailable',parcel:null,candidates:[],ambiguous:false,reason:'requested-source-unresolved'};
}
export function createCountyLookup({fetchImpl=(...args)=>fetch(...args),snapshotTimeoutMs=8000,liveTimeoutMs=15000}={}){
 // Snapshot reads are shared by createParcelLookup. A cancelled caller stops waiting,
 // while the reusable read still has its own deadline, including response-body parsing.
 const snapshotFetch=async(url,options={})=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),snapshotTimeoutMs);
  try{
   const response=await abortable(fetchImpl(url,{...options,signal:controller.signal}),controller.signal);
   if(!response.ok){clearTimeout(timer);return response;}
   return {ok:response.ok,status:response.status,json:async()=>{try{return await abortable(response.json(),controller.signal);}finally{clearTimeout(timer);}}};
  }catch(error){clearTimeout(timer);throw error;}
 };
 const current=createParcelLookup({manifestUrl:CURRENT_COUNTY_MANIFEST,fetchImpl:snapshotFetch});
 const historical=createParcelLookup({manifestUrl:COUNTY_MANIFEST,fetchImpl:snapshotFetch});
 const live=createCountyLiveLookup({fetchImpl:async(url,options)=>{const response=await abortable(fetchImpl(url,options),options?.signal);return {ok:response.ok,status:response.status,text:()=>abortable(response.text(),options?.signal)};}});
 return async(point,options={})=>{
  const {signal}=options;if(signal?.aborted)throw aborted();
  // A saved historical source identity always resolves within that dated snapshot.
  if(point?.recordKey?.startsWith('st-louis-county:'))return exactLocalResult(await abortable(historical(point),signal),point);
  const controller=new AbortController(),stop=()=>controller.abort(),timer=setTimeout(stop,liveTimeoutMs);signal?.addEventListener('abort',stop,{once:true});
  let fresh;
  try{fresh=await abortable(live(point,{...options,signal:controller.signal}),controller.signal);}
  catch(error){if(signal?.aborted)throw aborted();fresh={status:'unavailable',parcel:null,reason:'county-service-unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
  if(signal?.aborted)throw aborted();
  // A responding source's missing/ambiguous result is evidence; an outage alone uses the snapshot.
  if(fresh.status!=='unavailable'||fresh.reason==='requested-source-unresolved')return exactLocalResult(fresh,point);
  const local=exactLocalResult(await abortable(current(point),signal),point);
  // This fallback covers selected study areas, not the entire County. A local miss
  // cannot turn a live-service outage into evidence of jurisdiction-wide absence.
  if(local.status==='unsupported'||local.status==='not-found')return {...fresh,status:'unavailable',parcel:null,candidates:[],snapshotStatus:local.status,snapshotReason:local.reason,snapshotSource:local.source,liveStatus:'unavailable',liveReason:fresh.reason,snapshotFallback:true};
  return {...local,liveStatus:'unavailable',liveReason:fresh.reason,snapshotFallback:true};
 };
}
export const lookupCountyParcel=createCountyLookup();
export {filterCountyParcels} from './county-parcel-query.mjs';
export function createCountyIndex({fetchImpl=(...args)=>fetch(...args),manifestUrl=COUNTY_MANIFEST}={}){
 let pending;
 return ()=>pending||=(async()=>{
  const mr=await fetchImpl(manifestUrl);if(!mr.ok)throw Error('County parcel snapshot unavailable.');const manifest=await mr.json();
  const response=await fetchImpl(manifest.indexUrl);if(!response.ok)throw Error('County parcel index unavailable.');const index=await response.json();
  if(index.schema!=='county-parcel-index-v1'||!Array.isArray(index.records)||index.records.length!==manifest.featureCount||index.records.length>30000)throw Error('County parcel coverage could not be verified.');
  return {manifest,manifestUrl,records:index.records,source:index.source};
 })().catch(error=>{pending=null;throw error;});
}
export const loadCountyIndex=createCountyIndex({manifestUrl:CURRENT_COUNTY_MANIFEST});

export function countyParcelCsv(records,source){
 const fields=['address','parcelId','recordKey','municipality','postalCode','dwellingUnits','yearBuilt','livingAreaSqFt','areaSqFt','taxYear','assessmentYear','assessedValueUSD','assessorAppraisedValueUSD','assessedLandUSD','assessedImprovementsUSD','appraisedLandUSD','appraisedImprovementsUSD','propertyClass','landUseCode','taxCode','schoolDistrict','fireDistrict','deedBookPage','longitude','latitude'];
 const cell=v=>typeof v==='number'?String(v):'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 return [[...fields,'sourceUrl','sourceDataEditedAt','retrievedAt'],...records.map(r=>[...fields.map(key=>r[key]),source.url,source.sourceDataEditedAt,source.retrievedAt])].map(row=>row.map(cell).join(',')).join('\r\n');
}
