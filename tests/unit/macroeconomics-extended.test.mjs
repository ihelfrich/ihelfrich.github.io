import test from 'node:test';
import assert from 'node:assert/strict';
const m=await import('../../src/lib/macroeconomics-extended.mjs').catch(()=>({}));
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
const two={alpha:.33,s:.2,delta:.06,n:.01,eta:.08,u:.7,K0:100,L0:100,H0:1,T:40};
const ram={alpha:.33,beta:.95,delta:.1,gamma:2,N:81,kRatio:.6,T:40};
const hh={beta:.94,r:.02,w:1,gamma:2,spread:.5,stay:.9,N:61,amax:20};
test('two sectors preserve goods, equipment, workers and human capital separately',()=>{
 assert.equal(typeof m.twoSector,'function');const r=m.twoSector(two);
 for(const x of r.rows){near(x.Y,x.C+x.I);near(x.K1,x.K+x.I-x.D);near(x.H1,x.H*(1+two.eta*(1-two.u)));near(x.L1,x.L*(1+two.n));near(x.productionWorkers+x.educationWorkers,x.L);}
 const noSchool=m.twoSector({...two,u:1});near(noSchool.rows.at(-1).H,1);
});
test('Ramsey grid policy is feasible and approaches an independently known log/full-depreciation policy',()=>{
 assert.equal(typeof m.ramsey,'function');const r=m.ramsey({...ram,gamma:1,delta:1,N:161});
 for(const x of r.rows){near(x.c+x.k1,x.k**ram.alpha);assert.ok(x.c>0);}
 near(r.rows[0].k1,ram.alpha*ram.beta*r.rows[0].k**ram.alpha,.007);assert.ok(r.residual<1e-7);
});
test('analytic RBC benchmark obeys Euler and resource conditions; zero shock is stationary',()=>{
 assert.equal(typeof m.rbc,'function');const p={alpha:.33,beta:.96,rho:.8,shock:.02,T:40},r=m.rbc(p);
 for(const x of r.rows){near(x.c+x.k1,x.y);near(x.k1,p.alpha*p.beta*x.y);near(x.y,x.z*x.k**p.alpha);}
 const z=m.rbc({...p,shock:0});for(const x of z.rows)near(x.k,z.steady);
 for(let t=0;t<r.rows.length-1;t++)near(1/r.rows[t].c,p.beta*p.alpha*r.rows[t+1].y/r.rows[t].k1/r.rows[t+1].c);
});
test('open economy optimum satisfies both budgets and Euler condition',()=>{
 assert.equal(typeof m.openEconomy,'function');const p={y0:1,y1:1.2,b0:0,r:.04,beta:.96,gamma:2},r=m.openEconomy(p);
 near(r.c0+r.c1/(1+p.r),(1+p.r)*p.b0+p.y0+p.y1/(1+p.r));near(r.c1/r.c0,(p.beta*(1+p.r))**(1/p.gamma));near(r.b1-p.b0,r.ca);near((1+p.r)*r.b1+p.y1-r.c1,0);
});
test('matching flow law stays in [0,1], conserves workers, and converges to the Beveridge locus',()=>{
 assert.equal(typeof m.matching,'function');const p={eff:.4,theta:1,eta:.5,separation:.03,u0:.12,T:80},r=m.matching(p);
 for(const x of r.rows){near(x.u1,x.u+x.inflow-x.outflow);assert.ok(x.u1>=0&&x.u1<=1);}
 near(r.rows.at(-1).u,r.steady,1e-7);assert.ok(m.matching({...p,theta:2}).steady<r.steady);
});
test('incomplete markets solve a feasible household problem and conserve distribution mass',()=>{
 assert.equal(typeof m.household,'function');const r=m.household(hh);assert.ok(r.residual<1e-7);assert.ok(r.distributionResidual<1e-8);
 near(r.distribution.flat().reduce((a,b)=>a+b,0),1);
 for(let z=0;z<2;z++)for(let i=0;i<hh.N;i++){near(r.consumption[z][i]+r.policy[z][i],hh.w*r.z[z]+(1+hh.r)*r.grid[i]);assert.ok(r.consumption[z][i]>0);assert.ok(r.distribution[z][i]>=0);}
 near(r.meanConsumption,hh.w+hh.r*r.meanAssets,1e-6);assert.deepEqual(m.household(hh),r);
});
test('sequence-space operator satisfies market clearing, causality, and known no-lag multiplier',()=>{
 assert.equal(typeof m.sequence,'function');const p={mpc:.6,lag:.4,shock:1,shockAt:4,T:20},r=m.sequence(p);
 for(const x of r.rows){near(x.y,x.c+x.g);near(x.c,r.J[x.t].reduce((a,b,j)=>a+b*r.rows[j].y,0));if(x.t<4)near(x.y,0);}
 const q=m.sequence({...p,lag:0});near(q.rows[4].y,2.5);assert.ok(r.residual<1e-10);
 for(let s=0;s<=p.T;s++)for(let t=0;t<=p.T;t++)near(r.M[t][s]-(t===s?1:0),r.J[t].reduce((sum,v,j)=>sum+v*r.M[j][s],0));
});
test('extended engines reject nonfinite and out-of-domain controls',()=>{
 for(const [name,p,key] of [['twoSector',two,'u'],['ramsey',ram,'beta'],['household',hh,'N']])assert.throws(()=>m[name]({...p,[key]:NaN}));
});
test('all seven additional models remain finite across reproducible control-domain fixtures',async()=>{
 const {extendedModels}=await import('../../src/data/macroeconomics-extended.mjs');let seed=37911;
 const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/2**32);
 const finite=v=>{if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);};
 for(const model of extendedModels)for(let run=0;run<10;run++){
  const p={...model.defaults};for(const f of model.fields){if(f.key==='N'){p.N=41;continue;}if(f.options)continue;p[f.key]=Number(Math.min(f.max,f.min+Math.round(random()*(f.max-f.min)/f.step)*f.step).toPrecision(12));}
  const result=m[model.id](p);finite(result);assert.deepEqual(m[model.id](p),result);if(result.rows)for(const v of result.rows)assert.ok(Number.isFinite(v.t));
  if(result.distribution){near(result.distribution.flat().reduce((s,v)=>s+v,0),1);assert.ok(result.distributionResidual<1e-8);}
 }
});
test('household zero-risk case and aggregate steady resource identity survive grid refinement',()=>{
 for(const N of [41,61,101]){const r=m.household({...hh,N});near(r.meanConsumption,hh.w+hh.r*r.meanAssets,1e-6);assert.ok(r.residual<1e-7);}
 const r=m.household({...hh,spread:0});near(r.meanAssets,0,1e-6);near(r.meanConsumption,hh.w,1e-6);
});
test('new engines are independent of browser, wall clock, and random entropy',async()=>{
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../../src/lib/macroeconomics-extended.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|document\.|window\.|crypto\./);
});
