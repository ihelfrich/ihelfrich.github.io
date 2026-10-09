/** Weighted enumeration of the chapter's authored 36-state measurement model. */
export function measurementSummary(h, kappa) {
  if(!Number.isFinite(h)||h<0||h>4||![0,-.5,-2].includes(kappa))throw new RangeError('Use 0 <= h <= 4 and a declared calibration.');
  const states=[8,12].flatMap(x=>[-1,0,1].flatMap(z1=>[-1,0,1].flatMap(z2=>[-20,20].map(e=>({x,m:x+kappa*(x-10)+h*z1,twin:x+kappa*(x-10)+h*z2,y:30+50*x+e})))));
  const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const cov=(a,b)=>{const am=mean(a),bm=mean(b);return mean(a.map((x,i)=>(x-am)*(b[i]-bm)));};
  const m=states.map(s=>s.m),y=states.map(s=>s.y),x=states.map(s=>s.x),twin=states.map(s=>s.twin);
  const slope=cov(m,y)/cov(m,m),intercept=mean(y)-slope*mean(m);
  const points=[...new Map(states.map(s=>[`${s.m}:${s.y}`,{m:s.m,y:s.y}])).values()];
  return {h,kappa,slope,intercept,linearMSE:mean(states.map(s=>(s.y-intercept-slope*s.m)**2)),
    twinRatio:cov(m,y)/cov(m,twin),copiedRatio:slope,covariance:cov(m,y),sharedCovariance:cov(m,twin),
    meterVariance:cov(m,m),reliability:kappa===0?cov(x,x)/cov(m,m):null,
    slopePerKWh:slope/1000,minimumMeter:Math.min(...m),maximumMeter:Math.max(...m),points,
    signalRows:[8,12].flatMap(x=>[-1,0,1].map(z=>({x,m:x+kappa*(x-10)+h*z,meanBill:30+50*x}))),states};
}
