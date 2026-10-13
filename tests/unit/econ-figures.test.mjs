import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleSegment,renderGraph,graphDescription} from '../../src/lib/econ-practice/figures.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
test('line clipping retains exact intercepts and handles positive, negative and zero slopes',()=>{
 assert.deepEqual(visibleSegment({intercept:10,slope:-3},8,12),[[0,10],[10/3,0]]);
 assert.deepEqual(visibleSegment({intercept:-4,slope:2},9,10),[[2,0],[7,10]]);
 assert.deepEqual(visibleSegment({intercept:3,slope:0},9,10),[[0,3],[9,3]]);
 assert.equal(visibleSegment({intercept:11,slope:0},9,10),null);
 assert.equal(visibleSegment({intercept:20,slope:1},9,10),null);
});
test('all bank graph segments stay in bounds and obey the stated line equation',()=>{
 for(const q of buildBank().filter(q=>q.graph))for(const line of q.graph.lines){
  const segment=visibleSegment(line,q.graph.xMax,q.graph.yMax);assert.ok(segment,q.id);
  for(const [x,y] of segment){assert.ok(x>=0&&x<=q.graph.xMax&&y>=0&&y<=q.graph.yMax,q.id);assert.ok(Math.abs(y-line.intercept-line.slope*x)<1e-9,q.id);}
 }
});
test('graph descriptions expose equations and safely escape labels',()=>{
 const g={kind:'lines',xLabel:'Q',yLabel:'P',xMax:10,yMax:20,lines:[{label:'<script> & "Demand"',intercept:20,slope:-2}]};
 const rendered=renderGraph(g);assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(!rendered.includes('<script>'));assert.ok(graphDescription(g).includes('P = 20 minus 2 times Q'));assert.ok(rendered.includes('aria-label="P against Q. Horizontal range'));
 assert.equal(renderGraph({...g,xMax:0}),'');
});

test('large monetary ticks receive space between the vertical title and plot',()=>{
 const g={kind:'lines',xMax:11500,yMax:126500,xLabel:'Volume',yLabel:'Total cost ($)',lines:[{label:'Home',intercept:0,slope:11}]};
 const svg=renderGraph(g);
 const left=Number(svg.match(/class="axis" d="M([\d.]+),/)[1]);
 assert(left>=99);
 assert(svg.includes('126500'));
});
