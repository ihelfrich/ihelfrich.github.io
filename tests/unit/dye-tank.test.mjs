import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../../src/scripts/hidden-rivers/dye-tank.mjs').catch(()=>({}));
const create = options => { assert.equal(typeof module.createDyeTank,'function','The browser fluid solver must exist');return module.createDyeTank(options); };
const fixture = (salinity=36,nx=48,dt=.01) => {
  const tank=create({nx,ny:nx*3/4,width:.24,height:.18,waterSalinity:30});
  tank.drop({x:.12,y:.09,radius:.009,salinity});for(let t=0;t<1.2-1e-9;t+=dt)tank.step(dt);return tank;
};
// Catches a decorative falling path, wrong buoyancy sign, leaking scalar flux, or failed projection.
test('salty and fresh drops move in opposite directions and create counter-rotating flow',()=>{
  const down=fixture(36),up=fixture(24),d=down.diagnostics(),u=up.diagnostics();
  assert.ok(d.dyeCentroid.y>.092,JSON.stringify(d));assert.ok(u.dyeCentroid.y<.088,JSON.stringify(u));
  assert.ok(Math.abs(d.dyeCentroid.y+u.dyeCentroid.y-.18)<2e-5);
  assert.ok(d.vorticityMin<-.1&&d.vorticityMax>.1);
  assert.ok(d.divergenceRms<1e-6);assert.ok(d.salinityMin>=30-1e-5&&d.salinityMax<=36+1e-5);
  assert.ok(Math.abs(d.saltIntegral-down.initialSaltIntegral-down.injectedSaltIntegral)<1e-10);
  assert.ok(Math.abs(d.dyeIntegral-down.injectedDyeIntegral)<1e-11);
});
// Catches density-independent animation and spurious motion in a neutral tank.
test('matching salinity leaves the water at rest while dye diffuses',()=>{
  const tank=fixture(30),d=tank.diagnostics();assert.ok(d.maxSpeed<1e-12);assert.ok(Math.abs(d.dyeCentroid.y-.09)<1e-12);assert.ok(d.dyeMax<1);
});
// Catches a hydrostatic pressure/boundary sign error.
test('a stable salt gradient remains hydrostatic without dye',()=>{
  const tank=create({nx:40,ny:30,width:.24,height:.18,waterSalinity:24,bottomSalinity:36});
  for(let n=0;n<40;n++)tank.step(.01);const d=tank.diagnostics();assert.ok(d.maxSpeed<1e-8);assert.ok(Math.abs(d.saltIntegral-tank.initialSaltIntegral)<1e-10);
});
// Catches any wall-clock/random forcing entering the canonical state.
test('an identical sequence of drops and timesteps replays exactly',()=>{
  const a=fixture(),b=fixture();assert.deepEqual(a.salinity,b.salinity);assert.deepEqual(a.u,b.u);assert.deepEqual(a.dye,b.dye);
});
// Catches invalid controls corrupting state or an unlimited timestep.
test('invalid controls are rejected before changing the tank',()=>{
  assert.throws(()=>create({waterSalinity:NaN}),/salinity/i);const tank=create({nx:32,ny:24});const before=tank.diagnostics();
  for(const args of [{x:-1,y:.1,salinity:35},{x:.1,y:.1,salinity:99},{x:.1,y:.1,salinity:35,radius:0}])assert.throws(()=>tank.drop(args),/drop/i);
  assert.throws(()=>tank.step(0),/timestep/i);assert.throws(()=>tank.step(1),/timestep/i);assert.deepEqual(tank.diagnostics(),before);
});
// Preregistered global moments at 1.2 s, same 9 mm drop, not pixel-wise agreement of vortices.
test('dye centroid is stable under timestep halving and finer grids',()=>{
  const coarse=fixture(36,48),medium=fixture(36,72),fine=fixture(36,96),half=fixture(36,72,.005);
  const m=medium.diagnostics().dyeCentroid.y,f=fine.diagnostics().dyeCentroid.y;
  assert.ok(Math.abs(coarse.diagnostics().dyeCentroid.y-f)<.003);
  assert.ok(Math.abs(m-f)<.002);assert.ok(Math.abs(m-half.diagnostics().dyeCentroid.y)<.001);
});
