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
