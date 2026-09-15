import test from 'node:test';
import assert from 'node:assert/strict';

let instance = 0;
// A fresh module gives independent test schedules; the scheduler test deliberately
// creates multiple clients from ONE module, as the browser does.
const moduleUnderTest = () => import(`../../src/lib/property-driving.mjs?test=${++instance}`);
const origins = () => [{id:'import:one',longitude:-90.3508,latitude:38.6875}];
const destinations = () => [{id:'work',longitude:-90.306,latitude:38.648}];
const waypoint = p => ({location:[p.longitude,p.latitude],distance:0});
const table = (a=origins(),b=destinations()) => ({code:'Ok',sources:a.map(waypoint),destinations:b.map(waypoint),distances:a.map((_,i)=>b.map((_,j)=>7583.1+i*100+j*10)),durations:a.map((_,i)=>b.map((_,j)=>657.4+i*10+j)),data_version:'2026-09-14T00:00:00Z'});
const response = data => new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));

test('a rectangular matrix retains origin/destination order and sends only coordinates with correct browser policy',async()=>{
 const {createPropertyDrivingClient,PROPERTY_DRIVING_PROVIDER,PROPERTY_DRIVING_LIMITS}=await moduleUnderTest();
 const a=[...origins(),{id:'public:two',longitude:-90.4,latitude:38.7}],b=[...destinations(),{id:'other',longitude:-90.21,latitude:38.62}];let request;
 const client=createPropertyDrivingClient({fetchImpl:async(url,options)=>{request={url,options};return response(table(a,b));}});
 const result=await client.measure(a,b);const url=new URL(request.url);
 assert.equal(url.origin,'https://routing.openstreetmap.de');assert.match(url.pathname,/\/routed-car\/table\/v1\/driving\/-90.3508,38.6875;-90.4,38.7;-90.306,38.648;-90.21,38.62$/);
 assert.equal(url.searchParams.get('sources'),'0;1');assert.equal(url.searchParams.get('destinations'),'2;3');assert.equal(url.searchParams.get('annotations'),'distance,duration');assert.equal(url.searchParams.get('fallback_speed'),null);assert.equal(url.searchParams.get('generate_hints'),'false');
 assert.equal(request.options.credentials,'omit');assert.equal(request.options.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(request.options.cache,'no-store');assert.equal(request.url.includes('import'),false);
 assert.deepEqual(result.rows.map(r=>r.id),a.map(r=>r.id));assert.deepEqual(result.rows[1].routes.map(r=>r.destinationId),b.map(r=>r.id));assert.equal(result.rows[1].routes[1].distanceMeters,7693.1);assert.equal(result.rows[1].routes[1].durationSeconds,668.4);assert.equal(result.rows[0].routes[0].status,'routed');assert.equal(result.rows[0].routes[0].reason,null);
 assert.equal(result.fromCache,false);assert.equal(result.dataVersion,'2026-09-14T00:00:00Z');assert.ok(Number.isFinite(Date.parse(result.measuredAt)));assert.equal(result.provider.id,PROPERTY_DRIVING_PROVIDER.id);assert.equal(PROPERTY_DRIVING_LIMITS.maxOrigins,25);assert.equal(PROPERTY_DRIVING_LIMITS.maxDestinations,2);assert.match(result.provider.distanceBasis,/fastest/);assert.equal(result.provider.trafficAware,false);assert.match(result.provider.attribution,/OpenStreetMap/);assert.ok(result.provider.fixMapUrl.startsWith('https://www.openstreetmap.org/'));
 client.destroy();
});

test('bounds, IDs, numeric coordinates and batch sizes are validated before any request',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();let calls=0;const client=createPropertyDrivingClient({fetchImpl:async()=>{calls++;throw Error('must not fetch');}});
 const invalid=[[],null,{},[...origins(),...origins()],Array.from({length:26},(_,i)=>({...origins()[0],id:String(i)})),[{...origins()[0],id:''}],[{...origins()[0],id:null}],[{...origins()[0],longitude:'-90.35'}],[{...origins()[0],longitude:NaN}],[{...origins()[0],latitude:null}],[{...origins()[0],longitude:-91.01}],[{...origins()[0],latitude:39.1001}]];
 for(const a of invalid)await assert.rejects(client.measure(a,destinations()),/origin|coordinate|identifier|region/i);
 for(const b of [[],null,[...destinations(),...destinations()],Array.from({length:3},(_,i)=>({...destinations()[0],id:String(i)}))])await assert.rejects(client.measure(origins(),b),/destination|identifier/i);
 assert.equal(calls,0);client.destroy();
});

test('null routes, distant snaps and exactly 100 metres remain distinct from a measured zero',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();const a=Array.from({length:4},(_,i)=>({...origins()[0],id:String(i)})),raw=table(a);
 raw.distances[0][0]=raw.durations[0][0]=null;raw.sources[1].distance=100.01;raw.sources[2].distance=100;raw.distances[3][0]=raw.durations[3][0]=0;
 const r=await createPropertyDrivingClient({fetchImpl:async()=>response(raw)}).measure(a,destinations());
 assert.deepEqual(r.rows.map(x=>x.routes[0].status),['unavailable','unavailable','routed','routed']);assert.equal(r.rows[0].routes[0].reason,'no-route');assert.equal(r.rows[1].routes[0].reason,'origin-snap-too-far');assert.equal(r.rows[1].routes[0].distanceMeters,null);assert.equal(r.rows[1].routes[0].startSnapMeters,100.01);assert.equal(r.rows[3].routes[0].distanceMeters,0);
});

test('the observed public-provider fixture with a 140 metre destination snap is withheld',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();
 // Receipt reviewed 2026-09-15. Unlike the synthetic fixtures above, these are
 // the actual reported waypoint locations, distances, and matrix values.
 const raw={code:'Ok',distances:[[7583.1]],durations:[[657.4]],sources:[{distance:25.80344128,location:[-90.350767,38.687269]}],destinations:[{distance:140.2612023,location:[-90.306217,38.646748]}]};
 const r=await createPropertyDrivingClient({fetchImpl:async()=>response(raw)}).measure(origins(),destinations());
 assert.equal(r.rows[0].routes[0].status,'unavailable');assert.equal(r.rows[0].routes[0].reason,'destination-snap-too-far');assert.equal(r.rows[0].routes[0].distanceMeters,null);assert.equal(r.rows[0].routes[0].endSnapMeters,140.2612023);assert.equal(r.dataVersion,null);
});

test('malformed dimensions, values, waypoints, fallbacks and provider errors fail the entire matrix',async()=>{
 const changes=[r=>{r.distances=[];},r=>{r.durations[0].push(3);},r=>{r.distances[0][0]='7583';},r=>{r.durations[0][0]=-1;},r=>{r.distances[0][0]=null;},r=>{r.sources=[];},r=>{r.destinations[0].distance=null;},r=>{r.sources[0].location=[0,0];},r=>{r.sources[0].location[0]='-90.35';},r=>{r.fallback_speed_cells=[[0,0]];},r=>{r.fallback_speed_cells=[];},r=>{r.code='NoTable';},r=>{r.code='NoSegment';}];
 for(const change of changes){const {createPropertyDrivingClient}=await moduleUnderTest();const raw=table();change(raw);const client=createPropertyDrivingClient({fetchImpl:async()=>response(raw)});await assert.rejects(client.measure(origins(),destinations()),/matrix|waypoint|fallback|provider|route|response/i);client.destroy();}
});

test('a waypoint geographically farther than 100 metres is unavailable even if its reported distance is small',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();const raw=table();raw.sources[0].location[0]+=0.01;raw.sources[0].distance=0;
 const r=await createPropertyDrivingClient({fetchImpl:async()=>response(raw)}).measure(origins(),destinations());assert.equal(r.rows[0].routes[0].status,'unavailable');assert.equal(r.rows[0].routes[0].reason,'origin-snap-too-far');
});

test('successful matrices are cached by exact coordinate order, rebound to current IDs and protected from mutation',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();let calls=0,time=Date.now();const a=origins();
 const client=createPropertyDrivingClient({now:()=>time,fetchImpl:async()=>{calls++;return response(table());}});
 const first=await client.measure(a,destinations());first.rows[0].routes[0].distanceMeters=-1;
 const second=await client.measure([{...a[0],id:'different-exact-id'}],[{...destinations()[0],id:'new-destination-id'}]);
 assert.equal(calls,1);assert.equal(second.fromCache,true);assert.equal(second.rows[0].id,'different-exact-id');assert.equal(second.rows[0].routes[0].destinationId,'new-destination-id');assert.equal(second.rows[0].routes[0].distanceMeters,7583.1);assert.equal(first.measuredAt,second.measuredAt);
 time+=300001;const third=await client.measure(a,destinations());assert.equal(calls,2);assert.equal(third.fromCache,false);assert.notEqual(third.measuredAt,first.measuredAt);
 client.destroy();await assert.rejects(client.measure(a,destinations()),/destroy|abort/i);
});

test('changed or reordered coordinates are not mistaken for a cached matrix',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();let calls=0;const a=[...origins(),{id:'second',longitude:-90.4,latitude:38.7}];
 const client=createPropertyDrivingClient({fetchImpl:async url=>{calls++;const pts=new URL(url).pathname.split('/').at(-1).split(';').map((p,i)=>{const [longitude,latitude]=p.split(',').map(Number);return {id:String(i),longitude,latitude};});return response(table(pts.slice(0,2),pts.slice(2)));}});
 await client.measure(a,destinations());await client.measure([...a].reverse(),destinations());assert.equal(calls,2);client.destroy();
});

test('requests are serialized and spaced across clients; aborted queued work never contacts the provider',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();const starts=[];let running=0,maxRunning=0;
 const fetchImpl=async()=>{starts.push(Date.now());maxRunning=Math.max(maxRunning,++running);await pause(30);running--;return response(table());};
 const one=createPropertyDrivingClient({fetchImpl}),two=createPropertyDrivingClient({fetchImpl});const abort=new AbortController();
 const first=one.measure(origins(),destinations());await pause(5);const skipped=two.measure(origins(),destinations(),{signal:abort.signal});const skippedCheck=assert.rejects(skipped,{name:'AbortError'});abort.abort();
 const last=two.measure(origins(),destinations());await Promise.all([first,skippedCheck,last]);assert.equal(starts.length,2);assert.equal(maxRunning,1);assert.ok(starts[1]-starts[0]>=1090,`only ${starts[1]-starts[0]}ms between starts`);one.destroy();two.destroy();
});

test('abort, deadline and destroy stop both headers and streaming-body waits',async()=>{
 for(const kind of ['headers','body','abort','destroy']){
  const {createPropertyDrivingClient}=await moduleUnderTest();let cancelled=false;let gotSignal;const controller=new AbortController();
  const client=createPropertyDrivingClient({timeoutMs:30,fetchImpl:async(_url,options)=>{gotSignal=options.signal;if(kind==='headers')return new Promise(()=>{});return new Response(new ReadableStream({start(){},cancel(){cancelled=true;}}));}});
  const promise=client.measure(origins(),destinations(),{signal:controller.signal});const check=assert.rejects(promise,error=>kind==='headers'||kind==='body'?error.name==='TimeoutError':error.name==='AbortError');
  if(kind==='abort'||kind==='destroy'){await pause(5);if(kind==='abort')controller.abort();else client.destroy();}
  await check;assert.equal(gotSignal.aborted,true);if(kind!=='headers'){await pause(0);assert.equal(cancelled,true);}client.destroy();
 }
});

test('the deadline includes time spent waiting in the provider queue',async()=>{
 const {createPropertyDrivingClient}=await moduleUnderTest();let calls=0;const first=createPropertyDrivingClient({fetchImpl:async()=>response(table())});await first.measure(origins(),destinations());
 const second=createPropertyDrivingClient({timeoutMs:20,fetchImpl:async()=>{calls++;return response(table());}});await assert.rejects(second.measure(origins(),destinations()),{name:'TimeoutError'});assert.equal(calls,0);first.destroy();second.destroy();
});

test('response byte limits stop oversized headers and chunked bodies; failures never enter the cache',async()=>{
 for(const kind of ['header','chunks','http','json']){
  const {createPropertyDrivingClient}=await moduleUnderTest();let cancelled=false;
  const client=createPropertyDrivingClient({fetchImpl:async()=>kind==='header'?new Response('x',{headers:{'content-length':'200001'}}):kind==='chunks'?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(150000));c.enqueue(new Uint8Array(60000));},cancel(){cancelled=true;}})):kind==='http'?new Response('{}',{status:429}):new Response('invalid json')});
  await assert.rejects(client.measure(origins(),destinations()),/size|byte|unavailable|JSON|response/i);if(kind==='chunks')assert.equal(cancelled,true);client.destroy();
 }
 const {createPropertyDrivingClient}=await moduleUnderTest();let calls=0;const client=createPropertyDrivingClient({fetchImpl:async()=>++calls===1?new Response('{}',{status:503}):response(table())});await assert.rejects(client.measure(origins(),destinations()));const ok=await client.measure(origins(),destinations());assert.equal(ok.fromCache,false);assert.equal(calls,2);client.destroy();
});
