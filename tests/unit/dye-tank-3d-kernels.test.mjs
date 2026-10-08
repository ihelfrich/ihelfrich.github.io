import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
test('Float64 WebAssembly kernels agree with the independent JavaScript 3D reference',async()=>{
 const module=await import('../../src/scripts/hidden-rivers/tank-3d-kernels.mjs').catch(()=>({}));assert.equal(typeof module.instantiateTankKernels,'function');
 const kernels=await module.instantiateTankKernels(await readFile('public/hidden-rivers/dye-tank/tank-kernels.wasm'));
 const options={nx:16,ny:16,nz:16,width:.24,height:.24,depth:.24};const a=createDyeTank3D(options),b=createDyeTank3D({...options,kernels});
 for(const tank of[a,b]){tank.drop({x:.11,y:.07,z:.14,radius:.025,salinity:36});tank.drop({x:.14,y:.16,z:.08,radius:.025,salinity:24});for(let n=0;n<12;n++)tank.step();}
 assert.equal(b.acceleration,'float64-wasm');for(const name of['u','v','w','salinity','gold','coral']){let error=0;for(let i=0;i<a[name].length;i++)error=Math.max(error,Math.abs(a[name][i]-b[name][i]));assert.ok(error<1e-11,`${name}: ${error}`);}assert.ok(b.diagnostics().divergenceRms<1e-8);
});
test('incremental pressure splitting preserves analytic vortex decay and improves with grid refinement',async()=>{
 const {instantiateTankKernels}=await import('../../src/scripts/hidden-rivers/tank-3d-kernels.mjs');
 const kernels=await instantiateTankKernels(await readFile('public/hidden-rivers/dye-tank/tank-kernels.wasm'));
 const errors=[];
 for(const n of [32,64]){
  kernels.reset();const t=createDyeTank3D({nx:n,ny:n,nz:32,width:.24,height:.24,depth:.24,walls:'free-slip',kernels}),k=Math.PI/.24,a=.01;
  for(let z=0;z<32;z++)for(let y=0;y<n;y++)for(let x=0;x<=n;x++)t.u[(z*n+y)*(n+1)+x]=a*Math.sin(k*x*t.dx)*Math.cos(k*(y+.5)*t.dy);
  for(let z=0;z<32;z++)for(let y=0;y<=n;y++)for(let x=0;x<n;x++)t.v[(z*(n+1)+y)*n+x]=-a*Math.cos(k*(x+.5)*t.dx)*Math.sin(k*y*t.dy);
  t.project();const energy=()=>t.velocity.reduce((sum,c)=>{for(const v of c.data)sum+=v*v;return sum;},0);
  const initial=energy();for(let step=0;step<30;step++)t.step(.01);
  errors.push(Math.abs(energy()/(initial*Math.exp(-4*t.viscosity*k*k*.3))-1));assert.ok(t.diagnostics().divergenceRms<1e-8);
 }
 assert.ok(errors[0]<.01);assert.ok(errors[1]<errors[0],`32³ and 64×64×32 energy errors: ${errors}`);
});
