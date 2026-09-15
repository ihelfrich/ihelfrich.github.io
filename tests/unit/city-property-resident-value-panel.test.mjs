import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createResidentValuePanel} from '../../src/scripts/city/city-resident-value-panel.mjs';

const now=()=>new Date('2026-09-13T15:00:00Z');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const source={id:'stlco-real-billing-2025-sales',name:'County 2025 billing archive',url:'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip',retrievedAt:'2026-09-12T17:29:42Z',archiveEntryTimestamp:'2025-11-17T09:16:38',maxObservedSaleDateISO:'2025-10-29',limitations:['Latest published transfer per source record; this is not complete current sales coverage.']};
const marketContext=(pace=4.25)=>({source:{id:'fhfa-st-louis-all-transactions',seriesName:'St. Louis metropolitan all-transactions house-price index',url:'https://www.fhfa.gov/data/hpi/datasets',retrievedAt:'2026-09-13T12:00:00Z'},latest:{period:'2026 Q2'},changes:{oneYearPct:pace},limitations:['A regional index does not establish the appreciation of an individual property.']});
const selected=(n=1)=>({point:{longitude:-90.36,latitude:38.70},parcels:{parcel:{properties:{jurisdiction:'st-louis-county',recordKey:`st-louis-county-current:14L00000${n}:${n}`,parcelKey:`st-louis-county:14L00000${n}`,parcelId:`14L00000${n}`,sourceObjectId:n,address:`${n} Subject Street`}}}});
function saleEvidence(evidence=selected(),patch={}){
  const subject={...evidence.parcels.parcel.properties,...evidence.point};
  const candidate={recordKey:'st-louis-county-current:14L000020:20',parcelKey:'st-louis-county:14L000020',parcelId:'14L000020',sourceObjectId:20,jurisdiction:'st-louis-county',address:'20 Candidate Street',longitude:-90.359,latitude:38.70,priceUSD:150000,saleDateISO:'2025-05-01',distanceKm:.09,latestSalePriceStatus:'recorded',latestSaleValidityCode:'X',latestSaleMarketValidityCode:null,latestSaleDateRaw:'01-MAY-25',latestSaleDateCenturyInferred:true,latestSaleSourceId:source.id,source:{...source},qualification:'administrative-transfer-not-verified-comparable'};
  return {status:'ready',subject,candidates:[candidate],totalCandidates:1,examinedRecords:4,omittedByLimit:0,exclusionCounts:{'outside-date-window':1,'missing-or-zero-price':1,'source-flagged-transfer':1},sources:[{...source}],partial:false,coverage:{scope:'latest-available-transfer-per-source-record',radiusKm:1.5,fromDate:'2023-09-13',toDate:'2026-09-13',latestObservedSaleDateISO:'2025-10-29',warnings:['Latest available transfer snapshots are not complete current-market coverage.','Current comparable living area, home condition and transaction concessions are not established.']},valuation:{status:'not-estimated',reason:'Dated administrative records require comparable-property and transaction verification before estimating current value.'},...patch};
}
const financials=()=>({valueLow:200000,valueHigh:250000,offerPrice:210000,mortgagePayoff:120000,market:{sellingFeePct:6,closingCosts:3000,repairs:10000,concessions:2000,holdingMonths:3,monthlyHoldingCost:1500},offer:{sellingFeePct:1,closingCosts:1000,repairs:0,concessions:500,holdingMonths:1,monthlyHoldingCost:1000}});
function fixture(t,{loadSales=async e=>saleEvidence(e),loadMarket=async()=>marketContext()}={}){
  const win=new Window({url:'https://ihelfrich.github.io/st-louis/'}),root=win.document.createElement('section');win.document.body.append(root);
  const saleCalls=[],marketCalls=[],downloads=[],navigation=[];let disposed=0;
  const panel=createResidentValuePanel(root,{now,sales:{load(e,o){saleCalls.push({evidence:e,...o});return loadSales(e,o);},dispose(){disposed++;}},loadMarket(o){marketCalls.push(o);return loadMarket(o);},download(value,type,name){downloads.push({value,type,name});},onFind:()=>navigation.push('find'),onProforma:()=>navigation.push('proforma')});
  // This installed happy-dom version selects the preceding option while parsing
  // innerHTML. Honor explicit selected attributes as native browsers do; resets
  // and all later user edits still run through the actual form implementation.
  for(const select of root.querySelectorAll('select')){const option=select.querySelector('option[selected]');if(option)select.value=option.value;}
  const $=key=>root.querySelector(`[data-rv="${key}"]`),exportButton=kind=>root.querySelector(`[data-rv-export="${kind}"]`);
  const input=(name,value,form='offer-form')=>{const node=$(form).elements.namedItem(name);assert.ok(node,`input ${name} exists`);node.value=String(value);node.dispatchEvent(new win.Event('input',{bubbles:true}));return node;};
  const submit=form=>$(form).dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  const fill=(values=financials())=>{for(const[key,value]of Object.entries(values))if(value&&typeof value==='object'){for(const[field,amount]of Object.entries(value))input(`${key}-${field}`,amount);}else input(key,value);};
  t.after(async()=>{panel.destroy();await win.happyDOM.abort();});
  return {win,root,panel,$,input,submit,fill,exportButton,saleCalls,marketCalls,downloads,navigation,get disposed(){return disposed;}};
}

test('opening lazily loads the selected parcel once, preserves assumptions across tabs, and offers direct next actions',async t=>{
  const f=fixture(t);f.panel.setEvidence(selected());await settle();assert.equal(f.saleCalls.length,0);assert.equal(f.marketCalls.length,0);
  f.panel.setActive(true);await settle();assert.equal(f.saleCalls.length,1);assert.equal(f.marketCalls.length,1);assert.equal(f.saleCalls[0].radiusKm,.5);assert.equal(f.saleCalls[0].lookbackMonths,36);
  f.$('next').click();assert.equal(f.root.querySelector('[data-rv-view="offer"]').hidden,false);assert.equal(f.win.document.activeElement,f.$('offer-form').elements.namedItem('valueLow'));
  f.input('valueLow',200000);f.panel.setActive(false);f.panel.setActive(true);await settle();assert.equal(f.saleCalls.length,1);assert.equal(f.$('offer-form').elements.namedItem('valueLow').value,'200000');
  f.$('find').click();f.$('proforma').click();assert.deepEqual(f.navigation,['find','proforma']);
});

test('source evidence appears before a pending market request without inserting a benchmark or appraisal',async t=>{
  const pending=deferred(),f=fixture(t,{loadMarket:()=>pending.promise});f.panel.setEvidence(selected());f.panel.setActive(true);await settle();
  assert.match(f.$('evidence-status').textContent,/Nearby evidence assembled/);assert.match(f.$('evidence-result').textContent,/Current value is not established/);
  assert.match(f.$('evidence-result').textContent,/not complete current-market coverage/);assert.match(f.$('evidence-result').textContent,/2025-10-29/);assert.match(f.$('evidence-result').textContent,/2026-09-12/);
  assert.match(f.$('evidence-result').textContent,/not established/);assert.match(f.$('evidence-result').textContent,/not.*value|before estimating current value/);
  assert.equal(f.$('offer-form').elements.namedItem('valueLow').value,'');assert.equal(f.$('offer-form').elements.namedItem('valueHigh').value,'');assert.equal(f.panel.getDocument().offer,null);
  assert.equal(f.exportButton('report').disabled,false);assert.equal(f.exportButton('csv').disabled,true);assert.equal(f.$('use-trend').disabled,true);
  pending.resolve(marketContext());await settle();assert.match(f.$('market-context').textContent,/regional index, not the appreciation of this property/);assert.equal(f.$('use-trend').disabled,false);
});

test('market context can arrive independently of sales and an unknown rate is unavailable rather than zero',async t=>{
  const pending=deferred(),f=fixture(t,{loadSales:()=>pending.promise,loadMarket:async()=>marketContext(null)});f.panel.setEvidence(selected());f.panel.setActive(true);await settle();
  assert.match(f.$('market-context').textContent,/latest year: unavailable/);assert.doesNotMatch(f.$('market-context').textContent,/0\.00%/);assert.equal(f.$('use-trend').disabled,true);assert.match(f.$('evidence-status').textContent,/Collecting/);
  pending.resolve(saleEvidence(selected(),{status:'insufficient',candidates:[],totalCandidates:0}));await settle();assert.match(f.$('evidence-status').textContent,/No usable candidates/);assert.match(f.$('evidence-result').textContent,/2025-10-29/);
});

test('entered costs yield the independently reconciled seller net sheet and updates invalidate missing inputs',t=>{
  const f=fixture(t);f.fill();f.submit('offer-form');const r=f.panel.getDocument().offer;
  assert.equal(r.offer.net,85400);assert.deepEqual(r.market,{lowNet:48500,highNet:95500});assert.equal(r.breakEvenOfferPrice.low,171000/.99);assert.equal(r.breakEvenOfferPrice.high,218000/.99);
  assert.equal(f.$('offer-result').hidden,false);assert.match(f.$('offer-result').textContent,/\$85,400/);assert.match(f.$('offer-result').textContent,/\$48,500 – \$95,500/);assert.equal(f.exportButton('csv').disabled,false);
  f.input('offerPrice',220000);assert.equal(f.panel.getDocument().offer.offer.net,95300);assert.match(f.$('offer-result').textContent,/\$95,300/);
  f.input('mortgagePayoff','');assert.equal(f.panel.getDocument().offer,null);assert.equal(f.$('offer-result').hidden,true);assert.equal(f.exportButton('csv').disabled,true);assert.equal(f.exportButton('report').disabled,true);assert.match(f.$('offer-status').textContent,/Mortgage payoff/);
  f.input('mortgagePayoff',0);assert.equal(f.panel.getDocument().offer.offer.net,215300);assert.equal(f.exportButton('csv').disabled,false);
  f.input('market-sellingFeePct',100);assert.equal(f.panel.getDocument().offer,null);assert.match(f.$('offer-status').textContent,/less than 100/);
});

test('zero costs are visible outside the collapsed detail and negative algebraic break-even is explained',t=>{
  const f=fixture(t);assert.equal(f.root.querySelector('.rv-costs').open,false);assert.match(f.$('cost-summary').textContent,/both routes start at \$0/);
  f.fill({valueLow:10000,valueHigh:12000,offerPrice:11000,mortgagePayoff:0});f.submit('offer-form');assert.equal(f.panel.getDocument().offer.offer.net,11000);assert.match(f.$('cost-summary').textContent,/both routes have \$0 allowances/);
  f.input('market-repairs',20000);assert.match(f.$('cost-summary').textContent,/entered fees, repairs/);assert.deepEqual(f.panel.getDocument().offer.breakEvenOfferPrice,{low:-10000,high:-8000});
  assert.match(f.$('offer-result').textContent,/Even a zero-price transfer/);assert.match(f.$('offer-result').textContent,/algebraic break-even: -\$10,000/);assert.doesNotMatch(f.$('offer-result').textContent,/An offer of -\$/);
  f.exportButton('report').click();assert.equal(f.downloads.length,1);assert.match(f.downloads[0].value,/zero-price transfer/);assert.match(f.downloads[0].value,/algebraic break-even -\$10,000/);
  f.input('market-repairs',0);assert.match(f.$('cost-summary').textContent,/both routes have \$0 allowances/);
});

test('future paths require an entered baseline and react to both baseline and scenario edits',t=>{
  const f=fixture(t);f.submit('forecast-form');assert.equal(f.panel.getDocument().forecast,null);assert.equal(f.$('forecast-result').hidden,true);assert.match(f.$('forecast-status').textContent,/Enter your baseline value range in step 2/);
  f.input('valueLow',200000);f.input('valueHigh',250000);let result=f.panel.getDocument().forecast;assert.equal(result.classification,'user-what-if');assert.equal(result.paths.steady[5].high,250000);assert.equal(f.panel.getDocument().offer,null);
  assert.match(f.$('forecast-status').textContent,/not statistical confidence/);assert.ok(f.$('forecast-result').querySelector('svg[role="img"]'));assert.equal(f.exportButton('report').disabled,false);assert.equal(f.exportButton('csv').disabled,true);
  f.input('higher',10,'forecast-form');result=f.panel.getDocument().forecast;assert.ok(Math.abs(result.paths.higher[5].high-402627.5)<1e-7);
  f.input('valueHigh','');assert.equal(f.panel.getDocument().forecast,null);assert.equal(f.$('forecast-result').hidden,true);assert.equal(f.exportButton('report').disabled,true);
  f.input('valueHigh',240000);assert.equal(f.panel.getDocument().forecast.assumptions.valueHigh,240000);
  f.input('lower',11,'forecast-form');assert.equal(f.panel.getDocument().forecast,null);assert.match(f.$('forecast-status').textContent,/ordered lower/);
});

test('regional trend selection is explicit and labels illustrative rates without claiming prediction bounds',async t=>{
  const f=fixture(t);f.panel.setActive(true);await settle();assert.equal(f.saleCalls.length,0);assert.equal(f.$('forecast-form').elements.namedItem('steady').value,'0');
  f.$('use-trend').click();assert.equal(f.panel.getDocument().forecast,null);assert.match(f.$('forecast-status').textContent,/Enter your baseline/);
  f.input('valueLow',200000);f.input('valueHigh',250000);f.$('use-trend').click();assert.deepEqual(f.panel.getDocument().forecast.assumptions.rates,{lower:1.25,steady:4.25,higher:7.25});
  assert.match(f.$('forecast-status').textContent,/illustrative ±3 percentage-point/);assert.match(f.$('forecast-status').textContent,/not fitted prediction bounds/);assert.match(f.$('market-context').textContent,/Historical pace does not establish future growth/);
});

test('parcel switching resets financial inputs and excludes late responses for the former parcel',async t=>{
  const pending=[],f=fixture(t,{loadSales:e=>{const d=deferred();pending.push({e,...d});return d.promise;}});f.panel.setEvidence(selected(1));f.panel.setActive(true);await settle();
  f.fill();f.input('basisNote','Prior property appraisal');f.submit('offer-form');f.submit('forecast-form');assert.ok(f.panel.getDocument().offer);assert.ok(f.panel.getDocument().forecast);
  f.panel.setEvidence(selected(2));await settle();assert.equal(f.saleCalls[0].signal.aborted,true);assert.equal(f.panel.getDocument().subject.recordKey,selected(2).parcels.parcel.properties.recordKey);assert.equal(f.panel.getDocument().offer,null);assert.equal(f.panel.getDocument().forecast,null);
  for(const name of ['valueLow','valueHigh','offerPrice','mortgagePayoff','basisNote'])assert.equal(f.$('offer-form').elements.namedItem(name).value,'');assert.equal(f.$('offer-form').elements.namedItem('market-repairs').value,'0');assert.equal(f.$('forecast-form').elements.namedItem('steady').value,'0');
  assert.equal(f.exportButton('json').disabled,true);assert.equal(f.$('offer-result').hidden,true);assert.equal(f.$('forecast-result').hidden,true);
  pending[1].resolve(saleEvidence(selected(2)));await settle();const current=f.panel.getDocument();pending[0].resolve(saleEvidence(selected(1)));await settle();assert.equal(f.panel.getDocument().saleEvidence,current.saleEvidence);assert.equal(f.panel.getDocument().subject.recordKey,selected(2).parcels.parcel.properties.recordKey);assert.match(f.$('property').textContent,/2 Subject Street/);
});

test('refresh clears old sale evidence immediately; pending exports never attach prior search results',async t=>{
  const pending=deferred();let calls=0;const f=fixture(t,{loadSales:e=>++calls===1?saleEvidence(e):pending.promise});f.panel.setEvidence(selected());f.panel.setActive(true);await settle();f.fill();f.submit('offer-form');
  f.$('radius').value='0.5';f.$('radius').dispatchEvent(new f.win.Event('change'));await settle();assert.equal(f.panel.getDocument().saleEvidence,null);assert.equal(f.$('evidence-result').textContent,'');assert.equal(f.saleCalls[1].radiusKm,.5);
  f.exportButton('json').click();let data=JSON.parse(f.downloads.at(-1).value);assert.equal(data.saleEvidence,null);assert.equal(data.subject.recordKey,selected().parcels.parcel.properties.recordKey);assert.equal(data.offer.offer.net,85400);
  pending.resolve(saleEvidence(selected(),{coverage:{...saleEvidence().coverage,radiusKm:.5}}));await settle();f.exportButton('json').click();data=JSON.parse(f.downloads.at(-1).value);assert.equal(data.saleEvidence.coverage.radiusKm,.5);
});

test('exports retain current assumptions, exact source identity, source vintage and limitations',async t=>{
  const f=fixture(t);f.panel.setEvidence(selected());f.panel.setActive(true);await settle();f.fill();f.input('basis','independent-appraisal');f.input('basisNote','Appraiser A, 2026-08-31 <review required>');f.submit('offer-form');f.submit('forecast-form');
  for(const kind of ['json','report','csv'])f.exportButton(kind).click();assert.equal(f.downloads.length,3);assert.doesNotMatch(f.$('export-status').textContent,/could not/);
  const json=JSON.parse(f.downloads[0].value);assert.equal(json.createdAt,now().toISOString());assert.equal(json.subject.recordKey,selected().parcels.parcel.properties.recordKey);assert.equal(json.benchmark.basis,'independent-appraisal');assert.equal(json.offer.assumptions.valueLow,json.benchmark.valueLow);assert.equal(json.forecast.assumptions.valueHigh,json.benchmark.valueHigh);
  const candidate=json.saleEvidence.candidates[0];assert.equal(candidate.recordKey,'st-louis-county-current:14L000020:20');assert.equal(candidate.latestSaleMarketValidityCode,null);assert.equal(candidate.latestSaleDateCenturyInferred,true);assert.equal(candidate.source.retrievedAt,source.retrievedAt);assert.equal(json.saleEvidence.valuation.status,'not-estimated');assert.equal(json.marketContext.source.url,marketContext().source.url);assert.match(json.limitations.join(' '),/No current property appraisal/);
  const html=f.downloads[1];assert.equal(html.type,'text/html');assert.match(html.value,/2025-10-29/);assert.match(html.value,/2026-09-12T17:29:42Z/);assert.match(html.value,/2025-11-17T09:16:38/);assert.ok(html.value.includes(source.url));assert.match(html.value,/14L000020:20/);assert.match(html.value,/01-MAY-25/);assert.match(html.value,/Two-digit year interpreted: yes/);assert.match(html.value,/market validity code: unknown/);assert.match(html.value,/not independently verified comparable sales/);assert.match(html.value,/&lt;review required&gt;/);
  const csv=f.downloads[2];assert.equal(csv.type,'text/csv');assert.match(csv.value,/independent-appraisal/);assert.match(csv.value,/48500,95500,85400/);assert.match(csv.value,/not an appraisal/);
});

test('source failure remains retryable and disposal prevents late source completion from repopulating the panel',async t=>{
  let failed=true;const pending=deferred(),f=fixture(t,{loadSales:e=>{if(failed)throw Error('offline');return pending.promise;}});f.panel.setEvidence(selected());f.panel.setActive(true);await settle();assert.match(f.$('evidence-status').textContent,/could not be loaded.*retry/);assert.equal(f.panel.getDocument().saleEvidence,null);
  failed=false;f.$('refresh').click();await settle();f.panel.destroy();assert.equal(f.saleCalls.at(-1).signal.aborted,true);assert.equal(f.disposed,1);pending.resolve(saleEvidence());await settle();assert.equal(f.root.childNodes.length,0);
});
