import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const items=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/urban-economics.json',import.meta.url)));
const item=id=>items.find(q=>q.id===`urban-economics-${id}`);
test('urban economics quantitative keys match independent calculations',()=>{
 const cases=[['u1-01',-200/100,-2],['u1-03',(800-200)/20,30],['u1-04',(900-500)/(60-10),8],['u1-09',3-5,-2],['u2-01',(120-20)/2-(100-20)/2,10],['u2-08',200000*(.05-.02),6000],['u2-09',200000+20000,220000],['u3-05',(80-30)-(70-25),5],['u3-06',8,8],['u3-07',4/2,2],['u4-01',100*.1,10],['u4-02',(50-10)/(1+2*.5),20],['u4-03',20*.5,10],['u4-06',(8+12*20/60)-(2+12*40/60),2],['u5-01',(12+8-10)/2,5],['u5-04',600/.05,12000],['u5-07',.01*(100e6-60e6),400000],['u5-08',(1-.4)*10,6],['u6-03',(130-100)-(90-80),20],['u6-08',4-1,3],['u6-10',5-2,3]];
 for(const [id,computed,expected] of cases){assert(Math.abs(computed-expected)<1e-7,id);assert(item(id).correct.replaceAll(',','').replaceAll('−','-').includes(String(expected)),id);}
 assert(12/1>30/3);assert.match(item('u1-08').correct,/Type L/);
 assert.equal(50-70,-20);assert.match(item('u6-09').correct,/loss of 20/);
 // Check the surplus-per-resident optimum against the whole positive grid.
 const average=n=>20+4*n-n*n;for(let n=.01;n<20;n+=.01)assert(average(n)<=average(2)+1e-10);
 // Adding an extra unit of congestion affects every existing traveler.
 const total=q=>q*(10+.5*q),h=1e-4;
 assert(Math.abs((total(20+h)-total(20-h))/(2*h)-(50-20))<1e-6);
});
