import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const q=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/game-theory.json',import.meta.url)));
const item=id=>q.find(x=>x.id===`game-theory-${id}`);
test('Bayesian games, auctions and signaling satisfy probability and incentive checks',()=>{
 assert(Math.abs(5-6*(5/6))<1e-12);assert.match(item('u5-02').correct,/5\/6/);
 assert.equal(.4/(.4+.1),.8);assert.match(item('u5-03').correct,/0.8/);
 assert.equal(1-.5,.5);assert.match(item('u5-04').correct,/1\/2/);
 for(const value of [0,.1,.5,.9,1]){
  const payoff=bid=>Math.min(1,2*bid)*(value-bid),best=payoff(value/2);
  for(let bid=0;bid<=1.2;bid+=.001)assert(payoff(bid)<=best+1e-12);
 }
 assert.match(item('u5-06').correct,/v\/2/);
 let revenue=0;const steps=10000;for(let j=0;j<steps;j++)revenue+=(1-(j+.5)/steps)**2/steps;
 assert(Math.abs(revenue-1/3)<1e-8);assert.match(item('u5-07').correct,/1\/3/);
 assert.equal(Math.max(6,5),6);assert.match(item('u5-08').correct,/pays 6/);
 const posterior=(1/3*.5)/(1/3*.5+2/3*.25);assert.equal(posterior,.5);assert.match(item('u6-01').correct,/1\/2/);
 assert.equal(5*(2/5)-2,0);assert.match(item('u6-03').correct,/2\/5/);
 assert(4-1>1&&1>4-4);assert.match(item('u6-04').correct,/neither type wants to imitate/);
 assert(2.5>1-2&&2.5>1-4);assert.match(item('u6-05').correct,/2.5/);
 assert(4-2>1);assert.match(item('u6-06').correct,/L gains/);
 for(const epsilon of [.0001,.01,.5,.99])assert(1>1-epsilon);
 assert.match(item('u6-09').correct,/U strictly better/);
});
