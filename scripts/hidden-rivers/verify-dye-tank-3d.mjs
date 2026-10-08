import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
import {instantiateTankKernels} from '../../src/scripts/hidden-rivers/tank-3d-kernels.mjs';

// Acceptance thresholds were registered before the implementation.
const binary=await readFile('public/hidden-rivers/dye-tank/tank-kernels.wasm');
const kernels=await instantiateTankKernels(binary),results={};
const create=options=>{kernels.reset();return createDyeTank3D({...options,kernels});};
const cube={width:.24,height:.24,depth:.24};
const hash=b=>createHash('sha256').update(b).digest('hex');
function advance(t,duration,dt=.01){for(let n=0;n<Math.round(duration/dt);n++)t.step(dt);}
function conservation(t){const d=t.diagnostics(),salt=Math.abs(d.saltIntegral-t.initialSaltIntegral-t.injectedSaltIntegral),dye=Math.abs(d.dyeIntegral-t.injectedDyeIntegral);assert.ok(salt<1e-12&&dye<1e-12,`scalar ledger ${salt}, ${dye}`);assert.ok(d.divergenceRms<1e-8);return {...d,saltLedgerResidual:salt,dyeLedgerResidual:dye};}

results.projection=[];
for(const n of [16,32]){
 const t=create({...cube,nx:n,ny:n,nz:n});
 for(const c of t.velocity){const [nx,ny,nz]=c.shape;for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)c.data[(k*ny+j)*nx+i]=.01*Math.sin(i*1.31+j*.73+k*.91+c.axis);}
 t.project();const divergence=t.diagnostics().divergenceRms,fields=t.velocity.map(c=>c.data.slice());t.project();let error=0;
 t.velocity.forEach((c,a)=>{for(let i=0;i<c.data.length;i++)error=Math.max(error,Math.abs(c.data[i]-fields[a][i]));});
 assert.ok(divergence<1e-8&&error<1e-10);results.projection.push({grid:[n,n,n],divergenceRms:divergence,idempotenceMaxError:error});
}

results.rest=[];
for(const transition of [0,.008]){
 const t=create({nx:32,ny:32,nz:32,layers:[{bottom:.04,salinity:0},{bottom:.09,salinity:20},{bottom:.13,salinity:30},{bottom:.18,salinity:40}],transition});advance(t,.3);const d=conservation(t);assert.ok(d.maxSpeed<1e-12);results.rest.push({transition,...d});
}
const neutral=create({...cube,nx:32,ny:32,nz:32});neutral.drop({x:.12,y:.12,z:.12,radius:.014,salinity:30});advance(neutral,.3);results.neutral=conservation(neutral);assert.ok(results.neutral.maxSpeed<1e-12);

function plume(grid,salinity=36,dt=.01,radius=.014){
 const t=create({...cube,nx:grid[0],ny:grid[1],nz:grid[2]});t.drop({x:.12,y:.045,z:.12,radius,salinity});const started=performance.now();advance(t,.3,dt);const d=conservation(t);
 assert.ok(d.maxW>1e-6);assert.ok((d.dyeCentroid.y-.045)*Math.sign(salinity-30)>0);assert.ok(Math.abs(d.dyeCentroid.x-.12)<1e-12&&Math.abs(d.dyeCentroid.z-.12)<1e-12);
 assert.ok(d.salinityMin>=Math.min(30,salinity)-1e-6&&d.salinityMax<=Math.max(30,salinity)+1e-6);assert.ok(d.dyeMin>=-1e-9&&d.dyeMax<=1+1e-9);
 return {...d,requestedDt:dt,wallMilliseconds:performance.now()-started};
}
results.grid=[[32,32,32],[64,32,32],[64,64,64]].map(grid=>plume(grid));
results.gridCentroidDifference=Math.max(...results.grid.map(d=>d.dyeCentroid.y))-Math.min(...results.grid.map(d=>d.dyeCentroid.y));assert.ok(results.gridCentroidDifference<.007);
results.halfTimestep=plume([32,32,32],36,.005);results.timestepCentroidDifference=Math.abs(results.halfTimestep.dyeCentroid.y-results.grid[0].dyeCentroid.y);assert.ok(results.timestepCentroidDifference<.001);
results.extremes=[0,40].map(s=>({dropSalinity:s,...plume([32,32,32],s,.01,.025)}));

function vortex(nx,ny,nz){
 const t=create({...cube,nx,ny,nz,walls:'free-slip'}),a=.01,k=Math.PI/.24;
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<=nx;x++)t.u[(z*ny+y)*(nx+1)+x]=a*Math.sin(k*x*t.dx)*Math.cos(k*(y+.5)*t.dy);
 for(let z=0;z<nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<nx;x++)t.v[(z*(ny+1)+y)*nx+x]=-a*Math.cos(k*(x+.5)*t.dx)*Math.sin(k*y*t.dy);
 t.project();const energy=()=>{let e=0;for(const c of t.velocity)for(const v of c.data)e+=v*v;return .5*e*t.dx*t.dy*t.dz;};
 const initial=energy();advance(t,.3);const analytic=initial*Math.exp(-4*t.viscosity*k*k*.3),observed=energy();return {grid:[nx,ny,nz],initialEnergy:initial,analyticEnergy:analytic,observedEnergy:observed,relativeError:Math.abs(observed/analytic-1),divergenceRms:t.diagnostics().divergenceRms};
}
results.taylorGreen=[vortex(32,32,32),vortex(64,64,32)];
assert.ok(results.taylorGreen[0].relativeError<.01,JSON.stringify(results.taylorGreen));assert.ok(results.taylorGreen[1].relativeError<results.taylorGreen[0].relativeError,JSON.stringify(results.taylorGreen));

const manifest={model:'salinity-dye-tank-3d-v5-reference',generatedAt:new Date().toISOString(),passed:true,canonicalArithmetic:'Float64',solverSourceSha256:hash(await readFile('src/scripts/hidden-rivers/dye-tank-3d.mjs')),pressureSourceSha256:hash(await readFile('src/scripts/hidden-rivers/tank-pressure.mjs')),kernelSourceSha256:hash(await readFile('src/scripts/hidden-rivers/tank-3d-kernels.c')),kernelBinarySha256:hash(binary),modelRegisterSha256:hash(await readFile('docs/hidden-rivers/dye-tank-3d-model.md')),runtime:process.version,checks:results,scope:'Selected global quantities, conservation, incompressibility, hydrostatics, density response and one analytic viscous limit for the Float64 reference backend. GPU and 0.02 s requests are checked separately in verification-gpu.json. Not a validation of 3D turbulent morphology, physical entrainment rates, lab observations or measured ocean currents.'};
await writeFile('public/hidden-rivers/dye-tank/verification-3d.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile('public/hidden-rivers/dye-tank/model-3d.md','Current delivery is version 5. The browser schedules 0.02 s requests with the stability substeps below; optional GPU momentum uses Float32 while pressure, density and scalar transfers remain Float64. See [the GPU extension](model-gpu.md) and [its comparisons](verification-gpu.json). The original version-4 register below records the Float64 equations and preregistered reference fixtures, which remain in use.\n\n'+await readFile('docs/hidden-rivers/dye-tank-3d-model.md','utf8'));
console.log(JSON.stringify({passed:true,gridCentroidDifferenceMillimeters:results.gridCentroidDifference*1000,timestepCentroidDifferenceMillimeters:results.timestepCentroidDifference*1000,taylorGreenEnergyError:results.taylorGreen.map(d=>d.relativeError),maxSaltLedgerResidual:Math.max(...results.grid.map(d=>d.saltLedgerResidual)),maxDyeLedgerResidual:Math.max(...results.grid.map(d=>d.dyeLedgerResidual))},null,2));
