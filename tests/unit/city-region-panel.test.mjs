import {test} from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
import {createPropertyRegionPanel} from '../../src/scripts/city/city-property-region-panel.mjs';
import {createPropertyRegionData} from '../../src/lib/property-region-data.mjs';
import {PROPERTY_REGION_BOUNDS} from '../../src/lib/property-region-catalog.mjs';
import {readFile} from 'node:fs/promises';
const settle=()=>new Promise(r=>setTimeout(r,5));
const result=(n=1)=>({count:n,knownCount:n,level:'areas',features:Array.from({length:n},(_,i)=>({id:String(i),kind:'cell',count:1,knownCount:1,value:1,label:'Area '+i,bounds:[-90.4,38.6,-90.3,38.7]})),domain:[0,2],sources:[],unavailable:[],failedTiles:0,partial:false});
function fixture(t,query,options={}){const win=new Window(),doc=win.document;doc.body.innerHTML='<main id="city-app"><section id="fixture"></section></main>';const root=doc.querySelector('#fixture'),renders=[],fits=[],navigation=[],selected=[];const city={setPropertyAtlas:value=>renders.push(value),clearPropertyAtlas:()=>renders.push(null),fitPropertyAtlasBounds:b=>fits.push(b),getViewportBounds:()=>[-90.4,38.6,-90.3,38.7],flyToPropertyAtlasFeature:r=>selected.push(r)};const panel=createPropertyRegionPanel(root,{getCity:()=>city,data:{query},onNavigation:value=>navigation.push(value),...options});t.after(()=>{panel.dispose();win.happyDOM.abort();});return{panel,doc,root,city,renders,fits,navigation,selected,$:n=>root.querySelector(`[data-atlas="${n}"]`)};}
test('a failed refresh clears paginated results and cannot crash when Show more was previously present',async t=>{
 let fail=false;const f=fixture(t,async()=>{if(fail)throw Error('Fixture outage');return result(45);});f.panel.activate();await settle();assert.equal(f.$('more').hidden,false);fail=true;f.$('search-map').click();await settle();assert.equal(f.$('more').hidden,true);assert.equal(f.$('list').children.length,0);assert.equal(f.$('export').disabled,true);assert.match(f.$('status').textContent,/Fixture outage/);f.$('more').click();assert.equal(f.$('list').children.length,0);
});
test('stale regional requests cannot replace the newer selected jurisdiction',async t=>{
 let resolveOld;const old=new Promise(r=>resolveOld=r);let calls=0;const f=fixture(t,async()=>++calls===1?old:result(2));f.panel.activate();f.root.querySelector('[data-region="st-louis-city"]').click();await settle();assert.equal(f.$('count').textContent,'2 source records');resolveOld(result(99));await settle();assert.equal(f.$('count').textContent,'2 source records');assert.equal(f.renders.at(-1).features.length,2);
});
test('leaving Properties hides the atlas and a late response cannot repaint it',async t=>{
 let resolve;const f=fixture(t,()=>new Promise(r=>resolve=r));f.panel.activate();f.panel.activate(false);resolve(result());await settle();assert.equal(f.renders.at(-1),null);assert.equal(f.doc.querySelector('.atlas-map-key').hidden,true);
});
test('map and Activity cell drilldowns return through copied previous areas without changing the metric',async t=>{
 const queries=[],f=fixture(t,async options=>{queries.push(options);return result();});await f.panel.start();
 f.$('metric').value='latestSalePriceUSD';f.$('metric').dispatchEvent(new f.doc.defaultView.Event('change'));f.$('from').value='2023';f.$('dates').click();await settle();
 const first=[-90.5,38.5,-90.4,38.6],second=[-90.49,38.51,-90.48,38.52];
 f.panel.focusFeature({kind:'cell',bounds:first});await settle();f.panel.setActivityFocus(true);f.panel.focusFeature({kind:'activity-cell',layerId:'ownership-signals',count:40,bounds:second});await settle();
 assert.equal(f.panel.getNavigationState().depth,2);assert.equal(f.$('back').disabled,false);first[0]=999;
 assert.equal(await f.panel.back(),true);assert.deepEqual(f.fits.at(-1),[-90.5,38.5,-90.4,38.6]);assert.equal(queries.at(-1).metric,'latestSalePriceUSD');assert.equal(queries.at(-1).fromYear,2023);
 assert.equal(await f.panel.back(),true);assert.deepEqual(f.fits.at(-1),PROPERTY_REGION_BOUNDS);assert.equal(f.panel.getNavigationState().canGoBack,false);assert.equal(f.$('back').disabled,true);assert.equal(await f.panel.back(),false);
});
test('invalid cells cannot move the map or create history; region switches clear the old trail',async t=>{
 const queries=[],f=fixture(t,async o=>{queries.push(o);return result();});await f.panel.start();const count=queries.length,fits=f.fits.length;
 for(const bounds of [null,[3,2,1,4],[-181,0,0,1],[1,2,NaN,3]])f.panel.focusFeature({kind:'activity-cell',bounds});
 assert.equal(queries.length,count);assert.equal(f.fits.length,fits);assert.equal(f.panel.getNavigationState().depth,0);
 f.panel.focusFeature({kind:'cell',bounds:[-90.5,38.5,-90.4,38.6]});await settle();assert.equal(f.panel.getNavigationState().depth,1);
 f.root.querySelector('[data-region="st-louis-city"]').click();await settle();assert.equal(f.panel.getNavigationState().depth,0);assert.equal(f.navigation.at(-1).canGoBack,false);
});
test('late drilldown responses cannot replace restored area data, and back does not replay selected-record callbacks',async t=>{
 let resolveDrill,calls=0,selected=0;const f=fixture(t,()=>++calls===3?new Promise(resolve=>{resolveDrill=resolve;}):Promise.resolve(result()),{onSelect:()=>selected++});await f.panel.start();
 f.panel.focusFeature({kind:'cell',bounds:[-90.5,38.5,-90.4,38.6]});const returned=f.panel.back();await returned;resolveDrill(result(99));await settle();assert.equal(f.$('count').textContent,'1 source records');
 f.panel.focusFeature({id:'exact',kind:'parcel',longitude:-90.45,latitude:38.55,recordKey:'st-louis-county-current:EXACT:31'});assert.equal(selected,1);assert.equal(f.selected.at(-1).recordKey,'st-louis-county-current:EXACT:31');await f.panel.back();assert.equal(selected,1);
});
test('navigation storage is bounded and its public snapshots cannot mutate the return path',async t=>{
 const f=fixture(t,async()=>result());await f.panel.start();
 for(let i=0;i<30;i++){f.panel.focusFeature({kind:'cell',bounds:[-90.5+i*.001,38.5,-90.4+i*.001,38.6]});await settle();}
 const state=f.panel.getNavigationState();assert.equal(state.depth,20);const previous=[...state.previousBounds];state.previousBounds[0]=999;await f.panel.back();assert.deepEqual(f.fits.at(-1),previous);
 f.panel.dispose();assert.equal(await f.panel.back(),false);
});
test('explicit drill and back announce copied areas before refreshing, without adding duplicate return steps',async t=>{
 const order=[],f=fixture(t,async options=>{order.push(['query',[...options.bounds]]);return result();},{onNavigateArea:bounds=>{order.push(['navigate',[...bounds]]);bounds[0]=999;}});await f.panel.start();order.length=0;
 const bounds=[-90.5,38.5,-90.4,38.6];f.panel.focusFeature({kind:'activity-cell',bounds});await settle();assert.deepEqual(order.slice(0,2),[['navigate',bounds],['query',bounds]]);
 f.panel.focusFeature({kind:'activity-cell',bounds});await settle();assert.equal(f.panel.getNavigationState().depth,1);order.length=0;
 await f.panel.back();assert.deepEqual(order.slice(0,2),[['navigate',PROPERTY_REGION_BOUNDS],['query',PROPERTY_REGION_BOUNDS]]);
});
test('a settled manually panned viewport becomes the point-selection return area',async t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});
 const f=fixture(t,async()=>result());await f.panel.start();t.mock.timers.setTime(103000);const panned=[-90.6,38.65,-90.55,38.7];f.city.getViewportBounds=()=>panned;
 f.panel.focusFeature({id:'point',kind:'permit',longitude:-90.58,latitude:38.67});panned[0]=999;await f.panel.back();assert.deepEqual(f.fits.at(-1),[-90.6,38.65,-90.55,38.7]);
});
test('actual City and County manifest cells can be drilled into and returned without changing published counts',async t=>{
 const calls=[],data=createPropertyRegionData({maxPoints:1,fetchImpl:async url=>{calls.push(url);return new Response(await readFile(new URL('../../public'+url,import.meta.url),'utf8'));}});
 let accepted;const f=fixture(t,options=>data.query(options),{onView:view=>{accepted=view;}});await f.panel.start();
 const initial=accepted.count,cell=accepted.features.find(r=>r.jurisdiction==='st-louis-county'&&r.count>100);assert.ok(initial>500000&&cell);const original=structuredClone(cell);
 f.renders.at(-1).onSelect(cell);await settle();await f.panel.back();assert.equal(accepted.count,initial);assert.deepEqual(accepted.bounds,PROPERTY_REGION_BOUNDS);assert.deepEqual(cell,original);assert.equal(calls.some(url=>url.includes('/tiles/')),false,'Overview navigation uses source summary cells without fetching county-sized point data');
});
