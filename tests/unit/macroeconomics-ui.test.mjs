import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const data=await import('../../src/data/macroeconomics.mjs').catch(()=>({}));
const ui=await import('../../src/scripts/macroeconomics-lab.mjs').catch(()=>({}));
test('every model has explicit assumptions, equations, exercises, sources and admissible controls',()=>{
  assert.equal(data.models?.length,8);
  for(const m of data.models){assert.ok(m.equations.length>=2);assert.ok(m.assumptions.length>=2);assert.ok(m.source.url.startsWith('https://'));assert.ok(m.exercise.answer);for(const f of m.fields){assert.ok(f.key);if(!f.options)assert.ok(f.min<=m.defaults[f.key]&&m.defaults[f.key]<=f.max);}}
});
function fixture(){
  assert.equal(typeof ui.initializeMacro,'function');const window=new Window({url:'http://localhost/macroeconomics/'});
  window.document.body.innerHTML=`<section data-macro><select data-model-select></select><nav data-model-nav></nav><h2 data-model-title></h2><p data-model-question></p><span data-level></span><div data-controls></div><button data-reset>Reset</button><p data-error hidden></p><div data-metrics></div><div data-plots></div><div data-flow></div><p data-live></p><div data-reading-nav></div><div data-reading></div></section>`;
  const app=ui.initializeMacro(window.document);const root=window.document.querySelector('[data-macro]');return {window,root,app};
}
test('controls update the same ledger, view and accessible data',()=>{
  const f=fixture();assert.equal(f.app.state.model,'solow');assert.equal(f.app.state.result.rows[0].k,16);
  const input=f.root.querySelector('[data-param="n"]');input.value='0.05';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));
  assert.ok(f.app.state.result.rows[1].k<16);assert.match(f.root.querySelector('[data-live]').textContent,/worker/);
  f.root.querySelector('[data-reset]').click();assert.equal(f.app.state.params.n,.02);f.window.happyDOM.abort();
});
test('compact model picker updates the model and stays synchronized with model buttons',()=>{
  const f=fixture(),select=f.root.querySelector('[data-model-select]');
  select.innerHTML=data.models.map(m=>`<option value="${m.id}">${m.title}</option>`).join('');
  select.value='nk';select.dispatchEvent(new f.window.Event('change',{bubbles:true}));assert.equal(f.app.state.model,'nk');
  f.root.querySelector('[data-model="ak"]').click();assert.equal(select.value,'ak');f.window.happyDOM.abort();
});
test('all model selectors, learning modes and SVG views work without stale parameters',()=>{
  const f=fixture();for(const model of data.models){f.root.querySelector(`[data-model="${model.id}"]`).click();assert.equal(f.app.state.model,model.id);assert.ok(f.root.querySelector('svg'));for(const level of ['equations','computation','explore']){f.root.querySelector(`[data-mode="${level}"]`).click();assert.equal(f.app.state.mode,level);assert.ok(f.root.querySelector('[data-reading]').textContent.length>80);}}
  f.window.happyDOM.abort();
});
test('invalid input reports an error and recovers on the next valid input',()=>{
  const f=fixture(),input=f.root.querySelector('[data-param="s"]');input.type='number';input.value='2';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.root.querySelector('[data-error]').hidden,false);
  input.value='.3';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.root.querySelector('[data-error]').hidden,true);assert.equal(f.app.state.params.s,.3);f.window.happyDOM.abort();
});
test('changing the inspected period preserves the active slider element',()=>{
  const f=fixture(),input=f.root.querySelector('[data-flow] input');input.focus();input.value='1';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.root.querySelector('[data-flow] input'),input);assert.equal(f.window.document.activeElement,input);assert.equal(f.app.state.step,1);f.window.happyDOM.abort();
});
