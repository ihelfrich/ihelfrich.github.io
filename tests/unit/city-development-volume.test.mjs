import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { EntityCollection, Cartesian3, Cartographic, PolygonHierarchy, Color, JulianDate } from "cesium";
import { developmentVolume } from "../../src/lib/city-development-volume.mjs";
import { createDevelopmentVolumeLayer } from "../../src/scripts/city/city-scene.mjs";
import { createRealityDevelopmentVolume } from "../../src/scripts/city/city-reality.mjs";

const ring = (x, y, size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const parcel = {
  type: "Feature", properties: { recordKey: "synthetic-study-record" },
  geometry: { type: "MultiPolygon", coordinates: [
    [ring(0, 0, 0.002), ring(0.0005, 0.0005, 0.0005)],
    [ring(0.004, 0.004, 0.001)],
  ] },
};
const input = { parcel, stories: 5, floorHeightMetres: 3.2 };

test("height-study validation preserves exact multipart rings and holes without mutating source", () => {
  const before = structuredClone(parcel);
  const study = developmentVolume(input);
  assert.equal(study.status, "ready");
  assert.equal(study.heightMetres, 16);
  assert.equal(study.recordKey, "synthetic-study-record");
  assert.deepEqual(study.polygons, parcel.geometry.coordinates);
  assert.deepEqual(parcel, before);
  study.polygons[0][0][0][0] = 9;
  assert.deepEqual(parcel, before);
  assert.equal(developmentVolume({ ...input, stories: 100, floorHeightMetres: 6 }).heightMetres, 600);
  assert.equal(developmentVolume({ ...input, stories: 1, floorHeightMetres: 2 }).heightMetres, 2);
});

test("height-study inputs reject out-of-range, nonnumeric, invalid and oversized geometry", () => {
  for (const stories of [0,101,2.5,NaN,Infinity,"5",null])
    assert.equal(developmentVolume({ ...input, stories }).reason, "invalid-stories");
  for (const floorHeightMetres of [1.9,6.1,NaN,Infinity,"3",null])
    assert.equal(developmentVolume({ ...input, floorHeightMetres }).reason, "invalid-floor-height");
  const invalid = structuredClone(parcel);
  invalid.properties.geometryStatus = "invalid-source";
  assert.equal(developmentVolume({ ...input, parcel: invalid }).reason, "invalid-source-geometry");
  delete invalid.properties.geometryStatus;
  invalid.geometry.coordinates[0][0].pop();
  assert.equal(developmentVolume({ ...input, parcel: invalid }).reason, "invalid-parcel");
  invalid.geometry = { type: "Polygon", coordinates: [[[0,0],[1,1],[2,2],[0,0]]] };
  assert.equal(developmentVolume({ ...input, parcel: invalid }).reason, "invalid-parcel");
  invalid.geometry = { type: "Polygon", coordinates: [Array(4097).fill([0,0])] };
  assert.equal(developmentVolume({ ...input, parcel: invalid }).reason, "geometry-limit");
  assert.deepEqual(developmentVolume(null), { status: "cleared" });
});

test("Three volume preserves the hole, exact height and bounded resources through replacement and disposal", () => {
  const scene = new T.Scene();
  const layer = createDevelopmentVolumeLayer(scene, [0, 0]);
  const result = layer.setDevelopmentVolume(input);
  assert.equal(result.status, "shown");
  const group = scene.getObjectByName("parcel-height-study");
  assert.equal(group.children.length, 4); // two meshes and two edge geometries
  const mesh = group.children[0];
  mesh.geometry.computeBoundingBox();
  assert.equal(mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y, 16);
  group.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(0.00075 * 111195, 100, -0.00075 * 111195), new T.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(mesh).length, 0, "source hole remains empty through the full height");
  ray.ray.origin.set(0.0002 * 111195, 100, -0.0002 * 111195);
  assert.ok(ray.intersectObject(mesh).length > 0, "the parcel around the hole is present");
  let disposedGeometries = 0, disposedMaterials = 0;
  for (const child of group.children) child.geometry.addEventListener("dispose", () => disposedGeometries++);
  mesh.material.addEventListener("dispose", () => disposedMaterials++);
  group.children[1].material.addEventListener("dispose", () => disposedMaterials++);
  layer.setDevelopmentVolume({ ...input, stories: 100 });
  assert.equal(disposedGeometries, 4);
  assert.equal(group.children.length, 4, "100 stories do not allocate 100 meshes per parcel");
  assert.equal(layer.setDevelopmentVolume({ ...input, stories: 101 }).status, "unavailable");
  assert.equal(group.children.length, 0, "invalid replacement cannot leave a stale study visible");
  layer.setDevelopmentVolume(input);
  layer.dispose(); layer.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(disposedMaterials, 2);
  assert.equal(layer.setDevelopmentVolume(input).reason, "disposed");
});

test("Cesium uses a bounded captured-surface sample, preserves holes and clears failed/replaced studies", () => {
  const C = { Cartesian3, Cartographic, PolygonHierarchy, Color };
  const entities = new EntityCollection();
  const existing = entities.add({ id: "synthetic-nonstudy-overlay" });
  let renders = 0, samples = 0, available = true;
  const viewer = {
    entities, isDestroyed: () => false,
    scene: {
      sampleHeightSupported: true,
      sampleHeight(position, excluded) {
        samples++;
        assert.ok(excluded.includes(existing));
        return available ? 120.5 : undefined;
      },
      requestRender() { renders++; },
    },
  };
  const layer = createRealityDevelopmentVolume(C, viewer);
  const result = layer.setDevelopmentVolume(input);
  assert.equal(result.status, "shown");
  assert.equal(result.baseHeightMetres, 120.5);
  assert.match(result.reference, /may be a roof, not surveyed ground/);
  assert.equal(samples, 1);
  assert.equal(entities.values.length, 3);
  const polygon = entities.values[1].polygon;
  const now = JulianDate.now();
  assert.equal(polygon.height.getValue(now) - polygon.extrudedHeight.getValue(now), 16);
  assert.equal(polygon.hierarchy.getValue(now).holes.length, 1);
  assert.equal(polygon.hierarchy.getValue(now).holes[0].positions.length, 4);
  layer.setDevelopmentVolume({ ...input, stories: 100 });
  assert.equal(entities.values.length, 3);
  available = false;
  const beforeSamples = samples;
  assert.equal(layer.setDevelopmentVolume(input).reason, "surface-unavailable");
  assert.equal(samples - beforeSamples, 4);
  assert.equal(entities.values.length, 1);
  available = true;
  layer.setDevelopmentVolume(input);
  assert.deepEqual(layer.setDevelopmentVolume(null), { status: "cleared" });
  assert.equal(entities.values.length, 1);
  layer.setDevelopmentVolume(input);
  layer.dispose(); layer.dispose();
  assert.equal(entities.values.length, 1);
  const beforeRenders = renders;
  assert.equal(layer.setDevelopmentVolume(input).reason, "disposed");
  assert.equal(renders, beforeRenders);
});
