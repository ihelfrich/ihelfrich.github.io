// Run against the local dev server: node scripts/hidden-rivers/check-tank-gpu-momentum.mjs
// Set HIDDEN_RIVERS_PLAYWRIGHT_MODULE if Playwright is not at the local test path.
// The browser probe is a blank, routed localhost page so site redirects cannot
// destroy the evaluation context. The Metal flag is for this headless test only.
const playwrightPath=process.env.HIDDEN_RIVERS_PLAYWRIGHT_MODULE||'/tmp/hidden-rivers-browser/node_modules/playwright/index.mjs';
const {chromium}=await import(playwrightPath);
const base=process.env.HIDDEN_RIVERS_DEV_URL||'http://localhost:4328';
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
try{
  const page=await browser.newPage();
  const warnings=[];
  page.on('console',message=>{if(['warning','error'].includes(message.type()))warnings.push(message.text());});
  await page.route('**/gpu-momentum-probe',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>GPU momentum check</title>'}));
  await page.goto(`${base}/gpu-momentum-probe`);
  const result=await page.evaluate(async()=>{
    const {createDyeTank3D}=await import('/src/scripts/hidden-rivers/dye-tank-3d.mjs');
    const {createTankGpuMomentum}=await import('/src/scripts/hidden-rivers/tank-gpu-momentum.mjs');
    const gpu=await createTankGpuMomentum();
    if(!gpu)throw new Error('No WebGPU adapter/device in this browser');
    const cases=[];
    try{
      for(const [n,walls] of [[16,'no-slip'],[32,'no-slip'],[32,'free-slip']]){
        const cpu=createDyeTank3D({nx:n,ny:n,nz:n,walls});
        const accelerated=createDyeTank3D({nx:n,ny:n,nz:n,walls});
        for(let axis=0;axis<3;axis++){
          const face=cpu.velocity[axis],other=accelerated.velocity[axis];
          const [sx,sy,sz]=face.shape;
          for(let k=0;k<sz;k++)for(let j=0;j<sy;j++)for(let i=0;i<sx;i++){
            const d=(k*sy+j)*sx+i,x=i/(sx-1),y=j/(sy-1),z=k/(sz-1);
            // Smooth, axis-distinct field with nonzero tangential wall values.
            const v=[i,j,k][axis]===0||[i,j,k][axis]===face.shape[axis]-1?0:
              .003*(Math.sin(2*Math.PI*x+.31*axis)*Math.cos(2*y+.4*axis)*Math.cos(3*z)
                   +.22*Math.cos(3*x+5*y+2*z+.7*axis));
            face.data[d]=other.data[d]=v;
          }
        }
        const cpuStart=performance.now();cpu.advectVelocity(.01);const cpuMs=performance.now()-cpuStart;
        const gpuStart=performance.now();await gpu.momentum(accelerated,.01);const gpuMs=performance.now()-gpuStart;
        let maxError=0,allFinite=true,canonicalUntouched=true;
        for(let axis=0;axis<3;axis++){
          const expected=cpu.velocity[axis].data,actual=accelerated.velocity[axis].next,original=accelerated.velocity[axis].data;
          for(let i=0;i<expected.length;i++){
            maxError=Math.max(maxError,Math.abs(expected[i]-actual[i]));
            allFinite&&=Number.isFinite(actual[i]);
            canonicalUntouched&&=original[i]===cpu.velocity[axis].next[i];
          }
        }
        if(maxError>=5e-7||!allFinite||!canonicalUntouched)throw new Error(`GPU momentum mismatch at ${n}³ ${walls}: ${maxError}`);
        cases.push({n,walls,maxError,cpuMs,gpuMs,allocations:gpu.stats.allocations});
      }
      if(cases[1].allocations!==cases[2].allocations)throw new Error('GPU buffers were reallocated for unchanged grid dimensions');
      const failed=createDyeTank3D({nx:16,ny:16,nz:16});
      for(const face of failed.velocity)face.next.fill(123);
      failed.u[(8*16+8)*17+8]=NaN;
      let rejected=false;
      try{await gpu.momentum(failed,.01);}catch{rejected=true;}
      const atomic=rejected&&failed.velocity.every(face=>face.next.every(value=>value===123));
      if(!atomic)throw new Error('Nonfinite GPU result was not rejected atomically');
      return {backend:gpu.backend,cases,reusedAllocation:true,nonfiniteAtomic:true};
    }finally{gpu.dispose();}
  });
  if(warnings.length)throw new Error(`WebGPU browser warnings: ${warnings.join(' | ')}`);
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
