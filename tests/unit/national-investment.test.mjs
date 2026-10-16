import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectProjects,summarize,aggregate,annualFinancing,makeExport} from '../../src/lib/national-investment.mjs';
const {projects}=JSON.parse(await readFile(new URL('../../public/spatial-economics/national/projects.json',import.meta.url)));
const sources=JSON.parse(await readFile(new URL('../../public/spatial-economics/national/sources.json',import.meta.url)));
test('published financing reconciles across project, flow, state and tract aggregations',()=>{
  const selected=selectProjects(projects), total=7101879285855;
  assert.equal(selected.length,8439);assert.equal(summarize(selected).financingCents,total);
  for(const p of projects){assert.ok(Number.isSafeInteger(p.financingCents)&&p.financingCents>0);for(const [,v] of p.flows)assert.ok(Number.isSafeInteger(v)&&v>=0,'Nonnegative source flows prevent interval netting from changing project counts');assert.equal(p.flows.reduce((s,[,v])=>s+v,0),p.financingCents);}
  for(const key of ['state','tract'])assert.equal(aggregate(selected,key).reduce((s,p)=>s+p.financingCents,0),total);
  assert.equal(annualFinancing(projects).reduce((s,y)=>s+y.financingCents,0),total);
});
test('unmapped territory records remain in analytical totals',()=>{
  const s=summarize(selectProjects(projects));assert.equal(s.mappedProjects,8434);assert.equal(s.unmappedCents,4520000000);
  const gu=selectProjects(projects,{state:'GU'});assert.equal(gu.length,2);assert.equal(summarize(gu).mappedProjects,0);assert.equal(summarize(gu).financingCents,2390000000);
});
test('time filters select transaction flows, not full project amounts or duplicate projects',()=>{
  const example={...projects[0],financingCents:600,flows:[[2001,100],[2002,200],[2003,300]]};
  assert.deepEqual(selectProjects([example],{from:2002,to:2002}).map(p=>p.selectedCents),[200]);
  assert.equal(selectProjects([example],{from:2001,to:2003}).length,1);
  assert.equal(selectProjects([example],{from:2004,to:2023}).length,0);
  assert.throws(()=>selectProjects(projects,{from:2020,to:2010}),RangeError);
});
test('all intervals partition financing consistently with the annual series',()=>{
  for(const state of ['', 'NC','AK','PR','VI'])for(const metro of ['','Metro','Non-Metro']){
    const filters={state,metro,from:2014,to:2023};
    const amount=annualFinancing(projects,filters).filter(y=>y.year>=2014).reduce((s,y)=>s+y.financingCents,0);
    assert.equal(summarize(selectProjects(projects,filters)).financingCents,amount);
  }
});
test('exports reproduce filtered totals and preserve missing-location semantics',()=>{
  const filters={state:'AS',from:2001,to:2023};const out=makeExport(projects,filters,sources);
  assert.equal(out.summary.financingCents,out.projects.reduce((s,p)=>s+p.selectedFinancingCents,0));
  assert.ok(out.projects.every(p=>p.location===null));assert.equal(out.projects.length,2);
  assert.equal(summarize([]).nonMetroShare,null);
  assert.equal(selectProjects(projects,{state:'NO_SUCH_STATE'}).length,0);
});
