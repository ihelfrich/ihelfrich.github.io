import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,recordAnswer,progress,selectItem} from '../../src/lib/econ-practice/adaptive.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {prior,summarize} from '../../src/lib/econ-practice/irt.mjs';

test('assessment estimates and counts use the requested occasion rather than a lifetime pool',()=>{
 const items=buildBank().filter(q=>q.course==='ap-micro'&&q.unit===1&&q.format==='numeric');
 const first=items[0],second=items.find(q=>q.family!==first.family),state=newState();
 recordAnswer(state,first,{response:first.answer,mode:'assessment',sessionId:'earlier',eventId:'one',at:1});
 const before=progress(state,'ap-micro',{sessionId:'later'})[0];assert.equal(before.attempts,0);assert.deepEqual(before.estimate,summarize(prior()));
 recordAnswer(state,second,{response:second.answer+100,mode:'assessment',sessionId:'later',eventId:'two',at:2});
 const old=progress(state,'ap-micro',{sessionId:'earlier'})[0],now=progress(state,'ap-micro',{sessionId:'later'})[0];
 assert.equal(old.attempts,1);assert.equal(old.correct,1);assert.equal(now.attempts,1);assert.equal(now.correct,0);assert.equal(now.measurementResponses,1);
 const isolated=newState();recordAnswer(isolated,second,{response:second.answer+100,mode:'assessment',sessionId:'later',eventId:'two',at:2});
 assert.deepEqual(now.estimate,progress(isolated,'ap-micro',{sessionId:'later'})[0].estimate);
 const options={course:'ap-micro',mode:'assessment',unit:1,sessionId:'later',rng:()=>.4};
 assert.deepEqual(selectItem(items,state,options),selectItem(items,isolated,options));
});

test('occasion separation does not turn previously practiced families into fresh IRT evidence',()=>{
 const item=buildBank().find(q=>q.format==='numeric'),state=newState();
 recordAnswer(state,item,{response:item.answer,sessionId:'practice',eventId:'one'});
 recordAnswer(state,item,{response:item.answer,mode:'assessment',sessionId:'diagnostic',eventId:'two'});
 const unit=progress(state,item.course,{sessionId:'diagnostic'})[item.unit-1];assert.equal(unit.attempts,1);assert.equal(unit.measurementResponses,0);assert.deepEqual(unit.estimate,summarize(prior()));
});
