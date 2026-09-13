import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMapLayersPanel} from '../../src/scripts/city/city-map-layers-panel.mjs';
import {propertyRecordGeoJSON,mapLayerDetail,propertyFeatureBounds} from '../../src/lib/property-map-layer-catalog.mjs';

const bounds=[-90.22,38.61,-90.20,38.63],settle=()=>new Promise(r=>setTimeout(r,12));
const record=(id='water-materials')=>({id:id+':123',layerId:id,kind:'utility',title:'Source fixture',longitude:-90.21,latitude:38.62,sourceURL:'https://example.org/official',sourceObjectId:123});
const response=ids=>({features:ids.map(record),records:ids.map(record),layers:ids.map(id=>({id,status:'ready',count:1,mappedCount:1})),partial:false});
function fixture(t,{query=async o=>response(o.layers),infrastructureQuery=async o=>response(o.layers)}={}){
  const win=new Window({url:'https://ihelfrich.github.io/st-louis/'}),doc=win.document,root=doc.createElement('section');doc.body.append(root);
  const calls=[],maps=[],opened=[],inspected=[],fits=[];let cleared=0,city;
  const newMap=()=>({getViewportBounds:()=>bounds,setMapLayers:v=>{maps.push(v);return {shown:v.layers.reduce((n,l)=>n+l.features.length,0),layers:[]};},clearMapLayers:()=>{cleared++;},fitPropertyAtlasBounds:b=>fits.push(b)});city=newMap();
  const data=fn=>({query:o=>{calls.push(o);return fn(o);},dispose(){}});
  const panel=createMapLayersPanel(root,{getCity:()=>city,onOpen:()=>opened.push(true),onInspect:p=>inspected.push(p),evidence:data(query),infrastructure:data(infrastructureQuery),pollMs:100000});
  const $=id=>root.querySelector(`[data-map-layers="${id}"]`),toggle=id=>{const node=root.querySelector(`[data-layer-toggle="${id}"]`);node.checked=!node.checked;node.dispatchEvent(new win.Event('change'));};
  t.after(async()=>{panel.dispose();await win.happyDOM.abort();});return {win,doc,root,panel,$,toggle,calls,maps,opened,inspected,fits,get cleared(){return cleared;},switchRenderer(){city=newMap();panel.refreshRenderer();}};
}
test('layers load together and survive renderer replacement independently of property modes',async t=>{
  const f=fixture(t);f.toggle('water-materials');await settle();f.toggle('permits');await settle();
  assert.deepEqual(f.maps.at(-1).layers.map(l=>l.id),['water-materials','permits']);assert.equal(f.calls.at(-1).level,'properties');
  f.switchRenderer();assert.deepEqual(f.maps.at(-1).layers.map(l=>l.id),['water-materials','permits']);
  f.toggle('water-materials');await settle();assert.deepEqual(f.maps.at(-1).layers.map(l=>l.id),['permits']);assert.match(f.$('count').textContent,/1 data layer/);
});
test('clear and disposal reject late source responses instead of putting cleared layers back',async t=>{
  const pending=[],f=fixture(t,{query:()=>new Promise(r=>pending.push(r))});f.toggle('water-materials');f.$('clear').click();pending[0](response(['water-materials']));await settle();
  assert.match(f.$('count').textContent,/No data layers/);assert.equal(f.maps.length,1);assert.equal(f.maps[0].layers[0].features.length,0);
  f.toggle('permits');f.panel.dispose();const before=f.maps.length;pending[1](response(['permits']));await settle();assert.equal(f.maps.length,before);
});
test('a failed independent source leaves successful layers usable and retryable',async t=>{
  let failing=true;const f=fixture(t,{infrastructureQuery:async o=>{if(failing)throw Error('Offline');return response(o.layers);}});
  f.$('infrastructure').click();await settle();assert.ok(f.maps.at(-1).layers.find(l=>l.id==='water-materials').features.length);assert.match(f.$('status').textContent,/unavailable/);
  assert.ok([...f.root.querySelectorAll('.map-layer-state')].some(p=>p.textContent.includes('Unavailable')));
  failing=false;await f.panel.refresh();assert.ok(f.maps.at(-1).layers.find(l=>l.id==='city-streetlights').features.length);
});
test('map inspection retains exact source attributes without promoting infrastructure IDs to parcel IDs',async t=>{
  const f=fixture(t);f.toggle('water-materials');await settle();const rendered=f.maps.at(-1),feature=rendered.layers[0].features[0];rendered.onSelect(feature,'water-materials');
  assert.equal(f.opened.length,1);assert.equal(f.$('detail').hidden,false);assert.match(f.$('detail').textContent,/sourceObjectId/);
  const inspect=[...f.$('detail').querySelectorAll('button')].find(b=>b.textContent==='Inspect nearby parcels');inspect.click();
  assert.deepEqual(Object.keys(f.inspected[0]).sort(),['address','latitude','longitude']);assert.equal(f.inspected[0].sourceObjectId,undefined);
});
test('opacity redraws existing data without issuing a new query',async t=>{
  const f=fixture(t);f.toggle('water-materials');await settle();const n=f.calls.length;
  const input=f.root.querySelector('[aria-label="Water-service materials opacity"]');input.value='.35';input.dispatchEvent(new f.win.Event('input'));
  assert.equal(f.maps.at(-1).layers[0].opacity,.35);assert.equal(f.calls.length,n);
});
test('project inspection exposes named attributes and zooms source bounds without assigning a parcel',async t=>{
  const item={...record('city-capital-projects'),geometryRole:'source-point',bounds:[-90.215,38.615,-90.205,38.625],original:{sourceObjectId:42,sourceLayerId:2,attributes:{Name:'Bridge project',Status:'Active'},parcelKey:null}};
  const f=fixture(t,{infrastructureQuery:async()=>({features:[item],layers:[{id:item.layerId,status:'ready',count:1}]})});
  f.toggle(item.layerId);await settle();const rendered=f.maps.at(-1);rendered.onSelect(rendered.layers[0].features[0],item.layerId);
  assert.match(f.$('detail').textContent,/Location published by the source/);assert.match(f.$('detail').textContent,/Source date: Not supplied/);
  const terms=[...f.$('detail').querySelectorAll('dt')].map(n=>n.textContent);assert.ok(terms.includes('Status'));assert.ok(!terms.includes('attributes'));assert.ok(!terms.includes('parcelKey'));
  [...f.$('detail').querySelectorAll('button')].find(b=>b.textContent==='Zoom to this feature').click();await settle();
  assert.deepEqual(f.fits.at(-1),item.bounds);assert.equal(f.inspected.length,0);assert.equal(f.$('detail').hidden,true);
});
test('source references remain disabled and presets do not pretend they are connected',async t=>{
  const f=fixture(t),ref=f.root.querySelector('[data-layer-toggle="modot-bridges"]');assert.equal(ref.disabled,true);
  f.$('infrastructure').click();await settle();assert.ok(f.calls.every(c=>!c.layers.includes('modot-bridges')));
});
test('source geometry is retained and point locations never fabricate building footprints or utility paths',()=>{
  const input={...record(),geometry:{type:'LineString',coordinates:[[-90.21,38.62],[-90.22,38.63]]}};
  const projected=propertyRecordGeoJSON(input);assert.equal(projected.geometry,input.geometry);assert.equal(projected.properties.record,input);
  assert.equal(propertyRecordGeoJSON(record()).geometry.type,'Point');assert.equal(propertyRecordGeoJSON({id:'unlocated'}),null);
  assert.equal(mapLayerDetail(bounds),'properties');assert.equal(mapLayerDetail([-91,38,-90,39]),'areas');
  const fit=propertyFeatureBounds(input);assert.ok(fit[0]<-90.22&&fit[2]>-90.21&&fit[1]<38.62&&fit[3]>38.63);
  const point=propertyFeatureBounds(record());assert.ok(point[0]<point[2]&&point[1]<point[3]);
});
test('incentive layers recover their official source polygon without changing Activity point semantics',()=>{
  const polygon={type:'Polygon',coordinates:[[[-90.3,38.6],[-90.2,38.6],[-90.2,38.7],[-90.3,38.6]]]};
  const input={...record('tif-districts'),geometry:{type:'Point',coordinates:[-90.21,38.62]},original:{geometry:polygon}};
  const projected=propertyRecordGeoJSON(input);assert.equal(projected.geometry,polygon);assert.equal(input.geometry.type,'Point');assert.equal(projected.properties.record.geometryRole,'source-polygon-outline');
});
test('layer details expose full-cell scope and retrieval dates instead of implying exact viewport counts',async t=>{
  const f=fixture(t,{infrastructureQuery:async o=>({...response(o.layers),layers:o.layers.map(id=>({id,status:'ready',count:540,aggregation:'source-grid-cells',reason:'Counts cover complete source grid cells intersecting this view.',retrievedAt:'2026-09-13T21:00:00Z',sourceCount:52573}))})});
  f.toggle('city-streetlights');await settle();const metadata=f.root.querySelector('.map-layer-row.is-on .map-layer-source-metadata');
  assert.match(metadata.textContent,/complete source grid cells/);assert.match(metadata.textContent,/2026-09-13T21:00:00Z/);assert.match(metadata.textContent,/52573/);
});
