import L from 'leaflet';
import { unpackField, snapshotField, sampleAt, streamline, seeded, indexPixel } from './atlas-math.mjs';
import { WATER_STORIES } from './water-stories.mjs';
import { spectralSample } from './spectral.mjs';
import { maskedRiverRuns, trailIntervals, CURRENT_SAMPLES_PER_SECOND } from './flow-motion.mjs';
import { velocityRaster } from './velocity-raster.mjs';
import { decodeVelocityBytes } from './velocity-decode.mjs';
import { atlasQuery, collectionFor } from './atlas-navigation.mjs';
import { speedColor } from './speed-colors.mjs';
import { velocityDepthProfile } from './velocity-profile.mjs';
import { relativeVorticity, sampleVorticity, vorticityColor, vorticityPathRuns, vorticityRaster } from './ocean-vorticity.mjs';

const BASE = '/hidden-rivers/water-atlas/';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const OCEANS = [
  {id:'global',title:'Ocean circulation',group:'Ocean currents',bounds:[-179,-65,179,76],note:'The ocean’s broad currents, traced from satellite-tracked drifting buoys.',source:'drifter'},
  {id:'amazon-plume',title:'Amazon plume',group:'Ocean currents',bounds:[-58,-3,-39,12],note:'Fresh water spreads into the Atlantic beside the North Brazil Current.',source:'drifter',salinity:true},
  {id:'agulhas',title:'Agulhas Current',group:'Ocean currents',bounds:[10,-43,35,-30],note:'The current turns south of Africa, shedding rings into the Atlantic.',source:'hycom'},
  {id:'bahamas',title:'Florida Straits',group:'Ocean currents',bounds:[-84,22,-72,30],note:'Water flows between Florida and the Bahamas toward the Gulf Stream.',source:'hycom'},
  {id:'denmark',title:'Denmark Strait',group:'Ocean currents',bounds:[-40,59,-15,69],note:'Atlantic and Arctic waters meet between Greenland and Iceland.',source:'hycom'},
  {id:'gulf-stream',title:'Gulf Stream · Hatteras',group:'Ocean currents',bounds:[-80,30,-65,42],note:'The Gulf Stream leaves the coast near Cape Hatteras and turns into the open Atlantic.',source:'drifter'},
  {id:'point-nemo',title:'Point Nemo',group:'Reefs & open ocean',bounds:[-136,-56,-111,-41],note:'The oceanic pole of inaccessibility, within the South Pacific circulation.',source:'drifter'},
];
const LABELS = {rgb:'Natural color',pca:'Water PCA',landscape:'Landscape PCA',water:'Water index',currents:'Currents',salinity:'Salinity'};
const dateLabel = date => new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const shortDate = date => new Date(date).toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'});
const leafletBounds = b => [[b[1],b[0]],[b[3],b[2]]];
const safe = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function startWaterAtlas() {
  const el = id => document.getElementById('atlas-'+id), root=el('map'); if (!root) return;
  const query = atlasQuery(location.search), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialHash=location.hash;
  const requestedPlace=query.get('place')||query.get('region');
  const initialStory=query.get('story')||(!query.has('layer')?(WATER_STORIES.find(s=>s.steps.some(step=>step.place===requestedPlace))?.id||(requestedPlace?null:'classroom')):null);
  const initialChapter=query.has('chapter')?Math.max(0,Number(query.get('chapter'))||0):Math.max(0,WATER_STORIES.find(s=>s.id===initialStory)?.steps.findIndex(step=>step.place===requestedPlace&&(!query.has('depth')||step.depth===Number(query.get('depth'))))??0);
  const map = L.map(root,{zoomControl:false,preferCanvas:true,zoomSnap:.25,minZoom:2,maxZoom:18,
    scrollWheelZoom:true,zoomAnimation:!reduced,fadeAnimation:!reduced,markerZoomAnimation:false,
    worldCopyJump:false,maxBounds:[[-78,-190],[84,190]],maxBoundsViscosity:.6,attributionControl:true});
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19,noWrap:true,crossOrigin:true,attribution:'Imagery © Esri, Maxar, Earthstar Geographics · Copernicus Sentinel-2'}).addTo(map);
  L.control.scale({imperial:false,maxWidth:110}).addTo(map);
  const comparePane=map.createPane('satelliteCompare');comparePane.style.zIndex=410;
  const fieldCanvas=document.createElement('canvas'),flowCanvas=document.createElement('canvas');
  fieldCanvas.className='atlas-field-canvas';flowCanvas.className='atlas-flow-canvas';root.append(fieldCanvas,flowCanvas);
  const fieldCtx=fieldCanvas.getContext('2d'),flowCtx=flowCanvas.getContext('2d');
  const requests=new Map();
  const get = (url,kind='json') => {
    const key=kind+url;
    if(!requests.has(key)) requests.set(key,fetch(url).then(r=>{if(!r.ok)throw Error(`Unable to load ${url.split('/').at(-1)} (${r.status})`);return kind==='json'?r.json():r.arrayBuffer();}).catch(e=>{requests.delete(key);throw e;}));
    return requests.get(key);
  };
  const state={place:null,layer:'rgb',frame:0,depth:0,playing:!reduced,flow:true,diagnostic:query.get('diagnostic')==='vorticity'?'vorticity':'speed',speedShading:query.get('shading')==='speed',subsurface:query.get('subsurface')==='1',cycle:false,compare:false,present:false,view:query.get('view')==='flat'?'flat':'world',palette:['gold','coral','ice'].includes(query.get('palette'))?query.get('palette'):'gold',blend:query.get('blend')==='contrast'?'contrast':'brightness',story:initialStory,chapter:initialChapter,tilt:true,orbit:false};
  const oceanFlowVisible=()=>Boolean(state.place?.source&&(state.layer==='currents'||(!state.place.frames&&state.layer==='rgb'&&state.flow)));
  const currentDiagnostic=()=>oceanFlowVisible()?state.diagnostic:'speed';
  let places=[],manifest,hycom,originalHycom,drifter,radar,field=null,vorticity=null,layer=null,rivers=null,paths=[],riverPaths=[],images=[],epoch=0,imageEpoch=0,indexValues=null,waterCandidates=null;
  let phase=0,last=0,lastCycle=0,dirty=true,moving=false,presentTimer,previousFocus,group='all',pointerTimer;
  let world=null,worldPromise=null,spectra=null,samples=[],storyEpoch=0,cameraRestored=false,profileEpoch=0;
  let displayedEntries=[],tabEpoch=0;const remembered={};state.tab='ocean';state.grid=query.get('grid')==='sampled'?'sampled':'native';
  const sourceCatalog=()=>state.grid==='sampled'?originalHycom:hycom;
  const velocityFields=new Map();
  function loadVelocity(meta){const key=(sourceCatalog().dataBase||'/hidden-rivers/data/')+meta.file;
    if(velocityFields.has(key)){const cached=velocityFields.get(key);velocityFields.delete(key);velocityFields.set(key,cached);return cached;}
    // Retain a regional profile without accumulating decoded grids worldwide.
    while(velocityFields.size>=8)velocityFields.delete(velocityFields.keys().next().value);
    const promise=get(key,'bytes').then(bytes=>decodeVelocityBytes(bytes,meta.compression)).then(bytes=>unpackField(meta,bytes)).catch(error=>{if(velocityFields.get(key)===promise)velocityFields.delete(key);throw error;});velocityFields.set(key,promise);return promise;
  }
  function remember(){if(state.place&&state.tab!=='prints')remembered[state.tab]={place:state.place.id,layer:state.layer,frame:state.frame,depth:state.depth,compare:state.compare,palette:state.palette,blend:state.blend,story:state.story,chapter:state.chapter,grid:state.grid,flow:state.flow,diagnostic:state.diagnostic,speedShading:state.speedShading,subsurface:state.subsurface,camera:world?.getCamera(),flat:{center:map.getCenter(),zoom:map.getZoom()}};}
  function renderTab(){
    const prints=state.tab==='prints';document.getElementById('atlas').classList.toggle('atlas-is-prints',prints);
    document.querySelectorAll('[data-atlas-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.atlasTab===state.tab)));
    el('prints').hidden=!prints;world?.setVisible(!prints&&state.view==='world');
    if(prints&&!el('prints').src){const params=new URLSearchParams({embedded:'1'});for(const key of ['study','image'])if(query.has(key))params.set(key,query.get(key));el('prints').src='/hidden-rivers/prints/?'+params+(initialHash==='#saltwater-demo'?'#saltwater-demo':'');}
    el('prints').contentWindow?.postMessage({type:'hidden-rivers-visible',active:prints},location.origin);
  }
  async function selectTab(tab){
    if(tab===state.tab)return;const stamp=++tabEpoch;remember();state.tab=tab;renderTab();
    if(tab==='prints'){saveURL();return;}
    const saved=remembered[tab],fallback=tab==='satellite'?{place:'manaus',layer:'pca',palette:'gold',blend:'contrast'}:{place:'agulhas',layer:'currents',depth:0};
    const selection=saved||fallback;
    await selectPlace(selection.place,false,{...selection,restore:true});
    if(stamp!==tabEpoch)return;
    if(saved){state.story=saved.story;state.chapter=saved.chapter;renderStory();if(saved.camera)world?.setCamera(saved.camera);if(saved.flat)map.setView(saved.flat.center,saved.flat.zoom,{animate:false});}
    if(state.view==='world'&&!world)await setView('world');map.invalidateSize();saveURL();
  }
  const setStatus=text=>{el('status').textContent=text;};
  const bounds=()=>leafletBounds(state.place.bounds);
  function renderStory(){
    const story=WATER_STORIES.find(s=>s.id===state.story),step=story?.steps[Math.min(state.chapter,story.steps.length-1)];
    el('story').hidden=!step;document.getElementById('atlas').classList.toggle('has-story',Boolean(step));if(!step)return;
    state.chapter=Math.min(state.chapter,story.steps.length-1);el('story-series').textContent=story.title+' · '+(state.chapter+1)+' / '+story.steps.length;
    el('story-title').textContent=step.title;el('story-text').textContent=step.text;el('story-key').textContent=step.key;
    el('story-dots').innerHTML=story.steps.map((s,i)=>`<button type="button" data-chapter="${i}" aria-label="${safe(s.title)}" aria-pressed="${i===state.chapter}"></button>`).join('');
    el('story-source').hidden=!step.source;if(step.source)el('story-source').href=step.source;
  }
  function storyLibrary(){
    el('story-list').innerHTML=WATER_STORIES.map(s=>{const p=places.find(p=>p.id===s.thumb),thumb=p?.frames?.[0]?.pca;
      return `<button type="button" class="story-card" data-story="${s.id}">${thumb?`<img src="${BASE+thumb}" alt="" loading="lazy"/>`:'<span class="story-ocean-art" aria-hidden="true"></span>'}<span><strong>${safe(s.title)}</strong><small>${safe(s.subtitle)}</small><b>${s.steps.length} chapters ↗</b></span></button>`;}).join('');
  }
  async function storyChapter(index,id=state.story){
    const story=WATER_STORIES.find(s=>s.id===id);if(!story)return;
    const stamp=++storyEpoch;state.story=id;state.chapter=(index+story.steps.length)%story.steps.length;renderStory();el('story-library').hidden=true;
    const step=story.steps[state.chapter];await selectPlace(step.place,false,{...step,story:true});
    if(stamp===storyEpoch){renderStory();saveURL();}
  }
  async function syncWorld(desired=null){
    if(!world||!state.place)return;
    const entries=desired||displayedEntries;
    await world.update({place:state.place,images:entries,field,vorticity,diagnostic:currentDiagnostic(),frame:state.frame,rivers,waterCandidates,depth:state.depth,subsurface:state.subsurface,layer:state.layer,speedShading:state.speedShading,flow:state.flow,playing:state.playing,compare:state.compare,swipe:Number(el('swipe').value)/100,color:currentDiagnostic()==='vorticity'?vorticityColor:speedColor});
  }
  async function setView(view){
    state.view=view;if(view==='world'&&state.subsurface)state.speedShading=false;const atlas=document.getElementById('atlas');atlas.classList.toggle('atlas-is-world',view==='world');el('world').hidden=view!=='world';
    if(view==='world'){
      setStatus('Loading the ocean globe…');
      try{
        if(!worldPromise)worldPromise=import('./water-world.js').then(m=>m.mountWaterWorld(el('world'),{onPick:latlng=>void inspect({latlng}),onStatus:s=>{state.terrainStatus=s;}}));
        const pendingWorld=worldPromise;
        try{world=await pendingWorld;}catch(error){if(worldPromise===pendingWorld)worldPromise=null;throw error;}
        world.setVisible(state.tab!=='prints');await syncWorld();
        if(!cameraRestored){world.fit(state.place,{tilt:state.tilt,immediate:true});await world.whenReady();}
        if(!cameraRestored){cameraRestored=true;const cam={lat:Number(query.get('camlat')),lon:Number(query.get('camlon')),height:Number(query.get('camh')),heading:Number(query.get('heading')),pitch:Number(query.get('pitch'))};if(query.has('camh')&&Object.values(cam).every(Number.isFinite)&&Math.abs(cam.lat)<=90&&Math.abs(cam.lon)<=180&&cam.height>=80&&cam.height<=35000000)world.setCamera(cam);world.viewer.camera.changed.addEventListener(saveURL);world.viewer.camera.moveEnd.addEventListener(saveURL);}
        setStatus('');
      }catch(error){state.view='flat';atlas.classList.remove('atlas-is-world');el('world').hidden=true;if(!world){el('world').classList.remove('atlas-world-loading');el('world').replaceChildren();}setStatus('The globe could not start. Select Globe to retry, or use Map view.');console.error(error);}
    }else{world?.setVisible(false);map.invalidateSize();await displayFrame();dirty=true;setStatus('');}
    controls();saveURL();
  }
  function renderSpectra(){
    el('inspector').hidden=false;
    el('inspector-title').textContent='Light returned by the water';
    const max=Math.max(.02,...samples.flatMap(s=>s.values)),bands=['B2 · blue','B3 · green','B4 · red','B8 · near-IR'];
    el('spectra-chart').innerHTML=`<div class="sample-labels">${samples.map((s,i)=>`<span class="sample-${i}">${i?'B':'A'} · ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}</span>`).join('')}</div>${bands.map((b,i)=>`<div class="spectra-row"><span>${b}</span><div>${samples.map((s,j)=>`<i class="sample-${j}" style="width:${Math.max(0,s.values[i])/max*100}%"></i>`).join('')}</div><small>${samples.map(s=>s.values[i].toFixed(4)).join(' / ')}</small></div>`).join('')}<div class="sample-stats">${samples.map((s,i)=>`<p><b>${i?'B':'A'}</b> NDWI ${s.ndwi?.toFixed(3)??'unavailable'}${state.place.waterPca?` · PC1 ${s.pc[0].toFixed(4)} · PC2 ${s.pc[1].toFixed(4)}`:''}</p>`).join('')}</div>`;
    el('spectra-note').textContent=`${dateLabel(state.place.frames[state.frame].date)} · sampled surface reflectance. ${samples.length===1?'Click a second pixel to compare.':'The bars compare actual band values, not color names.'} Standard land-oriented L2A correction; aquatic and sunglint artifacts can remain.`;
  }
  function resize() {
    const {x:w,y:h}=map.getSize(),ratio=Math.min(devicePixelRatio||1,2);
    for(const canvas of [flowCanvas,fieldCanvas]){canvas.width=w*ratio;canvas.height=h*ratio;canvas.style.width=w+'px';canvas.style.height=h+'px';}
    flowCtx.setTransform(ratio,0,0,ratio,0,0);fieldCtx.setTransform(ratio,0,0,ratio,0,0);dirty=true;
  }
  function fit() {
    map.stop();
    map.fitBounds(bounds(),{padding:[24,24],animate:!reduced&&Boolean(world),duration:.8});
    world?.fit(state.place,{tilt:state.tilt,immediate:reduced});
  }
  function shareURL() {
    const c=map.getCenter(),p=new URLSearchParams({place:state.place.id,layer:state.layer,frame:String(state.frame),depth:String(state.depth),lat:c.lat.toFixed(5),lon:c.lng.toFixed(5),zoom:map.getZoom().toFixed(2)});
    if(!state.flow)p.set('flow','0'); if(state.compare)p.set('compare','1');
    if(state.speedShading)p.set('shading','speed');if(state.subsurface)p.set('subsurface','1');
    p.set('view',state.view);p.set('diagnostic',state.diagnostic);p.set('palette',state.palette);p.set('blend',state.blend);if(state.story){p.set('story',state.story);p.set('chapter',String(state.chapter));}
    p.set('tab',state.tab);p.set('grid',state.grid);
    if(state.tab==='prints')for(const key of ['study','image'])if(query.has(key))p.set(key,query.get(key));
    if(state.view==='world'&&world){const c=world.getCamera();p.set('camlat',c.lat.toFixed(5));p.set('camlon',c.lon.toFixed(5));p.set('camh',c.height.toFixed(1));p.set('heading',c.heading.toFixed(5));p.set('pitch',c.pitch.toFixed(5));}
    return `${location.pathname}?${p}${state.tab==='prints'&&initialHash==='#saltwater-demo'?'#saltwater-demo':''}`;
  }
  function saveURL() {if(state.place)history.replaceState(null,'',shareURL());}
  function browse(open) {
    el('places').hidden=!open;el('browse').setAttribute('aria-expanded',String(open));
    if(open){renderPlaces();el('search').focus();}else el('browse').focus();
  }
  function renderPlaces() {
    const term=el('search').value.trim().toLowerCase();
    const selected=places.filter(p=>(group==='all'||(group==='coasts'?!['Ocean currents','Amazon basin'].includes(p.group):p.group===group))&&`${p.title} ${p.note} ${p.group}`.toLowerCase().includes(term));
    let lastGroup='';
    el('place-list').innerHTML=selected.map(p=>{
      const heading=p.group!==lastGroup?`<p class="place-group-title">${safe(p.group)}</p>`:'';lastGroup=p.group;
      const thumb=p.frames?.[0]?.rgb;
      const depths=p.source==='hycom'?sourceCatalog().regions.find(r=>r.id===p.id).layers.map(l=>l.depth):[];
      return heading+`<button class="place-card" type="button" data-place="${p.id}" aria-current="${p.id===state.place?.id}">${thumb?`<img src="${BASE+thumb}" alt="" loading="lazy"/>`:'<span class="place-ocean-thumb" aria-hidden="true"></span>'}<span>${safe(p.title)}<small>${p.frames?'Sentinel-2 · PCA · dated scenes':p.source==='radar'?`Observed coastal currents · ${p.nominalResolutionKm} km`:p.source==='hycom'?depths.length>1?'HYCOM · surface to 2,000 m':`HYCOM · ${depths[0].toLocaleString()} m`:'NOAA drifter currents · 15 m'}</small></span></button>`;
    }).join('')||'<p class="places-empty">No places match. Try “Amazon”, “reef”, or “current”.</p>';
  }
  function availableLayers() {return state.place.frames?['rgb',...(state.place.waterPca?['pca']:[]),'landscape','water']:state.place.salinity?['currents','rgb','salinity']:['currents','rgb'];}
  function framePath(frame,kind){if(kind==='pca')return (frame.highResolution?.lenses||frame.lenses)[state.palette][state.blend];if(kind==='rgb')return frame.highResolution?.rgb||frame.rgb;return frame[kind];}
  function displayMetres(p,frame){const r=['pca','rgb'].includes(state.layer)&&frame?.highResolution?frame.highResolution:p.raster;return r.displayPixelGroundMetresAtCentre??r.displayPixelMetres*Math.cos((p.bounds[1]+p.bounds[3])/2*Math.PI/180);}
  function controls() {
    const p=state.place,frames=p.frames;
    document.getElementById('atlas').classList.toggle('atlas-is-currents',Boolean(p.source&&state.layer==='currents'));
    el('place-name').textContent=p.title;el('title').textContent=p.title;el('place-group').textContent=p.group.toUpperCase();el('note').textContent=p.note;
    el('layers').innerHTML=availableLayers().map(id=>`<button type="button" data-layer="${id}" aria-pressed="${state.layer===id}">${LABELS[id]}</button>`).join('');
    el('flow-label').hidden=!p.rivers&&!p.source;el('flow-label').querySelector('span').textContent=p.rivers?'River direction':'Moving streamlines';el('flow').checked=state.flow;
    el('diagnostic-mode-label').hidden=!oceanFlowVisible();el('diagnostic-mode').value=state.diagnostic;
    el('speed-shading-label').hidden=!p.source||state.layer!=='currents'||state.view==='world'&&state.subsurface;el('speed-shading-label').querySelector('span').textContent=state.diagnostic==='vorticity'?'Field shading':'Speed shading';el('speed-shading').checked=state.speedShading;
    el('subsurface-label').hidden=p.source!=='hycom'||state.view!=='world'||state.depth===0;el('subsurface').checked=state.subsurface;
    el('depth-label').hidden=!p.source;el('grid-label').hidden=p.source!=='hycom'||hycom===originalHycom;el('grid').value=state.grid;
    const depths=p.source==='hycom'?sourceCatalog().regions.find(r=>r.id===p.id).layers.map(l=>l.depth):[p.source==='radar'?p.depth:15];
    el('depth-rail').hidden=p.source!=='hycom'||depths.length<2;
    el('depth-rail').innerHTML='<span>DEPTH</span>'+depths.map(d=>`<button type="button" data-depth="${d}" aria-pressed="${d===state.depth}">${d?d.toLocaleString()+' m':'Surface'}</button>`).join('');
    if(p.source)el('depth').innerHTML=depths.map(d=>`<option value="${d}" ${d===state.depth?'selected':''}>${d===0?'Surface':d.toLocaleString()+' m'}</option>`).join('');
    const count=frames?frames.length:layer?.shape[0]||12;
    el('time').max=String(count-1);el('time').value=String(state.frame);el('time').disabled=count<2;
    el('time').setAttribute('aria-label',frames?'Satellite acquisition':p.source==='hycom'?'Velocity snapshot':'Climatology month');
    el('date').textContent=frames?dateLabel(frames[state.frame].date):layer?.dates?dateLabel(layer.dates[state.frame])+' · '+new Date(layer.dates[state.frame]).toISOString().slice(11,16)+' UTC':MONTHS[state.frame]+' · monthly climatology';
    el('cadence').textContent=frames?'Discrete acquisitions':p.source==='radar'?'Observed radar snapshot':p.source==='hycom'?'Source velocity snapshots':'Seasonal mean · through Feb 2023';
    if(state.layer==='salinity'){el('date').textContent='15 July 2024 · SMAP';el('cadence').textContent='Flow: '+MONTHS[state.frame]+' climatology';el('time').setAttribute('aria-label','Current climatology month; salinity acquisition remains 15 July 2024');}
    const ticks=frames?frames.map(f=>shortDate(f.date)):layer?.dates?[shortDate(layer.dates[0]),shortDate(layer.dates.at(-1))]:['JAN','APR','JUL','OCT','DEC'];
    el('date-ticks').innerHTML=ticks.map(t=>`<span>${safe(t)}</span>`).join('');
    el('play').dataset.playing=String(state.playing);el('play').setAttribute('aria-label',state.playing?'Pause animation':'Play animation');
    el('play').disabled=!p.rivers&&!p.source&&!state.cycle;
    el('cycle').textContent=frames?'Time-lapse':'Cycle dates';el('cycle').setAttribute('aria-pressed',String(state.cycle));el('cycle').disabled=count<2;
    el('compare').hidden=!frames||state.layer==='rgb';el('compare').setAttribute('aria-pressed',String(state.compare));el('compare-slider').hidden=!state.compare;
    el('compare-name').textContent=LABELS[state.layer];
    el('spectral-controls').hidden=state.layer!=='pca';el('blend').value=state.blend;
    el('spectral-controls').querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===state.palette)));
    el('view-world').setAttribute('aria-pressed',String(state.view==='world'));el('view-flat').setAttribute('aria-pressed',String(state.view==='flat'));el('tilt').hidden=el('orbit').hidden=state.view!=='world';
    world?.setPlaying(state.playing);world?.setFlow(state.flow);
    const frame=frames?.[state.frame];
    el('navigation-hint').textContent=`${frames?'Sentinel-2':p.source==='radar'?'HF radar observation':p.source==='hycom'?'HYCOM model':'NOAA drifter mean'} · ${el('date').textContent}${frames?' · '+Math.round(displayMetres(p,frame))+' m display':' · '+state.depth+' m'}`;
    el('navigation-hint').title='Drag to explore; scroll or pinch to zoom; click to inspect';
    el('evidence').textContent=frames?`Sentinel-2 L2A · native 10 m · ${Math.round(displayMetres(p,frame))} m display · ${Math.round(frame.validFraction*100)}% clear${p.rivers?' · drainage direction; rate illustrative':''}`:
      state.layer==='salinity'?'SMAP surface salinity · 0.25° source grid · dated daily retrieval; coastal pixels can be unreliable':currentDiagnostic()==='vorticity'?`${p.source==='radar'?'NOAA HF radar observations':p.source==='hycom'?'HYCOM model analysis':'NOAA/AOML monthly drifter climatology'} · signed vertical relative ζ · fixed ±4 × 10⁻⁵ s⁻¹ · strict spherical stencil; gaps retained`:p.source==='radar'?`NOAA HF radar · ${p.nominalResolutionKm} km native grid · ${p.validCells} observed cells · ${p.depth} m · motion 3,600×`:p.source==='hycom'?`HYCOM analysis · ${state.depth===0?'surface':state.depth+' m below sea level'} · ${layer.dlon.toFixed(2)}° × ${layer.dlat.toFixed(2)}° grid · ${layer.spatialStride===1?'all native cells':'sampled source'} · motion 3,600×`:
      'NOAA/AOML drifter climatology · 15 m drogue · 1° display grid · motion 3,600×; not observed tracks';
    legend();dataContent();
  }
  function legend() {
    const p=state.place,metricSource=p.source==='hycom'?'HYCOM model-analysis horizontal velocity at the selected depth and snapshot.':p.source==='radar'?'NOAA HF radar observed horizontal currents on the released grid and timestamp.':'NOAA/AOML drifter-derived monthly climatology at one nominal 15 m drogue depth.';
    if(state.layer==='currents'||(!p.frames&&state.flow&&state.layer==='rgb')){
      if(currentDiagnostic()==='vorticity')el('legend').innerHTML=`<strong>Vertical relative vorticity · 10⁻⁵ s⁻¹</strong><div class="vorticity-colorbar"></div><div class="ticks"><span>−4</span><span>0</span><span>+4</span></div><p>${state.speedShading?'Field shading and moving paths use one fixed symmetric ±4 × 10⁻⁵ s⁻¹ scale.':'Moving paths use ζ color; turn on Field shading for the gridded field.'}<br/>Viewed from above, positive is counter-clockwise; negative is clockwise. Values clip outside the scale. Curl of horizontal velocity only; no vertical velocity or f + ζ.<br/>${metricSource}</p>`;
      else el('legend').innerHTML=`<strong>Current speed · m/s</strong><div class="atlas-colorbar"></div><div class="ticks"><span>0</span><span>0.4</span><span>≥0.8</span></div><p>${state.speedShading?'Speed field and moving trails use the same 0–0.8 m/s scale.':'Moving trails use speed color. Turn on Speed shading for the gridded field.'}${state.view==='world'?'<br/>Globe line colors follow sampled speed along the path.':''}</p>`;
    }
    else if(state.layer==='water')el('legend').innerHTML='<strong>Water index · NDWI</strong><div class="atlas-colorbar water"></div><div class="ticks"><span>−1</span><span>0</span><span>+1</span></div><p>Green vs near-infrared reflectance. Positive values often indicate water.</p>';
    else if(state.layer==='pca'){
      const pc=p.waterPca,rows=manifest.spectralPalettes[state.palette].rows;
      el('legend').innerHTML=`<strong>Water brightness · PC1</strong><div class="spectral-ramp" style="background:linear-gradient(90deg,${rows[0].join(',')})"></div><div class="ticks"><span>Weaker return</span><span>Stronger</span></div><p>${(pc.varianceExplained[0]*100).toFixed(1)}% of water spectral variance<br/>Visible brightness correlation r = ${pc.correlations[0][0].toFixed(3)}</p>${state.blend==='contrast'?`<strong class="secondary-key">PC2 · spectral shape</strong><div class="spectral-ramp" style="background:linear-gradient(90deg,${rows[1].join(',')})"></div><p>Second ramp: higher PC2<br/>${(pc.varianceExplained[1]*100).toFixed(1)}% of water variance</p><div class="loading-key">${pc.bands.map((b,i)=>`<span>${b}<b>${pc.eigenvectors[i][1]>=0?'+':''}${pc.eigenvectors[i][1].toFixed(2)}</b></span>`).join('')}</div>`:''}<p>Shared basis across ${p.frames.length} dates.<br/>Click two water pixels to compare.</p>`;
    }
    else if(state.layer==='landscape')el('legend').innerHTML=`<strong>Landscape PCA</strong><p>Whole-scene B2 / B3 / B4 / B8.<br/>PC1 lightness; PC2 / PC3 hue.<br/>Land enters this separate fit.</p>`;
    else if(state.layer==='salinity')el('legend').innerHTML='<strong>Surface salinity · psu</strong><div class="atlas-colorbar salinity"></div><div class="ticks"><span>20</span><span>29</span><span>38</span></div><p>SMAP · 15 July 2024<br/>Separate from current climatology.</p>';
    else el('legend').innerHTML=p.frames?'<strong>Surface reflectance</strong><p>Sentinel-2 · B4 / B3 / B2<br/>Cloud and shadow masked.<br/>Click a pixel to inspect NDWI.</p>':'<strong>Satellite context</strong><p>Esri World Imagery.<br/>Basemap acquisition dates vary.</p>';
  }
  function dataContent() {
    const p=state.place,f=p.frames?.[state.frame];
    const vorticityMethod=currentDiagnostic()==='vorticity'?`<p>Vorticity is signed vertical relative vorticity of the horizontal velocity: ζ = [∂v/∂λ − ∂(u cos φ)/∂φ] / (R cos φ), in s⁻¹. Centered spherical-grid differences require the center and all four cardinal velocity neighbors; missing stencils remain transparent, with no coastal fill or one-sided derivative. This is relative ζ only, not f + ζ or vertical velocity. <a href="/hidden-rivers/ocean-vorticity-model.md">Diagnostic method and stencil ↗</a> · <a href="https://gmd.copernicus.org/articles/11/4637/2018/" target="_blank" rel="noopener">Spherical curl formulation ↗</a></p>`:'';
    if(f){
      const pc=p.waterPca;
      el('data-content').innerHTML=`<h3>${safe(p.title)} · ${dateLabel(f.date)}</h3><p>Natural color and spectral lenses use calibrated <a href="https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a" target="_blank" rel="noopener">Sentinel-2 Level-2A</a> B2, B3, B4 and B8 reflectance. Those bands are native 10 m. The dated raster has ${Math.round(displayMetres(p,f))} m display pixels. The imagery is georeferenced in Web Mercator; the globe uses a matching projection.</p>${pc?`<h3>Why these component combinations</h3><p>The water PCA is fitted to clear water candidates, not the forest, city or reef islands. PC1 is oriented toward increasing visible-band return. In this place it explains ${(pc.varianceExplained[0]*100).toFixed(1)}% of the fitted water variance and correlates ${pc.correlations[0][0].toFixed(3)} with mean visible reflectance. The brightness lens maps this component to an ordered dark-to-light palette. The contrast lens adds PC2 by blending between two brightness ramps in CIELAB. Both use the same basis and 2–98% stretches across all available dates.</p><table><caption>Water PCA loadings</caption><thead><tr><th>Band</th><th>PC1</th><th>PC2</th><th>PC3</th></tr></thead><tbody>${pc.bands.map((b,i)=>`<tr><th>${b}</th>${pc.eigenvectors[i].slice(0,3).map(v=>`<td>${v>=0?'+':''}${v.toFixed(4)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>PC2 is interpreted by these actual loadings. Its meaning varies with the place and sample. Components are not compared numerically between places. The separate Landscape PCA includes land and uses the original whole-scene fit.</p>`:'<p>There are too few water candidates here for a defensible water-only fit. This place offers natural color, whole-scene Landscape PCA and NDWI instead.</p>'}<h3>What the water colors can tell us</h3><p>They show differences in the measured optical return. Suspended material, dissolved matter, bottom reflection, water depth, illumination and atmospheric artifacts can influence that signal. The atlas does not retrieve sediment concentration, coral health or bathymetry from these colors. <a href="https://science.nasa.gov/earth/earth-observatory/great-blue-hole-belize-37741/" target="_blank" rel="noopener">NASA’s reef example</a> explains why shallow bottom reflection changes water color.</p><p>Standard Sen2Cor L2A correction is designed primarily for land. <a href="https://sentinels.copernicus.eu/documents/247904/446933/Sentinel-2-Level-2A-Algorithm-Theoretical-Basis-Document-ATBD.pdf" target="_blank" rel="noopener">Its algorithm documentation</a> identifies limitations for coastal waters and sunglint. This is exploratory spectral interpretation, not a validated aquatic constituent retrieval.</p><p>Cloud, shadow, saturation, cirrus and snow are masked. Water candidates combine SCL water or positive NDWI with B8 reflectance below 0.12 for the PCA fit. Muted land within the PCA raster is dated natural-color context. Transparent gaps expose the undated basemap. Time playback shows discrete acquisitions.</p>${p.rivers?'<h3>River direction</h3><p>HydroRIVERS v1.0 provides approximate drainage geometry at 15 arc-seconds. Moving marks follow verified downstream connections and clear-scene water candidates. Their rate is illustrative; no measured river speed is inferred. Discharge attributes are long-term WaterGAP estimates for 1971–2000.</p>':''}<p><a href="${BASE+p.id+'/provenance.json'}" target="_blank" rel="noopener">Band sources, calibration, masks, loadings, variance, correlations & display transforms ↗</a></p><p><a href="${BASE}calibration-validation.json" target="_blank" rel="noopener">Reflectance offset validation ↗</a></p>`;
      return;
    }
    if(p.source==='radar'){el('data-content').innerHTML=`<h3>Measured North Carolina coastal currents</h3><p>NOAA NDBC HF radar total vectors on the nominal ${p.nominalResolutionKm} km grid at ${dateLabel(p.dates[0])}, ${p.dates[0].slice(11,16)} UTC. The file records ${p.depth} m depth and ${p.validCells} valid cells in this regional window, including ${p.ncValidCells} south of 36.55° N. Radar coverage is discontinuous; this snapshot is not a complete shoreline map or a real-time feed.</p><p>Speed shading retains every returned valid source cell. Animated streamlines require four valid neighboring cells and stop at gaps. They integrate one observed velocity snapshot, with motion accelerated 3,600 times. They are not observed trajectories. Vorticity, when selected, is derived from this observed horizontal radar field and preserves missing stencil gaps.</p>${vorticityMethod}<p><a href="https://dods.ndbc.noaa.gov/thredds/catalog/hfradar.html" target="_blank" rel="noopener">NOAA HF radar catalog ↗</a></p><p><a href="${BASE}nc-radar.json" target="_blank" rel="noopener">Exact source request, footprint, timestamp and checksums ↗</a></p>`;return;}
    el('data-content').innerHTML=
      p.source==='hycom'?`<h3>${safe(p.title)} · ${state.depth===0?'surface':state.depth+' m'}</h3><p><a href="https://www.hycom.org/dataserver/espc-d-v02/global-analysis" target="_blank" rel="noopener">HYCOM / ESPC-D-V02</a> supplies eastward and northward horizontal velocity at the chosen depth. The map uses the released geographic grid and exact snapshot dates. Depth controls change the velocity data. Globe trails default to surface projection while sampling the selected depth. Subsurface view places the same horizontal flow at that actual model depth and makes the globe translucent over the regional footprint. No vertical velocity or vertical exaggeration is used.</p><p>Animated lines are streamlines through one selected velocity snapshot, calculated with a midpoint method in geographic coordinates. Motion is accelerated 3,600 times for display. These graphics are not observed drifter tracks, forecasts, or a measure of transport volume. Missing grid corners stop a line; field shading is optional.${currentDiagnostic()==='vorticity'?' Vorticity is calculated from the selected-depth model-analysis velocities, not observations.':''}</p>${vorticityMethod}<p><a href="${sourceCatalog().dataBase||'/hidden-rivers/data/'}manifest.json" target="_blank" rel="noopener">Velocity grid, dates, checksums & source records ↗</a></p>`:
      `<h3>Near-surface ocean circulation · 15 m</h3><p><a href="https://www.aoml.noaa.gov/phod/gdp/mean_velocity.php" target="_blank" rel="noopener">NOAA’s Global Drifter Program</a> estimates monthly climatological velocity from satellite-tracked drifting buoys with drogues centered at 15 m. This is a long-run seasonal pattern through February 2023, not today’s current or a forecast. The 0.25° source has been sampled every four grid cells to a 1° display grid. This product has one nominal depth and supplies no deeper velocity profile.${currentDiagnostic()==='vorticity'?' Its vorticity is the derivative of this monthly drifter-derived mean, not the vorticity of an individual observed track or an instantaneous current.':''}</p><p>Streamlines follow the selected monthly mean eastward and northward velocity. Their motion is accelerated 3,600 times for visibility. They are not the measured tracks of individual buoys. Colors encode ${currentDiagnostic()==='vorticity'?'signed vertical relative vorticity':'speed in m/s'}; seed density and line count do not encode water volume. No flow is invented for missing cells.</p>${vorticityMethod}<p><a href="/hidden-rivers/?place=agulhas&amp;layer=currents&amp;depth=0&amp;tab=ocean">Explore HYCOM levels from surface to 2,000 m in the Agulhas Current ↗</a></p>${p.salinity?'<h3>Amazon freshwater plume</h3><p>The salinity layer is a <a href="https://oceanwatch.noaa.gov/cwn/products/sea-surface-salinity-near-real-time-smap.html" target="_blank" rel="noopener">NOAA SMAP</a> daily satellite-derived surface-salinity retrieval for 15 July 2024, on a native 0.25° grid. It is separate from the monthly current climatology and does not describe estuary-scale salinity.</p>':''}<p><a href="${BASE}drifter.json" target="_blank" rel="noopener">Grid, record period, source request & checksum ↗</a></p>`;
  }
  async function selectPlace(id, initial=false,options={}) {
    const p=places.find(p=>p.id===id)||places[0],stamp=++epoch;profileEpoch++;
    if(!options.restore)remember();if(options.grid)state.grid=options.grid;state.tab=collectionFor(p);renderTab();
    if(!initial&&!options.story){state.story=null;renderStory();}
    state.place=p;state.frame=0;state.compare=false;state.cycle=false;state.layer=options.layer||(p.frames?'rgb':'currents');state.depth=p.source==='hycom'?0:15;state.flow=options.flow??(initial&&query.has('flow')?query.get('flow')!=='0':!p.frames);if(options.diagnostic)state.diagnostic=options.diagnostic;else if(initial&&query.get('diagnostic')==='vorticity')state.diagnostic='vorticity';if(options.speedShading!==undefined)state.speedShading=options.speedShading;state.subsurface=options.subsurface??(initial&&query.get('subsurface')==='1');
    spectra=null;samples=[];el('inspector').hidden=true;
    imageEpoch++;field=null;vorticity=null;layer=null;rivers=null;paths=[];riverPaths=[];indexValues=null;map.closePopup();dirty=true;
    el('title').textContent=p.title;el('place-name').textContent=p.title;el('note').textContent=p.note;el('place-group').textContent=p.group.toUpperCase();
    el('places').hidden=true;el('browse').setAttribute('aria-expanded','false');setStatus('Loading '+(p.frames?'satellite observations…':'velocity field…'));
    if(!options.camera)fit();
    try {
      if(p.frames&&p.rivers){const loaded=await get(BASE+p.rivers);if(stamp!==epoch)return;rivers=loaded;}
      if(p.source==='hycom'){
        const region=sourceCatalog().regions.find(r=>r.id===p.id);p.bounds=region.bounds;
        const requested=options.depth??(initial?Number(query.get('depth')):0);
        state.depth=region.layers.some(l=>l.depth===requested)?requested:region.layers[0].depth;
        const meta=region.layers.find(l=>l.depth===state.depth);
        const loaded=await loadVelocity(meta);
        if(stamp!==epoch)return;layer=loaded;
      } else if(p.source==='drifter') {
        const loaded=unpackField(drifter,await get(BASE+drifter.file,'bytes'));if(stamp!==epoch)return;layer=loaded;
      } else if(p.source==='radar') {
        const loaded=unpackField(p,await get(BASE+p.file,'bytes'));if(stamp!==epoch)return;layer=loaded;state.depth=p.depth;
      }
      if(stamp!==epoch)return;
      if(initial){state.frame=Math.min((p.frames?.length||layer?.shape[0]||1)-1,Math.max(0,Number(query.get('frame'))||0));state.layer=availableLayers().includes(query.get('layer'))?query.get('layer'):state.layer;state.flow=query.has('flow')?query.get('flow')!=='0':!p.frames;state.compare=query.get('compare')==='1'&&p.frames&&state.layer!=='rgb';}
      if(initial&&query.has('date')&&layer?.dates){const target=Date.parse(query.get('date'));if(Number.isFinite(target))state.frame=layer.dates.reduce((best,d,i)=>Math.abs(Date.parse(d)-target)<Math.abs(Date.parse(layer.dates[best])-target)?i:best,0);}
      if(initial&&!query.has('frame')&&query.has('time')&&layer?.dates){const seconds=Number(query.get('time'));if(Number.isFinite(seconds)){const target=Date.parse(layer.dates[0])+seconds*1000;state.frame=layer.dates.reduce((best,d,i)=>Math.abs(Date.parse(d)-target)<Math.abs(Date.parse(layer.dates[best])-target)?i:best,0);}}
      if(options.palette)state.palette=options.palette;if(options.blend)state.blend=options.blend;
      if(options.date&&layer?.dates){const target=Date.parse(options.date);state.frame=layer.dates.reduce((best,d,i)=>Math.abs(Date.parse(d)-target)<Math.abs(Date.parse(layer.dates[best])-target)?i:best,0);}
      if(options.frame!==undefined)state.frame=Math.min((p.frames?.length||layer?.shape[0]||1)-1,Math.max(0,options.frame));
      if(options.compare)state.compare=true;
      await displayFrame();if(stamp!==epoch)return;
      if(initial&&query.has('zoom')&&query.has('lat')&&query.has('lon')){
        const z=Number(query.get('zoom')),lat=Number(query.get('lat')),lon=Number(query.get('lon'));
        if(Number.isFinite(z+lat+lon)&&Math.abs(lat)<80&&Math.abs(lon)<=180)map.setView([lat,lon],Math.min(18,Math.max(2,z)),{animate:false});
      }
      controls();setStatus('');saveURL();dirty=true;
    }catch(error){if(stamp===epoch){setStatus(error.message+'. Select this place again to retry.');console.error(error);}}
  }
  function removeImages(){imageEpoch++;images.forEach(image=>map.removeLayer(image));images=[];}
  async function displayFrame() {
    const p=state.place,frame=p.frames?.[state.frame],stamp=++imageEpoch;indexValues=null;waterCandidates=null;spectra=null;samples=[];el('inspector').hidden=true;
    if(layer){field=snapshotField(layer,state.frame);vorticity=relativeVorticity(field);}else{field=null;vorticity=null;}
    const desired=[];
    if(frame){
      const path=framePath(frame,state.layer);
      const entry=(src,pane)=>({src:BASE+src,pane,tiles:frame.highResolution?.tiles?.[src]});
      desired.push(entry(state.compare?framePath(frame,'rgb'):path,'overlayPane'));
      if(state.compare)desired.push(entry(path,'satelliteCompare'));
      if(frame.spectra)void get(BASE+frame.spectra,'bytes').then(b=>{if(stamp===imageEpoch)spectra=new Float32Array(b);}).catch(()=>{});
      void get(BASE+frame.index,'bytes').then(b=>{if(stamp===imageEpoch){const view=new DataView(b);indexValues=new Int16Array(b.byteLength/2);for(let i=0;i<indexValues.length;i++)indexValues[i]=view.getInt16(i*2,true);}}).catch(()=>{});
      if(frame.waterCandidate)void get(BASE+frame.waterCandidate,'bytes').then(b=>{if(stamp===imageEpoch){waterCandidates=new Uint8Array(b);dirty=true;void syncWorld(desired);}}).catch(()=>{});
    }else if(state.layer==='salinity'){desired.push({src:BASE+'amazon-salinity.webp',pane:'overlayPane',bbox:[-62,-4,-37,14]});}
    const next=state.view==='world'?[]:await Promise.all(desired.map(entry=>new Promise((resolve,reject)=>{
      const overlay=L.imageOverlay(entry.src,entry.bbox?leafletBounds(entry.bbox):bounds(),{opacity:0,pane:entry.pane,interactive:false});
      overlay.once('load',()=>resolve(overlay));overlay.once('error',()=>{map.removeLayer(overlay);reject(Error('Satellite layer failed to load'));});overlay.addTo(map);
    })));
    if(stamp!==imageEpoch){next.forEach(o=>map.removeLayer(o));return;}
    displayedEntries=desired;images.forEach(o=>map.removeLayer(o));images=next;images.forEach(o=>o.setOpacity(1));applyCompare();dirty=true;controls();saveURL();await syncWorld(desired);
  }
  function applyCompare(){
    world?.setSwipe(Number(el('swipe').value)/100);
    if(!state.compare||images.length<2)return;
    const rect=images[1].getElement().getBoundingClientRect(),container=root.getBoundingClientRect();
    const cut=Math.min(100,Math.max(0,100*(container.left+container.width*Number(el('swipe').value)/100-rect.left)/rect.width));
    images[1].getElement().style.clipPath=`inset(0 0 0 ${cut}%)`;
  }
  async function selectFrame(index) {
    profileEpoch++;
    const count=state.place.frames?.length||layer?.shape[0]||1;
    state.frame=(index+count)%count;map.closePopup();
    try{await displayFrame();}catch(e){setStatus(e.message);}
  }
  function geometry() {
    resize();paths=[];riverPaths=[];
    const size=map.getSize(),visible=map.getBounds(),rng=seeded(1800+state.frame);
    if(rivers&&waterCandidates){
      for(const f of rivers.features){
        const shape=state.place.frames[state.frame].indexShape;
        const wet=p=>{const at=indexPixel(state.place.bounds,shape,...p);return at&&waterCandidates[at[1]*shape[1]+at[0]]===1;};
        for(const run of maskedRiverRuns(f.geometry.coordinates,wet)){
          const points=run.map(([lon,lat])=>{const p=map.latLngToContainerPoint([lat,lon]);return[p.x,p.y];});
          if(points.some(p=>p[0]>=-50&&p[0]<=size.x+50&&p[1]>=-50&&p[1]<=size.y+50))riverPaths.push({points,directed:f.properties.directed,id:f.properties.id});
        }
      }
    }
    if(field){
      // Uniform geographic releases, independent of velocity: line count is not volume.
      const total=Math.min(650,Math.max(170,Math.floor(size.x*size.y/1900)));
      const west=Math.max(visible.getWest(),field.lon0),east=Math.min(visible.getEast(),field.lon0+(field.shape[2]-1)*field.dlon);
      const south=Math.max(visible.getSouth(),field.lat0),north=Math.min(visible.getNorth(),field.lat0+(field.shape[1]-1)*field.dlat);
      for(let i=0;i<total*3&&paths.length<total;i++){
        const lon=west+rng()*(east-west),lat=south+rng()*(north-south),raw=streamline(field,lon,lat,110,1800);
        if(raw.length<8)continue;
        const runs=currentDiagnostic()==='vorticity'?vorticityPathRuns(raw,vorticity):[raw];
        for(const run of runs){if(paths.length>=total)break;paths.push({points:run.map(p=>{const pos=map.latLngToContainerPoint([p[1],p[0]]);return [pos.x,pos.y,p[2]];}),offset:rng()*run.length});}
      }
    }
    renderField();applyCompare();dirty=false;
  }
  function renderField() {
    const size=map.getSize();fieldCtx.clearRect(0,0,size.x,size.y);
    if(!field||state.layer!=='currents'||!state.speedShading)return;
    const palette=currentDiagnostic()==='vorticity'?vorticityColor:speedColor;
    const raster=currentDiagnostic()==='vorticity'?vorticityRaster(vorticity,palette):velocityRaster(field,palette),source=document.createElement('canvas');source.width=raster.width;source.height=raster.height;
    const ctx=source.getContext('2d'),pixels=ctx.createImageData(raster.width,raster.height);pixels.data.set(raster.data);ctx.putImageData(pixels,0,0);
    // Project native latitude strips into Mercator without dropping coastal
    // nodes. Transparent source cells remain transparent.
    const [west,south,east]=raster.bounds,x0=map.latLngToContainerPoint([south,west]).x,x1=map.latLngToContainerPoint([south,east]).x;
    fieldCtx.imageSmoothingEnabled=true;
    for(let y=0;y<raster.height;y++){const lat=south+y*field.dlat,top=map.latLngToContainerPoint([lat+field.dlat,west]).y,bottom=map.latLngToContainerPoint([lat,west]).y;if(bottom<0||top>size.y)continue;fieldCtx.drawImage(source,0,raster.height-1-y,raster.width,1,x0,top,x1-x0,bottom-top);}
  }
  function drawFlow() {
    const {x:w,y:h}=map.getSize();flowCtx.clearRect(0,0,w,h);if(!state.flow||moving)return;
    flowCtx.lineCap='round';
    function trail(points,interval,colorAt,width,maxAlpha){
      const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      for(let i=Math.floor(interval.start);i<Math.ceil(interval.end);i++){
        const lo=Math.max(interval.start,i),hi=Math.min(interval.end,i+1);if(hi<=lo)continue;
        const a=mix(points[i],points[i+1],lo-i),b=mix(points[i],points[i+1],hi-i),at=(lo+hi)/2;
        const fade=Math.max(0,1-(interval.head-at)/interval.tail)*Math.min(1,at/2,(points.length-1-at)/2);
        flowCtx.strokeStyle=`rgba(${colorAt(at).join(',')},${maxAlpha*fade})`;flowCtx.lineWidth=width;
        flowCtx.beginPath();flowCtx.moveTo(...a);flowCtx.lineTo(...b);flowCtx.stroke();
      }
    }
    // River rates remain illustrative; ocean intervals retain their source time.
    for(const p of riverPaths){if(p.directed)for(const interval of trailIntervals(p.points.length-1,phase*.65-(p.id%997)/997*18))trail(p.points,interval,()=>[213,245,232],1.8,.76);}
    const palette=currentDiagnostic()==='vorticity'?vorticityColor:speedColor;
    for(const p of paths)for(const interval of trailIntervals(p.points.length-1,phase*CURRENT_SAMPLES_PER_SECOND+p.offset))trail(p.points,interval,at=>palette(p.points[Math.min(p.points.length-1,Math.floor(at))][2]),2.3,.96);
  }
  function animation(time) {
    const dt=Math.min(.1,(time-last)/1000||0);last=time;
    if(!document.hidden&&state.tab!=='prints'){if(state.playing)phase+=dt;if(state.view==='flat'){if(dirty&&!moving)geometry();drawFlow();}
      if(state.cycle&&state.playing&&time-lastCycle>3000){lastCycle=time;void selectFrame(state.frame+1);}}
    requestAnimationFrame(animation);
  }
  async function inspect(event) {
    if(state.present)return;const stamp=++profileEpoch,{lng:lon,lat}=event.latlng,p=state.place,frame=p.frames?.[state.frame];
    if(p.source==='hycom'){
      const targetDate=layer?.dates?.[state.frame]||null,region=sourceCatalog().regions.find(r=>r.id===p.id);
        el('inspector').hidden=false;el('inspector-title').textContent=currentDiagnostic()==='vorticity'?'Velocity and vorticity with depth':'Velocity with depth';
      el('spectra-chart').innerHTML=`<strong>${safe(p.title)}</strong><p>${Math.abs(lat).toFixed(4)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(4)}° ${lon<0?'W':'E'}</p><p>Loading the released HYCOM depth levels…</p>`;
      el('spectra-note').textContent='Each row is a discrete horizontal-velocity level. No vertical velocity or values between levels are inferred.';
      try{
        const profiles=await Promise.all(region.layers.map(loadVelocity));if(stamp!==profileEpoch||state.place!==p)return;
        const rows=velocityDepthProfile(profiles,{date:targetDate,lon,lat});
        const zetas=currentDiagnostic()==='vorticity'?profiles.map((source,i)=>{
          const date=rows[i].date,index=source.dates?.reduce((best,d,j)=>Math.abs(Date.parse(d)-Date.parse(date))<Math.abs(Date.parse(source.dates[best])-Date.parse(date))?j:best,0)??0;
          return sampleVorticity(relativeVorticity(snapshotField(source,index)),lon,lat);
        }):null;
        const ticks=`<div class="velocity-profile-axis"><span>Depth</span><span><i>0</i><i>0.4</i><i>≥0.8 m/s</i></span><span>Speed</span><span>Direction</span>${zetas?'<span>ζ · 10⁻⁵ s⁻¹</span>':''}</div>`;
        const records=rows.map((r,i)=>{const valid=r.speed!==null,bar=valid?Math.min(100,r.speed/.8*100):0,fill=valid?`background:rgb(${speedColor(r.speed).join(' ')})`:'';
          const direction=valid&&r.direction!==null?`<span class="velocity-direction" title="Toward ${r.direction.toFixed(0)}° clockwise from north" style="transform:rotate(${r.direction}deg)">↑</span>${r.direction.toFixed(0)}°`:'—';
          const zeta=zetas?.[i],zetaCell=zetas?`<span class="velocity-profile-zeta" style="${Number.isFinite(zeta)?`color:rgb(${vorticityColor(zeta).join(' ')})`:''}">${Number.isFinite(zeta)?(zeta*1e5).toFixed(2):'—'}</span>`:'';
          return `<div class="velocity-profile-row${r.depth===state.depth?' is-selected':''}" data-depth="${r.depth}"><span>${r.depth===0?'Surface':r.depth.toLocaleString()+' m'}</span>${valid?`<span class="velocity-profile-bar"><i style="width:${bar}%;${fill}"></i></span><b>${r.speed.toFixed(3)}</b><span class="velocity-profile-direction">${direction}</span>`:'<span class="velocity-profile-missing">No valid sample</span><b>n/a</b><span>n/a</span>'}${zetaCell}</div>`;}).join('');
        el('spectra-chart').innerHTML=`<strong>${safe(p.title)}</strong><p>${Math.abs(lat).toFixed(4)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(4)}° ${lon<0?'W':'E'} · ${targetDate?dateLabel(targetDate):'selected snapshot'}</p><div class="velocity-profile${zetas?' has-vorticity':''}">${ticks}${records}</div>`;
        el('spectra-note').textContent=`HYCOM model analysis · dates matched to the nearest available snapshot at each level. Rows are discrete horizontal-velocity levels; values between depths and vertical velocity are not inferred.${zetas?' ζ is signed vertical relative vorticity of the horizontal flow at each level, using a strict spherical centered stencil.':''} Bars use the fixed 0–0.8 m/s speed scale. Directions are toward, clockwise from north. Vertical exaggeration: 1×.`;
      }catch(error){if(stamp===profileEpoch){el('spectra-chart').innerHTML=`<strong>${safe(p.title)}</strong><p>Depth profile unavailable: ${safe(error.message)}</p>`;}}
      return;
    }
    let text=`<strong>${Math.abs(lat).toFixed(4)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(4)}° ${lon<0?'W':'E'}</strong>`;
    if(field){const v=sampleAt(field,lon,lat),zeta=currentDiagnostic()==='vorticity'?sampleVorticity(vorticity,lon,lat):null;text+=v?`<p>${Math.hypot(...v).toFixed(3)} m/s · toward ${((Math.atan2(v[0],v[1])*180/Math.PI+360)%360).toFixed(0)}°</p>${currentDiagnostic()==='vorticity'?`<p>${zeta===null?'Relative vorticity unavailable at this point (strict stencil masked).':`ζ ${(zeta*1e5).toFixed(2)} × 10⁻⁵ s⁻¹ · ${zeta>0?'counter-clockwise':'clockwise'} viewed from above`}</p>`:''}<small>${state.depth} m · ${safe(el('date').textContent)}<br/>${p.source==='radar'?'Observed HF radar':p.source==='hycom'?'HYCOM model analysis':'NOAA/AOML drifter-derived climatology'}</small>`:'<p>No valid velocity sample here.</p><small>Missing cells remain missing.</small>';}
    if(p.source==='drifter'&&state.layer==='currents')text+=`<p>NOAA Global Drifter Program values represent one nominal drogue depth: 15 m. This climatology has no vertical profile.</p><p><a href="/hidden-rivers/?place=agulhas&amp;layer=currents&amp;depth=0&amp;tab=ocean">Explore Agulhas HYCOM levels from surface to 2,000 m ↗</a></p>`;
    if(frame){const pixel=indexPixel(p.bounds,frame.indexShape,lon,lat);const value=pixel&&indexValues?.[pixel[1]*frame.indexShape[1]+pixel[0]];
      if(pixel&&spectra){const offset=(pixel[1]*frame.indexShape[1]+pixel[0])*4,measured=spectralSample(Array.from(spectra.slice(offset,offset+4)),p.waterPca);if(measured){samples.push({...measured,lat,lon});samples=samples.slice(-2);renderSpectra();return;}}
      text+=value!==undefined&&value!==-32768?`<p>NDWI ${(value/10000).toFixed(3)}</p><small>${dateLabel(frame.date)} · sampled spectral index<br/>Not a speed, depth or water-quality estimate.</small>`:'<p>No clear Sentinel-2 sample here.</p><small>The background is satellite context.</small>';}
    if(state.view==='world'||p.source==='drifter'&&state.layer==='currents'){el('inspector').hidden=false;el('inspector-title').textContent='Current at this point';el('spectra-chart').innerHTML=text;el('spectra-note').textContent='';}else L.popup({maxWidth:280}).setLatLng(event.latlng).setContent(text).openOn(map);
  }
  function revealPresent(){const controls=root.parentElement.querySelector('.atlas-presentation-controls');controls.classList.add('revealed');clearTimeout(presentTimer);presentTimer=setTimeout(()=>controls.classList.remove('revealed'),1800);}
  async function exportMap(){
    if(state.view==='world'&&world){const a=document.createElement('a');a.href=world.save();a.download=`hidden-rivers-${state.place.id}-${state.layer}-globe.png`;a.click();return;}
    const rect=root.getBoundingClientRect(),output=document.createElement('canvas'),scale=2;
    output.width=rect.width*scale;output.height=rect.height*scale;const ctx=output.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#0b2636';ctx.fillRect(0,0,rect.width,rect.height);
    function draw(node,clip=false){const r=node.getBoundingClientRect();if(!r.width||!r.height)return;ctx.save();if(clip&&state.compare){ctx.beginPath();ctx.rect(rect.width*Number(el('swipe').value)/100,0,rect.width,rect.height);ctx.clip();}ctx.drawImage(node,r.left-rect.left,r.top-rect.top,r.width,r.height);ctx.restore();}
    try{
      ctx.filter='brightness(.94) saturate(.96)';root.querySelectorAll('.leaflet-tile-loaded').forEach(tile=>{if(tile.complete&&tile.naturalWidth)draw(tile);});ctx.filter='none';
      images.forEach((image,i)=>draw(image.getElement(),i===1));draw(fieldCanvas);draw(flowCanvas);
      ctx.fillStyle='rgba(7,28,37,.85)';ctx.fillRect(0,rect.height-25,rect.width,25);ctx.fillStyle='#d1e4dc';ctx.font='10px monospace';
      const source=state.place.frames?'Copernicus Sentinel-2 L2A':state.place.source==='hycom'?`HYCOM · ${state.depth} m`:'NOAA GDP · 15 m · climatology';
      ctx.fillText(`${state.place.title} · ${LABELS[state.layer]} · ${el('date').textContent} · ${source} · Imagery © Esri, Maxar, Earthstar Geographics`,12,rect.height-9);
      const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export unavailable');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hidden-rivers-${state.place.id}-${state.layer}-${state.frame}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){el('export').textContent='Imagery export unavailable. Try again when the tiles finish loading.';console.error(error);}
  }
  async function present(on) {
    state.present=on;const atlas=document.getElementById('atlas');atlas.classList.toggle('atlas-is-presenting',on);atlas.querySelector('.atlas-presentation-controls').hidden=!on;
    if(state.tab==='prints')el('prints').contentWindow?.postMessage({type:'hidden-rivers-present',active:on},location.origin);
    if(on){previousFocus=document.activeElement;browse(false);map.closePopup();try{await atlas.requestFullscreen?.();}catch{}root.focus();}
    else{if(document.fullscreenElement===atlas)await document.exitFullscreen();previousFocus?.focus();}
    map.invalidateSize();world?.viewer.resize();dirty=true;
  }
  function nextPlace(delta){if(state.tab==='prints'){el('prints').contentWindow?.postMessage({type:'hidden-rivers-move',direction:delta},location.origin);return;}if(state.present&&state.story){void storyChapter(state.chapter+delta);return;}const list=places.filter(p=>collectionFor(p)===state.tab),i=list.findIndex(p=>p.id===state.place.id);void selectPlace(list[(i+delta+list.length)%list.length].id);}
  document.querySelector('.atlas-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-atlas-tab]');if(b)void selectTab(b.dataset.atlasTab);});
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===el('prints').contentWindow){if(e.data?.type==='hidden-rivers-exit')void present(false);if(e.data?.type==='hidden-rivers-present-request')void present(true);if(e.data?.type==='hidden-rivers-explore'){const url=new URL(e.data.url,location.origin);if(url.origin!==location.origin)return;if(url.pathname==='/hidden-rivers/research/'){location.assign(url.href);return;}const q=atlasQuery(url.search);void selectPlace(q.get('place')||q.get('region')||'agulhas',false,{depth:Number(q.get('depth'))||0,layer:q.get('layer')||'currents'});}}});
  map.on('movestart zoomstart',()=>{moving=true;flowCtx.clearRect(0,0,flowCanvas.width,flowCanvas.height);fieldCtx.clearRect(0,0,fieldCanvas.width,fieldCanvas.height);});
  map.on('moveend zoomend resize',()=>{moving=false;dirty=true;saveURL();});map.on('click',inspect);
  el('browse').addEventListener('click',()=>browse(el('places').hidden));el('close-places').addEventListener('click',()=>browse(false));el('search').addEventListener('input',renderPlaces);
  el('places').addEventListener('click',e=>{const button=e.target.closest('button');if(button?.dataset.place)void selectPlace(button.dataset.place);if(button?.dataset.group){group=button.dataset.group;el('places').querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderPlaces();}});
  el('layers').addEventListener('click',async e=>{const button=e.target.closest('[data-layer]');if(!button)return;profileEpoch++;state.layer=button.dataset.layer;if(state.layer==='rgb')state.compare=false;try{await displayFrame();}catch(error){setStatus(error.message);}});
  el('grid').addEventListener('change',()=>{const date=layer?.dates?.[state.frame],camera=world?.getCamera();state.grid=el('grid').value;void selectPlace(state.place.id,false,{depth:state.depth,grid:state.grid,layer:state.layer,date,camera,story:true});});
  el('flow').addEventListener('change',()=>{state.flow=el('flow').checked;controls();saveURL();});
  el('diagnostic-mode').addEventListener('change',()=>{state.diagnostic=el('diagnostic-mode').value;dirty=true;renderField();void syncWorld();controls();saveURL();});
  el('speed-shading').addEventListener('change',()=>{state.speedShading=el('speed-shading').checked;renderField();void syncWorld();controls();saveURL();});
  el('depth-rail').addEventListener('click',e=>{const b=e.target.closest('[data-depth]');if(b){el('depth').value=b.dataset.depth;el('depth').dispatchEvent(new Event('change'));}});
  el('depth').addEventListener('change',async()=>{const stamp=++epoch,date=layer.dates?.[state.frame];state.depth=Number(el('depth').value);if(state.depth===0)state.subsurface=false;const chapter=WATER_STORIES.find(s=>s.id===state.story)?.steps.findIndex(s=>s.place===state.place.id&&s.depth===state.depth);if(chapter>=0){state.chapter=chapter;renderStory();}setStatus('Loading '+state.depth+' m velocity…');field=null;vorticity=null;paths=[];dirty=true;try{const meta=sourceCatalog().regions.find(r=>r.id===state.place.id).layers.find(l=>l.depth===state.depth);const next=await loadVelocity(meta);if(stamp!==epoch)return;layer=next;state.frame=date?layer.dates.reduce((best,d,i)=>Math.abs(Date.parse(d)-Date.parse(date))<Math.abs(Date.parse(layer.dates[best])-Date.parse(date))?i:best,0):Math.min(state.frame,layer.shape[0]-1);await displayFrame();setStatus('');}catch(error){setStatus(error.message);}});
  el('subsurface').addEventListener('change',()=>{state.subsurface=el('subsurface').checked;if(state.subsurface)state.speedShading=false;void syncWorld();controls();saveURL();});
  el('play').addEventListener('click',()=>{state.playing=!state.playing;controls();});el('time').addEventListener('input',()=>void selectFrame(Number(el('time').value)));
  el('previous').addEventListener('click',()=>void selectFrame(state.frame-1));el('next').addEventListener('click',()=>void selectFrame(state.frame+1));
  el('cycle').addEventListener('click',()=>{state.cycle=!state.cycle;if(state.cycle){state.playing=true;lastCycle=performance.now();}controls();});
  el('compare').addEventListener('click',()=>{state.compare=!state.compare;void displayFrame();});el('swipe').addEventListener('input',applyCompare);
  el('zoom-in').addEventListener('click',()=>state.view==='world'?world?.zoom(.3):map.zoomIn());el('zoom-out').addEventListener('click',()=>state.view==='world'?world?.zoom(-.4):map.zoomOut());el('fit').addEventListener('click',fit);el('world-home').addEventListener('click',()=>void selectPlace('global'));
  el('share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+shareURL());setStatus('View link copied');setTimeout(()=>setStatus(''),1500);}catch{setStatus('Copy the address bar to share this view.');}});
  el('info').addEventListener('click',()=>{dataContent();el('data').showModal();});el('close-info').addEventListener('click',()=>el('data').close());el('data').addEventListener('click',e=>{if(e.target===el('data')){const r=el('data').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el('data').close();}});
  el('export').addEventListener('click',()=>void exportMap());
  el('stories').addEventListener('click',()=>{storyLibrary();el('story-library').hidden=!el('story-library').hidden;el('places').hidden=true;});el('stories-close').addEventListener('click',()=>el('story-library').hidden=true);
  el('story-list').addEventListener('click',e=>{const b=e.target.closest('[data-story]');if(b)void storyChapter(0,b.dataset.story);});
  el('story-dots').addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(b)void storyChapter(Number(b.dataset.chapter));});el('story-back').addEventListener('click',()=>void storyChapter(state.chapter-1));el('story-next').addEventListener('click',()=>void storyChapter(state.chapter+1));
  el('story-read').addEventListener('click',()=>{const on=el('story').classList.toggle('story-expanded');el('story-read').setAttribute('aria-expanded',String(on));el('story-read').textContent=on?'Less':'Read';});
  el('controls-toggle').addEventListener('click',()=>{const on=document.getElementById('atlas').classList.toggle('atlas-controls-open');el('controls-toggle').setAttribute('aria-expanded',String(on));el('controls-toggle').textContent=on?'Close controls ↓':matchMedia('(min-width:761px)').matches?'Time & color ↑':'Layers & time ↑';});
  el('story-close').addEventListener('click',()=>{state.story=null;renderStory();saveURL();});
  el('view-world').addEventListener('click',()=>void setView('world'));el('view-flat').addEventListener('click',()=>void setView('flat'));
  el('tilt').addEventListener('click',()=>{state.tilt=!state.tilt;world?.fit(state.place,{tilt:state.tilt});});el('orbit').addEventListener('click',()=>{state.orbit=!state.orbit;world?.setOrbit(state.orbit);el('orbit').setAttribute('aria-pressed',String(state.orbit));});
  el('blend').addEventListener('change',()=>{state.blend=el('blend').value;void displayFrame();});el('spectral-controls').addEventListener('click',e=>{const b=e.target.closest('[data-palette]');if(b){state.palette=b.dataset.palette;void displayFrame();}});
  el('inspector-close').addEventListener('click',()=>{profileEpoch++;samples=[];el('inspector').hidden=true;});
  el('world').addEventListener('pointermove',()=>{if(state.present)revealPresent();});el('world').addEventListener('pointerdown',()=>{if(state.present)revealPresent();});
  el('present').addEventListener('click',()=>void present(true));el('present-exit').addEventListener('click',()=>void present(false));el('present-previous').addEventListener('click',()=>nextPlace(-1));el('present-next').addEventListener('click',()=>nextPlace(1));el('present-pause').addEventListener('click',()=>{state.playing=!state.playing;el('present-pause').textContent=state.playing?'Ⅱ':'▷';controls();});
  root.addEventListener('pointermove',()=>{if(state.present){clearTimeout(pointerTimer);revealPresent();}});root.addEventListener('pointerdown',()=>{if(state.present)revealPresent();});
  document.addEventListener('fullscreenchange',()=>{if(state.present&&!document.fullscreenElement)void present(false);});
  document.addEventListener('keydown',e=>{if(el('data').open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape'){if(state.present)void present(false);else browse(false);}if(state.present){if(e.key==='ArrowRight'){e.preventDefault();nextPlace(1);}if(e.key==='ArrowLeft'){e.preventDefault();nextPlace(-1);}if(e.code==='Space'){e.preventDefault();state.playing=!state.playing;controls();}}});
  new ResizeObserver(()=>{map.invalidateSize();dirty=true;}).observe(root);
  try{
    [manifest,hycom,drifter]=await Promise.all([get(BASE+'manifest.json'),get('/hidden-rivers/data/manifest.json'),get(BASE+'drifter.json')]);
    originalHycom=hycom;try{hycom=await get(BASE+'native-hycom/manifest.json');}catch{}
    try{radar=await get(BASE+'nc-radar.json');}catch{}
    places=[...manifest.places,...OCEANS,...(radar?[radar]:[])];
    if(matchMedia('(min-width:761px)').matches)el('controls-toggle').textContent='Time & color ↑';
    const aliases={hatteras:'outer-banks',nemo:'point-nemo',cape:'agulhas',peninsula:'agulhas'};
    const first=WATER_STORIES.find(s=>s.id===state.story)?.steps[state.chapter]||WATER_STORIES[0].steps[0];
    const requested=query.get('place')||query.get('region')||first.place;
    await selectPlace(aliases[requested]||requested,true,state.story?{...first,palette:query.get('palette')||first.palette,blend:query.get('blend')||first.blend,story:true}:{});resize();requestAnimationFrame(animation);renderStory();storyLibrary();
    window.__waterAtlas={map,state,places,selectPlace,selectFrame,selectTab,storyChapter,setView,inspect,getWorld:()=>world,getField:()=>field,getRivers:()=>rivers,getPaths:()=>paths,ready:()=>Boolean(state.place&&(displayedEntries.length||field)),present};
    if(state.view==='world'&&query.get('tab')!=='prints')await setView('world');else controls();
    if(query.get('tab')==='prints')await selectTab('prints');
  }catch(error){setStatus('Atlas data could not load. Reload to retry.');console.error(error);}
}
