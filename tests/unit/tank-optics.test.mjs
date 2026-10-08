import test from 'node:test';
import assert from 'node:assert/strict';
import {dyeExtinctionPerMetre,integrateDyeTransmittance} from '../../src/scripts/hidden-rivers/tank-optics.mjs';
test('uniform dye obeys Beer–Lambert attenuation over a physical path',()=>{
 const expected=Math.exp(-dyeExtinctionPerMetre*.2*.04);
 for(const n of [4,8,32])assert.ok(Math.abs(integrateDyeTransmittance(new Float32Array(n).fill(.2),.04/n)-expected)<1e-7);
 assert.equal(integrateDyeTransmittance(new Float32Array(4),.01),1);
 assert.equal(integrateDyeTransmittance(new Float32Array(4).fill(1),0),1);
});
test('twice the path squares transmittance; no negative extinction is accepted',()=>{
 const t=integrateDyeTransmittance(new Float32Array(8).fill(.5),.002);
 assert.ok(Math.abs(integrateDyeTransmittance(new Float32Array(8).fill(.5),.004)-t*t)<1e-12);
 assert.throws(()=>integrateDyeTransmittance([-1],.01),RangeError);
 assert.throws(()=>integrateDyeTransmittance([1],NaN),RangeError);
});
