/** Read-only interpolation of a cell-centered RGBA field onto a physical z plane. */
export function sampleTankSection({nx,ny,nz}, field, fraction) {
  if (![nx,ny,nz].every(n => Number.isInteger(n) && n > 0) ||
      !(field instanceof Float32Array) || field.length !== nx*ny*nz*4 ||
      !Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError('A compatible RGBA field and section fraction from 0 to 1 are required');
  }
  const z = Math.max(0, Math.min(nz-1, fraction*nz-.5));
  const lower = Math.floor(z), upper = Math.min(nz-1, lower+1), mix = z-lower;
  const count = nx*ny*4, result = new Float32Array(count);
  for (let i=0; i<count; i++) {
    const a = field[lower*count+i];
    result[i] = a + (field[upper*count+i]-a)*mix;
  }
  return result;
}
