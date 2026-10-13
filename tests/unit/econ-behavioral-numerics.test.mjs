import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const items=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/behavioral-economics.json',import.meta.url)));
const map=new Map(items.map(q=>[q.id.replace('behavioral-economics-',''),q]));
test('behavioral numerical keys match independent model calculations',()=>{
 const cases=[['u1-01',.5*30+.5*2*(-20),-5],['u1-05',.05*100,5],['u2-01',.9**2*100,81],['u2-06',.5*(-8+12),2],['u4-02',10-.5*(18-10),6],['u4-08',30-12,18],['u5-03',0,0],['u5-04',Math.exp(Math.log(2)*3)/(Math.exp(Math.log(2)*3)+Math.exp(Math.log(2))),.8],['u5-08',4+.25*(10-4),5.5],['u6-02',120-100,20],['u6-03',20/.4,50],['u6-04',3,3],['u6-05',20*.05,1],['u6-09',80*5-20*4-100,220]];
 for(const [id,calc,expected] of cases){assert(Math.abs(calc-expected)<1e-10);const n=Number(map.get(id).correct.replaceAll('−','-').match(/-?\d+(?:\.\d+)?/)[0]);assert.equal(n,expected,id);}
 assert(-.5*Math.sqrt(100)>-Math.sqrt(50));assert.match(map.get('u1-04').correct,/risky loss is preferred/);
 assert(70*.6>50*.6&&50>70*.6);assert.match(map.get('u2-03').correct,/Choose 70 initially/);
 assert(Math.abs(.08/(.08+.18)*100-30.8)<.05);assert.match(map.get('u3-01').correct,/30.8/);
 assert.equal((1/4)*6,3/2);assert.match(map.get('u3-02').correct,/3:2/);
 assert.equal(8+.5*10,13);assert.match(map.get('u4-01').correct,/utility 13/);
 assert.equal(16-.25*8,14);assert.match(map.get('u4-03').correct,/utility 14/);
 assert.match(map.get('u5-02').correct,/200\/9/);assert.equal((100/3)*(2/3),200/9);
});
