import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
import {newState,selectItem,recordAnswer} from '../../src/lib/econ-practice/adaptive.mjs';
import {prior,posteriorUpdate} from '../../src/lib/econ-practice/irt.mjs';
function fixture(){
 const source=buildBank(),bank=[];
 for(const unit of [1,2]){const seen=new Set();for(const q of source.filter(q=>q.course==='ap-micro'&&q.unit===unit&&q.format==='numeric'))if(!seen.has(q.family)){seen.add(q.family);bank.push(q);if(seen.size===3)break;}}
 const calibrationsByUnit={};for(const unit of [1,2])calibrationsByUnit[unit]={id:`fixture-unit-${unit}`,course:'ap-micro',unit,bankVersion:bank[0].version,status:'approved',items:Object.fromEntries(bank.filter(q=>q.unit===unit).slice(0,2).map(q=>[q.id,{a:unit===1?.7:1.8,b:unit===1?-1:1,c:0,d:1}]))};
 return {bank,calibrationsByUnit};
}
test('multi-unit selection keeps separate models and excludes unfitted items from calibrated units',()=>{
 const {bank,calibrationsByUnit}=fixture(),state=newState(),expected={};
 for(let i=0;i<4;i++){
  const selected=selectItem(bank,state,{mode:'assessment',sessionId:'s',calibrationsByUnit,rng:()=>.1});assert.ok(selected);
  const {item,parameters}=selected,model=calibrationsByUnit[item.unit];assert.ok(Object.hasOwn(model.items,item.id));assert.equal(parameters.modelVersion,model.id);assert.equal(parameters.status,'calibrated');
  recordAnswer(state,item,{response:item.answer,mode:'assessment',sessionId:'s',parameterSnapshot:parameters,eventId:`e${i}`});
  expected[item.unit]=posteriorUpdate(expected[item.unit]??prior(),true,model.items[item.id]);
  assert.deepEqual(state.posteriors[JSON.stringify(['s',item.course,item.unit])],expected[item.unit]);
 }
 assert.deepEqual(new Set(state.history.slice(0,2).map(h=>h.unit)),new Set([1,2]));
 assert.equal(selectItem(bank,state,{mode:'assessment',sessionId:'s',calibrationsByUnit}),null);
 assert.deepEqual(state.posteriorModels,{[JSON.stringify(['s','ap-micro',1])]:'fixture-unit-1',[JSON.stringify(['s','ap-micro',2])]:'fixture-unit-2'});
});
test('unit model scope errors, missing coverage and model switching fail explicitly',()=>{
 const {bank,calibrationsByUnit}=fixture(),state=newState();
 for(const patch of [{course:'ap-macro'},{unit:2},{bankVersion:'wrong'},{status:'candidate'},{items:{}}])assert.throws(()=>selectItem(bank,state,{mode:'assessment',unit:1,calibrationsByUnit:{1:{...calibrationsByUnit[1],...patch}}}));
 const invalid=structuredClone(calibrationsByUnit);invalid[1].items[bank[0].id]=null;assert.throws(()=>selectItem(bank,state,{mode:'assessment',unit:1,calibrationsByUnit:invalid}),/Missing parameters/);
 const first=selectItem(bank,state,{mode:'assessment',unit:1,sessionId:'s',calibrationsByUnit});recordAnswer(state,first.item,{response:first.item.answer,mode:'assessment',sessionId:'s',parameterSnapshot:first.parameters});
 const changed=structuredClone(calibrationsByUnit);changed[1].id='replacement-model';assert.throws(()=>selectItem(bank,state,{mode:'assessment',unit:1,sessionId:'s',calibrationsByUnit:changed}),/model/i);
});
