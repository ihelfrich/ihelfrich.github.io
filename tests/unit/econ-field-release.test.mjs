import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {selectItem,newState,recordAnswer} from '../../src/lib/econ-practice/adaptive.mjs';
for(const course of ['intro-econometrics','labor-economics','public-economics','industrial-organization','international-trade','development-economics','financial-economics','behavioral-economics'])test(`${course} release matches reviewed source bytes and covers every course unit`,()=>{
 const raw=fs.readFileSync(new URL(`../../content/econ-drafts/${course}.json`,import.meta.url)),release=JSON.parse(fs.readFileSync(new URL(`../../content/econ-drafts/${course}-release.json`,import.meta.url)));
 if(release.extensions){const bytes=fs.readFileSync(new URL(`../../content/econ-drafts/${course}-variants.json`,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),release.extensions.sourceSHA256);}
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),release.sourceSHA256,'Source changed after content review');
 const bank=buildBank(),items=bank.filter(q=>q.course===course);assert.equal(items.length,release.itemCount+(release.extensions?.itemCount??0));assert.equal(new Set(items.map(q=>q.family)).size,release.itemCount);assert.ok(items.every(q=>q.review==='content-reviewed-provisional'));
 const state=newState();for(let i=0;i<6;i++){const q=selectItem(bank,state,{course,mode:'assessment',sessionId:'scope',rng:()=>.3}).item;recordAnswer(state,q,{response:q.answerIndex,mode:'assessment',sessionId:'scope'});}assert.equal(new Set(state.history.map(h=>h.unit)).size,6);
});


test('re-evaluating the field module replaces its registrations without duplicating IDs',async()=>{
 const before=buildBank().map(q=>q.id);
 await import('../../src/lib/econ-practice/field-courses.mjs?reload-regression=1');
 const after=buildBank().map(q=>q.id);
 assert.deepEqual(after,before);
 assert.equal(new Set(after).size,after.length);
});

import {auditFieldRelease} from '../../src/lib/econ-practice/field-release.mjs';
test('release gate rejects unauthorized status, duplicate review entries and cross-course items before registration',()=>{
 const course='industrial-organization';
 const read=s=>JSON.parse(fs.readFileSync(new URL(`../../content/econ-drafts/${course}${s}.json`,import.meta.url)));
 const items=read(''),release=read('-release'),extensions=read('-variants');
 assert.deepEqual(auditFieldRelease(items,release,extensions),[]);
 for(const altered of [
  {...release,reviewStatus:'draft'},
  {...release,sourceSHA256:'unverified'},
  {...release,reviewedIds:[...release.reviewedIds,release.reviewedIds[0]]},
  {...release,extensions:{...release.extensions,reviewedBaseIds:[...release.extensions.reviewedBaseIds,release.extensions.reviewedBaseIds[0]]}},
  {...release,extensions:{...release.extensions,reviewStatus:'draft'}},
 ])assert(auditFieldRelease(items,altered,extensions).length>0);
 assert(auditFieldRelease([{...items[0],course:'wrong'},...items.slice(1)],release,extensions).length>0);
 assert(auditFieldRelease(items,release,[]).length>0);
});
