import {PROPERTY_MAP_LAYERS,PROPERTY_MAP_LAYER_GROUPS,propertyRecordGeoJSON,mapLayerDetail,propertyFeatureBounds} from '../../lib/property-map-layer-catalog.mjs';
import {createPropertyWorkspaceData} from '../../lib/property-workspace-data.mjs';
import {createPropertyInfrastructureData} from '../../lib/property-infrastructure-data.mjs';
import {PROPERTY_REGION_BOUNDS} from '../../lib/property-region-catalog.mjs';
import {validAtlasBounds} from '../../lib/property-region-data.mjs';

const count=n=>Number.isFinite(n)?n.toLocaleString():'Unknown';
const sameBounds=(a,b)=>validAtlasBounds(a)&&validAtlasBounds(b)&&a.every((v,i)=>Math.abs(v-b[i])<.0001);
const geometryMeaning={
  'source-point':'Location published by the source.',
  'source-line':'Path published by the source; no engineering alignment or depth is implied.',
  'source-project-corridor':'Published project corridor; construction status must be checked in the source.',
  'source-polygon-outline':'Boundary published by the source; no parcel relationship is implied.',
};
export function createMapLayersPanel(root,{getCity=()=>null,onOpen=()=>{},onInspect=()=>{},onModel=()=>{},onActivity=()=>{},onSite=()=>{},
  evidence=createPropertyWorkspaceData(),infrastructure=createPropertyInfrastructureData(),pollMs=1000}={}){
  const doc=root.ownerDocument,win=doc.defaultView;
  const make=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  root.innerHTML=`<div class="map-layers-heading"><h2>Layers</h2><p>Build your view of the city. Keep several sources on the map at once.</p></div>
    <div class="map-layer-presets" role="group" aria-label="Layer combinations"><button type="button" data-map-layers="infrastructure" class="secondary-button">Utilities & works</button><button type="button" data-map-layers="development" class="secondary-button">Development</button><button type="button" data-map-layers="clear" class="text-button">Clear</button></div>
    <div class="map-layer-toolbar"><span data-map-layers="count">No data layers on</span><button type="button" data-map-layers="refresh" class="text-button">Refresh this area</button></div>
    <p data-map-layers="status" class="small-note" role="status">Turn on a layer below. Data loads for the visible area.</p>
    <section data-map-layers="detail" class="map-layer-inspector" tabindex="-1" hidden></section>
    <div data-map-layers="catalog"></div>
    <section class="map-layer-model"><h3>Buildings & models</h3><p class="small-note">The open map shows mapped building shapes and interpreted heights. IFC models add actual building elements when a model is available.</p><button type="button" data-map-layers="model" class="secondary-button">Open building model</button><button type="button" data-map-layers="site" class="text-button">Terrain & site evidence</button></section>
    <details class="map-layer-coverage"><summary>Coverage & model limits</summary><p>Water-service materials cover St. Louis City. Street lights and capital projects use City publications; MoDOT bridges are currently a source reference only. County water mains, sewer pipes, gas lines and fiber routes are not connected.</p><p>A provider’s service area does not locate its wires or pipes. A project corridor does not establish completed construction. All overlays use a map plane; buried depths and engineering alignment are not supplied.</p><p>Coverage is St. Louis City and County. U.S. expansion requires verified sources for each jurisdiction. Building schematics and IFC models must be supplied separately; public footprints cannot reveal interiors.</p><button type="button" data-map-layers="activity" class="text-button">Open evidence & provider resources</button></details>`;
  const $=key=>root.querySelector(`[data-map-layers="${key}"]`),selected=new Set(),opacity=new Map(),rows=new Map(),results=new Map();
  const legend=make('aside',null,'map-layer-key atlas-map-key');legend.setAttribute('aria-label','Additional map layers');legend.hidden=true;doc.querySelector('#city-app')?.append(legend);
  let disposed=false,started=false,serial=0,controller=null,timer=null,lastBounds=null,lastMap=null,rendered=[],lastTrigger=null;
  const polling=setInterval(()=>{
    if(disposed||!started||doc.hidden||!selected.size)return;
    const map=getCity();if(map!==lastMap)render();
    const bounds=map?.getViewportBounds?.();if(validAtlasBounds(bounds)&&!sameBounds(bounds,lastBounds)){clearTimeout(timer);lastBounds=[...bounds];timer=setTimeout(()=>void refresh(bounds),250);}
  },pollMs);polling.unref?.();
  function external(parent,text,url){try{const value=new URL(url);if(!['https:','http:'].includes(value.protocol)||value.username||value.password)return;const a=make('a',text);a.href=value.href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}catch{}}
  function closeDetail(){const restore=$('detail').contains(doc.activeElement);$('detail').hidden=true;$('detail').replaceChildren();if(restore)(lastTrigger?.isConnected?lastTrigger:$('refresh')).focus({preventScroll:true});}
  function renderLegend(){
    legend.replaceChildren();legend.hidden=!selected.size;if(!selected.size)return;
    const open=make('button',`${selected.size} map ${selected.size===1?'layer':'layers'} on`,'text-button');open.type='button';open.addEventListener('click',onOpen);legend.append(open);
    for(const def of PROPERTY_MAP_LAYERS.filter(d=>selected.has(d.id)).slice(0,4)){const line=make('span'),dot=make('i');dot.style.background=def.color||'#b8d6e4';line.append(dot,doc.createTextNode(def.label));legend.append(line);}
    if(selected.size>4)legend.append(make('small',`+${selected.size-4} more · open Layers`));
  }
  function render(){
    renderLegend();const map=getCity();lastMap=map;
    if(!selected.size){map?.clearMapLayers?.();rendered=[];return;}
    rendered=PROPERTY_MAP_LAYERS.filter(def=>selected.has(def.id)).map(def=>({id:def.id,color:def.color||'#b8d6e4',opacity:opacity.get(def.id)??.85,
      features:(results.get(def.id)?.features||[]).map(propertyRecordGeoJSON).filter(Boolean)}));
    if(!map?.setMapLayers){$('status').textContent='Layers are loaded; waiting for the map renderer.';return;}
    let state;try{state=map.setMapLayers({layers:rendered,onSelect:(feature,id)=>{onOpen();openRecord(feature.properties.record,id);}});}catch{$('status').textContent='The overlay could not render. Refresh this area to retry.';return;}
    for(const layer of state?.layers||[])if(layer.omitted||layer.invalid||layer.unsupported)setRowStatus(layer.id,`${count(results.get(layer.id)?.source?.count)} source records · ${count(layer.shown)} drawn · zoom in for more detail`);
    const omitted=state?.omitted||0,invalid=(state?.invalid||0)+(state?.unsupported||0);
    const unavailable=[...selected].filter(id=>!results.has(id)||results.get(id)?.source?.status==='unavailable').length;
    $('status').textContent=omitted||invalid?`${count(omitted)} features exceed the display budget; ${count(invalid)} geometries could not be drawn. Zoom in for more detail.`:
      unavailable?`${unavailable} selected sources are unavailable. Check each layer below; Refresh retries the request.`:!state?.shown?'No map features in this area. Check layer coverage below.':'Colors identify sources. Selected layers stay on as you move between tools.';
  }
  function setRowStatus(id,summary){const row=rows.get(id);if(row)row.status.textContent=summary;}
  function updateControls(){
    $('count').textContent=selected.size?`${selected.size} data ${selected.size===1?'layer':'layers'} on`:'No data layers on';
    for(const [id,row] of rows){const enabled=selected.has(id);row.input.checked=enabled;row.opacity.disabled=!enabled;row.browse.disabled=!enabled||!results.get(id)?.features?.length;row.container.classList.toggle('is-on',enabled);if(!enabled)row.status.textContent=row.input.disabled?'Source reference · not mapped':'Off';}
  }
  function inspectRow(record,id){
    if(record.kind==='activity-cell'&&validAtlasBounds(record.bounds)){getCity()?.fitPropertyAtlasBounds?.(record.bounds);void refresh(record.bounds);return;}
    openRecord(record,id);
  }
  function openRecord(record,id){
    const body=$('detail'),def=PROPERTY_MAP_LAYERS.find(l=>l.id===id);body.replaceChildren();body.hidden=false;
    const back=make('button','Back to layers','text-button');back.type='button';back.addEventListener('click',closeDetail);body.append(back,make('p',def?.label||id,'map-layer-origin'),make('h3',record.title||record.address||record.ownerName||record.id));
    body.append(make('p',record.kind==='activity-cell'?`${count(record.count)} source records grouped in this area.`:geometryMeaning[record.geometryRole]||def?.meaning||'Source geometry; no parcel relationship is implied.','small-note'));
    for(const [label,value] of [['Address',record.address],['Observed name',record.ownerName],['Source date',record.date||'Not supplied'],['Retrieved',record.retrievedAt]])if(value)body.append(make('p',`${label}: ${value}`,'small-note'));
    external(body,'Open source',record.sourceURL||record.sourceUrl||def?.sourceURL);
    if(record.kind==='activity-cell'&&validAtlasBounds(record.bounds)){
      const drill=make('button','Zoom into these records','secondary-button');drill.type='button';drill.addEventListener('click',()=>{getCity()?.fitPropertyAtlasBounds?.(record.bounds);closeDetail();void refresh(record.bounds);});body.append(drill);
    }else if(Number.isFinite(record.longitude)&&Number.isFinite(record.latitude)){
      const zoom=make('button','Zoom to this feature','secondary-button');zoom.type='button';zoom.addEventListener('click',()=>{const bounds=validAtlasBounds(record.bounds)?record.bounds:propertyFeatureBounds(record);if(!validAtlasBounds(bounds))return;getCity()?.fitPropertyAtlasBounds?.(bounds);closeDetail();void refresh(bounds);});body.append(zoom);
      const inspect=make('button','Inspect nearby parcels','secondary-button');inspect.type='button';inspect.addEventListener('click',()=>onInspect({longitude:record.longitude,latitude:record.latitude,address:record.address}));body.append(inspect);
      body.append(make('p','The location is supplied by this source. A matching parcel or utility connection has not been established.','small-note'));
    }
    const original=make('details');original.append(make('summary','Source attributes'));
    const source=record.original||record,attributes=source.attributes&&typeof source.attributes==='object'?{...source.attributes,'Source record ID':source.sourceObjectId,'Source layer ID':source.sourceLayerId}:source;
    const fields=make('dl',null,'map-layer-fields');for(const [key,value] of Object.entries(attributes).filter(([key])=>!['geometry','coordinates'].includes(key)).slice(0,70)){
      fields.append(make('dt',key),make('dd',typeof value==='object'?JSON.stringify(value)?.slice(0,600):String(value??'Not supplied')));
    }original.append(fields);body.append(original);back.focus({preventScroll:true});body.scrollIntoView?.({block:'start'});
  }
  function browse(id,trigger){
    const data=results.get(id);if(!data)return;lastTrigger=trigger;const body=$('detail');body.replaceChildren();body.hidden=false;
    const back=make('button','Back to layers','text-button');back.type='button';back.addEventListener('click',closeDetail);body.append(back,make('h3',PROPERTY_MAP_LAYERS.find(l=>l.id===id)?.label||id));
    body.append(make('p',`${count(data.features.length)} loaded map features. Showing the first 50; use the map to narrow the area.`,'small-note'));
    for(const record of data.features.slice(0,50)){const button=make('button',record.title||record.address||record.ownerName||`${count(record.count)} source records`,'map-layer-record');button.type='button';button.addEventListener('click',()=>inspectRow(record,id));body.append(button);}
    back.focus({preventScroll:true});body.scrollIntoView?.({block:'start'});
  }
  for(const group of PROPERTY_MAP_LAYER_GROUPS){
    const section=make('section',null,'map-layer-group');section.append(make('h3',group.label));
    for(const def of PROPERTY_MAP_LAYERS.filter(d=>d.group===group.id)){
      const container=make('article',null,'map-layer-row'),label=make('label',null,'map-layer-toggle'),input=make('input');input.type='checkbox';input.value=def.id;input.dataset.layerToggle=def.id;input.disabled=def.available===false;
      const swatch=make('i');swatch.style.background=def.color||'#b8d6e4';swatch.setAttribute('aria-hidden','true');label.append(input,swatch,make('span',def.label));
      const status=make('p',def.available===false?'Source reference · not mapped':'Off','map-layer-state');status.setAttribute('role','status');
      const disclosure=make('details',null,'map-layer-options');disclosure.append(make('summary','Details & display'),make('p',def.coverage||'See the originating source.','small-note'),make('p',def.meaning||'Source geometry; no parcel relationship is implied.','small-note'));
      if(def.reason)disclosure.append(make('p',def.reason,'small-note'));external(disclosure,'Open official source',def.sourceURL);
      const metadata=make('div',null,'map-layer-source-metadata');disclosure.append(metadata);
      const opacityLabel=make('label','Opacity','map-layer-opacity'),slider=make('input');slider.type='range';slider.min='.15';slider.max='1';slider.step='.05';slider.value='.85';slider.disabled=true;slider.setAttribute('aria-label',`${def.label} opacity`);opacityLabel.append(slider);disclosure.append(opacityLabel);
      const browseButton=make('button','Browse loaded features','text-button');browseButton.type='button';browseButton.disabled=true;disclosure.append(browseButton);
      container.append(label,status,disclosure);section.append(container);rows.set(def.id,{container,input,status,metadata,opacity:slider,browse:browseButton});
      input.addEventListener('change',()=>{if(input.checked)selected.add(def.id);else{selected.delete(def.id);results.delete(def.id);}closeDetail();updateControls();render();void refresh();});
      slider.addEventListener('input',()=>{opacity.set(def.id,Number(slider.value));render();});browseButton.addEventListener('click',()=>browse(def.id,browseButton));
    }$('catalog').append(section);
  }
  async function refresh(requestedBounds){
    if(disposed)return;started=true;clearTimeout(timer);const request=++serial;controller?.abort();controller=new AbortController();closeDetail();
    const actual=requestedBounds||getCity()?.getViewportBounds?.()||lastBounds||PROPERTY_REGION_BOUNDS;
    if(!validAtlasBounds(actual)){$('status').textContent='A valid map area is not available. Try Refresh this area.';return;}
    const bounds=[...actual];lastBounds=bounds;
    if(!selected.size){results.clear();getCity()?.clearMapLayers?.();renderLegend();$('status').textContent='Turn on a layer below. Data loads for the visible area.';updateControls();return;}
    const ids=[...selected];results.clear();getCity()?.clearMapLayers?.();renderLegend();updateControls();$('status').textContent='Loading selected layers…';
    for(const id of ids){setRowStatus(id,'Loading this area…');rows.get(id)?.metadata.replaceChildren();}
    const jobs=[['evidence',evidence],['infrastructure',infrastructure]].map(([type,adapter])=>({adapter,layers:ids.filter(id=>PROPERTY_MAP_LAYERS.find(d=>d.id===id)?.adapter===type)})).filter(j=>j.layers.length);
    const settled=await Promise.allSettled(jobs.map(job=>job.adapter.query({layers:job.layers,bounds,level:mapLayerDetail(bounds),query:'',fromDate:null,toDate:null,material:'all',signal:controller.signal})));
    if(disposed||request!==serial)return;
    settled.forEach((response,index)=>{
      for(const id of jobs[index].layers){
        if(response.status==='rejected'){setRowStatus(id,'Unavailable. Refresh to retry.');continue;}
        const value=response.value,layer=value.layers.find(l=>l.id===id),features=value.features.filter(f=>f.layerId===id);
        results.set(id,{features,source:layer});
        const metadata=rows.get(id)?.metadata;if(metadata){metadata.replaceChildren();for(const [label,text] of [['Scope',layer?.reason||layer?.coverage],['Retrieved',layer?.retrievedAt||layer?.source?.retrievedAt],['Source records in publication',layer?.sourceCount],['Records without map locations',layer?.sourceUnmappedCount]])if(text!=null)metadata.append(make('p',`${label}: ${text}`,'small-note'));external(metadata,'Open source publication',layer?.source?.url);}
        const state=layer?.status||'unavailable',partial=layer?.partial||value.partial;
        setRowStatus(id,state==='unavailable'?'Unavailable. Refresh to retry.':state==='zoom-required'?'Zoom in to load this layer.':`${count(layer?.count??features.length)} source records · ${count(features.length)} map features${partial?' · partial coverage':''}${state==='baseline-only'?' · baseline only':''}`);
      }
    });updateControls();render();
  }
  function preset(ids){selected.clear();for(const id of ids)if(rows.has(id)&&!rows.get(id).input.disabled)selected.add(id);results.clear();updateControls();void refresh();}
  $('infrastructure').addEventListener('click',()=>preset(['water-materials','city-streetlights','city-capital-projects','modot-bridges']));
  $('development').addEventListener('click',()=>preset(['permits','zoning-petitions','tif-districts','tax-abatements']));
  $('clear').addEventListener('click',()=>preset([]));$('refresh').addEventListener('click',()=>void refresh());
  $('model').addEventListener('click',onModel);$('site').addEventListener('click',onSite);$('activity').addEventListener('click',onActivity);
  return {activate(){started=true;if(selected.size&&!results.size)void refresh();},refresh,refreshRenderer:render,
    dispose(){disposed=true;serial++;controller?.abort();clearTimeout(timer);clearInterval(polling);evidence.dispose?.();infrastructure.dispose?.();getCity()?.clearMapLayers?.();legend.remove();}};
}
