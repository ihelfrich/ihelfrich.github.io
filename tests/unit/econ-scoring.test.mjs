import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeResponse,publicQuestion,responseFeedback,validResponseShape} from '../../src/lib/econ-practice/scoring.mjs';
import {newState,recordAnswer} from '../../src/lib/econ-practice/adaptive.mjs';
const item={id:'test',family:'test',course:'ap-micro',topic:'2.8',unit:2,difficulty:2,format:'multipart',explanation:'Solve equilibrium then the tax wedge.',parts:[{id:'quantity',prompt:'Equilibrium quantity',answer:20,tolerance:.005,points:2,explanation:'Set demand equal to supply.'},{id:'price',prompt:'Equilibrium price',answer:40,tolerance:.005,points:1,explanation:'Substitute quantity.'}]};
test('multipart rubric awards declared partial credit and rejects blank answers',()=>{
 const grade=gradeResponse(item,{quantity:20,price:41});assert.equal(grade.correct,false);assert.equal(grade.score,2/3);assert.equal(grade.earned,2);assert.equal(grade.possible,3);
 assert.equal(gradeResponse(item,{quantity:20,price:40}).correct,true);assert.equal(validResponseShape(item,{quantity:'',price:40}),false);assert.equal(validResponseShape(item,{quantity:20,price:40,extra:1}),false);
});
test('multipart public item excludes every part key and explanation',()=>{
 const visible=publicQuestion(item);for(const part of visible.parts){assert.equal(part.answer,undefined);assert.equal(part.explanation,undefined);assert.equal(part.tolerance,undefined);}assert.equal(visible.explanation,undefined);
 assert.equal(responseFeedback(item,{quantity:20,price:41}).parts[1].answer,'40');
});
test('multipart responses never enter a binary posterior',()=>{const state=newState();recordAnswer(state,item,{response:{quantity:20,price:40},mode:'assessment'});assert.equal(Object.keys(state.posteriors).length,0);assert.equal(state.history[0].psychometricEligible,false);});
