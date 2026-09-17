import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const data=await import('../../src/data/macroeconomics.mjs').catch(()=>({}));
const ui=await import('../../src/scripts/macroeconomics-lab.mjs').catch(()=>({}));
test('every model has explicit assumptions, equations, exercises, sources and admissible controls',()=>{
  assert.equal(data.models?.length,15);
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
  const f=fixture();for(const model of data.models){f.root.querySelector(`[data-model="${model.id}"]`).click();assert.equal(f.app.state.model,model.id);assert.ok(f.root.querySelector('svg'));for(const level of ['equations','computation','explore','research']){f.root.querySelector(`[data-mode="${level}"]`).click();assert.equal(f.app.state.mode,level);assert.ok(f.root.querySelector('[data-reading]').textContent.length>80);}}
  f.window.happyDOM.abort();
});
test('invalid input reports an error and recovers on the next valid input',()=>{
  const f=fixture(),input=f.root.querySelector('[data-param="s"]');input.type='number';input.value='2';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.root.querySelector('[data-error]').hidden,false);
  input.value='.3';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.root.querySelector('[data-error]').hidden,true);assert.equal(f.app.state.params.s,.3);f.window.happyDOM.abort();
});
test('changing the inspected period preserves the active slider element',()=>{
  const f=fixture(),input=f.root.querySelector('[data-inspect-step]');input.focus();input.value='1';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.root.querySelector('[data-inspect-step]'),input);assert.equal(f.window.document.activeElement,input);assert.equal(f.app.state.step,1);f.window.happyDOM.abort();
});
test('period selection links equations, flow and trajectory markers without re-solving',()=>{
 const f=fixture(),result=f.app.state.result;assert.ok(f.root.querySelector('[data-live-math]'));
 const slider=f.root.querySelector('[data-inspect-step]');assert.ok(slider);slider.value='9';slider.dispatchEvent(new f.window.Event('input',{bubbles:true}));
 assert.equal(f.app.state.step,9);assert.equal(f.app.state.result,result);assert.equal(f.root.querySelector('[data-live-math]').dataset.period,'9');
 assert.match(f.root.querySelector('[data-flow] svg').getAttribute('aria-label'),/Period 9/);assert.ok(f.root.querySelector('[data-selected-x="9"]'));assert.equal(f.root.querySelector('[data-plots]').hidden,false);f.window.happyDOM.abort();
});
test('keyboard chart selection and table selection update the shared inspector',()=>{
 const f=fixture(),plot=f.root.querySelector('svg[data-chart-select="period"]');assert.ok(plot);
 plot.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.app.state.step,1);
 f.root.querySelector('[data-mode="computation"]').click();f.root.querySelector('[data-row="6"]').click();assert.equal(f.app.state.step,6);assert.equal(f.root.querySelector('[data-live-math]').dataset.period,'6');f.window.happyDOM.abort();
});
test('AK comparative statics chart changes the parameter and updates live equations',()=>{
 const f=fixture();f.root.querySelector('[data-model="ak"]').click();const plot=f.root.querySelector('svg[data-chart-select="s"]');assert.ok(plot);
 plot.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.app.state.params.s,.21);assert.equal(Number(f.root.querySelector('[data-param="s"]').value),.21);assert.match(f.root.querySelector('[data-live-math]').textContent,/0.21/);f.window.happyDOM.abort();
});
test('research methods have interactive distributions and Jacobian cells, not placeholder cards',()=>{
 const f=fixture();f.root.querySelector('[data-model="household"]').click();assert.ok(f.root.querySelector('svg[data-chart-select="capital"]'));
 f.root.querySelector('[data-model="sequence"]').click();const cell=f.root.querySelector('[data-matrix-row="5"][data-matrix-column="3"]');assert.ok(cell);cell.dispatchEvent(new f.window.MouseEvent('click',{bubbles:true}));assert.equal(f.app.state.step,5);assert.equal(f.app.state.params.shockAt,3);assert.match(f.root.querySelector('[data-live-math]').textContent,/5/);f.window.happyDOM.abort();
});
test('matrix selection can reach every date in an extended horizon and survives horizon changes',()=>{
 const f=fixture();f.root.querySelector('[data-model="sequence"]').click();const horizon=f.root.querySelector('[data-param="T"]');horizon.value='40';horizon.dispatchEvent(new f.window.Event('input',{bubbles:true}));
 f.root.querySelector('[data-matrix-row="35"][data-matrix-column="30"]').dispatchEvent(new f.window.MouseEvent('click',{bubbles:true}));assert.equal(f.app.state.params.shockAt,30);assert.equal(f.app.state.step,35);assert.equal(f.root.querySelector('[data-error]').hidden,true);
 horizon.value='20';horizon.dispatchEvent(new f.window.Event('input',{bubbles:true}));assert.equal(f.app.state.params.shockAt,20);assert.equal(f.app.state.step,20);assert.equal(f.root.querySelector('[data-error]').hidden,true);f.window.happyDOM.abort();
});
test('all 15 live models render valid mathematics and meaningful connected views',()=>{
 const f=fixture();for(const model of data.models){f.root.querySelector(`[data-model="${model.id}"]`).click();assert.equal(f.root.querySelector('[data-error]').hidden,true,`${model.id}: ${f.root.querySelector('[data-error]').textContent}`);assert.equal(f.root.querySelector('[data-live-math]').dataset.model,model.id);assert.ok(f.root.querySelectorAll('[data-plots] svg').length>=2,model.id);assert.ok(f.root.querySelector('[data-live-math] .katex-mathml'),model.id);f.root.querySelector('[data-mode="research"]').click();assert.ok(f.root.querySelector('.macro-research'));}
 f.window.happyDOM.abort();
});
test('selected stochastic state changes the Bellman evaluation while preserving the solution',()=>{
 const f=fixture();f.root.querySelector('[data-model="household"]').click();const before=f.root.querySelector('[data-live-math]').textContent,result=f.app.state.result,select=f.root.querySelector('[data-productivity]');select.value='1';select.dispatchEvent(new f.window.Event('change',{bubbles:true}));assert.equal(f.app.state.result,result);assert.notEqual(f.root.querySelector('[data-live-math]').textContent,before);assert.equal(f.app.state.productivity,1);f.window.happyDOM.abort();
});
test('switching income state also highlights the corresponding policy curve',()=>{
 const f=fixture();f.root.querySelector('[data-model="household"]').click();let active=f.root.querySelector('[data-chart-name="Assets carried into the next period"] [data-series-active="true"]');assert.equal(active?.dataset.seriesIndex,'0');
 const input=f.root.querySelector('[data-productivity]');input.value='1';input.dispatchEvent(new f.window.Event('change',{bubbles:true}));active=f.root.querySelector('[data-chart-name="Assets carried into the next period"] [data-series-active="true"]');assert.equal(active?.dataset.seriesIndex,'1');f.window.happyDOM.abort();
});
