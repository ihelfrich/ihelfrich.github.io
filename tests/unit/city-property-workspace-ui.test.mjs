import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Window} from 'happy-dom';
import {OrthographicCamera} from 'three';
import {createPropertyActivityPanel} from '../../src/scripts/city/city-property-activity-panel.mjs';
import {createPropertyAreaSelection} from '../../src/scripts/city/city-property-area-selection.mjs';
import {propertyScreenViewport,threeViewportBounds} from '../../src/scripts/city/city-property-atlas.mjs';
import {createPropertyViewUrl,readPropertyViewHash} from '../../src/lib/property-view-link.mjs';
import {createPropertyHistoryData} from '../../src/lib/property-history-data.mjs';

const bounds=[-90.5,38.5,-90.2,38.8],settle=()=>new Promise(r=>setTimeout(r,8));
const row=(id='one')=>({id,layerId:'ownership-signals',kind:'ownership',title:id,ownerName:id,longitude:-90.3,latitude:38.6,date:null,dateBasis:'current-observation-not-acquisition',sourceURL:'https://example.org/source'});
const answer=(records=[row()])=>({records,features:records,layers:[{id:'ownership-signals',label:'Names',status:'ready',count:records.length,coverage:'Fixture only'}],counts:{records:records.length},partial:false});
function fixture(t,{query=async()=>answer(),saved=null,url='https://ihelfrich.github.io/st-louis/'}={}){
 const window=new Window({url}),doc=window.document,root=doc.createElement('section');doc.body.append(root);
 if(saved)window.localStorage.setItem('property-observation-workspace-v1',JSON.stringify(saved));
 const markers=[],selected=[],fits=[],calls=[];
 const data={query:o=>{calls.push(o);return query(o);},health:async()=>({sources:[]}),entities:async()=>null,dispose(){}};
 const panel=createPropertyActivityPanel(root,{data,onFeatures:(features,layers)=>markers.push({features,layers}),onFeature:r=>selected.push(r),onFit:b=>fits.push(b),getCity:()=>({getViewportBounds:()=>bounds})});
 const $=key=>root.querySelector(`[data-activity="${key}"]`);
 t.after(async()=>{panel.dispose();await window.happyDOM.abort();});
 return {window,doc,root,panel,$,calls,markers,selected,fits};
}
test('superseded queries and disposed requests cannot restore stale markers or evidence',async t=>{
 const pending=[],f=fixture(t,{query:()=>new Promise(resolve=>pending.push(resolve))});f.panel.activate();
 f.$('query').value='second';f.$('form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));
 assert.equal(f.calls[0].signal.aborted,true);pending[1](answer([row('new')]));await settle();pending[0](answer([row('old')]));await settle();
 assert.equal(f.$('feed').textContent.includes('old'),false);assert.equal(f.markers.at(-1).features[0].id,'new');
 f.$('form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));f.panel.dispose();pending[2](answer([row('late')]));await settle();assert.equal(f.markers.at(-1).features.length,0);assert.doesNotMatch(f.$('feed').textContent,/late/);
});
test('export retains the filters actually sent even if fields change while their request is loading',async t=>{
 let resolve;const f=fixture(t,{query:()=>new Promise(r=>{resolve=r;})});f.$('query').value='accepted query';f.panel.activate();
 assert.equal(f.calls[0].query,'accepted query');f.$('query').value='unsubmitted edit';resolve(answer());await settle();
 const prior=URL.createObjectURL;let blob;URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};t.after(()=>{URL.createObjectURL=prior;});
 f.$('export').click();const payload=JSON.parse(await blob.text());assert.equal(payload.query,'accepted query');
});
test('moving the map clears actionable old evidence throughout the debounce window',async t=>{
 const f=fixture(t);f.panel.activate();await settle();assert.equal(f.$('export').disabled,false);
 f.panel.setViewport([-90.8,38.5,-90.6,38.7],'properties');
 assert.equal(f.markers.at(-1).features.length,0);assert.equal(f.$('feed').children.length,0);assert.equal(f.$('export').disabled,true);
});
test('opening evidence is stable and keyboard return restores the originating result',async t=>{
 const f=fixture(t);f.panel.activate();await settle();const button=f.$('feed').querySelector('button');button.focus();button.click();
 assert.equal(f.selected.length,0,'Reading a result must not move the camera and clear its detail');
 assert.equal(f.$('results').hidden,true);assert.match(f.doc.activeElement.textContent,/Back to results/);
 f.$('detail').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(f.$('results').hidden,false);assert.equal(f.doc.activeElement,button);assert.equal(f.$('detail').children.length,0);
 button.click();[...f.$('detail').querySelectorAll('button')].find(b=>b.textContent==='Show on map').click();assert.equal(f.selected[0].id,'one');
});
test('switching evidence questions retains the address and a reset explicitly clears filters',async t=>{
 const f=fixture(t);f.$('query').value='123 Example Street';f.panel.activate();await settle();
 f.root.querySelector('[data-lens="development"]').click();await settle();assert.equal(f.calls.at(-1).query,'123 Example Street');
 f.$('period').value='90';f.$('reset').click();await settle();assert.equal(f.calls.at(-1).query,'');assert.equal(f.$('period').value,'all');assert.equal(f.calls.at(-1).fromDate,null);
});
test('aggregate rows drill into the map while a subsequent refresh restores the result list',async t=>{
 const f=fixture(t,{query:async()=>answer([{...row('group'),kind:'activity-cell',count:12,bounds}])});f.panel.activate();await settle();
 f.$('feed').querySelector('button').click();assert.equal(f.selected[0].kind,'activity-cell');assert.equal(f.$('detail').children.length,0);
 f.panel.openFeature(row());assert.equal(f.$('results').hidden,true);f.$('form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await settle();assert.equal(f.$('results').hidden,false);
});
test('applying filters returns focus to the disclosure instead of a newly hidden submit button',async t=>{
 const f=fixture(t);f.panel.activate();await settle();const filters=f.root.querySelector('.activity-source-picker'),apply=filters.querySelector('[type="submit"]');filters.open=true;apply.focus();apply.click();await settle();
 assert.equal(filters.open,false);assert.equal(f.doc.activeElement,filters.querySelector('summary'));
});
test('restoring a saved area preserves valid filters and cannot import foreign lens layers',async t=>{
 const saved=[{name:'Fixture area',bounds,lens:'ownership',layers:['ownership-signals','water-materials','invented'],query:'a literal name',period:'custom',from:'2026-09-01',to:'2026-09-12',material:'all'},{name:'bad',bounds:[5,4,3,2],lens:'ownership'}];
 const f=fixture(t,{saved});f.panel.activate();await settle();assert.equal(f.$('saved').children.length,1);f.$('saved').querySelector('button').click();await settle();
 assert.deepEqual(f.calls.at(-1).layers,['ownership-signals']);assert.deepEqual(f.calls.at(-1).bounds,bounds);assert.equal(f.calls.at(-1).fromDate,'2026-09-01');assert.deepEqual(f.fits,[bounds]);
 assert.match(f.$('selected-label').textContent,/Custom dates/,'Collapsed filter label must describe the restored request');
 const n=f.calls.length;f.panel.setViewport([-91,38,-90,39],'areas');await settle();assert.equal(f.calls.length,n,'Fixed geographic area must not follow camera bounds');
});
test('area drawing clamps pointers to the visible surface, rejects tiny drags, cancels and restores focus',async t=>{
 const window=new Window(),doc=window.document,button=doc.createElement('button');doc.body.append(button);button.focus();const selections=[],rectangles=[],statuses=[];
 const drawing=createPropertyAreaSelection(doc,{getCity:()=>({getPropertySelectionSurface:()=>({left:20,top:30,width:200,height:100}),propertyBoundsForScreenRectangle:r=>{rectangles.push(r);return bounds;}}),onSelect:b=>selections.push(b),onStatus:s=>statuses.push(s)});t.after(async()=>{drawing.dispose();await window.happyDOM.abort();});
 drawing.begin();let overlay=doc.querySelector('.property-area-draw');overlay.dispatchEvent(new window.PointerEvent('pointerdown',{clientX:50,clientY:50,button:0,pointerId:1}));overlay.dispatchEvent(new window.PointerEvent('pointerup',{clientX:500,clientY:500,button:0,pointerId:1}));
 assert.deepEqual(rectangles,[{left:50,top:50,width:170,height:80}]);assert.deepEqual(selections,[bounds]);assert.equal(doc.querySelector('.property-area-draw'),null);assert.equal(doc.activeElement,button);
 drawing.begin();overlay=doc.querySelector('.property-area-draw');overlay.dispatchEvent(new window.PointerEvent('pointerdown',{clientX:50,clientY:50,button:0}));overlay.dispatchEvent(new window.PointerEvent('pointerup',{clientX:53,clientY:55,button:0}));assert.equal(selections.length,1);
 drawing.begin();doc.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',cancelable:true}));assert.equal(doc.querySelector('.property-area-draw'),null);assert.match(statuses.at(-1),/canceled/);
});
test('renderer rectangle conversion accounts for a nonzero canvas origin and rejects off-canvas pixels',()=>{
 const container={getBoundingClientRect:()=>({left:100,top:200,width:400,height:300})};
 assert.deepEqual(propertyScreenViewport(container,{left:120,top:230,width:100,height:90}),{left:20,top:30,width:100,height:90,fullWidth:400,fullHeight:300});
 assert.equal(propertyScreenViewport(container,{left:99,top:200,width:100,height:90}),null);assert.equal(propertyScreenViewport(container,{left:120,top:230,width:500,height:90}),null);
});
test('drawn rectangle projects through the actual Three camera to the selected ground footprint',()=>{
 const camera=new OrthographicCamera(-500,500,500,-500,1,10000);camera.position.set(0,1000,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const container={getBoundingClientRect:()=>({left:100,top:200,width:400,height:300})};
 const viewport=propertyScreenViewport(container,{left:200,top:275,width:200,height:150}),origin=[-90.193,38.628];
 const projected=threeViewportBounds(camera,origin,viewport),lonDelta=250/(111195*Math.cos(origin[1]*Math.PI/180)),latDelta=250/111195;
 const expected=[origin[0]-lonDelta,origin[1]-latDelta,origin[0]+lonDelta,origin[1]+latDelta];
 projected.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-9,`Selected ground corner ${i} is based on the selected pixels`));
});

const sourceId='st-louis-county-business-name-indicators',observedAt='2026-09-12T14:00:00Z';
const event=(patch={})=>({id:'change1',sourceId,kind:'owner-observation-changed',recordKey:'st-louis-county-current:ABC:1',parcelKey:'st-louis-county:ABC',parcelId:'ABC',sourceObjectId:1,longitude:-90.3,latitude:38.6,observedAt,before:{recordKey:'st-louis-county-current:ABC:1',ownerName:'A LLC'},after:{recordKey:'st-louis-county-current:ABC:1',ownerName:'B LLC'},...patch});
function history(events){const url='/st-louis/history/events/fixture.json',raw=JSON.stringify({schema:'property-observation-events-v1',sourceId,observedAt,events}),sha256=createHash('sha256').update(raw).digest('hex');const manifest={schema:'property-observation-history-v1',sources:[{id:sourceId,status:'healthy',lastSuccessAt:observedAt,events:[{url,observedAt,eventCount:events.length,sha256}]}]};return createPropertyHistoryData({fetchImpl:async path=>new Response(path===url?raw:JSON.stringify(manifest))});}
test('a malformed event invalidates the complete partition instead of leaking its earlier records',async()=>{
 const data=history([event(),event({id:'wrong-source',sourceId:'foreign-source'})]);const result=await data.query({bounds,level:'properties'});data.dispose();assert.equal(result.partial,true);assert.equal(result.records.length,0);assert.equal(result.features.length,0);
});
test('County observation events reject a foreign exact parcel key despite a valid source envelope',async()=>{
 const data=history([event({recordKey:'st-louis-city:ABC:1',parcelKey:'st-louis-city:ABC',jurisdiction:'st-louis-city'})]);const result=await data.query({bounds,level:'properties'});data.dispose();assert.equal(result.records.length,0);assert.equal(result.partial,true);
});
test('history dates and before/after identities must match the observation partition and exact record',async()=>{
 for(const patch of [{observedAt:'2026-02-30T14:00:00Z'},{observedAt:'2025-09-12T14:00:00Z'},{after:{recordKey:'st-louis-county-current:OTHER:2',ownerName:'B LLC'}}]){
  const data=history([event(patch)]),result=await data.query({bounds,level:'properties'});data.dispose();assert.equal(result.records.length,0,JSON.stringify(patch));assert.equal(result.partial,true);
 }
});

const sharedState={version:1,lens:'ownership',bounds,layers:['ownership-signals'],query:'VINEBROOK',fromDate:'2026-08-01',toDate:null,material:'all',level:'properties'};
const sharedURL=state=>createPropertyViewUrl(state,'https://ihelfrich.github.io/st-louis/');
function clipboard(f,writeText){Object.defineProperty(f.window.navigator,'clipboard',{configurable:true,value:{writeText}});}
test('shared evidence restores validated criteria, fixed geography and display level',async t=>{
 const f=fixture(t,{url:sharedURL(sharedState)});f.panel.activate();await settle();
 assert.equal(f.calls.length,1);const request=f.calls[0];
 for(const key of ['bounds','layers','query','fromDate','toDate','material','level'])assert.deepEqual(request[key],sharedState[key],key);
 assert.deepEqual(f.fits,[bounds]);assert.equal(f.$('period').value,'custom');assert.equal(f.$('query').value,'VINEBROOK');
 assert.match(f.$('chips').textContent,/Any end/);assert.match(f.$('chips').textContent,/Fixed search area/);assert.equal(f.$('link-notice').hidden,false);
 f.panel.setViewport([-91,38,-90,39],'areas');await settle();assert.equal(f.calls.length,1,'Shared area must remain fixed while the camera moves');
});
test('copy link captures accepted criteria despite unsubmitted form edits and excludes loaded evidence',async t=>{
 let resolve;const f=fixture(t,{query:()=>new Promise(r=>{resolve=r;})});let copied;
 clipboard(f,async url=>{copied=url;});f.$('query').value='accepted company';f.panel.activate();assert.equal(f.$('share').disabled,true);
 f.$('query').value='unsubmitted company';resolve(answer());await settle();f.$('share').click();await settle();
 const state=readPropertyViewHash(new URL(copied).hash).state;assert.equal(state.query,'accepted company');assert.equal('records' in state,false);assert.match(copied,/workspace=activity#evidence=/);
 assert.equal(f.$('share-status').hidden,false);assert.equal(f.$('share-fallback').hidden,true);
});
test('clipboard denial exposes a selected view URL with the same accepted request',async t=>{
 const f=fixture(t,{url:sharedURL(sharedState)});clipboard(f,async()=>{throw new Error('denied');});f.panel.activate();await settle();f.$('share').click();await settle();
 assert.equal(f.$('share-fallback').hidden,false);assert.equal(f.doc.activeElement,f.$('share-url'));assert.deepEqual(readPropertyViewHash(new URL(f.$('share-url').value).hash).state,sharedState);
});
test('removing an applied search chip retains accepted dates, layers and area without applying a draft',async t=>{
 const f=fixture(t,{url:sharedURL(sharedState)});f.panel.activate();await settle();f.$('from').value='2020-01-01';f.$('query').value='unsubmitted';
 f.root.querySelector('[aria-label="Remove filter: Search: VINEBROOK"]').click();await settle();const request=f.calls.at(-1);
 assert.equal(request.query,'');assert.equal(request.fromDate,'2026-08-01');assert.deepEqual(request.layers,['ownership-signals']);assert.deepEqual(request.bounds,bounds);assert.equal(f.doc.activeElement,f.$('query'));
 assert.equal(f.$('link-notice').hidden,true,'Shared-view banner no longer describes the edited view');
});
test('removing fixed-area chip follows the current map while retaining the other accepted filters',async t=>{
 const f=fixture(t,{url:sharedURL(sharedState)});f.panel.activate();await settle();const current=[-90.6,38.6,-90.4,38.7];f.panel.setViewport(current,'areas');
 f.root.querySelector('[aria-label="Remove filter: Fixed search area"]').click();await settle();assert.deepEqual(f.calls.at(-1).bounds,current);assert.equal(f.calls.at(-1).level,'areas');assert.equal(f.calls.at(-1).query,'VINEBROOK');assert.equal(f.$('follow').hidden,true);
});
test('invalid owned link never falls back to a broad query until explicit action',async t=>{
 const f=fixture(t,{url:'https://ihelfrich.github.io/st-louis/#evidence=%7Bbad'});f.panel.activate();f.panel.setViewport(bounds,'properties');await new Promise(r=>setTimeout(r,230));
 assert.equal(f.calls.length,0);assert.match(f.$('status').textContent,/not loaded/);assert.equal(f.$('share').disabled,true);
 f.$('form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await settle();assert.equal(f.calls.length,1);assert.equal(f.$('link-notice').hidden,true);
});
test('hash changes supersede a pending map debounce and disposal removes the listener',async t=>{
 const f=fixture(t);f.panel.activate();await settle();f.panel.setViewport(bounds,'properties');f.window.location.hash='#evidence=%7Bbad';await new Promise(r=>setTimeout(r,230));assert.equal(f.calls.length,1,'A queued map refresh must not bypass invalid-link validation');
 f.window.location.hash=new URL(sharedURL(sharedState)).hash;await settle();assert.equal(f.calls.length,2);assert.equal(f.calls.at(-1).query,'VINEBROOK');
 f.panel.dispose();f.window.location.hash=new URL(sharedURL({...sharedState,query:'later'})).hash;await settle();assert.equal(f.calls.length,2);
});
test('explicit area drill advances fixed evidence to the resolved detail level but a free pan does not',async t=>{
 const f=fixture(t,{url:sharedURL({...sharedState,level:'areas'})});f.panel.activate();await settle();const drill=[-90.28,38.70,-90.26,38.72];
 f.panel.navigateArea(drill);await settle();assert.deepEqual(f.calls.at(-1).bounds,drill);
 f.panel.setViewport(drill,'properties');await settle();assert.equal(f.calls.at(-1).level,'properties');assert.deepEqual(f.calls.at(-1).bounds,drill);
 const count=f.calls.length;f.panel.setViewport([-91,38,-90,39],'areas');await settle();assert.equal(f.calls.length,count);
});
test('late clipboard failures cannot reopen fallback after refresh or disposal',async t=>{
 const f=fixture(t);let reject;clipboard(f,()=>new Promise((_,r)=>{reject=r;}));f.panel.activate();await settle();f.$('share').click();
 f.$('form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));reject(new Error('late'));await settle();assert.equal(f.$('share-status').hidden,true);assert.equal(f.$('share-fallback').hidden,true);
 f.$('share').click();f.panel.dispose();reject(new Error('disposed'));await settle();assert.equal(f.$('share-fallback').hidden,true);
});
