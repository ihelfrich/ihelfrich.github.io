import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createPendingMapActions} from '../../src/scripts/city/city-startup.mjs';
import {createPropertyActivityPanel} from '../../src/scripts/city/city-property-activity-panel.mjs';
import {createPropertyViewUrl} from '../../src/lib/property-view-link.mjs';
const source=await readFile(new URL('../../src/scripts/city/city-app.mjs',import.meta.url),'utf8');
const page=await readFile(new URL('../../src/pages/st-louis.astro',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot={pois:[],buildings:[],graph:{nodes:[]},source:{osmSnapshotTimestamp:'2026-09-01'}};
function harness(t,{search='',saved=null,failData=false}={}){
 const win=new Window({url:'https://ihelfrich.github.io/st-louis/'+search});win.document.body.innerHTML=page.slice(page.indexOf('<main'),page.indexOf('<script'));
 const events=[];let finishScene,finishData;
 const scene=new Promise(resolve=>{finishScene=resolve;}),response=new Promise(resolve=>{finishData=resolve;});
 const context=vm.createContext({window:win,document:win.document,location:win.location,history:win.history,URL,URLSearchParams,Option:win.Option,
  $:id=>win.document.getElementById(id),data:null,places:[],origins:[],selectedDestination:null,environmentMode:'now',activeLayer:'city',mode:'explore',panelOpen:true,initialWorkspaceStarted:false,
  fetch:()=>failData?Promise.reject(Error('Offline snapshot')):response,
  setMode:mode=>{events.push(['mode',mode]);context.mode=mode;},property:{openRegion(){events.push(['region']);},openCounty(scope){events.push(['county',scope]);},selectTab(tab){events.push(['tab',tab]);}},
  decodeCityState:()=>saved,notice(){},version:()=> 'fixture',showPlaces(){},compare(){},matchMedia:()=>({matches:false}),togglePanel(){},
  make:(tag,_class,text)=>{const el=win.document.createElement(tag);el.textContent=text||'';return el;},requestAnimationFrame:fn=>fn(),
  openScene:()=>{events.push(['scene']);return scene;},console:{error(){}},showFallback:message=>events.push(['fallback',message])});
 const begin=source.includes('function initializeWorkspace()')?source.indexOf('function initializeWorkspace()'):source.indexOf('async function start()');
 vm.runInContext(source.slice(begin,source.indexOf('\ndocument\n  .querySelectorAll',begin)),context);
 t.after(()=>win.happyDOM.abort());return {context,events,win,finishScene,finishData:()=>finishData({ok:true,json:async()=>snapshot})};
}
test('default property controls open without waiting for the city snapshot or renderer',async t=>{
 const h=harness(t);const start=h.context.start();assert.deepEqual(h.events.slice(0,2),[['mode','properties'],['region']]);
 h.finishData();await flush();assert.ok(h.events.some(e=>e[0]==='scene'));
 h.events.push(['user','selected scenario']);h.finishScene();await start;assert.deepEqual(h.events.at(-1),['user','selected scenario'],'Renderer completion must not reopen a tab or override a pending search');
});
test('deep-linked County and notebook tools open before 3D and data retries do not reset them',async t=>{
 const h=harness(t,{search:'?area=overland&workspace=notebook',failData:true});await h.context.start();
 assert.ok(h.events.some(e=>e[0]==='county'&&e[1]==='overland'));assert.ok(h.events.some(e=>e[0]==='tab'&&e[1]==='resident'));
 assert.equal(h.win.document.getElementById('explorer').hidden,false,'City geometry failure must leave independent property tools available');
 const before=h.events.filter(e=>['region','county','tab'].includes(e[0])).length;await h.context.start();assert.equal(h.events.filter(e=>['region','county','tab'].includes(e[0])).length,before);
});
test('saved walking comparisons retain their saved view instead of forcing property mode',async t=>{
 const h=harness(t,{saved:{data:'fixture',a:'a',b:'b',minutes:15,light:12,layer:'city'},failData:true});await h.context.start();assert.equal(h.events.some(e=>e[0]==='region'||e[0]==='county'),false);
});
test('a notebook deep link wins over an older comparison hash throughout startup',async t=>{
 const h=harness(t,{search:'?workspace=notebook',saved:{data:'fixture',a:'a',b:'b',minutes:15,light:12,layer:'city'}}),start=h.context.start();h.finishData();await flush();h.finishScene();await start;
 assert.equal(h.context.mode,'properties');assert.equal(h.events.filter(e=>e[0]==='tab').at(-1)[1],'resident');
});

const sharedState={version:1,lens:'ownership',bounds:[-90.38,38.68,-90.34,38.72],layers:['ownership-signals'],query:'Example LLC',fromDate:null,toDate:null,material:'all',level:'properties'};
const sharedURL=state=>new URL(createPropertyViewUrl(state,'https://ihelfrich.github.io/st-louis/'));
function activityHarness(t,h,{query=async()=>({records:[],features:[],layers:[],counts:{records:0},partial:false})}={}){
 const root=h.win.document.createElement('section');h.win.document.body.append(root);const pending=createPendingMapActions(),calls=[];
 const panel=createPropertyActivityPanel(root,{getCity:()=>pending.map,onFit:bounds=>pending.map.fitPropertyAtlasBounds(bounds),data:{query:options=>{calls.push(options);return query(options);},health:async()=>({sources:[]}),entities:async()=>null,dispose(){}}});
 const select=h.context.property.selectTab;h.context.property.selectTab=tab=>{select(tab);if(tab==='activity')panel.activate();};t.after(()=>panel.dispose());return {panel,pending,calls,root};
}
test('shared Activity criteria load before the renderer and queued camera bounds survive scene completion',async t=>{
 const url=sharedURL(sharedState),h=harness(t,{search:url.search+url.hash}),a=activityHarness(t,h);const start=h.context.start();await flush();
 assert.equal(h.events.filter(e=>e[0]==='tab').at(-1)[1],'activity');assert.equal(a.calls.length,1);assert.deepEqual(a.calls[0].bounds,sharedState.bounds);assert.equal(a.calls[0].level,'properties');assert.deepEqual(a.calls[0].layers,['ownership-signals']);assert.equal(a.calls[0].query,'Example LLC');
 const fits=[];assert.equal(a.pending.apply({fitPropertyAtlasBounds:b=>fits.push(b)}),true);assert.deepEqual(fits,[sharedState.bounds]);
 h.finishData();await flush();h.context.property.selectTab('scenario');h.finishScene();await start;
 assert.equal(h.events.filter(e=>e[0]==='tab').at(-1)[1],'scenario','Late 3D startup must not reset the user’s later tool choice');assert.equal(a.calls.length,1);assert.equal(a.pending.apply({fitPropertyAtlasBounds:b=>fits.push(b)}),false);
});
test('a fixed shared view ignores unrelated initial overview detail before the renderer catches up',async t=>{
 const url=sharedURL(sharedState),h=harness(t,{search:url.search+url.hash,failData:true}),a=activityHarness(t,h);await h.context.start();await flush();
 a.panel.setViewport([-91,38.3,-90,39],'areas');a.root.querySelector('[data-activity="form"]').dispatchEvent(new h.win.Event('submit',{cancelable:true}));await flush();
 assert.deepEqual(a.calls.at(-1).bounds,sharedState.bounds);assert.equal(a.calls.at(-1).level,'properties','An unrelated initial overview must not downgrade the shared fixed area');
 assert.equal(h.win.document.getElementById('explorer').hidden,false);
});
test('fixed shared drill and back keep only the current target level and reject late evidence before 3D readiness',async t=>{
 const original={...sharedState,bounds:[-90.6,38.4,-90.1,38.9],level:'areas'},url=sharedURL(original),h=harness(t,{search:url.search+url.hash,failData:true}),pending=[];
 const a=activityHarness(t,h,{query:()=>new Promise(resolve=>pending.push(resolve))});await h.context.start();
 const answer=title=>({records:[{id:title,title,layerId:'ownership-signals',kind:'ownership',date:null}],features:[],layers:[],counts:{records:1},partial:false});pending[0](answer('initial'));await flush();
 const drill=sharedState.bounds;a.pending.map.fitPropertyAtlasBounds(drill);a.panel.navigateArea(drill);assert.equal(a.calls.at(-1).level,'areas');
 a.panel.setViewport([-91,38.3,-90,39],'areas');assert.equal(a.calls.length,2,'Unrelated overview does not resolve a pending fixed target');
 a.pending.map.fitPropertyAtlasBounds(original.bounds);a.panel.navigateArea(original.bounds);assert.equal(a.calls[1].signal.aborted,true);const before=a.calls.length;
 a.panel.setViewport(drill,'properties');assert.equal(a.calls.length,before,'Late drill resolution must not settle the newer Back target');
 a.panel.setViewport(original.bounds,'areas');assert.equal(a.calls.at(-1).level,'areas');assert.deepEqual(a.calls.at(-1).bounds,original.bounds);assert.equal(a.calls[2].signal.aborted,true);
 pending[3](answer('back target'));await flush();pending[1](answer('stale drill'));pending[2](answer('stale back'));await flush();
 assert.match(a.root.querySelector('[data-activity="feed"]').textContent,/back target/);assert.doesNotMatch(a.root.querySelector('[data-activity="feed"]').textContent,/stale/);
 const fits=[];a.pending.apply({fitPropertyAtlasBounds:b=>fits.push(b)});assert.deepEqual(fits,[original.bounds]);
});
test('invalid shared Activity links expose their error before 3D and do not silently query default evidence',async t=>{
 const h=harness(t,{search:'?area=region&workspace=activity#evidence=%7B%22version%22%3A999%7D',failData:true}),a=activityHarness(t,h);await h.context.start();await flush();
 assert.equal(h.events.filter(e=>e[0]==='tab').at(-1)[1],'activity');assert.equal(a.calls.length,0);assert.equal(a.root.querySelector('[data-activity="link-notice"]').hidden,false);assert.match(a.root.querySelector('[data-activity="status"]').textContent,/shared view was not loaded/);
 a.panel.setViewport([-91,38.3,-90,39],'areas');await flush();assert.equal(a.calls.length,0);
});
test('changing to an evidence hash opens Activity without replaying initial area navigation',async t=>{
 const h=harness(t,{failData:true});await h.context.start();const areaCalls=h.events.filter(e=>['region','county'].includes(e[0])).length;
 h.win.location.hash=sharedURL(sharedState).hash;h.win.dispatchEvent(new h.win.HashChangeEvent('hashchange'));await flush();
 assert.equal(h.events.filter(e=>e[0]==='tab').at(-1)[1],'activity');assert.equal(h.events.filter(e=>['region','county'].includes(e[0])).length,areaCalls);
});
test('Three renderer is lazy so scene code is not in the startup static dependency graph',()=>{
 assert.doesNotMatch(source,/import\s*\{[^}]*createCityScene[^}]*\}\s*from\s*["']\.\/city-scene\.mjs/);
});
test('map readiness replays only the latest user destination and corresponding pin once',()=>{
 const pending=createPendingMapActions(),calls=[],renderer={fitPropertyAtlasBounds:b=>calls.push(['fit',b]),flyTo:(...args)=>calls.push(['fly',...args]),pin:(...args)=>calls.push(['pin',...args])};
 const bounds=[-90.7,38.3,-90.1,38.9];pending.map.fitPropertyAtlasBounds(bounds);bounds[0]=999;
 pending.map.flyTo(12,25,3);pending.map.pin(12,25,'#aabbcc');pending.map.flyTo(40,50,4);pending.map.pin(40,50,'#112233');
 assert.equal(pending.map.getViewportBounds,undefined,'Pending destination cannot fabricate a map surface');assert.equal(pending.apply(renderer),true);
 assert.deepEqual(calls,[['fly',40,50,4,undefined],['pin',40,50,'#112233']]);assert.equal(pending.apply(renderer),false);
});
test('assigned-but-not-rendered scene keeps user camera choices pending until real readiness',()=>{
 const pendingMapActions=createPendingMapActions(),calls=[],city={flyTo:(...args)=>calls.push(args)};
 const context=vm.createContext({city,cityReady:false,pendingMapActions});vm.runInContext(source.match(/function getPropertyMap\(\)\{[^\n]+\}/)[0],context);
 context.getPropertyMap().flyTo(10,20,3);assert.equal(calls.length,0);
 context.cityReady=true;pendingMapActions.apply(city);context.getPropertyMap().flyTo(30,40,5);
 assert.deepEqual(calls,[[10,20,3,undefined],[30,40,5]]);
});
test('initial region fits retain copied bounds, invalid requests cannot replace them and failed fits remain retryable',()=>{
 const pending=createPendingMapActions(),bounds=[-90.7,38.3,-90.1,38.9];pending.map.fitPropertyAtlasBounds(bounds);bounds[0]=999;
 assert.equal(pending.map.fitPropertyAtlasBounds([1,2,0,3]),false);assert.equal(pending.map.flyTo(NaN,0,3),false);
 assert.equal(pending.apply({fitPropertyAtlasBounds:()=>false}),false);const calls=[];
 assert.equal(pending.apply({fitPropertyAtlasBounds:value=>calls.push(value)}),true);assert.deepEqual(calls,[[-90.7,38.3,-90.1,38.9]]);
});
test('pending exact-feature choice preserves source identity and does not swallow renderer errors',()=>{
 const pending=createPendingMapActions(),feature={id:'a',recordKey:'county:exact:9',longitude:-90.3,latitude:38.6};pending.map.flyToPropertyAtlasFeature(feature);feature.recordKey='modified';
 let selected;pending.apply({flyToPropertyAtlasFeature:value=>{selected=value;}});assert.equal(selected.recordKey,'county:exact:9');
 pending.map.flyTo(1,2,3);assert.throws(()=>pending.apply({flyTo(){throw Error('Fixture failure');}}),/Fixture failure/);
});
