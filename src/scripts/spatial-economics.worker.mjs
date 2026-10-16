import {makeGraph,travelMatrix} from '../lib/spatial-economics.mjs';
import {evaluatePolicy} from '../lib/spatial-incentives.mjs';
let data,matrix;
self.onmessage=({data:message})=>{
  const {id,kind}=message;
  try{
    if(kind==='init'){data=message.dataset;matrix=travelMatrix(data,makeGraph(data));self.postMessage({id,kind:'ready'});return;}
    const result=evaluatePolicy(data,matrix,message.parameters);
    const equalComparison=evaluatePolicy(data,matrix,{...message.parameters,allocation:'equal'}).groups;
    const sensitivity=[.05,.1,.2,.4,.6].map(additionality=>[0,.25,.5,.75].map(displacement=>{const r=evaluatePolicy(data,matrix,{...message.parameters,additionality,displacement});return {additionality,displacement,netJobs:r.netJobs,costPerJobYear:r.costPerJobYear};}));
    const frontier=[0,.25,.5,.75,1].map(equity=>{const r=evaluatePolicy(data,matrix,{...message.parameters,equity,allocation:'optimized'});return {equity,all:r.groups.workers.gain,low:r.groups.low.gain,shares:r.sites.map(s=>s.share)};});
    self.postMessage({id,kind:'result',result,sensitivity,frontier,equalComparison});
  }catch{self.postMessage({id,kind:'error',message:'The model could not calculate these parameters. Reload to restart.'});}
};
