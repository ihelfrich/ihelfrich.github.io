import { streamline, seeded, sampleAt, indexPixel } from './atlas-math.mjs';
import { connectWaterWorldTerrain } from './cesium-coast.js';
import { createRasterProvider, createTiledRasterProvider } from './raster-provider.mjs';
import { velocityRaster } from './velocity-raster.mjs';
import { maskedRiverRuns, flowTiming, FLOW_MATERIAL_SOURCE, CURRENT_SAMPLES_PER_SECOND, CURRENT_TIME_SCALE } from './flow-motion.mjs';

export async function mountWaterWorld(container,{onPick,onStatus=()=>{}}={}) {
  container.classList.add('atlas-world-loading');
  window.CESIUM_BASE_URL='/vendor/cesium/';
  if(!document.querySelector('link[data-water-world]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/cesium/Widgets/widgets.css';link.dataset.waterWorld='true';document.head.append(link);}
  const C=await import('cesium');
  const viewer=new C.Viewer(container,{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,scene3DOnly:true,shadows:false,contextOptions:{webgl:{preserveDrawingBuffer:true}}});
  viewer.resolutionScale=Math.min(1.6,devicePixelRatio||1);viewer.scene.verticalExaggeration=1;
  viewer.scene.backgroundColor=C.Color.fromCssColorString('#040e1b');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#092b3b');
  viewer.scene.globe.enableLighting=false;viewer.scene.globe.depthTestAgainstTerrain=false;
  viewer.scene.globe.maximumScreenSpaceError=1.5;viewer.scene.postProcessStages.fxaa.enabled=true;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance=80;viewer.scene.screenSpaceCameraController.maximumZoomDistance=35000000;
  viewer.scene.screenSpaceCameraController.inertiaSpin=.92;viewer.scene.screenSpaceCameraController.inertiaZoom=.82;viewer.scene.screenSpaceCameraController.zoomFactor=3;
  // Keep a complete local base underneath network imagery. Cesium cannot
  // display regional overlays until its bottom imagery layer is available.
  const context=await C.TileMapServiceImageryProvider.fromUrl('/vendor/cesium/Assets/Textures/NaturalEarthII/',{credit:'Natural Earth II · local geographic context'});
  viewer.imageryLayers.addImageryProvider(context);
  const base=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',tilingScheme:new C.WebMercatorTilingScheme(),maximumLevel:19,credit:'Imagery © Esri, Maxar, Earthstar Geographics'}));
  base.brightness=.92;base.saturation=.9;
  void connectWaterWorldTerrain(C,viewer,onStatus);
  const lines=viewer.scene.primitives.add(new C.PolylineCollection());
  let overlays=[],paths=[],epoch=0,phase=0,last=0,visible=true,current,orbit=false,pathKey='',imageryKey='';
  const images=new Map();
  // The saved rasters are EPSG:3857, so their provider must use that projection.
  // A geographic SingleTileImageryProvider would silently displace their rows.
  function provider(image,b,mercator=true,credit='Copernicus Sentinel-2 L2A'){
    return createRasterProvider(C,image,b,mercator,credit);
  }
  function load(src){if(!images.has(src))images.set(src,new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=()=>{images.delete(src);reject(Error('Globe imagery could not load'));};im.src=src;}));return images.get(src);}
  function scalar(field,color){
    const raster=velocityRaster(field,color),canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(raster.width,raster.height);data.data.set(raster.data);ctx.putImageData(data,0,0);return {canvas,b:raster.bounds};
  }
  function position(p,depth){return C.Cartesian3.fromDegrees(p[0],p[1],-depth);}
  function addTrail(pts,col,offset,river=false){
    const timing=flowTiming(pts.length,phase,river ? .65 : CURRENT_SAMPLES_PER_SECOND);
    const material=new C.Material({fabric:{type:'HiddenRiversTrail',uniforms:{color:col,clock:timing.clock,repeats:timing.repeats,offset},source:FLOW_MATERIAL_SOURCE},translucent:true});
    const line=lines.add({positions:pts,width:river?2.1:2.4,material});
    const normal=C.Cartesian3.normalize(C.Ellipsoid.WGS84.transformPositionToScaledSpace(pts[Math.floor(pts.length/2)]),new C.Cartesian3());
    paths.push({pts,line,material,river,normal});
  }
  function buildPaths(o){
    const key=[o.place.id,o.frame,o.depth,o.field?.sha256||o.field?.dlon,Boolean(o.waterCandidates)].join(':');
    if(key===pathKey)return;pathKey=key;paths=[];lines.removeAll();
    if(o.field){
      const f=o.field,b=o.place.bounds,rng=seeded(928+o.frame),west=Math.max(b[0],f.lon0),south=Math.max(b[1],f.lat0),east=Math.min(b[2],f.lon0+(f.shape[2]-1)*f.dlon),north=Math.min(b[3],f.lat0+(f.shape[1]-1)*f.dlat),global=o.place.id==='global';
      for(let i=0;i<5500&&paths.length<(global?1200:650);i++){
        const lon=west+rng()*(east-west),lat=south+rng()*(north-south),raw=streamline(f,lon,lat,110,1800);if(raw.length<8)continue;
        const pts=raw.map(p=>position(p,o.depth)),rgb=o.color(raw[Math.floor(raw.length/2)][2]),col=new C.Color(...rgb.map(v=>Math.min(1,v/255+.12)),.68);
        addTrail(pts,col,rng());
      }
    }else if(o.rivers&&o.waterCandidates){
      for(const reach of o.rivers.features){
        if(!reach.properties.directed)continue;
        const wet=p=>{const at=indexPixel(o.place.bounds,o.place.frames[o.frame].indexShape,...p);return at&&o.waterCandidates[at[1]*o.place.frames[o.frame].indexShape[1]+at[0]]===1;};
        for(const run of maskedRiverRuns(reach.geometry.coordinates,wet))addTrail(run.map(p=>C.Cartesian3.fromDegrees(...p,4)),C.Color.fromCssColorString('#b9e7d8').withAlpha(.52),(reach.properties.id%997)/997,true);
      }
    }
  }
  async function update(o){
    const stamp=++epoch;
    const key=JSON.stringify([o.place.id,o.layer,o.frame,o.depth,o.field?.sha256||o.field?.dlon,o.compare,o.images.map(e=>e.src)]);
    const desired=key===imageryKey?null:await Promise.all(o.images.map(async (entry,i)=>({provider:entry.tiles?createTiledRasterProvider(C,entry.tiles):provider(await load(entry.src),entry.bbox||o.place.bounds),split:o.compare&&i===1})));
    if(desired&&o.field&&o.layer==='currents'){const s=scalar(o.field,o.color);desired.push({provider:provider(s.canvas,s.b,false,o.place.source==='hycom'?'HYCOM depth-resolved model analysis':'NOAA Global Drifter Program climatology')});}
    if(stamp!==epoch)return;
    current=o;base.brightness=o.layer==='pca'?.44:.92;base.saturation=o.layer==='pca'?.32:.9;
    if(desired){
      const previous=overlays;imageryKey=key;
      overlays=desired.map(d=>{const l=viewer.imageryLayers.addImageryProvider(d.provider);l.splitDirection=d.split?C.SplitDirection.RIGHT:C.SplitDirection.NONE;return l;});
      // Retain the old scene beneath incoming tiles until visible tiles load.
      const incoming=overlays;
      let unsubscribe;
      unsubscribe=viewer.scene.globe.tileLoadProgressEvent.addEventListener(count=>{if(count===0){unsubscribe?.();previous.forEach(l=>{if(viewer.imageryLayers.contains(l)&&!overlays.includes(l))viewer.imageryLayers.remove(l);});}});
      // Overlapping transitions must not leak abandoned imagery layers.
      for(const l of Array.from({length:viewer.imageryLayers.length},(_,i)=>viewer.imageryLayers.get(i)))if(l!==base&&l.imageryProvider!==context&&!incoming.includes(l)&&!previous.includes(l))viewer.imageryLayers.remove(l);
      setTimeout(()=>{unsubscribe?.();previous.forEach(l=>{if(viewer.imageryLayers.contains(l)&&!overlays.includes(l))viewer.imageryLayers.remove(l);});},8000);
    }
    viewer.scene.splitPosition=o.swipe??.5;buildPaths(o);lines.show=o.flow;viewer.scene.requestRender();
  }
  function fit(place,{global=false,tilt=true,immediate=false}={}){
    viewer.camera.cancelFlight();
    if(global||place.id==='global'){viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(-32,12,19000000),orientation:{heading:0,pitch:-C.Math.PI_OVER_TWO,roll:0},duration:immediate?0:1.8});}
    else{const b=place.bounds,lon=(b[0]+b[2])/2,lat=(b[1]+b[3])/2,span=Math.max((b[2]-b[0])*Math.cos(C.Math.toRadians(lat)),b[3]-b[1])*111320,range=Math.max(1500,span*1.55);
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon,lat),span*.05),{offset:new C.HeadingPitchRange(C.Math.toRadians(4),C.Math.toRadians(tilt?-62:-90),range),duration:immediate?0:1.8});}
    viewer.scene.requestRender();
  }
  const input=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
  input.setInputAction(e=>{const ray=viewer.camera.getPickRay(e.position),hit=ray&&viewer.scene.globe.pick(ray,viewer.scene)||viewer.camera.pickEllipsoid(e.position);if(hit){const p=C.Cartographic.fromCartesian(hit);onPick?.({lat:C.Math.toDegrees(p.latitude),lng:C.Math.toDegrees(p.longitude)});}},C.ScreenSpaceEventType.LEFT_CLICK);
  const observer=new ResizeObserver(()=>viewer.resize());observer.observe(container);
  function whenReady(){return new Promise(resolve=>{
    let frames=0,stop;const finish=()=>{stop?.();clearTimeout(timer);container.classList.remove('atlas-world-loading');resolve();};
    const timer=setTimeout(finish,8000);
    stop=viewer.scene.postRender.addEventListener(()=>{if(++frames>3&&viewer.scene.globe.tilesLoaded)finish();else viewer.scene.requestRender();});viewer.scene.requestRender();
  });}
  function tick(t){const dt=Math.min(.1,(t-last)/1000||0);last=t;
    if(visible&&!document.hidden&&current){
      lines.show=current.flow;
      if(current.playing)phase+=dt;
      const camera=C.Ellipsoid.WGS84.transformPositionToScaledSpace(viewer.camera.positionWC);
      for(const p of paths){p.line.show=C.Cartesian3.dot(camera,p.normal)>1;p.material.uniforms.clock=flowTiming(p.pts.length,phase,p.river ? .65 : CURRENT_SAMPLES_PER_SECOND).clock;}
      const orbiting=current.playing&&orbit&&viewer.camera.positionCartographic.height>800000;
      if(orbiting)viewer.camera.rotate(C.Cartesian3.UNIT_Z,dt*.018);
      if(current.playing&&current.flow||orbiting)viewer.scene.requestRender();
    }
    if(!viewer.isDestroyed())requestAnimationFrame(tick);
  }requestAnimationFrame(tick);
  return {viewer,update,fit,whenReady,setVisible(v){visible=v;viewer.useDefaultRenderLoop=v;if(v){viewer.resize();viewer.scene.requestRender();}},setPlaying(v){if(current)current.playing=v;viewer.scene.requestRender();},setFlow(v){if(current)current.flow=v;lines.show=v;viewer.scene.requestRender();},setSwipe(v){viewer.scene.splitPosition=v;viewer.scene.requestRender();},setOrbit(v){orbit=v;},zoom(factor){viewer.camera.zoomIn(viewer.camera.positionCartographic.height*factor);viewer.scene.requestRender();},getCamera(){const p=viewer.camera.positionCartographic;return{lon:C.Math.toDegrees(p.longitude),lat:C.Math.toDegrees(p.latitude),height:p.height,heading:viewer.camera.heading,pitch:viewer.camera.pitch};},setCamera(p){viewer.camera.cancelFlight();viewer.camera.setView({destination:C.Cartesian3.fromDegrees(p.lon,p.lat,p.height),orientation:{heading:p.heading,pitch:p.pitch,roll:0}});viewer.scene.requestRender();},save(){viewer.render();return viewer.scene.canvas.toDataURL('image/png');},getDiagnostics(){return {paths:paths.length,depth:current?.depth,verticalScale:viewer.scene.verticalExaggeration,projection:'EPSG:3857 imagery; geographic velocity',overlays:overlays.length,tiled:current?.images.some(e=>e.tiles),animation:'continuous fading trails',timeScale:CURRENT_TIME_SCALE,phase};},dispose(){observer.disconnect();input.destroy();viewer.destroy();}};
}
