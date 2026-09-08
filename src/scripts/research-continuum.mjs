// Original geometric navigation artwork. These forms are illustrative, not empirical data.
export function continuumPoint(u,v,t,mode){
 const a=u*Math.PI*2,b=v*Math.PI*2;
 if(mode===0){const r=1+.13*Math.sin(3*a+t*.24)*Math.cos(4*b);return [r*Math.cos(a)*Math.sin(b),r*Math.sin(a)*Math.sin(b),r*Math.cos(b)*.8];}
 if(mode===1){const r=.74+.3*Math.cos(b);return [r*Math.cos(a),r*Math.sin(a),.3*Math.sin(b)+.17*Math.sin(a*3+t*.3)];}
 const x=(u-.5)*2.8,z=(v-.5)*2.1,y=.85*Math.exp(-2.7*(x*x+z*z))+.28*Math.exp(-8*((x-.8)**2+(z+.3)**2));
 return [x,-y+.3,z];
}
export function mountContinuum(root){
 if(!root)return ()=>{};
 const doc=root.ownerDocument,win=doc.defaultView,canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
 const labels=['Distance, distribution, and the shape of economic activity.','Connections between fields, methods, and research questions.','What changes when the observations change?'];
 const links=['#tool-transport','#connections','#tool-regression'],actions=['Work with space','Explore the research map','Move the observations'];
 const cleanups=[],on=(el,type,fn)=>{el.addEventListener(type,fn);cleanups.push(()=>el.removeEventListener(type,fn));};
 let mode=0,paused=false,visible=false,disposed=false,frame=0,last=0,time=0,w=1,h=1,px=0,py=0;
 const media=win.matchMedia('(prefers-reduced-motion: reduce)'),button=root.querySelector('[data-continuum-pause]');
 const cols=96,rows=32,points=Array.from({length:cols*rows},(_,i)=>continuumPoint(i%cols/(cols-1),Math.floor(i/cols)/(rows-1),0,0));
 function draw(delta=1){
  if(!ctx)return;
  ctx.clearRect(0,0,w,h);
  const angle=time*.055+px*.23,ca=Math.cos(angle),sa=Math.sin(angle),tilt=.38+py*.2,ct=Math.cos(tilt),st=Math.sin(tilt);
  const scale=Math.min(w*.27,h*.43),center=w*(w/h>1.7?.67:.57),projected=[];
  points.forEach((p,i)=>{
   const q=continuumPoint(i%cols/(cols-1),Math.floor(i/cols)/(rows-1),time,mode),blend=media.matches?1:Math.min(1,delta*.065);
   for(let k=0;k<3;k++)p[k]+=(q[k]-p[k])*blend;
   const x=p[0]*ca+p[2]*sa,z=-p[0]*sa+p[2]*ca,y=p[1]*ct-z*st,depth=p[1]*st+z*ct,perspective=3.7/(3.7+depth);
   projected.push([center+x*scale*perspective,h*.49+y*scale*perspective,depth]);
  });
  for(let r=0;r<rows;r++){
   ctx.beginPath();for(let c=0;c<cols;c++){const p=projected[r*cols+c];c?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);}
   ctx.strokeStyle=`rgba(240,240,240,${r%4===0?.5:.18})`;ctx.lineWidth=r%4===0?.9:.55;ctx.stroke();
  }
  for(let i=0;i<projected.length;i+=4){const [x,y,z]=projected[i];ctx.fillStyle=`rgba(255,255,255,${Math.max(.12,.7-z*.24)})`;ctx.beginPath();ctx.arc(x,y,z<0?1.2:.65,0,Math.PI*2);ctx.fill();}
  root.dataset.ready='true';
 }
 function stop(){win.cancelAnimationFrame(frame);frame=0;last=0;}
 function tick(now){frame=0;if(disposed||!visible||doc.hidden||paused||media.matches)return;const dt=last?now-last:33;if(dt>=32){time+=Math.min(dt,80)/1000;draw(Math.min(dt,80)/16.7);last=now;}frame=win.requestAnimationFrame(tick);}
 function sync(){stop();button.textContent=media.matches?'Reduced motion':paused?'Play motion':'Pause motion';button.disabled=media.matches;button.setAttribute('aria-pressed',String(paused||media.matches));if(ctx&&!disposed&&visible&&!doc.hidden&&!paused&&!media.matches)frame=win.requestAnimationFrame(tick);else draw(100);}
 for(const b of root.querySelectorAll('[data-form]'))on(b,'click',()=>{mode=Number(b.dataset.form);for(const other of root.querySelectorAll('[data-form]'))other.setAttribute('aria-pressed',String(other===b));root.querySelector('[data-continuum-description]').textContent=labels[mode];const a=root.querySelector('[data-continuum-link]');a.href=links[mode];a.textContent=actions[mode]+' ↗';if(paused||media.matches||!visible)draw(100);});
 if(ctx&&win.ResizeObserver&&win.IntersectionObserver){
  const resize=()=>{const box=canvas.getBoundingClientRect(),dpr=Math.min(win.devicePixelRatio||1,1.5,Math.sqrt(900000/Math.max(1,box.width*box.height)));canvas.width=w=Math.max(1,box.width*dpr);canvas.height=h=Math.max(1,box.height*dpr);draw(100);};
  const ro=new win.ResizeObserver(resize),io=new win.IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});ro.observe(canvas);io.observe(root);
  on(canvas,'pointermove',e=>{if(e.pointerType==='touch')return;const b=canvas.getBoundingClientRect();px=(e.clientX-b.left)/b.width-.5;py=(e.clientY-b.top)/b.height-.5;});on(canvas,'pointerleave',()=>{px=py=0;});
  on(button,'click',()=>{paused=!paused;sync();});on(doc,'visibilitychange',sync);on(media,'change',sync);button.hidden=false;resize();sync();cleanups.push(()=>{ro.disconnect();io.disconnect();});
 }
 for(const a of doc.querySelectorAll('a[href^="#tool-"]'))on(a,'click',()=>{const d=doc.getElementById(a.getAttribute('href').slice(1));if(d instanceof win.HTMLDetailsElement)d.open=true;});
 return()=>{disposed=true;stop();cleanups.forEach(fn=>fn());};
}
