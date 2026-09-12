import { getPropertyLayer, projectPublicInventory, projectPermitRecords } from './property-layer-catalog.mjs';

const PATHS = Object.freeze({ permits:'/st-louis/permits/city-2025.json', 'planning-notices':'/st-louis/planning/index.json',
  'zoning-petitions':'/st-louis/planning/county-zoning-petitions.geojson', 'ownership-signals':'/st-louis/ownership-signals/index.json',
  'public-inventory':'/st-louis/public-listings/latest.json' });
const finite = value => typeof value === 'number' && Number.isFinite(value);
const string = value => typeof value === 'string' ? value : '';
const searchable = value => string(value).normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const validBounds = b => Array.isArray(b) && b.length === 4 && b.every(finite) && b[0] < b[2] && b[1] < b[3] && b[0] >= -180 && b[2] <= 180 && b[1] >= -90 && b[3] <= 90;
const located = record => finite(record.longitude) && finite(record.latitude) && Math.abs(record.longitude) <= 180 && Math.abs(record.latitude) <= 90;
const intersects = (a,b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const inside = (record,b) => record.longitude >= b[0] && record.longitude <= b[2] && record.latitude >= b[1] && record.latitude <= b[3];
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const sourceURL = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; } };
const aborted = signal => { if (signal?.aborted) throw new DOMException('Aborted','AbortError'); };
function waitWithSignal(promise, signal) {
  aborted(signal); if (!signal) return promise;
  return new Promise((resolve,reject) => {
    const stop = () => reject(new DOMException('Aborted','AbortError'));
    signal.addEventListener('abort',stop,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));
  });
}
function sourceInfo(source, retrievedAt) {
  return { id:string(source?.id)||null, name:string(source?.name)||null, url:sourceURL(source?.url), retrievedAt:date(retrievedAt || source?.retrievedAt) };
}
function commonRecord(layerId, row, original, extra = {}) {
  return { ...row, ...extra, layerId, title:extra.title || row.address || row.id, address:row.address || null,
    date:extra.date ?? null, dateBasis:extra.dateBasis ?? 'not-supplied',
    sourceURL:sourceURL(extra.sourceURL || row.sourceUrl), sourceUrl:sourceURL(extra.sourceURL || row.sourceUrl),
    original };
}
function select(records, options, supportsDates) {
  const words = searchable(options.query).split(' ').filter(Boolean);
  return records.filter(row => {
    if (located(row) && !inside(row, options.bounds)) return false;
    if (words.length && !words.every(word => [row.title,row.address,row.description,row.ownerName,row.status,
      row.original?.petitionRaw, ...(row.original?.caseIds || [])].map(searchable).join(' ').includes(word))) return false;
    if (supportsDates && (options.fromYear != null || options.toYear != null)) {
      const year = row.date ? Number(row.date.slice(0,4)) : null;
      if (year == null || (options.fromYear != null && year < options.fromYear) || (options.toYear != null && year > options.toYear)) return false;
    }
    return true;
  });
}
function layerResult(id, records, source, { partial=false, stale=false, coverage, supportsDates=true, sourceCount=records.length, ...extra } = {}) {
  const mapped = records.filter(located), count = records.reduce((n,row)=>n+(row.kind === 'activity-cell' ? row.count : 1),0);
  const mappedCount = mapped.reduce((n,row)=>n+(row.kind === 'activity-cell' ? row.count : 1),0), unmappedCount = count-mappedCount;
  return { records, features:mapped, summary:{ id, label:getPropertyLayer(id).label, status:partial || stale ? 'partial' : count > 0 && !mappedCount ? 'unmapped' : 'ready',
    coverage:coverage || getPropertyLayer(id).coverage, count, mappedCount, unmappedCount, sourceCount, source,
    retrievedAt:source?.retrievedAt || null, partial:Boolean(partial||stale), stale, dateFilterApplied:supportsDates, ...extra } };
}

/** Static, layer-specific count cells. Totals are record counts, never prices,
 * unique homes, permits-in-progress or inferred private-equity holdings. */
export function aggregatePropertyActivities(features, { level='areas', maxFeatures=2000, gridDegrees=.02 } = {}) {
  if (!Array.isArray(features) || !Number.isSafeInteger(maxFeatures) || maxFeatures < 1 || maxFeatures > 2000 || !finite(gridDegrees) || gridDegrees <= 0)
    throw new RangeError('Invalid activity display budget.');
  if (level === 'properties' && features.length <= maxFeatures) return features;
  let cells=[];
  for (let step=0; step<16; step++) {
    const size=gridDegrees*2**step, groups=new Map();
    for (const feature of features) {
      if (!located(feature)) continue;
      const x=Math.floor(feature.longitude/size), y=Math.floor(feature.latitude/size), key=`${feature.layerId}:${x}:${y}`;
      const count=feature.kind==='activity-cell' ? feature.count : 1;
      let cell=groups.get(key);
      if (!cell) {
        const bounds=[x*size,y*size,(x+1)*size,(y+1)*size];
        cell={id:`activity-cell:${key}:${size}`,kind:'activity-cell',layerId:feature.layerId,bounds,longitude:(bounds[0]+bounds[2])/2,latitude:(bounds[1]+bounds[3])/2,
          count:0,value:null,title:`${getPropertyLayer(feature.layerId)?.label || 'Activity'} area`,color:feature.color || '#b8cfe2',pixelSize:12};
        groups.set(key,cell);
      }
      cell.count+=count;
    }
    cells=[...groups.values()];
    if (cells.length<=maxFeatures) return cells;
  }
  // World-scale inputs can still retain several categories. Never silently cut
  // their totals; the caller receives an explicit budget error instead.
  throw new RangeError('Activity categories exceed the map display budget.');
}

/** Shared cached snapshots and bounded ownership tiles. Abandoning a view does
 * not cancel shared fetches; its result rejects immediately and cannot publish. */
export function createPropertyActivityData({ fetchImpl=(...args)=>fetch(...args), timeoutMs=20000, maxBytes=16000000,
  cacheBytes=32000000, ownershipDetailLimit=6000, ownershipTileLimit=16, now=()=>Date.now() } = {}) {
  const cache=new Map(), controllers=new Set(), lifecycle=new AbortController(), preparedSnapshots=new WeakMap(); let storedBytes=0, disposed=false;
  const prepare=(snapshot,create)=>{
    if(!snapshot||typeof snapshot!=='object')throw Error('Activity snapshot cannot be verified.');
    let result=preparedSnapshots.get(snapshot);if(!result){result=create();preparedSnapshots.set(snapshot,result);}return result;
  };
  function read(url) {
    if (disposed) return Promise.reject(new DOMException('Aborted','AbortError'));
    if (!/^\/st-louis\/[a-zA-Z0-9_./-]+\.(?:json|geojson)$/.test(url) || url.includes('..')) return Promise.reject(Error('Activity source path is invalid.'));
    if (cache.has(url)) {const value=cache.get(url);cache.delete(url);cache.set(url,value);return value.promise;}
    const controller=new AbortController();controllers.add(controller);let timer;
    const entry={bytes:0,promise:null};
    const operation=(async()=>{
      const response=await fetchImpl(url,{signal:controller.signal});
      if (!response.ok) throw Error('Activity source is unavailable.');
      if (Number(response.headers?.get?.('content-length'))>maxBytes) throw Error('Activity source exceeds its size budget.');
      const text=await response.text(),bytes=new TextEncoder().encode(text).byteLength;
      if (bytes>maxBytes) throw Error('Activity source exceeds its size budget.');
      const value=JSON.parse(text);
      if(cache.get(url)===entry){entry.bytes=bytes;storedBytes+=bytes;for(const [key,old] of cache){if(storedBytes<=cacheBytes)break;if(old.bytes){cache.delete(key);storedBytes-=old.bytes;}}}
      return value;
    })();
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Activity source timed out.'));},timeoutMs);});
    entry.promise=Promise.race([operation,deadline]).catch(error=>{if(cache.get(url)===entry){cache.delete(url);storedBytes-=entry.bytes;}throw error;}).finally(()=>{clearTimeout(timer);controllers.delete(controller);});
    cache.set(url,entry);return entry.promise;
  }
  async function load(id, options) {
    const snapshot=await waitWithSignal(read(PATHS[id]),options.signal);aborted(options.signal);
    if(id==='public-inventory'){
      const {projected,records}=prepare(snapshot,()=>{
        const projected=projectPublicInventory(snapshot);
        if(projected.status.state==='unavailable')throw Error('Public inventory cannot be verified.');
        const originals=new Map(snapshot.listings.map(row=>[row.id,row]));
        return {projected,records:projected.records.map(row=>commonRecord(id,{...row,kind:'listing'},originals.get(row.sourceListingId),{title:row.address || `LRA parcel ${row.parcelId}`,date:null,dateBasis:'listing-date-not-supplied'}))};
      });
      const ageHours=(now()-Date.parse(snapshot.retrievedAt))/3600000;
      return layerResult(id,select(records,options,false),projected.source,{sourceCount:snapshot.listings.length,partial:projected.status.partial||ageHours<-.0833,stale:projected.status.state==='stale'||ageHours>48,supportsDates:false});
    }
    if(id==='permits'){
      if(snapshot.schema!=='property-permit-points-v1')throw Error('Permit snapshot cannot be verified.');
      const {projected,records}=prepare(snapshot,()=>{
        const sourceId=snapshot.source?.id || snapshot.sourceId;
        const normalized={...snapshot,source:{...snapshot.source,id:sourceId},records:snapshot.records?.map(row=>({...row,sourceId:row.sourceId||sourceId,jurisdiction:row.jurisdiction||snapshot.jurisdiction}))};
        const projected=projectPermitRecords(normalized);
        if(projected.status.state==='unavailable')throw Error('Permit snapshot cannot be verified.');
        const originals=new Map(snapshot.records.map(row=>[row.id,row]));
        return {projected,records:projected.records.map(row=>commonRecord(id,row,originals.get(row.sourceRecordId),{title:row.address || `Permit ${row.applicationNumber || row.sourceRecordId}`,date:date(row.issuedDate),dateBasis:'permit-issue-date'}))};
      });
      return layerResult(id,select(records,options,true),sourceInfo(snapshot.source,snapshot.retrievedAt),{sourceCount:snapshot.records.length,partial:projected.status.partial,coverage:getPropertyLayer(id).coverage});
    }
    if(id==='planning-notices'){
      if(snapshot.schema!=='property-planning-v1'||!Array.isArray(snapshot.records)||!snapshot.sources)throw Error('Planning notices cannot be verified.');
      let invalid=0;
      const records=snapshot.records.flatMap(row=>{
        if(!string(row.id)||!string(row.title)||!Array.isArray(row.sources)||!row.sources.length||row.sources.some(key=>!snapshot.sources[key])||!sourceURL(row.officialUrl)){invalid++;return [];}
        const activityDate=date(row.announcedDate)||date(row.hearingDate)||date(row.statusAsOfDate);
        return [commonRecord(id,{id:`planning-notices:${row.id}`,kind:'planning',sourceRecordId:row.id,jurisdiction:row.jurisdiction,longitude:null,latitude:null,
          status:string(row.status)||'unknown',description:string(row.summary),address:row.geography?.addresses?.join(', ')||null},row,
          {title:row.title,date:activityDate,dateBasis:date(row.announcedDate)?'announcement-date':date(row.hearingDate)?'hearing-date':date(row.statusAsOfDate)?'status-as-of-date':'not-supplied',sourceURL:row.officialUrl})];
      });
      const dates=Object.values(snapshot.sources).map(source=>date(source.retrievedAt)).filter(Boolean).sort();
      return layerResult(id,select(records,options,true),{id:'official-planning-notices',name:'Official planning sources',url:null,retrievedAt:dates.at(-1)||null},{sourceCount:snapshot.records.length,partial:invalid>0});
    }
    if(id==='zoning-petitions'){
      if(snapshot.type!=='FeatureCollection'||snapshot.source?.id!=='st-louis-county-zoning-petitions'||!Array.isArray(snapshot.features))throw Error('Zoning petition source cannot be verified.');
      const {records,invalid}=prepare(snapshot,()=>{
       let invalid=0;
       const records=snapshot.features.flatMap(feature=>{
        const row=feature.properties,point=feature.geometry?.type==='Point'?feature.geometry.coordinates:null;
        if(!string(row?.id)||row.sourceId!==snapshot.source.id){invalid++;return [];}
        return [commonRecord(id,{id:`zoning-petitions:${row.id}`,kind:'planning',sourceRecordId:row.id,jurisdiction:row.jurisdiction,longitude:point?.[0]??null,latitude:point?.[1]??null,
          sourceObjectId:row.sourceObjectId,status:row.status||'decision-unknown',color:getPropertyLayer(id).color,pixelSize:8},feature,
          {title:row.petitionRaw?`Zoning petition ${row.petitionRaw}`:'Zoning petition record',date:null,dateBasis:'case-date-not-supplied',sourceURL:row.officialUrl})];
       });return {records,invalid};
      });
      // Edit timestamps are not petition or hearing dates. An active date filter
      // therefore excludes undated petitions instead of guessing from case IDs.
      return layerResult(id,select(records,options,true),sourceInfo(snapshot.source),{sourceCount:snapshot.features.length,partial:invalid>0});
    }
    if(id==='ownership-signals')return ownership(snapshot,options);
    throw Error('Unknown activity source.');
  }
  async function ownership(manifest,options){
    const id='ownership-signals',sourceId='st-louis-county-business-name-indicators';
    if(manifest.schema!=='ownership-signals-v1'||manifest.source?.id!==sourceId||!Array.isArray(manifest.tiles)||manifest.tiles.some(tile=>!validBounds(tile.bounds)||!Number.isSafeInteger(tile.count)||tile.count<0||!/^\/st-louis\/ownership-signals\/tiles\/[\w-]+\.json$/.test(tile.url)))throw Error('Ownership indicator source cannot be verified.');
    const tiles=manifest.tiles.filter(tile=>intersects(tile.bounds,options.bounds)),sourceCount=tiles.reduce((n,tile)=>n+tile.count,0),source=sourceInfo(manifest.source,manifest.retrievedAt);
    const sourceUnmappedCount=Number.isSafeInteger(manifest.unlocatedCount)?manifest.unlocatedCount:0;
    const coverage=getPropertyLayer(id).coverage+(sourceUnmappedCount?` ${sourceUnmappedCount.toLocaleString()} additional source records have no mapped coordinates and are outside these map counts.`:'');
    const detailed=options.level==='properties'&&sourceCount<=ownershipDetailLimit&&tiles.length<=ownershipTileLimit;
    if(!detailed){
      if(options.query.trim())return ownershipNames(manifest,tiles,options,source,sourceCount);
      const records=tiles.filter(tile=>tile.count>0).map(tile=>({id:`ownership-cell:${tile.id}`,layerId:id,kind:'activity-cell',count:tile.count,bounds:tile.bounds,
        longitude:(tile.bounds[0]+tile.bounds[2])/2,latitude:(tile.bounds[1]+tile.bounds[3])/2,title:`Organization-name indicators · ${tile.count.toLocaleString()} records`,
        date:null,dateBasis:'current-observation-not-acquisition',status:'name-pattern',value:null,color:getPropertyLayer(id).color,pixelSize:12,
        original:tile,sourceURL:source.url,sourceUrl:source.url}));
      return layerResult(id,records,source,{sourceCount,supportsDates:false,aggregation:'intersecting-source-cell-counts',coverage,sourceUnmappedCount});
    }
    let failed=0,invalid=0;const records=[],seen=new Set();
    for(let index=0;index<tiles.length;index+=4){
      aborted(options.signal);
      const results=await waitWithSignal(Promise.allSettled(tiles.slice(index,index+4).map(async tile=>{
        const value=await read(tile.url);
        if(value.schema!=='ownership-signals-tile-v1'||value.id!==tile.id||value.sourceId!==sourceId||value.jurisdiction!=='st-louis-county'||!Array.isArray(value.records)||value.records.length!==tile.count)throw Error('Ownership indicator tile cannot be verified.');
        return value.records;
      })),options.signal);
      for(const result of results){if(result.status==='rejected'){failed++;continue;}
        for(const row of result.value){
          if(!string(row.id)||!string(row.recordKey)||row.jurisdiction!=='st-louis-county'||row.indicator!=='name_contains_legal_designator'||!string(row.matchedDesignator)||!row.ruleVersion||row.ruleVersion!==manifest.ruleVersion||seen.has(row.id)){invalid++;continue;}
          seen.add(row.id);
          records.push(commonRecord(id,{id:`ownership-signals:${row.id}`,kind:'ownership',sourceRecordId:row.id,recordKey:row.recordKey,parcelKey:row.parcelKey??null,parcelId:row.parcelId??null,
            sourceObjectId:row.sourceObjectId,jurisdiction:row.jurisdiction,longitude:row.longitude,latitude:row.latitude,ownerName:string(row.ownerName),
            indicator:row.indicator,matchedDesignator:row.matchedDesignator,ruleVersion:row.ruleVersion,status:'name-pattern',value:null,color:getPropertyLayer(id).color,pixelSize:8},row,
            {title:string(row.ownerName)||'Organization-name indicator',date:null,dateBasis:'current-observation-not-acquisition',sourceURL:source.url}));
        }
      }
    }
    return layerResult(id,select(records,options,false),source,{sourceCount,partial:failed>0||invalid>0,supportsDates:false,failedTiles:failed,invalidRecords:invalid,coverage,sourceUnmappedCount});
  }
  async function ownershipNames(manifest,tiles,options,source,sourceCount){
    const id='ownership-signals';
    if(manifest.nameIndexUrl!=='/st-louis/ownership-signals/names-index.json')return layerResult(id,[],source,{partial:true,sourceCount,supportsDates:false,searchApplied:false,coverage:'Name search is unavailable for this broad view. Zoom into a smaller area to search the loaded ownership records.'});
    const snapshot=await waitWithSignal(read(manifest.nameIndexUrl),options.signal);
    if(snapshot?.schema!=='ownership-name-index-v1'||snapshot.sourceId!==manifest.source.id||snapshot.ruleVersion!==manifest.ruleVersion||!Array.isArray(snapshot.records)||
      (Number.isSafeInteger(manifest.nameCount)&&snapshot.records.length!==manifest.nameCount))throw Error('Ownership name index cannot be verified.');
    const entries=prepare(snapshot,()=>{
      if(snapshot.schema!=='ownership-name-index-v1'||snapshot.sourceId!==manifest.source.id||snapshot.ruleVersion!==manifest.ruleVersion||!Array.isArray(snapshot.records))throw Error('Ownership name index cannot be verified.');
      const tileMap=new Map(manifest.tiles.map(tile=>[tile.id,tile])),seen=new Set();
      for(const row of snapshot.records){
        if(!string(row.name)||row.normalizedOwnerName!==searchable(row.name)||seen.has(row.name)||!Number.isSafeInteger(row.count)||row.count<1||!Array.isArray(row.tiles))throw Error('Ownership name index cannot be verified.');
        seen.add(row.name);const seenTiles=new Set();let mapped=0;
        for(const tile of row.tiles){if(!tileMap.has(tile.id)||seenTiles.has(tile.id)||!Number.isSafeInteger(tile.count)||tile.count<1||tile.count>tileMap.get(tile.id).count)throw Error('Ownership name index cannot be verified.');seenTiles.add(tile.id);mapped+=tile.count;}
        if(mapped+(row.unlocatedCount||0)!==row.count)throw Error('Ownership name index counts cannot be verified.');
      }
      return snapshot.records;
    });
    const visibleTiles=new Map(tiles.map(tile=>[tile.id,tile])),words=searchable(options.query).split(' ').filter(Boolean),counts=new Map(),records=[];
    let mappedCount=0,unmappedCount=0;
    for(const row of entries){
      if(!words.every(word=>row.normalizedOwnerName.includes(word)))continue;
      const matched=row.tiles.filter(tile=>visibleTiles.has(tile.id)),mapped=matched.reduce((n,tile)=>n+tile.count,0),unlocated=row.unlocatedCount||0;
      if(!mapped&&!unlocated)continue;
      mappedCount+=mapped;unmappedCount+=unlocated;
      for(const tile of matched)counts.set(tile.id,(counts.get(tile.id)||0)+tile.count);
      records.push({id:`ownership-name:${encodeURIComponent(row.name)}`,layerId:id,kind:'ownership',ownerName:row.name,
        title:`${row.name} · ${mapped.toLocaleString()} mapped indicators`,count:mapped+unlocated,mappedCount:mapped,unmappedCount:unlocated,
        longitude:null,latitude:null,recordKey:null,parcelKey:null,status:'name-pattern-group',date:null,dateBasis:'current-observation-not-acquisition',
        sourceURL:source.url,sourceUrl:source.url,original:row,groupingBasis:'literal-source-owner-name; no aliases or common-control inference'});
    }
    const features=[...counts].map(([tileId,count])=>{
      const tile=visibleTiles.get(tileId);
      return {id:`ownership-name-cell:${tileId}`,layerId:id,kind:'activity-cell',count,bounds:tile.bounds,longitude:(tile.bounds[0]+tile.bounds[2])/2,
        latitude:(tile.bounds[1]+tile.bounds[3])/2,title:`Matching organization-name indicators · ${count.toLocaleString()} records`,value:null,color:getPropertyLayer(id).color,pixelSize:12};
    });
    return {records,features,summary:{id,label:getPropertyLayer(id).label,status:mappedCount?'ready':unmappedCount?'unmapped':'ready',
      coverage:'Literal public owner names matching the search, grouped by name and intersecting source cells. Spelling variants remain separate; no affiliates or common control are inferred. Unlocated matches stay in the feed.',
      count:mappedCount+unmappedCount,mappedCount,unmappedCount,sourceCount,source,retrievedAt:source.retrievedAt,partial:false,stale:false,
      dateFilterApplied:false,searchApplied:true,groupCount:records.length,aggregation:'literal-name-groups-and-source-cell-counts'}};
  }
  async function query({layers=['permits','planning-notices'],bounds,level='areas',query='',fromYear=null,toYear=null,signal}={}){
    if(disposed)throw new DOMException('Aborted','AbortError');
    signal=signal?AbortSignal.any([signal,lifecycle.signal]):lifecycle.signal;
    if(!Array.isArray(layers)||layers.some(id=>!Object.hasOwn(PATHS,id))||!validBounds(bounds)||!['areas','properties'].includes(level)||typeof query!=='string'||query.length>300)throw new RangeError('Choose valid activity layers and map bounds.');
    if([fromYear,toYear].some(value=>value!==null&&(!Number.isInteger(value)||value<1800||value>2200))||(fromYear!==null&&toYear!==null&&fromYear>toYear))throw new RangeError('Choose a valid activity date range.');
    const unique=[...new Set(layers)],options={bounds,level,query,fromYear,toYear,signal};aborted(signal);
    const settled=await waitWithSignal(Promise.allSettled(unique.map(id=>load(id,options))),signal);aborted(signal);
    const summaries=[],records=[],points=[];
    settled.forEach((result,index)=>{
      const id=unique[index];
      if(result.status==='fulfilled'){summaries.push(result.value.summary);records.push(...result.value.records);points.push(...result.value.features);}
      else summaries.push({id,label:getPropertyLayer(id).label,status:'unavailable',coverage:getPropertyLayer(id).coverage,count:0,mappedCount:0,unmappedCount:0,source:null,partial:true,error:'This source could not be loaded or verified. Retry to reconnect.'});
    });
    const features=aggregatePropertyActivities(points,{level});
    return {features,records,layers:summaries,partial:summaries.some(layer=>layer.partial),bounds,level,
      counts:{records:summaries.reduce((n,layer)=>n+layer.count,0),mappedRecords:summaries.reduce((n,layer)=>n+layer.mappedCount,0),unmappedRecords:summaries.reduce((n,layer)=>n+layer.unmappedCount,0),visualFeatures:features.length},
      coverage:summaries.map(layer=>({id:layer.id,coverage:layer.coverage,status:layer.status}))};
  }
  return {query,clear(){cache.clear();storedBytes=0;},dispose(){disposed=true;lifecycle.abort();for(const controller of controllers)controller.abort();cache.clear();storedBytes=0;}};
}
