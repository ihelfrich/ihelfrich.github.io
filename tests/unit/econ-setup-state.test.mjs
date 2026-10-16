import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionFromSearch,signInReason} from '../../src/scripts/econ-setup-state.mjs';
import {courses} from '../../src/lib/econ-practice/curriculum.mjs';
import {prepare} from '../../src/lib/econ-practice/prepare-calibration.mjs';
import {screeningMessages} from '../../src/scripts/econ-screening-labels.mjs';
test('shared course/unit selection rejects inherited keys, malformed units and out-of-course ranges',()=>{
 const id=Object.keys(courses).at(-1);
 assert.deepEqual(selectionFromSearch(`?course=${id}&unit=2`,courses,'ap-micro'),{course:id,unit:2});
 for(const search of ['?course=__proto__&unit=1','?course=missing&unit=1'])assert.deepEqual(selectionFromSearch(search,courses,'ap-micro'),{course:'ap-micro',unit:0});
 for(const unit of ['1.5','1e0','-1','999',''])assert.equal(selectionFromSearch(`?course=${id}&unit=${unit}`,courses,'ap-micro').unit,0);
});
test('sign-in explains each unmet condition without confusing consent with missing configuration',()=>{
 const ready={connection:'connected',configured:true,consent:true,busy:false};assert.equal(signInReason(ready),'');
 assert.match(signInReason({...ready,connection:'connecting'}),/Checking/);
 assert.match(signInReason({...ready,connection:'disconnected'}),/Reload/);
 assert.match(signInReason({...ready,configured:false,consent:false}),/not configured/);
 assert.match(signInReason({...ready,consent:false}),/acknowledge answer storage/);
 assert.match(signInReason({...ready,busy:true}),/wait/i);
});
test('screening prose derives counts from a disconnected synthetic design with constant items',()=>{
 const rows=[];for(let group=0;group<2;group++)for(let p=0;p<4;p++)for(let i=0;i<4;i++)rows.push({course:'ap-micro',unit:1,item_version:'test',event_id:`${group}-${p}-${i}`,participant_id:`${group}-${p}`,session_id:`${group}-${p}`,item_id:`${group}-${i}`,family_id:`${group}-${i}`,mode:'assessment',first_family_exposure:true,hints_used:0,feedback_before_answer:false,attempt_number:1,validity:'valid',calibration_eligible:true,server_received_at:'2026-10-13T00:00:00Z',payload_sha256:'test',correct:i===3?1:p%2,selection_probability:0.25});
 const {manifest}=prepare(rows,{course:'ap-micro',unit:1,bankVersion:'test',minPersons:10,minItemResponses:3,minItemsPerPerson:3});const messages=screeningMessages(manifest);
 assert.match(messages.blocking.join(' '),/8 people retained; at least 10 required/);assert.match(messages.blocking.join(' '),/disconnected administration groups/);assert.match(messages.itemScreen,/2 items have no score variation/);assert.match(messages.exclusions.join(' '),/8 response records/);
});
