import {parcelGeometryBounds,parcelContainsPoint} from './city-parcels.mjs';
import {COUNTY_RECORD_FIELDS,COUNTY_RECORD_URL,countyLocator,normalizeCountyRecord} from './county-property-records.mjs';
const bounds=[-90.742,38.389,-90.122,38.892];
export function countyLiveParcelQuery(point){
 if(!point||!Number.isFinite(point.longitude)||!Number.isFinite(point.latitude))throw Error('A valid coordinate is required.');
 const p={f:'geojson',where:'1=1',outFields:COUNTY_RECORD_FIELDS.join(','),returnGeometry:'true',outSR:'4326',resultRecordCount:'64',orderByFields:'OBJECTID ASC'};
 const oid=point.sourceObjectId??(point.recordKey?.startsWith('st-louis-county-current:')?Number(point.recordKey.split(':').at(-1)):null);
 if(oid!=null){if(!Number.isSafeInteger(oid)||oid<=0)throw Error('Invalid source object ID.');p.objectIds=String(oid);}
 else if(point.parcelId)p.where=`LOCATOR = '${countyLocator(point.parcelId)}'`;
 else Object.assign(p,{geometry:`${point.longitude},${point.latitude}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects'});
 return `${COUNTY_RECORD_URL}/query?${new URLSearchParams(p)}`;
}
export function normalizeLiveCountyParcels(payload,point,{retrievedAt=new Date().toISOString(),queryUrl}={}){
 if(payload?.error||payload?.exceededTransferLimit||payload?.type!=='FeatureCollection'||!Array.isArray(payload.features)||payload.features.length>64)throw Error('County parcel response is incomplete.');
 const source={id:'st-louis-county-current',jurisdiction:'st-louis-county',name:'St. Louis County official parcel GIS',url:COUNTY_RECORD_URL,queryUrl,retrievedAt,sourceDataEditedAt:null,assessmentYear:null};
 const candidates=payload.features.map(f=>{
  const a=f.properties||{},id=a.LOCATOR?.trim()||null,oid=a.OBJECTID;
  if(!Number.isSafeInteger(oid)||oid<=0)throw Error('County source object ID missing.');
  const properties=id?normalizeCountyRecord({features:[{attributes:a}]},{parcelId:id,retrievedAt}):{sourceObjectId:oid,parcelId:null,address:a.PROP_ADD||null,assessmentYear:null};
  properties.parcelKey=id?`st-louis-county:${id}`:null;properties.recordKey=id?`st-louis-county-current:${id}:${oid}`:`st-louis-county-current:objectid:${oid}`;properties.jurisdiction='st-louis-county';
  return {type:'Feature',id:properties.recordKey,bbox:parcelGeometryBounds(f.geometry),geometry:f.geometry,properties};
 });
 const exact=point.recordKey?candidates.filter(f=>f.properties.recordKey===point.recordKey):point.parcelId?candidates.filter(f=>f.properties.parcelId===point.parcelId):candidates.filter(f=>parcelContainsPoint(f.geometry,point));
 if((point.recordKey||point.parcelId)&&exact.length===0)return {status:'unavailable',reason:'requested-source-unresolved',parcel:null,candidates:[],source};
 const matching=exact.filter(f=>(!point.parcelKey||f.properties.parcelKey===point.parcelKey)&&(!point.parcelId||f.properties.parcelId===point.parcelId)&&(!point.sourceObjectId||f.properties.sourceObjectId===point.sourceObjectId));
 if(exact.length&&!matching.length)return {status:'unavailable',reason:'requested-source-unresolved',parcel:null,candidates:[],source};
 return {status:matching.length?'found':'not-found',parcel:matching.length===1?matching[0]:null,candidates:matching,ambiguous:matching.length>1,source};
}
export function createCountyLiveLookup({fetchImpl=(...args)=>fetch(...args)}={}){
 return async(point,{signal}={})=>{
  if(!point||point.longitude<bounds[0]||point.longitude>bounds[2]||point.latitude<bounds[1]||point.latitude>bounds[3])return {status:'unsupported',parcel:null,reason:'outside-county-region'};
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,15000);signal?.addEventListener('abort',abort,{once:true});
  try{if(signal?.aborted)throw new DOMException('Aborted','AbortError');const queryUrl=countyLiveParcelQuery(point),response=await fetchImpl(queryUrl,{signal:controller.signal});if(!response.ok)throw Error('County service unavailable.');const raw=await response.text();if(raw.length>16000000)throw Error('County parcel response is too large.');return normalizeLiveCountyParcels(JSON.parse(raw),point,{queryUrl});}
  catch(error){if(signal?.aborted)throw new DOMException('Aborted','AbortError');return {status:'unavailable',parcel:null,reason:'county-service-unavailable',source:{url:COUNTY_RECORD_URL},detail:error.message};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
}
