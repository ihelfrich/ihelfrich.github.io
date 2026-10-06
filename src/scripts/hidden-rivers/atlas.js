import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { advance, sampleVelocity } from './field.mjs';

export async function startOceanAtlas(){
 const root=document.querySelector('#ocean-canvas');if(!root)return;
 const el=id=>document.querySelector('#ocean-'+id),status=el('status');
 let renderer;
 try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){status.textContent='3D graphics are unavailable on this device. The animation below remains available.';return;}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x06121f);root.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.01,150);camera.position.set(6,6,9);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=60;controls.target.set(0,-.8,0);controls.maxPolarAngle=Math.PI*.88;
 scene.add(new THREE.AmbientLight(0x90b4de,1.8));const light=new THREE.DirectionalLight(0xe4f3ef,2);light.position.set(-5,12,4);scene.add(light);
 let group=new THREE.Group();scene.add(group);let region=null,layers=[],particles=[],terrain=null,basemap=null,epoch=0,time=0,last=performance.now(),playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,vertical=80;
 const TAIL=40,N=innerWidth<700?450:1000;const cache=new Map();let manifest;
 const palettes={aurora:['#3285ad','#65ead2','#df9df8','#fff0b8'],ember:['#323f8a','#c76caa','#f89b69','#fff4ce'],ice:['#254377','#4389c8','#82d8dc','#eef9f1']};let palette=[];
 const tempColor=new THREE.Color();
 function recolor(){palette=palettes[el('palette').value].map(x=>new THREE.Color(x));el('gradient').style.background=`linear-gradient(90deg,${palettes[el('palette').value].join(',')})`;}
 recolor();
 function col(speed){const a=Math.min(2,Math.max(0,speed))/2*(palette.length-1),i=Math.min(palette.length-2,Math.floor(a));return tempColor.copy(palette[i]).lerp(palette[i+1],a-i);}
 function world(lon,lat,depth=0){const b=region.bounds,latc=(b[1]+b[3])/2;return new THREE.Vector3((lon-(b[0]+b[2])/2)*111.195*Math.cos(latc*Math.PI/180)/200,-depth/1000*vertical/200,-(lat-latc)*111.195/200);}
 function point(layer,x,y){return world(layer.lon0+x*layer.dlon,layer.lat0+y*layer.dlat,layer.depth);}
 function dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});scene.remove(group);group=new THREE.Group();scene.add(group);particles=[];el('labels').replaceChildren();}
 async function file(url){if(!cache.has(url)){cache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error(`Data request failed (${r.status})`);return r.arrayBuffer();}));}return cache.get(url);}
 function respawn(p,i){const layer=p.layer,j=p.valid[Math.floor(Math.random()*p.valid.length)];p.x[i]=j%layer.shape[2]+Math.random()*.5;p.y[i]=Math.floor(j/layer.shape[2])+Math.random()*.5;const w=point(layer,p.x[i],p.y[i]);for(let k=0;k<TAIL;k++){const q=(i*TAIL+k)*3;p.history[q]=w.x;p.history[q+1]=w.y;p.history[q+2]=w.z;}p.ages[i]=0;}
 function makeParticles(layer){const valid=[];const nx=layer.shape[2],ny=layer.shape[1];for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++)if(sampleVelocity(layer,x+.25,y+.25,0))valid.push(y*nx+x);if(!valid.length)return;
  const geometry=new THREE.BufferGeometry(),pos=new Float32Array(N*(TAIL-1)*6),colors=new Float32Array(pos.length);geometry.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));lines.frustumCulled=false;group.add(lines);
  const p={layer,valid,x:new Float32Array(N),y:new Float32Array(N),ages:new Uint16Array(N),history:new Float32Array(N*TAIL*3),pos,colors,lines};for(let i=0;i<N;i++)respawn(p,i);particles.push(p);
 }
 function layerPlanes(){const b=region.bounds;for(const layer of layers){const corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]].map(([x,y])=>world(x,y,layer.depth));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:0x568399,transparent:true,opacity:.45}));line.userData.depth=layer.depth;group.add(line);const label=document.createElement('span');label.textContent=layer.depth===0?'Surface':`${layer.depth.toLocaleString()} m`;label.dataset.depth=layer.depth;el('labels').appendChild(label);}}
 function setVertical(){vertical=Number(el('exag').value);el('vertical').textContent=`Vertical scale ×${vertical}`;el('exag-label').textContent=`${vertical}×`;if(!region)return;
  group.traverse(o=>{if(o.userData.altitudes){const a=o.geometry.attributes.position.array;for(let i=0;i<o.userData.altitudes.length;i++)a[i*3+1]=o.userData.altitudes[i]/1000*vertical/200;o.geometry.attributes.position.needsUpdate=true;o.geometry.computeVertexNormals();}else if(o.userData.depth!==undefined){const a=o.geometry.attributes.position.array;for(let i=1;i<a.length;i+=3)a[i]=-o.userData.depth/1000*vertical/200;o.geometry.attributes.position.needsUpdate=true;}});
  for(const p of particles)for(let i=1;i<p.history.length;i+=3)p.history[i]=-p.layer.depth/1000*vertical/200;
 }
 async function load(id){const current=++epoch;playing=false;syncPlay();status.textContent='Loading bathymetry and current layers…';
  try{const r=manifest.regions.find(r=>r.id===id);const raw=await Promise.all(r.layers.map(async l=>({...l,values:new Int16Array(await file('/hidden-rivers/data/'+l.file))})));let z;if(r.terrain)z=new Int16Array(await file('/hidden-rivers/data/'+r.terrain.file));if(current!==epoch)return;
   dispose();region=r;layers=raw;time=0;
   el('depth').replaceChildren();const options=raw.length>1?[['all','All available layers'],...raw.map(l=>[String(l.depth),l.depth?`${l.depth.toLocaleString()} m`:'Surface'])]:raw.map(l=>[String(l.depth),`${l.depth.toLocaleString()} m`]);for(const [v,t] of options){const op=new Option(t,v);el('depth').add(op);}
   if(z){const t=r.terrain,[ny,nx]=t.shape;const geometry=new THREE.PlaneGeometry(1,1,nx-1,ny-1),pos=geometry.attributes.position.array,colors=new Float32Array(nx*ny*3);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let i=y*nx+x;const p=world(t.lon0+x*t.dlon,t.lat0+y*t.dlat,-z[i]);pos.set([p.x,p.y,p.z],i*3);const c=z[i]>=0?new THREE.Color().setHSL(.30,.12,.20+Math.min(z[i]/5000,.2)):new THREE.Color().setHSL(.57,.36,.08+Math.max(0,1+z[i]/6500)*.13);colors.set([c.r,c.g,c.b],i*3);}
    // PlaneGeometry's index winding reverses under our south-to-north row mapping; DoubleSide preserves the visible terrain.
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,transparent:true,opacity:.32}));terrain.userData.altitudes=z;group.add(terrain);
   }
   const b=r.bounds,texture=await new THREE.TextureLoader().loadAsync(`/hidden-rivers/images/${id}_basemap.jpg`);if(current!==epoch){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;const ll=world(b[0],b[1]),ur=world(b[2],b[3]);basemap=new THREE.Mesh(new THREE.PlaneGeometry(ur.x-ll.x,ll.z-ur.z),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}));basemap.rotation.x=-Math.PI/2;basemap.position.y=.005;group.add(basemap);
   layerPlanes();raw.forEach(makeParticles);status.textContent=`${r.title} · HYCOM/ESPC · ${raw.length} depth ${raw.length===1?'layer':'layers'}`;
   el('region-note').textContent={agulhas:'Agulhas: compare the surface, 200 m, and 1,000 m layers. Tessera supplies annual coastal context, shown below.',bahamas:'Florida/Bahamas: the 200 m slice excludes the shallow banks. Turquoise surface imagery does not measure current velocity at this depth.',denmark:'Denmark Strait/Irminger Sea: a 1,000 m slice samples deep horizontal flow. It cannot reconstruct descent over the shallower sill or identify overflow water without temperature and salinity.'}[id];
   resetCamera();playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;syncPlay();drawParticles(0);window.__oceanAtlas={ready:true,region:id,depths:raw.map(l=>l.depth),getTime:()=>time};
  }catch(e){status.textContent=`Unable to load the 3D data. ${e.message}. The film and source downloads below remain available.`;console.error(e);}
 }
 function resetCamera(){const b=region?.bounds||[10,-43,35,-30],span=Math.max((b[2]-b[0])*111.195*Math.cos((b[1]+b[3])/2*Math.PI/180)/200,(b[3]-b[1])*111.195/200),dist=span/(2*Math.tan(43*Math.PI/360))*Math.max(1,1/camera.aspect)*1.12;camera.position.copy(new THREE.Vector3(.30,.72,1).normalize().multiplyScalar(dist));controls.target.set(0,-.45,0);controls.update();}
 function syncPlay(){el('play').textContent=playing?'Pause':'Play';el('play').setAttribute('aria-pressed',String(playing));}
 function drawParticles(dt){for(const p of particles){p.lines.visible=el('depth').value==='all'||Number(el('depth').value)===p.layer.depth;if(!p.lines.visible)continue;
   for(let i=0;i<N;i++){let move=dt?advance(p.layer,p.x[i],p.y[i],time,dt):[p.x[i],p.y[i],Math.hypot(...(sampleVelocity(p.layer,p.x[i],p.y[i],time)||[0,0]))];if(!move||p.ages[i]>850){respawn(p,i);move=[p.x[i],p.y[i],0];}else if(dt){p.x[i]=move[0];p.y[i]=move[1];p.ages[i]++;}
    const start=i*TAIL*3;p.history.copyWithin(start+3,start,start+(TAIL-1)*3);const w=point(p.layer,p.x[i],p.y[i]);p.history.set([w.x,w.y,w.z],start);const c=col(move[2]);
    for(let j=0;j<TAIL-1;j++){const o=(i*(TAIL-1)+j)*6,h=start+j*3;p.pos.set(p.history.subarray(h,h+6),o);const fade=Math.pow(1-j/TAIL,1.7);for(let k=0;k<2;k++)p.colors.set([c.r*fade,c.g*fade,c.b*fade],o+k*3);}
   }p.lines.geometry.attributes.position.needsUpdate=true;p.lines.geometry.attributes.color.needsUpdate=true;
  }}
 function resize(){const w=root.clientWidth,h=root.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(region)resetCamera();}new ResizeObserver(resize).observe(root);resize();
 function tick(now){const elapsed=document.hidden?0:Math.min((now-last)/1000,.05);last=now;if(playing&&layers.length){let dt=Math.min(900,elapsed*21600,432000-time);if(dt>0){drawParticles(dt);time+=dt;}if(time>=432000){time=0;for(const p of particles)for(let i=0;i<N;i++)respawn(p,i);}}
  el('time').value=String(time);el('date').value=new Date(Date.UTC(2026,8,29)+time*1000).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC';controls.update();
  let lastLabelY=-100;for(const label of el('labels').children){const depth=Number(label.dataset.depth),visible=el('depth').value==='all'||Number(el('depth').value)===depth;label.hidden=!visible;if(region&&visible){const p=world(region.bounds[0],region.bounds[1],depth).project(camera);const px=Math.max(4,Math.min(root.clientWidth-85,(p.x*.5+.5)*root.clientWidth)),py=Math.max(lastLabelY+23,Math.min(root.clientHeight-30,(-p.y*.5+.5)*root.clientHeight));lastLabelY=py;label.style.left=`${px}px`;label.style.top=`${py}px`;label.style.display=p.z<1?'':'none';}}
  renderer.render(scene,camera);requestAnimationFrame(tick);
 }
 el('play').onclick=()=>{playing=!playing;syncPlay();};el('reset').onclick=resetCamera;el('region').onchange=()=>load(el('region').value);el('depth').onchange=()=>{for(const p of particles)for(let i=0;i<N;i++)respawn(p,i);drawParticles(0);};el('palette').onchange=()=>{recolor();drawParticles(0);};el('exag').oninput=()=>{setVertical();drawParticles(0);};el('time').oninput=()=>{playing=false;syncPlay();time=Number(el('time').value);for(const p of particles)for(let i=0;i<N;i++)respawn(p,i);drawParticles(0);};
 syncPlay();requestAnimationFrame(tick);
 try{const res=await fetch('/hidden-rivers/data/manifest.json');if(!res.ok)throw Error(res.status);manifest=await res.json();await load('agulhas');}catch(e){status.textContent='The data manifest could not be loaded. Please use the video or try again.';console.error(e);}
}
