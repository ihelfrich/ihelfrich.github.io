/** Official parcel identity and exact source geometry. Never a listing inventory. */
export const CITY_PARCEL_SOURCE = Object.freeze({
  id: 'st-louis-city-parcels', jurisdiction: 'st-louis-city',
  name: 'City of St. Louis public parcel data',
  url: 'https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0',
  catalogUrl: 'https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82',
  termsUrl: 'https://dynamic.stlouis-mo.gov/opendata/terms.cfm',
  catalogPublishedAt: '2026-08-27',
  assessmentYear: null,
  geometryPolicy: 'Source WGS84 geometry; no simplification. GIS boundaries are not a legal survey.',
});
export const CITY_PARCEL_FIELDS = Object.freeze(['OBJECTID','HANDLE','ParcelId','ColParcelId','SITEADDR','SQFT','AsrLandUse1','AsdTotal','LastDate']);
const LIMITATIONS = Object.freeze([
  'Parcel boundaries do not establish ownership, availability or an asking price.',
  'Assessment year is not supplied by this layer; assessed value is not a current market valuation.',
  'Source LastDate is preserved as a record field, not interpreted as a transaction or assessment date.',
  'The City disclaims completeness, accuracy and fitness; validate decisions with the originating department.',
]);
function pointValues(point) {
  if (!point || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude) || Math.abs(point.longitude)>180 || Math.abs(point.latitude)>90) throw new RangeError('Enter finite WGS84 longitude and latitude.');
  return [point.longitude,point.latitude];
}
function validBounds(bounds) {
  return Array.isArray(bounds) && bounds.length===4 && bounds.every(Number.isFinite) && bounds[0]<=bounds[2] && bounds[1]<=bounds[3] && bounds[0]>=-180 && bounds[2]<=180 && bounds[1]>=-90 && bounds[3]<=90;
}
export function buildCityParcelQuery({ point, bounds, offset=0, limit=1000, objectIds } = {}) {
  if (!Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(limit) || limit<1 || limit>2000) throw new RangeError('Invalid bounded parcel page.');
  if (point && bounds) throw new RangeError('Use either a point or bounds.');
  const url=new URL(`${CITY_PARCEL_SOURCE.url}/query`);
  const params={ f:'geojson',where:'1=1',outFields:CITY_PARCEL_FIELDS.join(','),returnGeometry:'true',outSR:'4326',orderByFields:'OBJECTID ASC',resultOffset:String(offset),resultRecordCount:String(limit) };
  if (point) Object.assign(params,{geometry:pointValues(point).join(','),geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects'});
  if (bounds) {
    if (!validBounds(bounds)) throw new RangeError('Invalid WGS84 bounds.');
    Object.assign(params,{geometry:bounds.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects'});
  }
  if (objectIds) {
    if (!Array.isArray(objectIds) || !objectIds.length || objectIds.length>100 || !objectIds.every(n=>Number.isSafeInteger(n)&&n>0)) throw new RangeError('A query URL supports up to 100 object IDs; larger build batches use POST.');
    params.objectIds=objectIds.join(',');
  }
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  return url.href;
}
function polygons(geometry) {
  if (geometry?.type==='Polygon') return [geometry.coordinates];
  if (geometry?.type==='MultiPolygon') return geometry.coordinates;
  throw new TypeError('A parcel must have Polygon or MultiPolygon geometry.');
}
export function parcelGeometryBounds(geometry) {
  const bounds=[Infinity,Infinity,-Infinity,-Infinity], parts=polygons(geometry);
  if (!Array.isArray(parts)||!parts.length) throw new TypeError('Empty parcel geometry.');
  for (const rings of parts) {
    if (!Array.isArray(rings)||!rings.length) throw new TypeError('Empty parcel polygon.');
    for (const ring of rings) {
      if (!Array.isArray(ring)||ring.length<4) throw new TypeError('Invalid parcel ring.');
      for (const p of ring) {
        if (!Array.isArray(p)||p.length!==2) throw new TypeError('Parcel coordinates must be WGS84 2D positions.');
        pointValues({longitude:p[0],latitude:p[1]});
        bounds[0]=Math.min(bounds[0],p[0]); bounds[1]=Math.min(bounds[1],p[1]);
        bounds[2]=Math.max(bounds[2],p[0]); bounds[3]=Math.max(bounds[3],p[1]);
      }
      if (ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1]) throw new TypeError('Parcel rings must be closed.');
    }
  }
  return bounds;
}
const nullableNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
export function normalizeCityParcels(payload,{retrievedAt,catalogPublishedAt=CITY_PARCEL_SOURCE.catalogPublishedAt}={}) {
  if (!retrievedAt||!Number.isFinite(Date.parse(retrievedAt))) throw new TypeError('A retrieval timestamp is required.');
  if (payload?.error) throw new Error('The official parcel service returned an error.');
  if (payload?.type!=='FeatureCollection'||!Array.isArray(payload.features)) throw new TypeError('Expected a parcel GeoJSON FeatureCollection.');
  const ids=new Set();
  const features=payload.features.map(feature=>{
    const p=feature.properties||{}, handle=text(p.HANDLE);
    if (!handle) throw new TypeError('Source parcel HANDLE is required.');
    const parcelKey=`st-louis-city:${handle}`;
    if(!Number.isSafeInteger(p.OBJECTID)||p.OBJECTID<=0)throw new TypeError('Source parcel OBJECTID is required.');
    const parcelId=text(p.ParcelId)||text(p.ColParcelId)||handle;
    // HANDLE and even HANDLE+ParcelId are nonunique in the actual source.
    // OBJECTID makes a record identity within this dated snapshot, not a durable legal identifier.
    const recordKey=`${parcelKey}:${parcelId}:${p.OBJECTID}`;
    if (ids.has(recordKey)) throw new TypeError('Duplicate source parcel record requires review.');
    ids.add(recordKey);
    const bbox=parcelGeometryBounds(feature.geometry);
    return {type:'Feature',id:recordKey,bbox,geometry:structuredClone(feature.geometry),properties:{
      parcelKey,recordKey,sourceObjectId:p.OBJECTID,jurisdiction:'st-louis-city',handle,parcelId,
      address:text(p.SITEADDR)?.replace(/\s+/g,' ')||null,
      areaSqFt:nullableNumber(p.SQFT),landUseCode:nullableNumber(p.AsrLandUse1),
      assessedValueUSD:nullableNumber(p.AsdTotal),assessmentYear:null,
      sourceRecordDate:typeof p.LastDate==='number'&&Number.isFinite(p.LastDate)&&Number.isFinite(new Date(p.LastDate).getTime())?new Date(p.LastDate).toISOString():null,
    }};
  });
  return {type:'FeatureCollection',features,source:{...CITY_PARCEL_SOURCE,catalogPublishedAt,retrievedAt},limitations:[...LIMITATIONS],exceededTransferLimit:payload.exceededTransferLimit===true};
}
function ringLocation([x,y],ring) {
  let inside=false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [ax,ay]=ring[j],[bx,by]=ring[i],dx=bx-ax,dy=by-ay;
    const cross=(x-ax)*dy-(y-ay)*dx;
    if (Math.abs(cross)<=1e-12*Math.max(Math.abs(dx),Math.abs(dy),1e-9) && x>=Math.min(ax,bx)-1e-12 && x<=Math.max(ax,bx)+1e-12 && y>=Math.min(ay,by)-1e-12 && y<=Math.max(ay,by)+1e-12) return 0;
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside?1:-1;
}
export function parcelContainsPoint(geometry,point) {
  const coordinate=pointValues(point);
  return polygons(geometry).some(rings=>{
    const outer=ringLocation(coordinate,rings[0]);
    if (outer<0) return false;
    if (outer===0) return true;
    for (const hole of rings.slice(1)) {
      const position=ringLocation(coordinate,hole);
      if (position===0) return true;
      if (position===1) return false;
    }
    return true;
  });
}
const inBounds=([x,y],b)=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3];
/** Returns every overlapping parcel as candidates; never picks an arbitrary condo/account. */
export function createParcelLookup({manifestUrl='/st-louis/parcels/manifest.json',fetchImpl=(...args)=>fetch(...args),cacheSize=12}={}) {
  if(!Number.isSafeInteger(cacheSize)||cacheSize<1||cacheSize>64)throw new RangeError('Parcel tile cache must contain from 1 through 64 tiles.');
  let manifestPromise;
  const cache=new Map();
  const read=async url=>{const response=await fetchImpl(url);if(!response.ok)throw new Error('Parcel snapshot unavailable.');return response.json();};
  async function manifest() {
    if (!manifestPromise) manifestPromise=read(manifestUrl).catch(error=>{manifestPromise=null;throw error;});
    return manifestPromise;
  }
  async function tile(url) {
    if (cache.has(url)) { const value=cache.get(url);cache.delete(url);cache.set(url,value);return value; }
    const promise=read(url).catch(error=>{cache.delete(url);throw error;});
    cache.set(url,promise);
    while(cache.size>cacheSize)cache.delete(cache.keys().next().value);
    return promise;
  }
  return async function lookupParcel(point) {
    let coordinate;
    try { coordinate=pointValues(point); } catch { return {status:'unavailable',parcel:null,source:null,reason:'invalid-coordinate'}; }
    let m;
    try {
      m=await manifest();
      if (m.schema!=='st-louis-parcels-v1'||!Array.isArray(m.tiles)||!m.coverageGeometry) throw new Error('Invalid parcel manifest.');
      if (!parcelContainsPoint(m.coverageGeometry,point)) return {status:'unsupported',parcel:null,source:m.source,reason:'outside-city',officialLookupUrl:'https://stlcogis.maps.arcgis.com/apps/experiencebuilder/experience/?id=11ade50ce10741f9a2ed59659109843e'};
      const nearby=m.tiles.filter(t=>validBounds(t.bounds)&&inBounds(coordinate,t.bounds));
      const data=await Promise.all(nearby.map(t=>tile(t.url)));
      const found=new Map();
      for(const collection of data) {
        if(collection.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('Invalid parcel tile.');
        for(const feature of collection.features) {
          if(!inBounds(coordinate,feature.bbox||parcelGeometryBounds(feature.geometry)))continue;
          if(feature.properties.geometryStatus==='invalid-source')return {status:'unavailable',parcel:null,source:m.source,reason:'invalid-source-geometry'};
          if(parcelContainsPoint(feature.geometry,point))found.set(feature.properties.recordKey,feature);
        }
      }
      const candidates=[...found.values()].sort((a,b)=>a.properties.recordKey.localeCompare(b.properties.recordKey));
      const joined=typeof point.parcelKey==='string'?candidates.filter(f=>f.properties.parcelKey===point.parcelKey):[];
      const requested=typeof point.recordKey==='string'?candidates.find(f=>f.properties.recordKey===point.recordKey):joined.length===1?joined[0]:null;
      return candidates.length?{status:'found',parcel:requested||(candidates.length===1?candidates[0]:null),candidates,source:m.source,ambiguous:!requested&&candidates.length>1}:{status:'not-found',parcel:null,candidates:[],source:m.source,reason:'no-covered-parcel'};
    } catch { return {status:'unavailable',parcel:null,source:m?.source||null,reason:'snapshot-unavailable'}; }
  };
}
export const lookupParcel=createParcelLookup();

const searchText=value=>String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Lazy address-only index; interior representative points preserve exact lookup. */
export function createParcelSearch({manifestUrl='/st-louis/parcels/manifest.json',fetchImpl=(...args)=>fetch(...args)}={}) {
  let pending;
  async function load() {
    if(!pending)pending=(async()=>{
      const manifestResponse=await fetchImpl(manifestUrl);
      if(!manifestResponse.ok)throw new Error('Parcel address index unavailable.');
      const manifest=await manifestResponse.json();
      if(manifest.schema!=='st-louis-parcels-v1'||typeof manifest.search?.url!=='string')throw new Error('Parcel address index unavailable.');
      const response=await fetchImpl(manifest.search.url);
      if(!response.ok)throw new Error('Parcel address index unavailable.');
      const index=await response.json();
      if(index.schema!=='st-louis-parcel-addresses-v1'||!Array.isArray(index.records))throw new Error('Parcel address index unavailable.');
      return {source:manifest.source,records:index.records.map(row=>{
        if(!Array.isArray(row)||row.length!==7||typeof row[0]!=='string'||typeof row[2]!=='string'||typeof row[6]!=='string')throw new Error('Invalid parcel address record.');
        pointValues({longitude:row[3],latitude:row[4]});
        return {row,normalized:searchText(row[2])};
      })};
    })().catch(error=>{pending=null;throw error;});
    return pending;
  }
  return async function searchParcels(query,{limit=12}={}) {
    if(typeof query!=='string'||searchText(query).length<3)return [];
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new RangeError('Search limit must be from 1 through 50.');
    const normalized=searchText(query),tokens=normalized.split(' '),index=await load();
    return index.records.filter(record=>tokens.every(token=>record.normalized.includes(token)))
      .sort((a,b)=>Number(b.normalized.startsWith(normalized))-Number(a.normalized.startsWith(normalized))||a.normalized.localeCompare(b.normalized)||a.row[0].localeCompare(b.row[0]))
      .slice(0,limit).map(({row})=>({parcelKey:`st-louis-city:${row[0]}`,recordKey:row[6],parcelId:row[1],address:row[2],longitude:row[3],latitude:row[4],jurisdiction:'st-louis-city',source:index.source}));
  };
}
export const searchParcels=createParcelSearch();
