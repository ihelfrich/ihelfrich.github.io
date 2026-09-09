import {searchParcels} from '../../lib/city-parcels.mjs';
import {createPropertyLookup} from '../../lib/city-property-context.mjs';
import {loadPublicListings} from '../../lib/city-public-listings.mjs';
import {inventoryView} from '../../lib/city-inventory-view.mjs';

const ORIGIN=[-90.193,38.628], METRES=111195, X_SCALE=METRES*Math.cos(ORIGIN[1]*Math.PI/180);
const validPoint=p=>p&&Number.isFinite(p.longitude)&&Number.isFinite(p.latitude)&&Math.abs(p.longitude)<=180&&Math.abs(p.latitude)<=90;
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const date=value=>value!=null&&value!==''&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'Unknown';

/** Native controls alongside the existing estate panel; public/import marker channels stay separate. */
export function createPropertyPanel(root,{
  estate,getCity=()=>null,notice=()=>{},onOpen=()=>{},onPublicMarkers=()=>{},
  search=searchParcels,lookup:providedLookup=null,inventoryLoader=loadPublicListings,debounceMs=250,
}={}) {
  const doc=root.ownerDocument,section=doc.createElement('section');section.className='estate-source';
  section.innerHTML=`
    <details open><summary>Address & official property evidence</summary>
      <p class="small-note">Search City parcel addresses or select a map location. County parcel boundaries are not connected here.</p>
      <div class="estate-filters"><label>City address<input id="property-search" type="search" placeholder="Enter at least 3 characters" autocomplete="off" /></label></div>
      <p id="property-search-status" class="small-note" role="status">Enter at least 3 characters to search.</p>
      <div id="property-search-results" class="estate-list"></div>
      <div id="property-evidence" aria-live="polite"></div>
    </details>
    <details><summary>Available public LRA inventory</summary>
      <p class="small-note">Official land-bank inventory. This is not complete market coverage. Asking prices may be unknown; availability needs confirmation with the source.</p>
      <div class="estate-filters"><label>Address, parcel or use<input id="property-public-query" type="search" placeholder="Filter public inventory" /></label><label>Distance from map center<select id="property-public-radius"><option value="2000">Within 2 km</option><option value="5000">Within 5 km</option><option value="0">All available locations</option></select></label></div>
      <div class="button-row"><button id="property-public-load" class="secondary-button" type="button">Load available inventory</button><button id="property-public-map" class="secondary-button" type="button">Map public inventory</button><button id="property-public-clear" class="text-button" type="button" disabled>Hide public markers</button></div>
      <p id="property-public-status" class="small-note" role="status">Public inventory has not been loaded.</p>
      <p id="property-public-counts" class="small-note"></p><div id="property-public-source" class="small-note"></div>
      <div id="property-public-list" class="estate-list"></div>
    </details>`;
  root.prepend(section);
  const $=id=>section.querySelector('#property-'+id),details=section.querySelector('details');
  const element=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
  const paragraph=(parent,text)=>parent.append(element('p',text,'small-note'));
  function link(parent,label,value) {
    if(typeof value!=='string')return;
    try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return;const a=element('a',label);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a,doc.createTextNode(' · '));}catch{}
  }
  function sourceInfo(parent,source,label='Source') {
    const p=element('p',undefined,'small-note');
    link(p,label,source?.sourceUrl||source?.url);link(p,'Catalog',source?.catalogUrl);link(p,'Terms',source?.termsUrl);
    p.append(doc.createTextNode(`Retrieved: ${date(source?.retrievedAt)}. Source update: ${date(source?.sourceUpdatedAt||source?.sourceDate)}.`));
    if(source?.catalogPublishedAt)p.append(doc.createTextNode(` Catalog published: ${date(source.catalogPublishedAt)}.`));
    parent.append(p);
  }
  let inventoryPromise=null;
  const getInventory=()=>inventoryPromise ||= Promise.resolve(inventoryLoader()).catch(error=>{inventoryPromise=null;throw error});
  const lookup=providedLookup||createPropertyLookup({inventoryLoader:getInventory});
  let generation=0,controller=null,selectedParcel=null,searchGeneration=0,searchTimer=null;
  let inventoryGeneration=0,inventorySnapshot=null,overlayEnabled=false;
  function clearSelection() {
    generation++;controller?.abort();controller=null;selectedParcel=null;
    getCity()?.setParcel?.(null);$('evidence').replaceChildren();
    paragraph($('evidence'),'No parcel selected. Search an address or select a location to inspect official evidence.');
  }
  function pointIdentityMatches(properties,point) {
    return properties&&(!point.recordKey||properties.recordKey===point.recordKey)&&(!point.parcelKey||properties.parcelKey===point.parcelKey)&&(!point.parcelId||properties.parcelId===point.parcelId);
  }
  function renderEvidence(evidence) {
    const body=$('evidence');body.replaceChildren();
    const parcels=evidence.parcels||{},p=parcels.parcel?.properties,z=evidence.zoning||{},sale=evidence.inventory||{};
    body.append(element('h3',p?.address||'Selected location'));
    if(p) {
      const dl=element('dl');
      for(const [label,value] of [
        ['Parcel ID',p.parcelId||'Unknown'],['Exact source record',p.recordKey||'Unknown'],
        ['Lot area',Number.isFinite(p.areaSqFt)?`${p.areaSqFt.toLocaleString()} sq ft`:'Unknown'],
        ['Assessed value',Number.isFinite(p.assessedValueUSD)?usd.format(p.assessedValueUSD):'Unknown'],
        ['Assessment year',p.assessmentYear??'Unknown'],['Source record date',date(p.sourceRecordDate)],
      ]){const row=element('div');row.append(element('dt',label),element('dd',String(value)));dl.append(row)}
      body.append(dl);paragraph(body,'Assessed value is not an asking price or a verified market value. GIS boundaries are not a legal survey.');
    } else {
      paragraph(body,parcels.reason==='requested-source-unresolved'
        ?'The supplied source parcel was not resolved at this coordinate. A public inventory centroid can fall outside its parcel; search the address or choose an exact matching source record.'
        :parcels.ambiguous?'Several source records intersect this point. Choose the exact record before treating it as a selected parcel.'
        :parcels.status==='unsupported'?'Parcel coverage is unavailable outside the City of St. Louis.'
        :parcels.status==='not-found'?'No source parcel was resolved here; parcel identity and ownership remain unknown.'
        :'Parcel evidence is unavailable or unknown for this location.');
      for(const candidate of parcels.candidates||[]) {
        const cp=candidate.properties;if(!cp?.recordKey)continue;
        const button=element('button',`${cp.address||'Address unknown'} · parcel ${cp.parcelId||'Unknown'} · record ${cp.recordKey}`,'estate-listing');button.type='button';button.dataset.recordKey=cp.recordKey;
        button.addEventListener('click',()=>void inspectPoint({...evidence.point,recordKey:cp.recordKey,parcelKey:cp.parcelKey,parcelId:cp.parcelId}));body.append(button);
      }
    }
    sourceInfo(body,parcels.source,'Official parcel source');link(body,'Official parcel lookup',parcels.officialLookupUrl);
    body.append(element('h4','Zoning at this point'));
    paragraph(body,`Jurisdiction: ${z.jurisdiction?.label||'Unknown'}.`);
    if(z.status==='unsupported-municipality')paragraph(body,'This municipality’s zoning rules are not connected. County zoning cannot be substituted.');
    else if(['unavailable','outside-coverage','unknown'].includes(z.status)||!z.status)paragraph(body,'Zoning coverage is unavailable or not established for this location.');
    if(z.districts?.length)for(const district of z.districts)paragraph(body,`District: ${district.code||'Unknown'} · ${district.label||'Unknown district name'}.`);
    else paragraph(body,'Zoning district: Unknown.');
    if(z.status==='ambiguous')paragraph(body,'Multiple zoning districts were reported; no single district is assumed.');
    if(z.overlays?.length)for(const overlay of z.overlays){paragraph(body,`Overlay: ${overlay.label||'Unknown'} · ${overlay.type||'Type unknown'} · ordinance ${overlay.ordinance||'Unknown'} · source date ${date(overlay.sourceDate)}.`);link(body,'Official overlay source',overlay.sourceUrl)}
    else paragraph(body,z.overlayStatus==='none-reported'?'No overlays reported at this point.':'Overlay coverage: unavailable or unknown.');
    paragraph(body,`Legal effective date: ${date(z.effectiveDate)}. ${z.complete?'':'Source coverage is incomplete. '}District labels do not establish development permission or zoning across the whole parcel.`);
    link(body,'Zoning code',z.codeUrl);link(body,'Official zoning map',z.mapUrl);
    for(const source of z.sources||[])sourceInfo(body,source,source.sourceId||'Zoning source');
    body.append(element('h4','Public sale evidence'));
    if(sale.status==='matched') {
      paragraph(body,`${sale.listings?.length||0} matching public LRA inventory record(s). Confirm availability with LRA. Asking price: Unknown unless explicitly published by the source.`);
      for(const listing of sale.listings||[])link(body,'Official sale record',listing.sourceUrl);
      sourceInfo(body,{...sale.source,retrievedAt:sale.retrievedAt},'Public inventory source');
    } else paragraph(body,(sale.reason?sale.reason+' ':'')+'Private sale status and asking price are unknown. Absence from public LRA inventory does not establish that a property is unavailable.');
    body.scrollIntoView?.({block:"start",behavior:"auto"});
  }
  async function inspectPoint(input) {
    if(!validPoint(input)){notice('A valid map coordinate is required for property evidence.');return null}
    const point={longitude:input.longitude,latitude:input.latitude};
    for(const key of ['recordKey','parcelKey','parcelId'])if(typeof input[key]==='string')point[key]=input[key];
    if(Number.isFinite(input.height))point.height=input.height;
    // Estate reset can synchronously call clearSelection; establish our request afterward.
    estate.selectPoint(point);const serial=++generation;controller?.abort();const request=new AbortController();controller=request;
    selectedParcel=null;getCity()?.setParcel?.(null);onOpen();details.open=true;
    $('evidence').replaceChildren();paragraph($('evidence'),'Loading official parcel, zoning and public inventory evidence…');
    try {
      let result=await lookup(point,{signal:request.signal});if(serial!==generation||request.signal.aborted)return null;
      const requested=result.parcels?.parcel?.properties;
      if(requested&&!pointIdentityMatches(requested,point)) {
        result={...result,parcels:{...result.parcels,parcel:null,candidates:(result.parcels.candidates||[]).filter(c=>pointIdentityMatches(c.properties,point)),reason:'requested-source-unresolved'},inventory:{status:'unresolved',listings:[],reason:'The supplied inventory parcel is unresolved at this coordinate.'}};
      }
      result={...result,point:{...point}};
      if(estate.setPropertyEvidence(result)===false){clearSelection();return null}
      selectedParcel=result.parcels?.parcel||null;getCity()?.setParcel?.(selectedParcel);renderEvidence(result);return result;
    } catch {
      if(serial!==generation||request.signal.aborted)return null;
      const failed={point,parcels:{status:'unavailable',parcel:null},zoning:{status:'unavailable',districts:[],overlays:[]},inventory:{status:'unavailable',listings:[]}};
      estate.setPropertyEvidence(failed);renderEvidence(failed);return failed;
    }
  }
  async function runSearch(query,serial) {
    $('search-status').textContent='Searching City parcel addresses…';
    try {
      const rows=await search(query,{limit:12});if(serial!==searchGeneration)return;
      $('search-results').replaceChildren();$('search-status').textContent=rows.length?`${rows.length} matching City addresses. Choose an exact source record.`:'No matching City addresses in this index. County addresses are not included.';
      for(const row of rows) {
        const button=element('button',undefined,'estate-listing');button.type='button';button.append(element('strong',row.address||'Address unknown'),element('small',`Parcel ${row.parcelId||'Unknown'} · record ${row.recordKey||'Unknown'}`));
        button.addEventListener('click',()=>{void inspectPoint(row);getCity()?.flyTo?.((row.longitude-ORIGIN[0])*X_SCALE,-(row.latitude-ORIGIN[1])*METRES,3)});$('search-results').append(button);
      }
      if(rows[0]?.source)sourceInfo($('search-results'),rows[0].source,'Address index source');
    } catch {if(serial===searchGeneration){$('search-results').replaceChildren();$('search-status').textContent='City parcel address search is unavailable. Select a map point or retry.'}}
  }
  $('search').addEventListener('input',()=>{
    const query=$('search').value.trim(),serial=++searchGeneration;clearTimeout(searchTimer);$('search-results').replaceChildren();
    if(query.length<3){$('search-status').textContent='Enter at least 3 characters to search.';return}
    $('search-status').textContent='Waiting to search…';searchTimer=setTimeout(()=>void runSearch(query,serial),debounceMs);
  });
  function center() {
    const target=getCity()?.controls?.target;if(!Number.isFinite(target?.x)||!Number.isFinite(target?.z))return null;
    const point={longitude:ORIGIN[0]+target.x/X_SCALE,latitude:ORIGIN[1]-target.z/METRES};return validPoint(point)?point:null;
  }
  function choosePublic(record) {
    if(!validPoint(record)){notice('This public record has no usable map coordinate.');return}
    void inspectPoint({longitude:record.longitude,latitude:record.latitude,parcelKey:record.parcelKey,parcelId:record.parcelId});
    getCity()?.flyTo?.((record.longitude-ORIGIN[0])*X_SCALE,-(record.latitude-ORIGIN[1])*METRES,3);
  }
  function renderInventory() {
    if(!inventorySnapshot)return;
    const source=$('public-source');source.replaceChildren();sourceInfo(source,{...inventorySnapshot.source,retrievedAt:inventorySnapshot.retrievedAt,sourceUpdatedAt:inventorySnapshot.sourceUpdatedAt},'Official LRA inventory');
    paragraph(source,`Retrieval freshness: ${inventorySnapshot.snapshotStatus||'Unknown'}. Source record-update dates and asking prices are not supplied. Parcel-centroid markers do not establish exact parcel identity.`);
    $('public-list').replaceChildren();const point=center();
    if(!point){$('public-status').textContent='Map center unavailable. Open the map to filter public inventory.';$('public-counts').textContent='Matching and mapped counts: Unknown.';if(overlayEnabled)onPublicMarkers([],choosePublic);return}
    const view=inventoryView(inventorySnapshot.listings,{point,query:$('public-query').value,radiusMeters:Number($('public-radius').value),markerLimit:250});
    const mapped=overlayEnabled?view.markers.length:0;
    $('public-counts').textContent=`${view.matchingCount.toLocaleString()} matching locations · ${mapped.toLocaleString()} markers on map (250 maximum) · ${view.unknownPriceCount.toLocaleString()} asking prices unknown. ${view.pricedCount?`Published asking total: ${usd.format(view.knownAskingVolumeUSD)}.`:'Published asking total: Unknown.'}`;
    const withoutCoordinates=inventorySnapshot.listings.filter(l=>!validPoint(l)).length;
    $('public-status').textContent=`${inventorySnapshot.listings.length.toLocaleString()} records in the public snapshot. ${view.records.length} rows shown. ${overlayEnabled?view.hiddenMarkerCount.toLocaleString()+' matching locations exceed the marker budget.':'Public markers are hidden.'}${withoutCoordinates?' '+withoutCoordinates+' records have unknown coordinates and cannot enter this spatial filter.':''}`;
    for(const {listing,distance} of view.records) {
      const button=element('button',undefined,'estate-listing');button.type='button';button.append(element('strong',listing.address||'Address unknown'),element('small',`${listing.usage||listing.propertyType||'Use unknown'} · ${Math.round(distance).toLocaleString()} m from center · ${Number.isFinite(listing.askingPrice)&&listing.askingPrice>0?usd.format(listing.askingPrice):'Asking price unknown'}`));button.addEventListener('click',()=>choosePublic(listing));$('public-list').append(button);
    }
    if(overlayEnabled)onPublicMarkers(view.markers,choosePublic);
  }
  async function loadInventory(map=false) {
    const serial=++inventoryGeneration;if(map){overlayEnabled=true;$('public-clear').disabled=false}
    $('public-map').disabled=true;$('public-load').disabled=true;$('public-status').textContent='Loading the dated official public inventory…';
    try{const snapshot=await getInventory();if(serial!==inventoryGeneration)return;inventorySnapshot=snapshot;renderInventory()}
    catch{if(serial!==inventoryGeneration)return;overlayEnabled=false;onPublicMarkers([],choosePublic);$('public-clear').disabled=true;$('public-status').textContent='Public inventory unavailable. No empty or zero-price inventory has been inferred.'}
    finally{if(serial===inventoryGeneration){$('public-map').disabled=false;$('public-load').disabled=false}}
  }
  $('public-load').addEventListener('click',()=>void loadInventory());
  $('public-map').addEventListener('click',()=>void loadInventory(true));
  $('public-clear').addEventListener('click',()=>{inventoryGeneration++;overlayEnabled=false;onPublicMarkers([],choosePublic);$('public-clear').disabled=true;$('public-map').disabled=false;$('public-load').disabled=false;if(inventorySnapshot)renderInventory();else $('public-status').textContent='Public markers are hidden. Load inventory to update the list.'});
  $('public-query').addEventListener('input',renderInventory);$('public-radius').addEventListener('change',renderInventory);
  clearSelection();
  return {inspectPoint,clearSelection,refreshMarkers(){getCity()?.setParcel?.(selectedParcel);if(inventorySnapshot)renderInventory();if(!overlayEnabled)onPublicMarkers([],choosePublic)}};
}
