import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDyeTank3D} from '../../src/scripts/hidden-rivers/dye-tank-3d.mjs';
import {instantiateTankKernels} from '../../src/scripts/hidden-rivers/tank-3d-kernels.mjs';
import {createTankPacer} from '../../src/scripts/hidden-rivers/tank-motion.mjs';
const options={nx:16,ny:16,nz:16,width:.24,height:.24,depth:.24};
async function fixture(){const kernels=await instantiateTankKernels(await readFile('public/hidden-rivers/dye-tank/tank-kernels.wasm'));const tank=createDyeTank3D({...options,kernels});tank.drop({x:.12,y:.05,z:.12,radius:.025,salinity:36});return tank;}
function equal(a,b){for(const key of ['u','v','w','salinity','gold','coral'])assert.deepEqual(a[key],b[key],key);assert.equal(a.time,b.time);}
test('asynchronous momentum preserves pressure splitting and conservative scalar transport',async()=>{
 const a=await fixture(),b=await fixture();let calls=0;
 const accelerator={backend:'test-async-reference',async momentum(t,dt){await Promise.resolve();calls++;t.kernels.momentum(t,dt);}};
 for(let n=0;n<8;n++){a.step(.02);await b.stepAsync(.02,accelerator);}equal(a,b);assert.equal(calls,8);assert.equal(b.acceleration,'test-async-reference');
});
test('failed asynchronous momentum falls back without committing partial next buffers',async()=>{
 const a=await fixture(),b=await fixture();let calls=0,disposed=0;
 const accelerator={backend:'test-failure',async momentum(t){calls++;t.velocity[0].next.fill(NaN);throw new Error('Device lost');},dispose(){disposed++;}};
 for(let n=0;n<3;n++){a.step(.02);await b.stepAsync(.02,accelerator);}equal(a,b);assert.equal(calls,1);assert.equal(disposed,1);assert.equal(b.acceleration,'float64-wasm');assert.match(b.accelerationFallback,/Device lost/);
});
test('twenty-millisecond pacing preserves the requested physical clock',()=>{
 const p=createTankPacer({stepSeconds:.02});assert.equal(p.request(0,1,true,true),0);assert.equal(p.request(10,1,true,true),0);assert.equal(p.request(20,1,true,true),1);assert.equal(p.request(40,1,true,true),1);assert.equal(p.request(80,1,true,true),2);
});
