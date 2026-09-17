import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const rand = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
export const hash = (value) => {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
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
export function centroid(p) {
  const b = new T.Box2().setFromPoints(p.map((q) => new T.Vector2(...q)));
  return [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2];
}
export function shapeOf(polygon, holes = []) {
  const s = new T.Shape(polygon.map((p) => new T.Vector2(p[0], -p[1])));
  for (const ring of holes)
    s.holes.push(new T.Path(ring.map((p) => new T.Vector2(p[0], -p[1]))));
  return s;
}
export function flatGeometry(polygon, holes = [], y = 0.1) {
  const g = new T.ShapeGeometry(shapeOf(polygon, holes));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
// UVs are metres, not normalized bounding boxes: diagonal streets and facades retain scale.
export function ribbon(points, width, y = 0.3) {
  const pos = [],
    uv = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    if (l < 0.01) continue;
    const nx = ((-dz / l) * width) / 2,
      nz = ((dx / l) * width) / 2;
    for (const p of [
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [a[0] - nx, a[1] - nz],
      [a[0] - nx, a[1] - nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
    ]) {
      pos.push(p[0], y, p[1]);
      uv.push(p[0], -p[1]);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
export function mergedMesh(geometries, material, group, shadow = false) {
  if (!geometries.length) return null;
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error("Incompatible city geometry attributes");
  const mesh = new T.Mesh(merged, material);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  for (const g of geometries) g.dispose();
  return mesh;
}
const metreUV = {
  generateTopUV(g, v, a, b, c) {
    return [a, b, c].map((i) => new T.Vector2(v[i * 3], v[i * 3 + 1]));
  },
  generateSideWallUV(g, v, a, b, c, d) {
    const dx = v[b * 3] - v[a * 3],
      dy = v[b * 3 + 1] - v[a * 3 + 1],
      l = Math.hypot(dx, dy) || 1;
    return [a, b, c, d].map(
      (i) =>
        new T.Vector2(
          ((v[i * 3] - v[a * 3]) * dx + (v[i * 3 + 1] - v[a * 3 + 1]) * dy) / l,
          v[i * 3 + 2],
        ),
    );
  },
};
export function buildingGeometry(b) {
  const g = new T.ExtrudeGeometry(shapeOf(b.polygon, b.holes), {
    depth: Math.max(0.1, b.height - (b.minHeight || 0)),
    bevelEnabled: false,
    steps: 1,
    UVGenerator: metreUV,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.3 + (b.minHeight || 0), 0);
  return g;
}
export function splitBuildingGeometry(geo, roofs, walls) {
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
    (group.materialIndex === 0 ? roofs : walls).push(part);
  }
}
export function facadeStyle(b) {
  if (b.height > 48) return 3;
  const n = hash(b.id) % 10;
  return n < 4 ? 0 : n < 6 ? 1 : n < 8 ? 2 : n === 8 ? 4 : 5;
}
