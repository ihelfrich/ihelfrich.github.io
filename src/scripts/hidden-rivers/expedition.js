import { initLandscapes } from './landscapes.js';
import { createCinematicOcean } from './cinematic.js';
import { velocityAt, pointSeries, seriesCSV, formatCoordinate } from './inspection.mjs';
import { loadDiagnostic, diagnosticFrame, sampleDiagnostic } from './diagnostics.mjs';

const DAY=86400, BASE='/hidden-rivers/data/', SVG='http://www.w3.org/2000/svg';
const MODE_COPY={
 flow:{kicker:'01 / LAGRANGIAN TRANSPORT',title:'Follow a parcel through a changing current.',description:'Each filament is a numerical trajectory through the model’s evolving horizontal velocity field. Its history is measured in ocean hours, independent of the display’s frame rate. Scrubbing time follows the same seeded particles.',limit:'Particles stay on a selected depth surface. These paths do not include vertical motion, turbulent diffusion, waves, or windage.'},
 vorticity:{kicker:'02 / EULERIAN ROTATION',title:'Read the local rotation in the velocity field.',description:'The signed curl of the horizontal current separates clockwise from counterclockwise rotation. The center of the color scale is zero. Unlike a particle path, this is a local property of the velocity field at a particular time.',limit:'Daily diagnostic snapshots are shown at their exact times. High vorticity alone does not establish a coherent or persistent eddy.'},
 stretching:{kicker:'03 / FINITE-TIME DEFORMATION',title:'Measure how neighboring paths separate.',description:'Nearby initial locations are integrated forward for a complete 48 hours. Their separation defines the flow-map gradient and its largest stretching rate. Bright regions show stronger forward finite-time stretching, in inverse days.',limit:'These are daily release times with full 48-hour windows. A ridge can reflect shear and is not proof of a transport barrier. Incomplete trajectories remain masked.'},
 column:{kicker:'04 / DEPTH-ALIGNED COMPARISON',title:'One horizontal position. Different moving layers.',description:'The available depth surfaces share a geographic frame. In this comparison, the Agulhas surface is subsampled to daily inputs, matching the temporal spacing of the deeper fields. Depth is exaggerated for visibility.',limit:'The layers contain horizontal velocities only. Their apparent vertical separation is a display choice, not reconstructed sinking or upwelling. The relief and model wet mask are independently gridded.'}
};
const BOUNDS_TEXT={agulhas:'SOUTH ATLANTIC / INDIAN OCEAN',bahamas:'FLORIDA STRAITS / BAHAMAS',denmark:'DENMARK STRAIT / IRMINGER SEA'};
const isDiagnostic=mode=>mode==='vorticity'||mode==='stretching';
const roundLabel=n=>Math.abs(n)>=10?Number(n.toFixed(0)).toString():Number(n.toFixed(2)).toString();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Match the column renderer's deliberate daily subsampling of higher-cadence inputs.
function dailyLayer(layer){
 if(layer.dates.length<=6)return layer;
 const indices=layer.dates.map((date,index)=>({seconds:(Date.parse(date)-Date.parse(layer.dates[0]))/1000,index})).filter(x=>x.seconds%DAY===0).map(x=>x.index);
 const [,ny,nx]=layer.shape,plane=ny*nx,values=new Int16Array(2*indices.length*plane);
 for(let c=0;c<2;c++)indices.forEach((index,t)=>values.set(layer.values.subarray((c*layer.shape[0]+index)*plane,(c*layer.shape[0]+index+1)*plane),(c*indices.length+t)*plane));
 return {...layer,shape:[indices.length,ny,nx],dates:indices.map(i=>layer.dates[i]),timeStepSeconds:DAY,values};
}

export async function startExpedition(){
 const landscape=initLandscapes();
 const el=id=>document.getElementById('ocean-'+id),canvas=el('canvas');if(!canvas)return;
 const query=new URLSearchParams(location.search),capture=query.has('capture'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(capture)document.documentElement.classList.add('ocean-capture');
 const numeric=(name,fallback)=>{const v=Number(query.get(name));return query.has(name)&&Number.isFinite(v)?v:fallback;};
 const state={region:['agulhas','bahamas','denmark'].includes(query.get('region'))?query.get('region'):'agulhas',mode:Object.keys(MODE_COPY).includes(query.get('mode'))?query.get('mode'):'flow',depth:[0,200,500,1000,2000].includes(numeric('depth',1000))?numeric('depth',1000):1000,time:clamp(numeric('time',3*DAY),0,5*DAY),view:query.get('view')==='map'?'map':'oblique',playing:!reduced.matches&&!query.has('time')&&!capture,selected:null,film:false,speedScale:[.25,.5,1,2].includes(numeric('scale',.5))?numeric('scale',.5):.5};
 if(state.mode==='column')state.view='oblique';
 if(isDiagnostic(state.mode))state.time=Math.round(Math.min(state.time,state.mode==='stretching'?3*DAY:5*DAY)/DAY)*DAY;
 let region,layers=[],comparisonLayers=[],diagnostics,manifest,diagnosticManifest,renderer,loading=true,epoch=0,last=performance.now(),active=true,profileVersion=0,coastal,globe,coastalPosition={lon:18.4,lat:-34.2,height:900};
 const cache=new Map(),regionCache=new Map();let inspectorStamp=-1,lastClock=-1,lastDiagnosticStep=0;
 const status=el('status');
 function loadingState(text){status.classList.remove('ready');status.querySelector('p').textContent=text;}
 function message(text){el('action-status').textContent=text;}
 const requests=new Map();
 async function getJSON(url){if(!requests.has(url))requests.set(url,fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json();}));return requests.get(url);}
 async function bytes(url){if(!cache.has(url))cache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error(`${r.status}: ${url}`);return r.arrayBuffer();}).catch(e=>{cache.delete(url);throw e;}));return cache.get(url);}
 const decodeInt16=buffer=>{const data=new Int16Array(buffer.byteLength/2),view=new DataView(buffer);for(let i=0;i<data.length;i++)data[i]=view.getInt16(i*2,true);return data;};
 function effectiveLayers(){return state.mode==='column'?comparisonLayers:layers;}
 function duration(){return state.mode==='stretching'?3*DAY:5*DAY;}
 function physicalDate(seconds=state.time){return new Date(Date.parse(layers[0]?.dates[0]||'2026-09-29T00:00:00Z')+seconds*1000);}
 function dateText(seconds=state.time){return physicalDate(seconds).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC';}
 function updateLegend(){if(!renderer)return;const legend=renderer.getLegend();el('legend-title').textContent=legend.title;el('gradient').style.background=`linear-gradient(90deg,${legend.colors.join(',')})`;el('legend-ticks').replaceChildren(...[legend.min,(legend.min+legend.max)/2,legend.max].map((v,i)=>{const span=document.createElement('span');span.textContent=roundLabel(v)+(i===2?' '+legend.units:'');return span;}));el('legend-note').textContent=legend.note+(legend.clipped?' Values outside the range are color-clipped.':'');}
 function updateClock(force=false){const stamp=Math.floor(state.time/60);if(stamp===lastClock&&!force)return;lastClock=stamp;
  el('date').value=state.mode==='stretching'?`${dateText()} → ${dateText(state.time+2*DAY)}`:dateText();
  el('time').value=String(Math.round(state.time));el('time').max=String(duration());el('time').step=isDiagnostic(state.mode)?String(DAY):'900';el('time-end').textContent=state.mode==='stretching'?'2 OCT · +48 H WINDOW':'4 OCTOBER 2026';
  const layer=layers.find(l=>l.depth===state.depth)||layers[0];const cadence=state.mode==='column'?24:((layer?.timeStepSeconds||DAY)/3600);
  el('cadence').textContent=isDiagnostic(state.mode)?'Daily diagnostic snapshot':`${cadence}-hour velocity inputs`;
 }
 function updateControls(){
  document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===state.region)));
  document.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));b.disabled=loading;});
  el('depths').replaceChildren(...layers.map(l=>{const button=document.createElement('button');button.type='button';button.dataset.depth=l.depth;button.textContent=l.depth===0?'Surface':`${l.depth.toLocaleString()} m`;button.setAttribute('aria-pressed',String(state.mode==='column'||state.depth===l.depth));button.disabled=loading||state.mode==='column';button.onclick=()=>setScene({depth:l.depth});return button;}));
  el('play').disabled=loading;el('play').textContent=state.playing?'Pause':state.time>=duration()?'Replay':'Play';el('play').setAttribute('aria-pressed',String(state.playing));el('view').textContent=state.view==='map'?'Oblique view':'North-up map';el('view').setAttribute('aria-pressed',String(state.view==='oblique'));
  const copy=MODE_COPY[state.mode];el('mode-kicker').textContent=copy.kicker;document.getElementById('analysis-title').textContent=copy.title;el('mode-description').textContent=copy.description;el('mode-limit').textContent=copy.limit;
  if(capture){document.querySelector('.stage-deck').textContent={flow:'Horizontal transport / fixed model-time paths',vorticity:'Signed rotation / instantaneous model field',stretching:'Forward stretching / complete 48-hour windows',column:'Depth comparison / daily inputs'}[state.mode];}
  el('depth-readout').innerHTML=state.mode==='column'?'ALL <small>LAYERS</small>':`${state.depth.toLocaleString()} <small>m</small>`;el('depth-context').textContent=state.mode==='column'?'Aligned horizontal velocities':state.depth===0?'Modeled surface circulation':state.depth>=1000?'Horizontal flow in the ocean interior':'Subsurface horizontal circulation';el('speed-scale').value=String(state.speedScale);
  updateClock(true);updateLegend();
 }
 async function regionData(id){
  if(regionCache.has(id))return regionCache.get(id);
  const r=manifest.regions.find(r=>r.id===id);
  const promise=(async()=>{
   const raw=await Promise.all(r.layers.map(async l=>{const buffer=await bytes(BASE+l.file+(l.sha256?'?sha256='+l.sha256:''));if(buffer.byteLength!==l.shape.reduce((a,b)=>a*b,1)*4)throw Error('Velocity dimensions do not match the manifest.');return {...l,values:decodeInt16(buffer)};}));
   const terrain=decodeInt16(await bytes(BASE+r.terrain.file));
   const derived={layers:await Promise.all(raw.map(async layer=>({depth:layer.depth,fields:{vorticity:await loadDiagnostic(diagnosticManifest,id,layer.depth,'vorticity'),ftle:await loadDiagnostic(diagnosticManifest,id,layer.depth,'ftle')}})))};
   return {r,raw,terrain,derived};
  })().catch(e=>{regionCache.delete(id);throw e;});regionCache.set(id,promise);return promise;
 }
 async function loadRegion(id){const version=++epoch;loading=true;loadingState('Reading velocity, relief, and deformation fields');updateControls();
  try{const data=await regionData(id);if(version!==epoch)return;state.region=id;region=data.r;layers=data.raw;comparisonLayers=layers.map(dailyLayer);diagnostics=data.derived;if(!layers.some(l=>l.depth===state.depth)){state.depth=layers[0].depth;state.speedScale=state.depth>=500?.5:2;}
   renderer.setSpeedScale(state.speedScale);renderer.setDepth(state.depth);renderer.setTime(state.time);renderer.setView(state.view);renderer.setMode(state.mode);
   await renderer.loadRegion(region,layers,data.terrain,diagnostics);if(version!==epoch)return;
   loading=false;status.classList.add('ready');el('region-title').textContent=region.title;el('bounds').textContent=BOUNDS_TEXT[id];
   const sampleCount=layers.reduce((sum,l)=>sum+l.shape[0]*l.shape[1]*l.shape[2],0);el('evidence').textContent=`${layers.length} depth ${layers.length===1?'plane':'planes'} · ${layers[0].dates.length} ${layers[0].dates.length===41?'surface ':''}snapshots · 120 ocean hours`;
   state.selected=null;el('lon').value=((region.bounds[0]+region.bounds[2])/2).toFixed(3);el('lat').value=((region.bounds[1]+region.bounds[3])/2).toFixed(3);el('profile').replaceChildren();el('profile-legend').replaceChildren();el('inspect-title').textContent='Choose a location in the ocean.';el('inspect-body').innerHTML='<tr><td colspan="5">Click the field above or enter coordinates.</td></tr>';el('csv').disabled=true;
   updateControls();renderer.setPlaying(state.playing);window.__oceanExpedition.ready=true;window.__oceanAtlas={ready:true,region:id,depths:layers.map(l=>l.depth),getTime:()=>state.time,inspect,getSelected:()=>state.selected};
  }catch(e){if(version!==epoch)return;loading=true;loadingState('The ocean data could not be loaded. The film and methods remain available.');message(e.message);console.error(e);}
 }
 async function setScene(change={}){
  const oldMode=state.mode;if(change.region&&change.region!==state.region){state.region=change.region;await loadRegion(state.region);}
  if(change.mode&&MODE_COPY[change.mode]){state.mode=change.mode;if(change.mode==='column'){state.speedScale=2;renderer.setSpeedScale(2);}}
  if(change.depth!==undefined&&change.depth!=='all'&&layers.some(l=>l.depth===Number(change.depth))){state.depth=Number(change.depth);state.speedScale=state.depth>=500?.5:2;renderer.setSpeedScale(state.speedScale);}
  if(change.view)state.view=change.view==='map'?'map':'oblique';
  if(state.mode==='column')state.view='oblique';
  if(change.time!==undefined)state.time=clamp(Number(change.time)||0,0,duration());else state.time=Math.min(state.time,duration());
  if(isDiagnostic(state.mode))state.time=Math.round(state.time/DAY)*DAY;
  if(oldMode!==state.mode){state.playing=false;inspectorStamp=-1;profileVersion++;}
  renderer.setMode(state.mode);renderer.setDepth(state.mode==='column'?'all':state.depth);renderer.setView(state.view);renderer.setTime(state.time);renderer.setPlaying(state.playing);
  if(change.film!==undefined){state.film=Boolean(change.film);renderer.setFilm(state.film);}
  updateControls();updateInspection(true);drawProfile();
  if(renderer.whenReady)await renderer.whenReady();
  return {...state};
 }
 function setTime(seconds){state.time=clamp(Number(seconds)||0,0,duration());if(isDiagnostic(state.mode))state.time=Math.round(state.time/DAY)*DAY;renderer.setTime(state.time);updateClock(true);updateInspection(true);return state.time;}
 function inspect(lon,lat){if(!region||loading)return;const b=region.bounds;if(!Number.isFinite(lon+lat)||lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3]){el('inspect-message').textContent='Choose a location within the selected region.';return;}
  state.selected={lon,lat};renderer.select(lon,lat);el('lon').value=lon.toFixed(3);el('lat').value=lat.toFixed(3);el('inspect-title').textContent=formatCoordinate(lon,lat);el('inspect-message').textContent='';el('csv').disabled=false;inspectorStamp=-1;updateInspection(true);drawProfile();
 }
 function updateInspection(force=false){if(!state.selected||loading)return;const stamp=Math.floor(state.time/900);if(stamp===inspectorStamp&&!force)return;inspectorStamp=stamp;
  const rows=effectiveLayers().map(l=>{const v=velocityAt(l,state.selected.lon,state.selected.lat,state.time),tr=document.createElement('tr');const values=[l.depth===0?'Surface':`${l.depth.toLocaleString()} m`,v?v.speed.toFixed(3):'No data',v?v.east.toFixed(3):'—',v?v.north.toFixed(3):'—',v?.bearing!=null?`${v.bearing.toFixed(0)}°`:'—'];for(const [index,value]of values.entries()){const cell=document.createElement(index===0?'th':'td');cell.textContent=value;if(index===0)cell.scope='row';tr.appendChild(cell);}return tr;});
  el('inspect-body').replaceChildren(...rows);el('inspect-time').textContent=dateText()+(state.mode==='column'?' · all layers sampled daily':' · source cadence differs by depth');
  const name=state.mode==='vorticity'?'vorticity':state.mode==='stretching'?'ftle':null;
  if(name){const field=diagnostics?.layers.find(l=>l.depth===state.depth)?.fields[name],frame=diagnosticFrame(field,state.time),value=frame?sampleDiagnostic(field,state.selected.lon,state.selected.lat,frame.index):null;
   el('inspect-message').textContent=value===null?'No valid diagnostic value at this location and time.':name==='vorticity'?`Relative vorticity: ${(value*1e5).toFixed(3)} × 10⁻⁵ s⁻¹`:`48-hour forward FTLE: ${value.toFixed(3)} day⁻¹`;}
 }
 function svg(name,attrs={}){const e=document.createElementNS(SVG,name);for(const [key,value]of Object.entries(attrs))e.setAttribute(key,value);return e;}
 function drawProfile(){if(!state.selected||loading)return;const chart=el('profile'),width=Math.max(280,chart.clientWidth),height=175,left=44,right=12,top=22,bottom=28,rows=pointSeries(effectiveLayers(),state.selected.lon,state.selected.lat),valid=rows.filter(r=>r.speed!==null);chart.replaceChildren();chart.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const title=svg('title');title.textContent='Horizontal speed at this location over the model window';chart.appendChild(title);
  if(!valid.length){const text=svg('text',{x:width/2,y:90,'text-anchor':'middle'});text.textContent='No valid velocity samples here.';chart.appendChild(text);return;}
  const start=Date.parse(layers[0].dates[0]),max=Math.max(.1,Math.ceil(Math.max(...valid.map(r=>r.speed))*10)/10),x=date=>left+(Date.parse(date)-start)/(5*DAY*1000)*(width-left-right),y=v=>height-bottom-v/max*(height-top-bottom);
  for(let k=0;k<3;k++){const v=max*k/2;chart.appendChild(svg('line',{x1:left,x2:width-right,y1:y(v),y2:y(v),class:'profile-grid'}));const t=svg('text',{x:left-7,y:y(v)+4,'text-anchor':'end'});t.textContent=v.toFixed(2);chart.appendChild(t);}
  const unit=svg('text',{x:left,y:12});unit.textContent='Speed · m/s';chart.appendChild(unit);
  for(const [d,label] of [[0,'29 Sep'],[2,'1 Oct'],[5,'4 Oct']]){const t=svg('text',{x:left+d/5*(width-left-right),y:height-6,'text-anchor':d===0?'start':d===5?'end':'middle'});t.textContent=label;chart.appendChild(t);}
  for(const layer of effectiveLayers()){const values=rows.filter(r=>r.depth===layer.depth);let d='',connected=false;values.forEach(r=>{if(r.speed===null){connected=false;return;}d+=`${connected?'L':'M'}${x(r.date)},${y(r.speed)} `;connected=true;if(values.length<=12){const dot=svg('circle',{cx:x(r.date),cy:y(r.speed),r:2.5,class:`profile-depth-${layer.depth}`});const tip=svg('title');tip.textContent=`${r.date}: ${r.speed.toFixed(3)} m/s at ${layer.depth} m`;dot.appendChild(tip);chart.appendChild(dot);}});chart.appendChild(svg('path',{d,class:`profile-line profile-depth-${layer.depth}`}));}
  el('profile-legend').replaceChildren(...effectiveLayers().map(l=>{const span=document.createElement('span');span.className=`profile-depth-${l.depth}`;span.textContent=(l.depth===0?'Surface':`${l.depth.toLocaleString()} m`)+` / ${(l.timeStepSeconds||DAY)/3600}h`;return span;}));
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
 async function saveImage(){if(loading)return;const data=renderer.snapshot(),img=new Image();img.src=data;await img.decode();const output=document.createElement('canvas');output.width=Math.max(1600,img.width);const h=Math.round(img.height*output.width/img.width);output.height=h+140;const ctx=output.getContext('2d');ctx.fillStyle='#050e16';ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(img,0,0,output.width,h);ctx.fillStyle='#edf1ec';ctx.font='26px sans-serif';ctx.fillText(`Hidden Rivers / ${region.title}`,28,h+37);ctx.font='18px sans-serif';ctx.fillText(`${dateText()} · ${state.mode} · ${state.mode==='column'?'all available depths':state.depth+' m'} · ${state.view}`,28,h+68);ctx.fillText('HYCOM / ESPC · NOAA ETOPO1 · Context imagery © Esri, Maxar, Earthstar Geographics',28,h+97);const legend=renderer.getLegend(),x=output.width-320,g=ctx.createLinearGradient(x,0,x+270,0);legend.colors.forEach((color,i)=>g.addColorStop(i/(legend.colors.length-1),color));ctx.fillStyle=g;ctx.fillRect(x,h+25,270,8);ctx.fillStyle='#edf1ec';ctx.font='15px sans-serif';ctx.fillText(`${roundLabel(legend.min)} to ${roundLabel(legend.max)} ${legend.units}`,x,h+60);output.toBlob(blob=>{if(blob)download(blob,`hidden-rivers-${state.region}-${state.mode}.png`);});}
 async function share(){if(loading)return;state.playing=false;renderer.setPlaying(false);const q=new URLSearchParams({region:state.region,mode:state.mode,depth:String(state.depth),time:String(Math.round(state.time)),view:state.view,scale:String(state.speedScale)});if(state.selected){q.set('lon',state.selected.lon.toFixed(5));q.set('lat',state.selected.lat.toFixed(5));}const url=new URL(location.href);url.search=q.toString();url.hash='explorer';history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);message('View link copied.');}catch{message('The address bar now contains this view.');}updateControls();}
 async function openCoast(){return landscape?.open();}
 async function loadCoastal(){if(coastal)return;const {createCoastalExplorer}=await import('./coastal.js');coastal=createCoastalExplorer(document.getElementById('coastal-microscope'),{onLocation:point=>{coastalPosition=point;landscape?.setTesseraPosition(point);}});await coastal.load();}
 try{renderer=createCinematicOcean(canvas,{reducedMotion:reduced.matches,onPick:inspect,onProgress:p=>{if(loading)loadingState(`Integrating ${p.depth===0?'surface':p.depth+' m'} trajectories · ${p.paths.toLocaleString()} paths`);},onStats:stats=>{el('path-info').textContent=state.mode==='stretching'?`Forward window: ${dateText()} → ${dateText(state.time+2*DAY)}${stats.view==='oblique'?' · vertical ×'+stats.exaggeration:''}`:`${(stats.particles||0).toLocaleString()} seeded paths · ${Math.round(stats.historyHours||0)} h visible history${state.mode==='column'?' · daily inputs':''}${stats.view==='oblique'?' · vertical ×'+stats.exaggeration:''}`;el('camera-note').textContent=stats.view==='map'?'Drag to pan · Scroll to zoom · Click to inspect':'Drag to orbit · Scroll to zoom · Click to inspect';if(!loading)updateLegend();},onFilmEnd:()=>{state.film=false;el('film-camera').textContent='Slow camera orbit';}});}catch(e){
  document.getElementById('explorer').classList.add('ocean-static');
  document.getElementById('ocean-analysis').classList.add('analysis-static');
  const poster=document.createElement('img');poster.src='/hidden-rivers/film-v3-poster.jpg';poster.alt='Agulhas model trajectories, with the model date and speed scale shown in the frame.';poster.width=1920;poster.height=1080;canvas.replaceChildren(poster);
  canvas.setAttribute('aria-label','Still from the Hidden Rivers data film');
  status.replaceChildren();const note=document.createElement('p');note.textContent='This browser cannot open the interactive 3D field. Explore the same model data in the film, or use the coastal representation search.';status.appendChild(note);
  for(const [label,href]of [['Watch the film ↗','#cinema'],['Explore Tessera ↗','#coastal']]){const link=document.createElement('a');link.textContent=label;link.href=href;status.appendChild(link);}
 }

 if(renderer){
  window.__oceanExpedition={ready:false,renderer,setScene,setTime,getState:()=>({...state}),loadCoastal,openCoast};
  new IntersectionObserver(entries=>{active=entries[0].isIntersecting;last=performance.now();}).observe(canvas);
  function tick(now){const elapsed=Math.min((now-last)/1000,.1);last=now;if(state.playing&&!loading&&active&&!document.hidden){
   if(isDiagnostic(state.mode)){lastDiagnosticStep+=elapsed;if(lastDiagnosticStep>=3){lastDiagnosticStep=0;state.time+=DAY;}}
   else state.time+=elapsed*7200;
   if(state.time>=duration()){state.time=0;updateControls();}
   renderer.setTime(state.time);updateClock();updateInspection();
  }requestAnimationFrame(tick);}requestAnimationFrame(tick);
  document.querySelectorAll('[data-region]').forEach(button=>button.onclick=async()=>{state.playing=false;await loadRegion(button.dataset.region);});
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setScene({mode:button.dataset.mode}));
  el('play').onclick=()=>{if(loading)return;if(state.time>=duration())setTime(0);state.playing=!state.playing;renderer.setPlaying(state.playing);updateControls();};
  el('speed-scale').onchange=()=>{state.speedScale=Number(el('speed-scale').value);renderer.setSpeedScale(state.speedScale);updateLegend();};
  el('immersive').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.getElementById('explorer').requestFullscreen();}catch{message('Full screen is unavailable in this browser.');}};
  el('surface').onchange=()=>renderer.setSurfaceVisible(el('surface').checked);
  el('time').oninput=()=>{state.playing=false;setTime(Number(el('time').value));renderer.setPlaying(false);updateControls();};
  el('view').onclick=()=>setScene({view:state.view==='map'?'oblique':'map',mode:state.mode==='column'?'flow':state.mode});el('reset').onclick=()=>renderer.resetView();el('image').onclick=saveImage;el('share').onclick=share;
  el('film-camera').onclick=()=>{state.film=!state.film;if(state.film){state.view='oblique';renderer.setView('oblique');}renderer.setFilm(state.film);el('film-camera').textContent=state.film?'Stop camera orbit':'Slow camera orbit';updateControls();};
  el('inspect-form').onsubmit=e=>{e.preventDefault();inspect(Number(el('lon').value),Number(el('lat').value));};el('csv').onclick=()=>{if(state.selected)download(new Blob([seriesCSV(pointSeries(effectiveLayers(),state.selected.lon,state.selected.lat))],{type:'text/csv'}),`hidden-rivers-${state.region}-velocity.csv`);};
  new ResizeObserver(()=>{if(state.selected)drawProfile();}).observe(el('profile'));
  reduced.addEventListener('change',()=>{if(reduced.matches){state.playing=false;state.film=false;renderer.setPlaying(false);renderer.setFilm(false);updateControls();}});
  try{[manifest,diagnosticManifest]=await Promise.all([getJSON(BASE+'manifest.json'),getJSON(BASE+'diagnostics.json')]);await loadRegion(state.region);if(query.has('lon')&&query.has('lat'))inspect(numeric('lon',NaN),numeric('lat',NaN));}catch(e){loadingState('The bundled datasets could not be loaded. Please use the film or try again.');message(e.message);console.error(e);}
 }

 const coastObserver=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){coastObserver.disconnect();loadCoastal().catch(e=>{document.getElementById('coastal-microscope').textContent=`The coastal representation could not be loaded: ${e.message}`;});}},{rootMargin:'500px'});coastObserver.observe(document.getElementById('coastal-microscope'));
}
