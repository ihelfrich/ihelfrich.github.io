import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {mountHomepage} from '../../src/scripts/homepage-studio.mjs';
test('built homepage retains no-JS content and enhances keyboard and motion controls',async()=>{
 const w=new Window({url:'https://example.test'});w.document.write(await readFile('dist/index.html','utf8'));
 const doc=w.document,frames=new Map();let id=0;const observers=[];
 const media=Object.assign(new w.EventTarget(),{matches:false});w.matchMedia=()=>media;
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};w.cancelAnimationFrame=id=>frames.delete(id);
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 w.ResizeObserver=class{observe(){}disconnect(){}};
 w.IntersectionObserver=class{constructor(fn){this.fn=fn;observers.push(this)}observe(){this.fn([{isIntersecting:true}])}disconnect(){}};
 assert.equal([...doc.querySelectorAll('.st-project')].filter(p=>!p.hidden).length,3);
 assert.ok(doc.querySelector('[role=tablist]').hidden);
 const dispose=mountHomepage(doc);
 const tabs=[...doc.querySelectorAll('[role=tab]')];
 assert.equal(doc.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);
 tabs[1].click();assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(doc.querySelector('[role=tabpanel]:not([hidden])').id,'project-panel-1');
 tabs[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(doc.activeElement,tabs[2]);
 tabs[2].dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(doc.activeElement,tabs[0]);
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


test('visitor choices produce relevant routes and compose an editable email without sending',async()=>{
 const {mountVisitorPath}=await import('../../src/scripts/visitor-path.mjs');
 const {visitorPaths,resolveVisitorPath,visitorDraft}=await import('../../src/data/visitor-paths.mjs');
 assert.equal(resolveVisitorPath('__proto__','x'),null);assert.equal(resolveVisitorPath('constructor','x'),null);
 for(const [route,url] of [['index.html','https://example.test/'],['contact/index.html','https://example.test/contact?intent=research&focus=spatial']]){
  const w=new Window({url}),d=w.document;d.write(await readFile(`dist/${route}`,'utf8'));
  const root=d.querySelector('[data-visitor-path]');assert.ok(root.querySelector('[data-visitor-controls]').hidden);assert.equal(root.querySelector('[data-visitor-fallback]').hidden,false);
  let dispose=mountVisitorPath(root);const select=root.querySelector('[data-visitor-focus]');
  if(route.startsWith('contact')){assert.equal(select.value,'spatial');assert.equal(root.querySelector('[data-visitor-title]').textContent,visitorPaths.research.options[1].title);}
  for(const [id,path] of Object.entries(visitorPaths)){
   const radio=root.querySelector(`[value="${id}"]`);radio.checked=true;radio.dispatchEvent(new w.Event('change'));
   for(const option of path.options){select.value=option.id;select.dispatchEvent(new w.Event('change'));assert.equal(root.querySelector('[data-visitor-resource]').getAttribute('href'),option.href);assert.equal(root.querySelector('[data-visitor-title]').textContent,option.title);}
  }
  if(route.startsWith('contact')){
   const question=root.querySelector('[data-visitor-question]');question.value='<img src=x onerror=alert(1)>\nBcc: unwanted@example.test';question.dispatchEvent(new w.Event('input'));
   assert.equal(root.querySelector('[data-draft-body] img'),null);assert.ok(root.querySelector('[data-draft-body]').textContent.includes(question.value));
   const href=new URL(root.querySelector('[data-visitor-email]').href);assert.equal(href.searchParams.has('bcc'),false);assert.ok(href.searchParams.get('body').includes(question.value));
   dispose();dispose=mountVisitorPath(root);assert.equal(select.value,'teaching');assert.ok(root.querySelector('[data-draft-body]').textContent.includes(question.value));
  }else assert.ok(root.querySelector('[data-visitor-contact]').href.endsWith('/contact?intent=opportunity&focus=teaching'));
  dispose();await w.happyDOM.abort();
 }
 const draft=visitorDraft('learn','ideas','Zoë','How does β change?');assert.ok(decodeURIComponent(draft.href).includes('Zoë'));assert.ok(decodeURIComponent(draft.href).includes('β'));
});


test('every suggested visitor resource resolves to a built page and destination',async()=>{
 const {visitorPaths}=await import('../../src/data/visitor-paths.mjs');
 const seen=new Map();
 for(const path of Object.values(visitorPaths))for(const option of path.options){
  const url=new URL(option.href,'https://example.test');const file=`dist${url.pathname.replace(/\/$/,'')}/index.html`;
  if(!seen.has(file))seen.set(file,await readFile(file,'utf8'));
  if(url.hash){const w=new Window();w.document.write(seen.get(file));assert.ok(w.document.getElementById(url.hash.slice(1)),option.href);await w.happyDOM.abort();}
 }
});
