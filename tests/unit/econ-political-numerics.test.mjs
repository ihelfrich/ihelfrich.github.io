import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const items=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/political-economy.json',import.meta.url)));
const item=id=>items.find(q=>q.id===`political-economy-${id}`);
test('political economy arithmetic agrees with stored keys',()=>{
 const cases=[['u2-03',.02*100+.5-3,-.5],['u2-05',(2+6)/2/10*100,40],['u2-07',.25*40-8,2],['u2-10',.01*60,.6],['u3-06',Math.sqrt(100*25)-25,25],['u3-09',12-.3*50,-3],['u4-01',.8*(.7-.4)*20-3,1.8],['u4-03',.8*.5/(.8*.5+.2*.5),.8],['u4-09',100*(.42-.5),-8],['u5-05',90-20,70],['u6-07',(62-50)-(60-55),7]];
 for(const [id,computed,expected] of cases){assert(Math.abs(computed-expected)<1e-10,id);assert(item(id).correct.replaceAll('−','-').includes(String(expected)),id);}
 assert.equal((7-4)/(7-1),.5);assert.match(item('u3-08').correct,/1\/2/);
 assert.equal(6-1/3,17/3);assert.match(item('u5-09').correct,/17\/3/);
 assert.equal((60-40)/40,.5);assert.match(item('u6-05').correct,/1\/2/);
 assert.equal(.6*100-10,50);assert.equal(100-(.4*100-15),75);assert.match(item('u6-01').correct,/50≤s≤75/);
});
test('political voting keys survive enumeration rather than answer substitution',()=>{
 const ballots=[[5,['A','B','C']],[3,['B','C','A']],[2,['C','A','B']]];
 const scores={A:0,B:0,C:0};for(const [n,ranking] of ballots) ranking.forEach((c,i)=>scores[c]+=n*(2-i));
 assert.deepEqual(scores,{A:12,B:11,C:7});assert.match(item('u1-06').correct,/A wins with 12/);
 const ideals=[1,3,4,8,10];for(let opponent=0;opponent<=12;opponent+=.25){if(opponent===4)continue;assert(ideals.filter(x=>Math.abs(x-4)<Math.abs(x-opponent)).length>=3);}
 assert.equal(item('u1-02').correct,'4.');
 const accepts=x=>Math.abs(x-2)<2&&Math.abs(x-6)<6;
 assert.deepEqual([3,4,5,-1].filter(accepts),[3]);assert.equal(item('u5-03').correct,'3.');
});
