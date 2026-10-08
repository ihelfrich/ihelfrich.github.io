import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { speedColor } from '../../src/scripts/hidden-rivers/speed-colors.mjs';
import { vorticityColor, VORTICITY_MAX } from '../../src/scripts/hidden-rivers/ocean-vorticity.mjs';

const playwright = await (async () => {
  const requested = process.env.PLAYWRIGHT_MODULE;
  if (requested) return import(pathToFileURL(resolve(requested)).href);
  try { return await import('playwright'); }
  catch { return import('/tmp/hidden-rivers-browser/node_modules/playwright/index.mjs'); }
})();
const { chromium } = playwright;
const base = process.env.HIDDEN_RIVERS_URL || 'http://127.0.0.1:4328/hidden-rivers/';
const browser = await chromium.launch({
  headless: process.env.CURRENT_HEADLESS !== '0',
  args: ['--enable-webgl', '--enable-gpu', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist',...(process.env.CURRENT_HOST_RESOLVER_RULES?[`--host-resolver-rules=${process.env.CURRENT_HOST_RESOLVER_RULES}`]:[])],
});
const errors = [];
const results = {};
const failedHosts=new Map();

try {
  assert.deepEqual(speedColor(0), [76, 29, 149]);
  assert.deepEqual(speedColor(0.8), [255, 209, 226]);
  assert.deepEqual(speedColor(4), speedColor(0.8), 'speeds above the fixed scale must clip at its labeled endpoint');
  assert.deepEqual(vorticityColor(-VORTICITY_MAX), [34, 137, 157]);
  assert.deepEqual(vorticityColor(0), [237, 240, 229]);
  assert.deepEqual(vorticityColor(VORTICITY_MAX), [198, 65, 71]);

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed',request=>{const host=new URL(request.url()).hostname,reason=request.failure()?.errorText||'unknown',key=host+' '+reason;failedHosts.set(key,(failedHosts.get(key)||0)+1);});
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}?place=agulhas&layer=currents&view=flat`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__waterAtlas?.ready?.(), { timeout: 60000 });

  const initial = await page.evaluate(() => ({
    place: window.__waterAtlas.state.place.id,
    legend: document.querySelector('#atlas-legend').textContent,
    speedShading: document.querySelector('#atlas-speed-shading').checked,
  }));
  assert.equal(initial.place, 'agulhas');
  assert.equal(initial.speedShading, false, 'speed field should remain optional by default');
  assert.match(initial.legend, /0\.8/);

  await page.goto(`${base}?place=agulhas&layer=currents&view=flat&diagnostic=vorticity&shading=speed`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__waterAtlas?.ready?.(), { timeout: 60000 });
  const vorticityControls = await page.evaluate(() => ({
    visible: !document.querySelector('#atlas-diagnostic-mode-label').hidden,
    selected: document.querySelector('#atlas-diagnostic-mode').value,
    shadingLabel: document.querySelector('#atlas-speed-shading-label span').textContent,
    legend: document.querySelector('#atlas-legend').textContent,
  }));
  assert.equal(vorticityControls.visible, true);
  assert.equal(vorticityControls.selected, 'vorticity');
  assert.equal(vorticityControls.shadingLabel, 'Field shading');
  assert.match(vorticityControls.legend, /Vertical relative vorticity/);
  assert.match(vorticityControls.legend, /counter-clockwise/);
  assert.match(vorticityControls.legend, /no vertical velocity or f \+ ζ/);
  const legendGradient=await page.locator('.vorticity-colorbar').evaluate(el=>getComputedStyle(el).backgroundImage);
  for(const fraction of [-1,-.5,0,.5,1])assert.ok(legendGradient.includes(`rgb(${vorticityColor(fraction*VORTICITY_MAX).join(', ')})`),'legend must use the exact field palette: '+legendGradient);
  const vorticityField = await page.evaluate(() => {
    const canvas = document.querySelector('.atlas-field-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let colored = 0, cyan = 0, coral = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) {
      colored++;
      if (data[i + 1] > data[i] * 1.25 && data[i + 2] > data[i] * 1.2) cyan++;
      if (data[i] > data[i + 1] * 1.2 && data[i] > data[i + 2] * 1.2) coral++;
    }
    return { colored, cyan, coral };
  });
  assert.ok(vorticityField.colored > 1000, 'vorticity field shading should draw valid derivative cells');
  assert.ok(vorticityField.cyan > 20 && vorticityField.coral > 20, 'vorticity shading should show both signed colors');
  await page.evaluate(() => window.__waterAtlas.inspect({ latlng: { lat: -37.5, lng: 29.0799701397 } }));
  await page.waitForFunction(() => document.querySelector('.velocity-profile.has-vorticity .velocity-profile-zeta'), { timeout: 60000 });
  const zetaProfile = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.velocity-profile-row')].map(row => row.querySelector('.velocity-profile-zeta')?.textContent || null),
    note: document.querySelector('#atlas-spectra-note').textContent,
  }));
  assert.equal(zetaProfile.rows.length, 5, 'selected-depth vorticity profile should include all released HYCOM levels');
  assert.ok(zetaProfile.rows.some(value => value !== '—'), 'wet Agulhas profile should have sampled relative vorticity');
  assert.match(zetaProfile.note, /strict spherical centered stencil/);
  await page.evaluate(() => window.__waterAtlas.setView('world'));
  await page.waitForFunction(() => !document.querySelector('#atlas-world').classList.contains('atlas-world-loading'), { timeout: 60000 });
  await page.waitForFunction(() => {
    const d = window.__waterAtlas.getWorld()?.getDiagnostics();
    return d?.diagnostic === 'vorticity' && d.diagnosticGeometries > 0 && d.diagnosticReady;
  }, { timeout: 60000 });
  const globeVorticity = await page.evaluate(() => window.__waterAtlas.getWorld().getDiagnostics());
  assert.equal(globeVorticity.diagnostic, 'vorticity');
  if (process.env.CURRENT_VORTICITY_SCREENSHOT) await page.screenshot({ path: process.env.CURRENT_VORTICITY_SCREENSHOT });
  results.vorticity = { controls: vorticityControls, field: vorticityField, profile: zetaProfile.rows, globe: globeVorticity };

  await page.goto(`${base}?place=agulhas&layer=currents&view=flat`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__waterAtlas?.ready?.(), { timeout: 60000 });
  const flowPixels = async () => page.evaluate(() => {
    const canvas = document.querySelector('.atlas-flow-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let visible = 0, violetRose = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 12) {
        visible++;
        if (data[i] > data[i + 1] * 1.2 && data[i + 2] > data[i + 1] * 1.2) violetRose++;
      }
    }
    return { visible, violetRose };
  });
  const before = await flowPixels();
  await page.waitForTimeout(700);
  const after = await flowPixels();
  assert.ok(after.visible > 1000, 'moving current trails should be visible');
  assert.ok(after.violetRose > 100, 'current trails should use the violet-to-rose palette');
  assert.notDeepEqual(after, before, 'current trails should visibly move over time');

  await page.locator('#atlas-speed-shading').check();
  await page.waitForTimeout(150);
  const field = await page.evaluate(() => {
    const canvas = document.querySelector('.atlas-field-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) colored++;
    return { colored, checked: document.querySelector('#atlas-speed-shading').checked };
  });
  assert.equal(field.checked, true);
  assert.ok(field.colored > 1000, 'optional speed shading should draw valid source cells');

  await page.evaluate(() => window.__waterAtlas.inspect({ latlng: { lat: -37.5, lng: 29.0799701397 } }));
  await page.waitForFunction(() => document.querySelectorAll('.velocity-profile-row').length === 5, { timeout: 60000 });
  const profile = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.velocity-profile-row')].map(row => ({
      depth: row.dataset.depth,
      text: row.innerText,
      missing: row.querySelector('.velocity-profile-missing') !== null,
    })),
    explanation: document.querySelector('#atlas-spectra-note').textContent,
  }));
  assert.deepEqual(profile.rows.map(row => Number(row.depth)), [0, 200, 500, 1000, 2000]);
  assert.ok(profile.rows.every(row => !row.missing), 'known wet Agulhas point should sample each released level');
  assert.match(profile.explanation, /discrete horizontal-velocity level/i);

  await page.evaluate(() => window.__waterAtlas.setView('world'));
  await page.waitForFunction(() => !document.querySelector('#atlas-world').classList.contains('atlas-world-loading'), { timeout: 60000 });
  await page.waitForFunction(() => window.__waterAtlas.getWorld()?.getDiagnostics().diagnosticGeometries === 650 && window.__waterAtlas.getWorld().getDiagnostics().diagnosticReady, { timeout: 60000 });
  await page.locator('#atlas-depth').selectOption('200');
  await page.waitForTimeout(400);
  await page.locator('#atlas-subsurface').check();
  await page.waitForFunction(() => {
    const diagnostics = window.__waterAtlas.getWorld()?.getDiagnostics();
    return diagnostics?.renderDepth === 200 && diagnostics.subsurface && diagnostics.diagnosticReady;
  }, { timeout: 60000 });
  const depthView = await page.evaluate(() => ({
    diagnostics: window.__waterAtlas.getWorld().getDiagnostics(),
    globeTransparent: window.__waterAtlas.getWorld().viewer.scene.globe.translucency.enabled,
    speedShading: window.__waterAtlas.state.speedShading,
  }));
  assert.equal(depthView.diagnostics.verticalScale, 1);
  assert.equal(depthView.diagnostics.renderDepth, 200);
  assert.equal(depthView.globeTransparent, true);
  assert.equal(depthView.speedShading, false, 'surface raster must turn off in subsurface view');
  results.agulhas = { flow: after, shadedCells: field.colored, profile: profile.rows, subsurface: depthView.diagnostics };
  if (process.env.CURRENT_SCREENSHOT) await page.screenshot({ path: process.env.CURRENT_SCREENSHOT });

  await page.goto(`${base}?place=global&layer=currents&view=world`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__waterAtlas?.ready?.(), { timeout: 60000 });
  await page.waitForFunction(() => window.__waterAtlas.getWorld()?.getDiagnostics().diagnosticGeometries === 1200 && window.__waterAtlas.getWorld().getDiagnostics().diagnosticReady, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const fps = await page.evaluate(async () => {
    const world = window.__waterAtlas.getWorld(), viewer = world.viewer, times = [];
    const remove = viewer.scene.postRender.addEventListener(() => times.push(performance.now()));
    await new Promise(resolve => setTimeout(resolve, 2500));
    remove();
    const intervals = times.slice(1).map((time, index) => time - times[index]);
    const total = intervals.reduce((sum, value) => sum + value, 0);
    return {
      diagnostics: world.getDiagnostics(), frames: times.length,
      fps: intervals.length / (total / 1000),
      p95FrameMs: [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length * 0.95)],
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
    };
  });
  assert.equal(fps.diagnostics.paths, 1200);
  assert.ok(fps.fps >= 30, `global globe should sustain at least 30fps; measured ${fps.fps.toFixed(1)}`);
  results.global = fps;
  if(failedHosts.size)console.log(JSON.stringify({failedRequestsByHost:Object.fromEntries(failedHosts)}));
  assert.deepEqual(errors, [], 'browser console and page should remain error-free');
  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));
} finally {
  await browser.close();
}
