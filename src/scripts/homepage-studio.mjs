import {fieldPoint,inquiryHref} from '../data/homepage-studio.mjs';
export function mountHomepage(doc){
 const win=doc.defaultView,cleanups=[];
 const on=(el,type,fn)=>{el.addEventListener(type,fn);cleanups.push(()=>el.removeEventListener(type,fn));};
 const projects=doc.querySelector('[data-projects]');
 if(projects){
  const tabs=[...projects.querySelectorAll('[role=tab]')],panels=tabs.map(t=>doc.getElementById(t.getAttribute('aria-controls')));
  let projectAnimation, heightAnimation;
  const projectFrame=projects.querySelector('.st-projects');
  cleanups.push(()=>{projectAnimation?.cancel();heightAnimation?.cancel();});
  const activate=(index,focus=false,animate=true)=>{const oldHeight=projectFrame?.getBoundingClientRect().height;projectAnimation?.cancel();heightAnimation?.cancel();tabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===index));t.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});if(focus)tabs[index].focus();if(animate&&projectFrame?.animate&&!win.matchMedia('(prefers-reduced-motion: reduce)').matches){const nextHeight=projectFrame.getBoundingClientRect().height;if(oldHeight&&Math.abs(oldHeight-nextHeight)>1)heightAnimation=projectFrame.animate([{height:`${oldHeight}px`},{height:`${nextHeight}px`}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});}if(animate&&!win.matchMedia('(prefers-reduced-motion: reduce)').matches&&panels[index].animate)projectAnimation=panels[index].animate([{opacity:.2,transform:'translateY(18px) scale(.985)',clipPath:'inset(0 0 8% 0 round 18px)'},{opacity:1,transform:'none',clipPath:'inset(0 0 0 0 round 18px)'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});};
  tabs.forEach((t,i)=>{panels[i].setAttribute('role','tabpanel');panels[i].setAttribute('aria-labelledby',t.id);on(t,'click',()=>activate(i));on(t,'keydown',e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();activate(n,true);});});
  activate(0,false,false);projects.querySelector('[role=tablist]').hidden=false;
 }
 const form=doc.querySelector('[data-inquiry]');
 if(form){
  form.hidden=false;
  for(const a of doc.querySelectorAll('[data-inquiry-intent]'))on(a,'click',()=>{form.elements.intent.value=a.dataset.inquiryIntent;});
  on(form,'submit',e=>{e.preventDefault();if(!form.reportValidity())return;win.location.href=inquiryHref(form.elements.intent.value,form.elements.name.value,form.elements.question.value);form.querySelector('[role=status]').textContent='Your email app should open with the draft. If it does not, use the email link alongside.';});
 }
 const field=doc.querySelector('[data-line-field]'),canvas=field?.querySelector('canvas'),ctx=canvas?.getContext('2d');
 if(ctx&&win.ResizeObserver&&win.IntersectionObserver){
  const media=win.matchMedia('(prefers-reduced-motion: reduce)'),button=field.parentElement.querySelector('.st-motion');let raf=0,last=0,time=0,w=0,h=0,visible=false,paused=false,disposed=false;
  const draw=()=>{ctx.clearRect(0,0,w,h);for(let r=0;r<42;r++){ctx.beginPath();for(let j=0;j<=100;j++){const [x,y]=fieldPoint(j/100,r/41,time);j?ctx.lineTo(x*w,(.13+y*.74)*h):ctx.moveTo(x*w,(.13+y*.74)*h);}ctx.strokeStyle=r%7===0?'rgba(30,30,30,.28)':'rgba(60,60,60,.16)';ctx.lineWidth=r%7===0?1.2:.8;ctx.stroke();}canvas.dataset.ready='true';};
  const stop=()=>{win.cancelAnimationFrame(raf);raf=0;last=0;};
  const frame=now=>{raf=0;if(disposed||!visible||doc.hidden||paused||media.matches)return;if(!last||now-last>=32){time+=last?Math.min((now-last)/1000,.08):0;last=now;draw();}raf=win.requestAnimationFrame(frame);};
  const sync=()=>{stop();button.textContent=media.matches?'Reduced motion':paused?'Play motion':'Pause motion';button.disabled=media.matches;button.setAttribute('aria-pressed',String(paused||media.matches));if(!disposed&&visible&&!doc.hidden&&!paused&&!media.matches)raf=win.requestAnimationFrame(frame);};
  const resize=()=>{const r=canvas.getBoundingClientRect(),scale=Math.min(win.devicePixelRatio||1,1.5,Math.sqrt(440000/Math.max(1,r.width*r.height)));canvas.width=w=Math.max(1,Math.round(r.width*scale));canvas.height=h=Math.max(1,Math.round(r.height*scale));draw();};
  const ro=new win.ResizeObserver(resize),io=new win.IntersectionObserver(e=>{visible=e[0].isIntersecting;sync();});ro.observe(canvas);io.observe(canvas);on(doc,'visibilitychange',sync);on(media,'change',sync);on(button,'click',()=>{paused=!paused;sync();});button.hidden=false;resize();sync();
  cleanups.push(()=>{disposed=true;stop();ro.disconnect();io.disconnect();});
 }
 return()=>cleanups.forEach(fn=>fn());
}
