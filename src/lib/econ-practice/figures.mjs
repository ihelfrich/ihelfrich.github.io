const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>String(Number(n.toFixed(3)));
// Exact clipping preserves axis intercepts, unlike sampling a line on a grid.
export function visibleSegment(line,xMax,yMax){
 if(![line.intercept,line.slope,xMax,yMax].every(Number.isFinite)||xMax<=0||yMax<=0)return null;
 const {intercept:a,slope:b}=line;
 if(b===0)return a>=0&&a<=yMax?[[0,a],[xMax,a]]:null;
 const q0=-a/b,q1=(yMax-a)/b;
 const left=Math.max(0,Math.min(q0,q1)),right=Math.min(xMax,Math.max(q0,q1));
 return left<=right?[[left,Math.max(0,Math.min(yMax,a+b*left))],[right,Math.max(0,Math.min(yMax,a+b*right))]]:null;
}
export function graphDescription(g){
 return `${g.yLabel} against ${g.xLabel}. Horizontal range 0 to ${fmt(g.xMax)}; vertical range 0 to ${fmt(g.yMax)}. ${g.lines.map(l=>`${l.label}: ${g.yLabel} = ${fmt(l.intercept)} ${l.slope<0?'minus':'plus'} ${fmt(Math.abs(l.slope))} times ${g.xLabel}.`).join(' ')}`;
}
export function renderGraph(g){
 if(!g||g.kind!=='lines')return '';
 if(!Array.isArray(g.lines)||!g.lines.length||![g.xMax,g.yMax].every(n=>Number.isFinite(n)&&n>0)||g.lines.some(l=>![l.intercept,l.slope].every(Number.isFinite)))return '';
 const tickWidth=Math.max(...Array.from({length:6},(_,i)=>fmt(g.yMax*i/5).length))*9;
 const W=600,H=400+g.lines.length*25,L=Math.max(65,45+tickWidth),R=45,T=35,plotBottom=315;
 const x=q=>L+q/g.xMax*(W-L-R),y=p=>plotBottom-p/g.yMax*(plotBottom-T);
 const ticks=Array.from({length:6},(_,i)=>i/5),description=graphDescription(g);
 let parts=[`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(description)}"><title>${escape(g.yLabel)} against ${escape(g.xLabel)}</title><desc>${escape(description)}</desc>`];
 parts.push(`<path class="axis" d="M${L},${T}V${plotBottom}H${W-R}"/>`);
 ticks.forEach(t=>{const px=x(t*g.xMax),py=y(t*g.yMax);parts.push(`<text x="${px}" y="${plotBottom+23}" text-anchor="middle">${fmt(t*g.xMax)}</text><text x="${L-10}" y="${py+5}" text-anchor="end">${fmt(t*g.yMax)}</text>`);});
 g.lines.forEach((line,i)=>{
  const segment=visibleSegment(line,g.xMax,g.yMax);
  if(segment)parts.push(`<polyline class="curve curve-${i%3}" points="${segment.map(([q,p])=>`${x(q)},${y(p)}`).join(' ')}"/>`);
  // A separate legend avoids covering intersections or other curve labels.
  const ly=395+i*25;
  parts.push(`<path class="curve curve-${i%3}" d="M${L},${ly}h35"/><text x="${L+45}" y="${ly+5}">${escape(line.label)}</text>`);
 });
 parts.push(`<text x="${W/2}" y="365" text-anchor="middle">${escape(g.xLabel)}</text><text transform="translate(17 175) rotate(-90)" text-anchor="middle">${escape(g.yLabel)}</text></svg>`);
 return parts.join('');
}
