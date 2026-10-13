import fs from 'node:fs';
import {prior,probability,posteriorUpdate,summarize,stoppingDecision} from '../../src/lib/econ-practice/irt.mjs';
import {selectItem,newState,recordAnswer,progress,ENGINE_VERSION} from '../../src/lib/econ-practice/adaptive.mjs';
let seed=20261012;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return (seed+.5)/4294967296;};
const bank=Array.from({length:48},(_,i)=>({id:`synthetic-${i}`,version:'synthetic',family:`f${i}`,course:'ap-micro',unit:1,topic:'1.1',difficulty:2,format:'numeric',answer:1,tolerance:0}));
const items=Object.fromEntries(bank.map((q,i)=>[q.id,{a:.8+(i%4)*.3,b:-3+6*i/47,c:0,d:1}]));
const calibration={id:'synthetic-simulation-only',status:'approved',bankVersion:'synthetic',items};
const repeats=Number(process.argv[2]??30);if(!Number.isInteger(repeats)||repeats<1||repeats>500)throw new Error('Use 1–500 repetitions per trait point.');
const reports=[];
for(const method of ['adaptive','random'])for(const theta of [-3,-2,-1,0,1,2,3]){
 const results=[],exposure={};
 for(let person=0;person<repeats;person++){
  const state=newState();let weights=prior(),count=0,reason='';
  while(count<48){const remaining=bank.filter(q=>!state.history.some(h=>h.itemId===q.id));let item;
   if(method==='adaptive'){item=selectItem(bank,state,{mode:'assessment',unit:1,sessionId:'sim',rng,calibration}).item;}
   else item=remaining[Math.floor(rng()*remaining.length)];
   const correct=rng()<probability(theta,items[item.id]);weights=posteriorUpdate(weights,correct,items[item.id]);count++;
   exposure[item.id]=(exposure[item.id]??0)+1;
   recordAnswer(state,item,{response:Number(correct),mode:'assessment',sessionId:'sim',eventId:person+'-'+count,at:count,calibration});
   const operational=progress(state,'ap-micro',{sessionId:'sim'})[0].estimate;
   if(!operational||Math.abs(operational.theta-summarize(weights).theta)>1e-12)throw new Error('Simulation and operational posterior diverged');
   const summary=summarize(weights),stop=stoppingDecision({count,uniqueFamilies:count,summary,coverageComplete:true,calibrated:true});if(stop.stop){reason=stop.reason;break;}
  }
  const summary=summarize(weights);results.push({error:summary.theta-theta,covered:summary.interval[0]<=theta&&summary.interval[1]>=theta,length:count,sd:summary.sd,reason});
 }
 const mean=k=>results.reduce((s,r)=>s+r[k],0)/repeats,coverage=mean('covered');reports.push({method,theta,replications:repeats,bias:mean('error'),rmse:Math.sqrt(results.reduce((s,r)=>s+r.error**2,0)/repeats),intervalCoverage:coverage,coverageMonteCarloSE:Math.sqrt(coverage*(1-coverage)/repeats),meanLength:mean('length'),meanPosteriorSD:mean('sd'),precisionStops:results.filter(r=>r.reason==='precision-and-coverage').length,maximumItemExposure:Math.max(...Object.values(exposure))/repeats});
}
const out={synthetic:true,engineVersion:ENGINE_VERSION,seed:20261012,repeats,scope:'One-dimensional known-parameter synthetic bank. Does not validate real bank, six-dimensional coverage, prior choice, fit or learning dynamics.',reports};fs.mkdirSync('.local/econ-calibration',{recursive:true});fs.writeFileSync('.local/econ-calibration/cat-simulation.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
