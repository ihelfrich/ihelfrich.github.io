import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {selectItem,newState,recordAnswer} from '../../src/lib/econ-practice/adaptive.mjs';
for(const course of ['intro-econometrics','labor-economics','public-economics','industrial-organization','international-trade'])test(`${course} release matches reviewed source bytes and covers every course unit`,()=>{
 const raw=fs.readFileSync(new URL(`../../content/econ-drafts/${course}.json`,import.meta.url)),release=JSON.parse(fs.readFileSync(new URL(`../../content/econ-drafts/${course}-release.json`,import.meta.url)));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),release.sourceSHA256,'Source changed after content review');
 const bank=buildBank(),items=bank.filter(q=>q.course===course);assert.equal(items.length,release.itemCount);assert.equal(new Set(items.map(q=>q.family)).size,release.itemCount);assert.ok(items.every(q=>q.review==='content-reviewed-provisional'));
 const state=newState();for(let i=0;i<6;i++){const q=selectItem(bank,state,{course,mode:'assessment',sessionId:'scope',rng:()=>.3}).item;recordAnswer(state,q,{response:q.answerIndex,mode:'assessment',sessionId:'scope'});}assert.equal(new Set(state.history.map(h=>h.unit)).size,6);
});


test('re-evaluating the field module replaces its registrations without duplicating IDs',async()=>{
 const before=buildBank().map(q=>q.id);
 await import('../../src/lib/econ-practice/field-courses.mjs?reload-regression=1');
 const after=buildBank().map(q=>q.id);
 assert.deepEqual(after,before);
 assert.equal(new Set(after).size,after.length);
});
