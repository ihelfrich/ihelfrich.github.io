import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.HIDDEN_RIVERS_BASE_URL||'http://127.0.0.1:4329';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.HIDDEN_RIVERS_GPU||'metal'}`,'--enable-unsafe-swiftshader',...(process.env.CURRENT_HOST_RESOLVER_RULES?[`--host-resolver-rules=${process.env.CURRENT_HOST_RESOLVER_RULES}`]:[])]});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function globeReady(){await page.waitForFunction(()=>{const host=document.getElementById('atlas-world'),canvas=host?.querySelector('canvas');return window.__waterAtlas?.state.view==='world'&&canvas&&!host.hidden&&!host.classList.contains('atlas-world-loading')&&Number(getComputedStyle(canvas).opacity)>.9;},null,{timeout:45000});}
try{
 await page.goto(base+'/hidden-rivers/folio/?place=global&layer=currents&view=world&tab=ocean');await globeReady();
 assert.equal(await page.locator('.atlas-tabs #atlas-view-world').count(),1,'Globe must be beside the collection tabs');
 await page.locator('[data-atlas-tab=prints]').click();assert.equal(await page.locator('#atlas-view-world').isVisible(),false);
 await page.locator('[data-atlas-tab=ocean]').click();await globeReady();assert.equal(await page.locator('#atlas-view-world').isVisible(),true);
 for(const collection of ['ocean','satellite']){
  await page.locator(`[data-atlas-tab=${collection}]`).click();await page.locator('#atlas-view-flat').click();await page.waitForFunction(()=>window.__waterAtlas?.state.view==='flat');
  await page.locator('#atlas-view-world').click();await globeReady();assert.equal(await page.locator('#atlas-view-world').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#atlas-world canvas').count(),1);
 }
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#atlas-view-world').isVisible(),true);assert.equal(await page.locator('#atlas-view-flat').isVisible(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(errors.length)throw new Error(errors.join('; '));console.log('PASS: rendered Cesium globe, prominent Globe/Map choices, prints return, both collections, switching projections and mobile layout.');
}finally{await browser.close();}
