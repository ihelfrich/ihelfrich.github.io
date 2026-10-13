import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {selectItem,newState,recordAnswer} from '../../src/lib/econ-practice/adaptive.mjs';
test('econometrics release matches reviewed source bytes and covers every course unit',()=>{
 const raw=fs.readFileSync(new URL('../../content/econ-drafts/intro-econometrics.json',import.meta.url)),release=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/intro-econometrics-release.json',import.meta.url)));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),release.sourceSHA256,'Source changed after content review');
 const bank=buildBank(),items=bank.filter(q=>q.course==='intro-econometrics');assert.equal(items.length,30);assert.equal(new Set(items.map(q=>q.family)).size,30);assert.ok(items.every(q=>q.review==='content-reviewed-provisional'));
 const state=newState();for(let i=0;i<6;i++){const q=selectItem(bank,state,{course:'intro-econometrics',mode:'assessment',sessionId:'scope',rng:()=>.3}).item;recordAnswer(state,q,{response:q.answerIndex,mode:'assessment',sessionId:'scope'});}assert.equal(new Set(state.history.map(h=>h.unit)).size,6);
});
