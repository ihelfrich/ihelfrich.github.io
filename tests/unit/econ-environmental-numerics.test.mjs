import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const items=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/environmental-economics.json',import.meta.url)));
const byId=new Map(items.map(q=>[q.id.replace('environmental-economics-',''),q]));
test('environmental draft numerical keys agree with independent calculations',()=>{
 const cases=[['u1-01',100-20-20,60],['u1-02',80/(2+2),20],['u1-03',6*5,30],['u1-04',(12+8-10)/2,5],['u1-07',.5*20*20,200],['u2-02',12/2,6],['u2-03',25,25],['u3-01',.5*(6-2)*(12-2*2),16],['u3-06',18*2000,36000],['u3-08',30/(1/100000),3000000],['u4-01',.9*100+20,110],['u4-02',(1-.95)*200,10],['u4-03',12+28,40],['u4-04',121/1.1**2,100],['u5-01',10+(30-10)*1.05,31],['u5-05',100/2,50],['u5-06',80+12-18,74],['u6-01',-100+60/1.1+60/1.1**2,4.13],['u6-03',2*40-60,20],['u6-04',350-300,50],['u6-10',90*1.05,94.5]];
 for(const [id,calc,expected] of cases){const key=Number(byId.get(id).correct.replaceAll(',','').match(/\d+(?:\.\d+)?/)[0]);assert.equal(key,expected,id);assert(Math.abs(calc-key)<.005,`${id}: ${calc} vs ${key}`);}
 assert.equal(2*8,4*4);assert.equal(8+4,12);assert.match(byId.get('u2-01').correct,/a = 8 and b = 4/);
 assert.equal(100-30,70);assert.equal(30/100,.3);assert.match(byId.get('u4-07').correct,/70 tons and 30%/);
 assert.equal(40-10,30);assert.equal(10/40,.25);assert.match(byId.get('u4-10').correct,/30 units and 25%/);
 assert(1080/1.1<1000);assert.match(byId.get('u5-10').correct,/Sell now/);
 assert.equal((50-80)-(60-70),-20);assert.match(byId.get('u6-07').correct,/reduction of 20/);
 assert.equal(30000/10,3000);assert.match(byId.get('u6-09').correct,/3,000/);
});
