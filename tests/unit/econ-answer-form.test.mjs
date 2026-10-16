import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {renderAnswerInputs,readAnswerInputs,formatResponse} from '../../src/scripts/econ-answer-form.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {publicQuestion,gradeResponse} from '../../src/lib/econ-practice/scoring.mjs';
test('multipart form produces separately labeled fields and preserves each submitted value',()=>{
 const window=new Window(),field=window.document.createElement('fieldset'),item=buildBank().find(q=>q.format==='multipart');renderAnswerInputs(field,publicQuestion(item));
 const inputs=[...field.querySelectorAll('input')];assert.equal(inputs.length,item.parts.length);assert.throws(()=>readAnswerInputs(field,item),/finite number/);
 inputs.forEach((input,i)=>input.value=String(item.parts[i].answer));const response=readAnswerInputs(field,item);assert.equal(gradeResponse(item,response).correct,true);assert.ok(formatResponse(item,response).includes(item.parts[0].id));
 for(const input of inputs)assert.ok(input.parentElement.textContent.includes('point'));window.happyDOM.abort();
});
test('initial multipart market and monopoly rubrics satisfy independent economic identities',()=>{
 for(const q of buildBank().filter(q=>q.format==='multipart')){
  const numbers=[...q.prompt.matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));let expected;
  if(q.family==='market-tax-sequence'){const [a,c,t]=numbers,before=(a-c)/2,after=(a-c-t)/2;expected=[before,after,t*after];}
  else{const [a,b,mra,mrb,mc]=numbers,qm=(mra-mc)/mrb,price=a-b*qm,qc=(a-mc)/b;expected=[qm,price,(qc-qm)*(price-mc)/2];}
  q.parts.forEach((p,i)=>assert.ok(Math.abs(p.answer-expected[i])<1e-9,q.id));
 }
});

test('multipart bank rubrics award each part separately without error-carried-forward credit',()=>{
 for(const item of buildBank().filter(q=>q.format==='multipart')){
  const answers=Object.fromEntries(item.parts.map(p=>[p.id,p.answer]));
  for(const wrongPart of item.parts){
   const result=gradeResponse(item,{...answers,[wrongPart.id]:wrongPart.answer+10});
   assert.equal(result.earned,2,item.id);assert.equal(result.possible,3);assert.equal(result.correct,false);
   assert.equal(result.parts.filter(p=>p.correct).length,2);
  }
  const carried=item.family==='market-tax-sequence'
   ? {...answers,after:answers.after+1,revenue:(answers.revenue/answers.after)*(answers.after+1)}
   : {...answers,quantity:answers.quantity+1,price:answers.price-2};
  const result=gradeResponse(item,carried);assert.equal(result.earned,1,item.id);
 }
});

test('new question unlocks fields and numeric guidance is programmatically associated',()=>{
 const window=new Window(),field=window.document.createElement('fieldset');field.id='answer-options';window.document.body.append(field);field.disabled=true;
 const item=buildBank().find(q=>q.format==='multipart');renderAnswerInputs(field,publicQuestion(item));assert.equal(field.disabled,false);
 for(const input of field.querySelectorAll('input')){const described=window.document.getElementById(input.getAttribute('aria-describedby'));assert.ok(described);assert.match(described.textContent,/decimal places/);assert.ok(input.closest('label').textContent.includes('point'));}
 renderAnswerInputs(field,publicQuestion(buildBank().find(q=>q.format==='choice')));assert.equal(field.querySelectorAll('.choice-answer').length,4);assert.equal(field.querySelector('.answer-guidance'),null);window.happyDOM.abort();
});
