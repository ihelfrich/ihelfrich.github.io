import test from 'node:test';import assert from 'node:assert/strict';
import {createTankRenderBudget} from '../../src/scripts/hidden-rivers/tank-render-budget.mjs';
test('drawing follows 60 and 120 Hz cadence, and a slow GPU reduces only drawing scale',()=>{
 for(const hz of [60,120]){const b=createTankRenderBudget();for(let n=0;n<50;n++)b.frame(n*1000/hz);assert.ok(Math.abs(b.getStats().targetFps-hz)<1);for(let n=0;n<40;n++)b.cost(28);assert.ok(b.getStats().scale<1);assert.ok(b.getStats().scale>=.45);assert.ok(Math.abs(b.getStats().targetFps-hz)<1);}
});
test('budgets 144 Hz and faster screens using their measured interval',()=>{
 for(const hz of [144,165,240]){const b=createTankRenderBudget();for(let n=0;n<120;n++)b.frame(n*1000/hz);assert.ok(Math.abs(b.getStats().targetFps-hz)<1);}
 const b=createTankRenderBudget();for(let n=0;n<120;n++)b.frame(n*1000/240);for(let n=0;n<12;n++)b.cost(7);assert.ok(b.getStats().scale<1);
});
test('reset discards stale drawing cost and restores full drawing detail',()=>{
 const b=createTankRenderBudget();for(let n=0;n<12;n++)b.cost(28);assert.ok(b.getStats().scale<1);b.reset();assert.equal(b.getStats().scale,1);assert.equal(b.getStats().gpuDrawMs,null);
});
