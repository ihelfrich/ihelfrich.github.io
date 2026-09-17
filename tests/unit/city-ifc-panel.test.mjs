import test from 'node:test';import assert from 'node:assert/strict';import {Window}from'happy-dom';
import {createCityIfcPanel}from'../../src/scripts/city/city-ifc-panel.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(t,{loadViewer}={}){const win=new Window(),target=win.document.createElement('div');win.document.body.append(target);const loads=[],rejects=[],calls=[];const client={load:()=>new Promise((resolve,reject)=>{loads.push(resolve);rejects.push(reject);}),properties:async id=>({id,properties:[{group:'Example',name:'Unsafe title',value:'<img src=x onerror=alert(1)>'}]}),cancel(){calls.push('cancel');},destroy(){calls.push('destroy');}};
 const viewer={load:()=>calls.push('render'),setActive:v=>calls.push(['active',v]),visibility:v=>calls.push(['visible',[...v]]),select:id=>calls.push(['select',id]),destroy(){calls.push('dispose');},clear(){},fit(){},rotate(){},zoom(){}};
 const panel=createCityIfcPanel({document:win.document,target,client,loadViewer:loadViewer||(async()=>({createIfcViewer:()=>viewer}))});t.after(()=>{panel.destroy();win.happyDOM.abort();});return{win,target,panel,loads,rejects,calls,viewer};}
const model={schema:'IFC4',triangles:2,elements:[{id:31,type:'IfcWall',name:'Wall',globalId:'exact-guid'},{id:48,type:'IfcSlab',name:'Roof'}],parts:[],geometries:[]};
const file={name:'local.ifc',size:2,arrayBuffer:async()=>new ArrayBuffer(2)};
test('model rendering is lazy, selected source values are text, and categories can isolate exact elements',async t=>{
 const h=setup(t);assert.equal(h.calls.length,0);h.panel.setActive(true);assert.equal(h.calls.length,0);const loading=h.panel.loadFile(file);await flush();h.loads[0](model);await loading;
 assert.ok(h.calls.includes('render'));h.target.querySelector('[data-ifc-element="31"]').click();await flush();assert.match(h.target.textContent,/exact-guid/);assert.match(h.target.textContent,/<img src=x/);assert.equal(h.target.querySelector('img'),null);
 h.target.querySelector('[data-ifc-isolate="IfcWall"]').click();assert.deepEqual(h.calls.filter(c=>Array.isArray(c)&&c[0]==='visible').at(-1),['visible',['IfcWall']]);
 const checkbox=h.target.querySelector('[data-ifc-category="IfcWall"]');checkbox.focus();checkbox.click();assert.equal(h.win.document.activeElement,checkbox,'Visibility updates retain keyboard focus');
});
test('a parser failure is explicit and cannot expose stale ready controls or evidence',async t=>{
 const h=setup(t);h.panel.setActive(true);const loading=h.panel.loadFile(file);await flush();h.rejects[0](Error('Unsupported fixture geometry'));await loading;
 assert.match(h.target.querySelector('[data-ifc="status"]').textContent,/Unsupported fixture geometry/);assert.equal(h.target.querySelector('[data-ifc="workspace"]').hidden,true);assert.equal(h.target.querySelector('[data-ifc="fit"]').disabled,true);assert.ok(!h.calls.includes('render'));
});
test('leaving during a parse cancels work and later completion cannot activate the hidden viewer',async t=>{
 const h=setup(t);h.panel.setActive(true);const loading=h.panel.loadFile(file);await flush();h.panel.setActive(false);h.loads[0](model);await loading;
 assert.ok(h.calls.includes('cancel'));assert.ok(!h.calls.includes('render'));assert.match(h.target.querySelector('[data-ifc="status"]').textContent,/Loading stopped/);h.panel.setActive(true);await flush();assert.ok(!h.calls.includes('render'));
});
test('closing a model while its file is loading cannot restore stale geometry',async t=>{
 const h=setup(t);h.panel.setActive(true);const loading=h.panel.loadFile(file);await flush();h.target.querySelector('[data-ifc="close"]').click();h.loads[0](model);await loading;
 assert.ok(!h.calls.includes('render'));assert.equal(h.target.querySelector('[data-ifc-element]'),null);assert.match(h.target.querySelector('[data-ifc="status"]').textContent,/closed/i);
});
test('a ready active model reveals the canvas once and keeps its local-file attribution at the canvas',async t=>{
 const h=setup(t),scrolls=[];h.target.querySelector('[data-ifc="stage"]').scrollIntoView=options=>scrolls.push(options);h.panel.setActive(true);
 const loading=h.panel.loadFile(file);await flush();h.loads[0](model);await loading;
 assert.equal(scrolls.length,1);assert.equal(scrolls[0].block,'start');assert.match(h.target.querySelector('[data-ifc="stage-label"]').textContent,/Local model.*local\.ifc/);assert.equal(h.target.querySelector('[data-ifc="stage-label"]').hidden,false);
 h.panel.setActive(false);h.panel.setActive(true);assert.equal(scrolls.length,1,'Returning to the existing model preserves the user’s scroll position');
});
test('a viewer module completing after navigation away cannot scroll the hidden model into view',async t=>{
 let ready;const h=setup(t,{loadViewer:()=>new Promise(resolve=>{ready=resolve;})}),scrolls=[];h.target.querySelector('[data-ifc="stage"]').scrollIntoView=options=>scrolls.push(options);h.panel.setActive(true);
 const loading=h.panel.loadFile(file);await flush();h.loads[0](model);await flush();h.panel.setActive(false);ready({createIfcViewer:()=>h.viewer});await loading;
 assert.equal(scrolls.length,0);assert.ok(!h.calls.includes('render'));
});
