// Small teaching models. Deliberately distinct from production causal estimators.
const finite = (x) => { if (!Number.isFinite(x)) throw new RangeError('Expected a finite number'); return x; };
const count = (x) => { if (!Number.isInteger(x) || x < 1 || x > 100000) throw new RangeError('Count must be an integer from 1 to 100000'); return x; };
export function randomNormal(seed = 2026) {
  finite(seed); let state = seed >>> 0;
  const uniform = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
}
export function observationSample(seed = 2026, n = 160) {
  count(n); const normal = randomNormal(seed);
  return Array.from({ length: n }, (_,i) => { const u=normal(),v=normal(); return { id:i+1, x:u, y:u+v, u, v }; });
}
// The observed columns are training d and output y; internally the sample keeps x for the training draw.
export function world(data, b) { finite(b); return data.map(({id,x,y}) => ({id,d:x,y})); }
export function interventionMean(b,x) { return finite(b)*finite(x); }
export function ols(data) {
  if(data.length<2) throw new RangeError('At least two points required');
  const mx=data.reduce((s,p)=>s+finite(p.x),0)/data.length, my=data.reduce((s,p)=>s+finite(p.y),0)/data.length;
  const xx=data.reduce((s,p)=>s+(p.x-mx)**2,0);
  if(xx===0) throw new RangeError('X must vary');
  const slope=data.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/xx;
  return {slope,intercept:my-slope*mx};
}
export function samplingExperiment({seed=2026,n=50,bias=0,repetitions=100}={}) {
  count(n); count(repetitions); finite(bias);
  const normal=randomNormal(seed),se=1/Math.sqrt(n),halfWidth=1.959963984540054*se;
  // An exact draw from the sampling distribution of a mean of n N(bias,1) units.
  const rows=Array.from({length:repetitions},(_,i)=>{
    const mean=bias+se*normal(),low=mean-halfWidth,high=mean+halfWidth;
    return {replication:i+1,n,bias,mean,low,high,covers:low<=0&&high>=0};
  });
  return {rows,halfWidth,coverage:rows.filter(r=>r.covers).length/repetitions};
}
// Net value is exact at the half-unit slider steps, so equality to zero marks the break-even boundary.
export function designBounds(M=0) {
  finite(M); if(M<0) throw new RangeError('The bound cannot be negative');
  const dd=(62-50)-(46-40),effect=[dd-M,dd+M],net=effect.map(v=>100*v-300);
  const [low,high]=net;
  if(low>0) return {dd,effect,net,decision:'Robustly positive',note:'Every effect allowed by this bound clears the $300 cost.'};
  if(high<0) return {dd,effect,net,decision:'Robustly negative',note:'Every effect allowed by this bound falls short of the $300 cost.'};
  if(low===0&&high>0) return {dd,effect,net,decision:'Weakly positive',note:'No allowed effect loses money. At the lower boundary the program exactly breaks even, so training weakly dominates skipping.'};
  if(high===0&&low<0) return {dd,effect,net,decision:'Weakly negative',note:'No allowed effect makes money. At the upper boundary the program exactly breaks even, so skipping weakly dominates training.'};
  return {dd,effect,net,decision:'Depends on the assumption',note:'The allowed effects include some that fall short of the $300 cost and some that exceed it; the data and this bound do not settle the investment.'};
}
export function csv(rows,columns) {
  const quote=v=>{const s=String(v); return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return [columns.join(','),...rows.map(r=>columns.map(k=>quote(r[k])).join(','))].join('\n')+'\n';
}
// Suggested reading paths. Core chapters are highlighted; optional chapters are extensions
// whose prerequisites already lie on the path. tests/unit/econometrics.test.mjs checks every
// path against the `requires` arrays in the chapter frontmatter, and checks that a path
// containing a chapter also offers that chapter's `recommends` (chapter 12 recommends 11).
export const readingPaths=Object.freeze({
  all:Object.freeze({core:Object.freeze([]),optional:Object.freeze([])}),
  first:Object.freeze({core:Object.freeze([1,2,3,4,5,6]),optional:Object.freeze([])}),
  applied:Object.freeze({core:Object.freeze([1,2,3,4,5,6,8,12]),optional:Object.freeze([10,11])}),
  theory:Object.freeze({core:Object.freeze([1,2,3,4,5,7,8,10,12]),optional:Object.freeze([11])}),
});
// Names an ascending list of chapters in words: [1,2,3,4,5,7,8] -> 'chapters 1–5, 7, and 8'.
// Runs of three or more consecutive chapters collapse to a range.
export function chapterList(orders) {
  const runs=[];
  for(let i=0;i<orders.length;){
    let j=i; while(j+1<orders.length&&orders[j+1]===orders[j]+1) j++;
    if(j-i>=2) runs.push(`${orders[i]}–${orders[j]}`); else for(let k=i;k<=j;k++) runs.push(String(orders[k]));
    i=j+1;
  }
  const noun=runs.length===1&&!runs[0].includes('–')?'chapter':'chapters';
  return `${noun} ${runs.length<3?runs.join(' and '):`${runs.slice(0,-1).join(', ')}, and ${runs.at(-1)}`}`;
}
// Returns every [chapter, prerequisite] pair in which a listed chapter's prerequisite is absent.
export function missingPrerequisites(chapters,requires) {
  const listed=new Set(chapters),missing=[];
  for(const chapter of chapters) for(const prerequisite of requires[chapter]||[]) if(!listed.has(prerequisite)) missing.push([chapter,prerequisite]);
  return missing;
}
// One role per symbol across the twelve chapters. Rendered on the edition page and in the print edition.
export const notation=Object.freeze([
  ['Y','Outcome: output, or whether an employee meets the output target.'],
  ['D','Training, the treatment of interest. Participation (0 or 1) in most chapters; intensity or hours in chapters 1, 3, 6, and 10.'],
  ['Y(d)','Potential outcome under training status d; Y(1) with training and Y(0) without.'],
  ['X','Pre-treatment covariates. In general regression and likelihood formulas (chapters 3, 4, 7, and 11), the regressors. Exercise 2 in chapters 2 and 3 uses X and Y as generic random variables.'],
  ['K','Prior experience, a binary pre-treatment covariate (chapters 2 and 3).'],
  ['U','An unobserved characteristic or confounder.'],
  ['Z','An instrument (chapter 7).'],
  ['R','The running variable of a regression discontinuity design (chapter 9).'],
  ['S','Inclusion in the analyzed data: an observed outcome (chapter 6) or trial participation (chapter 11).'],
  ['E[·]','Expectation, the population average. No variable is named E.'],
  ['τ','A treatment effect. Each chapter states whether it is an individual effect or an average, and over which population: all employees, compliers, adopting offices, or a target population.'],
]);
