import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../../src/scripts/hidden-rivers/tank-motion.mjs').catch(()=>({}));
test('resolved frames interpolate continuously without extrapolating physical fields',()=>{
  assert.equal(typeof module.createTankMotion,'function');const motion=module.createTankMotion();
  motion.push({diagnostics:{time:0}},0);motion.push({diagnostics:{time:.02}},20);
  assert.equal(motion.sample(20).mix,0);assert.equal(motion.sample(30).mix,.5);assert.equal(motion.sample(40).mix,1);assert.equal(motion.sample(500).mix,1);
  motion.push({diagnostics:{time:.04}},40);assert.equal(motion.sample(40).time,.02);assert.equal(motion.sample(50).time,.03);
});
test('pause freezes display time and reset discards the old plume',()=>{
  assert.equal(typeof module.createTankMotion,'function');const motion=module.createTankMotion();
  motion.push({diagnostics:{time:0}},0);motion.push({diagnostics:{time:.02}},20);
  motion.pause(30);assert.equal(motion.sample(100).time,.01);motion.resume(100);assert.equal(motion.sample(110).time,.02);
  motion.reset();assert.equal(motion.sample(120),null);motion.push({diagnostics:{time:0}},120);assert.equal(motion.sample(130).time,0);
});
test('a finer calculation with slow arrivals blends across its full frame interval',()=>{
 const motion=module.createTankMotion();motion.push({diagnostics:{time:0}},0);motion.push({diagnostics:{time:.04}},200);
 assert.equal(motion.sample(300).mix,.5);assert.ok(motion.sample(350).mix<1);assert.equal(motion.sample(400).mix,1);
});
test('physics can request its next batch on a worker reply without double-counting frame time',()=>{
 assert.equal(typeof module.createTankPacer,'function');const p=module.createTankPacer();
 assert.equal(p.request(0,1,true,true),0);assert.equal(p.request(25,1,true,true),2);
 assert.equal(p.request(40,1,true,false),0);assert.equal(p.request(45,1,true,true),2);
 assert.equal(p.request(44,1,true,true),0); // A RAF timestamp can precede an earlier callback.
 assert.equal(p.request(50,1,false,true),0);assert.equal(p.request(10000,1,true,true),0);
 assert.equal(p.request(10020,1,true,true),2);p.reset();assert.equal(p.request(20000,1,true,true),0);
});
