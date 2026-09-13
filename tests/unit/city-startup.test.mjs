import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createPendingMapActions} from '../../src/scripts/city/city-startup.mjs';
const source=await readFile(new URL('../../src/scripts/city/city-app.mjs',import.meta.url),'utf8');
const page=await readFile(new URL('../../src/pages/st-louis.astro',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot={pois:[],buildings:[],graph:{nodes:[]},source:{osmSnapshotTimestamp:'2026-09-01'}};
function harness(t,{search='',saved=null,failData=false}={}){
 const win=new Window({url:'https://ihelfrich.github.io/st-louis/'+search});win.document.body.innerHTML=page.slice(page.indexOf('<main'),page.indexOf('<script'));
 const events=[];let finishScene,finishData;
 const scene=new Promise(resolve=>{finishScene=resolve;}),response=new Promise(resolve=>{finishData=resolve;});
 const context=vm.createContext({document:win.document,location:win.location,history:win.history,URL,URLSearchParams,Option:win.Option,
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
