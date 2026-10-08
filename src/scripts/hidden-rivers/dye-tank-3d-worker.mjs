import {createDyeTank3D} from './dye-tank-3d.mjs';
import {instantiateTankKernels} from './tank-3d-kernels.mjs';
import {createTankGpuMomentum} from './tank-gpu-momentum.mjs';
const acceleration=fetch('/hidden-rivers/dye-tank/tank-kernels.wasm').then(r=>{if(!r.ok)throw new Error('Kernel unavailable');return r.arrayBuffer();}).then(instantiateTankKernels).catch(()=>null);
const gpuAcceleration=createTankGpuMomentum().catch(()=>null);
let tank,version=0,includeVorticity=false,queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try{
  if(data.type==='reset'){const kernels=await acceleration;kernels?.reset();const next=createDyeTank3D({...data.options,kernels});if(data.drop)next.drop(data.drop);tank=next;version=data.version;}
  else if(data.version!==version||!tank)return;
  else if(data.type==='drop')tank.drop(data.drop);
  else if(data.type==='advance'){const gpu=await gpuAcceleration;for(let n=0;n<Math.min(2,Math.max(0,data.count));n++){if(gpu)await tank.stepAsync(.02,gpu);else tank.step(.02);}}
  if(typeof data.includeVorticity==='boolean')includeVorticity=data.includeVorticity;
  const snapshot=tank.snapshot({includeVorticity}),transfer=[snapshot.volume.buffer];if(snapshot.vorticity)transfer.push(snapshot.vorticity.buffer);self.postMessage({type:'frame',version,operation:data.type,request:data.request,snapshot},transfer);
 }catch(error){self.postMessage({type:'error',version:data.version,message:error.message});}
 });};
