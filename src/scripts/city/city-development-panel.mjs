import {calculateDevelopmentEnvelope,calculateGrowthSensitivity,MODEL_VERSION,VALIDATION_STATUS} from '../../lib/city-development.mjs';
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const count=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const compactUsd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const envelopeFields=[
 ['lotAreaSqFt','Lot area · ft²',0],['far','Assumed FAR',0],['coveragePct','Assumed lot coverage · %',0,100],['stories','Assumed stories',0,null,1],['efficiencyPct','Usable / gross area · %',0,100],['averageUnitSqFt','Average unit area · ft²',0],['hardCostPerGrossSqFt','Hard cost · $ / gross ft²',0],['softCostPct','Soft cost / hard cost · %',0],['contingencyPct','Contingency / hard + soft · %',0],
];
const incomeFields=[
 ['currentNoiAnnual','Current annual NOI · $ / year'],['growthPct','Base annual NOI growth · %',-100],['discountRatePct','Annual discount rate · %',-100],['terminalCapPct','Terminal cap rate · %',0],['horizonYears','Horizon · years',1,100,1],['exitCostsPct','Exit costs / terminal value · %',0,100],['lowGrowthPct','Low annual NOI growth · %',-100],['highGrowthPct','High annual NOI growth · %',-100],
];
const manualBasis=()=>({kind:'user-assumptions',sourceArea:null,importedScenario:null,illustrativeFields:[]});
const identity=e=>e?.parcels?.parcel?.properties?.recordKey||e?.point&&`${e.point.longitude},${e.point.latitude}`||'none';
function propertyBrief(e) {
 const p=e?.parcels?.parcel?.properties;
 return p?{recordKey:p.recordKey||null,parcelId:p.parcelId||null,address:p.address||null,lotAreaSqFt:Number.isFinite(p.areaSqFt)?p.areaSqFt:null,sourceRecordDate:p.sourceRecordDate||null,source:structuredClone(e.parcels.source||null)}:null;
}

/** Browser-only deterministic model UI. No data requests, predictions or automatic source import. */
export function createDevelopmentPanel(root,{getEvidence=()=>null,getScenario=()=>null,notice=()=>{}}={}) {
 const doc=root.ownerDocument,listeners=[],urls=new Map();let disposed=false,selected=null,selectionId=null,envelope=null,income=null,envelopeBasis=manualBasis(),incomeBasis=manualBasis();
 const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node};
 const $=id=>root.querySelector('#'+id);
 const listen=(node,event,handler)=>{node.addEventListener(event,handler);listeners.push(()=>node.removeEventListener(event,handler))};
 root.innerHTML=`
  <section class="estate-source development-workspace" aria-labelledby="development-title">
   <span class="eyebrow">USER-CONTROLLED MODELS</span><h3 id="development-title">Build the assumptions.</h3>
   <p class="model-status">Scenario engine v1 · Empirical AI valuation: not trained.</p>
   <p id="development-selection" class="small-note"></p>
   <div class="button-row"><button id="development-example" class="secondary-button" type="button">Try an invented property</button><button id="development-reset" class="text-button" type="button">Clear model inputs</button></div>
   <p id="development-fixture" class="model-status" hidden></p>
   <section aria-labelledby="development-envelope-title"><h3 id="development-envelope-title">Development envelope</h3>
    <p class="small-note">Test area, capacity and a construction budget. FAR, coverage and stories are your assumptions; zoning dimensional rules and legal entitlement have not been verified.</p>
    <button id="development-use-area" class="secondary-button" type="button" disabled>Use selected source lot area</button><p id="development-area-basis" class="small-note">Lot area: Unknown until you enter it or explicitly use source evidence.</p>
    <form id="development-form" class="development-form"><div id="development-fields" class="estate-fields"></div><button class="primary-button wide" type="submit">Calculate development envelope</button></form>
    <p id="development-status" class="model-status" role="status"></p><div id="development-results" hidden></div>
   </section>
   <section aria-labelledby="valuation-title"><h3 id="valuation-title">Income value & growth</h3>
    <p class="small-note">Current NOI is year 0. Annual NOI is received at each year end; the terminal sale uses year horizon + 1 NOI. Every rate and amount is your assumption.</p>
    <button id="valuation-use-noi" class="secondary-button" type="button">Import calculated rental NOI</button><p id="valuation-basis" class="small-note">Current NOI has not been supplied. Assessed value is not a market-value input.</p>
    <form id="valuation-form" class="development-form"><div id="valuation-fields" class="estate-fields"></div><button class="primary-button wide" type="submit">Calculate income scenarios</button></form>
    <p id="valuation-status" class="model-status" role="status"></p><div id="valuation-results" hidden></div>
   </section>
   <button id="development-export" class="secondary-button wide" type="button" hidden>Download model scenarios & sources ↓</button>
   <details class="property-source-details"><summary>Model method & validation record</summary>
    <p><strong>Empirical AI valuation: Not trained.</strong> These are deterministic scenario calculations. No learned valuation coefficients or market predictions are connected.</p>
    <p class="small-note">An empirical model needs licensed sales and property data, dated joins, calibration on a training sample, held-out temporal and geographic evaluation, baseline comparisons, uncertainty calibration and drift monitoring. None has been performed here.</p>
    <p class="small-note">Envelope: gross area = min(lot × FAR, lot × coverage × stories). Usable area = gross × efficiency. Whole units round down. Soft costs apply to hard costs; contingency applies to hard + soft. Construction budget excludes land, acquisition, financing and operating carry.</p>
    <p class="small-note">Income value = discounted years 1…H NOI + discounted [year H+1 NOI / terminal cap × (1 − exit costs)]. Losses remain signed. Growth sensitivity holds other inputs fixed and is not a confidence interval.</p>
    <p class="small-note">Arithmetic validation: zero/scaling/conservation, timing, domain and overflow invariants. Empirical market validation: not performed. Model version: ${MODEL_VERSION}.</p>
   </details>
  </section>`;
 function fields(prefix,rows) {
  for(const [key,label,min,max,step] of rows) {
   const wrapper=el('label',label),input=el('input');input.type='number';input.id=prefix+'-'+key;input.name=key;input.required=true;input.step=step??'any';if(min!=null)input.min=String(min);if(max!=null)input.max=String(max);wrapper.htmlFor=input.id;wrapper.append(input);$(prefix+'-fields').append(wrapper);
  }
 }
 fields('development',envelopeFields);fields('valuation',incomeFields);
 const read=(prefix,rows)=>Object.fromEntries(rows.map(([key])=>[key,$(prefix+'-'+key).value.trim()===''?NaN:Number($(prefix+'-'+key).value)]));
 const fill=(prefix,values)=>{for(const [key,value] of Object.entries(values))$(prefix+'-'+key).value=String(value)};
 function updateExport(){$('development-export').hidden=!envelope&&!income}
 function updateFixture() {
  const active=envelopeBasis.kind.startsWith('illustrative')||incomeBasis.kind.startsWith('illustrative');
  $('development-fixture').hidden=!active;
  if(active)$('development-fixture').textContent='Illustrative fixture: remaining example inputs were invented for an invented property. Edits and explicit source imports are tracked; the export identifies fields still using invented inputs.';
 }
 function invalidate(kind) {
  if(kind==='development')envelope=null;else income=null;
  $(kind+'-results').replaceChildren();$(kind+'-results').hidden=true;$(kind+'-status').textContent='';updateExport();
 }
 function clear() {
  $('development-form').reset();$('valuation-form').reset();envelopeBasis=manualBasis();incomeBasis=manualBasis();invalidate('development');invalidate('valuation');$('development-fixture').hidden=true;
  $('development-area-basis').textContent='Lot area: Unknown until you enter it or explicitly use source evidence.';$('valuation-basis').textContent='Current NOI has not been supplied. Assessed value is not a market-value input.';
 }
 function metrics(parent,entries) {
  const grid=el('div',undefined,'development-metrics');
  for(const [label,value] of entries){const card=el('div');card.append(el('span',label),el('strong',value));grid.append(card)}parent.append(grid);
 }
 function calculateEnvelope() {
  if(disposed)return;invalidate('development');
  try {
   const output=calculateDevelopmentEnvelope(read('development',envelopeFields));envelope={output,basis:structuredClone(envelopeBasis)};
   const body=$('development-results');body.hidden=false;
   metrics(body,[['Maximum gross area',`${count.format(output.grossAreaSqFt)} ft²`],['Usable area',`${count.format(output.usableAreaSqFt)} ft²`],['Whole units',count.format(output.wholeUnits)],['Construction budget',usd.format(output.constructionBudgetUSD)]]);
   const details=el('details',undefined,'property-source-details');details.append(el('summary','Envelope constraints & budget components'));
   metrics(details,[['FAR area limit',`${count.format(output.farLimitSqFt)} ft²`],['Coverage × stories limit',`${count.format(output.coverageHeightLimitSqFt)} ft²`],['Hard costs',usd.format(output.hardCostUSD)],['Soft costs',usd.format(output.softCostUSD)],['Explicit contingency',usd.format(output.contingencyUSD)],['Residual usable area',`${count.format(output.residualUsableAreaSqFt)} ft²`]]);body.append(details,el('p','Construction budget excludes land, acquisition, financing and operating carry. Area arithmetic does not establish a buildable footprint.','small-note'));
   $('development-status').textContent='Calculated from your assumptions. Zoning dimensional rules remain unverified.';updateExport();
  }catch(error){$('development-status').textContent=error.message||'Check the model assumptions.'}
 }
 function chart(parent,scenarios) {
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 480 250');svg.setAttribute('role','img');svg.setAttribute('aria-label','Income value by user-controlled low, base and high annual NOI growth. Not a confidence interval.');svg.classList.add('value-chart');
  const node=(tag,attrs,text)=>{const n=doc.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));if(text!=null)n.textContent=text;svg.append(n);return n};
  node('title',{},'Income value sensitivity');node('desc',{},'Signed discounted income values in USD. Three user-controlled growth scenarios; all other assumptions fixed.');
  const values=scenarios.map(s=>s.incomeValueUSD),min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,y=value=>28+(max-value)/span*152,baseline=y(0);
  node('line',{x1:52,x2:466,y1:baseline,y2:baseline,stroke:'currentColor','stroke-opacity':'.4','stroke-dasharray':'3 4'});
  node('text',{x:46,y:baseline+4,'text-anchor':'end',fill:'currentColor','font-size':10},'$0');
  scenarios.forEach((scenario,index)=>{
   const x=82+index*130,top=Math.min(y(scenario.incomeValueUSD),baseline),height=Math.abs(y(scenario.incomeValueUSD)-baseline),color=['#74b8b4','#e6b478','#99a7d6'][index];
   const bar=node('rect',{x,y:top,width:72,height,rx:4,fill:color});const title=doc.createElementNS(svg.namespaceURI,'title');title.textContent=`${scenario.label}: ${scenario.growthPct}% growth; ${usd.format(scenario.incomeValueUSD)}`;bar.append(title);
   node('text',{x:x+36,y:scenario.incomeValueUSD>=0?top-8:top+height+15,'text-anchor':'middle',fill:'currentColor','font-size':13,'font-weight':600},compactUsd.format(scenario.incomeValueUSD));
   node('text',{x:x+36,y:216,'text-anchor':'middle',fill:'currentColor','font-size':12},`${scenario.label} · ${scenario.growthPct}%`);
  });parent.append(svg);
 }
 function calculateIncome() {
  if(disposed)return;invalidate('valuation');
  try {
   const output=calculateGrowthSensitivity(read('valuation',incomeFields));income={output,basis:structuredClone(incomeBasis)};
   const body=$('valuation-results'),base=output.scenarios[1];body.hidden=false;
   metrics(body,[['Base income scenario value',usd.format(base.incomeValueUSD)],['Next-year NOI',usd.format(base.nextYearNoiAnnual)],['Discounted operating NOI',usd.format(base.annualNoiPresentValueUSD)],['Discounted net terminal value',usd.format(base.terminalPresentValueUSD)]]);
   chart(body,output.scenarios);body.append(el('p','Low / base / high are your growth scenarios, not confidence bands. All other assumptions are held fixed.','small-note'));
   metrics(body,output.scenarios.map(s=>[`${s.label} growth · ${s.growthPct}%`,usd.format(s.incomeValueUSD)]));
   $('valuation-status').textContent='Deterministic income scenarios. Empirical AI valuation: Not trained.';updateExport();
  }catch(error){$('valuation-status').textContent=error.message||'Check the model assumptions.'}
 }
 for(const kind of ['development','valuation'])listen($(kind+'-form'),'input',event=>{
  invalidate(kind);const basis=kind==='development'?envelopeBasis:incomeBasis;
  if(basis.kind.startsWith('illustrative')){basis.kind='illustrative-modified';basis.illustrativeFields=basis.illustrativeFields.filter(key=>key!==event.target.name)}
  if(kind==='development'&&event.target.id==='development-lotAreaSqFt'&&basis.sourceArea){basis.modifiedSourceArea=true;$('development-area-basis').textContent='Source lot area was edited. The entered area is a modified assumption; the original source is retained in the export.'}
  if(kind==='valuation'&&event.target.id==='valuation-currentNoiAnnual'&&basis.importedScenario){basis.modifiedImportedNoi=true;$('valuation-basis').textContent='Imported NOI was edited. The original rental scenario remains in the export as provenance.'}
  updateFixture();
 });
 listen($('development-form'),'submit',event=>{event.preventDefault();calculateEnvelope()});listen($('valuation-form'),'submit',event=>{event.preventDefault();calculateIncome()});
 listen($('development-reset'),'click',clear);
 listen($('development-use-area'),'click',()=>{
  const e=selected||getEvidence(),p=propertyBrief(e);if(!Number.isFinite(p?.lotAreaSqFt)||p.lotAreaSqFt<=0){notice('Selected source lot area is unknown. Enter an explicit assumption.');return}
  invalidate('development');envelopeBasis={...manualBasis(),kind:envelopeBasis.kind.startsWith('illustrative')?'illustrative-modified':'source-area',sourceArea:p,illustrativeFields:envelopeBasis.illustrativeFields.filter(key=>key!=='lotAreaSqFt')};$('development-lotAreaSqFt').value=String(p.lotAreaSqFt);$('development-area-basis').textContent=`Source lot area: ${count.format(p.lotAreaSqFt)} ft² · parcel ${p.parcelId||'Unknown'}. Other envelope and cost inputs remain your assumptions.`;updateFixture();
 });
 listen($('valuation-use-noi'),'click',()=>{
  const scenario=getScenario();if(!Number.isFinite(scenario?.result?.noiAnnual)){notice('Calculate a rental scenario first, then import its NOI explicitly.');$('valuation-basis').textContent='No valid calculated rental NOI is available.';return}
  invalidate('valuation');incomeBasis={...manualBasis(),kind:incomeBasis.kind.startsWith('illustrative')?'illustrative-modified':'imported-rental-scenario',importedScenario:structuredClone(scenario),illustrativeFields:incomeBasis.illustrativeFields.filter(key=>key!=='currentNoiAnnual')};$('valuation-currentNoiAnnual').value=String(scenario.result.noiAnnual);$('valuation-basis').textContent=`Imported assumption: ${scenario.label||'Rental scenario'} · current annual NOI ${usd.format(scenario.result.noiAnnual)}. This is calculated NOI, not an observed account.`;updateFixture();
 });
 listen($('development-example'),'click',()=>{
  clear();envelopeBasis={...manualBasis(),kind:'illustrative',illustrativeFields:envelopeFields.map(([key])=>key)};incomeBasis={...manualBasis(),kind:'illustrative',illustrativeFields:incomeFields.map(([key])=>key)};
  fill('development',{lotAreaSqFt:10000,far:2,coveragePct:50,stories:3,efficiencyPct:80,averageUnitSqFt:900,hardCostPerGrossSqFt:200,softCostPct:20,contingencyPct:10});
  fill('valuation',{currentNoiAnnual:100000,growthPct:2,discountRatePct:9,terminalCapPct:6,horizonYears:10,exitCostsPct:3,lowGrowthPct:-1,highGrowthPct:4});
  $('development-fixture').textContent='Illustrative fixture: every input is invented for an invented property. These inputs do not describe the selected parcel or current market conditions.';$('development-fixture').hidden=false;
  $('development-area-basis').textContent='Invented lot area; no selected parcel evidence is used.';$('valuation-basis').textContent='Invented current NOI and rates; no observed income or trained model is used.';calculateEnvelope();calculateIncome();
 });
 listen($('development-export'),'click',()=>{
  if(!envelope&&!income)return;
  const illustrative=[envelope,income].filter(Boolean).every(r=>r.basis.kind.startsWith('illustrative')&&!r.basis.sourceArea&&!r.basis.importedScenario);
  const output={schema:MODEL_VERSION,exportedAt:new Date().toISOString(),modelVersion:MODEL_VERSION,validationStatus:VALIDATION_STATUS,selectedProperty:illustrative?null:propertyBrief(selected),envelope:structuredClone(envelope),income:structuredClone(income),limitations:['Zoning dimensional assumptions and legal entitlement are unverified.','Construction budget excludes land, acquisition, financing and operating carry.','Income scenario value is not a verified market value or appraisal.','Growth sensitivity is user controlled, not a confidence interval.','Empirical AI valuation is not trained.']};
  const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'})),anchor=el('a');anchor.href=url;anchor.download='st-louis-development-scenarios.json';anchor.click();urls.set(url,setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url)},1000));
 });
 function setEvidence(evidence) {
  if(disposed)return;const nextId=identity(evidence);if(selectionId!==nextId)clear();selectionId=nextId;selected=evidence||null;
  const p=propertyBrief(selected);$('development-selection').textContent=p?`Selected evidence: ${p.address||'Address unknown'} · parcel ${p.parcelId||'Unknown'}`:'No official parcel selected. You can enter explicit assumptions for a hypothetical property.';
  $('development-use-area').disabled=!Number.isFinite(p?.lotAreaSqFt)||p.lotAreaSqFt<=0;
 }
 setEvidence(getEvidence());
 return {setEvidence,getEnvelopeInputs(){if(disposed)return null;try{return calculateDevelopmentEnvelope(read('development',envelopeFields)).assumptions}catch{return null}},dispose(){if(disposed)return;disposed=true;for(const remove of listeners)remove();for(const [url,timer] of urls){clearTimeout(timer);URL.revokeObjectURL(url)}urls.clear()}};
}
