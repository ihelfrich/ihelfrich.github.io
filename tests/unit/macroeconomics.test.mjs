import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {models} from '../../src/data/macroeconomics.mjs';
const m = await import('../../src/lib/macroeconomics.mjs').catch(() => ({}));
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const solow={B:1,alpha:.5,s:.2,delta:.03,n:.02,g:0,K0:1600,L0:100,T:80};
test('Solow preserves resources and capital per worker at the exact discrete steady state',()=>{
  assert.equal(typeof m.solow,'function');const r=m.solow(solow);
  close(r.steady,16);close(r.rows[0].Y,400);close(r.rows[0].I,80);close(r.rows[0].D,48);
  for(const v of r.rows){close(v.C+v.I,v.Y);close(v.K1,v.K+v.I-v.D);close(v.k,16);close(v.L1,v.L*(1+solow.n));}
});
test('Solow uses exact population and technology dilution and recovers CRS',()=>{
  const p={...solow,g:.02};const q=m.solow(p);
  close(q.steady,(p.s*p.B/((1+p.n)*(1+p.g)-1+p.delta))**(1/(1-p.alpha)));
  const scale=m.solow({...p,K0:p.K0*3,L0:p.L0*3});
  close(scale.rows[1].Y,3*q.rows[1].Y);close(scale.rows[1].q,q.rows[1].q);
  assert.ok(m.solow({...solow,n:.04}).rows[1].k<16);
  assert.equal(m.solow({...solow,s:0}).steady,0);
  assert.equal(m.solow({...solow,n:0,delta:0,g:0}).steady,null);
});
test('AK growth recovers the textbook example and exact depreciation/population accounting',()=>{
  const r=m.ak({a:.25,s:.2,delta:0,n:0,K0:200,L0:100,T:3});
  close(r.rows[0].Y,50);close(r.rows[1].K,210);close(r.growth,.05);
  const q=m.ak({a:.25,s:.3,delta:.03,n:.02,K0:200,L0:100,T:3});
  close(q.growth,(1+.3*.25-.03)/1.02-1);
  close(q.rows[1].k/q.rows[0].k-1,q.growth);
});
test('fixed-cost growth trap has the manufactured stable and unstable equilibria',()=>{
  const p={s:.2,delta:.03,n:.02,a:.5,F:36,k0:8,T:60};const r=m.trap(p);
  close(r.roots[0].k,16,1e-7);close(r.roots[1].k,72,1e-7);
  assert.equal(r.roots[0].stable,true);assert.equal(r.roots[1].stable,false);
  assert.ok(m.trap({...p,k0:70}).rows[1].k<70);
  assert.ok(m.trap({...p,k0:74}).rows[1].k>74);
});
test('Diamond log-utility OLG satisfies saving, cohort accounting and household Euler equation',()=>{
  const p={B:1,alpha:.33,beta:.96,delta:1,n:.02,k0:.2,T:40};const r=m.olg(p);
  for(const v of r.rows){close(v.cy+v.saving,v.wage);close(v.k1,v.saving/(1+p.n));close(1/v.cy,p.beta*v.R1/v.co);}
  close(r.steady,(p.beta/(1+p.beta)*(1-p.alpha)*p.B/(1+p.n))**(1/(1-p.alpha)));
});
test('IS-LM solves both market-clearing conditions and the fiscal multiplier',()=>{
  const p={G:50,T:40,M:200,c:.7,b:800};const r=m.islm(p);
  close(r.Y,r.C+r.I+p.G);close(p.M,.8*r.Y-1000*r.r);
  close(m.islm({...p,G:51}).Y-r.Y,r.multiplier);
  assert.ok(m.islm({...p,M:201}).r<r.r);
});
test('NK solution satisfies all forward-looking equations and flags indeterminacy',()=>{
  const p={beta:.99,sigma:1,kappa:.1,phiPi:1.5,phiX:.125,rho:.7,shock:.01,kind:'policy',T:24};
  const r=m.newKeynesian(p);assert.equal(r.determinate,true);assert.ok(r.rows[0].x<0);assert.ok(r.rows[0].pi<0);
  for(const v of r.rows){close(v.x,p.rho*v.x-(v.i-p.rho*v.pi-v.rn)/p.sigma);close(v.pi,p.beta*p.rho*v.pi+p.kappa*v.x+v.u);close(v.i,p.phiPi*v.pi+p.phiX*v.x+v.v);}
  assert.equal(m.newKeynesian({...p,phiPi:.5,phiX:0}).determinate,false);
  close(m.newKeynesian({...p,shock:0}).rows[0].x,0);
  assert.ok(m.newKeynesian({...p,kind:'cost'}).rows[0].pi>0);
});
test('debt dynamics use exact interest-growth arithmetic and stabilizing surplus',()=>{
  const p={r:.04,g:.02,p:.02,b0:.8,T:40};const r=m.debt(p);
  close(r.rows[1].b,1.04/1.02*.8-.02);
  const stable=m.debt({...p,p:r.stabilizing});for(const row of stable.rows)close(row.b,.8);
  assert.equal(m.debt({...p,r:.02,g:.04}).stable,true);
});
test('optimal growth solver respects feasibility, Markov probabilities and Bellman tolerance',()=>{
  const p={alpha:.33,beta:.95,delta:.1,gamma:2,spread:.1,stay:.9,N:51};const r=m.optimalGrowth(p);
  assert.equal(r.converged,true);assert.ok(r.residual<1e-7);assert.ok(r.errorBound<1e-5);
  r.grid.forEach((k,i)=>r.z.forEach((z,j)=>{const kp=r.policy[j][i],c=r.consumption[j][i];assert.ok(c>0);close(c+kp,z*k**p.alpha+(1-p.delta)*k);if(i>0)assert.ok(kp>=r.policy[j][i-1]);}));
  assert.deepEqual(r,m.optimalGrowth(p));
});
test('optimal growth converges toward the analytic log/full-depreciation policy as the grid refines',()=>{
  const p={alpha:.33,beta:.95,delta:1,gamma:1,spread:0,stay:.9};
  const error=r=>Math.sqrt(r.grid.reduce((sum,k,i)=>sum+(r.policy[0][i]-p.alpha*p.beta*k**p.alpha)**2,0)/r.grid.length);
  const coarse=m.optimalGrowth({...p,N:41}),fine=m.optimalGrowth({...p,N:81});
  assert.ok(error(fine)<error(coarse));assert.ok(error(fine)<2*(fine.grid[1]-fine.grid[0]));
});
test('invalid economic domains fail explicitly',()=>{
  assert.throws(()=>m.solow({...solow,alpha:1}),/alpha/i);
  assert.throws(()=>m.solow({...solow,K0:NaN}),/K0/i);
  assert.throws(()=>m.solow({...solow,s:1.1}),/s/i);
  assert.throws(()=>m.optimalGrowth({alpha:.33,beta:1,delta:.1,gamma:2,spread:.1,stay:.9,N:41}),/beta/i);
});
test('192 seeded parameter fixtures remain finite, deterministic and within numerical tolerance',()=>{
  let seed=78117;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const aliases={nk:'newKeynesian',optimal:'optimalGrowth'};
  function checkFinite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')for(const v of Object.values(value))checkFinite(v);}
  for(const model of models)for(let i=0;i<24;i++){
    const p={...model.defaults};for(const f of model.fields){if(f.key==='N'){p.N=41;continue;}if(f.options){p[f.key]=f.options[Math.floor(random()*f.options.length)][0];continue;}p[f.key]=Math.min(f.max,f.min+Math.round(random()*(f.max-f.min)/f.step)*f.step);if(f.key==='T')p.T=Math.round(p.T);}
    const result=m[aliases[model.id]||model.id](p);checkFinite(result);assert.deepEqual(result,m[aliases[model.id]||model.id](p));
    if(result.residual!==undefined)assert.ok(result.residual<1e-7);
    if(result.converged!==undefined)assert.equal(result.converged,true);
  }
});
test('numerical engines have no wall-clock, entropy or DOM dependencies',async()=>{
  const source=await readFile(new URL('../../src/lib/macroeconomics.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|document\.|window\.|crypto\./);
});
test('near-singular New Keynesian coefficients fail explicitly',()=>{
  assert.throws(()=>m.newKeynesian({beta:.99,sigma:1,kappa:.1,phiPi:.791,phiX:0,rho:.9,shock:.01,kind:'policy',T:24}),/singular/);
});
