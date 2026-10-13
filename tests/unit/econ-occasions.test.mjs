import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,recordAnswer,progress,selectItem} from '../../src/lib/econ-practice/adaptive.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';

test('assessment estimates and counts use the requested occasion rather than a lifetime pool',()=>{
 const items=buildBank().filter(q=>q.course==='ap-micro'&&q.unit===1&&q.format==='numeric');
 const first=items[0],second=items.find(q=>q.family!==first.family),state=newState();
 recordAnswer(state,first,{response:first.answer,mode:'assessment',sessionId:'earlier',eventId:'one',at:1});
 const before=progress(state,'ap-micro',{sessionId:'later'})[0];assert.equal(before.attempts,0);assert.equal(before.estimate,null);assert.equal(before.measurementStatus,'no-eligible-evidence');
 recordAnswer(state,second,{response:second.answer+100,mode:'assessment',sessionId:'later',eventId:'two',at:2});
 const old=progress(state,'ap-micro',{sessionId:'earlier'})[0],now=progress(state,'ap-micro',{sessionId:'later'})[0];
 assert.equal(old.attempts,1);assert.equal(old.correct,1);assert.equal(now.attempts,1);assert.equal(now.correct,0);assert.equal(now.measurementResponses,1);
 const isolated=newState();recordAnswer(isolated,second,{response:second.answer+100,mode:'assessment',sessionId:'later',eventId:'two',at:2});
 assert.deepEqual(now.estimate,progress(isolated,'ap-micro',{sessionId:'later'})[0].estimate);
 const options={course:'ap-micro',mode:'assessment',unit:1,sessionId:'later',rng:()=>.4};
 const unseen=items.filter(q=>q.family!==first.family);assert.deepEqual(selectItem(unseen,state,options),selectItem(unseen,isolated,options));
});

test('occasion separation does not turn previously practiced families into fresh IRT evidence',()=>{
 const item=buildBank().find(q=>q.format==='numeric'),state=newState();
 recordAnswer(state,item,{response:item.answer,sessionId:'practice',eventId:'one'});
 recordAnswer(state,item,{response:item.answer,mode:'assessment',sessionId:'diagnostic',eventId:'two'});
 const unit=progress(state,item.course,{sessionId:'diagnostic'})[item.unit-1];assert.equal(unit.attempts,1);assert.equal(unit.measurementResponses,0);assert.equal(unit.estimate,null);assert.equal(unit.measurementStatus,'no-eligible-evidence');
});

test('reports distinguish authored estimates from calibrated evidence and suppress unlinked model mixtures',()=>{
 const candidates=buildBank().filter(q=>q.course==='ap-micro'&&q.unit===1&&q.format==='numeric'),a=candidates[0],b=candidates.find(q=>q.family!==a.family),state=newState();
 recordAnswer(state,a,{response:a.answer,mode:'assessment',sessionId:'one',eventId:'a'});
 const seeded=progress(state,'ap-micro',{sessionId:'one'})[0];assert.equal(seeded.measurementStatus,'provisional');assert.deepEqual(seeded.modelVersions,['author-seeded-rasch-v1']);assert.ok(seeded.estimate);
 const calibration={status:'approved',bankVersion:b.version,id:'synthetic-test-model',items:{[b.id]:{a:1,b:0}}};
 const before=structuredClone(state);
 assert.throws(()=>recordAnswer(state,b,{response:b.answer,mode:'assessment',sessionId:'one',eventId:'b',calibration}),/model changed/);assert.deepEqual(state,before);
 assert.throws(()=>selectItem([b],state,{course:'ap-micro',mode:'assessment',sessionId:'one',calibration}),/model changed/);
 // A legacy or externally supplied mixed history remains explicitly unreportable.
 state.history.push({...state.history[0],eventId:'legacy-mixed',modelVersion:calibration.id});
 const mixed=progress(state,'ap-micro',{sessionId:'one'})[0];assert.equal(mixed.measurementStatus,'incompatible-model-versions');assert.equal(mixed.estimate,null);
 const clean=newState();recordAnswer(clean,b,{response:b.answer,mode:'assessment',sessionId:'two',eventId:'c',calibration});
 assert.equal(progress(clean,'ap-micro',{sessionId:'two'})[0].measurementStatus,'calibrated');
});

test('diagnostics prefer fresh families without violating unit coverage or preventing an exhausted-bank attempt',()=>{
 const q=buildBank().find(q=>q.format==='numeric'),a={...q,id:'a',family:'a',unit:1},b={...q,id:'b',family:'b',unit:1},c={...q,id:'c',family:'c',unit:2},state=newState();
 recordAnswer(state,a,{response:a.answer,sessionId:'prior',eventId:'one'});
 const fresh=selectItem([a,b,c],state,{mode:'assessment',unit:1,sessionId:'now',rng:()=>0});assert.equal(fresh.item.id,'b');assert.equal(fresh.selection.exposureStatus,'fresh-family');assert.equal(fresh.selection.eligibleItems,1);
 const fallback=selectItem([a,c],state,{mode:'assessment',unit:1,sessionId:'now',rng:()=>0});assert.equal(fallback.item.id,'a');assert.equal(fallback.selection.exposureStatus,'previously-exposed-family');
 const shown=selectItem([a,b],newState(),{mode:'assessment',unit:1,sessionId:'now',rng:()=>0,exposedFamilies:['a']});assert.equal(shown.item.id,'b');
 recordAnswer(state,b,{response:b.answer,mode:'assessment',sessionId:'now',eventId:'two'});
 const uncovered=selectItem([a,b,c],state,{mode:'assessment',sessionId:'now',rng:()=>0,exposedFamilies:['c']});assert.equal(uncovered.item.unit,2);assert.equal(uncovered.selection.exposureStatus,'previously-exposed-family');
});
