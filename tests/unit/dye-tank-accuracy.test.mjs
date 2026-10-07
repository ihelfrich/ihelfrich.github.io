import test from 'node:test';
import assert from 'node:assert/strict';
import {vortexDecay,tracerTranslation} from '../helpers/dye-tank-accuracy.mjs';
import {createDyeTank} from '../../src/scripts/hidden-rivers/dye-tank.mjs';
const density=await import('../../src/scripts/hidden-rivers/tank-seawater.mjs').catch(()=>({}));
test('density agrees with TEOS-10 at 10 °C, with Absolute Salinity in g/kg',()=>{
 assert.equal(typeof density.seawaterDensity,'function');
 for(const [salt,rho] of [[0,999.7024816906079],[24,1018.2921600741759],[30,1022.9434970098027],[35,1026.8258599850544],[40,1030.7140310876423]])assert.ok(Math.abs(density.seawaterDensity(salt)-rho)<.0005);
 assert.throws(()=>density.seawaterDensity(NaN));assert.throws(()=>density.seawaterDensity(-1));assert.throws(()=>density.seawaterDensity(41));
});
// Analytic Taylor-Green vortex: energy decays exp(−4νk²t); no manufactured curls.
test('resolved vortex circulation loses less than 0.5% excess energy at one second',()=>{
 const a=vortexDecay(64),b=vortexDecay(128);assert.ok(a.relativeEnergyError<.005,JSON.stringify(a));assert.ok(b.relativeEnergyError<a.relativeEnergyError);assert.ok(b.divergenceRms<1e-8);
});
test('dye translation stays bounded and conserved with less than 10% normalized L1 error',()=>{
 const a=tracerTranslation();assert.ok(a.relativeL1Error<.1,JSON.stringify(a));assert.ok(Math.abs(a.massResidual)<1e-12);assert.ok(a.min>=-1e-12&&a.max<=1);
});
test('glass walls dissipate tangential flow instead of imposing free slip',()=>{
 const a=createDyeTank({nx:32,ny:32,width:.24,height:.24,walls:'no-slip'}),b=createDyeTank({nx:32,ny:32,width:.24,height:.24,walls:'free-slip'});
 assert.equal(a.walls,'no-slip');assert.equal(b.walls,'free-slip');
 for(const tank of [a,b])for(let j=0;j<32;j++)for(let i=1;i<32;i++)tank.u[j*33+i]=.01;
 a.advectVelocity(.005);b.advectVelocity(.005);assert.ok(a.u[31*33+16]<b.u[31*33+16]);
 assert.equal(a.u[16],b.u[16],'The flat water surface has zero tangential stress');
 for(const tank of [a,b]){assert.equal(tank.u[0],0);assert.equal(tank.u[32],0);}
 assert.throws(()=>createDyeTank({walls:'invalid'}),/wall/i);
});
test('mixed pigments remain parts of the total dye and each pigment is conserved',()=>{
 const a=createDyeTank({nx:64,ny:64,height:.24});a.drop({x:.115,y:.09,salinity:36,radius:.009});a.drop({x:.125,y:.115,salinity:24,radius:.009});
 const total=a.integral(a.dye),coral=a.integral(a.coral);let excess=0;
 for(let n=0;n<250;n++){a.step();for(let k=0;k<a.dye.length;k++)excess=Math.max(excess,a.coral[k]-a.dye[k]);}
 assert.ok(excess<1e-12,`A pigment exceeded the total concentration by ${excess}`);
 assert.ok(Math.abs(a.integral(a.dye)-total)<1e-11);assert.ok(Math.abs(a.integral(a.coral)-coral)<1e-11);
});
