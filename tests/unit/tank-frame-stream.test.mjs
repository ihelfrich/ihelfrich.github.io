import test from 'node:test';
import assert from 'node:assert/strict';
import {createTankFrameStream} from '../../src/scripts/hidden-rivers/tank-frame-stream.mjs';
const frame=time=>({diagnostics:{time},volume:new Float32Array([time])});
test('new arrivals preserve the current computed endpoints and never extrapolate',()=>{
 const m=createTankFrameStream(),a=frame(0),b=frame(.04),c=frame(.08);m.push(a,0);m.push(b,100);
 const before=m.sample(150);m.push(c,150);const after=m.sample(150);
 assert.equal(after.previous,a);assert.equal(after.current,b);assert.equal(after.mix,before.mix);assert.equal(after.time,before.time);
 const later=m.sample(250);assert.equal(later.previous,b);assert.equal(later.current,c);assert.ok(later.time>=.04&&later.time<=.08);assert.equal(m.sample(9999).time,.08);
});
test('a slow fine-grid delivery keeps blending beyond half a second',()=>{
 const m=createTankFrameStream();m.push(frame(0),0);m.push(frame(.04),900);
 assert.ok(m.sample(1500).mix<1);assert.ok(m.sample(1500).mix>0);assert.ok(m.sample(1750).mix<1);
});
test('pause, bounded backlog and reset retain immutable frames and monotone time',()=>{
 const m=createTankFrameStream();m.push(frame(0),0);m.push(frame(.04),100);m.pause(130);const held=m.sample(1000).time;m.resume(1000);assert.equal(m.sample(1000).time,held);
 for(let i=2;i<15;i++)m.push(frame(i*.04),1000+i);assert.ok(m.getStats().queued<=3);
 let previous=held;for(let now=1000;now<3000;now+=8){const s=m.sample(now);assert.ok(s.time>=previous);assert.ok(s.time<=.56+1e-12);previous=s.time;}
 m.reset();assert.equal(m.sample(3000),null);const fresh=frame(0);m.push(fresh,3000);assert.equal(m.sample(3010).current,fresh);assert.equal(fresh.volume[0],0);
});
