import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDraftItems} from '../../scripts/econ-practice/audit-drafts.mjs';
const item={id:'test:item',course:'test',unit:1,topic:'1.1',title:'Title',prompt:'Question?',correct:'A',wrong:['B','C','D'],explanation:'Reason',skill:'interpret',sourceUrls:['https://example.edu/course'],reviewStatus:'draft'};
test('draft audit rejects answer duplication, duplicate stems and unsupported release claims',()=>{
 assert.deepEqual(auditDraftItems([item]).errors,[]);
 assert.ok(auditDraftItems([{...item,wrong:[' a ','C','D']}]).errors.some(e=>e.includes('duplicate options')));
 assert.ok(auditDraftItems([item,{...item,id:'second'}]).errors.some(e=>e.includes('duplicate prompt')));
 assert.ok(auditDraftItems([{...item,reviewStatus:'approved'}]).errors.some(e=>e.includes('release')));
 assert.ok(auditDraftItems([{...item,unit:2}]).errors.some(e=>e.includes('unit/topic')));
});
test('conditional expectation notation stays inside options rather than becoming delimiters',()=>{
 const wrong=['ATE alone, with no other assumptions.','ATT minus E[Y(0)|D=1]+E[Y(0)|D=0].','E[Y(1)−Y(0)|D=0] alone.'];
 assert.deepEqual(auditDraftItems([{...item,wrong}]).errors,[]);
 const fragmented=wrong.flatMap(option=>option.split('|'));
 assert.equal(fragmented.length,6);
 assert(auditDraftItems([{...item,wrong:fragmented}]).errors.some(error=>error.includes('expected four nonempty options')));
});
