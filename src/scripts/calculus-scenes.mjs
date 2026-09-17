/** Presentation geometry only. Camera and separation never enter the teaching model. */
const n=x=>Number(x.toFixed(3));
const fmt=x=>new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(x);
export function productScene(p,split=0){
 const S=60,X=115,Y=30,w=p.x*S,H=(p.x+1)*S,d=p.h*S,g=split*22,hx=X+w+d+g,hy=Y+H+d+g;
 return `<svg viewBox="0 0 580 390" role="group" aria-label="Product rule: drag the gold corner to change the finite increment"><defs><pattern id="cl-product-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#b2acd5" stroke-opacity=".12"/></pattern></defs><g class="cl-product-pieces"><rect x="${X}" y="${Y}" width="${w}" height="${H}" class="cl-old-area"/><rect x="${X}" y="${Y}" width="${w}" height="${H}" fill="url(#cl-product-hatch)"/><rect x="${X+w}" y="${Y}" width="${d}" height="${H}" class="cl-fill-blue cl-piece" style="transform:translateX(${g}px)"/><rect x="${X}" y="${Y+H}" width="${w}" height="${d}" class="cl-fill-teal cl-piece" style="transform:translateY(${g}px)"/><rect x="${X+w}" y="${Y+H}" width="${d}" height="${d}" class="cl-fill-orange cl-piece" style="transform:translate(${g}px,${g}px)"/><text x="${X+w/2}" y="${Y+H/2}" class="cl-center cl-product-label">x(x + 1)</text><text x="${X+w/2}" y="18" class="cl-center">x = ${fmt(p.x)}</text><text x="${hx+18}" y="${Y+H/2}">x + 1 = ${fmt(p.x+1)}</text><g data-growth-handle tabindex="0" role="slider" aria-label="Growth of each side. Drag diagonally or use arrow keys." aria-valuemin="0.01" aria-valuemax="1" aria-valuenow="${p.h}" data-origin-x="${X+w+g}" data-origin-y="${Y+H+g}" data-scale="${S}" transform="translate(${hx},${hy})"><circle r="37" fill="transparent" pointer-events="all"/><circle r="20" class="cl-handle-aura"/><circle r="10" class="cl-handle-core"/><path d="M-4 4L4-4M-1-4H4V1" class="cl-handle-arrow"/></g><text x="${X}" y="${Math.min(378,hy+32)}">Δx = ${fmt(p.h)} · ${split?'pieces separated':'drag the corner'}</text></g></svg><div class="cl-legend"><span><i class="cl-bg-blue"></i>First strip · ${fmt((p.x+1)*p.h)}</span><span><i class="cl-bg-teal"></i>Second strip · ${fmt(p.x*p.h)}</span><span><i class="cl-bg-orange"></i>Corner · ${fmt(p.h*p.h)}</span></div>`;
}
export function projectPoint(x,y,z,yaw){
 const horizontal=Math.cos(yaw)*x-Math.sin(yaw)*y,depth=Math.sin(yaw)*x+Math.cos(yaw)*y;
 return [290+horizontal*52,220+depth*23-z*60,depth];
}
export function surfaceScene(id,p,r,yaw=-.7){
 const production=id==='partials',lo=production?.5:-2.5,hi=production?6.5:2.5,center=(hi+lo)/2;
 const fun=(x,y)=>production?x**p.alpha*y**(1-p.alpha):x*x+(p.shape==='bowl'?1:-1)*y*y;
 const height=z=>production?z/2:z/6;
 const project=(x,y)=>projectPoint((x-center)*5/(hi-lo),(y-center)*5/(hi-lo),height(fun(x,y)),yaw);
 const points=[],N=20;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const x=lo+(hi-lo)*i/N,y=lo+(hi-lo)*j/N,d=(hi-lo)/N,verts=[[x,y],[x+d,y],[x+d,y+d],[x,y+d]].map(([a,b])=>project(a,b)),value=fun(x+d/2,y+d/2),t=production?value/7:(value+6.25)/12.5;
  points.push({depth:verts.reduce((s,v)=>s+v[2],0)/4,markup:`<polygon points="${verts.map(v=>`${n(v[0])},${n(v[1])}`).join(' ')}" fill="hsl(${255-70*t} 48% ${26+25*t}%)" stroke="#c8beff" stroke-opacity=".15" stroke-width=".6"/>`});
 }
 points.sort((a,b)=>a.depth-b.depth);
 const path=pts=>pts.map((v,i)=>`${i?'L':'M'}${n(v[0])},${n(v[1])}`).join(' ');
 const slice=axis=>Array.from({length:81},(_,i)=>{const t=lo+(hi-lo)*i/80;return axis==='x'?project(t,p.y):project(p.x,t);});
 const move=Array.from({length:41},(_,i)=>{const t=i/40;return project(p.x+t*(production?p.dx:.65*r.vx),p.y+t*(production?p.dy:.65*r.vy));}),end=move.at(-1);
 const P=project(p.x,p.y),origin=projectPoint(-2.5,-2.5,0,yaw),axisX=projectPoint(2.8,-2.5,0,yaw),axisY=projectPoint(-2.5,2.8,0,yaw);
 const axes=`<path d="${path([axisX,origin,axisY])}" fill="none" stroke="#9d9eb5" stroke-width="1"/><text x="${axisX[0]+6}" y="${axisX[1]+16}">${production?'K':'x'}</text><text x="${axisY[0]-12}" y="${axisY[1]+16}">${production?'L':'y'}</text>`;
 return `<svg viewBox="0 0 580 390" data-surface-plot tabindex="0" role="img" aria-label="Rotatable ${production?'production':p.shape} surface. Drag or use left and right arrows to orbit; input controls move the selected point.">${axes}${points.map(p=>p.markup).join('')}<path d="${path(slice('x'))}" fill="none" class="cl-teal"/><path d="${path(slice('y'))}" fill="none" class="cl-blue"/><path data-move-trace d="${path(move)}" fill="none" class="cl-orange"/><circle cx="${n(end[0])}" cy="${n(end[1])}" r="4" fill="#ffc58b"/><g transform="translate(${n(P[0])},${n(P[1])})"><circle r="13" fill="#ffffff20"/><circle r="6" fill="#f8f3ff" stroke="#171827" stroke-width="2"/></g><text x="24" y="28">${production?'Y(K,L)':p.shape==='bowl'?'f(x,y) = x² + y²':'f(x,y) = x² − y²'}</text><text x="24" y="365">Selected height = ${fmt(r.value)} · drag to orbit</text></svg><div class="cl-legend"><span><i class="cl-bg-teal"></i>Move ${production?'capital':'x'}, fix ${production?'labor':'y'}</span><span><i class="cl-bg-blue"></i>Move ${production?'labor':'y'}, fix ${production?'capital':'x'}</span><span><i class="cl-bg-orange"></i>${production?'Joint input move':'Chosen direction across surface'}</span></div>`;
}
/** Retain matching SVG/DOM nodes during continuous input, instead of rebuilding the scene. */
export function patchScene(host,html){
 const template=host.ownerDocument.createElement('template');template.innerHTML=html;
 function reconcile(parent,desired){
  const old=[...parent.childNodes],next=[...desired.childNodes];
  for(let i=0;i<Math.max(old.length,next.length);i++){
   const a=old[i],b=next[i];if(!b){a.remove();continue;}if(!a){parent.append(b.cloneNode(true));continue;}
   if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){a.replaceWith(b.cloneNode(true));continue;}
   if(a.nodeType===3){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;continue;}
   if(a.nodeType!==1)continue;
   for(const attr of [...a.attributes])if(!b.hasAttribute(attr.name))a.removeAttribute(attr.name);
   for(const attr of [...b.attributes])if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);
   reconcile(a,b);
  }
 }
 reconcile(host,template.content);
}
