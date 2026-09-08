import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const module = await import('../../src/scripts/measurement-lab.mjs').catch(() => ({}));
function fixture(){
  assert.equal(typeof module.initializeMeasurement,'function','Measurement controller must exist');
  const window=new Window();
  window.document.body.innerHTML=`<section data-measurement>
    <input data-m-weight value="50"><input data-m-spread value="0">
    <input data-m-audit type="checkbox"><input data-m-veto type="checkbox">
    <input data-m-q value="1"><output data-m-weight-value></output><output data-m-spread-value></output>
    <output data-m-q-value></output><span data-m-gap></span><p data-m-verdict></p>
    <p data-m-veto-result></p><p data-m-ordinal-result></p><span data-m-mean-b></span>
    <span data-m-mean-a></span><pre data-m-record></pre><button data-m-reset>Reset</button>
    <button data-m-preset="90">Access</button><button data-m-q-preset="2">Stretch</button>
    <button data-m-export>Export</button></section>`;
  module.initializeMeasurement(window.document);
  const el=window.document.querySelector('[data-measurement]');
  function set(selector,value){const control=el.querySelector(selector);if(control.type==='checkbox')control.checked=value;else control.value=String(value);control.dispatchEvent(new window.Event('input',{bubbles:true}));}
  const record=()=>JSON.parse(el.querySelector('[data-m-record]').textContent);
  return {window,el,set,record};
}
test('default rendered analysis retains the full compatible range',()=>{
  const f=fixture();assert.match(f.el.querySelector('[data-m-gap]').textContent,/-25.*10/);
  assert.deepEqual(f.record().weights,[.5,.5]);assert.equal(f.record().comparison.status,'unresolved');
  f.window.happyDOM.abort();
});
test('weight, audit, and hard floor update distinct conclusions',()=>{
  const f=fixture();f.set('[data-m-weight]',90);
  assert.equal(f.record().comparison.lower,3);assert.equal(f.record().comparison.upper,34);
  f.set('[data-m-audit]',true);assert.equal(f.record().comparison.lower,4);assert.equal(f.record().comparison.upper,33);
  f.set('[data-m-veto]',true);assert.equal(f.record().feasibility.A,'excluded');assert.equal(f.record().feasibility.B,'guaranteed');
  assert.match(f.el.querySelector('[data-m-veto-result]').textContent,/A.*excluded/i);
  f.window.happyDOM.abort();
});
test('recoding preserves ordinal evidence while the mean ranking changes',()=>{
  const f=fixture();f.set('[data-m-q]',2);
  assert.ok(f.record().ordinal.gap>0);assert.equal(f.record().ordinal.superiority,.5);
  f.set('[data-m-q]',.5);assert.ok(f.record().ordinal.gap<0);
  f.window.happyDOM.abort();
});
test('disagreement clips to admissible weights and reset restores all controls',()=>{
  const f=fixture();f.set('[data-m-weight]',90);f.set('[data-m-spread]',30);
  assert.deepEqual(f.record().weights,[.6,1]);f.set('[data-m-q]',2);f.set('[data-m-veto]',true);
  f.el.querySelector('[data-m-reset]').click();assert.deepEqual(f.record().weights,[.5,.5]);assert.equal(f.record().ordinal.q,1);assert.equal(f.record().controlFloor,null);
  f.window.happyDOM.abort();
});
test('exported analysis carries provenance and declared assumptions',()=>{
  const f=fixture();const r=f.record();
  assert.equal(r.schema,'measurement-argument/v1');assert.equal(r.dataStatus,'synthetic teaching scenario');
  assert.ok(r.assumptions.some(x=>/not.*confidence/i.test(x)));assert.deepEqual(r.profiles.A.control,[25,45]);
  f.el.querySelector('[data-m-preset="90"]').click();assert.deepEqual(f.record().weights,[.9,.9]);
  f.el.querySelector('[data-m-q-preset="2"]').click();assert.equal(f.record().ordinal.q,2);
  f.window.happyDOM.abort();
});
