import L from 'leaflet';
import { unpackField, snapshotField, sampleAt, streamline, seeded, indexPixel } from './atlas-math.mjs';

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
const LABELS = {rgb:'Satellite',pca:'Spectral PCA',water:'Water index',currents:'Currents',salinity:'Salinity'};
const dateLabel = date => new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const shortDate = date => new Date(date).toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'});
const leafletBounds = b => [[b[1],b[0]],[b[3],b[2]]];
const safe = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = [[38,62,104],[57,123,147],[84,188,168],[216,219,170],[239,178,105]];
function color(speed) {
  const t = Math.min(4,Math.max(0,speed/.8*4)), i = Math.floor(t), f=t-i;
  return colors[i].map((v,c)=>Math.round(v*(1-f)+colors[Math.min(4,i+1)][c]*f));
}

export async function startWaterAtlas() {
  const el = id => document.getElementById('atlas-'+id), root=el('map'); if (!root) return;
  const query = new URLSearchParams(location.search), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(root,{zoomControl:false,preferCanvas:true,zoomSnap:.25,minZoom:2,maxZoom:18,
    scrollWheelZoom:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,
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
  const state={place:null,layer:'rgb',frame:0,depth:0,playing:!reduced,flow:true,cycle:false,compare:false,present:false};
  let places=[],manifest,hycom,drifter,field=null,layer=null,rivers=null,paths=[],riverPaths=[],images=[],epoch=0,imageEpoch=0,indexValues=null,waterCandidates=null;
  let phase=0,last=0,lastCycle=0,dirty=true,moving=false,presentTimer,previousFocus,group='all',pointerTimer;
  const setStatus=text=>{el('status').textContent=text;};
  const bounds=()=>leafletBounds(state.place.bounds);
  function resize() {
    const {x:w,y:h}=map.getSize(),ratio=Math.min(devicePixelRatio||1,2);
    for(const canvas of [flowCanvas,fieldCanvas]){canvas.width=w*ratio;canvas.height=h*ratio;canvas.style.width=w+'px';canvas.style.height=h+'px';}
    flowCtx.setTransform(ratio,0,0,ratio,0,0);fieldCtx.setTransform(ratio,0,0,ratio,0,0);dirty=true;
  }
  function fit() {
    map.stop();
    map.fitBounds(bounds(),{padding:[24,24],animate:false});
  }
  function shareURL() {
    const c=map.getCenter(),p=new URLSearchParams({place:state.place.id,layer:state.layer,frame:String(state.frame),depth:String(state.depth),lat:c.lat.toFixed(5),lon:c.lng.toFixed(5),zoom:map.getZoom().toFixed(2)});
    if(!state.flow)p.set('flow','0'); if(state.compare)p.set('compare','1');
    return `${location.pathname}?${p}`;
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
      const depths=p.source==='hycom'?hycom.regions.find(r=>r.id===p.id).layers.map(l=>l.depth):[];
      return heading+`<button class="place-card" type="button" data-place="${p.id}" aria-current="${p.id===state.place?.id}">${thumb?`<img src="${BASE+thumb}" alt="" loading="lazy"/>`:'<span class="place-ocean-thumb" aria-hidden="true"></span>'}<span>${safe(p.title)}<small>${p.frames?'Sentinel-2 · PCA · dated scenes':p.source==='hycom'?depths.length>1?'HYCOM · surface to 2,000 m':`HYCOM · ${depths[0].toLocaleString()} m`:'NOAA drifter currents · 15 m'}</small></span></button>`;
    }).join('')||'<p class="places-empty">No places match. Try “Amazon”, “reef”, or “current”.</p>';
  }
  function availableLayers() {return state.place.frames?['rgb','pca','water']:state.place.salinity?['currents','rgb','salinity']:['currents','rgb'];}
  function controls() {
    const p=state.place,frames=p.frames;
    el('place-name').textContent=p.title;el('title').textContent=p.title;el('place-group').textContent=p.group.toUpperCase();el('note').textContent=p.note;
    el('layers').innerHTML=availableLayers().map(id=>`<button type="button" data-layer="${id}" aria-pressed="${state.layer===id}">${LABELS[id]}</button>`).join('');
    el('flow-label').hidden=!p.rivers&&!p.source;el('flow-label').querySelector('span').textContent=p.rivers?'River direction':'Flow paths';el('flow').checked=state.flow;
    el('depth-label').hidden=!p.source;
    const depths=p.source==='hycom'?hycom.regions.find(r=>r.id===p.id).layers.map(l=>l.depth):[15];
    if(p.source)el('depth').innerHTML=depths.map(d=>`<option value="${d}" ${d===state.depth?'selected':''}>${d===0?'Surface':d.toLocaleString()+' m'}</option>`).join('');
    const count=frames?frames.length:layer?.shape[0]||12;
    el('time').max=String(count-1);el('time').value=String(state.frame);el('time').disabled=count<2;
    el('time').setAttribute('aria-label',frames?'Satellite acquisition':p.source==='hycom'?'Velocity snapshot':'Climatology month');
    el('date').textContent=frames?dateLabel(frames[state.frame].date):p.source==='hycom'?dateLabel(layer.dates[state.frame])+' · '+new Date(layer.dates[state.frame]).toISOString().slice(11,16)+' UTC':MONTHS[state.frame]+' · monthly climatology';
    el('cadence').textContent=frames?'Discrete acquisitions':p.source==='hycom'?'Source velocity snapshots':'Seasonal mean · through Feb 2023';
    const ticks=frames?frames.map(f=>shortDate(f.date)):p.source==='hycom'?[shortDate(layer.dates[0]),shortDate(layer.dates.at(-1))]:['JAN','APR','JUL','OCT','DEC'];
    el('date-ticks').innerHTML=ticks.map(t=>`<span>${safe(t)}</span>`).join('');
    el('play').dataset.playing=String(state.playing);el('play').setAttribute('aria-label',state.playing?'Pause animation':'Play animation');
    el('play').disabled=!p.rivers&&!p.source&&!state.cycle;
    el('cycle').textContent=frames?'Time-lapse':'Cycle dates';el('cycle').setAttribute('aria-pressed',String(state.cycle));el('cycle').disabled=count<2;
    el('compare').hidden=!frames||state.layer==='rgb';el('compare').setAttribute('aria-pressed',String(state.compare));el('compare-slider').hidden=!state.compare;
    el('compare-name').textContent=LABELS[state.layer];
    const frame=frames?.[state.frame];
    el('evidence').textContent=frames?`Sentinel-2 L2A · ${Math.round(p.raster.displayPixelMetres)} m display pixels · ${Math.round(frame.validFraction*100)}% clear${p.rivers?' · HydroRIVERS direction; animation rate is illustrative':''}`:
      state.layer==='salinity'?'SMAP surface salinity · 0.25° source grid · dated daily retrieval; coastal pixels can be unreliable':p.source==='hycom'?`HYCOM analysis · ${state.depth===0?'surface':state.depth+' m below sea level'} · instantaneous streamlines · motion 21,600×`:
      'NOAA/AOML drifter climatology · 15 m drogue · 1° display grid · motion 21,600×; not observed tracks';
    legend();dataContent();
  }
  function legend() {
    const p=state.place;
    if(state.layer==='currents'||(!p.frames&&state.flow&&state.layer==='rgb'))el('legend').innerHTML='<strong>Current speed · m/s</strong><div class="atlas-colorbar"></div><div class="ticks"><span>0</span><span>0.4</span><span>≥0.8</span></div><p>Direction follows the selected velocity field. No vertical exaggeration.</p>';
    else if(state.layer==='water')el('legend').innerHTML='<strong>Water index · NDWI</strong><div class="atlas-colorbar water"></div><div class="ticks"><span>−1</span><span>0</span><span>+1</span></div><p>Green vs near-infrared reflectance. Positive values often indicate water.</p>';
    else if(state.layer==='pca')el('legend').innerHTML=`<strong>Spectral PCA</strong><p>Lightness: PC1<br/>Color: PC2 & PC3<br/>One basis across ${p.frames.length} dates.</p>`;
    else if(state.layer==='salinity')el('legend').innerHTML='<strong>Surface salinity · psu</strong><div class="atlas-colorbar salinity"></div><div class="ticks"><span>20</span><span>29</span><span>38</span></div><p>SMAP · 15 July 2024<br/>Separate from current climatology.</p>';
    else el('legend').innerHTML=p.frames?'<strong>Surface reflectance</strong><p>Sentinel-2 · B4 / B3 / B2<br/>Cloud and shadow masked.<br/>Click a pixel to inspect NDWI.</p>':'<strong>Satellite context</strong><p>Esri World Imagery.<br/>Basemap acquisition dates vary.</p>';
  }
  function dataContent() {
    const p=state.place,f=p.frames?.[state.frame];
    el('data-content').innerHTML=f?`<h3>${safe(p.title)} · ${dateLabel(f.date)}</h3><p>Four <a href="https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a" target="_blank" rel="noopener">Copernicus Sentinel-2 Level-2A</a> surface-reflectance bands are read from public georeferenced rasters. Natural color uses B4/B3/B2. PCA uses centered B2/B3/B4/B8 covariance, with one basis and one 2–98% stretch fitted across this place’s dates. PC1 controls lightness; PC2 and PC3 control two restrained CIELAB color axes. Exact loadings and display transforms are recorded below. Reflectance-offset handling was checked against independently stored Collection 1 pixels; <a href="/hidden-rivers/water-atlas/calibration-validation.json" target="_blank" rel="noopener">the calibration check</a> records its scope. PCA colors show spectral differences; they do not classify pollution, coral health or water depth.</p><dl><dt>Acquisition</dt><dd>${safe(f.id)}</dd><dt>Clear AOI pixels</dt><dd>${(100*f.validFraction).toFixed(1)}%</dd><dt>Native bands</dt><dd>10 m; display pixels ${Math.round(p.raster.displayPixelMetres)} m</dd><dt>PCA variance</dt><dd>${p.pca.varianceExplained.slice(0,3).map(v=>(v*100).toFixed(1)+'%').join(' / ')}</dd><dt>Water index</dt><dd>(B3 − B8) / (B3 + B8)</dd></dl><p>Cloud, shadow, saturation, cirrus and snow are masked using the scene classification layer. Transparent gaps show the Esri basemap, whose dates vary. Time-lapse switches among the actual acquisitions; the gaps are not filled with invented observations.</p>${p.rivers?'<h3>River direction</h3><p><a href="https://www.hydrosheds.org/products/hydrorivers" target="_blank" rel="noopener">HydroRIVERS v1.0</a> delineates reaches from HydroSHEDS elevation and drainage data at 15 arc-seconds (about 500 m at the equator). Moving marks follow verified downstream reach connections and appear only at clear-scene samples classified as water by Sentinel-2 SCL or with positive NDWI. These are water candidates, with classification uncertainty. They indicate direction only: the animation rate does not measure river velocity. The long-term discharge attribute is a WaterGAP estimate for 1971–2000, not a current gauge reading.</p>':''}<p><a href="${BASE+p.id+'/provenance.json'}" target="_blank" rel="noopener">Acquisitions, reflectance scales, PCA loadings & source URLs ↗</a></p>`:
      p.source==='hycom'?`<h3>${safe(p.title)} · ${state.depth===0?'surface':state.depth+' m'}</h3><p><a href="https://www.hycom.org/dataserver/espc-d-v02/global-analysis" target="_blank" rel="noopener">HYCOM / ESPC-D-V02</a> supplies eastward and northward horizontal velocity at the chosen depth. The map uses the released geographic grid and exact snapshot dates. Depth controls change the data, while geography stays flat at its true scale.</p><p>The animated lines are streamlines through one selected velocity snapshot, calculated with a midpoint method in geographic coordinates. Motion is accelerated 21,600 times for display. These graphics are not observed drifter tracks, forecasts, vertical motion, or a measure of transport volume. Missing grid corners stop a line.</p><p><a href="/hidden-rivers/data/manifest.json" target="_blank" rel="noopener">Velocity grid, dates, checksums & source records ↗</a></p>`:
      `<h3>Near-surface ocean circulation · 15 m</h3><p><a href="https://www.aoml.noaa.gov/phod/gdp/mean_velocity.php" target="_blank" rel="noopener">NOAA’s Global Drifter Program</a> estimates monthly climatological velocity from satellite-tracked drifting buoys with drogues centered at 15 m. This is a long-run seasonal pattern through February 2023, not today’s current or a forecast. The 0.25° source has been sampled every four grid cells to a 1° display grid.</p><p>Streamlines follow the selected monthly mean eastward and northward velocity. Their motion is accelerated 21,600 times for visibility. They are not the measured tracks of individual buoys. Colors encode speed in m/s; seed density and line count do not encode water volume. No flow is invented for missing cells.</p>${p.salinity?'<h3>Amazon freshwater plume</h3><p>The salinity layer is a <a href="https://oceanwatch.noaa.gov/cwn/products/sea-surface-salinity-near-real-time-smap.html" target="_blank" rel="noopener">NOAA SMAP</a> daily satellite-derived surface-salinity retrieval for 15 July 2024, on a native 0.25° grid. It is separate from the monthly current climatology and does not describe estuary-scale salinity.</p>':''}<p><a href="${BASE}drifter.json" target="_blank" rel="noopener">Grid, record period, source request & checksum ↗</a></p>`;
  }
  async function selectPlace(id, initial=false) {
    const p=places.find(p=>p.id===id)||places[0],stamp=++epoch;
    state.place=p;state.frame=0;state.compare=false;state.cycle=false;state.layer=p.frames?'rgb':'currents';state.depth=p.source==='hycom'?0:15;
    field=null;layer=null;rivers=null;paths=[];riverPaths=[];indexValues=null;removeImages();map.closePopup();dirty=true;
    el('title').textContent=p.title;el('place-name').textContent=p.title;el('note').textContent=p.note;el('place-group').textContent=p.group.toUpperCase();
    el('places').hidden=true;el('browse').setAttribute('aria-expanded','false');setStatus('Loading '+(p.frames?'satellite observations…':'velocity field…'));
    fit();
    try {
      if(p.frames&&p.rivers){const loaded=await get(BASE+p.rivers);if(stamp!==epoch)return;rivers=loaded;}
      if(p.source==='hycom'){
        const region=hycom.regions.find(r=>r.id===p.id);p.bounds=region.bounds;
        const requested=initial?Number(query.get('depth')):0;
        state.depth=region.layers.some(l=>l.depth===requested)?requested:region.layers[0].depth;
        const meta=region.layers.find(l=>l.depth===state.depth);
        const loaded=unpackField(meta,await get('/hidden-rivers/data/'+meta.file,'bytes'));
        if(stamp!==epoch)return;layer=loaded;
      } else if(p.source==='drifter') {
        const loaded=unpackField(drifter,await get(BASE+drifter.file,'bytes'));if(stamp!==epoch)return;layer=loaded;
      }
      if(stamp!==epoch)return;
      if(initial){state.frame=Math.min((p.frames?.length||layer?.shape[0]||1)-1,Math.max(0,Number(query.get('frame'))||0));state.layer=availableLayers().includes(query.get('layer'))?query.get('layer'):state.layer;state.flow=query.get('flow')!=='0';state.compare=query.get('compare')==='1'&&p.frames&&state.layer!=='rgb';}
      if(initial&&!query.has('frame')&&query.has('time')&&layer?.dates){const seconds=Number(query.get('time'));if(Number.isFinite(seconds)){const target=Date.parse(layer.dates[0])+seconds*1000;state.frame=layer.dates.reduce((best,d,i)=>Math.abs(Date.parse(d)-target)<Math.abs(Date.parse(layer.dates[best])-target)?i:best,0);}}
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
    const p=state.place,frame=p.frames?.[state.frame],stamp=++imageEpoch;indexValues=null;waterCandidates=null;
    if(layer)field=snapshotField(layer,state.frame);
    const desired=[];
    if(frame){
      desired.push({src:BASE+frame[state.compare?'rgb':state.layer],pane:'overlayPane'});
      if(state.compare)desired.push({src:BASE+frame[state.layer],pane:'satelliteCompare'});
      void get(BASE+frame.index,'bytes').then(b=>{if(stamp===imageEpoch){const view=new DataView(b);indexValues=new Int16Array(b.byteLength/2);for(let i=0;i<indexValues.length;i++)indexValues[i]=view.getInt16(i*2,true);}}).catch(()=>{});
      if(frame.waterCandidate)void get(BASE+frame.waterCandidate,'bytes').then(b=>{if(stamp===imageEpoch)waterCandidates=new Uint8Array(b);}).catch(()=>{});
    }else if(state.layer==='salinity'){desired.push({src:BASE+'amazon-salinity.webp',pane:'overlayPane',bbox:[-62,-4,-37,14]});}
    const next=await Promise.all(desired.map(entry=>new Promise((resolve,reject)=>{
      const overlay=L.imageOverlay(entry.src,entry.bbox?leafletBounds(entry.bbox):bounds(),{opacity:0,pane:entry.pane,interactive:false});
      overlay.once('load',()=>resolve(overlay));overlay.once('error',()=>{map.removeLayer(overlay);reject(Error('Satellite layer failed to load'));});overlay.addTo(map);
    })));
    if(stamp!==imageEpoch){next.forEach(o=>map.removeLayer(o));return;}
    images.forEach(o=>map.removeLayer(o));images=next;images.forEach(o=>o.setOpacity(1));applyCompare();dirty=true;controls();saveURL();
    const rest=p.frames?.filter(f=>f!==frame)||[];
    for(const f of rest){const image=new Image();image.src=BASE+f[state.layer];}
  }
  function applyCompare(){
    if(!state.compare||images.length<2)return;
    const rect=images[1].getElement().getBoundingClientRect(),container=root.getBoundingClientRect();
    const cut=Math.min(100,Math.max(0,100*(container.left+container.width*Number(el('swipe').value)/100-rect.left)/rect.width));
    images[1].getElement().style.clipPath=`inset(0 0 0 ${cut}%)`;
  }
  async function selectFrame(index) {
    const count=state.place.frames?.length||layer?.shape[0]||1;
    state.frame=(index+count)%count;map.closePopup();
    try{await displayFrame();}catch(e){setStatus(e.message);}
  }
  function geometry() {
    resize();paths=[];riverPaths=[];
    const size=map.getSize(),visible=map.getBounds(),rng=seeded(1800+state.frame);
    if(rivers){
      for(const f of rivers.features){
        const points=f.geometry.coordinates.map(([lon,lat])=>map.latLngToContainerPoint([lat,lon]));
        if(!points.some(p=>p.x>=-50&&p.x<=size.x+50&&p.y>=-50&&p.y<=size.y+50))continue;
        const segments=[];let length=0;
        for(let i=1;i<points.length;i++){const d=points[i].distanceTo(points[i-1]);segments.push({a:points[i-1],b:points[i],start:length,length:d});length+=d;}
        riverPaths.push({segments,length,q:f.properties.discharge,directed:f.properties.directed,id:f.properties.id});
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
        paths.push({points:raw.map(p=>{const pos=map.latLngToContainerPoint([p[1],p[0]]);return [pos.x,pos.y,p[2]];}),offset:rng()*raw.length});
      }
    }
    renderField();applyCompare();dirty=false;
  }
  function renderField() {
    const size=map.getSize();fieldCtx.clearRect(0,0,size.x,size.y);
    if(!field||state.layer!=='currents')return;
    // Bilinear display interpolation of the same strict wet-cell velocity
    // sampler as the lines. Smooth color does not add source resolution.
    const raster=document.createElement('canvas');raster.width=Math.ceil(size.x/6);raster.height=Math.ceil(size.y/6);
    const ctx=raster.getContext('2d'),data=ctx.createImageData(raster.width,raster.height);
    for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++){
      const position=map.containerPointToLatLng([x*6+3,y*6+3]),v=sampleAt(field,position.lng,position.lat);if(!v)continue;
      const rgb=color(Math.hypot(...v)),i=4*(y*raster.width+x);data.data.set([...rgb,155],i);
    }
    ctx.putImageData(data,0,0);fieldCtx.imageSmoothingEnabled=true;fieldCtx.drawImage(raster,0,0,size.x,size.y);
  }
  function drawFlow() {
    const {x:w,y:h}=map.getSize();flowCtx.clearRect(0,0,w,h);if(!state.flow||moving)return;
    if(rivers){
      for(const path of riverPaths){
        const width=Math.min(2.4,.6+Math.log10(Math.max(1,path.q))*.22);
        flowCtx.lineWidth=width;flowCtx.strokeStyle='rgba(129,231,213,.18)';flowCtx.beginPath();
        path.segments.forEach((s,i)=>{if(!i)flowCtx.moveTo(s.a.x,s.a.y);flowCtx.lineTo(s.b.x,s.b.y);});flowCtx.stroke();
        if(!path.directed||path.length<8)continue;
        // Explicitly a direction graphic. No inference of river speed from Q.
        const spacing=80,offset=(phase*18+(path.id%79))%spacing;
        flowCtx.fillStyle='rgba(229,255,224,.9)';
        for(let d=offset;d<path.length;d+=spacing){
          const s=path.segments.find(s=>s.start+s.length>=d);if(!s?.length)continue;
          const t=(d-s.start)/s.length,x=s.a.x+(s.b.x-s.a.x)*t,y=s.a.y+(s.b.y-s.a.y)*t;
          // Restrict moving direction marks to clear, positive-NDWI samples.
          // This combines the actual acquisition with the drainage geometry.
          const pos=map.containerPointToLatLng([x,y]),frame=state.place.frames[state.frame],pixel=indexPixel(state.place.bounds,frame.indexShape,pos.lng,pos.lat);
          const at=pixel?pixel[1]*frame.indexShape[1]+pixel[0]:-1,value=indexValues?.[at];
          if(!(waterCandidates?waterCandidates[at]===1:value>0))continue;
          flowCtx.beginPath();flowCtx.arc(x,y,1.8,0,2*Math.PI);flowCtx.fill();
        }
      }
    }
    if(field){
      flowCtx.lineCap='round';
      for(const path of paths){
        const pts=path.points,n=pts.length,head=(phase*12+path.offset)%n,start=Math.max(0,Math.floor(head)-20),end=Math.floor(head);
        for(let i=start+1;i<=end;i++){
          const alpha=.08+.67*(i-start)/Math.max(1,end-start),rgb=color(pts[i][2]);
          flowCtx.strokeStyle=`rgba(${rgb.map(c=>Math.min(255,c+55)).join(',')},${alpha})`;flowCtx.lineWidth=1.3;
          flowCtx.beginPath();flowCtx.moveTo(pts[i-1][0],pts[i-1][1]);flowCtx.lineTo(pts[i][0],pts[i][1]);flowCtx.stroke();
        }
      }
    }
  }
  function animation(time) {
    const dt=Math.min(.1,(time-last)/1000||0);last=time;
    if(!document.hidden){if(state.playing)phase+=dt;if(dirty&&!moving)geometry();drawFlow();
      if(state.cycle&&state.playing&&time-lastCycle>3000){lastCycle=time;void selectFrame(state.frame+1);}}
    requestAnimationFrame(animation);
  }
  async function inspect(event) {
    if(state.present)return;const {lng:lon,lat}=event.latlng,p=state.place,frame=p.frames?.[state.frame];
    let text=`<strong>${Math.abs(lat).toFixed(4)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(4)}° ${lon<0?'W':'E'}</strong>`;
    if(field){const v=sampleAt(field,lon,lat);text+=v?`<p>${Math.hypot(...v).toFixed(3)} m/s · toward ${((Math.atan2(v[0],v[1])*180/Math.PI+360)%360).toFixed(0)}°</p><small>${state.depth} m · ${safe(el('date').textContent)}<br/>${p.source==='hycom'?'Model analysis':'Drifter-derived climatology'}</small>`:'<p>No valid velocity sample here.</p><small>Missing cells remain missing.</small>';}
    if(frame){const pixel=indexPixel(p.bounds,frame.indexShape,lon,lat);const value=pixel&&indexValues?.[pixel[1]*frame.indexShape[1]+pixel[0]];
      text+=value!==undefined&&value!==-32768?`<p>NDWI ${(value/10000).toFixed(3)}</p><small>${dateLabel(frame.date)} · sampled spectral index<br/>Not a speed, depth or water-quality estimate.</small>`:'<p>No clear Sentinel-2 sample here.</p><small>The background is satellite context.</small>';}
    L.popup({maxWidth:280}).setLatLng(event.latlng).setContent(text).openOn(map);
  }
  function revealPresent(){const controls=root.parentElement.querySelector('.atlas-presentation-controls');controls.classList.add('revealed');clearTimeout(presentTimer);presentTimer=setTimeout(()=>controls.classList.remove('revealed'),1800);}
  async function exportMap(){
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
    if(on){previousFocus=document.activeElement;browse(false);map.closePopup();try{await atlas.requestFullscreen?.();}catch{}root.focus();}
    else{if(document.fullscreenElement===atlas)await document.exitFullscreen();previousFocus?.focus();}
    map.invalidateSize();dirty=true;
  }
  function nextPlace(delta){const i=places.findIndex(p=>p.id===state.place.id);void selectPlace(places[(i+delta+places.length)%places.length].id);}
  map.on('movestart zoomstart',()=>{moving=true;flowCtx.clearRect(0,0,flowCanvas.width,flowCanvas.height);fieldCtx.clearRect(0,0,fieldCanvas.width,fieldCanvas.height);});
  map.on('moveend zoomend resize',()=>{moving=false;dirty=true;saveURL();});map.on('click',inspect);
  el('browse').addEventListener('click',()=>browse(el('places').hidden));el('close-places').addEventListener('click',()=>browse(false));el('search').addEventListener('input',renderPlaces);
  el('places').addEventListener('click',e=>{const button=e.target.closest('button');if(button?.dataset.place)void selectPlace(button.dataset.place);if(button?.dataset.group){group=button.dataset.group;el('places').querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderPlaces();}});
  el('layers').addEventListener('click',async e=>{const button=e.target.closest('[data-layer]');if(!button)return;state.layer=button.dataset.layer;if(state.layer==='rgb')state.compare=false;try{await displayFrame();}catch(error){setStatus(error.message);}});
  el('flow').addEventListener('change',()=>{state.flow=el('flow').checked;controls();saveURL();});
  el('depth').addEventListener('change',async()=>{const stamp=++epoch,date=layer.dates?.[state.frame];state.depth=Number(el('depth').value);setStatus('Loading '+state.depth+' m velocity…');field=null;paths=[];dirty=true;try{const meta=hycom.regions.find(r=>r.id===state.place.id).layers.find(l=>l.depth===state.depth);const next=unpackField(meta,await get('/hidden-rivers/data/'+meta.file,'bytes'));if(stamp!==epoch)return;layer=next;state.frame=date?layer.dates.reduce((best,d,i)=>Math.abs(Date.parse(d)-Date.parse(date))<Math.abs(Date.parse(layer.dates[best])-Date.parse(date))?i:best,0):Math.min(state.frame,layer.shape[0]-1);await displayFrame();setStatus('');}catch(error){setStatus(error.message);}});
  el('play').addEventListener('click',()=>{state.playing=!state.playing;controls();});el('time').addEventListener('input',()=>void selectFrame(Number(el('time').value)));
  el('previous').addEventListener('click',()=>void selectFrame(state.frame-1));el('next').addEventListener('click',()=>void selectFrame(state.frame+1));
  el('cycle').addEventListener('click',()=>{state.cycle=!state.cycle;if(state.cycle){state.playing=true;lastCycle=performance.now();}controls();});
  el('compare').addEventListener('click',()=>{state.compare=!state.compare;void displayFrame();});el('swipe').addEventListener('input',applyCompare);
  el('zoom-in').addEventListener('click',()=>map.zoomIn());el('zoom-out').addEventListener('click',()=>map.zoomOut());el('fit').addEventListener('click',fit);el('world').addEventListener('click',()=>void selectPlace('global'));
  el('share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+shareURL());setStatus('View link copied');setTimeout(()=>setStatus(''),1500);}catch{setStatus('Copy the address bar to share this view.');}});
  el('info').addEventListener('click',()=>{dataContent();el('data').showModal();});el('close-info').addEventListener('click',()=>el('data').close());el('data').addEventListener('click',e=>{if(e.target===el('data')){const r=el('data').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el('data').close();}});
  el('export').addEventListener('click',()=>void exportMap());
  el('present').addEventListener('click',()=>void present(true));el('present-exit').addEventListener('click',()=>void present(false));el('present-previous').addEventListener('click',()=>nextPlace(-1));el('present-next').addEventListener('click',()=>nextPlace(1));el('present-pause').addEventListener('click',()=>{state.playing=!state.playing;el('present-pause').textContent=state.playing?'Ⅱ':'▷';controls();});
  root.addEventListener('pointermove',()=>{if(state.present){clearTimeout(pointerTimer);revealPresent();}});root.addEventListener('pointerdown',()=>{if(state.present)revealPresent();});
  document.addEventListener('fullscreenchange',()=>{if(state.present&&!document.fullscreenElement)void present(false);});
  document.addEventListener('keydown',e=>{if(el('data').open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape'){if(state.present)void present(false);else browse(false);}if(state.present){if(e.key==='ArrowRight'){e.preventDefault();nextPlace(1);}if(e.key==='ArrowLeft'){e.preventDefault();nextPlace(-1);}if(e.code==='Space'){e.preventDefault();state.playing=!state.playing;controls();}}});
  new ResizeObserver(()=>{map.invalidateSize();dirty=true;}).observe(root);
  try{
    [manifest,hycom,drifter]=await Promise.all([get(BASE+'manifest.json'),get('/hidden-rivers/data/manifest.json'),get(BASE+'drifter.json')]);
    places=[...manifest.places,...OCEANS];
    const aliases={hatteras:'outer-banks',nemo:'point-nemo',cape:'agulhas',peninsula:'agulhas'};
    const requested=query.get('place')||query.get('region')||'manaus';
    await selectPlace(aliases[requested]||requested,true);resize();requestAnimationFrame(animation);
    window.__waterAtlas={map,state,places,selectPlace,selectFrame,getField:()=>field,getRivers:()=>rivers,getPaths:()=>paths,ready:()=>Boolean(state.place&&(images.length||field)),present};
  }catch(error){setStatus('Atlas data could not load. Reload to retry.');console.error(error);}
}
