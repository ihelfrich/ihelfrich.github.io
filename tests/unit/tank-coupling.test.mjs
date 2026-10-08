import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {instantiateTankKernels} from '../../src/scripts/hidden-rivers/tank-3d-kernels.mjs';
import {smoothCouplingTank,initialScalarAcceleration,rmsDifference} from '../helpers/tank-coupling.mjs';

test('acceleration from rest transports salinity with the analytic half-step coefficient',()=>{
 const t=smoothCouplingTank(),S=t.salinity.slice(),L=initialScalarAcceleration(t),dt=.02;
 t.step(dt);let numerator=0,denominator=0;
 for(let i=0;i<S.length;i++){numerator+=(t.salinity[i]-S[i])*L[i];denominator+=L[i]*L[i];}
 const coefficient=numerator/(dt*dt*denominator);
 assert.ok(coefficient>.49&&coefficient<.51,JSON.stringify({coefficient,expected:.5}));
 assert.ok(Math.abs(t.integral(t.salinity)-t.initialSaltIntegral)<1e-12);
 assert.ok(Math.abs(t.integral(t.gold)-t.injectedDyeIntegral)<1e-12);
 assert.ok(t.diagnostics().divergenceRms<1e-8);
});
test('smooth salinity and dye have second-order temporal self-convergence',async()=>{
 const kernels=await instantiateTankKernels(await readFile('public/hidden-rivers/dye-tank/tank-kernels.wasm')),runs=[];
 for(const dt of [.02,.01,.005,.0025]){
  kernels.reset();const t=smoothCouplingTank(kernels);for(let n=0;n<Math.round(.3/dt);n++)t.step(dt);
  runs.push({salinity:t.salinity.slice(),gold:t.gold.slice()});
 }
 for(const field of ['salinity','gold']){
  const errors=runs.slice(0,-1).map((r,i)=>rmsDifference(r[field],runs[i+1][field]));
  for(let i=0;i<2;i++){const ratio=errors[i]/errors[i+1];assert.ok(ratio>3.5&&ratio<4.5,JSON.stringify({field,errors,ratio}));}
 }
});
