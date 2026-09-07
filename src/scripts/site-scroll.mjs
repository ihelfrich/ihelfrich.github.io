import Lenis from 'lenis';

// Keep the browser's scroll container, touch handling, history and keyboard navigation.
// Run animation frames only while input or an animated scroll needs them.
export function mountSiteScroll(doc,ScrollEngine=Lenis){
 const win=doc.defaultView;if(!win.ResizeObserver)return()=>{};
 const engine=new ScrollEngine({autoRaf:false,lerp:.12,syncTouch:false,anchors:true,allowNestedScroll:true,stopInertiaOnNavigate:true,prevent:node=>doc.body.classList.contains('nav-open')||node.matches?.('textarea, select, pre, [data-lenis-prevent]')});
 let frame=0,disposed=false;const cleanups=[];
 const wake=()=>{if(!disposed&&!doc.hidden&&!frame)frame=win.requestAnimationFrame(tick);};
 const tick=time=>{frame=0;if(disposed||doc.hidden)return;engine.raf(time);if(engine.isScrolling==='smooth')wake();};
 const on=(el,type,fn,options)=>{el.addEventListener(type,fn,options);cleanups.push(()=>el.removeEventListener(type,fn,options));};
 const measure=()=>{const header=doc.querySelector('.site-header')?.getBoundingClientRect().height||0,dock=doc.querySelector('.st-experience-nav')?.getBoundingClientRect().height||0;doc.documentElement.style.setProperty('--site-header-height',`${header}px`);doc.documentElement.style.setProperty('--site-anchor-offset',`${header+dock+18}px`);};
 const revealHash=()=>{let id;try{id=decodeURIComponent(win.location.hash.slice(1));}catch{return;}const target=doc.getElementById(id);if(target?.matches('details'))target.open=true;};
 const prepareAnchor=e=>{const a=e.target.closest?.('a[href]');if(!a)return;let url;try{url=new URL(a.href,win.location.href);}catch{return;}if(url.origin!==win.location.origin||url.pathname!==win.location.pathname||!url.hash)return;let target;try{target=doc.getElementById(decodeURIComponent(url.hash.slice(1)));}catch{return;}if(target?.matches('details'))target.open=true;measure();wake();};
 engine.on('virtual-scroll',wake);engine.on('scroll',wake);
 on(doc,'click',prepareAnchor,true);on(win,'hashchange',revealHash);on(doc,'visibilitychange',()=>{if(doc.hidden){win.cancelAnimationFrame(frame);frame=0;}else wake();});
 const resize=new win.ResizeObserver(measure);for(const element of doc.querySelectorAll('.site-header,.st-experience-nav'))resize.observe(element);
 measure();revealHash();doc.documentElement.dataset.scrollEngine='lenis';
 return()=>{disposed=true;win.cancelAnimationFrame(frame);resize.disconnect();engine.destroy();cleanups.forEach(fn=>fn());delete doc.documentElement.dataset.scrollEngine;doc.documentElement.style.removeProperty('--site-anchor-offset');doc.documentElement.style.removeProperty('--site-header-height');};
}
