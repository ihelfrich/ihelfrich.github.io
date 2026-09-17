import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import * as regionMath from "../../src/lib/city-region.mjs";
import * as sceneModule from "../../src/scripts/city/city-scene.mjs";
import { createRegionScene } from "../../src/scripts/city/city-region-scene.mjs";
import { selectRegionTiles, regionLevel, regionRequestPlan } from "../../src/lib/city-region.mjs";
const tiles = [
  { id: "west", bounds: [-20, -10, 0, 10] },
  { id: "east", bounds: [0, -10, 20, 10] },
  { id: "far", bounds: [200, 200, 220, 220] },
];
test("visible tile selection includes geometry overlapping a grid boundary", () => {
  assert.deepEqual(
    selectRegionTiles(tiles, [-2, -2, 2, 2], 4).map((t) => t.id),
    ["east", "west"],
  );
});
test("budget favors nearby visible tiles and is stable across source order", () => {
  assert.deepEqual(
    selectRegionTiles(tiles, [0, -2, 10, 2], 1).map((t) => t.id),
    ["east"],
  );
  assert.deepEqual(
    selectRegionTiles([...tiles].reverse(), [-2, -2, 2, 2], 1).map((t) => t.id),
    ["east"],
  );
});
test("a nonintersecting viewport never loads a distant tile", () => {
  assert.deepEqual(selectRegionTiles(tiles, [30, 30, 40, 40]), []);
});
test("overview omits buildings while closer zooms request geometry", () => {
  assert.equal(regionLevel(0.02), "overview");
  assert.equal(regionLevel(0.15), "district");
  assert.equal(regionLevel(2), "detail");
});
test('a viewport exceeding the geometry budget uses a complete overview, not partial buildings',()=>{const plan=regionRequestPlan(tiles,[-30,-30,230,230],.2,2);assert.equal(plan.level,'overview');assert.deepEqual(plan.tiles,[]);assert.equal(plan.visibleTileCount,3);});

test("a geometry budget exactly covering the viewport loads every candidate", () => {
  const plan = regionRequestPlan(tiles, [-30, -30, 230, 230], .2, 3);
  assert.equal(plan.level, "district");
  assert.equal(plan.tiles.length, 3);
  assert.equal(plan.visibleTileCount, 3);
  assert.equal(regionRequestPlan(tiles, [-30, -30, 230, 230], .02, 3).tiles.length, 0);
});

test("overview direction gives a near-vertical north-up view, and detail restores an oblique view", () => {
  assert.equal(typeof regionMath.regionViewDirection, "function");
  const overview = regionMath.regionViewDirection(.014);
  assert.equal(overview[0], 0);
  assert.ok(overview[1] > .99999);
  assert.ok(overview[2] > 0 && overview[2] < .005);
  assert.ok(Math.abs(Math.hypot(...overview) - 1) < 1e-12);
  const camera = new T.OrthographicCamera(-840,840,525,-525,2,350000);
  camera.zoom = .014;
  const target = new T.Vector3(-20000,20,-2000);
  camera.position.copy(target).addScaledVector(new T.Vector3(...overview),2800/camera.zoom);
  camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
    const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(x,y),camera);
    return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());
  });
  assert.ok(corners.every(Boolean));
  const groundHeight = Math.max(...corners.map(p=>p.z))-Math.min(...corners.map(p=>p.z));
  assert.ok(Math.abs(groundHeight-1050/.014)<1);
  const detail = regionMath.regionViewDirection(1.8, overview);
  assert.ok(detail[1] > .3 && detail[1] < .6);
});

async function fixtureRegion(t, buildings) {
  const manifest = { tiles: [{id:"fixture",url:"/fixture",bounds:[-2000,-2000,2000,2000]}], boundary:[] };
  t.mock.method(globalThis, "fetch", async url => ({ok:true, json:async () => url.includes("manifest") ? manifest : url === "/fixture" ? {buildings} : {}}));
  const oldRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { callback(0); return 1; };
  t.after(() => { if (oldRaf) globalThis.requestAnimationFrame = oldRaf; else delete globalThis.requestAnimationFrame; });
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-100,100,100,-100,1,20000);
  camera.position.set(150,200,150); camera.lookAt(10,0,10); camera.updateProjectionMatrix();
  const material = new T.MeshBasicMaterial();
  let invalidations = 0;
  const region = await createRegionScene({scene,camera,controls:{target:new T.Vector3(10,0,10)},materials:{wallMaterials:Array(6).fill(material),roof:material,asphalt:material,path:material},data:{buildings:[]},waterMaterial:material,onSceneChange:()=>invalidations++});
  t.after(() => { region.dispose(); material.dispose(); });
  const initialInvalidations = invalidations;
  region.update(1000);
  await new Promise(resolve => setImmediate(resolve));
  return {region,camera,initialInvalidations,invalidations:()=>invalidations};
}
const building = {id:"fixture-building", height:30,minHeight:0,polygon:[[0,0],[20,0],[20,20],[0,20]],holes:[]};

test("merged regional roof and walls pick their source object with visibility and height transforms", async t => {
  const second = {...building,id:"fixture-second",minHeight:10,polygon:[[40,0],[60,0],[60,20],[40,20]]};
  const {region} = await fixtureRegion(t, [building,second]);
  assert.equal(typeof region.raycast, "function");
  const roofRay = new T.Raycaster(new T.Vector3(60,100,60),new T.Vector3(-50,-70,-50).normalize());
  assert.equal(region.raycast(roofRay)?.building.id, building.id);
  assert.equal(region.raycast(new T.Raycaster(new T.Vector3(50,100,10),new T.Vector3(0,-1,0)))?.building.id, second.id);
  assert.equal(region.raycast(new T.Raycaster(new T.Vector3(80,20,10),new T.Vector3(-1,0,0)))?.building.id, second.id);
  assert.equal(region.raycast(new T.Raycaster(new T.Vector3(80,5,10),new T.Vector3(-1,0,0)))?.building.id, building.id);
  region.toggle("buildings",false);
  assert.equal(region.raycast(roofRay), null);
  region.toggle("buildings",true);
  region.setNetwork(true);
  assert.equal(region.raycast(roofRay), null);
});

test("tile add/remove and visibility changes invalidate cached shadows", async t => {
  const {region,camera,initialInvalidations,invalidations} = await fixtureRegion(t, [building]);
  assert.ok(invalidations() > initialInvalidations);
  const loaded = invalidations();
  region.toggle("buildings",false);
  assert.ok(invalidations() > loaded);
  const hidden = invalidations();
  camera.zoom = .02; camera.updateProjectionMatrix(); region.update(2000);
  assert.ok(invalidations() > hidden);
});

test("listing markers use normalized coordinates, select the correct instance and clear old listings", () => {
  assert.equal(typeof sceneModule.createListingLayer,"function");
  const scene = new T.Scene(), origin = [-90.193,38.628];
  const layer = sceneModule.createListingLayer(scene,origin);
  const a={id:"a",latitude:origin[1],longitude:origin[0]}, b={id:"b",latitude:origin[1]+.001,longitude:origin[0]+.001};
  let selected = null;
  layer.setListings([a,b,{id:"bad",latitude:null,longitude:null}], listing => {selected = listing;});
  assert.equal(scene.getObjectByName("listing-markers").children[0].count,2);
  const ray = new T.Raycaster(new T.Vector3(111.195*Math.cos(origin[1]*Math.PI/180),100,-111.195),new T.Vector3(0,-1,0));
  assert.equal(layer.pick(ray),true);
  assert.equal(selected,b);
  selected=null;
  layer.setListings([],listing=>{selected=listing;});
  assert.equal(layer.pick(ray),false);
  assert.equal(selected,null);
  layer.dispose(); assert.equal(scene.children.length,0);
});
