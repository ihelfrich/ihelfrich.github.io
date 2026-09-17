import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import * as C from 'cesium';
import { prepareMapLayers, createThreeMapLayers, createCesiumMapLayers, MAP_LAYER_LIMITS } from '../../src/scripts/city/city-map-layers-renderer.mjs';

const point = (id, coordinates = [0, 0]) => ({ type:'Feature', id, properties:{sourceId:'official', sourceObjectId:17, parcelKey:null}, geometry:{type:'Point',coordinates} });
const line = (id, coordinates = [[-.001,0],[.001,0]]) => ({ type:'Feature',id,properties:{sourceUrl:'https://example.gov/source'},geometry:{type:'LineString',coordinates} });
const input = (features, extra = {}) => ({layers:[{id:'source-a',color:'#77cbd3',opacity:.7,features,...extra}]});
function camera() { const c = new T.OrthographicCamera(-500,500,500,-500,1,10000); c.position.set(0,1000,0);c.up.set(0,0,-1);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c; }

test('all supported source geometries retain exact source features; polygon holes stay separate', () => {
  const ring=[[0,0],[.01,0],[.01,.01],[0,0]], hole=[[.001,.001],[.002,.001],[.002,.002],[.001,.001]];
  const features=[point(0,[0,0,-12]),line('line'),{...line('multi-line'),geometry:{type:'MultiLineString',coordinates:[ring,hole]}},
    {...line('polygon'),geometry:{type:'Polygon',coordinates:[ring,hole]}},{...line('multi-polygon'),geometry:{type:'MultiPolygon',coordinates:[[ring,hole],[ring]]}}];
  const before=structuredClone(features), result=prepareMapLayers(input(features));
  assert.equal(result.status.shown,5);assert.equal(result.status.ignoredElevations,1);
  assert.equal(result.layers[0].items[0].feature,features[0]);
  assert.equal(result.layers[0].items[3].paths.length,2);assert.equal(result.layers[0].items[4].paths.length,3);
  assert.deepEqual(features,before);assert.deepEqual(result.layers[0].items[0].point,[0,0]);
});

test('invalid, unclosed, unsupported, and duplicate geometry is reported rather than partially fabricated', () => {
  const features=[point('ok'),point('ok'),point('bad',['0',0]),line('open',[[0,0]]),
    {...line('ring'),geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]}},
    {...point('collection'),geometry:{type:'GeometryCollection',geometries:[]}},line('wrap',[[179,0],[-179,0]])];
  const result=prepareMapLayers(input(features));
  assert.equal(result.status.shown,1);assert.equal(result.status.duplicates,1);assert.equal(result.status.invalid,4);assert.equal(result.status.unsupported,1);
  assert.equal(result.status.status,'partial');
  const cross=prepareMapLayers({layers:[...input([point('same')]).layers,{id:'source-b',features:[point('same')]}]});
  assert.equal(cross.status.shown,2,'source IDs may repeat across layers without cross-layer aliasing');
});

test('global feature/coordinate limits omit whole features and retain actionable per-layer counts', () => {
  const features=Array.from({length:MAP_LAYER_LIMITS.features+2},(_,i)=>point(String(i)));
  const many=prepareMapLayers(input(features));
  assert.equal(many.status.shown,2000);assert.equal(many.status.omitted,2);assert.equal(many.status.layers[0].omitted,2);
  const huge=line('huge',Array.from({length:MAP_LAYER_LIMITS.coordinates+1},(_,i)=>[i*.000001,0]));
  const bounded=prepareMapLayers(input([huge,point('small')]));
  assert.equal(bounded.status.shown,1);assert.equal(bounded.status.omitted,1);assert.equal(bounded.status.coordinates,1);
  assert.equal(bounded.layers[0].items[0].feature.id,'small');
  assert.equal(prepareMapLayers(input([point('hidden')],{opacity:0})).status.shown,0);
});

test('Three batches simultaneous points and lines, and edge clicks return original evidence and layer', () => {
  const scene=new T.Scene(), map=createThreeMapLayers(scene,[0,0]), selected=[];
  const a=point('p',[.001,.001]),b=line('road');
  const result=map.setMapLayers({layers:[{id:'a',color:'#77cbd3',opacity:.4,features:[a]},{id:'b',color:'#e39759',features:[b]}],onSelect:(...args)=>selected.push(args)});
  assert.equal(result.engine,'three');assert.equal(result.shown,2);assert.equal(scene.children.length,1);
  const root=scene.children[0], points=root.children.find(x=>x.isPoints),segments=root.children.find(x=>x.isLineSegments);
  assert.ok(points&&segments);assert.equal(segments.geometry.attributes.position.count,2);assert.equal(segments.material.depthTest,false);assert.equal(segments.material.fog,false,'countywide fog cannot hide a enabled source outline');
  assert.equal(map.pick({x:0,y:0},camera(),{width:1000,height:1000}),true);assert.deepEqual(selected[0],[b,'b']);
  assert.equal(map.pick({x:.8,y:.8},camera(),{width:1000,height:1000}),false);
});

test('polygon interiors do not steal parcel clicks, and replacement/clear/dispose release geometry and stale selections', () => {
  const scene=new T.Scene(),map=createThreeMapLayers(scene,[0,0]),ring=[[-.001,-.001],[.001,-.001],[.001,.001],[-.001,.001],[-.001,-.001]];
  map.setMapLayers(input([{...line('outline'),geometry:{type:'Polygon',coordinates:[ring]}}]));
  assert.equal(map.pick({x:0,y:0},camera(),{width:1000,height:1000}),false);
  const old=scene.children[0].children[0];let released=0;
  old.geometry.addEventListener('dispose',()=>released++);old.material.addEventListener('dispose',()=>released++);
  map.setMapLayers(input([point('new')]));assert.equal(released,2);
  map.clearMapLayers();assert.equal(map.pick({x:0,y:0},camera(),{width:1000,height:1000}),false);
  map.dispose();map.dispose();assert.equal(scene.children.length,0);assert.equal(map.getMapLayersStatus().status,'unavailable');
  assert.equal(map.setMapLayers(input([point('late')])).status,'unavailable');
});

test('Cesium uses bounded primitives, projected zero-height geometry, exact opaque picks, and cleans replacements', () => {
  const primitives=new C.PrimitiveCollection();let renders=0;
  const viewer={isDestroyed:()=>false,scene:{primitives,requestRender(){renders++;}}};
  const map=createCesiumMapLayers(C,viewer),selected=[],p=point('p',[0,0,-150]),l=line('l');
  const status=map.setMapLayers({...input([p,l]),onSelect:(...args)=>selected.push(args)});
  assert.equal(status.engine,'cesium');assert.equal(status.shown,2);assert.equal(primitives.length,2);
  const points=primitives.get(0),lines=primitives.get(1),token=points.get(0).id;
  assert.ok(Math.abs(C.Cartographic.fromCartesian(points.get(0).position).height)<.001);
  assert.equal(points.get(0).disableDepthTestDistance,Infinity);assert.equal(lines.appearance.renderState.depthTest.enabled,false);
  assert.equal(map.pick({id:token}),true);assert.deepEqual(selected[0],[p,'source-a']);
  const instance=lines.geometryInstances[0];assert.equal(map.pick({id:instance.id}),true);assert.deepEqual(selected[1],[l,'source-a']);
  map.setMapLayers(input([point('next')]));assert.equal(map.pick({id:token}),false);assert.equal(lines.isDestroyed(),true);
  map.clearMapLayers();assert.equal(primitives.length,1);assert.equal(points.length,0);
  map.dispose();map.dispose();assert.equal(primitives.length,0);assert.ok(renders>=3);
});

test('renderer status is copied, so callers cannot alter resource accounting', () => {
  const map=createThreeMapLayers(new T.Scene(),[0,0]);map.setMapLayers(input([point('x')]));
  const status=map.getMapLayersStatus();status.layers[0].shown=987;status.supportedGeometryTypes.length=0;
  assert.equal(map.getMapLayersStatus().layers[0].shown,1);assert.equal(map.getMapLayersStatus().supportedGeometryTypes.length,5);map.dispose();
});

test('budgets span layers, oversized polygons are not reduced to one ring, and duplicate layer IDs are not merged', () => {
  const coordinates=Array.from({length:14999},(_,i)=>[i*.000001,0]);
  const result=prepareMapLayers({layers:[{id:'a',features:[line('long',coordinates)]},{id:'b',features:[line('over'),point('fits'),point('no-space')]}]});
  assert.equal(result.status.coordinates,15000);assert.deepEqual(result.layers.flatMap(layer=>layer.items.map(item=>item.id)),['long','fits']);
  assert.equal(result.status.layers[1].omitted,2);
  const duplicate=prepareMapLayers({layers:[...input([point('one')]).layers,...input([point('two')]).layers]});
  assert.equal(duplicate.status.shown,1);assert.equal(duplicate.status.duplicates,1);
  const ring=[[0,0],[.001,0],[.001,.001],[0,0]],holes=Array.from({length:3750},()=>ring);
  const polygon=prepareMapLayers(input([{...point('large'),geometry:{type:'Polygon',coordinates:[ring,...holes]}}]));
  assert.equal(polygon.status.shown,0);assert.equal(polygon.status.omitted,1);assert.equal(polygon.status.coordinates,0);
});

test('Three points stay pickable above overlapping line strokes; same-source IDs in separate layers stay distinct', () => {
  const scene=new T.Scene(),map=createThreeMapLayers(scene,[0,0]),selected=[],p=point('same'),l=line('same');
  map.setMapLayers({layers:[{id:'point',features:[p]},{id:'line',features:[l]}],onSelect:(...args)=>selected.push(args)});
  map.pick({x:0,y:0},camera(),{width:1000,height:1000});assert.deepEqual(selected.at(-1),[p,'point']);
  map.setMapLayers({layers:[{id:'point',opacity:0,features:[p]},{id:'line',features:[l]}],onSelect:(...args)=>selected.push(args)});
  map.pick({x:0,y:0},camera(),{width:1000,height:1000});assert.deepEqual(selected.at(-1),[l,'line']);map.dispose();
});

test('Cesium outline geometry compiles with bounded vertices and shared source IDs for holes', () => {
  const primitives=new C.PrimitiveCollection(),viewer={isDestroyed:()=>false,scene:{primitives,requestRender(){}}},map=createCesiumMapLayers(C,viewer);
  const ring=[[0,0],[.001,0],[.001,.001],[0,0]],hole=[[.0001,.0001],[.0002,.0001],[.0002,.0002],[.0001,.0001]];
  map.setMapLayers(input([{...point('area'),geometry:{type:'Polygon',coordinates:[ring,hole]}}]));
  const instances=primitives.get(1).geometryInstances;assert.equal(instances.length,2);assert.equal(instances[0].id,instances[1].id);
  for(const instance of instances){const geometry=C.PolylineGeometry.createGeometry(instance.geometry);assert.ok(geometry.indices.length>0);assert.ok(geometry.attributes.position.values.length<=100);}
  map.dispose();
});
