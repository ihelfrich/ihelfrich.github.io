/** Derived physical fields. NaN is missing, never a zero-speed or zero-gradient cell. */
export function diagnosticMetadata(manifest, regionId, depth, name) {
  const layer = manifest?.regions?.find(region => region.id === regionId)?.layers?.find(layer => layer.depth === Number(depth));
  const field = layer?.fields?.[name];
  return field ? { ...layer.grid, ...field, name, depth: layer.depth, validation: layer.validation } : null;
}

export async function loadDiagnostic(manifest, regionId, depth, name, baseUrl = '/hidden-rivers/data/') {
  const metadata = diagnosticMetadata(manifest, regionId, depth, name);
  if (!metadata) return null;
  const response = await fetch(`${baseUrl}${metadata.file}`);
  if (!response.ok) throw new Error(`Diagnostic ${name} could not be loaded (${response.status}).`);
  const buffer = await response.arrayBuffer();
  return decodeDiagnostic(metadata, buffer);
}

export function decodeDiagnostic(metadata, buffer) {
  const count = metadata.shape.reduce((product, n) => product * n, 1);
  if (buffer.byteLength !== count * 4) throw new Error('Diagnostic array length does not match its metadata.');
  const view = new DataView(buffer);
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = view.getFloat32(i * 4, true);
  return { ...metadata, values };
}

/** Nearest available start, with no temporal blending of different FTLE windows.
 * Returns null past the final supported start. The UI must display the returned
 * date, even if the particle animation's time falls between two daily snapshots.
 */
export function diagnosticFrame(field, seconds) {
  if (!field?.dates?.length || !Number.isFinite(seconds)) return null;
  const first = Date.parse(field.dates[0]);
  const offsets = field.dates.map(date => (Date.parse(date) - first) / 1000);
  if (seconds < 0 || seconds > offsets.at(-1)) return null;
  let index = 0;
  for (let i = 1; i < offsets.length; i++) if (Math.abs(offsets[i] - seconds) < Math.abs(offsets[index] - seconds)) index = i;
  return { index, date: field.dates[index], startSeconds: offsets[index],
    endDate: field.horizonHours ? new Date(first + (offsets[index] + field.horizonHours * 3600) * 1000).toISOString() : null,
    snapped: Math.abs(offsets[index] - seconds) > 0.001 };
}

export function sampleDiagnostic(field, longitude, latitude, frameIndex = 0) {
  if (!field?.values || !Number.isInteger(frameIndex)) return null;
  const [nt, ny, nx] = field.shape;
  const x = (longitude - field.lon0) / field.dlon;
  const y = (latitude - field.lat0) / field.dlat;
  if (!Number.isFinite(x + y) || frameIndex < 0 || frameIndex >= nt || x < 0 || y < 0 || x > nx - 1 || y > ny - 1) return null;
  const ix = Math.min(nx - 2, Math.floor(x)), iy = Math.min(ny - 2, Math.floor(y));
  const ax = x - ix, ay = y - iy, offset = frameIndex * nx * ny + iy * nx + ix;
  const values = [field.values[offset], field.values[offset + 1], field.values[offset + nx], field.values[offset + nx + 1]];
  if (!values.every(Number.isFinite)) return null;
  return values[0] * (1-ax) * (1-ay) + values[1] * ax * (1-ay) + values[2] * (1-ax) * ay + values[3] * ax * ay;
}
