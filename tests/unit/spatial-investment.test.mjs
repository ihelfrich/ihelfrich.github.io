import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeGraph,shortestPaths,travelMatrix} from '../../src/lib/spatial-economics.mjs';
import {allocate,annuity,evaluatePolicy} from '../../src/lib/spatial-incentives.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../public/spatial-economics/asheville.json',import.meta.url)));
const graph=makeGraph(data),matrix=travelMatrix(data,graph);
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} vs ${b}`);
test('directed paths preserve unreachable nodes and bridge exclusions',()=>{
  const g=makeGraph({nodes:[0,1,2,3],edges:[[0,1,1,-1],[1,2,2,0],[0,2,9,-1]]});
  near(shortestPaths(g,0)[2],3);near(shortestPaths(g,0,new Set([0]))[2],9);
  assert.equal(shortestPaths(g,2)[0],Infinity);assert.equal(shortestPaths(g,0)[3],Infinity);
});
test('compressed JS routes match independent SciPy routes on original geometry',()=>{
  const oracle=JSON.parse(fs.readFileSync(new URL('../../public/spatial-economics/routing-oracle.json',import.meta.url)));
  const results=new Map();for(const p of oracle.pairs){if(!results.has(p.from))results.set(p.from,shortestPaths(graph,p.from));const actual=results.get(p.from)[p.to];if(p.minutes===null)assert.equal(actual,Infinity);else near(actual,p.minutes,0.00001);}
  assert.ok(oracle.pairs.length>=100);
});
test('allocation exhausts budget, obeys cap, and solves an independent brute-force grid',()=>{
  const scores=[.8,.6,.4],allocation=allocate(scores,.4);
  near(allocation.reduce((a,b)=>a+b),1);assert.ok(allocation.every(x=>x<=.4));
  const optimum=allocation.reduce((sum,x,i)=>sum+x*scores[i],0);
  let brute=-Infinity;for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){const c=10-a-b;if(c>=0&&c<=4)brute=Math.max(brute,(a*scores[0]+b*scores[1]+c*scores[2])/10);}
  near(optimum,brute);assert.throws(()=>allocate(scores,.2));
});
test('job accounting conserves spatial mass and budget in observed-data scenario',()=>{
  const r=evaluatePolicy(data,matrix);near(r.offers,400);near(r.induced,80);near(r.displaced,20);near(r.netJobs,60);
  near(r.cells.reduce((sum,c)=>sum+c.deltaJobs,0),r.netJobs);
  near(r.sites.reduce((sum,s)=>sum+s.budget,0),r.parameters.budget);
  assert.ok(r.sites.every(s=>s.share<=.4));
  r.cells.forEach((c,i)=>assert.ok(data.cells[i].jobs+c.deltaJobs>=0));
});
test('zero additionality produces no spatial effect and undefined cost ratio',()=>{
  const r=evaluatePolicy(data,matrix,{additionality:0});near(r.netJobs,0);assert.equal(r.costPerJobYear,null);assert.ok(r.cells.every(c=>c.gain===0&&c.deltaJobs===0));near(r.deadweightOffers,r.offers);
});
test('full within-area relocation conserves total jobs but may redistribute access',()=>{
  const r=evaluatePolicy(data,matrix,{displacement:1});near(r.netJobs,0);assert.equal(r.costPerJob,null);near(r.cells.reduce((sum,c)=>sum+c.deltaJobs,0),0);assert.ok(r.cells.some(c=>Math.abs(c.gain)>0.001));
});
test('discounting and job persistence have the specified timing',()=>{
  near(annuity(10,0),10);near(annuity(10,.03),(1-(1.03)**-10)/.03);
  const r=evaluatePolicy(data,matrix,{discount:0,years:10});near(r.costPerJobYear,10000000/600);
});
test('optimized allocation weakly improves its stated objective over equal shares',()=>{
  for(const equity of [0,.25,.5,.75,1]){const p={equity,maxShare:.4};const r=evaluatePolicy(data,matrix,p),equal=evaluatePolicy(data,matrix,{...p,allocation:'equal'});const score=v=>(1-equity)*v.groups.workers.gain+equity*v.groups.low.gain;assert.ok(score(r)>=score(equal)-1e-9);}
});
test('invalid or infeasible policy inputs are rejected',()=>{
  for(const p of [{subsidy:0},{additionality:-.1},{displacement:1.1},{years:2.5},{maxShare:.1},{halfLife:0}])assert.throws(()=>evaluatePolicy(data,matrix,p));
});
