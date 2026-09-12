import {createParcelLookup} from './city-parcels.mjs';
export const COUNTY_MANIFEST='/st-louis/county-parcels/manifest.json';
export const lookupCountyParcel=createParcelLookup({manifestUrl:COUNTY_MANIFEST});
export {filterCountyParcels} from './county-parcel-query.mjs';
export function createCountyIndex({fetchImpl=(...args)=>fetch(...args)}={}){
 let pending;
 return ()=>pending||=(async()=>{
  const mr=await fetchImpl(COUNTY_MANIFEST);if(!mr.ok)throw Error('County parcel snapshot unavailable.');const manifest=await mr.json();
  const response=await fetchImpl(manifest.indexUrl);if(!response.ok)throw Error('County parcel index unavailable.');const index=await response.json();
  if(index.schema!=='county-parcel-index-v1'||!Array.isArray(index.records)||index.records.length!==manifest.featureCount||index.records.length>30000)throw Error('County parcel coverage could not be verified.');
  return {manifest,records:index.records,source:index.source};
 })().catch(error=>{pending=null;throw error;});
}
export const loadCountyIndex=createCountyIndex();

export function countyParcelCsv(records,source){
 const fields=['address','parcelId','recordKey','municipality','postalCode','dwellingUnits','yearBuilt','livingAreaSqFt','areaSqFt','assessmentYear','assessedValueUSD','assessorAppraisedValueUSD','longitude','latitude'];
 const cell=v=>typeof v==='number'?String(v):'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 return [[...fields,'sourceUrl','sourceDataEditedAt','retrievedAt'],...records.map(r=>[...fields.map(key=>r[key]),source.url,source.sourceDataEditedAt,source.retrievedAt])].map(row=>row.map(cell).join(',')).join('\r\n');
}
