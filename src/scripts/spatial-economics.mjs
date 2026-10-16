import {mountCesiumCoast} from './hidden-rivers/cesium-coast.js';
import {DEFAULTS,candidateSites} from '../lib/spatial-incentives.mjs';
const $=id=>document.getElementById(id),number=(x,d=0)=>Number(x).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}),money=x=>x===null?'Undefined':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(x),signed=(x,d=1)=>`${x>=0?'+':''}${number(x,d)}`;
let data,result,worker,ready=false,request=0,latest=0,allocation='optimized',mapLayer='employment',sceneApi,C,viewer,selectedId;
let columnEntities=[],siteEntities=[];const heights=new Map();
const spec={budget:[1000000,x=>`$${x} million`],subsidy:[1000,x=>money(x*1000)],additionality:[.01,x=>`${x}%`],displacement:[.01,x=>`${x}%`],years:[1,x=>`${x} years`],discount:[.01,x=>`${x}%`],'half-life':[1,x=>`${x} min`],equity:[.01,x=>`${x}%`],'max-share':[.01,x=>`${x}%`]};
function parameters(){const p={...DEFAULTS,allocation};for(const [id,[scale]]of Object.entries(spec)){const key=id==='half-life'?'halfLife':id==='max-share'?'maxShare':id;p[key]=Number($(id).value)*scale;}return p;}
function recalculate(){for(const[id,[,format]]of Object.entries(spec))$(`${id}-value`).textContent=format(Number($(id).value));if(!ready)return;latest=++request;document.body.classList.add('policy-pending');$('calculation-status').textContent='Recomputing allocation and spatial access…';$('export-scenario').disabled=true;worker.postMessage({id:latest,kind:'calculate',parameters:parameters()});}
let inputTimer;for(const id of Object.keys(spec))$(id).addEventListener('input',()=>{clearTimeout(inputTimer);latest=++request;$('export-scenario').disabled=true;document.body.classList.add('policy-pending');inputTimer=setTimeout(recalculate,90);});
for(const mode of ['optimized','equal'])$(mode).addEventListener('click',()=>{allocation=mode;for(const m of ['optimized','equal']){$(m).classList.toggle('active',m===mode);$(m).setAttribute('aria-pressed',String(m===mode));}recalculate();});
function inspect(id,fly=false){
  if(!data||!result)return;selectedId=id;const cell=data.cells.find(c=>c.id===id),r=result.cells.find(c=>c.id===id),site=result.sites.find(s=>s.id===id);
  $('selection').replaceChildren();const title=document.createElement('strong'),body=document.createElement('span');title.textContent=site?`${site.label} · ${money(site.budget)}`:`Cell ${id}`;body.textContent=`${number(cell.jobs)} existing primary jobs · ${number(cell.workers)} resident workers · ${signed(r.gain)} gravity-weighted job opportunities (${signed(r.percent??0,3)}%). ${site?`${number(site.induced,1)} induced site jobs before donor subtraction. `:''}${cell.lat.toFixed(4)}° N, ${Math.abs(cell.lon).toFixed(4)}° W.`;$('selection').append(title,body);
  if(fly&&sceneApi)sceneApi.flyTo(cell.lon,cell.lat,{height:heights.get(id)||650,range:6500,heading:20});
}
function drawResults(message){
  result=message.result;const r=result,p=r.parameters;
  document.body.classList.remove('policy-pending');$('net-jobs').textContent=number(r.netJobs,1);$('job-year-cost').textContent=money(r.costPerJobYear);$('access-gain').textContent=signed(r.groups.low.gain,1);$('growth-share').textContent=`${signed(r.jobGrowthPercent,3)}% of study-area job stock`;
  $('scenario-tag').textContent=`${p.allocation==='optimized'?'Optimized':'Equal'} allocation · ${number(p.additionality*100)}% additionality`;
  $('accounting').innerHTML=`<div><span>Supported offers</span><strong>${number(r.offers,1)}</strong></div><div><span>No changed site choice</span><strong>−${number(r.deadweightOffers,1)}</strong></div><div><span>Within-area relocations</span><strong>−${number(r.displaced,1)}</strong></div><div><span>Additional study-area jobs</span><strong>${number(r.netJobs,1)}</strong></div>`;
  const labels={low:'Lower earnings',middle:'Middle earnings',high:'Higher earnings'};const maxGain=Math.max(1,...Object.keys(labels).map(g=>Math.abs(r.groups[g].gain)));
  $('distribution-chart').innerHTML=Object.entries(labels).map(([g,label])=>`<div class="bar-row"><div class="bar-label"><span>${label} · ${number(r.groups[g].workers)} workers</span><strong>${signed(r.groups[g].gain)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${100*Math.abs(r.groups[g].gain)/maxGain}%"></div></div></div>`).join('');
  $('site-allocations').replaceChildren();for(const s of r.sites){const button=document.createElement('button');button.type='button';button.className='site-card';button.setAttribute('aria-label',`Inspect ${s.label}`);button.innerHTML=`<strong>${s.label}</strong><span class="site-money">$${number(s.budget/1000000,1)}m</span><span>${number(s.share*100)}% of budget · ${number(s.induced,1)} induced site jobs</span><small>${number(s.existingJobs)} existing primary jobs</small><span class="allocation-bar"><i style="width:${100*s.share}%"></i></span>`;button.addEventListener('click',()=>inspect(s.id,true));$('site-allocations').append(button);}
  $('allocation-note').textContent=`${p.allocation==='optimized'?'Optimal for the specified linear objective':'Equal-share comparison'} · maximum ${number(p.maxShare*100)}% per cluster · lower-earnings objective weight ${number(p.equity*100)}%. Cluster selection reflects existing employment, not available land.`;
  $('allocation-note').textContent+=` Lower-earnings access changes by ${signed(r.groups.low.gain)} weighted opportunities; equal shares yield ${signed(message.equalComparison.low.gain)} at the same budget and additional job count.`;
  $('frontier-chart').innerHTML=`<table class="frontier-table"><caption class="visually-hidden">Optimized accessibility gains by lower-earnings objective weight</caption><thead><tr><th>Weight</th><th>All workers</th><th>Lower earnings</th></tr></thead><tbody>${message.frontier.map(f=>`<tr><td>${number(f.equity*100)}%</td><td>${signed(f.all)}</td><td>${signed(f.low)}</td></tr>`).join('')}</tbody></table>`;
  $('sensitivity-chart').innerHTML=`<table class="sensitivity-table"><caption class="visually-hidden">Additional jobs by site additionality and within-area relocation</caption><thead><tr><th>a / d</th><th>0%</th><th>25%</th><th>50%</th><th>75%</th></tr></thead><tbody>${message.sensitivity.map(row=>`<tr><th>${number(row[0].additionality*100)}%</th>${row.map(c=>`<td>${number(c.netJobs,0)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('calculation-status').textContent=`Calculated on ${number(data.coverage.graphNodes)} road nodes. Scenario assumptions are not estimated causal effects.`;$('export-scenario').disabled=false;
  if(selectedId)inspect(selectedId);updateColumns();
}
$('export-scenario').addEventListener('click',()=>{
  if(!result||$('export-scenario').disabled)return;
  const payload={model:'Spatial Investment Lab v1',createdAt:new Date().toISOString(),status:'conditional_policy_scenario_not_causal_estimate',result,coverage:data.coverage,provenance:data.provenance,assumptions:data.assumptions,interpretation:['Uniform response and subsidy across sites.','Displaced jobs removed in proportion to baseline study-area employment.','No general-equilibrium, tax-revenue, wage or multiplier estimate.','Job persistence is constant through the selected horizon; incentive expenditure is upfront.','Candidate cells do not establish availability, feasibility or incentive eligibility.'],license:'OSM-derived network and geometry: OpenStreetMap contributors, ODbL. Census counts: U.S. public data.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='spatial-investment-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function token(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}
function color(name,alpha=1){return C.Color.fromCssColorString(token(name)).withAlpha(alpha);}
function camera(overhead=false){if(!viewer)return;viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(-82.555,35.59,650),100),{duration:0,offset:new C.HeadingPitchRange(C.Math.toRadians(overhead?0:15),C.Math.toRadians(overhead?-90:-43),overhead?24000:20500)});viewer.scene.requestRender();}
$('reset-camera').addEventListener('click',()=>camera());$('top-view').addEventListener('click',()=>camera(true));
for(const button of document.querySelectorAll('[data-layer]'))button.addEventListener('click',()=>{mapLayer=button.dataset.layer;for(const b of document.querySelectorAll('[data-layer]'))b.setAttribute('aria-pressed',String(b===button));updateColumns();});
function updateColumns(){
  if(!viewer||!data||!C)return;const sites=new Map((result?.sites||candidateSites(data)).map(s=>[s.id,s]));
  const effects=new Map((result?.cells||[]).map(c=>[c.id,c]));const maxChange=Math.max(1,...[...effects.values()].map(c=>Math.abs(c.gain)));
  data.cells.forEach((cell,i)=>{
    const e=columnEntities[i];if(!e)return;const site=sites.get(cell.id),effect=effects.get(cell.id);let height=Math.max(20,cell.jobs*.2),material=site?color('--p-red-78',.95):color('--p-teal-78',.65);
    e.show=cell.jobs>0;
    if(mapLayer==='access'){height=Math.max(20,Math.abs(effect?.gain||0)/maxChange*650);material=(effect?.gain||0)>=0?color('--p-teal-78',.8):color('--p-red-73',.9);e.show=cell.workers>0;}
    if(mapLayer==='allocation'){height=Math.max(20,(site?.budget||0)/1000000*250);material=color('--p-red-78',.95);e.show=Boolean(site);}
    e.position=C.Cartesian3.fromDegrees(cell.lon,cell.lat,(heights.get(cell.id)||650)+height/2);e.cylinder.length=height;e.cylinder.material=material;
  });
  for(const {entity,site}of siteEntities){const s=sites.get(site.id);entity.label.text=`${site.label}\n${result?`$${number((s?.budget||0)/1000000,1)}m`:`${number(site.jobs)} jobs`}`;entity.position=C.Cartesian3.fromDegrees(site.lon,site.lat,(heights.get(site.id)||650)+Math.max(100,mapLayer==='allocation'?(s?.budget||0)/1000000*250:site.jobs*.2)+75);}
  $('map-layer-label').textContent={employment:'Existing employment',access:'Change in potential job access',allocation:'Spatial incentive allocation'}[mapLayer];$('height-legend').textContent={employment:'Height = 2023 primary jobs · 0.2 m / job',access:'Height = |access change| · scenario-scaled',allocation:'Height = budget · 250 m / $1m'}[mapLayer];$('color-legend').textContent={employment:'Teal: baseline · gold: candidate cluster',access:'Teal: gain · rust: loss',allocation:'Gold: allocated incentive budget'}[mapLayer];viewer.scene.requestRender();
}
async function addScene({Cesium,viewer:mounted}){
  C=Cesium;viewer=mounted;camera();
  for(let i=0;i<viewer.imageryLayers.length;i++){const layer=viewer.imageryLayers.get(i);layer.brightness=.45;layer.saturation=.35;layer.contrast=1.15;}
  const addLines=(lines,lineColor,width)=>{
    const instances=lines.filter(l=>l.coordinates.length>1).map(l=>new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:C.Cartesian3.fromDegreesArray(l.coordinates.flat()),width}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(lineColor)}}));
    if(instances.length)viewer.scene.groundPrimitives.add(new C.GroundPolylinePrimitive({geometryInstances:instances,appearance:new C.PolylineColorAppearance(),asynchronous:true}));
  };
  addLines(data.rivers,color('--p-teal-76',.7),3);
  addLines(data.roads.filter(r=>['motorway','trunk','primary','secondary'].includes(r.type)),color('--p-paper',.25),1.2);
  columnEntities=data.cells.map(cell=>viewer.entities.add({id:`cell-${cell.id}`,position:C.Cartesian3.fromDegrees(cell.lon,cell.lat,700),cylinder:{length:100,topRadius:85,bottomRadius:85,material:color('--p-teal-78',.7),slices:8,outline:false}}));
  siteEntities=candidateSites(data).map(site=>({site,entity:viewer.entities.add({id:`site-${site.id}`,position:C.Cartesian3.fromDegrees(site.lon,site.lat,1100),label:{text:site.label,font:'12px sans-serif',fillColor:color('--p-paper'),showBackground:true,backgroundColor:color('--p-neutral-06',.85),backgroundPadding:new C.Cartesian2(7,5),pixelOffset:new C.Cartesian2(0,-15),disableDepthTestDistance:Number.POSITIVE_INFINITY,scaleByDistance:new C.NearFarScalar(1000,1,40000,.65)}})}));
  const input=new C.ScreenSpaceEventHandler(viewer.scene.canvas);input.setInputAction(event=>{const pick=viewer.scene.pick(event.position);const id=pick?.id?.id;if(typeof id==='string'&&(id.startsWith('cell-')||id.startsWith('site-')))inspect(id.slice(5));},C.ScreenSpaceEventType.LEFT_CLICK);
  updateColumns();
  if(viewer.terrainProvider?.availability){
    try{const positions=data.cells.map(c=>C.Cartographic.fromDegrees(c.lon,c.lat));const samples=await C.sampleTerrainMostDetailed(viewer.terrainProvider,positions);if(viewer.isDestroyed())return;samples.forEach((p,i)=>{if(Number.isFinite(p.height))heights.set(data.cells[i].id,p.height);});updateColumns();$('economic-map').dataset.columnsGrounded=String(heights.size);}catch{$('economic-map').dataset.columnsGrounded='unavailable';}
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted&&!input.isDestroyed())input.destroy();});
}
async function start(){
  try{const response=await fetch('/spatial-economics/asheville.json');if(!response.ok)throw new Error('Data unavailable');data=await response.json();const c=data.coverage;$('coverage').textContent=`The study window contains ${number(c.includedJobs)} workplace primary jobs and ${number(c.includedWorkers)} residential primary jobs in ${c.includedCells} included 1 km cells. ${c.excludedCells} cells excluded by the 750 m snapping limit. The road graph has ${number(c.graphNodes)} nodes and ${number(c.directedEdges)} directed edges. Road snapshot: ${data.assumptions.roadSnapshot.slice(0,10)}.`;
    worker=new Worker(new URL('./spatial-economics.worker.mjs',import.meta.url),{type:'module'});worker.onmessage=({data:message})=>{if(message.kind==='ready'){ready=true;recalculate();}else if(message.kind==='result'&&message.id===latest)drawResults(message);else if(message.kind==='error'){$('calculation-status').textContent=message.message;document.body.classList.remove('policy-pending');}};worker.onerror=()=>{$('calculation-status').textContent='The model worker could not start. Reload this page to retry.';};worker.postMessage({kind:'init',id:0,dataset:data});
    sceneApi=await mountCesiumCoast($('economic-map'),{initialPreset:'fayetteville',statusElement:$('map-status'),onScene:scene=>{addScene(scene).catch(()=>{$('map-status').textContent='3D context connected; analytical overlays could not finish loading.';});}});
  }catch{$('calculation-status').textContent='Public model inputs could not load. Reload this page to retry.';$('map-status').textContent='3D scene unavailable until model inputs load.';}
}
window.addEventListener('pagehide',event=>{if(!event.persisted){worker?.terminate();sceneApi?.dispose();}});
start();
