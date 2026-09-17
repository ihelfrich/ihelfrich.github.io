import * as T from "three";
import { regionRequestPlan } from "../../lib/city-region.mjs";
import {
  flatGeometry,
  ribbon,
  mergedMesh,
  buildingGeometry,
  splitBuildingGeometry,
  facadeStyle,
} from "./city-geometry.mjs";

const widths = {
  motorway: 20,
  trunk: 18,
  primary: 15,
  secondary: 13,
  tertiary: 11,
  residential: 8,
  unclassified: 8,
  service: 4,
  living_street: 5,
  pedestrian: 4,
  footway: 2,
  path: 2,
  cycleway: 2,
  track: 2,
  steps: 2,
};
const disposeGeometry = (group) => {
  group.traverse((o) => o.geometry?.dispose());
  group.removeFromParent();
};
export async function createRegionScene({
  scene,
  camera,
  controls,
  materials,
  data,
  waterMaterial,
  onStatus = () => {},
  onManifest = () => {},
  onSceneChange = () => {},
}) {
  const response = await fetch("/st-louis/region/manifest.json");
  if (!response.ok) throw new Error("Regional map unavailable");
  const manifest = await response.json(),
    root = new T.Group(),
    overview = new T.Group();
  scene.add(root);
  root.add(overview);
  const known = new Set(data.buildings.map((b) => b.id.split(":")[0])),
    loaded = new Map(),
    pending = new Map(),
    failed = new Map();
  let desired = new Set(),
    desiredTiles = [],
    destroyed = false,
    buildingsVisible = true,
    greenVisible = true,
    network = false,
    lastUpdate = 0,
    visibleTileCount = 0,
    activeLevel = "detail";
  const parkMat = new T.MeshStandardMaterial({
      color: "#567344",
      roughness: 1,
    }),
    boundaryMat = new T.LineBasicMaterial({
      color: "#d5bf83",
      transparent: true,
      opacity: 0.52,
    });
  function ground(payload, group, coarse = false) {
    const road = [],
      path = [],
      parks = [],
      water = [];
    for (const r of payload.roads || []) {
      if (r.tunnel || r.points?.length < 2) continue;
      const w = widths[r.kind] || 3;
      (w < 5 ? path : road).push(
        ribbon(
          r.points,
          w,
          coarse ? 0.12 : r.bridge ? 7 + (r.layer || 0) * 2 : 0.24,
        ),
      );
    }
    for (const p of payload.parks || [])
      if (p.polygon?.length > 2)
        parks.push(flatGeometry(p.polygon, p.holes, coarse ? -0.6 : -0.1));
    for (const p of payload.water || [])
      if (p.polygon?.length > 2)
        water.push(flatGeometry(p.polygon, p.holes, coarse ? -0.45 : -0.35));
    mergedMesh(road, materials.asphalt, group);
    mergedMesh(path, materials.path, group);
    const green = mergedMesh(parks, parkMat, group);
    if (green) green.userData.isGreen = true;
    mergedMesh(water, waterMaterial, group);
  }
  function buildTile(payload) {
    const group = new T.Group(),
      buildings = new T.Group();
    group.add(buildings);
    buildings.name = "tile-buildings";
    const roofs = [],
      walls = materials.wallMaterials.map(() => []);
    for (const b of payload.buildings || []) {
      if (known.has(b.id.split(":")[0]) || b.polygon?.length < 3) continue;
      const g = buildingGeometry(b);
      const wall = walls[facadeStyle(b)],
        roofStart = roofs.length,
        wallStart = wall.length;
      splitBuildingGeometry(g, roofs, wall);
      for (const part of [...roofs.slice(roofStart), ...wall.slice(wallStart)])
        part.userData.building = b;
      g.dispose();
    }
    function mergeBuildings(geometries, material) {
      let endFace = 0;
      const ranges = geometries.map((g) => ({
        endFace: (endFace +=
          (g.index?.count || g.attributes.position.count) / 3),
        building: g.userData.building,
      }));
      const mesh = mergedMesh(geometries, material, buildings, true);
      if (mesh) mesh.userData.buildingRanges = ranges;
    }
    walls.forEach((g, i) => mergeBuildings(g, materials.wallMaterials[i]));
    mergeBuildings(roofs, materials.roof);
    ground(payload, group);
    return group;
  }
  const coarseResponse = await fetch(
    manifest.overviewUrl || "/st-louis/region/overview.json",
  );
  if (coarseResponse.ok) ground(await coarseResponse.json(), overview, true);
  const linePoints = [];
  for (const ring of manifest.boundary || [])
    for (let i = 1; i < ring.length; i++)
      linePoints.push(
        ring[i - 1][0],
        2,
        ring[i - 1][1],
        ring[i][0],
        2,
        ring[i][1],
      );
  const lineGeo = new T.BufferGeometry();
  lineGeo.setAttribute("position", new T.Float32BufferAttribute(linePoints, 3));
  overview.add(new T.LineSegments(lineGeo, boundaryMat));
  onManifest(manifest);
  onSceneChange();
  function report() {
    onStatus({
      manifest,
      level: activeLevel,
      visibleTileCount,
      loaded: loaded.size,
      pending: pending.size,
      failed: [...desired].filter((id) => failed.has(id)).length,
    });
  }
  function apply(group) {
    const b = group.getObjectByName("tile-buildings");
    if (b) {
      b.visible = buildingsVisible;
      b.scale.y = network ? 0.07 : 1;
    }
    group.traverse((o) => {
      if (o.userData.isGreen) o.visible = greenVisible && !network;
    });
  }
  function pump() {
    if (destroyed) return;
    for (const tile of desiredTiles) {
      if (pending.size >= 3) break;
      if (
        !desired.has(tile.id) ||
        loaded.has(tile.id) ||
        pending.has(tile.id) ||
        (failed.has(tile.id) && Date.now() - failed.get(tile.id) < 30000)
      )
        continue;
      const abort = new AbortController();
      const deadline = setTimeout(() => {
        failed.set(tile.id, Date.now());
        abort.abort();
      }, 15000);
      pending.set(tile.id, abort);
      fetch(tile.url, { signal: abort.signal })
        .then((r) => {
          if (!r.ok) throw new Error("Tile request failed");
          return r.json();
        })
        .then(async (payload) => {
          if (destroyed || !desired.has(tile.id)) return;
          await new Promise((resolve) => requestAnimationFrame(resolve));
          if (destroyed || !desired.has(tile.id)) return;
          const group = buildTile(payload);
          apply(group);
          root.add(group);
          loaded.set(tile.id, { group, payload });
          failed.delete(tile.id);
          onSceneChange();
        })
        .catch((error) => {
          if (error.name !== "AbortError") failed.set(tile.id, Date.now());
        })
        .finally(() => {
          clearTimeout(deadline);
          pending.delete(tile.id);
          report();
          pump();
        });
    }
    report();
  }
  function viewBounds() {
    camera.updateMatrixWorld();
    const p = new T.Plane(new T.Vector3(0, 1, 0), 0),
      ray = new T.Raycaster(),
      pts = [];
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      ray.setFromCamera(new T.Vector2(x, y), camera);
      const v = new T.Vector3();
      if (ray.ray.intersectPlane(p, v)) pts.push(v);
    }
    if (pts.length < 4) {
      const r = 1000 / camera.zoom;
      return [
        controls.target.x - r,
        controls.target.z - r,
        controls.target.x + r,
        controls.target.z + r,
      ];
    }
    return [
      Math.min(...pts.map((p) => p.x)) - 250,
      Math.min(...pts.map((p) => p.z)) - 250,
      Math.max(...pts.map((p) => p.x)) + 250,
      Math.max(...pts.map((p) => p.z)) + 250,
    ];
  }
  function update(now) {
    if (destroyed || now - lastUpdate < 350) return;
    lastUpdate = now;
    const plan = regionRequestPlan(
      manifest.tiles,
      viewBounds(),
      camera.zoom,
      16,
    );
    desiredTiles = plan.tiles;
    activeLevel = plan.level;
    visibleTileCount = plan.visibleTileCount;
    desired = new Set(plan.tiles.map((t) => t.id));
    for (const [id, abort] of pending) if (!desired.has(id)) abort.abort();
    for (const [id, item] of loaded)
      if (!desired.has(id)) {
        disposeGeometry(item.group);
        loaded.delete(id);
        onSceneChange();
      }
    pump();
  }
  return {
    manifest,
    root,
    update,
    setNetwork(v) {
      network = v;
      for (const { group } of loaded.values()) apply(group);
      onSceneChange();
    },
    toggle(name, v) {
      if (name === "buildings") buildingsVisible = v;
      if (name === "green") greenVisible = v;
      for (const { group } of loaded.values()) apply(group);
      overview.traverse((o) => {
        if (o.userData.isGreen) o.visible = greenVisible && !network;
      });
      onSceneChange();
    },
    raycast(raycaster) {
      if (!buildingsVisible || destroyed) return null;
      const meshes = [];
      root.updateMatrixWorld(true);
      for (const { group } of loaded.values())
        group.getObjectByName("tile-buildings").traverse((o) => {
          if (o.isMesh && o.visible) meshes.push(o);
        });
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return null;
      const ranges = hit.object.userData.buildingRanges;
      // Merged triangles retain their input order; find their source without duplicate meshes.
      let low = 0,
        high = ranges.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (hit.faceIndex < ranges[mid].endFace) high = mid;
        else low = mid + 1;
      }
      return ranges[low] ? { ...hit, building: ranges[low].building } : null;
    },
    buildingAt(x, z, contains) {
      for (const { payload } of loaded.values())
        for (const b of payload.buildings || [])
          if (
            contains([x, z], b.polygon) &&
            !(b.holes || []).some((r) => contains([x, z], r))
          )
            return b;
      return null;
    },
    dispose() {
      destroyed = true;
      for (const abort of pending.values()) abort.abort();
      disposeGeometry(root);
      parkMat.dispose();
      boundaryMat.dispose();
    },
  };
}
