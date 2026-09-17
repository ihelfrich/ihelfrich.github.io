import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
import {createProFormaPanel} from '../../src/scripts/city/city-proforma-panel.mjs';
const setup=()=>{const w=new Window(),root=w.document.createElement('section');w.document.body.append(root);const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};const panel=createProFormaPanel(root,{storage:()=>storage});const q=key=>root.querySelector(`[data-pf-${key}]`);const submit=()=>q('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));return {w,root,panel,q,submit};};
test('underwriting begins blank, rejects missing values and enables exports only after calculation',()=>{const f=setup();assert.equal(f.root.querySelector('#pf-purchasePrice').value,'');f.submit();assert.match(f.q('status').textContent,/Purchase price/);assert.equal(f.panel.getResult(),null);f.q('example').click();f.submit();assert.ok(f.panel.getResult());assert.equal(f.root.querySelector('[data-pf-export="xlsx"]').disabled,false);f.root.querySelector('#pf-purchasePrice').value='210000';f.root.querySelector('#pf-purchasePrice').dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.panel.getResult(),null);assert.equal(f.root.querySelector('[data-pf-export="xlsx"]').disabled,true);});
test('new parcel selection never carries over another property financial assumptions',()=>{const f=setup(),ev=id=>({parcels:{parcel:{properties:{recordKey:id,parcelId:id,address:id,assessmentYear:2023,assessedValueUSD:999999}},source:{url:'https://example.org/public'}}});f.panel.setEvidence(ev('A'));assert.equal(f.root.querySelector('#pf-purchasePrice').value,'');f.q('example').click();f.submit();f.panel.setEvidence(ev('B'));assert.equal(f.panel.getResult(),null);assert.equal(f.root.querySelector('#pf-purchasePrice').value,'');assert.match(f.q('property').textContent,/B/);f.panel.setEvidence(null);assert.match(f.q('property').textContent,/No property/);});
test('saved scenario round-trips assumptions, evidence and illustrative status',()=>{const f=setup();f.q('example').click();f.submit();const expected=f.panel.getResult().sources.equity;f.q('save').click();f.q('reset').click();f.q('saved').value='0';f.q('load').click();assert.match(f.q('origin').textContent,/ILLUSTRATIVE/);assert.equal(f.panel.getResult(),null);f.submit();assert.equal(f.panel.getResult().sources.equity,expected);});
test('expanded workspace escapes inspector clipping and restores its original position',()=>{const f=setup(),original=f.root.parentNode;f.q('expand').click();assert.equal(f.root.parentNode,f.w.document.body);assert.equal(f.root.getAttribute('role'),'dialog');assert.equal(f.root.getAttribute('aria-modal'),'true');assert.match(f.q('expand').textContent,/Return to map/);f.root.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.root.parentNode,original);assert.equal(f.root.hasAttribute('aria-modal'),false);});
test('development import carries year-one NOI and the complete assumption provenance',()=>{const f=setup();assert.equal(f.panel.getScenario(),null);f.q('example').click();f.submit();const s=f.panel.getScenario();assert.equal(s.result.noiAnnual,f.panel.getResult().annual[0].noi);assert.equal(s.origin,'illustrative');assert.equal(s.proForma.assumptions.purchasePrice,185000);f.q('reset').click();assert.equal(f.panel.getScenario(),null);});
test('dependent preservation results can invalidate when pro-forma inputs change',()=>{const w=new Window(),root=w.document.createElement('section');w.document.body.append(root);let changes=0;createProFormaPanel(root,{storage:()=>({getItem:()=>null}),onChange:()=>changes++});const initial=changes;root.querySelector('[data-pf-example]').click();assert.equal(changes,initial+1);root.querySelector('[data-pf-form]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(changes,initial+2);root.querySelector('#pf-purchasePrice').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(changes,initial+3);});
const taxProperty=id=>({recordKey:`fixture:${id}`,parcelId:id,jurisdiction:'st-louis-county',address:`Synthetic ${id}`});
const taxEvidence=id=>({parcels:{parcel:{properties:taxProperty(id)},source:{url:'https://example.org/synthetic-parcels'}}});
const taxBill=id=>({status:'matched',...taxProperty(id),taxYear:2025,amountUSD:2345.67,amountKind:'annual-property-tax',sourceUrl:'https://example.org/synthetic-tax-bill',retrievedAt:'2026-09-12T12:00:00Z'});
test('fetched annual bills never overwrite assumptions or results until explicitly applied',()=>{
 const f=setup();f.panel.setEvidence(taxEvidence('A'));f.q('example').click();f.submit();const before=f.panel.getResult();
 assert.equal(f.panel.setTaxEvidence(taxBill('A')),true);assert.equal(f.panel.getResult(),before);assert.equal(f.root.querySelector('#pf-taxAnnual').value,'2800');
 assert.match(f.q('tax-preview').textContent,/2,800\.00 → source bill: \$2,345\.67 \(tax year 2025\)/);
 f.q('tax-use').click();assert.equal(f.root.querySelector('#pf-taxAnnual').value,'2345.67');assert.equal(f.panel.getResult(),null);assert.equal(f.root.querySelector('[data-pf-export="xlsx"]').disabled,true);
 f.submit();assert.equal(f.panel.getScenario().assumptionSources.taxAnnual.amountUSD,2345.67);assert.equal(f.panel.getScenario().origin,'illustrative');
});
test('manual annual-tax edits remove only that claim while other edits retain sourced tax provenance',()=>{
 const f=setup();f.panel.setEvidence(taxEvidence('A'));f.q('example').click();f.panel.setTaxEvidence(taxBill('A'));f.q('tax-use').click();f.submit();
 const price=f.root.querySelector('#pf-purchasePrice');price.value='200000';price.dispatchEvent(new f.w.Event('input',{bubbles:true}));f.submit();assert.equal(f.panel.getScenario().assumptionSources.taxAnnual.amountUSD,2345.67);
 const tax=f.root.querySelector('#pf-taxAnnual');tax.value='3100';tax.dispatchEvent(new f.w.Event('input',{bubbles:true}));f.submit();assert.deepEqual(f.panel.getScenario().assumptionSources,{});assert.equal(f.q('tax-use').disabled,false);
 f.q('tax-use').click();f.submit();assert.equal(f.panel.getScenario().assumptionSources.taxAnnual.amountUSD,2345.67);
});
test('parcel switches discard candidate bills and stale mismatched responses cannot apply',()=>{
 const f=setup();f.panel.setEvidence(taxEvidence('A'));f.panel.setTaxEvidence(taxBill('A'));f.panel.setEvidence(taxEvidence('B'));
 assert.equal(f.q('tax-evidence').hidden,true);assert.equal(f.panel.setTaxEvidence(taxBill('A')),false);assert.equal(f.root.querySelector('#pf-taxAnnual').value,'');
 assert.equal(f.panel.setTaxEvidence({...taxBill('B'),amountKind:'balance-due'}),false);assert.equal(f.root.querySelector('#pf-taxAnnual').value,'');
 assert.equal(f.panel.setTaxEvidence(taxBill('B')),true);f.q('tax-use').click();assert.equal(f.root.querySelector('#pf-taxAnnual').value,'2345.67');
});
test('saved annual-tax sources restore independently of fetching and new bill candidates do not replace them',()=>{
 const f=setup();f.panel.setEvidence(taxEvidence('A'));f.q('example').click();f.panel.setTaxEvidence(taxBill('A'));f.q('tax-use').click();f.submit();f.q('save').click();f.q('reset').click();
 f.q('saved').value='0';f.q('load').click();f.submit();assert.equal(f.panel.getScenario().assumptionSources.taxAnnual.taxYear,2025);assert.match(f.q('tax-applied').textContent,/tax-year 2025/);
 f.panel.setTaxEvidence({...taxBill('A'),taxYear:2026,amountUSD:3100});assert.equal(f.root.querySelector('#pf-taxAnnual').value,'2345.67');assert.equal(f.panel.getScenario().assumptionSources.taxAnnual.taxYear,2025);
 f.q('tax-use').click();f.submit();assert.equal(f.panel.getScenario().assumptionSources.taxAnnual.taxYear,2026);assert.equal(f.panel.getScenario().assumptions.taxAnnual,3100);
});
test('blank scenario growth starts at zero rather than the negative validation boundary',()=>{const f=setup();assert.equal(f.root.querySelector('#pf-rentGrowthPct').value,'0');assert.equal(f.root.querySelector('#pf-expenseGrowthPct').value,'0');assert.equal(f.root.querySelector('#pf-taxAnnual').value,'');});
test('starting checklist distinguishes blank, valid zero and invalid amounts without blocking expert calculation',()=>{
 const f=setup(),field=key=>f.root.querySelector(`#pf-${key}`),set=(key,value)=>{field(key).value=value;field(key).dispatchEvent(new f.w.Event('input',{bubbles:true}));};
 assert.match(f.q('readiness-summary').textContent,/0 of 5 entered/);assert.match(f.q('next-input').textContent,/Enter purchase price/);
 assert.equal(f.q('readiness').querySelector('details').open,false);
 for(const key of ['purchasePrice','rentMonthly','taxAnnual','insuranceAnnual','exitPrice'])set(key,'0');
 assert.match(f.q('readiness-summary').textContent,/5 of 5 entered/);assert.equal(f.q('next-input').hidden,true);assert.match(f.q('readiness-note').textContent,/Review the remaining assumptions/);
 f.submit();assert.ok(f.panel.getResult(),'Explicit zero amounts remain valid model inputs');
 set('insuranceAnnual','');assert.match(f.q('readiness-summary').textContent,/4 of 5 entered/);assert.match(f.q('next-input').textContent,/Enter annual insurance/);
 set('insuranceAnnual','-1');assert.match(f.q('next-input').textContent,/Check annual insurance/);assert.equal(f.root.querySelector('[data-pf-focus-input="insuranceAnnual"]').dataset.inputState,'check');
 set('insuranceAnnual','1000000001');assert.match(f.q('readiness-summary').textContent,/4 of 5 entered/);
});
test('checklist actions open and focus their existing groups and follow tax application and resets',()=>{
 const f=setup();f.panel.setEvidence(taxEvidence('A'));const rent=f.root.querySelector('#pf-rentMonthly'),tax=f.root.querySelector('#pf-taxAnnual');
 assert.equal(rent.closest('details').open,false);f.root.querySelector('[data-pf-focus-input="rentMonthly"]').click();assert.equal(rent.closest('details').open,true);assert.equal(f.w.document.activeElement,rent);
 f.q('next-input').click();assert.equal(f.w.document.activeElement,f.root.querySelector('#pf-purchasePrice'));
 f.panel.setTaxEvidence(taxBill('A'));assert.match(f.q('readiness-summary').textContent,/0 of 5 entered/);f.q('tax-use').click();assert.match(f.q('readiness-summary').textContent,/1 of 5 entered/);
 f.root.querySelector('[data-pf-focus-input="taxAnnual"]').click();assert.equal(f.w.document.activeElement,tax);assert.equal(tax.closest('details').open,true);
 f.q('example').click();assert.match(f.q('readiness-summary').textContent,/5 of 5 entered/);f.q('reset').click();assert.match(f.q('readiness-summary').textContent,/0 of 5 entered/);
});
test('cap-rate checklist explains the existing unused-price requirement without silently filling it',()=>{
 const f=setup(),exit=f.q('form').elements.namedItem('exitMethod');exit.value='cap';exit.dispatchEvent(new f.w.Event('change',{bubbles:true}));
 assert.match(f.q('readiness-note').textContent,/enter 0 in the unused sale-price field/);assert.equal(f.root.querySelector('#pf-exitPrice').value,'');
 f.root.querySelector('[data-pf-focus-input="exitPrice"]').click();assert.equal(f.w.document.activeElement,f.root.querySelector('#pf-exitPrice'));
});
