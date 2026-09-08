import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {continuumPoint,mountContinuum} from '../../src/scripts/research-continuum.mjs';
test('all visual forms stay finite and within the camera volume',()=>{
 for(let mode=0;mode<3;mode++)for(const t of [0,100,100000])for(let i=0;i<100;i++){
  const p=continuumPoint(i/99,(i*37%100)/99,t,mode);
  assert.ok(p.every(x=>Number.isFinite(x)&&Math.abs(x)<1.6));
 }
});
test('homepage retains its actual instruments and navigable research map',async()=>{
 const w=new Window();w.document.write(await readFile('dist/index.html','utf8'));const d=w.document;
 for(const id of ['continuum','instruments','connections','tool-transport','tool-regression','tool-spatial','research-graph'])assert.ok(d.getElementById(id),id);
 assert.ok(d.querySelector('[data-ot-run]'));assert.ok(d.querySelector('[data-est-add]'));assert.ok(d.querySelector('[data-spatial-studio]'));assert.ok(d.querySelector('[data-graph-tag]'));
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'unique IDs across all embedded tools');
 await w.happyDOM.abort();
});
test('visual navigation morphs, opens its tool, respects motion preferences, and disposes frames',async()=>{
 const w=new Window();w.document.write(await readFile('dist/index.html','utf8'));const d=w.document,frames=new Set();let id=0;let visibility;
 const media=Object.assign(new w.EventTarget(),{matches:false});w.matchMedia=()=>media;
 w.requestAnimationFrame=()=>{frames.add(++id);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 w.ResizeObserver=class{observe(){}disconnect(){}};
 w.IntersectionObserver=class{constructor(fn){visibility=fn;}observe(){visibility([{isIntersecting:true}]);}disconnect(){}};
 const root=d.querySelector('[data-continuum]'),dispose=mountContinuum(root);
 assert.ok(frames.size);root.querySelector('[data-form="2"]').click();assert.equal(root.querySelector('[data-continuum-link]').getAttribute('href'),'#tool-regression');
 root.querySelector('[data-continuum-link]').click();assert.ok(d.querySelector('#tool-regression').open);
 root.querySelector('[data-continuum-pause]').click();assert.equal(frames.size,0);
 root.querySelector('[data-continuum-pause]').click();assert.ok(frames.size);
 visibility([{isIntersecting:false}]);assert.equal(frames.size,0);
 media.matches=true;media.dispatchEvent(new w.Event('change'));assert.ok(root.querySelector('[data-continuum-pause]').disabled);
 media.matches=false;media.dispatchEvent(new w.Event('change'));visibility([{isIntersecting:true}]);assert.ok(frames.size);
 dispose();assert.equal(frames.size,0);await w.happyDOM.abort();
});
