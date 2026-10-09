import test from 'node:test';import assert from 'node:assert/strict';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
test('a single diagnostic scan packs exact display fields without changing canonical state',()=>{
 const t=createDyeTank3D({nx:16,ny:16,nz:16});t.drop();t.u.fill(.003);t.v.fill(-.002);t.w.fill(.001);
 const before=t.diagnostics(),S=t.salinity.slice(),U=t.u.slice(),volume=new Float32Array(16**3*4),d=t.diagnostics(volume);
 for(let k=0;k<t.nz;k++)for(let j=0;j<t.ny;j++)for(let i=0;i<t.nx;i++){const q=(k*t.ny+j)*t.nx+i;assert.deepEqual(Array.from(volume.subarray(4*q,4*q+4)),Array.from(Float32Array.of(t.gold[q],t.coral[q],t.salinity[q]/40,Math.hypot(.003,-.002,.001))));}
 assert.deepEqual(d,before);assert.deepEqual(t.salinity,S);assert.deepEqual(t.u,U);assert.deepEqual(t.snapshot().volume,volume);
});
