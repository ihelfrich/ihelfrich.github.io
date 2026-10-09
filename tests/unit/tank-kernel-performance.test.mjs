import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
import {instantiateTankKernels} from '../../src/scripts/hidden-rivers/tank-3d-kernels.mjs';

const wasmPath=process.env.TANK_KERNEL_PERF_WASM||'public/hidden-rivers/dye-tank/tank-kernels.wasm';
const maxError=(a,b)=>{let error=0;for(let i=0;i<a.length;i++)error=Math.max(error,Math.abs(a[i]-b[i]));return error;};
const independentlyPrepare=t=>{
 for(const c of t.velocity){const [a,b,e]=c.shape;for(let k=0;k<e;k++)for(let j=0;j<b;j++)for(let i=0;i<a;i++)if([i,j,k][c.axis]===0||[i,j,k][c.axis]===c.shape[c.axis]-1)c.data[(k*b+j)*a+i]=0;}
 const rhs=new Float64Array(t.rhs.length);t.divergence(rhs);let mean=0;for(const r of rhs)mean+=r/rhs.length;for(let i=0;i<rhs.length;i++)rhs[i]=-rhs[i]+mean;return rhs;
};

test('projection bookkeeping and extrema wrappers exist before numerical integration',async()=>{
 const kernels=await instantiateTankKernels(await readFile(wasmPath));
 for(const name of ['projectionPrepare','projectionFinish','extrema'])assert.equal(typeof kernels[name],'function',`${name} is required`);
});

test('Float64 projection bookkeeping matches independent closed-wall loops',async()=>{
 const kernels=await instantiateTankKernels(await readFile(wasmPath));
 for(const [nx,ny,nz] of [[16,16,16],[32,16,32],[64,32,16]]){
  kernels.reset();const options={nx,ny,nz,width:.24,height:.18,depth:.20};
  const reference=createDyeTank3D(options),candidate=createDyeTank3D({...options,kernels});
  for(let axis=0;axis<3;axis++)for(let i=0;i<reference.velocity[axis].data.length;i++){
   const value=.002*Math.sin(.113*i+.71*axis)+.0003*Math.cos(.037*i-.2*axis);
   reference.velocity[axis].data[i]=candidate.velocity[axis].data[i]=value;
  }
  const prepared=independentlyPrepare(reference);
  kernels.projectionPrepare(candidate);
  assert.ok(maxError(prepared,candidate.rhs)<=1e-15,`${nx}×${ny}×${nz} prepared rhs`);
  for(const name of ['u','v','w'])assert.ok(maxError(reference[name],candidate[name])===0,`${name} normal walls`);
  candidate.solvePressure=reference.solvePressure;
  reference.project();candidate.solvePressure(candidate.rhs,candidate.phi);kernels.projectionFinish(candidate);
  for(const name of ['u','v','w','rhs'])assert.ok(maxError(reference[name],candidate[name])<=1e-15,`${nx}×${ny}×${nz} ${name}`);
  assert.ok(Math.abs(reference.projectionResidual-candidate.projectionResidual)<=1e-15);
  assert.ok(candidate.projectionResidual<1e-8);
  reference.project();kernels.projectionPrepare(candidate);candidate.solvePressure(candidate.rhs,candidate.phi);kernels.projectionFinish(candidate);
  assert.ok(candidate.projectionResidual<1e-8,'already projected field');
  for(const name of ['u','v','w'])assert.ok(maxError(reference[name],candidate[name])<=1e-15,`idempotent ${name}`);
 }
});

test('extrema match ordered JS scans and nonfinite projection remains a hard error',async()=>{
 const kernels=await instantiateTankKernels(await readFile(wasmPath));kernels.reset();
 const t=createDyeTank3D({nx:16,ny:32,nz:16,kernels});
 for(let axis=0;axis<3;axis++)for(let i=0;i<t.velocity[axis].data.length;i++)t.velocity[axis].data[i]=.04*Math.sin(i*.017+axis);
 for(let i=0;i<t.salinity.length;i++)t.salinity[i]=20+16*Math.sin(i*.013);
 const expected={umax:0,vmax:0,wmax:0,smin:40,smax:0};
 for(const a of t.u)expected.umax=Math.max(expected.umax,Math.abs(a));
 for(const a of t.v)expected.vmax=Math.max(expected.vmax,Math.abs(a));
 for(const a of t.w)expected.wmax=Math.max(expected.wmax,Math.abs(a));
 for(const a of t.salinity){expected.smin=Math.min(expected.smin,a);expected.smax=Math.max(expected.smax,a);}
 assert.deepEqual(kernels.extrema(t),expected);
 t.u[11]=NaN;assert.throws(()=>kernels.extrema(t),/nonfinite|Flow exceeds/i);t.u[11]=0;
 t.salinity[17]=Infinity;assert.throws(()=>kernels.extrema(t),/nonfinite|Flow exceeds/i);t.salinity[17]=30;
 kernels.projectionPrepare(t);t.phi.fill(0);t.phi[0]=NaN;
 assert.throws(()=>kernels.projectionFinish(t),/pressure did not converge/i);
});

test('a complete Float64 step agrees when projection bookkeeping uses WASM',async()=>{
 const kernels=await instantiateTankKernels(await readFile(wasmPath));kernels.reset();
 const options={nx:16,ny:16,nz:16,width:.24,height:.18,depth:.20};
 const reference=createDyeTank3D(options),candidate=createDyeTank3D({...options,kernels});
 candidate.project=()=>{kernels.projectionPrepare(candidate);candidate.solvePressure(candidate.rhs,candidate.phi);kernels.projectionFinish(candidate);};
 for(const t of [reference,candidate]){t.drop({x:.115,y:.045,z:.095,radius:.022,salinity:36});for(let i=0;i<4;i++)t.step(.01);}
 for(const name of ['u','v','w','salinity','gold','coral'])assert.ok(maxError(reference[name],candidate[name])<1e-11,`${name} complete step`);
 assert.ok(candidate.projectionResidual<1e-8);
});
