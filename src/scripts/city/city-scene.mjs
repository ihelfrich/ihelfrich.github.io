import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Sky } from "three/addons/objects/Sky.js";

const clamp = T.MathUtils.clamp;
const rand = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const hash = (s) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
export function contains(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
const centroid = (p) => {
  const b = new T.Box2().setFromPoints(p.map((q) => new T.Vector2(...q)));
  return [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2];
};
function shapeOf(polygon, holes = []) {
  const s = new T.Shape(polygon.map((p) => new T.Vector2(p[0], -p[1])));
  for (const ring of holes)
    s.holes.push(new T.Path(ring.map((p) => new T.Vector2(p[0], -p[1]))));
  return s;
}
function flatGeometry(polygon, holes = [], y = 0.1) {
  const g = new T.ShapeGeometry(shapeOf(polygon, holes));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
function ribbon(points, width, y = 0.3) {
  const pos = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    if (l < 0.01) continue;
    const nx = ((-dz / l) * width) / 2,
      nz = ((dx / l) * width) / 2;
    pos.push(
      a[0] + nx,
      y,
      a[1] + nz,
      b[0] + nx,
      y,
      b[1] + nz,
      a[0] - nx,
      y,
      a[1] - nz,
      a[0] - nx,
      y,
      a[1] - nz,
      b[0] + nx,
      y,
      b[1] + nz,
      b[0] - nx,
      y,
      b[1] - nz,
    );
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function mergedMesh(geometries, material, group, shadow = false) {
  if (!geometries.length) return null;
  const merged = mergeGeometries(geometries, false);
  if (!merged) return null;
  const mesh = new T.Mesh(merged, material);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  for (const g of geometries) g.dispose();
  return mesh;
}
function facade(style) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d"),
    r = rand(style + 31);
  const colors = [
    "#a8947c",
    "#806151",
    "#b0a794",
    "#6d7978",
    "#776f63",
    "#9b8670",
  ];
  ctx.fillStyle = colors[style % colors.length];
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    for (let x = -16; x < 128; x += 32) {
      ctx.fillStyle = `rgba(35,28,21,${0.04 + r() * 0.08})`;
      ctx.fillRect(x + (y % 16 ? 16 : 0), y, 31, 7);
    }
  }
  const glass = style === 3;
  ctx.fillStyle = glass ? "#344955" : "#243335";
  ctx.fillRect(glass ? 3 : 24, 12, glass ? 122 : 80, 88);
  const gradient = ctx.createLinearGradient(0, 12, 0, 100);
  gradient.addColorStop(0, "#69808a");
  gradient.addColorStop(0.45, "#41545a");
  gradient.addColorStop(1, "#202e33");
  ctx.fillStyle = gradient;
  ctx.fillRect(glass ? 5 : 27, 15, glass ? 118 : 74, 80);
  ctx.fillStyle = "rgba(207,204,171,.28)";
  ctx.fillRect(32, 20, 2, 72);
  ctx.fillRect(66, 16, 2, 80);
  ctx.fillStyle = glass ? "#89918c" : "#beb5a0";
  ctx.fillRect(glass ? 0 : 19, 102, glass ? 128 : 90, 4);
  ctx.fillStyle = "#313735";
  ctx.fillRect(0, 125, 128, 3);
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(0.24, 0.27);
  texture.anisotropy = 4;
  return texture;
}

function facadeLights(style) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d"),
    r = rand(style + 190);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++)
      if (r() > 0.68) {
        ctx.fillStyle = r() > 0.5 ? "#ffe6af" : "#fff7dc";
        ctx.fillRect(
          x * 128 + (style === 3 ? 5 : 27),
          y * 128 + 15,
          style === 3 ? 118 : 74,
          80,
        );
      }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(0.06, 0.0675);
  return t;
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
  t.repeat.set(150, 150);
  return t;
}

export async function createCityScene(
  container,
  data,
  { onSelect = () => {}, onReady = () => {}, onError = () => {} } = {},
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
    28000,
  );
  camera.position.set(2100, 1100, 1700);
  camera.zoom = aspect < 0.8 ? 0.62 : 1;
  camera.updateProjectionMatrix();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(aspect < 0.8 ? 350 : 150, 35, 140);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.07;
  controls.minZoom = 0.38;
  controls.maxZoom = 5;
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
  const sun = new T.DirectionalLight("#ffe4b4", 3.4);
  sun.position.set(-2200, 1700, 600);
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
  sky.scale.setScalar(15000);
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
    new T.PlaneGeometry(24000, 24000),
    new T.MeshStandardMaterial({
      color: "#b7b6a5",
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
  const wallMaterials = Array.from(
    { length: 6 },
    (_, i) =>
      new T.MeshStandardMaterial({
        map: facade(i),
        roughness: i === 3 ? 0.32 : 0.86,
        metalness: i === 3 ? 0.25 : 0.04,
        color: 0xffffff,
        emissive: "#ffc06b",
        emissiveMap: facadeLights(i),
        emissiveIntensity: 0.015,
      }),
  );
  const roofMat = new T.MeshStandardMaterial({
      color: "#aaa899",
      roughness: 0.95,
    }),
    wallBuckets = wallMaterials.map(() => []),
    roofs = [],
    pickMeshes = [],
    roofProps = [];
  const roofDetailMat = new T.MeshStandardMaterial({
    color: "#787d76",
    roughness: 0.85,
  });
  const uv = {
    generateTopUV(g, v, a, b, c) {
      return [a, b, c].map((i) => new T.Vector2(v[i * 3], v[i * 3 + 1]));
    },
    generateSideWallUV(g, v, a, b, c, d) {
      const x =
        Math.abs(v[a * 3] - v[b * 3]) > Math.abs(v[a * 3 + 1] - v[b * 3 + 1]);
      return [a, b, c, d].map(
        (i) => new T.Vector2(v[i * 3 + (x ? 0 : 1)], v[i * 3 + 2]),
      );
    },
  };
  for (const b of data.buildings) {
    if (!b.polygon?.length || b.polygon.length < 3) continue;
    const center = centroid(b.polygon),
      style = b.height > 70 ? 3 : hash(b.id) % 6;
    const geo = new T.ExtrudeGeometry(shapeOf(b.polygon, b.holes), {
      depth: Math.max(0.1, b.height - (b.minHeight || 0)),
      bevelEnabled: false,
      steps: 1,
      UVGenerator: uv,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.3 + (b.minHeight || 0), 0);
    const pick = new T.Mesh(geo);
    pick.userData = b;
    pickMeshes.push(pick);
    for (const group of geo.groups) {
      const part = new T.BufferGeometry();
      for (const [key, attr] of Object.entries(geo.attributes))
        part.setAttribute(
          key,
          new T.BufferAttribute(
            attr.array.slice(
              group.start * attr.itemSize,
              (group.start + group.count) * attr.itemSize,
            ),
            attr.itemSize,
          ),
        );
      (group.materialIndex === 0 ? roofs : wallBuckets[style]).push(part);
    }
    const rng = rand(hash(b.id));
    const bounds = new T.Box2().setFromPoints(
      b.polygon.map((p) => new T.Vector2(...p)),
    );
    const w = bounds.max.x - bounds.min.x,
      d = bounds.max.y - bounds.min.y;
    if (
      w > 14 &&
      d > 14 &&
      contains(center, b.polygon) &&
      !(b.holes || []).some((r) => contains(center, r))
    ) {
      const prop = new T.BoxGeometry(
        Math.min(12, w * 0.25),
        2.4,
        Math.min(8, d * 0.25),
      );
      prop.translate(center[0], b.height + 1.5, center[1]);
      roofProps.push(prop);
    }
    if (b.height > 70) {
      const crown = new T.BoxGeometry(
        Math.min(14, w * 0.35),
        4,
        Math.min(14, d * 0.35),
      );
      if (contains(center, b.polygon)) {
        crown.translate(center[0], b.height + 2, center[1]);
        roofProps.push(crown);
      }
    }
  }
  for (let i = 0; i < wallBuckets.length; i++)
    mergedMesh(wallBuckets[i], wallMaterials[i], buildings, true);
  mergedMesh(roofs, roofMat, buildings, true);
  mergedMesh(roofProps, roofDetailMat, buildings, true);
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
  mergedMesh(
    sidewalkGeo,
    new T.MeshStandardMaterial({ color: "#b8b4a5", roughness: 1 }),
    roads,
  );
  mergedMesh(
    roadGeo,
    new T.MeshStandardMaterial({ color: "#525551", roughness: 0.95 }),
    roads,
  );
  mergedMesh(
    pathGeo,
    new T.MeshStandardMaterial({ color: "#b7ab91", roughness: 1 }),
    roads,
  );
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
      fogColor: { value: new T.Color("#b8c4bd") },
    },
    vertexShader: `varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `precision highp float;varying vec3 vWorld;uniform float time;uniform float warm;uniform float lightGain;uniform vec3 sun;uniform vec3 fogColor;void main(){vec2 p=vWorld.xz;float s1=sin(p.x*.09+p.y*.055+time*.75),s2=cos(p.y*.15-p.x*.04+time*.4);vec3 n=normalize(vec3((s1+s2*.43)*.06,1.,(s2+sin(p.x*.33+time)*.3)*.06));vec3 v=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,v),0.),3.);vec3 base=mix(vec3(.19,.25,.25),vec3(.46,.49,.43),fres);float glint=pow(max(dot(reflect(-normalize(sun),n),v),0.),95.);vec3 col=base*lightGain+vec3(1.,.80,.48)*glint*.6*warm;float fog=1.-exp(-length(cameraPosition-vWorld)*.000045);gl_FragColor=vec4(mix(col,fogColor,fog),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
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
      !buildings.visible ||
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
    const hits = raycaster.intersectObjects(pickMeshes, false);
    if (hits[0]) {
      const b = hits[0].object.userData;
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
  function setLight(hour) {
    renderer.shadowMap.needsUpdate = true;
    light = hour;
    const phase = (hour - 6) / 16,
      alt = Math.max(0.015, Math.sin(phase * Math.PI) * 0.5),
      theta = (phase - 0.5) * Math.PI * 1.5;
    sun.position.set(
      Math.sin(theta) * -3800,
      alt * 3500,
      Math.cos(theta) * 1400,
    );
    sun.intensity = hour > 20 ? 0.18 : 3.5 + alt;
    sun.color.set(hour > 15 ? "#ffe0ad" : "#fff0d5");
    hemi.intensity = hour > 20 ? 0.35 : 1.0;
    scene.environmentIntensity = hour > 20 ? 0.03 : 0.14;
    wallMaterials.forEach(
      (m) =>
        (m.emissiveIntensity =
          hour > 18 ? Math.min(1.1, (hour - 18) * 0.4) : 0.015),
    );
    hemi.color.set(hour > 20 ? "#7f9dad" : "#dce6ec");
    su.sunPosition.value.copy(sun.position).normalize();
    waterMat.uniforms.sun.value.copy(sun.position).normalize();
    waterMat.uniforms.warm.value = hour > 20 ? 0.1 : 1;
    waterMat.uniforms.lightGain.value = hour > 20 ? 0.22 : 1;
    am.material.emissive.set("#b4c3bf");
    am.material.emissiveIntensity = hour > 19 ? 0.16 : 0;
    scene.fog.color.set(hour > 20 ? "#52636a" : "#b8c4bd");
    waterMat.uniforms.fogColor.value.copy(scene.fog.color);
    renderer.toneMappingExposure = hour > 20 ? 0.83 : 1.08;
  }
  function flyTo(x, z, zoom = 1.8) {
    const target = new T.Vector3(x, 20, z);
    flying = {
      from: controls.target.clone(),
      to: target,
      start: performance.now(),
      zoomFrom: camera.zoom,
      zoomTo: zoom,
    };
    if (reduced) {
      const d = target.clone().sub(controls.target);
      camera.position.add(d);
      controls.target.copy(target);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      flying = null;
    }
  }
  function reset() {
    flying = null;
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
    green.visible = !v;
    traffic.visible = !v;
    landmarks.visible = !v;
    roofMat.color.set(v ? "#b5bcad" : "#aaa899");
    wallMaterials.forEach((m) => {
      m.color.set(v ? "#99a894" : "#ffffff");
    });
  }
  function setQuality(q) {
    quality = q;
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
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  setLight(light);
  moveVehicles(0);
  container.addEventListener("keydown", (e) => {
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
      camera.zoom = clamp(camera.zoom * (e.key === "+" ? 1.15 : 0.87), 0.38, 5);
      camera.updateProjectionMatrix();
    }
    const v = new T.Vector3(
      e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0,
      0,
      e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0,
    );
    camera.position.add(v);
    controls.target.add(v);
  });
  function frame(now) {
    if (disposed) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    if (!paused) animTime += dt;
    waterMat.uniforms.time.value = animTime;
    if (!paused && frames % 2 === 0) moveVehicles(animTime);
    if (flying) {
      const p = clamp((now - flying.start) / 1300, 0, 1),
        ease = 1 - Math.pow(1 - p, 3),
        target = flying.from.clone().lerp(flying.to, ease),
        delta = target.clone().sub(controls.target);
      camera.position.add(delta);
      controls.target.copy(target);
      camera.zoom = T.MathUtils.lerp(flying.zoomFrom, flying.zoomTo, ease);
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
    renderer.render(scene, camera);
    frames++;
    if (frames === 2) onReady();
    if (quality === "auto" && frames < 200 && dt > 0.038) slowFrames++;
    if (quality === "auto" && frames === 200 && slowFrames > 70) {
      renderer.setPixelRatio(1);
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      renderer.shadowMap.needsUpdate = true;
      resize();
    }
  }
  requestAnimationFrame(frame);
  return {
    scene,
    camera,
    renderer,
    controls,
    flyTo,
    reset,
    route,
    pin,
    clearRoutes,
    selectBuilding,
    setLight,
    setNetwork,
    setQuality,
    setPaused(v) {
      paused = v;
    },
    toggle(name, v) {
      (({ buildings, green, traffic })[name] || scene).visible = v;
      renderer.shadowMap.needsUpdate = true;
    },
    zoom(factor) {
      camera.zoom = clamp(camera.zoom * factor, 0.38, 5);
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
