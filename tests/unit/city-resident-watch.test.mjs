import test from 'node:test';import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {normalizeNotebook,normalizeWatchEvent,summarizeNotebook,preservationScenario,RESIDENT_SCHEMA,RESIDENT_NOTICES} from '../../src/lib/city-resident-watch.mjs';
import {illustrativeProForma} from '../../src/lib/property-proforma.mjs';
import {createResidentPanel} from '../../src/scripts/city/city-resident-panel.mjs';
const event=(patch={})=>normalizeWatchEvent({id:'a',type:'transfer',date:'2026-01-01',title:'Fixture deed',sourceUrl:'https://example.org/deed',organization:'Fixture LLC',...patch});
const property=(key,events=[])=>({recordKey:key,parcelId:key,address:key,events,sourceUrl:'https://example.org/parcel'});
const notebook=properties=>normalizeNotebook({schema:RESIDENT_SCHEMA,properties});
test('LLC names and similar spellings never automatically establish common control or PE affiliation',()=>{const s=summarizeNotebook(notebook([property('1',[event()]),property('2',[event({organization:'FIXTURE LLC'})])]),{asOf:'2026-09-11'});assert.equal(s.groups.length,0);assert.equal(s.unresolvedOrganization,2);assert.equal(s.acquisitionRecords,2);assert.equal(Object.hasOwn(s,'privateEquityShare'),false);});
test('only exact documented registration IDs connect latest captured acquisitions',()=>{const registered={registrationId:'MO:001',registryUrl:'https://example.org/registry'};const s=summarizeNotebook(notebook([property('1',[event(registered)]),property('2',[event({...registered,id:'b'})]),property('3',[event({...registered,id:'c'}),event({id:'d',date:'2026-02-01',registrationId:'MO:002',registryUrl:'https://example.org/other',organization:'Other LLC'})])]),{asOf:'2026-09-11'});assert.equal(s.groups[0].properties.length,2);assert.equal(s.groups[1].properties.length,1);});
test('same-date conflicting buyers and future-dated transfers remain unresolved',()=>{const r=id=>({registrationId:'MO:'+id,registryUrl:'https://example.org/registry'});const s=summarizeNotebook(notebook([property('one',[event(r('1')),event({...r('2'),id:'b'})]),property('future',[event({...r('1'),date:'2030-01-01'})])]),{asOf:'2026-09-11'});assert.equal(s.groups.length,0);assert.equal(s.unresolvedOrganization,1);assert.equal(s.withoutAcquisition,1);});
test('source links and independent affiliation provenance are required without inferring sale price',()=>{assert.throws(()=>event({sourceUrl:''}));assert.throws(()=>event({sourceUrl:'javascript:alert(1)'}));assert.throws(()=>event({date:'2026-02-30'}));assert.throws(()=>event({registrationId:'MO:001'}));assert.throws(()=>event({affiliation:'A private equity firm'}));assert.equal(event({amount:200000,amountBasis:'consideration'}).amountBasis,'consideration');assert.throws(()=>event({type:'assessment',amountBasis:'reported-sale'}));assert.equal(event({type:'lead',sourceUrl:''}).sourceUrl,'');});
test('notebook imports reject duplicate identities, large collections and unknown fields',()=>{assert.throws(()=>notebook([property('same'),property('same')]));assert.throws(()=>notebook(Array.from({length:501},(_,i)=>property(String(i)))));const n=notebook([{...property('1'),secret:'excluded',events:[{...event(),ownerPhone:'excluded'}]}]);assert.equal(n.properties[0].secret,undefined);assert.equal(n.properties[0].events[0].ownerPhone,undefined);});
test('rent preservation uses explicit target rent and time-zero NPV support without changing debt or exit assumptions',()=>{const a=illustrativeProForma(),r=preservationScenario(a,1500);assert.equal(r.target.assumptions.rentMonthly,1500);assert.equal(r.target.assumptions.loanAmount,a.loanAmount);assert.equal(r.target.assumptions.exitPrice,a.exitPrice);assert.ok(r.target.returns.npv<r.base.returns.npv);assert.ok(Math.abs(r.target.returns.npv+r.upfrontSupportForZeroNpv)<1e-7);assert.ok(r.worstOperatingYear<0);assert.throws(()=>preservationScenario(a,NaN));});
test('planning notices preserve cancellation and limited evidence status',()=>{assert.equal(RESIDENT_NOTICES.items[0].status,'Cancellation notice');assert.equal(RESIDENT_NOTICES.items[0].date,'2026-09-29');assert.match(RESIDENT_NOTICES.items[1].status,/outcome not checked/);});
const ui=()=>{const w=new Window(),root=w.document.createElement('div');w.document.body.append(root);let stored;const p=createResidentPanel(root,{storage:()=>({getItem:()=>stored,setItem:(_,v)=>stored=v})});return {w,root,p,q:s=>root.querySelector(`[data-rw-${s}]`)};};
test('selected parcels save locally with no invented owners and render without HTML execution',()=>{const f=ui();f.p.setEvidence({point:{latitude:38.69,longitude:-90.35},parcels:{parcel:{properties:{recordKey:'a',parcelId:'a',address:'<img src=x onerror=alert(1)>'}},source:{url:'https://example.org/parcel'}}});f.q('add').click();assert.equal(f.p.getNotebook().properties.length,1);assert.equal(f.p.getNotebook().properties[0].events.length,0);assert.equal(f.root.querySelector('img'),null);assert.match(f.q('connections').textContent,/unknown/);});
test('failed storage cannot claim a saved watchlist case',()=>{const w=new Window(),root=w.document.createElement('div');const p=createResidentPanel(root,{storage:()=>({getItem:()=>null,setItem:()=>{throw Error('Storage blocked');}})});p.setEvidence({parcels:{parcel:{properties:{recordKey:'a',parcelId:'a',address:'A'}},source:{url:'https://example.org'}}});root.querySelector('[data-rw-add]').click();assert.equal(p.getNotebook().properties.length,0);assert.match(root.querySelector('[data-rw-status]').textContent,/Storage blocked/);});
test('superseded acquisition records are retained but excluded from organization connections',()=>{const a=event({registrationId:'MO:OLD',registryUrl:'https://example.org/old',superseded:true,replacedBy:'b'}),b=event({id:'b',registrationId:'MO:NEW',registryUrl:'https://example.org/new'});const n=notebook([property('one',[a,b])]),s=summarizeNotebook(n,{asOf:'2026-09-11'});assert.equal(n.properties[0].events.length,2);assert.equal(s.acquisitionRecords,1);assert.equal(s.groups[0].registrationId,'MO:NEW');});
test('case corrections preserve the original source record and append a new version',()=>{const f=ui();f.p.setEvidence({parcels:{parcel:{properties:{recordKey:'a',parcelId:'a',address:'A'}},source:{url:'https://example.org'}}});f.q('add').click();const form=f.q('form'),fill=patch=>Object.entries(patch).forEach(([k,v])=>form.elements.namedItem(k).value=v),submit=()=>form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));fill({type:'planning',date:'2026-08-25',title:'Original title',sourceUrl:'https://example.org/agenda',summary:'Agenda only.'});submit();assert.equal(f.p.getNotebook().properties[0].events.length,1);f.root.querySelector('[data-rw-edit]').click();fill({title:'Corrected title',summary:'Outcome remains unknown.'});submit();const events=f.p.getNotebook().properties[0].events;assert.equal(events.length,2);assert.equal(events[0].superseded,true);assert.equal(events[0].replacedBy,events[1].id);assert.equal(events[1].title,'Corrected title');assert.equal(events[1].superseded,false);});

test('existing notebooks restore into searchable lists without changing stored records',()=>{
 const w=new Window(),root=w.document.createElement('div');w.document.body.append(root);
 const original=notebook([property('100 Page',[event({organization:'Example Holdings'})]),property('200 Woodson',[event({type:'planning',title:'Site plan'})]),property('300 Lackland')]);
 let stored=JSON.stringify(original);const p=createResidentPanel(root,{storage:()=>({getItem:()=>stored,setItem:(_,v)=>stored=v})}),q=s=>root.querySelector(`[data-rw-${s}]`);
 assert.equal(root.querySelectorAll('[data-rw-choose]').length,3);
 q('search').value='holdings';q('search').dispatchEvent(new w.Event('input'));
 assert.equal(root.querySelectorAll('[data-rw-choose]').length,1);assert.match(q('list').textContent,/100 Page/);
 q('search').value='';q('search').dispatchEvent(new w.Event('input'));q('filter').value='empty';q('filter').dispatchEvent(new w.Event('change'));
 assert.match(q('list').textContent,/300 Lackland/);assert.equal(root.querySelectorAll('[data-rw-choose]').length,1);
 assert.deepEqual(p.getNotebook(),original);assert.deepEqual(JSON.parse(stored),original);
 assert.doesNotMatch(root.textContent,/private.equity|resident workspace|displacement|preservation|Keep neighborhoods/i);
});
test('switching notebook properties retains unsaved drafts and correction targets',()=>{
 const f=ui(),pick=id=>f.p.setEvidence({parcels:{parcel:{properties:{recordKey:id,parcelId:id,address:id}},source:{url:'https://example.org'}}});
 pick('first');f.p.addEvidence();const form=f.q('form');form.elements.namedItem('title').value='Unfinished first record';form.closest('details').open=true;
 pick('second');f.p.addEvidence();assert.equal(form.elements.namedItem('title').value,'');form.elements.namedItem('title').value='Second draft';
 f.root.querySelector('[data-rw-choose="first"]').click();assert.equal(form.elements.namedItem('title').value,'Unfinished first record');assert.equal(form.closest('details').open,true);
 f.root.querySelector('[data-rw-choose="second"]').click();assert.equal(form.elements.namedItem('title').value,'Second draft');assert.equal(f.p.getNotebook().properties.every(p=>p.events.length===0),true);
});
test('record filters do not delete evidence and cancelling a correction retains the original',()=>{
 const f=ui();f.p.setEvidence({parcels:{parcel:{properties:{recordKey:'a',parcelId:'a',address:'A'}},source:{url:'https://example.org'}}});f.p.addEvidence();
 const form=f.q('form');for(const [k,v]of Object.entries({type:'planning',date:'2026-08-25',title:'Source agenda',sourceUrl:'https://example.org/agenda'}))form.elements.namedItem(k).value=v;
 form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));f.q('event-filter').value='transfer';f.q('event-filter').dispatchEvent(new f.w.Event('change'));
 assert.match(f.q('timeline').textContent,/No records of this type/);assert.equal(f.p.getNotebook().properties[0].events.length,1);
 f.q('event-filter').value='all';f.q('event-filter').dispatchEvent(new f.w.Event('change'));f.root.querySelector('[data-rw-edit]').click();form.elements.namedItem('title').value='Uncommitted correction';f.q('cancel-edit').click();
 assert.equal(f.p.getNotebook().properties[0].events[0].title,'Source agenda');assert.equal(f.p.getNotebook().properties[0].events[0].superseded,false);
 f.p.addEvidence();assert.equal(f.p.getNotebook().properties.length,1);assert.equal(f.p.getNotebook().properties[0].events.length,1);
});
test('notebook shortcuts route to connected tools and absent coordinates disable View parcel',()=>{
 const w=new Window(),root=w.document.createElement('div'),actions=[];
 const p=createResidentPanel(root,{onFind:()=>actions.push('find'),onArea:s=>actions.push(s),onScenario:()=>actions.push('scenario'),storage:()=>({getItem:()=>null,setItem(){}})});
 for(const selector of ['[data-rw-find]','[data-rw-area="overland"]','[data-rw-area="page-i170"]','[data-rw-scenario]'])root.querySelector(selector).click();
 assert.deepEqual(actions,['find','overland','page-i170','scenario']);
 p.setEvidence({parcels:{parcel:{properties:{recordKey:'a',parcelId:'a',address:'A'}},source:{url:'https://example.org'}}});p.addEvidence();assert.equal(root.querySelector('[data-rw-locate]').disabled,true);
});
test('keyboard selection transfers focus to the selected case instead of the removed list row',()=>{
 const f=ui();for(const id of ['a','b']){f.p.setEvidence({parcels:{parcel:{properties:{recordKey:id,parcelId:id,address:id}},source:{url:'https://example.org'}}});f.p.addEvidence();}
 const button=f.root.querySelector('[data-rw-choose="a"]');button.focus();button.click();assert.equal(f.w.document.activeElement,f.q('case-title'));assert.equal(f.q('case-title').textContent,'a');
});
test('rent comparison displays both baselines and clears stale outputs when assumptions change',()=>{
 const w=new Window(),root=w.document.createElement('div'),assumptions=illustrativeProForma();const p=createResidentPanel(root,{getScenario:()=>({assumptions,name:'Illustrative fixture'}),storage:()=>({getItem:()=>null,setItem(){}})});
 root.querySelector('[data-rw-rent]').value='1500';root.querySelector('[data-rw-preserve]').click();const output=root.querySelector('[data-rw-preservation]');assert.match(output.textContent,/Current.*Target rent.*Change/s);assert.match(output.textContent,/\$1,500/);assert.equal(output.querySelectorAll('tbody tr').length,4);p.invalidateScenario();assert.equal(output.textContent,'');
});
