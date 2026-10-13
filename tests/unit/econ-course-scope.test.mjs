import test from 'node:test';
import assert from 'node:assert/strict';
import {courses,knownCourse,validCourseUnit} from '../../src/lib/econ-practice/curriculum.mjs';
test('course scopes reject inherited names and derive unit limits from the registry',()=>{
 assert.equal(knownCourse('toString'),false);assert.equal(knownCourse('__proto__'),false);
 for(const id of Object.keys(courses)){assert.equal(validCourseUnit(id,0),false);assert.equal(validCourseUnit(id,0,{allowAll:true}),true);assert.equal(validCourseUnit(id,courses[id].units.length),true);assert.equal(validCourseUnit(id,courses[id].units.length+1),false);assert.equal(validCourseUnit(id,'1'),false);}
});
