import test from 'node:test';
import assert from 'node:assert/strict';
import { randomNormal, observationSample, world, interventionMean, ols, samplingExperiment, designBounds, csv } from '../../src/lib/econometrics.mjs';

test('all causal worlds give exactly the same observed sample', () => {
  const data = observationSample(2026, 160);
  const reference = world(data, -1);
  for (const b of [-.5, 0, .5, 1, 2]) assert.deepEqual(world(data, b), reference);
  for (const {x,y,u,v} of data) for (const b of [-1,0,2]) assert.ok(Math.abs(y-(b*x+(1-b)*u+v)) < 1e-12);
});
test('interventions replace X only: mean changes with causal slope', () => {
  assert.equal(interventionMean(2, 1), 2);
  assert.equal(interventionMean(-1, 1), -1);
  assert.equal(interventionMean(0, 2), 0);
});
test('seeded samples reproduce without changing global RNG', () => {
  assert.deepEqual(observationSample(41, 20), observationSample(41,20));
  assert.notDeepEqual(observationSample(41,20), observationSample(42,20));
});
test('OLS recovers known affine line and residual orthogonality', () => {
  const fit=ols([{x:-2,y:-3},{x:0,y:1},{x:2,y:5}]);
  assert.equal(fit.slope,2); assert.equal(fit.intercept,1);
  const d=observationSample(2026,160), f=ols(d);
  assert.ok(Math.abs(d.reduce((s,p)=>s+p.y-f.intercept-f.slope*p.x,0))<1e-10);
  assert.ok(Math.abs(d.reduce((s,p)=>s+p.x*(p.y-f.intercept-f.slope*p.x),0))<1e-10);
});
test('large synthetic sample has specified population moments', () => {
  const d=observationSample(908,50000), f=ols(d);
  assert.ok(Math.abs(f.slope-1)<.025); assert.ok(Math.abs(f.intercept)<.025);
});
test('Gaussian 95 percent known-sigma coverage near nominal over 20000 independent draws', () => {
  const r=samplingExperiment({seed:777,n:50,bias:0,repetitions:20000});
  assert.ok(r.coverage>.942 && r.coverage<.958, String(r.coverage));
});
test('larger sample reduces interval width at square-root rate', () => {
  const a=samplingExperiment({n:25}),b=samplingExperiment({n:100});
  assert.ok(Math.abs(a.halfWidth/b.halfWidth-2)<1e-12);
});
test('bias creates precise errors: coverage collapses with larger n', () => {
  const a=samplingExperiment({n:20,bias:.5,repetitions:1000});
  const b=samplingExperiment({n:1000,bias:.5,repetitions:1000});
  assert.ok(a.coverage>b.coverage); assert.equal(b.coverage,0);
});
test('sampling export intervals and coverage indicator agree', () => {
  for(const p of samplingExperiment({n:30,bias:.1}).rows) {
    assert.equal(p.covers,p.low<=0&&p.high>=0);
    assert.ok(Math.abs((p.low+p.high)/2-p.mean)<1e-12);
  }
});
test('DiD bound collapses to 6 under parallel trends', () => {
  const d=designBounds(0); assert.equal(d.dd,6); assert.deepEqual(d.effect,[6,6]); assert.deepEqual(d.net,[300,300]);
});
test('bounded violations include exactly the compatible effects', () => {
  for(const M of [0,.5,2,6,10]){
    const d=designBounds(M);
    for(const delta of [-M,0,M]) assert.ok(6-delta>=d.effect[0]&&6-delta<=d.effect[1]);
    assert.equal(d.effect[1]-d.effect[0],2*M);
  }
});
test('decision boundary is correct, including zero net benefit', () => {
  assert.equal(designBounds(2).decision,'Robustly positive');
  assert.equal(designBounds(3).decision,'Depends on the assumption');
  assert.equal(designBounds(8).decision,'Depends on the assumption');
});
test('invalid numerical inputs rejected instead of silently producing NaN', () => {
  assert.throws(()=>designBounds(-1)); assert.throws(()=>samplingExperiment({n:0}));
  assert.throws(()=>observationSample(1,0)); assert.throws(()=>ols([{x:1,y:1},{x:1,y:2}]));
  assert.throws(()=>interventionMean(Infinity,1));
});
test('CSV contains declared columns and data, with escaping', () => {
  assert.equal(csv([{x:1,label:'a,b'}],['x','label']),'x,label\n1,"a,b"\n');
});
