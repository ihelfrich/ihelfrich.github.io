import { streamline, seeded, sampleAt, indexPixel } from './atlas-math.mjs';
import { connectWaterWorldTerrain } from './cesium-coast.js';
import { createRasterProvider } from './raster-provider.mjs';

export async function mountWaterWorld(container,{onPick,onStatus=()=>{}}={}) {
  window.CESIUM_BASE_URL='/vendor/cesium/';
  if(!document.querySelector('link[data-water-world]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/cesium/Widgets/widgets.css';link.dataset.waterWorld='true';document.head.append(link);}
  const C=await import('cesium');
  const viewer=new C.Viewer(container,{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,scene3DOnly:true,shadows:false,contextOptions:{webgl:{preserveDrawingBuffer:true}}});
  viewer.resolutionScale=Math.min(1.6,devicePixelRatio||1);viewer.scene.verticalExaggeration=1;
  viewer.scene.backgroundColor=C.Color.fromCssColorString('#040e1b');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#092b3b');
  viewer.scene.globe.enableLighting=false;viewer.scene.globe.depthTestAgainstTerrain=false;
  viewer.scene.globe.maximumScreenSpaceError=1.5;viewer.scene.postProcessStages.fxaa.enabled=true;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance=80;viewer.scene.screenSpaceCameraController.maximumZoomDistance=35000000;
  const base=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',tilingScheme:new C.WebMercatorTilingScheme(),maximumLevel:19,credit:'Imagery © Esri, Maxar, Earthstar Geographics'}));
  base.brightness=.92;base.saturation=.9;
  void connectWaterWorldTerrain(C,viewer,onStatus);
  const lines=viewer.scene.primitives.add(new C.PolylineCollection()),heads=viewer.scene.primitives.add(new C.PointPrimitiveCollection());
  let overlays=[],paths=[],epoch=0,phase=0,last=0,visible=true,current,orbit=false;
  const images=new Map();
  // The saved rasters are EPSG:3857, so their provider must use that projection.
  // A geographic SingleTileImageryProvider would silently displace their rows.
  function provider(image,b,mercator=true,credit='Copernicus Sentinel-2 L2A'){
    return createRasterProvider(C,image,b,mercator,credit);
  }
  function load(src){if(!images.has(src))images.set(src,new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=()=>{images.delete(src);reject(Error('Globe imagery could not load'));};im.src=src;}));return images.get(src);}
  function scalar(field,color){
    const canvas=document.createElement('canvas');canvas.width=Math.min(720,field.shape[2]*4);canvas.height=Math.min(400,field.shape[1]*4);const ctx=canvas.getContext('2d'),data=ctx.createImageData(canvas.width,canvas.height);
    const west=field.lon0,east=west+(field.shape[2]-1)*field.dlon,south=field.lat0,north=south+(field.shape[1]-1)*field.dlat;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const v=sampleAt(field,west+(x+.5)/canvas.width*(east-west),north-(y+.5)/canvas.height*(north-south));const edge=Math.min(x,y,canvas.width-1-x,canvas.height-1-y),fade=Math.min(1,edge/Math.max(8,Math.min(canvas.width,canvas.height)*.04));if(v)data.data.set([...color(Math.hypot(...v)),Math.round(105*fade)],4*(y*canvas.width+x));}
    ctx.putImageData(data,0,0);return {canvas,b:[west,south,east,north]};
  }
  function position(p,depth){return C.Cartesian3.fromDegrees(p[0],p[1],-depth);}
  function buildPaths(o){
    paths=[];lines.removeAll();heads.removeAll();phase=0;
    if(o.field){
      const f=o.field,b=o.place.bounds,rng=seeded(928+o.frame),west=Math.max(b[0],f.lon0),south=Math.max(b[1],f.lat0),east=Math.min(b[2],f.lon0+(f.shape[2]-1)*f.dlon),north=Math.min(b[3],f.lat0+(f.shape[1]-1)*f.dlat),global=o.place.id==='global';
      for(let i=0;i<1400&&paths.length<(global?420:300);i++){
        const lon=west+rng()*(east-west),lat=south+rng()*(north-south),raw=streamline(f,lon,lat,110,1800);if(raw.length<8)continue;
        const pts=raw.map(p=>position(p,o.depth)),rgb=o.color(raw[Math.floor(raw.length/2)][2]),col=new C.Color(...rgb.map(v=>v/255),.23);
        lines.add({positions:pts,width:1.1,material:C.Material.fromType('Color',{color:col})});
        const head=heads.add({position:pts[0],pixelSize:3.4,color:new C.Color(...rgb.map(v=>Math.min(1,v/255+.22)),.96),outlineWidth:0,disableDepthTestDistance:Number.POSITIVE_INFINITY});
        paths.push({pts,head,offset:rng()*pts.length});
      }
    }else if(o.rivers&&o.waterCandidates){
      for(const reach of o.rivers.features){
        if(!reach.properties.directed)continue;const raw=reach.geometry.coordinates,pts=[];
        for(let i=1;i<raw.length;i++){const a=raw[i-1],b=raw[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.002));for(let j=0;j<steps;j++){const t=j/steps;pts.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}
        const wet=pts.filter(p=>{const at=indexPixel(o.place.bounds,o.place.frames[o.frame].indexShape,...p);return at&&o.waterCandidates[at[1]*o.place.frames[o.frame].indexShape[1]+at[0]]===1;});
        if(wet.length<3)continue;
        const positions=pts.map(p=>C.Cartesian3.fromDegrees(...p,4));
        lines.add({positions,width:.75,material:C.Material.fromType('Color',{color:C.Color.fromCssColorString('#92ead4').withAlpha(.12)})});
        const head=heads.add({position:C.Cartesian3.fromDegrees(...wet[0],4),pixelSize:3,color:C.Color.fromCssColorString('#edf3bd'),disableDepthTestDistance:Number.POSITIVE_INFINITY});
        paths.push({pts:wet.map(p=>C.Cartesian3.fromDegrees(...p,4)),head,offset:reach.properties.id%wet.length,river:true});
      }
    }
  }
  async function update(o){
    const stamp=++epoch;current=null;lines.show=heads.show=false;
    const desired=await Promise.all(o.images.map(async (entry,i)=>({provider:provider(await load(entry.src),entry.bbox||o.place.bounds),split:o.compare&&i===1})));
    if(o.field&&o.layer==='currents'){const s=scalar(o.field,o.color);desired.push({provider:provider(s.canvas,s.b,false,o.place.source==='hycom'?'HYCOM depth-resolved model analysis':'NOAA Global Drifter Program climatology')});}
    if(stamp!==epoch)return;
    current=o;base.brightness=o.layer==='pca'?.44:.92;base.saturation=o.layer==='pca'?.32:.9;
    overlays.forEach(l=>viewer.imageryLayers.remove(l));overlays=desired.map(d=>{const l=viewer.imageryLayers.addImageryProvider(d.provider);l.splitDirection=d.split?C.SplitDirection.RIGHT:C.SplitDirection.NONE;return l;});
    viewer.scene.splitPosition=o.swipe??.5;buildPaths(o);lines.show=heads.show=o.flow;viewer.scene.requestRender();
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
  function tick(t){const dt=Math.min(.1,(t-last)/1000||0);last=t;
    if(visible&&!document.hidden&&current){
      lines.show=heads.show=current.flow;
      if(current.playing){phase+=dt;const camera=C.Ellipsoid.WGS84.transformPositionToScaledSpace(viewer.camera.positionWC);for(const p of paths){const at=(phase*(p.river?3:12)+p.offset)%p.pts.length,i=Math.floor(at),f=at-i;p.head.position=C.Cartesian3.lerp(p.pts[i],p.pts[(i+1)%p.pts.length],f,new C.Cartesian3());const point=C.Cartesian3.normalize(C.Ellipsoid.WGS84.transformPositionToScaledSpace(p.head.position),new C.Cartesian3());p.head.show=C.Cartesian3.dot(camera,point)>1;}if(orbit&&viewer.camera.positionCartographic.height>800000)viewer.camera.rotate(C.Cartesian3.UNIT_Z,dt*.018);viewer.scene.requestRender();}
    }
    if(!viewer.isDestroyed())requestAnimationFrame(tick);
  }requestAnimationFrame(tick);
  return {viewer,update,fit,setVisible(v){visible=v;viewer.useDefaultRenderLoop=v;if(v){viewer.resize();viewer.scene.requestRender();}},setPlaying(v){if(current)current.playing=v;},setFlow(v){if(current)current.flow=v;},setSwipe(v){viewer.scene.splitPosition=v;viewer.scene.requestRender();},setOrbit(v){orbit=v;},zoom(factor){viewer.camera.zoomIn(viewer.camera.positionCartographic.height*factor);viewer.scene.requestRender();},getCamera(){const p=viewer.camera.positionCartographic;return{lon:C.Math.toDegrees(p.longitude),lat:C.Math.toDegrees(p.latitude),height:p.height,heading:viewer.camera.heading,pitch:viewer.camera.pitch};},setCamera(p){viewer.camera.cancelFlight();viewer.camera.setView({destination:C.Cartesian3.fromDegrees(p.lon,p.lat,p.height),orientation:{heading:p.heading,pitch:p.pitch,roll:0}});viewer.scene.requestRender();},save(){viewer.render();return viewer.scene.canvas.toDataURL('image/png');},getDiagnostics(){return {paths:paths.length,depth:current?.depth,verticalScale:viewer.scene.verticalExaggeration,projection:'EPSG:3857 imagery; geographic velocity',overlays:overlays.length};},dispose(){observer.disconnect();input.destroy();viewer.destroy();}};
}
