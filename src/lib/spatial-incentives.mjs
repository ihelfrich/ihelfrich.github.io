import {accessibility} from './spatial-economics.mjs';
export const DEFAULTS={budget:10000000,subsidy:25000,additionality:.2,displacement:.25,years:10,discount:.03,halfLife:15,equity:.5,maxShare:.4,allocation:'optimized'};
export function candidateSites(data){
  const selected=[];
  for(const cell of [...data.cells].sort((a,b)=>b.jobs-a.jobs)){
    if(selected.every(s=>Math.hypot((s.lon-cell.lon)*90500,(s.lat-cell.lat)*111100)>=2000))selected.push(cell);
    if(selected.length===6)break;
  }
  return selected.map((s,i)=>({...s,index:data.cells.findIndex(c=>c.id===s.id),label:`Cluster ${String(i+1).padStart(2,'0')}`}));
}
export function annuity(years,rate){let value=0;for(let y=1;y<=years;y++)value+=1/(1+rate)**y;return value;}
export function allocate(scores,maxShare,mode='optimized'){
  if(!scores.length||maxShare*scores.length<1-1e-9)throw new Error('Infeasible concentration cap');
  if(mode==='equal')return scores.map(()=>1/scores.length);
  const order=scores.map((score,i)=>({score,i})).sort((a,b)=>b.score-a.score||a.i-b.i),weights=scores.map(()=>0);let remaining=1;
  for(const {i} of order){weights[i]=Math.min(maxShare,remaining);remaining-=weights[i];if(remaining<=1e-12)break;}
  return weights;
}
export function evaluatePolicy(data,matrix,input={}){
  const p={...DEFAULTS,...input};
  if(!Number.isFinite(p.budget)||p.budget<=0||!Number.isFinite(p.subsidy)||p.subsidy<=0||![p.additionality,p.displacement,p.equity].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!Number.isInteger(p.years)||p.years<1||p.years>50||!Number.isFinite(p.discount)||p.discount<0||!Number.isFinite(p.maxShare)||p.maxShare<=0||p.maxShare>1||!['equal','optimized'].includes(p.allocation))throw new Error('Invalid policy parameters');
  const n=data.cells.length,sites=candidateSites(data),totals={workers:0,low:0,middle:0,high:0};
  data.cells.forEach(c=>Object.keys(totals).forEach(g=>totals[g]+=c[g]));
  const base=accessibility(data,matrix,{halfLife:p.halfLife}),jobs=data.cells.reduce((sum,c)=>sum+c.jobs,0);
  const scores=sites.map(site=>{
    const reach={workers:0,low:0,middle:0,high:0};
    data.cells.forEach((c,i)=>{const k=Math.exp(-Math.LN2*matrix[i*n+site.index]/p.halfLife);Object.keys(reach).forEach(g=>reach[g]+=c[g]*k/(totals[g]||1));});
    return {...reach,objective:(1-p.equity)*reach.workers+p.equity*reach.low};
  });
  const shares=allocate(scores.map(s=>s.objective),p.maxShare,p.allocation);
  const offers=p.budget/p.subsidy,induced=offers*p.additionality,displaced=induced*p.displacement,netJobs=induced-displaced;
  if(displaced>jobs)throw new Error('Displacement exceeds observed job stock');
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
  const pvJobYears=netJobs*annuity(p.years,p.discount);
  return {parameters:p,offers,induced,displaced,netJobs,deadweightOffers:offers-induced,jobGrowthPercent:100*netJobs/jobs,pvJobYears,costPerJob:netJobs>0?p.budget/netJobs:null,costPerJobYear:pvJobYears>0?p.budget/pvJobYears:null,groups,cells,sites:sites.map((s,k)=>({id:s.id,label:s.label,lon:s.lon,lat:s.lat,existingJobs:s.jobs,share:shares[k],budget:p.budget*shares[k],induced:induced*shares[k],scores:scores[k]}))};
}
