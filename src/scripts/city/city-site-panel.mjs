import {measureSite,prepareTerrainPoints,fitTerrainPlane} from '../../lib/city-site-analysis.mjs';
import {createSiteSourceLoader} from '../../lib/city-site-sources.mjs';

const number=(n,digits=1)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:digits}):'Unknown';
const date=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString().slice(0,10):'Unknown';
const gaps=[
 ['Survey & legal boundaries','Current survey, easements, rights of way and vertical control are not connected.'],
 ['Drainage & utilities','Pipe locations and inverts, outfalls, service capacity and stormwater design criteria are not connected.'],
 ['Dimensional zoning & access','Verified setbacks, height/FAR limits, parking, access and fire-apparatus requirements are not connected.'],
 ['Subsurface conditions','Geotechnical testing, groundwater and environmental site investigations are not connected.'],
];

/** Preliminary evidence only: derived GIS dimensions and explicitly requested source queries. */
export function createSitePanel(root,{getEvidence=()=>null,load=createSiteSourceLoader()}={}) {
 const doc=root.ownerDocument,$=id=>root.querySelector('#site-'+id);
 const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const note=(parent,text)=>parent.append(el('p',text,'small-note'));
 let evidence=null,measure=null,points=[],samplingPlan=null,products=null,fit=null,generation=0,controller=null,disposed=false;
 root.innerHTML=`<section class="site-dossier"><span class="eyebrow">PARCEL / TERRAIN / CONSTRAINTS</span><h3>Site dossier</h3><p id="site-selection" class="small-note"></p><p class="site-status-band">Preliminary engineering evidence</p><div id="site-geometry"></div><div id="site-plot" class="site-plot"></div><button id="site-load" type="button" class="primary-button wide" disabled>Load terrain & flood evidence</button><p id="site-status" class="small-note" role="status">Select an exact City parcel to begin.</p><div id="site-terrain"></div><div id="site-flood"></div><details class="site-gaps"><summary>Evidence still needed for design</summary><div id="site-gaps"></div></details><button id="site-export" type="button" class="secondary-button wide" disabled>Download site dossier & sources</button></section>`;
 for(const [label,value] of gaps){const row=el('section');row.append(el('h4',label));note(row,value);$('gaps').append(row)}
 const metric=(parent,label,value,detail)=>{const item=el('div');item.append(el('span',label),el('strong',value));if(detail)item.append(el('small',detail));parent.append(item)};
 function sourceLink(parent,label,url) {
  if(typeof url!=='string')return;
  try {const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='prd-tnm.s3.amazonaws.com'||/(^|\.)(usgs\.gov|nationalmap\.gov|fema\.gov|stlouis-mo\.gov)$/.test(u.hostname)))return;const a=el('a',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a)}catch{}
 }
 function renderGeometry() {
  const body=$('geometry');body.replaceChildren();if(!measure)return;
  const metrics=el('div',undefined,'development-metrics');
  metric(metrics,'GIS polygon area',`${number(measure.areaSqFt,0)} ft²`,'Derived geometry; approximate');
  metric(metrics,'Outer perimeter',`${number(measure.outerPerimeterFeet)} ft`,'Excludes courtyard-hole boundaries');
  metric(metrics,'East–west extent',`${number(measure.eastWestExtentMetres)} m`,'Bounding extent, not frontage');
  metric(metrics,'North–south extent',`${number(measure.northSouthExtentMetres)} m`,'Bounding extent, not legal depth');
  body.append(metrics);
  note(body,`${measure.partCount} polygon part(s) · ${measure.holeCount} hole(s). Source lot area: ${Number.isFinite(measure.sourceAreaSqFt)?number(measure.sourceAreaSqFt,0)+' ft²':'Unknown'}.`);
  const detail=el('details');detail.append(el('summary','Geometry method & source comparison'));
  note(detail,`All-ring perimeter: ${number(measure.allRingPerimeterFeet)} ft. GIS area minus source area: ${number(measure.areaDifferenceSqFt)} ft² (${number(measure.areaDifferencePct)}%). These quantities can have different administrative meanings.`);
  note(detail,'Dimensions use a local equirectangular projection. A GIS boundary is not a legal survey, street frontage, setback line or buildable footprint.');
  sourceLink(detail,'Official parcel source',evidence.parcels.source?.catalogUrl||evidence.parcels.source?.url);body.append(detail);
 }
 function drawPlot(samples=[]) {
  const body=$('plot');body.replaceChildren();if(!measure)return;
  const geometry=evidence.parcels.parcel.geometry,parts=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const vertices=parts.flat(2),xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);
  const west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys),cos=Math.cos((north+south)*Math.PI/360);
  const scale=Math.min(280/((east-west)*cos),175/(north-south)),width=(east-west)*cos*scale,height=(north-south)*scale;
  const project=([x,y])=>[(320-width)/2+(x-west)*cos*scale,(210-height)/2+(north-y)*scale];
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 320 210');svg.setAttribute('role','img');svg.setAttribute('aria-label','Selected parcel boundary and terrain sample locations. North is up.');
  const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',parts.flatMap(part=>part.map(ring=>ring.map((p,i)=>(i?'L':'M')+project(p).map(n=>n.toFixed(2)).join(',')).join(' ')+' Z')).join(' '));path.setAttribute('fill-rule','evenodd');path.setAttribute('class','site-outline');svg.append(path);
  const values=samples.map(s=>s.elevationMetres).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values);
  for(const [i,point] of points.entries()) {
    const [x,y]=project([point.longitude,point.latitude]),sample=samples[i],valid=Number.isFinite(sample?.elevationMetres);
    const dot=doc.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',String(x));dot.setAttribute('cy',String(y));dot.setAttribute('r','3.2');
    dot.setAttribute('fill',valid?`hsl(${185-((sample.elevationMetres-min)/(max-min||1))*145} 55% 65%)`:'#a0a8aa');
    const title=doc.createElementNS(svg.namespaceURI,'title');title.textContent=`Sample ${i+1}: ${valid?number(sample.elevationMetres,2)+' m':'elevation not available'}`;dot.append(title);svg.append(dot);
  }
  body.append(svg);note(body,`North ↑ · ${points.length} interior sample locations. ${values.length?`Sampled elevations ${number(min,2)}–${number(max,2)} m; dots show relative elevation.`:'Points show the proposed sample pattern.'}`);
 }
 function renderTerrain(terrain) {
  const body=$('terrain');body.replaceChildren();body.append(el('h3','Bare-earth terrain'));
  if(!['ready','partial'].includes(terrain?.status)||terrain.units!=='m'){note(body,samplingPlan?.status==='insufficient-samples'?samplingPlan.reason:terrain?.reason||'USGS terrain evidence is unavailable.');return}
  const datums=new Set(terrain.sources.map(s=>s.verticalDatum).filter(Boolean));
  fit=datums.size===1&&terrain.sources.every(s=>s.verticalDatum)?fitTerrainPlane(terrain.samples):null;
  const metrics=el('div',undefined,'development-metrics');
  metric(metrics,'Lowest sample',`${number(fit?.minElevationMetres,2)} m`);metric(metrics,'Highest sample',`${number(fit?.maxElevationMetres,2)} m`);
  metric(metrics,'Sampled relief',`${number(fit?.reliefMetres,2)} m`);metric(metrics,'Fitted plane grade',Number.isFinite(fit?.planeGradePct)?`${number(fit.planeGradePct,2)}%`:'Unavailable','Average planar fit; not maximum slope');body.append(metrics);
  note(body,`${terrain.availableCount} / ${terrain.requestedCount} elevations available. ${fit?.status==='fitted'?`Plane fit residual: ${number(fit.rmsResidualMetres,3)} m; this is not elevation accuracy.`:fit?.reason||'Grade withheld: a common source vertical datum is not established.'}`);
  note(body,'This DEM describes its acquisition period. Subsequent grading or construction may have changed the site. Sampled relief and a fitted plane do not establish drainage paths, cut/fill quantities or design grades.');
  const details=el('details');details.append(el('summary','Terrain acquisition, resolution & datum'));
  for(const source of terrain.sources){note(details,`${source.project||source.id} · ${number(source.resolutionMetres)} m source resolution · vertical datum ${source.verticalDatum||'Unknown'} · acquired ${date(source.acquisitionDate)}.`);sourceLink(details,'USGS source raster',source.url)}
  note(details,`Fetched ${date(terrain.fetchedAt)}. ${terrain.method||''} DEM heights are not applied to the photographic mesh; its ellipsoid/display heights have a different reference.`);sourceLink(details,'USGS 3DEP service',terrain.sourceUrl);body.append(details);drawPlot(terrain.samples);
 }
 function renderFlood(flood) {
  const body=$('flood');body.replaceChildren();body.append(el('h3','FEMA flood-zone evidence'));
  note(body,'Selected point only. This query does not classify every part of the parcel.');
  if(flood?.status!=='ready'){note(body,flood?.reason||'Flood-zone evidence is unavailable. No absence of flood hazard is inferred.');return}
  for(const zone of flood.zones) {
    const card=el('div',undefined,'site-flood-zone');card.append(el('strong',`Zone ${zone.zone||'Unknown'}`));note(card,zone.subtype||'Subtype not supplied.');
    note(card,`Special Flood Hazard Area: ${zone.specialFloodHazardArea===true?'Yes':zone.specialFloodHazardArea===false?'No':'Unknown'}. Base flood elevation: ${Number.isFinite(zone.baseFloodElevation)?number(zone.baseFloodElevation)+' '+(zone.baseFloodElevationUnits||'unknown units'):'Not supplied'}.`);
    note(card,`Study ${zone.studyId||'Unknown'} · Source citation ${zone.sourceCitation||'Unknown'}.`);body.append(card);
  }
  note(body,`Effective map/revision date: ${date(flood.effectiveDate)}. Fetched ${date(flood.fetchedAt)}. Mapped Zone X is not a prediction of zero flood risk. Verify the applicable map and revisions before a design determination.`);sourceLink(body,'FEMA National Flood Hazard Layer',flood.sourceUrl);
 }
 function setEvidence(next) {
  generation++;controller?.abort();controller=null;evidence=next;measure=null;products=null;fit=null;points=[];samplingPlan=null;
  for(const id of ['geometry','plot','terrain','flood'])$(id).replaceChildren();$('load').disabled=true;$('export').disabled=true;
  const parcel=next?.parcels?.parcel;$('selection').textContent=parcel?.properties?.address||'Select an exact official City parcel.';
  if(!parcel){$('status').textContent='Select an exact City parcel to begin.';return}
  try {measure=measureSite(parcel);samplingPlan=prepareTerrainPoints(parcel,{maxPoints:25});points=samplingPlan.status==='ready'?samplingPlan.points:[];renderGeometry();drawPlot();$('load').disabled=false;$('export').disabled=false;$('status').textContent=points.length?`${points.length} proposed terrain samples. External sources load only when requested.`:`Parcel geometry measured. Terrain sampling withheld: ${samplingPlan.reason} FEMA point evidence can still be requested.`}
  catch { $('status').textContent='This source geometry exceeds the supported site-analysis bounds or is invalid. No dimensions or terrain model were inferred.'; }
 }
 async function refresh() {
  if(disposed||!measure)return;const serial=++generation;controller?.abort();controller=new AbortController();products=null;fit=null;$('load').disabled=true;$('export').disabled=true;$('terrain').replaceChildren();$('flood').replaceChildren();drawPlot();$('status').textContent='Loading independent USGS terrain and FEMA point evidence…';
  try {
    const result=await load({points,selectedPoint:evidence.point},{signal:controller.signal});if(disposed||serial!==generation)return;
    products=result;renderTerrain(result.terrain);renderFlood(result.flood);$('status').textContent='Source checks finished. Each section reports its own coverage and availability.';
  } catch {if(!disposed&&serial===generation){products=null;$('terrain').replaceChildren();$('flood').replaceChildren();$('status').textContent='The source request was unavailable or cancelled. No environmental result was inferred.'}}
  finally {if(!disposed&&serial===generation){$('load').disabled=false;$('export').disabled=!measure}}
 }
 function download() {
  if(!measure)return;
  const payload={schema:'st-louis-site-dossier-v1',exportedAt:new Date().toISOString(),classification:'preliminary-site-evidence',point:evidence.point,parcel:evidence.parcels.parcel,parcelSource:evidence.parcels.source,geometry:measure,samplingPlan,sampleLocations:points,terrain:products?.terrain||null,terrainAnalysis:fit,flood:products?.flood||null,evidenceGaps:gaps,limitations:['GIS geometry is not a legal survey.','Terrain is a dated DEM sample, not current surveyed grade.','FEMA query covers the selected point, not the full parcel.','No civil design, utility clearance, hydrologic model or zoning entitlement has been established.']};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='st-louis-site-dossier.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('load').addEventListener('click',refresh);$('export').addEventListener('click',download);setEvidence(getEvidence());
 return {setEvidence,dispose(){disposed=true;generation++;controller?.abort();$('load').removeEventListener('click',refresh);$('export').removeEventListener('click',download)}};
}
