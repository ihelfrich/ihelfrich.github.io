import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionActions,loadCurrentHint} from '../../src/scripts/econ-session-actions.mjs';
test('navigation ignores competing actions and releases its lock after failure',async()=>{
 let busy=false,resolve,count=0,error;const run=createSessionActions({isBusy:()=>busy,setBusy:v=>busy=v,onError:e=>error=e});
 const pending=run(()=>new Promise(r=>{resolve=r;count++;}));assert.equal(busy,true);assert.equal(await run(async()=>count++),false);assert.equal(count,1);resolve();assert.equal(await pending,true);assert.equal(busy,false);
 assert.equal(await run(async()=>{throw new Error('offline');}),false);assert.equal(error.message,'offline');assert.equal(busy,false);assert.equal(await run(async()=>count++),true);
});
test('late hint success and failure cannot overwrite another question',async()=>{
 for(const reject of [false,true]){let current='old',settle,shown=false,error=false;const pending=loadCurrentHint({presentationId:'old',request:()=>new Promise((resolve,fail)=>settle=()=>reject?fail(new Error('late')):resolve({hint:'old hint'})),isCurrent:id=>id===current,show:()=>shown=true,onError:()=>error=true});current='new';settle();await pending;assert.equal(shown,false);assert.equal(error,false);}
});
