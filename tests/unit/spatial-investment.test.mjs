import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accessibility,makeGraph,shortestPaths,travelMatrix} from '../../src/lib/spatial-economics.mjs';
import {allocate,annuity,candidateSites,candidateSpacingOk,evaluatePolicy,jobAccounting,sensitivityGrid} from '../../src/lib/spatial-incentives.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../public/spatial-economics/asheville.json',import.meta.url)));
const graph=makeGraph(data),matrix=travelMatrix(data,graph);
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} vs ${b}`);
test('directed paths preserve unreachable nodes and bridge exclusions',()=>{
  const g=makeGraph({nodes:[0,1,2,3],edges:[[0,1,1,-1],[1,2,2,0],[0,2,9,-1]]});
  near(shortestPaths(g,0)[2],3);near(shortestPaths(g,0,new Set([0]))[2],9);
  assert.equal(shortestPaths(g,2)[0],Infinity);assert.equal(shortestPaths(g,0)[3],Infinity);
});
test('compressed JS routes match independent SciPy routes on original geometry',()=>{
  const oracle=JSON.parse(fs.readFileSync(new URL('../../public/spatial-economics/routing-oracle.json',import.meta.url)));
  const results=new Map();for(const p of oracle.pairs){if(!results.has(p.from))results.set(p.from,shortestPaths(graph,p.from));const actual=results.get(p.from)[p.to];if(p.minutes===null)assert.equal(actual,Infinity);else near(actual,p.minutes,0.00001);}
  assert.ok(oracle.pairs.length>=100);
});
test('allocation exhausts budget, obeys cap, and solves an independent brute-force grid',()=>{
  const scores=[.8,.6,.4],allocation=allocate(scores,.4);
  near(allocation.reduce((a,b)=>a+b),1);assert.ok(allocation.every(x=>x<=.4));
  const optimum=allocation.reduce((sum,x,i)=>sum+x*scores[i],0);
  let brute=-Infinity;for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){const c=10-a-b;if(c>=0&&c<=4)brute=Math.max(brute,(a*scores[0]+b*scores[1]+c*scores[2])/10);}
  near(optimum,brute);assert.throws(()=>allocate(scores,.2));
});
test('job accounting conserves spatial mass and budget in observed-data scenario',()=>{
  const r=evaluatePolicy(data,matrix);near(r.offers,400);near(r.induced,80);near(r.displaced,20);near(r.netJobs,60);
  near(r.cells.reduce((sum,c)=>sum+c.deltaJobs,0),r.netJobs);
  near(r.sites.reduce((sum,s)=>sum+s.budget,0),r.parameters.budget);
  assert.ok(r.sites.every(s=>s.share<=.4));
  r.cells.forEach((c,i)=>assert.ok(data.cells[i].jobs+c.deltaJobs>=0));
});
test('zero additionality produces no spatial effect and undefined cost ratio',()=>{
  const r=evaluatePolicy(data,matrix,{additionality:0});near(r.netJobs,0);assert.equal(r.costPerJobYear,null);assert.ok(r.cells.every(c=>c.gain===0&&c.deltaJobs===0));near(r.deadweightOffers,r.offers);
});
test('full within-area relocation conserves total jobs but may redistribute access',()=>{
  const r=evaluatePolicy(data,matrix,{displacement:1});near(r.netJobs,0);assert.equal(r.costPerJob,null);near(r.cells.reduce((sum,c)=>sum+c.deltaJobs,0),0);assert.ok(r.cells.some(c=>Math.abs(c.gain)>0.001));
});
test('discounting and job persistence have the specified timing',()=>{
  near(annuity(10,0),10);near(annuity(10,.03),(1-(1.03)**-10)/.03);
  const r=evaluatePolicy(data,matrix,{discount:0,years:10});near(r.costPerJobYear,10000000/600);
});
test('optimized allocation weakly improves its stated objective over equal shares',()=>{
  for(const equity of [0,.25,.5,.75,1]){const p={equity,maxShare:.4};const r=evaluatePolicy(data,matrix,p),equal=evaluatePolicy(data,matrix,{...p,allocation:'equal'});const score=v=>(1-equity)*v.groups.workers.gain+equity*v.groups.low.gain;assert.ok(score(r)>=score(equal)-1e-9);}
});
test('invalid or infeasible policy inputs are rejected',()=>{
  for(const p of [{subsidy:0},{additionality:-.1},{displacement:1.1},{years:2.5},{maxShare:.1},{halfLife:0}])assert.throws(()=>evaluatePolicy(data,matrix,p));
});
// --- Regressions: grid spacing, halfLife validation, Float64 matrix, scalar sensitivity accounting ---
const cell=(id,jobs,extra={})=>({id,jobs,workers:50,low:20,middle:20,high:10,lon:-82.5,lat:35.5,snapMeters:0,node:0,...extra});
test('candidate spacing uses exact 1 km grid indices, ignoring coordinates, and rejects sub-2 km neighbours',()=>{
  // lon/lat are deliberately identical: only the gx-gy IDs can separate these cells.
  const sites=candidateSites({cells:[cell('100-200',10),cell('101-201',9),cell('102-200',8),cell('100-202',7),cell('101-200',6)]});
  assert.deepEqual(sites.map(s=>s.id),['100-200','102-200','100-202']);
  assert.deepEqual(sites.map(s=>s.index),[0,2,3]);
  assert.ok(candidateSpacingOk({id:'0-0'},{id:'2-0'}),'exactly 2 km is admitted');
  assert.ok(!candidateSpacingOk({id:'0-0'},{id:'1-1'}),'sqrt(2) km is rejected');
  assert.ok(!candidateSpacingOk({id:'0-0'},{id:'2-0'},2001),'threshold is not rounded');
  assert.ok(candidateSpacingOk({id:'0-0'},{id:'2-0'},1999));
});
test('candidate selection is deterministic under job ties and input order',()=>{
  const cells=[cell('300-400',5),cell('301-400',5),cell('200-400',5),cell('250-400',5)];
  const ids=list=>candidateSites({cells:list}).map(s=>s.id);
  const expected=['200-400','250-400','300-400'];
  assert.deepEqual(ids(cells),expected);
  assert.deepEqual(ids([...cells].reverse()),expected);
  assert.deepEqual(ids([cells[1],cells[3],cells[0],cells[2]]),expected);
});
test('non-grid cell IDs fall back to geodesic spacing at 2 km',()=>{
  const at=(id,lat)=>({id,jobs:1,lon:-82.5,lat});
  assert.ok(!candidateSpacingOk(at('a',35.5),at('b',35.5+0.0179)));
  assert.ok(candidateSpacingOk(at('a',35.5),at('b',35.5+0.0181)));
  assert.ok(!candidateSpacingOk(at('1-1',35.5),at('b',35.5+0.0179)),'mixed ID forms use the fallback');
});
test('real-data candidate clusters are the same six under the grid method as under the legacy planar rule',()=>{
  const sites=candidateSites(data);assert.equal(sites.length,6);
  const legacy=[];for(const c of [...data.cells].sort((a,b)=>b.jobs-a.jobs)){if(legacy.every(s=>Math.hypot((s.lon-c.lon)*90500,(s.lat-c.lat)*111100)>=2000))legacy.push(c);if(legacy.length===6)break;}
  assert.deepEqual(sites.map(s=>s.id).sort(),legacy.map(s=>s.id).sort());
  sites.forEach((s,i)=>{assert.equal(data.cells[s.index].id,s.id);sites.slice(0,i).forEach(t=>assert.ok(candidateSpacingOk(s,t)));});
});
test('travel matrix keeps double precision',()=>{
  const tiny={nodes:[0,1],edges:[[0,1,1.1,-1],[1,0,1.1,-1]],cells:[{node:0,snapMeters:0},{node:1,snapMeters:0}]};
  const m=travelMatrix(tiny,makeGraph(tiny));
  assert.ok(m instanceof Float64Array);assert.equal(m[1],1.1);assert.equal(m[0],2);
});
test('nonfinite or nonpositive half-lives are rejected, including with unreachable OD pairs',()=>{
  const two={cells:[cell('10-10',100,{lon:-82.5}),cell('20-10',100,{lon:-82.4})]};
  const split=new Float64Array([2,Infinity,Infinity,2]);
  for(const halfLife of [Infinity,-Infinity,NaN,0,-5]){
    assert.throws(()=>evaluatePolicy(two,split,{halfLife,maxShare:1}),/Invalid policy/);
    assert.throws(()=>accessibility(two,split,{halfLife}),/Positive parameters/);
  }
  // An Infinity half-life on an unreachable pair would give Infinity/Infinity = NaN inside exp(); finite values stay finite.
  const ok=evaluatePolicy(two,split,{halfLife:15,maxShare:1});
  assert.ok(ok.cells.every(c=>Number.isFinite(c.gain)&&Number.isFinite(c.baseline)));
  assert.ok(Object.values(ok.groups).every(g=>Number.isFinite(g.gain)));
});
test('scalar job accounting agrees with the full evaluation for every feasible sensitivity cell',()=>{
  const grid=sensitivityGrid(data,{});
  assert.equal(grid.length,5);grid.forEach(row=>assert.equal(row.length,4));
  for(const row of grid)for(const c of row){
    assert.ok(c.feasible);const full=evaluatePolicy(data,matrix,{additionality:c.additionality,displacement:c.displacement});
    near(c.netJobs,full.netJobs);
    if(full.costPerJobYear===null)assert.equal(c.costPerJobYear,null);else near(c.costPerJobYear,full.costPerJobYear,1e-6);
  }
  const jobs=data.cells.reduce((s,c)=>s+c.jobs,0),a=jobAccounting(evaluatePolicy(data,matrix).parameters,jobs);
  near(a.netJobs,60);near(a.induced,80);near(a.displaced,20);assert.ok(a.feasible);
});
test('sensitivity cells whose relocations exceed the donor stock are marked unavailable rather than throwing',()=>{
  const small={cells:[cell('10-10',100),cell('20-10',100)]},p={subsidy:1000,maxShare:1};
  const grid=sensitivityGrid(small,p);
  // 10,000 offers: displaced = 10,000·a·d against 200 observed jobs.
  const at=(a,d)=>grid.flat().find(c=>c.additionality===a&&c.displacement===d);
  assert.equal(at(.05,.25).feasible,true);near(at(.05,.25).netJobs,375);
  for(const [a,d] of [[.05,.5],[.6,.75],[.2,.25]]){const c=at(a,d);assert.equal(c.feasible,false);assert.equal(c.netJobs,null);assert.equal(c.costPerJobYear,null);}
  const split=new Float64Array([2,Infinity,Infinity,2]);
  assert.throws(()=>evaluatePolicy(small,split,{...p,additionality:.2,displacement:.25}),/Displacement exceeds/);
  assert.throws(()=>sensitivityGrid(small,{halfLife:Infinity}),/Invalid policy/);
});
test('candidate sites report gross induced jobs and net cell job change separately',()=>{
  const r=evaluatePolicy(data,matrix),jobs=data.cells.reduce((s,c)=>s+c.jobs,0);
  r.sites.forEach(s=>{
    const index=data.cells.findIndex(c=>c.id===s.id);
    near(s.netCellJobs,r.cells[index].deltaJobs);
    near(s.netCellJobs,s.induced-r.displaced*s.existingJobs/jobs);
    assert.ok(s.netCellJobs<s.induced);
  });
});
test('worker computes scalar sensitivity and tags errors with the request id',async()=>{
  const out=[];globalThis.self={postMessage:m=>out.push(m)};
  await import('../../src/scripts/spatial-economics.worker.mjs');
  self.onmessage({data:{id:0,kind:'init',dataset:data}});
  self.onmessage({data:{id:3,kind:'calculate',parameters:{}}});
  self.onmessage({data:{id:4,kind:'calculate',parameters:{halfLife:Infinity}}});
  delete globalThis.self;
  assert.deepEqual(out.map(m=>[m.id,m.kind]),[[0,'ready'],[3,'result'],[4,'error']]);
  assert.equal(out[1].sensitivity.length,5);assert.ok(out[1].sensitivity.flat().every(c=>typeof c.feasible==='boolean'));
});
