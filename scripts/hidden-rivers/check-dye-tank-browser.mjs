const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.HIDDEN_RIVERS_BASE_URL||'http://127.0.0.1:4329';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/hidden-rivers/folio/?study=density&image=atlantic-density#saltwater-demo');
 const frame=page.frameLocator('#atlas-prints');await frame.locator('#dye-tank-canvas').waitFor({timeout:15000});
 const child=page.frames().find(f=>f.url().includes('/prints/'));await child.waitForFunction(()=>window.__dyeTank?.diagnostics?.time>.6,null,{timeout:20000});
 await frame.locator('#tank-pause').click();const first=await child.evaluate(()=>window.__dyeTank.diagnostics);
 assert.ok(first.maxSpeed>0);assert.ok(first.divergenceRms<1e-6);
 const pausedFrames=await child.evaluate(()=>window.__dyeTank.renderStats.frames);await page.waitForTimeout(150);assert.equal(await child.evaluate(()=>window.__dyeTank.renderStats.frames),pausedFrames,'Paused rendering must sleep');
 await frame.locator('#tank-present').click();await frame.locator('.folio-present-tank.folio-is-presenting').waitFor();
 assert.equal(await frame.locator('.tank-controls').isVisible(),false);assert.equal(await frame.locator('#dye-tank-canvas').isVisible(),true);
 await frame.locator('#dye-tank-canvas').focus();await frame.locator('#dye-tank-canvas').press('Space'); await child.waitForFunction(()=>window.__dyeTank.diagnostics?.time>1,null,{timeout:12000}); await frame.locator('#folio-pause').click(); await page.waitForTimeout(250);const heldTime=await child.evaluate(()=>window.__dyeTank.diagnostics.time);await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();});await page.keyboard.press('Space');await child.waitForFunction(time=>window.__dyeTank.diagnostics?.time>time+.1,heldTime,{timeout:6000});await frame.locator('#folio-pause').click();await frame.locator('#folio-exit').click();await frame.locator('.tank-controls').waitFor();
 await frame.locator('[data-tank-preset=fresh]').click();await frame.locator('#tank-pause').click();
 await child.waitForFunction(()=>window.__dyeTank.diagnostics?.time>.6,null,{timeout:20000});await frame.locator('#tank-pause').click();
 const fresh=await child.evaluate(()=>window.__dyeTank.diagnostics);assert.ok(fresh.dyeCentroid.y>.1 && fresh.dyeCentroid.y<.152);assert.ok(fresh.salinityMax<=30.00001);
 await frame.locator('#tank-view').selectOption('vorticity');await frame.locator('#tank-view').selectOption('salinity');
 await frame.locator('#tank-flow').check();await frame.locator('#tank-flow-canvas').waitFor();await frame.locator('#tank-flow').uncheck();
 await frame.locator('#tank-view').selectOption('dye');await child.evaluate(()=>document.getElementById('saltwater-demo').scrollIntoView()); await frame.locator('#tank-pause').click();const beforeDrop=await child.evaluate(()=>window.__dyeTank.diagnostics.dyeIntegral);await frame.locator('#dye-tank-canvas').click({position:{x:200,y:200}});await child.waitForFunction(before=>window.__dyeTank.diagnostics.dyeIntegral>before,beforeDrop);
 // Continuous pouring must create more than a pointer-down drop.
 await frame.locator('#tank-pause').click();const beforeDrag=await child.evaluate(()=>window.__dyeTank.diagnostics.dyeIntegral);
 const box=await frame.locator('#dye-tank-canvas').boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.25);await page.mouse.down();
 for(let i=1;i<=5;i++){await page.mouse.move(box.x+box.width*(.25+.06*i),box.y+box.height*.25);await page.waitForTimeout(80);}await page.mouse.up();
 await child.waitForFunction(before=>window.__dyeTank.diagnostics.dyeIntegral>before+.0001,beforeDrag);
 await frame.locator('#tank-view').selectOption('salinity');await frame.locator('#tank-view').selectOption('dye');
 await page.setViewportSize({width:390,height:844});assert.equal(await child.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 const fallback=await browser.newPage({viewport:{width:900,height:900}});
 await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return this.id==='dye-tank-canvas'&&kind==='webgl2'?null:original.call(this,kind,...args);};});
 fallback.on('pageerror',e=>errors.push(e.message));await fallback.goto(base+'/hidden-rivers/prints/?study=density&image=atlantic-density#saltwater-demo');
 await fallback.waitForFunction(()=>window.__dyeTank?.diagnostics?.time>.2,null,{timeout:20000});assert.equal(await fallback.evaluate(()=>window.__dyeTank.renderStats.mode),'canvas');await fallback.close();
 const calm=await browser.newPage({viewport:{width:900,height:900},reducedMotion:'reduce'});calm.on('pageerror',e=>errors.push(e.message));
 await calm.goto(base+'/hidden-rivers/prints/?study=density&image=atlantic-density#saltwater-demo');await calm.waitForFunction(()=>window.__dyeTank?.diagnostics);
 await calm.waitForTimeout(200);assert.equal(await calm.evaluate(()=>window.__dyeTank.diagnostics.time),0);await calm.locator('#tank-start-button').click();
 await calm.waitForFunction(()=>window.__dyeTank.diagnostics.time>.1,null,{timeout:20000});await calm.close();
 assert.deepEqual(errors,[]);console.log('PASS: legacy density anchor, browser physics, pause, fresh/salt presets, drag pouring, sleeping pause, text-free tank presentation and mobile.');
}finally{await browser.close();}
