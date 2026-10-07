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
