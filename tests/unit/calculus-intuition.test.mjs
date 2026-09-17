import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,byId} from '../../src/lib/calculus.mjs';
import {intuition,intuitionStory} from '../../src/lib/calculus-intuition.mjs';
const story=(id,changes)=>{const p={...byId[id].defaults,...changes};return intuitionStory(id,p,calculate(id,p));};

test('intuition keeps negative local response separate from positive finite change across the chain minimum',()=>{
 const p={x:-.1,h:.5},r=calculate('chain',p),copy=story('chain',p);
 assert.ok(r.slope<0&&r.actual>0);
 assert.match(copy.steps[2].value,/^-/);
 assert.match(copy.steps[2].explanation,/actual final change is \+/);
 assert.match(copy.note,/local response/);
});
test('log stories preserve equal ratios, distinguish scale changes, and expose finite approximation error',()=>{
 const a=story('logs',{x:2,pct:100}),b=story('logs',{x:4,pct:100});
 assert.equal(a.steps[1].value,b.steps[1].value);
 assert.notEqual(a.steps[1].value,a.steps[2].value);
 assert.equal(story('logs',{base:2,pct:100}).steps[1].value,'+1');
 assert.match(story('logs',{base:2}).note,/rescaled/);
});
test('plain-language edge cases do not confuse a saddle, a corner, or signed accumulation',()=>{
 assert.match(story('slope',{fn:'abs',x:0}).note,/disagree/);
 assert.match(story('gradient',{shape:'saddle',x:0,y:0}).note,/saddle/);
 assert.match(story('gradient',{shape:'bowl',x:0,y:0}).note,/minimum/);
 assert.match(story('integral',{x:-1}).note,/negative.*reverse/);
 assert.match(story('partials',{dy:0}).note,/Workers stay fixed/);
 assert.match(story('optimize',{x:6,c:3}).note,/little less/);
 for(const id of Object.keys(intuition))assert.equal(intuition[id].answers.length,byId[id].answers.length);
});
