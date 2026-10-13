import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
const bank=buildBank().filter(q=>q.course==='ap-micro');
// Parse the student-visible quantities, independently of generator indexes.
// These checks cover arithmetic/feasibility, not empirical item quality.
const numbers=q=>[...q.prompt.matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
const oracles={
 'opportunity-cost':([hours,wage,duration])=>wage*duration,
 'ppc-slope':([bicycles,meals])=>meals/bicycles,
 'comparative-output':([at,ac,bt,bc])=>bc/bt,
 'comparative-input':([report,presentation])=>presentation/report,
 'net-benefit':([benefit,explicit,implicit])=>benefit-explicit-implicit,
 'marginal-choice':v=>v.slice(0,4).filter(mb=>mb>v[4]).length,
 'utility-dollar':([px,mux,py])=>mux*py/px,
 'demand-elasticity':([dp,dq])=>dq/dp,
 'midpoint-elasticity':([p0,p1,q0,q1])=>Math.abs(((q1-q0)/((q1+q0)/2))/((p1-p0)/((p1+p0)/2))),
 'supply-elasticity':([dp,dq])=>dq/dp,
 'cross-elasticity':([dp,dq])=>dq/dp,
 'income-elasticity':([di,dq])=>-dq/di,
 'equilibrium-quantity':([a,b,c])=>(a-c)/(b+1),
 'equilibrium-price':([a,b,c])=>c+(a-c)/(b+1),
 'consumer-surplus':([a,b,p])=>(a-p)**2/(2*b),
 'producer-surplus':([c,p])=>(p-c)**2/2,
 'shift-equilibrium':([a0,a1,c])=>(a1-c)/2-(a0-c)/2,
 'ceiling-shortage':([a,b,d,p])=>(a-b*p)-d*p,
 'floor-surplus':([a,b,d,p])=>d*p-(a-b*p),
 'tax-quantity':([a,c,t])=>(a-c-t)/2,
 'tax-incidence':([d,s,t])=>t*d/(d+s),
 'tax-dwl':([t,dq])=>t*dq/2,
 'imports':([d,s])=>d-s,
 'tariff-revenue':([t,d,s])=>t*(d-s)
};
test('unit 1–2 numeric keys agree with student-visible data and independent economic identities',()=>{
 for(const [family,oracle] of Object.entries(oracles)){
  const items=bank.filter(q=>q.family===family);assert.equal(items.length,24,family);
  for(const q of items){const expected=oracle(numbers(q));assert.ok(Number.isFinite(expected)&&Math.abs(q.answer-expected)<=0.000501,`${q.id}: ${q.answer} versus ${expected}`);}
 }
});
test('revised numeric families vary correct answers and include distinct marginal decisions',()=>{
 for(const family of ['ppc-slope','comparative-output','comparative-input','marginal-choice','demand-elasticity','supply-elasticity','producer-surplus','shift-equilibrium'])assert.ok(new Set(bank.filter(q=>q.family===family).map(q=>q.answer)).size>=5,family);
 assert.deepEqual([...new Set(bank.filter(q=>q.family==='marginal-choice').map(q=>q.answer))].sort(),[0,1,2,3,4]);
 const elasticity=bank.filter(q=>q.family==='demand-elasticity');assert.ok(elasticity.some(q=>q.answer<1)&&elasticity.some(q=>q.answer===1)&&elasticity.some(q=>q.answer>1));
});
