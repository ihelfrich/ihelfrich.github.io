import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { PointPrimitiveCollection, PrimitiveCollection, Cartesian2, Cartesian3, Cartographic, Color, BlendOption, Ellipsoid, Rectangle, Math as CesiumMath } from "cesium";
import { preparePropertyAtlas, PROPERTY_ATLAS_LIMIT, PROPERTY_ATLAS_COLORS, PROPERTY_ATLAS_UNKNOWN_COLOR, propertyAtlasColor, propertyAtlasAvailableViewport } from "../../src/lib/city-property-atlas.mjs";
import { createThreePropertyAtlas, createCesiumPropertyAtlas, threeViewportBounds, cesiumViewportBounds, threeAtlasFit, threeAtlasLocalPosition, cesiumAtlasFit } from "../../src/scripts/city/city-property-atlas.mjs";

const feature = (id, longitude = 0, latitude = 0, value = 100) => ({ id, recordKey: `source:${id}:17`, parcelKey: `parcel:${id}`, longitude, latitude, value });
const C = { PointPrimitiveCollection, Cartesian2, Cartesian3, Cartographic, Color, BlendOption, Ellipsoid, Math: CesiumMath };
function topCamera() {
  const camera = new T.OrthographicCamera(-500, 500, 500, -500, 1, 10000);
  camera.position.set(0, 1000, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  return camera;
}

test("missing/invalid values are distinct from zero, explicit domains/colors remain common to both engines", () => {
  const originals = [feature("zero", 0, 0, 0), feature("missing", 1, 1, null), feature("invalid", 2, 2, "100"),
    { ...feature("colored"), color: "#ff00a1" }];
  const before = structuredClone(originals);
  const prepared = preparePropertyAtlas({ features: originals, domain: [0, 200] });
  assert.equal(prepared.status.status, "shown");
  assert.deepEqual(prepared.status.domain, [0, 200]);
  assert.equal(prepared.items[0].value, 0);
  assert.notEqual(prepared.items[0].color, PROPERTY_ATLAS_UNKNOWN_COLOR);
  assert.equal(prepared.items[1].color, PROPERTY_ATLAS_UNKNOWN_COLOR);
  assert.equal(prepared.items[2].color, PROPERTY_ATLAS_UNKNOWN_COLOR);
  assert.equal(prepared.items[3].color, "#ff00a1");
  assert.equal(prepared.items[0].feature, originals[0], "callbacks retain the exact original source object");
  assert.deepEqual(originals, before);
  assert.equal(propertyAtlasColor(100, [100, 100]), propertyAtlasColor(50, [0, 100]));
  assert.deepEqual(preparePropertyAtlas({ features: originals, domain: [200, 0] }).status.domain, [0, 100]);
  assert.deepEqual([0, 1, 2, 3].map(value => propertyAtlasColor(value, [0, 3])), PROPERTY_ATLAS_COLORS,
    "the four legend stops match the renderer exactly");
});

test("record IDs never derive from coordinates and invalid, duplicate, or over-limit input is reported", () => {
  const retained = feature("retained");
  const prepared = preparePropertyAtlas({ features: [retained, { ...retained },
    { longitude: 0, latitude: 0 }, feature("bad", "0", 0), feature("outside", 181, 0),
    feature("bad-lat", 1, Infinity), { ...feature("fallback"), id: undefined }] });
  assert.deepEqual(prepared.items.map(item => item.id), ["retained", "source:fallback:17"]);
  assert.equal(prepared.status.invalid, 4); assert.equal(prepared.status.duplicates, 1);
  assert.equal(prepared.status.status, "partial");
  const capped = preparePropertyAtlas({ features: Array.from({ length: PROPERTY_ATLAS_LIMIT + 15 }, (_, i) => feature(String(i))) });
  assert.equal(capped.items.length, PROPERTY_ATLAS_LIMIT); assert.equal(capped.status.truncated, 15);
  assert.equal(capped.status.status, "partial");
});

test("Three reuses one bounded GPU buffer through 10,000 records and replacements; clear/dispose remove stale picks", () => {
  const scene = new T.Scene(), layer = createThreePropertyAtlas(scene, [0, 0], { getPixelRatio: () => 2 });
  const camera = topCamera(), viewport = { width: 1000, height: 1000 }, selected = [];
  const records = Array.from({ length: PROPERTY_ATLAS_LIMIT }, (_, i) => feature(String(i), i * 0.0001));
  assert.equal(layer.setPropertyAtlas({ features: records, onSelect: value => selected.push(value) }).shown, 10000);
  assert.equal(scene.children.length, 1);
  const points = scene.children[0], geometry = points.geometry, material = points.material;
  assert.ok(points.isPoints); assert.equal(geometry.drawRange.count, 10000);
  assert.equal(geometry.attributes.position.count, PROPERTY_ATLAS_LIMIT);
  assert.equal(geometry.attributes.position.array.byteLength + geometry.attributes.color.array.byteLength + geometry.attributes.pointSize.array.byteLength, 280000);
  points.onBeforeRender(); assert.equal(material.uniforms.pixelRatio.value, 2);
  assert.equal(layer.pick({ x: 0, y: 0 }, camera, viewport), true);
  assert.equal(selected[0], records[0]);
  const replacement = feature("replacement");
  layer.setPropertyAtlas({ features: [replacement], onSelect: value => selected.push(value) });
  assert.equal(points.geometry, geometry); assert.equal(points.material, material); assert.equal(geometry.drawRange.count, 1);
  assert.equal(layer.pick({ x: 0, y: 0 }, camera, viewport), true);
  assert.equal(selected.at(-1), replacement);
  layer.clearPropertyAtlas(); assert.equal(geometry.drawRange.count, 0);
  assert.equal(layer.pick({ x: 0, y: 0 }, camera, viewport), false);
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener("dispose", () => geometryDisposals++); material.addEventListener("dispose", () => materialDisposals++);
  layer.dispose(); layer.dispose();
  assert.equal(scene.children.length, 0); assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
  assert.equal(layer.setPropertyAtlas({ features: records }).reason, "disposed");
  assert.equal(layer.pick({ x: 0, y: 0 }, camera, viewport), false);
});

test("Three click radii follow CSS pixels at different zooms, preserve aggregate semantics, and miss offscreen points", () => {
  const scene = new T.Scene(), layer = createThreePropertyAtlas(scene, [0, 0]);
  const cell = { ...feature("cell", 0.001), kind: "cell", count: 43, bounds: [0, 0, 0.002, 0.002], pixelSize: 20 };
  const chosen = [], camera = topCamera(), viewport = { width: 1000, height: 1000 };
  layer.setPropertyAtlas({ features: [cell], onSelect: value => chosen.push(value) });
  for (const zoom of [0.2, 3]) {
    camera.zoom = zoom; camera.updateProjectionMatrix();
    const center = new T.Vector3(111.195, 4, 0).project(camera);
    assert.equal(layer.pick({ x: center.x + 16 / viewport.width, y: center.y }, camera, viewport), true);
    assert.equal(chosen.at(-1), cell); assert.equal(chosen.at(-1).kind, "cell");
    assert.equal(layer.pick({ x: center.x + 32 / viewport.width, y: center.y }, camera, viewport), false);
  }
  camera.position.y = -1000; camera.lookAt(0, -2000, 0); camera.updateMatrixWorld(true);
  assert.equal(layer.pick({ x: 0, y: 0 }, camera, viewport), false, "behind-camera records are not selectable");
  layer.dispose();
});

test("local viewport bounds derive from the actual camera/origin, shrink on zoom, and fail for a sky view", () => {
  const camera = topCamera(), origin = [-90.25, 38.7];
  const initial = threeViewportBounds(camera, origin);
  assert.ok(initial[0] < origin[0] && initial[2] > origin[0]);
  assert.ok(initial[1] < origin[1] && initial[3] > origin[1]);
  assert.ok(Math.abs(initial[2] - initial[0] - 1000 / (111195 * Math.cos(origin[1] * Math.PI / 180))) < 1e-10);
  camera.zoom = 2; camera.updateProjectionMatrix();
  const closer = threeViewportBounds(camera, origin);
  assert.ok(Math.abs((closer[2] - closer[0]) / (initial[2] - initial[0]) - 0.5) < 1e-10);
  camera.position.x += 300; camera.lookAt(300, 0, 0); camera.updateMatrixWorld(true);
  const moved = threeViewportBounds(camera, origin); assert.ok(moved[0] > closer[0]);
  camera.lookAt(camera.position.x, 2000, 0); camera.updateMatrixWorld(true);
  assert.equal(threeViewportBounds(camera, origin), null);
});

test("Cesium uses one PointPrimitiveCollection, exact opaque pick identities, and releases replacement/disposal state", () => {
  const primitives = new PrimitiveCollection(), selected = []; let renders = 0;
  const viewer = { isDestroyed: () => false, scene: { primitives, requestRender() { renders++; } } };
  const layer = createCesiumPropertyAtlas(C, viewer), row = { ...feature("exact", -90.3, 38.7, 0), heightMetres: 321 };
  const status = layer.setPropertyAtlas({ features: [row], onSelect: value => selected.push(value) });
  assert.equal(status.shown, 1); assert.equal(primitives.length, 1);
  const collection = primitives.get(0), point = collection.get(0), token = point.id;
  assert.ok(collection instanceof PointPrimitiveCollection);
  assert.equal(collection.length, 1); assert.equal(point.pixelSize, 7);
  assert.equal(point.disableDepthTestDistance, Infinity);
  const position = Cartographic.fromCartesian(point.position);
  assert.ok(Math.abs(CesiumMath.toDegrees(position.longitude) - row.longitude) < 1e-10);
  assert.ok(Math.abs(position.height - 321) < 1e-7);
  assert.equal(layer.pick({ id: row.id }), false, "a coincident provider ID cannot select an atlas record");
  assert.equal(layer.pick({ id: token }), true); assert.equal(selected[0], row);
  layer.setPropertyAtlas({ features: [feature("next")], onSelect: value => selected.push(value) });
  assert.equal(primitives.get(0), collection); assert.equal(collection.length, 1);
  assert.equal(layer.pick({ id: token }), false, "picks from a replaced buffer are discarded");
  assert.equal(layer.pick({ primitive: collection.get(0) }), true); assert.equal(selected.at(-1).id, "next");
  layer.clearPropertyAtlas(); assert.equal(collection.length, 0); assert.equal(layer.pick({ id: token }), false);
  layer.dispose(); layer.dispose(); assert.equal(primitives.length, 0); assert.equal(collection.isDestroyed(), true);
  const before = renders;
  assert.equal(layer.setPropertyAtlas({ features: [row] }).reason, "disposed"); assert.equal(renders, before);
  primitives.destroy();
});

test("Cesium bounds use its camera and WGS84 without requiring a rendered globe", () => {
  const viewer = { isDestroyed: () => false, camera: { computeViewRectangle(ellipsoid) {
    assert.equal(ellipsoid, Ellipsoid.WGS84); return Rectangle.fromDegrees(-90.7, 38.4, -90.1, 38.9);
  } } };
  const bounds = cesiumViewportBounds(C, viewer);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(bounds[i] - [-90.7, 38.4, -90.1, 38.9][i]) < 1e-10);
  viewer.camera.computeViewRectangle = () => undefined; assert.equal(cesiumViewportBounds(C, viewer), null);
  viewer.isDestroyed = () => true; assert.equal(cesiumViewportBounds(C, viewer), null);
});

test("native Three fit contains all County corners on portrait and landscape views, including below the old min zoom", () => {
  const bounds = [-90.742, 38.389, -90.122, 38.892], origin = [-90.193, 38.628];
  for (const aspect of [390 / 844, 1440 / 900]) {
    const camera = new T.OrthographicCamera(-1050 * aspect / 2, 1050 * aspect / 2, 525, -525, 2, 2000000);
    const fit = threeAtlasFit(camera, bounds, origin);
    assert.ok(fit.zoom > 0);
    if (aspect < 1) assert.ok(fit.zoom < 0.013, "a portrait County fit needs the renderer's newly supported zoom range");
    camera.zoom = fit.zoom; camera.position.set(fit.x, 3000 / fit.zoom, fit.z + 3 / fit.zoom);
    camera.lookAt(fit.x, 0, fit.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    for (const [longitude, latitude] of [[bounds[0], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[1]], [bounds[2], bounds[3]]]) {
      const local = threeAtlasLocalPosition(longitude, latitude, origin);
      const projected = new T.Vector3(local.x, 0, local.z).project(camera);
      assert.ok(Math.abs(projected.x) <= 0.841 && Math.abs(projected.y) <= 0.841, "every geographic corner remains within the padded camera view");
    }
  }
  assert.equal(threeAtlasFit(topCamera(), [2, 1, 1, 2]), null);
  assert.equal(threeAtlasLocalPosition(null, 0), null);
});

test("native Cesium fit passes a padded Rectangle and a north-up camera orientation instead of synthetic zoom", () => {
  let flight, renders = 0;
  const viewer = { isDestroyed: () => false, camera: { flyTo(value) { flight = value; } }, scene: { requestRender() { renders++; } } };
  const complete = () => {};
  assert.equal(cesiumAtlasFit({ ...C, Rectangle }, viewer, [-90.7, 38.4, -90.1, 38.9], { duration: 0, complete }), true);
  assert.ok(CesiumMath.toDegrees(flight.destination.west) < -90.7);
  assert.ok(CesiumMath.toDegrees(flight.destination.north) > 38.9);
  assert.deepEqual(flight.orientation, { heading: 0, pitch: -Math.PI / 2, roll: 0 });
  assert.equal(flight.complete, complete); assert.equal(flight.duration, 0); assert.equal(renders, 1);
  assert.equal(cesiumAtlasFit({ ...C, Rectangle }, viewer, [0, 0, NaN, 1]), false);
  assert.equal(renders, 1);
});

test("fits put every County corner in the free map area beside the desktop inspector or above a mobile sheet", () => {
  const bounds = [-90.742, 38.389, -90.122, 38.892], origin = [-90.193, 38.628];
  const layouts = [
    { width: 1440, height: 900, blockers: [{ left: 88, top: 146, width: 360, height: 700 }, { left: 0, top: 0, width: 72, height: 900 }] },
    { width: 390, height: 844, blockers: [{ left: 14, top: 417, width: 362, height: 321 }, { left: 14, top: 72, width: 362, height: 42 }] },
  ];
  for (const layout of layouts) {
    const viewport = propertyAtlasAvailableViewport({ ...layout, left: 0, top: 0 }, layout.blockers);
    if (layout.width === 1440) assert.equal(viewport.left, 460);
    else { assert.equal(viewport.top, 126); assert.equal(viewport.top + viewport.height, 405); }
    const aspect = layout.width / layout.height;
    const camera = new T.OrthographicCamera(-1050 * aspect / 2, 1050 * aspect / 2, 525, -525, 2, 5000000);
    const fit = threeAtlasFit(camera, bounds, origin, viewport);
    camera.zoom = fit.zoom; camera.position.set(fit.x, 3000 / fit.zoom, fit.z + 3 / fit.zoom);
    camera.lookAt(fit.x, 0, fit.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    for (const [longitude, latitude] of [[bounds[0], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[1]], [bounds[2], bounds[3]]]) {
      const local = threeAtlasLocalPosition(longitude, latitude, origin);
      const projected = new T.Vector3(local.x, 0, local.z).project(camera);
      const x = (projected.x + 1) * layout.width / 2, y = (1 - projected.y) * layout.height / 2;
      assert.ok(x > viewport.left && x < viewport.left + viewport.width, "County is beside, not behind, the inspector");
      assert.ok(y > viewport.top && y < viewport.top + viewport.height, "County is above the sheet and below top controls");
    }
    const visibleBounds = threeViewportBounds(camera, origin, viewport);
    assert.ok(visibleBounds[0] <= bounds[0] && visibleBounds[1] <= bounds[1] && visibleBounds[2] >= bounds[2] && visibleBounds[3] >= bounds[3]);
    let destination;
    const viewer = { isDestroyed: () => false, camera: { flyTo(value) { destination = value.destination; } }, scene: { requestRender() {} } };
    cesiumAtlasFit({ ...C, Rectangle }, viewer, bounds, { viewport });
    const full = [destination.west, destination.south, destination.east, destination.north].map(CesiumMath.toDegrees);
    for (const [lon, lat] of [[bounds[0], bounds[1]], [bounds[2], bounds[3]]]) {
      const x = (lon - full[0]) / (full[2] - full[0]) * layout.width, y = (full[3] - lat) / (full[3] - full[1]) * layout.height;
      assert.ok(x > viewport.left && x < viewport.left + viewport.width);
      assert.ok(y > viewport.top && y < viewport.top + viewport.height);
    }
  }
});

test("unobscured viewport handles offscreen/collapsed layout and Cesium queries actual cropped corner rays", () => {
  assert.deepEqual(propertyAtlasAvailableViewport({ left: 50, top: 20, width: 1440, height: 900 }, [
    { left: 138, top: 166, width: 360, height: 42 }, { left: 2000, top: 0, width: 800, height: 900 },
  ]), { left: 0, top: 0, width: 1440, height: 900, fullWidth: 1440, fullHeight: 900 });
  const viewport = { left: 400, top: 0, width: 600, height: 800, fullWidth: 1000, fullHeight: 800 };
  const rays = [], viewer = { isDestroyed: () => false, camera: { pickEllipsoid(screen) {
    rays.push([screen.x, screen.y]); return Cartesian3.fromDegrees(-91 + screen.x / 1000, 39 - screen.y / 1000);
  } } };
  const result = cesiumViewportBounds(C, viewer, viewport);
  assert.deepEqual(rays, [[400, 0], [1000, 0], [400, 800], [1000, 800]]);
  assert.ok(Math.abs(result[0] + 90.6) < 1e-9);
  assert.ok(Math.abs(result[1] - 38.2) < 1e-9);
  viewer.camera.pickEllipsoid = () => undefined; assert.equal(cesiumViewportBounds(C, viewer, viewport), null);
});
