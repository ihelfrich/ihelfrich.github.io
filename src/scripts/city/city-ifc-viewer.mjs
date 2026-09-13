import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// Local model coordinates only. IFC placement is not evidence of parcel location.
export function createIfcViewer(container,{onSelect=()=>{},onError=()=>{}}={}){
 const doc=container.ownerDocument,win=doc.defaultView;
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0x161d25);renderer.domElement.className='ifc-canvas';renderer.domElement.setAttribute('aria-label','Local IFC model. Drag to orbit, scroll to zoom, or use the adjacent model controls.');
 container.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.01,10000),controls=new OrbitControls(camera,renderer.domElement),group=new THREE.Group();scene.add(group);
 controls.enableDamping=false;controls.screenSpacePanning=true;
 scene.add(new THREE.HemisphereLight(0xe6f3ff,0x665e50,3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(8,14,5);scene.add(sun);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),categoryById=new Map();let meshes=[],geometries=[],active=false,disposed=false,frame=0,down=null;
 function draw(){frame=0;if(!active||disposed||doc.hidden)return;try{renderer.render(scene,camera);}catch(error){onError(error);}}
 function requestDraw(){if(active&&!disposed&&!doc.hidden&&!frame)frame=win.requestAnimationFrame(draw);}
 function resize(){if(disposed)return;const width=container.clientWidth,height=container.clientHeight;if(width<1||height<1)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestDraw();}
 const observer=new win.ResizeObserver(resize);observer.observe(container);controls.addEventListener('change',requestDraw);
 function fit(){const box=new THREE.Box3();for(const mesh of meshes)if(mesh.visible)box.expandByObject(mesh);if(box.isEmpty())return;const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const radius=Math.max(size.length()/2,.05),distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2)*1.2;camera.position.copy(center).add(new THREE.Vector3(1,.7,1).normalize().multiplyScalar(distance));camera.near=Math.max(.001,distance/10000);camera.far=Math.max(100,distance*20);camera.updateProjectionMatrix();controls.target.copy(center);controls.minDistance=radius*.05;controls.maxDistance=distance*10;controls.update();requestDraw();
 }
 function clear(){for(const mesh of meshes){mesh.material.dispose();group.remove(mesh);}for(const geometry of geometries)geometry.dispose();meshes=[];geometries=[];categoryById.clear();requestDraw();}
 function load(model){clear();for(const element of model.elements)categoryById.set(element.id,element.type);
  geometries=model.geometries.map(source=>{const geometry=new THREE.BufferGeometry(),interleaved=new THREE.InterleavedBuffer(source.vertices,6);geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(interleaved,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(interleaved,3,3));geometry.setIndex(new THREE.BufferAttribute(source.indices,1));geometry.computeBoundingSphere();return geometry;});
  const palette=[0xb6d8ce,0xeee4cf,0xd19d71,0x92b8cf,0xc6abc4],categories=[...new Set(model.elements.map(e=>e.type))].sort();
  for(const part of model.parts){const rgba=part.color,plain=rgba.slice(0,3).every(n=>n>.94),color=plain?new THREE.Color(palette[categories.indexOf(categoryById.get(part.id))%palette.length]):new THREE.Color().setRGB(rgba[0],rgba[1],rgba[2]);const material=new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,side:THREE.DoubleSide,transparent:rgba[3]<1,opacity:Math.max(.08,rgba[3])});
   const mesh=new THREE.Mesh(geometries[part.geometryIndex],material);mesh.applyMatrix4(new THREE.Matrix4().fromArray(part.matrix));mesh.userData.elementId=part.id;group.add(mesh);meshes.push(mesh);
  }resize();fit();
 }
 function visibility(types){for(const mesh of meshes)mesh.visible=types.has(categoryById.get(mesh.userData.elementId));requestDraw();}
 function select(id){for(const mesh of meshes){const selected=mesh.userData.elementId===id;mesh.material.emissive.set(selected?0x267788:0x000000);mesh.material.emissiveIntensity=selected?.45:0;}requestDraw();}
 function pointerDown(event){down={x:event.clientX,y:event.clientY};}
 function pointerUp(event){if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(meshes.filter(m=>m.visible),false)[0];if(hit)onSelect(hit.object.userData.elementId);}
 function setActive(value){active=Boolean(value);controls.enabled=active;if(!active&&frame){win.cancelAnimationFrame(frame);frame=0;}if(active)resize();}
 function visibilityChanged(){if(doc.hidden&&frame){win.cancelAnimationFrame(frame);frame=0;}else requestDraw();}
 function contextLost(event){event.preventDefault();setActive(false);onError(Error('The browser released this 3D canvas. Reopen the model to restore it; element records remain readable.'));}
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('webglcontextlost',contextLost);doc.addEventListener('visibilitychange',visibilityChanged);
 return{load,clear,fit,visibility,select,setActive,
  rotate(angle){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),angle);camera.position.copy(controls.target).add(offset);controls.update();requestDraw();},
  zoom(factor){const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor);if(offset.length()>=controls.minDistance&&offset.length()<=controls.maxDistance){camera.position.copy(controls.target).add(offset);controls.update();requestDraw();}},
  destroy(){if(disposed)return;setActive(false);clear();disposed=true;observer.disconnect();controls.removeEventListener('change',requestDraw);controls.dispose();doc.removeEventListener('visibilitychange',visibilityChanged);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 };
}
