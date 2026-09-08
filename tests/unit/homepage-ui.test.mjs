import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {mountHomepage} from '../../src/scripts/homepage-studio.mjs';
test('built homepage retains no-JS content and enhances keyboard, inquiry and motion controls',async()=>{
 const w=new Window({url:'https://example.test'});w.document.write(await readFile('dist/index.html','utf8'));
 const doc=w.document,frames=new Map();let id=0;const observers=[];
 const media=Object.assign(new w.EventTarget(),{matches:false});w.matchMedia=()=>media;
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};w.cancelAnimationFrame=id=>frames.delete(id);
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 w.ResizeObserver=class{observe(){}disconnect(){}};
 w.IntersectionObserver=class{constructor(fn){this.fn=fn;observers.push(this)}observe(){this.fn([{isIntersecting:true}])}disconnect(){}};
 assert.equal([...doc.querySelectorAll('.st-project')].filter(p=>!p.hidden).length,3);
 assert.ok(doc.querySelector('[role=tablist]').hidden);
 assert.ok(doc.querySelector('[data-inquiry]').hidden);
 const dispose=mountHomepage(doc);
 const tabs=[...doc.querySelectorAll('[role=tab]')];
 assert.equal(doc.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);
 tabs[1].click();assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(doc.querySelector('[role=tabpanel]:not([hidden])').id,'project-panel-1');
 tabs[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(doc.activeElement,tabs[2]);
 tabs[2].dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(doc.activeElement,tabs[0]);
 doc.querySelector('[data-inquiry-intent=collaborate]').click();assert.equal(doc.querySelector('#st-intent').value,'collaborate');
 assert.ok(frames.size);doc.querySelector('.st-motion').click();assert.equal(frames.size,0);doc.querySelector('.st-motion').click();assert.ok(frames.size);
 observers[0].fn([{isIntersecting:false}]);assert.equal(frames.size,0);observers[0].fn([{isIntersecting:true}]);assert.ok(frames.size);
 media.matches=true;media.dispatchEvent(new w.Event('change'));assert.equal(frames.size,0);assert.ok(doc.querySelector('.st-motion').disabled);
 for(const a of doc.querySelectorAll('a[href^="#"]')){const href=a.getAttribute('href');if(href!=='#')assert.ok(doc.querySelector(href),href);}
 dispose();assert.equal(frames.size,0);await w.happyDOM.abort();
});

test('fluid portrait and section navigation reset correctly on preference changes and disposal',async()=>{
 const {mountFluidSurface}=await import('../../src/scripts/homepage-fluid.mjs');
 const w=new Window({url:'https://example.test/'});w.document.write(await readFile('dist/index.html','utf8'));const d=w.document;
 const media=Object.assign(new w.EventTarget(),{matches:false});w.matchMedia=()=>media;let notify,disconnected=false;
 w.IntersectionObserver=class{constructor(fn){notify=fn;}observe(){}disconnect(){disconnected=true;}};
 const portrait=d.querySelector('.st-portrait'),stage=d.querySelector('.st-portrait-stage');stage.getBoundingClientRect=()=>({left:0,top:0,width:500,height:500});
 const dispose=mountFluidSurface(d);
 stage.dispatchEvent(new w.PointerEvent('pointermove',{clientX:500,clientY:0,pointerType:'mouse'}));assert.equal(portrait.style.getPropertyValue('--portrait-x'),'3deg');
 media.matches=true;media.dispatchEvent(new w.Event('change'));assert.equal(portrait.style.getPropertyValue('--portrait-x'),'');
 stage.dispatchEvent(new w.PointerEvent('pointermove',{clientX:500,clientY:0,pointerType:'mouse'}));assert.equal(portrait.style.getPropertyValue('--portrait-x'),'');
 const section=d.getElementById('instruments');notify([{target:section,isIntersecting:true,boundingClientRect:{top:80}}]);assert.equal(d.querySelector('.st-experience-nav [aria-current]').hash,'#instruments');
 dispose();assert.ok(disconnected);assert.equal(d.querySelector('.st-experience-nav [aria-current]'),null);await w.happyDOM.abort();
});

test('scroll enhancement wakes only on demand, reveals tools, and releases its listeners',async()=>{
 const {mountSiteScroll}=await import('../../src/scripts/site-scroll.mjs');
 const w=new Window({url:'https://example.test/#tool-regression'}),d=w.document;
 d.body.innerHTML='<header class="site-header"></header><nav class="st-experience-nav"></nav><a href="#tool-spatial">Spatial</a><details id="tool-regression"></details><details id="tool-spatial"></details><textarea></textarea>';
 d.querySelector('.site-header').getBoundingClientRect=()=>({height:72});
 d.querySelector('.st-experience-nav').getBoundingClientRect=()=>({height:60});
 const frames=new Map();let next=0,engine,disconnected=false;
 w.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}};
 class Engine{constructor(options){this.options=options;this.events={};this.isScrolling=false;engine=this;}on(name,fn){this.events[name]=fn;}resize(){}scrollTo(){}raf(){this.ticks=(this.ticks||0)+1;}destroy(){this.destroyed=true;}}
 const dispose=mountSiteScroll(d,Engine);
 assert.equal(frames.size,0);assert.equal(d.getElementById('tool-regression').open,true);
 assert.equal(d.documentElement.style.getPropertyValue('--site-anchor-offset'),'150px');
 assert.equal(engine.options.anchors,true);assert.equal(engine.options.syncTouch,false);assert.equal(engine.options.autoRaf,false);
 assert.equal(engine.options.prevent(d.querySelector('textarea')),true);
 d.body.classList.add('nav-open');assert.equal(engine.options.prevent(d.body),true);d.body.classList.remove('nav-open');
 d.querySelector('a').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(d.getElementById('tool-spatial').open,true);
 const step=()=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(16);};
 engine.isScrolling='smooth';step();assert.equal(frames.size,1);
 engine.isScrolling=false;step();assert.equal(frames.size,0);
 engine.events['virtual-scroll']();assert.equal(frames.size,1);
 dispose();assert.equal(frames.size,0);assert.ok(disconnected&&engine.destroyed);assert.equal(d.documentElement.dataset.scrollEngine,undefined);
 assert.equal(d.documentElement.style.getPropertyValue('--site-anchor-offset'),'');
 engine.events.scroll();assert.equal(frames.size,0);await w.happyDOM.abort();
});


test('direct links reveal every containing disclosure and keep unrelated detail closed',async()=>{
 const {revealAnchorTarget}=await import('../../src/scripts/site-scroll.mjs');
 const w=new Window(),d=w.document;
 d.body.innerHTML='<details id="outer"><summary>Methods</summary><details id="inner"><summary>Example</summary><p id="target">Evidence</p></details></details><details id="unrelated"><summary>Other</summary></details>';
 assert.equal(revealAnchorTarget(d,'#target'),d.getElementById('target'));
 assert.ok(d.getElementById('outer').open&&d.getElementById('inner').open);
 assert.equal(d.getElementById('unrelated').open,false);
 assert.equal(revealAnchorTarget(d,'#missing'),null);assert.equal(revealAnchorTarget(d,'#%invalid'),null);
 await w.happyDOM.abort();
});

test('overview pages preserve detail and functional routes without opening everything at once',async()=>{
 for(const route of ['index.html','teaching/index.html','research/index.html']){
  const w=new Window(),d=w.document;d.write(await readFile(`dist/${route}`,'utf8'));
  assert.ok(d.querySelectorAll('details.content-disclosure').length,route);
  assert.equal(d.querySelectorAll('details.content-disclosure[open]').length,0,route);
  for(const link of d.querySelectorAll('.page-guide a,.st-experience-nav a'))assert.ok(d.getElementById(link.hash.slice(1)),link.hash);
  if(route==='index.html')assert.equal(d.querySelectorAll('.st-tool[open]').length,0);
  await w.happyDOM.abort();
 }
});
