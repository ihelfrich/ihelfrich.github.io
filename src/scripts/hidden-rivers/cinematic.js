import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { advance, sampleVelocity } from './field.mjs';

// Positions use a local equirectangular display projection, 200 km per world unit.
// Integration uses geographic grid rates in field.mjs, not display coordinates.
const DAY = 86400, STEP = 1800, HISTORY = 3 * DAY, EARTH_KM = Math.PI * 6371 / 180;
const COLORS = {
  speed: ['#102e50', '#17688b', '#32c8cf', '#a4f3c1', '#fff0a4'],
  vorticity: ['#6857d8', '#4bb4e3', '#233344', '#ffc57b', '#ed655e'],
  stretching: ['#080d20', '#392867', '#a7447b', '#f38c61', '#fff2b0'],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nextPaint = () => new Promise(resolve => setTimeout(resolve, 0));
const layerDuration = layer => layer?.dates?.length > 1 ? (Date.parse(layer.dates.at(-1)) - Date.parse(layer.dates[0])) / 1000 : ((layer?.shape?.[0] || 6) - 1) * (layer?.timeStepSeconds || DAY);
function dailyLayer(layer) {
  if (!layer?.dates?.length || layer.dates.length <= 6) return layer;
  const start = Date.parse(layer.dates[0]), indices = layer.dates.map((date, index) => [index, (Date.parse(date) - start) / 1000]).filter(([, seconds]) => Math.abs(seconds % DAY) < .01).map(([index]) => index);
  const [nt, ny, nx] = layer.shape, plane = ny * nx, values = new Int16Array(2 * indices.length * plane);
  for (let c = 0; c < 2; c++) indices.forEach((index, t) => values.set(layer.values.subarray((c * nt + index) * plane, (c * nt + index + 1) * plane), (c * indices.length + t) * plane));
  return { ...layer, values, shape: [indices.length, ny, nx], dates: indices.map(i => layer.dates[i]), timeStepSeconds: DAY };
}
const halton = (index, base) => { let v = 0, f = 1; while (index > 0) { f /= base; v += f * (index % base); index = Math.floor(index / base); } return v; };
const palette = key => COLORS[key].map(c => new THREE.Color(c));
const mixColor = (colors, t, target) => { const x = clamp(t, 0, 1) * (colors.length - 1), i = Math.min(colors.length - 2, Math.floor(x)); return target.copy(colors[i]).lerp(colors[i + 1], x - i); };

const lineVertex = `
  attribute float modelTime;
  attribute float speed;
  uniform float exaggeration;
  varying float vTime;
  varying float vSpeed;
  void main() {
    vec3 p = position;
    p.y = p.y * exaggeration + 0.025;
    vTime = modelTime;
    vSpeed = speed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const lineFragment = `
  uniform float now;
  uniform float history;
  uniform float opacity;
  uniform float neutral;
  uniform vec3 color0;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform vec3 color4;
  varying float vTime;
  varying float vSpeed;
  vec3 ramp(float x) {
    float s = clamp(x / 2.0, 0.0, 1.0) * 4.0;
    if (s < 1.0) return mix(color0, color1, s);
    if (s < 2.0) return mix(color1, color2, s - 1.0);
    if (s < 3.0) return mix(color2, color3, s - 2.0);
    return mix(color3, color4, s - 3.0);
  }
  void main() {
    float age = now - vTime;
    if (age < 0.0 || age > history) discard;
    float tail = pow(1.0 - age / history, 0.7);
    float head = exp(-age / 5200.0);
    float light = 0.52 + 0.8 * head;
    gl_FragColor = vec4(mix(ramp(vSpeed), vec3(0.62, 0.72, 0.75), neutral) * light, opacity * tail);
  }
`;

/**
 * A renderer whose time axis is wholly controlled by its caller.
 * All filament vertices are actual time-dependent model trajectories. No
 * cosmetic movement is added to their spatial coordinates or velocities.
 */
export function createCinematicOcean(container, options = {}) {
  const reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000103);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.domElement.setAttribute('aria-label', 'Time-dependent ocean trajectories over georeferenced bathymetry');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000103, 0.008);
  const camera = new THREE.PerspectiveCamera(39, 1, .01, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.minDistance = 2;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * .48;
  controls.enablePan = true;
  scene.add(new THREE.AmbientLight(0x88acba, 1.1));
  const sun = new THREE.DirectionalLight(0xb9e6ee, 2.5); sun.position.set(-6, 10, -6); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x406aad, .8); fill.position.set(9, 4, 10); scene.add(fill);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), mobile ? .4 : .62, .52, .48);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const overlay = document.createElement('div');
  overlay.className = 'ocean-geographic-labels';
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  container.appendChild(overlay);
  const labels = [];
  let group = new THREE.Group(); scene.add(group);
  let region = null, layers = [], diagnostics = null, terrain = null, surface = null, selectedMarker = null;
  let dailyLayers = new Map(), pendingTracks = new Map(), tracksInProgress = 0;
  let tracks = [], fields = [], time = 3 * DAY, depth = 0, mode = 'flow', view = 'oblique';
  let vertical = 60, film = false, filmStarted = 0, playing = false, disposed = false, manualRendering = false, epoch = 0;
  let lastField = -1, lastStats = 0, inViewport = true, raf = 0, ready = false;
  let fitDistance = 14, baseTarget = new THREE.Vector3(), selected = null;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), temp = new THREE.Vector3();
  const speedPalette = palette('speed');

  function world(lon, lat, elevation = 0) {
    const b = region.bounds, middle = (b[1] + b[3]) / 2;
    return new THREE.Vector3((lon - (b[0] + b[2]) / 2) * EARTH_KM * Math.cos(middle * Math.PI / 180) / 200, elevation / 200000, -(lat - middle) * EARTH_KM / 200);
  }
  function layerPoint(layer, x, y) { return world(layer.lon0 + x * layer.dlon, layer.lat0 + y * layer.dlat, -layer.depth); }
  function active(layer) { return (mode === 'column' || depth === 'all') ? true : Number(depth) === layer.depth; }
  function variantFor(layer) { return mode === 'column' && dailyLayers.get(layer.depth) !== layer ? 'daily' : 'native'; }
  function activeTrack(track) { return active(track.layer) && track.variant === variantFor(layers.find(l => l.depth === track.layer.depth) || track.layer); }
  function displayVertical() { return view === 'map' ? 0 : vertical; }
  function colorUniforms() { return Object.fromEntries(speedPalette.map((c, i) => [`color${i}`, { value: c }])); }
  function releaseGroup() {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { materials.add(m); if (m.map) textures.add(m.map); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    scene.remove(group); group = new THREE.Group(); scene.add(group); overlay.replaceChildren();
    labels.length = 0; tracks = []; fields = []; terrain = surface = selectedMarker = null;
  }
  function label(text, lon, lat, elevation = 0, kind = 'place', layerDepth = null) {
    const el = document.createElement('span'); el.textContent = text; el.className = `ocean-geo-label ocean-geo-label--${kind}`;
    el.style.cssText = `position:absolute;white-space:nowrap;color:${kind === 'depth' ? '#a6e7df' : '#b6c7ca'};font:500 ${kind === 'place' ? '10' : '9'}px ui-monospace,monospace;letter-spacing:${kind === 'place' ? '.12' : '.04'}em;text-shadow:0 1px 8px #02070c;transform:translate(-50%,-50%);opacity:.8`;
    overlay.appendChild(el); labels.push({ el, point: world(lon, lat, elevation), kind, depth: layerDepth });
  }
  function buildGeography(z, texture) {
    const t = region.terrain, [ny, nx] = t.shape, b = region.bounds;
    const geometry = new THREE.PlaneGeometry(1, 1, nx - 1, ny - 1), pos = geometry.attributes.position.array, colors = new Float32Array(nx * ny * 3);
    const c = new THREE.Color(), deep = new THREE.Color(0x0a1825), shallow = new THREE.Color(0x264b56), land = new THREE.Color(0x374446);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x, p = world(t.lon0 + x * t.dlon, t.lat0 + y * t.dlat, z[i]); pos.set([p.x, p.y, p.z], i * 3);
      if (z[i] >= 0) c.copy(land).lerp(new THREE.Color(0x617473), clamp(z[i] / 3000, 0, 1));
      else c.copy(deep).lerp(shallow, Math.pow(clamp(1 + z[i] / 6500, 0, 1), 1.8));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: .05, side: THREE.DoubleSide, transparent: true, opacity: .92 }));
    terrain.scale.y = displayVertical(); group.add(terrain);
    // Imagery remains at the surface. It is never painted onto the seafloor.
    const sw = world(b[0], b[1]), ne = world(b[2], b[3]);
    surface = new THREE.Mesh(new THREE.PlaneGeometry(ne.x - sw.x, sw.z - ne.z), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .19, side: THREE.DoubleSide, depthWrite: false, color: 0x779498 }));
    surface.rotation.x = -Math.PI / 2; surface.position.y = .008; group.add(surface);
    const points = [];
    for (let k = 0; k <= 5; k++) {
      const lon = b[0] + (b[2] - b[0]) * k / 5, lat = b[1] + (b[3] - b[1]) * k / 5;
      points.push(world(lon, b[1]), world(lon, b[3]), world(b[0], lat), world(b[2], lat));
      if (k > 0 && k < 5) { label(`${Math.abs(lon).toFixed(0)}°${lon < 0 ? 'W' : 'E'}`, lon, b[1], 0, 'axis'); label(`${Math.abs(lat).toFixed(0)}°${lat < 0 ? 'S' : 'N'}`, b[0], lat, 0, 'axis'); }
    }
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x76979e, opacity: .12, transparent: true, depthWrite: false })); grid.position.y = .01; group.add(grid);
    for (const l of layers) {
      const corners = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]].map(([x, y]) => world(x, y, -l.depth));
      const frame = new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineBasicMaterial({ color: 0x68aaa9, opacity: .16, transparent: true, depthWrite: false }));
      frame.userData.depth = l.depth; frame.userData.frame = true; frame.scale.y = displayVertical(); group.add(frame);
      label(l.depth ? `${l.depth.toLocaleString()} m` : 'SURFACE', b[2], b[1], -l.depth, 'depth', l.depth);
    }
    const places = { agulhas: [['CAPE TOWN',18.45,-33.92],['SOUTH AFRICA',25.3,-31.7],['SOUTH ATLANTIC',13,-38.4],['INDIAN OCEAN',32,-39.3]], bahamas: [['FLORIDA',-80.9,28.3],['CUBA',-77.8,22.4],['BAHAMAS',-75.7,24.8],['NORTH ATLANTIC',-73.6,29.8]], denmark: [['GREENLAND',-41.5,66.9],['ICELAND',-20.9,64.7],['IRMINGER SEA',-33.5,61.5]] };
    for (const [name, lon, lat] of places[region.id] || []) label(name, lon, lat, 50, 'place');
  }

  async function buildTracks(layer, version, variant = 'native') {
    const [, ny, nx] = layer.shape, duration = layerDuration(layer);
    const desired = mobile ? 420 : 1000, positions = [], times = [], speeds = [], paths = [];
    let candidates = 0;
    while (paths.length < desired && candidates < desired * 15) {
      candidates++;
      const start = candidates % 5 === 0 ? DAY : 0;
      const x = halton(candidates, 2) * (nx - 1.02) + .005, y = halton(candidates, 3) * (ny - 1.02) + .005;
      const velocity = sampleVelocity(layer, x, y, start); if (!velocity) continue;
      const speed = Math.hypot(...velocity);
      // The deterministic acceptance rule concentrates some seeds in fast jets
      // without treating density as transport, mass, or observational coverage.
      if (halton(candidates, 5) > .38 + .62 * clamp(speed / .65, 0, 1)) continue;
      let px = x, py = y, previous = layerPoint(layer, x, y), previousSpeed = speed;
      const samples = [previous.x, previous.y, previous.z, speed];
      for (let t = start; t < duration; t += STEP) {
        let moved = advance(layer, px, py, t, STEP / 2);
        if (moved) moved = advance(layer, moved[0], moved[1], t + STEP / 2, STEP / 2);
        if (!moved) break;
        px = moved[0]; py = moved[1]; const p = layerPoint(layer, px, py);
        positions.push(previous.x, previous.y, previous.z, p.x, p.y, p.z); times.push(t, t + STEP); speeds.push(previousSpeed, moved[2]);
        samples.push(p.x, p.y, p.z, moved[2]); previous = p; previousSpeed = moved[2];
      }
      if (samples.length > 4) paths.push({ start, samples: new Float32Array(samples) });
      if (candidates % 70 === 0) { options.onProgress?.({ depth: layer.depth, paths: paths.length, target: desired }); await nextPaint(); if (version !== epoch || disposed) return; }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('modelTime', new THREE.Float32BufferAttribute(times, 1)); geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
    const uniforms = { now: { value: time }, history: { value: HISTORY }, opacity: { value: .87 }, neutral: { value: 0 }, exaggeration: { value: displayVertical() }, ...colorUniforms() };
    const lines = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({ uniforms, vertexShader: lineVertex, fragmentShader: lineFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true })); lines.frustumCulled = false; lines.renderOrder = 3; group.add(lines);
    const hp = new Float32Array(paths.length * 3), hc = new Float32Array(paths.length * 3), hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3).setUsage(THREE.DynamicDrawUsage)); hg.setAttribute('color', new THREE.BufferAttribute(hc, 3).setUsage(THREE.DynamicDrawUsage));
    const heads = new THREE.Points(hg, new THREE.ShaderMaterial({ uniforms: { exaggeration: { value: displayVertical() }, opacity: { value: .85 }, ratio: { value: renderer.getPixelRatio() } }, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: `uniform float exaggeration; uniform float ratio; varying vec3 vColor; void main(){ vec3 p=position; p.y=p.y*exaggeration+0.026; vColor=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);gl_PointSize=3.2*ratio;}`, fragmentShader: `uniform float opacity; varying vec3 vColor; void main(){float r=length(gl_PointCoord-0.5)*2.0;if(r>1.0)discard;gl_FragColor=vec4(vColor*1.4,pow(1.0-r,1.2)*opacity);}` }));
    heads.frustumCulled = false; heads.renderOrder = 4; group.add(heads); tracks.push({ layer, paths, lines, heads, hp, hc, variant });
  }

  async function ensureTracks() {
    if (!region) return;
    const version = epoch;
    for (const original of layers.filter(active)) {
      const variant = variantFor(original), key = `${original.depth}:${variant}`;
      if (tracks.some(t => t.layer.depth === original.depth && t.variant === variant)) continue;
      if (!pendingTracks.has(key)) { tracksInProgress++; pendingTracks.set(key, buildTracks(variant === 'daily' ? dailyLayers.get(original.depth) : original, version, variant).finally(() => { tracksInProgress--; })); }
      await pendingTracks.get(key);
      if (version !== epoch || disposed) return;
      visibility(); emitStats(true);
    }
  }

  function buildField(layer) {
    const [, ny, nx] = layer.shape, canvas = document.createElement('canvas'); canvas.width = nx - 1; canvas.height = ny - 1;
    const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sw = layerPoint(layer, 0, 0), ne = layerPoint(layer, nx - 1, ny - 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ne.x - sw.x, sw.z - ne.z), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .19, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((sw.x + ne.x) / 2, sw.y * displayVertical() + .014, (sw.z + ne.z) / 2); mesh.renderOrder = 2; group.add(mesh); fields.push({ layer, canvas, ctx, texture, mesh });
  }

  function diagnosticFor(layer, name) {
    if (!diagnostics) return null;
    const d = Array.isArray(diagnostics.layers) ? diagnostics.layers.find(x => x.depth === layer.depth) : diagnostics[layer.depth];
    return d?.[name] || d?.fields?.[name] || null;
  }
  function diagnosticValue(item, lon, lat, seconds, discrete = false) {
    if (!item) return NaN;
    const values = item.values || item.data, shape = item.shape;
    if (!values || !shape) return NaN;
    const plane = shape[1] * shape[2], grid = item.grid || item, first = item.startSeconds || 0, step = item.timeStepSeconds || DAY;
    const x = (lon - grid.lon0) / grid.dlon, y = (lat - grid.lat0) / grid.dlat;
    if (!Number.isFinite(x + y) || x < 0 || y < 0 || x > shape[2] - 1 || y > shape[1] - 1) return NaN;
    const ix = Math.min(shape[2] - 2, Math.floor(x)), iy = Math.min(shape[1] - 2, Math.floor(y)), ax = x - ix, ay = y - iy;
    const sample = frame => {
      const indices = [iy * shape[2] + ix, iy * shape[2] + ix + 1, (iy + 1) * shape[2] + ix, (iy + 1) * shape[2] + ix + 1], weights = [(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay];
      let v = 0; for (let k = 0; k < 4; k++) { const q = values[frame * plane + indices[k]]; if (!Number.isFinite(q)) return NaN; v += q * weights[k]; } return v;
    };
    if (discrete) { const frame = Math.round((seconds - first) / step); return frame < 0 || frame >= shape[0] ? NaN : sample(frame); }
    const t = (seconds - first) / step;
    if (shape[0] === 1) return sample(0);
    if (t < 0 || t > shape[0] - 1) return NaN;
    const low = Math.min(shape[0] - 2, Math.floor(t)), a = t - low, q = sample(low), r = sample(low + 1);
    return Number.isFinite(q) && Number.isFinite(r) ? q * (1 - a) + r * a : NaN;
  }
  function updateFields(force = false) {
    const stamp = `${mode}:${Math.floor(time / 3600)}`; if (!force && stamp === lastField) return; lastField = stamp;
    const key = mode === 'vorticity' ? 'vorticity' : mode === 'stretching' ? 'stretching' : 'speed', colors = palette(key), c = new THREE.Color();
    for (const f of fields) {
      if (!active(f.layer)) continue;
      const [, ny, nx] = f.layer.shape, image = f.ctx.createImageData(nx - 1, ny - 1), diagnostic = diagnosticFor(f.layer, mode === 'stretching' ? 'ftle' : 'vorticity');
      for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
        const source = mode === 'column' ? dailyLayers.get(f.layer.depth) || f.layer : f.layer;
        const velocity = sampleVelocity(source, x + .5, y + .5, time); if (!velocity) continue;
        let value;
        if (key === 'speed') value = Math.hypot(...velocity) / 2;
        else {
          const v = diagnosticValue(diagnostic, f.layer.lon0 + (x + .5) * f.layer.dlon, f.layer.lat0 + (y + .5) * f.layer.dlat, time, mode === 'stretching');
          if (!Number.isFinite(v)) continue;
          const domain = diagnostic?.displayDomain || (mode === 'vorticity' ? [-.00002, .00002] : [0, .9]);
          value = (v - domain[0]) / (domain[1] - domain[0]);
        }
        mixColor(colors, value, c).convertLinearToSRGB();
        const o = ((ny - 2 - y) * (nx - 1) + x) * 4; image.data.set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 245], o);
      }
      f.ctx.putImageData(image, 0, 0); f.texture.needsUpdate = true;
    }
  }
  function updateHeads() {
    const c = new THREE.Color();
    for (const t of tracks) {
      t.lines.material.uniforms.now.value = time;
      if (!t.lines.visible) continue;
      for (let j = 0; j < t.paths.length; j++) {
        const p = t.paths[j], samples = p.samples, n = samples.length / 4, at = (time - p.start) / STEP;
        if (at < 0 || at > n - 1) { t.hp.set([1000, 1000, 1000], j * 3); continue; }
        const k = Math.min(n - 2, Math.floor(at)), a = at - k;
        for (let d = 0; d < 3; d++) t.hp[j * 3 + d] = samples[k * 4 + d] * (1 - a) + samples[(k + 1) * 4 + d] * a;
        const speed = samples[k * 4 + 3] * (1 - a) + samples[(k + 1) * 4 + 3] * a;
        if (mode === 'vorticity' || mode === 'stretching') c.setRGB(.62, .72, .75); else mixColor(speedPalette, speed / 2, c);
        t.hc.set([c.r, c.g, c.b], j * 3);
      }
      t.heads.geometry.attributes.position.needsUpdate = true; t.heads.geometry.attributes.color.needsUpdate = true;
    }
  }
  function visibility() {
    const diagnosticMode = mode === 'vorticity' || mode === 'stretching';
    // Bloom follows luminous trajectories. Broad diagnostic rasters retain
    // contrast rather than turning every high-value cell into a glowing blur.
    bloom.strength = diagnosticMode ? .10 : mobile ? .4 : .62;
    bloom.threshold = diagnosticMode ? .92 : .48;
    for (const t of tracks) { t.lines.visible = activeTrack(t); t.heads.visible = t.lines.visible; t.lines.material.uniforms.neutral.value = diagnosticMode ? 1 : 0; t.lines.material.uniforms.opacity.value = diagnosticMode ? .42 : mode === 'column' ? .72 : .92; t.heads.material.uniforms.opacity.value = diagnosticMode ? .55 : .95; }
    for (const f of fields) { f.mesh.visible = active(f.layer); f.mesh.material.opacity = diagnosticMode ? .72 : mode === 'column' ? .07 : .13; }
    group.traverse(o => { if (o.userData.frame) o.visible = active({ depth: o.userData.depth }) && view !== 'map'; });
    if (surface) surface.material.opacity = mode === 'vorticity' || mode === 'stretching' ? .12 : .19;
    updateFields(true); updateHeads(); updateMarker();
  }
  function applyVertical() {
    const v = displayVertical(); if (terrain) terrain.scale.y = v;
    for (const t of tracks) { t.lines.material.uniforms.exaggeration.value = v; t.heads.material.uniforms.exaggeration.value = v; }
    for (const f of fields) f.mesh.position.y = -f.layer.depth / 200000 * v + .014;
    group.traverse(o => { if (o.userData.frame) o.scale.y = v; }); updateMarker();
  }
  function resetView(initial = false) {
    if (!region) return;
    const b = region.bounds, sw = world(b[0], b[1]), ne = world(b[2], b[3]), width = ne.x - sw.x, height = sw.z - ne.z;
    fitDistance = Math.max(height, width / camera.aspect) / (2 * Math.tan(camera.fov * Math.PI / 360));
    baseTarget.set(0, view === 'map' ? 0 : -.42, 0); controls.target.copy(baseTarget);
    // The phone opening view favors the central current system; users can pan
    // across its geographic extent. Explicit Reset always fits the full region.
    const openingZoom = mobile && initial ? 1.45 : 1;
    if (view === 'map') camera.position.set(0, fitDistance * 1.12 / openingZoom, .001);
    else camera.position.copy(new THREE.Vector3(.08, 1.04, 1).normalize().multiplyScalar(fitDistance * 1.27 / openingZoom)).add(baseTarget);
    camera.up.set(0, 1, 0); controls.enableRotate = view !== 'map'; camera.lookAt(baseTarget); controls.update();
  }
  function updateMarker() {
    if (selectedMarker) { selectedMarker.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); group.remove(selectedMarker); selectedMarker = null; }
    if (!selected || !region) return;
    selectedMarker = new THREE.Group(); const points = layers.filter(active).map(l => { const p = world(selected.lon, selected.lat, -l.depth); p.y = p.y * displayVertical() + .025; return p; });
    for (const p of points) { const ring = new THREE.Mesh(new THREE.RingGeometry(.055, .065, 32), new THREE.MeshBasicMaterial({ color: 0xf8e6b1, depthTest: false, side: THREE.DoubleSide, transparent: true, opacity: .95 })); ring.rotation.x = -Math.PI / 2; ring.position.copy(p); selectedMarker.add(ring); }
    if (points.length > 1) selectedMarker.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: 0xb2dacf, transparent: true, opacity: .5, depthTest: false, dashSize: .05, gapSize: .04 })));
    group.add(selectedMarker);
  }
  function getLegend() {
    const layer = layers.find(active) || layers[0];
    if (mode === 'vorticity') { const domain = diagnosticFor(layer, 'vorticity')?.displayDomain || [-.00002, .00002]; return { title: 'Vertical relative vorticity', units: '10⁻⁵ s⁻¹', min: domain[0] * 1e5, max: domain[1] * 1e5, colors: COLORS.vorticity, clipped: true, note: 'Negative: clockwise. Positive: counterclockwise.' }; }
    if (mode === 'stretching') { const domain = diagnosticFor(layer, 'ftle')?.displayDomain || [0, .9]; return { title: '48-hour forward stretching (FTLE)', units: 'day⁻¹', min: domain[0], max: domain[1], colors: COLORS.stretching, clipped: true, note: 'Daily start date; full 48-hour trajectories. The final available start is 2 October.' }; }
    return { title: 'Horizontal speed', units: 'm s⁻¹', min: 0, max: 2, colors: COLORS.speed, clipped: true, note: 'Color encodes speed. Seed density does not measure volume transport.' };
  }
  function emitStats(force = false) {
    const now = performance.now(); if (!force && now - lastStats < 300) return; lastStats = now;
    const ftleStartSeconds = mode === 'stretching' && Math.round(time / DAY) <= 3 ? Math.round(time / DAY) * DAY : null;
    options.onStats?.({ time, particles: tracks.filter(activeTrack).reduce((n, t) => n + t.paths.length, 0), segments: tracks.filter(activeTrack).reduce((n, t) => n + t.lines.geometry.attributes.position.count / 2, 0), historyHours: Math.min(time, HISTORY) / 3600, mode, view, exaggeration: displayVertical(), legend: getLegend(), ftleStartSeconds, ftleEndSeconds: ftleStartSeconds === null ? null : ftleStartSeconds + 2 * DAY, loadedDepths: tracks.filter(activeTrack).map(t => t.layer.depth), ready, columnCadenceHours: mode === 'column' ? 24 : null });
  }
  function resize() { const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight); renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); if (region) resetView(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(e => { inViewport = e[0].isIntersecting; }); intersectionObserver.observe(container);
  resize();
  function drawFrame() {
    controls.update();
    for (const l of labels) {
      l.el.hidden = l.kind === 'depth' && (view === 'map' || !active({ depth: l.depth })); if (l.el.hidden) continue;
      temp.copy(l.point); temp.y = temp.y * displayVertical() + .025; temp.project(camera);
      const x = (temp.x * .5 + .5) * container.clientWidth, y = (-temp.y * .5 + .5) * container.clientHeight;
      l.el.style.left = `${x}px`; l.el.style.top = `${y}px`; l.el.style.visibility = temp.z < 1 && x > 20 && x < container.clientWidth - 20 && y > 20 && y < container.clientHeight - 25 ? 'visible' : 'hidden';
    }
    composer.render();
  }
  let lastFrame = 0;
  function frame(now) {
    if (disposed) return; raf = requestAnimationFrame(frame);
    if (manualRendering) return;
    if (!inViewport || document.hidden || now - lastFrame < (ready && tracksInProgress === 0 ? (mobile ? 32 : 16) : 400)) return; lastFrame = now;
    if (film && !reduced && view !== 'map' && region) {
      const t = (now - filmStarted) / 1000, angle = .10 + Math.sin(t / 19) * .22, tilt = .77 + Math.sin(t / 29) * .08;
      camera.position.set(Math.sin(angle) * fitDistance * 1.22, fitDistance * tilt, Math.cos(angle) * fitDistance * .92).add(baseTarget); controls.target.copy(baseTarget);
    }
    drawFrame(); emitStats();
  }
  raf = requestAnimationFrame(frame);
  let down = null;
  const pointerDown = e => { down = [e.clientX, e.clientY]; if (film) { film = false; options.onFilmEnd?.(); } };
  const pointerUp = e => {
    if (!down || !region || !ready || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    const d = mode === 'column' || depth === 'all' ? layers[0].depth : Number(depth), y = -d / 200000 * displayVertical();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), temp)) return;
    const b = region.bounds, latc = (b[1] + b[3]) / 2, lon = (b[0] + b[2]) / 2 + temp.x * 200 / (EARTH_KM * Math.cos(latc * Math.PI / 180)), lat = latc - temp.z * 200 / EARTH_KM;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return; selected = { lon, lat }; updateMarker(); options.onPick?.(lon, lat);
  };
  renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);

  return {
    async loadRegion(r, loadedLayers, terrainInt16, diagnosticData = null) {
      const version = ++epoch; ready = false; releaseGroup(); region = r; layers = loadedLayers; diagnostics = diagnosticData; pendingTracks = new Map(); dailyLayers = new Map(layers.map(l => [l.depth, dailyLayer(l)]));
      if (!layers.some(l => l.depth === Number(depth)) && depth !== 'all') depth = layers[0].depth;
      time = clamp(time, 0, layerDuration(layers[0])); selected = null;
      let texture;
      try { texture = await new THREE.TextureLoader().loadAsync(`/hidden-rivers/images/${region.id}_basemap.jpg`); texture.colorSpace = THREE.SRGBColorSpace; }
      catch { texture = new THREE.DataTexture(new Uint8Array([17, 38, 45, 255]), 1, 1); texture.needsUpdate = true; }
      if (version !== epoch || disposed) { texture.dispose(); return; }
      buildGeography(terrainInt16, texture); layers.forEach(buildField); resetView(true); visibility();
      // Only the requested depth is integrated. Other depths are built on demand
      // and kept in memory, so the first scene does not wait for an entire stack.
      await ensureTracks(); if (version !== epoch || disposed) return;
      ready = true; emitStats(true);
    },
    setTime(seconds) { if (!Number.isFinite(seconds)) return; time = clamp(seconds, 0, layerDuration(layers[0])); updateHeads(); updateFields(); emitStats(); },
    setDepth(value) { depth = value === 'all' ? 'all' : Number(value); visibility(); emitStats(true); void ensureTracks().catch(e => options.onError?.(e)); },
    setMode(value) { if (!['flow', 'vorticity', 'stretching', 'column'].includes(value)) return; mode = value; if (mode === 'column') { view = 'oblique'; applyVertical(); resetView(); } visibility(); emitStats(true); void ensureTracks().catch(e => options.onError?.(e)); },
    setPalette() { /* Semantic scales are fixed across regions and depths. */ },
    setView(value) { const next = value === 'map' ? 'map' : 'oblique', changed = next !== view; view = next; if (view === 'map' && (depth === 'all' || mode === 'column')) { depth = layers[0]?.depth ?? 0; mode = 'flow'; } applyVertical(); visibility(); if (changed) resetView(); emitStats(true); },
    setPlaying(value) { playing = Boolean(value); return playing; },
    setFilm(value) { film = Boolean(value) && !reduced; filmStarted = performance.now(); if (film) { view = 'oblique'; applyVertical(); resetView(); } },
    setExaggeration(value) { vertical = clamp(Number(value) || 60, 1, 300); applyVertical(); emitStats(true); },
    select(lon, lat) { selected = Number.isFinite(lon + lat) ? { lon, lat } : null; updateMarker(); },
    setDiagnostics(value) { diagnostics = value; updateFields(true); },
    getLegend,
    getColumnLayers() { return [...dailyLayers.values()]; },
    async whenReady() { await ensureTracks(); drawFrame(); },
    renderFrame() { film = false; drawFrame(); },
    setManualRendering(value) { manualRendering = Boolean(value); },
    getCamera() { return { position: camera.position.toArray(), target: controls.target.toArray(), view }; },
    setCamera(state) { if (state?.position?.length === 3 && state?.target?.length === 3 && [...state.position, ...state.target].every(Number.isFinite)) { camera.position.fromArray(state.position); controls.target.fromArray(state.target); controls.update(); } },
    resetView() { resetView(false); },
    snapshot() { drawFrame(); return renderer.domElement.toDataURL('image/png'); },
    getCanvas() { return renderer.domElement; },
    dispose() { disposed = true; ++epoch; cancelAnimationFrame(raf); resizeObserver.disconnect(); intersectionObserver.disconnect(); controls.dispose(); releaseGroup(); composer.dispose(); bloom.dispose(); renderer.dispose(); renderer.domElement.remove(); overlay.remove(); },
  };
}
