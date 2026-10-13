// Descriptive screening diagnostics, not IRT parameter estimates or population inference.
export function wilsonInterval(correct,n){
 if(!Number.isInteger(n)||n<0||!Number.isInteger(correct)||correct<0||correct>n)throw new Error('Invalid binary response counts');
 if(!n)return null;
 const z=1.959963984540054,p=correct/n,denominator=1+z*z/n;
 const center=(p+z*z/(2*n))/denominator,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denominator;
 return [Math.max(0,center-half),Math.min(1,center+half)];
}
function distribution(values){
 const finite=values.filter(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
 if(!finite.length)return {n:0,missingOrInvalid:values.length,min:null,median:null,p90:null,max:null};
 const quantile=p=>{const at=(finite.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return finite[lo]+(finite[hi]-finite[lo])*(at-lo);};
 return {n:finite.length,missingOrInvalid:values.length-finite.length,min:finite[0],median:quantile(.5),p90:quantile(.9),max:finite.at(-1)};
}
export function itemDiagnostics(stats,retainedCounts={}){
 return {scope:'Eligible unassisted first-family responses from one occasion per person, after minimum-person-response screening and before sparse/constant-item screening.',interpretation:'Facility is conditional on the adaptively selected observed sample, not a population success rate or an IRT difficulty. Wilson intervals use a working binomial model and do not correct for adaptive sampling, clustering or parameter uncertainty. Constant and sparse items remain visible.',items:Object.entries(stats).map(([itemId,s])=>({itemId,family:s.family,observedResponses:s.n,correct:s.correct,facility:s.n?s.correct/s.n:null,workingBinomial95: wilsonInterval(s.correct,s.n),constantResponse:s.correct===0||s.correct===s.n,retainedMatrixResponses:retainedCounts[itemId]??0,activeMs:distribution(s.activeMs),selectionProbability:distribution(s.propensities),responseFrequencies:s.distractors}))};
}
