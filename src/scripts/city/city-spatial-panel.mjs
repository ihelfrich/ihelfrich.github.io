import { createSpatialStatistics, SPATIAL_MODEL_VERSION } from '../../lib/city-spatial-statistics.mjs';

const number=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:0}):'Unknown';
const money=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}):'Unknown';
const date=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)):'Unknown';

/** Explicit local analysis; last-good statistics never survive a selection change. */
export function createSpatialPanel(root,{getEvidence=()=>null,onLocate=()=>{},load=createSpatialStatistics()}={}) {
  const doc=root.ownerDocument,section=doc.createElement('section');section.className='spatial-workspace';
  section.innerHTML=`<span class="eyebrow">LOCAL PARCEL EVIDENCE</span><h3>Neighborhood statistics</h3><p id="spatial-selection" class="small-note">Select an exact official City property first.</p><div class="spatial-form"><label>Radius<select id="spatial-radius"><option value="250">250 metres</option><option value="500">500 metres</option></select></label><button id="spatial-run" class="secondary-button" type="button" disabled>Summarize neighborhood</button><button id="spatial-locate" class="text-button" type="button" disabled>Locate center</button></div><p id="spatial-status" class="model-status small-note" role="status">A local source summary, calculated on request.</p><div id="spatial-results"></div>`;
  root.append(section);
  const $=id=>section.querySelector(`#spatial-${id}`),results=$('results'),status=$('status'),run=$('run'),radius=$('radius'),locate=$('locate');
  let evidence=null,generation=0,controller=null,disposed=false;
  const el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node};
  const note=text=>el('p',text,'small-note');
  const usable=e=>Boolean(e?.parcels?.parcel?.properties?.recordKey&&Number.isFinite(e?.point?.longitude)&&Number.isFinite(e?.point?.latitude));
  const metric=(label,value,detail)=>{const item=el('div',undefined,'spatial-metric');item.append(el('span',label,'small-note'),el('strong',value));if(detail)item.append(el('span',detail,'small-note'));return item};
  function render(result) {
    results.replaceChildren();
    const coverage=result.coverage.geographic==='partial-city-coverage'?'Partial geographic coverage: this radius crosses the City boundary. Only the City parcel subset is available.':'Radius falls within City coverage. Counts refer to this dated source snapshot.';
    results.append(note(`${number(result.radiusMeters)} m radius · source polygons intersecting the radius.`),note(coverage));
    const metrics=el('div',undefined,'development-metrics spatial-metrics');
    metrics.append(metric('Source accounts',number(result.counts.sourceRecords),'Distinct exact record keys'),metric('Distinct parcel HANDLEs',number(result.counts.distinctHandles),`${number(result.counts.sharedHandleGroups)} shared HANDLE groups`),metric('Median assessed account value',money(result.assessment.medianUSD),`${number(result.assessment.nonNullAccounts)} known / ${number(result.assessment.unknownAccounts)} unknown accounts`),metric('Median source lot area',result.lotArea.medianSqFt===null?'Unknown':`${number(result.lotArea.medianSqFt)} ft²`,`${number(result.lotArea.nonNullHandles)} agreeing HANDLE groups; ${number(result.lotArea.conflictingHandles)} conflicts excluded`));
    results.append(metrics,note('Assessment year is unknown. Assessed values are account-weighted administrative values; they are not market prices.'),note(`Source lot area: ${number(result.lotArea.nonNullRecords)} nonnull records, ${number(result.lotArea.unknownRecords)} unknown records; ${number(result.lotArea.unknownHandles)} HANDLE groups have no known area. Shared accounts prevent a naive sum of lot areas or assessments.`));
    const frequencies=el('details',undefined,'spatial-frequency');frequencies.append(el('summary','Land-use codes · account frequency'));
    const list=el('ul',undefined,'land-use-frequency');
    for(const item of result.landUseCodes) {
      const row=el('li');row.append(el('span',item.code===null?'Unknown code':`Code ${item.code}`),el('strong',number(item.count)));
      const bar=doc.createElement('meter');bar.min=0;bar.max=Math.max(1,result.counts.sourceRecords);bar.value=item.count;bar.setAttribute('aria-label',`${item.code===null?'Unknown':item.code}: ${item.count} source accounts`);row.append(bar);list.append(row);
    }
    frequencies.append(list,note('Source codes are shown without inferred land-use names. Shared HANDLE accounts remain separate; these are not land-area shares.'));results.append(frequencies);
    if(result.publicInventory.status==='provided-subset')results.append(note(`Supplied LRA subset: ${number(result.publicInventory.matchedSourceRecords)} matching source accounts, ${number(result.publicInventory.matchedHandles)} HANDLEs and ${number(result.publicInventory.matchedListingRecords)} listing records. Matched on HANDLE and ParcelId. Snapshot retrieved ${date(result.publicInventory.retrievedAt)}. Private availability is unknown.`));
    else results.append(note('Neighborhood LRA subset comparison unavailable: no full public inventory snapshot was supplied. Private availability is unknown.'));
    if(result.excluded.invalidGeometryCandidates)results.append(note(`${number(result.excluded.invalidGeometryCandidates)} candidate records excluded for invalid source geometry. Their radius membership cannot be confirmed; counts describe the usable geometry subset.`));
    const method=el('details',undefined,'spatial-source-details');method.append(el('summary','Source, method & limits'));
    method.append(note(`Parcel snapshot retrieved ${date(result.source?.retrievedAt)}. Catalog publication ${result.source?.catalogPublishedAt||'Unknown'}. Calculation ${date(result.computedAt)} does not update the source.`),note(result.coverage.geometryPolicy),note('Local equirectangular projection centered on the selected point, Earth radius 6,371,008.8 m. Polygon holes are honored. GIS geometry is not a legal survey.'),note('Every intersecting source tile must load. Limit: 12 tiles, 15 MB measured response bytes, 5,000 matched source accounts. Exceeding a limit produces no partial calculation.'),note(`Model ${SPATIAL_MODEL_VERSION}. Deterministic descriptive statistics; no transaction-price, price-growth, demographic or entitlement inference.`));
    if(result.transport)method.append(note(`${number(result.transport.tiles)} geometry tiles · ${(result.transport.bytes/1_000_000).toFixed(2)} MB read including manifest.`));
    const sourceUrl=result.source?.catalogUrl||result.source?.url;
    if(typeof sourceUrl==='string'&&/^https:\/\/(?:(?:www|maps8)\.)?stlouis-mo\.gov\//.test(sourceUrl)) {const link=el('a','Official City parcel source');link.href=sourceUrl;link.target='_blank';link.rel='noopener noreferrer';method.append(link);}
    for(const limitation of result.sourceLimitations||[])method.append(note(limitation));results.append(method);
  }
  function setEvidence(next) {
    generation++;controller?.abort();controller=null;evidence=next;results.replaceChildren();
    const selected=usable(evidence);run.disabled=!selected;locate.disabled=!selected;radius.disabled=false;
    $('selection').textContent=selected?`${evidence.parcels.parcel.properties.address||'Selected source property'} · Radius centered on the selected map coordinate.`:'Select an exact official City property first.';
    status.textContent=selected?'Choose a radius and calculate its source summary.':'A local source summary, calculated on request.';
  }
  async function calculate() {
    if(disposed||!usable(evidence))return;
    const current=++generation;controller?.abort();controller=new AbortController();const selected=evidence;
    results.replaceChildren();run.disabled=true;status.textContent='Loading intersecting parcel tiles within the bounded local request…';
    try {
      const result=await load(selected.point,{radiusMeters:Number(radius.value),signal:controller.signal,inventorySnapshot:selected.inventorySnapshot||null});
      if(disposed||current!==generation)return;
      if(result?.status!=='complete')throw new Error('Source summary is incomplete.');
      render(result);status.textContent=`Completed ${number(result.counts.sourceRecords)} source accounts. ${result.excluded.invalidGeometryCandidates?'Invalid geometry candidates were excluded.':'All requested tiles loaded.'}`;
    } catch(error) {if(!disposed&&current===generation){results.replaceChildren();status.textContent=error?.name==='AbortError'?'Local request cancelled or timed out. No partial summary was calculated.':`${error?.message||'Source summary unavailable.'} No partial summary was calculated.`;}}
    finally {if(!disposed&&current===generation)run.disabled=!usable(evidence);}
  }
  const changeRadius=()=>{generation++;controller?.abort();controller=null;results.replaceChildren();run.disabled=!usable(evidence);status.textContent='Radius changed. Recalculate the local source summary.';};
  const locateCenter=()=>{if(usable(evidence))onLocate({...evidence.point,label:evidence.parcels.parcel.properties.address||'Selected property'});};
  run.addEventListener('click',calculate);radius.addEventListener('change',changeRadius);locate.addEventListener('click',locateCenter);setEvidence(getEvidence());
  return {setEvidence,dispose(){disposed=true;generation++;controller?.abort();run.removeEventListener('click',calculate);radius.removeEventListener('change',changeRadius);locate.removeEventListener('click',locateCenter);}};
}
