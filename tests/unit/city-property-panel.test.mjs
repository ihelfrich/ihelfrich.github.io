import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPropertyPanel} from '../../src/scripts/city/city-property-panel.mjs';
import {createEstatePanel} from '../../src/scripts/city/city-estate.mjs';
const point={longitude:-90.193,latitude:38.628};
const parcel=(id='one',patch={})=>({type:'Feature',geometry:{type:'Polygon',coordinates:[[[-90.194,38.627],[-90.192,38.627],[-90.192,38.629],[-90.194,38.627]]]},properties:{parcelKey:'st-louis-city:h',parcelId:id,recordKey:'record:'+id,sourceObjectId:1,address:'10 Fixture Place',assessedValueUSD:0,assessmentYear:null,sourceRecordDate:null,...patch}});
const evidence=(p=point,selected=parcel())=>({point:{...p},parcels:{status:'found',parcel:selected,candidates:[selected],source:{url:'https://www.stlouis-mo.gov/data/',retrievedAt:'2026-09-08T12:00:00Z',catalogPublishedAt:'2026-08-27'}},zoning:{status:'matched',complete:false,jurisdiction:{label:'City of St. Louis'},districts:[{code:'A',label:'Single-Family Dwelling District'}],overlays:[],overlayStatus:'unavailable',effectiveDate:null,codeUrl:'https://example.org/zoning',sources:[{sourceId:'city-base',sourceUrl:'https://example.org/layer',retrievedAt:'2026-09-08T12:00:00Z',sourceDate:null}]},inventory:{status:'not-in-public-inventory',listings:[],reason:'No matching land-bank record; private sale status is unknown.'}});
const settle=()=>new Promise(resolve=>setTimeout(resolve,8));
test('County records are attached to the exact selection and disposed before replacing property context',async t=>{
 const mounts=[],taxes=[];let disposed=0;
 const county=parcel('16L640291',{jurisdiction:'st-louis-county',recordKey:'st-louis-county-current:16L640291:143368',parcelKey:'st-louis-county:16L640291',taxYear:2026});
 const f=fixture(t,{lookup:async p=>evidence(p,county),onTaxEvidence:b=>taxes.push(b),recordsPanelFactory:(root,options)=>{mounts.push(options);root.textContent='County record fixture';return {dispose(){disposed++;}};}});
 await f.panel.inspectPoint(point);
 assert.equal(mounts.length,1);assert.equal(mounts[0].parcel.recordKey,county.properties.recordKey);
 assert.match(f.$('context-id').textContent,/2026 source tax year/);
 assert.equal(f.$('evidence').querySelector('h3'),null,'Selected address already appears in the sticky property context');
 assert.equal(f.$('evidence').querySelector('details').open,false);
 mounts[0].onTaxEvidence({parcelId:'16L640291'});assert.equal(taxes.at(-1).parcelId,'16L640291');
 mounts[0].onScenario();assert.equal(f.$('tab-tools').getAttribute('aria-selected'),'true');assert.equal(f.$('panel-scenario').hidden,false);
 f.panel.clearSelection();assert.equal(disposed,1);assert.equal(taxes.at(-1),null);
});
const listing=(id='lra-one',patch={})=>({id,parcelKey:'st-louis-city:h',parcelId:id,address:'Fixture parcel '+id,...point,askingPrice:null,priceStatus:'not-published',status:'available',usage:'Vacant Lot',...patch});
const snapshot=listings=>({listings,source:{name:'Official LRA',url:'https://www.stlouis-mo.gov/data/',termsUrl:'https://example.org/terms'},retrievedAt:'2026-09-08T12:00:00Z',sourceUpdatedAt:null,snapshotStatus:'recent',counts:{listings:listings.length}});
function fixture(t,options={}) {
 const {withEstate=false,withHeading=false,...panelOptions}=options;
 const window=new Window(),prior=globalThis.document;globalThis.document=window.document;
 const root=document.createElement('section'),original=document.createElement('p');original.id='existing-estate';root.append(original);document.body.append(root);
 if(withHeading){root.id='explorer';const heading=document.createElement('div');heading.className='panel-heading';heading.innerHTML='<h2>Property explorer</h2><button id="existing-collapse">Collapse</button><button id="existing-height">Height</button>';root.prepend(heading);}
 const selected=[],applied=[],outlines=[],markers=[],notices=[];let panel;
 const city={controls:{target:{x:0,z:0}},setParcel(p){outlines.push(p)},setListings(){throw new Error('Public panel must not replace imported markers')},flyTo(){}};
 const estate=withEstate?createEstatePanel(root,{getCity:()=>city,onMarkers(){},onSelectionChange(){panel?.clearSelection()}}):{selectPoint(p){selected.push(p);panel?.clearSelection()},setPropertyEvidence(e){applied.push(e);return true}};
 panel=createPropertyPanel(root,{estate,getCity:()=>city,notice:m=>notices.push(m),onPublicMarkers:(records,select)=>markers.push({records,select}),lookup:async p=>evidence(p),search:async()=>[],inventoryLoader:async()=>snapshot([]),debounceMs:0,...panelOptions});
 t.after(async()=>{panel.clearSelection();await window.happyDOM.abort();globalThis.document=prior});
 const $=id=>root.querySelector('#property-'+id),type=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event('input',{bubbles:true}))};
 return {root,original,panel,$,type,window,city,estate,selected,applied,outlines,markers,notices};
}

test('prepends native controls while preserving the estate panel and the three-character search threshold',async t=>{
 let searches=0;const f=fixture(t,{search:async()=>{searches++;return []}});
 assert.equal(f.root.querySelector('#existing-estate'),f.original);assert.ok(f.root.querySelector('details'));assert.ok(f.$('search'));
 f.type('search','ab');await settle();assert.equal(searches,0);assert.match(f.$('search-status').textContent,/3 characters/i);
});
test('debounced search ignores old successes and old errors after the query changes',async t=>{
 const pending=new Map();const f=fixture(t,{search:q=>new Promise((resolve,reject)=>pending.set(q,{resolve,reject}))});
 f.type('search','old');await settle();f.type('search','new');await settle();
 pending.get('new').resolve([{...point,recordKey:'record:new',parcelKey:'st-louis-city:h',parcelId:'new',address:'New Result'}]);await settle();
 pending.get('old').reject(new Error('stale error'));await settle();
 assert.match(f.$('search-results').textContent,/New Result/);assert.doesNotMatch(f.$('search-status').textContent,/unavailable/i);
});
test('inspection resets estate first, then guards its new lookup from older results and applies the parcel',async t=>{
 const pending=[];const f=fixture(t,{lookup:(p,{signal})=>new Promise(resolve=>pending.push({p,signal,resolve}))});
 const a=f.panel.inspectPoint(point);assert.equal(f.selected.length,1);assert.equal(pending.length,1);
 const other={longitude:-90.2,latitude:38.64},b=f.panel.inspectPoint(other);
 assert.equal(pending[0].signal.aborted,true);
 pending[0].resolve(evidence(point));await a;assert.equal(f.applied.length,0);
 pending[1].resolve(evidence(other));await b;assert.equal(f.applied.length,1);assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');
 const before=f.outlines.length;f.panel.refreshMarkers();assert.equal(f.outlines.length,before+1);assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');
});
test('ambiguous candidates require an exact source record choice and show unknown assessment year',async t=>{
 const a=parcel('one'),b=parcel('two');const calls=[];
 const f=fixture(t,{lookup:async p=>{calls.push(p);return p.recordKey?evidence(p,p.recordKey===b.properties.recordKey?b:a):{...evidence(p),parcels:{...evidence(p).parcels,parcel:null,candidates:[a,b],ambiguous:true}}}});
 await f.panel.inspectPoint(point);assert.equal(f.outlines.at(-1),null);
 const choices=f.$('evidence').querySelectorAll('button[data-record-key]');assert.equal(choices.length,2);choices[1].click();await settle();
 assert.equal(calls.at(-1).recordKey,'record:two');assert.equal(f.applied.at(-1).parcels.parcel.properties.parcelId,'two');
 assert.match(f.$('evidence').textContent,/Assessment year[\s\S]*Unknown/);assert.match(f.$('evidence').textContent,/\$0/);assert.match(f.$('evidence').textContent,/Overlay coverage[\s\S]*unavailable/i);
});
test('public centroid cannot silently select a neighboring parcel',async t=>{
 const f=fixture(t,{lookup:async p=>evidence(p,parcel('different',{parcelKey:'st-louis-city:other'}))});
 await f.panel.inspectPoint({...point,parcelKey:'st-louis-city:intended',parcelId:'intended'});
 assert.equal(f.applied.at(-1).parcels.parcel,null);assert.equal(f.outlines.at(-1),null);assert.match(f.$('evidence').textContent,/centroid|source parcel/i);
});
test('unsupported parcel/zoning coverage is explicit and source strings remain literal',async t=>{
 const f=fixture(t,{lookup:async p=>({point:p,parcels:{status:'unsupported',parcel:null,reason:'outside-city'},zoning:{status:'unsupported-municipality',jurisdiction:{label:'<img src=x onerror=alert(1)>'},districts:[],overlays:[],complete:false},inventory:{status:'unresolved',listings:[]}})});
 await f.panel.inspectPoint(point);assert.equal(f.$('evidence').querySelector('img'),null);assert.match(f.$('evidence').textContent,/unavailable|not connected/i);assert.match(f.$('evidence').textContent,/private sale status.*unknown/i);
});
test('public inventory uses the separate callback, caps markers and states matching versus mapped counts',async t=>{
 const rows=Array.from({length:300},(_,i)=>listing(String(i)));rows.push(listing('far',{longitude:-91}));
 const f=fixture(t,{inventoryLoader:async()=>snapshot(rows)});f.$('public-map').click();await settle();
 assert.equal(f.markers.at(-1).records.length,250);assert.match(f.$('public-counts').textContent,/300 matching/);assert.match(f.$('public-counts').textContent,/250.*map/i);assert.match(f.$('public-counts').textContent,/300.*unknown/i);
 f.$('public-radius').value='0';f.$('public-radius').dispatchEvent(new f.window.Event('change',{bubbles:true}));assert.match(f.$('public-counts').textContent,/301 matching/);
 f.markers.at(-1).select(rows[0]);await settle();assert.equal(f.selected.at(-1).parcelKey,rows[0].parcelKey);assert.equal(f.selected.at(-1).parcelId,rows[0].parcelId);
 f.$('public-clear').click();assert.equal(f.markers.at(-1).records.length,0);f.panel.refreshMarkers();assert.equal(f.markers.at(-1).records.length,0);
});
test('clearing an in-flight public overlay request prevents late marker re-enabling',async t=>{
 let resolve;const f=fixture(t,{inventoryLoader:()=>new Promise(r=>{resolve=r})});f.$('public-map').click();f.$('public-clear').click();resolve(snapshot([listing()]));await settle();
 assert.equal(f.markers.at(-1).records.length,0);assert.equal(f.$('public-map').disabled,false);assert.doesNotMatch(f.$('public-status').textContent,/loading/i);
});
test('clearSelection cancels outstanding evidence without clearing imported or public marker channels',async t=>{
 let resolve;const f=fixture(t,{lookup:p=>new Promise(r=>{resolve=r})});const waiting=f.panel.inspectPoint(point);const count=f.markers.length;f.panel.clearSelection();resolve(evidence(point));await waiting;
 assert.equal(f.applied.length,0);assert.equal(f.outlines.at(-1),null);assert.equal(f.markers.length,count);
});

test('workspace keyboard navigation and scenario action preserve selected evidence and entered assumptions',async t=>{
 const f=fixture(t,{withEstate:true}),input=f.root.querySelector('#estate-purchasePrice');
 const evidenceTab=f.$('tab-evidence');evidenceTab.focus();
 evidenceTab.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
 assert.equal(f.$('panel-activity').hidden,false);assert.equal(f.window.document.activeElement,f.$('tab-activity'));
 f.$('tab-activity').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
 assert.equal(f.$('panel-resident').hidden,false);assert.equal(f.window.document.activeElement,f.$('tab-resident'));
 f.$('tab-resident').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
 assert.equal(f.$('panel-tools').hidden,false);assert.equal(f.window.document.activeElement,f.$('tab-tools'));
 f.$('tab-tools').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
 assert.equal(f.$('panel-evidence').hidden,false);assert.equal(f.window.document.activeElement,evidenceTab);
 evidenceTab.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
 assert.equal(f.$('panel-tools').hidden,false);assert.equal(f.window.document.activeElement,f.$('tab-tools'));assert.equal(evidenceTab.tabIndex,-1);
 f.$('tab-tools').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));
 assert.equal(f.$('panel-evidence').hidden,false);assert.equal(f.window.document.activeElement,evidenceTab);
 await f.panel.inspectPoint(point);assert.equal(f.$('panel-evidence').hidden,false);
 input.value='125000';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));
 f.$('evidence').querySelector('button').click();
 assert.equal(f.$('panel-scenario').hidden,false);assert.equal(f.window.document.activeElement,input);
 assert.equal(input.value,'125000');assert.equal(f.root.querySelector('#estate-selection').textContent,'10 Fixture Place');
 f.panel.selectTab('evidence');assert.match(f.$('evidence').textContent,/10 Fixture Place/);
 assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');
 assert.equal(f.root.querySelectorAll('#estate-purchasePrice').length,1);
});

test('four primary tabs expose every tool through one accessible launcher without replacing original controls',async t=>{
 let lookups=0,inventoryLoads=0;const f=fixture(t,{withEstate:true,lookup:async p=>{lookups++;return evidence(p);},inventoryLoader:async()=>{inventoryLoads++;return snapshot([]);}});
 const tabs=[...f.root.querySelectorAll('.property-tabs [role="tab"]')];assert.deepEqual(tabs.map(x=>x.textContent),['Map','Activity','Notebook','Tools']);assert.equal(f.root.querySelectorAll('[role="tabpanel"]').length,4);
 const originalInput=f.root.querySelector('#estate-purchasePrice');originalInput.value='186500';
 f.$('tab-tools').click();assert.equal(f.$('tools-home').hidden,false);assert.equal(f.$('tool-header').hidden,true);
 for(const [key,label] of [['site','Site'],['inventory','Inventory'],['scenario','Pro forma'],['develop','Develop']]){
  const launcher=f.$('tab-'+key);assert.equal(launcher.getAttribute('role'),null);assert.equal(launcher.getAttribute('aria-controls'),'property-panel-'+key);launcher.click();
  assert.equal(f.$('panel-tools').hidden,false);assert.equal(f.$('tab-tools').getAttribute('aria-selected'),'true');assert.equal(f.$('tools-home').hidden,true);assert.equal(f.$('tool-header').hidden,false);assert.equal(f.$('tool-title').textContent,label);
  const panel=f.$('panel-'+key);assert.equal(panel.hidden,false);assert.equal(panel.getAttribute('role'),'region');assert.equal(f.window.document.activeElement,panel);
  assert.equal(f.root.querySelectorAll('.property-tool-panel:not([hidden])').length,1);assert.equal(f.root.querySelectorAll('.property-tabs [aria-selected="true"]').length,1);
  f.$('tools-back').click();assert.equal(f.$('tools-home').hidden,false);assert.equal(f.window.document.activeElement,launcher);assert.equal(f.root.querySelectorAll('.property-tool-panel:not([hidden])').length,0);
 }
 assert.equal(f.root.querySelector('#estate-purchasePrice'),originalInput);assert.equal(originalInput.value,'186500');assert.equal(lookups,0);assert.equal(inventoryLoads,0);
 assert.equal(f.panel.selectTab('nonexistent'),false);assert.equal(f.$('panel-tools').hidden,false);
});

test('programmatic tool routes retain exact selection, assumptions, Tools state and return keyboard focus',async t=>{
 const f=fixture(t,{withEstate:true});await f.panel.inspectPoint(point);const input=f.root.querySelector('#estate-purchasePrice');input.value='157000';
 for(const name of ['site','inventory','scenario','develop']){assert.equal(f.panel.selectTab(name),true);assert.equal(f.$('tab-tools').getAttribute('aria-selected'),'true');assert.equal(f.$('panel-'+name).hidden,false);assert.equal(f.$('context').hidden,false);assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');}
 f.panel.selectTab('scenario');input.focus();f.panel.selectTab('scenario');assert.equal(f.window.document.activeElement,input,'Reselecting the active tool must not steal input focus');
 assert.equal(input.value,'157000');f.$('tools-back').click();assert.equal(f.window.document.activeElement,f.$('tab-scenario'));
 f.panel.selectTab('resident');assert.equal(f.$('panel-resident').hidden,false);assert.equal(f.$('panel-tools').hidden,true);assert.equal(input.value,'157000');
});

test('inspection from Activity returns to its existing filters instead of sending the visitor to Map results',async t=>{
 const f=fixture(t);f.panel.selectTab('activity');const query=f.root.querySelector('[data-activity="query"]');query.value='same research question';
 await f.panel.inspectPoint(point);assert.equal(f.$('panel-evidence').hidden,false);assert.equal(f.$('context-results').hidden,false);assert.equal(f.$('context-results').textContent,'Back to Activity');
 f.$('context-results').click();assert.equal(f.$('panel-activity').hidden,false);assert.equal(f.window.document.activeElement,f.$('panel-activity'));assert.equal(f.root.querySelector('[data-activity="query"]'),query);assert.equal(query.value,'same research question');
 assert.equal(f.outlines.at(-1).properties.recordKey,'record:one');
 f.panel.selectTab('evidence');await f.panel.inspectPoint(point);assert.equal(f.$('context-results').textContent,'Back to results');
});

test('Activity-origin ambiguous candidates retain their return route after exact parcel choice',async t=>{
 const a=parcel('one'),b=parcel('two'),calls=[];
 const f=fixture(t,{lookup:async p=>{calls.push(p);return p.recordKey?evidence(p,p.recordKey===b.properties.recordKey?b:a):{...evidence(p),parcels:{...evidence(p).parcels,parcel:null,candidates:[a,b],ambiguous:true}}}});
 f.panel.selectTab('activity');const query=f.root.querySelector('[data-activity="query"]');query.value='retained address';await f.panel.inspectPoint(point);
 assert.equal(f.$('panel-evidence').hidden,false);assert.equal(f.$('context-results').textContent,'Back to Activity');assert.equal(f.outlines.at(-1),null);
 const choices=f.$('evidence').querySelectorAll('button[data-record-key]');assert.equal(choices.length,2);choices[1].click();await settle();
 assert.equal(calls.at(-1).recordKey,b.properties.recordKey);assert.equal(f.outlines.at(-1).properties.recordKey,b.properties.recordKey);assert.equal(f.$('context-results').textContent,'Back to Activity');
 f.$('context-results').click();assert.equal(f.$('panel-activity').hidden,false);assert.equal(f.window.document.activeElement,f.$('panel-activity'));assert.equal(query.value,'retained address');assert.equal(f.outlines.at(-1).properties.recordKey,b.properties.recordKey);
});

test('unresolved Activity source locations retain a return route without enabling notebook saving',async t=>{
 let saved=0;const f=fixture(t,{onNotebook:()=>saved++,lookup:async p=>({...evidence(p),parcels:{status:'not-found',parcel:null,candidates:[]}})});f.panel.selectTab('activity');await f.panel.inspectPoint({...point,address:'Source location only'});
 assert.equal(f.$('context').hidden,false);assert.equal(f.$('context-address').textContent,'Source location only');assert.match(f.$('context-id').textContent,/parcel not resolved/);assert.equal(f.$('context-save').disabled,true);f.$('context-save').click();assert.equal(saved,0);
 f.$('context-results').click();assert.equal(f.$('panel-activity').hidden,false);f.panel.clearSelection();assert.equal(f.$('context').hidden,true);
});

test('shell search opens Evidence and preserves exact-record choice without showing composite keys in result labels',async t=>{
 const key='st-louis-city:123456789:1234567890000:9876',queries=[];
 const f=fixture(t,{search:async query=>{queries.push(query);return [{...point,recordKey:key,parcelId:'1234567890000',address:'Exact Fixture'}]}});
 f.panel.selectTab('inventory');await f.panel.searchAddress('  Exact Fixture  ');
 assert.deepEqual(queries,['Exact Fixture']);assert.equal(f.$('panel-evidence').hidden,false);
 assert.equal(f.window.document.activeElement,f.$('search'));assert.equal(f.selected.length,0);
 const result=f.$('search-results').querySelector('button');assert.equal(result.dataset.recordKey,key);
 assert.match(result.textContent,/account 9876/);assert.equal(result.textContent.includes(key),false);
});

test('import controls retain their listeners after moving and an imported selection opens Scenario and clears stale evidence',async t=>{
 const f=fixture(t,{withEstate:true});await f.panel.inspectPoint(point);
 const file=f.root.querySelector('#estate-file');
 Object.defineProperty(file,'files',{configurable:true,value:[{name:'fixture.csv',size:250,text:async()=>
  'listing_id,address,latitude,longitude,asking_price,status,source,as_of,parcel_id\nfixture,Imported fixture,38.628,-90.193,225000,active,Fixture source,2026-09-08,fixture-parcel\n'}]});
 file.dispatchEvent(new f.window.Event('change',{bubbles:true}));await settle();
 await f.panel.inspectPoint(point);f.panel.selectTab('inventory');
 f.root.querySelector('#estate-list button').click();
 assert.equal(f.$('panel-scenario').hidden,false);assert.equal(f.root.querySelector('#estate-purchasePrice').value,'225000');
 assert.equal(f.root.querySelector('#estate-selection').textContent,'Imported fixture');
 assert.equal(f.outlines.at(-1),null);assert.match(f.$('evidence').textContent,/No parcel selected/);
});

test('County address results retain source identity and label the location without fabricating a parcel',async t=>{
 const address={longitude:-90.337,latitude:38.649,address:'41 S CENTRAL AVE',municipality:'Clayton',postalCode:'63105',jurisdiction:'st-louis-county',resultKind:'address',source:{name:'Synthetic County address source',url:'https://maps.stlouisco.com/',retrievedAt:'2026-09-09T00:00:00Z'}};
 const f=fixture(t,{withEstate:true,search:async()=>({results:[address],sources:[{jurisdiction:'st-louis-county',status:'ready',source:address.source},{jurisdiction:'st-louis-city',status:'ready'}],partial:false}),lookup:async p=>({point:p,parcels:{status:'unsupported',parcel:null,reason:'outside-city'},zoning:{status:'unsupported-municipality',districts:[]},inventory:{status:'unresolved',listings:[]}})});
 await f.panel.searchAddress('41 S Central');
 const result=f.$('search-results').querySelector('button');assert.match(result.textContent,/COUNTY · ADDRESS/);assert.match(result.textContent,/Clayton · 63105/);assert.doesNotMatch(result.textContent,/account|Parcel /);
 result.click();await settle();assert.equal(f.outlines.at(-1),null);assert.match(f.$('evidence').textContent,/41 S CENTRAL AVE/);assert.match(f.$('evidence').textContent,/address point/);assert.equal(f.root.querySelector('#estate-selection').textContent,address.address);
});

test('partial search preserves usable matches and cancelled requests cannot overwrite a later query',async t=>{
 const pending=[];const f=fixture(t,{search:(q,{signal})=>new Promise(resolve=>pending.push({q,signal,resolve}))});
 const first=f.panel.searchAddress('earlier'),second=f.panel.searchAddress('later');assert.equal(pending[0].signal.aborted,true);
 pending[1].resolve({results:[{...point,address:'Usable City result',resultKind:'parcel'}],sources:[{jurisdiction:'st-louis-city',status:'ready'},{jurisdiction:'st-louis-county',status:'unavailable'}],partial:true});await second;
 pending[0].resolve({results:[],sources:[],partial:false});await first;
 assert.match(f.$('search-results').textContent,/Usable City result/);assert.match(f.$('search-status').textContent,/County search is unavailable; coverage is partial/);
 f.type('search','ab');assert.equal(pending[1].signal.aborted,true);assert.match(f.$('search-status').textContent,/3 characters/);
});

test('selected property context persists across tabs and supports one-click notebook saving',async t=>{
 let saved=0;const f=fixture(t,{onNotebook:()=>saved++});await f.panel.inspectPoint(point);
 assert.equal(f.$('context').hidden,false);assert.match(f.$('context-address').textContent,/Fixture Place/);
 f.panel.selectTab('site');assert.equal(f.$('context').hidden,false);f.$('context-save').click();assert.equal(saved,1);assert.equal(f.$('panel-resident').hidden,false);
 f.$('expand').click();assert.equal(f.window.document.body.classList.contains('property-wide'),true);assert.equal(f.$('expand').getAttribute('aria-pressed'),'true');
 f.$('expand').click();assert.equal(f.window.document.body.classList.contains('property-wide'),false);
 f.panel.clearSelection();assert.equal(f.$('context').hidden,true);
});

test('workspace expansion shares the existing explorer heading and preserves its other controls',async t=>{
 const f=fixture(t,{withHeading:true}),heading=f.root.querySelector('.panel-heading'),button=f.$('expand'),collapse=f.root.querySelector('#existing-collapse'),height=f.root.querySelector('#existing-height');
 assert.equal(button.parentElement,heading);assert.equal(f.root.querySelector('.property-workspace-tools'),null);assert.equal(f.root.querySelectorAll('#property-expand').length,1);assert.equal(button.textContent,'Expand');assert.equal(button.getAttribute('aria-label'),'Expand workspace');
 let clicks=0;collapse.addEventListener('click',()=>clicks++);height.addEventListener('click',()=>clicks++);button.click();assert.equal(button.textContent,'Compact');assert.equal(button.title,'Compact workspace');assert.equal(button.getAttribute('aria-pressed'),'true');
 collapse.click();height.click();assert.equal(clicks,2);assert.equal(collapse.parentElement,heading);assert.equal(height.parentElement,heading);button.click();assert.equal(button.getAttribute('aria-label'),'Expand workspace');
});
