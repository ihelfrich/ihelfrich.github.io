/** Exact finite averages for the chapter's controlled alert model. */
export function alertSummary(b) {
  if (!Number.isFinite(b) || b < -2 || b > 2) throw new RangeError('The chapter model requires -2 <= b <= 2.');
  const states = [0,1].flatMap(u => [-1,0,1].map(v => ({u,v})));
  const mean = values => values.reduce((sum,x) => sum+x,0)/values.length;
  const observed = states.map(({u,v}) => 10+b*u+(2-b)*u+v);
  const assigned = a => states.map(({u,v}) => 10+b*a+(2-b)*u+v);
  const noAlert = assigned(0), alert = assigned(1);
  return {
    b, observed0:mean(observed.filter((_,i)=>states[i].u===0)),
    observed1:mean(observed.filter((_,i)=>states[i].u===1)),
    assigned0:mean(noAlert), assigned1:mean(alert),
    effect:mean(alert.map((y,i)=>y-noAlert[i])),
    forecastMSE:mean(observed.map((y,i)=>(y-(10+2*states[i].u))**2)),
    states:states.map(({u,v},i)=>({u,v,observed:observed[i],assigned0:noAlert[i],assigned1:alert[i]})),
  };
}
