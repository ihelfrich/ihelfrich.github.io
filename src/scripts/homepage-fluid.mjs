/** Pointer treatment and active navigation share the existing native page flow. */
export function mountFluidSurface(doc){
 const win=doc.defaultView,media=win.matchMedia('(prefers-reduced-motion: reduce)'),cleanups=[];
 const on=(el,event,handler)=>{el.addEventListener(event,handler);cleanups.push(()=>el.removeEventListener(event,handler));};
 const portrait=doc.querySelector('.st-portrait'),stage=doc.querySelector('.st-portrait-stage');
 const reset=()=>{portrait?.style.removeProperty('--portrait-x');portrait?.style.removeProperty('--portrait-y');};
 if(portrait&&stage){
  on(stage,'pointermove',e=>{if(media.matches||e.pointerType==='touch')return;const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;const x=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),y=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));portrait.style.setProperty('--portrait-x',`${x*3}deg`);portrait.style.setProperty('--portrait-y',`${-y*2.5}deg`);});
  on(stage,'pointerleave',reset);on(media,'change',reset);cleanups.push(reset);
 }
 const nav=doc.querySelector('.st-experience-nav'),links=nav?[...nav.querySelectorAll('a[href^="#"]')]:[];
 if(links.length&&win.IntersectionObserver){
  const active=new Map(),mark=()=>{const ranked=[...active.entries()].filter(([,v])=>v.isIntersecting).sort((a,b)=>Math.abs(a[1].boundingClientRect.top)-Math.abs(b[1].boundingClientRect.top));for(const a of links){if(a.hash===`#${ranked[0]?.[0]}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}};
  const observer=new win.IntersectionObserver(entries=>{for(const e of entries)active.set(e.target.id,e);mark();},{rootMargin:'-15% 0px -35% 0px',threshold:0});
  for(const a of links){const section=doc.getElementById(a.hash.slice(1));if(section)observer.observe(section);}cleanups.push(()=>{observer.disconnect();for(const a of links)a.removeAttribute('aria-current');});
 }
 return()=>cleanups.forEach(fn=>fn());
}
