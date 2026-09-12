import {PROPERTY_REGIONS,PROPERTY_REGION_BOUNDS} from './property-region-catalog.mjs';
export const ATLAS_METRICS=Object.freeze({assessedValueUSD:{label:'Assessed value',explanation:'The tax assessment attached to a source record. It is not an asking price or a market valuation.'},assessorAppraisedValueUSD:{label:'County appraised value',explanation:'The County assessor’s appraised total. A comparable total is not connected for City records.'},latestSalePriceUSD:{label:'Latest recorded transfer',explanation:'The latest dated transfer per source record, including non-market transfers. This is not a complete sales-volume series.'}});
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const inside=(r,b)=>r.longitude>=b[0]&&r.longitude<=b[2]&&r.latitude>=b[1]&&r.latitude<=b[3];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function validAtlasBounds(b){return Array.isArray(b)&&b.length===4&&b.every(finite)&&b[0]<b[2]&&b[1]<b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;}
export function decodeAtlasRow(row,manifest){
 if(!Array.isArray(row)||row.length!==manifest.fields.length)throw Error('Property row schema mismatch.');
 const record=Object.fromEntries(manifest.fields.map((key,i)=>[key,row[i]]));
 if(!record.recordKey||!finite(record.longitude)||!finite(record.latitude))throw Error('Property identity or location missing.');
 if(!record.recordKey.startsWith(manifest.jurisdiction+':')&&!(manifest.jurisdiction==='st-louis-county'&&record.recordKey.startsWith('st-louis-county-current:')))throw Error('Property jurisdiction identity mismatch.');
 return {...record,assessmentSource:manifest.sources?.assessment||manifest.source,latestSaleSourceId:record.latestSaleSourceId??manifest.saleSource?.id??null,id:record.recordKey,jurisdiction:manifest.jurisdiction,kind:'parcel'};
}
function selectedYear(date,fromYear,toYear){const year=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?Number(date.slice(0,4)):null;return year!==null&&(!fromYear||year>=fromYear)&&(!toYear||year<=toYear);}
export function atlasCell(tile,manifest,{metric,fromYear,toYear}){
 let count=tile.count,stats=tile.metrics?.[metric]||{sum:0,count:0};
 if(metric==='latestSalePriceUSD'&&(fromYear||toYear)){
  count=0;stats={sum:0,count:0};
  for(const [year,summary] of Object.entries(tile.latestSaleYears||{}))if((!fromYear||Number(year)>=fromYear)&&(!toYear||Number(year)<=toYear)){count+=summary.count;stats.sum+=summary.priceSum||0;stats.count+=summary.priceCount||0;}
 }
 const municipality=Object.entries(tile.municipalities||{}).sort((a,b)=>b[1]-a[1])[0]?.[0];
 return {id:`${manifest.jurisdiction}:cell:${tile.id}`,kind:'cell',jurisdiction:manifest.jurisdiction,bounds:tile.bounds,longitude:(tile.bounds[0]+tile.bounds[2])/2,latitude:(tile.bounds[1]+tile.bounds[3])/2,count,knownCount:stats.count,value:stats.count?stats.sum/stats.count:null,label:`${municipality?'Near '+municipality:manifest.jurisdiction==='st-louis-city'?'City':'County'} · ${count.toLocaleString()} source records`,pixelSize:Math.min(23,10+Math.log2(Math.max(1,count)))};
}
export function atlasRows(rows,manifest,{bounds,metric,fromYear,toYear}){
 return rows.map(row=>decodeAtlasRow(row,manifest)).filter(r=>inside(r,bounds)&&(metric!=='latestSalePriceUSD'||!(fromYear||toYear)||selectedYear(r.latestSaleDateISO,fromYear,toYear))).map(r=>({...r,value:finite(r[metric])&&r[metric]>=0?r[metric]:null,pixelSize:7}));
}
/** Overview summaries plus bounded, lazy point tiles; no geometry or county-sized index in browser. */
export function createPropertyRegionData({fetchImpl=(...args)=>fetch(...args),regions=PROPERTY_REGIONS,maxPoints=8000,maxTiles=20,cacheSize=24}={}){
 const cache=new Map();let manifestsPromise;
 async function read(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetchImpl(url,{signal:controller.signal});if(!r.ok)throw Error(`Property data unavailable (${r.status}).`);return await r.json();}finally{clearTimeout(timer);}}
 function tile(url){if(cache.has(url)){const p=cache.get(url);cache.delete(url);cache.set(url,p);return p;}const p=read(url).catch(error=>{cache.delete(url);throw error;});cache.set(url,p);while(cache.size>cacheSize)cache.delete(cache.keys().next().value);return p;}
 async function manifests(){return manifestsPromise||=(async()=>{
  const results=await Promise.allSettled(regions.map(async region=>{const m=await read(region.manifestUrl);if(m.schema!=='property-region-v1'||m.jurisdiction!==region.id||!Array.isArray(m.fields)||!Array.isArray(m.tiles)||m.tiles.some(t=>!validAtlasBounds(t.bounds)||!Number.isSafeInteger(t.count)||t.count<0||typeof t.url!=='string'))throw Error(`${region.name} manifest cannot be verified.`);return {...m,region};}));
  const available=results.filter(r=>r.status==='fulfilled').map(r=>r.value),unavailable=regions.filter((_,i)=>results[i].status==='rejected').map(r=>r.name);
  if(!available.length)throw Error('Regional property data is unavailable.');
  if(unavailable.length)manifestsPromise=null;
  return {available,unavailable};
 })().catch(error=>{manifestsPromise=null;throw error;});}
 async function query({jurisdiction='all',bounds=PROPERTY_REGION_BOUNDS,metric='assessedValueUSD',fromYear=null,toYear=null,signal}={}){
  if(!validAtlasBounds(bounds)||!ATLAS_METRICS[metric]||!(jurisdiction==='all'||regions.some(r=>r.id===jurisdiction)))throw Error('Invalid regional view.');
  if(metric!=='latestSalePriceUSD'){fromYear=null;toYear=null;}
  if((fromYear!==null&&(!Number.isInteger(fromYear)||fromYear<1800||fromYear>2200))||(toYear!==null&&(!Number.isInteger(toYear)||toYear<1800||toYear>2200))||(fromYear&&toYear&&fromYear>toYear))throw Error('Choose a valid date range.');
  const aborted=()=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};aborted();
  const catalog=await manifests();aborted();const sources=catalog.available.filter(m=>jurisdiction==='all'||m.jurisdiction===jurisdiction);
  const matches=sources.flatMap(m=>m.tiles.filter(t=>intersects(t.bounds,bounds)).map(t=>({m,t}))),inputCount=matches.reduce((n,{t})=>n+t.count,0);
  const detailed=inputCount<=maxPoints&&matches.length<=maxTiles;
  let features,failedTiles=0;
  if(detailed){
   const all=[];
   // Four requests at a time; shared tiles remain reusable after a stale view is abandoned.
   for(let i=0;i<matches.length;i+=4){aborted();const batch=await Promise.allSettled(matches.slice(i,i+4).map(async({m,t})=>{const data=await tile(t.url);if(data.schema!=='property-region-tile-v1'||data.id!==t.id||data.jurisdiction!==m.jurisdiction||data.sourceId!==m.source.id||JSON.stringify(data.fields)!==JSON.stringify(m.fields)||!Array.isArray(data.rows)||data.rows.length!==t.count)throw Error('Property tile cannot be verified.');return atlasRows(data.rows,m,{bounds,metric,fromYear,toYear});}));for(const result of batch)if(result.status==='fulfilled')all.push(...result.value);else failedTiles++;}
   features=all;
  }else features=matches.map(({m,t})=>atlasCell(t,m,{metric,fromYear,toYear})).filter(f=>f.count>0);
  aborted();const known=features.filter(f=>finite(f.value));
  const values=known.map(f=>f.value).sort((a,b)=>a-b);
  const domain=values.length?[values[0],values[Math.min(values.length-1,Math.floor(values.length*.95))]]:[0,1];
  if(domain[1]<=domain[0])domain[1]=domain[0]+1;
  return {features,level:detailed?'properties':'areas',count:detailed?features.length:features.reduce((n,f)=>n+f.count,0),knownCount:detailed?known.length:features.reduce((n,f)=>n+f.knownCount,0),domain,bounds,metric,fromYear,toYear,sources,unavailable:catalog.unavailable.filter(name=>jurisdiction==='all'||regions.find(r=>r.id===jurisdiction)?.name===name),failedTiles,partial:failedTiles>0||catalog.unavailable.some(name=>jurisdiction==='all'||regions.find(r=>r.id===jurisdiction)?.name===name)};
 }
 async function findRecord(parcel,{signal}={}){
  const p=parcel?.properties;if(!p?.recordKey||!p.jurisdiction||!validAtlasBounds(parcel.bbox))return null;
  const {available}=await manifests(),m=available.find(r=>r.jurisdiction===p.jurisdiction);if(!m||signal?.aborted)return null;
  const matches=m.tiles.filter(t=>intersects(t.bounds,parcel.bbox));if(matches.length>maxTiles)return null;
  let found=null;
  for(let i=0;i<matches.length;i+=4){if(signal?.aborted)return null;const batch=await Promise.allSettled(matches.slice(i,i+4).map(async t=>{const data=await tile(t.url);if(data.schema!=='property-region-tile-v1'||data.id!==t.id||data.jurisdiction!==m.jurisdiction||data.sourceId!==m.source.id||JSON.stringify(data.fields)!==JSON.stringify(m.fields)||data.rows?.length!==t.count)throw Error('Property tile cannot be verified.');return data.rows;}));for(const r of batch)if(r.status==='fulfilled'){const row=r.value.find(row=>row[m.fields.indexOf('recordKey')]===p.recordKey);if(row){const candidate=decodeAtlasRow(row,m);if(candidate.sourceObjectId!==p.sourceObjectId||candidate.parcelKey!==p.parcelKey||candidate.parcelId!==p.parcelId)return null;found=candidate;}}}
  return signal?.aborted?null:found;
 }
 return {query,manifests,findRecord,clear(){cache.clear();manifestsPromise=null;}};
}
export const propertyRegionData=createPropertyRegionData();
export function propertyAtlasCsv(view){
 const keys=view.level==='properties'?['jurisdiction','recordKey','parcelKey','parcelId','sourceObjectId','address','municipality','longitude','latitude','taxYear','assessedValueUSD','assessorAppraisedValueUSD','latestSaleDateISO','latestSaleDateRaw','latestSalePriceUSD','latestSalePriceStatus','latestSaleValidityCode','latestSaleMarketValidityCode','latestSaleInstrumentTypeCode','latestSaleDateCenturyInferred','latestSaleSourceId']:['jurisdiction','id','longitude','latitude','count','knownCount','value'];
 keys.push('latestSaleReportedPriceUSD','displayMetric','aggregation','fromYear','throughYear','manifestUrl','sourceRetrievedAt');
 const esc=value=>typeof value==='number'?String(value):`"${String(value??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')}"`;
 return [keys,...view.features.map(r=>{const source=view.sources?.find(m=>m.jurisdiction===r.jurisdiction),row={...r,displayMetric:view.metric,aggregation:view.level==='areas'?'mean per source record in intersecting cell':'individual source record',fromYear:view.fromYear,throughYear:view.toYear,manifestUrl:source?.region.manifestUrl,sourceRetrievedAt:source?.source.retrievedAt};return keys.map(k=>row[k]);})].map(row=>row.map(esc).join(',')).join('\r\n');
}
