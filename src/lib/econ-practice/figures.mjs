const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderGraph(g){
 if(!g||g.kind!=='lines')return '';
 const W=600,H=380,L=65,R=45,T=35,B=65;
 const x=q=>L+q/g.xMax*(W-L-R),y=p=>H-B-p/g.yMax*(H-T-B);
 const ticks=Array.from({length:6},(_,i)=>i/5);
 let parts=[`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(g.yLabel)} against ${escape(g.xLabel)}"><title>${escape(g.lines.map(l=>`${l.label}: ${g.yLabel} = ${l.intercept} ${l.slope<0?'−':'+'} ${Math.abs(l.slope)} × ${g.xLabel}`).join('; '))}</title>`];
 parts.push(`<path class="axis" d="M${L},${T}V${H-B}H${W-R}"/>`);
 ticks.forEach(t=>{const px=x(t*g.xMax),py=y(t*g.yMax);parts.push(`<text x="${px}" y="${H-B+23}" text-anchor="middle">${+(t*g.xMax).toFixed(1)}</text><text x="${L-10}" y="${py+5}" text-anchor="end">${+(t*g.yMax).toFixed(1)}</text>`);});
 g.lines.forEach((line,i)=>{
  let points=[];for(let j=0;j<=200;j++){const q=g.xMax*j/200,p=line.intercept+line.slope*q;if(p>=0&&p<=g.yMax)points.push([x(q),y(p)]);}
  if(points.length){parts.push(`<polyline class="curve curve-${i}" points="${points.map(p=>p.join(',')).join(' ')}"/>`);const a=points[Math.floor(points.length*.72)];parts.push(`<text class="curve-label" x="${a[0]+8}" y="${a[1]-8}">${escape(line.label)}</text>`);}
 });
 parts.push(`<text x="${W/2}" y="${H-12}" text-anchor="middle">${escape(g.xLabel)}</text><text transform="translate(17 ${H/2}) rotate(-90)" text-anchor="middle">${escape(g.yLabel)}</text></svg>`);
 return parts.join('');
}
