/** Bounded, explicit car-routing requests. This is not a background inventory scan.
 * OSRM Table: https://project-osrm.org/docs/v5.24.0/api/#table-service
 * Provider policy: https://routing.openstreetmap.de/about.html
 */
export const PROPERTY_DRIVING_PROVIDER = Object.freeze({
  id:'fossgis-osrm-car',
  name:'FOSSGIS · OSRM car routing',
  url:'https://routing.openstreetmap.de/',
  endpoint:'https://routing.openstreetmap.de/routed-car/table/v1/driving/',
  policyUrl:'https://routing.openstreetmap.de/about.html',
  attribution:'Routing: FOSSGIS / OSRM · Map data © OpenStreetMap contributors',
  attributionUrl:'https://www.openstreetmap.org/copyright',
  fixMapUrl:'https://www.openstreetmap.org/fixthemap',
  distanceBasis:'Road distance along the modeled fastest car route, not the shortest-distance route.',
  durationBasis:'Modeled travel time; no live traffic or departure-time adjustment.',
  trafficAware:false,
  privacy:'Coordinates are sent to the public routing provider and may be logged there. Listing IDs, prices and addresses are not sent.',
  usage:'Small explicit requests only; no automatic scans. An owned routing service is needed for sustained or large-scale use.',
});
export const PROPERTY_DRIVING_LIMITS = Object.freeze({
  maxOrigins:25,maxDestinations:2,maxSnapMeters:100,
  intervalMs:1100,timeoutMs:20000,maxBytes:200000,
  cacheTtlMs:300000,maxCacheEntries:32,
  bounds:Object.freeze([-91,38.3,-89.9,39.1]),
});

// A page can instantiate multiple tool panels. They must share ONE provider
// queue, including the response body, rather than each consuming the rate limit.
let providerQueue=Promise.resolve(),lastRequestStarted=-Infinity;
const abortError=()=>new DOMException('Driving request was aborted.','AbortError');
const aborted=signal=>{if(signal?.aborted)throw signal.reason instanceof Error?signal.reason:abortError();};
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function abortable(promise,signal){
  if(signal.aborted){Promise.resolve(promise).catch(()=>{});return Promise.reject(signal.reason instanceof Error?signal.reason:abortError());}
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(signal.reason instanceof Error?signal.reason:abortError());
    signal.addEventListener('abort',cancel,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
}
function delay(ms,signal){
  aborted(signal);if(ms<=0)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const cancel=()=>{clearTimeout(timer);reject(signal.reason instanceof Error?signal.reason:abortError());};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
    signal.addEventListener('abort',cancel,{once:true});
  });
}
function scheduled(operation,signal){
  const task=providerQueue.then(async()=>{
    aborted(signal);
    // Repeat after timers fire: a timer can wake slightly early.
    while(Date.now()-lastRequestStarted<PROPERTY_DRIVING_LIMITS.intervalMs)
      await delay(PROPERTY_DRIVING_LIMITS.intervalMs-(Date.now()-lastRequestStarted),signal);
    aborted(signal);lastRequestStarted=Date.now();return operation();
  });
  providerQueue=task.catch(()=>{});
  return abortable(task,signal);
}
function coordinatesInRegion(longitude,latitude){
  const [west,south,east,north]=PROPERTY_DRIVING_LIMITS.bounds;
  return typeof longitude==='number'&&typeof latitude==='number'&&Number.isFinite(longitude)&&Number.isFinite(latitude)&&longitude>=west&&longitude<=east&&latitude>=south&&latitude<=north;
}
function points(input,kind,max){
  if(!Array.isArray(input)||input.length<1||input.length>max)throw new RangeError(`Provide 1–${max} ${kind}s.`);
  const ids=new Set();
  return input.map(row=>{
    if(!row||typeof row.id!=='string'||!row.id.trim()||row.id.length>512||/[\u0000-\u001f\u007f]/.test(row.id)||ids.has(row.id))throw new RangeError(`Each ${kind} needs a distinct, nonempty identifier.`);
    if(!coordinatesInRegion(row.longitude,row.latitude))throw new RangeError(`The ${kind} coordinates are invalid or outside the supported St. Louis region.`);
    ids.add(row.id);return {id:row.id,longitude:row.longitude,latitude:row.latitude};
  });
}
function geographicDistance(point,location){
  const rad=Math.PI/180,a=(location[1]-point.latitude)*rad,b=(location[0]-point.longitude)*rad;
  const h=Math.sin(a/2)**2+Math.cos(point.latitude*rad)*Math.cos(location[1]*rad)*Math.sin(b/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
function waypoints(input,expected){
  if(!Array.isArray(input)||input.length!==expected.length)throw Error('Routing response waypoint dimensions are invalid.');
  return input.map((row,i)=>{
    if(!row||!nonnegative(row.distance)||!Array.isArray(row.location)||row.location.length!==2||!coordinatesInRegion(row.location[0],row.location[1]))throw Error('Routing response contains an invalid waypoint.');
    return {distance:row.distance,tooFar:Math.max(row.distance,geographicDistance(expected[i],row.location))>PROPERTY_DRIVING_LIMITS.maxSnapMeters};
  });
}
function matrix(raw,origins,destinations){
  if(!raw||raw.code!=='Ok')throw Error('The routing provider could not return a verified road-route matrix.');
  if(Object.hasOwn(raw,'fallback_speed_cells'))throw Error('Routing response contains fallback estimates instead of verified road routes.');
  const sources=waypoints(raw.sources,origins),targets=waypoints(raw.destinations,destinations);
  for(const key of ['distances','durations']){
    if(!Array.isArray(raw[key])||raw[key].length!==origins.length||raw[key].some(row=>!Array.isArray(row)||row.length!==destinations.length))throw Error('Routing response matrix dimensions are invalid.');
  }
  const routes=origins.map((_,i)=>destinations.map((__,j)=>{
    const distance=raw.distances[i][j],duration=raw.durations[i][j];
    const missing=distance===null&&duration===null;
    if(!missing&&(!nonnegative(distance)||!nonnegative(duration)))throw Error('Routing response contains an invalid matrix cell.');
    const reason=sources[i].tooFar?'origin-snap-too-far':targets[j].tooFar?'destination-snap-too-far':missing?'no-route':null;
    return {status:reason?'unavailable':'routed',distanceMeters:reason?null:distance,durationSeconds:reason?null:duration,startSnapMeters:sources[i].distance,endSnapMeters:targets[j].distance,reason};
  }));
  return {routes,dataVersion:typeof raw.data_version==='string'&&/^\d{4}-\d\d-\d\dT/.test(raw.data_version)&&Number.isFinite(Date.parse(raw.data_version))?raw.data_version:null};
}
async function readResponse(response,signal){
  if(!response?.ok){void response?.body?.cancel?.().catch(()=>{});throw Error('The routing provider is unavailable. Try again later.');}
  if(Number(response.headers?.get?.('content-length'))>PROPERTY_DRIVING_LIMITS.maxBytes){void response.body?.cancel?.().catch(()=>{});throw Error('Routing response exceeds its byte limit.');}
  let text;
  if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0,complete=false;
    try{
      while(true){
        const {done,value}=await abortable(reader.read(),signal);if(done){complete=true;break;}
        if(!(value instanceof Uint8Array))throw Error('Routing response contains an invalid byte stream.');
        bytes+=value.byteLength;if(bytes>PROPERTY_DRIVING_LIMITS.maxBytes)throw Error('Routing response exceeds its byte limit.');chunks.push(value);
      }
      const body=new Uint8Array(bytes);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.byteLength;}
      text=new TextDecoder('utf-8',{fatal:true}).decode(body);
    }finally{
      if(!complete)void reader.cancel().catch(()=>{});
      try{reader.releaseLock();}catch{}
    }
  }else{
    text=await abortable(response.text(),signal);
    if(new TextEncoder().encode(text).byteLength>PROPERTY_DRIVING_LIMITS.maxBytes)throw Error('Routing response exceeds its byte limit.');
  }
  aborted(signal);
  try{return JSON.parse(text);}catch{throw Error('Routing response is not valid JSON.');}
}
function urlFor(origins,destinations){
  const coordinates=[...origins,...destinations].map(p=>`${p.longitude},${p.latitude}`).join(';');
  const url=new URL(coordinates,PROPERTY_DRIVING_PROVIDER.endpoint);
  url.searchParams.set('sources',origins.map((_,i)=>i).join(';'));
  url.searchParams.set('destinations',destinations.map((_,i)=>origins.length+i).join(';'));
  url.searchParams.set('annotations','distance,duration');url.searchParams.set('generate_hints','false');url.searchParams.set('skip_waypoints','false');
  return url.href;
}
function result(cached,origins,destinations,fromCache){
  return {provider:PROPERTY_DRIVING_PROVIDER,measuredAt:cached.measuredAt,dataVersion:cached.dataVersion,fromCache,
    rows:origins.map((point,i)=>({id:point.id,routes:destinations.map((destination,j)=>({destinationId:destination.id,...cached.routes[i][j]}))}))};
}

/** Inputs are [{id,longitude,latitude}]; only coordinate pairs reach the provider.
 * A rejected request is a source failure, not an empty inventory or zero distance.
 * `timeoutMs` may shorten, but cannot exceed, the production 20-second deadline.
 */
export function createPropertyDrivingClient({fetchImpl=(...args)=>fetch(...args),now=Date.now,timeoutMs=PROPERTY_DRIVING_LIMITS.timeoutMs}={}){
  if(typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>PROPERTY_DRIVING_LIMITS.timeoutMs)throw new RangeError('Invalid driving client options.');
  const cache=new Map(),lifecycle=new AbortController();
  async function measure(originInput,destinationInput,{signal}={}){
    aborted(lifecycle.signal);aborted(signal);
    const origins=points(originInput,'origin',PROPERTY_DRIVING_LIMITS.maxOrigins),destinations=points(destinationInput,'destination',PROPERTY_DRIVING_LIMITS.maxDestinations);
    const url=urlFor(origins,destinations),stamp=now();
    if(!Number.isFinite(stamp)||!Number.isFinite(new Date(stamp).getTime()))throw Error('Driving request time is invalid.');
    for(const [key,value] of cache)if(stamp-value.createdAt>=PROPERTY_DRIVING_LIMITS.cacheTtlMs||stamp<value.createdAt)cache.delete(key);
    if(cache.has(url)){const hit=cache.get(url);cache.delete(url);cache.set(url,hit);return result(hit,origins,destinations,true);}
    const deadline=new AbortController(),combined=AbortSignal.any([lifecycle.signal,deadline.signal,...signal?[signal]:[]]);
    const timer=setTimeout(()=>deadline.abort(new DOMException('Driving request timed out.','TimeoutError')),timeoutMs);
    try{
      const fresh=await scheduled(async()=>{
        aborted(combined);
        // A preceding identical queued request may have filled the cache.
        const queuedHit=cache.get(url),currentTime=now();
        if(queuedHit&&currentTime>=queuedHit.createdAt&&currentTime-queuedHit.createdAt<PROPERTY_DRIVING_LIMITS.cacheTtlMs)return {value:queuedHit,fromCache:true};
        const response=await abortable(fetchImpl(url,{signal:combined,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin',cache:'no-store',headers:{Accept:'application/json'}}),combined);
        const normalized=matrix(await readResponse(response,combined),origins,destinations);aborted(combined);
        const createdAt=now();if(!Number.isFinite(createdAt)||!Number.isFinite(new Date(createdAt).getTime()))throw Error('Driving response time is invalid.');
        const value={...normalized,createdAt,measuredAt:new Date(createdAt).toISOString()};cache.set(url,value);
        while(cache.size>PROPERTY_DRIVING_LIMITS.maxCacheEntries)cache.delete(cache.keys().next().value);
        return {value,fromCache:false};
      },combined);
      aborted(combined);return result(fresh.value,origins,destinations,fresh.fromCache);
    }finally{clearTimeout(timer);}
  }
  return {measure,destroy(){cache.clear();lifecycle.abort(abortError());}};
}
