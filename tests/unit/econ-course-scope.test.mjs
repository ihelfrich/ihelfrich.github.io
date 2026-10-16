import test from 'node:test';
import assert from 'node:assert/strict';
import {courses,knownCourse,validCourseUnit} from '../../src/lib/econ-practice/curriculum.mjs';
test('course scopes reject inherited names and derive unit limits from the registry',()=>{
 assert.equal(knownCourse('toString'),false);assert.equal(knownCourse('__proto__'),false);
 for(const id of Object.keys(courses)){assert.equal(validCourseUnit(id,0),false);assert.equal(validCourseUnit(id,0,{allowAll:true}),true);assert.equal(validCourseUnit(id,courses[id].units.length),true);assert.equal(validCourseUnit(id,courses[id].units.length+1),false);assert.equal(validCourseUnit(id,'1'),false);}
});

test('expanded directory contains named outlines and valid source links, not table separators',async()=>{
 const {readFileSync}=await import('node:fs');const entries=JSON.parse(readFileSync(new URL('../../src/data/economics-curriculum-plan.json',import.meta.url),'utf8'));assert.equal(entries.length,37);
 assert.equal(new Set(entries.map(e=>e.title)).size,entries.length);
 for(const entry of entries){assert.match(entry.title,/[A-Za-z]/);assert.ok(entry.topics.length>0);for(const source of entry.sources)assert.equal(new URL(source.url).protocol,'https:');}
});
