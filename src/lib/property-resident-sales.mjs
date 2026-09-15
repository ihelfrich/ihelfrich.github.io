import {createPropertyRegionData} from './property-region-data.mjs';

const JURISDICTIONS=['st-louis-county','st-louis-city'];
const COUNTY_SALES='stlco-real-billing-2025-sales';
const CITY_GIS='st-louis-city-gis-residential-sale-fields';
const CITY_DATABASE='st-louis-city-prclsale-2026-09-12';
const TRANSFER_URLS=Object.freeze({[COUNTY_SALES]:'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip',[CITY_GIS]:'https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0',[CITY_DATABASE]:'https://www.stlouis-mo.gov/data/upload/data-files/prclsale.zip'});
const MAX_CANDIDATES=20;
const COUNTY_EXCLUDED_VALIDITY=['1','2','3','4','5','6','7','8','D','U','Z'];
const CITY_EXCLUDED_VALIDITY=['19','20','21','22','23','24','25','26','27','28','29','31','32','33','34','35','38','39','40','41','42','43','44','45','46','47','49','50','60','61','70','71','72','80','81','82','83','90','98'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:null;
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
const safeURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}};
const abortError=()=>new DOMException('The sale-evidence request was cancelled.','AbortError');
const aborted=signal=>{if(signal.aborted)throw abortError();};
function waitFor(promise,signal){
 return new Promise((resolve,reject)=>{
  const stop=()=>{cleanup();reject(abortError());},cleanup=()=>signal.removeEventListener('abort',stop);
  signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});if(signal.aborted)stop();
 });
}
function sourceSummary(source,{jurisdiction,maxObservedSaleDateISO=null,role='transfer'}={}){
 if(!text(source?.id))return null;
 return {id:source.id,name:text(source.name),jurisdiction,role,url:safeURL(source.url),queryUrl:safeURL(source.queryUrl),retrievedAt:timestamp(source.retrievedAt),
  sourceDataEditedAt:timestamp(source.sourceDataEditedAt),archiveEntryTimestamp:timestamp(source.archiveEntryTimestamp),
  memberSha256:/^[a-f\d]{64}$/i.test(source.memberSha256||'')?source.memberSha256:null,
  maxObservedSaleDateISO:day(source.maxObservedSaleDateISO)||day(maxObservedSaleDateISO),
  limitations:(Array.isArray(source.limits)?source.limits:Array.isArray(source.limitations)?source.limitations:[]).filter(x=>typeof x==='string').slice(0,15)};
}
function identity(record,jurisdiction){
 if(!record||record.jurisdiction!==jurisdiction||!text(record.parcelId)||!text(record.parcelKey)||!text(record.recordKey)||!Number.isSafeInteger(record.sourceObjectId)||record.sourceObjectId<=0)return false;
 if(jurisdiction==='st-louis-county')return /^[A-Z\d]{9}$/.test(record.parcelId)&&record.parcelKey===`${jurisdiction}:${record.parcelId}`&&
  [`${jurisdiction}:${record.parcelId}:${record.sourceObjectId}`,`st-louis-county-current:${record.parcelId}:${record.sourceObjectId}`].includes(record.recordKey);
 const handle=record.parcelKey.slice(jurisdiction.length+1);
 return jurisdiction==='st-louis-city'&&record.parcelKey.startsWith(jurisdiction+':')&&handle.length>0&&!handle.includes(':')&&record.recordKey===`${record.parcelKey}:${record.parcelId}:${record.sourceObjectId}`;
}
function selectedSubject(evidence){
 const p=evidence?.parcels?.parcel?.properties,point=evidence?.point;
 if(!JURISDICTIONS.includes(p?.jurisdiction)||!identity(p,p.jurisdiction)||!finite(point?.longitude)||!finite(point?.latitude)||Math.abs(point.longitude)>180||Math.abs(point.latitude)>89)return null;
 for(const key of ['recordKey','parcelKey','parcelId','jurisdiction'])if(point[key]!=null&&point[key]!==p[key])return null;
 return {recordKey:p.recordKey,parcelKey:p.parcelKey,parcelId:p.parcelId,sourceObjectId:p.sourceObjectId,jurisdiction:p.jurisdiction,
  handle:text(p.handle)||p.parcelKey.slice(p.jurisdiction.length+1),address:text(p.address),longitude:point.longitude,latitude:point.latitude,
  livingAreaSqFt:finite(p.livingAreaSqFt)?p.livingAreaSqFt:null,yearBuilt:finite(p.yearBuilt)?p.yearBuilt:null,propertyClass:text(p.propertyClass),
  coordinateBasis:'selected-parcel lookup point; not a surveyed building location'};
}
export function residentSaleDistanceKm(a,b){
 const radians=Math.PI/180,dLat=(b.latitude-a.latitude)*radians,dLon=(b.longitude-a.longitude)*radians;
 const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*radians)*Math.cos(b.latitude*radians)*Math.sin(dLon/2)**2;
 return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
function boundsAround(point,radiusKm){
 const lat=radiusKm/6371.0088*180/Math.PI,lon=Math.asin(Math.min(1,Math.sin(lat*Math.PI/180)/Math.cos(point.latitude*Math.PI/180)))*180/Math.PI;
 return [Math.max(-180,point.longitude-lon),Math.max(-90,point.latitude-lat),Math.min(180,point.longitude+lon),Math.min(90,point.latitude+lat)];
}
function monthsBefore(value,months){
 const original=new Date(value+'T00:00:00Z'),target=new Date(Date.UTC(original.getUTCFullYear(),original.getUTCMonth()-months,1));
 const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(original.getUTCDate(),last));return target.toISOString().slice(0,10);
}
const valuation=()=>({status:'not-estimated',reason:'These are dated administrative transfer records, not verified comparable sales. Current home condition, sale-date attributes, complete recent sales coverage and market adjustments are not established.'});
function badFlag(row,sourceId){
 if(Array.isArray(row.flags)&&row.flags.some(flag=>['source-not-open-market','source-related-parties','source-deleted-or-duplicate','source-multi-parcel','source-multiple-parcels'].includes(flag)))return true;
 const validity=text(row.latestSaleValidityCode),market=text(row.latestSaleMarketValidityCode);
 if(sourceId===COUNTY_SALES)return COUNTY_EXCLUDED_VALIDITY.includes(validity)||(market!==null&&market!=='0');
 if(sourceId===CITY_DATABASE)return CITY_EXCLUDED_VALIDITY.includes(validity);
 return false;
}
const sourceFlags=row=>Object.fromEntries(['latestSaleValidityCode','latestSaleMarketValidityCode','latestSaleInstrumentTypeCode'].map(key=>[key,text(row[key])]));

/** Candidate evidence only: geographic/date filtering does not establish home
 * similarity, arm's-length qualification, sale-date attributes, or market value.
 * A newer load cancels delivery of the older result, even if its adapter ignores
 * abort. The private region adapter can still reuse completed source downloads. */
export function createResidentSaleEvidence({regionData=createPropertyRegionData(),now=()=>new Date()}={}){
 let controller=null,disposed=false;
 async function load(evidence,{radiusKm=1.5,lookbackMonths=36,signal}={}){
  if(disposed)throw abortError();
  if(!finite(radiusKm)||radiusKm<=0||radiusKm>10||!Number.isInteger(lookbackMonths)||lookbackMonths<1||lookbackMonths>120)throw new RangeError('Use a radius above 0 and at most 10 km, and a lookback from 1 to 120 whole months.');
  const instant=now();if(!(instant instanceof Date)||!Number.isFinite(instant.valueOf()))throw new RangeError('A valid report date is required.');
  controller?.abort();controller=new AbortController();const current=controller,combined=signal?AbortSignal.any([signal,current.signal]):current.signal;aborted(combined);
  const subject=selectedSubject(evidence),toDate=instant.toISOString().slice(0,10),fromDate=monthsBefore(toDate,lookbackMonths),bounds=subject?boundsAround(subject,radiusKm):null;
  const initialSource=sourceSummary(evidence?.parcels?.source,{jurisdiction:subject?.jurisdiction,role:'parcel'});
  const result={status:'unavailable',subject,candidates:[],totalCandidates:0,examinedRecords:0,omittedByLimit:0,exclusionCounts:{},sources:initialSource?[initialSource]:[],partial:false,
   coverage:{scope:'latest-available-transfer-per-source-record',bounds,radiusKm,fromDate,toDate,requestedLookbackMonths:lookbackMonths,latestObservedSaleDateISO:null,sourceCoverage:[],
   filters:{minimumPriceExclusiveUSD:100,requiredPriceStatus:'recorded',maximumReturnedCandidates:MAX_CANDIDATES,countyExcludedValidityCodes:[...COUNTY_EXCLUDED_VALIDITY],countyAllowedMarketValidityCodes:[null,'0'],cityExcludedSaleTypeCodes:[...CITY_EXCLUDED_VALIDITY]},warnings:[
    'One latest available transfer per source record is searched. Earlier sales superseded by later transfers are absent; this is not a complete transaction history.',
    'Retrieval dates are not sale-coverage dates. Source validity codes and inferred two-digit years are retained, not independently verified.',
    'Distance uses representative map locations. Home size, age, type, condition, concessions and renovations have not been matched.',
    'Zero, missing, nominal amounts of $100 or less, withheld prices and explicitly adverse source classifications are excluded. Missing validity codes do not establish a verified sale.'
   ]},valuation:valuation()};
  if(!subject){result.reason='Select an exact City or County parcel before loading nearby sale evidence.';return result;}
  let view;
  try{view=await waitFor(regionData.query({jurisdiction:subject.jurisdiction,bounds,metric:'latestSalePriceUSD',fromYear:Number(fromDate.slice(0,4)),toYear:Number(toDate.slice(0,4)),signal:combined}),combined);aborted(combined);}
  catch(error){aborted(combined);result.reason='Regional sale evidence could not load. This does not establish that no nearby transfers exist.';result.partial=true;return result;}
  const manifests=Array.isArray(view?.sources)?view.sources.filter(m=>m?.jurisdiction===subject.jurisdiction):[],registry=new Map();
  for(const m of manifests){
   const latest=day(m.maxObservedLatestTransferDateISO);
   if(latest&&(!result.coverage.latestObservedSaleDateISO||latest>result.coverage.latestObservedSaleDateISO))result.coverage.latestObservedSaleDateISO=latest;
   const rawSources=subject.jurisdiction==='st-louis-county'?[m.saleSource]:Object.values(m.sources||{}).filter(s=>[CITY_DATABASE,CITY_GIS].includes(s?.id));
   for(const raw of rawSources){const summary=sourceSummary(raw,{jurisdiction:m.jurisdiction,maxObservedSaleDateISO:subject.jurisdiction==='st-louis-county'?latest:null});if(!summary)continue;registry.set(summary.id,summary);result.coverage.sourceCoverage.push(summary);}
  }
  result.sources=[...new Map([...result.sources,...registry.values()].map(s=>[s.id,s])).values()];
  result.partial=Boolean(view?.partial||view?.failedTiles||view?.unavailable?.length);
  if(result.partial)result.coverage.warnings.push('Partial source coverage: one or more requested sources or tiles failed. Candidate counts are incomplete.');
  const latest=result.coverage.latestObservedSaleDateISO;
  if(latest)result.coverage.warnings.push(`The latest date observed across the connected ${subject.jurisdiction==='st-louis-county'?'County':'City'} snapshot is ${latest}. It does not establish complete sales coverage through that date.`);
  else result.coverage.warnings.push('The latest observed transaction coverage date is unavailable.');
  if(view?.level==='areas'){result.status='zoom-required';result.reason='This search exceeds the detailed-record budget. Use a smaller radius; area averages are not individual sale evidence.';return result;}
  if(view?.level!=='properties'||!Array.isArray(view.features)||!manifests.length){result.reason='Detailed source records could not be verified.';return result;}
  const rows=view.features,duplicateKeys=new Map();result.examinedRecords=rows.length;
  for(const row of rows)for(const field of ['recordKey','parcelKey','parcelId'])if(text(row?.[field])){const key=field+':'+row[field];duplicateKeys.set(key,(duplicateKeys.get(key)||0)+1);}
  const excluded=reason=>{result.exclusionCounts[reason]=(result.exclusionCounts[reason]||0)+1;};
  const candidates=[];
  for(const row of rows){
   if(row?.jurisdiction!==subject.jurisdiction){excluded('foreign-jurisdiction');continue;}
   if(row.kind!=='parcel'||!identity(row,subject.jurisdiction)){excluded('invalid-source-identity');continue;}
   const handle=text(row.handle)||row.parcelKey.slice(subject.jurisdiction.length+1);
   if(row.recordKey===subject.recordKey||row.parcelKey===subject.parcelKey||row.parcelId===subject.parcelId||handle===subject.handle){excluded('subject');continue;}
   if(['recordKey','parcelKey','parcelId'].some(field=>(duplicateKeys.get(field+':'+row[field])||0)>1)){excluded('ambiguous-parcel-identity');continue;}
   if(!finite(row.longitude)||!finite(row.latitude)||Math.abs(row.longitude)>180||Math.abs(row.latitude)>90){excluded('invalid-location');continue;}
   const distanceKm=residentSaleDistanceKm(subject,row);if(distanceKm>radiusKm+1e-9){excluded('outside-radius');continue;}
   const saleDateISO=day(row.latestSaleDateISO);if(!saleDateISO){excluded('invalid-sale-date');continue;}
   if(saleDateISO>toDate){excluded('future-sale-date');continue;}if(saleDateISO<fromDate){excluded('outside-date-window');continue;}
   if(!finite(row.latestSalePriceUSD)||row.latestSalePriceUSD<=100){excluded('missing-zero-or-nominal-price');continue;}
   if(row.latestSalePriceStatus!=='recorded'){excluded('withheld-or-unsupported-price-status');continue;}
   const sourceId=text(row.latestSaleSourceId)||(subject.jurisdiction==='st-louis-county'?COUNTY_SALES:null),source=registry.get(sourceId);
   const sourceMatches=subject.jurisdiction==='st-louis-county'?sourceId===COUNTY_SALES:[CITY_DATABASE,CITY_GIS].includes(sourceId);
   if(!sourceMatches||!source?.url||source.url!==TRANSFER_URLS[sourceId]||!source.retrievedAt){excluded('unverified-transfer-source');continue;}
   if(source.maxObservedSaleDateISO&&saleDateISO>source.maxObservedSaleDateISO){excluded('beyond-source-coverage');continue;}
   if(badFlag(row,sourceId)){excluded('source-flagged-transfer');continue;}
   candidates.push({id:row.recordKey,recordKey:row.recordKey,parcelKey:row.parcelKey,parcelId:row.parcelId,sourceObjectId:row.sourceObjectId,jurisdiction:row.jurisdiction,
    address:text(row.address),municipality:text(row.municipality),propertyClass:text(row.propertyClass),longitude:row.longitude,latitude:row.latitude,distanceKm,
    saleDateISO,priceUSD:row.latestSalePriceUSD,latestSaleDateISO:saleDateISO,latestSaleDateRaw:text(row.latestSaleDateRaw),latestSalePriceUSD:row.latestSalePriceUSD,
    latestSalePriceStatus:row.latestSalePriceStatus,...sourceFlags(row),latestSaleDateCenturyInferred:typeof row.latestSaleDateCenturyInferred==='boolean'?row.latestSaleDateCenturyInferred:null,
    latestSaleSourceId:sourceId,source,sourceUrl:source.url,sourceURL:source.url,retrievedAt:source.retrievedAt,
    flags:(Array.isArray(row.flags)?row.flags:[]).filter(x=>typeof x==='string').slice(0,30),qualification:'administrative-transfer-not-verified-comparable'});
  }
  candidates.sort((a,b)=>a.distanceKm-b.distanceKm||b.saleDateISO.localeCompare(a.saleDateISO)||a.recordKey.localeCompare(b.recordKey));
  result.totalCandidates=candidates.length;result.candidates=candidates.slice(0,MAX_CANDIDATES);result.omittedByLimit=Math.max(0,candidates.length-MAX_CANDIDATES);
  result.status=candidates.length?'ready':result.partial?'unavailable':'insufficient';
  if(!candidates.length)result.reason=result.partial?'No candidates survived within the available partial records. Missing tiles prevent a complete search.':'No nearby transfers meet these evidence filters in the selected dated snapshot.';
  return result;
 }
 return {load,dispose(){if(disposed)return;disposed=true;controller?.abort();regionData.clear?.();}};
}
