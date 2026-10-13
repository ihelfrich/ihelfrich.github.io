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
