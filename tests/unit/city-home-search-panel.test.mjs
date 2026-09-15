import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createHomeSearchPanel} from '../../src/scripts/city/city-home-search-panel.mjs';

const settled=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const instant='2026-09-15T20:00:00.000Z';
const provider={id:'fossgis-osrm-car',url:'https://routing.openstreetmap.de/routed-car/',trafficAware:false,distanceBasis:'distance along the modeled fastest route',attribution:'© OpenStreetMap contributors',fixMapUrl:'https://www.openstreetmap.org/fixthemap'};
const home=(id='home-a',patch={})=>({id,listingId:id,address:`${id} Example Street`,longitude:-90.35,latitude:38.68,askingPrice:200000,status:'active',source:'Permitted fixture import',asOf:'2026-09-14',beds:3,baths:2,livingAreaSqFt:1500,propertyType:'house',...patch});
const point=(label='Work',patch={})=>({address:label,longitude:-90.30,latitude:38.64,...patch});
const measurement=(origins,destinations,routePatch=()=>({}))=>({provider,measuredAt:instant,dataVersion:'2026-09-14T00:00:00Z',fromCache:false,rows:origins.map(origin=>({id:origin.id,routes:destinations.map(destination=>({destinationId:destination.id,status:'routed',reason:null,distanceMeters:1609.344,durationSeconds:120,startSnapMeters:5,endSnapMeters:8,...routePatch(origin,destination)}))}))});

function fixture(t,{listings=[home()],measure,search,getPublicInventory}={}){
 const window=new Window({url:'https://ihelfrich.github.io/st-louis/'}),doc=window.document,root=doc.createElement('div');doc.body.append(root);
 const calls={measure:[],search:[],public:[],downloads:[],markers:[],inspect:[],fit:[],imports:0,destroy:0};
 let inventory={listings,fileName:'authorized-listings.csv',retrievedAt:'2026-09-15T19:00:00Z'};
 const driving={measure:async(origins,destinations,options)=>{calls.measure.push({origins,destinations,options});return measure?measure(origins,destinations,options):measurement(origins,destinations);},destroy(){calls.destroy++;}};
 const panel=createHomeSearchPanel(root,{getListings:()=>inventory,getPublicInventory:async()=>{calls.public.push(true);return getPublicInventory?getPublicInventory():{retrievedAt:instant,listings:[]};},driving,
  search:async(query,options)=>{calls.search.push({query,options});return search?search(query,options):{results:[point('First address'),point('Second address',{longitude:-90.28,latitude:38.62})]};},
  onMarkers:(records,onInspect)=>calls.markers.push({records,onInspect}),onInspect:record=>calls.inspect.push(record),onFit:records=>calls.fit.push(records),onImport:()=>calls.imports++,
  download:(text,type,name)=>calls.downloads.push({text,type,name}),now:()=>new Date(instant)});
 const $=name=>root.querySelector(`[data-home="${name}"]`);
 const event=(node,type)=>node.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true}));
 const change=(name,value)=>{const node=$('criteria').elements.namedItem(name);node.value=String(value);event(node,node.tagName==='SELECT'?'change':'input');};
 const select=(p=point())=>{panel.setEvidence({point:p});$('use-selected').click();};
 const limits=(index,maximumMiles,maximumMinutes)=>{const inputs=$('destinations').querySelectorAll('fieldset')[index].querySelectorAll('input');for(const[i,value]of [maximumMiles,maximumMinutes].entries()){inputs[i].value=value===null?'':String(value);event(inputs[i],'input');}};
 const run=async()=>{event($('criteria'),'submit');await settled();};
 const exportResult=()=>{$('export').click();return JSON.parse(calls.downloads.at(-1).text);};
 t.after(async()=>{panel.destroy();await window.happyDOM.abort();});
 return {window,doc,root,panel,calls,$,event,change,select,limits,run,exportResult,setInventory:value=>{inventory=value;}};
}

test('construction, activation, map selection and criteria edits do not request routes or inventory',async t=>{
 const f=fixture(t);f.panel.setActive(true);f.select();f.change('maxPrice',250000);f.$('source').value='public';f.event(f.$('source'),'change');await settled();
 assert.equal(f.calls.measure.length,0);assert.equal(f.calls.search.length,0);assert.equal(f.calls.public.length,0);assert.equal(f.$('export').disabled,true);
 f.$('import').click();assert.equal(f.calls.imports,1);
});

test('destination search requires an exact result choice and routes the selected point',async t=>{
 const f=fixture(t);f.$('query').value='123 Example';f.event(f.$('address-form'),'submit');await settled();
 assert.equal(f.calls.search[0].query,'123 Example');assert.equal(f.calls.search[0].options.limit,8);assert.equal(f.calls.measure.length,0);assert.equal(f.$('destinations').children.length,0);
 f.$('address-results').querySelectorAll('button')[1].click();await f.run();
 const destination=f.calls.measure[0].destinations[0];assert.equal(destination.label,'Second address');assert.equal(destination.longitude,-90.28);assert.equal(destination.latitude,38.62);assert.equal(f.panel.getResult().records[0].outcome,'match');
});

test('selected map destinations retain their coordinates, reject duplicate points and cap the choice at two',async t=>{
 const f=fixture(t);f.select(point('First'));f.select(point('Duplicate'));assert.equal(f.$('destinations').children.length,1);assert.match(f.$('address-status').textContent,/already selected/);
 f.select(point('Second',{longitude:-90.29}));f.select(point('Third',{longitude:-90.28}));assert.equal(f.$('destinations').children.length,2);assert.match(f.$('address-status').textContent,/Two destinations/);
 await f.run();assert.deepEqual(f.calls.measure[0].destinations.map(d=>[d.label,d.longitude,d.latitude]),[['First',-90.30,38.64],['Second',-90.29,38.64]]);
});

test('price and typed property criteria exclude missing evidence before requesting routes',async t=>{
 const f=fixture(t,{listings:[home('yes'),home('price-unknown',{askingPrice:null}),home('too-high',{askingPrice:300000}),home('beds-unknown',{beds:null}),home('pending',{status:'pending'}),home('condo',{propertyType:'condo'})]});
 f.select();f.change('minPrice',150000);f.change('maxPrice',250000);f.change('minBeds',3);f.change('propertyType','house');await f.run();
 assert.deepEqual(f.calls.measure[0].origins.map(r=>r.id),['yes']);const r=f.panel.getResult();assert.equal(r.filterCounts.input,6);assert.equal(r.filterCounts.excluded,5);assert.equal(r.filterCounts.unknown,2);assert.equal(r.exclusions['unknown-price'],1);assert.equal(r.exclusions['unknown-beds'],1);assert.match(f.$('results').textContent,/2 lacked evidence/);
});

test('every miles and minutes constraint must pass for both destinations, inclusive at the boundary',async t=>{
 const f=fixture(t,{listings:['boundary','first-miles','first-minutes','second-miles','second-minutes'].map(id=>home(id)),measure:(origins,destinations)=>measurement(origins,destinations,(o,d)=>{const first=d.id==='destination-1';return {distanceMeters:(first?2:3)*1609.344+((o.id===(first?'first-miles':'second-miles'))?1:0),durationSeconds:(first?10:20)*60+((o.id===(first?'first-minutes':'second-minutes'))?1:0)};})});
 f.select(point('Work'));f.select(point('Family',{longitude:-90.29}));f.limits(0,2,10);f.limits(1,3,20);await f.run();
 const outcomes=Object.fromEntries(f.panel.getResult().records.map(r=>[r.listing.id,r.outcome]));assert.equal(outcomes.boundary,'match');for(const id of ['first-miles','first-minutes','second-miles','second-minutes'])assert.equal(outcomes[id],'outside-limits',id);assert.equal(f.root.querySelectorAll('.home-match').length,1);
});

test('unavailable and absent route evidence remain unknown rather than outside the limits',async t=>{
 const f=fixture(t,{listings:[home('no-route'),home('missing-destination')],measure:(origins,destinations)=>{const m=measurement(origins,destinations,(o)=>o.id==='no-route'?{status:'unavailable',reason:'no-route',distanceMeters:null,durationSeconds:null}:{});m.rows.find(r=>r.id==='missing-destination').routes.pop();return m;}});
 f.select();await f.run();assert.deepEqual(f.panel.getResult().records.map(r=>r.outcome),['unavailable','unavailable']);assert.match(f.$('results').textContent,/2 could not be routed reliably/);assert.match(f.$('results').textContent,/Unavailable routes do not establish/);assert.deepEqual(f.calls.markers.at(-1).records,[]);
});

test('a measured zero route is a valid value while missing numeric evidence is unknown',async t=>{
 const f=fixture(t,{listings:[home('zero'),home('missing')],measure:(origins,destinations)=>measurement(origins,destinations,o=>o.id==='zero'?{distanceMeters:0,durationSeconds:0}:{distanceMeters:null,durationSeconds:null})});
 f.select();await f.run();assert.equal(f.panel.getResult().records.find(r=>r.listing.id==='zero').outcome,'match');assert.equal(f.panel.getResult().records.find(r=>r.listing.id==='missing').outcome,'unavailable');assert.match(f.$('results').textContent,/0\.0 driving mi/);
});

for(const scenario of ['criteria','import','cancel','source','destination'])test(`a late routing response cannot restore results after ${scenario} changes`,async t=>{
 const wait=deferred();const f=fixture(t,{measure:()=>wait.promise});f.select();await f.run();const request=f.calls.measure[0];assert.equal(f.$('run').disabled,true);
 if(scenario==='criteria')f.change('maxPrice',100000);
 if(scenario==='import'){f.setInventory({listings:[home('new')],fileName:'new.csv'});f.panel.invalidateInventory();}
 if(scenario==='cancel')f.$('cancel').click();
 if(scenario==='source'){f.$('source').value='public';f.event(f.$('source'),'change');}
 if(scenario==='destination')f.limits(0,4,5);
 assert.equal(request.options.signal.aborted,true);wait.resolve(measurement(request.origins,request.destinations));await settled();assert.equal(f.panel.getResult(),null);assert.equal(f.$('results').children.length,0);assert.equal(f.$('export').disabled,true);assert.equal(f.$('run').disabled,false);assert.deepEqual(f.calls.markers.at(-1).records,[]);
});

test('a newly accepted result survives a superseded request completing last',async t=>{
 const first=deferred();let n=0;const f=fixture(t,{measure:(origins,destinations)=>++n===1?first.promise:measurement(origins,destinations)});f.select();await f.run();const old=f.calls.measure[0];
 f.setInventory({listings:[home('new')],fileName:'new.csv'});f.panel.invalidateInventory();await f.run();assert.equal(f.panel.getResult().records[0].listing.id,'new');first.resolve(measurement(old.origins,old.destinations));await settled();assert.equal(f.panel.getResult().records[0].listing.id,'new');assert.match(f.$('results').textContent,/new Example Street/);
});

test('stale address matches are not actionable after editing the address or disposing',async t=>{
 const first=deferred();const f=fixture(t,{search:()=>first.promise});f.$('query').value='Old address';f.event(f.$('address-form'),'submit');f.$('query').value='New address';f.event(f.$('query'),'input');first.resolve({results:[point('Old response')]});await settled();
 assert.equal(f.calls.search[0].options.signal.aborted,true);assert.equal(f.$('address-results').children.length,0);assert.equal(f.$('destinations').children.length,0);
 const second=deferred();const g=fixture(t,{search:()=>second.promise});g.$('query').value='Pending';g.event(g.$('address-form'),'submit');g.panel.destroy();second.resolve({results:[point()]});await settled();assert.equal(g.root.children.length,0);assert.equal(g.calls.measure.length,0);
});

test('only 25 explicitly disclosed closest candidates are routed and evidence retains the eligible denominator',async t=>{
 const f=fixture(t,{listings:Array.from({length:30},(_,i)=>home(`home-${String(i).padStart(2,'0')}`,{longitude:-90.31-i*.001,latitude:38.64}))});f.select();await f.run();
 assert.equal(f.calls.measure[0].origins.length,25);assert.equal(f.calls.measure.length,1);assert.equal(f.panel.getResult().eligibleCount,30);assert.equal(f.panel.getResult().records.length,25);assert.equal(f.panel.getResult().partial,true);assert.deepEqual(f.calls.measure[0].origins.map(r=>r.id),Array.from({length:25},(_,i)=>`home-${String(i).padStart(2,'0')}`));assert.match(f.$('results').textContent,/Checked 25 of 30/);assert.match(f.$('results').textContent,/partial search/);assert.equal(f.exportResult().partial,true);
});

test('public source loads only on demand and routes Building records without inventing asking prices',async t=>{
 const publicRows=[home('building',{status:'available',propertyType:'Building',askingPrice:null,sourceId:'city-lra',asOf:null,retrievedAt:instant}),home('lot',{status:'available',propertyType:'Lot',askingPrice:null}),home('unknown-type',{status:'available',propertyType:null,askingPrice:null})];
 const f=fixture(t,{getPublicInventory:async()=>({retrievedAt:instant,listings:publicRows})});f.$('source').value='public';f.event(f.$('source'),'change');f.select();assert.equal(f.calls.public.length,0);await f.run();
 assert.equal(f.calls.public.length,1);assert.deepEqual(f.calls.measure[0].origins.map(r=>r.id),['building']);assert.equal(f.panel.getResult().records[0].listing.askingPrice,null);assert.match(f.$('results').textContent,/Price not published/);assert.match(f.$('inventory-status').textContent,/1 City land-bank building/);assert.match(f.panel.getResult().inventory.coverage,/no private listings or County/);
 f.change('maxPrice',200000);await f.run();assert.equal(f.calls.measure.length,1);assert.equal(f.calls.public.length,1);assert.equal(f.panel.getResult(),null);assert.match(f.$('status').textContent,/No driving request was sent/);
});

test('a deferred public inventory response cannot trigger routing after a source switch',async t=>{
 const pending=deferred();const f=fixture(t,{getPublicInventory:()=>pending.promise});f.$('source').value='public';f.event(f.$('source'),'change');f.select();await f.run();assert.equal(f.calls.public.length,1);
 f.$('source').value='imported';f.event(f.$('source'),'change');pending.resolve({retrievedAt:instant,listings:[home('old-public',{status:'available',propertyType:'Building'})]});await settled();assert.equal(f.calls.measure.length,0);assert.equal(f.panel.getResult(),null);assert.equal(f.$('run').disabled,false);
});

test('evidence export preserves exact criteria, provider, source dates, destination limits and route evidence',async t=>{
 const addressSource={id:'county-address-points',name:'County public address points',url:'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Addresses/MapServer/0',retrievedAt:'2026-09-15T19:30:00Z',sourceDataEditedAt:null};
 const f=fixture(t);f.select(point('Work',{resultKind:'address',jurisdiction:'st-louis-county',sourceAddressId:'county-address:1234',source:addressSource,sourceRecordUpdatedAt:'2026-09-01T00:00:00Z'}));f.limits(0,5,15);f.change('maxPrice',250000);f.change('minBeds',2);await f.run();const payload=f.exportResult();
 assert.equal(f.calls.downloads[0].type,'application/json');assert.equal(f.calls.downloads[0].name,'property-driving-search.json');assert.equal(payload.schema,'property-driving-search-v1');assert.equal(payload.createdAt,instant);assert.deepEqual(payload.provider,provider);assert.equal(payload.measuredAt,instant);assert.equal(payload.inventory.fileName,'authorized-listings.csv');assert.equal(payload.inventory.retrievedAt,'2026-09-15T19:00:00Z');assert.equal(payload.records[0].listing.asOf,'2026-09-14');assert.equal(payload.criteria.maxPrice,250000);assert.equal(payload.criteria.minBeds,2);assert.equal(payload.criteria.minBaths,null);assert.equal(payload.destinations[0].maxMiles,5);assert.equal(payload.destinations[0].maxMinutes,15);assert.equal(payload.records[0].routes[0].startSnapMeters,5);assert.equal(payload.records[0].routes[0].endSnapMeters,8);
 assert.equal(payload.dataVersion,'2026-09-14T00:00:00Z','The routing graph vintage supplied by the provider must not disappear from exported evidence');
 assert.equal(payload.destinations[0].coordinateBasis,'source-address-point');assert.equal(payload.destinations[0].sourceEvidence.sourceAddressId,'county-address:1234');assert.equal(payload.destinations[0].sourceEvidence.jurisdiction,'st-louis-county');assert.deepEqual(payload.destinations[0].sourceEvidence.source,addressSource);assert.equal(payload.destinations[0].sourceEvidence.sourceRecordUpdatedAt,'2026-09-01T00:00:00Z');assert.equal(payload.destinations[0].sourceEvidence.recordKey,null,'An address result does not invent an exact parcel identity');
});

test('routing errors remain retryable and never substitute straight-line results',async t=>{
 let tries=0;const f=fixture(t,{measure:(origins,destinations)=>{if(++tries===1)throw new Error('Provider temporarily unavailable');return measurement(origins,destinations);}});f.select();await f.run();assert.equal(f.panel.getResult(),null);assert.equal(f.$('export').disabled,true);assert.equal(f.$('run').disabled,false);assert.match(f.$('status').textContent,/temporarily unavailable/);assert.deepEqual(f.calls.markers.at(-1).records,[]);
 await f.run();assert.equal(f.calls.measure.length,2);assert.equal(f.panel.getResult().records[0].outcome,'match');
});

test('imported source labels and addresses are literal text and unsafe source links are withheld',async t=>{
 const hostile='<img src=x onerror="globalThis.__ran=true">',f=fixture(t,{listings:[home('evil',{address:hostile,source:hostile,sourceUrl:'javascript:alert(1)'})]});f.select(point(hostile));await f.run();
 assert.equal(f.root.querySelectorAll('img,script,iframe').length,0);assert.ok(f.$('results').textContent.includes(hostile));assert.equal(f.root.querySelector('.home-match a'),null);assert.equal(f.window.__ran,undefined);assert.equal(f.exportResult().records[0].listing.source,hostile);
 f.root.querySelector('.home-match button').click();assert.equal(f.calls.inspect[0].id,'evil');assert.equal(f.calls.markers.at(-1).records[0].id,'evil');
});

test('invalid and empty criteria give an actionable status without sending a driving request',async t=>{
 const f=fixture(t);await f.run();assert.match(f.$('status').textContent,/Add at least one destination/);f.select();f.limits(0,null,null);await f.run();assert.match(f.$('status').textContent,/enter a driving-mile or modeled-minute limit/);f.limits(0,5,null);f.change('minPrice',300000);f.change('maxPrice',200000);await f.run();assert.match(f.$('status').textContent,/Minimum asking price cannot exceed/);assert.equal(f.calls.measure.length,0);assert.equal(f.$('run').disabled,false);assert.equal(f.$('cancel').hidden,true);
});

test('disposal aborts outstanding routing, destroys the client and cannot restore markers',async t=>{
 const pending=deferred();const f=fixture(t,{measure:()=>pending.promise});f.select();await f.run();const request=f.calls.measure[0];f.panel.destroy();assert.equal(request.options.signal.aborted,true);assert.equal(f.calls.destroy,1);const n=f.calls.markers.length;pending.resolve(measurement(request.origins,request.destinations));await settled();assert.equal(f.root.children.length,0);assert.equal(f.calls.markers.length,n);assert.deepEqual(f.calls.markers.at(-1).records,[]);
});


test('map framing receives only verified matches and disables immediately when criteria change',async t=>{
 const f=fixture(t,{listings:[home('inside'),home('outside'),home('unknown')],measure:(origins,destinations)=>measurement(origins,destinations,o=>o.id==='outside'?{distanceMeters:20000}:o.id==='unknown'?{status:'unavailable',distanceMeters:null,durationSeconds:null}:{})});
 assert.equal(f.$('fit').disabled,true);f.select();await f.run();assert.equal(f.$('fit').disabled,false);f.$('fit').click();assert.deepEqual(f.calls.fit[0].map(r=>r.id),['inside']);
 f.change('maxPrice',150000);assert.equal(f.$('fit').disabled,true);assert.equal(f.panel.getResult(),null);
});
