import { EARTH_METRES_PER_DEGREE } from './field.mjs';

// Each ocean vertex is a 1,800-second integration step. Two vertices per
// display second preserve the velocity differences at a 3,600× time scale.
export const CURRENT_SAMPLES_PER_SECOND = 2;
export const CURRENT_TIME_SCALE = 3600;
export const PULSE_SAMPLES = 18;

export function flowTiming(vertexCount, seconds, samplesPerSecond = CURRENT_SAMPLES_PER_SECOND) {
  return { repeats: (vertexCount - 1) / PULSE_SAMPLES, clock: seconds * samplesPerSecond / PULSE_SAMPLES };
}

// Split at every failed water-mask sample. Filtering the failed points out
// would create fictitious connections across land, cloud or missing imagery.
export function maskedRiverRuns(coordinates, isWet, spacingMetres = 180, minimumPoints = 5) {
  const runs = []; let run = [];
  const flush = () => { if (run.length >= minimumPoints) runs.push(run); run = []; };
  const accept = p => { if (isWet(p)) run.push(p); else flush(); };
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    const cos = Math.cos((a[1] + b[1]) * Math.PI / 360);
    const metres = Math.hypot((b[0] - a[0]) * cos, b[1] - a[1]) * EARTH_METRES_PER_DEGREE;
    const count = Math.max(1, Math.ceil(metres / spacingMetres));
    for (let j = 0; j < count; j++) accept([a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count]);
  }
  if (coordinates.length) accept(coordinates.at(-1));
  flush(); return runs;
}

// Open intervals: tails enter and leave a path; no end-to-start segment exists.
export function trailIntervals(last, phase, spacing = PULSE_SAMPLES, tail = 14) {
  const result = [], offset = ((phase % spacing) + spacing) % spacing;
  for (let head = offset; head < last + tail; head += spacing) {
    const start = Math.max(0, head - tail), end = Math.min(last, head);
    if (end > start) result.push({ start, end, head, tail });
  }
  return result;
}

export const FLOW_MATERIAL_SOURCE = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  float s = materialInput.st.s;
  float pulse = fract(s * repeats - clock + offset);
  float tail = smoothstep(0.18, 0.94, pulse) * (1.0 - smoothstep(0.97, 1.0, pulse));
  float across = 1.0 - smoothstep(0.08, 0.5, abs(materialInput.st.t - 0.5));
  float ends = smoothstep(0.0, 0.045, s) * smoothstep(0.0, 0.045, 1.0 - s);
  material.diffuse = color.rgb;
  material.emission = color.rgb * 0.25;
  material.alpha = color.a * across * ends * (0.06 + 0.94 * tail);
  return material;
}`;
