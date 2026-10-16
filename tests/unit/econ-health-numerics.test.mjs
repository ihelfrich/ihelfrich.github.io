import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const items=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/health-economics.json',import.meta.url)));
const item=id=>items.find(q=>q.id===`health-economics-${id}`);
test('health evaluation keys agree with independent incremental calculations',()=>{
 const cases=[['u5-01',(16000-10000)/(4.3-4),20000],['u5-03',40000*.4-12000,4000],['u5-04',2*.6+3*.8,3.6],['u5-05',11025/1.05**2,10000],['u5-09',9000/30000,.3],['u5-10',2400-2700,-300],['u6-01',40+25,65],['u6-06',8*1.5,12],['u6-08',6000/25000*100,24]];
 for(const [id,computed,expected] of cases){assert(Math.abs(computed-expected)<1e-7,id);const normalized=item(id).correct.replaceAll(',','').replaceAll('−','-').replaceAll('$','');assert(normalized.includes(String(expected)),id);}
 assert(5000<7000&&3>2.8);assert.match(item('u5-02').correct,/A strictly dominates B/);
 assert.equal((1+3)/2,2);assert.equal((1000+5000)/2,3000);assert(3000<4000);assert.match(item('u5-08').correct,/extendedly dominated/);
});
test('health conceptual corrections preserve their stated identifying assumptions',()=>{
 assert.match(item('u6-03').prompt,/cannot prevent anyone/);
 assert.match(item('u6-07').prompt,/mean-preserving contraction/);
 assert.match(item('u5-10').prompt,/no spillovers/);
 assert.match(item('u3-10').correct,/130/);
 assert(item('u3-10').wrong.some(x=>x.includes('difference between')));
 assert.equal(item('u4-09').wrong.length,3);
 assert(item('u4-09').wrong.every(x=>/marginal production cost/.test(x)));
});
