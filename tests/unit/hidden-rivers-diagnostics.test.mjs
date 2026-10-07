import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeDiagnostic, diagnosticFrame, sampleDiagnostic } from '../../src/scripts/hidden-rivers/diagnostics.mjs';

test('little-endian diagnostics retain masks and reject incomplete downloads', () => {
  const metadata = {shape:[1,2,2],lon0:10,lat0:-40,dlon:1,dlat:1};
  const buffer = new ArrayBuffer(16), view = new DataView(buffer);
  [1,3,5,7].forEach((n,i)=>view.setFloat32(i*4,n,true));
  const field = decodeDiagnostic(metadata,buffer);
  assert.equal(sampleDiagnostic(field,10.5,-39.5),4);
  assert.equal(sampleDiagnostic(field,11,-39),7);
  field.values[0]=NaN;
  assert.equal(sampleDiagnostic(field,10.5,-39.5),null);
  assert.equal(sampleDiagnostic(field,9,-40),null);
  assert.throws(()=>decodeDiagnostic(metadata,new ArrayBuffer(12)),/length/);
});

test('FTLE dates denote full valid integration windows and never extrapolate', () => {
  const field={dates:['2026-09-29T00:00:00Z','2026-09-30T00:00:00Z','2026-10-01T00:00:00Z','2026-10-02T00:00:00Z'],horizonHours:48};
  assert.equal(diagnosticFrame(field,86400).endDate,'2026-10-02T00:00:00.000Z');
  assert.equal(diagnosticFrame(field,86000).snapped,true);
  assert.equal(diagnosticFrame(field,4*86400),null);
  assert.equal(diagnosticFrame(field,-1),null);
});

import { sampleVelocity, timeOffsets } from '../../src/scripts/hidden-rivers/field.mjs';
test('velocity interpolation respects actual three-hour and irregular timestamps', () => {
  const layer={shape:[3,2,2],values:new Int16Array([...Array(4).fill(1000),...Array(4).fill(2000),...Array(4).fill(4000),...Array(12).fill(0)]),dates:['2026-09-29T00:00:00Z','2026-09-29T03:00:00Z','2026-09-29T09:00:00Z']};
  assert.deepEqual(timeOffsets(layer),[0,10800,32400]);
  assert.deepEqual(sampleVelocity(layer,.5,.5,5400),[1.5,0]);
  assert.deepEqual(sampleVelocity(layer,.5,.5,21600),[3,0]);
  assert.deepEqual(sampleVelocity(layer,.5,.5,32400),[4,0]);
  assert.equal(sampleVelocity(layer,.5,.5,40000),null);
});
