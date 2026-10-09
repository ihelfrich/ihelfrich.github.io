// Manual pacing evidence, not a hardware-dependent CI gate.
// Standalone Retina example: HIDDEN_RIVERS_TANK_STANDALONE=1 HIDDEN_RIVERS_DPR=2
// HIDDEN_RIVERS_TANK_QUALITY=fine HIDDEN_RIVERS_TANK_WATER=6 HIDDEN_RIVERS_TANK_PACE=2
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.HIDDEN_RIVERS_BASE_URL||'http://127.0.0.1:4329';
const gpu=process.env.HIDDEN_RIVERS_GPU==='metal'?'metal':'swiftshader';
const standalone=process.env.HIDDEN_RIVERS_TANK_STANDALONE==='1';
const dpr=Number(process.env.HIDDEN_RIVERS_DPR??1);
const intervalS=Number(process.env.HIDDEN_RIVERS_TANK_INTERVAL??6);
assert.ok(dpr>0&&dpr<=4&&intervalS>0&&intervalS<=60,'Bounded display benchmark settings');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle',`--use-angle=${gpu}`,...(gpu==='swiftshader'?['--enable-unsafe-swiftshader']:[])]});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:dpr}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Observe the displayed interpolation uniform on old and new releases alike.
await page.addInitScript(()=>{
 const phases=new WeakSet(),find=WebGL2RenderingContext.prototype.getUniformLocation,send=WebGL2RenderingContext.prototype.uniform1f;
 WebGL2RenderingContext.prototype.getUniformLocation=function(program,name){const location=find.call(this,program,name);if(name==='phase'&&location)phases.add(location);return location;};
 WebGL2RenderingContext.prototype.uniform1f=function(location,value){if(phases.has(location))window.__tankDisplayPhase=value;return send.call(this,location,value);};
});
try{
 await page.goto(base+(standalone?'/hidden-rivers/tank/?field=vorticity&geometry=volume':'/hidden-rivers/folio/?study=density&image=atlantic-density#saltwater-demo'));
 const child=standalone?page:page.frameLocator('#atlas-prints');
 await child.locator('#dye-tank-canvas').waitFor();
 const frame=standalone?page:page.frames().find(f=>f.url().includes('/prints/'));
 await frame.waitForFunction(()=>window.__dyeTank?.diagnostics);
 if(process.env.HIDDEN_RIVERS_TANK_QUALITY||process.env.HIDDEN_RIVERS_TANK_WATER||process.env.HIDDEN_RIVERS_TANK_PACE){
  await child.locator('.tank-advanced').evaluate(element=>{element.open=true;});
  if(process.env.HIDDEN_RIVERS_TANK_QUALITY)await child.locator('#tank-quality').selectOption(process.env.HIDDEN_RIVERS_TANK_QUALITY);
  if(process.env.HIDDEN_RIVERS_TANK_PACE)await child.locator('#tank-speed').selectOption(process.env.HIDDEN_RIVERS_TANK_PACE);
  if(process.env.HIDDEN_RIVERS_TANK_WATER){await child.locator('#tank-water').fill(process.env.HIDDEN_RIVERS_TANK_WATER);await child.locator('#tank-water').dispatchEvent('input');await frame.waitForFunction(s=>{const d=window.__dyeTank?.diagnostics;return d&&Math.abs((s<=36?d.salinityMin:d.salinityMax)-s)<.01;},Number(process.env.HIDDEN_RIVERS_TANK_WATER));}
 }
 if(!standalone)await child.locator('#tank-present').click();
 await frame.waitForFunction(min=>window.__dyeTank?.diagnostics?.time>min,Number(process.env.HIDDEN_RIVERS_TANK_START??.3),{timeout:60000});
 const stats=await frame.evaluate(async intervalS=>{
  const api=window.__dyeTank;let running=true,last=api.renderStats.frames,lastPhase=window.__tankDisplayPhase,held=0;
  const updates=[],physicalTimes=new Set(),longTasks=[];
  const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask',buffered:false});
  const observe=()=>{if(!running)return;const n=api.renderStats.frames;if(n!==last){updates.push(performance.now());last=n;physicalTimes.add(api.diagnostics.time);if(lastPhase===window.__tankDisplayPhase)held++;lastPhase=window.__tankDisplayPhase;}requestAnimationFrame(observe);};requestAnimationFrame(observe);
  const start=api.diagnostics.time;await new Promise(resolve=>setTimeout(resolve,intervalS*1000));running=false;observer.disconnect();
  const gaps=updates.slice(1).map((t,i)=>t-updates[i]).sort((a,b)=>a-b);
  return {...api.renderStats,grid:api.diagnostics.grid,acceleration:api.diagnostics.acceleration,paintFps:updates.length/intervalS,physicsSnapshotsObservedFps:physicalTimes.size/intervalS,heldDisplayFraction:held/updates.length,p95GapMs:gaps[Math.floor(gaps.length*.95)],maxGapMs:Math.max(...gaps),longTasks,simSeconds:api.diagnostics.time-start};
 },intervalS);
 if(errors.length)throw new Error(errors.join('; '));console.log(JSON.stringify({gpu,viewport:[1440,1000],deviceScaleFactor:dpr,standalone,intervalS,ambientSalinity:Number(process.env.HIDDEN_RIVERS_TANK_WATER??30),requestedPace:Number(process.env.HIDDEN_RIVERS_TANK_PACE??1),...stats}));
 if(process.env.HIDDEN_RIVERS_SCREENSHOT){await child.locator('#tank-pause').click();await child.locator('#dye-tank-canvas').blur();await child.locator('#dye-tank-canvas').screenshot({path:process.env.HIDDEN_RIVERS_SCREENSHOT});}
}finally{await browser.close();}
