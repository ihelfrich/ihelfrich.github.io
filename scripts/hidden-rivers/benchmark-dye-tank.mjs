// Manual pacing evidence, not a hardware-dependent CI gate.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.HIDDEN_RIVERS_BASE_URL||'http://127.0.0.1:4329';
const gpu=process.env.HIDDEN_RIVERS_GPU==='metal'?'metal':'swiftshader';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle',`--use-angle=${gpu}`,...(gpu==='swiftshader'?['--enable-unsafe-swiftshader']:[])]});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/hidden-rivers/folio/?study=density&image=atlantic-density#saltwater-demo');
 const child=page.frameLocator('#atlas-prints');
 if(process.env.HIDDEN_RIVERS_TANK_QUALITY){await child.locator('.tank-advanced').evaluate(element=>{element.open=true;});await child.locator('#tank-quality').selectOption(process.env.HIDDEN_RIVERS_TANK_QUALITY);}
 await child.locator('#tank-present').click();const frame=page.frames().find(f=>f.url().includes('/prints/'));
 await frame.waitForFunction(()=>window.__dyeTank?.diagnostics?.time>.3);
 const stats=await frame.evaluate(async()=>{
  let running=true,last=window.__dyeTank.renderStats.frames;const updates=[],physicalTimes=new Set();
  const observe=()=>{if(!running)return;const n=window.__dyeTank.renderStats.frames;if(n!==last){updates.push(performance.now());last=n;physicalTimes.add(window.__dyeTank.diagnostics.time);}requestAnimationFrame(observe);};requestAnimationFrame(observe);
  const start=window.__dyeTank.diagnostics.time;await new Promise(resolve=>setTimeout(resolve,6000));running=false;
  const gaps=updates.slice(1).map((t,i)=>t-updates[i]).sort((a,b)=>a-b);
  return {...window.__dyeTank.renderStats,grid:window.__dyeTank.diagnostics.grid,acceleration:window.__dyeTank.diagnostics.acceleration,paintFps:updates.length/6,physicsSnapshotsObservedFps:physicalTimes.size/6,p95GapMs:gaps[Math.floor(gaps.length*.95)],maxGapMs:Math.max(...gaps),simSeconds:window.__dyeTank.diagnostics.time-start};
 });
 if(errors.length)throw new Error(errors.join('; '));console.log(JSON.stringify({gpu,viewport:[1440,1000],intervalS:6,...stats}));
 if(process.env.HIDDEN_RIVERS_SCREENSHOT){await child.locator('#dye-tank-canvas').press('Space');await child.locator('#dye-tank-canvas').blur();await child.locator('#dye-tank-canvas').screenshot({path:process.env.HIDDEN_RIVERS_SCREENSHOT});}
}finally{await browser.close();}
