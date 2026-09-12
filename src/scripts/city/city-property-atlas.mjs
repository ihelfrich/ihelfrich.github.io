import * as T from "three";
import { preparePropertyAtlas, PROPERTY_ATLAS_LIMIT, propertyAtlasAvailableViewport } from "../../lib/city-property-atlas.mjs";

const METRES_PER_DEGREE = 111195;
const emptyStatus = () => ({ status: "cleared", shown: 0, inputCount: 0, invalid: 0, duplicates: 0, truncated: 0, domain: null });
const copyStatus = status => ({ ...status, domain: status.domain ? [...status.domain] : null });

export function propertyAtlasViewport(container) {
  const viewport = container?.getBoundingClientRect?.();
  if (!viewport) return null;
  const app = container.closest?.("#city-app"), win = container.ownerDocument?.defaultView;
  const blockers = [];
  for (const element of app?.querySelectorAll("#explorer,.city-header,.workspace-command,.mode-bar,.conditions-card,.light-controls,.city-footer,.atlas-map-key") || []) {
    if (element.hidden) continue;
    const style = win?.getComputedStyle?.(element);
    if (style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") continue;
    blockers.push(element.getBoundingClientRect());
  }
  return propertyAtlasAvailableViewport(viewport, blockers);
}

/** A static single-draw-call point buffer. Selection is a bounded screen-space
 * lookup on click only; no per-point DOM, meshes, animation, or render polling. */
export function createThreePropertyAtlas(scene, origin = [-90.193, 38.628], { getPixelRatio = () => 1 } = {}) {
  const longitudeScale = METRES_PER_DEGREE * Math.cos(origin[1] * Math.PI / 180);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(PROPERTY_ATLAS_LIMIT * 3), 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute("color", new T.BufferAttribute(new Float32Array(PROPERTY_ATLAS_LIMIT * 3), 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute("pointSize", new T.BufferAttribute(new Float32Array(PROPERTY_ATLAS_LIMIT), 1).setUsage(T.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new T.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `attribute float pointSize; attribute vec3 color;
      uniform float pixelRatio; varying vec3 atlasColor;
      void main() { atlasColor = color; gl_PointSize = pointSize * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 atlasColor;
      void main() { float radius = length(gl_PointCoord - vec2(0.5));
        if (radius > 0.5) discard;
        float edge = max(fwidth(radius), 0.015);
        gl_FragColor = vec4(atlasColor, 1.0 - smoothstep(0.5 - edge, 0.5, radius)); }`,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const points = new T.Points(geometry, material);
  points.name = "property-atlas";
  points.renderOrder = 18;
  points.frustumCulled = false;
  // Camera-quality changes only alter one uniform. Static records never require
  // a per-frame walk; this hook executes only when the scene actually renders.
  points.onBeforeRender = () => { material.uniforms.pixelRatio.value = Math.max(1, Number(getPixelRatio()) || 1); };
  scene.add(points);
  let items = [], onSelect = () => {}, status = emptyStatus(), disposed = false;
  const color = new T.Color(), screen = new T.Vector3();
  function clearPropertyAtlas() {
    if (disposed) return copyStatus(status);
    items = []; onSelect = () => {}; status = emptyStatus();
    geometry.setDrawRange(0, 0);
    return copyStatus(status);
  }
  return {
    setPropertyAtlas(input) {
      if (disposed) return copyStatus(status);
      ({ items, onSelect, status } = preparePropertyAtlas(input));
      const positions = geometry.attributes.position, colors = geometry.attributes.color, sizes = geometry.attributes.pointSize;
      const colorCache = new Map();
      items.forEach((item, index) => {
        // Heights are not interpreted as local surveyed elevations. This is a
        // planimetric overlay above the existing local map display plane.
        positions.setXYZ(index, (item.longitude - origin[0]) * longitudeScale, 4, -(item.latitude - origin[1]) * METRES_PER_DEGREE);
        let rgb = colorCache.get(item.color);
        if (!rgb) { color.set(item.color); rgb = [color.r, color.g, color.b]; colorCache.set(item.color, rgb); }
        colors.setXYZ(index, ...rgb);
        sizes.setX(index, item.pixelSize);
      });
      for (const attribute of [positions, colors, sizes]) {
        attribute.clearUpdateRanges();
        if (items.length) attribute.addUpdateRange(0, items.length * attribute.itemSize);
        attribute.needsUpdate = true;
      }
      geometry.setDrawRange(0, items.length);
      return copyStatus(status);
    },
    clearPropertyAtlas,
    getPropertyAtlasStatus: () => copyStatus(status),
    /** pointer is NDC; viewport dimensions are CSS pixels, as are point sizes. */
    pick(pointer, camera, viewport) {
      if (disposed || !points.visible || !items.length || !Number.isFinite(pointer?.x) || !Number.isFinite(pointer?.y) ||
        !(viewport?.width > 0) || !(viewport?.height > 0)) return false;
      camera.updateMatrixWorld(true);
      let best = -1, bestDistance = Infinity, bestDepth = Infinity;
      const positions = geometry.attributes.position;
      for (let i = 0; i < items.length; i++) {
        screen.fromBufferAttribute(positions, i).project(camera);
        if (screen.z < -1 || screen.z > 1) continue;
        const dx = (screen.x - pointer.x) * viewport.width / 2, dy = (screen.y - pointer.y) * viewport.height / 2;
        const distance = dx * dx + dy * dy, radius = items[i].pixelSize / 2 + 2;
        if (distance <= radius * radius && (distance < bestDistance || (distance === bestDistance && screen.z < bestDepth))) {
          best = i; bestDistance = distance; bestDepth = screen.z;
        }
      }
      if (best < 0) return false;
      onSelect(items[best].feature);
      return true;
    },
    dispose() {
      if (disposed) return;
      clearPropertyAtlas(); disposed = true;
      status = { ...emptyStatus(), status: "unavailable", reason: "disposed" };
      points.removeFromParent(); geometry.dispose(); material.dispose();
    },
  };
}

/** WGS84 footprint of the local camera on its map plane, not terrain coverage. */
export function threeViewportBounds(camera, origin = [-90.193, 38.628], viewport) {
  const longitudeScale = METRES_PER_DEGREE * Math.cos(origin[1] * Math.PI / 180);
  if (!camera || !Number.isFinite(longitudeScale) || Math.abs(longitudeScale) < 1) return null;
  camera.updateMatrixWorld(true);
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const left = viewport ? viewport.left * 2 / viewport.fullWidth - 1 : -1;
  const right = viewport ? (viewport.left + viewport.width) * 2 / viewport.fullWidth - 1 : 1;
  const top = viewport ? 1 - viewport.top * 2 / viewport.fullHeight : 1;
  const bottom = viewport ? 1 - (viewport.top + viewport.height) * 2 / viewport.fullHeight : -1;
  for (const [x, y] of [[left, bottom], [left, top], [right, bottom], [right, top]]) {
    ray.setFromCamera(new T.Vector2(x, y), camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const lon = origin[0] + hit.x / longitudeScale, lat = origin[1] - hit.z / METRES_PER_DEGREE;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    west = Math.min(west, lon); east = Math.max(east, lon); south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return [Math.max(-180, west), Math.max(-90, south), Math.min(180, east), Math.min(90, north)];
}

const validBounds = bounds => Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite) &&
  bounds[0] < bounds[2] && bounds[1] < bounds[3] && bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -90 && bounds[3] <= 90;

export function threeAtlasLocalPosition(longitude, latitude, origin = [-90.193, 38.628]) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  return { x: (longitude - origin[0]) * METRES_PER_DEGREE * Math.cos(origin[1] * Math.PI / 180), z: -(latitude - origin[1]) * METRES_PER_DEGREE };
}

/** A north-up orthographic fit uses both camera dimensions, including portrait
 * aspect. The scene adapter applies this camera plan through its normal flight. */
export function threeAtlasFit(camera, bounds, origin = [-90.193, 38.628], viewport) {
  if (!validBounds(bounds) || !camera?.isOrthographicCamera) return null;
  const a = threeAtlasLocalPosition(bounds[0], bounds[1], origin), b = threeAtlasLocalPosition(bounds[2], bounds[3], origin);
  const width = Math.max(25, Math.abs(b.x - a.x)), height = Math.max(25, Math.abs(b.z - a.z));
  const fractionX = viewport ? viewport.width / viewport.fullWidth : 1, fractionY = viewport ? viewport.height / viewport.fullHeight : 1;
  const zoom = Math.min(3, (camera.right - camera.left) * fractionX * 0.84 / width, (camera.top - camera.bottom) * fractionY * 0.84 / height);
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  const centerX = viewport ? 2 * (viewport.left + viewport.width / 2) / viewport.fullWidth - 1 : 0;
  const centerY = viewport ? 1 - 2 * (viewport.top + viewport.height / 2) / viewport.fullHeight : 0;
  return { x: (a.x + b.x) / 2 - centerX * (camera.right - camera.left) / (2 * zoom),
    z: (a.z + b.z) / 2 + centerY * (camera.top - camera.bottom) / (2 * zoom), zoom, widthMetres: width, heightMetres: height };
}

export function cesiumAtlasFit(C, viewer, bounds, { duration = 1.2, complete, viewport } = {}) {
  if (!validBounds(bounds) || !viewer || viewer.isDestroyed()) return false;
  // Cesium chooses the range from its actual perspective frustum and aspect;
  // passing a fabricated Three zoom would not produce the same geographic fit.
  let fitBounds;
  if (viewport) {
    const latitude = (bounds[1] + bounds[3]) / 2, longitudeScale = METRES_PER_DEGREE * Math.cos(latitude * Math.PI / 180);
    const width = (bounds[2] - bounds[0]) * longitudeScale / (0.84 * viewport.width / viewport.fullWidth);
    const height = (bounds[3] - bounds[1]) * METRES_PER_DEGREE / (0.84 * viewport.height / viewport.fullHeight);
    const aspect = viewport.fullWidth / viewport.fullHeight;
    const fullHeight = Math.max(height, width / aspect), fullWidth = fullHeight * aspect;
    const lonSpan = fullWidth / longitudeScale, latSpan = fullHeight / METRES_PER_DEGREE;
    const x = 2 * (viewport.left + viewport.width / 2) / viewport.fullWidth - 1, y = 1 - 2 * (viewport.top + viewport.height / 2) / viewport.fullHeight;
    const lon = (bounds[0] + bounds[2]) / 2 - x * lonSpan / 2, lat = latitude - y * latSpan / 2;
    fitBounds = [lon - lonSpan / 2, lat - latSpan / 2, lon + lonSpan / 2, lat + latSpan / 2];
  } else {
    const xPad = (bounds[2] - bounds[0]) * 0.08, yPad = (bounds[3] - bounds[1]) * 0.08;
    fitBounds = [bounds[0] - xPad, bounds[1] - yPad, bounds[2] + xPad, bounds[3] + yPad];
  }
  viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(Math.max(-180, fitBounds[0]), Math.max(-90, fitBounds[1]),
    Math.min(180, fitBounds[2]), Math.min(90, fitBounds[3])),
    orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration, complete });
  viewer.scene.requestRender(); return true;
}

/** GPU primitives, deliberately separate from the existing listing Entities.
 * Default elevations use the WGS84 ellipsoid; no ground-height claim is made. */
export function createCesiumPropertyAtlas(C, viewer) {
  const collection = viewer.scene.primitives.add(new C.PointPrimitiveCollection({ blendOption: C.BlendOption.OPAQUE }));
  const identities = new Map();
  let disposed = false, status = emptyStatus(), onSelect = () => {};
  const requestRender = () => { if (!viewer.isDestroyed()) viewer.scene.requestRender(); };
  function clearPropertyAtlas() {
    if (disposed) return copyStatus(status);
    identities.clear(); collection.removeAll(); onSelect = () => {}; status = emptyStatus(); requestRender();
    return copyStatus(status);
  }
  return {
    setPropertyAtlas(input) {
      if (disposed) return copyStatus(status);
      identities.clear(); collection.removeAll();
      const prepared = preparePropertyAtlas(input);
      status = prepared.status; onSelect = prepared.onSelect;
      for (const item of prepared.items) {
        // Object identity prevents collisions with provider features/listing IDs,
        // and makes a pick from a replaced collection unresolvable.
        const token = {};
        identities.set(token, item.feature);
        collection.add({ id: token, position: C.Cartesian3.fromDegrees(item.longitude, item.latitude, item.heightMetres),
          pixelSize: item.pixelSize, color: C.Color.fromCssColorString(item.color),
          outlineColor: C.Color.BLACK, outlineWidth: 0.5, disableDepthTestDistance: Number.POSITIVE_INFINITY });
      }
      requestRender(); return copyStatus(status);
    },
    clearPropertyAtlas,
    getPropertyAtlasStatus: () => copyStatus(status),
    pick(picked) {
      if (disposed) return false;
      const feature = identities.get(picked?.id) || identities.get(picked?.primitive?.id);
      if (!feature) return false;
      onSelect(feature); return true;
    },
    dispose() {
      if (disposed) return;
      identities.clear(); onSelect = () => {}; disposed = true;
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(collection);
      if (!collection.isDestroyed()) collection.destroy();
      status = { ...emptyStatus(), status: "unavailable", reason: "disposed" };
    },
  };
}

export function cesiumViewportBounds(C, viewer, viewport) {
  if (!viewer || viewer.isDestroyed()) return null;
  if (viewport) {
    const positions = [];
    for (const [x, y] of [[viewport.left, viewport.top], [viewport.left + viewport.width, viewport.top],
      [viewport.left, viewport.top + viewport.height], [viewport.left + viewport.width, viewport.top + viewport.height]]) {
      const point = viewer.camera.pickEllipsoid(new C.Cartesian2(x, y), C.Ellipsoid.WGS84);
      if (!point) return null;
      const position = C.Cartographic.fromCartesian(point);
      positions.push([C.Math.toDegrees(position.longitude), C.Math.toDegrees(position.latitude)]);
    }
    return [Math.min(...positions.map(p => p[0])), Math.min(...positions.map(p => p[1])), Math.max(...positions.map(p => p[0])), Math.max(...positions.map(p => p[1]))];
  }
  const rectangle = viewer.camera.computeViewRectangle(C.Ellipsoid.WGS84);
  if (!rectangle) return null;
  const bounds = [rectangle.west, rectangle.south, rectangle.east, rectangle.north].map(C.Math.toDegrees);
  return bounds.every(Number.isFinite) ? bounds : null;
}
