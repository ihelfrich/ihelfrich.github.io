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
export function world(data, b) { finite(b); return data.map(({id,x,y}) => ({id,x,y})); }
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
export function designBounds(M=0) {
  finite(M); if(M<0) throw new RangeError('The bound cannot be negative');
  const dd=(62-50)-(46-40),effect=[dd-M,dd+M],net=effect.map(v=>100*v-300);
  return {dd,effect,net,decision:net[0]>0?'Robustly positive':net[1]<0?'Robustly negative':'Depends on the assumption'};
}
export function csv(rows,columns) {
  const quote=v=>{const s=String(v); return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return [columns.join(','),...rows.map(r=>columns.map(k=>quote(r[k])).join(','))].join('\n')+'\n';
}
