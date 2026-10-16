import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const items=JSON.parse(fs.readFileSync(new URL('../../content/econ-drafts/advanced-macroeconomics.json',import.meta.url)));
const item=id=>items.find(q=>q.id===`advanced-macroeconomics-${id}`);
test('advanced macro initial quantitative keys respect gross returns and timing',()=>{
 const cases=[['u1-02',1/.96-1+.08,.12167,.000005],['u1-03',(.09-.04-.03)/2,.01,1e-10],['u1-09',(1-.1)*20+10-6,22,1e-10],['u2-01',.5/(1+.5)*12,4,1e-10],['u2-02',6/1.2,5,1e-10],['u2-06',1+.03,1.03,1e-10],['u2-08',(1.2*12-6)/(2*1.2),3.5,1e-10],['u3-02',100-15-25,60,1e-10],['u3-03',.7*100/50,1.4,1e-10]];
 for(const [id,value,expected,tolerance] of cases){assert(Math.abs(value-expected)<tolerance,id);assert(item(id).correct.includes(String(expected)),id);}
 assert(Math.abs(Math.sqrt(.96*1.05)-1.004)<.00001);assert.match(item('u1-01').correct,/√1.008/);
 const k=1/16;assert.equal(Math.sqrt(k)/4,k);assert.match(item('u2-04').correct,/1\/16/);
 const lifetime=s=>Math.log(12-s)+Math.log(1.2*s+6);
 for(let s=-4.9;s<12;s+=.01)assert(lifetime(s)<=lifetime(3.5)+1e-10);
 // Risky-asset Euler equation must retain covariance; means do not substitute.
 const discount=[.8,1.2],returns=[1.4,.7333333333333334];
 const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
 assert(Math.abs(mean(discount.map((m,i)=>m*returns[i]))-1)<1e-12);
 assert(Math.abs(mean(discount)*mean(returns)-1)>.05);
 assert.match(item('u3-06').correct,/E_t\[m_\(t\+1\)R_\(t\+1\)\]=1/);
});
test('advanced macro linearization and policy keys satisfy their equations',()=>{
 const cases=[['u4-02',.8*.01+.2*.05,.018,1e-12],['u4-04',.8**2*.02,.0128,1e-12],['u5-01',-.02/2,-.01,1e-12],['u5-02',.99*.02+.1*(-.01),.0188,1e-12],['u5-03',1/.25,4,1e-12],['u5-05',1.5-1,.5,1e-12],['u5-06',-(0-0-(-.02)),-.02,1e-12],['u6-01',2*.03,.06,1e-12],['u6-04',-.5*.02/(.5**2+.25),-.02,1e-12],['u6-06',1.03*100-4,99,1e-12],['u6-07',(1.04/1.02-1)*.6,.011765,5e-7]];
 for(const [id,value,expected,tolerance] of cases){assert(Math.abs(value-expected)<tolerance,id);assert(item(id).correct.replaceAll('−','-').includes(String(expected)),id);}
 let forwardSum=0;for(let j=0;j<100;j++)forwardSum+=.45**j;
 assert(Math.abs(forwardSum-1/(1-.45))<1e-12);
 const loss=x=>((.5*x+.02)**2+.25*x*x)/2;
 for(let x=-.1;x<=.1;x+=.0001)assert(loss(x)>=loss(-.02)-1e-12);
 const surplus=(1.04/1.02-1)*.6;
 assert(Math.abs(1.04/1.02*.6-surplus-.6)<1e-12);
});
