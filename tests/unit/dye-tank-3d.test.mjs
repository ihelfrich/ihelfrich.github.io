import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../../src/scripts/hidden-rivers/dye-tank-3d.mjs').catch(()=>({}));
const create=options=>{assert.equal(typeof module.createDyeTank3D,'function','A genuine 3D model must exist');return module.createDyeTank3D(options);};
const cube={nx:16,ny:16,nz:16,width:.24,height:.24,depth:.24};
test('3D pressure projection closes all six walls, removes divergence and is idempotent',()=>{
 const a=create(cube);for(const c of a.velocity){const [nx,ny,nz]=c.shape;for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)c.data[(k*ny+j)*nx+i]=.01*Math.sin(i*1.31+j*.73+k*.91+c.axis);}
 a.project();assert.ok(a.diagnostics().divergenceRms<1e-8);const fields=a.velocity.map(c=>c.data.slice());a.project();
 a.velocity.forEach((c,n)=>{for(let i=0;i<c.data.length;i++)assert.ok(Math.abs(c.data[i]-fields[n][i])<1e-10);});
});
test('stratified saline layers remain hydrostatic, including sharp interfaces',()=>{
 const a=create({...cube,layers:[{bottom:.07,salinity:20},{bottom:.16,salinity:30},{bottom:.24,salinity:36}],transition:.002});for(let n=0;n<20;n++)a.step();const d=a.diagnostics();assert.ok(d.maxSpeed<1e-12);assert.ok(Math.abs(d.saltIntegral-a.initialSaltIntegral)<1e-12);assert.ok(a.salinity[0]<21&&a.salinity[15*16]>35);
});
test('spherical dye drops create 3D motion with conserved scalars and x-z symmetry',()=>{
 for(const [salt,sign] of [[36,1],[24,-1]]){const a=create(cube);a.drop({x:.12,y:.12,z:.12,radius:.025,salinity:salt});for(let n=0;n<30;n++)a.step();const d=a.diagnostics();assert.ok((d.dyeCentroid.y-.12)*sign>0);assert.ok(d.maxW>1e-6);assert.ok(d.divergenceRms<1e-8);assert.ok(Math.abs(d.saltIntegral-a.initialSaltIntegral-a.injectedSaltIntegral)<1e-12);assert.ok(Math.abs(d.dyeIntegral-a.injectedDyeIntegral)<1e-12);assert.ok(d.salinityMin>=Math.min(30,salt)-1e-6&&d.salinityMax<=Math.max(30,salt)+1e-6);assert.ok(Math.abs(d.dyeCentroid.x-.12)<1e-12&&Math.abs(d.dyeCentroid.z-.12)<1e-12);}
});
test('neutral dye, replay and invalid layer controls obey their contracts',()=>{
 const a=create(cube),b=create(cube);for(const q of[a,b]){q.drop({x:.1,y:.1,z:.12,radius:.025,salinity:30});for(let n=0;n<12;n++)q.step();}assert.equal(a.diagnostics().maxSpeed,0);assert.deepEqual(a.salinity,b.salinity);assert.deepEqual(a.gold,b.gold);const before=a.salinity.slice();assert.throws(()=>a.drop({x:.1,y:.1,z:NaN,salinity:35}));assert.deepEqual(a.salinity,before);assert.throws(()=>create({...cube,layers:[{bottom:.2,salinity:20},{bottom:.1,salinity:35}]}));
});
