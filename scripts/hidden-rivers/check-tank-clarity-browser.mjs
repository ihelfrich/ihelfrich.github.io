import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/hidden-rivers-browser/node_modules/playwright/index.mjs');
const base=process.env.HIDDEN_RIVERS_BASE_URL||'http://127.0.0.1:4329';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
if(process.env.TANK_FORCE_CANVAS==='1')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
const physicalKeys=['time','saltIntegral','dyeIntegral','steps'];
const unchanged=(a,b)=>{for(const key of physicalKeys)assert.equal(a[key],b[key],key+' must survive a display change');};
async function colorCounts(){return page.evaluate(()=>{
 document.querySelector('#tank-plane').dispatchEvent(new Event('input'));
 const source=document.querySelector('#dye-tank-canvas'),copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
 const ctx=copy.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data;let cyan=0,coral=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i+2]>55&&pixels[i+2]>pixels[i]*1.3)cyan++;if(pixels[i]>65&&pixels[i]>pixels[i+2]*1.4)coral++;}return {cyan,coral};
});}
try{
 await page.goto(base+'/hidden-rivers/tank/');await page.waitForFunction(()=>window.__dyeTank?.diagnostics?.time>2);
 assert.equal(await page.locator('.tank-advanced').getAttribute('open'),null);if(process.env.TANK_FORCE_CANVAS==='1')assert.match(await page.evaluate(()=>window.__dyeTank.renderStats.mode),/^canvas/);
 for(const selector of ['[data-tank-field=vorticity-z]','#tank-drop-button']){const box=await page.locator(selector).boundingBox();assert.ok(box.y>=0&&box.y+box.height<1000,'Primary controls should be in the initial desktop view');}
 await page.locator('#tank-pause').click();await page.waitForTimeout(200);const before=await page.evaluate(()=>window.__dyeTank.diagnostics);
 await page.locator('[data-tank-field=vorticity-z]').click();await page.waitForFunction(()=>window.__dyeTank.diagnostics.vorticityMax>0);
 const after=await page.evaluate(()=>window.__dyeTank.diagnostics);unchanged(before,after);
 assert.deepEqual(await page.evaluate(()=>window.__dyeTank.getState()),{field:'vorticity-z',geometry:'section',plane:.5,paused:true,preset:'salt'});
 assert.equal(await page.locator('[data-tank-field=vorticity-z]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-tank-geometry=section]').getAttribute('aria-pressed'),'true');
 const camera=await page.evaluate(()=>window.__dyeTank.getCamera());assert.ok(camera.forward[2]<-.999999);
 assert.match(await page.locator('#tank-vorticity-note').textContent(),/counterclockwise.*clockwise/);
 assert.equal(await page.locator('#tank-legend-zero').isVisible(),true);
 const keyBox=await page.locator('.tank-stage-key').boundingBox();assert.ok(keyBox.y+keyBox.height<=1000,'The full vorticity key should fit in the desktop viewport');
 const sectionPixels=await colorCounts();assert.ok(sectionPixels.cyan>150&&sectionPixels.coral>150,'Both turning directions must be visible: '+JSON.stringify(sectionPixels));
 await page.screenshot({path:process.env.TANK_CLARITY_SCREENSHOT||'/tmp/tank-clarity-desktop.png'});
 await page.locator('#tank-plane').fill('3');await page.locator('#tank-plane').dispatchEvent('input');const edgePixels=await colorCounts();
 assert.ok(edgePixels.cyan<sectionPixels.cyan*.5&&edgePixels.coral<sectionPixels.coral*.5,'Changing the physical section should sample a different part of the water');unchanged(after,await page.evaluate(()=>window.__dyeTank.diagnostics));
 await page.locator('#tank-plane').fill('50');await page.locator('#tank-plane').dispatchEvent('input');
 await page.locator('[data-tank-field=dye]').click();assert.equal(await page.locator('#tank-legend').isVisible(),false);assert.equal((await page.evaluate(()=>window.__dyeTank.getState())).geometry,'section');
 await page.locator('[data-tank-geometry=volume]').click();assert.ok((await page.evaluate(()=>window.__dyeTank.getCamera())).elevation>.1);unchanged(after,await page.evaluate(()=>window.__dyeTank.diagnostics));
 await page.locator('[data-tank-field=vorticity-z]').click();await page.locator('#tank-present').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));
 for(const selector of ['.tank-controls','.tank-display','.tank-stage-key','.tank-heading','.tank-ruler'])assert.equal(await page.locator(selector).isVisible(),false,selector+' must be hidden in presentation');
 const bounds=await page.locator('.tank-stage').boundingBox();assert.ok(Math.abs(bounds.x)<1&&Math.abs(bounds.y)<1&&Math.abs(bounds.width-1440)<1&&Math.abs(bounds.height-1000)<1);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('.folio-is-presenting'));
 await page.evaluate(()=>{const root=document.querySelector('.ocean-folio'),native=root.requestFullscreen.bind(root);root.requestFullscreen=async()=>{const result=native();await new Promise(resolve=>setTimeout(resolve,250));return result;};});
 await page.locator('#tank-present').click();await page.keyboard.press('Escape');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement||document.querySelector('.folio-is-presenting'))),false,'A late fullscreen request must not trap the user');
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tank-field=vorticity-z]').scrollIntoViewIfNeeded();
 assert.equal(await page.locator('[data-tank-field=vorticity-z]').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/tank-clarity-mobile.png'});
 await page.locator('.tank-advanced summary').click();await page.locator('#tank-view').selectOption('vorticity');assert.match(await page.locator('#tank-reading').textContent(),/all three axes/);
 await page.goto(base+'/hidden-rivers/tank/?field=vorticity-z&geometry=section&section=0.35');await page.waitForFunction(()=>window.__dyeTank?.diagnostics);
 const linkedState=await page.evaluate(()=>window.__dyeTank.getState());assert.equal(linkedState.geometry,'section');assert.equal(linkedState.field,'vorticity-z');assert.equal(linkedState.plane,.35);
 await page.locator('#tank-pause').click();await page.waitForTimeout(200);const dropBefore=await page.evaluate(()=>({diagnostics:window.__dyeTank.diagnostics,camera:window.__dyeTank.getCamera()}));
 await page.locator('#tank-drop-button').click();await page.waitForFunction(value=>window.__dyeTank.diagnostics.dyeIntegral>value,dropBefore.diagnostics.dyeIntegral);
 assert.deepEqual(await page.evaluate(()=>window.__dyeTank.getCamera()),dropBefore.camera,'A paused injection must preserve the aligned section camera');
 assert.equal((await page.evaluate(()=>window.__dyeTank.diagnostics)).time,dropBefore.diagnostics.time);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,sectionPixels,edgePixels,physicalStateUnchanged:true,directLink:true,mobile:true,presentation:true}));
}finally{await browser.close();}
