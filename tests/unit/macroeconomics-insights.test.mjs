import test from 'node:test';
import assert from 'node:assert/strict';
import {models,byId} from '../../src/data/macroeconomics.mjs';
import * as core from '../../src/lib/macroeconomics.mjs';
import * as more from '../../src/lib/macroeconomics-extended.mjs';
const {buildInsight}=await import('../../src/lib/macroeconomics-insights.mjs').catch(()=>({}));
const solve={...core,...more,nk:core.newKeynesian,optimal:core.optimalGrowth};
const state=(id,params={},step=0)=>{const p={...byId[id].defaults,...params};return {model:id,params:p,result:solve[id](p),step,productivity:0};};
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('every model has a distinct, computed question beyond its canonical plots',()=>{
 assert.equal(typeof buildInsight,'function');const questions=new Set();
 for(const model of models){const s=state(model.id),saved=JSON.stringify(s),v=buildInsight(s);assert.ok(v.question.length>20);assert.ok(v.answer);assert.ok(v.equation);assert.ok(v.note);questions.add(v.question);assert.equal(JSON.stringify(s),saved);}
 assert.equal(questions.size,15);
});
test('Solow saving experiment has an immediate consumption cost at fixed initial resources',()=>{
 const s=state('solow'),v=buildInsight(s);near(v.chart.series[0].values[0].y,3.2);near(v.chart.series[1].values[0].y,2.8);near(v.experiment.s,.3);
});
test('AK indexes separate aggregate accumulation from per-worker decline',()=>{
 const v=buildInsight(state('ak',{n:.03},10));assert.ok(v.chart.series[0].values[10].y>100);assert.ok(v.chart.series[1].values[10].y<100);near(v.threshold,.24);
});
test('fiscal, debt, RBC and sequence decompositions satisfy independent identities',()=>{
 for(const [id,params,step,key]of [['islm',{},0,'total'],['debt',{},5,'total'],['rbc',{},5,'total'],['sequence',{},5,'total']]){const s=state(id,params,step),v=buildInsight(s);near(v.parts.reduce((x,y)=>x+y.value,0),v[key]);}
 const r=buildInsight(state('rbc',{rho:0},1));near(r.parts[0].value,0);assert.ok(r.parts[1].value>0);
 const d=state('debt',{r:.03,g:.03,p:0},4),dv=buildInsight(d);near(dv.total,0);
});
test('growth trap threshold is a strict crossing, not merely the fixed adoption cost',()=>{
 const v=buildInsight(state('trap'));near(v.threshold,72);near(v.requiredPush,64);assert.match(v.note,/strictly/);
});
test('household borrowing-bound mass uses policy choices and actual joint probabilities',()=>{
 const s=state('household'),v=buildInsight(s);let mass=0;for(let z=0;z<2;z++)for(let i=0;i<s.result.grid.length;i++)if(s.result.policy[z][i]===0)mass+=s.result.distribution[z][i];near(v.constraintMass,mass);
});
test('the Bellman choice landscape peaks at the solved policy within the discrete residual',()=>{
 const s=state('optimal'),v=buildInsight(s),points=v.chart.series[0].values;const best=points.reduce((a,b)=>a.y>b.y?a:b);near(best.x,s.result.policy[0][0]);assert.ok(Math.abs(best.y)<=s.result.residual*1.1+1e-10);
});
test('NK stability curves are shock-independent and retain the unit-circle threshold',()=>{
 const a=buildInsight(state('nk')),b=buildInsight(state('nk',{shock:0}));assert.deepEqual(a.chart.series,b.chart.series);for(const pt of a.chart.series[2].values)near(pt.y,1);
});
