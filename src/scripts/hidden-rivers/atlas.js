import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { advance, sampleVelocity } from './field.mjs';
import { velocityAt, pointSeries, seriesCSV, formatCoordinate, readView } from './inspection.mjs';

const PALETTES={aurora:['#3285ad','#65ead2','#df9df8','#fff0b8'],ember:['#323f8a','#c76caa','#f89b69','#fff4ce'],ice:['#254377','#4389c8','#82d8dc','#eef9f1']};
const NOTES={agulhas:'Agulhas: compare the surface, 200 m, and 1,000 m layers. The same color scale applies to every depth.',bahamas:'Florida/Bahamas: the 200 m slice excludes the shallow banks. Turquoise surface imagery does not measure velocity at this depth.',denmark:'Denmark Strait/Irminger Sea: a 1,000 m slice samples deep horizontal flow. It cannot reconstruct descent over the shallower sill or identify overflow water without temperature and salinity.'};
const TAIL=70, DURATION=432000, SVG='http://www.w3.org/2000/svg';

export async function startOceanAtlas(){
 const root=document.querySelector('#ocean-canvas');if(!root)return;
 const el=id=>document.getElementById('ocean-'+id),status=el('status'),motion=matchMedia('(prefers-reduced-motion: reduce)'),initial=readView(location.search);
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{status.textContent='3D graphics are unavailable on this device. The animation below remains available.';return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x06121f);root.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.01,160),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=75;controls.maxPolarAngle=Math.PI*.84;
 scene.add(new THREE.AmbientLight(0xd8eafa,2.2));const light=new THREE.DirectionalLight(0xe4f3ef,2);light.position.set(-5,12,4);scene.add(light);
 let group=new THREE.Group();scene.add(group);
 let manifest,region,layers=[],particles=[],fields=[],terrain,basemap,marker,epoch=0,time=initial.time,last=performance.now(),playing=!motion.matches,vertical=initial.vertical,loading=false,view=initial.view,selected=null,fieldStamp=-1,inspectStamp=-1;
 const cache=new Map(),N=innerWidth<700?320:650,tempColor=new THREE.Color(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 let palette=[],speedLimit=2,inViewport=true;
 el('scale').value=initial.scale;el('field').checked=initial.shading;el('palette').value=initial.palette;el('view').value=view;el('exag').value=String(vertical);el('region').value=initial.region;

 function color(speed){const a=Math.min(speedLimit,Math.max(0,speed))/speedLimit*(palette.length-1),i=Math.min(palette.length-2,Math.floor(a));return tempColor.copy(palette[i]).lerp(palette[i+1],a-i);}
 function recolor(){palette=PALETTES[el('palette').value].map(x=>new THREE.Color(x));el('gradient').style.background=`linear-gradient(90deg,${PALETTES[el('palette').value].join(',')})`;fieldStamp=-1;}
 function world(lon,lat,depth=0){const b=region.bounds,latc=(b[1]+b[3])/2;return new THREE.Vector3((lon-(b[0]+b[2])/2)*111.195*Math.cos(latc*Math.PI/180)/200,-depth/1000*(view==='map'?0:vertical)/200,-(lat-latc)*111.195/200);}
 function point(layer,x,y){return world(layer.lon0+x*layer.dlon,layer.lat0+y*layer.dlat,layer.depth);}
 function visible(depth){return el('depth').value==='all'||Number(el('depth').value)===depth;}
 function setDepths(){
  if(!region)return;
  const allOption=[...el('depth').options].find(o=>o.value==='all');if(allOption)allOption.disabled=view==='map';
  if(view==='map'&&el('depth').value==='all')el('depth').value=String(layers[0].depth);
  status.textContent=`${region.title} · ${el('depth').value==='all'?`${layers.length} depth layers`:el('depth').selectedOptions[0].textContent}`;
  for(const p of particles){p.lines.visible=visible(p.layer.depth);p.heads.visible=p.lines.visible;}
  for(const f of fields){f.mesh.visible=visible(f.layer.depth)&&el('field').checked;f.arrows.visible=visible(f.layer.depth);f.mesh.material.opacity=el('depth').value==='all'?.17:.48;}
  group.traverse(o=>{if(o.userData.frame)o.visible=visible(o.userData.depth);});
  speedLimit=el('scale').value==='regional'?Math.ceil(Math.max(...layers.map(l=>l.speedMax))*4)/4:2;
  el('legend-mid').textContent=String(speedLimit/2);el('legend-max').textContent=`${speedLimit}${el('scale').value==='common'?'+':''}`;
  fieldStamp=-1;updateMarker();renderParticles();
 }
 function disposeGroup(){const textures=new Set();group.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(m.map)textures.add(m.map);m.dispose();}});textures.forEach(t=>t.dispose());scene.remove(group);group=new THREE.Group();scene.add(group);particles=[];fields=[];terrain=basemap=marker=null;el('labels').replaceChildren();}
 async function file(url){if(!cache.has(url))cache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error(`Data request failed (${r.status})`);return r.arrayBuffer();}).catch(e=>{cache.delete(url);throw e;}));return cache.get(url);}
 function respawn(p,i){const j=p.valid[Math.floor(Math.random()*p.valid.length)],nx=p.layer.shape[2];p.x[i]=j%nx+.2+Math.random()*.6;p.y[i]=Math.floor(j/nx)+.2+Math.random()*.6;const w=point(p.layer,p.x[i],p.y[i]);for(let k=0;k<TAIL;k++)p.history.set([w.x,w.y,w.z],(i*TAIL+k)*3);p.ages[i]=0;}
 function resetTracers(){for(const p of particles)for(let i=0;i<N;i++)respawn(p,i);renderParticles();}
 function makeParticles(layer){
  const valid=[],[,,nx]=layer.shape;for(let y=0;y<layer.shape[1]-1;y++)for(let x=0;x<nx-1;x++)if(sampleVelocity(layer,x+.5,y+.5,time))valid.push(y*nx+x);if(!valid.length)return;
  const geometry=new THREE.BufferGeometry(),pos=new Float32Array(N*(TAIL-1)*6),colors=new Float32Array(pos.length),headPos=new Float32Array(N*3),headColors=new Float32Array(N*3);
  geometry.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));lines.frustumCulled=false;group.add(lines);
  const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.BufferAttribute(headPos,3));hg.setAttribute('color',new THREE.BufferAttribute(headColors,3));
  const heads=new THREE.Points(hg,new THREE.PointsMaterial({size:1.6,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}));heads.frustumCulled=false;group.add(heads);
  const p={layer,valid,x:new Float32Array(N),y:new Float32Array(N),ages:new Uint16Array(N),history:new Float32Array(N*TAIL*3),speeds:new Float32Array(N),pos,colors,headPos,headColors,lines,heads};for(let i=0;i<N;i++)respawn(p,i);particles.push(p);
 }
 // Moving a particle and rendering its trail are separate: paused changes cannot consume history.
 function moveParticles(dt){for(const p of particles){for(let i=0;i<N;i++){
  const move=advance(p.layer,p.x[i],p.y[i],time,dt);
  if(!move||p.ages[i]>700){respawn(p,i);continue;}
  p.x[i]=move[0];p.y[i]=move[1];p.speeds[i]=move[2];p.ages[i]++;
  const start=i*TAIL*3;p.history.copyWithin(start+3,start,start+(TAIL-1)*3);const w=point(p.layer,p.x[i],p.y[i]);p.history.set([w.x,w.y,w.z],start);
 }}}
 function renderParticles(){for(const p of particles){if(!p.lines.visible)continue;for(let i=0;i<N;i++){
  const v=sampleVelocity(p.layer,p.x[i],p.y[i],time);const c=color(v?Math.hypot(...v):0),start=i*TAIL*3;
  p.headPos.set(p.history.subarray(start,start+3),i*3);p.headColors.set([c.r,c.g,c.b],i*3);
  for(let j=0;j<TAIL-1;j++){const o=(i*(TAIL-1)+j)*6,h=start+j*3;p.pos.set(p.history.subarray(h,h+6),o);const fade=Math.pow(1-j/TAIL,1.7);for(let k=0;k<2;k++)p.colors.set([c.r*fade,c.g*fade,c.b*fade],o+k*3);}
 }for(const g of [p.lines.geometry,p.heads.geometry]){g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;}}}
 function makeField(layer){
  const [ ,ny,nx]=layer.shape,canvas=document.createElement('canvas');canvas.width=nx-1;canvas.height=ny-1;const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sw=point(layer,0,0),ne=point(layer,nx-1,ny-1),mesh=new THREE.Mesh(new THREE.PlaneGeometry(ne.x-sw.x,sw.z-ne.z),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set((sw.x+ne.x)/2,sw.y+.002,(sw.z+ne.z)/2);group.add(mesh);
  const arrows=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.52,depthWrite:false}));arrows.frustumCulled=false;group.add(arrows);fields.push({layer,canvas,ctx,texture,mesh,arrows});
 }
 function updateFields(){
  const stamp=Math.floor(time/3600);if(stamp===fieldStamp)return;fieldStamp=stamp;
  for(const f of fields){const {layer,ctx,canvas}=f,[,ny,nx]=layer.shape,image=ctx.createImageData(nx-1,ny-1),positions=[],colors=[],step=Math.max(4,Math.round(Math.max(nx,ny)/23));
   for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
    const v=sampleVelocity(layer,x+.5,y+.5,time);if(!v)continue;const speed=Math.hypot(...v),c=color(speed);const srgb=c.clone().convertLinearToSRGB(),i=((ny-2-y)*(nx-1)+x)*4;
    image.data.set([Math.round(srgb.r*255),Math.round(srgb.g*255),Math.round(srgb.b*255),205],i);
    if(x%step===Math.floor(step/2)&&y%step===Math.floor(step/2)&&speed>.005){
     const p=point(layer,x+.5,y+.5);p.y+=.004;const d=new THREE.Vector3(v[0],0,-v[1]).normalize();const length=(world(layer.lon0+layer.dlon*step,layer.lat0).x-world(layer.lon0,layer.lat0).x)*.52;
     const a=p.clone().addScaledVector(d,-length*.5),b=p.clone().addScaledVector(d,length*.5),side=new THREE.Vector3(-d.z,0,d.x),wing=b.clone().addScaledVector(d,-length*.32);
     for(const q of [a,b,b,wing.clone().addScaledVector(side,length*.18),b,wing.clone().addScaledVector(side,-length*.18)]){positions.push(q.x,q.y,q.z);colors.push(c.r,c.g,c.b);}
    }
   }
   ctx.putImageData(image,0,0);f.texture.needsUpdate=true;f.arrows.geometry.dispose();f.arrows.geometry=new THREE.BufferGeometry();f.arrows.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));f.arrows.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  }
 }
 function buildGeography(r,z,texture){
  const t=r.terrain,[ny,nx]=t.shape,geometry=new THREE.PlaneGeometry(1,1,nx-1,ny-1),pos=geometry.attributes.position.array,uv=geometry.attributes.uv.array,colors=new Float32Array(nx*ny*3);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const i=y*nx+x,lon=t.lon0+x*t.dlon,lat=t.lat0+y*t.dlat,p=world(lon,lat,-z[i]);pos.set([p.x,p.y,p.z],i*3);
   uv.set([(lon-r.bounds[0])/(r.bounds[2]-r.bounds[0]),(lat-r.bounds[1])/(r.bounds[3]-r.bounds[1])],i*2);
   const c=z[i]>=0?new THREE.Color(0xc6cbb6):new THREE.Color().setHSL(.56,.45,.34+Math.max(0,1+z[i]/6500)*.17);colors.set([c.r,c.g,c.b],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,vertexColors:true,roughness:1,side:THREE.DoubleSide,transparent:true,opacity:.72,depthWrite:false}));terrain.userData.altitudes=z;group.add(terrain);
  const b=r.bounds,sw=world(b[0],b[1]),ne=world(b[2],b[3]);basemap=new THREE.Mesh(new THREE.PlaneGeometry(ne.x-sw.x,sw.z-ne.z),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false}));basemap.rotation.x=-Math.PI/2;basemap.position.y=.006;group.add(basemap);
  const grid=[];for(let k=0;k<=4;k++){const lon=b[0]+(b[2]-b[0])*k/4,lat=b[1]+(b[3]-b[1])*k/4;grid.push(world(lon,b[1]),world(lon,b[3]),world(b[0],lat),world(b[2],lat));}
  const graticule=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid),new THREE.LineBasicMaterial({color:0x819bab,transparent:true,opacity:.12,depthWrite:false}));group.add(graticule);
  for(const layer of layers){
   const corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]].map(([x,y])=>world(x,y,layer.depth));
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:0x7898ad,transparent:true,opacity:.5}));line.userData={depth:layer.depth,frame:true};group.add(line);
   const label=document.createElement('span');label.textContent=layer.depth===0?'Surface':`${layer.depth.toLocaleString()} m`;label.dataset.depth=layer.depth;el('labels').appendChild(label);
  }
  const extent=document.createElement('span');extent.className='ocean-extent';extent.textContent=`${Math.abs(b[0])}–${Math.abs(b[2])}° ${b[0]<0?'W':'E'} / ${Math.min(Math.abs(b[1]),Math.abs(b[3]))}–${Math.max(Math.abs(b[1]),Math.abs(b[3]))}° ${b[1]<0?'S':'N'}`;el('extent').replaceChildren(extent);
 }
 function setVertical(){vertical=Number(el('exag').value);const displayScale=view==='map'?0:vertical;el('exag').disabled=view==='map';el('vertical').textContent=view==='map'?'North-up · planar map':`Vertical scale ×${vertical}`;el('exag-label').textContent=view==='map'?'Not applied in map view':`${vertical}×`;if(!region)return;
  group.traverse(o=>{if(o.userData.altitudes){const a=o.geometry.attributes.position.array;for(let i=0;i<o.userData.altitudes.length;i++)a[i*3+1]=o.userData.altitudes[i]/1000*displayScale/200;o.geometry.attributes.position.needsUpdate=true;o.geometry.computeVertexNormals();}else if(o.userData.frame){const a=o.geometry.attributes.position.array;for(let i=1;i<a.length;i+=3)a[i]=-o.userData.depth/1000*displayScale/200;o.geometry.attributes.position.needsUpdate=true;}});
  for(const p of particles)for(let i=1;i<p.history.length;i+=3)p.history[i]=-p.layer.depth/1000*displayScale/200;
  for(const f of fields)f.mesh.position.y=-f.layer.depth/1000*displayScale/200+.002;fieldStamp=-1;updateMarker();renderParticles();
 }
 function resetCamera(){if(!region)return;const b=region.bounds,width=world(b[2],b[1]).x*2,height=world(b[0],b[1]).z*2,span=Math.max(width,height),dist=Math.max(height,width/camera.aspect)/(2*Math.tan(43*Math.PI/360));controls.target.set(0,view==='map'?0:-.65,0);camera.position.copy(view==='map'?new THREE.Vector3(0,dist*1.1,.001):new THREE.Vector3(.12,.82,1).normalize().multiplyScalar(Math.max(span,dist)*1.14));camera.up.set(0,1,0);controls.enableRotate=view!=='map';controls.update();el('compass').textContent=view==='map'?'↑ N':'N';}
 function syncPlay(){el('play').textContent=playing?'Pause':'Play';el('play').setAttribute('aria-pressed',String(playing));}
 async function load(id,restore=false){const current=++epoch;loading=true;playing=false;syncPlay();status.textContent='Loading bathymetry and current layers…';el('play').disabled=true;
  try{
   const r=manifest.regions.find(r=>r.id===id),raw=await Promise.all(r.layers.map(async l=>({...l,values:new Int16Array(await file('/hidden-rivers/data/'+l.file))}))),z=new Int16Array(await file('/hidden-rivers/data/'+r.terrain.file)),texture=await new THREE.TextureLoader().loadAsync(`/hidden-rivers/images/${id}_basemap.jpg`);
   if(current!==epoch){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;disposeGroup();region=r;layers=raw;time=restore?initial.time:0;selected=null;
   el('depth').replaceChildren();for(const [v,t] of (raw.length>1?[['all','All available layers'],...raw.map(l=>[String(l.depth),l.depth?`${l.depth.toLocaleString()} m`:'Surface'])]:[[String(raw[0].depth),`${raw[0].depth.toLocaleString()} m`]]))el('depth').add(new Option(t,v));
   if(restore&&[...el('depth').options].some(o=>o.value===initial.depth))el('depth').value=initial.depth;
   buildGeography(r,z,texture);raw.forEach(makeField);raw.forEach(makeParticles);el('region-note').textContent=NOTES[id];el('lon').value=((r.bounds[0]+r.bounds[2])/2).toFixed(3);el('lat').value=((r.bounds[1]+r.bounds[3])/2).toFixed(3);clearInspection();
   setDepths();setVertical();resetCamera();updateFields();loading=false;playing=!(restore&&new URLSearchParams(location.search).has('time'))&&!motion.matches;el('play').disabled=false;syncPlay();
   if(restore&&initial.longitude!==null&&initial.latitude!==null)inspect(initial.longitude,initial.latitude);
   window.__oceanAtlas={ready:true,region:id,depths:raw.map(l=>l.depth),getTime:()=>time,inspect,getSelected:()=>selected,getTrailChecksum:()=>particles.reduce((s,p)=>s+p.history.reduce((a,b)=>a+b,0),0)};
  }catch(e){if(current!==epoch)return;loading=false;status.textContent=`Unable to load the 3D data. ${e.message}. The film and source downloads below remain available.`;console.error(e);}
 }
 function clearInspection(){el('inspect-title').textContent='Inspect a water column';el('inspect-empty').hidden=false;el('inspect-results').hidden=true;inspectStamp=-1;}
 function inspect(lon,lat){if(!region||loading)return;const b=region.bounds;if(!Number.isFinite(lon+lat)||lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3]){el('inspect-message').textContent='Choose a location inside the displayed region.';return;}
  selected={lon,lat};el('inspect-message').textContent='';el('inspect-title').textContent=formatCoordinate(lon,lat);el('lon').value=lon.toFixed(3);el('lat').value=lat.toFixed(3);el('inspect-empty').hidden=true;el('inspect-results').hidden=false;inspectStamp=-1;updateInspection();drawProfile();updateMarker();
 }
 function updateMarker(){if(marker){group.remove(marker);marker.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});marker=null;}if(!selected||!region)return;marker=new THREE.Group();const {lon,lat}=selected,depths=layers.filter(l=>visible(l.depth)).map(l=>l.depth);
  for(const d of depths){const ring=new THREE.Mesh(new THREE.RingGeometry(.045,.06,32),new THREE.MeshBasicMaterial({color:0xfff5d5,side:THREE.DoubleSide,depthTest:false,transparent:true}));ring.rotation.x=-Math.PI/2;ring.position.copy(world(lon,lat,d));ring.position.y+=.015;marker.add(ring);}
  if(depths.length>1){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([world(lon,lat,Math.min(...depths)),world(lon,lat,Math.max(...depths))]),new THREE.LineBasicMaterial({color:0xfff5d5,transparent:true,opacity:.65,depthTest:false}));marker.add(line);}group.add(marker);
 }
 function updateInspection(){if(!selected)return;const stamp=Math.floor(time/900);if(stamp===inspectStamp)return;inspectStamp=stamp;const rows=[];
  for(const layer of layers){const v=velocityAt(layer,selected.lon,selected.lat,time),row=document.createElement('tr');const cells=[layer.depth===0?'Surface':`${layer.depth.toLocaleString()} m`,v?v.speed.toFixed(3):'No data',v?v.east.toFixed(3):'—',v?v.north.toFixed(3):'—',v?.bearing!==null&&v?`${v.bearing.toFixed(0)}°`:'—'];for(const [i,value] of cells.entries()){const td=document.createElement(i===0?'th':'td');td.textContent=value;if(i===0)td.scope='row';row.appendChild(td);}rows.push(row);}
  el('inspect-body').replaceChildren(...rows);el('inspect-time').textContent=formatTime();
 }
 function svg(name,attrs={}){const e=document.createElementNS(SVG,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
 function drawProfile(){if(!selected||!layers.length)return;const chart=el('profile'),width=Math.max(300,chart.clientWidth),height=190,left=48,right=18,top=23,bottom=34,rows=pointSeries(layers,selected.lon,selected.lat),valid=rows.filter(r=>r.speed!==null);chart.replaceChildren();chart.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const title=svg('title');title.textContent='Horizontal speed at this location across six daily model snapshots';chart.appendChild(title);
  if(!valid.length){const text=svg('text',{x:width/2,y:90,'text-anchor':'middle'});text.textContent='No valid model samples at this location.';chart.appendChild(text);return;}
  const ymax=Math.max(.1,Math.ceil(Math.max(...valid.map(r=>r.speed))*10)/10),x=i=>left+i/5*(width-left-right),y=v=>height-bottom-v/ymax*(height-top-bottom);
  for(let k=0;k<=2;k++){const val=ymax*k/2;chart.appendChild(svg('line',{x1:left,x2:width-right,y1:y(val),y2:y(val),class:'profile-grid'}));const label=svg('text',{x:left-8,y:y(val)+4,'text-anchor':'end'});label.textContent=val.toFixed(2);chart.appendChild(label);}
  const axis=svg('text',{x:left,y:13});axis.textContent='Speed · m/s';chart.appendChild(axis);
  for(const i of [0,2,5]){const t=svg('text',{x:x(i),y:height-10,'text-anchor':i===0?'start':i===5?'end':'middle'});t.textContent=new Date(layers[0].dates[i]).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});chart.appendChild(t);}
  for(const l of layers){const values=rows.filter(r=>r.depth===l.depth);let d='',connected=false;values.forEach((r,i)=>{if(r.speed===null){connected=false;return;}d+=`${connected?'L':'M'}${x(i)},${y(r.speed)} `;connected=true;const dot=svg('circle',{cx:x(i),cy:y(r.speed),r:3,class:`profile-depth-${l.depth}`});const tooltip=svg('title');tooltip.textContent=`${r.date}: ${r.speed.toFixed(3)} m/s at ${l.depth} m`;dot.appendChild(tooltip);chart.appendChild(dot);});chart.appendChild(svg('path',{d,fill:'none',class:`profile-line profile-depth-${l.depth}`}));}
  el('profile-legend').replaceChildren(...layers.map(l=>{const span=document.createElement('span');span.className=`profile-depth-${l.depth}`;span.textContent=l.depth===0?'● Surface':l.depth===200?'– – 200 m':'··· 1,000 m';return span;}));
 }
 function formatTime(){return new Date(Date.parse(layers[0]?.dates[0]||'2026-09-29')+time*1000).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC';}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function saveImage(){if(!region||loading)return;renderer.render(scene,camera);const canvas=document.createElement('canvas'),source=renderer.domElement;canvas.width=Math.max(1400,source.width);const imageHeight=Math.round(source.height*canvas.width/source.width);canvas.height=imageHeight+160;const ctx=canvas.getContext('2d');ctx.fillStyle='#06121f';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,imageHeight);const size=22,y=imageHeight;ctx.fillStyle='#e9f1f1';ctx.font=`600 ${size}px sans-serif`;ctx.fillText(`Hidden Rivers · ${region.title}`,24,y+32);ctx.font=`${size*.72}px sans-serif`;ctx.fillText(`${formatTime()} · ${el('depth').selectedOptions[0].textContent} · ${view==='map'?'north-up planar map':`vertical ×${vertical}`}`,24,y+62);ctx.fillText('HYCOM/ESPC analysis · NOAA ETOPO1 · Imagery: Esri, Maxar, Earthstar Geographics',24,y+90);ctx.fillText('Horizontal currents at fixed depths · ihelfrich.github.io/hidden-rivers/',24,y+116);const gx=canvas.width-280,gy=y+28,gradient=ctx.createLinearGradient(gx,0,gx+230,0);PALETTES[el('palette').value].forEach((c,i)=>gradient.addColorStop(i/3,c));ctx.fillStyle=gradient;ctx.fillRect(gx,gy,230,10);ctx.fillStyle='#e9f1f1';ctx.fillText(`0–${speedLimit} m/s${el('scale').value==='common'?' (2+ clipped)':''}`,gx,gy+34);canvas.toBlob(blob=>{if(blob)download(blob,`hidden-rivers-${region.id}-${Math.round(time/3600)}h.png`);});}
 function resize(){const w=root.clientWidth,h=root.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(region)resetCamera();if(selected)drawProfile();}
 new ResizeObserver(resize).observe(root);new ResizeObserver(()=>{if(selected)drawProfile();}).observe(el('profile'));resize();
 new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;last=performance.now();}).observe(root);
 function tick(now){const elapsed=Math.min((now-last)/1000,.05);last=now;
  if(!document.hidden&&inViewport){if(playing&&!loading&&layers.length){const dt=Math.min(900,elapsed*21600,DURATION-time);if(dt>0){moveParticles(dt);time+=dt;renderParticles();}if(time>=DURATION){time=0;resetTracers();fieldStamp=inspectStamp=-1;}}
   el('time').value=String(Math.round(time));el('date').value=formatTime();controls.update();if(!loading){updateFields();updateInspection();}
   let labelY=-100;for(const label of el('labels').children){const depth=Number(label.dataset.depth);label.hidden=!visible(depth)||view==='map';if(!label.hidden){const p=world(region.bounds[0],region.bounds[1],depth).project(camera),x=Math.max(8,Math.min(root.clientWidth-90,(p.x*.5+.5)*root.clientWidth)),y=Math.min(root.clientHeight-125,Math.max(labelY+24,(-p.y*.5+.5)*root.clientHeight));labelY=y;label.style.left=`${x}px`;label.style.top=`${y}px`;label.style.display=p.z<1?'':'none';}}
   if(region&&view!=='map'){const a=world((region.bounds[0]+region.bounds[2])/2,(region.bounds[1]+region.bounds[3])/2).project(camera),b=world((region.bounds[0]+region.bounds[2])/2,(region.bounds[1]+region.bounds[3])/2+1).project(camera);el('compass').textContent='↑ N';el('compass').style.transform=`rotate(${Math.atan2(b.x-a.x,b.y-a.y)*180/Math.PI}deg)`;}else el('compass').style.transform='';
   renderer.render(scene,camera);
  }requestAnimationFrame(tick);
 }
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||!region||loading)return;const rect=root.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const depth=el('depth').value==='all'?0:Number(el('depth').value),target=new THREE.Vector3();if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),depth/1000*(view==='map'?0:vertical)/200),target))return;const b=region.bounds,latc=(b[1]+b[3])/2;inspect((b[0]+b[2])/2+target.x*200/(111.195*Math.cos(latc*Math.PI/180)),latc-target.z*200/111.195);});
 el('play').onclick=()=>{if(loading)return;playing=!playing;inspectStamp=fieldStamp=-1;syncPlay();};el('reset').onclick=resetCamera;el('region').onchange=()=>{if(manifest)load(el('region').value);};el('depth').onchange=setDepths;el('palette').onchange=()=>{recolor();renderParticles();};el('scale').onchange=setDepths;el('field').onchange=setDepths;el('exag').oninput=setVertical;el('view').onchange=()=>{view=el('view').value;if(!region||loading)return;setDepths();setVertical();resetCamera();};
 el('time').oninput=()=>{playing=false;syncPlay();time=Number(el('time').value);fieldStamp=inspectStamp=-1;resetTracers();};
 el('inspect-form').onsubmit=e=>{e.preventDefault();inspect(Number(el('lon').value),Number(el('lat').value));};
 el('csv').onclick=()=>{if(selected)download(new Blob([seriesCSV(pointSeries(layers,selected.lon,selected.lat))],{type:'text/csv'}),`hidden-rivers-${region.id}-point.csv`);};el('image').onclick=saveImage;
 el('share').onclick=async()=>{if(!region||loading)return;playing=false;inspectStamp=fieldStamp=-1;syncPlay();const q=new URLSearchParams({region:region.id,depth:el('depth').value,palette:el('palette').value,scale:el('scale').value,shading:el('field').checked?'1':'0',view,time:String(Math.round(time)),vertical:String(vertical)});if(selected){q.set('lon',selected.lon.toFixed(5));q.set('lat',selected.lat.toFixed(5));}const url=new URL(location.href);url.search=q.toString();url.hash='explorer';history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);el('action-status').textContent='View link copied.';}catch{el('action-status').textContent='This view is now saved in the address bar. Copy its URL to share.';}};
 motion.addEventListener('change',()=>{if(motion.matches){playing=false;syncPlay();}});
 recolor();setVertical();syncPlay();requestAnimationFrame(tick);
 try{const res=await fetch('/hidden-rivers/data/manifest.json');if(!res.ok)throw Error(res.status);manifest=await res.json();await load(initial.region,true);}catch(e){status.textContent='The data manifest could not be loaded. Please use the video or try again.';console.error(e);}
}
