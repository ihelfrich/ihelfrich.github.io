/** Logistic IRT mathematics. Operational models require an approved calibration.
 * Author-seeded parameters support formative routing only, never AP score claims.
 */
export const GRID=Object.freeze(Array.from({length:81},(_,i)=>-4+i/10));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function probability(theta,{a=1,b=0,c=0,d=1}={}){
 if(![theta,a,b,c,d].every(Number.isFinite)||a<=0||c<0||d>1||c>=d)throw new Error('Invalid IRT parameters');
 const z=a*(theta-b);const s=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
 return c+(d-c)*s;
}
export function information(theta,p){
 const {a=1,c=0,d=1}=p;const P=probability(theta,p);const s=(P-c)/(d-c);
 const derivative=(d-c)*a*s*(1-s);
 return derivative**2/Math.max(1e-12,P*(1-P));
}
export function prior(){const weights=GRID.map(t=>Math.exp(-t*t/2));const z=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/z);}
export function posteriorUpdate(weights,correct,params){
 if(weights.length!==GRID.length||weights.some(w=>!Number.isFinite(w)||w<0)||!weights.some(w=>w>0))throw new Error('Invalid posterior');
 if(typeof correct!=='boolean')throw new Error('Response must be boolean');
 const log=weights.map((w,i)=>Math.log(Math.max(w,1e-300))+Math.log(clamp(correct?probability(GRID[i],params):1-probability(GRID[i],params),1e-12,1)));
 const max=Math.max(...log),raw=log.map(v=>Math.exp(v-max)),z=raw.reduce((a,b)=>a+b,0);return raw.map(w=>w/z);
}
export function summarize(weights){
 const mean=weights.reduce((s,w,i)=>s+w*GRID[i],0);const variance=weights.reduce((s,w,i)=>s+w*(GRID[i]-mean)**2,0);
 let cdf=0,low=GRID[0],high=GRID.at(-1),lowerFound=false;
 weights.forEach((w,i)=>{const prev=cdf;cdf+=w;if(!lowerFound&&cdf>=.025){low=GRID[i];lowerFound=true;}if(prev<.975&&cdf>=.975)high=GRID[i];});
 return {theta:mean,sd:Math.sqrt(variance),interval:[low,high],boundaryMass:weights[0]+weights.at(-1)};
}
export function itemParameters(item,calibration){
 const p=calibration?.status==='approved'&&calibration.bankVersion===item.version?calibration.items?.[item.id]:null;
 if(p)return {...p,status:'calibrated',modelVersion:calibration.id};
 return {a:1,b:item.difficulty-2,c:0,d:1,status:'provisional',modelVersion:'author-seeded-rasch-v1'};
}
export function expectedInformation(weights,params){return weights.reduce((s,w,i)=>s+w*information(GRID[i],params),0);}
export function eligibleForCalibration(event){
 return event.mode==='assessment'&&event.firstExposure===true&&event.hints===0&&event.feedbackBeforeAnswer===false&&event.receiptVerified===true&&event.validity==='valid'&&typeof event.correct==='boolean';
}
export function stoppingDecision({count,uniqueFamilies,summary,minItems=18,maxItems=48,targetSD=.35,coverageComplete,calibrated}){
 if(count>=maxItems)return {stop:true,reason:'maximum-length',precisionMet:calibrated&&summary.sd<=targetSD};
 if(calibrated&&count>=minItems&&uniqueFamilies>=minItems&&coverageComplete&&summary.sd<=targetSD&&summary.boundaryMass<.01)return {stop:true,reason:'precision-and-coverage',precisionMet:true};
 return {stop:false,reason:calibrated?'more-evidence-needed':'provisional-fixed-length',precisionMet:false};
}
