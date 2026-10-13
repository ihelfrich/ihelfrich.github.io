import test from 'node:test';
import assert from 'node:assert/strict';
import {prepare} from '../../scripts/econ-practice/prepare-calibration.mjs';
const row=(person,item,extra={})=>({event_id:`${person}-${item}`,participant_id:person,session_id:`s-${person}`,course:'ap-micro',unit:2,item_version:'test',mode:'assessment',first_family_exposure:1,hints_used:0,feedback_before_answer:0,attempt_number:1,validity:'valid',calibration_eligible:1,server_received_at:'2026-10-12T00:00:00Z',payload_sha256:'fixture',item_id:item,family_id:item,correct:Number(person.endsWith('1')),selection_probability:.1,active_ms:5000,raw_answer_json:'0',...extra});
const opts={course:'ap-micro',unit:2,bankVersion:'test',minItemResponses:2,minPersons:2,minItemsPerPerson:3};
test('calibration keeps missing responses missing and filters assisted/repeated evidence',()=>{const rows=[];for(const p of ['p1','p2','p3'])for(const i of ['a','b','c','d','e'])rows.push(row(p,i));rows.push(row('p4','a',{hints_used:1}));rows.push(row('p1','f',{session_id:'later',server_received_at:'2026-10-13T00:00:00Z'}));const out=prepare(rows,opts);assert.equal(out.manifest.readyForCandidateFit,true);assert.equal(out.manifest.exclusions.assisted,1);assert.equal(out.manifest.exclusions.later_occasion,1);assert.equal(out.people.length,3);});
test('conflicting duplicate events are a hard error',()=>{assert.throws(()=>prepare([row('p1','a'),row('p1','a',{correct:0})],opts),/Conflicting duplicate/);});
test('disconnected item designs cannot pass screening',()=>{const rows=[];for(const p of ['p1','p2'])for(const i of ['a','b','c'])rows.push(row(p,i));for(const p of ['q1','q2'])for(const i of ['d','e','f'])rows.push(row(p,i));assert.ok(prepare(rows,opts).manifest.blockingReasons.includes('disconnected_item_design'));});
test('constant items and inadequate samples are rejected explicitly',()=>{const rows=[];for(const i of ['a','b','c'])rows.push(row('p1',i));const out=prepare(rows,opts);assert.equal(out.manifest.readyForCandidateFit,false);assert.ok(out.manifest.blockingReasons.includes('insufficient_persons'));});
test('synthetic or unreviewed fits cannot be ready for operational approval',async()=>{const {validateCandidate}=await import('../../scripts/econ-practice/validate-candidate.mjs');const r={synthetic:true,bankVersion:'test',sourceSHA256:'hash',models:{'2PL':{converged:true,finiteParameters:true,positiveFiniteCovarianceDiagonal:true,holdout:{predictions:200},items:{i:{a:1,b:0,c:0,d:1}}}}};const result=validateCandidate(r,{bankVersion:'test'});assert.equal(result.readyForInstructorApproval,false);assert.ok(result.issues.some(i=>i.includes('Synthetic')));assert.ok(result.issues.some(i=>i.includes('substantive review')));});

test('item diagnostics retain constant items and distinguish screened from fitted-matrix counts',()=>{
 const rows=[];for(const p of ['p1','p2','p3'])for(const i of ['a','b','c','d','e'])rows.push(row(p,i,{correct:i==='e'?1:Number(p.endsWith('1')),active_ms:p==='p3'?null:p==='p1'?1000:3000}));
 const out=prepare(rows,opts),items=out.manifest.diagnostics.items,e=items.find(q=>q.itemId==='e'),a=items.find(q=>q.itemId==='a');
 assert.equal(e.constantResponse,true);assert.equal(e.observedResponses,3);assert.equal(e.retainedMatrixResponses,0);assert.equal(e.facility,1);assert.ok(e.workingBinomial95[0]>.43&&e.workingBinomial95[0]<.44);assert.equal(e.workingBinomial95[1],1);
 assert.equal(a.facility,1/3);assert.equal(a.retainedMatrixResponses,3);assert.equal(a.activeMs.median,2000);assert.equal(a.activeMs.missingOrInvalid,1);assert.equal(a.activeMs.min,1000);assert.equal(a.responseFrequencies['0'],3);
 assert.ok(!JSON.stringify(out.manifest.diagnostics).includes('s-p1'));
});
test('working binomial intervals remain defined at zero successes and small samples',async()=>{
 const {wilsonInterval}=await import('../../scripts/econ-practice/item-diagnostics.mjs');assert.equal(wilsonInterval(0,0),null);
 const zero=wilsonInterval(0,10),all=wilsonInterval(10,10);assert.ok(zero[0]<1e-12);assert.ok(Math.abs(zero[1]-.2775327998628892)<1e-12);assert.ok(Math.abs(all[0]-(1-zero[1]))<1e-12);assert.throws(()=>wilsonInterval(2,1),/Invalid/);
});

test('an item that becomes constant after respondent filtering cannot pass fit screening',()=>{
 const rows=[row('removed','a',{correct:1}),row('removed','x',{correct:1}),row('removed','y',{correct:1})];
 for(const person of ['p1','p2','p3'])for(const item of ['a','b','c','d','e','f'])rows.push(row(person,item,{correct:item==='a'?0:Number(person!=='p2')}));
 const result=prepare(rows,opts);assert.equal(result.manifest.itemStats.a.n,4);assert.equal(result.manifest.itemStats.a.correct,1);
 assert.equal(result.manifest.readyForCandidateFit,false);assert.deepEqual(result.manifest.finalItemStats.a,{n:3,correct:0,constantResponse:true});assert.ok(result.manifest.blockingReasons.includes('constant_items_after_person_filter'));
 assert.equal(result.people.includes('removed'),false);assert.equal(result.manifest.finalItemStats.b.constantResponse,false);
});
