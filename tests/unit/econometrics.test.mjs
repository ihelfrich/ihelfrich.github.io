import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';
import { randomNormal, observationSample, world, interventionMean, ols, samplingExperiment, designBounds, csv, readingPaths, missingPrerequisites, chapterList, notation } from '../../src/lib/econometrics.mjs';

const chapterDirectory = new URL('../../src/content/econometrics/', import.meta.url);
const chapters = readdirSync(chapterDirectory).filter(f => f.endsWith('.md')).sort().map(file => {
  const meta = load(readFileSync(new URL(file, chapterDirectory), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1]);
  return { file, ...meta };
});
const requires = Object.fromEntries(chapters.map(c => [c.order, c.requires]));
const closure = order => { const seen = new Set(), stack = [...requires[order]]; while (stack.length) { const c = stack.pop(); if (!seen.has(c)) { seen.add(c); stack.push(...requires[c]); } } return seen; };

test('all causal worlds give exactly the same observed sample', () => {
  const data = observationSample(2026, 160);
  const reference = world(data, -1);
  for (const b of [-.5, 0, .5, 1, 2]) assert.deepEqual(world(data, b), reference);
  for (const {x,y,u,v} of data) for (const b of [-1,0,2]) assert.ok(Math.abs(y-(b*x+(1-b)*u+v)) < 1e-12);
  assert.deepEqual(Object.keys(reference[0]), ['id','d','y'], 'observed columns use the book notation: training d, output y');
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
  assert.equal(designBounds(2.5).decision,'Robustly positive');
  // At M = 3 the net-value set is [0, 600]: no allowed effect loses money, so training weakly dominates.
  const boundary=designBounds(3);
  assert.deepEqual(boundary.net,[0,600]);
  assert.equal(boundary.decision,'Weakly positive');
  assert.match(boundary.note,/No allowed effect loses money/);
  assert.equal(designBounds(3.5).decision,'Depends on the assumption');
  assert.equal(designBounds(8).decision,'Depends on the assumption');
  for(const M of [0,1,2,3,3.5,4,8,10]){
    const d=designBounds(M),label=d.net[0]>0?'Robustly positive':d.net[0]===0?'Weakly positive':'Depends on the assumption';
    assert.equal(d.decision,label,`M=${M}`); assert.ok(d.note.length>0);
  }
});
test('invalid numerical inputs rejected instead of silently producing NaN', () => {
  assert.throws(()=>designBounds(-1)); assert.throws(()=>samplingExperiment({n:0}));
  assert.throws(()=>observationSample(1,0)); assert.throws(()=>ols([{x:1,y:1},{x:1,y:2}]));
  assert.throws(()=>interventionMean(Infinity,1));
});
test('CSV contains declared columns and data, with escaping', () => {
  assert.equal(csv([{x:1,label:'a,b'}],['x','label']),'x,label\n1,"a,b"\n');
});
test('chapter prerequisites point only backward and agree with the prerequisite text', () => {
  assert.deepEqual(chapters.map(c => c.order), [1,2,3,4,5,6,7,8,9,10,11,12]);
  for (const c of chapters) {
    assert.ok(Array.isArray(c.requires), `${c.file}: requires array`);
    for (const r of c.requires) assert.ok(Number.isInteger(r) && r >= 1 && r < c.order, `${c.file}: requires only earlier chapters`);
    const recommends = c.recommends ?? [];
    for (const r of recommends) assert.ok(Number.isInteger(r) && r >= 1 && r < c.order && !closure(c.order).has(r), `${c.file}: recommends only earlier chapters that requires does not already reach`);
    const named = [...c.prerequisites.matchAll(/chapters? (\d+(?:(?:,? and |, )\d+)*)/gi)].flatMap(m => m[1].match(/\d+/g).map(Number));
    // A later chapter named in the prerequisites is a forward pointer; an earlier one must be required or recommended.
    for (const n of named.filter(n => n < c.order)) assert.ok(closure(c.order).has(n) || recommends.includes(n), `${c.file}: prerequisites name chapter ${n}, which neither requires nor recommends reaches`);
    for (const r of recommends) assert.ok(named.includes(r), `${c.file}: prerequisites explain why chapter ${r} is recommended`);
  }
  // Chapter 12 rests its bound on a transport assumption that chapter 11 develops.
  assert.deepEqual(chapters[11].recommends, [11]);
});
test('no suggested reading path omits a prerequisite', () => {
  for (const [name, path] of Object.entries(readingPaths)) {
    assert.deepEqual(missingPrerequisites(path.core, requires), [], `${name}: core chapters`);
    assert.deepEqual(missingPrerequisites([...path.core, ...path.optional], requires), [], `${name}: core with optional chapters`);
    for (const c of path.optional) assert.ok(!path.core.includes(c), `${name}: chapter ${c} is either core or optional`);
    for (const c of path.core) for (const r of chapters[c - 1].recommends ?? []) assert.ok(path.core.includes(r) || path.optional.includes(r), `${name}: chapter ${c} recommends chapter ${r}, which the path should offer`);
  }
  // The previously published paths skipped prerequisites; the check must catch them.
  assert.notDeepEqual(missingPrerequisites([1,4,6,8,10,11,12], requires), []);
  assert.notDeepEqual(missingPrerequisites([2,3,4,7,10,12], requires), []);
});
test('reading-path summaries name chapters in words', () => {
  assert.equal(chapterList([11]), 'chapter 11');
  assert.equal(chapterList([10, 11]), 'chapters 10 and 11');
  assert.equal(chapterList([1, 2, 3, 4, 5, 6]), 'chapters 1–6');
  assert.equal(chapterList(readingPaths.applied.core), 'chapters 1–6, 8, and 12');
  assert.equal(chapterList(readingPaths.theory.core), 'chapters 1–5, 7, 8, 10, and 12');
});
test('notation table gives each symbol one entry', () => {
  const symbols = notation.map(([symbol]) => symbol);
  assert.equal(new Set(symbols).size, symbols.length);
  for (const symbol of ['Y','D','X','K','Z','R','S']) assert.ok(symbols.includes(symbol), symbol);
});
