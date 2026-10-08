// Reproduce the preregistered v5 browser checks against the local dev server.
// node scripts/hidden-rivers/verify-tank-gpu-browser.mjs
// HIDDEN_RIVERS_DEV_URL and HIDDEN_RIVERS_PLAYWRIGHT_MODULE may be overridden.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const playwrightPath=process.env.HIDDEN_RIVERS_PLAYWRIGHT_MODULE||'/tmp/hidden-rivers-browser/node_modules/playwright/index.mjs';
const base=process.env.HIDDEN_RIVERS_DEV_URL||'http://localhost:4328';
const output=resolve(root,'public/hidden-rivers/dye-tank/verification-gpu.json');
const sources={
  modelRegister:'docs/hidden-rivers/dye-tank-gpu-model.md',
  core:'src/scripts/hidden-rivers/dye-tank-3d.mjs',
  vorticity:'src/scripts/hidden-rivers/tank-vorticity.mjs',
  gpu:'src/scripts/hidden-rivers/tank-gpu-momentum.mjs',
  wasmWrapper:'src/scripts/hidden-rivers/tank-3d-kernels.mjs',
  wasmSource:'src/scripts/hidden-rivers/tank-3d-kernels.c',
  wasmBinary:'public/hidden-rivers/dye-tank/tank-kernels.wasm',
  verifier:'scripts/hidden-rivers/verify-tank-gpu-browser.mjs',
};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=Object.fromEntries(await Promise.all(Object.entries(sources).map(async([key,path])=>[key,sha256(await readFile(resolve(root,path)))])));
const {chromium}=await import(playwrightPath);
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
let result,warning=[];
try{
  const page=await browser.newPage();
  page.on('console',message=>{if(['warning','error'].includes(message.type()))warning.push(message.text());});
  page.on('pageerror',error=>warning.push(error.message));
  await page.route('**/tank-gpu-verification-probe',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Tank GPU verification</title>'}));
  await page.goto(`${base}/tank-gpu-verification-probe`);
  result=await page.evaluate(async()=>{
    const {createDyeTank3D}=await import('/src/scripts/hidden-rivers/dye-tank-3d.mjs');
    const {instantiateTankKernels}=await import('/src/scripts/hidden-rivers/tank-3d-kernels.mjs');
    const {createTankGpuMomentum}=await import('/src/scripts/hidden-rivers/tank-gpu-momentum.mjs');
    const wasm=await (await fetch('/hidden-rivers/dye-tank/tank-kernels.wasm')).arrayBuffer();
    const accelerator=await createTankGpuMomentum();
    if(!accelerator)throw new Error('WebGPU adapter/device unavailable in browser verification');
    if(typeof createDyeTank3D({nx:16,ny:16,nz:16}).stepAsync!=='function')throw new Error('Tank3D.stepAsync is not available');
    const cube={width:.24,height:.24,depth:.24};
    const report={browserUserAgent:navigator.userAgent,webgpuBackend:accelerator.backend,momentum:[],plumes:[],rest:[],taylorGreen:[]};
    const create=async options=>createDyeTank3D({...options,kernels:await instantiateTankKernels(wasm)});
    function diagnostic(t){
      const d=t.diagnostics();
      return {time:d.time,steps:d.steps,dyeCentroid:d.dyeCentroid,maxSpeed:d.maxSpeed,maxW:d.maxW,
        divergenceRms:d.divergenceRms,saltLedgerResidual:Math.abs(d.saltIntegral-t.initialSaltIntegral-t.injectedSaltIntegral),
        dyeLedgerResidual:Math.abs(d.dyeIntegral-t.injectedDyeIntegral)};
    }
    async function advance(t,duration,dt,mode){
      const count=Math.round(duration/dt),start=performance.now(),gpuSteps=accelerator.stats.steps;
      for(let i=0;i<count;i++){
        if(mode==='gpu')await t.stepAsync(dt,accelerator);
        else t.step(dt);
      }
      return {wallMilliseconds:performance.now()-start,acceleratedMomentumCalls:accelerator.stats.steps-gpuSteps,...diagnostic(t)};
    }
    try{
      for(const n of [16,32]){
        const reference=createDyeTank3D({...cube,nx:n,ny:n,nz:n});
        const candidate=createDyeTank3D({...cube,nx:n,ny:n,nz:n});
        let seed=1793;
        const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        for(let axis=0;axis<3;axis++){
          const phase=[random()*6.28,random()*6.28,random()*6.28];
          const face=reference.velocity[axis],other=candidate.velocity[axis],[sx,sy,sz]=face.shape;
          for(let k=0;k<sz;k++)for(let j=0;j<sy;j++)for(let i=0;i<sx;i++){
            const d=(k*sy+j)*sx+i,x=i/(sx-1),y=j/(sy-1),z=k/(sz-1);
            const v=[i,j,k][axis]===0||[i,j,k][axis]===face.shape[axis]-1?0:
              .003*(Math.sin(2*Math.PI*x+phase[0])*Math.cos(2*y+phase[1])*Math.cos(3*z+phase[2])
                   +.22*Math.cos(3*x+5*y+2*z+phase[0]));
            face.data[d]=other.data[d]=v;
          }
        }
        reference.advectVelocity(.01);
        await accelerator.momentum(candidate,.01);
        let maxError=0,finite=true;
        for(let axis=0;axis<3;axis++){
          const expected=reference.velocity[axis].data,actual=candidate.velocity[axis].next;
          for(let i=0;i<expected.length;i++){
            maxError=Math.max(maxError,Math.abs(expected[i]-actual[i]));finite&&=Number.isFinite(actual[i]);
          }
        }
        report.momentum.push({grid:[n,n,n],maxComponentErrorMetresPerSecond:maxError,finite});
      }
      for(const dt of [.01,.02]){
        const pair=[];
        for(const mode of ['wasm','gpu']){
          const t=await create({...cube,nx:32,ny:32,nz:32});
          t.drop({x:.12,y:.045,z:.12,radius:.022,salinity:36});
          pair.push({mode,...await advance(t,1,dt,mode)});
        }
        const [reference,hybrid]=pair;
        report.plumes.push({grid:[32,32,32],duration:1,requestedDt:dt,drop:{radiusMetres:.022,salinityGramsPerKilogram:36,ambientSalinityGramsPerKilogram:30},
          reference,hybrid,centroidDifferenceMetres:Math.hypot(reference.dyeCentroid.x-hybrid.dyeCentroid.x,reference.dyeCentroid.y-hybrid.dyeCentroid.y,reference.dyeCentroid.z-hybrid.dyeCentroid.z)});
      }
      report.plumeTimestepSensitivityMetres={wasm:Math.abs(report.plumes[0].reference.dyeCentroid.y-report.plumes[1].reference.dyeCentroid.y),
        hybrid:Math.abs(report.plumes[0].hybrid.dyeCentroid.y-report.plumes[1].hybrid.dyeCentroid.y)};
      const layers=[{bottom:.04,salinity:0},{bottom:.09,salinity:20},{bottom:.13,salinity:30},{bottom:.18,salinity:40}];
      for(const setup of ['four-layers','neutral-drop']){
        const pair=[];
        for(const mode of ['wasm','gpu']){
          const t=await create(setup==='four-layers'?{nx:32,ny:32,nz:32,layers,transition:.008}:{...cube,nx:32,ny:32,nz:32});
          if(setup==='neutral-drop')t.drop({x:.12,y:.12,z:.12,radius:.014,salinity:30});
          pair.push({mode,...await advance(t,.3,.01,mode)});
        }
        report.rest.push({setup,reference:pair[0],hybrid:pair[1]});
      }
      for(const grid of [[32,32,32],[64,64,32]]){
        const pair=[],waveNumber=Math.PI/.24;
        for(const mode of ['wasm','gpu']){
          const [nx,ny,nz]=grid,t=await create({...cube,nx,ny,nz,walls:'free-slip'}),amplitude=.01;
          for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<=nx;x++)t.u[(z*ny+y)*(nx+1)+x]=amplitude*Math.sin(waveNumber*x*t.dx)*Math.cos(waveNumber*(y+.5)*t.dy);
          for(let z=0;z<nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<nx;x++)t.v[(z*(ny+1)+y)*nx+x]=-amplitude*Math.cos(waveNumber*(x+.5)*t.dx)*Math.sin(waveNumber*y*t.dy);
          t.project();
          const energy=()=>{let sum=0;for(const c of t.velocity)for(const v of c.data)sum+=v*v;return .5*sum*t.dx*t.dy*t.dz;};
          const initialEnergy=energy(),evolved=await advance(t,.3,.01,mode),observedEnergy=energy();
          const analyticEnergy=initialEnergy*Math.exp(-4*t.viscosity*waveNumber*waveNumber*.3);
          pair.push({mode,...evolved,initialEnergy,analyticEnergy,observedEnergy,relativeEnergyError:Math.abs(observedEnergy/analyticEnergy-1)});
        }
        report.taylorGreen.push({grid,reference:pair[0],hybrid:pair[1],relativeEnergyErrorDifference:pair[1].relativeEnergyError-pair[0].relativeEnergyError});
      }
      report.gpuStats={...accelerator.stats};
      return report;
    }finally{accelerator.dispose();}
  });
}catch(error){result={executionError:String(error),browserWarnings:warning};}
finally{await browser.close();}

const checks=[];
const check=(name,passed,actual,limit)=>checks.push({name,passed,actual,limit});
if(!result.executionError){
  for(const m of result.momentum){
    check(`momentum ${m.grid.join('x')} component error`,m.maxComponentErrorMetresPerSecond<5e-7,m.maxComponentErrorMetresPerSecond,5e-7);
    check(`momentum ${m.grid.join('x')} finite`,m.finite,m.finite,true);
  }
  for(const p of result.plumes){
    check(`plume centroid ${p.requestedDt}s`,p.centroidDifferenceMetres<.00025,p.centroidDifferenceMetres,.00025);
    for(const row of [p.reference,p.hybrid]){
      check(`plume ${p.requestedDt}s ${row.mode} salt ledger`,row.saltLedgerResidual<1e-12,row.saltLedgerResidual,1e-12);
      check(`plume ${p.requestedDt}s ${row.mode} dye ledger`,row.dyeLedgerResidual<1e-12,row.dyeLedgerResidual,1e-12);
      check(`plume ${p.requestedDt}s ${row.mode} divergence`,row.divergenceRms<1e-8,row.divergenceRms,1e-8);
      if(row.mode==='gpu')check(`plume ${p.requestedDt}s uses GPU`,row.acceleratedMomentumCalls>0,row.acceleratedMomentumCalls,'>0');
    }
  }
  for(const r of result.rest)for(const row of [r.reference,r.hybrid]){
    check(`${r.setup} ${row.mode} rest speed`,row.maxSpeed<1e-12,row.maxSpeed,1e-12);
    check(`${r.setup} ${row.mode} salt ledger`,row.saltLedgerResidual<1e-12,row.saltLedgerResidual,1e-12);
    check(`${r.setup} ${row.mode} dye ledger`,row.dyeLedgerResidual<1e-12,row.dyeLedgerResidual,1e-12);
    check(`${r.setup} ${row.mode} divergence`,row.divergenceRms<1e-8,row.divergenceRms,1e-8);
    if(row.mode==='gpu')check(`${r.setup} uses GPU`,row.acceleratedMomentumCalls>0,row.acceleratedMomentumCalls,'>0');
  }
  for(const t of result.taylorGreen)for(const row of [t.reference,t.hybrid]){
    check(`Taylor-Green ${t.grid.join('x')} ${row.mode} energy`,row.relativeEnergyError<1e-4,row.relativeEnergyError,1e-4);
    check(`Taylor-Green ${t.grid.join('x')} ${row.mode} divergence`,row.divergenceRms<1e-8,row.divergenceRms,1e-8);
    if(row.mode==='gpu')check(`Taylor-Green ${t.grid.join('x')} uses GPU`,row.acceleratedMomentumCalls>0,row.acceleratedMomentumCalls,'>0');
  }
}
const manifest={model:'salinity-dye-tank-3d-v5-hybrid-candidate',generatedAt:new Date().toISOString(),passed:!result.executionError&&!warning.length&&checks.every(c=>c.passed),
  sourceSha256:hashes,runtime:{node:process.version,browser:browser.version(),origin:base,headlessMetal:process.platform==='darwin'},
  thresholds:{momentumMaxErrorMetresPerSecond:5e-7,plumeCentroidDifferenceMetres:.00025,ledgerResidual:1e-12,projectedDivergencePerSecond:1e-8,restMaxSpeedMetresPerSecond:1e-12,taylorGreenRelativeEnergyError:1e-4},
  browserWarnings:warning,checks,results:result,
  scope:'Browser numerical and timing verification of a Float32 GPU momentum candidate with Float64 pressure and scalar operations. This does not validate turbulent mixing or laboratory morphology.'};
await writeFile(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({passed:manifest.passed,failures:checks.filter(c=>!c.passed),executionError:result.executionError||null,
  plumeCentroidDifferenceMillimetres:result.plumes?.map(p=>p.centroidDifferenceMetres*1000),
  taylorGreenRelativeEnergyErrors:result.taylorGreen?.map(t=>({grid:t.grid,wasm:t.reference.relativeEnergyError,hybrid:t.hybrid.relativeEnergyError})),
  wallMilliseconds:result.plumes?.map(p=>({dt:p.requestedDt,wasm:p.reference.wallMilliseconds,hybrid:p.hybrid.wallMilliseconds}))},null,2));
if(!manifest.passed)process.exitCode=1;
