import {newState,selectItem,recordAnswer} from '../../src/lib/econ-practice/adaptive.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {auditFieldExpansions,fieldQuestionAt,fieldVariantHintAt} from '../../src/lib/econ-practice/field-expansions.mjs';
import {family,families,buildBank} from '../../src/lib/econ-practice/bank.mjs';
import {publicQuestion} from '../../src/lib/econ-practice/scoring.mjs';
const base={id:'expansion-fixture',unit:1,topic:'1.1',prompt:'Original conceptual comparison',correct:'A',wrong:['B','C','D'],explanation:'Base reasoning'};
const variants=Array.from({length:4},(_,i)=>({prompt:`Compute the outcome for input ${i+2}.`,answer:i+.125,explanation:'Numerical reasoning',hint:'PRIVATE METHOD SCAFFOLD',graph:{kind:'lines',xLabel:'Quantity',yLabel:'Price',xMax:10,yMax:10,lines:[{label:'Demand',intercept:10,slope:-1}]}}));
test('expansion validation rejects unknown families, duplicate stems, invalid graphs and constant keys',()=>{
 const good=[{baseId:base.id,variants}];assert.deepEqual(auditFieldExpansions([base],good).errors,[]);
 assert.match(auditFieldExpansions([base],[{baseId:'missing',variants}]).errors.join(' '),/unknown/);
 const bad=structuredClone(good);bad[0].variants[1].prompt=variants[0].prompt;bad[0].variants[0].graph.lines[0].intercept=100;
 assert.match(auditFieldExpansions([base],bad).errors.join(' '),/repeated prompt/);assert.match(auditFieldExpansions([base],bad).errors.join(' '),/invisible/);
 assert.match(auditFieldExpansions([base],[{baseId:base.id,variants:variants.map(q=>({...q,answer:1}))}]).errors.join(' '),/distinct/);
});
test('numeric extensions preserve base identity and family count without exposing hints or answers',()=>{
 const start=families.length;
 try{
  family(base.id,base.topic,'Fixture',2,i=>fieldQuestionAt(base,variants,i),'fixture',5,{numericExtensions:true});
  const items=buildBank().filter(q=>q.course==='fixture');
  assert.equal(families.length,start+1);assert.equal(items.length,5);assert.equal(items[0].id,'fixture:expansion-fixture:01');
  assert.equal(items[0].format,'choice');assert.ok(items.slice(1).every(q=>q.format==='numeric'&&q.family===base.id));
  for(const q of items){const visible=publicQuestion(q);assert.ok(!('answer' in visible)&&!('answerIndex' in visible)&&!('hint' in visible));assert.ok(!JSON.stringify(visible).includes('PRIVATE METHOD'));}
  const assessmentItems=items.map(q=>({...q,course:'intro-econometrics'})),state=newState();
  const settings={course:'intro-econometrics',unit:1,mode:'assessment',sessionId:'mixed-family',rng:()=>.5};
  const selected=selectItem(assessmentItems,state,settings).item;
  recordAnswer(state,selected,{mode:'assessment',sessionId:settings.sessionId,response:selected.format==='choice'?selected.answerIndex:selected.answer});
  assert.equal(selectItem(assessmentItems,state,settings),null,'Other formats are still the same exposed family');
  const repeat=assessmentItems.find(q=>q.id!==selected.id);
  recordAnswer(state,repeat,{mode:'assessment',sessionId:'another-session',response:repeat.format==='choice'?repeat.answerIndex:repeat.answer});
  assert.equal(state.history[1].psychometricEligible,false,'A format change must not create new first-exposure IRT evidence');
  assert.equal(fieldVariantHintAt(variants,1),'PRIVATE METHOD SCAFFOLD');assert.equal(fieldVariantHintAt(variants,0),null);
  assert.throws(()=>fieldQuestionAt(base,variants,5),RangeError);
  assert.throws(()=>family('bad','1.1','Bad',2,()=>fieldQuestionAt(base,[],0),'fixture',3,{numericExtensions:true}),/must be numeric/);
 }finally{families.splice(start);}
});
