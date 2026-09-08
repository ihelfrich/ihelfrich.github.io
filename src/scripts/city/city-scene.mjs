import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import {
  contains,
  centroid,
  rand,
  hash,
  shapeOf,
  flatGeometry,
  ribbon,
  mergedMesh,
  buildingGeometry,
  splitBuildingGeometry,
  facadeStyle,
} from "./city-geometry.mjs";
import { createCityMaterials } from "./city-materials.mjs";
import { createCityDetail } from "./city-detail.mjs";
import { createRegionScene } from "./city-region-scene.mjs";
import { solarPosition } from "../../lib/city-conditions.mjs";
import { regionViewDirection } from "../../lib/city-region.mjs";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
const clamp = T.MathUtils.clamp;
export { contains } from "./city-geometry.mjs";

// One instanced draw call for imported coordinates; no geocoding or inferred locations.
export function createListingLayer(scene, origin) {
  const group = new T.Group();
  group.name = "listing-markers";
  scene.add(group);
  let mesh = null, items = [], onSelect = () => {}, currentScale = null;
  const material = new T.MeshBasicMaterial({depthTest:false,depthWrite:false});
  const matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3();
  const rotation = new T.Quaternion();
  function update(zoom = 1) {
    if (!mesh) return;
    const size = clamp(1 / zoom, .35, 80);
    if (size === currentScale) return;
    currentScale = size;
    scale.setScalar(size);
    items.forEach((listing, i) => {
      position.set(
        (listing.longitude - origin[0]) * 111195 * Math.cos(origin[1] * Math.PI / 180),
        44,
        -(listing.latitude - origin[1]) * 111195,
      );
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  return {
    setListings(listings, select = () => {}) {
      if (mesh) {mesh.geometry.dispose();mesh.dispose();group.remove(mesh);mesh=null;}
      onSelect = typeof select === "function" ? select : () => {};
      items = (Array.isArray(listings) ? listings : []).filter(listing =>
        Number.isFinite(listing?.latitude) && Math.abs(listing.latitude) <= 90 &&
        Number.isFinite(listing?.longitude) && Math.abs(listing.longitude) <= 180);
      currentScale = null;
      if (!items.length) return;
      mesh = new T.InstancedMesh(new T.SphereGeometry(8,12,8), material, items.length);
      mesh.renderOrder = 20;
      items.forEach((listing,i) => mesh.setColorAt(i, new T.Color(
        ({active:"#e98648",pending:"#eac476",sold:"#91a9ae",withdrawn:"#969693"})[listing.status] || "#e98648")));
      group.add(mesh);
      update();
    },
    update,
    pick(raycaster) {
      if (!mesh) return false;
      group.updateMatrixWorld(true);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (!hit || !items[hit.instanceId]) return false;
      onSelect(items[hit.instanceId]);
      return true;
    },
    dispose() {
      if (mesh) {mesh.geometry.dispose();mesh.dispose();}
      material.dispose();group.clear();group.removeFromParent();mesh=null;items=[];
    },
  };
}

function grainTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    r = rand(391);
  ctx.fillStyle = "#a09e87";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = r() > 0.5 ? "#b0ad95" : "#8e927e";
    ctx.fillRect(r() * 128, r() * 128, 1, 1);
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(6000, 6000);
  return t;
}

export async function createCityScene(
  container,
  data,
  {
    onSelect = () => {},
    onReady = () => {},
    onError = () => {},
    onRegionReady = () => {},
    onRegionStatus = () => {},
  } = {},
) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = T.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    onError(
      "The graphics context was interrupted. The place comparisons remain available.",
    );
  });
  const scene = new T.Scene();
  const listingsLayer = createListingLayer(scene, data.origin || [-90.193,38.628]);
  scene.background = new T.Color("#aebfc1");
  scene.fog = new T.FogExp2("#b8c4bd", 0.000095);
  const aspect = container.clientWidth / container.clientHeight,
    frustum = 1050;
  const camera = new T.OrthographicCamera(
    (-frustum * aspect) / 2,
    (frustum * aspect) / 2,
    frustum / 2,
    -frustum / 2,
    2,
    350000,
  );
  camera.position.set(2100, 1100, 1700);
  camera.zoom = aspect < 0.8 ? 0.62 : 1;
  camera.updateProjectionMatrix();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(
    scene,
    camera,
    container.clientWidth,
    container.clientHeight,
    {},
    { radius: 16, thickness: 4, distanceFallOff: 1, scale: 1.15, samples: 8 },
  );
  ao.blendIntensity = 0.78;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  let ambientOcclusion = true;
  const controls = new OrbitControls(camera, renderer.domElement);
  const cameraDistance = camera.position.length();
  let region = null,
    detail = null;
  controls.target.set(aspect < 0.8 ? 350 : 150, 35, 140);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.07;
  controls.minZoom = 0.013;
  controls.maxZoom = 12;
  controls.maxPolarAngle = Math.PI * 0.43;
  controls.minPolarAngle = 0.18;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.mouseButtons = {
    LEFT: T.MOUSE.ROTATE,
    MIDDLE: T.MOUSE.DOLLY,
    RIGHT: T.MOUSE.PAN,
  };
  controls.update();
  const invalidateShadows = () => { renderer.shadowMap.needsUpdate = true; };
  controls.addEventListener("change", invalidateShadows);
  const sun = new T.DirectionalLight("#ffe4b4", 3.4);
  sun.position.set(-2200, 1700, 600);
  const sunDirection = sun.position.clone().normalize();
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -2600,
    right: 2600,
    top: 2400,
    bottom: -2400,
    near: 1,
    far: 11000,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.25;
  sun.shadow.radius = 2;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new T.HemisphereLight("#dbe7ee", "#777451", 1.3);
  scene.add(hemi);
  const sky = new Sky();
  sky.scale.setScalar(250000);
  scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 3;
  su.rayleigh.value = 1.2;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.8;
  const pmrem = new T.PMREMGenerator(renderer);
  su.sunPosition.value.copy(sun.position).normalize();
  scene.environment = pmrem.fromScene(sky, 0.05, 1, 25000).texture;
  scene.environmentIntensity = 0.14;
  pmrem.dispose();
  const terrain = new T.Mesh(
    new T.PlaneGeometry(180000, 180000),
    new T.MeshStandardMaterial({
      color: "#7a8a65",
      map: grainTexture(),
      roughness: 1,
    }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -1.5;
  terrain.receiveShadow = true;
  scene.add(terrain);
  const buildings = new T.Group(),
    green = new T.Group(),
    roads = new T.Group(),
    traffic = new T.Group(),
    overlays = new T.Group(),
    landmarks = new T.Group();
  scene.add(buildings, green, roads, traffic, overlays, landmarks);
  const materials = await createCityMaterials(renderer);
  const wallMaterials = materials.wallMaterials,
    roofMat = materials.roof,
    wallBuckets = wallMaterials.map(() => []),
    roofs = [],
    pickMeshes = [];
  for (const b of data.buildings) {
    if (!b.polygon?.length || b.polygon.length < 3) continue;
    const center = centroid(b.polygon),
      style = facadeStyle(b);
    const geo = buildingGeometry(b);
    const pick = new T.Mesh(geo);
    pick.userData = b;
    pickMeshes.push(pick);
    splitBuildingGeometry(geo, roofs, wallBuckets[style]);
  }
  for (let i = 0; i < wallBuckets.length; i++)
    mergedMesh(wallBuckets[i], wallMaterials[i], buildings, true);
  mergedMesh(roofs, roofMat, buildings, true);

  const parkMat = new T.MeshStandardMaterial({
    color: "#597344",
    roughness: 1,
  });
  const parkGeos = [];
  for (const p of data.parks || [])
    if (p.polygon?.length > 2)
      parkGeos.push(flatGeometry(p.polygon, p.holes, 0.05));
  mergedMesh(parkGeos, parkMat, green);
  const roadGeo = [],
    sidewalkGeo = [],
    pathGeo = [],
    lineGeo = [];
  const roadWidths = {
    motorway: 23,
    trunk: 20,
    primary: 17,
    secondary: 15,
    tertiary: 13,
    residential: 10,
    unclassified: 10,
    service: 6,
    living_street: 7,
    pedestrian: 7,
    footway: 2.5,
    path: 2,
    cycleway: 2.5,
    steps: 2,
    track: 3,
  };
  for (const r of data.roads || []) {
    if (r.tunnel || !r.points?.length) continue;
    const w = roadWidths[r.kind] || 4,
      y = r.bridge ? 9 + (r.layer || 0) * 2 : 0.25;
    if (
      ["footway", "path", "pedestrian", "cycleway", "steps", "track"].includes(
        r.kind,
      )
    ) {
      pathGeo.push(ribbon(r.points, w, y + 0.12));
      continue;
    }
    sidewalkGeo.push(ribbon(r.points, w + 4, y));
    roadGeo.push(ribbon(r.points, w, y + 0.08));
    if (w >= 10)
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i],
          l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let d = 2; d < l - 4; d += 13) {
          const t = d / l,
            u = Math.min((d + 5) / l, 1);
          lineGeo.push(
            ribbon(
              [
                [
                  T.MathUtils.lerp(a[0], b[0], t),
                  T.MathUtils.lerp(a[1], b[1], t),
                ],
                [
                  T.MathUtils.lerp(a[0], b[0], u),
                  T.MathUtils.lerp(a[1], b[1], u),
                ],
              ],
              0.28,
              y + 0.11,
            ),
          );
        }
      }
  }
  mergedMesh(sidewalkGeo, materials.concrete, roads);
  mergedMesh(roadGeo, materials.asphalt, roads);
  mergedMesh(pathGeo, materials.path, roads);
  mergedMesh(lineGeo, new T.MeshBasicMaterial({ color: "#d3c9a1" }), roads);
  // Procedural foliage decorates mapped green areas. Its position is not a tree inventory.
  const treePositions = (data.trees || []).map((p) => [p[0], p[1], 1]);
  const tr = rand(1928);
  for (const p of data.parks || []) {
    if (!p.polygon?.length) continue;
    const box = new T.Box2().setFromPoints(
        p.polygon.map((p) => new T.Vector2(...p)),
      ),
      size = box.getSize(new T.Vector2()),
      tries = Math.min(1500, Math.floor((size.x * size.y) / 110));
    for (let n = 0; n < tries; n++) {
      const q = [box.min.x + tr() * size.x, box.min.y + tr() * size.y];
      if (
        contains(q, p.polygon) &&
        !(p.holes || []).some((r) => contains(q, r)) &&
        tr() > 0.36
      )
        treePositions.push([q[0], q[1], 0.7 + tr() * 0.8]);
    }
  }
  const uniqueTrees = treePositions.slice(0, 9000);
  const treeGeo = new T.IcosahedronGeometry(4.5, 1),
    trunkGeo = new T.CylinderGeometry(0.4, 0.65, 5, 5),
    leaf = new T.MeshStandardMaterial({ color: "#587445", roughness: 0.95 }),
    trunk = new T.MeshStandardMaterial({ color: "#695a42", roughness: 1 });
  const leaves = new T.InstancedMesh(treeGeo, leaf, uniqueTrees.length * 2),
    trunks = new T.InstancedMesh(trunkGeo, trunk, uniqueTrees.length);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  trunks.castShadow = true;
  green.add(leaves, trunks);
  const dummy = new T.Object3D(),
    color = new T.Color();
  uniqueTrees.forEach(([x, z, scale], i) => {
    dummy.position.set(x, 2.6 * scale, z);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 2; j++) {
      dummy.position.set(
        x + (j ? 1.8 : -1.2) * scale,
        (j ? 8.8 : 7) * scale,
        z + (j ? 1.2 : -0.5) * scale,
      );
      dummy.scale.set(scale * (j ? 0.8 : 1), scale * (j ? 1 : 1.1), scale);
      dummy.rotation.set(tr() * 0.8, tr() * 6, tr() * 0.5);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 2 + j, dummy.matrix);
      color.setHSL(0.21 + tr() * 0.035, 0.22 + tr() * 0.15, 0.22 + tr() * 0.13);
      leaves.setColorAt(i * 2 + j, color);
    }
  });
  // The water shader interprets the river visually; no hydrological claims.
  const waterMat = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      sun: { value: new T.Vector3(-0.7, 0.5, 0.2) },
      warm: { value: 1 },
      lightGain: { value: 1 },
      waveGain: { value: 1 },
      fogDensity: { value: 0.000045 },
      fogColor: { value: new T.Color("#b8c4bd") },
    },
    vertexShader: `varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `precision highp float;varying vec3 vWorld;uniform float time;uniform float warm;uniform float lightGain;uniform float waveGain;uniform float fogDensity;uniform vec3 sun;uniform vec3 fogColor;void main(){vec2 p=vWorld.xz;float s1=sin(p.x*.09+p.y*.055+time*.75),s2=cos(p.y*.15-p.x*.04+time*.4);vec3 n=normalize(vec3((s1+s2*.43)*.06*waveGain,1.,(s2+sin(p.x*.33+time)*.3)*.06*waveGain));vec3 v=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,v),0.),3.);vec3 base=mix(vec3(.19,.25,.25),vec3(.46,.49,.43),fres);float glint=pow(max(dot(reflect(-normalize(sun),n),v),0.),95.);vec3 col=base*lightGain+vec3(1.,.80,.48)*glint*.6*warm;float fog=1.-exp(-length(cameraPosition-vWorld)*fogDensity);gl_FragColor=vec4(mix(col,fogColor,fog),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
  });
  const waterGeos = [];
  for (const w of data.water || [])
    if (w.polygon?.length > 2)
      waterGeos.push(flatGeometry(w.polygon, w.holes, -0.3));
  const waterMesh = mergedMesh(waterGeos, waterMat, scene);
  // Authored Gateway Arch: catenary silhouette, triangular steel cross-section.
  const origin = data.origin || [-90.193, 38.628],
    project = (lon, lat) => [
      (lon - origin[0]) * 111195 * Math.cos((origin[1] * Math.PI) / 180),
      -(lat - origin[1]) * 111195,
    ];
  const court = data.pois.find((p) => p.name === "Old Courthouse");
  if (court) {
    const stone = new T.MeshStandardMaterial({
      color: "#d0c7ac",
      roughness: 0.8,
    });
    const copper = new T.MeshStandardMaterial({
      color: "#718b78",
      metalness: 0.45,
      roughness: 0.53,
    });
    const drum = new T.Mesh(new T.CylinderGeometry(13, 14, 14, 24), stone);
    drum.position.set(court.x, 34, court.z);
    drum.castShadow = true;
    landmarks.add(drum);
    const dome = new T.Mesh(
      new T.SphereGeometry(14, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      copper,
    );
    dome.position.set(court.x, 41, court.z);
    dome.castShadow = true;
    landmarks.add(dome);
    const lantern = new T.Mesh(new T.CylinderGeometry(2.5, 3.5, 6, 12), stone);
    lantern.position.set(court.x, 57, court.z);
    lantern.castShadow = true;
    landmarks.add(lantern);
  }
  const archCenter = project(-90.184776, 38.624691),
    arch = new T.Group();
  arch.position.set(archCenter[0], 0, archCenter[1]);
  const archVerts = [],
    archIdx = [];
  const a = 127.7,
    H = 192,
    span = 192,
    N = 100;
  for (let i = 0; i <= N; i++) {
    const t = i / N,
      x = (t - 0.5) * span,
      y =
        (H * (Math.cosh(span / 2 / a) - Math.cosh(x / a))) /
        (Math.cosh(span / 2 / a) - 1),
      width = 6.3 + 10 * Math.pow(Math.abs(t - 0.5) * 2, 2.4);
    const dy = (-H * Math.sinh(x / a)) / a / (Math.cosh(span / 2 / a) - 1),
      nx = -dy / Math.hypot(1, dy),
      ny = 1 / Math.hypot(1, dy);
    for (let j = 0; j < 3; j++) {
      const ang = (j / 3) * Math.PI * 2,
        off = Math.cos(ang) * width * 0.5;
      archVerts.push(
        x + nx * off,
        Math.max(0, y + ny * off),
        Math.sin(ang) * width * 0.5,
      );
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < 3; j++) {
      const a = i * 3 + j,
        b = i * 3 + ((j + 1) % 3),
        c = (i + 1) * 3 + j,
        d = (i + 1) * 3 + ((j + 1) % 3);
      archIdx.push(a, b, c, b, d, c);
    }
  const ag = new T.BufferGeometry();
  ag.setAttribute("position", new T.Float32BufferAttribute(archVerts, 3));
  ag.setIndex(archIdx);
  ag.computeVertexNormals();
  const am = new T.Mesh(
    ag,
    new T.MeshStandardMaterial({
      color: "#c9d1cf",
      metalness: 0.68,
      roughness: 0.22,
      side: T.DoubleSide,
    }),
  );
  am.castShadow = true;
  am.receiveShadow = true;
  arch.add(am);
  arch.rotation.y = Math.PI / 2 - 0.32;
  landmarks.add(arch);
  detail = await createCityDetail(data, materials);
  scene.add(detail.group);
  // Road-following ambient vehicles are decoration, with reproducible placement.
  const vehicleRoutes = (data.roads || [])
    .filter(
      (r) =>
        !r.tunnel &&
        !r.bridge &&
        ["primary", "secondary", "tertiary", "residential"].includes(r.kind) &&
        r.points.length > 2,
    )
    .slice(0, 180);
  const vehicles = [];
  const carGeo = new T.BoxGeometry(2.1, 1.3, 4.5),
    carTopGeo = new T.BoxGeometry(1.8, 0.75, 2.4),
    carMat = new T.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.15,
      color: "#d4d2c6",
    }),
    glassMat = new T.MeshStandardMaterial({
      color: "#34484c",
      roughness: 0.22,
      metalness: 0.3,
    });
  const cars = new T.InstancedMesh(carGeo, carMat, vehicleRoutes.length * 2),
    tops = new T.InstancedMesh(carTopGeo, glassMat, vehicleRoutes.length * 2);
  cars.castShadow = false;
  tops.castShadow = false;
  traffic.add(cars, tops);
  for (const r of vehicleRoutes) {
    const dist = [0];
    for (let i = 1; i < r.points.length; i++)
      dist.push(
        dist.at(-1) +
          Math.hypot(
            r.points[i][0] - r.points[i - 1][0],
            r.points[i][1] - r.points[i - 1][1],
          ),
      );
    for (let j = 0; j < 2; j++) {
      const rng = rand(hash(r.id) + j);
      vehicles.push({
        points: r.points,
        dist,
        length: dist.at(-1),
        speed: 4 + rng() * 5,
        offset: rng() * dist.at(-1),
      });
      cars.setColorAt(
        vehicles.length - 1,
        new T.Color(
          ["#d6cfc0", "#3a484f", "#a3a596", "#8b4934", "#28373c"][
            Math.floor(rng() * 5)
          ],
        ),
      );
    }
  }
  function moveVehicles(t) {
    vehicles.forEach((v, i) => {
      let d = (v.offset + t * v.speed) % v.length,
        k = 1;
      while (k < v.dist.length - 1 && v.dist[k] < d) k++;
      const a = v.points[k - 1],
        b = v.points[k],
        f = (d - v.dist[k - 1]) / (v.dist[k] - v.dist[k - 1]),
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      dummy.position.set(
        T.MathUtils.lerp(a[0], b[0], f) - (dz / len) * 2.2,
        1.05,
        T.MathUtils.lerp(a[1], b[1], f) + (dx / len) * 2.2,
      );
      dummy.rotation.set(0, Math.atan2(dx, dz), 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      cars.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 1.95;
      dummy.updateMatrix();
      tops.setMatrixAt(i, dummy.matrix);
    });
    cars.instanceMatrix.needsUpdate = true;
    tops.instanceMatrix.needsUpdate = true;
  }
  const highlightMat = new T.MeshBasicMaterial({
      color: "#f7d18c",
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    selection = new T.Group();
  scene.add(selection);
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    down = [e.clientX, e.clientY];
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (
      !down ||
      Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (listingsLayer.pick(raycaster) || !buildings.visible) return;
    const hits = raycaster.intersectObjects(pickMeshes, false);
    const regionalHit = region?.raycast(raycaster);
    const b = regionalHit && (!hits[0] || regionalHit.distance < hits[0].distance)
      ? regionalHit.building
      : hits[0]?.object.userData;
    if (b) {
      selectBuilding(b);
      onSelect(b);
    }
  });
  function clear(group) {
    while (group.children.length) {
      const o = group.children[0];
      group.remove(o);
      o.geometry?.dispose();
      if (o.material !== highlightMat) o.material?.dispose();
    }
  }
  function selectBuilding(b) {
    clear(selection);
    const g = new T.ExtrudeGeometry(shapeOf(b.polygon, b.holes), {
      depth: Math.max(0.1, b.height - (b.minHeight || 0)) + 0.9,
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.45 + (b.minHeight || 0), 0);
    selection.add(new T.Mesh(g, highlightMat));
    const line = new T.LineSegments(
      new T.EdgesGeometry(g),
      new T.LineBasicMaterial({ color: "#f4d096" }),
    );
    selection.add(line);
  }
  let light = 17,
    network = false,
    paused = reduced,
    disposed = false,
    animTime = 0,
    last = performance.now(),
    flying = null,
    frames = 0,
    slowFrames = 0,
    quality = "auto",
    flatMix = 0;
  let fogDensity = 0.00006,
    weatherState = null;
  const rainCount = 800,
    rainSeeds = rand(90311),
    rainBase = Array.from({ length: rainCount }, () => [
      rainSeeds() * 1100 - 550,
      rainSeeds() * 450,
      rainSeeds() * 1100 - 550,
    ]);
  const rainGeometry = new T.BufferGeometry(),
    rainPositions = new Float32Array(rainCount * 6);
  rainGeometry.setAttribute(
    "position",
    new T.BufferAttribute(rainPositions, 3),
  );
  const rain = new T.LineSegments(
    rainGeometry,
    new T.LineBasicMaterial({
      color: "#d0dce2",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  function setEnvironment(solar, weather = null) {
    weatherState = weather?.usable ? weather : null;
    const elevation = solar.direction.y,
      day = T.MathUtils.smoothstep(elevation, -0.09, 0.18),
      night = 1 - T.MathUtils.smoothstep(elevation, -0.07, 0.08),
      cloud = weatherState?.cloudCoverFraction ?? 0.15;
    sunDirection
      .set(solar.direction.x, solar.direction.y, solar.direction.z)
      .normalize();
    sun.position.copy(controls.target).addScaledVector(sunDirection, 6000);
    sun.target.position.copy(controls.target);
    sun.intensity =
      Math.max(0, elevation) > 0.001
        ? (2.5 + Math.sqrt(Math.max(0, elevation)) * 2.2) * (1 - cloud * 0.86)
        : 0;
    sun.color.set(elevation < 0.28 ? "#ffddaf" : "#fff4e5");
    hemi.intensity = 0.18 + day * 0.93;
    hemi.color.set(night > 0.6 ? "#6a87ad" : "#d8e4ed");
    hemi.groundColor.set(night > 0.6 ? "#333b46" : "#6a715b");
    scene.environmentIntensity = 0.035 + day * 0.18;
    wallMaterials.forEach((m) => (m.emissiveIntensity = 0.006 + night * 1.65));
    detail?.setNight(night);
    am.material.emissive.set("#c3d5e4");
    am.material.emissiveIntensity = night * 0.28;
    su.sunPosition.value.copy(sunDirection);
    su.turbidity.value = 2 + cloud * 9;
    su.rayleigh.value = 1.7;
    waterMat.uniforms.sun.value.copy(sunDirection);
    waterMat.uniforms.warm.value = day;
    waterMat.uniforms.lightGain.value = 0.08 + day * 0.92;
    waterMat.uniforms.waveGain.value =
      weatherState?.windSpeedMps === null ||
      weatherState?.windSpeedMps === undefined
        ? 1
        : clamp(0.4 + weatherState.windSpeedMps * 0.15, 0.4, 2.5);
    const fog = new T.Color(
      night > 0.8 ? "#172839" : cloud > 0.7 ? "#98a8ae" : "#abbec5",
    );
    scene.fog.color.copy(fog);
    scene.background.copy(fog);
    waterMat.uniforms.fogColor.value.copy(fog);
    fogDensity =
      weatherState?.visibilityMeters > 0
        ? clamp(1 / weatherState.visibilityMeters, 0.000025, 0.0004)
        : 0.000045;
    materials.setWetness(
      weatherState?.precipitationLastHourMm > 0
        ? Math.min(1, 0.35 + weatherState.precipitationLastHourMm * 0.16)
        : weatherState?.precipitationKind === "rain"
          ? 0.7
          : 0,
    );
    rain.visible =
      ["rain", "mixed", "snow"].includes(weatherState?.precipitationKind) &&
      camera.zoom > 0.3;
    renderer.toneMappingExposure = 0.95 + day * 0.14;
    renderer.shadowMap.needsUpdate = true;
  }
  function setLight(hour) {
    light = hour;
    const now = new Date(),
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now),
      localHour =
        Number(parts.find((p) => p.type === "hour").value) +
        Number(parts.find((p) => p.type === "minute").value) / 60;
    setEnvironment(
      solarPosition(new Date(now.getTime() + (hour - localHour) * 3600000)),
      weatherState,
    );
  }
  function flyTo(x, z, zoom = 1.8) {
    const target = new T.Vector3(x, 20, z);
    const direction = camera.position.clone().sub(controls.target).normalize();
    const destinationDirection = new T.Vector3(...regionViewDirection(zoom, direction.toArray()));
    controls.minPolarAngle = zoom < .075 ? .0005 : .18;
    flying = {
      from: controls.target.clone(),
      to: target,
      start: performance.now(),
      zoomFrom: camera.zoom,
      zoomTo: zoom,
      directionFrom: direction,
      directionTo: destinationDirection,
    };
    if (reduced) {
      controls.target.copy(target);
      camera.zoom = zoom;
      camera.position.copy(target).addScaledVector(destinationDirection, cameraDistance / Math.min(1, zoom));
      camera.updateProjectionMatrix();
      controls.update();
      invalidateShadows();
      flying = null;
    }
  }
  function reset() {
    flying = null;
    controls.minPolarAngle = .18;
    const mobile = container.clientWidth / container.clientHeight < 0.8;
    camera.position.set(2100, 1100, 1700);
    controls.target.set(mobile ? 350 : 150, 35, 140);
    camera.zoom = mobile ? 0.62 : 1;
    camera.updateProjectionMatrix();
    controls.update();
  }
  function route(points, color = "#f0c674", width = 3.5) {
    if (points.length < 2) return;
    const mesh = new T.Mesh(
      ribbon(points, width, 4),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      }),
    );
    mesh.renderOrder = 10;
    overlays.add(mesh);
  }
  function pin(x, z, color) {
    const g = new T.Group();
    const post = new T.Mesh(
      new T.CylinderGeometry(1, 1, 40, 8),
      new T.MeshBasicMaterial({ color, depthTest: false }),
    );
    post.position.y = 20;
    g.add(post);
    const orb = new T.Mesh(
      new T.SphereGeometry(7, 12, 8),
      new T.MeshBasicMaterial({ color, depthTest: false }),
    );
    orb.position.y = 44;
    g.add(orb);
    g.position.set(x, 0, z);
    g.renderOrder = 12;
    overlays.add(g);
  }
  function clearRoutes() {
    overlays.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    overlays.clear();
  }
  function setNetwork(v) {
    renderer.shadowMap.needsUpdate = true;
    network = v;
    region?.setNetwork(v);
    if (detail) detail.group.visible = !v && buildings.visible;
    green.visible = !v;
    traffic.visible = !v;
    landmarks.visible = !v;
    roofMat.color.set(v ? "#b5bcad" : "#898b86");
    wallMaterials.forEach((m) => {
      m.color.set(v ? "#99a894" : "#ffffff");
    });
  }
  function setQuality(q) {
    quality = q;
    ambientOcclusion = q !== "low";
    renderer.setPixelRatio(
      q === "low" ? 1 : Math.min(devicePixelRatio, q === "high" ? 2 : 1.5),
    );
    sun.shadow.mapSize.set(
      q === "high" ? 4096 : 2048,
      q === "high" ? 4096 : 2048,
    );
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
    resize();
  }
  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    camera.left = (-frustum * w) / h / 2;
    camera.right = (frustum * w) / h / 2;
    camera.top = frustum / 2;
    camera.bottom = -frustum / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    ao.setSize(
      Math.round(w * renderer.getPixelRatio() * 0.75),
      Math.round(h * renderer.getPixelRatio() * 0.75),
    );
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  setLight(light);
  moveVehicles(0);
  function onKeyDown(e) {
    if (e.target !== container) return;
    const d = 80 / camera.zoom;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "Home",
      ].includes(e.key)
    )
      e.preventDefault();
    if (e.key === "Home") return reset();
    if (e.key === "+" || e.key === "-") {
      camera.zoom = clamp(
        camera.zoom * (e.key === "+" ? 1.15 : 0.87),
        0.013,
        12,
      );
      camera.updateProjectionMatrix();
    }
    const v = new T.Vector3(
      e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0,
      0,
      e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0,
    );
    camera.position.add(v);
    controls.target.add(v);
  }
  container.addEventListener("keydown", onKeyDown);
  function frame(now) {
    if (disposed) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    if (!paused) animTime += dt;
    waterMat.uniforms.time.value = animTime;
    waterMat.uniforms.fogDensity.value = fogDensity * Math.min(1, camera.zoom);
    if (rain.visible) {
      const wind = weatherState?.windVector || { x: 0, z: 0 },
        snow = weatherState?.precipitationKind === "snow";
      for (let i = 0; i < rainCount; i++) {
        const b = rainBase[i],
          y = (((b[1] - animTime * (snow ? 8 : 80)) % 450) + 450) % 450,
          x = controls.target.x + b[0] + Math.sin(animTime * 0.3 + i) * 2,
          z = controls.target.z + b[2];
        rainPositions.set(
          [x, y, z, x - wind.x * 0.4, y + (snow ? 1 : 9), z - wind.z * 0.4],
          i * 6,
        );
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }

    if (!paused && frames % 2 === 0) moveVehicles(animTime);
    if (flying) {
      const p = clamp((now - flying.start) / 1300, 0, 1),
        ease = 1 - Math.pow(1 - p, 3),
        target = flying.from.clone().lerp(flying.to, ease),
        direction = flying.directionFrom.clone().lerp(flying.directionTo, ease).normalize();
      controls.target.copy(target);
      camera.zoom = T.MathUtils.lerp(flying.zoomFrom, flying.zoomTo, ease);
      camera.position.copy(target).addScaledVector(direction, cameraDistance / Math.min(1,camera.zoom));
      camera.updateProjectionMatrix();
      if (p === 1) flying = null;
    }
    const previousFlatMix = flatMix;
    flatMix = T.MathUtils.damp(flatMix, network ? 1 : 0, 6, dt);
    if (Math.abs(flatMix - previousFlatMix) > 0.0001)
      renderer.shadowMap.needsUpdate = true;
    buildings.scale.y = 1 - flatMix * 0.93;
    selection.scale.y = buildings.scale.y;
    for (const pick of pickMeshes) {
      pick.scale.y = buildings.scale.y;
      pick.updateMatrixWorld();
    }
    controls.update();
    const offset = camera.position
      .clone()
      .sub(controls.target)
      .normalize()
      .multiplyScalar(cameraDistance / Math.min(1, camera.zoom));
    camera.position.copy(controls.target).add(offset);
    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).addScaledVector(sunDirection, 6000);
    const castShadow = camera.zoom > 0.12;
    if (castShadow !== sun.castShadow) invalidateShadows();
    sun.castShadow = castShadow;
    listingsLayer.update(camera.zoom);
    scene.fog.density = fogDensity * Math.min(1, camera.zoom);
    if (region) region.update(now);
    ao.enabled = ambientOcclusion && camera.zoom > 0.12;
    composer.render();
    frames++;
    if (frames === 2) onReady();
    if (quality === "auto" && frames < 200 && dt > 0.038) slowFrames++;
    if (quality === "auto" && frames === 200 && slowFrames > 70) {
      ambientOcclusion = false;
      renderer.setPixelRatio(1);
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      renderer.shadowMap.needsUpdate = true;
      resize();
    }
  }
  requestAnimationFrame(frame);
  createRegionScene({
    scene,
    camera,
    controls,
    materials,
    data,
    waterMaterial: waterMat,
    onStatus: onRegionStatus,
    onManifest: onRegionReady,
    onSceneChange: invalidateShadows,
  })
    .then((value) => {
      if (disposed) value.dispose();
      else {
        region = value;
        region.setNetwork(network);
        region.toggle("buildings", buildings.visible);
        region.toggle("green", green.visible);
      }
    })
    .catch((error) => onRegionStatus({ error: error.message }));
  return {
    engine: "three",
    scene,
    camera,
    renderer,
    controls,
    flyTo,
    setListings: listingsLayer.setListings,
    reset,
    route,
    pin,
    clearRoutes,
    selectBuilding,
    setLight,
    setEnvironment,
    setNetwork,
    setQuality,
    setPaused(v) {
      paused = v;
    },
    toggle(name, v) {
      (({ buildings, green, traffic })[name] || scene).visible = v;
      region?.toggle(name, v);
      if (name === "buildings" && detail) detail.group.visible = v && !network;
      renderer.shadowMap.needsUpdate = true;
    },
    zoom(factor) {
      camera.zoom = clamp(camera.zoom * factor, 0.013, 12);
      camera.updateProjectionMatrix();
    },
    north() {
      const offset = camera.position.clone().sub(controls.target);
      offset.set(0, offset.y, Math.hypot(offset.x, offset.z));
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    dispose() {
      disposed = true;
      ro.disconnect();
      container.removeEventListener("keydown", onKeyDown);
      controls.removeEventListener("change", invalidateShadows);
      listingsLayer.dispose();
      region?.dispose();
      detail?.dispose();
      materials.dispose();
      ao.dispose();
      composer.dispose();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
      renderer.domElement.remove();
    },
  };
}
