import { parcelGeometryBounds, parcelContainsPoint } from './city-parcels.mjs';

export const SPATIAL_MODEL_VERSION = 'st-louis-spatial-statistics-v1';
export const SPATIAL_LIMITS = Object.freeze({ maxTiles: 12, maxBytes: 15_000_000, maxRecords: 5000 });
const EARTH_RADIUS_M = 6371008.8, RAD = Math.PI / 180;
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const median = values => { if (!values.length) return null; const sorted = [...values].sort((a,b)=>a-b), middle = Math.floor(sorted.length/2); return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2; };
const parts = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
function validate(point, radiusMeters) {
  if (!point || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude) || Math.abs(point.longitude)>180 || Math.abs(point.latitude)>=85) throw new RangeError('A valid local WGS84 selection is required.');
  if (![250,500].includes(radiusMeters)) throw new RangeError('Neighborhood radius must be 250 or 500 metres.');
}
function project(coordinate, point) { return [(coordinate[0]-point.longitude)*RAD*EARTH_RADIUS_M*Math.cos(point.latitude*RAD),(coordinate[1]-point.latitude)*RAD*EARTH_RADIUS_M]; }
function segmentDistanceSquared(a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length ? Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/length)) : 0;
  return (a[0]+t*dx)**2+(a[1]+t*dy)**2;
}
function nearestBoundarySquared(geometry,point) {
  let minimum=Infinity;
  for (const rings of parts(geometry)) for (const ring of rings) for (let i=1;i<ring.length;i++) minimum=Math.min(minimum,segmentDistanceSquared(project(ring[i-1],point),project(ring[i],point)));
  return minimum;
}
const validBounds = b => Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;
function boundsIntersect(bounds,point,radiusMeters) {
  const a=project([bounds[0],bounds[1]],point),b=project([bounds[2],bounds[3]],point);
  const x=Math.max(a[0],Math.min(0,b[0])),y=Math.max(a[1],Math.min(0,b[1]));
  return x*x+y*y<=radiusMeters*radiusMeters+1e-6;
}
/** Source geometry-circle intersection in the documented local projection. */
export function geometryIntersectsRadius(geometry,point,radiusMeters) {
  validate(point,radiusMeters); const bounds=parcelGeometryBounds(geometry);
  return boundsIntersect(bounds,point,radiusMeters)&&(parcelContainsPoint(geometry,point)||nearestBoundarySquared(geometry,point)<=radiusMeters*radiusMeters+1e-6);
}
export function selectNeighborhoodTiles(manifest,{point,radiusMeters=250,maxTiles=SPATIAL_LIMITS.maxTiles}={}) {
  validate(point,radiusMeters);
  if (manifest?.schema!=='st-louis-parcels-v1'||!Array.isArray(manifest.tiles)||!manifest.coverageGeometry||manifest.completeSourceExtraction!==true) throw new Error('A complete City parcel manifest is required.');
  parcelGeometryBounds(manifest.coverageGeometry);
  const urls=new Set();
  const tiles=manifest.tiles.filter(tile=>{
    if (!validBounds(tile?.bounds)||typeof tile.url!=='string') throw new Error('Parcel manifest tile bounds are incomplete.');
    if (!/^\/st-louis\/parcels\/tiles\/[A-Za-z0-9_-]+\.json$/.test(tile.url)) throw new Error('Only same-origin parcel geometry tiles are allowed.');
    if (urls.has(tile.url)) throw new Error('Duplicate tile identity in source manifest.'); urls.add(tile.url);
    return boundsIntersect(tile.bounds,point,radiusMeters);
  }).sort((a,b)=>order(a.url,b.url));
  if (tiles.length>maxTiles) throw new RangeError(`Neighborhood exceeds the ${maxTiles}-tile budget. Use a smaller radius.`);
  return tiles;
}
function inventorySummary(records,snapshot) {
  if (!snapshot || !Array.isArray(snapshot.listings)) return {status:'not-provided',matchedSourceRecords:null,matchedListingRecords:null,matchedHandles:null,source:null,retrievedAt:null};
  const pairs=new Map();
  for (const listing of snapshot.listings) {
    const key=typeof listing?.parcelKey==='string'?listing.parcelKey:typeof listing?.handle==='string'?`st-louis-city:${listing.handle}`:null;
    if (!key||typeof listing.parcelId!=='string') continue;
    const pair=JSON.stringify([key,listing.parcelId]);
    if (!pairs.has(pair)) pairs.set(pair,new Set());
    pairs.get(pair).add(typeof listing.id==='string'?listing.id:pair);
  }
  const matching=[],listingIds=new Set(),handles=new Set();
  for(const record of records) {
    const p=record.properties,key=JSON.stringify([`st-louis-city:${p.handle}`,p.parcelId]),listings=pairs.get(key);
    if(!listings)continue;
    matching.push(p.recordKey);handles.add(p.handle);for(const id of listings)listingIds.add(id);
  }
  return {status:'provided-subset',matchedSourceRecords:matching.length,matchedListingRecords:listingIds.size,matchedHandles:handles.size,source:snapshot.source||null,retrievedAt:snapshot.retrievedAt||null};
}
/** Pure deterministic account/handle summaries. No aggregate parcel-value totals. */
export function summarizeSpatialRecords(features,{point,radiusMeters=250,coverageGeometry,source=null,inventorySnapshot=null,maxRecords=SPATIAL_LIMITS.maxRecords}={}) {
  validate(point,radiusMeters); parcelGeometryBounds(coverageGeometry);
  if (!Array.isArray(features)) throw new TypeError('Source parcel records are required.');
  const identities=new Map(),matches=[],invalidGeometry=new Set();
  for (const feature of features) {
    const p=feature?.properties;
    if (typeof p?.recordKey!=='string'||!p.recordKey||typeof p.handle!=='string'||!p.handle||typeof p.parcelId!=='string') throw new Error('Source record identity is incomplete.');
    const signature=JSON.stringify([feature.geometry,Object.entries(p).sort(([a],[b])=>order(a,b))]);
    if(identities.has(p.recordKey)) { if(identities.get(p.recordKey)!==signature) throw new Error('Source record identity collision requires review.'); continue; }
    identities.set(p.recordKey,signature);
    if (validBounds(feature.bbox)&&!boundsIntersect(feature.bbox,point,radiusMeters)) continue;
    if(p.geometryStatus==='invalid-source') { invalidGeometry.add(p.recordKey);continue; }
    let intersects;
    try { intersects=geometryIntersectsRadius(feature.geometry,point,radiusMeters); } catch { invalidGeometry.add(p.recordKey);continue; }
    if(!intersects)continue;
    matches.push(feature);
    if(matches.length>maxRecords)throw new RangeError(`Neighborhood exceeds the ${maxRecords}-record budget. Use a smaller radius.`);
  }
  matches.sort((a,b)=>order(a.properties.recordKey,b.properties.recordKey));
  const groups=new Map(),assessments=[],landUses=new Map();let nonNullAreas=0;
  for(const feature of matches) {
    const p=feature.properties;
    if(!groups.has(p.handle))groups.set(p.handle,[]);groups.get(p.handle).push(p);
    const value=known(p.assessedValueUSD);if(value!==null)assessments.push(value);
    if(known(p.areaSqFt)!==null)nonNullAreas++;
    const code=typeof p.landUseCode==='string'&&p.landUseCode.trim()?p.landUseCode.trim():known(p.landUseCode)!==null?String(p.landUseCode):null;
    landUses.set(code,(landUses.get(code)||0)+1);
  }
  let sharedHandleGroups=0,conflictingHandles=0,unknownHandles=0;const areas=[];
  for(const records of groups.values()) {
    if(records.length>1)sharedHandleGroups++;
    const values=new Set(records.map(p=>known(p.areaSqFt)).filter(v=>v!==null));
    if(values.size>1)conflictingHandles++;else if(values.size===1)areas.push([...values][0]);else unknownHandles++;
  }
  const centerInCity=parcelContainsPoint(coverageGeometry,point),crossesBoundary=nearestBoundarySquared(coverageGeometry,point)<=radiusMeters*radiusMeters+1e-6;
  return {modelVersion:SPATIAL_MODEL_VERSION,status:'complete',point:{longitude:point.longitude,latitude:point.latitude},radiusMeters,
    source,coverage:{geographic:centerInCity&&!crossesBoundary?'within-city':'partial-city-coverage',geometryPolicy:'Source polygons intersect the radius in a local equirectangular projection; holes honored.',sourceScope:'City of St. Louis parcel snapshot only',exclusions:invalidGeometry.size},
    counts:{sourceRecords:matches.length,distinctHandles:groups.size,sharedHandleGroups},
    assessment:{medianUSD:median(assessments),nonNullAccounts:assessments.length,unknownAccounts:matches.length-assessments.length,assessmentYear:null},
    lotArea:{medianSqFt:median(areas),nonNullHandles:areas.length,unknownHandles,conflictingHandles,nonNullRecords:nonNullAreas,unknownRecords:matches.length-nonNullAreas},
    landUseCodes:[...landUses].sort(([a],[b])=>a===null?1:b===null?-1:order(a,b)).map(([code,count])=>({code,count})),
    excluded:{invalidGeometryCandidates:invalidGeometry.size},publicInventory:inventorySummary(matches,inventorySnapshot),recordKeys:matches.map(f=>f.properties.recordKey),
  };
}
/** Explicit request only. Every required tile must finish within one overall budget. */
export function createSpatialStatistics({manifestUrl='/st-louis/parcels/manifest.json',fetchImpl=(...args)=>fetch(...args),maxBytes=SPATIAL_LIMITS.maxBytes,maxTiles=SPATIAL_LIMITS.maxTiles,maxRecords=SPATIAL_LIMITS.maxRecords,timeoutMs=30000,now=Date.now}={}) {
  if (!/^\/st-louis\/parcels\/manifest\.json$/.test(manifestUrl)) throw new Error('Only the same-origin City parcel manifest is allowed.');
  return async function loadNeighborhood(point,{radiusMeters=250,signal,inventorySnapshot=null}={}) {
    validate(point,radiusMeters);
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const controller=new AbortController(),abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(abort,timeoutMs);let bytes=0;
    const check=()=>{if(controller.signal.aborted)throw new DOMException('Aborted or timed out','AbortError');};
    async function read(url) {
      check();const response=await fetchImpl(url,{signal:controller.signal,credentials:'same-origin'});check();
      if(!response.ok)throw new Error(`Parcel snapshot returned HTTP ${response.status}.`);
      let body='';
      if(response.body?.getReader) {
        const reader=response.body.getReader(),decoder=new TextDecoder();
        while(true) { const {value,done}=await reader.read();check();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new RangeError(`Neighborhood exceeds the ${maxBytes}-byte budget. No partial summary was calculated.`);}body+=decoder.decode(value,{stream:true}); }
        body+=decoder.decode();
      } else {
        body=await response.text();check();bytes+=new TextEncoder().encode(body).byteLength;
        if(bytes>maxBytes)throw new RangeError(`Neighborhood exceeds the ${maxBytes}-byte budget. No partial summary was calculated.`);
      }
      return JSON.parse(body);
    }
    try {
      const manifest=await read(manifestUrl),tiles=selectNeighborhoodTiles(manifest,{point,radiusMeters,maxTiles}),features=[];
      if(!geometryIntersectsRadius(manifest.coverageGeometry,point,radiusMeters))throw new Error('This radius has no verified City parcel coverage.');
      for(const tile of tiles) {
        const collection=await read(tile.url);
        if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features)||collection.exceededTransferLimit===true)throw new Error('A required parcel tile is incomplete.');
        if(Number.isSafeInteger(tile.count)&&collection.features.length!==tile.count)throw new Error('A required parcel tile has a source record-count mismatch.');
        features.push(...collection.features);
      }
      check();
      const result=summarizeSpatialRecords(features,{point,radiusMeters,coverageGeometry:manifest.coverageGeometry,source:manifest.source,inventorySnapshot,maxRecords});
      return {...result,computedAt:new Date(now()).toISOString(),transport:{bytes,tiles:tiles.length,tileUrls:tiles.map(t=>t.url),limits:{maxBytes,maxTiles,maxRecords}},sourceLimitations:manifest.limitations||[]};
    } finally { clearTimeout(timeout);signal?.removeEventListener('abort',abort); }
  };
}
