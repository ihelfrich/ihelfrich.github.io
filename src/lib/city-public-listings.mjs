const SERVICE = 'https://maps8.stlouis-mo.gov/arcgis/rest/services/SLDC/SLDC_Real_Estate/MapServer/0';
const AVAILABLE = "LRA='YES' AND Case_Status='Available' AND Status='Available'";
const DETAIL = 'https://www.stlouis-mo.gov/government/property/city-owned-property-search.cfm';
export const PUBLIC_LRA_SOURCE = Object.freeze({
  id:'st-louis-city-lra', name:'City of St. Louis · Land Reutilization Authority',
  url:'https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30',
  dataUrl:SERVICE,
  termsUrl:'https://dynamic.stlouis-mo.gov/opendata/terms.cfm',
  pricingUrl:'https://www.lrastl.org/offer-to-purchase',
  access:'Public, no account or data-access fee',
  terms:'City public-data terms; raw extracts may contain errors or change. No standardized license is stated.',
  updateFrequency:'Nightly according to the official catalog; individual record update times are not supplied.',
  availabilityFilter:AVAILABLE,
});
const FIELDS = 'OBJECTID,Handle,ParcelId,Address,LRA,Case_Status,Status,Usage,PropertyType,SQFT,BuildingCount';
const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : '';
const key = value => typeof value === 'string' ? value.trim() : Number.isSafeInteger(value) && value >= 0 ? String(value) : '';
const finite = value => Number.isFinite(value);

export function buildPublicListingsQuery({objectIds, idsOnly=false}={}) {
  const url=new URL(SERVICE+'/query');
  url.searchParams.set('f','json');url.searchParams.set('where',AVAILABLE);
  if(idsOnly) url.searchParams.set('returnIdsOnly','true');
  else {
    if(!Array.isArray(objectIds) || !objectIds.length || objectIds.length>500 || !objectIds.every(id=>Number.isSafeInteger(id)&&id>=0))
      throw new Error('Provide 1–500 numeric source object IDs.');
    url.searchParams.set('objectIds',objectIds.join(','));
    url.searchParams.set('outFields',FIELDS);url.searchParams.set('returnGeometry','true');url.searchParams.set('outSR','4326');
  }
  return url.href;
}

function inRing(point,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
// Translate first to avoid cancellation when small parcels use geographic coordinates.
function ringMeasure(ring) {
  const origin=ring[0];let twiceArea=0,mx=0,my=0;
  for(let i=0;i<ring.length;i++) {
    const next=ring[(i+1)%ring.length],a=[ring[i][0]-origin[0],ring[i][1]-origin[1]],b=[next[0]-origin[0],next[1]-origin[1]],cross=a[0]*b[1]-b[0]*a[1];
    twiceArea+=cross;mx+=(a[0]+b[0])*cross;my+=(a[1]+b[1])*cross;
  }
  if(!finite(twiceArea)||Math.abs(twiceArea)<1e-16)return null;
  return {area:Math.abs(twiceArea)/2,x:origin[0]+mx/(3*twiceArea),y:origin[1]+my/(3*twiceArea)};
}
function parcelCenter(geometry,spatialReference) {
  if((geometry?.spatialReference?.latestWkid || geometry?.spatialReference?.wkid || spatialReference?.latestWkid || spatialReference?.wkid)!==4326)return null;
  const rings=geometry?.rings;
  if(!Array.isArray(rings)||!rings.length||!rings.every(r=>Array.isArray(r)&&r.length>=3&&r.every(p=>Array.isArray(p)&&finite(p[0])&&finite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)))return null;
  const measures=rings.map(ringMeasure);if(measures.some(m=>!m))return null;
  let weight=0,x=0,y=0;
  for(let i=0;i<rings.length;i++) {
    // Ring containment identifies holes independently of winding/order.
    const depth=rings.reduce((n,r,j)=>n+(i!==j&&measures[j].area>measures[i].area&&inRing(rings[i][0],r)?1:0),0);
    const w=measures[i].area*(depth%2?-1:1);weight+=w;x+=measures[i].x*w;y+=measures[i].y*w;
  }
  return weight>0 && finite(x/weight)&&finite(y/weight) ? {longitude:x/weight,latitude:y/weight} : null;
}

export function normalizePublicListing(feature,{retrievedAt,spatialReference}={}) {
  if(!finite(Date.parse(retrievedAt)))throw new Error('A valid retrieval timestamp is required.');
  const a=feature?.attributes;
  if(!a||a.LRA!=='YES'||a.Case_Status!=='Available'||a.Status!=='Available')return null;
  const handle=key(a.Handle),parcelId=key(a.ParcelId);
  if(!handle||!parcelId)throw new Error('Available LRA record lacks its parcel identifiers.');
  const parcelKey='st-louis-city:'+handle,center=parcelCenter(feature.geometry,spatialReference);
  return {
    id:'lra:st-louis-city:'+parcelId,parcelKey,parcelId,handle,
    address:clean(a.Address)||null,
    latitude:center?.latitude??null,longitude:center?.longitude??null,
    coordinateBasis:center?'source-parcel-centroid':'unavailable',
    status:'available',sourceStatus:'Available',
    askingPrice:null,priceStatus:'not-published',
    usage:clean(a.Usage)||null,propertyType:clean(a.PropertyType)||null,
    lotSquareFeet:finite(a.SQFT)&&a.SQFT>0?a.SQFT:null,
    buildingCount:Number.isInteger(a.BuildingCount)&&a.BuildingCount>=0?a.BuildingCount:null,
    sourceId:PUBLIC_LRA_SOURCE.id,
    sourceUrl:DETAIL+'?action=detail&parcelId='+encodeURIComponent(parcelId),
    retrievedAt,sourceUpdatedAt:null,
  };
}

export function createPublicListingsSnapshot(payload,{retrievedAt}={}) {
  if(!finite(Date.parse(retrievedAt)))throw new Error('A valid retrieval timestamp is required.');
  if(payload?.error)throw new Error('Official LRA source returned an error.');
  if(!Array.isArray(payload?.features)||payload.exceededTransferLimit)throw new Error('Incomplete official LRA response.');
  const seen=new Set(),listings=[];let excluded=0;
  for(const feature of payload.features) {
    const listing=normalizePublicListing(feature,{retrievedAt,spatialReference:payload.spatialReference});
    if(!listing){excluded++;continue;}
    if(seen.has(listing.id))throw new Error('Duplicate LRA parcel identity: '+listing.parcelKey);
    seen.add(listing.id);listings.push(listing);
  }
  listings.sort((a,b)=>a.id.localeCompare(b.id));
  const parcelCounts=new Map();
  for(const listing of listings)parcelCounts.set(listing.parcelKey,(parcelCounts.get(listing.parcelKey)||0)+1);
  for(const listing of listings)listing.parcelJoinStatus=parcelCounts.get(listing.parcelKey)>1?'shared-handle':'unique-handle';
  return {
    schemaVersion:1,source:{...PUBLIC_LRA_SOURCE},retrievedAt,sourceUpdatedAt:null,
    coverage:{jurisdiction:'st-louis-city',scope:'LRA parcels explicitly marked Available. This is public land-bank inventory, not complete market coverage.',coordinateBasis:'Area-weighted centroid of source parcel rings; may fall outside a concave parcel. No building/entrance precision is claimed.',priceBasis:'No verified parcel asking price is published by this connection. Consult LRA pricing and offer requirements.'},
    counts:{sourceFeatures:payload.features.length,listings:listings.length,excluded,mapped:listings.filter(l=>l.latitude!==null).length,unknownAskingPrices:listings.length,uniqueParcelKeys:parcelCounts.size,sharedParcelKeys:[...parcelCounts.values()].filter(count=>count>1).length},
    listings,
  };
}

export async function loadPublicListings({url='/st-louis/public-listings/latest.json',fetchImpl=globalThis.fetch,signal,now=Date.now(),timeoutMs=15000}={}) {
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try {
    const response=await fetchImpl(url,{signal:controller.signal});
    if(!response.ok)throw new Error('Public sale inventory is unavailable.');
    const snapshot=await response.json();
    if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
    if(snapshot?.schemaVersion!==1||snapshot.source?.id!==PUBLIC_LRA_SOURCE.id||!Array.isArray(snapshot.listings)||!finite(Date.parse(snapshot.retrievedAt))||snapshot.sourceUpdatedAt!==null||!snapshot.listings.every(l=>l.id&&l.parcelKey&&l.parcelId&&l.status==='available'&&l.sourceStatus==='Available'&&l.askingPrice===null&&l.priceStatus==='not-published'))
      throw new Error('Invalid public sale inventory snapshot.');
    const ageHours=(now-Date.parse(snapshot.retrievedAt))/3600000;
    return {...snapshot,snapshotStatus:ageHours<-.0833?'unknown':ageHours>48?'stale':'recent',snapshotAgeHours:Math.max(0,ageHours)};
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
