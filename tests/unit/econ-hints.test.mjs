import test from 'node:test';
import assert from 'node:assert/strict';
import {hintFor,HINT_VERSION} from '../../src/lib/econ-practice/hints.mjs';
import {microTopics} from '../../src/lib/econ-practice/curriculum.mjs';
test('every AP micro topic has a method hint independent of numeric answers',()=>{
 for(const topic of Object.keys(microTopics)){const a=hintFor({course:'ap-micro',topic,answer:'SECRET-ANSWER',explanation:'SECRET-EXPLANATION'});assert.equal(a.hintScope,`ap-micro:${topic}`);assert.equal(a.hintVersion,HINT_VERSION);assert.ok(a.hint.length>60);assert.ok(!a.hint.includes('SECRET'));assert.deepEqual(a,hintFor({course:'ap-micro',topic,answer:999}));}
 assert.equal(hintFor({course:'ap-macro',topic:'4.2'}).hintScope,'general');
});
