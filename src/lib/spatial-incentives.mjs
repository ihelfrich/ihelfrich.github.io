import {accessibility} from './spatial-economics.mjs';
export const DEFAULTS={budget:10000000,subsidy:25000,additionality:.2,displacement:.25,years:10,discount:.03,halfLife:15,equity:.5,maxShare:.4,allocation:'optimized'};
export const GRID_METERS=1000,CANDIDATE_SPACING_METERS=2000;
const GRID_ID=/^(\d+)-(\d+)$/;
function gridCoordinates(id){const m=GRID_ID.exec(String(id));return m?[Number(m[1]),Number(m[2])]:null;}
// Haversine fallback for cells whose IDs do not encode UTM kilometre grid indices.
function geodesicMeters(a,b){
  const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 2*6371008.8*Math.asin(Math.min(1,Math.sqrt(h)));
}
// Cell IDs are `gx-gy` indices of the 1 km UTM grid; integer arithmetic makes the spacing threshold exact.
export function candidateSpacingOk(a,b,spacing=CANDIDATE_SPACING_METERS,gridMeters=GRID_METERS){
  const ga=gridCoordinates(a.id),gb=gridCoordinates(b.id);
  if(ga&&gb){const dx=ga[0]-gb[0],dy=ga[1]-gb[1];return (dx*dx+dy*dy)*gridMeters*gridMeters>=spacing*spacing;}
  return geodesicMeters(a,b)>=spacing;
}
export function candidateSites(data){
  const selected=[];
  // Highest jobs first; ties break on cell ID, then input position, so the choice never depends on sort stability.
  const order=data.cells.map((cell,index)=>({cell,index})).sort((a,b)=>b.cell.jobs-a.cell.jobs||(a.cell.id<b.cell.id?-1:a.cell.id>b.cell.id?1:0)||a.index-b.index);
  for(const {cell,index} of order){
    if(selected.every(s=>candidateSpacingOk(s.cell,cell,CANDIDATE_SPACING_METERS,data.gridMeters??GRID_METERS)))selected.push({cell,index});
    if(selected.length===6)break;
  }
  return selected.map(({cell,index},i)=>({...cell,index,label:`Cluster ${String(i+1).padStart(2,'0')}`}));
}
export function annuity(years,rate){let value=0;for(let y=1;y<=years;y++)value+=1/(1+rate)**y;return value;}
export function allocate(scores,maxShare,mode='optimized'){
  if(!scores.length||maxShare*scores.length<1-1e-9)throw new Error('Infeasible concentration cap');
  if(mode==='equal')return scores.map(()=>1/scores.length);
  const order=scores.map((score,i)=>({score,i})).sort((a,b)=>b.score-a.score||a.i-b.i),weights=scores.map(()=>0);let remaining=1;
  for(const {i} of order){weights[i]=Math.min(maxShare,remaining);remaining-=weights[i];if(remaining<=1e-12)break;}
  return weights;
}
export function validatePolicy(p){
  if(!Number.isFinite(p.budget)||p.budget<=0||!Number.isFinite(p.subsidy)||p.subsidy<=0||![p.additionality,p.displacement,p.equity].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!Number.isInteger(p.years)||p.years<1||p.years>50||!Number.isFinite(p.discount)||p.discount<0||!Number.isFinite(p.maxShare)||p.maxShare<=0||p.maxShare>1||!Number.isFinite(p.halfLife)||p.halfLife<=0||!['equal','optimized'].includes(p.allocation))throw new Error('Invalid policy parameters');
  return p;
}
// Scalar job accounting shared by the spatial evaluation and the sensitivity grid. `feasible` is false when
// within-area relocations would exceed the observed donor job stock.
export function jobAccounting(p,jobs){
  const offers=p.budget/p.subsidy,induced=offers*p.additionality,displaced=induced*p.displacement,netJobs=induced-displaced;
  const pvJobYears=netJobs*annuity(p.years,p.discount);
  return {offers,induced,displaced,netJobs,feasible:displaced<=jobs,pvJobYears,costPerJob:netJobs>0?p.budget/netJobs:null,costPerJobYear:pvJobYears>0?p.budget/pvJobYears:null};
}
export function sensitivityGrid(data,input={},additionalities=[.05,.1,.2,.4,.6],displacements=[0,.25,.5,.75]){
  const p=validatePolicy({...DEFAULTS,...input}),jobs=data.cells.reduce((sum,c)=>sum+c.jobs,0);
  return additionalities.map(additionality=>displacements.map(displacement=>{
    const q=validatePolicy({...p,additionality,displacement}),a=jobAccounting(q,jobs);
    return a.feasible?{additionality,displacement,feasible:true,netJobs:a.netJobs,costPerJobYear:a.costPerJobYear}:{additionality,displacement,feasible:false,netJobs:null,costPerJobYear:null};
  }));
}
export function evaluatePolicy(data,matrix,input={}){
  const p=validatePolicy({...DEFAULTS,...input});
  const n=data.cells.length,sites=candidateSites(data),totals={workers:0,low:0,middle:0,high:0};
  data.cells.forEach(c=>Object.keys(totals).forEach(g=>totals[g]+=c[g]));
  const base=accessibility(data,matrix,{halfLife:p.halfLife}),jobs=data.cells.reduce((sum,c)=>sum+c.jobs,0);
  const scores=sites.map(site=>{
    const reach={workers:0,low:0,middle:0,high:0};
    data.cells.forEach((c,i)=>{const k=Math.exp(-Math.LN2*matrix[i*n+site.index]/p.halfLife);Object.keys(reach).forEach(g=>reach[g]+=c[g]*k/(totals[g]||1));});
    return {...reach,objective:(1-p.equity)*reach.workers+p.equity*reach.low};
  });
  const shares=allocate(scores.map(s=>s.objective),p.maxShare,p.allocation);
  const acct=jobAccounting(p,jobs),{offers,induced,displaced,netJobs,pvJobYears}=acct;
  if(!acct.feasible)throw new Error('Displacement exceeds observed job stock');
  const deltaJobs=data.cells.map(c=>-displaced*c.jobs/jobs);
  sites.forEach((s,k)=>{deltaJobs[s.index]+=induced*shares[k];});
  const groups={};Object.keys(totals).forEach(g=>groups[g]={workers:totals[g],baseline:0,gain:0});
  const cells=data.cells.map((c,i)=>{
    let gain=-displaced/jobs*base.gravity[i];
    sites.forEach((s,k)=>{gain+=induced*shares[k]*Math.exp(-Math.LN2*matrix[i*n+s.index]/p.halfLife);});
    Object.keys(groups).forEach(g=>{groups[g].baseline+=c[g]*base.gravity[i]/(totals[g]||1);groups[g].gain+=c[g]*gain/(totals[g]||1);});
    return {id:c.id,gain,baseline:base.gravity[i],percent:base.gravity[i]>0?100*gain/base.gravity[i]:null,deltaJobs:deltaJobs[i]};
  });
  Object.values(groups).forEach(g=>g.percent=g.baseline>0?100*g.gain/g.baseline:null);
  return {parameters:p,offers,induced,displaced,netJobs,deadweightOffers:offers-induced,jobGrowthPercent:100*netJobs/jobs,pvJobYears,costPerJob:acct.costPerJob,costPerJobYear:acct.costPerJobYear,groups,cells,sites:sites.map((s,k)=>({id:s.id,label:s.label,lon:s.lon,lat:s.lat,existingJobs:s.jobs,share:shares[k],budget:p.budget*shares[k],induced:induced*shares[k],netCellJobs:deltaJobs[s.index],scores:scores[k]}))};
}
