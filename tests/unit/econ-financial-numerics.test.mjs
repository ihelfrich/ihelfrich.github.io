import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=new URL('../../content/econ-drafts/financial-economics.json',import.meta.url);
const rows=JSON.parse(fs.readFileSync(source));
const byId=new Map(rows.map(q=>[q.id.replace('financial-economics-',''),q]));
const checks=[
 ['u4-01',80*1.05,84,0],['u4-02',100-90/1.05,14.29,.005],['u4-03',Math.max(62-50,0)-4,8,0],
 ['u4-04',Math.max(70-58,0),12,0],['u4-05',100-105/1.05,0,0],['u4-07',.625*20/1.05,11.90,.005],
 ['u4-08',75-Math.max(75-60,0),60,0],['u5-03',4-1.5,2.5,0],['u5-05',.3-.4,-.1,.000001],
 ['u5-09',(.8*.5)/(.8*.5+.2*.5),.8,0],['u6-01',-100+60/1.1+60/1.1**2,4.13,.005],
 ['u6-02',-100+115/1.1,4.55,.005],['u6-03',-150+160/1.1,-4.55,.005],['u6-04',100*(Math.sqrt(242/200)-1),10,.000001],
 ['u6-06',.6*10+.4*5*(1-.25),7.5,0],['u6-08',8+.5*(8-4),10,0],['u6-10',.5*Math.max(120-80,0)+.5*Math.max(40-80,0),20,0],
 ['u1-01',1210/1.1**2,1000,.001],['u1-02',110/1.1+110/1.1**2,190.91,.005],
 ['u1-03',100*((1+.12/12)**12-1),12.68,.005],['u1-04',60/.05,1200,.001],
 ['u1-05',60/1.05+1060/1.05**2,1018.59,.005],['u1-06',100*(Math.sqrt(968/800)-1),10,.001],
 ['u1-07',4,4,0],['u1-08',100*(-6*.005),-3,.001],['u1-09',100*(1.05**2/1.04-1),6.01,.005],
 ['u1-10',100*(1.1/1.04-1),5.77,.005],['u2-01',.25*20+.75*(-4),2,0],
 ['u2-02',.5*.1**2+.5*(-.1)**2,.01,.000001],['u2-03',.3*12+.7*4,6.4,.000001],
 ['u2-04',100*Math.sqrt(.5**2*.2**2*2),14.14,.005],['u2-07',(.09-.03)/.15,.4,.000001],
 ['u2-08',1.5*8-.5*2,11,0],['u2-09',((Math.sqrt(100)+Math.sqrt(400))/2)**2,225,0],
 ['u3-02',.4*80+.5*20,42,0],['u3-03',100*(1/(.35+.6)-1),5.26,.005],
 ['u3-04',2+1.5*(8-2),11,0],['u3-05',.018/.012,1.5,.000001],
 ['u3-06',3-.5*6,0,0],['u3-07',.5*1.2*10,6,0],['u3-10',(100*1.05-80)/(120-80),.625,0],
];
test('financial draft numeric answer keys agree with independent calculations',()=>{
 for(const [id,computed,expected,tolerance] of checks){
  const q=byId.get(id);assert(q,`Missing ${id}`);
  const key=Number(q.correct.replaceAll(',','').replaceAll('−','-').match(/-?\d+(?:\.\d+)?/)[0]);
  assert.equal(key,expected,`${id} saved key changed; review required`);
  assert(Math.abs(computed-key)<=tolerance+1e-10,`${id}: ${computed} vs ${key}`);
 }
 const w=2/3;assert(Math.abs(w*.1-(1-w)*.2)<1e-12);
 assert.match(byId.get('u2-05').correct,/Two-thirds/);
 assert.match(byId.get('u2-06').correct,/0\.01/);
 assert.equal(.01+.04/1000000<.010001,true);
});
