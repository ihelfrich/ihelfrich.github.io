import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBank,families} from '../../src/lib/econ-practice/bank.mjs';
import {microTopics} from '../../src/lib/econ-practice/curriculum.mjs';
import {probability,information,prior,posteriorUpdate,summarize,eligibleForCalibration,stoppingDecision} from '../../src/lib/econ-practice/irt.mjs';
import {newState,recordAnswer,selectItem,score} from '../../src/lib/econ-practice/adaptive.mjs';
const bank=buildBank();
test('bank exceeds 1,000 unique AP micro item IDs and covers every declared topic',()=>{
 assert.ok(bank.length>1000);assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
 for(const topic of Object.keys(microTopics))assert.ok(bank.some(q=>q.topic===topic),topic);
 for(const q of bank){assert.ok(q.prompt&&q.explanation);if(q.format==='numeric')assert.ok(Number.isFinite(q.answer));else{assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.answerIndex>=0&&q.answerIndex<q.options.length);}}
});
test('IRT mathematics agrees with closed-form Rasch values and finite differences',()=>{
 assert.equal(probability(0,{a:1,b:0}),.5);assert.equal(information(0,{a:1,b:0}),.25);
 for(const theta of [-3,-1,0,1,3]){const p={a:1.7,b:.2,c:.15,d:.95},P=probability(theta,p),h=1e-5;const derivative=(probability(theta+h,p)-probability(theta-h,p))/(2*h);assert.ok(Math.abs(information(theta,p)-derivative**2/(P*(1-P)))<1e-8);}
});
test('posterior remains normalized for extreme patterns and uncertainty is explicit',()=>{
 for(const correct of [true,false]){let w=prior();for(let i=0;i<200;i++)w=posteriorUpdate(w,correct,{a:1,b:0});assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-10);const s=summarize(w);assert.ok(Number.isFinite(s.theta)&&s.sd>0);assert.ok(correct?s.theta>0:s.theta<0);}
});
test('blank numeric answers are not scored as zero',()=>{assert.equal(score({format:'numeric',answer:0,tolerance:.005},''),false);assert.equal(score({format:'numeric',answer:0,tolerance:.005},'0'),true);});
test('practice and repeated siblings cannot inflate IRT evidence',()=>{
 const s=newState(),q=bank.find(q=>q.format==='numeric');recordAnswer(s,q,{response:q.answer,mode:'practice',eventId:'a'});assert.equal(Object.keys(s.posteriors).length,0);
 recordAnswer(s,{...q,id:q.id+'x'},{response:q.answer,mode:'assessment',eventId:'b'});assert.equal(Object.keys(s.posteriors).length,0);
 recordAnswer(s,q,{response:q.answer,mode:'practice',eventId:'a'});assert.equal(s.history.length,2);
});
test('assessment excludes every sibling of an administered family',()=>{const s=newState();const q=bank[0];recordAnswer(s,q,{response:q.answer,mode:'assessment',sessionId:'test'});for(let i=0;i<50;i++){const selected=selectItem(bank,s,{mode:'assessment',sessionId:'test'});assert.notEqual(selected.item.family,q.family);assert.ok(selected.selection.probability>0&&selected.selection.probability<=1);}});
test('unapproved calibrations cannot trigger precision stopping',()=>{assert.equal(stoppingDecision({count:20,uniqueFamilies:20,summary:{sd:.1,boundaryMass:0},coverageComplete:true,calibrated:false}).stop,false);});
test('calibration requires verified unassisted assessment evidence',()=>{const e={mode:'assessment',firstExposure:true,hints:0,feedbackBeforeAnswer:false,receiptVerified:true,validity:'valid',correct:true};assert.equal(eligibleForCalibration(e),true);for(const field of ['firstExposure','receiptVerified'])assert.equal(eligibleForCalibration({...e,[field]:false}),false);assert.equal(eligibleForCalibration({...e,hints:1}),false);});
test('independent economic checks across all numeric variants',()=>{
 for(const q of bank){const n=q.variant-1;let expected;
 switch(q.family){case 'tax-quantity':{const a=80+4*n,t=10+2*n;expected=(a-20-t)/2;break;}case 'monopoly-output':expected=(100+4*n-20)/4;break;case 'monopoly-price':expected=(100+4*n+20)/2;break;case 'monopoly-dwl':{const a=100+4*n,qm=(a-20)/4,qc=(a-20)/2;expected=(qc-qm)*(a-2*qm-20)/2;break;}case 'monopsony-employment':expected=(70+3*n-10)/3;break;case 'externality-output':expected=(100+4*n-20-12)/2;break;default:continue;}
 assert.ok(Math.abs(q.answer-expected)<=.001,q.id);
 }
});
test('conceptual choices do not all put the correct answer in the same position',async()=>{const {buildBank:buildFull}=await import('../../src/lib/econ-practice/index.mjs');const choices=buildFull().filter(q=>q.format==='choice');const counts=[0,0,0,0];choices.forEach(q=>counts[q.answerIndex]++);for(const count of counts)assert.ok(count>choices.length*.1&&count<choices.length*.5,JSON.stringify(counts));});
test('rendered explanations do not leak the generator index',async()=>{const {buildBank:buildFull}=await import('../../src/lib/econ-practice/index.mjs');for(const q of buildFull()){assert.ok(!/\d+\.\d{8,}/.test(q.prompt),q.id);if(q.family!=='golden-rule')assert.ok(!/\bn\b|\d+n\b/.test(q.explanation),q.id);}});
test('first six all-unit assessment selections cover every unit',()=>{const s=newState();let seed=23;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<6;i++){const q=selectItem(bank,s,{mode:'assessment',sessionId:'coverage',rng}).item;recordAnswer(s,q,{response:q.format==='choice'?q.answerIndex:q.answer,mode:'assessment',sessionId:'coverage'});}assert.equal(new Set(s.history.map(h=>h.unit)).size,6);});
test('a correct answer after a hint schedules finite early review without increasing an unassisted streak',()=>{
 const state=newState(),q=bank.find(q=>q.format==='numeric'),at=100000;
 recordAnswer(state,q,{response:q.answer,hints:1,at});const topic=state.topics[`${q.course}:${q.topic}`];
 assert.equal(topic.streak,0);assert.equal(topic.due,at+0.04*86400000);assert.equal(Object.keys(state.posteriors).length,0);
});
test('selection respects within-family information and records the exact joint propensity',()=>{
 const base=bank.find(q=>q.format==='numeric'),items=[{...base,id:'a',family:'same'},{...base,id:'b',family:'same'},{...base,id:'c',family:'other'}];
 const calibration={id:'test-calibration',status:'approved',bankVersion:base.version,items:{a:{a:.2,b:0},b:{a:3,b:0},c:{a:1,b:0}}};
 const sample=draws=>{let i=0;return selectItem(items,newState(),{course:base.course,unit:base.unit,mode:'assessment',calibration,rng:()=>draws[i++]});};
 const a=sample([0,0]),b=sample([0,.999999]),c=sample([.999999,0]);
 assert.equal(a.item.id,'a');assert.equal(b.item.id,'b');assert.equal(c.item.id,'c');
 assert.ok(b.selection.probability>a.selection.probability);
 assert.ok(Math.abs(a.selection.probability+b.selection.probability+c.selection.probability-1)<1e-12);
 const equal=items.map(q=>({...q,difficulty:2}));let calls=0;
 const selected=selectItem(equal,newState(),{unit:base.unit,mode:'assessment',rng:()=>[0,0][calls++]});
 assert.ok(Math.abs(selected.selection.probability-.25)<1e-12,'two equal families each get half the mass, two siblings each get one quarter');
});
test('malformed approved calibration cannot partially change student state',()=>{
 const q=bank.find(q=>q.format==='numeric');
 for(const params of [{a:1},{a:-1,b:0},{a:1,b:Infinity},{a:1,b:0,c:.9,d:.8}]){
  const state=newState(),before=JSON.stringify(state);
  assert.throws(()=>recordAnswer(state,q,{response:q.answer,mode:'assessment',calibration:{id:'invalid-model',status:'approved',bankVersion:q.version,items:{[q.id]:params}}}));
  assert.equal(JSON.stringify(state),before);
 }
});
test('maximum length never falsely claims precision when coverage or boundary checks fail',()=>{
 const base={count:48,uniqueFamilies:48,coverageComplete:true,calibrated:true,summary:{sd:.2,boundaryMass:0}};
 assert.equal(stoppingDecision(base).precisionMet,true);
 for(const override of [{coverageComplete:false},{uniqueFamilies:5},{summary:{sd:.2,boundaryMass:.1}},{summary:{sd:0,boundaryMass:0}},{summary:{sd:.2,boundaryMass:NaN}}]){
  const result=stoppingDecision({...base,...override});assert.equal(result.stop,true);assert.equal(result.reason,'maximum-length');assert.equal(result.precisionMet,false);
 }
});
test('prerequisite routing respects course-specific meanings of topic numbers',async()=>{
 const {buildBank:full}=await import('../../src/lib/econ-practice/index.mjs');const all=full();
 const unemp=all.find(q=>q.course==='ap-macro'&&q.family==='unemployment'),inflation=all.find(q=>q.course==='ap-macro'&&q.family==='inflation');
 const state=newState();state.topics['ap-macro:2.1']={attempts:4,correct:0,credit:0};
 const result=selectItem([unemp,inflation],state,{course:'ap-macro',unit:2,mode:'practice',rng:()=>0});
 assert.equal(result.item.id,unemp.id);assert.ok(Math.abs(result.selection.probability-.5)<1e-12,'GDP weakness is not an AP Micro demand prerequisite for macro labor statistics');
});
test('repeated practice difficulty triggers an in-scope prerequisite step, then releases the constraint',()=>{
 const state=newState(),failed=bank.filter(q=>q.topic==='3.5'&&q.format==='numeric').slice(0,2);
 for(const q of failed)recordAnswer(state,q,{response:-999,mode:'practice',sessionId:'remediation'});
 const review=selectItem(bank,state,{mode:'practice',unit:3,sessionId:'remediation',rng:()=>0});assert.equal(review.item.topic,'3.2');assert.equal(review.selection.reason,'prerequisite review for 3.5');
 recordAnswer(state,review.item,{response:review.item.answer,mode:'practice',sessionId:'remediation'});
 const subsequent=selectItem(bank,state,{mode:'practice',unit:3,sessionId:'remediation',rng:()=>0});assert.equal(subsequent.selection.reason,'coverage, review, and difficulty');
});
test('prerequisite remediation never widens an explicit topic filter or changes assessment mode',()=>{
 const state=newState();for(const q of bank.filter(q=>q.topic==='3.5'&&q.format==='numeric').slice(0,2))recordAnswer(state,q,{response:-999,mode:'practice',sessionId:'restricted'});
 const selected=selectItem(bank,state,{mode:'practice',topic:'3.5',sessionId:'restricted',rng:()=>0});assert.equal(selected.item.topic,'3.5');
 const assessment=selectItem(bank,state,{mode:'assessment',unit:3,sessionId:'restricted',rng:()=>0});assert.equal(assessment.selection.reason,'content-balanced information sampling');
});
