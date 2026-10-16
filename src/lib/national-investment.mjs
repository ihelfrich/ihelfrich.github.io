/** Descriptive NMTC aggregation. All arithmetic in integer nominal US cents. */
export const YEAR_MIN = 2001;
export const YEAR_MAX = 2023;
export function validateFilters({from=YEAR_MIN,to=YEAR_MAX,state='',metro='',type=''}={}) {
  if (!Number.isInteger(from)||!Number.isInteger(to)||from<YEAR_MIN||to>YEAR_MAX||from>to) throw new RangeError('Select an ordered origination-year interval.');
  return {from,to,state,metro,type};
}
export function selectProjects(projects, filters={}) {
  const f=validateFilters(filters);
  return projects.flatMap(p=>{
    if((f.state&&p.state!==f.state)||(f.metro&&p.metro!==f.metro)||(f.type&&p.type!==f.type))return [];
    const selectedCents=p.flows.reduce((sum,[year,value])=>sum+(year>=f.from&&year<=f.to?value:0),0);
    return selectedCents>0?[{...p,selectedCents}]:[];
  });
}
export function summarize(projects) {
  const result={projects:projects.length,financingCents:0,nonMetroCents:0,mappedProjects:0,unmappedCents:0,multiTractProjects:0};
  for(const p of projects){
    result.financingCents+=p.selectedCents;
    if(p.metro==='Non-Metro')result.nonMetroCents+=p.selectedCents;
    if(p.point)result.mappedProjects++;else result.unmappedCents+=p.selectedCents;
    if(p.multiTract)result.multiTractProjects++;
  }
  result.nonMetroShare=result.financingCents?result.nonMetroCents/result.financingCents:null;
  result.meanProjectCents=result.projects?result.financingCents/result.projects:null;
  return result;
}
export function aggregate(projects, key) {
  if(!['state','tract'].includes(key))throw new RangeError('Unsupported geographic aggregation');
  const groups=new Map();
  for(const p of projects){const id=p[key];if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p);}
  return [...groups].map(([id,rows])=>({id,...summarize(rows),rows})).sort((a,b)=>b.financingCents-a.financingCents||a.id.localeCompare(b.id));
}
export function annualFinancing(projects,filters={}) {
  const f=validateFilters(filters), years=Array.from({length:YEAR_MAX-YEAR_MIN+1},(_,i)=>({year:YEAR_MIN+i,financingCents:0,projects:0}));
  for(const p of projects){
    if((f.state&&p.state!==f.state)||(f.metro&&p.metro!==f.metro)||(f.type&&p.type!==f.type))continue;
    for(const [year,value] of p.flows){const bucket=years[year-YEAR_MIN];if(bucket){bucket.financingCents+=value;if(value>0)bucket.projects++;}}
  }
  return years;
}
export function makeExport(projects,filters,sourceManifest) {
  const f=validateFilters(filters),selected=selectProjects(projects,f);
  return {schemaVersion:1,filters:f,summary:summarize(selected),
    method:sourceManifest.method,sources:sourceManifest.sources,release:sourceManifest.release,
    projects:selected.map(p=>({id:p.id,state:p.state,city:p.city,tract:p.tract,metro:p.metro,type:p.type,
      selectedFinancingCents:p.selectedCents,lifetimeReportedFinancingCents:p.financingCents,
      selectedFlows:p.flows.filter(([year])=>year>=f.from&&year<=f.to),
      location:p.point?{longitude:p.point[0],latitude:p.point[1],kind:'2020 Census tract internal point'}:null,
      multiTract:p.multiTract,multiCde:p.multiCde}))};
}
