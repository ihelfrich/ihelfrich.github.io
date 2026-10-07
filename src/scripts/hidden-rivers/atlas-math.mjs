import { sampleVelocity, EARTH_METRES_PER_DEGREE } from './field.mjs';

export function unpackField(meta, buffer) {
  const view = new DataView(buffer), values = new Int16Array(buffer.byteLength / 2);
  for (let i = 0; i < values.length; i++) values[i] = view.getInt16(i * 2, true);
  if (values.length !== 2 * meta.shape.reduce((a, b) => a * b, 1)) throw Error('Incomplete current field');
  return { ...meta, values };
}

// A repeated snapshot permits the existing tested sampler to represent a
// stationary velocity field. Streamlines are graphics, not forecast tracks.
export function snapshotField(layer, index) {
  const [nt, ny, nx] = layer.shape, plane = ny * nx;
  if (!Number.isInteger(index) || index < 0 || index >= nt) throw Error('Invalid field frame');
  const values = new Int16Array(4 * plane);
  for (let c = 0; c < 2; c++) {
    const slice = layer.values.subarray((c * nt + index) * plane, (c * nt + index + 1) * plane);
    values.set(slice, c * 2 * plane); values.set(slice, (c * 2 + 1) * plane);
  }
  return { ...layer, shape: [2, ny, nx], values, dates: undefined, timeStepSeconds: 86400 };
}

export function sampleAt(field, lon, lat) {
  return sampleVelocity(field, (lon - field.lon0) / field.dlon, (lat - field.lat0) / field.dlat, 0);
}

// RK2 streamlines of one instantaneous field, using the same spherical metric
// and strict wet-cell interpolation as the released transport renderer.
export function streamline(field, lon, lat, steps = 96, stepSeconds = 1800) {
  const points = [];
  for (let i = 0; i < steps; i++) {
    const v = sampleAt(field, lon, lat); if (!v || Math.hypot(...v) < .005) break;
    points.push([lon, lat, Math.hypot(...v)]);
    const mx = lon + v[0] * stepSeconds / (2 * EARTH_METRES_PER_DEGREE * Math.cos(lat * Math.PI / 180));
    const my = lat + v[1] * stepSeconds / (2 * EARTH_METRES_PER_DEGREE);
    const mid = sampleAt(field, mx, my); if (!mid) break;
    lon += mid[0] * stepSeconds / (EARTH_METRES_PER_DEGREE * Math.cos(my * Math.PI / 180));
    lat += mid[1] * stepSeconds / EARTH_METRES_PER_DEGREE;
  }
  return points;
}

export function seeded(seed = 9) {
  let x = seed >>> 0;
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 4294967296; };
}

// Web Mercator rows differ from latitude-linear rows: match the exported warp.
export function indexPixel(bounds, shape, lon, lat) {
  const [w, s, e, n] = bounds, [height, width] = shape;
  if (lon < w || lon > e || lat < s || lat > n) return null;
  const merc = p => Math.log(Math.tan(Math.PI / 4 + p * Math.PI / 360));
  return [Math.min(width - 1, Math.floor((lon - w) / (e - w) * width)),
    Math.min(height - 1, Math.floor((merc(n) - merc(lat)) / (merc(n) - merc(s)) * height))];
}
