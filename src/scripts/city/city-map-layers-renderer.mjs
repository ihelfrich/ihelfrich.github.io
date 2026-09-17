import * as T from 'three';

export const MAP_LAYER_LIMITS = Object.freeze({ layers:32, features:2000, coordinates:15000 });
const TYPES = Object.freeze(['Point','LineString','MultiLineString','Polygon','MultiPolygon']);
const METRES_PER_DEGREE = 111195;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const identity = value => typeof value === 'string' && value.trim() ? value : finite(value) ? String(value) : null;
const counts = () => ({ inputCount:0, shown:0, coordinates:0, invalid:0, unsupported:0, duplicates:0, omitted:0, hidden:0, ignoredElevations:0 });
const emptyStatus = engine => ({ status:'cleared', engine, ...counts(), layers:[], supportedGeometryTypes:[...TYPES],
  limits:{...MAP_LAYER_LIMITS}, geometryMode:'planimetric-points-and-outlines', heightBasis:engine==='cesium'?'WGS84 ellipsoid display surface; source heights ignored':'Local map display plane; source heights ignored' });
const copy = value => structuredClone(value);

/** Strict, bounded GeoJSON projection. Never close a source ring, drop a hole,
 * use source altitude as underground depth, or promote coordinates to identity.
 * Antimeridian-crossing paths require an upstream geographic splitter. */
function geometryParts(geometry) {
  if (!TYPES.includes(geometry?.type)) return { error:'unsupported' };
  let count=0, ignoredElevations=0, error=null;
  const coordinate = value => {
    if (++count>MAP_LAYER_LIMITS.coordinates) { error='omitted'; return null; }
    if (!Array.isArray(value) || value.length<2 || value.length>3 || !value.every(finite) || Math.abs(value[0])>180 || Math.abs(value[1])>90) { error='invalid';return null; }
    if (value.length===3) ignoredElevations++;
    return value.slice(0,2);
  };
  const path = (values, ring=false) => {
    if (!Array.isArray(values) || values.length<(ring?4:2)) {error='invalid';return null;}
    if (values.length+count>MAP_LAYER_LIMITS.coordinates) {error='omitted';return null;}
    const result=[];let distinct=new Set();
    for (const value of values) {
      const p=coordinate(value);if(!p)return null;
      if(result.length && Math.abs(p[0]-result.at(-1)[0])>180){error='invalid';return null;}
      result.push(p);distinct.add(`${p[0]},${p[1]}`);
    }
    if(distinct.size<(ring?3:2) || (ring && (result[0][0]!==result.at(-1)[0] || result[0][1]!==result.at(-1)[1]))){error='invalid';return null;}
    return result;
  };
  const paths=[];
  const append = (values,ring=false) => {const result=path(values,ring);if(result)paths.push(result);return !!result;};
  let point=null;
  const coordinates=geometry.coordinates;
  if(geometry.type==='Point') point=coordinate(coordinates);
  else if(geometry.type==='LineString') append(coordinates);
  else if(geometry.type==='MultiLineString' || geometry.type==='Polygon') {
    if(!Array.isArray(coordinates)||!coordinates.length)error='invalid';
    else for(const values of coordinates) {if(!append(values,geometry.type==='Polygon'))break;}
  } else {
    if(!Array.isArray(coordinates)||!coordinates.length)error='invalid';
    else for(const polygon of coordinates) {
      if(!Array.isArray(polygon)||!polygon.length){error='invalid';break;}
      for(const values of polygon){if(!append(values,true))break;}
      if(error)break;
    }
  }
  return error?{error}:{point,paths,coordinates:count,ignoredElevations};
}

/** This prepares geometry, not source data or a canonical layer registry. The
 * caller owns viewport loading, enabled layers, source status, and the legend.
 * Features omitted by a budget remain in the caller's source result. */
export function prepareMapLayers(input={}) {
  const status=emptyStatus(null), layers=[], seenLayers=new Set();let inspected=0;
  const candidates=Array.isArray(input?.layers)?input.layers:[];
  for(let layerIndex=0;layerIndex<candidates.length;layerIndex++) {
    const layer=candidates[layerIndex], id=identity(layer?.id), facts={id,...counts()};
    const features=Array.isArray(layer?.features)?layer.features:[];
    facts.inputCount=features.length;
    const color=/^#[0-9a-f]{6}$/i.test(layer?.color)?layer.color:'#77cbd3';
    const opacity=finite(layer?.opacity)?Math.max(0,Math.min(1,layer.opacity)):1;
    Object.assign(facts,{color,opacity});
    if(!id || !Array.isArray(layer?.features)) facts.invalid=features.length||1;
    else if(seenLayers.has(id))facts.duplicates=features.length||1;
    else if(layerIndex>=MAP_LAYER_LIMITS.layers)facts.omitted=features.length;
    else if(opacity===0 || layer.visible===false)facts.hidden=features.length;
    else {
      seenLayers.add(id);const items=[],seen=new Set();
      for(let i=0;i<features.length;i++) {
        if(inspected>=MAP_LAYER_LIMITS.features){facts.omitted+=features.length-i;break;}
        inspected++;
        const feature=features[i],featureId=identity(feature?.id);
        if(feature?.type!=='Feature'||!featureId){facts.invalid++;continue;}
        if(seen.has(featureId)){facts.duplicates++;continue;}seen.add(featureId);
        const parts=geometryParts(feature.geometry);
        if(parts.error){facts[parts.error]++;continue;}
        if(status.coordinates+facts.coordinates+parts.coordinates>MAP_LAYER_LIMITS.coordinates){facts.omitted++;continue;}
        items.push({feature,layerId:id,id:featureId,...parts});facts.shown++;facts.coordinates+=parts.coordinates;facts.ignoredElevations+=parts.ignoredElevations;
      }
      layers.push({id,color,opacity,items});
    }
    status.layers.push(facts);
    for(const key of Object.keys(counts()))status[key]+=facts[key];
  }
  status.status=status.invalid||status.unsupported||status.duplicates||status.omitted?'partial':status.shown?'shown':'cleared';
  return {layers,status,onSelect:typeof input?.onSelect==='function'?input.onSelect:()=>{}};
}

function engineStatus(prepared,engine) {return {...emptyStatus(engine),...prepared.status,engine,heightBasis:emptyStatus(engine).heightBasis};}
const distanceToSegment = (px,py,ax,ay,bx,by) => {
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den)):0;
  return (px-ax-t*dx)**2+(py-ay-t*dy)**2;
};

/** Static geometry, at most two GPU draw calls per layer. Screen-space hit
 * testing runs only on a click and includes outlines, never polygon interiors. */
export function createThreeMapLayers(scene,origin=[-90.193,38.628],{getPixelRatio=()=>1}={}) {
  const group=new T.Group();group.name='persistent-map-layers';scene.add(group);
  const longitudeScale=METRES_PER_DEGREE*Math.cos(origin[1]*Math.PI/180);
  const local = ([lon,lat]) => new T.Vector3((lon-origin[0])*longitudeScale,6,-(lat-origin[1])*METRES_PER_DEGREE);
  let items=[],onSelect=()=>{},status=emptyStatus('three'),disposed=false;
  function release() {
    for(const object of [...group.children]){object.removeFromParent();object.geometry.dispose();object.material.dispose();}
    items=[];onSelect=()=>{};
  }
  function clearMapLayers() {if(disposed)return copy(status);release();status=emptyStatus('three');return copy(status);}
  return {
    setMapLayers(input) {
      if(disposed)return copy(status);
      const prepared=prepareMapLayers(input);release();onSelect=prepared.onSelect;status=engineStatus(prepared,'three');
      for(const layer of prepared.layers) {
        const pointPositions=[],linePositions=[];
        for(const item of layer.items) {
          const point=item.point?local(item.point):null,paths=item.paths.map(path=>path.map(local));
          items.push({...item,point,paths});
          if(point)point.toArray(pointPositions,pointPositions.length);
          for(const path of paths)for(let i=1;i<path.length;i++){
            path[i-1].toArray(linePositions,linePositions.length);path[i].toArray(linePositions,linePositions.length);
          }
        }
        if(linePositions.length) {
          const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(linePositions,3));
          const material=new T.LineBasicMaterial({color:layer.color,opacity:layer.opacity,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fog:false});
          const lines=new T.LineSegments(geometry,material);lines.name=`map-layer:${layer.id}:outlines`;lines.renderOrder=22;lines.frustumCulled=false;group.add(lines);
        }
        if(pointPositions.length) {
          const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pointPositions,3));
          const material=new T.ShaderMaterial({uniforms:{color:{value:new T.Color(layer.color)},opacity:{value:layer.opacity},pixelRatio:{value:1}},
            vertexShader:'uniform float pixelRatio; void main(){gl_PointSize=8.0*pixelRatio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader:'uniform vec3 color;uniform float opacity;void main(){float r=length(gl_PointCoord-vec2(.5));if(r>.5)discard;gl_FragColor=vec4(color,opacity*(1.0-smoothstep(.45,.5,r)));}',
            transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
          const points=new T.Points(geometry,material);points.name=`map-layer:${layer.id}:points`;points.renderOrder=23;points.frustumCulled=false;
          points.onBeforeRender=()=>{material.uniforms.pixelRatio.value=Math.max(1,Number(getPixelRatio())||1);};group.add(points);
        }
      }
      return copy(status);
    },
    clearMapLayers,
    getMapLayersStatus:()=>copy(status),
    pick(pointer,camera,viewport) {
      if(disposed||!group.visible||!items.length||!finite(pointer?.x)||!finite(pointer?.y)||!(viewport?.width>0)||!(viewport?.height>0))return false;
      camera.updateMatrixWorld(true);const a=new T.Vector3(),b=new T.Vector3();
      const px=pointer.x*viewport.width/2,py=pointer.y*viewport.height/2;
      let selected=null,best=36,bestIsPoint=false;
      for(const item of items) {
        if(item.point) {
          a.copy(item.point).project(camera);if(a.z < -1 || a.z > 1)continue;
          const distance=(a.x*viewport.width/2-px)**2+(a.y*viewport.height/2-py)**2;
          if(distance<=best){best=distance;selected=item;bestIsPoint=true;}
        }
        for(const path of item.paths)for(let i=1;i<path.length;i++) {
          a.copy(path[i-1]).project(camera);b.copy(path[i]).project(camera);
          // Both display-plane endpoints must be inside the camera depth range;
          // do not select a behind-camera segment via its projected extension.
          if(a.z < -1 || a.z > 1 || b.z < -1 || b.z > 1)continue;
          const distance=distanceToSegment(px,py,a.x*viewport.width/2,a.y*viewport.height/2,b.x*viewport.width/2,b.y*viewport.height/2);
          if(distance<best || (distance===best&&!bestIsPoint)){best=distance;selected=item;bestIsPoint=false;}
        }
      }
      if(!selected)return false;onSelect(selected.feature,selected.layerId);return true;
    },
    dispose(){if(disposed)return;release();group.removeFromParent();disposed=true;status={...emptyStatus('three'),status:'unavailable',reason:'disposed'};},
  };
}

/** One point collection and one batched outline primitive across enabled
 * layers. No terrain/roof sample or input altitude becomes a utility depth. */
export function createCesiumMapLayers(C,viewer) {
  const points=new C.PointPrimitiveCollection();viewer.scene.primitives.add(points);
  let lines=null,identities=new Map(),onSelect=()=>{},status=emptyStatus('cesium'),disposed=false;
  const requestRender=()=>{if(!disposed&&!viewer.isDestroyed())viewer.scene.requestRender();};
  const remove = object => {if(!object)return;if(!viewer.isDestroyed())viewer.scene.primitives.remove(object);if(!object.isDestroyed())object.destroy();};
  function release(){identities.clear();onSelect=()=>{};if(!points.isDestroyed())points.removeAll();remove(lines);lines=null;}
  function clearMapLayers(){if(disposed)return copy(status);release();status=emptyStatus('cesium');requestRender();return copy(status);}
  return {
    setMapLayers(input) {
      if(disposed)return copy(status);
      const prepared=prepareMapLayers(input);release();onSelect=prepared.onSelect;status=engineStatus(prepared,'cesium');
      const instances=[];
      for(const layer of prepared.layers) {
        const color=C.Color.fromCssColorString(layer.color).withAlpha(layer.opacity);
        for(const item of layer.items) {
          const token={};identities.set(token,{feature:item.feature,layerId:item.layerId});
          if(item.point)points.add({id:token,position:C.Cartesian3.fromDegrees(...item.point,0),pixelSize:8,color,outlineColor:C.Color.BLACK,outlineWidth:.5,disableDepthTestDistance:Infinity});
          for(const path of item.paths)instances.push(new C.GeometryInstance({id:token,
            geometry:new C.PolylineGeometry({positions:path.map(p=>C.Cartesian3.fromDegrees(...p,0)),width:2,arcType:C.ArcType.NONE,vertexFormat:C.PolylineColorAppearance.VERTEX_FORMAT}),
            attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(color)}}));
        }
      }
      if(instances.length) {
        lines=new C.Primitive({geometryInstances:instances,appearance:new C.PolylineColorAppearance({translucent:true,renderState:{depthTest:{enabled:false},depthMask:false}}),asynchronous:false,allowPicking:true});
        viewer.scene.primitives.add(lines);
      }
      requestRender();return copy(status);
    },
    clearMapLayers,
    getMapLayersStatus:()=>copy(status),
    pick(picked) {
      if(disposed)return false;const selected=identities.get(picked?.id)||identities.get(picked?.primitive?.id);
      if(!selected)return false;onSelect(selected.feature,selected.layerId);return true;
    },
    dispose(){if(disposed)return;release();remove(points);disposed=true;status={...emptyStatus('cesium'),status:'unavailable',reason:'disposed'};},
  };
}
