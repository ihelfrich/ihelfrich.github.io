import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {propertyAtlasAvailableViewport} from '../../src/lib/city-property-atlas.mjs';

test('mobile property context scrolls with controls while desktop retains sticky context', async () => {
  const page = await readFile(new URL('../../src/pages/st-louis.astro', import.meta.url), 'utf8');
  const paths = [...page.matchAll(/import ['"]\.\.\/styles\/([^'"]+\.css)['"]/g)].map(match => match[1]);
  const css = (await Promise.all(paths.map(path => readFile(new URL('../../src/styles/' + path, import.meta.url), 'utf8')))).join('\n');
  for (const width of [390, 720, 721, 1440]) {
    const window = new Window({width, height:844});
    try {
      window.document.head.innerHTML = `<style>${css}</style>`;
      window.document.body.className = 'city-workbench';
      window.document.body.innerHTML = `<div id="panel-content"><section class="property-workspace">
        <div class="property-sticky"><div class="property-workspace-tools">Property workspace</div>
          <div class="property-tabs">Map · Activity</div><div class="property-context">
            <div><strong>871 STONE MEADOW DR</strong><small>County parcel and source tax year</small></div>
            <button>Back to results</button><button>Save to notebook</button>
          </div></div>
        <div class="atlas-actions"><button data-atlas="reset">Fit selected region ↗</button></div>
      </section></div>`;
      const context = window.document.querySelector('.property-sticky');
      assert.equal(window.getComputedStyle(context).position, width <= 720 ? 'static' : 'sticky');
      assert.equal(window.getComputedStyle(context.querySelector('.property-tabs')).position, 'static',
        'the tab row does not leave another sticky overlay behind');
    } finally { await window.happyDOM.abort(); }
  }
});

test('the observed mobile selection leaves a valid camera fitting rectangle', () => {
  const boxes = [
    [16,14,276,44], [14,72,362,42], [14,127,183,38],
    [14,383.523,362,354.477], [12,754,366,61], [13,824.5,364,10.5],
  ].map(([left,top,width,height]) => ({left,top,width,height}));
  const viewport = propertyAtlasAvailableViewport({left:0,top:0,width:390,height:844}, boxes);
  assert.deepEqual({...viewport,height:undefined}, {left:0,top:177,width:390,height:undefined,fullWidth:390,fullHeight:844});
  assert.ok(Math.abs(viewport.height - 194.523) < 1e-9);
});
