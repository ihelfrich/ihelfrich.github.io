import test from 'node:test';
import assert from 'node:assert/strict';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
const create=()=>createDyeTank3D({nx:16,ny:16,nz:16,width:.24,height:.24,depth:.24,viscosity:0,diffusivity:0});
test('adaptive steps divide a requested interval without a tiny last remainder',()=>{
 const t=create();t.u.fill(.25*t.dx/.0100003);
 assert.equal(t.substepLimit(.02),.01);
});
test('a harmless fractional request does not indicate an unstable physical flow',()=>{
 const t=create();assert.equal(t.substepLimit(5e-7),5e-7);
 t.u.fill(1e9);assert.throws(()=>t.substepLimit(.02),/exceeds the 3D grid/);
});
