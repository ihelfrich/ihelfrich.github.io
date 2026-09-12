import {PROPERTY_REGIONS,PROPERTY_REGION_BOUNDS} from '../../lib/property-region-catalog.mjs';
import {ATLAS_METRICS,propertyRegionData,propertyAtlasCsv,validAtlasBounds} from '../../lib/property-region-data.mjs';
const money=v=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(v):'Unknown';
const number=v=>(v||0).toLocaleString();
export function createPropertyRegionPanel(root,{getCity=()=>null,onSelect=()=>{},onLocate=()=>{},onView=()=>{},onActivitySelect=()=>{},data=propertyRegionData}={}){
 const doc=root.ownerDocument;root.className='property-atlas';
 root.innerHTML=`<div class="atlas-heading"><span class="eyebrow">REGIONAL PROPERTY ATLAS</span><h3>Every neighborhood.<br>One view.</h3><p>Explore values and recorded transfers across the entire City and County.</p></div>
 <div class="atlas-jurisdictions" role="group" aria-label="Property geography"><button type="button" data-region="all" aria-pressed="true">City + County</button><button type="button" data-region="st-louis-county" aria-pressed="false">County</button><button type="button" data-region="st-louis-city" aria-pressed="false">City</button></div>
 <label class="atlas-metric">Color the map by<select data-atlas="metric" aria-label="Property map metric"><option value="assessedValueUSD">Assessed value</option><option value="assessorAppraisedValueUSD">County appraised value</option><option value="latestSalePriceUSD">Latest recorded transfer</option></select></label>
 <div data-atlas="time" class="atlas-time" hidden><label>Latest transfer from year<input data-atlas="from" type="number" min="1800" max="2200" step="1" placeholder="Any" /></label><label>Through year<input data-atlas="to" type="number" min="1800" max="2200" step="1" placeholder="Any" /></label><button data-atlas="dates" type="button" class="secondary-button">Apply years</button></div>
 <div class="atlas-status"><strong data-atlas="count">Connecting regional records…</strong><span data-atlas="status" role="status">Loading geographic coverage</span><span data-atlas="vintage"></span></div>
 <div class="atlas-key"><div class="atlas-key-bar"></div><div><span data-atlas="low">Lower</span><span data-atlas="high">Higher</span></div><p data-atlas="legend">Zoom into an area to reveal individual properties.</p></div>
 <div class="atlas-actions"><button data-atlas="search-map" class="secondary-button" type="button">Search this map</button><button data-atlas="reset" class="text-button" type="button">Fit selected region ↗</button></div>
 <p data-atlas="meaning" class="small-note"></p>
 <details class="atlas-results"><summary data-atlas="results-label">Browse mapped areas</summary><p class="small-note" data-atlas="list-note"></p><div data-atlas="list" class="atlas-list"></div><button data-atlas="more" type="button" class="text-button" hidden>Show more results</button><button data-atlas="export" type="button" class="secondary-button" disabled>Export this view · CSV</button></details>
 <details class="atlas-sources"><summary>Coverage, source dates &amp; methods</summary><div data-atlas="sources"></div><p class="small-note">The atlas currently connects St. Louis City and County. Additional U.S. jurisdictions require their own verified data connections; national coverage is not connected.</p></details>`;
 const $=name=>root.querySelector(`[data-atlas="${name}"]`),el=(tag,text)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;return e;};
 let activityFeatures=[],activityLayers=[];
 let jurisdiction='all',metric='assessedValueUSD',fromYear=null,toYear=null,view=null,active=false,started=false,sequence=0,controller=null,lastBounds=null,lastKey='',poll=null,observedKey='',settledTicks=0,listLimit=40,pauseUntil=0,lastScene=null;
 const floating=el('aside');floating.className='atlas-map-key';floating.hidden=true;floating.setAttribute('aria-label','Property map legend');doc.querySelector('#city-app')?.append(floating);
 function fit(bounds){
  getCity()?.fitPropertyAtlasBounds?.(bounds);
  pauseUntil=Date.now()+2000;lastBounds=bounds;
  onLocate({longitude:(bounds[0]+bounds[2])/2,latitude:(bounds[1]+bounds[3])/2,label:jurisdiction==='all'?'ST. LOUIS CITY + COUNTY':PROPERTY_REGIONS.find(r=>r.id===jurisdiction)?.name.toUpperCase()});
 }
 function pick(feature){
  if(feature.kind==='cell'||feature.kind==='activity-cell'){fit(feature.bounds);void refresh(feature.bounds);if(feature.kind==='cell')root.querySelector('.atlas-heading')?.scrollIntoView?.({block:'start'});}
  else{if(feature.kind==='parcel')onSelect(feature);else onActivitySelect(feature);getCity()?.flyToPropertyAtlasFeature?.(feature);pauseUntil=Date.now()+1600;}
 }
 function renderMap(){if(!active||!view)return;const small=doc.defaultView?.innerWidth<=720,features=[...view.features.map(f=>f.kind==='cell'?{...f,pixelSize:small?5:12}:f),...activityFeatures];getCity()?.setPropertyAtlas?.({features,onSelect:pick,domain:view.domain});lastScene=getCity();floating.hidden=false;floating.querySelector('.atlas-activity-legend')?.remove();if(activityLayers.length){const list=el('small');list.className='atlas-activity-legend';for(const layer of activityLayers.filter(l=>l.mappedCount>0)){const row=el('span'),swatch=el('i');swatch.style.backgroundColor=activityFeatures.find(f=>f.layerId===layer.id)?.color||'#b4c6d0';swatch.setAttribute('aria-hidden','true');row.append(swatch,doc.createTextNode(`${layer.label||layer.id}: ${number(layer.mappedCount)}`));list.append(row);}floating.append(list);}}
 function renderList(){
  if(!view)return;
  const sorted=[...view.features].sort((a,b)=>(b.value??-1)-(a.value??-1)||a.id.localeCompare(b.id));$('list').replaceChildren();
  for(const feature of sorted.slice(0,listLimit)){
   const button=el('button');button.type='button';button.className='atlas-result';
   const address=el('strong',feature.kind==='cell'?feature.label:feature.address||`Parcel ${feature.parcelId}`),value=el('span',money(feature.value));
   const detail=el('small',feature.kind==='cell'?`Area mean · ${number(feature.knownCount)} amounts reported · zoom in ↗`:[feature.municipality|| (feature.jurisdiction==='st-louis-city'?'City':'County'),metric==='latestSalePriceUSD'?feature.latestSaleDateISO||'No transfer date':`Source tax year ${feature.taxYear??'not supplied'}`].join(' · '));
   button.append(address,value,detail);button.addEventListener('click',()=>pick(feature));$('list').append(button);
  }
  $('more').hidden=sorted.length<=listLimit;$('list-note').textContent=`${number(Math.min(listLimit,sorted.length))} of ${number(sorted.length)} ${view.level==='areas'?'map areas':'mapped source records'}, ordered by amount. Export includes the entire loaded view.`;
 }
 function renderSources(){
  $('sources').replaceChildren();
  for(const m of view.sources){
   const block=el('section'),heading=el('h4',m.region.name),p=el('p',`${number(m.sourceFeatureCount??m.recordCount??m.tiles.reduce((n,t)=>n+t.count,0))} source records. Retrieved ${(m.source?.retrievedAt||m.retrievedAt||'Unknown').slice(0,10)}. ${m.unlocatedCount?`${number(m.unlocatedCount)} lack usable map locations. `:''}GIS source records are not necessarily unique homes or parcels.`);p.className='small-note';block.append(heading,p);
   const a=el('a','Dataset manifest & provenance');a.href=m.region.manifestUrl;a.target='_blank';a.rel='noopener';block.append(a);
   for(const limitation of m.limitations||[]){const note=el('p',limitation);note.className='small-note';block.append(note);} $('sources').append(block);
  }
  const note=el('p','Annual tax bills, multi-year assessment histories and detailed transfer histories have separate, limited coverage. A mapped record does not mean every underlying document is imported. Open a property for source-specific status and official records.');note.className='small-note';$('sources').append(note);
 }
 async function refresh(bounds=lastBounds||PROPERTY_REGION_BOUNDS){
  if(!validAtlasBounds(bounds))return;const serial=++sequence;controller?.abort();controller=new AbortController();lastBounds=bounds;
  $('status').textContent='Updating the visible area…';root.setAttribute('aria-busy','true');$('export').disabled=true;
  try{
   const result=await data.query({jurisdiction,metric,fromYear,toYear,bounds,signal:controller.signal});if(serial!==sequence)return;view=result;listLimit=40;
   $('count').textContent=`${number(view.count)} source records`;
   $('vintage').textContent=view.sources.map(m=>metric==='latestSalePriceUSD'?`${m.jurisdiction==='st-louis-city'?'City':'County'} latest observed date: ${m.maxObservedLatestTransferDateISO||'See source manifest'}`:m.jurisdiction==='st-louis-city'?'City assessment year not supplied':'County: mostly 2026 source tax year').join(' · ');
   $('status').textContent=view.partial?`Partial coverage${view.unavailable.length?`: ${view.unavailable.join(', ')} unavailable`:''}${view.failedTiles?` · ${view.failedTiles} tiles failed`:''}. Retry with Search this map.`:view.level==='areas'?`${number(view.features.length)} geographic cells · click an area to zoom`:`${number(view.features.length)} individual records · click to inspect`;
   $('low').textContent=money(view.domain[0]);$('high').textContent=money(view.domain[1])+'+';
   $('legend').textContent=`${view.level==='areas'?'Color = mean per geographic cell. Cells touching the view are included.':'Color = amount per source record.'} ${number(view.knownCount)} reported amounts; gray = unknown or unusable. Upper colors cap at the visible 95th percentile.`;
   $('meaning').textContent=ATLAS_METRICS[metric].explanation+ (metric==='latestSalePriceUSD'?' Year filters count records by their latest reported transfer, not every transaction in those years. Zero-price transfers remain zero.':' County tax year and City assessment vintage are not interchangeable.');
   $('results-label').textContent=view.level==='areas'?'Browse mapped areas':'Browse visible properties';$('export').disabled=!view.features.length;
   floating.replaceChildren(el('strong',ATLAS_METRICS[metric].label),el('span',`${money(view.domain[0])} — ${money(view.domain[1])}+`),el('small',`${view.level==='areas'?'Area means':'Individual records'} · gray = unknown${view.partial?' · partial data':''}`));const bar=el('div');bar.className='atlas-key-bar';floating.append(bar);
   renderList();renderSources();renderMap();onView(view);lastKey=bounds.map(n=>n.toFixed(4)).join(',');
  }catch(error){if(serial!==sequence||error.name==='AbortError')return;$('status').textContent=`${error.message} Use Search this map to retry.`;$('count').textContent='Coverage unavailable';view=null;getCity()?.clearPropertyAtlas?.();floating.hidden=true;$('list').replaceChildren();$('more').hidden=true;$('list-note').textContent='';$('results-label').textContent='Results unavailable';$('legend').textContent='No verified map results are available.';}
  finally{if(serial===sequence)root.removeAttribute('aria-busy');}
 }
 const regionBounds=()=>jurisdiction==='all'?PROPERTY_REGION_BOUNDS:PROPERTY_REGIONS.find(r=>r.id===jurisdiction).bounds;
 for(const button of root.querySelectorAll('[data-region]'))button.addEventListener('click',()=>{jurisdiction=button.dataset.region;for(const other of root.querySelectorAll('[data-region]'))other.setAttribute('aria-pressed',String(other===button));fit(regionBounds());void refresh(regionBounds());});
 $('metric').addEventListener('change',()=>{metric=$('metric').value;$('time').hidden=metric!=='latestSalePriceUSD';void refresh();});
 $('dates').addEventListener('click',()=>{const a=$('from').value,b=$('to').value;fromYear=a?Number(a):null;toYear=b?Number(b):null;void refresh();});
 $('search-map').addEventListener('click',()=>{const bounds=getCity()?.getViewportBounds?.();void refresh(validAtlasBounds(bounds)?bounds:lastBounds||regionBounds());});
 $('reset').addEventListener('click',()=>{fit(regionBounds());void refresh(regionBounds());});
 $('more').addEventListener('click',()=>{listLimit+=40;renderList();});
 $('export').addEventListener('click',()=>{if(!view)return;const content=propertyAtlasCsv(view),url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download=`st-louis-${jurisdiction}-${metric}-${view.level}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 function activate(value=true){active=value;if(!value){getCity()?.clearPropertyAtlas?.();floating.hidden=true;return;}if(!started){started=true;void refresh(regionBounds());poll=setInterval(()=>{if(!active||doc.hidden||Date.now()<pauseUntil)return;if(getCity()!==lastScene)renderMap();const bounds=getCity()?.getViewportBounds?.();if(!validAtlasBounds(bounds))return;const key=bounds.map(n=>n.toFixed(4)).join(',');if(key!==observedKey){observedKey=key;settledTicks=0;return;}if(++settledTicks>=1&&key!==lastKey){lastKey=key;void refresh(bounds);}},900);poll.unref?.();}else renderMap();}
 return {activate,start(){activate(true);fit(regionBounds());return refresh(regionBounds());},setActivityLayers(features,layers){activityFeatures=features;activityLayers=layers;renderMap();},focusFeature(feature){pick(feature);},refresh(){renderMap();},focusResults(){root.scrollIntoView?.({block:'start'});$('metric').focus();},dispose(){active=false;sequence++;controller?.abort();clearInterval(poll);getCity()?.clearPropertyAtlas?.();floating.remove();}};
}
