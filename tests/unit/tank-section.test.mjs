import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTankSection } from '../../src/scripts/hidden-rivers/tank-section.mjs';

const grid = { nx: 2, ny: 2, nz: 2 };
const field = Float32Array.from({length:32}, (_, i) => i);

test('section samples the two adjacent z layers while preserving x/y/channel order', () => {
  const saved = field.slice();
  assert.deepEqual([...sampleTankSection(grid, field, .5)], Array.from({length:16}, (_, i) => i + 8));
  assert.deepEqual(field, saved);
});
test('section endpoints clamp to nearest cell centers and do not extrapolate', () => {
  assert.deepEqual(sampleTankSection(grid, field, 0), field.slice(0,16));
  assert.deepEqual(sampleTankSection(grid, field, 1), field.slice(16));
  assert.deepEqual([...sampleTankSection(grid, field, .375)], Array.from({length:16}, (_, i) => i + 4));
});
test('section rejects invalid planes and incompatible fields', () => {
  for (const fraction of [-.01, 1.01, NaN]) assert.throws(() => sampleTankSection(grid, field, fraction), RangeError);
  assert.throws(() => sampleTankSection(grid, field.slice(1), .5), RangeError);
});
