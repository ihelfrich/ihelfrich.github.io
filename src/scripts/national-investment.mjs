import {selectProjects,summarize,aggregate,annualFinancing,makeExport,YEAR_MIN,YEAR_MAX} from '../lib/national-investment.mjs';
import {connectedAerialImagery} from './hidden-rivers/cesium-coast.js';

const $=id=>document.getElementById(`ni-${id}`);
const names=Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|AS:American Samoa|GU:Guam|PR:Puerto Rico|VI:U.S. Virgin Islands'.split('|').map(s=>s.split(':')));
const n=x=>x.toLocaleString('en-US'), dollars=c=>c===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(c/100), pct=x=>x===null?'—':`${(x*100).toFixed(1)}%`;
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
let projects=[],sources,selected=[],stateGroups=[],filters={from:YEAR_MIN,to:YEAR_MAX,state:'',metro:'',type:''},page=0, C,viewer,input,resize,anchors=new Map(),disposed=false,activeTract='';
const pageSize=30;
function metric(label,value){const row=el('div',undefined,'ni-detail-row');row.append(el('span',label),el('strong',value));return row;}
function describeSelection(group){
  $('selection-title').textContent=group?`Tract ${group.id}`:filters.state?(names[filters.state]||filters.state):'National distribution';
  $('selection-description').textContent=group?`${[...new Set(group.rows.map(p=>p.city))].join(' · ')}. Representative tract location; select a project below for its source record.`:filters.state?'Each column sums selected financing assigned to a representative 2020 Census tract.':'Select a state or territory in the table or on the globe to inspect its financed tracts.';
  const s=group||summarize(selected);$('selection-detail').replaceChildren(metric('Selected financing',dollars(s.financingCents)),metric('Distinct projects',n(s.projects)),metric('Non-metro financing',pct(s.nonMetroShare)),metric('Multi-tract projects',n(s.multiTractProjects)));
}
function setRegion(state){filters.state=state;$('state').value=state;activeTract='';page=0;render();resetCamera();}
function renderRegions(){
  $('regions').replaceChildren(...stateGroups.map(g=>{
    const tr=el('tr');if(g.id===filters.state)tr.className='ni-selected';const td=el('td'),button=el('button',names[g.id]||g.id);button.type='button';button.setAttribute('aria-pressed',String(g.id===filters.state));button.addEventListener('click',()=>setRegion(g.id));td.append(button);tr.append(td,el('td',dollars(g.financingCents)),el('td',n(g.projects)),el('td',pct(g.nonMetroShare)));return tr;
  }));
  if(!stateGroups.length){const tr=el('tr'),td=el('td','No projects match these years and types.');td.colSpan=4;tr.append(td);$('regions').append(tr);}
}
function renderProjects(){
  const rows=(activeTract?selected.filter(p=>p.tract===activeTract):selected).slice().sort((a,b)=>b.selectedCents-a.selectedCents||a.id.localeCompare(b.id));
  page=Math.min(page,Math.max(0,Math.ceil(rows.length/pageSize)-1));
  $('projects').replaceChildren(...rows.slice(page*pageSize,(page+1)*pageSize).map(p=>{
    const tr=el('tr'),identity=el('td'),button=el('button',`${p.id} · ${p.city}`);button.type='button';button.addEventListener('click',()=>inspectProject(p));identity.append(button,el('small',`${p.state} · ${p.metro} · ${p.type}${p.multiTract?' · multi-tract':''}${p.point?'':' · unmapped'}`));tr.append(identity,el('td',p.tract),el('td',dollars(p.selectedCents)));return tr;
  }));
  if(!rows.length){const tr=el('tr'),td=el('td','No projects match this selection.');td.colSpan=3;tr.append(td);$('projects').append(tr);}
  $('record-count').textContent=`${n(rows.length)} projects${activeTract?` in tract ${activeTract}`:''} · ranked by selected financing. Export includes all ${n(selected.length)} projects in the region/year/type selection.`;
  $('page').textContent=rows.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,rows.length)} of ${n(rows.length)}`:'No records';$('prev').disabled=page===0;$('next').disabled=(page+1)*pageSize>=rows.length;
}
function inspectProject(p){
  $('selection-title').textContent=p.id;$('selection-description').textContent=`${p.city}, ${names[p.state]||p.state} · ${p.metro} · reported type ${p.type}.`;
  $('selection-detail').replaceChildren(metric('Selected financing',dollars(p.selectedCents)),metric('Full-release financing',dollars(p.financingCents)),metric('2020 tract',p.tract),metric('Location',p.point?'Tract internal point':'Not mapped'),metric('Multi-tract / multi-CDE',`${p.multiTract?'Yes':'No'} / ${p.multiCde?'Yes':'No'}`));
  if(viewer&&p.point)fly(p.point,80000);
}
function renderTimeline(){
  const years=annualFinancing(projects,filters),max=Math.max(1,...years.map(y=>y.financingCents));
  $('timeline').replaceChildren(...years.map(y=>{
    const button=el('button');button.type='button';button.className='ni-year';button.setAttribute('aria-label',`${y.year}: ${dollars(y.financingCents)}, ${n(y.projects)} projects. Select year.`);button.setAttribute('aria-pressed',String(y.year>=filters.from&&y.year<=filters.to));button.title=`${y.year} · ${dollars(y.financingCents)} · ${n(y.projects)} projects`;
    const bar=el('i');bar.style.height=`${y.financingCents/max*100}%`;button.append(bar,el('span',String(y.year)));button.addEventListener('click',()=>{filters.from=filters.to=y.year;$('from').value=$('to').value=String(y.year);page=0;activeTract='';render();});return button;
  }));
}
function render(){
  selected=selectProjects(projects,filters);stateGroups=aggregate(selectProjects(projects,{...filters,state:''}),'state');
  const s=summarize(selected);$('total').textContent=dollars(s.financingCents);$('count').textContent=n(s.projects);$('share').textContent=pct(s.nonMetroShare);$('mean').textContent=dollars(s.meanProjectCents);
  $('coverage').textContent=`${n(s.mappedProjects)} of ${n(s.projects)} selected projects have tract points.${s.unmappedCents?` ${dollars(s.unmappedCents)} in unmapped financing is included in these totals.`:''} ${n(s.multiTractProjects)} are reported as multi-tract.`;
  $('error').textContent=s.projects?`${names[filters.state]||'United States & territories'} · ${filters.from}–${filters.to} · ${filters.metro||'all metro classes'} · ${filters.type||'all reported types'}`:'No projects match these filters. Change the year interval or project type.';
  $('map-region').textContent=(names[filters.state]||'United States').toUpperCase();$('map-unit').textContent=filters.state?'2020 tract totals':'State & territory totals';$('height').textContent=filters.state?'Height: 10 km per $10 million':'Height: 100 km per $1 billion';$('point-note').textContent=filters.state?'Tract internal points · not project addresses':'AS, GU & VI: tables only · no matched tract points';
  describeSelection();renderRegions();renderProjects();renderTimeline();renderMap();
  const params=new URLSearchParams();for(const [key,value] of Object.entries(filters))if(value!==''&&value!==({from:YEAR_MIN,to:YEAR_MAX})[key])params.set(key,String(value));history.replaceState(null,'',`${location.pathname}${params.size?`?${params}`:''}${location.hash}`);
}
function cssColor(name){return C.Color.fromCssColorString(getComputedStyle(document.documentElement).getPropertyValue(name).trim());}
function renderMap(){
  if(!viewer||viewer.isDestroyed())return;viewer.entities.suspendEvents();viewer.entities.removeAll();
  const groups=filters.state?aggregate(selected,'tract'):stateGroups;
  for(const g of groups){const point=filters.state?g.rows.find(p=>p.point)?.point:anchors.get(g.id);if(!point)continue;
    const height=g.financingCents/(filters.state?1e5:1e6),radius=filters.state?2200:30000;
    viewer.entities.add({id:`${filters.state?'tract':'state'}:${g.id}`,position:C.Cartesian3.fromDegrees(...point,height/2),cylinder:{length:height,topRadius:radius,bottomRadius:radius,slices:8,material:cssColor(g.nonMetroShare>.5?'--p-gold-74':'--p-teal-76').withAlpha(.88),outline:false},...(!filters.state?{label:{text:g.id,font:'10px sans-serif',fillColor:cssColor('--p-paper'),showBackground:true,backgroundColor:cssColor('--p-neutral-06').withAlpha(.8),pixelOffset:new C.Cartesian2(0,-14),distanceDisplayCondition:new C.DistanceDisplayCondition(0,16000000)}}:{})});
  }
  viewer.entities.resumeEvents();viewer.scene.requestRender();
  $('map').dataset.columnCount=String(viewer.entities.values.length);
  $('map-status').textContent=viewer.entities.values.length?'Select a column to inspect. Drag to rotate; scroll to zoom.':'No mappable projects in this selection. Reported financing remains in the tables.';
}
function fly(point,range){
  if(!viewer)return;viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(...point),1),{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1.1,offset:new C.HeadingPitchRange(0,C.Math.toRadians(-55),range)});viewer.scene.requestRender();
}
function resetCamera(){
  if(!viewer)return;
  if(filters.state){const points=projects.filter(p=>p.state===filters.state&&p.point).map(p=>p.point);if(points.length){const sphere=C.BoundingSphere.fromPoints(points.map(p=>C.Cartesian3.fromDegrees(...p)));viewer.camera.flyToBoundingSphere(sphere,{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1.1,offset:new C.HeadingPitchRange(0,C.Math.toRadians(-65),Math.max(150000,sphere.radius*3.4))});return;}}
  viewer.camera.setView({destination:C.Cartesian3.fromDegrees(-99,35,6500000),orientation:{heading:0,pitch:C.Math.toRadians(-84),roll:0}});viewer.scene.requestRender();
}
async function startMap(){
  try{
    globalThis.CESIUM_BASE_URL='/vendor/cesium/';const link=el('link');link.rel='stylesheet';link.href='/vendor/cesium/Widgets/widgets.css';document.head.append(link);
    C=await import('cesium');if(disposed)return;
    viewer=new C.Viewer($('map'),{baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,scene3DOnly:true});
    viewer.resolutionScale=Math.min(devicePixelRatio||1,1.4);viewer.scene.globe.baseColor=cssColor('--p-blue-17');viewer.scene.globe.enableLighting=false;viewer.scene.skyAtmosphere.show=false;viewer.scene.skyBox.show=false;viewer.scene.backgroundColor=cssColor('--p-neutral-06');viewer.scene.screenSpaceCameraController.maximumZoomDistance=25000000;viewer.scene.screenSpaceCameraController.minimumZoomDistance=20000;
    viewer.scene.renderError.addEventListener(()=>{$('map-status').textContent='The 3D renderer stopped. Tables, filters and exports remain available.';});
    input=new C.ScreenSpaceEventHandler(viewer.scene.canvas);input.setInputAction(event=>{const id=viewer.scene.pick(event.position)?.id?.id;if(typeof id!=='string')return;const [kind,key]=id.split(':');if(kind==='state')setRegion(key);else if(kind==='tract'){activeTract=key;page=0;const group=aggregate(selected,'tract').find(g=>g.id===key);if(group)describeSelection(group);renderProjects();}},C.ScreenSpaceEventType.LEFT_CLICK);
    resize=new ResizeObserver(()=>{if(!viewer.isDestroyed())viewer.resize();});resize.observe($('map'));
    renderMap();resetCamera();
    try{const provider=await C.TileMapServiceImageryProvider.fromUrl('/vendor/cesium/Assets/Textures/NaturalEarthII');if(!disposed&&!viewer.isDestroyed()){const layer=viewer.imageryLayers.addImageryProvider(provider);layer.brightness=.5;layer.saturation=.35;viewer.scene.requestRender();}}catch{if(!disposed)$('map-status').textContent='Investment columns available; background imagery could not load.';}
    // Background upgrades are independent: neither can block analytical tables.
    connectedAerialImagery(C).then(provider=>{if(provider&&!disposed&&!viewer.isDestroyed()){const layer=viewer.imageryLayers.addImageryProvider(provider);layer.brightness=.48;layer.saturation=.3;viewer.scene.requestRender();}}).catch(()=>{});
    fetch('/spatial-economics/national/context.json').then(r=>{if(!r.ok)throw Error('Context unavailable');return r.json();}).then(context=>{
      if(disposed||viewer.isDestroyed())return;
      const instances=context.states.flatMap(s=>s.lines).filter(line=>line.length>1).map(line=>new C.GeometryInstance({geometry:new C.PolylineGeometry({positions:C.Cartesian3.fromDegreesArray(line.flat()),width:1,vertexFormat:C.PolylineColorAppearance.VERTEX_FORMAT}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(cssColor('--p-paper').withAlpha(.32))}}));
      viewer.scene.primitives.add(new C.Primitive({geometryInstances:instances,appearance:new C.PolylineColorAppearance(),asynchronous:true}));viewer.scene.requestRender();
    }).catch(()=>{});
  }catch{$('map-status').textContent='3D is unavailable in this browser. Use the regional table, project records and export below.';}
}
async function start(){
  try{
    const responses=await Promise.all(['projects','sources'].map(async name=>{const r=await fetch(`/spatial-economics/national/${name}.json`);if(!r.ok)throw Error('Source unavailable');return r.json();}));projects=responses[0].projects;sources=responses[1];
    for(const g of aggregate(selectProjects(projects),'state')){const mapped=g.rows.filter(p=>p.point),sum=mapped.reduce((s,p)=>s+p.selectedCents,0);if(sum)anchors.set(g.id,[0,1].map(axis=>mapped.reduce((s,p)=>s+p.point[axis]*p.selectedCents,0)/sum));}
    const states=[...new Set(projects.map(p=>p.state))].sort((a,b)=>(names[a]||a).localeCompare(names[b]||b));for(const state of states){const option=el('option',names[state]||state);option.value=state;$('state').append(option);}
    const params=new URLSearchParams(location.search),from=Number(params.get('from')||YEAR_MIN),to=Number(params.get('to')||YEAR_MAX);if(Number.isInteger(from)&&Number.isInteger(to)&&from>=YEAR_MIN&&to<=YEAR_MAX&&from<=to){filters.from=from;filters.to=to;}if(states.includes(params.get('state')))filters.state=params.get('state');if(['Metro','Non-Metro'].includes(params.get('metro')))filters.metro=params.get('metro');if(['RE','NRE','SPE','CDE'].includes(params.get('type')))filters.type=params.get('type');
    for(const key of ['state','from','to','metro','type']){const control=$(key);control.value=String(filters[key]);control.disabled=false;control.addEventListener('change',()=>{const oldState=filters.state;filters[key]=['from','to'].includes(key)?Number(control.value):control.value;if(filters.from>filters.to){if(key==='from')filters.to=filters.from;else filters.from=filters.to;$('from').value=String(filters.from);$('to').value=String(filters.to);}page=0;activeTract='';render();if(filters.state!==oldState)resetCamera();});}
    $('reset').disabled=false;$('reset').addEventListener('click',()=>{filters={from:YEAR_MIN,to:YEAR_MAX,state:'',metro:'',type:''};for(const key of Object.keys(filters))$(key).value=String(filters[key]);page=0;activeTract='';render();resetCamera();});
    $('view').addEventListener('click',()=>{activeTract='';page=0;describeSelection();renderProjects();resetCamera();});
    $('prev').addEventListener('click',()=>{page--;renderProjects();});$('next').addEventListener('click',()=>{page++;renderProjects();});
    $('export').disabled=false;$('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(makeExport(projects,filters,sources),null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=`nmtc-${filters.state||'national'}-${filters.from}-${filters.to}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    render();await startMap();
  }catch{$('error').textContent='The public dataset could not load. Reload to retry, or download the source files below. Figures above show the full-release baseline, not a filtered result.';}
}
window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;resize?.disconnect();if(input&&!input.isDestroyed())input.destroy();if(viewer&&!viewer.isDestroyed())viewer.destroy();}});
start();
